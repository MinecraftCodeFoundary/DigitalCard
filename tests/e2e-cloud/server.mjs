import { randomUUID } from 'node:crypto'
import { buildGateway } from '../../backend/src/gateway.mjs'
import { createService } from '../../cloudfunctions/digitalCard/service.mjs'
import { MemoryRepository, MemoryStorage } from '../../cloudfunctions/tests/fixtures.mjs'
const storage = new MemoryStorage()
const repository = new MemoryRepository()
const service = createService({ repository, storage,
  appId: 'wx-test', webUrl: 'http://localhost:9200', qr: async () => { throw new Error('WeChat not available in browser fixture') } })
let requestSequence = 0
const cloud = {
  callFunction: async ({ data }) => ({ result: await service.handle({ ...data, gatewayIp: `e2e-${++requestSequence}` }, { ENV: 'cloud-test' }) }),
  uploadFile: async ({ cloudPath, fileContent }) => ({ fileID: await storage.upload(cloudPath, fileContent) }),
  deleteFile: async ({ fileList }) => Promise.all(fileList.map(id => storage.remove(id))),
}
const app = await buildGateway({ cloud, corsOrigins: 'http://localhost:9200' })
// Only this loopback-bound, in-memory test server issues browser fixture sessions.
// The production gateway never exposes these routes or accepts browser WeChat identity claims.
const fixtures = new Map()
async function call(path, token = '', method = 'GET', data, context = {}) {
  const response = await service.handle({ path: `/api${path}`, method, token,
    ...(data === undefined ? {} : { data }), gatewayIp: `fixture-${++requestSequence}` }, { ENV: 'cloud-test', ...context })
  if (response.code) throw new Error(response.message)
  return response.data
}
async function setMembership(userId, plan) {
  const user = await repository.get('users', userId)
  user.membership = { plan: plan === 'free' ? 'free' : 'vip',
    expiresAt: plan === 'expired' ? '2000-01-01T00:00:00.000Z' : null }
  await repository.set('users', user.id, user)
}
app.post('/__test/session', { config: { rateLimit: false } }, async (request, reply) => {
  const { plan = 'free' } = request.body || {}
  if (!['free', 'vip', 'expired'].includes(plan)) return reply.code(400).send({ error: 'Invalid fixture plan' })
  const login = await call('/auth/wechat', '', 'POST', {}, { OPENID: `e2e-${randomUUID()}`, APPID: 'wx-test' })
  fixtures.set(login.token, login.account.id)
  await setMembership(login.account.id, plan)
  return { ...login, account: await call('/me/account', login.token), card: await call('/me/card', login.token) }
})
app.post('/__test/membership', { config: { rateLimit: false } }, async (request, reply) => {
  const { token, plan } = request.body || {}
  if (!fixtures.has(token) || !['free', 'vip', 'expired'].includes(plan))
    return reply.code(400).send({ error: 'Unknown fixture session or plan' })
  await setMembership(fixtures.get(token), plan)
  return call('/me/account', token)
})
app.post('/__test/favorites', { config: { rateLimit: false } }, async (request, reply) => {
  const { token, count, prefix } = request.body || {}
  if (!fixtures.has(token) || !Number.isInteger(count) || count < 1 || count > 50
    || typeof prefix !== 'string' || prefix.length > 20)
    return reply.code(400).send({ error: 'Invalid favorites fixture' })
  // Seed through the cloud service without consuming the gateway HTTP quota
  // for every fixture card. Browser interactions still use the real gateway.
  for (let index = 0; index < count; index++) {
    const owner = await call('/auth/wechat', '', 'POST', {}, { OPENID: `e2e-${randomUUID()}`, APPID: 'wx-test' })
    const { id, updatedAt, mediaAccess, mediaUnavailable, isVip, isOwner, isFavorite, savedAt, ...body } = owner.card
    await call('/me/card', owner.token, 'PUT', { ...body, name: `${prefix} ${index + 1}`, published: true })
    await call(`/cards/${id}/favorite`, token, 'PUT')
  }
  return { created: count }
})
await app.listen({ port: 3200, host: '127.0.0.1' })
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0) })

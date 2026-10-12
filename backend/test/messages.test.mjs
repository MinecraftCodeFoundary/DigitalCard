import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp } from '../src/app.mjs'

const defaults = { databasePath: ':memory:', jwtSecret: 'test-secret-of-at-least-32-characters', demoEnabled: true, nodeEnv: 'test' }
const headers = user => ({ authorization: `Bearer ${user.token}` })
async function login(app, devKey) {
  return (await app.inject({ method: 'POST', url: '/api/auth/dev', payload: devKey ? { devKey } : {} })).json().data
}
const message = { name: '  陈小雨  ', contact: '  hello@example.com  ', content: '  想聊聊品牌设计\n下周方便交流吗？  ' }
const send = (app, id, payload = message, ip = '127.0.0.1') => app.inject({ method: 'POST', url: `/api/cards/${id}/messages`, payload, remoteAddress: ip })

test('anonymous visitors can leave private messages and only the card owner can read them', async t => {
  const app = await buildApp(defaults); t.after(() => app.close())
  const owner = await login(app); const other = await login(app)
  const result = await send(app, owner.card.id)
  assert.equal(result.statusCode, 200); assert.deepEqual(result.json().data, { submitted: true })
  assert.equal((await app.inject('/api/me/messages')).statusCode, 401)
  assert.equal((await app.inject({ url: '/api/me/messages', headers: { authorization: 'Bearer forged' } })).statusCode, 401)
  assert.equal((await app.inject(`/api/cards/${owner.card.id}/messages`)).statusCode, 404)
  const own = (await app.inject({ url: '/api/me/messages', headers: headers(owner) })).json().data
  assert.equal(own.total, 1)
  assert.equal(own.items[0].name, '陈小雨'); assert.equal(own.items[0].contact, 'hello@example.com')
  assert.equal(own.items[0].content, '想聊聊品牌设计\n下周方便交流吗？')
  assert.match(own.items[0].id, /^[a-f\d]{24}$/); assert.ok(Number.isFinite(Date.parse(own.items[0].createdAt)))
  const foreign = (await app.inject({ url: `/api/me/messages?cardId=${owner.card.id}`, headers: headers(other) })).json().data
  assert.equal(foreign.total, 0)
  const publicCard = (await app.inject(`/api/cards/${owner.card.id}`)).json().data
  assert.equal(publicCard.messages, undefined)
  assert.ok(!JSON.stringify(publicCard).includes('hello@example.com'))
})

test('messages validate content, reject private cards and paginate newest first', async t => {
  const app = await buildApp(defaults); t.after(() => app.close())
  const owner = await login(app)
  const invalid = [{ ...message, name: ' ' }, { ...message, content: '' }, { ...message, content: 'x'.repeat(1001) }, { ...message, contact: 'x'.repeat(121) }, { ...message, name: 'x'.repeat(31) }, { ...message, card_id: owner.card.id }]
  for (let i = 0; i < invalid.length; i++)
    assert.equal((await send(app, owner.card.id, invalid[i], `10.0.0.${i + 1}`)).statusCode, 400)
  for (let i = 0; i < 3; i++) {
    assert.equal((await send(app, owner.card.id, { name: `访客${i}`, content: `内容${i}` })).statusCode, 200)
    await new Promise(resolve => setTimeout(resolve, 2))
  }
  const first = (await app.inject({ url: '/api/me/messages?page=1&pageSize=2', headers: headers(owner) })).json().data
  assert.equal(first.total, 3); assert.deepEqual(first.items.map(item => item.name), ['访客2', '访客1'])
  assert.equal(first.items[0].contact, '')
  const second = (await app.inject({ url: '/api/me/messages?page=2&pageSize=2', headers: headers(owner) })).json().data
  assert.deepEqual(second.items.map(item => item.name), ['访客0'])
  assert.equal((await app.inject({ url: '/api/me/messages?page=0', headers: headers(owner) })).statusCode, 400)
  const { id, updatedAt, mediaAccess, ...body } = owner.card
  await app.inject({ method: 'PUT', url: '/api/me/card', headers: headers(owner), payload: { ...body, published: false } })
  assert.equal((await send(app, id)).statusCode, 404)
  assert.equal((await app.inject({ url: '/api/me/messages', headers: headers(owner) })).json().data.total, 3)
  assert.equal((await send(app, 'not-an-id', message, '10.0.0.100')).statusCode, 400)
})

test('message submission limits repeated requests and messages survive server restart', async () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), 'card-messages-')), 'cards.sqlite')
  const app = await buildApp({ ...defaults, databasePath })
  const owner = await login(app)
  try {
    for (let i = 0; i < 5; i++) assert.equal((await send(app, owner.card.id)).statusCode, 200)
    assert.equal((await send(app, owner.card.id)).statusCode, 429)
  }
  finally { await app.close() }
  const reopened = await buildApp({ ...defaults, databasePath })
  try {
    const restored = await login(reopened, owner.devKey)
    const inbox = await reopened.inject({ url: '/api/me/messages', headers: headers(restored) })
    assert.equal(inbox.json().data.total, 5)
    assert.equal(inbox.json().data.items[0].content, message.content.trim())
  }
  finally { await reopened.close() }
})

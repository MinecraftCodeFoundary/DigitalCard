import test from 'node:test'
import assert from 'node:assert/strict'
import { createService, blankCard } from '../digitalCard/service.mjs'
import { MemoryRepository, MemoryStorage } from './fixtures.mjs'

async function fixture(membership = { plan: 'free', expiresAt: null }) {
  const db = new MemoryRepository()
  const time = { value: Date.UTC(2026, 9, 11) }
  const service = createService({ repository: db, storage: new MemoryStorage(), appId: 'wx-test',
    envId: 'cloud-test', clock: () => time.value, logger: { error() {} } })
  let sequence = 0
  const call = (path, method = 'GET', token = '') => service.handle({ path: `/api${path}`, method,
    token, gatewayIp: `favorite-test-${++sequence}` })
  const register = async openid => (await service.handle({ path: '/api/auth/wechat', method: 'POST' },
    { OPENID: openid, APPID: 'wx-test' })).data
  const owner = await register('owner')
  const collector = await register('collector')
  const user = await db.get('users', collector.account.id)
  await db.set('users', user.id, { ...user, membership })
  const ids = Array.from({ length: 51 }, (_, index) => (index + 1).toString(16).padStart(24, '0'))
  for (const [index, id] of ids.entries()) await db.set('cards', id, { id, ownerId: owner.account.id,
    body: { ...blankCard, name: `名片 ${index + 1}`, published: true }, updatedAt: new Date(time.value).toISOString() })
  const favorite = (id, method = 'PUT') => call(`/cards/${id}/favorite`, method, collector.token)
  const list = (query = '') => call(`/favorites${query}`, 'GET', collector.token)
  return { db, time, collector, owner, ids, favorite, list, call }
}

for (const [plan, capacity, message] of [
  ['free', 10, '普通用户名片夹最多收藏 10 张名片，VIP 可收藏 50 张'],
  ['vip', 50, 'VIP 名片夹最多收藏 50 张名片，请先移除部分收藏'],
]) test(`${plan} favorites enforce ${capacity} slots, including competing requests, retries and removal`, async () => {
  const f = await fixture({ plan, expiresAt: null })
  assert.equal((await f.list()).data.total, 0)
  for (const id of f.ids.slice(0, capacity - 1)) assert.equal((await f.favorite(id)).code, 0)
  const contenders = f.ids.slice(capacity - 1, capacity + 1)
  const results = await Promise.all(contenders.map(id => f.favorite(id)))
  assert.deepEqual(results.map(result => result.code).sort(), [0, 403])
  assert.equal(results.find(result => result.code === 403).message, message)
  assert.equal(await f.db.count('favorites', { userId: f.collector.account.id }), capacity)
  assert.equal((await f.favorite(f.ids[0])).code, 0, 'an existing favorite consumes no additional slot')
  const page = await f.list('?page=2&pageSize=5')
  assert.equal(page.code, 0)
  assert.equal(page.data.total, capacity)
  assert.equal(page.data.items.length, 5)
  assert.equal((await f.list('?search=%E5%90%8D%E7%89%87%201')).code, 0)
  const rejected = contenders[results.findIndex(result => result.code === 403)]
  assert.equal((await f.favorite(f.ids[0], 'DELETE')).code, 0)
  assert.equal((await f.favorite(f.ids[0], 'DELETE')).code, 0, 'repeated removal remains idempotent')
  assert.equal((await f.favorite(rejected)).code, 0)
  assert.equal(await f.db.count('favorites', { userId: f.collector.account.id }), capacity)
})

test('expired VIP retains and can search/remove excess favorites, but new saves use the free limit', async () => {
  const f = await fixture({ plan: 'vip', expiresAt: '2026-10-11T00:00:01.000Z' })
  for (const id of f.ids.slice(0, 12)) assert.equal((await f.favorite(id)).code, 0)
  f.time.value += 1000
  assert.equal((await f.list()).data.total, 12)
  assert.equal((await f.list('?search=%E5%90%8D%E7%89%87%201')).data.total, 4)
  assert.equal((await f.favorite(f.ids[0])).code, 0)
  assert.equal((await f.favorite(f.ids[12])).code, 403)
  for (const id of f.ids.slice(0, 2)) assert.equal((await f.favorite(id, 'DELETE')).code, 0)
  assert.equal((await f.favorite(f.ids[12])).code, 403, 'ten saves still fill the free quota')
  assert.equal((await f.favorite(f.ids[2], 'DELETE')).code, 0)
  assert.equal((await f.favorite(f.ids[12])).code, 0)
  assert.equal((await f.list()).data.total, 10)
})

test('hidden or missing cards retain their slots until the collector removes the saved relationship', async () => {
  const f = await fixture()
  for (const id of f.ids.slice(0, 10)) assert.equal((await f.favorite(id)).code, 0)
  const hidden = await f.db.get('cards', f.ids[0])
  await f.db.set('cards', hidden.id, { ...hidden, body: { ...hidden.body, published: false } })
  await f.db.remove('cards', f.ids[1])
  const list = (await f.list()).data
  assert.equal(list.total, 8)
  assert.deepEqual(list.unavailableIds.sort(), [hidden.id, f.ids[1]].sort())
  const filtered = (await f.list('?page=3&pageSize=1&search=not-found')).data
  assert.equal(filtered.total, 0)
  assert.deepEqual(filtered.items, [])
  assert.deepEqual(filtered.unavailableIds.sort(), list.unavailableIds)
  const otherAccount = (await f.call('/favorites', 'GET', f.owner.token)).data
  assert.deepEqual(otherAccount.unavailableIds, [], 'saved identifiers belong only to the collector')
  assert.equal((await f.call('/favorites')).code, 401)
  assert.equal((await f.favorite(f.ids[10])).code, 403)
  for (const id of list.unavailableIds) assert.equal((await f.favorite(id, 'DELETE')).code, 0)
  assert.deepEqual((await f.list()).data.unavailableIds, [])
  assert.equal((await f.favorite(f.ids[10])).code, 0)
  assert.equal((await f.favorite(f.ids[11])).code, 0)
  assert.equal((await f.list()).data.total, 10)
})

test('saving a favorite rechecks membership inside the write transaction', async () => {
  const f = await fixture({ plan: 'vip', expiresAt: null })
  for (const id of f.ids.slice(0, 10)) assert.equal((await f.favorite(id)).code, 0)
  const transaction = f.db.transaction.bind(f.db)
  let transactions = 0
  f.db.transaction = work => transaction(async tx => {
    if (++transactions === 2) {
      const user = await tx.get('users', f.collector.account.id)
      await tx.set('users', user.id, { ...user, membership: { plan: 'free', expiresAt: null } })
    }
    return work(tx)
  })
  assert.equal((await f.favorite(f.ids[10])).code, 403)
  assert.equal(await f.db.count('favorites', { userId: f.collector.account.id }), 10)
})

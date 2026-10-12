import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp } from '../src/app.mjs'
import { getOrCreateUser, openDatabase } from '../src/db.mjs'

for (const [testVipFixtures, capacity] of [[false, 10], [true, 50]]) {
  test(`local favorites enforce ${capacity} slots and keep full-list PUT and DELETE idempotent`, async t => {
    const databasePath = join(mkdtempSync(join(tmpdir(), 'card-favorites-')), 'test.sqlite')
    const app = await buildApp({ databasePath, nodeEnv: 'test', demoEnabled: true, testVipFixtures,
      rateLimitMax: 500, jwtSecret: 'favorites-tests-secret-at-least-32-characters' })
    t.after(() => app.close())
    const login = (await app.inject({ method: 'POST', url: '/api/auth/dev', payload: {} })).json().data
    const headers = { authorization: `Bearer ${login.token}` }
    const db = openDatabase(databasePath)
    t.after(() => db.close())
    db.prepare('DELETE FROM favorites WHERE user_id = ?').run(login.account.id)
    const ids = []
    for (let index = 0; index <= capacity; index++) {
      const user = getOrCreateUser(db, `seed:quota-${index}`, true)
      ids.push(db.prepare('SELECT id FROM cards WHERE owner_id = ?').get(user.id).id)
    }
    const favorite = (id, method = 'PUT') => app.inject({ method, url: `/api/cards/${id}/favorite`, headers })
    for (const id of ids.slice(0, capacity - 1)) assert.equal((await favorite(id)).statusCode, 200)
    const contenders = ids.slice(capacity - 1)
    const results = await Promise.all(contenders.map(id => favorite(id)))
    assert.deepEqual(results.map(result => result.statusCode).sort(), [200, 403])
    assert.equal(results.find(result => result.statusCode === 403).json().message, testVipFixtures
      ? 'VIP 名片夹最多收藏 50 张名片，请先移除部分收藏'
      : '普通用户名片夹最多收藏 10 张名片，VIP 可收藏 50 张')
    assert.equal((await favorite(ids[0])).statusCode, 200)
    const list = (await app.inject({ url: '/api/favorites?pageSize=50', headers })).json().data
    assert.equal(list.total, capacity)
    assert.equal(list.items.length, capacity)
    const rejected = contenders[results.findIndex(result => result.statusCode === 403)]
    assert.equal((await favorite(ids[0], 'DELETE')).statusCode, 200)
    assert.equal((await favorite(ids[0], 'DELETE')).statusCode, 200)
    assert.equal((await favorite(rejected)).statusCode, 200)
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?').get(login.account.id).total, capacity)

    const hidden = JSON.parse(db.prepare('SELECT body FROM cards WHERE id = ?').get(ids[1]).body)
    db.prepare('UPDATE cards SET body = ? WHERE id = ?').run(JSON.stringify({ ...hidden, published: false }), ids[1])
    // Reproduce an old orphaned relationship without changing production FK rules.
    db.exec('PRAGMA foreign_keys = OFF')
    db.prepare('DELETE FROM cards WHERE id = ?').run(ids[2])
    db.exec('PRAGMA foreign_keys = ON')
    const unavailable = (await app.inject({ url: '/api/favorites', headers })).json().data
    assert.equal(unavailable.total, capacity - 2)
    assert.deepEqual(unavailable.unavailableIds.sort(), [ids[1], ids[2]].sort())
    const filtered = (await app.inject({ url: '/api/favorites?page=3&pageSize=1&search=not-found', headers })).json().data
    assert.equal(filtered.total, 0)
    assert.deepEqual(filtered.items, [])
    assert.deepEqual(filtered.unavailableIds.sort(), unavailable.unavailableIds)
    const other = (await app.inject({ method: 'POST', url: '/api/auth/dev', payload: {} })).json().data
    assert.deepEqual((await app.inject({ url: '/api/favorites', headers: { authorization: `Bearer ${other.token}` } }))
      .json().data.unavailableIds, [])
    assert.equal((await favorite(ids[0])).statusCode, 403)
    for (const id of unavailable.unavailableIds) assert.equal((await favorite(id, 'DELETE')).statusCode, 200)
    assert.equal((await favorite(ids[0])).statusCode, 200)
    assert.deepEqual((await app.inject({ url: '/api/favorites', headers })).json().data.unavailableIds, [])
  })
}

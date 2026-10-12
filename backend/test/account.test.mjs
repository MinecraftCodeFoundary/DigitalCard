import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp } from '../src/app.mjs'
import { getOrCreateUser, openDatabase } from '../src/db.mjs'

const secret = 'account-tests-with-stable-secret-at-least-32-characters'
const wechat = { login: async code => `openid-${code}` }
async function fixture(t, options = {}) {
  const app = await buildApp({ databasePath: ':memory:', jwtSecret: secret, wechat, nodeEnv: 'test', ...options })
  t.after(() => app.close())
  return app
}
const headers = user => ({ authorization: `Bearer ${user.token}` })
const login = (app, code = 'alice') => app.inject({ method: 'POST', url: '/api/auth/wechat', payload: { code } })
async function signIn(app, code) {
  const response = await login(app, code)
  assert.equal(response.statusCode, 200, response.body)
  return response.json().data
}
const databaseFile = () => join(mkdtempSync(join(tmpdir(), 'card-wechat-')), 'test.sqlite')


test('WeChat registers on first login and restores the same private account on subsequent logins', async t => {
  const app = await fixture(t)
  const a = await signIn(app, 'alice')
  const b = await signIn(app, 'bob')
  assert.equal(a.mode, 'wechat')
  assert.equal(a.account.mode, 'wechat')
  assert.equal(a.card.published, false)
  assert.equal(a.card.name, '')
  assert.equal(a.devKey, undefined)
  assert.notEqual(a.card.id, b.card.id)
  const { id, updatedAt, mediaAccess, ...body } = a.card
  assert.equal((await app.inject({ method: 'PUT', url: '/api/me/card', headers: headers(a), payload: { ...body, name: '微信名片' } })).statusCode, 200)
  const restored = await signIn(app, 'alice')
  assert.equal(restored.account.id, a.account.id)
  assert.equal(restored.card.id, a.card.id)
  assert.equal(restored.card.name, '微信名片')
  assert.equal((await app.inject({ url: `/api/cards/${a.card.id}`, headers: headers(b) })).statusCode, 404)
  assert.equal((await app.inject('/api/me/account')).statusCode, 401)
  const profile = (await app.inject({ url: '/api/me/account', headers: headers(a) })).json().data
  assert.deepEqual(profile, a.account)
  assert.deepEqual(Object.keys(profile).sort(), ['createdAt', 'id', 'mode'])
  assert.ok(!JSON.stringify(profile).includes('openid'))
  assert.equal((await app.inject({ url: '/api/favorites', headers: headers(a) })).json().data.total, 0)
})

test('password registration, login, binding and password changes are unavailable', async t => {
  const app = await fixture(t)
  const user = await signIn(app)
  for (const route of [
    { method: 'POST', url: '/api/auth/register' },
    { method: 'POST', url: '/api/auth/login' },
    { method: 'POST', url: '/api/me/account' },
    { method: 'PUT', url: '/api/me/account/password' },
  ]) {
    for (const authHeaders of [{}, headers(user)]) {
      const response = await app.inject({ ...route, headers: authHeaders, payload: { username: 'alice', password: 'password123' } })
      assert.equal(response.statusCode, 404, response.body)
    }
  }
  assert.equal((await app.inject({ url: '/api/me/account', headers: headers(user) })).statusCode, 200)
})

test('WeChat login rejects invalid payloads and failed authorization without creating accounts', async t => {
  const databasePath = databaseFile()
  let calls = 0
  const app = await fixture(t, { databasePath, wechat: { login: async () => {
    calls++
    throw Object.assign(new Error('微信授权失败，请重试'), { statusCode: 502 })
  } } })
  for (const payload of [{}, { code: '' }, { code: '   ' }, { code: 1 }, { code: 'x'.repeat(257) }, { code: 'valid', openid: 'forged' }]) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/wechat', payload })).statusCode, 400)
  }
  assert.equal(calls, 0)
  assert.equal((await login(app)).statusCode, 502)
  const db = openDatabase(databasePath)
  try { assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0) }
  finally { db.close() }
})

test('concurrent WeChat logins create a single account and card', async t => {
  const app = await fixture(t)
  const sessions = await Promise.all(Array.from({ length: 4 }, () => signIn(app)))
  assert.equal(new Set(sessions.map(session => session.account.id)).size, 1)
  assert.equal(new Set(sessions.map(session => session.card.id)).size, 1)
  assert.equal(new Set(sessions.map(session => session.token)).size, 4)
})

test('legacy WeChat accounts retain data while old password sessions and password-only accounts cannot authenticate', async t => {
  const databasePath = databaseFile()
  const db = openDatabase(databasePath)
  const wx = getOrCreateUser(db, 'wx:openid-alice')
  const legacy = getOrCreateUser(db, 'account:old-account')
  const wxCard = db.prepare('SELECT * FROM cards WHERE owner_id = ?').get(wx.id)
  db.prepare('UPDATE cards SET body = ? WHERE owner_id = ?').run(JSON.stringify({ ...JSON.parse(wxCard.body), name: '保留已有名片' }), wx.id)
  db.prepare('INSERT INTO account_credentials VALUES (?, ?, ?, ?, ?)').run(wx.id, 'alice', 'hash-kept', 'salt-kept', 7)
  db.prepare('INSERT INTO account_credentials VALUES (?, ?, ?, ?, ?)').run(legacy.id, 'old_account', 'hash-kept', 'salt-kept', 3)
  const credentials = db.prepare('SELECT * FROM account_credentials ORDER BY user_id').all()
  const cards = db.prepare('SELECT * FROM cards ORDER BY id').all()
  db.close()
  const app = await fixture(t, { databasePath })
  for (const token of [
    app.jwt.sign({ sub: wx.id, version: 7 }),
    app.jwt.sign({ sub: wx.id, version: 7, provider: 'account' }),
    app.jwt.sign({ sub: legacy.id, version: 3 }),
    app.jwt.sign({ sub: legacy.id, version: 3, provider: 'wechat' }),
  ]) assert.equal((await app.inject({ url: '/api/me/account', headers: headers({ token }) })).statusCode, 401)
  const user = await signIn(app)
  assert.equal(user.account.id, wx.id)
  assert.equal(user.mode, 'wechat')
  assert.equal(user.card.id, wxCard.id)
  assert.equal(user.card.name, '保留已有名片')
  assert.equal(user.account.username, undefined)
  assert.equal((await app.inject({ url: '/api/me/account', headers: headers(user) })).statusCode, 200)
  const reopened = openDatabase(databasePath)
  try {
    assert.deepEqual(reopened.prepare('SELECT * FROM account_credentials ORDER BY user_id').all(), credentials)
    assert.deepEqual(reopened.prepare('SELECT * FROM cards ORDER BY id').all(), cards)
  }
  finally { reopened.close() }
})

test('logout revokes only the current session and revocation survives a restart', async t => {
  const options = { databasePath: databaseFile(), jwtSecret: secret, wechat, nodeEnv: 'production' }
  const app = await buildApp(options)
  const a = await signIn(app)
  const b = await signIn(app)
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: headers(a) })).statusCode, 200)
  assert.equal((await app.inject({ url: '/api/me/card', headers: headers(a) })).statusCode, 401)
  assert.equal((await app.inject({ url: '/api/me/card', headers: headers(b) })).statusCode, 200)
  await app.close()
  const reopened = await fixture(t, options)
  assert.equal((await reopened.inject({ url: '/api/me/account', headers: headers(a) })).statusCode, 401)
  assert.equal((await reopened.inject({ url: '/api/me/account', headers: headers(b) })).statusCode, 200)
  assert.equal((await signIn(reopened)).card.id, a.card.id)
  assert.equal((await reopened.inject({ method: 'POST', url: '/api/auth/dev', payload: {} })).statusCode, 403)
})

test('WeChat login is rate limited', async t => {
  const app = await fixture(t)
  for (let index = 0; index < 20; index++) assert.equal((await login(app)).statusCode, 200)
  assert.equal((await login(app)).statusCode, 429)
})

test('demo authentication is available only to explicitly configured test servers', async t => {
  const databasePath = databaseFile()
  const original = await buildApp({ databasePath, jwtSecret: secret, wechat, nodeEnv: 'test', demoEnabled: true })
  const demo = (await original.inject({ method: 'POST', url: '/api/auth/dev', payload: {} })).json().data
  assert.equal((await original.inject({ url: '/api/me/account', headers: headers(demo) })).statusCode, 200)
  const user = await signIn(original)
  await original.close()
  for (const nodeEnv of ['development', 'production']) {
    const app = await fixture(t, { databasePath, nodeEnv, demoEnabled: true })
    assert.equal((await app.inject('/api/health')).json().data.demoEnabled, false)
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/dev', payload: {} })).statusCode, 403)
    assert.equal((await app.inject({ url: '/api/me/account', headers: headers(demo) })).statusCode, 401)
    assert.equal((await app.inject({ url: '/api/me/account', headers: headers(user) })).statusCode, 200)
    assert.equal((await signIn(app)).mode, 'wechat')
  }
})

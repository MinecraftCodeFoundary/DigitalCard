import test from 'node:test'
import assert from 'node:assert/strict'
import { createService, digest } from '../digitalCard/service.mjs'
import { MemoryRepository, MemoryStorage } from './fixtures.mjs'
const env = 'cloud-test'
function fixture() {
  const db = new MemoryRepository()
  const storage = new MemoryStorage(env)
  const time = { value: Date.UTC(2026, 9, 10) }
  const logs = []
  const service = createService({ repository: db, storage, appId: 'wx-test', envId: env, webUrl: 'https://cards.example.test',
    qr: async () => 'data:image/png;base64,AA==', clock: () => time.value, logger: { error: (...args) => logs.push(args) } })
  let sequence = 0
  const call = (path, method = 'GET', data, token = '', context = {}) => service.handle({ path: `/api${path}`, method,
    ...(data === undefined ? {} : { data }), token, gatewayIp: `test-${++sequence}` }, { ENV: env, ...context })
  const register = async (openid = 'alice') => {
    const result = await call('/auth/wechat', 'POST', {}, '', { OPENID: openid, APPID: 'wx-test' })
    assert.equal(result.code, 0)
    return result.data
  }
  const registerVip = async (openid = 'alice') => {
    const result = await register(openid)
    const user = await db.get('users', result.account.id)
    await db.set('users', user.id, { ...user, membership: { plan: 'vip', expiresAt: null } })
    return { ...result, card: (await call('/me/card', 'GET', undefined, result.token)).data,
      account: (await call('/me/account', 'GET', undefined, result.token)).data }
  }
  const save = async (account, patch) => {
    const { id, updatedAt, mediaAccess, mediaUnavailable, isVip, ...body } = account.card
    return call('/me/card', 'PUT', { ...body, name: 'Alice', ...patch }, account.token)
  }
  return { db, storage, time, logs, service, call, register, registerVip, save }
}

test('WeChat-injected metadata is ignored and cannot supply a login identity', async () => {
  const f = fixture()
  const metadata = { userInfo: { openId: 'forged', appId: 'wx-test' }, tcbContext: { env: 'cloud-test' } }
  assert.equal((await f.service.handle({ path: '/api/health', ...metadata })).code, 0)
  assert.equal((await f.service.handle({ path: '/api/auth/wechat', method: 'POST', ...metadata })).code, 401)
  assert.equal((await f.service.handle({ path: '/api/health', ...metadata, openid: 'forged' })).code, 400)
})

test('WeChat first login registers a private card and stores only a hashed session', async () => {
  const f = fixture()
  const account = await f.register('Alice')
  assert.equal(account.mode, 'wechat')
  assert.deepEqual(Object.keys(account.account).sort(), ['createdAt', 'id', 'membership', 'mode'])
  assert.deepEqual(account.account.membership, { plan: 'free', expiresAt: null, isVip: false })
  assert.equal(account.card.isVip, false)
  assert.equal(account.account.mode, 'wechat')
  assert.equal(account.card.published, false)
  assert.equal(await f.db.count('credentials'), 0)
  assert.equal(await f.db.count('usernames'), 0)
  const session = await f.db.get('sessions', digest(account.token))
  assert.equal(session.userId, account.account.id)
  assert.equal(session.authMethod, 'wechat')
  assert.equal(session.token, undefined)
  assert.equal(await f.db.get('sessions', account.token), null)
  assert.deepEqual((await f.call('/me/account', 'GET', undefined, account.token)).data, account.account)
  const again = await f.register('Alice')
  assert.equal(again.card.id, account.card.id)
  assert.equal(again.account.id, account.account.id)
  assert.notEqual(again.token, account.token)
})
test('concurrent WeChat registration reuses one account and creates no orphan cards', async () => {
  const f = fixture()
  const results = await Promise.all(Array.from({ length: 3 }, () => f.register('same-wechat')))
  assert.equal(new Set(results.map(r => r.account.id)).size, 1)
  assert.equal(new Set(results.map(r => r.card.id)).size, 1)
  assert.equal(new Set(results.map(r => r.token)).size, 3)
  assert.equal(await f.db.count('users'), 1)
  assert.equal(await f.db.count('cards'), 1)
  assert.equal(await f.db.count('identities'), 1)
})
test('logout revokes its session and expired sessions require another WeChat login', async () => {
  const f = fixture()
  const a = await f.register()
  const second = await f.register()
  assert.equal((await f.call('/auth/logout', 'POST', {}, a.token)).code, 0)
  assert.equal(await f.db.get('sessions', digest(a.token)), null)
  assert.equal((await f.call('/me/card', 'GET', undefined, a.token)).code, 401)
  assert.equal((await f.call('/me/card', 'GET', undefined, second.token)).code, 0)
  f.time.value += 604800001
  assert.equal((await f.call('/me/card', 'GET', undefined, second.token)).code, 401)
  const renewed = await f.register()
  assert.equal(renewed.card.id, a.card.id)
  assert.equal((await f.call('/me/card', 'GET', undefined, renewed.token)).code, 0)
})
test('WeChat identity comes only from trusted context and ignores payload identity claims', async () => {
  const f = fixture()
  assert.equal((await f.call('/auth/wechat', 'POST', { code: 'fake', openid: 'someone' })).code, 401)
  assert.equal((await f.call('/auth/wechat', 'POST', {}, '', { OPENID: 'real', APPID: 'wrong' })).code, 401)
  assert.equal((await f.call('/auth/wechat', 'POST', {}, '', { OPENID: 'real' })).code, 401)
  assert.equal((await f.call('/auth/wechat', 'POST', {}, '', { APPID: 'wx-test' })).code, 401)
  assert.equal(await f.db.count('users'), 0)
  const context = { OPENID: 'real', APPID: 'wx-test' }
  const wx = (await f.call('/auth/wechat', 'POST', { openid: 'someone', userId: 'someone-else' }, '', context)).data
  const again = (await f.call('/auth/wechat', 'POST', {}, '', context)).data
  assert.equal(wx.card.id, again.card.id)
  assert.equal((await f.db.get('users', wx.account.id)).identity, 'wx:real')
  assert.equal(await f.db.get('identities', digest('wx:someone')), null)
})
test('password registration, login, binding and changes are unavailable without mutating accounts', async () => {
  const f = fixture()
  const wx = await f.register()
  for (const token of ['', wx.token]) {
    for (const [path, method, data] of [
      ['/auth/register', 'POST', { username: 'new-user', password: 'password123' }],
      ['/auth/login', 'POST', { username: 'old-user', password: 'password123' }],
      ['/me/account', 'POST', { username: 'bound', password: 'password123' }],
      ['/me/account/password', 'PUT', { currentPassword: 'password123', newPassword: 'newpassword123' }],
    ]) {
      const result = await f.call(path, method, data, token)
      assert.equal(result.code, 403)
      assert.equal(result.message, '仅支持微信直接注册和登录')
    }
  }
  assert.equal(await f.db.count('users'), 1)
  assert.equal(await f.db.count('cards'), 1)
  assert.equal(await f.db.count('credentials'), 0)
  assert.equal(await f.db.count('usernames'), 0)
  assert.equal((await f.call('/me/card', 'GET', undefined, wx.token)).code, 0)
})

test('legacy sessions fail while existing WeChat-linked cards and credentials are preserved', async () => {
  const f = fixture()
  const wx = await f.register()
  await f.save(wx, { name: 'Existing owner', bio: 'Existing content' })
  const credential = { userId: wx.account.id, username: 'old-user', password_hash: 'historical-hash', version: 1 }
  await f.db.set('credentials', wx.account.id, credential)
  await f.db.set('usernames', digest(credential.username), { userId: wx.account.id })
  const oldToken = 'a'.repeat(64)
  await f.db.set('sessions', digest(oldToken), { userId: wx.account.id, version: 1, expiresAt: f.time.value + 604800000 })
  assert.equal((await f.call('/me/card', 'GET', undefined, oldToken)).code, 401)
  assert.equal((await f.call('/me/account', 'GET', undefined, oldToken)).code, 401)
  const again = await f.register()
  assert.equal(again.card.id, wx.card.id)
  assert.equal(again.card.name, 'Existing owner')
  assert.equal(again.card.bio, 'Existing content')
  assert.equal(again.account.mode, 'wechat')
  assert.equal('username' in again.account, false)
  assert.deepEqual(await f.db.get('credentials', wx.account.id), credential)
  assert.deepEqual(await f.db.get('usernames', digest(credential.username)), { userId: wx.account.id })
})

test('legacy password-only accounts cannot authenticate or merge into a new WeChat account', async () => {
  const f = fixture()
  const oldUser = { id: 'old-user', cardId: 'old-card', identity: 'account:old-user', createdAt: new Date(f.time.value).toISOString() }
  const oldCard = { id: oldUser.cardId, ownerId: oldUser.id, body: { name: 'Historical card' } }
  await f.db.set('users', oldUser.id, oldUser)
  await f.db.set('cards', oldCard.id, oldCard)
  const oldToken = 'b'.repeat(64)
  await f.db.set('sessions', digest(oldToken), { userId: oldUser.id, version: 1, expiresAt: f.time.value + 604800000 })
  assert.equal((await f.call('/me/card', 'GET', undefined, oldToken)).code, 401)
  const wx = await f.register()
  assert.notEqual(wx.account.id, oldUser.id)
  assert.notEqual(wx.card.id, oldCard.id)
  assert.deepEqual(await f.db.get('users', oldUser.id), oldUser)
  assert.deepEqual(await f.db.get('cards', oldCard.id), oldCard)
  assert.equal(await f.db.count('users'), 2)
})

test('private cards and messages remain isolated; public favorites and visitor counts are idempotent', async () => {
  const f = fixture()
  const owner = await f.registerVip()
  const visitor = await f.registerVip('visitor')
  assert.equal((await f.call(`/cards/${owner.card.id}`, 'GET', undefined, visitor.token)).code, 404)
  assert.equal((await f.save(owner, { ownerId: visitor.account.id })).code, 400)
  assert.equal((await f.save(owner, { published: true })).code, 0)
  for (let i = 0; i < 2; i++) {
    assert.equal((await f.call(`/cards/${owner.card.id}`, 'GET', undefined, visitor.token)).code, 0)
    assert.equal((await f.call(`/cards/${owner.card.id}/favorite`, 'PUT', {}, visitor.token)).code, 0)
  }
  assert.equal((await f.call(`/cards/${owner.card.id}/messages`, 'POST', { name: 'Visitor', content: 'Hello' })).code, 0)
  const stats = (await f.call('/me/stats', 'GET', undefined, owner.token)).data
  assert.equal(stats.views, 1)
  assert.equal(stats.favorites, 1)
  assert.equal(stats.days.length, 7)
  assert.equal((await f.call('/me/messages', 'GET', undefined, visitor.token)).data.total, 0)
  assert.equal((await f.call('/me/messages', 'GET', undefined, owner.token)).data.items[0].content, 'Hello')
  assert.equal((await f.call('/favorites?search=alice', 'GET', undefined, visitor.token)).data.total, 1)
  await f.save(owner, { published: false })
  assert.equal((await f.call('/favorites', 'GET', undefined, visitor.token)).data.total, 0)
  assert.equal((await f.call(`/cards/${owner.card.id}/messages`, 'POST', { name: 'Visitor', content: 'Hello' })).code, 404)
})
test('card templates persist for owners, public visitors and favorites without changing content', async () => {
  const f = fixture()
  const owner = await f.registerVip()
  const visitor = await f.registerVip('visitor')
  for (const template of ['signature', 'festive', 'business', 'neon', 'floral', 'poster', 'obsidian', 'porcelain', 'editorial', 'sunset', 'aurora', 'botanical']) {
    const saved = await f.save(owner, {
      published: true, bio: '保留个人介绍',
      appearance: { template, coverTitle: '保留自己的封面' },
    })
    assert.equal(saved.code, 0)
    assert.equal(saved.data.appearance.template, template)
    assert.equal((await f.db.get('cards', owner.card.id)).body.appearance.template, template)
    assert.equal((await f.call(`/cards/${owner.card.id}/favorite`, 'PUT', {}, visitor.token)).code, 0)
    const restored = await f.call('/me/card', 'GET', undefined, owner.token)
    const publicCard = await f.call(`/cards/${owner.card.id}`)
    const favorites = await f.call('/favorites', 'GET', undefined, visitor.token)
    assert.equal(restored.code, 0)
    assert.equal(publicCard.code, 0)
    assert.equal(favorites.code, 0)
    for (const card of [restored.data, publicCard.data, favorites.data.items.find(card => card.id === owner.card.id)]) {
      assert.equal(card.appearance.template, template)
      assert.equal(card.appearance.coverTitle, '保留自己的封面')
      assert.equal(card.name, 'Alice')
      assert.equal(card.bio, '保留个人介绍')
    }
  }
  for (const template of ['unknown', 'Obsidian', '', null, 123, ['aurora']])
    assert.equal((await f.save(owner, { appearance: { template } })).code, 400)
  assert.equal((await f.call('/me/card', 'GET', undefined, owner.token)).data.appearance.template, 'botanical')
  assert.equal((await f.save(owner, { appearance: {} })).code, 0)
})

test('media commits validate bytes, copy immutable files and enforce owner/public visibility', async () => {
  const f = fixture()
  const owner = await f.registerVip()
  const other = await f.registerVip('other')
  const reservation = (await f.call('/media/reserve', 'POST', {}, owner.token)).data
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5n8AAAAASUVORK5CYII=', 'base64')
  const fileID = await f.storage.upload(reservation.cloudPath, png)
  assert.equal((await f.call('/media/commit', 'POST', { id: reservation.id, fileID }, other.token)).code, 400)
  const result = await f.call('/media/commit', 'POST', { id: reservation.id, fileID }, owner.token)
  assert.equal(result.code, 0)
  assert.equal(result.data.kind, 'image')
  assert.equal(f.storage.files.has(fileID), false)
  const record = await f.db.get('media', reservation.id)
  assert.match(record.fileID, /\/media\//)
  assert.equal((await f.call('/media/commit', 'POST', { id: reservation.id, fileID }, owner.token)).code, 400)
  assert.equal((await f.call(`/media/${reservation.id}`)).code, 404)
  assert.equal((await f.call(`/media/${reservation.id}`, 'GET', undefined, owner.token)).code, 0)
  const sections = [{ id: 'image', type: 'image', title: 'Image', content: '', visible: true, images: [result.data.url] }]
  assert.equal((await f.save(other, { sections })).code, 400)
  await f.save(owner, { published: true, sections })
  const publicCard = await f.call(`/cards/${owner.card.id}`)
  assert.match(publicCard.data.mediaAccess[result.data.url], /^https:\/\//)
  assert.equal(JSON.stringify(publicCard).includes('fileID'), false)
  assert.equal((await f.call(`/media/${reservation.id}`)).code, 0)
  await f.save(owner, { published: true, sections: [{ ...sections[0], visible: false }] })
  assert.equal((await f.call(`/media/${reservation.id}`)).code, 404)
  assert.deepEqual((await f.call(`/cards/${owner.card.id}`)).data.mediaAccess, {})
})
test('committed uploads remain successful when preview signing fails and recover through authorized card reads', async () => {
  for (const missingUrl of [false, true]) {
    const f = fixture()
    const owner = await f.registerVip()
    const other = await f.registerVip('other')
    const reservation = (await f.call('/media/reserve', 'POST', {}, owner.token)).data
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5n8AAAAASUVORK5CYII=', 'base64')
    const fileID = await f.storage.upload(reservation.cloudPath, png)
    const urls = f.storage.urls.bind(f.storage)
    let signingCalls = 0
    f.storage.urls = async () => {
      signingCalls++
      if (missingUrl) return {}
      throw new Error('Temporary signing outage')
    }
    const committed = await f.call('/media/commit', 'POST', { id: reservation.id, fileID }, owner.token)
    assert.equal(committed.code, 0)
    assert.deepEqual(committed.data, { url: `/api/media/${reservation.id}`, kind: 'image', size: png.length, mediaUnavailable: true })
    assert.equal(await f.db.get('uploads', reservation.id), null)
    assert.equal(f.storage.files.has(fileID), false)
    assert.equal(await f.db.count('media'), 1)
    assert.equal(f.storage.files.size, 1)
    assert.equal((await f.db.get('media', reservation.id)).mediaUnavailable, undefined)
    assert.equal(signingCalls, 1)
    assert.equal(f.logs[0][0], 'Uploaded media preview failed')
    assert.equal(f.logs[0][1].mediaId, reservation.id)
    assert.equal(JSON.stringify(f.logs).includes(owner.token), false)
    assert.equal(JSON.stringify(committed).includes('fileID'), false)
    // An unavailable preview grants no new access to another account or an
    // anonymous visitor and does not create a second commit for the same ID.
    assert.equal((await f.call('/media/commit', 'POST', { id: reservation.id, fileID }, other.token)).code, 400)
    assert.equal((await f.call('/media/commit', 'POST', { id: reservation.id, fileID }, owner.token)).code, 400)
    for (const token of ['', other.token])
      assert.equal((await f.call(`/media/${reservation.id}`, 'GET', undefined, token)).code, 404)
    assert.equal(signingCalls, 1)
    const sections = [{ id: 'image', type: 'image', title: 'Image', content: '', visible: true, images: [committed.data.url] }]
    const saved = await f.save(owner, { sections })
    assert.equal(saved.code, 0)
    assert.equal((await f.db.get('cards', owner.card.id)).body.sections[0].images[0], committed.data.url)
    f.storage.urls = urls
    const refreshed = await f.call('/me/card', 'GET', undefined, owner.token)
    assert.equal(refreshed.code, 0)
    assert.match(refreshed.data.mediaAccess[committed.data.url], /^https:\/\//)
    assert.equal(refreshed.data.mediaUnavailable, undefined)
    assert.equal((await f.call(`/media/${reservation.id}`, 'GET', undefined, owner.token)).code, 0)
    for (const token of ['', other.token])
      assert.equal((await f.call(`/media/${reservation.id}`, 'GET', undefined, token)).code, 404)
    assert.equal(await f.db.count('media'), 1)
    assert.equal(f.storage.files.size, 1)
  }
})
test('concurrent commits during a preview outage retain exactly one owned media file', async () => {
  const f = fixture()
  const owner = await f.registerVip()
  const reservation = (await f.call('/media/reserve', 'POST', {}, owner.token)).data
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5n8AAAAASUVORK5CYII=', 'base64')
  const fileID = await f.storage.upload(reservation.cloudPath, png)
  f.storage.urls = async () => { throw new Error('Temporary signing outage') }
  const results = await Promise.all(Array.from({ length: 3 }, () => f.call('/media/commit', 'POST', { id: reservation.id, fileID }, owner.token)))
  assert.equal(results.filter(result => result.code === 0).length, 1)
  assert.equal(results.filter(result => result.code === 409).length, 2)
  assert.equal(results.find(result => result.code === 0).data.mediaUnavailable, true)
  assert.equal(await f.db.count('uploads'), 0)
  assert.equal(await f.db.count('media'), 1)
  assert.equal(f.storage.files.size, 1)
  const record = await f.db.get('media', reservation.id)
  assert.equal(record.ownerId, owner.account.id)
  assert.equal(f.storage.files.has(record.fileID), true)
})
test('gateway uploads use the configured environment when WXContext lacks ENV', async () => {
  const f = fixture()
  const account = await f.registerVip()
  const invoke = (path, data) => f.service.handle({ path: `/api${path}`, method: 'POST', data, token: account.token }, {})
  const reserved = await invoke('/media/reserve', {})
  assert.equal(reserved.code, 0)
  assert.equal((await f.db.get('uploads', reserved.data.id)).env, env)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5n8AAAAASUVORK5CYII=', 'base64')
  const fileID = await f.storage.upload(reserved.data.cloudPath, png)
  assert.equal((await invoke('/media/commit', { id: reserved.data.id, fileID })).code, 0)
})

test('forged file paths, non-media bytes, oversized images and expired upload reservations fail', async () => {
  const f = fixture()
  const a = await f.registerVip()
  const r = (await f.call('/media/reserve', 'POST', {}, a.token)).data
  assert.equal((await f.call('/media/commit', 'POST', { id: r.id, fileID: `cloud://${env}.bucket/media/other` }, a.token)).code, 400)
  const id = await f.storage.upload(r.cloudPath, Buffer.from('not an image'))
  assert.equal((await f.call('/media/commit', 'POST', { id: r.id, fileID: id }, a.token)).code, 400)
  const buffer = Buffer.alloc(8 * 1024 * 1024 + 1)
  // A complete PNG avoids scanning megabytes of synthetic zero-length chunks
  // before this test reaches the size check.
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5n8AAAAASUVORK5CYII=', 'base64').copy(buffer)
  await f.storage.upload(r.cloudPath, buffer)
  assert.equal((await f.call('/media/commit', 'POST', { id: r.id, fileID: id }, a.token)).code, 413)
  f.time.value += 1800001
  assert.equal((await f.call('/media/commit', 'POST', { id: r.id, fileID: id }, a.token)).code, 400)
})
test('demo endpoints are disabled and rate limits cannot be bypassed by event identity', async () => {
  const f = fixture()
  assert.equal((await f.call('/auth/dev', 'POST', {})).code, 403)
  assert.equal((await f.service.handle({ path: '/api/auth/wechat', method: 'POST', openid: 'fake' }, {})).code, 400)
  const context = { OPENID: 'one-client', APPID: 'wx-test', ENV: env }
  for (let i = 0; i < 5; i++) assert.equal((await f.call('/auth/wechat', 'POST', {}, '', context)).code, 0)
  for (let i = 0; i < 5; i++) await f.call('/auth/wechat', 'POST', {}, '', context)
  assert.equal((await f.call('/auth/wechat', 'POST', {}, '', context)).code, 429)
})
test('QR responses preserve web sharing and use cloud WeChat OpenAPI', async () => {
  const f = fixture()
  const a = await f.register()
  await f.save(a, { published: true })
  const web = await f.call(`/cards/${a.card.id}/qr?mode=web`)
  assert.equal(web.code, 0)
  assert.match(web.data.image, /^data:image\/png;base64,/)
  assert.match(web.data.url, /https:\/\/cards.example.test/)
  const wx = await f.call(`/cards/${a.card.id}/qr?mode=wechat`)
  assert.equal(wx.data.mode, 'wechat')
})

test('temporary media URL outages do not fail committed saves or expose private files', async () => {
  const f = fixture()
  const owner = await f.registerVip()
  const id = 'a'.repeat(24)
  await f.db.set('media', id, { id, ownerId: owner.account.id, fileID: `cloud://${env}.bucket/media/owned`, kind: 'image' })
  const url = `/api/media/${id}`
  f.storage.urls = async () => { throw new Error('Cloud storage URL failed') }
  const sections = [{ id: 'image', type: 'image', title: 'Image', content: '', visible: true, images: [url] }]
  const saved = await f.save(owner, { sections, name: 'Saved despite signing outage' })
  assert.equal(saved.code, 0)
  assert.equal(saved.data.mediaUnavailable, true)
  assert.deepEqual(saved.data.mediaAccess, {})
  assert.equal((await f.db.get('cards', owner.card.id)).body.name, 'Saved despite signing outage')
  assert.equal((await f.db.get('cards', owner.card.id)).body.mediaUnavailable, undefined)
  const loaded = await f.call('/me/card', 'GET', undefined, owner.token)
  assert.equal(loaded.code, 0)
  assert.equal(loaded.data.name, saved.data.name)
  assert.equal(loaded.data.mediaUnavailable, true)
  assert.equal(JSON.stringify(loaded).includes('fileID'), false)
  assert.equal((await f.call(`/cards/${owner.card.id}`)).code, 404)
  assert.equal((await f.call(`/media/${id}`)).code, 404)
  f.storage.urls = async ids => Object.fromEntries(ids.map(file => [file, 'https://signed.example.test/recovered']))
  const recovered = await f.call('/me/card', 'GET', undefined, owner.token)
  assert.equal(recovered.data.mediaUnavailable, undefined)
  assert.equal(recovered.data.mediaAccess[url], 'https://signed.example.test/recovered')
})

test('exhausted transaction conflicts are reported as busy and logged with the route', async () => {
  const db = new MemoryRepository()
  db.transaction = async () => { throw Object.assign(new Error('[ResourceUnavailable.TransactionConflict]'), { errCode: -501001 }) }
  const logs = []
  const service = createService({ repository: db, storage: new MemoryStorage(), logger: { error: (...args) => logs.push(args) } })
  const result = await service.handle({ path: '/api/me/card', method: 'PUT', token: 'private-token' })
  assert.equal(result.code, 503)
  assert.equal(result.message, '请求暂时繁忙，请稍后重试')
  assert.equal(logs[0][1].path, '/api/me/card')
  assert.equal(logs[0][1].method, 'PUT')
  assert.equal(JSON.stringify(logs).includes('private-token'), false)
})

test('concurrent calls from the same client still enforce the exact global limit', async () => {
  const f = fixture()
  const results = await Promise.all(Array.from({ length: 125 }, () => f.call('/health', 'GET', undefined, '', { OPENID: 'same-client' })))
  assert.equal(results.filter(r => r.code === 0).length, 120)
  assert.equal(results.filter(r => r.code === 429).length, 5)
})

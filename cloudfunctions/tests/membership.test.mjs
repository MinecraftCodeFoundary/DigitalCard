import test from 'node:test'
import assert from 'node:assert/strict'
import { createService } from '../digitalCard/service.mjs'
import { FREE_APPEARANCE, FREE_PAGES, FREE_SECTIONS, membershipProfile } from '../digitalCard/membership.mjs'
import { MemoryRepository, MemoryStorage } from './fixtures.mjs'

function fixture() {
  const db = new MemoryRepository()
  const storage = new MemoryStorage('cloud-test')
  const time = { value: Date.UTC(2026, 9, 11) }
  let sequence = 0
  const service = createService({ repository: db, storage, appId: 'wx-test', envId: 'cloud-test',
    webUrl: 'https://cards.example.test', clock: () => time.value, qr: async () => 'image', logger: { error() {} } })
  const call = (path, method = 'GET', data, token = '') => service.handle({ path: `/api${path}`, method, data,
    token, gatewayIp: `client-${++sequence}` }, { ENV: 'cloud-test' })
  const register = async (openid = `member-${++sequence}`) => {
    const response = await service.handle({ path: '/api/auth/wechat', method: 'POST' }, { OPENID: openid, APPID: 'wx-test' })
    assert.equal(response.code, 0)
    return response.data
  }
  const membership = async (account, value) => {
    const user = await db.get('users', account.account.id)
    if (value === undefined) delete user.membership
    else user.membership = value
    await db.set('users', user.id, user)
  }
  const load = async account => (await call('/me/card', 'GET', undefined, account.token)).data
  const save = async (account, patch = {}) => {
    const { id, updatedAt, mediaAccess, mediaUnavailable, isVip, ...body } = await load(account)
    return call('/me/card', 'PUT', { ...body, name: 'Alice', ...patch }, account.token)
  }
  return { db, storage, time, service, call, register, membership, load, save }
}

test('membership fails closed for missing, malformed and expired records; expiration is server-clock based', () => {
  const clock = Date.UTC(2026, 9, 11)
  for (const membership of [undefined, null, {}, [], 'vip', { plan: 'VIP', expiresAt: null },
    { plan: 'vip' }, { plan: 'vip', expiresAt: 9999999999999 }, { plan: 'vip', expiresAt: '' },
    { plan: 'vip', expiresAt: 'not-a-date' }, { plan: 'vip', expiresAt: '2027-02-30T00:00:00Z' },
    { plan: 'vip', expiresAt: '2027-01-01' }, { plan: 'vip', expiresAt: '2027-01-01T24:00:00Z' },
    { plan: 'vip', expiresAt: new Date(clock).toISOString() },
    { plan: 'free', expiresAt: '2027-01-01T00:00:00Z', isVip: true }])
    assert.equal(membershipProfile({ membership }, clock).isVip, false, JSON.stringify(membership))
  assert.equal(membershipProfile({ membership: { plan: 'vip', expiresAt: null } }, clock).isVip, true)
  for (const plan of ['free', 'unknown']) assert.deepEqual(membershipProfile({ membership: {
    plan, expiresAt: '2027-01-01T00:00:00Z', isVip: true,
  } }, clock), { plan: 'free', expiresAt: null, isVip: false })
  const expiry = '2026-10-12T08:00:00+08:00'
  assert.deepEqual(membershipProfile({ membership: { plan: 'vip', expiresAt: expiry } }, clock),
    { plan: 'vip', expiresAt: expiry, isVip: true })
  assert.equal(membershipProfile({ membership: { plan: 'vip', expiresAt: expiry } }, Date.parse(expiry)).isVip, false)
})

test('free accounts can edit basic information, publish and share a canonical simple card', async () => {
  const f = fixture()
  const account = await f.register()
  assert.deepEqual(account.account.membership, { plan: 'free', expiresAt: null, isVip: false })
  assert.equal(account.card.isVip, false)
  assert.deepEqual(account.card.appearance, FREE_APPEARANCE)
  assert.deepEqual(account.card.pages, FREE_PAGES)
  assert.deepEqual(account.card.sections, FREE_SECTIONS)
  const saved = await f.save(account, { published: true, name: '免费用户', title: '设计师', company: 'Studio',
    phone: '13800138000', email: 'hello@example.test', wechat: 'hello', location: '上海', bio: '欢迎联系',
    website: 'https://example.test', tags: ['设计'], avatar: 'data:image/png;base64,AA==' })
  assert.equal(saved.code, 0)
  assert.equal(saved.data.name, '免费用户')
  assert.equal(saved.data.bio, '欢迎联系')
  const publicCard = await f.call(`/cards/${account.card.id}`)
  assert.equal(publicCard.code, 0)
  assert.equal(publicCard.data.isVip, false)
  assert.equal('membership' in publicCard.data, false)
  assert.equal((await f.call(`/cards/${account.card.id}/qr?mode=web`)).code, 0)
  const { appearance, pages, sections, ...withoutDesign } = saved.data
  const { id, updatedAt, mediaAccess, isVip, ...body } = withoutDesign
  assert.equal((await f.call('/me/card', 'PUT', body, account.token)).code, 0)
})

test('free saves reject premium designs and identity claims, including external media and hidden blocks', async () => {
  const f = fixture()
  const account = await f.register()
  for (const patch of [
    { theme: 'ink' }, { appearance: { layout: 'poster' } }, { appearance: { template: 'aurora' } },
    { appearance: { coverImage: 'https://example.test/image.png' } }, { appearance: { decoration: true } },
    { appearance: { accentColor: '#123456' } },
    { pages: [...FREE_PAGES, { id: 'extra', title: '公司', columns: 1 }] },
    { pages: [{ ...FREE_PAGES[0], presentation: 'article' }] },
    { sections: [...FREE_SECTIONS, { id: 'secret', type: 'text', title: '隐藏内容', content: 'premium', visible: false }] },
    { sections: [{ id: 'image', type: 'image', title: '作品', content: '', visible: true, images: ['https://example.test/image.png'] }] },
    { sections: [{ ...FREE_SECTIONS[0], content: '绕过简介字段' }, FREE_SECTIONS[1]] },
  ]) assert.equal((await f.save(account, patch)).code, 403, JSON.stringify(patch))
  for (const patch of [{ membership: { plan: 'vip', expiresAt: null } }, { isVip: true }, { ownerId: 'another-user' }])
    assert.equal((await f.save(account, patch)).code, 400)
  assert.equal((await f.call('/me/membership', 'PUT', { plan: 'vip' }, account.token)).code, 404)
  assert.equal((await f.call('/me/account', 'PUT', { membership: { plan: 'vip' } }, account.token)).code, 403)
  assert.equal((await f.call('/me/account', 'GET', undefined, account.token)).data.membership.isVip, false)
  assert.equal((await f.db.get('cards', account.card.id)).body.name, '')
  assert.equal((await f.save(account, { pages: [{ ...FREE_PAGES[0], icon: 'user', presentation: 'cards' }],
    sections: FREE_SECTIONS.map(section => ({ ...section, pageId: 'main', columnSpan: 1, showTitle: true })) })).code, 0)
})

test('advanced APIs require the acting VIP, while public messages depend on the recipient membership', async () => {
  const f = fixture()
  const owner = await f.register()
  const visitor = await f.register()
  await f.save(owner, { published: true })
  for (const [path, method] of [['/me/stats', 'GET'], ['/me/messages', 'GET'],
    ['/media/reserve', 'POST'], ['/media/commit', 'POST']])
    assert.equal((await f.call(path, method, {}, visitor.token)).code, 403, path)
  assert.equal((await f.call(`/cards/${owner.card.id}/favorite`, 'PUT', {}, visitor.token)).code, 0)
  assert.equal((await f.call('/favorites', 'GET', undefined, visitor.token)).data.total, 1)
  assert.equal((await f.call(`/cards/${owner.card.id}/messages`, 'POST', { name: '访客', content: '你好' })).code, 403)
  await f.membership(visitor, { plan: 'vip', expiresAt: null })
  assert.equal((await f.call(`/cards/${owner.card.id}/messages`, 'POST', { name: '访客', content: '你好' }, visitor.token)).code, 403)
  assert.equal((await f.call(`/cards/${owner.card.id}/favorite`, 'PUT', {}, visitor.token)).code, 0)
  const favorites = await f.call('/favorites', 'GET', undefined, visitor.token)
  assert.equal(favorites.code, 0)
  assert.equal(favorites.data.items[0].isVip, false)
  await f.membership(owner, { plan: 'vip', expiresAt: null })
  assert.equal((await f.call(`/cards/${owner.card.id}/messages`, 'POST', { name: '匿名', content: '你好' })).code, 0)
  assert.equal((await f.call('/me/messages', 'GET', undefined, owner.token)).data.total, 1)
  assert.equal((await f.call('/me/stats', 'GET', undefined, owner.token)).code, 0)
  await f.membership(visitor, { plan: 'free', expiresAt: null })
  assert.equal((await f.call(`/cards/${owner.card.id}/favorite`, 'DELETE', {}, visitor.token)).code, 0)
  assert.equal(await f.db.count('favorites'), 0)
})

test('expiration projects existing VIP cards and media safely, and free edits preserve the stored VIP design', async () => {
  const f = fixture()
  const owner = await f.register()
  const collector = await f.register()
  const expiresAt = new Date(f.time.value + 1000).toISOString()
  await f.membership(owner, { plan: 'vip', expiresAt })
  await f.membership(collector, { plan: 'vip', expiresAt: null })
  const mediaId = 'a'.repeat(24)
  const mediaUrl = `/api/media/${mediaId}`
  await f.db.set('media', mediaId, { id: mediaId, ownerId: owner.account.id, fileID: 'cloud://cloud-test.bucket/media/image', kind: 'image' })
  const design = { published: true, theme: 'ink', appearance: { template: 'poster', layout: 'poster', coverImage: mediaUrl, brandLogo: mediaUrl },
    pages: [{ id: 'company', title: '公司', columns: 2, presentation: 'article' }],
    sections: [{ id: 'image', type: 'image', title: '作品', content: '', visible: true, pageId: 'company', images: [mediaUrl] }] }
  assert.equal((await f.save(owner, design)).code, 0)
  const original = (await f.db.get('cards', owner.card.id)).body
  assert.equal((await f.call(`/cards/${owner.card.id}/favorite`, 'PUT', {}, collector.token)).code, 0)
  assert.equal((await f.call(`/media/${mediaId}`)).code, 0)
  const reservation = (await f.call('/media/reserve', 'POST', {}, owner.token)).data
  f.time.value += 1000
  const account = await f.call('/me/account', 'GET', undefined, owner.token)
  assert.deepEqual(account.data.membership, { plan: 'vip', expiresAt, isVip: false })
  assert.equal((await f.call('/media/commit', 'POST', { id: reservation.id, fileID: 'forged' }, owner.token)).code, 403)
  assert.equal((await f.call('/me/stats', 'GET', undefined, owner.token)).code, 403)
  for (const card of [await f.load(owner), (await f.call(`/cards/${owner.card.id}`)).data,
    (await f.call('/favorites', 'GET', undefined, collector.token)).data.items[0]]) {
    assert.equal(card.isVip, false)
    assert.equal(card.theme, 'forest')
    assert.deepEqual(card.appearance, FREE_APPEARANCE)
    assert.deepEqual(card.pages, FREE_PAGES)
    assert.deepEqual(card.sections, FREE_SECTIONS)
    assert.deepEqual(card.mediaAccess, {})
  }
  for (const token of ['', owner.token, collector.token]) assert.equal((await f.call(`/media/${mediaId}`, 'GET', undefined, token)).code, 404)
  assert.equal((await f.save(owner, { name: '新的姓名', bio: '更新基本简介' })).code, 0)
  const raw = (await f.db.get('cards', owner.card.id)).body
  assert.equal(raw.name, '新的姓名')
  assert.equal(raw.bio, '更新基本简介')
  for (const key of ['theme', 'appearance', 'pages', 'sections']) assert.deepEqual(raw[key], original[key])
  assert.ok(await f.db.get('media', mediaId))
  await f.membership(owner, { plan: 'vip', expiresAt: null })
  const restored = await f.load(owner)
  assert.equal(restored.isVip, true)
  assert.equal(restored.name, '新的姓名')
  assert.deepEqual(restored.sections, original.sections)
  assert.equal((await f.call(`/media/${mediaId}`)).code, 0)
})

test('legacy accounts with no membership cannot expose previously stored advanced content', async () => {
  const f = fixture()
  const owner = await f.register()
  await f.membership(owner, { plan: 'vip', expiresAt: null })
  await f.save(owner, { published: true, appearance: { template: 'neon', layout: 'portrait' },
    sections: [{ id: 'text', type: 'text', title: '历史内容', content: '保留但不展示', visible: true }] })
  await f.membership(owner, undefined)
  assert.equal((await f.call('/me/account', 'GET', undefined, owner.token)).data.membership.isVip, false)
  const card = (await f.call(`/cards/${owner.card.id}`)).data
  assert.equal(card.isVip, false)
  assert.deepEqual(card.sections, FREE_SECTIONS)
  assert.equal((await f.db.get('cards', owner.card.id)).body.sections[0].content, '保留但不展示')
})

test('membership is checked again inside card mutation transactions', async () => {
  const f = fixture()
  const owner = await f.register()
  await f.membership(owner, { plan: 'vip', expiresAt: null })
  const card = await f.load(owner)
  const { id, updatedAt, mediaAccess, isVip, ...body } = card
  const transaction = f.db.transaction.bind(f.db)
  let transactions = 0
  f.db.transaction = work => transaction(async tx => {
    if (++transactions === 2) {
      const user = await tx.get('users', owner.account.id)
      await tx.set('users', user.id, { ...user, membership: { plan: 'free', expiresAt: null } })
    }
    return work(tx)
  })
  const response = await f.call('/me/card', 'PUT', { ...body, name: 'blocked', appearance: { template: 'neon' } }, owner.token)
  assert.equal(response.code, 403)
  assert.equal((await f.db.get('cards', owner.card.id)).body.name, '')
})

test('an explicit basic save preserves advanced content when VIP is activated after the free form loads', async () => {
  const f = fixture()
  const owner = await f.register()
  await f.membership(owner, { plan: 'vip', expiresAt: null })
  await f.save(owner, { appearance: { template: 'neon', layout: 'portrait' },
    sections: [{ id: 'text', type: 'text', title: 'VIP 内容', content: '稍后恢复', visible: true }] })
  const original = (await f.db.get('cards', owner.card.id)).body
  await f.membership(owner, { plan: 'free', expiresAt: null })
  const { id, updatedAt, mediaAccess, isVip, ...freeForm } = await f.load(owner)
  await f.membership(owner, { plan: 'vip', expiresAt: null })
  const saved = await f.call('/me/card?mode=basic', 'PUT', { ...freeForm, name: '新姓名' }, owner.token)
  assert.equal(saved.code, 0)
  assert.equal(saved.data.isVip, true)
  assert.equal(saved.data.name, '新姓名')
  assert.deepEqual(saved.data.sections, original.sections)
  const raw = (await f.db.get('cards', owner.card.id)).body
  for (const key of ['theme', 'appearance', 'pages', 'sections']) assert.deepEqual(raw[key], original[key])
  assert.equal((await f.call('/me/card?mode=basic', 'PUT', { ...freeForm, appearance: { template: 'aurora' } }, owner.token)).code, 403)
  for (const mode of ['vip', 'full', ''])
    assert.equal((await f.call(`/me/card?mode=${mode}`, 'PUT', freeForm, owner.token)).code, 400)
})

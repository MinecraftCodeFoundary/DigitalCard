import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp, chinaDay } from '../src/app.mjs'

const defaults = { databasePath: ':memory:', jwtSecret: 'test-secret-of-at-least-32-characters', demoEnabled: true, nodeEnv: 'test' }
async function fixture(t, options = {}) {
  const app = await buildApp({ ...defaults, ...options })
  t.after(() => app.close())
  return app
}
async function login(app, devKey) {
  const result = await app.inject({ method: 'POST', url: '/api/auth/dev', payload: devKey ? { devKey } : {} })
  assert.equal(result.statusCode, 200)
  return result.json().data
}
const headers = user => ({ authorization: `Bearer ${user.token}` })
function body(card, overrides = {}) {
  const { id, updatedAt, mediaAccess, ...rest } = card
  return { ...rest, ...overrides }
}
async function save(app, user, overrides) {
  const response = await app.inject({ method: 'PUT', url: '/api/me/card', headers: headers(user), payload: body(user.card, overrides) })
  return response
}

test('auth protects private APIs and rejects forged tokens', async t => {
  const app = await fixture(t)
  for (const url of ['/api/me/card', '/api/favorites', '/api/me/stats']) {
    assert.equal((await app.inject(url)).statusCode, 401)
    assert.equal((await app.inject({ url, headers: { authorization: 'Bearer forged' } })).statusCode, 401)
  }
})
test('browser preflight permits authenticated card updates and favorite removal', async t => {
  const app = await fixture(t)
  for (const method of ['PUT', 'DELETE']) {
    const response = await app.inject({ method: 'OPTIONS', url: '/api/me/card', headers: {
      origin: 'http://localhost:9000', 'access-control-request-method': method,
      'access-control-request-headers': 'authorization,content-type',
    } })
    assert.equal(response.statusCode, 204)
    assert.ok(response.headers['access-control-allow-methods'].includes(method))
    assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:9000')
  }
})
test('demo credentials isolate users and restore the same account', async t => {
  const app = await fixture(t)
  const a = await login(app); const b = await login(app)
  assert.notEqual(a.card.id, b.card.id)
  const saved = await save(app, a, { name: '测试名片', phone: '13800000000', email: 'test@example.com' })
  assert.equal(saved.statusCode, 200)
  const restored = await login(app, a.devKey)
  assert.equal(restored.card.id, a.card.id)
  assert.equal(restored.card.name, '测试名片')
  const bCard = (await app.inject({ url: '/api/me/card', headers: headers(b) })).json().data
  assert.equal(bCard.name, '林予安')
  assert.equal((await save(app, b, { owner_id: a.card.id })).statusCode, 400)
})
test('validates names, contacts, themes and tag limits', async t => {
  const app = await fixture(t); const user = await login(app)
  for (const overrides of [{ name: '' }, { email: 'invalid' }, { phone: 'abc' }, { website: 'javascript:alert(1)' }, { theme: 'red' }, { tags: ['1', '2', '3', '4', '5', '6'] }, { avatar: 'https://evil.test/a.svg' }]) {
    assert.equal((await save(app, user, overrides)).statusCode, 400)
  }
})

test('custom appearance persists and reaches visitors and favorites without deleting hidden content', async t => {
  const app = await fixture(t); const owner = await login(app); const visitor = await login(app)
  const appearance = {
    layout: 'centered', accentColor: '#f4d35e', coverLabel: 'HELLO', coverTitle: '一起创造\n新的可能',
    wordmark: 'MY STUDIO', avatarShape: 'circle', decoration: false, hiddenFields: ['company', 'tags'],
  }
  assert.equal((await save(app, owner, { appearance })).statusCode, 200)
  assert.deepEqual((await login(app, owner.devKey)).card.appearance, appearance)
  const publicCard = (await app.inject(`/api/cards/${owner.card.id}`)).json().data
  assert.deepEqual(publicCard.appearance, appearance)
  assert.equal(publicCard.company, owner.card.company)
  await app.inject({ method: 'PUT', url: `/api/cards/${owner.card.id}/favorite`, headers: headers(visitor) })
  const favorites = (await app.inject({ url: '/api/favorites', headers: headers(visitor) })).json().data.items
  assert.deepEqual(favorites.find(card => card.id === owner.card.id).appearance, appearance)
  for (const invalid of [{ layout: 'unknown' }, { accentColor: 'red' }, { accentColor: '#fff' }, { coverTitle: 'a'.repeat(49) }, { avatarShape: 'star' }, { hiddenFields: ['name'] }, { decoration: 'false' }, { unexpected: true }]) {
    assert.equal((await save(app, owner, { appearance: invalid })).statusCode, 400)
  }
})

test('legacy cards can still be saved with default appearance', async t => {
  const app = await fixture(t); const user = await login(app)
  const legacy = body(user.card)
  delete legacy.appearance
  const response = await app.inject({ method: 'PUT', url: '/api/me/card', headers: headers(user), payload: legacy })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().data.appearance.layout, 'classic')
  assert.deepEqual(response.json().data.appearance.hiddenFields, [])
  assert.deepEqual(response.json().data.sections.map(section => section.id), ['about', 'contact'])
})
test('decorated templates persist for the owner, public visitors and favorites without changing content', async t => {
  const app = await fixture(t); const owner = await login(app); const visitor = await login(app)
  await app.inject({ method: 'PUT', url: `/api/cards/${owner.card.id}/favorite`, headers: headers(visitor) })
  for (const template of ['signature', 'festive', 'business', 'neon', 'floral', 'poster', 'obsidian', 'porcelain', 'editorial', 'sunset', 'aurora', 'botanical']) {
    const response = await save(app, owner, { appearance: { template, coverTitle: '保留自己的封面' } })
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().data.appearance.template, template)
    const restored = (await login(app, owner.devKey)).card
    assert.equal(restored.appearance.template, template)
    const publicCard = (await app.inject(`/api/cards/${owner.card.id}`)).json().data
    assert.equal(publicCard.appearance.template, template)
    assert.equal(publicCard.name, owner.card.name)
    assert.equal(publicCard.bio, owner.card.bio)
    assert.equal(publicCard.appearance.coverTitle, '保留自己的封面')
    const favorites = (await app.inject({ url: '/api/favorites', headers: headers(visitor) })).json().data.items
    assert.equal(favorites.find(card => card.id === owner.card.id).appearance.template, template)
  }
  assert.equal((await save(app, owner, { appearance: { template: 'untrusted' } })).statusCode, 400)
})

test('module order, visibility and custom content survive saves and public reads', async t => {
  const app = await fixture(t); const owner = await login(app)
  const sections = [
    { id: 'services', type: 'text', title: '我的服务', content: '品牌设计\n数字体验', visible: true },
    { id: 'contact', type: 'contact', title: '合作联系', content: '', visible: true },
    { id: 'about', type: 'about', title: '认识我', content: '', visible: false },
  ]
  assert.equal((await save(app, owner, { sections })).statusCode, 200)
  assert.deepEqual((await login(app, owner.devKey)).card.sections, sections)
  assert.deepEqual((await app.inject(`/api/cards/${owner.card.id}`)).json().data.sections, sections)
  for (const invalid of [[sections[0], sections[0]], [{ ...sections[0], title: '' }], [{ ...sections[0], content: 'a'.repeat(1001) }], [{ ...sections[0], type: 'html' }], [{ ...sections[0], visible: 'true' }], [sections[1], { ...sections[1], id: 'other-contact' }], Array.from({ length: 31 }, (_, index) => ({ ...sections[0], id: `text-${index}` }))]) {
    assert.equal((await save(app, owner, { sections: invalid })).statusCode, 400)
  }
  assert.equal((await save(app, owner, { sections: [] })).statusCode, 200)
  assert.deepEqual((await login(app, owner.devKey)).card.sections, [])
})
test('freeform content preserves 30 blocks and independent title visibility', async t => {
  const app = await fixture(t); const owner = await login(app)
  const sections = Array.from({ length: 30 }, (_, index) => ({
    id: `paragraph-${index}`, type: index % 2 ? 'image' : 'text', title: `段落 ${index}`,
    content: `内容 ${index}`, visible: true, showTitle: index === 0,
    ...(index % 2 ? { images: ['https://example.com/image.png'], imageLayout: 'stack' } : {}),
  }))
  assert.equal((await save(app, owner, { sections })).statusCode, 200)
  assert.deepEqual((await login(app, owner.devKey)).card.sections, sections)
  assert.deepEqual((await app.inject(`/api/cards/${owner.card.id}`)).json().data.sections, sections)
  assert.equal((await save(app, owner, { sections: [{ ...sections[0], showTitle: 'false' }] })).statusCode, 400)
})

test('pages and columns survive saves and public reads with legacy defaults', async t => {
  const app = await fixture(t); const owner = await login(app)
  const pages = [{ id: 'main', title: '主页', columns: 1 }, { id: 'work', title: '作品', columns: 2, icon: 'image', presentation: 'article' }]
  const sections = [
    { id: 'intro', type: 'text', title: '介绍', content: '旧模块仍在第一页', visible: true },
    { id: 'work-one', type: 'text', title: '项目一', content: '案例', visible: true, pageId: 'work', columnSpan: 2 },
  ]
  assert.equal((await save(app, owner, { pages, sections })).statusCode, 200)
  assert.deepEqual((await login(app, owner.devKey)).card.pages, pages)
  const publicCard = (await app.inject(`/api/cards/${owner.card.id}`)).json().data
  assert.deepEqual(publicCard.pages, pages)
  assert.deepEqual(publicCard.sections, sections)
  for (const invalid of [[], [pages[0], pages[0]], [{ ...pages[0], title: '' }], [{ ...pages[0], columns: 3 }], [{ ...pages[0], icon: 'unknown' }], [{ ...pages[0], presentation: 'html' }], Array.from({ length: 7 }, (_, index) => ({ ...pages[0], id: `page-${index}` }))])
    assert.equal((await save(app, owner, { pages: invalid })).statusCode, 400)
  for (const change of [{ pageId: 'missing' }, { columnSpan: 3 }])
    assert.equal((await save(app, owner, { pages, sections: [{ ...sections[0], ...change }] })).statusCode, 400)
  const legacy = body(owner.card)
  delete legacy.pages
  const saved = await app.inject({ method: 'PUT', url: '/api/me/card', headers: headers(owner), payload: legacy })
  assert.equal(saved.statusCode, 200)
  assert.deepEqual(saved.json().data.pages, [pages[0]])
})

test('public access honors visibility, including favorites and QR codes', async t => {
  const app = await fixture(t); const a = await login(app); const b = await login(app)
  assert.equal((await app.inject(`/api/cards/${a.card.id}`)).statusCode, 200)
  assert.equal((await app.inject({ method: 'PUT', url: `/api/cards/${a.card.id}/favorite`, headers: headers(b) })).statusCode, 200)
  assert.equal((await save(app, a, { published: false })).statusCode, 200)
  assert.equal((await app.inject(`/api/cards/${a.card.id}`)).statusCode, 404)
  assert.equal((await app.inject({ url: `/api/cards/${a.card.id}`, headers: headers(b) })).statusCode, 404)
  assert.equal((await app.inject({ url: `/api/cards/${a.card.id}`, headers: headers(a) })).statusCode, 200)
  assert.equal((await app.inject({ url: `/api/cards/${a.card.id}/qr`, headers: headers(a) })).statusCode, 400)
  const contacts = (await app.inject({ url: '/api/favorites', headers: headers(b) })).json().data
  assert.ok(!contacts.items.some(card => card.id === a.card.id))
})
test('favorites are idempotent, searchable, paginated and persist removal on re-login', async t => {
  const app = await fixture(t); const user = await login(app)
  for (let i = 0; i < 2; i++) assert.equal((await app.inject({ method: 'PUT', url: '/api/cards/sample-chen/favorite', headers: headers(user) })).statusCode, 200)
  const list = (await app.inject({ url: '/api/favorites?page=1&pageSize=2', headers: headers(user) })).json().data
  assert.equal(list.items.length, 2); assert.equal(list.total, 3)
  const search = (await app.inject({ url: `/api/favorites?search=${encodeURIComponent('摄影')}`, headers: headers(user) })).json().data
  assert.equal(search.items[0].name, '苏念'); assert.equal(search.total, 1)
  await app.inject({ method: 'DELETE', url: '/api/cards/sample-chen/favorite', headers: headers(user) })
  const restored = await login(app, user.devKey)
  const after = (await app.inject({ url: '/api/favorites', headers: headers(restored) })).json().data
  assert.equal(after.total, 2)
  assert.equal((await app.inject({ method: 'PUT', url: `/api/cards/${user.card.id}/favorite`, headers: headers(user) })).statusCode, 400)
  assert.equal((await app.inject({ url: '/api/favorites?page=-1', headers: headers(user) })).statusCode, 400)
})
test('analytics exclude owner visits and deduplicate each visitor per China calendar day', async t => {
  const app = await fixture(t); const owner = await login(app); const visitor = await login(app)
  for (let i = 0; i < 3; i++) {
    await app.inject({ url: `/api/cards/${owner.card.id}`, headers: headers(owner) })
    await app.inject({ url: `/api/cards/${owner.card.id}`, headers: headers(visitor) })
  }
  await app.inject({ method: 'PUT', url: `/api/cards/${owner.card.id}/favorite`, headers: headers(visitor) })
  const stats = (await app.inject({ url: '/api/me/stats', headers: headers(owner) })).json().data
  assert.equal(stats.views, 1); assert.equal(stats.todayViews, 1); assert.equal(stats.favorites, 1)
  assert.equal(stats.days.length, 7); assert.equal(stats.days.at(-1).day, chinaDay())
  assert.equal(stats.days.at(-1).views, 1)
  assert.equal(chinaDay(new Date('2026-10-09T16:30:00Z')), '2026-10-10')
})
test('web QR contains a PNG and a canonical public card URL', async t => {
  const app = await fixture(t, { webUrl: 'https://card.example.com/' }); const user = await login(app)
  const result = await app.inject({ url: `/api/cards/${user.card.id}/qr`, headers: headers(user) })
  assert.equal(result.statusCode, 200)
  const qr = result.json().data
  assert.ok(qr.image.startsWith('data:image/png;base64,iVBOR'))
  assert.equal(qr.url, `https://card.example.com/#/pages/card/card?id=${user.card.id}`)
  assert.equal((await app.inject('/api/cards/not-an-id')).statusCode, 400)
})
test('WeChat login uses server-side identity and first card is private', async t => {
  const app = await fixture(t, { wechat: { login: async code => { assert.equal(code, 'wechat-code'); return 'openid-from-wechat' } } })
  const first = (await app.inject({ method: 'POST', url: '/api/auth/wechat', payload: { code: 'wechat-code' } })).json().data
  const second = (await app.inject({ method: 'POST', url: '/api/auth/wechat', payload: { code: 'wechat-code' } })).json().data
  assert.equal(first.card.id, second.card.id); assert.equal(first.card.published, false)
  assert.equal(first.mode, 'wechat'); assert.equal(first.devKey, undefined)
  assert.equal(first.card.id.length, 24)
  assert.equal((await app.inject(`/api/cards/${first.card.id}`)).statusCode, 404)
})
test('production blocks demo login and requires a strong JWT secret', async t => {
  await assert.rejects(buildApp({ nodeEnv: 'production', jwtSecret: 'weak' }), /JWT_SECRET/)
  const app = await fixture(t, { nodeEnv: 'production', demoEnabled: true })
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/dev', payload: {} })).statusCode, 403)
  assert.equal((await app.inject('/api/health')).json().data.demoEnabled, false)
  assert.equal((await app.inject('/api/cards/sample-chen')).statusCode, 404)
})
test('card data survives closing and reopening SQLite', async () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), 'yimian-test-')), 'cards.sqlite')
  const app = await buildApp({ ...defaults, databasePath })
  const user = await login(app)
  await save(app, user, { name: '持久化验证', appearance: { layout: 'minimal', coverTitle: '持久化封面', accentColor: '#9f3451' } }); await app.close()
  const reopened = await buildApp({ ...defaults, databasePath })
  try {
    const restored = (await login(reopened, user.devKey)).card
    assert.equal(restored.name, '持久化验证')
    assert.equal(restored.appearance.layout, 'minimal')
    assert.equal(restored.appearance.coverTitle, '持久化封面')
    assert.equal(restored.appearance.accentColor, '#9f3451')
  }
  finally { await reopened.close() }
})

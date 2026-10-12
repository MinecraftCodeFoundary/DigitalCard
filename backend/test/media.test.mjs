import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildApp } from '../src/app.mjs'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const settings = { databasePath: ':memory:', jwtSecret: 'media-test-secret-of-at-least-32-characters', demoEnabled: true, nodeEnv: 'test' }
async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'yimian-media-'))
  const app = await buildApp({ ...settings, mediaDirectory: directory })
  t.after(async () => {
    await app.close()
    for (const filename of readdirSync(directory)) unlinkSync(join(directory, filename))
    rmdirSync(directory)
  })
  const login = () => app.inject({ method: 'POST', url: '/api/auth/dev', payload: {} }).then(response => response.json().data)
  return { app, owner: await login(), other: await login(), directory }
}
const headers = user => ({ authorization: `Bearer ${user.token}` })
function upload(app, user, bytes = png, filename = 'photo.png', mime = 'image/png') {
  const boundary = 'yimian-media-test-boundary'
  return app.inject({ method: 'POST', url: '/api/media', headers: {
    ...headers(user), 'content-type': `multipart/form-data; boundary=${boundary}`,
  }, payload: Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`),
    bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]) })
}
function save(app, user, overrides) {
  const { id, updatedAt, mediaAccess, ...body } = user.card
  return app.inject({ method: 'PUT', url: '/api/me/card', headers: headers(user), payload: { ...body, ...overrides } })
}

test('uploads validate actual bytes, isolate ownership, preserve privacy and support ranges', async t => {
  const { app, owner, other, directory } = await fixture(t)
  assert.equal((await app.inject({ method: 'POST', url: '/api/media', payload: {} })).statusCode, 401)
  const uploaded = await upload(app, owner)
  assert.equal(uploaded.statusCode, 200, uploaded.body)
  const media = uploaded.json().data
  assert.equal(media.kind, 'image'); assert.equal(media.size, png.length)
  assert.equal((await app.inject(media.url)).statusCode, 404)
  const preview = await app.inject(media.previewUrl)
  assert.equal(preview.statusCode, 200); assert.deepEqual(preview.rawPayload, png)
  assert.equal(preview.headers['content-type'], 'image/png')
  assert.equal((await app.inject(media.previewUrl.replace(/.$/, 'x'))).statusCode, 404)
  const section = { id: 'photos', type: 'image', title: '作品', content: '', visible: true, images: [media.url], imageLayout: 'grid' }
  assert.equal((await save(app, other, { sections: [section] })).statusCode, 400)
  assert.equal((await save(app, owner, { sections: [section], published: true })).statusCode, 200)
  assert.deepEqual((await app.inject(media.url)).rawPayload, png)
  const range = await app.inject({ url: media.url, headers: { range: 'bytes=0-7' } })
  assert.equal(range.statusCode, 206); assert.deepEqual(range.rawPayload, png.subarray(0, 8))
  assert.equal(range.headers['content-range'], `bytes 0-7/${png.length}`)
  const suffix = await app.inject({ url: media.url, headers: { range: 'bytes=-4' } })
  assert.equal(suffix.statusCode, 206); assert.deepEqual(suffix.rawPayload, png.subarray(-4))
  for (const range of ['bytes=999999-', 'bytes=8-2', 'bytes=0-1,3-4', 'bytes=-0'])
    assert.equal((await app.inject({ url: media.url, headers: { range } })).statusCode, 416)
  assert.equal((await save(app, owner, { sections: [{ ...section, visible: false }] })).statusCode, 200)
  assert.equal((await app.inject(media.url)).statusCode, 404)
  assert.equal((await save(app, owner, { sections: [section], published: false })).statusCode, 200)
  assert.equal((await app.inject(media.url)).statusCode, 404)
  const mine = (await app.inject({ url: '/api/me/card', headers: headers(owner) })).json().data
  assert.equal((await app.inject(mine.mediaAccess[media.url])).statusCode, 200)
  const before = readdirSync(directory).length
  assert.equal((await upload(app, owner, Buffer.from('<script>alert(1)</script>'), 'fake.png')).statusCode, 400)
  assert.equal((await upload(app, owner, Buffer.from('a'), 'tiny.mp4', 'video/mp4')).statusCode, 400)
  assert.equal((await upload(app, owner, Buffer.concat([png, Buffer.alloc(8 * 1024 * 1024)]))).statusCode, 413)
  assert.equal(readdirSync(directory).length, before)
})

test('nested Card media retains ownership, private previews, and parent visibility', async t => {
  const { app, owner, other } = await fixture(t)
  const media = (await upload(app, owner)).json().data
  const block = { id: 'picture', type: 'image', title: '作品图片', content: '', visible: true, images: [media.url] }
  const section = { id: 'custom', type: 'card', title: '作品 Card', content: '', visible: true, cardLayout: 'stack', blocks: [block] }
  assert.equal((await save(app, other, { sections: [section] })).statusCode, 400)
  assert.equal((await save(app, owner, { sections: [section], published: false })).statusCode, 200)
  const mine = (await app.inject({ url: '/api/me/card', headers: headers(owner) })).json().data
  assert.equal((await app.inject(mine.mediaAccess[media.url])).statusCode, 200)
  assert.equal((await app.inject(media.url)).statusCode, 404)
  assert.equal((await save(app, owner, { sections: [section], published: true })).statusCode, 200)
  assert.equal((await app.inject(media.url)).statusCode, 200)
  assert.deepEqual((await app.inject(`/api/cards/${owner.card.id}`)).json().data.sections, [section])
  assert.equal((await save(app, owner, { sections: [{ ...section, visible: false }], published: true })).statusCode, 200)
  assert.equal((await app.inject(media.url)).statusCode, 404)
  assert.equal((await save(app, owner, { sections: [{ ...section, blocks: [{ ...block, visible: false }] }], published: true })).statusCode, 200)
  assert.equal((await app.inject(media.url)).statusCode, 404)
  assert.equal((await save(app, owner, { sections: [{ ...section, blocks: [{ id: 'video', type: 'video', title: '视频', content: '', visible: true, url: media.url }] }] })).statusCode, 400)
  assert.equal((await save(app, owner, { sections: [{ ...section, blocks: [block, block] }] })).statusCode, 400)
  assert.equal((await save(app, owner, { sections: [{ ...section, blocks: [{ ...block, type: 'card', blocks: [] }] }] })).statusCode, 400)
})

test('portrait cover uploads preserve ownership and privacy through publication and layout changes', async t => {
  const { app, owner, other } = await fixture(t)
  const media = (await upload(app, owner)).json().data
  const appearance = { layout: 'portrait', coverImage: media.url }
  assert.equal((await save(app, other, { appearance })).statusCode, 400)
  assert.equal((await save(app, owner, { appearance, published: false, sections: [] })).statusCode, 200)
  assert.equal((await app.inject(media.url)).statusCode, 404)
  const mine = (await app.inject({ url: '/api/me/card', headers: headers(owner) })).json().data
  assert.equal((await app.inject(mine.mediaAccess[media.url])).statusCode, 200)
  assert.equal((await save(app, owner, { appearance, published: true, sections: [] })).statusCode, 200)
  assert.equal((await app.inject(media.url)).statusCode, 200)
  const publicCard = (await app.inject(`/api/cards/${owner.card.id}`)).json().data
  assert.equal(publicCard.appearance.coverImage, media.url)
  assert.equal(publicCard.mediaAccess, undefined)
  assert.equal((await save(app, owner, { appearance: { ...appearance, layout: 'classic' }, sections: [] })).statusCode, 200)
  assert.equal((await app.inject(media.url)).statusCode, 404)
  assert.equal((await save(app, owner, { appearance: { layout: 'portrait', coverImage: 'javascript:alert(1)' } })).statusCode, 400)
})

test('poster logo and portrait retain ownership, private preview access and layout-based publication', async t => {
  const { app, owner, other } = await fixture(t)
  const portrait = (await upload(app, owner)).json().data
  const logo = (await upload(app, owner)).json().data
  const appearance = { template: 'poster', layout: 'poster', coverImage: portrait.url, brandLogo: logo.url, posterPortraitScale: 1.2, posterPortraitX: -5, posterFooter: '连接专业，让合作发生' }
  assert.equal((await save(app, other, { appearance })).statusCode, 400)
  assert.equal((await save(app, owner, { appearance, published: false, sections: [] })).statusCode, 200)
  const mine = (await app.inject({ url: '/api/me/card', headers: headers(owner) })).json().data
  for (const asset of [portrait, logo]) {
    assert.equal((await app.inject(asset.url)).statusCode, 404)
    assert.equal((await app.inject(mine.mediaAccess[asset.url])).statusCode, 200)
  }
  assert.equal((await save(app, owner, { appearance, published: true, sections: [] })).statusCode, 200)
  for (const asset of [portrait, logo]) assert.equal((await app.inject(asset.url)).statusCode, 200)
  assert.equal((await save(app, owner, { appearance: { ...appearance, layout: 'classic' }, sections: [] })).statusCode, 200)
  for (const asset of [portrait, logo]) assert.equal((await app.inject(asset.url)).statusCode, 404)
  for (const invalid of [{ posterPortraitScale: 1.5 }, { posterPortraitX: 21 }, { brandLogo: 'javascript:alert(1)' }])
    assert.equal((await save(app, owner, { appearance: { ...appearance, ...invalid } })).statusCode, 400)
})

test('media modules validate sources, required assets, limits and mixed content', async t => {
  const { app, owner } = await fixture(t)
  const base = { id: 'module', title: '媒体', content: '介绍', visible: true }
  for (const section of [
    { ...base, type: 'image', images: [] },
    { ...base, type: 'image', images: ['javascript:alert(1)'] },
    { ...base, type: 'image', images: Array(7).fill('https://example.com/photo.png') },
    { ...base, type: 'video', url: '' },
    { ...base, type: 'video', url: 'blob:temporary' },
    { ...base, type: 'video', url: 'https://example.com/video.mp4', poster: 'file:///private.png' },
    { ...base, type: 'link', url: 'javascript:alert(1)' },
  ]) assert.equal((await save(app, owner, { sections: [section] })).statusCode, 400)
  const sections = [
    { ...base, id: 'gallery', type: 'image', images: ['https://example.com/photo.png'], imageLayout: 'stack' },
    { ...base, id: 'video', type: 'video', url: 'https://example.com/video.mp4', poster: 'https://example.com/poster.png' },
    { ...base, id: 'link', type: 'link', url: 'https://example.com/portfolio', buttonLabel: '查看作品集' },
  ]
  assert.equal((await save(app, owner, { sections })).statusCode, 200)
  assert.deepEqual((await app.inject(`/api/cards/${owner.card.id}`)).json().data.sections, sections)
})

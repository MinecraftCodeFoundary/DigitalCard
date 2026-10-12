import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGateway } from '../src/gateway.mjs'
test('H5 gateway forwards method, query and token to cloud and preserves authorization failures', async t => {
  const calls = []
  const cloud = { callFunction: async options => { calls.push(options); return { result: { code: 401, message: '登录已过期' } } } }
  const app = await buildGateway({ cloud })
  t.after(() => app.close())
  const response = await app.inject({ method: 'GET', url: '/api/me/messages?page=2', headers: { authorization: 'Bearer abc' } })
  assert.equal(response.statusCode, 401)
  assert.equal(calls[0].name, 'digitalCard')
  assert.equal(calls[0].data.path, '/api/me/messages?page=2')
  assert.equal(calls[0].data.token, 'abc')
})
test('missing cloud credentials fail explicitly instead of silently storing accounts locally', async t => {
  const app = await buildGateway()
  t.after(() => app.close())
  const response = await app.inject({ method: 'POST', url: '/api/auth/wechat', payload: { code: 'wechat-code' } })
  assert.equal(response.statusCode, 503)
  assert.match(response.json().message, /凭证/)
})

test('H5 upload preserves a committed media reference when its cloud preview is unavailable', async t => {
  const id = 'a'.repeat(24)
  const cloudPath = `staging/gateway-owner/${id}`
  const fileID = `cloud://test.bucket/${cloudPath}`
  const bytes = Buffer.from('isolated upload bytes')
  const calls = [], uploads = [], removals = []
  const committed = { code: 0, data: { url: `/api/media/${id}`, kind: 'image', size: bytes.length, mediaUnavailable: true } }
  const cloud = {
    callFunction: async ({ data }) => {
      calls.push(data)
      return { result: data.path === '/api/media/reserve' ? { code: 0, data: { id, cloudPath } } : committed }
    },
    uploadFile: async options => { uploads.push(options); return { fileID } },
    deleteFile: async options => { removals.push(options); return { fileList: [] } },
  }
  const app = await buildGateway({ cloud })
  t.after(() => app.close())
  const boundary = 'isolated-gateway-media'
  const response = await app.inject({ method: 'POST', url: '/api/media', headers: {
    authorization: 'Bearer isolated-token', 'content-type': `multipart/form-data; boundary=${boundary}`,
  }, payload: Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n`),
    bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]) })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), committed)
  assert.deepEqual(calls.map(call => call.path), ['/api/media/reserve', '/api/media/commit'])
  assert.deepEqual(calls[1].data, { id, fileID })
  assert.equal(calls[1].token, 'isolated-token')
  assert.deepEqual(uploads, [{ cloudPath, fileContent: bytes }])
  assert.deepEqual(removals, [{ fileList: [fileID] }])
})

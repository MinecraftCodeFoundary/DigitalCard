import test from 'node:test'
import assert from 'node:assert/strict'
import { CloudStorage } from '../digitalCard/storage.mjs'
test('temporary URLs are requested in batches of fifty with a five-minute lifetime', async () => {
  const calls = []
  const storage = new CloudStorage({ getTempFileURL: async ({ fileList }) => {
    calls.push(fileList)
    return { fileList: fileList.map(file => ({ ...file, status: 0, tempFileURL: `https://storage.test/${file.fileID}` })) }
  } })
  const result = await storage.urls(Array.from({ length: 123 }, (_, id) => String(id)))
  assert.deepEqual(calls.map(call => call.length), [50, 50, 23])
  assert.equal(calls[0][0].maxAge, 300)
  assert.equal(Object.keys(result).length, 123)
})
test('download rejects large declared files before consuming their bodies', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  let cancelled = false
  globalThis.fetch = async () => ({ ok: true, headers: new Headers({ 'content-length': String(51 * 1024 * 1024) }),
    body: { cancel: async () => { cancelled = true } } })
  const storage = new CloudStorage({})
  storage.urls = async () => ({ file: 'https://storage.test/file' })
  await assert.rejects(storage.download('file'), error => error.statusCode === 413)
  assert.equal(cancelled, true)
})
test('download bounds a stream even when content-length is omitted or incorrect', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  const storage = new CloudStorage({})
  storage.urls = async () => ({ file: 'https://storage.test/file' })
  globalThis.fetch = async () => ({ ok: true, headers: new Headers(), body: (async function* () {
    yield Buffer.alloc(50 * 1024 * 1024)
    yield Buffer.from('overflow')
  })() })
  await assert.rejects(storage.download('file'), error => error.statusCode === 413)
  globalThis.fetch = async () => ({ ok: true, headers: new Headers(), body: (async function* () { yield Buffer.from('valid') })() })
  assert.equal((await storage.download('file')).toString(), 'valid')
})

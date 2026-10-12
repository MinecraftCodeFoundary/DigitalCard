import { afterEach, describe, expect, it, vi } from 'vitest'
import { mediaUrl, validMediaUrl } from './media'
import { parseMediaUpload } from '@/http/validators'

describe('media boundaries', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('accepts persistent media sources and rejects scripts and temporary paths', () => {
    for (const value of ['https://example.com/image.png', 'http://localhost:3000/video.webm', `/api/media/${'a'.repeat(24)}`])
      expect(validMediaUrl(value)).toBe(true)
    for (const value of ['javascript:alert(1)', 'data:image/png;base64,abc', 'blob:temporary', 'file:///photo.png', 'https://user:secret@example.com/video.mp4', '', null])
      expect(validMediaUrl(value)).toBe(false)
  })
  it('resolves signed preview URLs without saving them as module sources', () => {
    vi.stubEnv('VITE_SERVER_BASEURL', 'http://localhost:3000/api')
    const url = `/api/media/${'a'.repeat(24)}`
    const previewUrl = `${url}?preview=1799999999.${'b'.repeat(64)}`
    expect(mediaUrl(url, { [url]: previewUrl })).toContain(previewUrl)
    expect(parseMediaUpload({ url, previewUrl, kind: 'image', size: 100 }).url).toBe(url)
    for (const bad of [{ url: 'javascript:alert(1)', previewUrl, kind: 'image', size: 100 }, { url, previewUrl: '/wrong', kind: 'image', size: 100 }, { url, previewUrl, kind: 'html', size: 100 }])
      expect(() => parseMediaUpload(bad)).toThrow('无效数据')
  })
  it('keeps production media on the same origin when the gateway is /api', () => {
    const url = `/api/media/${'a'.repeat(24)}`
    const previewUrl = `${url}?preview=1799999999.${'b'.repeat(64)}`
    for (const gateway of ['/api', '/api/']) {
      vi.stubEnv('VITE_SERVER_BASEURL', gateway)
      expect(mediaUrl(url)).toBe(url)
      expect(mediaUrl(url, { [url]: previewUrl })).toBe(previewUrl)
      expect(mediaUrl(url, { [url]: 'https://storage.example.com/photo.png' })).toBe('https://storage.example.com/photo.png')
    }
  })
})

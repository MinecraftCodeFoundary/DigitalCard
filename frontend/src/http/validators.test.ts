import { describe, expect, it } from 'vitest'
import { defaultAppearance } from '@/utils/appearance'
import {
  parseAccount,
  parseCard,
  parseList,
  parseLogin,
  parseLogout,
  parseMediaUpload,
  parseMembership,
  parseMessageList,
  parseMessageSubmission,
  parseQr,
  parseStats,
} from './validators'

describe('hTTP response boundaries', () => {
  it('accepts legacy favorite lists and validates unavailable IDs before removal', () => {
    const list = { items: [], total: 0, page: 1, pageSize: 20 }
    expect(parseList(list).unavailableIds).toBeUndefined()
    const unavailableIds = ['a'.repeat(24), 'sample-chen']
    expect(parseList({ ...list, unavailableIds }).unavailableIds).toEqual(unavailableIds)
    for (const ids of [null, 'a'.repeat(24), [123], ['../me/card'], [{}]])
      expect(() => parseList({ ...list, unavailableIds: ids })).toThrow('无效数据')
  })
  it('requires page icons to be supported strings instead of coercible values', () => {
    const card = { id: 'a'.repeat(24), name: 'Alice', title: '', company: '', phone: '', email: '', wechat: '', location: '', bio: '', avatar: '', website: '', tags: [], theme: 'forest', published: false, updatedAt: '2026-10-10' }
    const page = { id: 'main', title: '主页', columns: 1 }
    expect(parseCard({ ...card, pages: [page] }).pages).toEqual([page])
    for (const icon of ['user', 'company', 'product', 'contact', 'image', 'video', 'link'])
      expect(parseCard({ ...card, pages: [{ ...page, icon }] }).pages?.[0].icon).toBe(icon)
    for (const icon of [['user'], { toString: () => 'user' }, null, 123, '', 'unknown'])
      expect(() => parseCard({ ...card, pages: [{ ...page, icon }] })).toThrow('无效数据')
  })
  it('accepts the new template IDs and rejects unknown or malformed IDs', () => {
    const card = { id: 'a'.repeat(24), name: 'Alice', title: '', company: '', phone: '', email: '', wechat: '', location: '', bio: '', avatar: '', website: '', tags: [], theme: 'forest', published: false, updatedAt: '2026-10-10' }
    for (const template of ['obsidian', 'porcelain', 'editorial', 'sunset', 'aurora', 'botanical']) {
      const appearance = { ...defaultAppearance(), template }
      expect(parseCard({ ...card, appearance }).appearance).toEqual(appearance)
    }
    for (const template of ['unknown', 'Obsidian', '', null, 123, ['aurora']])
      expect(() => parseCard({ ...card, appearance: { ...defaultAppearance(), template } })).toThrow('无效数据')
  })
  it('validates the temporary media warning without changing the card body', () => {
    const card = { id: 'a'.repeat(24), name: 'Alice', title: '', company: '', phone: '', email: '', wechat: '', location: '', bio: '', avatar: '', website: '', tags: [], theme: 'forest', published: false, updatedAt: '2026-10-10', mediaAccess: {} }
    expect(parseCard({ ...card, mediaUnavailable: true }).mediaUnavailable).toBe(true)
    expect(parseCard(card).mediaUnavailable).toBeUndefined()
    expect(() => parseCard({ ...card, mediaUnavailable: 'true' })).toThrow('无效数据')
  })
  it('accepts cloud HTTPS preview URLs while rejecting unsafe schemes and credentials', () => {
    const value = { url: `/api/media/${'a'.repeat(24)}`, previewUrl: 'https://storage.example.test/file?sign=abc', kind: 'image', size: 120 }
    expect(parseMediaUpload(value)).toEqual(value)
    for (const previewUrl of ['javascript:alert(1)', 'http://storage.example.test/file', 'https://user:password@storage.example.test/file'])
      expect(() => parseMediaUpload({ ...value, previewUrl })).toThrow('无效数据')
  })
  it('accepts committed media without a preview only when preview unavailability is explicit', () => {
    const value = { url: `/api/media/${'a'.repeat(24)}`, kind: 'image', size: 120 }
    const unavailable = { ...value, mediaUnavailable: true }
    expect(parseMediaUpload(unavailable)).toEqual(unavailable)
    for (const mediaUnavailable of [undefined, false, 'true', 1, null])
      expect(() => parseMediaUpload({ ...value, mediaUnavailable })).toThrow('无效数据')
    for (const previewUrl of ['', null, 'javascript:alert(1)', 'http://storage.example.test/file', 'https://user:password@storage.example.test/file'])
      expect(() => parseMediaUpload({ ...unavailable, previewUrl })).toThrow('无效数据')
    expect(parseMediaUpload({ ...value, previewUrl: 'https://storage.example.test/restored.png' }).previewUrl).toBe('https://storage.example.test/restored.png')
  })
  it('requires a string media kind for both normal and unavailable previews', () => {
    const value = { url: `/api/media/${'a'.repeat(24)}`, size: 120 }
    for (const preview of [{ previewUrl: 'https://storage.example.test/file.png' }, { mediaUnavailable: true }]) {
      for (const kind of ['image', 'video'])
        expect(parseMediaUpload({ ...value, ...preview, kind }).kind).toBe(kind)
      for (const kind of [['image'], ['video'], { toString: () => 'image' }, null, 1])
        expect(() => parseMediaUpload({ ...value, ...preview, kind })).toThrow('无效数据')
    }
  })
  it('rejects malformed server data before it reaches the UI', () => {
    for (const parser of [
      parseCard,
      parseList,
      parseStats,
      parseQr,
      parseLogin,
      parseMessageList,
      parseMessageSubmission,
      parseAccount,
      parseLogout,
    ]) {
      for (const value of [null, 'success', [], {}, { code: 0 }])
        expect(() => parser(value)).toThrow('无效数据')
    }
  })
  it('validates account profiles and logout acknowledgements', () => {
    const profile = { id: 'a'.repeat(24), mode: 'wechat', createdAt: '2026-10-10T10:00:00.000Z' }
    expect(parseAccount(profile)).toEqual({ ...profile, membership: { plan: 'free', expiresAt: null, isVip: false } })
    expect(parseLogout({ loggedOut: true })).toEqual({ loggedOut: true })
    for (const value of [{ ...profile, mode: 'account' }, { ...profile, mode: 'unknown' }, { ...profile, createdAt: 'invalid' }])
      expect(() => parseAccount(value)).toThrow('无效数据')
    expect(() => parseLogout({ loggedOut: false })).toThrow('无效数据')
  })
  it('validates membership from the server and defaults missing entitlement to free', () => {
    expect(parseMembership(undefined)).toEqual({ plan: 'free', expiresAt: null, isVip: false })
    const vip = { plan: 'vip', expiresAt: '2026-12-01T00:00:00.000Z', isVip: true }
    expect(parseMembership(vip)).toEqual(vip)
    expect(parseMembership({ ...vip, isVip: false }).isVip).toBe(false)
    for (const value of [null, {}, { ...vip, plan: 'admin' }, { ...vip, isVip: 'true' }, { ...vip, expiresAt: 'invalid' }, { ...vip, plan: 'free' }])
      expect(() => parseMembership(value)).toThrow('无效数据')
  })
  it('validates private message lists and submission acknowledgements', () => {
    const item = { id: 'a'.repeat(24), name: '访客', contact: '', content: '你好', createdAt: '2026-10-10T10:00:00.000Z' }
    const list = { items: [item], total: 1, page: 1, pageSize: 10 }
    expect(parseMessageList(list)).toEqual(list)
    expect(parseMessageSubmission({ submitted: true })).toEqual({ submitted: true })
    for (const invalid of [{ ...list, page: 0 }, { ...list, items: [{ ...item, content: 42 }] }, { ...list, items: [{ ...item, createdAt: 'invalid' }] }])
      expect(() => parseMessageList(invalid)).toThrow('无效数据')
    expect(() => parseMessageSubmission({ submitted: false })).toThrow('无效数据')
  })
  it('rejects unsafe QR payloads and invalid count values', () => {
    expect(() =>
      parseQr({
        image: 'javascript:alert(1)',
        url: 'https://example.com',
        mode: 'web',
      }),
    ).toThrow()
    expect(() =>
      parseStats({
        views: -1,
        todayViews: 0,
        favorites: 0,
        contacts: 0,
        days: [],
      }),
    ).toThrow()
  })
})

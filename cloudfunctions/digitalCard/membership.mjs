import { isDeepStrictEqual } from 'node:util'
import { fail } from './schema.mjs'

export const FREE_APPEARANCE = Object.freeze({
  template: 'signature', layout: 'minimal', accentColor: '',
  coverLabel: 'THE ART OF CONNECTION', coverTitle: '每一次相遇\n都有新的可能。',
  wordmark: 'YIMIAN.', avatarShape: 'rounded', decoration: false, hiddenFields: [],
})
export const FREE_PAGES = Object.freeze([{ id: 'main', title: '主页', columns: 1 }])
export const FREE_SECTIONS = Object.freeze([
  { id: 'about', type: 'about', title: '关于我', content: '', visible: true },
  { id: 'contact', type: 'contact', title: '保持联系', content: '', visible: true },
])
export const BASIC_FIELDS = Object.freeze(['name', 'title', 'company', 'phone', 'email', 'wechat',
  'location', 'bio', 'avatar', 'website', 'tags', 'published'])

export function expiryTimestamp(value) {
  if (typeof value !== 'string') return NaN
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!parts) return NaN
  const [, year, month, day, hour, minute, second, , zone] = parts
  const local = new Date(0)
  local.setUTCFullYear(Number(year), Number(month) - 1, Number(day))
  local.setUTCHours(Number(hour), Number(minute), Number(second), 0)
  if (local.getUTCFullYear() !== Number(year) || local.getUTCMonth() !== Number(month) - 1
    || local.getUTCDate() !== Number(day) || local.getUTCHours() !== Number(hour)
    || local.getUTCMinutes() !== Number(minute) || local.getUTCSeconds() !== Number(second)
    || zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return NaN
  return Date.parse(value)
}

// Missing or malformed membership records never grant access. Only an explicit
// null expiry means permanent VIP; an omitted expiry is not a permanent grant.
export function membershipProfile(user, clockValue = Date.now()) {
  const record = user?.membership
  const plan = record?.plan === 'vip' ? 'vip' : 'free'
  const expiresAt = typeof record?.expiresAt === 'string' ? record.expiresAt : null
  const expiry = expiryTimestamp(expiresAt)
  const isVip = plan === 'vip' && (record.expiresAt === null || Number.isFinite(expiry) && expiry > clockValue)
  return { plan, expiresAt: plan === 'vip' && Number.isFinite(expiry) ? expiresAt : null, isVip }
}

export function requireVip(user, clockValue = Date.now()) {
  if (!membershipProfile(user, clockValue).isVip) throw fail('此功能仅限 VIP 用户使用', 403)
}

export function assertFavoriteCapacity(user, count, clockValue = Date.now()) {
  const isVip = membershipProfile(user, clockValue).isVip
  if (count >= (isVip ? 50 : 10)) throw fail(isVip
    ? 'VIP 名片夹最多收藏 50 张名片，请先移除部分收藏'
    : '普通用户名片夹最多收藏 10 张名片，VIP 可收藏 50 张', 403)
}

export function projectCardBody(body, user, clockValue = Date.now()) {
  if (membershipProfile(user, clockValue).isVip) return structuredClone(body)
  return {
    ...Object.fromEntries(BASIC_FIELDS.filter(key => key in body).map(key => [key, structuredClone(body[key])])),
    theme: 'forest', appearance: structuredClone(FREE_APPEARANCE),
    pages: structuredClone(FREE_PAGES), sections: structuredClone(FREE_SECTIONS),
  }
}

// The editor adds these neutral defaults when normalizing older cards.
// Remove only neutral values before comparing, never arbitrary extra fields.
function comparableFreeBody(body) {
  const appearance = { ...body.appearance }
  for (const key of ['coverImage', 'brandLogo', 'posterFooter']) if (appearance[key] === '') delete appearance[key]
  const pages = body.pages.map(page => {
    const result = { ...page }
    if (result.icon === 'user') delete result.icon
    if (result.presentation === 'cards') delete result.presentation
    return result
  })
  const sections = body.sections.map(section => {
    const result = { ...section }
    if (result.pageId === 'main') delete result.pageId
    if (result.columnSpan === 1) delete result.columnSpan
    if (result.showTitle === true) delete result.showTitle
    return result
  })
  return { theme: body.theme, appearance, pages, sections }
}

export function assertFreeCard(body) {
  const canonical = { theme: 'forest', appearance: FREE_APPEARANCE, pages: FREE_PAGES, sections: FREE_SECTIONS }
  if (!isDeepStrictEqual(comparableFreeBody(body), canonical))
    throw fail('免费用户仅可使用基础简易名片，高级设计与内容功能需要 VIP', 403)
}

export function prepareFreeInput(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  return { theme: 'forest', pages: structuredClone(FREE_PAGES), sections: structuredClone(FREE_SECTIONS), ...data,
    ...(data.appearance === undefined ? { appearance: structuredClone(FREE_APPEARANCE) }
      : data.appearance && typeof data.appearance === 'object' && !Array.isArray(data.appearance)
        ? { appearance: { ...structuredClone(FREE_APPEARANCE), ...data.appearance } } : {}),
  }
}

export function mergeBasicFields(previous, body) {
  // Retain the VIP design so upgrading again restores it, while edits to basic
  // personal/contact information and publication state still take effect.
  return { ...previous, ...Object.fromEntries(BASIC_FIELDS.map(key => [key, body[key]])) }
}

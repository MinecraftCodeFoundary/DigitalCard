import type {
  AccountProfile,
  Card,
  CardList,
  LoginResponse,
  MediaUpload,
  Membership,
  MessageList,
  QrResponse,
  Stats,
} from '@/api/types'
import { HttpError } from './errors'
import { defaultAppearance } from '@/utils/appearance'
import { cardTemplates } from '@/utils/templates'
import { defaultSections } from '@/utils/sections'
import { defaultPages } from '@/utils/pages'
import { validMediaUrl } from '@/utils/media'
import { validCardId } from '@/utils/card'

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function invalid(): never {
  throw new HttpError('服务返回了无效数据，请重试', 502)
}
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}
function validPreview(url: string, preview: unknown): preview is string {
  return typeof preview === 'string' && (new RegExp(`^${url}\\?preview=\\d{10}\\.[a-f\\d]{64}$`).test(preview)
    || (preview.startsWith('https://') && validMediaUrl(preview)))
}
function validContentBlock(block: unknown): boolean {
  return record(block)
    && typeof block.id === 'string' && /^[a-z\d-]{1,60}$/.test(block.id)
    && ['text', 'image', 'video', 'link'].includes(String(block.type))
    && typeof block.title === 'string' && block.title.trim().length > 0 && block.title.length <= 40
    && typeof block.content === 'string' && block.content.length <= 1000
    && typeof block.visible === 'boolean'
    && (block.showTitle === undefined || typeof block.showTitle === 'boolean')
    && (block.columnSpan === undefined || block.columnSpan === 1 || block.columnSpan === 2)
    && (block.images === undefined || (Array.isArray(block.images) && block.images.length <= 6 && block.images.every(validMediaUrl)))
    && (block.url === undefined || block.url === '' || validMediaUrl(block.url))
    && (block.poster === undefined || block.poster === '' || validMediaUrl(block.poster))
    && (block.imageLayout === undefined || ['grid', 'stack'].includes(String(block.imageLayout)))
    && (block.buttonLabel === undefined || (typeof block.buttonLabel === 'string' && block.buttonLabel.length <= 30))
    && (block.type !== 'image' || (Array.isArray(block.images) && block.images.length > 0))
    && (!['video', 'link'].includes(String(block.type)) || validMediaUrl(block.url))
    && (block.type !== 'link' || /^https?:\/\//.test(String(block.url)))
    && block.blocks === undefined && block.pageId === undefined && block.cardLayout === undefined
}
export function parseCard(value: unknown): Card {
  if (!record(value))
    return invalid()
  const keys = [
    'id',
    'name',
    'title',
    'company',
    'phone',
    'email',
    'wechat',
    'location',
    'bio',
    'avatar',
    'website',
    'updatedAt',
  ]
  if (
    !keys.every(key => typeof value[key] === 'string')
    || !Array.isArray(value.tags)
    || !value.tags.every(tag => typeof tag === 'string')
    || !['forest', 'sand', 'ink'].includes(String(value.theme))
    || typeof value.published !== 'boolean'
    || (value.isOwner !== undefined && typeof value.isOwner !== 'boolean')
    || (value.isVip !== undefined && typeof value.isVip !== 'boolean')
    || (value.isFavorite !== undefined && typeof value.isFavorite !== 'boolean')
    || (value.mediaUnavailable !== undefined && typeof value.mediaUnavailable !== 'boolean')
  ) {
    return invalid()
  }
  if (value.appearance !== undefined) {
    const style = value.appearance
    if (!record(style)
      || (style.template !== undefined && !cardTemplates.some(template => template.id === style.template))
      || !['classic', 'centered', 'minimal', 'portrait', 'poster'].includes(String(style.layout))
      || (style.coverImage !== undefined && style.coverImage !== '' && !validMediaUrl(style.coverImage))
      || (style.brandLogo !== undefined && style.brandLogo !== '' && !validMediaUrl(style.brandLogo))
      || (style.posterPortraitScale !== undefined && (typeof style.posterPortraitScale !== 'number' || !Number.isFinite(style.posterPortraitScale) || style.posterPortraitScale < 0.7 || style.posterPortraitScale > 1.4))
      || (style.posterPortraitX !== undefined && (typeof style.posterPortraitX !== 'number' || !Number.isFinite(style.posterPortraitX) || style.posterPortraitX < -20 || style.posterPortraitX > 20))
      || (style.posterFooter !== undefined && (typeof style.posterFooter !== 'string' || style.posterFooter.length > 60))
      || typeof style.accentColor !== 'string'
      || !/^(?:#[a-f\d]{6})?$/i.test(style.accentColor)
      || typeof style.coverLabel !== 'string' || style.coverLabel.length > 32
      || typeof style.coverTitle !== 'string' || style.coverTitle.length > 48
      || typeof style.wordmark !== 'string' || style.wordmark.length > 24
      || !['rounded', 'circle', 'square'].includes(String(style.avatarShape))
      || typeof style.decoration !== 'boolean'
      || !Array.isArray(style.hiddenFields) || style.hiddenFields.length > 4
      || !style.hiddenFields.every(field => ['title', 'company', 'location', 'tags'].includes(field))) {
      return invalid()
    }
  }
  const pages = value.pages ?? defaultPages()
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 6
    || !pages.every(page => record(page) && typeof page.id === 'string' && /^[a-z\d-]{1,60}$/.test(page.id)
      && typeof page.title === 'string' && page.title.trim().length > 0 && page.title.length <= 24
      && (page.columns === 1 || page.columns === 2)
      && (page.icon === undefined || (typeof page.icon === 'string' && ['user', 'company', 'product', 'contact', 'image', 'video', 'link'].includes(page.icon)))
      && (page.presentation === undefined || ['cards', 'article'].includes(String(page.presentation))))
    || new Set(pages.map(page => page.id)).size !== pages.length) {
    return invalid()
  }
  if (value.pages === null)
    return invalid()
  if (value.sections !== undefined) {
    if (!Array.isArray(value.sections) || value.sections.length > 30
      || !value.sections.every(section => record(section)
        && typeof section.id === 'string' && /^[a-z\d-]{1,60}$/.test(section.id)
        && ['about', 'contact', 'text', 'image', 'video', 'link', 'card'].includes(String(section.type))
        && typeof section.title === 'string' && section.title.trim().length > 0 && section.title.length <= 40
        && typeof section.content === 'string' && section.content.length <= 1000
        && typeof section.visible === 'boolean'
        && (section.showTitle === undefined || typeof section.showTitle === 'boolean')
        && (section.cardLayout === undefined || (section.type === 'card' && ['stack', 'columns', 'showcase'].includes(String(section.cardLayout))))
        && (section.type === 'card'
          ? Array.isArray(section.blocks) && section.blocks.length <= 20 && section.blocks.every(validContentBlock)
          && new Set(section.blocks.map(block => block.id)).size === section.blocks.length
          : section.blocks === undefined)
        && (section.pageId === undefined || pages.some(page => page.id === section.pageId))
        && (section.columnSpan === undefined || section.columnSpan === 1 || section.columnSpan === 2)
        && (section.images === undefined || (Array.isArray(section.images) && section.images.length <= 6 && section.images.every(validMediaUrl)))
        && (section.url === undefined || section.url === '' || validMediaUrl(section.url))
        && (section.poster === undefined || section.poster === '' || validMediaUrl(section.poster))
        && (section.imageLayout === undefined || ['grid', 'stack'].includes(String(section.imageLayout)))
        && (section.buttonLabel === undefined || (typeof section.buttonLabel === 'string' && section.buttonLabel.length <= 30))
        && (section.type !== 'image' || (Array.isArray(section.images) && section.images.length > 0))
        && (!['video', 'link'].includes(String(section.type)) || validMediaUrl(section.url))
        && (section.type !== 'link' || /^https?:\/\//.test(String(section.url))))
      || new Set(value.sections.map(section => section.id)).size !== value.sections.length
      || ['about', 'contact'].some(type => (value.sections as Record<string, unknown>[]).filter(section => section.type === type).length > 1)) {
      return invalid()
    }
  }
  if (value.mediaAccess !== undefined && (!record(value.mediaAccess)
    || !Object.entries(value.mediaAccess).every(([url, preview]) => /^\/api\/media\/[a-f\d]{24}$/.test(url)
      && validPreview(url, preview)))) {
    return invalid()
  }
  return { ...value, isVip: value.isVip === true, appearance: value.appearance ?? defaultAppearance(), sections: value.sections ?? defaultSections(), pages } as unknown as Card
}
export function parseMediaUpload(value: unknown): MediaUpload {
  if (!record(value) || typeof value.url !== 'string' || !/^\/api\/media\/[a-f\d]{24}$/.test(value.url)
    || (value.mediaUnavailable !== undefined && typeof value.mediaUnavailable !== 'boolean')
    || (value.previewUrl === undefined ? value.mediaUnavailable !== true : !validPreview(value.url, value.previewUrl))
    || typeof value.kind !== 'string' || !['image', 'video'].includes(value.kind) || !count(value.size) || value.size === 0) {
    return invalid()
  }
  return value as unknown as MediaUpload
}
export function parseMediaReservation(value: unknown): { id: string, cloudPath: string } {
  if (!record(value) || typeof value.id !== 'string' || !/^[a-f\d]{24}$/.test(value.id)
    || typeof value.cloudPath !== 'string' || !new RegExp(`^staging/[a-zA-Z\\d_-]+/${value.id}$`).test(value.cloudPath)) {
    return invalid()
  }
  return { id: value.id, cloudPath: value.cloudPath }
}
export function parseLogin(value: unknown): LoginResponse {
  if (
    !record(value)
    || typeof value.token !== 'string'
    || !value.token
    || !count(value.expiresIn)
    || !['demo', 'wechat'].includes(String(value.mode))
    || (value.devKey !== undefined
      && (typeof value.devKey !== 'string' || !/^[a-f\d]{64}$/.test(value.devKey)))
  ) {
    return invalid()
  }
  const account = value.account === undefined ? undefined : parseAccount(value.account)
  if (account && account.mode !== value.mode)
    return invalid()
  return { ...value, account, card: parseCard(value.card) } as unknown as LoginResponse
}
export function parseMembership(value: unknown): Membership {
  if (value === undefined)
    return { plan: 'free', expiresAt: null, isVip: false }
  if (!record(value) || !['free', 'vip'].includes(String(value.plan))
    || typeof value.isVip !== 'boolean'
    || (value.expiresAt !== null && (typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))))
    || (value.plan === 'free' && (value.isVip || value.expiresAt !== null))) {
    return invalid()
  }
  return { plan: value.plan, expiresAt: value.expiresAt, isVip: value.isVip } as Membership
}
export function parseAccount(value: unknown): AccountProfile {
  if (!record(value) || typeof value.id !== 'string' || !/^[a-f\d]{24}$/.test(value.id)
    || !['demo', 'wechat'].includes(String(value.mode))
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) {
    return invalid()
  }
  return { ...value, membership: parseMembership(value.membership) } as unknown as AccountProfile
}
export function parseLogout(value: unknown): { loggedOut: true } {
  if (!record(value) || value.loggedOut !== true)
    return invalid()
  return { loggedOut: true }
}
export function parseList(value: unknown): CardList {
  if (
    !record(value)
    || !Array.isArray(value.items)
    || !count(value.total)
    || !count(value.page)
    || !count(value.pageSize)
    || (value.unavailableIds !== undefined && (!Array.isArray(value.unavailableIds)
      || !value.unavailableIds.every(validCardId)))
  ) {
    return invalid()
  }
  return { ...value, items: value.items.map(parseCard) } as unknown as CardList
}
export function parseStats(value: unknown): Stats {
  if (
    !record(value)
    || !['views', 'todayViews', 'favorites', 'contacts'].every(key =>
      count(value[key]),
    )
    || !Array.isArray(value.days)
    || value.days.length !== 7
    || !value.days.every(
      day =>
        record(day)
        && typeof day.day === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(day.day)
        && count(day.views),
    )
  ) {
    return invalid()
  }
  return value as unknown as Stats
}
export function parseQr(value: unknown): QrResponse {
  if (
    !record(value)
    || typeof value.image !== 'string'
    || !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value.image)
    || typeof value.url !== 'string'
    || !/^https?:\/\//.test(value.url)
    || !['web', 'wechat'].includes(String(value.mode))
  ) {
    return invalid()
  }
  return value as unknown as QrResponse
}
export function parseFavorite(value: unknown): { saved: boolean } {
  if (!record(value) || typeof value.saved !== 'boolean')
    return invalid()
  return { saved: value.saved }
}
export function parseMessageList(value: unknown): MessageList {
  if (!record(value) || !Array.isArray(value.items)
    || !count(value.total) || !count(value.page) || value.page < 1
    || !count(value.pageSize) || value.pageSize < 1 || value.pageSize > 50
    || value.items.length > value.pageSize
    || !value.items.every(item => record(item)
      && typeof item.id === 'string' && /^[a-f\d]{24}$/.test(item.id)
      && typeof item.name === 'string' && !!item.name.trim() && item.name.length <= 30
      && typeof item.contact === 'string' && item.contact.length <= 120
      && typeof item.content === 'string' && !!item.content.trim() && item.content.length <= 1000
      && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)))) {
    return invalid()
  }
  return value as unknown as MessageList
}
export function parseMessageSubmission(value: unknown): { submitted: true } {
  if (!record(value) || value.submitted !== true)
    return invalid()
  return { submitted: true }
}

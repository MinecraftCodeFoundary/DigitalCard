import type { Card, CardAppearance, CardBody, CardPage, CardSection } from '@/api/types'
import { defaultAppearance } from './appearance'
import { defaultSections } from './sections'
import { defaultPages } from './pages'

export function cardBody(card: Card): CardBody & { appearance: CardAppearance, sections: CardSection[], pages: CardPage[] } {
  const {
    name,
    title,
    company,
    phone,
    email,
    wechat,
    location,
    bio,
    avatar,
    website,
    tags,
    theme,
    published,
    appearance = defaultAppearance(),
    sections = defaultSections(),
    pages = defaultPages(),
  } = card
  return {
    name,
    title,
    company,
    phone,
    email,
    wechat,
    location,
    bio,
    avatar,
    website,
    tags: [...tags],
    theme,
    published,
    appearance: { ...appearance, hiddenFields: [...appearance.hiddenFields] },
    pages: pages.map(page => ({ ...page })),
    sections: sections.map(section => ({ ...section, pageId: section.pageId ?? pages[0].id, columnSpan: section.columnSpan ?? 1, ...(section.images ? { images: [...section.images] } : {}), ...(section.blocks ? { blocks: section.blocks.map(block => ({ ...block, ...(block.images ? { images: [...block.images] } : {}) })) } : {}) })),
  }
}
export function validCardId(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[a-f\d]{24}|sample-(?:chen|su|zhou))$/.test(value)
}
export function completeness(card: CardBody) {
  return Math.round(
    ([
      card.name,
      card.title,
      card.company,
      card.phone || card.email,
      card.bio,
      card.tags.length,
    ].filter(Boolean).length
    / 6)
  * 100,
  )
}
export function sharePath(card: Card) {
  return `/pages/card/card?id=${encodeURIComponent(card.id)}`
}
export function copyText(value: string, title = '已复制') {
  if (!value)
    return
  uni.setClipboardData({ data: value, success: () => uni.showToast({ title, icon: 'success' }) })
}

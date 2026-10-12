import { describe, expect, it } from 'vitest'
import { cardBody, completeness, validCardId } from './card'
import type { Card } from '@/api/types'

const card: Card = {
  id: 'a'.repeat(24),
  name: '林',
  title: '设计师',
  company: '工作室',
  phone: '',
  email: '',
  wechat: '',
  location: '',
  bio: '介绍',
  avatar: '',
  website: '',
  tags: ['设计'],
  theme: 'forest',
  published: true,
  updatedAt: '2026-10-10',
  isFavorite: false,
}
describe('card boundaries and editing', () => {
  it('accepts valid scene IDs and rejects malformed or injected routes', () => {
    expect(validCardId(card.id)).toBe(true)
    expect(validCardId('sample-chen')).toBe(true)
    for (const value of [undefined, [], '../me', 'a'.repeat(36), 'sample-other', '<script>'])
      expect(validCardId(value)).toBe(false)
  })
  it('strips server fields from an editable card and does not mutate original tags', () => {
    const editable = cardBody(card)
    expect(editable).not.toHaveProperty('id')
    expect(editable).not.toHaveProperty('isFavorite')
    editable.tags.push('咨询')
    expect(card.tags).toEqual(['设计'])
    expect(editable.appearance.layout).toBe('classic')
    const second = cardBody({ ...card, appearance: editable.appearance })
    second.appearance.hiddenFields.push('company')
    expect(editable.appearance.hiddenFields).toEqual([])
    const third = cardBody({ ...card, sections: editable.sections })
    third.sections[0].title = '新标题'
    expect(editable.sections[0].title).toBe('关于我')
    expect(editable.pages).toEqual([{ id: 'main', title: '主页', columns: 1 }])
    expect(editable.sections.every(section => section.pageId === 'main')).toBe(true)
    const fourth = cardBody({ ...card, pages: editable.pages, sections: editable.sections })
    fourth.pages[0].title = '作品'
    expect(editable.pages[0].title).toBe('主页')
  })
  it('requires a contact method for full completeness', () => {
    expect(completeness(card)).toBe(83)
    expect(completeness({ ...card, email: 'hello@example.com' })).toBe(100)
  })
})

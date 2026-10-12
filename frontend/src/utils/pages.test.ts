import { describe, expect, it } from 'vitest'
import type { CardPage, CardPageIcon, CardSection } from '@/api/types'
import { defaultPages, pageIconClass, pageIcons, removePage } from './pages'

describe('page icons', () => {
  it('maps supported icons and defaults missing icons to the user icon', () => {
    for (const icon of pageIcons)
      expect(pageIconClass(icon.key)).toBe(icon.className)
    expect(pageIconClass()).toBe('i-carbon-user')
  })

  it('renders a safe fallback for malformed legacy icon values', () => {
    for (const icon of ['unknown', '', null, 123, ['user'], { toString: () => 'user' }])
      expect(pageIconClass(icon as CardPageIcon)).toBe('i-carbon-user')
  })
})

describe('page removal', () => {
  const pages: CardPage[] = [{ id: 'main', title: '主页', columns: 1 }, { id: 'work', title: '作品', columns: 2 }, { id: 'contact', title: '联系', columns: 1 }]
  const sections: CardSection[] = [
    { id: 'a', type: 'text', title: '旧模块', content: '保留', visible: true },
    { id: 'b', type: 'text', title: '作品', content: '项目一', visible: false, pageId: 'work', columnSpan: 2 },
    { id: 'c', type: 'text', title: '联系方式', content: '邮件', visible: true, pageId: 'contact' },
  ]
  it('moves all modules to the preceding page without losing content or mutating the source', () => {
    const result = removePage(pages, sections, 'work')
    expect(result.pages.map(page => page.id)).toEqual(['main', 'contact'])
    expect(result.sections[1]).toEqual({ ...sections[1], pageId: 'main' })
    expect(sections[1].pageId).toBe('work')
    expect(result.sections[2].pageId).toBe('contact')
  })
  it('moves legacy modules on the first page to the next page and keeps the last page', () => {
    expect(removePage(pages, sections, 'main').sections[0].pageId).toBe('work')
    expect(removePage(defaultPages(), sections, 'main').pages).toEqual(defaultPages())
    expect(removePage(pages, sections, 'missing').pages).toEqual(pages)
  })
})

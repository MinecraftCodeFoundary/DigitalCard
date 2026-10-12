import { describe, expect, it } from 'vitest'
import { applyCardTemplate, cardTemplates, templateCoverStyle } from './templates'
import { defaultAppearance } from './appearance'
import { parseCard } from '@/http/validators'
import { cardBody } from './card'
import type { Card } from '@/api/types'

const card: Card = { id: 'a'.repeat(24), updatedAt: '2026-10-10', name: '林予安', title: '', company: '', phone: '', email: '', wechat: '', location: '', bio: '', avatar: '', website: '', tags: [], theme: 'forest', published: true }
describe('complete card templates', () => {
  it('changes the design while keeping custom copy, hidden fields and media', () => {
    const previous = { ...defaultAppearance(), coverTitle: '我的封面文案', coverLabel: '我的品牌', wordmark: '我的署名', coverImage: 'https://example.com/cover.png', hiddenFields: ['company' as const] }
    for (const template of cardTemplates) {
      const appearance = applyCardTemplate(previous, template)
      expect(appearance.template).toBe(template.id)
      expect(appearance.layout).toBe(template.layout)
      expect(appearance.accentColor).toBe(template.accent)
      expect(appearance.coverTitle).toBe(previous.coverTitle)
      expect(appearance.coverLabel).toBe(previous.coverLabel)
      expect(appearance.wordmark).toBe(previous.wordmark)
      expect(appearance.coverImage).toBe(previous.coverImage)
      expect(appearance.hiddenFields).toEqual(previous.hiddenFields)
      const parsed = parseCard({ ...card, appearance })
      expect(cardBody(parsed).appearance.template).toBe(template.id)
    }
    expect(previous.template).toBeUndefined()
  })
  it('rejects unknown templates and uses the chosen custom color in decorated covers', () => {
    expect(() => parseCard({ ...card, appearance: { ...defaultAppearance(), template: 'unknown' } })).toThrow('无效数据')
    const appearance = { ...defaultAppearance(), template: 'neon' as const, accentColor: '#a123bc' }
    expect(templateCoverStyle({ ...card, appearance }).backgroundColor).toBe('#a123bc')
    expect(templateCoverStyle({ ...card, appearance }).backgroundImage).toContain('#a123bc')
    expect(templateCoverStyle(card)).toEqual({})
  })
})

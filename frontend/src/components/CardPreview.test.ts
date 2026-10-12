import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Card } from '@/api/types'
import CardPreview from './CardPreview.vue'
import { defaultAppearance } from '@/utils/appearance'
import { parseCard } from '@/http/validators'

const card: Card = {
  id: 'a'.repeat(24),
  name: '测试',
  title: '设计师',
  company: '工作室',
  phone: '',
  email: '',
  wechat: '',
  location: '上海',
  bio: '',
  avatar: '',
  website: '',
  tags: ['设计'],
  theme: 'forest',
  published: true,
  updatedAt: '2026-10-10',
}

describe('card appearance', () => {
  it('renders poster identity and signed assets, preserves custom placement, and rejects invalid settings', () => {
    const appearance = { ...defaultAppearance(), template: 'poster' as const, layout: 'poster' as const, coverImage: `/api/media/${'a'.repeat(24)}`, brandLogo: `/api/media/${'b'.repeat(24)}`, posterPortraitScale: 1.2, posterPortraitX: -10, hiddenFields: ['title' as const] }
    const mediaAccess = { [appearance.coverImage]: 'https://example.com/portrait.png', [appearance.brandLogo]: 'https://example.com/logo.png' }
    const wrapper = mount(CardPreview, { props: { card: { ...card, appearance }, mediaAccess } })
    expect(wrapper.find('.poster-person-image').attributes('src')).toBe(mediaAccess[appearance.coverImage])
    expect(wrapper.find('.poster-brand-logo').attributes('src')).toBe(mediaAccess[appearance.brandLogo])
    expect(wrapper.find('.poster-person-image').attributes('style')).toContain('translateX(-10%) scale(1.2)')
    expect(wrapper.find('.poster-person-title').exists()).toBe(false)
    expect(parseCard({ ...card, appearance }).appearance).toEqual(appearance)
    for (const invalid of [{ posterPortraitScale: 2 }, { posterPortraitX: 21 }, { posterPortraitX: Number.NaN }, { brandLogo: 'javascript:alert(1)' }, { posterFooter: 'x'.repeat(61) }])
      expect(() => parseCard({ ...card, appearance: { ...appearance, ...invalid } })).toThrow('无效数据')
  })
  it('shows a full portrait cover and keeps selected identity fields hidden', () => {
    const wrapper = mount(CardPreview, { props: { card: { ...card, appearance: { ...defaultAppearance(), layout: 'portrait', coverImage: 'https://example.com/portrait.jpg', hiddenFields: ['company'] } } } })
    expect(wrapper.find('.portrait-photo').attributes('src')).toBe('https://example.com/portrait.jpg')
    expect(wrapper.find('.card-name').text()).toBe('测试')
    expect(wrapper.find('.card-company').exists()).toBe(false)
    expect(wrapper.find('.card-cover').exists()).toBe(false)
    expect(() => parseCard({ ...card, appearance: { ...defaultAppearance(), coverImage: 'javascript:alert(1)' } })).toThrow('无效数据')
  })

  it('keeps legacy cards usable and rejects malformed appearance at the response boundary', () => {
    expect(parseCard(card).appearance).toEqual(defaultAppearance())
    for (const invalid of [null, {}, { ...defaultAppearance(), accentColor: 'red' }, { ...defaultAppearance(), hiddenFields: ['phone'] }]) {
      expect(() => parseCard({ ...card, appearance: invalid })).toThrow('无效数据')
    }
  })

  it('updates the preview and restores hidden content when settings change', async () => {
    const wrapper = mount(CardPreview, { props: { card } })
    expect(wrapper.find('.card-company').text()).toBe('工作室')
    expect(wrapper.find('.cover-title').text()).toBe('每一次相遇\n都有新的可能。')
    await wrapper.setProps({ card: { ...card, appearance: {
      ...defaultAppearance(),
      layout: 'centered',
      avatarShape: 'circle',
      accentColor: '#f4d35e',
      coverTitle: '',
      wordmark: '',
      decoration: false,
      hiddenFields: ['company', 'location', 'tags', 'title'],
    } } })
    expect(wrapper.classes()).toContain('centered')
    expect(wrapper.classes()).toContain('avatar-circle')
    for (const selector of ['.card-title', '.card-company', '.card-location', '.tag', '.cover-rings'])
      expect(wrapper.find(selector).exists()).toBe(false)
    expect(wrapper.find('.cover-title').text()).toBe('')
    expect(wrapper.find('.card-cover').attributes('style')).toContain('color: rgb(23, 37, 29)')
    await wrapper.setProps({ card: { ...card, appearance: defaultAppearance() } })
    expect(wrapper.find('.card-company').text()).toBe('工作室')
    expect(wrapper.find('.tag').text()).toBe('设计')
    expect(wrapper.find('.cover-rings').exists()).toBe(true)
  })
})

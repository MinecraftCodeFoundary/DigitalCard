import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { CardSection } from '@/api/types'
import SectionMedia from './SectionMedia.vue'

const base: CardSection = { id: 'media', type: 'image', title: '作品', content: '介绍', visible: true }
describe('media modules', () => {
  it('renders galleries and switches between grid and stack layouts', async () => {
    const wrapper = mount(SectionMedia, { props: { section: { ...base, images: ['https://example.com/1.png', 'https://example.com/2.png'] } } })
    expect(wrapper.findAll('.gallery-image')).toHaveLength(2)
    expect(wrapper.find('.gallery-grid').exists()).toBe(true)
    await wrapper.setProps({ section: { ...base, images: ['https://example.com/1.png'], imageLayout: 'stack' } })
    expect(wrapper.find('.gallery-grid').exists()).toBe(false)
  })
  it('renders a video player and link button rather than contact fields', () => {
    const video = mount(SectionMedia, { props: { section: { ...base, type: 'video', url: 'https://example.com/video.mp4', poster: 'https://example.com/poster.png' } } })
    expect(video.find('video').attributes('src')).toBe('https://example.com/video.mp4')
    expect(video.find('video').attributes('poster')).toBe('https://example.com/poster.png')
    const link = mount(SectionMedia, { props: { section: { ...base, type: 'link', url: 'https://example.com', buttonLabel: '查看作品集' } } })
    expect(link.find('button').text()).toContain('查看作品集')
  })
})

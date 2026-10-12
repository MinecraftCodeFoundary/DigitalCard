import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { CardBody } from '@/api/types'
import { defaultAppearance } from '@/utils/appearance'
import { portraitPages } from '@/utils/pages'
import CardHomepage from './CardHomepage.vue'

const card: CardBody = {
  name: '林',
  title: '创始人',
  company: '我的公司',
  phone: '',
  email: '',
  wechat: '',
  location: '',
  bio: '介绍',
  avatar: '',
  website: '',
  tags: [],
  theme: 'forest',
  published: true,
  appearance: { ...defaultAppearance(), layout: 'portrait', accentColor: '#58bde9' },
  pages: portraitPages(),
  sections: [{ id: 'company-text', type: 'text', title: '公司文字模块', content: '公司介绍\n专业服务', visible: true, pageId: 'company' }],
}

describe('portrait homepage navigation', () => {
  it('opens an independent article page and returns to the cover without exposing other pages', async () => {
    const wrapper = mount(CardHomepage, { props: { card } })
    expect(wrapper.find('.portrait-hero').exists()).toBe(true)
    expect(wrapper.findAll('.homepage-nav-item')).toHaveLength(4)
    expect(wrapper.find('.section-content').exists()).toBe(false)
    await wrapper.find('[aria-label="打开公司简介"]').trigger('click')
    expect(wrapper.find('.portrait-hero').exists()).toBe(false)
    expect(wrapper.find('.homepage-page-heading').text()).toBe('公司简介')
    expect(wrapper.find('.section-content').text()).toBe('公司介绍\n专业服务')
    expect(wrapper.find('.section-title').exists()).toBe(false)
    expect(wrapper.find('.page-tabs').exists()).toBe(false)
    await wrapper.find('[aria-label="返回名片首页"]').trigger('click')
    expect(wrapper.find('.portrait-hero').exists()).toBe(true)
    expect(wrapper.find('.section-content').exists()).toBe(false)
  })
  it('follows editor selection and returns to the landing view if that page is removed', async () => {
    const wrapper = mount(CardHomepage, { props: { card, pageId: 'company' } })
    expect(wrapper.find('.homepage-page-heading').text()).toBe('公司简介')
    await wrapper.setProps({ card: { ...card, pages: portraitPages().filter(page => page.id !== 'company') } })
    expect(wrapper.find('.portrait-hero').exists()).toBe(true)
    expect(wrapper.findAll('.homepage-nav-item')).toHaveLength(3)
  })
})

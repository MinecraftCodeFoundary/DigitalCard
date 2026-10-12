import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { CardBody } from '@/api/types'
import CardSections from './CardSections.vue'
import { parseCard } from '@/http/validators'
import { defaultAppearance } from '@/utils/appearance'

const card: CardBody = {
  name: '测试',
  title: '',
  company: '',
  phone: '',
  email: '',
  wechat: '',
  location: '',
  bio: '个人介绍',
  avatar: '',
  website: '',
  tags: [],
  theme: 'forest',
  published: true,
}

describe('profile sections', () => {
  it('joins poster pages in saved page order while retaining visibility and three-column content', () => {
    const body: CardBody = { ...card, appearance: { ...defaultAppearance(), template: 'poster', layout: 'poster', posterFooter: '连接专业与合作' }, pages: [{ id: 'a', title: '业务', columns: 1 }, { id: 'b', title: '服务', columns: 1 }], sections: [
      { id: 'second', pageId: 'b', type: 'text', title: '合作', content: '第二页', visible: true },
      { id: 'hidden', pageId: 'a', type: 'text', title: '隐藏内容', content: '不可见', visible: false },
      { id: 'business', pageId: 'a', type: 'card', title: '主营业务', content: '', visible: true, cardLayout: 'showcase', blocks: [
        { id: 'product', type: 'image', title: '产品', content: '产品介绍', images: ['https://example.com/product.png'], showTitle: true, visible: true },
        { id: 'service', type: 'text', title: '咨询', content: '咨询介绍', showTitle: true, visible: true },
      ] },
    ] }
    const wrapper = mount(CardSections, { props: { card: body, pageId: 'b' } })
    expect(wrapper.findAll('.profile-section').map(node => node.attributes('data-section-id'))).toEqual(['business', 'second'])
    expect(wrapper.find('.page-tabs').exists()).toBe(false)
    expect(wrapper.find('.content-showcase').exists()).toBe(true)
    expect(wrapper.findAll('.card-content-block')).toHaveLength(2)
    expect(wrapper.text()).not.toContain('不可见')
    expect(wrapper.find('.footer-slogan').text()).toBe('连接专业与合作')
    expect(parseCard({ ...body, id: 'a'.repeat(24), updatedAt: '2026-10-10' }).sections).toEqual(body.sections)
  })
  it('renders several mixed blocks inside a single Card even on a freeform page', async () => {
    const section: NonNullable<CardBody['sections']>[number] = { id: 'container', type: 'card', title: '我的作品', content: '', visible: true, cardLayout: 'columns', blocks: [
      { id: 'intro', type: 'text', title: '介绍', content: '第一段', visible: true, columnSpan: 1 },
      { id: 'picture', type: 'image', title: '图片', content: '', images: ['https://example.com/picture.png'], visible: true, columnSpan: 1 },
      { id: 'end', type: 'text', title: '结尾', content: '最后一段', visible: true, columnSpan: 2 },
    ] }
    const body = { ...card, pages: [{ id: 'main', title: '主页', columns: 1 as const, presentation: 'article' as const }], sections: [section] }
    const wrapper = mount(CardSections, { props: { card: body } })
    expect(wrapper.findAll('.profile-section')).toHaveLength(1)
    expect(wrapper.find('.profile-section').classes()).toContain('custom-card')
    expect(wrapper.find('.section-title').text()).toBe('我的作品')
    expect(wrapper.find('.card-content').classes()).toContain('content-columns')
    expect(wrapper.findAll('.card-content-block').map(block => block.attributes('data-block-id'))).toEqual(['intro', 'picture', 'end'])
    expect(wrapper.findAll('.block-text').map(block => block.text())).toEqual(['第一段', '最后一段'])
    expect(parseCard({ ...body, id: 'a'.repeat(24), updatedAt: '2026-10-10' }).sections).toEqual([section])
    for (const blocks of [[{ ...section.blocks![0], type: 'card' }], [...section.blocks!, section.blocks![0]]])
      expect(() => parseCard({ ...body, id: 'a'.repeat(24), updatedAt: '2026-10-10', sections: [{ ...section, blocks }] })).toThrow('无效数据')
    await wrapper.setProps({ card: { ...body, sections: [{ ...section, visible: false }] } })
    expect(wrapper.find('.card-content-block').exists()).toBe(false)
  })
  it('preserves mixed content order and explicit title visibility in either presentation', async () => {
    const sections: NonNullable<CardBody['sections']> = [
      { id: 'text', type: 'text', title: '开场', content: '第一段', visible: true, showTitle: true },
      { id: 'photo', type: 'image', title: '图片备注', content: '图片说明', images: ['https://example.com/photo.png'], visible: true, showTitle: false },
      { id: 'end', type: 'text', title: '结尾备注', content: '最后一段', visible: true, showTitle: false },
    ]
    const wrapper = mount(CardSections, { props: { card: { ...card, pages: [{ id: 'main', title: '图文', columns: 1, presentation: 'article' }], sections } } })
    expect(wrapper.findAll('.profile-section').map(node => node.attributes('data-section-id'))).toEqual(['text', 'photo', 'end'])
    expect(wrapper.findAll('.section-title').map(node => node.text())).toEqual(['开场'])
    await wrapper.setProps({ card: { ...card, sections } })
    expect(wrapper.findAll('.section-title').map(node => node.text())).toEqual(['开场'])
    const saved = { ...card, id: 'a'.repeat(24), updatedAt: '2026-10-10', sections }
    expect(parseCard(saved).sections).toEqual(sections)
    expect(() => parseCard({ ...saved, sections: [{ ...sections[0], showTitle: 'false' }] })).toThrow('无效数据')
  })
  it('switches named pages, applies column widths and falls back after page deletion', async () => {
    const pages = [{ id: 'main', title: '主页', columns: 1 as const }, { id: 'work', title: '作品', columns: 2 as const }]
    const sections = [
      { id: 'intro', type: 'text' as const, title: '介绍', content: '第一页面', visible: true },
      { id: 'work-one', type: 'text' as const, title: '项目一', content: '第二页面', visible: true, pageId: 'work' },
      { id: 'work-two', type: 'text' as const, title: '项目二', content: '', visible: true, pageId: 'work', columnSpan: 2 as const },
    ]
    const wrapper = mount(CardSections, { props: { card: { ...card, pages, sections } } })
    expect(wrapper.findAll('.section-title').map(node => node.text())).toEqual(['介绍'])
    await wrapper.findAll('.page-tabs button')[1].trigger('click')
    expect(wrapper.findAll('.section-title').map(node => node.text())).toEqual(['项目一', '项目二'])
    expect(wrapper.find('.section-grid').classes()).toContain('columns-two')
    expect(wrapper.findAll('.profile-section')[1].classes()).toContain('full-width')
    await wrapper.setProps({ card: { ...card, pages: pages.slice(0, 1), sections } })
    expect(wrapper.findAll('.section-title').map(node => node.text())).toEqual(['介绍'])
    expect(wrapper.find('.page-tabs').exists()).toBe(false)
  })

  it('rejects invalid page configuration and dangling module references', () => {
    const base = { ...card, id: 'a'.repeat(24), updatedAt: '2026-10-10' }
    const page = { id: 'main', title: '主页', columns: 1 }
    for (const pages of [null, [], [page, page], [{ ...page, title: '' }], [{ ...page, columns: 3 }], [{ ...page, icon: 'unsafe' }], [{ ...page, presentation: 'html' }], Array.from({ length: 7 }, (_, i) => ({ ...page, id: `page-${i}` }))])
      expect(() => parseCard({ ...base, pages })).toThrow('无效数据')
    for (const change of [{ pageId: 'missing' }, { columnSpan: 3 }])
      expect(() => parseCard({ ...base, sections: [{ id: 'text', type: 'text', title: '模块', content: '', visible: true, ...change }] })).toThrow('无效数据')
    expect(parseCard(base).pages).toEqual([page])
  })

  it('shows only enabled modules in saved order and renders content as plain text', async () => {
    const wrapper = mount(CardSections, { props: { card: { ...card, sections: [
      { id: 'service', type: 'text', title: '我的服务', content: '<script>alert(1)</script>', visible: true },
      { id: 'contact', type: 'contact', title: '联系我', content: '', visible: false },
      { id: 'about', type: 'about', title: '认识我', content: '', visible: true },
    ] } } })
    expect(wrapper.findAll('.section-title').map(node => node.text())).toEqual(['我的服务', '认识我'])
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('.section-content').text()).toBe('<script>alert(1)</script>')
    await wrapper.setProps({ card: { ...card, sections: [] } })
    expect(wrapper.findAll('.profile-section')).toHaveLength(0)
  })

  it('rejects invalid or duplicate modules at the response boundary', () => {
    const base = { ...card, id: 'a'.repeat(24), updatedAt: '2026-10-10' }
    const about = { id: 'about', type: 'about', title: '关于我', content: '', visible: true }
    for (const sections of [null, [about, about], [{ ...about, title: '' }], [{ ...about, visible: 'true' }], [{ ...about, type: 'html' }], [{ ...about, content: 'a'.repeat(1001) }], [about, { ...about, id: 'about-two' }]])
      expect(() => parseCard({ ...base, sections })).toThrow('无效数据')
  })
})

import type { CardPage, CardSection } from '@/api/types'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ModuleEditor from './ModuleEditor.vue'
import MediaSectionEditor from './MediaSectionEditor.vue'

function setup(initialSections: CardSection[], initialPages: CardPage[] = [
  { id: 'a', title: '介绍', columns: 1 },
  { id: 'b', title: '作品', columns: 1 },
], compact = false) {
  const sections = ref(initialSections)
  const pages = ref(initialPages)
  const wrapper = mount(defineComponent({
    setup: () => () => h(ModuleEditor, {
      'sections': sections.value,
      'pages': pages.value,
      'mediaAccess': {},
      compact,
      'onUpdate:sections': value => sections.value = value,
      'onUpdate:pages': value => pages.value = value,
    }),
  }), { global: { stubs: { MediaSectionEditor: true } } })
  const row = (id: string) => wrapper.get(`[data-module-id="${id}"]`)
  const order = () => wrapper.findAll('.module-row').map(item => item.attributes('data-module-id'))
  return { wrapper, sections, pages, row, order }
}

function section(id: string, pageId?: string): CardSection {
  return { id, pageId, type: 'text', title: id, content: `${id} 正文`, visible: true }
}

describe('page-grouped module editor', () => {
  it('creates an empty Card and upgrades legacy content without changing its identity or page', async () => {
    const { wrapper, sections, row } = setup([section('legacy', 'a')])
    await wrapper.get('[aria-label="模块 1 转为 Card"]').trigger('click')
    expect(sections.value[0]).toMatchObject({ id: 'legacy', pageId: 'a', type: 'card', blocks: [{ type: 'text', content: 'legacy 正文', visible: true }] })
    expect(row('legacy').find('.card-content-editor').exists()).toBe(true)
    await wrapper.get('.module-group[data-page-id="b"]').findAll('button').find(button => button.text() === '＋ 创建 Card')!.trigger('click')
    expect(sections.value[1]).toMatchObject({ type: 'card', pageId: 'b', blocks: [], showTitle: true })
  })
  it('inserts text and images at the requested position without disturbing another page', async () => {
    const { wrapper, sections, order, row } = setup([section('a1', 'a'), section('b1', 'b'), section('a2', 'a')], [
      { id: 'a', title: '图文', columns: 1, presentation: 'article' },
      { id: 'b', title: '作品', columns: 1 },
    ])
    await wrapper.get('[aria-label="模块 1 后插入图片"]').trigger('click')
    const image = sections.value.find(item => item.type === 'image')!
    expect(image).toMatchObject({ pageId: 'a', imageLayout: 'stack', showTitle: false })
    expect(order()).toEqual(['a1', image.id, 'a2', 'b1'])
    await wrapper.get('[aria-label="第 1 页开头插入文字"]').trigger('click')
    const first = sections.value[0]
    expect(order()).toEqual([first.id, 'a1', image.id, 'a2', 'b1'])
    expect(row(first.id).find('input').exists()).toBe(false)
    await row(first.id).get('[aria-label="模块 1 显示标题"]').trigger('click')
    expect(sections.value[0].showTitle).toBe(true)
    expect(row(first.id).find('input').exists()).toBe(true)
    await row(image.id).get('[aria-label="上移模块 3"]').trigger('click')
    expect(order()).toEqual([first.id, image.id, 'a1', 'a2', 'b1'])
  })
  it('keeps an uploading media editor mounted until its upload finishes', async () => {
    const { wrapper, row } = setup([{ ...section('photo', 'a'), type: 'image', images: [] }])
    const media = wrapper.findComponent(MediaSectionEditor)
    media.vm.$emit('uploading', true)
    await nextTick()
    expect(row('photo').get('[aria-label="模块 1 放到第 2 页"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="删除第 1 页"]').attributes('disabled')).toBeDefined()
    media.vm.$emit('uploading', false)
    await nextTick()
    expect(row('photo').get('[aria-label="模块 1 放到第 2 页"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[aria-label="删除第 1 页"]').attributes('disabled')).toBeUndefined()
  })
  it('groups interleaved modules by page order and keeps legacy modules on their original page', async () => {
    const { wrapper, order, sections } = setup([section('a1'), section('b1', 'b'), section('a2', 'a'), section('b2', 'b')])
    expect(order()).toEqual(['a1', 'a2', 'b1', 'b2'])
    await wrapper.get('[aria-label="前移第 2 页"]').trigger('click')
    expect(order()).toEqual(['b1', 'b2', 'a1', 'a2'])
    expect(sections.value.find(item => item.id === 'a1')?.pageId).toBe('a')
    expect(wrapper.findAll('.module-group .page-row input').map(item => (item.element as HTMLInputElement).value)).toEqual(['作品', '介绍'])
  })

  it('edits, hides and deletes the displayed module by identity after grouping', async () => {
    const { row, sections, order } = setup([section('b1', 'b'), section('a1', 'a'), section('a2', 'a')])
    expect(order()).toEqual(['a1', 'a2', 'b1'])
    await row('a1').get('input').trigger('input', { detail: { value: '新的标题' } })
    await row('a1').get('textarea').trigger('input', { detail: { value: '新的正文' } })
    await row('a1').get('[aria-label="隐藏模块 1"]').trigger('click')
    expect(sections.value.find(item => item.id === 'a1')).toMatchObject({ title: '新的标题', content: '新的正文', visible: false })
    expect(sections.value.find(item => item.id === 'b1')).toMatchObject({ title: 'b1', content: 'b1 正文', visible: true })
    await row('a1').get('[aria-label="删除模块 1"]').trigger('click')
    expect(order()).toEqual(['a2', 'b1'])
  })

  it('moves only within a page and immediately regroups a module assigned to another page', async () => {
    const { wrapper, row, sections, order } = setup([section('a1', 'a'), section('b1', 'b'), section('a2', 'a'), section('b2', 'b')])
    expect(row('a1').get('[aria-label="上移模块 1"]').attributes('disabled')).toBeDefined()
    expect(row('a2').get('[aria-label="下移模块 2"]').attributes('disabled')).toBeDefined()
    await row('a2').get('[aria-label="上移模块 2"]').trigger('click')
    expect(order()).toEqual(['a2', 'a1', 'b1', 'b2'])
    await row('b1').get('.drag-handle').trigger('dragstart')
    await row('a2').trigger('drop')
    expect(order()).toEqual(['a2', 'a1', 'b1', 'b2'])
    await row('a1').get('[aria-label="模块 2 放到第 2 页"]').trigger('click')
    expect(wrapper.get('.module-group[data-page-id="a"]').findAll('.module-row')).toHaveLength(1)
    expect(wrapper.get('.module-group[data-page-id="b"]').findAll('.module-row')).toHaveLength(3)
    expect(sections.value.find(item => item.id === 'a1')?.pageId).toBe('b')
    await row('b2').get('.drag-handle').trigger('dragstart')
    await row('b1').trigger('drop')
    expect(order()).toEqual(['a2', 'a1', 'b2', 'b1'])
  })

  it('places each page settings directly before its modules and adds to that page without a selection step', async () => {
    const { wrapper, sections, order } = setup([section('a1', 'a')])
    const firstPage = wrapper.get('.module-group[data-page-id="a"]')
    expect(firstPage.find('.page-row').exists()).toBe(true)
    expect(firstPage.get('.page-row').element.compareDocumentPosition(firstPage.get('.module-row').element) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    const secondPage = wrapper.get('.module-group[data-page-id="b"]')
    expect(secondPage.find('.page-row').exists()).toBe(true)
    expect(secondPage.get('.module-empty').text()).toContain('还没有内容')
    await wrapper.get('[aria-label="编辑第 1 页"]').trigger('click')
    const addButton = secondPage.findAll('button').find(button => button.text() === '＋ 添加文字段落')!
    await addButton.trigger('click')
    const added = sections.value[1]
    expect(added.pageId).toBe('b')
    await wrapper.get('[aria-label="前移第 2 页"]').trigger('click')
    expect(order()).toEqual([added.id, 'a1'])
    await wrapper.get('[aria-label="删除第 1 页"]').trigger('click')
    expect(sections.value).toHaveLength(2)
    expect(sections.value.every(item => item.pageId === 'a')).toBe(true)
    await wrapper.get('.module-group[data-page-id="a"]').findAll('button').find(button => button.text() === '＋ 添加文字段落')!.trigger('click')
    expect(sections.value[2].pageId).toBe('a')
  })
})

describe('compact content editing', () => {
  it('combines all three scenarios and retains existing edits when the suggestion changes', async () => {
    const { wrapper, sections, row } = setup([section('existing', 'a')], [{ id: 'a', title: '主页', columns: 1 }], true)
    const additions = [
      { scenario: '商务名片', title: '我能提供的服务', content: '品牌咨询与设计。' },
      { scenario: '业务展示', title: '公司介绍', content: '跨领域的设计团队。' },
      { scenario: '个人主页', title: '个人经历', content: '产品设计与独立创业。' },
    ]
    const original = { ...sections.value[0] }
    for (const item of additions) {
      await wrapper.findAll('button').find(button => button.text() === item.scenario)!.trigger('click')
      await wrapper.get(`[aria-label="添加${item.title}到第 1 页"]`).trigger('click')
      const added = sections.value.at(-1)!
      expect(added).toMatchObject({ title: item.title, type: 'text', pageId: 'a', showTitle: true })
      await row(added.id).get('textarea').trigger('input', { detail: { value: item.content } })
    }
    await wrapper.findAll('button').find(button => button.text() === '商务名片')!.trigger('click')
    expect(sections.value).toHaveLength(4)
    expect(sections.value[0]).toEqual(original)
    expect(sections.value.slice(1).map(({ title, content }) => ({ title, content }))).toEqual(additions.map(({ title, content }) => ({ title, content })))
    expect(wrapper.get('.page-row').attributes('style')).toContain('display: none')
    expect(wrapper.find('[aria-label="模块 2 转为 Card"]').exists()).toBe(false)
  })

  it('keeps content editable while revealing page layout and module settings independently', async () => {
    const { wrapper, sections, row, pages } = setup([section('text', 'a')], [
      { id: 'a', title: '介绍', columns: 2 },
      { id: 'b', title: '作品', columns: 1 },
    ], true)
    expect(row('text').get('input').isVisible()).toBe(true)
    expect(row('text').get('textarea').isVisible()).toBe(true)
    expect(row('text').get('[aria-label="模块 1 显示标题"]').isVisible()).toBe(false)
    expect(row('text').find('[aria-label="模块 1 通栏"]').exists()).toBe(false)
    expect(row('text').find('[aria-label="模块 1 放到第 2 页"]').exists()).toBe(false)
    await row('text').get('textarea').trigger('input', { detail: { value: '保存这段介绍' } })
    await wrapper.findAll('button').find(button => button.text() === '页面与排版设置')!.trigger('click')
    await wrapper.get('[aria-label="第 1 页双栏"]').trigger('click')
    expect(wrapper.get('.page-row').attributes('style') ?? '').not.toContain('display: none')
    expect(pages.value[0].columns).toBe(2)
    expect(row('text').find('[aria-label="模块 1 通栏"]').exists()).toBe(false)
    await row('text').get('[aria-label="模块 1 更多设置"]').trigger('click')
    await row('text').get('[aria-label="模块 1 通栏"]').trigger('click')
    await row('text').get('[aria-label="模块 1 显示标题"]').trigger('click')
    expect(sections.value[0]).toMatchObject({ content: '保存这段介绍', columnSpan: 2, showTitle: false })
    await row('text').get('[aria-label="模块 1 更多设置"]').trigger('click')
    expect(row('text').get('textarea').isVisible()).toBe(true)
    expect(row('text').find('[aria-label="模块 1 通栏"]').exists()).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === '收起页面与排版设置')!.trigger('click')
    expect(wrapper.get('.page-row').attributes('style')).toContain('display: none')
    expect(sections.value[0].content).toBe('保存这段介绍')
  })

  it('reveals hidden article names and page settings so validation errors can be corrected', async () => {
    const { wrapper, row, sections } = setup([{ ...section('article', 'a'), title: '', showTitle: false }], [
      { id: 'a', title: '', columns: 1, presentation: 'article' },
    ], true)
    expect(wrapper.get('.page-row').attributes('style')).toContain('display: none')
    expect(row('article').find('input').exists()).toBe(false)
    wrapper.findComponent(ModuleEditor).vm.revealSettings('edit-section-article')
    await nextTick()
    expect(wrapper.get('.page-row').attributes('style')).toContain('display: none')
    expect(row('article').get('[aria-label="模块 1 更多设置"]').attributes('aria-expanded')).toBe('true')
    await row('article').get('input').trigger('input', { detail: { value: '修正后的名称' } })
    expect(sections.value[0]).toMatchObject({ title: '修正后的名称', content: 'article 正文', showTitle: false })
    wrapper.findComponent(ModuleEditor).vm.revealSettings('edit-page-a')
    await nextTick()
    expect(wrapper.get('.page-row').attributes('style') ?? '').not.toContain('display: none')
  })
})

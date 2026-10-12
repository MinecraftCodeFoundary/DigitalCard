import type { CardSection } from '@/api/types'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CardContentEditor from './CardContentEditor.vue'
import MediaSectionEditor from './MediaSectionEditor.vue'

function setup() {
  const section = ref<CardSection>({ id: 'my-card', type: 'card', title: '作品', content: '', visible: true, blocks: [] })
  const events: boolean[] = []
  const wrapper = mount(defineComponent({
    setup: () => () => h(CardContentEditor, { section: section.value, mediaAccess: {}, onUpdate: value => section.value = value, onUploading: busy => events.push(busy) }),
  }), { global: { stubs: { MediaSectionEditor: true } } })
  const click = async (label: string) => wrapper.findAll('button').find(button => button.text() === label)!.trigger('click')
  return { section, wrapper, click, events }
}

describe('content inside a custom Card', () => {
  it('adds, inserts and reorders content inside one parent Card', async () => {
    const { section, wrapper, click } = setup()
    await click('＋ 添加文字')
    const textId = section.value.blocks![0].id
    await wrapper.get('textarea').trigger('input', { detail: { value: '保留的正文' } })
    await click('＋ 添加图片')
    const imageId = section.value.blocks![1].id
    await wrapper.get('[aria-label="内容 1 后插入文字"]').trigger('click')
    const middleId = section.value.blocks![1].id
    expect(section.value.blocks!.map(block => block.id)).toEqual([textId, middleId, imageId])
    await wrapper.get('[aria-label="上移内容 3"]').trigger('click')
    expect(section.value.blocks!.map(block => block.id)).toEqual([textId, imageId, middleId])
    expect(section.value.blocks![0].content).toBe('保留的正文')
    expect(section.value).toMatchObject({ id: 'my-card', type: 'card', title: '作品' })
    await wrapper.get('[aria-label="删除内容 3"]').trigger('click')
    expect(section.value.blocks!.map(block => block.id)).toEqual([textId, imageId])
  })

  it('keeps the Card busy until all nested media uploads finish and preserves edits made during upload', async () => {
    const { section, wrapper, click, events } = setup()
    await click('＋ 添加图片')
    await click('＋ 添加视频')
    const media = wrapper.findAllComponents(MediaSectionEditor)
    media[0].vm.$emit('uploading', true)
    media[1].vm.$emit('uploading', true)
    await nextTick()
    expect(wrapper.get('[aria-label="删除内容 1"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[aria-label="内容 1 标题设置"]').trigger('click')
    await click('隐藏小标题')
    await wrapper.get('input').trigger('input', { detail: { value: '上传时编辑的标题' } })
    media[0].vm.$emit('update', { ...media[0].props('section'), images: ['https://example.com/photo.png'], title: '过时标题' })
    media[0].vm.$emit('uploading', false)
    await nextTick()
    expect(events.at(-1)).toBe(true)
    expect(section.value.blocks![0]).toMatchObject({ title: '上传时编辑的标题', images: ['https://example.com/photo.png'] })
    media[1].vm.$emit('uploading', false)
    await nextTick()
    expect(events.at(-1)).toBe(false)
  })
})

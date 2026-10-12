<script setup lang="ts">
import type { CardContentBlock, CardSection, MediaUpload } from '@/api/types'
import { computed, ref } from 'vue'
import MediaSectionEditor from './MediaSectionEditor.vue'
import ContentInsert from './ContentInsert.vue'

const props = defineProps<{ section: CardSection, mediaAccess: Record<string, string> }>()
const emit = defineEmits<{ update: [section: CardSection], uploaded: [media: MediaUpload], uploading: [busy: boolean] }>()
const blocks = computed(() => props.section.blocks ?? [])
const busyIds = ref<string[]>([])
const expandedIds = ref<string[]>([])
defineExpose({
  revealSettings(targetId?: string) {
    expandedIds.value = [...new Set([...expandedIds.value, ...blocks.value.filter(block => !targetId || targetId === `edit-block-${block.id}`).map(block => block.id)])]
  },
})
const names = { text: '文字', image: '图片', video: '视频', link: '链接' }
let nextId = 0
function updateBlocks(value: CardContentBlock[]) {
  emit('update', { ...props.section, blocks: value })
}
function updateBlock(id: string, patch: Partial<CardContentBlock>) {
  updateBlocks(blocks.value.map(item => item.id === id ? { ...item, ...patch } : item))
}
function add(type: CardContentBlock['type'], afterId?: string | null) {
  if (blocks.value.length >= 20)
    return
  const block: CardContentBlock = {
    id: `block-${Date.now().toString(36)}-${nextId++}`,
    type,
    title: names[type],
    content: '',
    visible: true,
    showTitle: props.section.cardLayout === 'showcase',
    ...(type === 'image' ? { images: [], imageLayout: 'stack' } : {}),
    ...(type === 'video' || type === 'link' ? { url: '' } : {}),
    columnSpan: 2,
  }
  const result = [...blocks.value]
  const index = afterId === null ? 0 : afterId ? result.findIndex(item => item.id === afterId) + 1 : result.length
  result.splice(index, 0, block)
  updateBlocks(result)
}
function move(id: string, offset: number) {
  const result = [...blocks.value]
  const index = result.findIndex(item => item.id === id)
  const target = index + offset
  if (index < 0 || target < 0 || target >= result.length)
    return
  const [block] = result.splice(index, 1)
  result.splice(target, 0, block)
  updateBlocks(result)
}
function remove(id: string) {
  if (!busyIds.value.includes(id))
    updateBlocks(blocks.value.filter(item => item.id !== id))
}
function uploading(id: string, busy: boolean) {
  busyIds.value = busy ? [...new Set([...busyIds.value, id])] : busyIds.value.filter(value => value !== id)
  emit('uploading', busyIds.value.length > 0)
}
function toggleSettings(id: string) {
  expandedIds.value = expandedIds.value.includes(id) ? expandedIds.value.filter(value => value !== id) : [...expandedIds.value, id]
}
function replaceMedia(id: string, value: CardSection) {
  const { content, images, url, poster, imageLayout, buttonLabel } = value
  updateBlock(id, { content, images, url, poster, imageLayout, buttonLabel })
}
</script>

<template>
  <view class="card-content-editor mt-4">
    <view class="flex items-center justify-between gap-2">
      <text class="text-sm font-bold">Card 内的内容</text><text class="muted">{{ blocks.length }}/20 项</text>
    </view>
    <text class="muted mt-2 block">文字、图片、视频和链接都放在这张 Card 里。移动或隐藏 Card 时，内部内容一起移动或隐藏。</text>
    <view class="mt-3 flex gap-2">
      <button role="button" class="content-action flex-1" :aria-pressed="!section.cardLayout || section.cardLayout === 'stack'" @click="emit('update', { ...section, cardLayout: 'stack' })">
        单列排版
      </button>
      <button role="button" class="content-action flex-1" :aria-pressed="section.cardLayout === 'columns'" @click="emit('update', { ...section, cardLayout: 'columns' })">
        双列排版
      </button>
      <button role="button" class="content-action flex-1" :aria-pressed="section.cardLayout === 'showcase'" @click="emit('update', { ...section, cardLayout: 'showcase' })">
        三列展示
      </button>
    </view>
    <text v-if="section.cardLayout === 'showcase'" class="muted mt-2 block">每项内容占一张展示卡：图片项可同时填写标题、介绍和图片；文字项适合服务介绍。手机上每行展示三项。</text>
    <text v-if="!blocks.length" class="empty-card muted mt-3 block">这是一张空 Card，先添加一段文字或一组图片。</text>
    <ContentInsert v-if="blocks.length" :disabled="blocks.length >= 20" position="Card 开头" @insert="add($event, null)" />
    <view v-for="(block, index) in blocks" :key="block.id" class="content-entry">
      <view :id="`edit-block-${block.id}`" class="content-editor-block" :data-block-id="block.id">
        <view class="flex items-center justify-between gap-2">
          <text class="text-xs font-bold">{{ index + 1 }} · {{ names[block.type] }}</text>
          <button role="button" class="text-link" :aria-label="`删除内容 ${index + 1}`" :disabled="busyIds.includes(block.id)" @click="remove(block.id)">
            删除
          </button>
        </view>
        <view v-if="section.cardLayout === 'showcase'" class="field mt-3">
          <text class="field-label">展示卡标题</text><input :value="block.title" class="field-input" :maxlength="40" placeholder="公司、业务或服务名称" @input="updateBlock(block.id, { title: $event.detail.value, showTitle: true })">
        </view>
        <textarea v-if="block.type === 'text'" :value="block.content" class="field-input field-textarea mt-3" placeholder="编辑这张 Card 里的文字内容，支持换行" :maxlength="1000" @input="updateBlock(block.id, { content: $event.detail.value })" />
        <MediaSectionEditor v-else :section="block" :media-access="mediaAccess" :caption-label="section.cardLayout === 'showcase' ? '展示卡介绍（显示在图片上方）' : undefined" compact @update="replaceMedia(block.id, $event)" @uploaded="emit('uploaded', $event)" @uploading="uploading(block.id, $event)" />
        <view v-if="section.cardLayout === 'columns'" class="mt-3 flex gap-2">
          <button role="button" class="content-action flex-1" :aria-pressed="block.columnSpan !== 2" @click="updateBlock(block.id, { columnSpan: 1 })">
            占一列
          </button>
          <button role="button" class="content-action flex-1" :aria-pressed="block.columnSpan === 2" @click="updateBlock(block.id, { columnSpan: 2 })">
            占整行
          </button>
        </view>
        <view class="mt-3 flex flex-wrap items-center gap-2">
          <button role="button" class="content-action" :aria-label="`上移内容 ${index + 1}`" :disabled="index === 0" @click="move(block.id, -1)">
            ↑ 上移
          </button>
          <button role="button" class="content-action" :aria-label="`下移内容 ${index + 1}`" :disabled="index === blocks.length - 1" @click="move(block.id, 1)">
            ↓ 下移
          </button>
          <button role="button" class="text-link ml-auto" :aria-expanded="expandedIds.includes(block.id)" :aria-label="`内容 ${index + 1} 标题设置`" @click="toggleSettings(block.id)">
            标题设置
          </button>
        </view>
        <view v-if="expandedIds.includes(block.id)" class="mt-3">
          <button role="button" class="content-action" :aria-pressed="!!block.showTitle" @click="updateBlock(block.id, { showTitle: !block.showTitle })">
            {{ block.showTitle ? '显示小标题' : '隐藏小标题' }}
          </button>
          <input :value="block.title" class="field-input mt-2" placeholder="内容小标题" :maxlength="40" @input="updateBlock(block.id, { title: $event.detail.value })">
        </view>
      </view>
      <ContentInsert :disabled="blocks.length >= 20" :position="`内容 ${index + 1} 后`" @insert="add($event, block.id)" />
    </view>
    <view class="card-add-content mt-3">
      <text class="text-xs font-bold">添加到 Card 内</text>
      <view class="mt-2 flex flex-wrap gap-2">
        <button v-for="(label, type) in names" :key="type" role="button" class="content-action" :disabled="blocks.length >= 20" @click="add(type)">
          ＋ 添加{{ label }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.card-content-editor {
  min-width: 0;
  border-top: 1px solid var(--ui-line);
  padding-top: 16px;
}
.content-editor-block {
  padding: 12px;
  border: 1px solid #e2e5db;
  border-radius: 10px;
  background: white;
  min-width: 0;
}
.content-action {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--ui-line);
  border-radius: 8px;
  background: white;
  color: #5e6656;
  font-size: 12px;
  line-height: 1.6;
}
.content-action[aria-pressed='true'] {
  background: #fbefe5;
  border-color: #d7a082;
}
.content-action[disabled] {
  opacity: 0.4;
}
.empty-card {
  padding: 20px 12px;
  border: 1px dashed #d5d8cf;
  border-radius: 10px;
  text-align: center;
}
.card-add-content {
  padding: 12px;
  background: #f0f2eb;
  border-radius: 10px;
}
</style>

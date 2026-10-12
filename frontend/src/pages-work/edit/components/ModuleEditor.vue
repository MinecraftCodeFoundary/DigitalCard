<script setup lang="ts">
import type { CardContentBlock, CardPage, CardSection, MediaUpload } from '@/api/types'
import { computed, ref, watch } from 'vue'
import { defaultSections, moveSection } from '@/utils/sections'
import { pageIconClass, pageIcons, removePage } from '@/utils/pages'
import MediaSectionEditor from './MediaSectionEditor.vue'
import ContentInsert from './ContentInsert.vue'
import CardContentEditor from './CardContentEditor.vue'

const props = defineProps<{ sections: CardSection[], pages: CardPage[], mediaAccess: Record<string, string>, poster?: boolean, compact?: boolean }>()
const emit = defineEmits<{
  'update:sections': [sections: CardSection[]]
  'update:pages': [pages: CardPage[]]
  'pageChange': [id: string]
  'mediaUploaded': [media: MediaUpload]
  'uploadingChange': [busy: boolean]
  'sectionAdded': [id: string]
}>()
const dragged = ref<string>()
const expanded = ref<string[]>([])
const pageSettings = ref(false)
const cardEditors = ref<InstanceType<typeof CardContentEditor>[]>([])
const scenario = ref<'business' | 'company' | 'personal'>('business')
const scenarios = [
  { key: 'business' as const, label: '商务名片' },
  { key: 'company' as const, label: '业务展示' },
  { key: 'personal' as const, label: '个人主页' },
]
const suggestions = {
  business: [
    { type: 'text' as const, title: '我能提供的服务', hint: '服务内容、适合谁、能解决什么问题' },
    { type: 'text' as const, title: '合作需求', hint: '希望结识的人、合作方向' },
    { type: 'image' as const, title: '代表案例', hint: '案例图片与项目说明' },
  ],
  company: [
    { type: 'text' as const, title: '公司介绍', hint: '公司背景、优势与经验' },
    { type: 'text' as const, title: '产品与服务', hint: '主营业务、产品特点与服务范围' },
    { type: 'image' as const, title: '客户案例', hint: '项目图片与交付成果' },
  ],
  personal: [
    { type: 'text' as const, title: '个人经历', hint: '经历、专长与兴趣' },
    { type: 'image' as const, title: '我的作品', hint: '作品图片与创作说明' },
    { type: 'link' as const, title: '社交主页', hint: '作品集或社交平台链接' },
  ],
}
defineExpose({
  revealSettings(targetId?: string) {
    if (!targetId || targetId.startsWith('edit-page-'))
      pageSettings.value = true
    const affected = props.sections.filter(section => !targetId || targetId === `edit-section-${section.id}` || section.blocks?.some(block => targetId === `edit-block-${block.id}`))
    expanded.value = [...new Set([...expanded.value, ...affected.map(section => section.id)])]
    cardEditors.value.forEach(editor => editor.revealSettings(targetId))
  },
})
function toggleSettings(id: string) {
  expanded.value = expanded.value.includes(id) ? expanded.value.filter(value => value !== id) : [...expanded.value, id]
}
let nextId = 0
const selectedPage = ref(props.pages[0].id)
const moduleGroups = computed(() => {
  let index = 0
  return props.pages.map(page => ({
    page,
    modules: props.sections
      .filter(section => (section.pageId ?? props.pages[0].id) === page.id)
      .map(section => ({ section, index: index++ })),
  }))
})
watch(() => props.pages, () => {
  if (!props.pages.some(page => page.id === selectedPage.value))
    selectPage(props.pages[0].id)
})
function selectPage(id: string) {
  selectedPage.value = id
  emit('pageChange', id)
}
function updatePage<K extends 'title' | 'columns' | 'icon' | 'presentation'>(id: string, key: K, value: CardPage[K]) {
  emit('update:pages', props.pages.map(page => page.id === id ? { ...page, [key]: value } : page))
}
function addPage() {
  if (props.pages.length >= 6)
    return
  const page: CardPage = { id: `page-${Date.now().toString(36)}-${nextId++}`, title: `页面 ${props.pages.length + 1}`, columns: 1 }
  emit('update:pages', [...props.pages, page])
  selectPage(page.id)
}
function deletePage(id: string) {
  if (pageUploading(id))
    return
  const result = removePage(props.pages, props.sections, id)
  emit('update:sections', result.sections)
  emit('update:pages', result.pages)
  if (selectedPage.value === id)
    selectPage(result.pages[0].id)
}
function movePage(from: number, to: number) {
  if (to < 0 || to >= props.pages.length)
    return
  const pages = [...props.pages]
  const [page] = pages.splice(from, 1)
  pages.splice(to, 0, page)
  // Legacy sections without pageId belong to the original first page.
  if (props.sections.some(section => !section.pageId))
    emit('update:sections', props.sections.map(section => ({ ...section, pageId: section.pageId ?? props.pages[0].id })))
  emit('update:pages', pages)
}
function pageColumns(section: CardSection) {
  return props.pages.find(page => page.id === (section.pageId ?? props.pages[0].id))?.columns ?? 1
}
const uploadingIds = ref<string[]>([])
function pageUploading(id: string) {
  return props.sections.some(section => (section.pageId ?? props.pages[0].id) === id && uploadingIds.value.includes(section.id))
}
const moduleNames: Record<CardSection['type'], string> = { about: '个人简介', contact: '联系方式', text: '文字段落', image: '图片模块', video: '视频模块', link: '链接模块', card: '自定义 Card' }
function replace(id: string, section: CardSection) {
  emit('update:sections', props.sections.map(item => item.id === id ? section : item))
}
function wrapInCard(section: CardSection) {
  if (!['text', 'image', 'video', 'link'].includes(section.type) || uploadingIds.value.includes(section.id))
    return
  const { pageId, columnSpan } = section
  const block: CardContentBlock = { id: `block-${Date.now().toString(36)}-${nextId++}`, type: section.type as CardContentBlock['type'], title: section.title, content: section.content, images: section.images, url: section.url, poster: section.poster, imageLayout: section.imageLayout, buttonLabel: section.buttonLabel, visible: true, showTitle: false, columnSpan: 2 }
  replace(section.id, { id: section.id, title: section.title, content: '', type: 'card', visible: section.visible, showTitle: section.showTitle ?? true, pageId, columnSpan, cardLayout: 'stack', blocks: [block] })
}
function uploading(id: string, busy: boolean) {
  uploadingIds.value = busy ? [...new Set([...uploadingIds.value, id])] : uploadingIds.value.filter(value => value !== id)
  emit('uploadingChange', uploadingIds.value.length > 0)
}
function update<K extends 'title' | 'content' | 'visible' | 'pageId' | 'columnSpan' | 'showTitle'>(id: string, key: K, value: CardSection[K]) {
  if (key === 'pageId' && uploadingIds.value.includes(id))
    return
  emit('update:sections', props.sections.map(section => section.id === id ? { ...section, [key]: value } : section))
}
function move(id: string, targetId: string) {
  const from = props.sections.findIndex(section => section.id === id)
  const to = props.sections.findIndex(section => section.id === targetId)
  if (from < 0 || to < 0
    || (props.sections[from].pageId ?? props.pages[0].id) !== (props.sections[to].pageId ?? props.pages[0].id)) {
    return
  }
  emit('update:sections', moveSection(props.sections, from, to))
}
function remove(id: string) {
  emit('update:sections', props.sections.filter(section => section.id !== id))
}
function add(type: CardSection['type'], pageId: string, afterId?: string | null, title?: string) {
  if (props.sections.length >= 30)
    return
  const article = props.pages.find(page => page.id === pageId)?.presentation === 'article'
  const section: CardSection = ['about', 'contact'].includes(type)
    ? defaultSections().find(section => section.type === type)!
    : { id: `${type}-${Date.now().toString(36)}-${nextId++}`, type, title: moduleNames[type], content: '', visible: true, ...(type === 'card' ? { blocks: [], cardLayout: 'stack', showTitle: true } : {}), ...(type === 'image' ? { images: [], imageLayout: 'grid' } : {}), ...(type === 'video' || type === 'link' ? { url: '' } : {}) }
  const added = { ...section, pageId, columnSpan: type === 'video' ? 2 as const : 1 as const, ...(article && type !== 'card' ? { showTitle: false, ...(type === 'text' ? { title: '文字段落' } : {}), ...(type === 'image' ? { imageLayout: 'stack' as const } : {}) } : {}), ...(title ? { title, showTitle: true } : {}) }
  const sections = [...props.sections]
  const firstIndex = sections.findIndex(item => (item.pageId ?? props.pages[0].id) === pageId)
  const position = afterId === null ? (firstIndex < 0 ? sections.length : firstIndex) : afterId ? sections.findIndex(item => item.id === afterId) + 1 : sections.length
  sections.splice(position, 0, added)
  emit('update:sections', sections)
  selectPage(pageId)
  emit('sectionAdded', added.id)
}
function addShowcase(pageId: string, images: boolean) {
  if (props.sections.length >= 30)
    return
  const prefix = `showcase-${Date.now().toString(36)}-${nextId++}`
  const section: CardSection = {
    id: prefix,
    type: 'card',
    title: images ? '主营业务' : '服务与价值',
    content: '',
    visible: true,
    showTitle: true,
    pageId,
    columnSpan: 2,
    cardLayout: 'showcase',
    blocks: Array.from({ length: 3 }, (_, index) => ({
      id: `${prefix}-${index}`,
      type: images ? 'image' : 'text',
      title: `${images ? '业务' : '服务'} ${index + 1}`,
      content: '',
      visible: true,
      showTitle: true,
      ...(images ? { images: [], imageLayout: 'stack' as const } : {}),
    })),
  }
  emit('update:sections', [...props.sections, section])
  selectPage(pageId)
  emit('sectionAdded', section.id)
}
// #ifdef H5
function startDrag(id: string, event: DragEvent) {
  dragged.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }
}
// #endif
function drop(id: string) {
  if (dragged.value !== undefined) {
    move(dragged.value, id)
    dragged.value = undefined
  }
}
</script>

<template>
  <view class="module-editor mt-4">
    <view class="flex items-center justify-between gap-3">
      <text class="section-title">{{ compact ? '业务与展示内容' : '自由编排主页' }}</text><text class="muted">{{ sections.length }}/30 个模块</text>
    </view>
    <text class="muted mt-2 block">{{ compact ? '按需要添加介绍、服务、案例或作品，写标题和内容即可。三种场景的内容可以混合添加。' : '创建 Card，在 Card 内组合文字、图片、视频和链接，再按页面调整 Card 的顺序。' }}</text>
    <view v-if="compact" class="mt-4 flex gap-2" role="group" aria-label="常用内容场景">
      <button v-for="item in scenarios" :key="item.key" role="button" class="module-action flex-1" :class="{ active: scenario === item.key }" :aria-pressed="scenario === item.key" @click="scenario = item.key">
        {{ item.label }}
      </button>
    </view>
    <button v-if="compact" role="button" class="module-action mt-4 w-full" :aria-expanded="pageSettings" @click="pageSettings = !pageSettings">
      {{ pageSettings ? '收起页面与排版设置' : '页面与排版设置' }}
    </button>
    <view v-show="!compact || pageSettings" class="page-settings mt-4">
      <text class="text-sm font-bold">页面与分栏</text>
      <text class="muted mt-2 block">每页的设置、内容和添加按钮都放在一起。最多 6 页，删除页面会把内容移到相邻页面。</text>
    </view>
    <text v-show="!compact || pageSettings" class="muted mt-3 block">{{ poster ? '海报按页面顺序连续展示，下方依次编辑各区域。业务区和服务区可用三列展示，每项内容在自己的卡片内编辑。' : '按页面从上往下编辑；上移、下移调整本页内容，更换所属页面可跨页移动。' }}</text>
    <view class="mt-4 flex flex-col gap-3">
      <view v-for="(group, pageIndex) in moduleGroups" :key="group.page.id" class="module-group" :data-page-id="group.page.id">
        <text v-if="compact && !pageSettings && pages.length > 1" class="block font-bold">{{ group.page.title }}</text>
        <view v-show="!compact || pageSettings" :id="`edit-page-${group.page.id}`" class="page-row mt-3" :class="{ selected: group.page.id === selectedPage }" :data-page-id="group.page.id">
          <view class="flex items-center gap-2">
            <button role="button" class="module-action" :aria-label="`编辑第 ${pageIndex + 1} 页`" :aria-pressed="group.page.id === selectedPage" @click="selectPage(group.page.id)">
              第 {{ pageIndex + 1 }} 页
            </button>
            <input class="field-input flex-1" :value="group.page.title" :maxlength="24" placeholder="页面名称，例如：作品 / 服务" @input="updatePage(group.page.id, 'title', $event.detail.value)">
          </view>
          <view class="mt-2 flex flex-wrap gap-2">
            <button role="button" class="module-action" :class="{ active: group.page.columns === 1 }" :aria-label="`第 ${pageIndex + 1} 页单栏`" :aria-pressed="group.page.columns === 1" @click="updatePage(group.page.id, 'columns', 1)">
              单栏
            </button>
            <button role="button" class="module-action" :class="{ active: group.page.columns === 2 }" :aria-label="`第 ${pageIndex + 1} 页双栏`" :aria-pressed="group.page.columns === 2" @click="updatePage(group.page.id, 'columns', 2)">
              双栏
            </button>
            <button role="button" class="module-action" :aria-label="`前移第 ${pageIndex + 1} 页`" :disabled="pageIndex === 0" @click="movePage(pageIndex, pageIndex - 1)">
              ← 前移
            </button>
            <button role="button" class="module-action" :aria-label="`后移第 ${pageIndex + 1} 页`" :disabled="pageIndex === pages.length - 1" @click="movePage(pageIndex, pageIndex + 1)">
              后移 →
            </button>
            <button role="button" class="module-action" :aria-label="`删除第 ${pageIndex + 1} 页`" :aria-disabled="pages.length === 1 || pageUploading(group.page.id)" :disabled="pages.length === 1 || pageUploading(group.page.id)" @click="deletePage(group.page.id)">
              删除页面
            </button>
          </view>
          <view class="mt-3">
            <text class="field-label">内容编排方式</text>
            <view class="flex flex-wrap gap-2">
              <button role="button" class="module-action" :class="{ active: group.page.presentation !== 'article' }" :aria-label="`第 ${pageIndex + 1} 页卡片模块`" :aria-pressed="group.page.presentation !== 'article'" @click="updatePage(group.page.id, 'presentation', 'cards')">
                独立卡片
              </button>
              <button role="button" class="module-action" :class="{ active: group.page.presentation === 'article' }" :aria-label="`第 ${pageIndex + 1} 页自由图文`" :aria-pressed="group.page.presentation === 'article'" @click="updatePage(group.page.id, 'presentation', 'article')">
                自由图文
              </button>
            </view>
            <text class="muted mt-2 block">{{ group.page.presentation === 'article' ? '文字段落和图片组按顺序连成一篇内容。在任意位置插入，再用上移、下移调整顺序；每段标题可单独显示。' : '每个内容块显示在独立卡片里，适合服务项目、作品分类。' }}</text>
          </view>
          <view class="mt-3">
            <text class="field-label">主页导航图标</text>
            <view class="flex flex-wrap gap-2">
              <button v-for="icon in pageIcons" :key="icon.key" role="button" class="module-action flex items-center gap-1" :class="{ active: (group.page.icon ?? 'user') === icon.key }" :aria-label="`第 ${pageIndex + 1} 页图标${icon.label}`" :aria-pressed="(group.page.icon ?? 'user') === icon.key" @click="updatePage(group.page.id, 'icon', icon.key)">
                <view :class="pageIconClass(icon.key)" />{{ icon.label }}
              </button>
            </view>
          </view>
        </view>
        <view v-if="compact" class="mt-3 flex flex-col gap-2">
          <button v-for="item in suggestions[scenario]" :key="item.title" role="button" class="module-action text-left" :aria-label="`添加${item.title}到第 ${pageIndex + 1} 页`" :disabled="sections.length >= 30" @click="add(item.type, group.page.id, undefined, item.title)">
            <text class="block font-bold">＋ {{ item.title }}</text><text class="muted mt-1 block">{{ item.hint }}</text>
          </button>
        </view>
        <view class="module-group-heading mt-4 flex items-center justify-between gap-2">
          <text class="module-group-title">{{ compact ? '已添加的内容' : '本页内容' }}</text><text class="muted">{{ group.modules.length }} 个模块</text>
        </view>
        <text v-if="!group.modules.length" class="module-empty muted block">这一页还没有内容，点击下方按钮添加。</text>
        <ContentInsert v-if="group.page.presentation === 'article'" :disabled="sections.length >= 30" :position="`第 ${pageIndex + 1} 页开头`" @insert="add($event, group.page.id, null)" />
        <view v-for="({ section, index }, localIndex) in group.modules" :key="section.id" class="module-entry">
          <view :id="`edit-section-${section.id}`" class="module-row mt-3" :class="{ dragging: dragged === section.id }" :data-module-id="section.id" @dragover.prevent @drop.prevent="drop(section.id)">
            <view class="flex items-center gap-2">
              <!-- #ifdef H5 -->
              <view class="drag-handle" draggable="true" title="拖动调整页内顺序" :aria-label="`拖动模块 ${index + 1}`" @dragstart="startDrag(section.id, $event)" @dragend="dragged = undefined">
                <view class="i-carbon-draggable" />
              </view>
              <!-- #endif -->
              <text class="module-kind flex-1">{{ index + 1 }} · {{ group.page.presentation === 'article' && section.type === 'text' ? '文字段落' : group.page.presentation === 'article' && section.type === 'image' ? '图片组' : moduleNames[section.type] }}</text>
              <button role="button" class="text-link" :aria-label="`删除模块 ${index + 1}`" :disabled="uploadingIds.includes(section.id)" @click="remove(section.id)">
                删除
              </button>
            </view>
            <view class="mt-3 flex items-center justify-between gap-2">
              <button v-show="!compact || expanded.includes(section.id)" role="button" class="module-action" :aria-label="`模块 ${index + 1} 显示标题`" :aria-pressed="section.showTitle ?? group.page.presentation !== 'article'" @click="update(section.id, 'showTitle', !(section.showTitle ?? group.page.presentation !== 'article'))">
                {{ (section.showTitle ?? group.page.presentation !== 'article') ? '标题：显示' : '标题：隐藏' }}
              </button>
              <button v-if="compact || group.page.presentation === 'article'" role="button" class="text-link" :aria-label="`模块 ${index + 1} 更多设置`" :aria-expanded="expanded.includes(section.id)" @click="toggleSettings(section.id)">
                {{ expanded.includes(section.id) ? '收起设置' : '更多设置' }}
              </button>
            </view>
            <button v-if="['text', 'image', 'video', 'link'].includes(section.type) && (!compact || expanded.includes(section.id))" role="button" class="module-action mt-2" :disabled="uploadingIds.includes(section.id)" :aria-label="`模块 ${index + 1} 转为 Card`" @click="wrapInCard(section)">
              转为 Card，继续添加内容
            </button>
            <view v-if="group.page.presentation !== 'article' || section.type === 'card' || section.showTitle || expanded.includes(section.id)" class="field mt-3">
              <text class="field-label">{{ section.type === 'card' ? 'Card 标题' : group.page.presentation === 'article' && !section.showTitle ? '模块名称（标题已隐藏）' : '模块标题' }}</text><input :value="section.title" class="field-input" placeholder="例如：我的服务 / 代表作品 / 合作方向" :maxlength="40" @input="update(section.id, 'title', $event.detail.value)">
            </view>
            <view v-if="(!compact && group.page.presentation !== 'article') || expanded.includes(section.id)" class="mt-3">
              <text class="field-label">所属页面</text>
              <view class="flex flex-wrap gap-2">
                <button v-for="(item, targetPageIndex) in pages" :key="item.id" role="button" class="module-action" :class="{ active: (section.pageId ?? pages[0].id) === item.id }" :aria-label="`模块 ${index + 1} 放到第 ${targetPageIndex + 1} 页`" :aria-pressed="(section.pageId ?? pages[0].id) === item.id" :disabled="uploadingIds.includes(section.id)" @click="update(section.id, 'pageId', item.id)">
                  {{ item.title }}
                </button>
              </view>
            </view>
            <view v-if="pageColumns(section) === 2 && (!compact || expanded.includes(section.id))" class="mt-3">
              <text class="field-label">双栏中的模块宽度</text>
              <view class="flex gap-2">
                <button role="button" class="module-action" :class="{ active: section.columnSpan !== 2 }" :aria-label="`模块 ${index + 1} 占一栏`" :aria-pressed="section.columnSpan !== 2" @click="update(section.id, 'columnSpan', 1)">
                  占一栏
                </button>
                <button role="button" class="module-action" :class="{ active: section.columnSpan === 2 }" :aria-label="`模块 ${index + 1} 通栏`" :aria-pressed="section.columnSpan === 2" @click="update(section.id, 'columnSpan', 2)">
                  通栏
                </button>
              </view>
            </view>
            <CardContentEditor v-if="section.type === 'card'" ref="cardEditors" :section="section" :media-access="mediaAccess" @update="replace(section.id, $event)" @uploaded="emit('mediaUploaded', $event)" @uploading="uploading(section.id, $event)" />
            <view v-else-if="section.type === 'text'" class="field">
              <text class="field-label">{{ group.page.presentation === 'article' ? '文字段落' : '模块内容' }}</text><textarea :value="section.content" class="field-input field-textarea" placeholder="写下这段文字，支持换行。可在下方接着插入图片或文字。" :maxlength="1000" @input="update(section.id, 'content', $event.detail.value)" />
              <text class="muted mt-2 block text-right">{{ section.content.length }}/1000</text>
            </view>
            <MediaSectionEditor v-else-if="['image', 'video', 'link'].includes(section.type)" :section="section" :compact="compact || group.page.presentation === 'article'" :media-access="mediaAccess" @update="replace(section.id, $event)" @uploaded="emit('mediaUploaded', $event)" @uploading="uploading(section.id, $event)" />
            <text v-else class="muted mt-2 block">{{ section.type === 'about' ? '内容来自上方的个人简介。' : '内容来自上方已填写的联系方式。' }}</text>
            <view class="module-actions mt-3 flex flex-wrap items-center gap-3">
              <button role="button" class="module-action" :aria-label="`上移模块 ${index + 1}`" :disabled="localIndex === 0" @click="move(section.id, group.modules[localIndex - 1].section.id)">
                ↑ 上移
              </button>
              <button role="button" class="module-action" :aria-label="`下移模块 ${index + 1}`" :disabled="localIndex === group.modules.length - 1" @click="move(section.id, group.modules[localIndex + 1].section.id)">
                ↓ 下移
              </button>
              <button role="button" class="module-action ml-auto" :aria-label="`${section.visible ? '隐藏' : '显示'}模块 ${index + 1}`" :aria-pressed="section.visible" @click="update(section.id, 'visible', !section.visible)">
                {{ section.visible ? '展示中' : '已隐藏' }}
              </button>
            </view>
          </view>
          <ContentInsert v-if="group.page.presentation === 'article'" :disabled="sections.length >= 30" :position="`模块 ${index + 1} 后`" @insert="add($event, group.page.id, section.id)" />
        </view>
        <text class="mt-4 block text-sm font-bold">{{ group.page.presentation === 'article' ? '添加到本页末尾' : '添加本页模块' }}</text>
        <view class="mt-3 flex flex-wrap gap-2">
          <button v-if="poster" role="button" class="module-action" :disabled="sections.length >= 30" @click="addShowcase(group.page.id, true)">
            ＋ 添加主营业务区
          </button>
          <button v-if="poster" role="button" class="module-action" :disabled="sections.length >= 30" @click="addShowcase(group.page.id, false)">
            ＋ 添加服务介绍区
          </button>
          <button v-show="!compact || pageSettings" role="button" class="module-action" :disabled="sections.length >= 30" @click="add('card', group.page.id)">
            ＋ 创建 Card
          </button>
          <button role="button" class="module-action" :disabled="sections.length >= 30" @click="add('text', group.page.id)">
            ＋ 添加文字段落
          </button>
          <button role="button" class="module-action" :disabled="sections.length >= 30" @click="add('image', group.page.id)">
            ＋ 添加图片模块
          </button>
          <button role="button" class="module-action" :disabled="sections.length >= 30" @click="add('video', group.page.id)">
            ＋ 添加视频模块
          </button>
          <button role="button" class="module-action" :disabled="sections.length >= 30" @click="add('link', group.page.id)">
            ＋ 添加链接模块
          </button>
          <button v-if="!sections.some(section => section.type === 'about')" role="button" class="module-action" :disabled="sections.length >= 30" @click="add('about', group.page.id)">
            ＋ 添加个人简介
          </button>
          <button v-if="!sections.some(section => section.type === 'contact')" role="button" class="module-action" :disabled="sections.length >= 30" @click="add('contact', group.page.id)">
            ＋ 添加联系方式
          </button>
        </view>
      </view>
      <button v-show="!compact || pageSettings" role="button" class="module-action w-full" :disabled="pages.length >= 6" @click="addPage">
        {{ pages.length >= 6 ? '已达到 6 页上限' : '＋ 添加页面' }}
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.module-group {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--ui-line);
  border-radius: 16px;
  background: white;
}
.module-group-heading {
  border-top: 1px solid var(--ui-line);
  padding-top: 18px;
}
.module-group-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.module-empty {
  padding: 16px 12px;
  margin-top: 12px;
  border: 1px dashed var(--ui-line);
  border-radius: 10px;
}
.page-settings {
  padding: 16px;
  border: 1px solid var(--ui-line);
  border-radius: 16px;
  background: white;
}
.page-row {
  margin-top: 0;
}
.page-row.selected > view:first-child > button {
  color: var(--ui-accent);
  border-color: #d7a082;
  background: #fbefe5;
}
.page-row input {
  min-width: 0;
  width: 0;
}
.module-action.active {
  background: var(--ui-accent);
  color: white;
  border-color: var(--ui-accent);
}
.module-row {
  border: 1px solid var(--ui-line);
  background: #faf9f6;
  border-radius: 12px;
  padding: 16px;
  min-width: 0;
}
.module-row.dragging {
  opacity: 0.5;
  border-color: var(--ui-accent);
}
.module-kind {
  color: #5e6656;
  font-size: 12px;
}
.drag-handle {
  cursor: grab;
  padding: 6px;
  color: #787d6e;
}
.module-action {
  min-height: 44px;
  padding: 11px 12px;
  border-radius: 8px;
  border: 1px solid var(--ui-line);
  background: white;
  color: #5e6656;
  font-size: 12px;
  line-height: 1.6;
}
.module-action[disabled] {
  opacity: 0.4;
}
</style>

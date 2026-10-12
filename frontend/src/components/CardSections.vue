<script setup lang="ts">
import type { CardBody, CardSection } from '@/api/types'
import { computed, ref, watch } from 'vue'
import { copyText } from '@/utils/card'
import { defaultSections } from '@/utils/sections'
import { defaultPages, pageIconClass } from '@/utils/pages'
import { coverColors, themeColors } from '@/utils/appearance'
import { cardTemplateClass } from '@/utils/templates'
import SectionMedia from './SectionMedia.vue'
import CardContent from './CardContent.vue'
import BrandPosterFooter from './BrandPosterFooter.vue'

const props = defineProps<{ card: CardBody, interactive?: boolean, mediaAccess?: Record<string, string>, pageId?: string, hideNavigation?: boolean }>()
const pages = computed(() => props.card.pages ?? defaultPages())
const colors = computed(() => coverColors(props.card.appearance?.accentColor || themeColors[props.card.theme]))
const activeId = ref('')
watch(() => props.pageId, (id) => {
  activeId.value = id ?? ''
}, { immediate: true })
const activePage = computed(() => pages.value.find(page => page.id === activeId.value) ?? pages.value[0])
const pageIndex = computed(() => pages.value.findIndex(page => page.id === activePage.value.id))
const poster = computed(() => props.card.appearance?.layout === 'poster')
const displayPages = computed(() => poster.value ? pages.value : [activePage.value])
function pageSections(pageId: string) {
  return (props.card.sections ?? defaultSections()).filter(section => section.visible
    && (section.pageId ?? pages.value[0].id) === pageId && (section.type !== 'about' || props.card.bio))
}
const sections = computed(() => pageSections(activePage.value.id))
const hasContact = computed(() => !!(props.card.phone || props.card.email || props.card.wechat || props.card.website))
function hasVisual(section: CardSection) {
  return ['image', 'video'].includes(section.type) || section.blocks?.some(block => block.visible && ['image', 'video'].includes(block.type))
}
function call() {
  if (props.interactive && props.card.phone)
    uni.makePhoneCall({ phoneNumber: props.card.phone, fail: () => copyText(props.card.phone) })
}
function copy(value: string, title: string) {
  if (props.interactive)
    copyText(value, title)
}
</script>

<template>
  <view class="card-sections" :class="cardTemplateClass(card)" :style="{ '--section-accent': colors.background, '--section-ink': colors.color, '--section-text': colors.color === '#ffffff' ? colors.background : '#273c30' }">
    <view v-if="pages.length > 1 && !hideNavigation && !poster" class="page-tabs" :style="{ gridTemplateColumns: `repeat(${Math.min(pages.length, 4)}, minmax(0, 1fr))` }">
      <button v-for="item in pages" :key="item.id" role="button" class="page-tab" :class="{ selected: item.id === activePage.id }" :aria-pressed="item.id === activePage.id" @click="activeId = item.id">
        <view class="page-icon flex items-center justify-center" aria-hidden="true">
          <view :class="pageIconClass(item.icon)" />
        </view>
        <text>{{ item.title }}</text>
      </button>
    </view>
    <view v-if="pages.length > 1 && !hideNavigation && !poster" class="page-heading flex items-center gap-3">
      <text class="page-number">{{ String(pageIndex + 1).padStart(2, '0') }}</text>
      <view class="min-w-0 flex-1">
        <text class="page-heading-title">{{ activePage.title }}</text><text class="page-heading-caption">{{ card.appearance?.hiddenFields.includes('company') ? card.name : card.company || card.name }}</text>
      </view>
      <view class="page-heading-line" />
    </view>
    <view v-for="displayPage in displayPages" :key="displayPage.id" :class="{ 'poster-page': poster }">
      <view v-if="poster && pages.length > 1 && pageSections(displayPage.id).length" class="poster-page-heading">
        <text>{{ displayPage.title }}</text><view />
      </view>
      <view class="section-grid" :class="{ 'columns-two': displayPage.columns === 2, 'article': displayPage.presentation === 'article' }" :data-page-id="displayPage.id">
        <view v-for="section in pageSections(displayPage.id)" :key="section.id" class="profile-section panel" :class="{ 'custom-card': section.type === 'card', 'showcase-card': section.cardLayout === 'showcase', 'visual-card': hasVisual(section), 'story-card': section.type === 'card' && !hasVisual(section), 'contact-card': section.type === 'contact', 'full-width': section.columnSpan === 2, 'without-title': !(section.showTitle ?? (section.type === 'card' || displayPage.presentation !== 'article')) }" :data-section-id="section.id">
          <text v-if="section.showTitle ?? (section.type === 'card' || displayPage.presentation !== 'article')" class="section-title">{{ section.title }}</text>
          <CardContent v-if="section.type === 'card'" :blocks="section.blocks ?? []" :layout="section.cardLayout" :media-access="mediaAccess" :interactive="interactive" />
          <text v-else-if="section.type === 'about'" class="section-content">{{ card.bio }}</text>
          <text v-else-if="section.type === 'text'" class="section-content">{{ section.content }}</text>
          <SectionMedia v-else-if="['image', 'video', 'link'].includes(section.type)" :section="section" :media-access="mediaAccess" :interactive="interactive" :plain="displayPage.presentation === 'article'" />
          <view v-else class="mt-3">
            <button v-if="card.phone" role="button" class="contact-row" @click="call">
              <view class="i-carbon-phone" /><view><text class="contact-label">电话</text><text>{{ card.phone }}</text></view><view class="i-carbon-arrow-up-right" />
            </button>
            <button v-if="card.wechat" role="button" class="contact-row" @click="copy(card.wechat, '微信号已复制')">
              <view class="i-carbon-chat" /><view><text class="contact-label">微信</text><text>{{ card.wechat }}</text></view><view class="i-carbon-copy" />
            </button>
            <button v-if="card.email" role="button" class="contact-row" @click="copy(card.email, '邮箱已复制')">
              <view class="i-carbon-email" /><view><text class="contact-label">邮箱</text><text>{{ card.email }}</text></view><view class="i-carbon-copy" />
            </button>
            <button v-if="card.website" role="button" class="contact-row" @click="copy(card.website, '网址已复制')">
              <view class="i-carbon-link" /><view><text class="contact-label">个人网站</text><text>{{ card.website }}</text></view><view class="i-carbon-copy" />
            </button>
            <text v-if="!hasContact" class="muted">对方尚未填写联系方式。</text>
          </view>
        </view>
      </view>
    </view>
    <BrandPosterFooter v-if="poster" :card="card" />
    <view v-if="!sections.length && pages.length > 1 && !poster" class="panel muted text-center">
      这个页面暂时没有展示内容。
    </view>
    <view v-if="pages.length > 1 && !hideNavigation && !poster" class="mt-4 flex items-center justify-between gap-3">
      <button role="button" class="page-tab" :disabled="pageIndex === 0" @click="activeId = pages[pageIndex - 1].id">
        上一页
      </button>
      <text class="muted">{{ pageIndex + 1 }} / {{ pages.length }}</text>
      <button role="button" class="page-tab" :disabled="pageIndex === pages.length - 1" @click="activeId = pages[pageIndex + 1].id">
        下一页
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.section-grid.article .profile-section:not(.custom-card) {
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.custom-card > .section-title + :deep(.card-content) {
  margin-top: 14px;
}
.article .section-content {
  margin-top: 0;
  color: #51565a;
  font-size: 14px;
  line-height: 1.9;
}
.article .section-title + .section-content,
.article .section-title + :deep(.section-media) {
  margin-top: 12px;
}
.without-title .section-content,
.without-title :deep(.section-media) {
  margin-top: 0;
}
.section-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.columns-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.profile-section {
  min-width: 0;
  border-radius: 20px;
  padding: 22px 20px;
  border-color: #e7e7dc;
  box-shadow: 0 5px 18px #233d3005;
}
.story-card {
  background: #fbfaf4;
  border-top: 3px solid var(--section-accent);
}
.visual-card {
  background: white;
}
.profile-section.visual-card > .section-title {
  font-size: 19px;
  line-height: 1.6;
}
.profile-section > .section-title {
  padding-bottom: 14px;
  border-bottom: 1px solid #e9ece1;
  color: #273c30;
  font-size: 17px;
  line-height: 1.65;
}
.story-card > .section-title {
  border-bottom-style: dashed;
}
.contact-card {
  background: #f0f3e9;
}
.page-tabs {
  display: grid;
  gap: 6px;
  padding: 7px;
  border: 1px solid #e7e7dc;
  border-radius: 20px;
  background: #efefe7;
  margin-bottom: 24px;
}
.page-tabs .page-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 4px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
}
.page-icon {
  width: 30px;
  height: 30px;
  font-size: 20px;
  color: var(--section-accent);
}
.page-tabs .page-tab.selected {
  background: var(--section-accent);
  color: var(--section-ink);
  box-shadow: 0 4px 10px #243e3015;
}
.page-tab.selected .page-icon {
  color: inherit;
}
.page-heading {
  margin-bottom: 18px;
}
.page-number {
  font-size: 37px;
  line-height: 1;
  font-family: Georgia, serif;
  color: #aab69d;
  font-style: italic;
}
.page-heading-title {
  display: block;
  color: #31402f;
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.page-heading-caption {
  display: block;
  color: #929889;
  font-size: 10px;
  margin-top: 3px;
  overflow-wrap: anywhere;
}
.page-heading-line {
  width: 40px;
  height: 1px;
  background: #cbd3bf;
}
.section-grid.article .profile-section:not(.custom-card) > .section-title {
  border-bottom: 0;
  padding-bottom: 0;
}
.card-sections :deep(.block-title) {
  color: var(--section-text);
}
.custom-card :deep(.media-plain .gallery-image),
.custom-card :deep(.media-plain .section-video) {
  border-radius: 12px;
}
.contact-row > view:first-child {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background-color: #e3e9d9;
  color: var(--section-text);
  flex-shrink: 0;
}
.contact-card .contact-row {
  background: transparent;
  border-color: #dfe6d5;
}
.columns-two .contact-row > view:first-child {
  width: 28px;
  height: 28px;
}
.columns-two .profile-section {
  padding: 16px;
}
.full-width {
  grid-column: 1 / -1;
}
.page-tab {
  min-width: 0;
  min-height: 44px;
  padding: 9px 14px;
  border: 1px solid var(--ui-line);
  border-radius: 10px;
  background: white;
  color: var(--ui-muted);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.page-tab.selected {
  background: #303e34;
  color: white;
  border-color: #303e34;
}
.page-tab[disabled] {
  opacity: 0.4;
}
.columns-two .contact-row {
  flex-wrap: wrap;
  gap: 6px;
}
.section-content {
  display: block;
  margin-top: 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: #636d5b;
  font-size: 14px;
  line-height: 2;
}
.section-title {
  overflow-wrap: anywhere;
}
.contact-row {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
  padding: 14px 0;
  background: white;
  border-bottom: 1px solid #eeeee7;
  text-align: left;
  color: #515c49;
  font-size: 13px;
  line-height: 1.6;
}
.contact-row > view:nth-child(2) {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.contact-label {
  display: block;
  font-size: 11px;
  color: #7f8774;
}
.contact-row:last-child {
  border-bottom: none;
}
</style>

<script setup lang="ts">
import type { CardContentBlock, CardSection } from '@/api/types'
import SectionMedia from './SectionMedia.vue'

defineProps<{ blocks: CardContentBlock[], layout?: CardSection['cardLayout'], mediaAccess?: Record<string, string>, interactive?: boolean }>()
</script>

<template>
  <view class="card-content" :class="{ 'content-columns': layout === 'columns', 'content-showcase': layout === 'showcase', 'service-showcase': layout === 'showcase' && blocks.filter(block => block.visible).every(block => block.type === 'text') }">
    <view v-for="(block, index) in blocks.filter(item => item.visible)" :key="block.id" class="card-content-block" :class="{ 'content-full-width': block.columnSpan === 2 && layout !== 'showcase', 'text-block': block.type === 'text', 'titled-block': block.showTitle }" :data-block-id="block.id">
      <view v-if="layout === 'showcase' && block.type === 'text'" class="showcase-service-icon" aria-hidden="true">
        <view v-if="index % 3 === 0" class="i-carbon-user-follow" /><view v-else-if="index % 3 === 1" class="i-carbon-chart-line" /><view v-else class="i-carbon-chip" />
      </view>
      <text v-if="layout === 'showcase' && block.type !== 'text'" class="showcase-number">{{ String(index + 1).padStart(2, '0') }}</text>
      <view v-if="block.showTitle" class="block-heading flex items-start gap-2">
        <text v-if="block.type === 'text'" class="block-order">{{ String(index + 1).padStart(2, '0') }}</text>
        <text class="block-title min-w-0 flex-1">{{ block.title }}</text>
      </view>
      <text v-if="block.type === 'text'" class="block-text">{{ block.content }}</text>
      <SectionMedia v-else :section="block" :media-access="mediaAccess" :interactive="interactive" plain />
    </view>
  </view>
</template>

<style scoped>
.card-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}
.content-columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.card-content-block {
  min-width: 0;
}
.content-showcase {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  align-items: stretch;
}
.content-showcase > .card-content-block {
  padding: 10px 8px;
  border-radius: 4px;
  background: linear-gradient(140deg, var(--template-soft, #f1f6f8), #fff);
  display: flex;
  flex-direction: column;
}
.content-showcase .block-heading {
  margin-bottom: 8px;
}
.content-showcase > .card-content-block:not(.text-block) .block-heading {
  display: block;
}
.content-showcase > .card-content-block:not(.text-block) .block-heading::after {
  content: '';
  display: block;
  width: 16px;
  height: 2px;
  margin-top: 7px;
  background: #a3b851;
}
.content-showcase.service-showcase {
  gap: 0;
  padding: 14px 0;
  border-radius: 4px;
  background: var(--template-soft, #f1f6f8);
}
.content-showcase.service-showcase > .card-content-block {
  background: transparent;
}
.content-showcase.service-showcase > .card-content-block + .card-content-block {
  border-left: 1px solid #dce8eb;
}
.content-showcase .block-order {
  display: none;
}
.content-showcase .block-title {
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.content-showcase .block-text {
  font-size: 10px;
  line-height: 1.8;
}
.content-showcase .text-block.titled-block + .text-block.titled-block {
  border: 0;
  padding-top: 10px;
}
.content-showcase > .text-block {
  text-align: center;
}
.showcase-number {
  color: #aec0c7;
  font-size: 15px;
  line-height: 1;
  margin-bottom: 8px;
  font-weight: 300;
}
.showcase-service-icon {
  font-size: 26px;
  color: var(--section-accent, #168e91);
  margin: 5px auto 12px;
}
.content-showcase :deep(.section-media) {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 10px;
}
.content-showcase :deep(.section-media > view) {
  margin-top: auto;
}
.content-showcase :deep(.media-caption) {
  order: -1;
  margin: 0;
  font-size: 10px;
  line-height: 1.8;
}
.content-showcase :deep(.image-gallery) {
  gap: 6px;
}
.content-showcase :deep(.gallery-image) {
  border-radius: 0;
}
.content-showcase :deep(.section-media.media-plain .gallery-image) {
  border-radius: 0;
}
.content-showcase :deep(.section-video) {
  height: 110px;
}
.content-showcase :deep(.btn-secondary) {
  padding: 8px 4px;
  font-size: 10px;
}
.content-showcase :deep(.media-hint) {
  font-size: 10px;
}
.content-full-width {
  grid-column: 1 / -1;
}
.block-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #303e34;
  overflow-wrap: anywhere;
}
.block-heading {
  margin-bottom: 9px;
}
.block-order {
  color: #8d9a7e;
  font-family: Georgia, serif;
  font-size: 16px;
  font-style: italic;
  line-height: 1.2;
}
.text-block.titled-block + .text-block.titled-block {
  border-top: 1px solid #e6e9de;
  padding-top: 18px;
}
.content-columns .text-block.titled-block {
  padding: 16px 12px;
  border-radius: 12px;
  background: var(--template-soft, #f0f3e9);
  border: 1px solid var(--template-border, #e4e9d9);
}
.content-columns .text-block.titled-block .block-heading {
  flex-direction: column;
}
.content-columns .block-order {
  font-size: 23px;
  margin-bottom: 4px;
}
.block-text {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.9;
  color: #51565a;
}
.card-content:not(.content-columns) > .text-block:first-child:not(.titled-block) .block-text {
  font-size: 15px;
  line-height: 2;
  color: var(--template-text, #3b4838);
}
</style>

<script setup lang="ts">
import type { CardBody } from '@/api/types'
import type { CardTemplateDefinition, TemplateCategory } from '@/utils/templates'
import { computed, ref, watch } from 'vue'
import { cardTemplateClass, cardTemplates, templateCategories, templateCoverStyle } from '@/utils/templates'
import TemplateDecoration from '@/components/TemplateDecoration.vue'

const props = defineProps<{ card: CardBody, disabled?: boolean }>()
const emit = defineEmits<{ select: [template: CardTemplateDefinition] }>()
const category = ref<'all' | TemplateCategory>('all')
const selected = computed(() => cardTemplates.find(template => template.id === (props.card.appearance?.template || 'signature'))!)
const filtered = computed(() => cardTemplates.filter(template => category.value === 'all' || template.category === category.value))
watch(selected, (template) => {
  if (category.value !== 'all' && template.category !== category.value)
    category.value = 'all'
})
function sample(card: CardBody, template: CardTemplateDefinition): CardBody {
  return { ...card, appearance: { ...card.appearance!, template: template.id, accentColor: template.accent } }
}
</script>

<template>
  <view class="template-library">
    <view class="template-filters mt-4 flex gap-1" role="group" aria-label="按风格筛选主题">
      <button v-for="item in templateCategories" :key="item.key" role="button" class="template-filter flex-1" :class="{ active: category === item.key }" :aria-label="`查看${item.label}主题`" :aria-pressed="category === item.key" @click="category = item.key">
        {{ item.label }}
      </button>
    </view>
    <view class="mt-3 flex items-center justify-between gap-2">
      <text class="muted">当前：{{ selected.name }}</text><text class="muted">{{ filtered.length }} 套可选</text>
    </view>
    <view class="template-picker">
      <button v-for="item in filtered" :key="item.id" role="button" class="template-option" :class="{ chosen: selected.id === item.id }" :aria-label="`应用${item.name}模板`" :aria-pressed="selected.id === item.id" :disabled="disabled" @click="emit('select', item)">
        <view class="template-poster" :class="[...cardTemplateClass(sample(card, item)), { 'brand-poster-thumbnail': item.id === 'poster' }]">
          <view class="poster-cover" :style="{ background: item.accent, ...templateCoverStyle(sample(card, item)) }">
            <TemplateDecoration :template="item.id" />
            <text class="poster-label">{{ item.name }}</text>
            <text class="poster-name">{{ card.name || '你的名字' }}</text>
            <view v-if="item.id === 'poster'" class="thumbnail-person i-carbon-user-avatar" />
          </view>
          <view class="poster-profile">
            <view class="poster-avatar" :class="`thumbnail-avatar-${item.avatarShape}`">
              {{ card.name.slice(0, 1) || '你' }}
            </view><view class="poster-lines">
              <view /><view />
            </view>
          </view>
        </view>
        <view class="option-caption flex items-center justify-between gap-2">
          <text>{{ item.name }}</text><view v-if="selected.id === item.id" class="i-carbon-checkmark-filled" />
        </view>
        <text class="option-usage">{{ item.usage }}</text>
        <text class="option-description">{{ item.description }}</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.template-filter {
  min-width: 0;
  min-height: 44px;
  padding: 10px 0;
  border: 1px solid var(--ui-line);
  border-radius: 9px;
  color: #626b5c;
  background: #f8f7f2;
  font-size: 12px;
  line-height: 1.8;
}
.template-filter.active {
  color: var(--ui-accent);
  border-color: #d7a082;
  background: #fbefe5;
}
.template-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.template-option {
  min-width: 0;
  padding: 7px;
  border: 2px solid #e9e7e0;
  border-radius: 15px;
  background: #fff;
  text-align: left;
  color: #34412f;
  line-height: 1.5;
}
.template-option.chosen {
  border-color: #c4512d;
  background: #fff9f4;
}
.template-poster {
  overflow: hidden;
  border-radius: 9px;
  border: 1px solid #0000000a;
}
.poster-cover {
  position: relative;
  overflow: hidden;
  height: 101px;
  padding: 14px 12px;
  color: white;
}
.poster-label {
  position: relative;
  display: block;
  font-size: 9px;
  letter-spacing: 1px;
  opacity: 0.85;
}
.poster-name {
  position: relative;
  display: block;
  margin-top: 12px;
  font-size: 21px;
  font-weight: 700;
  overflow-wrap: anywhere;
  line-height: 1.2;
}
.poster-profile {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 43px;
  padding: 6px 12px;
  background: var(--template-panel, #fafbf5);
}
.brand-poster-thumbnail .poster-name {
  max-width: 65%;
  font-size: 18px;
  color: #168e91;
}
.brand-poster-thumbnail .poster-label {
  color: #284b55;
}
.thumbnail-person {
  position: absolute;
  right: -5px;
  bottom: -16px;
  width: 83px;
  height: 94px;
  color: #168e9140;
}
.poster-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 2px solid var(--template-border, #d8ddcf);
  border-radius: 8px;
  background: var(--template-soft, #eef2e5);
  color: var(--template-text, #415437);
  font-size: 11px;
}
.poster-lines {
  flex: 1;
}
.thumbnail-avatar-circle {
  border-radius: 50%;
}
.thumbnail-avatar-square {
  border-radius: 3px;
}
.poster-lines > view {
  width: 70%;
  height: 3px;
  margin-bottom: 5px;
  background: var(--template-border, #d8ddcf);
  border-radius: 3px;
}
.poster-lines > view:last-child {
  width: 45%;
  margin-bottom: 0;
}
.option-caption {
  margin: 9px 3px 0;
  font-size: 13px;
  font-weight: 600;
}
.option-caption > view {
  color: #c4512d;
}
.option-description {
  display: block;
  margin: 4px 3px;
  color: #8a8e82;
  font-size: 10px;
  line-height: 1.6;
}
.option-usage {
  display: block;
  margin: 6px 3px 0;
  color: #626b5c;
  font-size: 10px;
  line-height: 1.6;
}
</style>

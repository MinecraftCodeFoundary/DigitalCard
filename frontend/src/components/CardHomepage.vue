<script setup lang="ts">
import type { CardBody } from '@/api/types'
import { computed, ref, watch } from 'vue'
import { defaultPages, pageIconClass } from '@/utils/pages'
import { themeColors } from '@/utils/appearance'
import { cardTemplateClass } from '@/utils/templates'
import CardPreview from './CardPreview.vue'
import CardSections from './CardSections.vue'

const props = defineProps<{ card: CardBody, mediaAccess?: Record<string, string>, interactive?: boolean, pageId?: string, back?: boolean }>()
const emit = defineEmits<{ exit: [] }>()
const pages = computed(() => props.card.pages ?? defaultPages())
const activeId = ref('')
watch(() => props.pageId, (id) => {
  activeId.value = id ?? ''
}, { immediate: true })
const activePage = computed(() => pages.value.find(page => page.id === activeId.value))
const color = computed(() => props.card.appearance?.accentColor || themeColors[props.card.theme])
function openPage(id: string) {
  activeId.value = id
  if (props.interactive)
    uni.pageScrollTo({ scrollTop: 0, duration: 0 })
}
</script>

<template>
  <view class="card-homepage" :class="cardTemplateClass(card)" :style="{ '--homepage-color': color }">
    <view v-if="!activePage" class="homepage-landing">
      <CardPreview :card="card" :media-access="mediaAccess" />
      <button v-if="back" role="button" class="homepage-exit" aria-label="返回" @click="emit('exit')">
        <view class="i-carbon-chevron-left" />
      </button>
      <view class="homepage-navigation">
        <button v-for="item in pages" :key="item.id" role="button" class="homepage-nav-item" :aria-label="`打开${item.title}`" @click="openPage(item.id)">
          <view class="homepage-nav-icon">
            <view :class="pageIconClass(item.icon)" />
          </view>
          <text>{{ item.title }}</text>
        </button>
      </view>
    </view>
    <view v-else class="homepage-detail">
      <view class="homepage-page-heading">
        <button role="button" class="homepage-back" aria-label="返回名片首页" @click="openPage('')">
          <view class="i-carbon-chevron-left" />
        </button>
        <text>{{ activePage.title }}</text>
        <view class="heading-spacer" />
      </view>
      <view class="homepage-page-body">
        <CardSections :card="card" :page-id="activePage.id" :media-access="mediaAccess" :interactive="interactive" hide-navigation />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.card-homepage {
  background: white;
  min-width: 0;
}
.homepage-landing {
  position: relative;
}
.homepage-exit,
.homepage-back {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  font-size: 22px;
}
.homepage-exit {
  position: absolute;
  top: calc(var(--card-status-inset, 0px) + 14px);
  left: 8px;
  z-index: 4;
  color: white;
}
.homepage-exit::after,
.homepage-nav-item::after,
.homepage-back::after {
  border: none;
}
.homepage-navigation {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px 8px;
  padding: 22px 12px 26px;
}
.homepage-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  color: #252e34;
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: anywhere;
  gap: 10px;
}
.homepage-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  color: white;
  background: var(--homepage-color);
  background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.3), transparent);
  font-size: 23px;
}
.homepage-page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 8px;
  padding-top: calc(var(--card-status-inset, 0px) + 12px);
  border-bottom: 1px solid #f2f3f5;
  color: #202b32;
  font-size: 15px;
  line-height: 1.6;
}
.homepage-page-heading > text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.heading-spacer {
  width: 40px;
  flex-shrink: 0;
}
.homepage-page-body {
  padding: 16px;
  min-height: 240px;
}
</style>

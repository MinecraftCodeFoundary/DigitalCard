<script setup lang="ts">
import type { CardBody } from '@/api/types'
import { computed, ref, watch } from 'vue'
import { mediaUrl } from '@/utils/media'
import { copyText } from '@/utils/card'
import { themeColors } from '@/utils/appearance'

const props = defineProps<{ card: CardBody, mediaAccess?: Record<string, string>, interactive?: boolean, compact?: boolean }>()
const appearance = computed(() => props.card.appearance!)
const accent = computed(() => appearance.value.accentColor || themeColors[props.card.theme])
const portrait = computed(() => appearance.value.coverImage || props.card.avatar)
const headlineUnits = computed(() => Math.max(1, ...appearance.value.coverTitle.split('\n').map(line =>
  Array.from(line).reduce((width, character) => width + (character.charCodeAt(0) <= 127 ? 0.55 : 1), 0))) + 0.4)
const imageFailed = ref(false)
const logoFailed = ref(false)
watch(portrait, () => imageFailed.value = false)
watch(() => appearance.value.brandLogo, () => logoFailed.value = false)
function call() {
  if (props.interactive && props.card.phone)
    uni.makePhoneCall({ phoneNumber: props.card.phone, fail: () => copyText(props.card.phone) })
}
</script>

<template>
  <view class="brand-poster-hero" :class="{ 'poster-compact': compact }" :style="{ '--poster-accent': accent, '--poster-tint': `${accent}20`, '--poster-headline-units': headlineUnits }">
    <view v-if="appearance.decoration" class="poster-hero-decoration" aria-hidden="true">
      <view class="hero-orbit orbit-one" /><view class="hero-orbit orbit-two" /><view class="hero-lines" />
    </view>
    <view class="poster-brand-row">
      <image v-if="appearance.brandLogo && !logoFailed" class="poster-brand-logo" :src="mediaUrl(appearance.brandLogo, mediaAccess)" mode="aspectFit" @error="logoFailed = true" />
      <text v-else class="poster-brand-name">{{ !appearance.hiddenFields.includes('company') && card.company ? card.company : card.name }}</text>
      <text class="poster-brand-label">{{ appearance.coverLabel }}</text>
    </view>
    <view class="poster-hero-body">
      <view class="poster-person" :class="{ 'avatar-portrait': !appearance.coverImage }">
        <image v-if="portrait && !imageFailed" class="poster-person-image" :src="mediaUrl(portrait, mediaAccess)" mode="aspectFit" :style="{ transform: `translateX(${appearance.posterPortraitX ?? 0}%) scale(${appearance.posterPortraitScale ?? 1})` }" aria-label="名片人物半身照" @error="imageFailed = true" />
        <view v-else class="poster-person-placeholder">
          <view class="i-carbon-user-avatar" /><text>{{ imageFailed ? '人物图片暂时无法显示' : '上传人物半身照' }}</text>
        </view>
      </view>
      <view class="poster-copy-shade" aria-hidden="true" />
      <view class="poster-hero-copy">
        <view class="poster-headline">
          <text v-for="(line, index) in appearance.coverTitle.split('\n')" :key="index" :class="{ 'headline-first': index === 0 && appearance.coverTitle.includes('\n') }">{{ line }}</text>
        </view>
        <view v-if="card.tags.length && !appearance.hiddenFields.includes('tags')" class="poster-expertise">
          {{ card.tags.join(' · ') }}
        </view>
        <view class="poster-accent-line" />
        <text class="poster-person-name">{{ card.name || '你的名字' }}</text>
        <text v-if="card.title && !appearance.hiddenFields.includes('title')" class="poster-person-title">{{ card.title }}</text>
        <button v-if="card.phone" role="button" class="poster-phone" :aria-label="`拨打电话 ${card.phone}`" @click="call">
          <view class="poster-phone-icon i-carbon-phone-filled" /><text>{{ card.phone }}</text>
        </button>
        <text v-if="card.location && !appearance.hiddenFields.includes('location')" class="poster-location">{{ card.location }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.brand-poster-hero {
  position: relative;
  overflow: hidden;
  background: #fff;
  color: #283a43;
}
.poster-brand-row {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 23px 20px 10px;
  min-height: 62px;
}
.poster-brand-logo {
  width: 125px;
  height: 40px;
  flex-shrink: 0;
}
.poster-brand-name {
  max-width: 58%;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.4;
  color: var(--poster-accent);
  overflow-wrap: anywhere;
}
.poster-brand-label {
  max-width: 38%;
  padding-top: 4px;
  font-size: 8px;
  line-height: 1.8;
  text-align: right;
  letter-spacing: 2px;
  overflow-wrap: anywhere;
  color: #708990;
}
.poster-brand-label::after {
  content: '';
  display: block;
  width: 24px;
  height: 2px;
  margin: 7px 0 0 auto;
  background: #a3b851;
}
.poster-hero-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.hero-orbit {
  position: absolute;
  width: 420px;
  height: 450px;
  right: -240px;
  top: -65px;
  transform: rotate(-25deg);
  border-radius: 48%;
  background: var(--poster-tint);
}
.orbit-two {
  right: -230px;
  top: 130px;
  background: var(--poster-accent);
  opacity: 0.13;
}
.hero-lines {
  position: absolute;
  top: 120px;
  right: -32px;
  width: 110px;
  height: 180px;
  border-radius: 40%;
  border: 1px solid #fff;
  background: repeating-linear-gradient(-12deg, transparent 0 16px, #ffffff80 16px 17px);
  transform: rotate(-12deg);
}
.poster-hero-body {
  position: relative;
}
.poster-person {
  position: absolute;
  z-index: 1;
  inset: 0 -10% 0 auto;
  width: 67%;
  overflow: hidden;
}
.poster-person-image {
  width: 100%;
  height: 100%;
  display: block;
  transform-origin: bottom center;
}
.poster-person.avatar-portrait {
  right: 0;
  width: 38%;
}
.poster-person-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: var(--poster-accent);
  background: linear-gradient(140deg, transparent, var(--poster-tint));
  padding-left: 15%;
}
.poster-person-placeholder > view {
  font-size: 130px;
  opacity: 0.22;
}
.poster-person-placeholder > text {
  font-size: 10px;
  opacity: 0.65;
}
.poster-copy-shade {
  position: absolute;
  z-index: 2;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(90deg, #ffffff 0%, #ffffffef 28%, #ffffff70 48%, transparent 65%);
}
.poster-hero-copy {
  position: relative;
  z-index: 3;
  width: 62%;
  min-height: 306px;
  padding: 18px 0 24px 20px;
  box-sizing: border-box;
}
.poster-headline {
  display: block;
  font-size: clamp(20px, calc((min(100vw, 480px) - 110px) * 0.62 / var(--poster-headline-units)), 31px);
  font-weight: 900;
  line-height: 1.3;
  letter-spacing: -0.5px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--poster-accent);
}
.poster-headline > text {
  display: block;
}
.poster-headline > .headline-first {
  color: #283a43;
}
.poster-expertise {
  margin-top: 10px;
  font-size: 10px;
  line-height: 1.8;
  color: #627982;
  overflow-wrap: anywhere;
}
.poster-accent-line {
  width: 27px;
  height: 3px;
  background: #a3b851;
  margin: 14px 0;
}
.poster-person-name {
  display: block;
  font-size: 27px;
  font-weight: 800;
  letter-spacing: 2px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.poster-person-title {
  display: block;
  font-size: 11px;
  line-height: 1.7;
  overflow-wrap: anywhere;
  color: #566b74;
}
.poster-phone {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  width: 100%;
  padding: 5px 0;
  margin: 0;
  text-align: left;
  color: #344952;
  background: transparent;
  font-size: 13px;
  line-height: 1.6;
  font-weight: 600;
}
.poster-phone::after {
  border: 0;
}
.poster-phone text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.poster-phone-icon {
  color: #a3b851;
  font-size: 18px;
  flex-shrink: 0;
}
.poster-location {
  display: block;
  font-size: 9px;
  color: #7a9097;
  overflow-wrap: anywhere;
}
.poster-compact .poster-brand-row {
  padding: 14px 14px 5px;
  min-height: 45px;
}
.poster-compact .poster-brand-name {
  font-size: 12px;
}
.poster-compact .poster-brand-logo {
  width: 85px;
  height: 28px;
}
.poster-compact .poster-hero-copy {
  min-height: 190px;
  padding: 10px 0 14px 14px;
}
.poster-compact .poster-headline {
  font-size: 22px;
}
.poster-compact .poster-person-name {
  font-size: 20px;
}
.poster-compact .poster-expertise,
.poster-compact .poster-location,
.poster-compact .poster-phone {
  display: none;
}
@media (max-width: 360px) {
  .poster-person-name {
    font-size: 24px;
  }
}
</style>

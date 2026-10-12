<script setup lang="ts">
import type { CardBody } from '@/api/types'
import { computed, ref, watch } from 'vue'
import { coverColors, defaultAppearance, themeColors } from '@/utils/appearance'
import { mediaUrl } from '@/utils/media'
import { cardTemplateClass, templateCoverStyle } from '@/utils/templates'
import TemplateDecoration from './TemplateDecoration.vue'
import BrandPosterHero from './BrandPosterHero.vue'

const props = defineProps<{ card: CardBody, compact?: boolean, dashboard?: boolean, mediaAccess?: Record<string, string>, interactive?: boolean }>()
const appearance = computed(() => props.card.appearance ?? defaultAppearance())
const accent = computed(() => appearance.value.accentColor || themeColors[props.card.theme])
const portraitImage = computed(() => appearance.value.coverImage ? mediaUrl(appearance.value.coverImage, props.mediaAccess) : props.card.avatar)
const imageFailed = ref(false)
watch(portraitImage, () => {
  imageFailed.value = false
})
const customColors = computed<{ background?: string, color?: string }>(() => /^#[a-f\d]{6}$/i.test(appearance.value.accentColor)
  ? coverColors(appearance.value.accentColor)
  : {})
const coverStyle = computed(() => ({ ...customColors.value, ...templateCoverStyle(props.card) }))
const tagColors = computed(() => /^#[a-f\d]{6}$/i.test(appearance.value.accentColor)
  ? { color: customColors.value.color === '#ffffff' ? appearance.value.accentColor : '#17251d', background: `${appearance.value.accentColor}12` }
  : {})
</script>

<template>
  <view class="identity-card" :style="{ '--card-accent': accent }" :class="[...cardTemplateClass(card), card.theme, appearance.layout, `avatar-${appearance.avatarShape}`, { compact, dashboard }]">
    <BrandPosterHero v-if="appearance.layout === 'poster'" :card="card" :media-access="mediaAccess" :interactive="interactive" :compact="compact || dashboard" />
    <view v-else-if="appearance.layout === 'portrait'" class="portrait-hero" :style="{ backgroundColor: appearance.accentColor || themeColors[card.theme] }">
      <view v-if="appearance.decoration" class="portrait-shapes">
        <view /><view />
      </view>
      <image v-if="portraitImage && !imageFailed" class="portrait-photo" :src="portraitImage" mode="aspectFill" @error="imageFailed = true" />
      <view v-else class="portrait-placeholder">
        <text>{{ card.name.slice(0, 1) || '你' }}</text>
      </view>
      <view class="portrait-shade" />
      <text v-if="imageFailed" class="portrait-image-hint">封面图片暂时无法显示</text>
      <view class="portrait-identity">
        <text class="card-name">{{ card.name || '你的名字' }}</text>
        <text v-if="appearance.coverLabel" class="portrait-label">{{ appearance.coverLabel }}</text>
        <view class="portrait-credentials">
          <text v-if="card.title && !appearance.hiddenFields.includes('title')" class="card-title">{{ card.title }}</text>
          <text v-if="card.company && !appearance.hiddenFields.includes('company')" class="card-company">{{ card.company }}</text>
          <text v-if="appearance.coverTitle && !compact" class="portrait-description">{{ appearance.coverTitle }}</text>
        </view>
      </view>
      <text v-if="appearance.wordmark" class="portrait-wordmark">{{ appearance.wordmark }}</text>
    </view>
    <template v-else>
      <view class="card-cover" :style="coverStyle">
        <view v-if="appearance.decoration && (!appearance.template || appearance.template === 'signature')" class="cover-rings">
          <view /><view /><view />
        </view>
        <view v-if="appearance.decoration && (!appearance.template || appearance.template === 'signature')" class="cover-art" aria-hidden="true">
          <view class="art-arch" /><view class="art-sphere" /><view class="art-grid" />
        </view>
        <TemplateDecoration v-if="appearance.decoration && appearance.template && appearance.template !== 'signature'" :template="appearance.template" />
        <view class="cover-top flex items-center justify-between gap-3">
          <text class="cover-label">{{ appearance.coverLabel }}</text><view class="cover-arrow flex shrink-0 items-center justify-center">
            <view class="i-carbon-arrow-up-right" />
          </view>
        </view>
        <view class="cover-bottom">
          <text class="cover-title">{{ appearance.coverTitle }}</text>
        </view>
        <text v-if="!compact && !dashboard && appearance.layout !== 'minimal' && appearance.wordmark" class="cover-signature">{{ appearance.wordmark }}</text>
      </view>
      <view class="card-content">
        <view class="identity-top flex items-start justify-between">
          <image v-if="card.avatar" :src="card.avatar" class="avatar" mode="aspectFill" />
          <view v-else class="avatar avatar-text">
            {{ card.name.slice(0, 1) || '你' }}
          </view>
          <view class="card-status">
            <view class="status-dot" /><text>{{ card.published ? '开放连接' : '仅自己可见' }}</text>
          </view>
        </view>
        <text v-if="!compact && !dashboard && appearance.layout !== 'minimal'" class="identity-greeting">你好，我是</text>
        <text class="card-name">{{ card.name || '你的名字' }}</text>
        <text v-if="!appearance.hiddenFields.includes('title')" class="card-title">{{ card.title || '你的职业与身份' }}</text>
        <text v-if="!appearance.hiddenFields.includes('company')" class="card-company">{{ card.company || '让大家认识你所在的公司' }}</text>
        <view v-if="card.tags.length && !appearance.hiddenFields.includes('tags')" class="card-tags mt-5 flex flex-wrap gap-2">
          <text v-for="tag in card.tags" :key="tag" class="tag" :style="(!appearance.template || appearance.template === 'signature') ? tagColors : {}">{{ tag }}</text>
        </view>
        <view v-if="!compact" class="card-divider" />
        <view v-if="!compact" class="card-bottom flex items-center justify-between">
          <view v-if="!appearance.hiddenFields.includes('location')" class="card-location flex items-center gap-2">
            <view class="i-carbon-location" /><text>
              {{
                card.location || '世界很大，很高兴遇见你'
              }}
            </text>
          </view><text class="card-wordmark">{{ appearance.wordmark }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.identity-card.portrait {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.portrait-hero {
  position: relative;
  aspect-ratio: 2 / 3;
  min-height: 430px;
  max-height: 720px;
  overflow: hidden;
  color: white;
}
.portrait-photo,
.portrait-shade,
.portrait-placeholder,
.portrait-shapes {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.portrait-photo {
  z-index: 1;
}
.portrait-shade {
  z-index: 2;
  background: linear-gradient(180deg, transparent 30%, rgba(8, 30, 52, 0.08) 50%, rgba(8, 30, 52, 0.8));
}
.portrait-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 180px;
  font-family: serif;
  color: rgba(255, 255, 255, 0.28);
}
.portrait-shapes view {
  position: absolute;
  border: 54px solid rgba(255, 255, 255, 0.09);
  width: 280px;
  height: 280px;
  border-radius: 50%;
  top: -100px;
  right: -150px;
}
.portrait-shapes view:last-child {
  border-radius: 0;
  top: 30%;
  right: auto;
  left: -180px;
}
.portrait-identity {
  position: absolute;
  z-index: 3;
  left: 0;
  right: 0;
  bottom: 46px;
}
.portrait .card-name {
  padding: 0 26px;
  margin-top: 0;
  font-size: 32px;
  letter-spacing: 1px;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.15);
}
.portrait-label {
  display: block;
  margin-top: 7px;
  padding: 6px 26px;
  background: linear-gradient(90deg, rgba(91, 199, 237, 0.48), transparent 90%);
  font-size: 11px;
  letter-spacing: 2px;
  overflow-wrap: anywhere;
}
.portrait-credentials {
  padding: 12px 26px 0;
}
.portrait .card-title,
.portrait .card-company,
.portrait-description {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.8;
  letter-spacing: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.portrait-wordmark {
  position: absolute;
  z-index: 3;
  right: 22px;
  bottom: 16px;
  font-size: 9px;
  letter-spacing: 2px;
  opacity: 0.7;
}
.portrait-image-hint {
  position: absolute;
  z-index: 3;
  top: 20px;
  left: 20px;
  font-size: 12px;
}
.portrait.compact .portrait-hero {
  aspect-ratio: 3 / 2;
  min-height: 180px;
  max-height: 240px;
}
.portrait.compact .card-name {
  font-size: 24px;
}
.portrait.compact .portrait-identity {
  bottom: 30px;
}
.identity-card {
  overflow: hidden;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e3e5dc;
  box-shadow: 0 12px 28px rgba(34, 40, 30, 0.045);
}
.card-cover {
  position: relative;
  padding: 28px 32px 48px;
  min-height: 216px;
  box-sizing: border-box;
  overflow: hidden;
  color: #f7f1df;
  background: #263e35;
}
.cover-title {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.cover-label {
  position: relative;
  font-size: 10px;
  letter-spacing: 2.5px;
  overflow-wrap: anywhere;
}
.cover-bottom {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 27px;
  font-size: 28px;
  font-weight: 400;
  line-height: 1.65;
  letter-spacing: 1px;
}
.cover-rings {
  position: absolute;
  width: 300px;
  height: 300px;
  right: -75px;
  top: -36px;
  transform: rotate(-25deg);
}
.cover-rings view {
  border: 1px solid rgba(230, 228, 201, 0.22);
  border-radius: 120px;
  position: absolute;
  width: 270px;
  height: 320px;
}
.cover-rings view:nth-child(2) {
  width: 210px;
  height: 260px;
  top: 30px;
  left: 30px;
}
.cover-rings view:nth-child(3) {
  width: 150px;
  height: 200px;
  top: 60px;
  left: 60px;
  background: rgba(230, 228, 201, 0.045);
}
.card-content {
  padding: 0 32px 24px;
}
.avatar {
  margin-top: -32px;
  width: 76px;
  height: 76px;
  border: 5px solid white;
  border-radius: 23px;
  position: relative;
  background: #f1e8d9;
}
.avatar-text {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-family: inherit;
  color: #795b43;
  box-sizing: border-box;
}
.card-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #6f7b69;
  margin-top: 18px;
  padding: 5px 9px;
  border: 1px solid #e8ece3;
  border-radius: 20px;
}
.status-dot {
  width: 5px;
  height: 5px;
  background: #719257;
  border-radius: 50%;
}
.card-name {
  display: block;
  font-size: 30px;
  font-weight: 600;
  margin-top: 20px;
  letter-spacing: 2px;
  overflow-wrap: anywhere;
}
.card-title {
  display: block;
  font-size: 14px;
  margin-top: 9px;
  color: #555e52;
  overflow-wrap: anywhere;
}
.card-company {
  display: block;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: #7d8376;
  margin-top: 8px;
  overflow-wrap: anywhere;
}
.tag {
  padding: 6px 11px;
  background: #f2f3ee;
  color: #636d59;
  border-radius: 6px;
  font-size: 11px;
}
.card-divider {
  height: 1px;
  background: #eeeee7;
  margin: 24px 0 18px;
}
.card-bottom {
  color: #7b8272;
  font-size: 11px;
  gap: 12px;
  flex-wrap: wrap;
}
.card-location {
  min-width: 0;
  overflow-wrap: anywhere;
}
.card-wordmark {
  letter-spacing: 2px;
  font-size: 9px;
  overflow-wrap: anywhere;
  margin-left: auto;
}
.sand .card-cover {
  background: #886347;
  color: #fff1df;
}
.sand .tag {
  background: #f8f1e6;
  color: #856a4e;
}
.ink .card-cover {
  background: #29384a;
  color: #e9eef8;
}
.ink .tag {
  background: #eef1f8;
  color: #5d6a81;
}
.compact .card-cover {
  min-height: 128px;
  padding: 20px 22px;
}
.compact .cover-bottom {
  font-size: 18px;
  margin-top: 10px;
}
.compact .card-content {
  padding: 0 22px 24px;
}
.avatar-circle .avatar {
  border-radius: 50%;
}
.avatar-square .avatar {
  border-radius: 4px;
}
.centered .identity-top {
  flex-direction: column;
  align-items: center;
}
.centered .card-content {
  text-align: center;
}
.centered .card-status {
  margin-top: 10px;
}
.centered .card-tags {
  justify-content: center;
}
.minimal .card-cover {
  min-height: 88px;
  padding: 18px 28px;
}
.minimal .cover-bottom {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: 1px;
}
.minimal .cover-rings {
  opacity: 0.4;
}
.minimal .avatar {
  margin-top: 18px;
}
.dashboard .card-cover {
  min-height: 118px;
  padding: 16px 22px 26px;
}
.dashboard .cover-bottom {
  font-size: 20px;
  line-height: 1.4;
  margin-top: 10px;
}
.dashboard .cover-label {
  font-size: 9px;
  letter-spacing: 1.5px;
}
.dashboard .card-content {
  padding: 0 22px 14px;
}
.dashboard .avatar {
  width: 60px;
  height: 60px;
  margin-top: -25px;
  border-radius: 19px;
  font-size: 25px;
}
.dashboard.avatar-circle .avatar {
  border-radius: 50%;
}
.dashboard.avatar-square .avatar {
  border-radius: 4px;
}
.dashboard .card-name {
  margin-top: 6px;
  font-size: 25px;
}
.dashboard .card-status {
  margin-top: 12px;
}
.dashboard .card-title {
  margin-top: 5px;
}
.dashboard .card-company {
  margin-top: 5px;
}
.dashboard .card-tags {
  margin-top: 12px;
}
.dashboard .card-divider {
  margin: 16px 0 12px;
}
.dashboard.minimal .card-cover {
  min-height: 82px;
  padding-bottom: 18px;
}
.dashboard.minimal .avatar {
  margin-top: 12px;
}
@media (max-width: 600px) {
  .card-cover {
    padding: 24px 24px 44px;
    min-height: 198px;
  }
  .cover-bottom {
    font-size: 25px;
    margin-top: 24px;
  }
  .cover-label {
    font-size: 9px;
    letter-spacing: 1.5px;
  }
  .card-content {
    padding: 0 24px 22px;
  }
  .card-name {
    font-size: 27px;
  }
  .cover-rings {
    right: -145px;
  }
}
.identity-card:not(.portrait) {
  border-radius: 24px;
  border-color: #e5e5d9;
  background: #fffdf8;
  box-shadow: 0 12px 36px #253b3010;
}
.cover-top {
  position: relative;
  z-index: 2;
}
.cover-arrow {
  width: 30px;
  height: 30px;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 18px;
  opacity: 0.8;
}
.cover-art {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.art-arch {
  position: absolute;
  right: -40px;
  top: 65px;
  width: 155px;
  height: 230px;
  border: 30px solid #e5e7c638;
  border-bottom: 0;
  border-radius: 90px 90px 0 0;
  transform: rotate(25deg);
}
.art-sphere {
  position: absolute;
  right: 62px;
  top: 72px;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 25%, #f9dfb2, #d79569);
  box-shadow: 8px 12px 22px #09291f30;
}
.art-grid {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 130px;
  height: 95px;
  opacity: 0.13;
  transform: skewY(-22deg);
  background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px);
  background-size: 20px 20px;
}
.card-cover {
  background-image: linear-gradient(115deg, #0000000e, #ffffff08);
}
.cover-rings {
  opacity: 0.45;
}
.identity-card:not(.compact):not(.dashboard):not(.minimal) .card-cover {
  min-height: 246px;
  padding: 24px 24px 46px;
}
.identity-card:not(.compact):not(.dashboard):not(.minimal) .cover-bottom {
  margin-top: 23px;
  max-width: var(--template-cover-width, 85%);
  font-size: var(--template-cover-size, 30px);
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 1px;
}
.cover-signature {
  display: block;
  position: relative;
  margin-top: 16px;
  font-size: 8px;
  letter-spacing: 2.3px;
  opacity: 0.5;
  overflow-wrap: anywhere;
}
.identity-card:not(.compact):not(.dashboard) .card-content {
  padding: 0 24px 22px;
}
.identity-card:not(.compact):not(.dashboard) .avatar {
  width: 80px;
  height: 80px;
  margin-top: -36px;
  border-color: #fffdf8;
  box-shadow: 0 5px 14px #233c3010;
}
.identity-greeting {
  display: block;
  margin-top: 14px;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: #89907f;
}
.identity-greeting + .card-name {
  margin-top: 5px;
  font-size: 32px;
  letter-spacing: 3px;
  line-height: 1.4;
}
.card-status {
  background: #f2f4eb;
  border-color: #e6eadc;
}
.tag {
  border: 1px solid #e3e8dc;
  border-radius: 20px;
  background: #f4f6ee;
  color: var(--card-accent);
  padding: 5px 12px;
}
.card-divider {
  margin: 20px 0 15px;
  background: linear-gradient(90deg, #cbd3be, #eee);
}
.card-wordmark {
  letter-spacing: 1.3px;
  font-size: 8px;
}
.compact .cover-art,
.dashboard .cover-art {
  opacity: 0.45;
}
.compact .art-arch,
.dashboard .art-arch {
  top: 20px;
  width: 100px;
  height: 160px;
  border-width: 22px;
}
.compact .art-sphere,
.dashboard .art-sphere {
  top: 40px;
  right: 44px;
  width: 25px;
  height: 25px;
}
.minimal .cover-art,
.minimal .cover-arrow {
  display: none;
}
.identity-card.minimal:not(.compact):not(.dashboard) .avatar {
  margin-top: 18px;
}
.centered .identity-greeting {
  margin-top: 16px;
}
</style>

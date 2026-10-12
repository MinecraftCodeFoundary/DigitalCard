<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  active?: 'home' | 'contacts' | 'stats'
  title?: string
  back?: boolean
  immersive?: boolean
}>()
const topPadding = ref<string>()
const capsulePadding = ref<string>()
const statusInset = ref<string>()
// #ifdef MP-WEIXIN
const { statusBarHeight, windowWidth } = uni.getWindowInfo()
const capsule = uni.getMenuButtonBoundingClientRect()
topPadding.value = `${Math.max(statusBarHeight, capsule.top + (capsule.height - 44) / 2)}px`
capsulePadding.value = `${Math.max(0, windowWidth - capsule.left - 8)}px`
statusInset.value = `${statusBarHeight}px`
// #endif
function navigate(url: string) {
  uni.reLaunch({ url })
}
function goBack() {
  if (getCurrentPages().length > 1)
    uni.navigateBack()
  else navigate('/pages/index/index')
}
const platform = uni
</script>

<template>
  <view class="app-shell" :class="{ 'with-nav': active, immersive }" :style="{ '--card-status-inset': immersive ? statusInset : undefined }">
    <view v-if="!immersive" class="app-top" :style="{ paddingTop: topPadding, paddingRight: capsulePadding }">
      <view v-if="back" class="back-line flex items-center gap-2">
        <button role="button" class="icon-button" aria-label="返回" @click="goBack">
          <view class="i-carbon-chevron-left" />
        </button>
        <text class="nav-title">{{ title }}</text>
      </view>
      <view
        v-else
        class="brand flex items-center gap-3"
        @click="navigate('/pages/index/index')"
      >
        <view class="brand-mark">
          <view /><view />
        </view>
        <view>
          <view class="flex items-baseline gap-2">
            <text class="brand-name">一面</text><text class="brand-caption">数字名片</text>
          </view>
        </view>
      </view>
      <view v-if="!back" class="top-actions flex items-center gap-2">
        <button
          role="button"
          class="icon-button"
          aria-label="我的账号"
          @click="platform.navigateTo({ url: '/pages-work/account/account' })"
        >
          <view class="i-carbon-user" />
        </button>
        <button
          role="button"
          class="icon-button"
          aria-label="设置"
          @click="platform.navigateTo({ url: '/pages-work/settings/settings' })"
        >
          <view class="i-carbon-settings" />
        </button>
      </view>
    </view>
    <view class="app-content">
      <slot />
    </view>
    <view v-if="active" class="bottom-nav">
      <view class="nav-inner">
        <button
          role="button"
          :class="{ selected: active === 'home' }"
          :aria-current="active === 'home' ? 'page' : undefined"
          @click="navigate('/pages/index/index')"
        >
          <view class="i-carbon-id-management" /><text>我的名片</text>
        </button>
        <button
          role="button"
          :class="{ selected: active === 'contacts' }"
          :aria-current="active === 'contacts' ? 'page' : undefined"
          @click="navigate('/pages/contacts/contacts')"
        >
          <view class="i-carbon-notebook" /><text>名片夹</text>
        </button>
        <button
          role="button"
          :class="{ selected: active === 'stats' }"
          :aria-current="active === 'stats' ? 'page' : undefined"
          @click="navigate('/pages/stats/stats')"
        >
          <view class="i-carbon-chart-column" /><text>数据概览</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-shell {
  position: relative;
  max-width: 480px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
  background: #f8f7f4;
}
.app-shell.immersive {
  padding: 0 0 calc(24px + env(safe-area-inset-bottom));
  background: white;
}
.with-nav {
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
}
.app-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  padding: calc(12px + env(safe-area-inset-top)) 0 12px;
  margin-bottom: 4px;
  gap: 8px;
}
.brand {
  min-width: 0;
  height: 44px;
}
.brand-mark {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #c4512d;
}
.brand-mark view {
  position: absolute;
  width: 13px;
  height: 18px;
  border: 1.5px solid #fff4e8;
  border-radius: 3px;
  top: 7px;
  left: 7px;
  transform: rotate(-9deg);
}
.brand-mark view + view {
  left: 11px;
  transform: rotate(9deg);
  background: #c4512d;
}
.brand-name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
  white-space: nowrap;
}
.brand-caption {
  font-size: 11px;
  color: #7a7e73;
  white-space: nowrap;
}
.top-actions {
  flex-shrink: 0;
}
.app-top .icon-button {
  border: 0;
  background: transparent;
  width: 44px;
  height: 44px;
}
.back-line {
  min-width: 0;
}
.nav-title {
  font-size: 17px;
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 480px;
  margin: 0 auto;
  background: #fff;
  border-top: 1px solid #eeece5;
  padding: 6px 12px calc(6px + env(safe-area-inset-bottom));
  z-index: 20;
}
.nav-inner {
  display: flex;
  gap: 8px;
}
.nav-inner button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  min-height: 54px;
  margin: 0;
  padding: 6px 4px;
  border-radius: 12px;
  background: transparent;
  color: #82877b;
  font-size: 11px;
  line-height: 1.5;
}
.nav-inner button view {
  font-size: 23px;
}
.nav-inner button.selected {
  color: #b24a29;
  font-weight: 600;
  background: #fcf2eb;
}
.nav-inner button::after {
  border: none;
}
/* #ifdef H5 */
@media (min-width: 481px) {
  .app-shell {
    border-left: 1px solid #e9e7df;
    border-right: 1px solid #e9e7df;
  }
}
/* #endif */
</style>

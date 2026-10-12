<script setup lang="ts">
import type { CardBody } from '@/api/types'
import { themeColors } from '@/utils/appearance'

defineProps<{ card: CardBody }>()
</script>

<template>
  <view class="brand-poster-footer" :style="{ '--poster-accent': card.appearance?.accentColor || themeColors[card.theme] }">
    <view v-if="card.appearance?.decoration" class="footer-waves" aria-hidden="true">
      <view /><view /><view />
    </view>
    <view class="footer-slogan">
      <view /><text>{{ card.appearance?.posterFooter ?? '连接专业，让合作发生' }}</text><view />
    </view>
    <text class="footer-signature">{{ card.appearance?.wordmark }}</text>
  </view>
</template>

<style scoped>
.brand-poster-footer {
  position: relative;
  overflow: hidden;
  min-height: 92px;
  padding: 30px 18px;
  text-align: center;
  background: white;
  color: #405c67;
}
.footer-waves {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.footer-waves > view {
  position: absolute;
  width: 140%;
  height: 70px;
  bottom: -43px;
  left: -25%;
  border-radius: 50%;
  background: var(--poster-accent);
  opacity: 0.1;
  transform: rotate(8deg);
}
.footer-waves > view:nth-child(2) {
  bottom: -39px;
  left: 5%;
  opacity: 0.14;
  transform: rotate(-8deg);
}
.footer-waves > view:nth-child(3) {
  top: -53px;
  bottom: auto;
  left: -15%;
  opacity: 0.06;
  transform: rotate(7deg);
}
.footer-slogan {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.footer-slogan text {
  max-width: 80%;
  font-size: 12px;
  letter-spacing: 2px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.footer-slogan > view {
  height: 1px;
  width: 23px;
  flex-shrink: 0;
  background: var(--poster-accent);
  opacity: 0.6;
}
.footer-signature {
  position: relative;
  display: block;
  margin-top: 8px;
  font-size: 8px;
  letter-spacing: 3px;
  line-height: 1.8;
  overflow-wrap: anywhere;
  color: #83969c;
}
</style>

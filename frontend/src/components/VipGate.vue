<script setup lang="ts">
withDefaults(defineProps<{ title?: string, description?: string }>(), {
  title: '用 VIP，展示更多可能',
  description: '解锁全部模板、图文视频、主页编排、私密留言与数据统计，名片夹容量提升至 50 张。',
})
function openAccount() {
  uni.navigateTo({ url: '/pages-work/account/account' })
}
</script>

<template>
  <view class="panel border border-[#e8d6b5] bg-[#fcf7ed]">
    <text class="eyebrow text-[#987139]">YIMIAN / VIP</text>
    <text class="section-title mt-2 block">{{ title }}</text>
    <text class="muted mt-3 block">{{ description }}</text>
    <button role="button" class="btn-secondary mt-5" @click="openAccount">
      查看 VIP 权益
    </button>
  </view>
</template>

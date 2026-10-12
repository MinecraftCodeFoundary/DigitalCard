<script setup lang="ts">
defineProps<{ loading?: boolean, error?: string, empty?: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <view class="page-state">
    <view v-if="loading" class="loading-ring" />
    <view v-else class="i-carbon-id-management state-icon" />
    <text class="state-title">{{ loading ? '正在准备你的名片…' : error || empty }}</text>
    <button v-if="error" role="button" class="btn-secondary mt-5" @click="$emit('retry')">
      重新加载
    </button>
  </view>
</template>

<style scoped lang="scss">
.page-state {
  min-height: 230px;
  padding: 35px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e6eae1;
  border-radius: 20px;
  text-align: center;
}
.state-icon {
  font-size: 36px;
  color: #a2b293;
  margin-bottom: 16px;
}
.state-title {
  font-size: 13px;
  color: #75816f;
  line-height: 1.8;
}
.loading-ring {
  width: 24px;
  height: 24px;
  border: 2px solid #e3e9d9;
  border-top-color: #34543e;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 18px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

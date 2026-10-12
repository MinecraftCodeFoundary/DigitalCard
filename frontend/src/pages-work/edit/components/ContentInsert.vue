<script setup lang="ts">
defineProps<{ disabled: boolean, position: string }>()
defineEmits<{ insert: [type: 'text' | 'image'] }>()
</script>

<template>
  <view class="content-insert flex items-center justify-center gap-2">
    <text class="muted text-xs">插入</text>
    <button role="button" class="insert-button" :aria-label="`${position}插入文字`" :disabled="disabled" @click="$emit('insert', 'text')">
      ＋ 文字
    </button>
    <button role="button" class="insert-button" :aria-label="`${position}插入图片`" :disabled="disabled" @click="$emit('insert', 'image')">
      ＋ 图片
    </button>
  </view>
</template>

<style scoped>
.content-insert {
  padding: 8px 0;
}
.insert-button {
  min-height: 44px;
  margin: 0;
  padding: 10px 12px;
  border: 1px dashed #d5d8cf;
  border-radius: 8px;
  background: white;
  color: #5e6656;
  font-size: 12px;
  line-height: 1.8;
}
.insert-button[disabled] {
  opacity: 0.4;
}
</style>

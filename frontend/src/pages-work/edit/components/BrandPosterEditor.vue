<script setup lang="ts">
import type { CardAppearance, MediaUpload } from '@/api/types'
import PortraitCoverEditor from './PortraitCoverEditor.vue'

defineProps<{ appearance: CardAppearance, mediaAccess: Record<string, string> }>()
const emit = defineEmits<{ update: [patch: Partial<CardAppearance>], uploaded: [media: MediaUpload], uploading: [busy: boolean] }>()
const activeUploads = new Set<'brandLogo' | 'coverImage'>()
function uploading(field: 'brandLogo' | 'coverImage', busy: boolean) {
  if (busy)
    activeUploads.add(field)
  else
    activeUploads.delete(field)
  emit('uploading', activeUploads.size > 0)
}
function update(patch: Partial<CardAppearance>) {
  emit('update', patch)
}
</script>

<template>
  <view class="poster-editor mt-4">
    <text class="text-sm font-bold">品牌海报设置</text>
    <text class="muted mt-2 block">宣传标题在左侧，人物在右侧；下方各页内容按顺序连成一张长海报。可在每页添加业务展示区和服务介绍区。</text>
    <PortraitCoverEditor :model-value="appearance.brandLogo" :media-access="mediaAccess" label="品牌 Logo" hint="建议使用透明背景的横版 Logo，最大 8 MB。留空时显示公司名称。" @update:model-value="update({ brandLogo: $event })" @uploaded="emit('uploaded', $event)" @uploading="uploading('brandLogo', $event)" />
    <PortraitCoverEditor :model-value="appearance.coverImage" :media-access="mediaAccess" label="海报人物图" hint="建议使用透明背景的竖版半身照，最大 8 MB。人物会放在标题右侧，留空时使用头像。" @update:model-value="update({ coverImage: $event })" @uploaded="emit('uploaded', $event)" @uploading="uploading('coverImage', $event)" />
    <view class="field">
      <text class="field-label">人物大小 · {{ Math.round((appearance.posterPortraitScale ?? 1) * 100) }}%</text><slider :min="70" :max="140" :value="Math.round((appearance.posterPortraitScale ?? 1) * 100)" active-color="#168e91" show-value @change="update({ posterPortraitScale: $event.detail.value / 100 })" />
    </view>
    <view class="field">
      <text class="field-label">人物左右位置</text><slider :min="-20" :max="20" :value="appearance.posterPortraitX ?? 0" active-color="#168e91" show-value @change="update({ posterPortraitX: $event.detail.value })" />
    </view>
    <view class="field">
      <text class="field-label">海报页脚口号</text><input class="field-input" :value="appearance.posterFooter ?? '连接专业，让合作发生'" :maxlength="60" placeholder="例如：链接品牌、产品、渠道与增长" @input="update({ posterFooter: $event.detail.value })">
    </view>
  </view>
</template>

<style scoped>
.poster-editor {
  padding: 16px;
  border: 1px solid #bcdcdf;
  background: #f2fafb;
  border-radius: 12px;
}
</style>

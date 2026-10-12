<script setup lang="ts">
import type { MediaUpload } from '@/api/types'
import { ref } from 'vue'
import { mediaApi } from '../../api/media'
import { ensureSession } from '@/hooks/useSession'
import { errorMessage } from '@/http'
import { mediaUrl } from '@/utils/media'

const props = defineProps<{ modelValue?: string, mediaAccess: Record<string, string>, label?: string, hint?: string }>()
const emit = defineEmits<{
  'update:modelValue': [url: string]
  'uploaded': [media: MediaUpload]
  'uploading': [busy: boolean]
}>()
const busy = ref(false)
const progress = ref(0)
const error = ref('')
async function upload() {
  if (busy.value)
    return
  busy.value = true
  emit('uploading', true)
  error.value = ''
  progress.value = 0
  try {
    const result = await uni.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album', 'camera'] })
    const paths = typeof result.tempFilePaths === 'string' ? [result.tempFilePaths] : result.tempFilePaths
    await ensureSession(true)
    const media = await mediaApi.upload(paths[0], value => progress.value = value)
    if (media.kind !== 'image')
      throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片')
    emit('uploaded', media)
    emit('update:modelValue', media.url)
  }
  catch (e) {
    if (!(e && typeof e === 'object' && 'errMsg' in e && String(e.errMsg).includes('cancel')))
      error.value = errorMessage(e)
  }
  finally {
    busy.value = false
    emit('uploading', false)
  }
}
</script>

<template>
  <view class="portrait-cover-editor field">
    <text class="field-label">{{ label || '主页人物封面' }}</text>
    <image v-if="modelValue" class="cover-thumbnail mt-3" :src="mediaUrl(modelValue, mediaAccess)" mode="aspectFill" />
    <view class="mt-3 flex gap-2">
      <button role="button" class="btn-secondary flex-1" :disabled="busy" @click="upload">
        {{ busy ? `上传中 ${progress}%` : label ? `上传${label}` : '上传人物封面' }}
      </button>
      <button v-if="modelValue" role="button" class="btn-secondary" :disabled="busy" @click="emit('update:modelValue', '')">
        移除封面
      </button>
    </view>
    <text class="muted mt-2 block">{{ hint || '建议使用竖版人物照片，最大 8 MB；姓名和介绍会覆盖在照片下部。留空时使用头像或主题背景。' }}</text>
    <input :value="modelValue || ''" class="field-input mt-3" placeholder="也可粘贴 http(s) 图片链接" :maxlength="2000" :disabled="busy" @input="emit('update:modelValue', $event.detail.value)">
    <text v-if="error" class="mt-2 block text-sm text-red-600">{{ error }}</text>
  </view>
</template>

<style scoped lang="scss">
.cover-thumbnail {
  display: block;
  width: 100%;
  height: 200px;
  border-radius: 12px;
}
</style>

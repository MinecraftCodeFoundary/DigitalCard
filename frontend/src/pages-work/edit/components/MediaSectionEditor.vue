<script setup lang="ts">
import type { CardSection, MediaUpload } from '@/api/types'
import { ref } from 'vue'
import SectionMedia from '@/components/SectionMedia.vue'
import { mediaApi } from '../../api/media'
import { ensureSession } from '@/hooks/useSession'
import { errorMessage } from '@/http'
import { mediaUrl, validMediaUrl } from '@/utils/media'

const props = defineProps<{ section: CardSection, mediaAccess: Record<string, string>, compact?: boolean, captionLabel?: string }>()
const emit = defineEmits<{
  update: [section: CardSection]
  uploaded: [media: MediaUpload]
  uploading: [busy: boolean]
}>()
const busy = ref(false)
const progress = ref(0)
const error = ref('')
const imageLink = ref('')
const showImageLink = ref(false)
function update(patch: Partial<CardSection>) {
  emit('update', { ...props.section, ...patch })
}
function removeImage(index: number) {
  update({ images: props.section.images?.filter((_, position) => position !== index) })
}
function moveImage(index: number, offset: number) {
  if (busy.value)
    return
  const images = [...(props.section.images || [])]
  const target = index + offset
  if (target < 0 || target >= images.length)
    return
  const [image] = images.splice(index, 1)
  images.splice(target, 0, image)
  update({ images })
}
function addImageLink() {
  if (!validMediaUrl(imageLink.value) || (props.section.images?.length || 0) >= 6)
    return
  update({ images: [...(props.section.images || []), imageLink.value] })
  imageLink.value = ''
}
async function uploadFiles(kind: 'image' | 'video' | 'poster') {
  if (busy.value)
    return
  busy.value = true
  emit('uploading', true)
  progress.value = 0
  error.value = ''
  try {
    let paths: string[]
    if (kind === 'video') {
      const result = await uni.chooseVideo({ sourceType: ['album', 'camera'], compressed: true })
      if (result.size > 50 * 1024 * 1024)
        throw new Error('视频最大 50 MB，请选择更小的视频')
      paths = [result.tempFilePath]
    }
    else {
      const result = await uni.chooseImage({ count: kind === 'poster' ? 1 : 6 - (props.section.images?.length || 0), sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      paths = typeof result.tempFilePaths === 'string' ? [result.tempFilePaths] : result.tempFilePaths
    }
    await ensureSession(true)
    const images = [...(props.section.images || [])]
    for (let index = 0; index < paths.length; index++) {
      const media = await mediaApi.upload(paths[index], (value) => {
        progress.value = Math.round((index * 100 + value) / paths.length)
      })
      if (media.kind !== (kind === 'video' ? 'video' : 'image'))
        throw new Error(kind === 'video' ? '请选择 MP4 或 WebM 视频' : '请选择图片文件')
      emit('uploaded', media)
      if (kind === 'image') {
        images.push(media.url)
        update({ images: [...images] })
      }
      else {
        update(kind === 'video' ? { url: media.url } : { poster: media.url })
      }
    }
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
  <view>
    <view v-if="section.type === 'image'" class="mt-4">
      <view class="grid grid-cols-2 gap-2">
        <view v-for="(url, index) in section.images" :key="`${index}-${url}`" class="image-editor-item">
          <image :src="mediaUrl(url, mediaAccess)" class="image-thumbnail" mode="aspectFill" />
          <view v-if="(section.images?.length || 0) > 1" class="mt-2 flex gap-1">
            <button role="button" class="module-action flex-1" :aria-label="`前移图片 ${index + 1}`" :disabled="busy || index === 0" @click="moveImage(index, -1)">
              前移
            </button>
            <button role="button" class="module-action flex-1" :aria-label="`后移图片 ${index + 1}`" :disabled="busy || index === (section.images?.length || 0) - 1" @click="moveImage(index, 1)">
              后移
            </button>
          </view>
          <button role="button" class="module-action mt-2 w-full" :aria-label="`删除图片 ${index + 1}`" :disabled="busy" @click="removeImage(index)">
            删除图片
          </button>
        </view>
      </view>
      <button role="button" class="module-action mt-3" :disabled="busy || (section.images?.length || 0) >= 6" @click="uploadFiles('image')">
        {{ busy ? `上传中 ${progress}%` : '上传图片' }}
      </button>
      <text class="muted mt-2 block">每个模块最多 6 张，每张最大 8 MB，支持 JPG、PNG、WebP、GIF。</text>
      <button v-if="compact" role="button" class="module-action mt-2" :aria-expanded="showImageLink" @click="showImageLink = !showImageLink">
        {{ showImageLink ? '收起图片链接' : '使用图片链接' }}
      </button>
      <view v-if="!compact || showImageLink" class="field">
        <text class="field-label">图片链接</text><input v-model="imageLink" class="field-input" placeholder="也可粘贴 http(s) 图片地址" :maxlength="2000">
        <button role="button" class="module-action mt-2" :disabled="busy || !validMediaUrl(imageLink) || (section.images?.length || 0) >= 6" @click="addImageLink">
          添加图片链接
        </button>
      </view>
      <view class="mt-3 flex gap-2">
        <button role="button" class="module-action flex-1" :aria-pressed="section.imageLayout !== 'stack'" @click="update({ imageLayout: 'grid' })">
          网格展示
        </button>
        <button role="button" class="module-action flex-1" :aria-pressed="section.imageLayout === 'stack'" @click="update({ imageLayout: 'stack' })">
          纵向展示
        </button>
      </view>
    </view>
    <view v-else-if="section.type === 'video'" class="mt-4">
      <button role="button" class="module-action" :disabled="busy" @click="uploadFiles('video')">
        {{ busy ? `上传中 ${progress}%` : section.url ? '更换视频' : '上传视频' }}
      </button>
      <text class="muted mt-2 block">最大 50 MB，支持 MP4、WebM；建议使用 MP4，兼容手机和小程序。也可填写可直接播放的视频地址。</text>
      <view class="field">
        <text class="field-label">视频地址</text><input :value="section.url || ''" class="field-input" placeholder="https://example.com/video.mp4" :maxlength="2000" :disabled="busy" @input="update({ url: $event.detail.value })">
      </view>
      <view class="mt-3 flex flex-wrap gap-2">
        <button role="button" class="module-action" :disabled="busy" @click="uploadFiles('poster')">
          {{ section.poster ? '更换视频封面' : '上传视频封面' }}
        </button>
        <button v-if="section.poster" role="button" class="module-action" :disabled="busy" @click="update({ poster: '' })">
          移除封面
        </button>
      </view>
      <SectionMedia :section="{ ...section, content: '' }" :media-access="mediaAccess" />
    </view>
    <view v-else-if="section.type === 'link'">
      <view class="field">
        <text class="field-label">链接地址</text><input :value="section.url || ''" class="field-input" placeholder="https://你的作品集或预约页面" :maxlength="2000" @input="update({ url: $event.detail.value })">
      </view>
      <view class="field">
        <text class="field-label">按钮文字</text><input :value="section.buttonLabel || ''" class="field-input" placeholder="例如：查看作品集 / 预约咨询" :maxlength="30" @input="update({ buttonLabel: $event.detail.value })">
      </view>
    </view>
    <view class="field">
      <text class="field-label">{{ captionLabel || (compact && section.type === 'image' ? '图片下方的说明（选填）' : '模块说明') }}</text><textarea :value="section.content" class="field-input field-textarea" placeholder="介绍图片、视频或链接的内容（选填）" :maxlength="1000" @input="update({ content: $event.detail.value })" />
    </view>
    <text v-if="error" class="upload-error mt-3 block">{{ error }}</text>
  </view>
</template>

<style scoped lang="scss">
.image-thumbnail {
  display: block;
  width: 100%;
  height: 110px;
  border-radius: 8px;
  background: var(--ui-line);
}
.module-action {
  min-height: 44px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--ui-line);
  background: white;
  color: #5e6656;
  font-size: 11px;
  line-height: 1.6;
}
.module-action[aria-pressed='true'] {
  background: #fbefe5;
  border-color: #d7a082;
}
.upload-error {
  color: #a25343;
  font-size: 12px;
}
</style>

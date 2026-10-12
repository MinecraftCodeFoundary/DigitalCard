<script setup lang="ts">
import type { CardSection } from '@/api/types'
import { ref, watch } from 'vue'
import { copyText } from '@/utils/card'
import { mediaUrl, validMediaUrl } from '@/utils/media'

const props = defineProps<{ section: CardSection, mediaAccess?: Record<string, string>, interactive?: boolean, plain?: boolean }>()
const failures = ref<string[]>([])
watch(() => [props.section.url, props.section.images, props.mediaAccess], () => {
  failures.value = []
})
function preview(index: number) {
  if (props.interactive)
    uni.previewImage({ current: index, urls: (props.section.images || []).map(url => mediaUrl(url, props.mediaAccess)) })
}
function openLink() {
  if (!props.interactive || !props.section.url)
    return
  // #ifdef H5
  window.open(props.section.url, '_blank', 'noopener,noreferrer')
  // #endif
  // #ifndef H5
  copyText(props.section.url, '链接已复制')
  // #endif
}
</script>

<template>
  <view class="section-media" :class="plain ? 'media-plain' : 'mt-4'">
    <view v-if="section.type === 'image'">
      <view v-if="section.images?.length" class="image-gallery" :class="{ 'gallery-grid': section.imageLayout !== 'stack' && section.images.length > 1 }">
        <view v-for="(url, index) in section.images" :key="`${index}-${url}`" class="gallery-item">
          <image class="gallery-image" :src="mediaUrl(url, mediaAccess)" mode="widthFix" :aria-label="`${section.title} 图片 ${index + 1}`" @click="preview(index)" @error="failures.push(url)" />
          <text v-if="failures.includes(url)" class="media-hint">图片加载失败，请检查图片地址。</text>
        </view>
      </view>
      <text v-else class="media-hint">添加图片后将在这里展示。</text>
    </view>
    <view v-else-if="section.type === 'video'">
      <video v-if="validMediaUrl(section.url)" class="section-video" :src="mediaUrl(section.url, mediaAccess)" :poster="section.poster ? mediaUrl(section.poster, mediaAccess) : ''" :controls="true" :autoplay="false" :show-center-play-btn="true" @error="failures.push(section.url)" />
      <text v-else class="media-hint">上传视频或填写视频地址后可预览播放。</text>
      <text v-if="failures.length" class="media-hint mt-2 block">视频加载失败，请检查地址或使用 MP4、WebM 视频。</text>
    </view>
    <view v-else-if="section.type === 'link'">
      <button role="button" class="btn-secondary w-full" :disabled="!validMediaUrl(section.url)" @click="openLink">
        {{ section.buttonLabel || '打开链接' }} <view class="i-carbon-arrow-up-right" />
      </button>
    </view>
    <text v-if="section.content" class="media-caption mt-3 block">{{ section.content }}</text>
  </view>
</template>

<style scoped lang="scss">
.media-plain .gallery-image,
.media-plain .section-video {
  border-radius: 0;
}
.media-plain .media-caption {
  color: #51565a;
  font-size: 14px;
  line-height: 1.9;
}
.image-gallery {
  display: grid;
  gap: 12px;
}
.gallery-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.gallery-item {
  min-width: 0;
}
.gallery-image {
  display: block;
  width: 100%;
  border-radius: 12px;
  background: #eff2e9;
}
.section-video {
  display: block;
  width: 100%;
  height: 210px;
  border-radius: 12px;
  background: #17251d;
}
.media-hint,
.media-caption {
  font-size: 12px;
  line-height: 1.8;
  color: #73816a;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>

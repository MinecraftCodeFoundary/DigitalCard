<script setup lang="ts">
import type { Card, QrResponse } from '@/api/types'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { ref } from 'vue'
import AppShell from '@/components/AppShell.vue'
import PageState from '@/components/PageState.vue'
import { cardApi } from '@/api/card'
import { useSessionStore } from '@/store/session'
import { errorMessage, showError } from '@/http'
import { copyText, sharePath, validCardId } from '@/utils/card'

definePage({ style: { navigationBarTitleText: '分享名片' } })

const session = useSessionStore()
const card = ref<Card>()
const qr = ref<QrResponse>()
const error = ref('')
const loading = ref(true)
let id = ''
async function load() {
  loading.value = true
  error.value = ''
  try {
    card.value = await cardApi.detail(id)
    if (!card.value.published)
      throw new Error('请先在编辑页开启名片公开')
    let mode: 'web' | 'wechat' = 'web'
    // #ifdef MP-WEIXIN
    if (import.meta.env.VITE_BACKEND_MODE === 'cloud' || session.mode === 'wechat')
      mode = 'wechat'
    // #endif
    qr.value = await cardApi.qr(id, mode)
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    loading.value = false
  }
}
async function saveQr() {
  if (!qr.value)
    return
  try {
    // #ifdef MP-WEIXIN
    const filePath = `${wx.env.USER_DATA_PATH}/yimian-${id}.png`
    await new Promise<void>((resolve, reject) => {
      uni
        .getFileSystemManager()
        .writeFile({
          filePath,
          data: qr.value!.image.split(',')[1],
          encoding: 'base64',
          success: () => resolve(),
          fail: reject,
        })
    })
    await uni.saveImageToPhotosAlbum({ filePath })
    uni.showToast({ title: '已保存到相册', icon: 'success' })
    // #endif
    // #ifdef H5
    const link = document.createElement('a')
    link.href = qr.value.image
    link.download = `${card.value?.name || '一面'}-名片码.png`
    link.click()
    // #endif
  }
  catch {
    showError(new Error('保存未完成，请允许相册访问后重试'))
  }
}
onLoad((options) => {
  if (!validCardId(options?.id)) {
    error.value = '名片链接不正确'
    loading.value = false
    return
  }
  id = options.id
  load()
})
onShareAppMessage(() =>
  card.value?.published
    ? { title: `${card.value.name}的名片 · 很高兴认识你`, path: sharePath(card.value) }
    : { title: '一面 · 数字名片', path: '/pages/index/index' },
)
</script>

<template>
  <AppShell back title="分享我的名片">
    <PageState v-if="loading || error" :loading="loading" :error="error" @retry="load" />
    <view v-else-if="card && qr" class="share-wrap">
      <text class="page-subtitle text-center">扫一扫，认识我</text>
      <view class="share-card mt-7">
        <view class="share-card-head">
          <text class="share-name">{{ card.name }}</text><text>{{ card.title }}</text><text class="share-company">{{ card.company }}</text>
        </view><view class="qr-box">
          <image :src="qr.image" class="qr-image" mode="aspectFit" /><text class="qr-caption">
            {{
              qr.mode === 'wechat' ? '微信扫一扫，认识我' : '扫码查看我的网页名片'
            }}
          </text>
        </view><view class="share-card-footer">
          <text>一面</text><text>让连接，自然发生</text>
        </view>
      </view>
      <view class="mobile-action-bar flex gap-3">
        <button role="button" class="btn-secondary flex-1" @click="saveQr">
          <view class="i-carbon-download" />保存名片码
        </button>
        <!-- #ifdef MP-WEIXIN -->
        <button role="button" class="btn-primary flex-1" open-type="share">
          <view class="i-carbon-chat" />分享给朋友
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <button role="button" class="btn-primary flex-1" @click="copyText(qr.url, '名片链接已复制')">
          <view class="i-carbon-link" />复制名片链接
        </button>
        <!-- #endif -->
      </view>
      <text class="muted mt-5 block text-center">
        名片信息更新后，分享链接与名片码持续有效。
      </text>
    </view>
  </AppShell>
</template>

<style scoped lang="scss">
.share-wrap {
  max-width: 420px;
  margin: 0 auto;
  padding-bottom: calc(84px + env(safe-area-inset-bottom));
}
.share-card {
  border: 1px solid #e6e2d8;
  border-radius: 18px;
  overflow: hidden;
  background: white;
  box-shadow: 0 15px 40px rgba(49, 68, 42, 0.07);
}
.share-card-head {
  background: #2d3c33;
  color: #fff5e4;
  padding: 26px 24px;
  text-align: center;
}
.share-card-head > text {
  display: block;
  font-size: 14px;
  margin-top: 8px;
}
.share-card-head .share-name {
  font-size: 28px;
  letter-spacing: 4px;
  margin-top: 0;
  font-weight: 600;
}
.share-card-head .share-company {
  font-size: 12px;
  color: #bbc4b5;
  letter-spacing: 1px;
}
.qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 20px;
}
.qr-image {
  width: 205px;
  height: 205px;
}
.qr-caption {
  display: block;
  margin-top: 13px;
  font-size: 12px;
  color: #737b69;
}
.share-card-footer {
  margin: 0 28px;
  border-top: 1px dashed #dddcd2;
  padding: 18px 0;
  display: flex;
  justify-content: space-between;
  color: #757e6b;
  font-size: 11px;
}
.share-card-footer text:first-child {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
}
@media (max-width: 550px) {
  .page-title {
    font-size: 24px;
  }
}
</style>

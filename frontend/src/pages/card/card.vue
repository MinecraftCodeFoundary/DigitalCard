<script setup lang="ts">
import type { Card } from '@/api/types'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppShell from '@/components/AppShell.vue'
import CardPreview from '@/components/CardPreview.vue'
import CardSections from '@/components/CardSections.vue'
import CardHomepage from '@/components/CardHomepage.vue'
import PageState from '@/components/PageState.vue'
import MessageBoard from '@/components/MessageBoard.vue'
import { cardApi } from '@/api/card'
import { ensureSession } from '@/hooks/useSession'
import { errorMessage, HttpError, showError } from '@/http'
import { sharePath, validCardId } from '@/utils/card'
import { coverColors, themeColors } from '@/utils/appearance'
import { cardTemplateClass } from '@/utils/templates'

definePage({ style: { navigationBarTitleText: '数字名片' } })

const card = ref<Card>()
const actionColors = computed(() => card.value
  ? coverColors(card.value.appearance?.accentColor || themeColors[card.value.theme])
  : {})
const loading = ref(true)
const saving = ref(false)
const error = ref('')
let id = ''
async function load() {
  error.value = ''
  loading.value = true
  try {
    try {
      card.value = await cardApi.detail(id)
    }
    catch (e) {
      if (!(e instanceof HttpError) || e.status !== 401)
        throw e
      card.value = await cardApi.detail(id)
    }
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    loading.value = false
  }
}
async function favorite() {
  if (!card.value || saving.value)
    return
  saving.value = true
  try {
    await ensureSession(true)
    const result = await cardApi.favorite(id, !card.value.isFavorite)
    card.value.isFavorite = result.saved
    uni.showToast({ title: result.saved ? '已加入名片夹' : '已取消收藏', icon: 'success' })
  }
  catch (e) {
    if (e instanceof HttpError && e.status === 401)
      uni.navigateTo({ url: '/pages-work/account/account' })
    else showError(e)
  }
  finally {
    saving.value = false
  }
}
function addContact() {
  if (!card.value)
    return
  const data = card.value
  // #ifdef MP-WEIXIN
  uni.addPhoneContact({
    firstName: data.name,
    mobilePhoneNumber: data.phone,
    email: data.email,
    organization: data.company,
    title: data.title,
    remark: data.bio,
    fail: () => uni.showToast({ title: '未保存联系人', icon: 'none' }),
  })
  // #endif
  // #ifdef H5
  const escape = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&')
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escape(data.name)}`,
    `N:${escape(data.name)};;;;`,
    `TEL:${escape(data.phone)}`,
    `EMAIL:${escape(data.email)}`,
    `ORG:${escape(data.company)}`,
    `TITLE:${escape(data.title)}`,
    'END:VCARD',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([vcard], { type: 'text/vcard;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${data.name}.vcf`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  // #endif
}
onLoad((options) => {
  let value = options?.id
  if (!value && options?.scene) {
    try {
      value = decodeURIComponent(options.scene)
    }
    catch {
      value = ''
    }
  }
  if (!validCardId(value)) {
    error.value = '名片链接不正确'
    loading.value = false
    return
  }
  id = value
  load()
})
onShareAppMessage(() =>
  card.value?.published
    ? { title: `${card.value.name}的名片 · 很高兴认识你`, path: sharePath(card.value) }
    : { title: '一面 · 数字名片', path: '/pages/index/index' },
)
const platform = uni
function exitHomepage() {
  if (getCurrentPages().length > 1)
    uni.navigateBack()
  else
    uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<template>
  <AppShell back title="很高兴认识你" :immersive="card?.appearance?.layout === 'portrait'">
    <PageState v-if="loading || error" :loading="loading" :error="error" @retry="load" />
    <view v-else-if="card" class="detail-grid" :class="[...cardTemplateClass(card), { 'portrait-detail': card.appearance?.layout === 'portrait' }]">
      <CardHomepage v-if="card.appearance?.layout === 'portrait'" :card="card" :media-access="card.mediaAccess" interactive back @exit="exitHomepage" />
      <view v-else>
        <CardPreview :card="card" :media-access="card.mediaAccess" interactive /><button v-if="card.appearance?.layout !== 'poster'" role="button" class="btn-secondary mt-4 w-full" @click="addContact">
          <view class="i-carbon-user-follow" />存入手机通讯录
        </button>
      </view>
      <view :class="{ 'portrait-actions': card.appearance?.layout === 'portrait' }">
        <CardSections v-if="card.appearance?.layout !== 'portrait'" :card="card" :media-access="card.mediaAccess" interactive />
        <button v-if="['portrait', 'poster'].includes(card.appearance?.layout || '')" role="button" class="btn-secondary w-full" @click="addContact">
          <view class="i-carbon-user-follow" />存入手机通讯录
        </button>
        <button
          v-if="!card.isOwner"
          role="button"
          class="btn-primary mt-5 w-full"
          :style="actionColors"
          :disabled="saving"
          @click="favorite"
        >
          <view :class="card.isFavorite ? 'i-carbon-bookmark-filled' : 'i-carbon-bookmark'" />{{
            card.isFavorite ? '已收藏 · 点击取消' : '收藏这张名片'
          }}
        </button>
        <button
          v-else
          role="button"
          class="btn-primary mt-5 w-full"
          :style="actionColors"
          @click="platform.navigateTo({ url: '/pages-work/edit/edit' })"
        >
          <view class="i-carbon-edit" />编辑我的名片
        </button>
        <MessageBoard v-if="card.isVip" :card="card" class="mt-5" />
      </view>
    </view>
  </AppShell>
</template>

<style scoped lang="scss">
.detail-grid.portrait-detail {
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}
.portrait-actions {
  padding: 0 16px 16px;
}
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}
@media (max-width: 650px) {
  .detail-grid {
    grid-template-columns: 1fr;
    gap: 22px;
  }
}
</style>

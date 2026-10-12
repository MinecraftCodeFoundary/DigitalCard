<script setup lang="ts">
import type { Card } from '@/api/types'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { nextTick, ref } from 'vue'
import AppShell from '@/components/AppShell.vue'
import PageState from '@/components/PageState.vue'
import { cardApi } from '@/api/card'
import { accountApi } from '@/api/account'
import { ensureSession } from '@/hooks/useSession'
import { errorMessage } from '@/http'
import { validCardId } from '@/utils/card'

definePage({ style: { navigationBarTitleText: '名片夹' } })

interface Paging {
  reload: () => void
  complete: (data: Card[] | false) => void
  pageReachBottom: () => void
}
const paging = ref<Paging>()
const cards = ref<Card[]>([])
const unavailableIds = ref<string[]>([])
const removingId = ref('')
const search = ref('')
const total = ref(0)
const error = ref('')
const loading = ref(true)
const membershipLoaded = ref(false)
const isVip = ref(false)
let pending: Promise<void> | undefined
function loadMembership(): Promise<void> {
  if (pending)
    return pending
  pending = (async () => {
    loading.value = true
    error.value = ''
    membershipLoaded.value = false
    isVip.value = false
    cards.value = []
    unavailableIds.value = []
    total.value = 0
    try {
      await ensureSession()
      isVip.value = (await accountApi.mine()).membership.isVip
      membershipLoaded.value = true
    }
    catch (e) { error.value = errorMessage(e) }
    finally { loading.value = false }
    await nextTick()
    if (membershipLoaded.value)
      reload()
  })().finally(() => { pending = undefined })
  return pending
}
async function query(page: number, pageSize: number) {
  error.value = ''
  try {
    await ensureSession()
    const result = await cardApi.favorites(page, pageSize, search.value.trim())
    total.value = result.total
    unavailableIds.value = result.unavailableIds ?? []
    paging.value?.complete(result.items)
  }
  catch (e) {
    paging.value?.complete(false)
    error.value = errorMessage(e)
  }
}
function reload() {
  paging.value?.reload()
}
async function removeUnavailable(id: string) {
  if (removingId.value)
    return
  removingId.value = id
  error.value = ''
  try {
    await ensureSession()
    await cardApi.favorite(id, false)
    unavailableIds.value = unavailableIds.value.filter(item => item !== id)
    uni.showToast({ title: '已取消收藏', icon: 'success' })
    reload()
  }
  catch (e) { error.value = errorMessage(e) }
  finally { removingId.value = '' }
}
function scan() {
  // #ifdef MP-WEIXIN
  uni.scanCode({
    success(result) {
      const match = /(?:id=|scene=)([a-f\d]{24}|sample-(?:chen|su|zhou))/.exec(
        result.path || result.result,
      )
      if (match && validCardId(match[1]))
        uni.navigateTo({ url: `/pages/card/card?id=${match[1]}` })
      else uni.showToast({ title: '请扫描一面名片二维码', icon: 'none' })
    },
  })
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '请在微信小程序中使用扫码功能', icon: 'none' })
  // #endif
}
onShow(loadMembership)
onReachBottom(() => paging.value?.pageReachBottom())
const platform = uni
</script>

<template>
  <AppShell active="contacts">
    <view class="flex items-center justify-between">
      <text class="page-title">名片夹</text><button role="button" class="icon-button" aria-label="扫描名片" @click="scan">
        <view class="i-carbon-scan" />
      </button>
    </view>
    <text class="page-subtitle">把每一次相遇，好好收藏。</text>
    <PageState v-if="loading || !membershipLoaded" class="mt-7" :loading="loading" :error="error" @retry="loadMembership" />
    <template v-else>
      <text class="muted mt-3 block">{{ isVip ? 'VIP 最多收藏 50 张名片。' : '普通用户最多收藏 10 张名片，VIP 最多 50 张。' }}</text>
      <view class="search-box mt-5 flex items-center gap-3">
        <view class="i-carbon-search" /><input
          v-model="search"
          class="flex-1"
          placeholder="搜索姓名、公司或专业领域"
          confirm-type="search"
          @confirm="reload"
        ><button role="button" class="text-link" @click="reload">
          搜索
        </button>
      </view>
      <view class="mb-5 mt-7 flex items-center justify-between">
        <text class="section-title">
          我的名片夹 <text class="count">{{ total }}</text>
        </text><text class="muted">按收藏时间排列</text>
      </view>
      <PageState v-if="error" :error="error" @retry="reload" />
      <view v-if="unavailableIds.length" class="mb-5 rounded-xl bg-[#f3f2ee] p-4">
        <text class="muted block">另有 {{ unavailableIds.length }} 张名片暂不可用，仍占收藏名额。</text>
        <view v-for="(id, index) in unavailableIds" :key="id" class="unavailable-contact mt-3 flex items-center justify-between gap-3">
          <text class="muted">暂不可用的名片 {{ index + 1 }}</text>
          <button role="button" class="text-link" :disabled="!!removingId" @click="removeUnavailable(id)">
            {{ removingId === id ? '正在取消…' : '取消收藏' }}
          </button>
        </view>
      </view>
      <z-paging
        ref="paging"
        v-model="cards"
        :use-page-scroll="true"
        :auto="false"
        :refresher-enabled="false"
        :hide-empty-view="!!error"
        :empty-view-text="unavailableIds.length ? '暂无可查看的名片' : '还没有收藏名片，下一次相遇从扫码开始'"
        @query="query"
      >
        <view class="contact-grid">
          <view
            v-for="card in cards"
            :key="card.id"
            class="contact-card"
            @click="platform.navigateTo({ url: `/pages/card/card?id=${card.id}` })"
          >
            <view class="flex items-center gap-4">
              <image
                v-if="card.avatar"
                :src="card.avatar"
                class="contact-avatar"
                mode="aspectFill"
              /><view v-else class="contact-avatar" :class="card.theme">
                {{ card.name.slice(0, 1) }}
              </view><view class="flex-1">
                <text class="contact-name">{{ card.name }}</text><text class="contact-role">{{ card.title }}</text>
              </view><view class="i-carbon-arrow-up-right text-lg text-gray-400" />
            </view>
            <text class="contact-company">{{ card.company || '独立从业者' }}</text>
            <view class="mt-4 flex flex-wrap gap-2">
              <text v-for="tag in card.tags" :key="tag" class="small-tag">{{ tag }}</text>
            </view>
            <view class="contact-location mt-5 flex items-center gap-1">
              <view class="i-carbon-location" /><text>{{ card.location || '期待与你相遇' }}</text>
            </view>
          </view>
        </view>
      </z-paging>
      <view class="connection-note mt-7">
        <view class="i-carbon-connect text-xl" /><text>人脉的价值，从一次真诚的连接开始。</text>
      </view>
    </template>
  </AppShell>
</template>

<style scoped lang="scss">
.search-box {
  background: white;
  border: 1px solid var(--ui-line);
  border-radius: 12px;
  padding: 4px 14px;
  color: #7b8074;
  max-width: 640px;
}
.search-box input {
  font-size: 14px;
  min-width: 0;
}
.count {
  font-size: 10px;
  margin-left: 5px;
  background: #f1e5da;
  padding: 4px 8px;
  border-radius: 5px;
  color: #9b603b;
}
.contact-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.contact-card {
  padding: 20px;
  background: white;
  border: 1px solid var(--ui-line);
  border-radius: 16px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  min-width: 0;
  overflow-wrap: anywhere;
}
.contact-card:hover {
  border-color: #cbb8a5;
  box-shadow: 0 8px 24px #48371d09;
}
.contact-avatar {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  border-radius: 17px;
  color: #4e6a41;
  background: #e8eddc;
  font-size: 21px;
  font-family: inherit;
}
.contact-avatar.sand {
  background: #f3eadc;
  color: #8a674b;
}
.contact-avatar.ink {
  background: #e7ebf3;
  color: #4c607d;
}
.contact-name {
  display: block;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 1px;
}
.contact-role {
  display: block;
  font-size: 12px;
  margin-top: 6px;
  color: var(--ui-muted);
}
.contact-company {
  display: block;
  font-size: 13px;
  margin-top: 23px;
}
.contact-location {
  font-size: 11px;
  color: #7b8074;
  border-top: 1px solid var(--ui-line);
  padding-top: 18px;
}
.connection-note {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: var(--ui-muted);
  font-size: 12px;
}
@media (max-width: 550px) {
  .contact-grid {
    grid-template-columns: 1fr;
  }
  .page-title {
    font-size: 24px;
  }
}
</style>

<script setup lang="ts">
import type { AccountProfile } from '@/api/types'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppShell from '@/components/AppShell.vue'
import { accountApi } from '@/api/account'
import { ensureSession } from '@/hooks/useSession'
import { errorMessage, HttpError } from '@/http'
import { useSessionStore } from '@/store/session'
import { membershipExpiry, membershipLabel } from './membership'

definePage({ style: { navigationBarTitleText: '我的账号' } })

const session = useSessionStore()
const profile = ref<AccountProfile>()
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const loggedIn = computed(() => !!session.token && session.expiresAt > Date.now())

async function load() {
  if (loading.value)
    return
  profile.value = undefined
  error.value = ''
  if (!loggedIn.value)
    return
  loading.value = true
  try {
    profile.value = await accountApi.mine()
    session.mode = profile.value.mode
  }
  catch (e) { error.value = errorMessage(e) }
  finally { loading.value = false }
}
async function logout() {
  if (busy.value)
    return
  busy.value = true
  error.value = ''
  try {
    await accountApi.logout()
    session.logout()
    profile.value = undefined
  }
  catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      session.logout()
      profile.value = undefined
    }
    else { error.value = errorMessage(e) }
  }
  finally { busy.value = false }
}
async function wechatLogin() {
  if (busy.value)
    return
  busy.value = true
  error.value = ''
  try {
    await ensureSession(true)
    uni.reLaunch({ url: '/pages/index/index' })
  }
  catch (e) { error.value = errorMessage(e) }
  finally { busy.value = false }
}
onShow(load)
const platform = uni
function copyAccountId() {
  if (profile.value)
    uni.setClipboardData({ data: profile.value.id })
}
</script>

<template>
  <AppShell back title="我的账号">
    <view class="panel mt-4">
      <text class="eyebrow">YIMIAN / ACCOUNT</text>
      <template v-if="loading">
        <text class="muted">正在读取账号…</text>
      </template>
      <template v-else-if="loggedIn && !profile">
        <text class="page-title">我的账号</text>
        <button role="button" class="btn-secondary mt-6" :disabled="busy" @click="load">
          重新加载账号
        </button>
      </template>
      <template v-else-if="loggedIn && profile">
        <text class="page-title">{{ profile.mode === 'wechat' ? '微信账号' : '开发测试账号' }}</text>
        <text class="page-subtitle">使用同一个微信登录，即可继续管理你的名片和收藏。</text>
        <view class="mt-6 rounded-xl bg-[#f3f2ee] p-4">
          <text class="muted block">账号编号</text>
          <text class="mt-1 block break-all text-xs">{{ profile.id }}</text>
          <button role="button" class="text-link mt-3" @click="copyAccountId">
            复制账号编号
          </button>
          <text class="muted mt-3 block">创建日期 · {{ profile.createdAt.slice(0, 10) }}</text>
        </view>
        <view class="mt-5 border border-[#e8d6b5] rounded-xl bg-[#fcf7ed] p-5">
          <view class="flex items-center justify-between gap-3">
            <text class="section-title">{{ membershipLabel(profile.membership) }}</text>
            <text class="small-tag">{{ profile.membership.isVip ? '全部功能已解锁' : '基础简易名片' }}</text>
          </view>
          <text class="muted mt-3 block">{{ membershipExpiry(profile.membership) }}</text>
          <view class="mt-5 border-t border-[#e8d6b5] pt-4 text-sm leading-7">
            <text class="block">免费版 · 基础资料、头像、联系方式、简约名片与分享，名片夹可收藏 10 张名片</text>
            <text class="mt-2 block">VIP · 全部模板与样式、图文视频、多页面编排、50 张名片收藏、私密留言与数据统计</text>
          </view>
          <text v-if="!profile.membership.isVip" class="muted mt-4 block">如需开通或续期，请将账号编号提供给管理员。开通后点击下方按钮刷新状态。</text>
          <text class="muted mt-3 block">会员到期后使用基础简易名片，高级内容会保留，重新开通后恢复。</text>
          <text class="muted mt-3 block">名片夹普通用户上限 10 张，VIP 上限 50 张。到期后已有收藏保留，达到上限时需先取消收藏再添加。</text>
          <button role="button" class="btn-secondary mt-5" :disabled="loading || busy" @click="load">
            刷新会员状态
          </button>
        </view>
        <button role="button" class="btn-primary mt-6" :disabled="busy" @click="platform.reLaunch({ url: '/pages/index/index' })">
          返回我的名片
        </button>
        <button role="button" class="text-link mt-3 w-full" :disabled="busy" @click="logout">
          {{ busy ? '正在退出…' : '退出登录' }}
        </button>
      </template>
      <template v-else>
        <text class="page-title">用微信，开启你的名片</text>
        <text class="page-subtitle">一张名片，让每一次连接都有你的名字。</text>
        <view class="mt-6 rounded-xl bg-[#f3f2ee] p-4">
          <text class="block text-sm">首次使用微信将自动注册，并创建一张仅自己可见的名片。</text>
          <text class="muted mt-3 block">已有账号可直接登录，名片与收藏会自动恢复。</text>
        </view>
        <button role="button" class="btn-primary mt-6" :disabled="busy" @click="wechatLogin">
          {{ busy ? '正在连接微信…' : '微信直接登录' }}
        </button>
        <button role="button" class="btn-secondary mt-3 w-full" :disabled="busy" @click="wechatLogin">
          微信直接注册
        </button>
        <!-- #ifndef MP-WEIXIN -->
        <text class="muted mt-4 block text-center">请在微信小程序中使用微信注册或登录</text>
        <!-- #endif -->
      </template>
      <text v-if="error" class="mt-4 block text-sm text-red-700" role="alert">{{ error }}</text>
    </view>
    <text class="muted mt-5 block text-center">名片资料和收藏保存在账号中，退出登录后仍会保留。</text>
  </AppShell>
</template>

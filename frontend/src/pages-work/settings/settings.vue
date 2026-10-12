<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
import { useSessionStore } from '@/store/session'
import { accountApi } from '@/api/account'
import { HttpError, showError } from '@/http'
import { ref } from 'vue'

definePage({ style: { navigationBarTitleText: '设置' } })

const session = useSessionStore()
const busy = ref(false)
function logout() {
  if (busy.value)
    return
  uni.showModal({
    title: '退出当前登录？',
    content: '名片和收藏会保留。再次登录后即可继续管理。',
    async success(result) {
      if (result.confirm) {
        busy.value = true
        try {
          await accountApi.logout()
          session.logout()
          uni.reLaunch({ url: '/pages-work/account/account' })
        }
        catch (e) {
          if (e instanceof HttpError && e.status === 401) {
            session.logout()
            uni.reLaunch({ url: '/pages-work/account/account' })
          }
          else { showError(e) }
        }
        finally { busy.value = false }
      }
    },
  })
}
const platform = uni
</script>

<template>
  <AppShell back title="设置与关于">
    <view class="settings-wrap">
      <view class="panel">
        <text class="eyebrow">YIMIAN / 一面</text><text class="page-title">让连接，自然发生。</text><text class="page-subtitle">一张数字名片，承载你的专业、个性和下一种可能。</text><text class="muted mt-5 block">版本 1.0.0</text>
      </view>
      <view class="panel mt-5">
        <text class="section-title">账号与名片</text><view class="setting-row">
          <text>当前登录方式</text><text class="muted">
            {{
              session.token ? (session.mode === 'wechat' ? '微信账号' : '开发测试账号') : '未登录'
            }}
          </text>
        </view><view class="setting-row" @click="platform.navigateTo({ url: '/pages-work/account/account' })">
          <text>{{ session.token ? '账号管理' : '微信登录 / 注册' }}</text><view class="i-carbon-chevron-right" />
        </view><view class="setting-row" @click="platform.navigateTo({ url: '/pages-work/account/account' })">
          <text>VIP 会员与权益</text><view class="i-carbon-chevron-right" />
        </view><view class="setting-row" @click="platform.navigateTo({ url: '/pages-work/edit/edit' })">
          <text>编辑资料与公开状态</text><view class="i-carbon-chevron-right" />
        </view><button v-if="session.token" role="button" class="text-link mt-5" :disabled="busy" @click="logout">
          退出登录
        </button>
      </view>
      <view class="panel mt-5">
        <text class="section-title">你的信息，由你决定</text><text class="muted mt-4 block">
          公开名片中的姓名、公司、简介和联系方式可被持有链接的人查看。你可以随时编辑，或关闭公开状态。
        </text><text class="muted mt-3 block">
          收藏的名片仅供你自己查看。数据概览展示匿名访问数量，不提供访客的手机号或微信身份。
        </text>
      </view>
    </view>
  </AppShell>
</template>

<style scoped lang="scss">
.settings-wrap {
  max-width: 620px;
  margin: 0 auto;
}
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
  font-size: 12px;
  border-bottom: 1px solid var(--ui-line);
}
</style>

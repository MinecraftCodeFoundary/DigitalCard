<script setup lang="ts">
import { onPullDownRefresh, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { computed } from 'vue'
import AppShell from '@/components/AppShell.vue'
import CardPreview from '@/components/CardPreview.vue'
import CardSections from '@/components/CardSections.vue'
import CardHomepage from '@/components/CardHomepage.vue'
import PageState from '@/components/PageState.vue'
import MessageBoard from '@/components/MessageBoard.vue'
import VipGate from '@/components/VipGate.vue'
import { useHomeCard } from '@/hooks/useHomeCard'
import { showError } from '@/http'
import { completeness, sharePath } from '@/utils/card'

definePage({
  type: 'home',
  style: { navigationBarTitleText: '我的名片', enablePullDownRefresh: true },
})

const { card, stats, loading, error, statsError, needsLogin, load } = useHomeCard()
const progress = computed(() => (card.value ? completeness(card.value) : 0))
function edit() {
  uni.navigateTo({ url: '/pages-work/edit/edit' })
}
function share() {
  if (!card.value?.published) {
    showError(new Error('请在编辑页开启名片公开后分享'))
    return
  }
  uni.navigateTo({ url: `/pages-work/share/share?id=${card.value.id}` })
}
onShow(() => load())
onPullDownRefresh(() => load())
onShareAppMessage(() =>
  card.value?.published
    ? { title: `${card.value.name}的名片 · 很高兴认识你`, path: sharePath(card.value) }
    : { title: '一面 · 让连接自然发生', path: '/pages/index/index' },
)
const platform = uni
</script>

<template>
  <AppShell active="home">
    <view class="page-heading flex items-center justify-between">
      <view>
        <text class="page-title">我的名片</text><text class="page-subtitle">很高兴，与你相遇。</text>
      </view>
      <view v-if="card" class="heading-status flex items-center gap-2">
        <view class="status-dot" :class="{ private: !card.published }" />
        <text>{{ card.published ? '已公开' : '仅自己可见' }}</text>
      </view>
    </view>
    <view v-if="needsLogin" class="panel mt-8">
      <text class="section-title">让每一次相遇都有你的名字</text><text class="page-subtitle">使用微信登录，即可创建、编辑和分享自己的商务名片。</text>
      <button role="button" class="btn-primary mt-6" @click="platform.navigateTo({ url: '/pages-work/account/account' })">
        微信登录 / 注册 <view class="i-carbon-arrow-right" />
      </button>
    </view>
    <PageState
      v-else-if="loading || error"
      class="mt-8"
      :loading="loading"
      :error="error"
      @retry="load()"
    />
    <view v-else-if="card" class="home-grid">
      <view class="identity-column">
        <view v-if="card.mediaUnavailable" class="panel mb-4">
          <text>图片暂时无法加载，名片资料正常。</text><button class="text-link" @click="load()">
            重新加载
          </button>
        </view>
        <CardHomepage v-if="card.appearance?.layout === 'portrait'" :card="card" :media-access="card.mediaAccess" interactive />
        <template v-else>
          <CardPreview :card="card" dashboard />
        </template>
        <view class="card-actions mt-4 flex gap-3">
          <button role="button" class="btn-secondary flex-1" @click="edit">
            <view class="i-carbon-edit" />编辑名片
          </button><button role="button" class="btn-primary flex-1" @click="share">
            <view class="i-carbon-share" />分享名片
          </button>
        </view>
        <view class="preview-entry flex items-center justify-between">
          <view class="sync-note flex items-center gap-1">
            <view class="i-carbon-checkmark-outline" /><text>修改后实时更新</text>
          </view>
          <button role="button" class="text-link flex items-center gap-1" @click="platform.navigateTo({ url: sharePath(card) })">
            访客视角 <view class="i-carbon-chevron-right" />
          </button>
        </view>
      </view>
      <view class="side-column">
        <VipGate v-if="!card.isVip" />
        <view v-else class="overview panel">
          <view class="flex items-center justify-between">
            <text class="section-title">连接的足迹</text><button role="button" class="text-link" @click="platform.reLaunch({ url: '/pages/stats/stats' })">
              查看数据 <view class="i-carbon-chevron-right" />
            </button>
          </view>
          <view class="metrics mt-6 flex">
            <view>
              <text class="metric-number">{{ stats?.views ?? '—' }}</text><text class="muted">名片浏览</text>
            </view><view>
              <text class="metric-number">{{ stats?.favorites ?? '—' }}</text><text class="muted">被收藏</text>
            </view><view>
              <text class="metric-number">{{ stats?.contacts ?? '—' }}</text><text class="muted">我的人脉</text>
            </view>
          </view>
          <view v-if="statsError" class="today-line" role="alert">
            <text>统计暂时无法加载</text><button class="text-link" @click="load()">
              重试
            </button>
          </view>
          <view v-else-if="stats" class="today-line">
            <view class="i-carbon-growth" /><text>
              今天有 {{ stats?.todayViews ?? 0 }} 次新的名片访问
            </text>
          </view>
        </view>
        <view class="completion panel mt-4">
          <view class="flex items-center justify-between">
            <view><text class="section-title">名片完整度</text></view><text class="progress-number">{{ progress }}<text>%</text></text>
          </view>
          <view class="progress-track mt-4">
            <view :style="{ width: `${progress}%` }" />
          </view>
          <text class="muted mt-3 block">
            {{
              progress < 100
                ? '补充联系方式，让新的机会更容易找到你。'
                : '你的名片已准备就绪，分享给下一位新朋友吧。'
            }}
          </text>
          <button role="button" class="text-link mt-4" @click="edit">
            {{ progress < 100 ? '完善我的名片' : '更新名片信息' }} <text class="ml-1">→</text>
          </button>
        </view>
        <button role="button" class="invitation mt-4" aria-label="展示我的名片码" @click="share">
          <view class="invitation-icon i-carbon-qr-code" />
          <view class="flex-1">
            <text class="invitation-title">面对面，扫一扫</text><text class="invitation-description">出示名片码，认识新朋友</text>
          </view>
          <view class="i-carbon-chevron-right" />
        </button>
      </view>
      <CardSections v-if="card.appearance?.layout !== 'portrait'" :card="card" :media-access="card.mediaAccess" interactive />
      <MessageBoard v-if="card.isVip" :card="card" owner />
    </view>
    <view class="footer-note">
      <text>一面 · 让连接自然发生</text>
    </view>
  </AppShell>
</template>

<style scoped lang="scss">
.page-heading {
  margin: 0 2px 14px;
  gap: 12px;
}
.page-title {
  font-size: 25px;
  letter-spacing: 0;
}
.page-subtitle {
  font-size: 12px;
  margin-top: 4px;
}
.heading-status {
  padding: 7px 10px;
  border: 1px solid #e4e5dc;
  border-radius: 24px;
  background: #fff;
  color: #687261;
  font-size: 11px;
  flex-shrink: 0;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #678466;
}
.status-dot.private {
  background: #96968d;
}
.home-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.identity-column,
.side-column {
  min-width: 0;
}
.card-actions {
  gap: 10px;
  margin-top: 14px;
}
.card-actions .btn-primary {
  flex: 1.3;
}
.preview-entry {
  min-height: 44px;
  margin-top: 4px;
}
.sync-note {
  color: #808679;
  font-size: 11px;
}
.metrics {
  margin-top: 18px;
}
.metrics > view {
  flex: 1;
  text-align: center;
}
.metrics > view + view {
  border-left: 1px solid #eeeee8;
}
.metric-number {
  display: block;
  font-size: 27px;
  font-weight: 600;
  margin-bottom: 3px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.today-line {
  display: flex;
  gap: 7px;
  align-items: center;
  font-size: 11px;
  color: #68745f;
  background: #f2f4ed;
  padding: 10px;
  border-radius: 8px;
  margin-top: 16px;
}
.progress-number {
  font-size: 23px;
  font-weight: 600;
  color: #c4512d;
}
.progress-number text {
  font-size: 12px;
  margin-left: 2px;
}
.progress-track {
  height: 5px;
  border-radius: 4px;
  background: #f1eee7;
  overflow: hidden;
  margin-top: 12px;
}
.progress-track > view {
  height: 100%;
  background: #d18b67;
  border-radius: 4px;
}
.invitation {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 18px;
  border: 1px solid #eeded0;
  background: #f4e8dc;
  border-radius: 16px;
  color: #573d2c;
  text-align: left;
  line-height: 1.6;
}
.invitation-icon {
  flex-shrink: 0;
  font-size: 34px;
  color: #a66c48;
}
.invitation-title {
  display: block;
  font-size: 15px;
  font-weight: 600;
}
.invitation-description {
  display: block;
  font-size: 12px;
  color: #836b59;
  margin-top: 4px;
}
.footer-note {
  text-align: center;
  padding: 28px 0 8px;
  color: #94998a;
  font-size: 11px;
  letter-spacing: 1px;
}
</style>

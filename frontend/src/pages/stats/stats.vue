<script setup lang="ts">
import type { Stats } from '@/api/types'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppShell from '@/components/AppShell.vue'
import PageState from '@/components/PageState.vue'
import VipGate from '@/components/VipGate.vue'
import { cardApi } from '@/api/card'
import { accountApi } from '@/api/account'
import { ensureSession } from '@/hooks/useSession'
import { errorMessage, HttpError } from '@/http'

definePage({ style: { navigationBarTitleText: '数据概览', enablePullDownRefresh: true } })

const stats = ref<Stats>()
const loading = ref(true)
const error = ref('')
const isVip = ref(false)
const max = computed(() => Math.max(1, ...(stats.value?.days.map(day => day.views) || [])))
async function load() {
  loading.value = true
  error.value = ''
  stats.value = undefined
  isVip.value = false
  try {
    await ensureSession()
    isVip.value = (await accountApi.mine()).membership.isVip
    if (!isVip.value)
      return
    stats.value = await cardApi.stats()
  }
  catch (e) {
    if (e instanceof HttpError && e.status === 403)
      isVip.value = false
    else
      error.value = errorMessage(e)
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}
onShow(load)
onPullDownRefresh(load)
const platform = uni
</script>

<template>
  <AppShell active="stats">
    <text class="page-title">数据概览</text><text class="page-subtitle">每一份关注，都有回响。</text>
    <PageState
      v-if="loading || error"
      class="mt-7"
      :loading="loading"
      :error="error"
      @retry="load"
    />
    <VipGate v-else-if="!isVip" class="mt-7" title="数据概览 · VIP 专属" description="开通 VIP，查看浏览、收藏和近七天趋势。你的基础名片仍可正常分享。" />
    <view v-else-if="stats">
      <view class="stat-grid mt-8">
        <view class="panel">
          <view class="i-carbon-view stat-icon" /><text class="stat-value">{{ stats.views }}</text><text class="muted">累计名片浏览</text><text class="stat-detail">今日新增 {{ stats.todayViews }} 次</text>
        </view>
        <view class="panel">
          <view class="i-carbon-bookmark stat-icon" /><text class="stat-value">
            {{
              stats.favorites
            }}
          </text><text class="muted">名片被收藏</text><text class="stat-detail">对你感兴趣的人</text>
        </view>
        <view class="panel">
          <view class="i-carbon-user-multiple stat-icon" /><text class="stat-value">
            {{
              stats.contacts
            }}
          </text><text class="muted">我的收藏人脉</text><text class="stat-detail">保持联系，共同成长</text>
        </view>
      </view>
      <view class="panel mt-5">
        <view class="flex items-center justify-between">
          <text class="section-title">近 7 天的连接足迹</text><text class="small-tag">浏览次数</text>
        </view>
        <view class="chart">
          <view v-for="day in stats.days" :key="day.day" class="chart-column">
            <text class="chart-value">{{ day.views }}</text><view class="bar-space">
              <view
                class="chart-bar"
                :style="{
                  height: `${(day.views / max) * 130}px`,
                  minHeight: day.views ? '4px' : '0px',
                }"
              />
            </view><text class="chart-day">{{ day.day.slice(5).replace('-', '/') }}</text>
          </view>
        </view>
        <view class="chart-caption">
          <view class="i-carbon-information" /><text>
            同一访客每日计为一次浏览，自己的访问不计入。
          </text>
        </view>
      </view>
      <view v-if="!stats.views" class="empty-hint mt-5">
        <view class="i-carbon-sprout text-2xl" /><view>
          <text class="section-title">你的连接故事，才刚刚开始。</text><text class="muted mt-2 block">分享你的名片，第一份关注也许就在下一次相遇。</text>
        </view><button role="button" class="text-link" @click="platform.reLaunch({ url: '/pages/index/index' })">
          去分享 →
        </button>
      </view>
    </view>
  </AppShell>
</template>

<style scoped lang="scss">
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.stat-grid .panel {
  padding: 16px 10px;
}
.stat-icon {
  font-size: 24px;
  color: #c4512d;
}
.stat-value {
  display: block;
  font-size: 28px;
  margin-top: 20px;
  margin-bottom: 6px;
  font-weight: 600;
  letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
}
.stat-detail {
  display: block;
  margin-top: 16px;
  font-size: 10px;
  color: var(--ui-muted);
}
.chart {
  display: flex;
  justify-content: space-around;
  gap: 12px;
  margin-top: 35px;
}
.chart-column {
  flex: 1 1 0;
  min-width: 0;
  text-align: center;
}
.chart-value {
  font-size: 12px;
  color: #68705e;
}
.bar-space {
  height: 140px;
  border-bottom: 1px solid var(--ui-line);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  margin-top: 8px;
}
.chart-bar {
  background: #c9825c;
  width: 65%;
  max-width: 40px;
  border-radius: 6px 6px 0 0;
}
.chart-day {
  display: block;
  font-size: 11px;
  margin-top: 12px;
  color: var(--ui-muted);
}
.chart-caption {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ui-muted);
  margin-top: 25px;
  line-height: 1.8;
}
.empty-hint {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  background: #f1e9dc;
  border: 1px solid #e7dccb;
  border-radius: 16px;
}
.empty-hint > view:nth-child(2) {
  flex: 1;
}
@media (max-width: 550px) {
  .stat-grid {
    gap: 8px;
  }
  .stat-grid .panel {
    padding: 18px 12px;
  }
  .stat-value {
    font-size: 28px;
  }
  .stat-detail {
    font-size: 10px;
  }
  .empty-hint {
    flex-wrap: wrap;
    padding: 20px;
  }
  .page-title {
    font-size: 24px;
  }
}
</style>

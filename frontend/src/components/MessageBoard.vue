<script setup lang="ts">
import type { Card, CardMessage } from '@/api/types'
import { computed, reactive, ref, watch } from 'vue'
import { cardApi } from '@/api/card'
import { errorMessage } from '@/http'
import { coverColors, themeColors } from '@/utils/appearance'
import { cardTemplateClass, templateCoverStyle } from '@/utils/templates'

const props = defineProps<{ card: Card, owner?: boolean }>()
const isOwner = computed(() => props.owner || props.card.isOwner)
const colors = computed(() => coverColors(props.card.appearance?.accentColor || themeColors[props.card.theme]))
const draft = reactive({ name: '', contact: '', content: '' })
const submitting = ref(false)
const submitted = ref(false)
const submitError = ref('')
const messages = ref<CardMessage[]>([])
const total = ref(0)
const page = ref(0)
const loading = ref(false)
const inboxError = ref('')
let generation = 0
watch(() => [draft.name, draft.contact, draft.content], () => {
  submitError.value = ''
})

async function loadMessages(reset = false) {
  if (loading.value)
    return
  const current = generation
  const nextPage = reset ? 1 : page.value + 1
  loading.value = true
  inboxError.value = ''
  try {
    const result = await cardApi.messages(nextPage)
    if (current !== generation)
      return
    messages.value = reset ? result.items : [...messages.value, ...result.items.filter(item => !messages.value.some(existing => existing.id === item.id))]
    total.value = result.total
    page.value = result.page
  }
  catch (e) {
    if (current === generation)
      inboxError.value = errorMessage(e)
  }
  finally {
    if (current === generation)
      loading.value = false
  }
}
watch(() => [props.card.id, isOwner.value], () => {
  generation++
  messages.value = []
  total.value = 0
  page.value = 0
  loading.value = false
  submitted.value = false
  submitError.value = ''
  inboxError.value = ''
  Object.assign(draft, { name: '', contact: '', content: '' })
  if (isOwner.value)
    loadMessages(true)
}, { immediate: true })

async function submit() {
  if (submitting.value)
    return
  submitError.value = ''
  const body = { name: draft.name.trim(), contact: draft.contact.trim(), content: draft.content.trim() }
  if (!body.name || !body.content) {
    submitError.value = !body.name ? '请填写你的称呼' : '请填写留言内容'
    return
  }
  submitting.value = true
  try {
    await cardApi.leaveMessage(props.card.id, body)
    submitted.value = true
    Object.assign(draft, { name: '', contact: '', content: '' })
  }
  catch (e) {
    submitError.value = errorMessage(e)
  }
  finally {
    submitting.value = false
  }
}
function timeLabel(value: string) {
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function copyContact(contact: string) {
  uni.setClipboardData({ data: contact })
}
</script>

<template>
  <view class="message-board panel" :class="cardTemplateClass(card)" :style="{ '--message-accent': colors.background, '--message-ink': colors.color }">
    <view class="board-header" :style="templateCoverStyle(card)">
      <view class="header-orbit" aria-hidden="true" />
      <view class="header-top flex items-center justify-between gap-3">
        <text class="board-eyebrow">{{ isOwner ? 'YOUR INBOX' : "LET’S TALK" }}</text>
        <view class="private-badge flex items-center gap-1">
          <view class="i-carbon-locked" /><text>{{ isOwner ? '仅自己可见' : '私密留言' }}</text>
        </view>
      </view>
      <view class="header-main flex items-center justify-between gap-3">
        <view class="min-w-0 flex-1">
          <text class="section-title">{{ isOwner ? '收到的留言' : '给我留言' }}</text>
          <text class="board-description">{{ isOwner ? '每一句问候，都是新的连接。' : '一个想法，一次问候。\n让新的连接，从这里开始。' }}</text>
        </view>
        <view class="letter-art" aria-hidden="true">
          <view class="letter-paper">
            <view /><view /><view />
          </view>
          <view class="letter-envelope" />
          <view class="letter-seal">
            <view class="i-carbon-arrow-up-right" />
          </view>
        </view>
      </view>
      <view v-if="!isOwner" class="recipient flex items-center gap-2">
        <image v-if="card.avatar" class="recipient-avatar" :src="card.avatar" mode="aspectFill" />
        <view v-else class="recipient-avatar flex items-center justify-center">
          {{ card.name.slice(0, 1) }}
        </view>
        <text>写给 {{ card.name }}</text><view class="recipient-line flex-1" /><text class="recipient-note">期待你的来信</text>
      </view>
    </view>
    <view class="board-body">
      <template v-if="isOwner">
        <view class="inbox-toolbar mt-4 flex items-center justify-between">
          <text class="muted">共 {{ total }} 条留言</text>
          <button role="button" class="text-link" :disabled="loading" @click="loadMessages(true)">
            刷新留言
          </button>
        </view>
        <view v-if="!loading && !inboxError && !messages.length" class="inbox-empty">
          <view class="empty-icon i-carbon-chat" />
          <text class="empty-title">等候第一声「你好」</text>
          <text>分享名片，让新的对话开始。<text class="block">留言和联系方式仅你可查看。</text></text>
        </view>
        <view v-for="message in messages" :key="message.id" class="message-item">
          <view class="flex items-center gap-3">
            <view class="sender-avatar flex shrink-0 items-center justify-center">
              {{ message.name.slice(0, 1) }}
            </view>
            <view class="min-w-0 flex-1">
              <text class="message-name block">{{ message.name }}</text>
              <text class="message-time block">{{ timeLabel(message.createdAt) }}</text>
            </view>
            <view class="message-mark i-carbon-chat" aria-hidden="true" />
          </view>
          <text class="message-content mt-3 block">{{ message.content }}</text>
          <view v-if="message.contact" class="message-contact mt-3 flex items-center justify-between gap-3">
            <text class="min-w-0 flex-1">{{ message.contact }}</text>
            <button role="button" class="text-link shrink-0" :aria-label="`复制${message.name}的联系方式`" @click="copyContact(message.contact)">
              复制
            </button>
          </view>
        </view>
        <text v-if="inboxError" class="board-error mt-3 block" role="alert">{{ inboxError }}</text>
        <button v-if="inboxError || messages.length < total" role="button" class="btn-secondary mt-4 w-full" :disabled="loading" @click="loadMessages(page === 0)">
          {{ loading ? '正在加载…' : inboxError ? '重试加载' : '查看更多留言' }}
        </button>
        <text v-else-if="loading" class="muted mt-4 block">正在加载留言…</text>
      </template>
      <view v-else-if="submitted" class="message-success">
        <view class="success-icon flex items-center justify-center">
          <view class="i-carbon-checkmark" />
        </view>
        <text class="success-title block">留言已送达</text>
        <text class="board-description">感谢你的留言，我会认真阅读。只有我能看到这条留言。</text>
        <button role="button" class="btn-secondary mt-4 w-full" @click="submitted = false">
          再写一条
        </button>
      </view>
      <view v-else class="message-form">
        <view class="field">
          <text class="field-label">你的称呼 <text class="required">*</text></text>
          <view class="input-wrap">
            <view class="input-icon i-carbon-user" aria-hidden="true" />
            <input v-model="draft.name" class="field-input message-name-input" aria-label="你的称呼" placeholder="怎么称呼你？" :maxlength="30" :disabled="submitting">
          </view>
        </view>
        <view class="field">
          <text class="field-label">联系方式 <text class="optional">选填</text></text>
          <view class="input-wrap">
            <view class="input-icon i-carbon-chat" aria-hidden="true" />
            <input v-model="draft.contact" class="field-input message-contact-input" aria-label="留言联系方式" placeholder="微信、电话或邮箱" :maxlength="120" :disabled="submitting">
          </view>
        </view>
        <view class="field">
          <view class="flex items-center justify-between gap-3">
            <text class="field-label">留言内容 <text class="required">*</text></text>
            <text class="character-count">{{ draft.content.length }}/1000</text>
          </view>
          <textarea v-model="draft.content" class="field-input field-textarea message-content-input" aria-label="留言内容" placeholder="关于合作、关于想法，或简单说声你好…" :maxlength="1000" :disabled="submitting" :auto-height="false" />
        </view>
        <view class="privacy-note flex items-center gap-1">
          <view class="i-carbon-locked shrink-0" /><text>你的留言将私密送达，仅名片主人可见</text>
        </view>
        <text v-if="submitError" class="board-error mt-3 block" role="alert">{{ submitError }}</text>
        <button role="button" class="send-button btn-primary mt-4 w-full" :style="colors" :disabled="submitting" @click="submit">
          <view class="i-carbon-send-alt" /><text>{{ submitting ? '正在发送…' : '发送留言' }}</text><view class="send-arrow flex items-center justify-center">
            <view class="i-carbon-arrow-right" />
          </view>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.message-board {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid #e5e5d9;
  border-radius: 22px;
  background: #faf9f5;
  box-shadow: 0 10px 28px #283e2d08;
}
.board-header {
  position: relative;
  overflow: hidden;
  padding: 22px 22px 18px;
  background-color: var(--message-accent);
  color: var(--message-ink);
  background-image: linear-gradient(120deg, transparent, #ffffff0e);
}
.header-orbit {
  position: absolute;
  width: 250px;
  height: 250px;
  top: -90px;
  right: -115px;
  border: 1px solid currentColor;
  border-radius: 50%;
  opacity: 0.12;
  box-shadow:
    0 0 0 28px #ffffff06,
    0 0 0 56px #ffffff04;
  pointer-events: none;
}
.header-top,
.header-main,
.recipient {
  position: relative;
}
.board-eyebrow {
  font-size: 10px;
  letter-spacing: 2.8px;
  font-weight: 600;
  opacity: 0.7;
}
.private-badge {
  padding: 5px 8px;
  border: 1px solid #ffffff30;
  border-radius: 20px;
  font-size: 10px;
  opacity: 0.85;
}
.header-main {
  margin-top: 18px;
}
.board-header .section-title {
  font-size: 26px;
  line-height: 1.4;
  font-weight: 600;
  letter-spacing: 1px;
}
.board-header .board-description {
  color: inherit;
  opacity: 0.75;
  white-space: pre-line;
  font-size: 12px;
}
.letter-art {
  position: relative;
  width: 82px;
  height: 84px;
  flex-shrink: 0;
  margin-right: 4px;
  transform: rotate(-8deg);
}
.letter-paper {
  position: absolute;
  width: 58px;
  height: 65px;
  top: 0;
  left: 12px;
  padding: 15px 11px;
  border-radius: 5px;
  background: #fff8e9;
  box-shadow: 0 4px 12px #00000012;
}
.letter-paper > view {
  height: 2px;
  background: #b6b7a0;
  margin-bottom: 6px;
  border-radius: 2px;
}
.letter-paper > view:last-child {
  width: 60%;
}
.letter-envelope {
  position: absolute;
  bottom: 3px;
  width: 82px;
  height: 48px;
  border-radius: 4px 4px 7px 7px;
  background:
    linear-gradient(32deg, #e6d8b6 49%, transparent 50%), linear-gradient(-32deg, #eddfc0 49%, transparent 50%), #d3c29e;
  box-shadow: 0 6px 12px #00000012;
}
.letter-seal {
  position: absolute;
  right: -8px;
  bottom: -1px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 29px;
  height: 29px;
  border: 3px solid var(--message-accent);
  border-radius: 50%;
  background: #f0b88c;
  color: #493527;
  font-size: 15px;
}
.recipient {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #ffffff25;
  font-size: 12px;
}
.recipient-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ffffff20;
  font-size: 11px;
}
.recipient-line {
  height: 1px;
  margin: 0 4px;
  background: currentColor;
  opacity: 0.15;
}
.recipient-note {
  opacity: 0.6;
  font-size: 10px;
}
.board-body {
  padding: 20px;
}
.message-form > .field:first-child {
  margin-top: 0;
}
.message-form .field {
  margin-top: 18px;
}
.input-wrap {
  position: relative;
}
.input-icon {
  position: absolute;
  top: 17px;
  left: 14px;
  z-index: 1;
  font-size: 17px;
  color: #7a8775;
  pointer-events: none;
}
.message-form .field-input {
  background: #fff;
  border-color: #e5e5dc;
  border-radius: 12px;
  height: 50px;
  font-size: 13px;
}
.input-wrap .field-input {
  padding-left: 42px;
}
.message-form .field-input:focus-within {
  border-color: var(--message-accent);
  box-shadow: 0 0 0 3px #234e3e0a;
}
.message-form .field-label {
  font-size: 12px;
}
.message-form .message-content-input {
  height: 144px;
  padding: 12px 14px;
  line-height: 28px;
  background-image: repeating-linear-gradient(transparent, transparent 27px, #f0f0e7 27px, #f0f0e7 28px);
  background-origin: content-box;
}
.send-button {
  position: relative;
  min-height: 52px;
  border-radius: 13px;
  box-shadow: 0 5px 12px #183f3515;
  padding-right: 44px;
}
.send-arrow {
  position: absolute;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ffffff18;
  font-size: 14px;
}
.sender-avatar {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #edf1e7;
  color: var(--message-accent);
  font-size: 14px;
  font-weight: 600;
}
.message-mark {
  color: #b8bfae;
  font-size: 18px;
}
.success-icon {
  width: 54px;
  height: 54px;
  margin: 0 auto 14px;
  border-radius: 50%;
  background: #edf2e7;
  color: var(--message-accent);
  font-size: 25px;
}
.success-title {
  font-size: 19px;
}
.empty-icon {
  margin: 0 auto 12px;
  color: #a0ac94;
  font-size: 32px;
}
.empty-title {
  display: block;
  margin-bottom: 8px;
  color: #45533e;
  font-size: 15px;
  font-weight: 600;
}
.board-description {
  display: block;
  margin-top: 8px;
  color: #7b8176;
  font-size: 12px;
  line-height: 1.7;
}
.optional,
.character-count {
  color: #969b91;
  font-size: 11px;
  font-weight: 400;
}
.optional {
  margin-left: 4px;
}
.required {
  color: #bd5838;
}
.message-content-input {
  min-height: 128px;
  width: 100%;
}
.privacy-note {
  color: #7b8176;
  font-size: 11px;
  line-height: 1.7;
  margin-top: 14px;
}
.board-error {
  color: #b4442e;
  font-size: 13px;
  line-height: 1.7;
}
.message-success {
  border-radius: 12px;
  padding: 18px;
  background: white;
  color: #234e3e;
  font-weight: 600;
  text-align: center;
}
.inbox-empty {
  display: block;
  padding: 24px 0 18px;
  color: #7b8176;
  font-size: 13px;
  line-height: 1.8;
  text-align: center;
}
.message-item {
  padding: 16px;
  margin-top: 12px;
  border: 1px solid #eceee7;
  border-radius: 15px;
  background: white;
}
.message-name {
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.message-time {
  color: #969b91;
  font-size: 11px;
  margin-top: 4px;
}
.message-content {
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.message-contact {
  border-radius: 10px;
  padding: 2px 12px;
  background: #f6f7f2;
  color: #66715e;
  font-size: 12px;
  overflow-wrap: anywhere;
}
</style>

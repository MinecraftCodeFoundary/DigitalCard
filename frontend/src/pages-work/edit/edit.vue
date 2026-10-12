<script setup lang="ts">
import type { CardAppearance, CardDisplayField, CardSection, CardTheme, MediaUpload } from '@/api/types'
import { onBackPress, onLoad, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import AppShell from '@/components/AppShell.vue'
import CardPreview from '@/components/CardPreview.vue'
import CardSections from '@/components/CardSections.vue'
import CardHomepage from '@/components/CardHomepage.vue'
import ModuleEditor from './components/ModuleEditor.vue'
import PortraitCoverEditor from './components/PortraitCoverEditor.vue'
import CardTemplatePicker from './components/CardTemplatePicker.vue'
import BrandPosterEditor from './components/BrandPosterEditor.vue'
import type { CardTemplateDefinition } from '@/utils/templates'
import { applyCardTemplate, cardTemplateClass, cardTemplates } from '@/utils/templates'
import PageState from '@/components/PageState.vue'
import { cardApi } from '@/api/card'
import { ensureSession } from '@/hooks/useSession'
import { errorMessage, HttpError, showError } from '@/http'
import { cardBody } from '@/utils/card'
import { chooseAvatar } from './avatar'
import { defaultAppearance, themeColors } from '@/utils/appearance'
import { validMediaUrl } from '@/utils/media'
import { portraitPages } from '@/utils/pages'
import type { EditableCard } from './basic-card'
import { basicCardBody, restoreVipStyle } from './basic-card'

definePage({ style: { navigationBarTitleText: '编辑名片' } })

const form = ref<EditableCard>()
const isVip = ref(false)
const membershipRefreshing = ref(false)
const membershipError = ref('')
let loaded = false
const previewPage = ref('')
const original = ref('')
const tagText = ref('')
const loading = ref(true)
const saving = ref(false)
const moduleUploading = ref(false)
const coverUploading = ref(false)
const avatarUploading = ref(false)
const mediaUploading = computed(() => moduleUploading.value || coverUploading.value || avatarUploading.value)
const mediaAccess = ref<Record<string, string>>({})
function mediaUploaded(media: MediaUpload) {
  if (media.previewUrl)
    mediaAccess.value[media.url] = media.previewUrl
  if (media.mediaUnavailable)
    uni.showToast({ title: '上传成功，预览暂时不可用，可继续保存', icon: 'none', duration: 3000 })
}
const error = ref('')
const preview = ref(false)
const fieldError = ref('')
const guided = ref(true)
const step = ref(0)
const moreAppearance = ref(false)
const contentEditor = ref<InstanceType<typeof ModuleEditor>>()
const hasContact = computed(() => !!form.value && [form.value.phone, form.value.wechat, form.value.email, form.value.website].some(value => value.trim()))
const hasBusinessContent = computed(() => form.value?.sections.some(section => section.visible && !['about', 'contact'].includes(section.type)
  && (section.content.trim() || section.images?.length || section.url?.trim() || section.blocks?.some(block => block.visible && (block.content.trim() || block.images?.length || block.url?.trim())))))
const steps = [
  { id: 0, label: '身份与联系', title: '你是谁，怎么联系你', hint: '填写身份、简介和常用联系方式，让收到名片的人认识你。仅姓名必填，其余按实际情况填写。' },
  { id: 1, label: '业务与展示', title: '让对方了解你能提供什么', hint: '商务名片、业务展示、个人主页都可以在这里补充内容，也可以混合使用。' },
  { id: 2, label: '风格与发布', title: '确认名片的样式和分享状态', hint: '选择风格、预览内容，再决定是否公开。样式细节可按需调整。' },
]
const availableSteps = computed(() => isVip.value ? steps : [steps[0], { ...steps[2], hint: '预览你的基础简易名片，再决定是否公开分享。' }])
const stepIndex = computed(() => availableSteps.value.findIndex(item => item.id === step.value))
const currentStep = computed(() => availableSteps.value[stepIndex.value] ?? availableSteps.value[0])
const previewCard = computed(() => form.value && (isVip.value ? form.value : basicCardBody(form.value)))
function showMembership() {
  uni.navigateTo({ url: '/pages-work/account/account' })
}
async function goToStep(target: number) {
  if (saving.value || mediaUploading.value)
    return
  if (!isVip.value && target === 1)
    target = 2
  if (target > step.value && !form.value?.name.trim()) {
    await showFieldError('请填写你的姓名', 'profile')
    return
  }
  step.value = target
  fieldError.value = ''
  preview.value = false
  await nextTick()
  if (guided.value)
    uni.pageScrollTo({ scrollTop: 0, duration: 250 })
  else
    uni.pageScrollTo({ selector: ['#edit-profile', '#edit-content', '#edit-appearance'][target], duration: 250 })
}
async function toggleGuided() {
  if (saving.value || mediaUploading.value)
    return
  guided.value = !guided.value
  preview.value = false
  fieldError.value = ''
  await nextTick()
  uni.pageScrollTo({ scrollTop: 0, duration: 250 })
}
async function focusSection(id: string) {
  await nextTick()
  uni.pageScrollTo({ selector: `#edit-section-${id}`, duration: 250 })
}
type ErrorArea = 'profile' | 'tags' | 'content' | 'appearance'
async function showFieldError(message: string, area: ErrorArea, targetId?: string) {
  fieldError.value = message
  preview.value = false
  step.value = area === 'profile' || area === 'tags' ? 0 : area === 'content' ? 1 : 2
  if (area === 'appearance')
    moreAppearance.value = true
  if (area === 'content')
    contentEditor.value?.revealSettings(targetId)
  await nextTick()
  const id = targetId || (area === 'tags' ? 'edit-tags' : `edit-${area}`)
  uni.pageScrollTo({ selector: `#${id}`, duration: 250 })
}
const themes: { key: CardTheme, label: string, color: string }[] = [
  { key: 'forest', label: '森林绿', color: '#234e3e' },
  { key: 'sand', label: '暖砂棕', color: '#8c6444' },
  { key: 'ink', label: '深海蓝', color: '#2a3549' },
]
const layouts: { key: CardAppearance['layout'], label: string, description: string }[] = [
  { key: 'poster', label: '品牌海报', description: '左文右人，业务长海报' },
  { key: 'portrait', label: '人物主页', description: '大图封面，图标导航' },
  { key: 'classic', label: '经典商务', description: '醒目封面，清晰介绍' },
  { key: 'centered', label: '居中名片', description: '头像居中，突出个人' },
  { key: 'minimal', label: '简约名片', description: '紧凑封面，聚焦信息' },
]
function selectTemplate(template: CardTemplateDefinition) {
  if (!isVip.value || !form.value || mediaUploading.value)
    return
  form.value.appearance = applyCardTemplate(form.value.appearance, template)
  form.value.theme = template.theme
  previewPage.value = form.value.pages[0].id
}
function selectLayout(key: CardAppearance['layout']) {
  if (!isVip.value || !form.value || mediaUploading.value)
    return
  const previous = form.value.appearance.layout
  if (key === 'poster') {
    selectTemplate(cardTemplates.find(template => template.id === 'poster')!)
    return
  }
  form.value.appearance.layout = key
  if (key === 'portrait' && previous !== key) {
    previewPage.value = ''
    if (!form.value.appearance.accentColor)
      form.value.appearance.accentColor = '#58bde9'
    if (form.value.pages.length === 1 && form.value.pages[0].id === 'main' && form.value.pages[0].title === '主页') {
      form.value.pages = portraitPages()
      form.value.sections = form.value.sections.map(section => ({ ...section, pageId: section.type === 'contact' ? 'contact-page' : 'main' }))
    }
  }
}
const avatarShapes: { key: CardAppearance['avatarShape'], label: string }[] = [
  { key: 'rounded', label: '圆角' },
  { key: 'circle', label: '圆形' },
  { key: 'square', label: '方形' },
]
const displayFields: { key: CardDisplayField, label: string }[] = [
  { key: 'title', label: '职位 / 身份' },
  { key: 'company', label: '公司 / 组织' },
  { key: 'location', label: '所在城市' },
  { key: 'tags', label: '专业标签' },
]
function toggleField(key: CardDisplayField) {
  if (!isVip.value || !form.value)
    return
  const hidden = form.value.appearance.hiddenFields
  form.value.appearance.hiddenFields = hidden.includes(key) ? hidden.filter(field => field !== key) : [...hidden, key]
}
function selectTheme(key: CardTheme) {
  if (!isVip.value || !form.value)
    return
  form.value.theme = key
  form.value.appearance.accentColor = ''
}
function resetAppearance() {
  if (isVip.value && form.value && !mediaUploading.value) {
    const defaults = defaultAppearance()
    form.value.appearance = {
      ...form.value.appearance,
      layout: defaults.layout,
      template: defaults.template,
      accentColor: defaults.accentColor,
      avatarShape: defaults.avatarShape,
      decoration: defaults.decoration,
      hiddenFields: defaults.hiddenFields,
    }
    form.value.theme = 'forest'
  }
}
const dirty = computed(
  () => form.value && original.value !== JSON.stringify({ ...form.value, tags: splitTags() }),
)
function togglePreview() {
  if (form.value)
    form.value.tags = splitTags()
  preview.value = !preview.value
  if (preview.value)
    uni.pageScrollTo({ scrollTop: 0, duration: 300 })
}
function splitTags() {
  return [
    ...new Set(
      tagText.value
        .split(/[,，、]/)
        .map(v => v.trim())
        .filter(Boolean),
    ),
  ]
}
async function load() {
  error.value = ''
  loading.value = true
  try {
    await ensureSession()
    const result = await cardApi.mine()
    isVip.value = result.isVip === true
    form.value = cardBody(result)
    mediaAccess.value = result.mediaAccess || {}
    original.value = JSON.stringify(form.value)
    tagText.value = form.value.tags.join('，')
    loaded = true
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    loading.value = false
  }
}
async function refreshMembership() {
  if (!loaded || membershipRefreshing.value || saving.value || mediaUploading.value)
    return
  membershipRefreshing.value = true
  membershipError.value = ''
  try {
    await ensureSession()
    const result = await cardApi.mine()
    if (mediaUploading.value || saving.value)
      return
    const saved = cardBody(result)
    const hasDraft = dirty.value
    if (!dirty.value) {
      form.value = saved
      original.value = JSON.stringify(saved)
      tagText.value = saved.tags.join('，')
    }
    else if (!isVip.value && result.isVip === true && form.value) {
      form.value = restoreVipStyle(form.value, saved)
      original.value = JSON.stringify(saved)
    }
    isVip.value = result.isVip === true
    mediaAccess.value = hasDraft ? { ...mediaAccess.value, ...result.mediaAccess } : result.mediaAccess || {}
    if (!isVip.value && step.value === 1)
      step.value = 2
  }
  catch (e) {
    membershipError.value = errorMessage(e)
  }
  finally {
    membershipRefreshing.value = false
  }
}
async function avatar() {
  if (!form.value || saving.value || avatarUploading.value)
    return
  avatarUploading.value = true
  try {
    form.value.avatar = await chooseAvatar()
  }
  catch (e) {
    if (!(typeof e === 'object' && e && 'errMsg' in e && String(e.errMsg).includes('cancel')))
      showError(e)
  }
  finally {
    avatarUploading.value = false
  }
}
async function save() {
  if (!form.value || saving.value || membershipRefreshing.value || mediaUploading.value)
    return
  fieldError.value = ''
  const basicOnly = !isVip.value
  const body = basicOnly ? basicCardBody(form.value) : form.value
  if (!form.value.name.trim()) {
    await showFieldError('请填写你的姓名', 'profile')
    return
  }
  if (!/^(?:#[a-f\d]{6})?$/i.test(body.appearance.accentColor)) {
    await showFieldError('自定义颜色需为六位十六进制色值，例如 #234e3e', 'appearance', 'edit-accent-color')
    return
  }
  const untitledSection = body.sections.find(section => !section.title.trim())
  if (untitledSection) {
    await showFieldError('请填写每个模块的标题', 'content', `edit-section-${untitledSection.id}`)
    return
  }
  const untitledPage = body.pages.find(page => !page.title.trim())
  if (untitledPage) {
    await showFieldError('请填写每个页面的名称', 'content', `edit-page-${untitledPage.id}`)
    return
  }
  if (body.appearance.coverImage && !validMediaUrl(body.appearance.coverImage)) {
    await showFieldError('请上传人物封面或填写有效的图片地址', 'appearance')
    return
  }
  if (body.appearance.brandLogo && !validMediaUrl(body.appearance.brandLogo)) {
    await showFieldError('请上传品牌 Logo 或填写有效的图片地址', 'appearance')
    return
  }
  const contentItems = body.sections.flatMap(section => section.type === 'card'
    ? (section.blocks ?? []).map(block => ({ section: block as CardSection, targetId: `edit-block-${block.id}` }))
    : [{ section, targetId: `edit-section-${section.id}` }])
  for (const { section, targetId } of contentItems) {
    if (!section.title.trim()) {
      await showFieldError('请填写 Card 内容的小标题，或使用默认名称', 'content', targetId)
      return
    }
    if (section.type === 'image' && !section.images?.length) {
      await showFieldError(`请为「${section.title}」添加图片`, 'content', targetId)
      return
    }
    if (['video', 'link'].includes(section.type) && !validMediaUrl(section.url)) {
      await showFieldError(`请为「${section.title}」填写有效地址或上传视频`, 'content', targetId)
      return
    }
    if (section.poster && !validMediaUrl(section.poster)) {
      await showFieldError(`「${section.title}」的视频封面地址不正确`, 'content', targetId)
      return
    }
  }
  const tags = splitTags()
  if (tags.length > 5 || tags.some(tag => tag.length > 16)) {
    await showFieldError('最多填写 5 个标签，每个不超过 16 字', 'tags')
    return
  }
  let refreshAfterDenied = false
  saving.value = true
  try {
    const result = basicOnly
      ? await cardApi.save({ ...body, tags }, { basicOnly: true })
      : await cardApi.save({ ...body, tags })
    isVip.value = result.isVip === true
    form.value = cardBody(result)
    original.value = JSON.stringify(form.value)
    tagText.value = form.value.tags.join('，')
    uni.showToast({ title: result.mediaUnavailable ? '名片已保存，图片暂时无法加载' : '名片已更新', icon: result.mediaUnavailable ? 'none' : 'success' })
    setTimeout(() => uni.reLaunch({ url: '/pages/index/index' }), 400)
  }
  catch (e) {
    fieldError.value = errorMessage(e)
    showError(e)
    refreshAfterDenied = e instanceof HttpError && e.status === 403
  }
  finally {
    saving.value = false
    if (refreshAfterDenied)
      await refreshMembership()
  }
}
onLoad(load)
onShow(refreshMembership)
// H5 and App support onBackPress; native WeChat back cannot be intercepted.
onBackPress(() => {
  if (!dirty.value || saving.value)
    return false
  uni.showModal({
    title: '还有未保存的修改',
    content: '离开后，本次修改不会保存。',
    confirmText: '离开',
    success: (result) => {
      if (result.confirm) {
        original.value = JSON.stringify({ ...form.value, tags: splitTags() })
        uni.navigateBack()
      }
    },
  })
  return true
})
</script>

<template>
  <AppShell back title="编辑我的名片">
    <PageState v-if="loading || error" :loading="loading" :error="error" @retry="load" />
    <view v-else-if="form" class="edit-grid">
      <view class="edit-form">
        <view v-if="!isVip" class="panel mb-4" data-testid="free-card-notice">
          <view class="flex items-center justify-between gap-3">
            <text class="section-title">基础简易名片</text><text class="small-tag">免费版</text>
          </view>
          <text class="muted mt-3 block">免费版可编辑基本资料、头像与联系方式，并公开分享。开通 VIP 后可使用全部模板、图文视频、多页面和高级排版。</text>
          <button role="button" class="text-link mt-3" @click="showMembership">
            了解 VIP 权益 <view class="i-carbon-chevron-right" />
          </button>
        </view>
        <view v-if="membershipError" class="panel mb-4" role="alert">
          <text class="muted block">会员状态暂时无法刷新：{{ membershipError }}。你的未保存资料仍保留在这里。</text>
          <button role="button" class="text-link mt-3" :disabled="membershipRefreshing" @click="refreshMembership">
            刷新会员状态
          </button>
        </view>
        <view v-show="!guided || !preview">
          <view class="edit-guide mb-4">
            <view class="flex items-center justify-between gap-3">
              <text class="muted">{{ guided ? `第 ${stepIndex + 1} 步，共 ${availableSteps.length} 步` : '连续填写' }}</text>
              <button role="button" class="text-link" :disabled="saving || mediaUploading" @click="toggleGuided">
                {{ guided ? '连续填写' : '返回分步填写' }}
              </button>
            </view>
            <view v-if="guided" class="edit-steps grid mt-3 gap-2" :class="isVip ? 'grid-cols-3' : 'grid-cols-2'">
              <button v-for="(item, index) in availableSteps" :key="item.label" role="button" :class="{ active: step === item.id }" :aria-label="`第 ${index + 1} 步：${item.label}`" :aria-current="step === item.id ? 'step' : undefined" :disabled="saving || mediaUploading" @click="goToStep(item.id)">
                {{ item.label }}
              </button>
            </view>
            <text class="guide-title mt-4 block">{{ guided ? currentStep.title : '按需要修改你的名片' }}</text>
            <text class="muted mt-2 block">{{ guided ? currentStep.hint : isVip ? '依次填写身份与联系、业务内容和名片风格。排版设置仍可按需展开。' : '填写基本资料与联系方式，再确认名片的公开状态。' }}</text>
          </view>
          <view v-show="!guided || step === 0">
            <view id="edit-profile" class="panel">
              <text class="section-title">基本资料</text>
              <text class="muted mt-2 block">只有姓名是必填项</text>
              <button role="button" class="avatar-picker" :disabled="saving || avatarUploading" @click="avatar">
                <image v-if="form.avatar" :src="form.avatar" mode="aspectFill" /><view
                  v-else
                  class="avatar-placeholder"
                >
                  {{ form.name.slice(0, 1) || '+' }}
                </view><view>
                  <text class="block font-bold">{{ avatarUploading ? '正在处理头像…' : '设置头像（选填）' }}</text><text class="muted">点击上传一张你的照片</text>
                </view><view class="i-carbon-camera ml-auto text-lg" />
              </button>
              <view class="field">
                <text class="field-label">姓名 <text class="required">*</text></text><input
                  v-model="form.name"
                  class="field-input"
                  placeholder="怎么称呼你"
                  :maxlength="30"
                >
              </view>
              <view class="field">
                <text class="field-label">职位 / 身份</text><input
                  v-model="form.title"
                  class="field-input"
                  placeholder="例如：品牌策略顾问"
                  :maxlength="60"
                >
              </view>
              <view class="field">
                <text class="field-label">公司 / 组织</text><input
                  v-model="form.company"
                  class="field-input"
                  placeholder="你的公司或工作室"
                  :maxlength="80"
                >
              </view>
              <view class="field">
                <text class="field-label">个人简介</text><textarea
                  v-model="form.bio"
                  class="field-input field-textarea"
                  placeholder="例如：我是一名设计师，帮助品牌做出好看又好用的产品。"
                  :maxlength="500"
                /><text class="muted mt-2 block text-right">{{ form.bio.length }}/500</text>
              </view>
              <view id="edit-profile-more">
                <view class="field">
                  <text class="field-label">所在城市</text><input
                    v-model="form.location"
                    class="field-input"
                    placeholder="例如：上海 · 静安"
                    :maxlength="100"
                  >
                </view>
                <view id="edit-tags" class="field">
                  <text class="field-label">专业标签</text><input
                    v-model="tagText"
                    class="field-input"
                    placeholder="用逗号分隔，例如：设计，咨询"
                    :maxlength="100"
                  ><text class="muted mt-2 block">最多 5 个，帮助同频的人发现你</text>
                </view>
              </view>
            </view>
          </view>
          <view v-show="!guided || step === 0" id="edit-contact" class="panel mt-4">
            <text class="section-title">联系方式</text><text class="muted mt-2 block">建议至少留一种，方便对方联系你。只填写你愿意展示的号码或账号，也可稍后补充。</text>
            <view class="field">
              <text class="field-label">联系电话</text><input
                v-model="form.phone"
                class="field-input"
                placeholder="填写你的联系电话"
                :maxlength="30"
              >
            </view>
            <view class="field">
              <text class="field-label">微信号</text><input
                v-model="form.wechat"
                class="field-input"
                placeholder="方便新朋友添加你"
                :maxlength="60"
              >
            </view>
            <view class="field">
              <text class="field-label">邮箱</text><input
                v-model="form.email"
                class="field-input"
                placeholder="hello@example.com"
                :maxlength="120"
              >
            </view>
            <view class="field">
              <text class="field-label">个人网站</text><input
                v-model="form.website"
                class="field-input"
                placeholder="https://"
                :maxlength="200"
              >
            </view>
          </view>
          <view v-if="isVip" v-show="!guided || step === 1" id="edit-content" :class="{ 'mt-4': !guided }">
            <ModuleEditor ref="contentEditor" v-model:sections="form.sections" v-model:pages="form.pages" compact :poster="form.appearance.layout === 'poster'" :media-access="mediaAccess" @page-change="previewPage = $event" @section-added="focusSection" @media-uploaded="mediaUploaded" @uploading-change="moduleUploading = $event" />
          </view>
          <view v-show="!guided || step === 2">
            <view class="panel my-4">
              <text class="section-title">分享前确认</text>
              <text class="muted mt-2 block">{{ form.name || '尚未填写姓名' }} · {{ form.title || '尚未填写身份' }}</text>
              <view class="mt-3 flex items-center justify-between gap-3">
                <text class="muted">{{ hasContact ? '已填写联系方式' : '尚未留联系方式，对方暂时无法直接联系你' }}</text>
                <button role="button" class="text-link" @click="goToStep(0)">
                  修改资料
                </button>
              </view>
              <view v-if="isVip" class="mt-3 flex items-center justify-between gap-3">
                <text class="muted">{{ hasBusinessContent ? '已添加业务或展示内容' : '尚未补充业务或展示内容，可先保存' }}</text>
                <button role="button" class="text-link" @click="goToStep(1)">
                  修改内容
                </button>
              </view>
            </view>
            <view id="edit-appearance" class="panel" :class="{ 'mt-4': !guided }">
              <template v-if="isVip">
                <view class="flex items-center justify-between gap-3">
                  <text class="section-title">选择你的名片风格</text>
                  <button role="button" class="text-link" :disabled="mediaUploading" @click="resetAppearance">
                    恢复默认风格
                  </button>
                </view>
                <text class="muted mt-2 block">点击图片即可换样式，无需自己排版。切换样式会保留已填写的内容。</text>
                <CardTemplatePicker :card="form" :disabled="mediaUploading" @select="selectTemplate" />
                <button role="button" class="disclosure mt-5" :aria-expanded="moreAppearance" aria-controls="edit-appearance-more" :disabled="coverUploading" @click="moreAppearance = !moreAppearance">
                  <view><text class="block font-bold">调整样式细节（选填）</text><text class="muted mt-1 block">配色、布局、封面照片和文案</text></view><text>{{ moreAppearance ? '收起 −' : '展开 ＋' }}</text>
                </button>
                <view v-show="moreAppearance" id="edit-appearance-more">
                  <text class="field-label mt-5">名片布局</text>
                  <view class="layout-picker grid grid-cols-2 mt-3 gap-2">
                    <button v-for="layout in layouts" :key="layout.key" role="button" :aria-pressed="form.appearance.layout === layout.key" :class="{ chosen: form.appearance.layout === layout.key }" :disabled="mediaUploading" @click="selectLayout(layout.key)">
                      <text class="block font-bold">{{ layout.label }}</text>
                      <text class="mt-1 block text-xs">{{ layout.description }}</text>
                    </button>
                  </view>
                  <PortraitCoverEditor v-show="form.appearance.layout === 'portrait' || (form.appearance.coverImage && !validMediaUrl(form.appearance.coverImage))" v-model="form.appearance.coverImage" :media-access="mediaAccess" @uploaded="mediaUploaded" @uploading="coverUploading = $event" />
                  <BrandPosterEditor v-if="form.appearance.layout === 'poster' || (form.appearance.brandLogo && !validMediaUrl(form.appearance.brandLogo))" :appearance="form.appearance" :media-access="mediaAccess" @update="form.appearance = { ...form.appearance, ...$event }" @uploaded="mediaUploaded" @uploading="coverUploading = $event" />
                  <text class="field-label mt-5">主题配色</text>
                  <view class="theme-picker mt-3 flex gap-3">
                    <button
                      v-for="theme in themes"
                      :key="theme.key"
                      role="button"
                      :class="{ chosen: form.theme === theme.key && !form.appearance.accentColor }"
                      @click="selectTheme(theme.key)"
                    >
                      <view :style="{ background: theme.color }" /><text>{{ theme.label }}</text><view v-if="form.theme === theme.key && !form.appearance.accentColor" class="i-carbon-checkmark" />
                    </button>
                  </view>
                  <view id="edit-accent-color" class="field">
                    <text class="field-label">自定义主题色</text>
                    <input v-model="form.appearance.accentColor" class="field-input" :placeholder="`例如：${themeColors[form.theme]}，留空使用主题配色`" :maxlength="7">
                    <view class="mt-3 flex flex-wrap gap-2">
                      <button v-for="color in ['#234e3e', '#8c6444', '#2a3549', '#7c3aed', '#9f3451', '#f4d35e']" :key="color" role="button" class="color-swatch" :aria-label="`使用颜色 ${color}`" :aria-pressed="form.appearance.accentColor === color" :style="{ background: color }" @click="form.appearance.accentColor = color">
                        <text v-if="form.appearance.accentColor === color">✓</text>
                      </button>
                    </view>
                    <text class="muted mt-2 block">输入 # 加 6 位色值；封面文字随颜色自动调整深浅。</text>
                  </view>
                  <view class="field">
                    <text class="field-label">封面小标题</text><input v-model="form.appearance.coverLabel" class="field-input" placeholder="例如：DESIGN WITH PURPOSE" :maxlength="32">
                  </view>
                  <view class="field">
                    <text class="field-label">封面文案</text><textarea v-model="form.appearance.coverTitle" class="field-input field-textarea" placeholder="写一句代表你的话，可换行" :maxlength="48" />
                    <text class="muted mt-2 block text-right">{{ form.appearance.coverTitle.length }}/48</text>
                  </view>
                  <view class="field">
                    <text class="field-label">底部署名</text><input v-model="form.appearance.wordmark" class="field-input" placeholder="例如：你的品牌或工作室名称" :maxlength="24">
                  </view>
                  <text class="field-label mt-5">头像形状</text>
                  <view class="layout-picker mt-3 flex gap-2">
                    <button v-for="shape in avatarShapes" :key="shape.key" role="button" class="flex-1" :aria-pressed="form.appearance.avatarShape === shape.key" :class="{ chosen: form.appearance.avatarShape === shape.key }" @click="form.appearance.avatarShape = shape.key">
                      {{ shape.label }}
                    </button>
                  </view>
                  <view class="mt-5 flex items-center justify-between gap-3">
                    <text class="field-label">显示封面装饰</text>
                    <switch :checked="form.appearance.decoration" color="#c4512d" @change="form.appearance.decoration = $event.detail.value" />
                  </view>
                  <text class="field-label mt-5">名片展示信息</text>
                  <text class="muted mt-2 block">选择展示哪些资料，隐藏后仍保留已填写的内容。</text>
                  <view class="layout-picker grid grid-cols-2 mt-3 gap-2">
                    <button v-for="field in displayFields" :key="field.key" role="button" :aria-pressed="!form.appearance.hiddenFields.includes(field.key)" :class="{ chosen: !form.appearance.hiddenFields.includes(field.key) }" @click="toggleField(field.key)">
                      {{ field.label }} · {{ form.appearance.hiddenFields.includes(field.key) ? '已隐藏' : '展示' }}
                    </button>
                  </view>
                </view>
              </template>
              <view v-else>
                <text class="section-title">简约风格，清晰介绍你</text>
                <text class="muted mt-2 block">使用统一的简约名片样式，展示头像、身份、简介与联系方式。更多模板与排版可在开通 VIP 后使用。</text>
              </view>
              <view class="visibility mt-6 flex items-center justify-between">
                <view>
                  <text class="field-label mb-1">公开我的名片</text><text class="muted">关闭后，分享链接和收藏中的名片将不可见</text>
                </view><switch
                  :checked="form.published"
                  color="#c4512d"
                  style="transform: scale(0.8); transform-origin: right center"
                  @change="form.published = $event.detail.value"
                />
              </view>
            </view>
            <text v-if="guided" class="muted mt-4 block text-center">样式满意后，点击下方「保存我的名片」即可生效。</text>
          </view>
        </view>
        <view class="mobile-action-bar">
          <text v-if="fieldError" class="error-text" role="alert">{{ fieldError }}</text>
          <view class="edit-actions flex gap-2">
            <button
              role="button"
              class="btn-secondary"
              @click="togglePreview"
            >
              {{ preview ? '关闭预览' : '预览名片' }}
            </button>
            <button v-if="guided && stepIndex > 0 && !preview" role="button" class="text-link" :disabled="saving || mediaUploading" @click="goToStep(availableSteps[stepIndex - 1].id)">
              上一步
            </button>
            <button v-if="guided && stepIndex < availableSteps.length - 1 && !preview" role="button" class="btn-primary flex-1" :disabled="saving || mediaUploading" @click="goToStep(availableSteps[stepIndex + 1].id)">
              下一步：{{ availableSteps[stepIndex + 1].label }}<view class="i-carbon-arrow-right" />
            </button>
            <button v-else role="button" class="btn-primary flex-1" :disabled="saving || membershipRefreshing || mediaUploading" @click="save">
              {{ mediaUploading ? '媒体正在上传…' : saving ? '正在保存…' : membershipRefreshing ? '正在刷新会员状态…' : '保存我的名片' }}<view class="i-carbon-checkmark" />
            </button>
          </view>
        </view>
      </view>
      <view v-if="previewCard" class="live-preview" :class="[...cardTemplateClass(previewCard), { 'mobile-preview': preview }]">
        <view class="preview-heading mb-4 flex items-center justify-between">
          <text class="preview-title">名片预览</text>
          <button role="button" class="text-link" @click="togglePreview">
            返回编辑
          </button>
        </view>
        <CardHomepage v-if="previewCard.appearance.layout === 'portrait'" :card="previewCard" :media-access="mediaAccess" :page-id="previewPage" />
        <template v-else>
          <CardPreview :card="{ ...previewCard, tags: splitTags().slice(0, 5) }" :media-access="mediaAccess" />
          <CardSections class="mt-4" :card="previewCard" :media-access="mediaAccess" :page-id="previewPage" />
        </template><text
          class="muted mt-5 block text-center"
        >
          好的第一印象，值得被记住。
        </text>
      </view>
    </view>
  </AppShell>
</template>

<style scoped lang="scss">
.edit-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  padding-bottom: calc(86px + env(safe-area-inset-bottom));
}
.edit-guide {
  padding: 16px;
  border: 1px solid var(--ui-line);
  border-radius: 16px;
  background: #f8f7f2;
}
.edit-steps button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 44px;
  padding: 8px 2px;
  border-radius: 10px;
  background: #eeede7;
  color: #666e5e;
  font-size: 12px;
  line-height: 1.5;
}
.edit-steps button.active {
  background: var(--ui-accent);
  color: #fff;
}
.guide-title {
  font-size: 19px;
  font-weight: 600;
  line-height: 1.5;
}
.disclosure {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 8px 0;
  background: transparent;
  color: var(--ui-ink);
  font-size: 13px;
  line-height: 1.6;
  text-align: left;
}
.disclosure > text:last-child {
  flex-shrink: 0;
  color: var(--ui-accent);
  font-size: 12px;
}
.edit-actions .btn-primary,
.edit-actions .btn-secondary {
  padding: 12px;
  font-size: 13px;
}
.edit-actions .text-link {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 4px;
}
.live-preview {
  display: none;
  padding: 14px;
  background: #efeee8;
  border: 1px solid #e5e3da;
  border-radius: 18px;
}
.live-preview.mobile-preview {
  display: block;
  grid-row: 1;
}
.preview-heading {
  min-height: 28px;
}
.preview-title {
  font-size: 16px;
  font-weight: 600;
}
.avatar-picker {
  display: flex;
  align-items: center;
  gap: 16px;
  background: transparent;
  width: 100%;
  padding-top: 24px;
  text-align: left;
  font-size: 13px;
  color: #5e6656;
  line-height: 1.8;
}
.avatar-placeholder,
.avatar-picker image {
  width: 52px;
  height: 52px;
  border-radius: 15px;
  background: #f1e4d5;
}
.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-family: inherit;
}
.required {
  color: #96705b;
}
.theme-picker button {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: center;
  font-size: 11px;
  background: #faf9f6;
  color: #787d6e;
  border: 1px solid var(--ui-line);
  border-radius: 10px;
  padding: 12px 4px;
  line-height: 1.5;
}
.layout-picker button {
  padding: 12px 8px;
  border: 1px solid var(--ui-line);
  border-radius: 10px;
  background: #faf9f6;
  color: #787d6e;
  font-size: 12px;
  line-height: 1.6;
}
.layout-picker button.chosen {
  border-color: #d7a082;
  background: #fbefe5;
  color: var(--ui-accent);
}
.color-swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  color: white;
  text-shadow: 0 1px 3px #17251d;
  line-height: 1;
}
.theme-picker button.chosen {
  border-color: #d7a082;
  background: #fbefe5;
}
.theme-picker button > view:first-child {
  width: 13px;
  height: 13px;
  border-radius: 50%;
}
.visibility {
  border-top: 1px solid var(--ui-line);
  padding-top: 20px;
}
.visibility > view {
  flex: 1;
}
.error-text {
  display: block;
  color: #a25343;
  font-size: 12px;
  margin: 0 0 10px;
}
</style>

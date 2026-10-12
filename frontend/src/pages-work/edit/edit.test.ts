import type { Card } from '@/api/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Edit from './edit.vue'
import { basicCardBody } from './basic-card'
import { cardApi } from '@/api/card'
import { defaultAppearance } from '@/utils/appearance'
import { cardBody } from '@/utils/card'
import { HttpError } from '@/http'

const lifecycle = vi.hoisted(() => ({
  load: undefined as (() => Promise<void>) | undefined,
  show: undefined as (() => Promise<void>) | undefined,
}))
vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (callback: () => Promise<void>) => { lifecycle.load = callback },
  onShow: (callback: () => Promise<void>) => { lifecycle.show = callback },
  onBackPress: vi.fn(),
}))
vi.mock('@/hooks/useSession', () => ({ ensureSession: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/api/card', () => ({ cardApi: { mine: vi.fn(), save: vi.fn() } }))

function card(isVip: boolean): Card {
  return {
    id: 'a'.repeat(24),
    updatedAt: '2026-10-11T00:00:00.000Z',
    isVip,
    name: '林予安',
    title: '设计师',
    company: '',
    phone: '13800000000',
    email: '',
    wechat: '',
    location: '',
    bio: '提供设计服务',
    avatar: '',
    website: '',
    tags: ['设计'],
    published: false,
    theme: 'ink',
    appearance: { ...defaultAppearance(), template: 'aurora' },
    pages: [{ id: 'main', title: '个人主页', columns: 2 }],
    sections: [{ id: 'work', type: 'text', title: '作品介绍', content: '已保存的 VIP 内容', visible: true }],
  }
}

async function editor(initial: Card) {
  vi.mocked(cardApi.mine).mockResolvedValue(initial)
  vi.mocked(cardApi.save).mockImplementation(async body => ({ ...initial, ...body }))
  const wrapper = mount(Edit, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        CardPreview: true,
        CardSections: true,
        CardHomepage: true,
        ModuleEditor: true,
        PortraitCoverEditor: true,
        CardTemplatePicker: true,
        BrandPosterEditor: true,
        PageState: true,
      },
    },
  })
  await lifecycle.load!()
  await flushPromises()
  const button = (label: string) => wrapper.findAll('button').find(item => item.text().includes(label))!
  return { wrapper, button }
}

describe('member card editing', () => {
  beforeEach(() => {
    vi.stubGlobal('definePage', vi.fn())
    vi.stubGlobal('uni', { ...uni, pageScrollTo: vi.fn() })
  })

  it('keeps free editing and publication available without mounting advanced controls', async () => {
    const initial = { ...card(false), ...basicCardBody(card(false)) }
    const { wrapper, button } = await editor(initial)
    expect(wrapper.find('[data-testid="free-card-notice"]').exists()).toBe(true)
    expect(wrapper.find('.edit-steps').findAll('button')).toHaveLength(2)
    expect(wrapper.find('module-editor-stub').exists()).toBe(false)
    expect(wrapper.find('card-template-picker-stub').exists()).toBe(false)
    await wrapper.get('#edit-profile input').setValue('新的姓名')
    await button('下一步：风格与发布').trigger('click')
    expect(wrapper.get('#edit-appearance').isVisible()).toBe(true)
    await wrapper.get('.visibility switch').trigger('change', { detail: { value: true } })
    await button('保存我的名片').trigger('click')
    await flushPromises()
    expect(cardApi.save).toHaveBeenCalledWith({
      ...basicCardBody(cardBody(initial)),
      name: '新的姓名',
      published: true,
    }, { basicOnly: true })
    wrapper.unmount()
  })

  it('keeps all editor features available to VIP members', async () => {
    const { wrapper, button } = await editor(card(true))
    expect(wrapper.find('[data-testid="free-card-notice"]').exists()).toBe(false)
    expect(wrapper.find('.edit-steps').findAll('button')).toHaveLength(3)
    expect(wrapper.find('module-editor-stub').exists()).toBe(true)
    expect(wrapper.find('card-template-picker-stub').exists()).toBe(true)
    await button('连续填写').trigger('click')
    await button('保存我的名片').trigger('click')
    await flushPromises()
    expect(cardApi.save).toHaveBeenCalledWith(expect.objectContaining({
      appearance: expect.objectContaining({ template: 'aurora' }),
      sections: [expect.objectContaining({ content: '已保存的 VIP 内容' })],
    }))
    wrapper.unmount()
  })

  it('refreshes an upgrade on return and restores saved VIP content without losing a basic draft', async () => {
    const { wrapper, button } = await editor({ ...card(false), ...basicCardBody(card(false)) })
    await wrapper.get('#edit-profile input').setValue('尚未保存的姓名')
    await wrapper.get('#edit-tags input').setValue('新的标签')
    await button('了解 VIP 权益').trigger('click')
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages-work/account/account' })
    vi.mocked(cardApi.mine).mockResolvedValue(card(true))
    await lifecycle.show!()
    await flushPromises()
    expect((wrapper.get('#edit-profile input').element as HTMLInputElement).value).toBe('尚未保存的姓名')
    expect((wrapper.get('#edit-tags input').element as HTMLInputElement).value).toBe('新的标签')
    expect(wrapper.find('module-editor-stub').exists()).toBe(true)
    await button('连续填写').trigger('click')
    await button('保存我的名片').trigger('click')
    await flushPromises()
    expect(cardApi.save).toHaveBeenCalledWith(expect.objectContaining({
      name: '尚未保存的姓名',
      tags: ['新的标签'],
      sections: [expect.objectContaining({ content: '已保存的 VIP 内容' })],
    }))
    wrapper.unmount()
  })

  it('refreshes an expired membership while retaining the basic draft and saves only basic configuration', async () => {
    const { wrapper, button } = await editor(card(true))
    await wrapper.get('#edit-profile input').setValue('保留这个名字')
    vi.mocked(cardApi.mine).mockResolvedValue({ ...card(false), ...basicCardBody(card(false)) })
    await lifecycle.show!()
    await flushPromises()
    expect(wrapper.find('module-editor-stub').exists()).toBe(false)
    expect((wrapper.get('#edit-profile input').element as HTMLInputElement).value).toBe('保留这个名字')
    await button('连续填写').trigger('click')
    await button('保存我的名片').trigger('click')
    await flushPromises()
    expect(cardApi.save).toHaveBeenCalledWith(expect.objectContaining({
      name: '保留这个名字',
      theme: 'forest',
      appearance: expect.objectContaining({ template: 'signature', layout: 'minimal', decoration: false }),
      pages: [{ id: 'main', title: '主页', columns: 1 }],
      sections: basicCardBody(card(false)).sections,
    }), { basicOnly: true })
    wrapper.unmount()
  })

  it('refreshes rejected VIP access without discarding or automatically resubmitting the draft', async () => {
    const { wrapper, button } = await editor(card(true))
    await wrapper.get('#edit-profile input').setValue('会员到期时的草稿')
    await button('连续填写').trigger('click')
    vi.mocked(cardApi.save).mockRejectedValue(new HttpError('请开通 VIP 后使用此功能', 403))
    vi.mocked(cardApi.mine).mockResolvedValue({ ...card(false), ...basicCardBody(card(false)) })
    await button('保存我的名片').trigger('click')
    await flushPromises()
    expect(cardApi.mine).toHaveBeenCalledTimes(2)
    expect(cardApi.save).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="free-card-notice"]').exists()).toBe(true)
    expect(wrapper.find('module-editor-stub').exists()).toBe(false)
    expect((wrapper.get('#edit-profile input').element as HTMLInputElement).value).toBe('会员到期时的草稿')
    expect(wrapper.get('.error-text').text()).toContain('请开通 VIP')
    wrapper.unmount()
  })
})

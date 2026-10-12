import type { Card, MediaUpload } from '@/api/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Edit from './edit.vue'
import { cardApi } from '@/api/card'
import { mediaApi } from '../api/media'
import { parseMediaUpload } from '@/http/validators'
import { defaultAppearance } from '@/utils/appearance'

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
vi.mock('../api/media', () => ({ mediaApi: { upload: vi.fn() } }))

function deferredUpload() {
  let resolve!: (value: MediaUpload) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<MediaUpload>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

const assets: MediaUpload[] = ['a', 'b'].map((id, index) => ({
  url: `/api/media/${id.repeat(24)}`,
  previewUrl: `https://storage.example.test/${index}.png`,
  kind: 'image',
  size: 120,
}))

async function editor() {
  let saved: Card = {
    id: 'c'.repeat(24),
    isVip: true,
    updatedAt: '2026-10-11T00:00:00.000Z',
    name: '品牌设计师',
    title: '',
    company: '',
    phone: '',
    email: '',
    wechat: '',
    location: '',
    bio: '',
    avatar: '',
    website: '',
    tags: [],
    theme: 'forest',
    published: false,
    appearance: { ...defaultAppearance(), template: 'poster', layout: 'poster', brandLogo: '', coverImage: '' },
    pages: [{ id: 'main', title: '主页', columns: 1 }],
    sections: [],
  }
  vi.mocked(cardApi.mine).mockImplementation(async () => saved)
  vi.mocked(cardApi.save).mockImplementation(async (body) => {
    saved = { ...saved, ...body }
    return saved
  })
  const wrapper = mount(Edit, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        CardPreview: true,
        CardSections: true,
        CardHomepage: true,
        ModuleEditor: true,
        CardTemplatePicker: true,
        PageState: true,
        slider: true,
      },
    },
  })
  await lifecycle.load!()
  await flushPromises()
  const button = (label: string) => wrapper.findAll('button').find(item => item.text().includes(label))!
  await button('连续填写').trigger('click')
  const uploads = [deferredUpload(), deferredUpload()]
  vi.mocked(mediaApi.upload)
    .mockImplementationOnce(() => uploads[0].promise)
    .mockImplementationOnce(() => uploads[1].promise)
  return { wrapper, button, uploads, saved: () => saved }
}

describe('brand poster uploads in the real card editor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('VITE_SERVER_BASEURL', 'http://localhost:3000/api')
    vi.stubGlobal('definePage', vi.fn())
    vi.stubGlobal('uni', { ...uni, pageScrollTo: vi.fn() })
    vi.mocked(mediaApi.upload).mockReset()
    vi.mocked(uni.chooseImage).mockResolvedValue({ errMsg: 'chooseImage:ok', tempFilePaths: ['selected-image.png'], tempFiles: [] })
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it.each([0, 1])('waits for both images when upload %i completes first', async (first) => {
    const { wrapper, button, uploads } = await editor()
    try {
      await button('上传品牌 Logo').trigger('click')
      await flushPromises()
      expect(button('上传海报人物图').attributes('disabled')).toBeUndefined()
      await button('上传海报人物图').trigger('click')
      await flushPromises()
      expect(mediaApi.upload).toHaveBeenCalledTimes(2)
      expect(button('媒体正在上传').attributes('disabled')).toBeDefined()

      uploads[first].resolve(assets[first])
      await flushPromises()
      expect(button('媒体正在上传').attributes('disabled')).toBeDefined()
      await button('媒体正在上传').trigger('click')
      expect(cardApi.save).not.toHaveBeenCalled()

      uploads[1 - first].resolve(assets[1 - first])
      await flushPromises()
      expect(button('保存我的名片').attributes('disabled')).toBeUndefined()
      await button('保存我的名片').trigger('click')
      await flushPromises()
      expect(cardApi.save).toHaveBeenCalledWith(expect.objectContaining({ appearance: expect.objectContaining({ brandLogo: assets[0].url, coverImage: assets[1].url }) }))
    }
    finally { wrapper.unmount() }
  })

  it.each([0, 1])('preserves both images and current appearance when upload %i resolves first in the same tick', async (first) => {
    const { wrapper, button, uploads } = await editor()
    try {
      await button('上传品牌 Logo').trigger('click')
      await flushPromises()
      await button('上传海报人物图').trigger('click')
      await flushPromises()
      await wrapper.get('textarea[placeholder="写一句代表你的话，可换行"]').setValue('上传期间修改的封面文案')

      uploads[first].resolve(assets[first])
      uploads[1 - first].resolve(assets[1 - first])
      await flushPromises()

      expect(button('保存我的名片').attributes('disabled')).toBeUndefined()
      await button('保存我的名片').trigger('click')
      await flushPromises()
      expect(cardApi.save).toHaveBeenCalledWith(expect.objectContaining({ appearance: expect.objectContaining({
        brandLogo: assets[0].url,
        coverImage: assets[1].url,
        coverTitle: '上传期间修改的封面文案',
      }) }))
    }
    finally { wrapper.unmount() }
  })

  it.each([0, 1])('keeps saving locked when upload %i fails while the other image is pending', async (failed) => {
    const { wrapper, button, uploads } = await editor()
    try {
      await button('上传品牌 Logo').trigger('click')
      await flushPromises()
      await button('上传海报人物图').trigger('click')
      await flushPromises()
      uploads[failed].reject(new Error('图片上传失败'))
      await flushPromises()
      expect(wrapper.text()).toContain('图片上传失败')
      expect(button('媒体正在上传').attributes('disabled')).toBeDefined()
      expect(cardApi.save).not.toHaveBeenCalled()

      uploads[1 - failed].resolve(assets[1 - failed])
      await flushPromises()
      expect(button('保存我的名片').attributes('disabled')).toBeUndefined()
      await button('保存我的名片').trigger('click')
      await flushPromises()
      expect(cardApi.save).toHaveBeenCalledTimes(1)
      expect(cardApi.save).toHaveBeenCalledWith(expect.objectContaining({ appearance: expect.objectContaining({
        brandLogo: failed === 0 ? '' : assets[0].url,
        coverImage: failed === 1 ? '' : assets[1].url,
      }) }))
    }
    finally { wrapper.unmount() }
  })

  it('saves committed media despite preview failure and displays the recovered preview on refresh', async () => {
    const { wrapper, button, uploads, saved } = await editor()
    try {
      await button('上传品牌 Logo').trigger('click')
      await flushPromises()
      uploads[0].resolve(parseMediaUpload({ url: assets[0].url, kind: 'image', size: 120, mediaUnavailable: true }))
      await flushPromises()
      expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '上传成功，预览暂时不可用，可继续保存', icon: 'none' }))
      expect(button('保存我的名片').attributes('disabled')).toBeUndefined()
      await button('保存我的名片').trigger('click')
      await flushPromises()
      expect(cardApi.save).toHaveBeenCalledWith(expect.objectContaining({ appearance: expect.objectContaining({ brandLogo: assets[0].url }) }))

      vi.mocked(cardApi.mine).mockResolvedValue({ ...saved(), mediaAccess: { [assets[0].url]: assets[0].previewUrl! } })
      await lifecycle.show!()
      await flushPromises()
      expect(wrapper.get('.poster-editor .cover-thumbnail').attributes('src')).toBe(assets[0].previewUrl)
    }
    finally { wrapper.unmount() }
  })
})

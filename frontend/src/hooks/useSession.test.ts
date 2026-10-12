import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureSession } from './useSession'
import { cardApi } from '@/api/card'
import type { LoginResponse } from '@/api/types'
import { HttpError, request } from '@/http'
import { useSessionStore } from '@/store/session'

vi.mock('@/api/card', () => ({ cardApi: { demoLogin: vi.fn(), wechatLogin: vi.fn() } }))
const wechatResponse: LoginResponse = { token: 'wechat-token', expiresIn: 604800, mode: 'wechat', card: {} as LoginResponse['card'] }

describe('wechat session lifecycle', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_LOGIN_MODE', 'demo')
    vi.stubEnv('VITE_BACKEND_MODE', 'http')
    vi.stubEnv('VITE_SERVER_BASEURL', 'http://localhost:3000/api')
    vi.mocked(cardApi.wechatLogin).mockResolvedValue(wechatResponse)
  })
  it('requires an explicit WeChat login and rejects cached experience sessions in the normal app', async () => {
    vi.stubEnv('VITE_LOGIN_MODE', 'wechat')
    const session = useSessionStore()
    expect(session.mode).toBe('wechat')
    await expect(ensureSession()).rejects.toThrow('请使用微信登录')
    session.mode = 'demo'
    session.token = 'cached-demo-token'
    session.expiresAt = Date.now() + 60000
    session.devKey = 'a'.repeat(64)
    await expect(ensureSession()).rejects.toThrow('请使用微信登录')
    expect(session.token).toBe('')
    expect(session.devKey).toBe('')
    expect(session.mode).toBe('wechat')
    expect(cardApi.demoLogin).not.toHaveBeenCalled()
    expect(cardApi.wechatLogin).not.toHaveBeenCalled()
  })
  it('invalidates legacy password sessions before accepting cached tokens', async () => {
    const session = useSessionStore()
    Object.assign(session, { mode: 'account', token: 'old-password-token', expiresAt: Date.now() + 60000 })
    await expect(ensureSession()).rejects.toThrow('请使用微信登录')
    expect(session.token).toBe('')
    expect(session.mode).toBe('wechat')
    expect(cardApi.demoLogin).not.toHaveBeenCalled()
  })
  it('does not replace an expired WeChat account with an automatic experience login', async () => {
    const session = useSessionStore()
    session.mode = 'wechat'
    await expect(ensureSession()).rejects.toThrow('请使用微信登录')
    expect(cardApi.demoLogin).not.toHaveBeenCalled()
  })
  it('explicit logout prevents automatic experience login', async () => {
    const session = useSessionStore()
    session.logout()
    await expect(ensureSession()).rejects.toThrow('请使用微信登录')
    expect(cardApi.demoLogin).not.toHaveBeenCalled()
  })
  it('an explicit WeChat action after logout always uses WeChat, including in demo configuration', async () => {
    vi.stubEnv('VITE_BACKEND_MODE', 'cloud')
    const session = useSessionStore()
    session.logout()
    await ensureSession(true)
    expect(cardApi.wechatLogin).toHaveBeenCalledWith('')
    expect(cardApi.demoLogin).not.toHaveBeenCalled()
    expect(session.mode).toBe('wechat')
    expect(session.token).toBe('wechat-token')
    expect(session.autoLoginDisabled).toBe(false)
  })
  it('exchanges a fresh WeChat code in HTTP mode', async () => {
    const login = vi.fn().mockResolvedValue({ code: 'fresh-wechat-code' })
    Object.assign(uni, { login })
    await ensureSession(true)
    expect(login).toHaveBeenCalledWith({ provider: 'weixin' })
    expect(cardApi.wechatLogin).toHaveBeenCalledWith('fresh-wechat-code')
    expect(cardApi.demoLogin).not.toHaveBeenCalled()
  })
  it('retains a valid explicitly enabled test session for interactive authenticated actions', async () => {
    const session = useSessionStore()
    session.mode = 'demo'
    session.token = 'active-test-token'
    session.expiresAt = Date.now() + 60000
    await ensureSession(true)
    expect(session.token).toBe('active-test-token')
    expect(session.mode).toBe('demo')
    expect(cardApi.demoLogin).not.toHaveBeenCalled()
    expect(cardApi.wechatLogin).not.toHaveBeenCalled()
  })
  it('does not create a session when WeChat returns no code or authorization fails', async () => {
    Object.assign(uni, { login: vi.fn().mockResolvedValue({ code: '' }) })
    await expect(ensureSession(true)).rejects.toThrow('未获取到微信登录凭证')
    expect(cardApi.wechatLogin).not.toHaveBeenCalled()
    expect(useSessionStore().token).toBe('')
    vi.stubEnv('VITE_BACKEND_MODE', 'cloud')
    vi.mocked(cardApi.wechatLogin).mockRejectedValueOnce(new HttpError('微信授权失败', 401))
    await expect(ensureSession(true)).rejects.toThrow('微信授权失败')
    expect(useSessionStore().token).toBe('')
    expect(cardApi.demoLogin).not.toHaveBeenCalled()
  })
  it('merges concurrent WeChat authorization requests', async () => {
    vi.stubEnv('VITE_BACKEND_MODE', 'cloud')
    await Promise.all([ensureSession(true), ensureSession(true)])
    expect(cardApi.wechatLogin).toHaveBeenCalledTimes(1)
    expect(useSessionStore().token).toBe('wechat-token')
  })
  it('a pending WeChat login cannot undo logout', async () => {
    vi.stubEnv('VITE_BACKEND_MODE', 'cloud')
    let finish: (value: LoginResponse) => void = () => {}
    vi.mocked(cardApi.wechatLogin).mockImplementationOnce(() => new Promise((resolve) => {
      finish = resolve
    }))
    const session = useSessionStore()
    const pending = ensureSession(true)
    session.logout()
    finish(wechatResponse)
    await expect(pending).rejects.toThrow('登录状态已变化')
    expect(session.token).toBe('')
    expect(session.autoLoginDisabled).toBe(true)
  })
  it('an explicit WeChat login supersedes a pending demo request', async () => {
    vi.stubEnv('VITE_BACKEND_MODE', 'cloud')
    let finish: (value: LoginResponse) => void = () => {}
    vi.mocked(cardApi.demoLogin).mockImplementationOnce(() => new Promise((resolve) => {
      finish = resolve
    }))
    const background = ensureSession()
    await ensureSession(true)
    expect(cardApi.wechatLogin).toHaveBeenCalledTimes(1)
    finish({ ...wechatResponse, mode: 'demo', token: 'demo-token' })
    await background
    expect(useSessionStore().mode).toBe('wechat')
    expect(useSessionStore().token).toBe('wechat-token')
  })
  it('a fresh login after logout does not reuse the obsolete request', async () => {
    vi.stubEnv('VITE_BACKEND_MODE', 'cloud')
    let finish: (value: LoginResponse) => void = () => {}
    vi.mocked(cardApi.wechatLogin).mockImplementationOnce(() => new Promise((resolve) => {
      finish = resolve
    }))
    const obsolete = ensureSession(true)
    useSessionStore().logout()
    await ensureSession(true)
    expect(cardApi.wechatLogin).toHaveBeenCalledTimes(2)
    finish({ ...wechatResponse, token: 'obsolete-token' })
    await obsolete
    expect(useSessionStore().token).toBe('wechat-token')
  })
  it('a pending experience login cannot undo logout', async () => {
    let finish: (value: LoginResponse) => void = () => {}
    vi.mocked(cardApi.demoLogin).mockImplementationOnce(() => new Promise((resolve) => {
      finish = resolve
    }))
    const session = useSessionStore()
    const pending = ensureSession()
    session.logout()
    finish({ ...wechatResponse, token: 'demo-token', mode: 'demo' })
    await expect(pending).rejects.toThrow('登录状态已变化')
    expect(session.token).toBe('')
    expect(session.autoLoginDisabled).toBe(true)
  })
  it('a failed WeChat login does not clear the currently authenticated session', async () => {
    const session = useSessionStore()
    session.token = 'current-wechat-token'
    vi.mocked(uni.request).mockImplementationOnce((options) => {
      options.success?.({ statusCode: 401, data: { code: 401, message: '微信授权失败' }, header: {}, cookies: [], errMsg: '' })
      return {} as UniApp.RequestTask
    })
    await expect(request('/auth/wechat', 'POST', {}, false)).rejects.toBeInstanceOf(HttpError)
    expect(session.token).toBe('current-wechat-token')
  })
  it('a delayed 401 for an older token cannot clear a new login', async () => {
    const session = useSessionStore()
    session.token = 'older-token'
    vi.mocked(uni.request).mockImplementationOnce((options) => {
      session.token = 'new-token'
      options.success?.({ statusCode: 401, data: { code: 401, message: '过期' }, header: {}, cookies: [], errMsg: '' })
      return {} as UniApp.RequestTask
    })
    await expect(request('/me/account')).rejects.toBeInstanceOf(HttpError)
    expect(session.token).toBe('new-token')
  })
})

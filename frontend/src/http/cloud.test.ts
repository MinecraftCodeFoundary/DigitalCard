import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callCloud, initializeCloud } from './cloud'
import { request } from './index'
import { useSessionStore } from '@/store/session'

const cloud = { init: vi.fn(), callFunction: vi.fn() }
describe('weChat cloud transport', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_BACKEND_MODE', 'cloud')
    vi.stubEnv('VITE_CLOUD_ENV', 'cloud-test')
    vi.stubEnv('VITE_CLOUD_FUNCTION', 'digitalCard')
    vi.stubGlobal('wx', { cloud })
  })
  it('initializes once and preserves cloud envelope, method, path and session token', async () => {
    initializeCloud()
    initializeCloud()
    expect(cloud.init).toHaveBeenCalledTimes(1)
    expect(cloud.init).toHaveBeenCalledWith({ env: 'cloud-test', traceUser: true })
    cloud.callFunction.mockResolvedValueOnce({ result: { code: 0, data: { status: 'ok' } } })
    expect(await callCloud('/health', 'GET', undefined, 'token')).toEqual({ code: 0, data: { status: 'ok' } })
    expect(cloud.callFunction).toHaveBeenCalledWith({ name: 'digitalCard', data: { path: '/api/health', method: 'GET', token: 'token' } })
  })
  it('handles function errors and preserves a newer session when an older request expires', async () => {
    const session = useSessionStore()
    session.token = 'old-token'
    cloud.callFunction.mockImplementationOnce(async () => {
      session.token = 'new-token'
      return { result: { code: 401, message: '登录已过期' } }
    })
    await expect(request('/me/card')).rejects.toThrow('登录已过期')
    expect(session.token).toBe('new-token')
    cloud.callFunction.mockRejectedValueOnce(new Error('function not found'))
    await expect(request('/me/card')).rejects.toThrow('确认云函数已部署')
    cloud.callFunction.mockResolvedValueOnce({ result: { code: 401, message: '登录已过期' } })
    await expect(request('/me/card')).rejects.toThrow('登录已过期')
    expect(session.token).toBe('')
  })
})

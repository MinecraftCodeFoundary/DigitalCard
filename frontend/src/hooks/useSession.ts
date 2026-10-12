import { cardApi } from '@/api/card'
import type { LoginResponse } from '@/api/types'
import { HttpError } from '@/http'
import { useSessionStore } from '@/store/session'

let pending: { promise: Promise<void>, generation: number, mode: 'demo' | 'wechat' } | undefined
async function loginWithWechat(): Promise<LoginResponse> {
  let response: LoginResponse | undefined
  // #ifdef MP-WEIXIN
  if (import.meta.env.VITE_BACKEND_MODE === 'cloud') {
    response = await cardApi.wechatLogin('')
  }
  else {
    const result = await uni.login({ provider: 'weixin' })
    if (!result.code)
      throw new Error('未获取到微信登录凭证')
    response = await cardApi.wechatLogin(result.code)
  }
  // #endif
  if (!response)
    throw new HttpError('请在微信小程序中使用微信注册或登录', 401)
  return response
}
export async function ensureSession(interactive = false): Promise<void> {
  const session = useSessionStore()
  if (!['demo', 'wechat'].includes(session.mode)
    || (session.mode === 'demo' && import.meta.env.VITE_LOGIN_MODE !== 'demo')) {
    session.clearToken()
    session.mode = 'wechat'
    session.devKey = ''
  }
  if (session.token && session.expiresAt > Date.now())
    return
  // An authenticated action must not replace a valid isolated test session.
  // When a login is actually needed, an explicit action still uses WeChat.
  if (interactive && session.mode === 'demo') {
    session.clearToken()
    session.mode = 'wechat'
    session.devKey = ''
  }
  const allowDemo = !interactive && session.mode === 'demo' && import.meta.env.VITE_LOGIN_MODE === 'demo'
  if (!interactive && (!allowDemo || session.autoLoginDisabled))
    throw new HttpError('请使用微信登录，继续管理名片', 401)
  const mode = allowDemo ? 'demo' : 'wechat'
  const generation = session.generation
  if (pending?.generation === generation && pending.mode === mode)
    return pending.promise
  const promise = (async () => {
    let response
    // This mode is used only by the isolated automated test server.
    if (allowDemo) {
      try {
        response = await cardApi.demoLogin(session.devKey || undefined)
      }
      catch (error) {
        if (!(error instanceof HttpError) || error.status !== 401)
          throw error
        if (session.generation !== generation)
          throw new HttpError('登录状态已变化，请重新登录', 401)
        session.devKey = ''
        response = await cardApi.demoLogin()
      }
    }
    else {
      response = await loginWithWechat()
    }
    if (session.generation !== generation) {
      if (session.token && session.expiresAt > Date.now())
        return
      throw new HttpError('登录状态已变化，请重新登录', 401)
    }
    session.applyLogin(response)
  })()
  const attempt: NonNullable<typeof pending> = { promise, generation, mode }
  pending = attempt
  try {
    await promise
  }
  finally {
    if (pending === attempt)
      pending = undefined
  }
}

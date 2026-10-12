import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LoginResponse } from '@/api/types'

export const useSessionStore = defineStore(
  'digital-card-session',
  () => {
    const token = ref('')
    const devKey = ref('')
    const expiresAt = ref(0)
    const mode = ref<'demo' | 'wechat'>(import.meta.env.VITE_LOGIN_MODE === 'demo' ? 'demo' : 'wechat')
    const autoLoginDisabled = ref(false)
    const generation = ref(0)
    function clearToken() {
      token.value = ''
      expiresAt.value = 0
      generation.value++
    }
    function applyLogin(response: LoginResponse) {
      generation.value++
      token.value = response.token
      devKey.value = response.devKey || ''
      mode.value = response.mode
      expiresAt.value = Date.now() + response.expiresIn * 1000
      autoLoginDisabled.value = false
    }
    function logout() {
      clearToken()
      autoLoginDisabled.value = true
    }
    return { token, devKey, expiresAt, mode, autoLoginDisabled, generation, clearToken, applyLogin, logout }
  },
  {
    persist: {
      paths: ['token', 'devKey', 'expiresAt', 'mode', 'autoLoginDisabled'],
      afterRestore: ({ store }) => {
        if (
          typeof store.token !== 'string'
          || typeof store.expiresAt !== 'number'
          || !Number.isFinite(store.expiresAt)
          || store.expiresAt <= Date.now()
        ) {
          store.clearToken()
        }
        if (typeof store.devKey !== 'string' || !/^[a-f\d]{64}$/.test(store.devKey))
          store.devKey = ''
        if (!['demo', 'wechat'].includes(store.mode)
          || (store.mode === 'demo' && import.meta.env.VITE_LOGIN_MODE !== 'demo')) {
          store.clearToken()
          store.devKey = ''
          store.mode = 'wechat'
        }
        if (typeof store.autoLoginDisabled !== 'boolean')
          store.autoLoginDisabled = false
      },
    },
  },
)

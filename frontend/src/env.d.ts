/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_SERVER_BASEURL: string
  readonly VITE_LOGIN_MODE: 'wechat' | 'demo'
  readonly VITE_BACKEND_MODE: 'cloud' | 'http'
  readonly VITE_CLOUD_ENV: string
  readonly VITE_CLOUD_FUNCTION: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

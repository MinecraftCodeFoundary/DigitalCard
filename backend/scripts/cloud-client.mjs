import cloudbase from '@cloudbase/node-sdk'
export function cloudClient() {
  if (!process.env.TCB_SECRET_ID || !process.env.TCB_SECRET_KEY)
    throw new Error('请在 backend/.env 中配置 TCB_SECRET_ID / TCB_SECRET_KEY；不要写入前端或提交到 Git')
  return cloudbase.init({ env: process.env.CLOUD_ENV_ID || 'cloud1-d5g9aguo13adf0f36',
    secretId: process.env.TCB_SECRET_ID, secretKey: process.env.TCB_SECRET_KEY,
    ...(process.env.TCB_SESSION_TOKEN ? { sessionToken: process.env.TCB_SESSION_TOKEN } : {}),
    throwOnCode: true,
  })
}
export function checked(result) {
  if (result?.code) throw new Error(`${result.code}: ${result.message || 'Cloud operation failed'}`)
  return result
}

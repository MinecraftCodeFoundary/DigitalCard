import cloudbase from '@cloudbase/node-sdk'
import { buildGateway } from './gateway.mjs'

const cloud = process.env.TCB_SECRET_ID && process.env.TCB_SECRET_KEY ? cloudbase.init({
  env: process.env.CLOUD_ENV_ID || 'cloud1-d5g9aguo13adf0f36',
  secretId: process.env.TCB_SECRET_ID, secretKey: process.env.TCB_SECRET_KEY,
  ...(process.env.TCB_SESSION_TOKEN ? { sessionToken: process.env.TCB_SESSION_TOKEN } : {}),
}) : undefined
const app = await buildGateway({ cloud, functionName: process.env.CLOUD_FUNCTION_NAME || 'digitalCard',
  logger: true, corsOrigins: process.env.CORS_ORIGINS })
try {
  await app.listen({ port: Number(process.env.PORT || 3000), host: process.env.HOST || '0.0.0.0' })
}
catch (error) {
  app.log.error(error)
  process.exit(1)
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => { await app.close(); process.exit(0) })
}

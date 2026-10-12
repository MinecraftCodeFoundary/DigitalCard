import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { buildApp } from '../../backend/src/app.mjs'

const directory = resolve(mkdtempSync(join(tmpdir(), 'digital-card-e2e-')))
const app = await buildApp({
  nodeEnv: 'test', demoEnabled: true, testVipFixtures: true, rateLimitMax: 1000,
  databasePath: join(directory, 'test.sqlite'), mediaDirectory: join(directory, 'media'),
  jwtSecret: randomBytes(32).toString('hex'),
  corsOrigins: 'http://localhost:9100,http://127.0.0.1:9100', webUrl: 'http://localhost:9100',
})
await app.listen({ port: 3100, host: '127.0.0.1' })
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await app.close()
    if (dirname(directory) === resolve(tmpdir()) && basename(directory).startsWith('digital-card-e2e-'))
      rmSync(directory, { recursive: true, force: true })
    process.exit(0)
  })
}

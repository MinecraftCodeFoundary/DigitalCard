import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { constants } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { loadConfigFromFile } from 'vite'

async function main() {
  const args = process.argv.slice(2)
  const root = process.cwd()
  const build = args[0] === 'build'
  const watch = args.includes('--watch') || args.includes('-w')
  const defaultMode = build && !watch ? 'production' : 'development'
  const modeIndex = args.findIndex(arg => arg === '--mode' || arg === '-m')
  const mode = (modeIndex >= 0 ? args[modeIndex + 1] : undefined)
    || args.find(arg => arg.startsWith('--mode='))?.slice('--mode='.length)
    || defaultMode

  process.env.NODE_ENV = defaultMode
  // uni caches manifest.json in initEnv, before it loads any Vite plugins.
  // Generate from the same config first, so even a clean checkout builds correctly.
  const loaded = await loadConfigFromFile(
    { command: build ? 'build' : 'serve', mode },
    path.resolve(root, 'manifest.config.ts'),
    root,
  )
  if (!loaded)
    throw new Error('无法加载 manifest.config.ts')
  const inputDir = path.resolve(root, process.env.UNI_INPUT_DIR || 'src')
  mkdirSync(inputDir, { recursive: true })
  writeFileSync(path.join(inputDir, 'manifest.json'), `${JSON.stringify(loaded.config, null, 2)}\n`)

  const require = createRequire(path.join(root, 'package.json'))
  const cli = require.resolve('@dcloudio/vite-plugin-uni/bin/uni.js')
  const child = spawn(process.execPath, [cli, ...args], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  })
  const signals = ['SIGINT', 'SIGTERM']
  const handlers = signals.map(signal => [signal, () => child.kill(signal)])
  for (const [signal, handler] of handlers)
    process.on(signal, handler)
  try {
    const { code, signal } = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code, signal) => resolve({ code, signal }))
    })
    process.exitCode = code ?? (128 + (constants.signals[signal] || 1))
  }
  finally {
    for (const [signal, handler] of handlers)
      process.off(signal, handler)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'

const wrapper = path.resolve(process.cwd(), 'scripts/uni-with-manifest.mjs')
const fixtures: string[] = []

function fixture(manifest?: object) {
  const root = mkdtempSync(path.join(tmpdir(), 'digital-card-manifest-'))
  fixtures.push(root)
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }))
  writeFileSync(path.join(root, 'manifest.config.ts'), `
    export default ({ command, mode }: { command: string, mode: string }) => ({
      name: 'current config',
      command,
      mode,
      args: process.argv.slice(2),
      'mp-weixin': { lazyCodeLoading: 'requiredComponents' },
    })
  `)
  if (manifest) {
    mkdirSync(path.join(root, 'src'))
    writeFileSync(path.join(root, 'src/manifest.json'), JSON.stringify(manifest))
  }
  const cliDir = path.join(root, 'node_modules/@dcloudio/vite-plugin-uni')
  mkdirSync(path.join(cliDir, 'bin'), { recursive: true })
  writeFileSync(path.join(cliDir, 'package.json'), JSON.stringify({ name: '@dcloudio/vite-plugin-uni' }))
  writeFileSync(path.join(cliDir, 'bin/uni.js'), `
    const fs = require('node:fs')
    const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'))
    console.log(JSON.stringify({ cliStarted: true, manifest, args: process.argv.slice(2) }))
    process.exitCode = Number(process.env.FIXTURE_EXIT_CODE || 0)
  `)
  return root
}

function run(root: string, args: string[], extraEnv: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [wrapper, ...args], {
    cwd: root,
    env: { ...process.env, UNI_INPUT_DIR: undefined, ...extraEnv },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  })
  expect(result.error).toBeUndefined()
  return result
}

afterEach(() => {
  for (const root of fixtures.splice(0)) {
    // Only remove the absolute directories created by this test.
    expect(path.dirname(root)).toBe(path.resolve(tmpdir()))
    expect(path.basename(root)).toMatch(/^digital-card-manifest-/)
    rmSync(root, { recursive: true, force: true })
  }
})

describe('uni CLI manifest generation', () => {
  it.each([undefined, { name: 'stale config', staleOnly: true }])('writes current config before the CLI first reads a missing or stale manifest (%j)', (previous) => {
    const root = fixture(previous)
    const result = run(root, ['build', '-p', 'mp-weixin'])
    expect(result.status).toBe(0)
    const { manifest, cliStarted } = JSON.parse(result.stdout)
    expect(cliStarted).toBe(true)
    expect(manifest.name).toBe('current config')
    expect(manifest.staleOnly).toBeUndefined()
    expect(manifest['mp-weixin'].lazyCodeLoading).toBe('requiredComponents')
    expect(JSON.parse(readFileSync(path.join(root, 'src/manifest.json'), 'utf8'))).toEqual(manifest)
  })

  it.each([
    { args: [], command: 'serve', mode: 'development' },
    { args: ['build'], command: 'build', mode: 'production' },
    { args: ['build', '-w', '-p', 'mp-weixin'], command: 'build', mode: 'development' },
    { args: ['-p', 'mp-weixin', '--mode', 'production'], command: 'serve', mode: 'production' },
    { args: ['build', '--mode', 'test', '--outDir', 'folder with spaces'], command: 'build', mode: 'test' },
  ])('preserves arguments and selects the configuration environment for $args', ({ args, command, mode }) => {
    const result = run(fixture(), args)
    expect(result.status).toBe(0)
    const output = JSON.parse(result.stdout)
    expect(output.args).toEqual(args)
    expect(output.manifest.args).toEqual(args)
    expect(output.manifest.command).toBe(command)
    expect(output.manifest.mode).toBe(mode)
  })

  it('does not start the CLI or overwrite the old manifest when configuration fails', () => {
    const root = fixture({ name: 'preserved config' })
    writeFileSync(path.join(root, 'manifest.config.ts'), `throw new Error('fixture config failure')`)
    const result = run(root, ['build'])
    expect(result.status).toBe(1)
    expect(result.stdout).not.toContain('cliStarted')
    expect(result.stderr).toContain('fixture config failure')
    expect(JSON.parse(readFileSync(path.join(root, 'src/manifest.json'), 'utf8'))).toEqual({ name: 'preserved config' })
  })

  it('preserves the CLI failure exit code', () => {
    const root = fixture()
    const result = run(root, ['build'], { FIXTURE_EXIT_CODE: '7' })
    expect(result.status).toBe(7)
    expect(existsSync(path.join(root, 'src/manifest.json'))).toBe(true)
  })
})

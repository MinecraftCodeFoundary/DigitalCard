import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expiryTimestamp, membershipProfile } from '../../cloudfunctions/digitalCard/membership.mjs'

export const usage = `用法：
  node --env-file-if-exists=backend/.env backend/scripts/set-membership.mjs status --user-id <账号ID>
  node --env-file-if-exists=backend/.env backend/scripts/set-membership.mjs grant --user-id <账号ID> [--expires-at <带时区的ISO时间>] [--apply]
  node --env-file-if-exists=backend/.env backend/scripts/set-membership.mjs revoke --user-id <账号ID> [--apply]
grant 不指定 expires-at 时开通永久 VIP；未指定 --apply 时仅预览，不修改云端。`

export function parseMembershipArgs(args, clockValue = Date.now()) {
  const [action, ...rest] = args
  if (!['status', 'grant', 'revoke'].includes(action)) throw new Error(usage)
  const options = { action, apply: false }
  const seen = new Set()
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index]
    if (!['--user-id', '--expires-at', '--apply'].includes(flag) || seen.has(flag)) throw new Error(`未知或重复参数：${flag}\n${usage}`)
    seen.add(flag)
    if (flag === '--apply') { options.apply = true; continue }
    const value = rest[++index]
    if (!value || value.startsWith('--')) throw new Error(`参数 ${flag} 缺少值`)
    options[flag === '--user-id' ? 'userId' : 'expiresAt'] = value
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(options.userId || '')) throw new Error('请提供完整且有效的账号 ID，不支持搜索、通配符或批量操作')
  if (action !== 'grant' && options.expiresAt !== undefined) throw new Error('只有 grant 可以指定 --expires-at')
  if (action === 'status' && options.apply) throw new Error('status 为只读操作，不接受 --apply')
  if (options.expiresAt !== undefined) {
    const expiry = expiryTimestamp(options.expiresAt)
    if (!Number.isFinite(expiry) || expiry <= clockValue) throw new Error('到期时间必须是未来的 ISO 时间，并包含 Z 或 +08:00 等明确时区')
    options.expiresAt = new Date(expiry).toISOString()
  }
  return options
}

function checked(result) {
  if (result?.code) throw new Error(`${result.code}: ${result.message || 'Cloud operation failed'}`)
  return result
}

export async function executeMembership(database, options, clock = () => Date.now()) {
  const inspect = async (store, write) => {
    const document = store.collection('users').doc(options.userId)
    const response = checked(await document.get())
    const user = Array.isArray(response.data) ? response.data[0] : response.data
    if (!user || user.id !== options.userId) throw new Error(`账号 ${options.userId} 不存在或记录不匹配，未修改任何数据`)
    const currentTime = clock()
    const before = membershipProfile(user, currentTime)
    const membership = options.action === 'grant'
      ? { plan: 'vip', expiresAt: options.expiresAt ?? null } : { plan: 'free', expiresAt: null }
    if (options.action === 'grant' && membership.expiresAt !== null && expiryTimestamp(membership.expiresAt) <= currentTime)
      throw new Error('到期时间已过，请重新设置未来的到期时间')
    if (write) checked(await document.update({ membership, membershipUpdatedAt: new Date(currentTime).toISOString() }))
    return { userId: user.id, cardId: user.cardId, action: options.action, applied: write, before,
      after: options.action === 'status' ? before : membershipProfile({ membership }, currentTime) }
  }
  return options.apply ? database.runTransaction(tx => inspect(tx, true)) : inspect(database, false)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { console.log(usage); return }
  const options = parseMembershipArgs(args)
  // Load credentials only after validating the entire operation. No client-facing
  // API can invoke this script or supply privileged CloudBase credentials.
  const { cloudClient } = await import('./cloud-client.mjs')
  const result = await executeMembership(cloudClient().database(), options)
  console.log(JSON.stringify(result, null, 2))
  if (options.action !== 'status' && !options.apply) console.log('只读预览完成；添加 --apply 执行以上变更。')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { console.error(error.message); process.exitCode = 1 })

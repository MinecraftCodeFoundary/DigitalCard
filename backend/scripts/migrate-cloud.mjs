import { DatabaseSync } from 'node:sqlite'
import { readFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { migrationPlan } from './migration-plan.mjs'
import { cloudClient, checked } from './cloud-client.mjs'
import { inspectFile } from '../../cloudfunctions/digitalCard/storage.mjs'
const path = resolve(process.env.DATABASE_PATH || 'backend/data/digital-card.sqlite')
const db = new DatabaseSync(path, { readOnly: true })
const plan = migrationPlan(db)
db.close()
console.log(JSON.stringify({ documents: plan.writes.length, media: plan.media.length,
  excludedDemoOrSampleUsers: plan.excludedUsers, apply: process.argv.includes('--apply') }))
if (!process.argv.includes('--apply')) {
  console.log('只读预检完成。备份 SQLite 与媒体后，npm run cloud:migrate -- --apply 执行一次性迁移。')
  process.exit(0)
}
const cloud = cloudClient()
const target = cloud.database()
// Refuse to merge a legacy snapshot into live data: preserves newer accounts,
// usernames and password versions. Do this once before accepting registrations.
for (const name of ['users', 'cards', 'credentials', 'usernames', 'identities', 'favorites', 'views', 'messages', 'media']) {
  if (checked(await target.collection(name).count()).total) throw new Error(`集合 ${name} 非空，停止迁移以免覆盖云端数据`)
}
const directory = resolve(process.env.MEDIA_DIRECTORY || resolve(dirname(path), 'media'))
// Read and validate every source before creating any cloud data.
const files = []
for (const row of plan.media) {
  const filePath = resolve(directory, row.filename)
  if (!filePath.startsWith(directory + sep)) throw new Error('媒体文件路径超出迁移目录')
  const buffer = await readFile(filePath)
  const type = await inspectFile(buffer)
  files.push({ row, buffer, type })
}
const uploaded = []
try {
  for (const { row, buffer, type } of files) {
    const { fileID } = checked(await cloud.uploadFile({ cloudPath: `media/${row.owner_id}/migrated-${row.id}.${type.ext}`, fileContent: buffer }))
    uploaded.push(fileID)
    plan.writes.push({ collection: 'media', id: row.id, data: { id: row.id, ownerId: row.owner_id, fileID,
      ...type, createdAt: row.created_at } })
  }
  // A single database transaction makes a failed import safe to retry.
  await target.runTransaction(async tx => {
    for (const write of plan.writes) {
      const existing = checked(await tx.collection(write.collection).doc(write.id).get()).data
      if (Array.isArray(existing) ? existing.length : existing) throw new Error('迁移期间发现冲突的云端数据，已停止以免覆盖')
      checked(await tx.collection(write.collection).doc(write.id).set(write.data))
    }
  })
}
catch (error) {
  for (let offset = 0; offset < uploaded.length; offset += 50)
    await cloud.deleteFile({ fileList: uploaded.slice(offset, offset + 50) }).catch(() => {})
  throw error
}
console.log('迁移完成。原 SQLite 和本地媒体保持原样；旧登录凭证失效，请重新登录。')

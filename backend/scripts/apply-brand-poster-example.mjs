import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { buildApp } from '../src/app.mjs'

// Local development fixture loader. Uploads and saves through the same validated
// routes as the editor; it never changes credentials or exposes an admin route.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const cardId = args[args.indexOf('--card') + 1]
if (!args.includes('--card') || !/^[a-f\d]{24}$/.test(cardId || ''))
  throw new Error('Usage: node backend/scripts/apply-brand-poster-example.mjs --card <24-hex-id> [--restore <backup-json>]')
const databasePath = resolve(process.env.DATABASE_PATH || resolve(root, 'backend/data/digital-card.sqlite'))
const reader = new DatabaseSync(databasePath, { readOnly: true })
const row = reader.prepare('SELECT cards.*, users.identity FROM cards JOIN users ON users.id = cards.owner_id WHERE cards.id = ?').get(cardId)
reader.close()
if (!row || !row.identity.startsWith('demo:')) throw new Error('This fixture loader only updates an existing local demo card.')
const assetsPath = resolve(root, 'assets/brand-poster-example')
const backupsPath = resolve(root, 'artifacts/brand-poster-backups')
await mkdir(backupsPath, { recursive: true })
const backupPath = resolve(backupsPath, `${cardId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
await writeFile(backupPath, JSON.stringify(JSON.parse(row.body), null, 2) + '\n', { flag: 'wx' })
const app = await buildApp({ databasePath, demoEnabled: false })
await app.ready()
const authorization = `Bearer ${app.jwt.sign({ sub: row.owner_id })}`
try {
  let body
  if (args.includes('--restore')) {
    body = JSON.parse(await readFile(resolve(args[args.indexOf('--restore') + 1]), 'utf8'))
  }
  else {
    body = JSON.parse(await readFile(resolve(assetsPath, 'card.template.json'), 'utf8'))
    const media = {}
    for (const name of ['portrait.png', 'business-materials.png', 'business-implant.png', 'business-channel.png']) {
      const data = await readFile(resolve(assetsPath, name))
      const form = new FormData()
      form.append('file', new Blob([data], { type: 'image/png' }), basename(name))
      const request = new Request('http://localhost/api/media', { method: 'POST', body: form })
      const response = await app.inject({ method: 'POST', url: '/api/media', headers: {
        authorization, 'content-type': request.headers.get('content-type'),
      }, payload: Buffer.from(await request.arrayBuffer()) })
      if (response.statusCode !== 200) throw new Error(`${name}: ${response.body}`)
      media[name] = response.json().data.url
    }
    body.appearance.coverImage = media[body.appearance.coverImage]
    for (const section of body.sections)
      for (const block of section.blocks || [])
        if (block.images) block.images = block.images.map(name => media[name])
    // Preserve the user's existing publication setting.
    body.published = JSON.parse(row.body).published
  }
  const response = await app.inject({ method: 'PUT', url: '/api/me/card', headers: { authorization }, payload: body })
  if (response.statusCode !== 200) throw new Error(response.body)
  await writeFile(resolve(assetsPath, 'card.saved.json'), JSON.stringify(body, null, 2) + '\n')
  console.log(JSON.stringify({ cardId, preview: `http://localhost:9000/#/pages/card/card?id=${cardId}`, backupPath,
    saved: resolve(assetsPath, 'card.saved.json'), blocks: body.sections.flatMap(section => section.blocks || []).length }))
}
finally { await app.close() }

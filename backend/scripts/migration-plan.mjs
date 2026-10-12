import { randomBytes } from 'node:crypto'
import { digest } from '../../cloudfunctions/digitalCard/service.mjs'
export function migrationPlan(db) {
  const writes = []
  const add = (collection, id, data) => writes.push({ collection, id, data })
  const credentials = db.prepare('SELECT * FROM account_credentials').all()
  const accounts = new Map(credentials.map(account => [account.user_id, account]))
  const users = db.prepare('SELECT * FROM users').all().filter(user => accounts.has(user.id) || user.identity.startsWith('wx:'))
  const userIds = new Set(users.map(user => user.id))
  const cards = db.prepare('SELECT * FROM cards').all().filter(card => userIds.has(card.owner_id))
  const cardIds = new Set(cards.map(card => card.id))
  for (const user of users) {
    const card = cards.find(card => card.owner_id === user.id)
    if (!card) throw new Error(`账号 ${user.id} 缺少名片，停止迁移`)
    const identity = user.identity.startsWith('demo:') ? `account:${user.id}` : user.identity
    add('users', user.id, { id: user.id, identity, cardId: card.id,
      analyticsSalt: randomBytes(32).toString('hex'), createdAt: user.created_at })
    if (identity.startsWith('wx:')) add('identities', digest(identity), { userId: user.id })
  }
  for (const account of credentials.filter(account => userIds.has(account.user_id))) {
    add('credentials', account.user_id, { ...account, userId: account.user_id })
    add('usernames', digest(account.username), { userId: account.user_id })
  }
  for (const card of cards) add('cards', card.id, { id: card.id, ownerId: card.owner_id, body: JSON.parse(card.body), updatedAt: card.updated_at })
  for (const favorite of db.prepare('SELECT * FROM favorites').all().filter(row => userIds.has(row.user_id) && cardIds.has(row.card_id)))
    add('favorites', digest(`${favorite.user_id}:${favorite.card_id}`), { userId: favorite.user_id, cardId: favorite.card_id, createdAt: favorite.created_at })
  for (const view of db.prepare('SELECT * FROM views').all().filter(row => cardIds.has(row.card_id)))
    add('views', digest(`${view.card_id}:${view.visitor}:${view.day}`), { cardId: view.card_id, visitor: view.visitor, day: view.day, createdAt: view.created_at })
  for (const message of db.prepare('SELECT * FROM messages').all().filter(row => cardIds.has(row.card_id)))
    add('messages', message.id, { id: message.id, cardId: message.card_id, name: message.name, contact: message.contact, content: message.content, createdAt: message.created_at })
  const media = db.prepare('SELECT * FROM media').all().filter(row => userIds.has(row.owner_id))
  return { writes, media, excludedUsers: db.prepare('SELECT COUNT(*) AS n FROM users').get().n - users.length }
}

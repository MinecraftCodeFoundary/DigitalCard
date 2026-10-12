export function accountProfile(user, membership) {
  return { id: user.id, mode: user.identity.startsWith('demo:') ? 'demo' : 'wechat', createdAt: user.created_at,
    ...(membership ? { membership } : {}) }
}

export function registerAccountRoutes(app, { db, auth, profile = accountProfile }) {
  app.get('/api/me/account', { preHandler: auth }, async request => ({ code: 0,
    data: profile(db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.sub)) }))
  app.post('/api/auth/logout', { preHandler: auth }, async request => {
    db.prepare('DELETE FROM revoked_tokens WHERE expires_at <= ?').run(Math.floor(Date.now() / 1000))
    const tokenId = request.user.jti || request.headers.authorization.slice(7)
    db.prepare('INSERT OR IGNORE INTO revoked_tokens VALUES (?, ?)').run(tokenId, request.user.exp)
    return { code: 0, data: { loggedOut: true } }
  })
}

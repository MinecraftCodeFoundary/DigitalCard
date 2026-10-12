export function validMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000)
    return false
  if (/^\/api\/media\/[a-f\d]{24}$/.test(value))
    return true
  return /^https?:\/\//.test(value) && /^https?:\/\/(?:\[[a-f\d:]+\]|[^\s/?#:@]+)(?::\d{1,5})?(?:[/?#]\S*)?$/i.test(value)
}

export function mediaUrl(value: string, access: Record<string, string> = {}) {
  const source = access[value] || value
  if (source.startsWith('/api/media/'))
    return `${import.meta.env.VITE_SERVER_BASEURL.replace(/\/api\/?$/, '')}${source}`
  return source
}

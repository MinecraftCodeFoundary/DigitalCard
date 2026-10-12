import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useHomeCard } from './useHomeCard'
import { cardApi } from '@/api/card'
import { ensureSession } from '@/hooks/useSession'
import { HttpError } from '@/http'

vi.mock('@/api/card', () => ({ cardApi: { mine: vi.fn(), stats: vi.fn() } }))
vi.mock('@/hooks/useSession', () => ({ ensureSession: vi.fn() }))

describe('home card loading', () => {
  beforeEach(() => {
    vi.mocked(ensureSession).mockResolvedValue()
    vi.mocked(cardApi.mine).mockResolvedValue({ id: 'card', name: 'Alice', isVip: true } as Awaited<ReturnType<typeof cardApi.mine>>)
    vi.mocked(cardApi.stats).mockResolvedValue({ views: 3, todayViews: 1, favorites: 2, contacts: 4, days: [] })
    vi.stubGlobal('uni', { ...uni, stopPullDownRefresh: vi.fn() })
  })

  it('loads a free card without requesting VIP statistics', async () => {
    vi.mocked(cardApi.mine).mockResolvedValue({ id: 'card', name: 'Alice', isVip: false } as Awaited<ReturnType<typeof cardApi.mine>>)
    const home = useHomeCard()
    await home.load()
    expect(home.card.value?.name).toBe('Alice')
    expect(cardApi.stats).not.toHaveBeenCalled()
    expect(home.statsError.value).toBe('')
  })

  it('refreshes the card if membership expires between card and statistics requests', async () => {
    vi.mocked(cardApi.mine).mockResolvedValueOnce({ id: 'card', isVip: true } as Awaited<ReturnType<typeof cardApi.mine>>).mockResolvedValueOnce({ id: 'card', isVip: false } as Awaited<ReturnType<typeof cardApi.mine>>)
    vi.mocked(cardApi.stats).mockRejectedValueOnce(new HttpError('VIP 已到期', 403))
    const home = useHomeCard()
    await home.load()
    expect(home.card.value?.isVip).toBe(false)
    expect(home.statsError.value).toBe('')
    expect(home.error.value).toBe('')
  })

  it('shows the card when statistics fail and recovers on refresh', async () => {
    const home = useHomeCard()
    vi.mocked(cardApi.stats).mockRejectedValueOnce(new HttpError('云服务暂时不可用', 500))
    await home.load()
    expect(home.card.value?.name).toBe('Alice')
    expect(home.error.value).toBe('')
    expect(home.stats.value).toBeUndefined()
    expect(home.statsError.value).toBe('云服务暂时不可用')
    expect(home.loading.value).toBe(false)
    await home.load()
    expect(home.stats.value?.views).toBe(3)
    expect(home.statsError.value).toBe('')
  })

  it('merges overlapping page-show and refresh loads', async () => {
    const home = useHomeCard()
    const first = home.load()
    const second = home.load()
    expect(first).toBe(second)
    await Promise.all([first, second])
    expect(cardApi.mine).toHaveBeenCalledTimes(1)
    expect(cardApi.stats).toHaveBeenCalledTimes(1)
    expect(uni.stopPullDownRefresh).toHaveBeenCalledTimes(1)
  })

  it('keeps card failures fatal and session expiry prompts login', async () => {
    const home = useHomeCard()
    vi.mocked(cardApi.mine).mockRejectedValueOnce(new HttpError('名片加载失败', 503))
    await home.load()
    expect(home.card.value).toBeUndefined()
    expect(home.error.value).toBe('名片加载失败')
    vi.mocked(cardApi.stats).mockRejectedValueOnce(new HttpError('登录已过期', 401))
    await home.load()
    expect(home.needsLogin.value).toBe(true)
    expect(home.card.value).toBeUndefined()
    vi.mocked(ensureSession).mockRejectedValueOnce(new HttpError('请登录', 401))
    await home.load()
    expect(home.needsLogin.value).toBe(true)
    expect(home.loading.value).toBe(false)
  })
})

import type { Card, Stats } from '@/api/types'
import { ref } from 'vue'
import { cardApi } from '@/api/card'
import { ensureSession } from '@/hooks/useSession'
import { errorMessage, HttpError } from '@/http'

export function useHomeCard() {
  const card = ref<Card>()
  const stats = ref<Stats>()
  const loading = ref(true)
  const error = ref('')
  const statsError = ref('')
  const needsLogin = ref(false)
  let pending: Promise<void> | undefined

  function load(interactive = false): Promise<void> {
    if (pending)
      return pending
    pending = (async () => {
      loading.value = true
      error.value = ''
      statsError.value = ''
      needsLogin.value = false
      card.value = undefined
      stats.value = undefined
      try {
        await ensureSession(interactive)
        let currentCard = await cardApi.mine()
        if (currentCard.isVip) {
          try {
            stats.value = await cardApi.stats()
          }
          catch (e) {
            if (e instanceof HttpError && e.status === 401)
              throw e
            if (e instanceof HttpError && e.status === 403)
              currentCard = await cardApi.mine()
            if (currentCard.isVip)
              statsError.value = errorMessage(e)
          }
        }
        card.value = currentCard
      }
      catch (e) {
        error.value = errorMessage(e)
        needsLogin.value = e instanceof HttpError && e.status === 401
      }
      finally {
        loading.value = false
        uni.stopPullDownRefresh()
      }
    })().finally(() => {
      pending = undefined
    })
    return pending
  }

  return { card, stats, loading, error, statsError, needsLogin, load }
}

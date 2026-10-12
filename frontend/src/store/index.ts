import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'

const store = createPinia()
store.use(
  createPersistedState({
    storage: {
      getItem(key) {
        const value: unknown = uni.getStorageSync(key)
        return typeof value === 'string' ? value : null
      },
      setItem: uni.setStorageSync,
    },
  }),
)
export default store

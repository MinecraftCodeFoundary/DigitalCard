<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { initializeCloud } from '@/http/cloud'
// Navigation colors are configured in pages.config.ts; all pages use AppShell.
defineOptions({ name: 'YimianApp' })
onLaunch(() => initializeCloud())
</script>

<style lang="scss">
</style>

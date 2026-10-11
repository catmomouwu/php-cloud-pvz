import { useNow } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatRelative } from '@/lib/format'
import { useCloudSync } from './useCloudSync'

/** 侧栏与存档页共用的一行同步状态文案 */
export function useSyncStatusText() {
  const { t, locale } = useI18n()
  const { status, lastSyncedAt } = useCloudSync()
  const now = useNow({ interval: 30_000 })
  return computed(() => {
    if (status.value === 'synced') {
      const time = lastSyncedAt.value ? formatRelative(lastSyncedAt.value, locale.value, now.value.getTime()) : null
      return t('sync.status.synced', { time: time ?? t('sync.justNow') })
    }
    return t(`sync.status.${status.value}`)
  })
}

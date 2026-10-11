<script setup lang="ts">
// 同步需要用户处理的情况：逐个用户的冲突 / 云端有更新 / 同步失败。其余状态不显示。
import { Button, CalloutBanner } from '@felinic/ui'
import { useI18n } from 'vue-i18n'
import { type ProfileConflict, useCloudSync } from '@/composables/useCloudSync'
import { useGameSession } from '@/composables/useGameSession'
import { formatDateTime } from '@/lib/format'

withDefaults(defineProps<{
  size?: 'default' | 'sm'
}>(), {
  size: 'default',
})

const { t, locale } = useI18n()
const sync = useCloudSync()
const session = useGameSession()
const { status, conflicts } = sync

function describe(conflict: ProfileConflict): string {
  const values = {
    version: conflict.remote.version,
    time: formatDateTime(new Date(conflict.remote.updatedAt), locale.value),
  }
  const text = conflict.reason === 'deleted-remotely'
    ? t('sync.conflictDeleted')
    : conflict.reason === 'first-sync'
      ? t('sync.conflictFirstSync', values)
      : t('sync.conflictBoth', values)
  return session.isActive.value ? `${text} ${t('sync.conflictRunning')}` : text
}
</script>

<template>
  <div
    v-if="status === 'conflict' && conflicts.length > 0"
    class="space-y-3"
  >
    <CalloutBanner
      v-for="conflict in conflicts"
      :key="conflict.key"
      tone="warning"
      :size="size"
      :title="t('sync.conflictTitle', { name: conflict.localName })"
      :description="describe(conflict)"
    >
      <div class="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          :disabled="session.isActive.value"
          @click="sync.resolveConflict(conflict.key, 'cloud')"
        >
          {{ conflict.reason === 'deleted-remotely' ? t('sync.deleteLocal') : t('sync.useCloud') }}
        </Button>
        <Button
          size="sm"
          @click="sync.resolveConflict(conflict.key, 'local')"
        >
          {{ conflict.reason === 'deleted-remotely' ? t('sync.restoreToCloud') : t('sync.keepLocal') }}
        </Button>
      </div>
    </CalloutBanner>
  </div>
  <CalloutBanner
    v-else-if="status === 'remote-newer'"
    tone="neutral"
    :size="size"
    :title="t('sync.remoteNewerTitle')"
    :description="t('sync.remoteNewerDescription')"
  />
  <CalloutBanner
    v-else-if="status === 'error'"
    tone="destructive"
    :size="size"
    :title="t('sync.errorTitle')"
    :description="t('sync.errorDescription')"
  >
    <Button
      size="sm"
      variant="secondary"
      @click="sync.syncNow()"
    >
      {{ t('sync.retry') }}
    </Button>
  </CalloutBanner>
</template>

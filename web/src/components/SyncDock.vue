<script setup lang="ts">
// 页面右下角的同步状态与“立即同步”
import { Button, SurfaceCard } from '@felinic/ui'
import { RefreshCw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useCloudSync } from '@/composables/useCloudSync'
import { useSyncStatusText } from '@/composables/useSyncStatusText'

const { t } = useI18n()
const sync = useCloudSync()
const statusText = useSyncStatusText()
</script>

<template>
  <SurfaceCard
    padding="none"
    bordered
    class="flex items-center gap-1 py-1 pr-1 pl-3"
    role="status"
  >
    <span class="text-body text-muted-foreground">{{ statusText }}</span>
    <Button
      variant="ghost"
      size="sm"
      :loading="sync.status.value === 'syncing'"
      loading-mode="icon"
      @click="sync.syncNow()"
    >
      <RefreshCw />
      {{ t('sync.syncNow') }}
    </Button>
  </SurfaceCard>
</template>

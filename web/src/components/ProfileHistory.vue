<script setup lang="ts">
// 单个游戏内用户的云端历史版本：下载、恢复
import {
  Button,
  ConfirmPopover,
  InlineLoadingRow,
  SettingsRow,
  SettingsSection,
  TextButton,
  toast,
} from '@felinic/ui'
import type { ProfileVersionDto } from '@shared/pvz/profile-archive'
import { stageString } from '@shared/pvz/userdata'
import { Download } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCloudSync } from '@/composables/useCloudSync'
import { useGameSession } from '@/composables/useGameSession'
import { formatBytes, formatDateTime } from '@/lib/format'

const props = defineProps<{
  localId: number
}>()

const { t, locale } = useI18n()
const sync = useCloudSync()
const session = useGameSession()

const key = computed(() => {
  // 依赖 remoteProfiles，让同步完成后重新取 key（新用户第一次上传后才有）
  void sync.remoteProfiles.value
  return sync.keyForLocalId(props.localId)
})
const currentVersion = computed(() => sync.remoteProfiles.value.find(remote => remote.key === key.value)?.version ?? null)

const versions = ref<ProfileVersionDto[]>([])
const loaded = ref(false)
const failed = ref(false)
const restoring = ref<number | null>(null)

async function load() {
  if (!key.value) {
    loaded.value = true
    return
  }
  failed.value = false
  try {
    const response = await fetch(`/api/profiles/${key.value}/versions`, { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    versions.value = (await response.json() as { versions: ProfileVersionDto[] }).versions
  }
  catch {
    failed.value = true
  }
  finally {
    loaded.value = true
  }
}

// 换用户、首次同步出 key、云端版本变化时刷新
watch([key, currentVersion], () => void load(), { immediate: true })

function sourceText(version: ProfileVersionDto): string {
  if (version.source === 'delete') return t('saves.history.sourceDelete')
  return version.source === 'restore' ? t('saves.history.sourceRestore') : t('saves.history.sourceUpload')
}

function describe(version: ProfileVersionDto): string {
  const parts = [formatDateTime(new Date(version.createdAt), locale.value), sourceText(version)]
  if (version.hasContent) {
    if (version.stats.level !== null) parts.push(t('saves.stage', { stage: stageString(version.stats.level) }))
    if (version.stats.coins !== null) parts.push(t('saves.coins', { coins: version.stats.coins.toLocaleString(locale.value) }))
    parts.push(formatBytes(version.size))
  }
  return parts.join(' · ')
}

function label(version: ProfileVersionDto): string {
  const base = t('saves.history.version', { version: version.version })
  const name = version.name ? ` · ${version.name}` : ''
  return version.version === currentVersion.value ? `${base}${name} · ${t('saves.history.current')}` : `${base}${name}`
}

async function restore(version: number) {
  restoring.value = version
  try {
    const response = await fetch(`/api/profiles/${key.value}/restore`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    // 拉取新版本到本地（本地有未上传的改动时会提示冲突）
    await sync.syncNow()
    toast.success(t('saves.history.restored', { version }))
  }
  catch {
    toast.error(t('saves.history.failed'))
  }
  finally {
    restoring.value = null
  }
}
</script>

<template>
  <SettingsSection :title="t('saves.history.title')">
    <InlineLoadingRow
      v-if="!loaded"
      surface="card-row"
    >
      {{ t('saves.history.loading') }}
    </InlineLoadingRow>

    <SettingsRow
      v-else-if="!key"
      :label="t('saves.history.notSynced')"
    />

    <SettingsRow
      v-else-if="failed"
      :label="t('saves.history.failed')"
    >
      <Button
        size="sm"
        variant="secondary"
        @click="load"
      >
        {{ t('sync.retry') }}
      </Button>
    </SettingsRow>

    <SettingsRow
      v-else-if="versions.length === 0"
      :label="t('saves.history.empty')"
    />

    <template v-else>
      <SettingsRow
        v-for="version in versions"
        :key="version.version"
        :label="label(version)"
        :description="describe(version)"
        stack="sm"
      >
        <div
          v-if="version.hasContent"
          class="flex items-center gap-1"
        >
          <TextButton
            as="a"
            :href="`/api/profiles/${key}/versions/${version.version}`"
          >
            <Download />
            {{ t('saves.history.download') }}
          </TextButton>
          <ConfirmPopover
            v-if="version.version !== currentVersion"
            :title="t('saves.history.restoreConfirmTitle', { version: version.version })"
            :message="t('saves.history.restoreConfirmMessage')"
            :confirm-text="t('saves.history.restore')"
            :cancel-text="t('saves.cancel')"
            :loading="restoring === version.version"
            @confirm="restore(version.version)"
          >
            <template #trigger>
              <Button
                variant="secondary"
                size="sm"
                :disabled="session.isActive.value"
                :title="session.isActive.value ? t('saves.history.restoreRunning') : undefined"
              >
                {{ t('saves.history.restore') }}
              </Button>
            </template>
          </ConfirmPopover>
        </div>
      </SettingsRow>
    </template>
  </SettingsSection>
</template>

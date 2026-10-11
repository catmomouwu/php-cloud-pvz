<script setup lang="ts">
// 快照：手动保存云端当前存档，每个用户最多 10 个；可导出、还原、重命名、删除
import {
  Button,
  CalloutBanner,
  ConfirmDeleteDialog,
  ConfirmPopover,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FieldStack,
  FormDialogShell,
  InlineLoadingRow,
  Input,
  SettingsRow,
  SettingsSection,
  TextButton,
  toast,
} from '@felinic/ui'
import { MAX_SNAPSHOT_LABEL_LENGTH, MAX_SNAPSHOTS, type ProfileSnapshotDto } from '@shared/pvz/profile-archive'
import { stageString } from '@shared/pvz/userdata'
import { Download, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCloudSync } from '@/composables/useCloudSync'
import { useGameSession } from '@/composables/useGameSession'
import { useProfileEditor } from '@/composables/useProfileEditor'
import { formatDateTime } from '@/lib/format'
import {
  createSnapshot,
  deleteSnapshot,
  listSnapshots,
  renameSnapshot,
  restoreSnapshot,
  SnapshotLimitError,
  snapshotDownloadUrl,
} from '@/lib/snapshots-api'

const props = defineProps<{
  localId: number
}>()

const { t, locale } = useI18n()
const sync = useCloudSync()
const session = useGameSession()
const editor = useProfileEditor()

const key = computed(() => {
  // 新用户第一次上传后才有 key
  void sync.remoteProfiles.value
  return sync.keyForLocalId(props.localId)
})

const snapshots = ref<ProfileSnapshotDto[]>([])
const loaded = ref(false)
const failed = ref(false)
const busy = ref(false)

async function load() {
  if (!key.value) {
    loaded.value = true
    return
  }
  failed.value = false
  try {
    snapshots.value = await listSnapshots(key.value)
  }
  catch {
    failed.value = true
  }
  finally {
    loaded.value = true
  }
}

watch(key, () => void load(), { immediate: true })

/** 最早的快照：满额时创建新快照会覆盖它 */
const oldest = computed(() => snapshots.value.at(-1) ?? null)
const full = computed(() => snapshots.value.length >= MAX_SNAPSHOTS)

/** 快照名默认就是创建时间；名字不是时间时补上创建时间，方便辨认 */
function snapshotTitle(snapshot: ProfileSnapshotDto): string {
  const time = formatDateTime(new Date(snapshot.createdAt), locale.value)
  return snapshot.label === time ? snapshot.label : t('editor.backup.labelWithTime', { label: snapshot.label, time })
}

function describe(snapshot: ProfileSnapshotDto): string {
  const parts = [formatDateTime(new Date(snapshot.createdAt), locale.value), t('editor.backup.fromVersion', { version: snapshot.sourceVersion })]
  if (snapshot.stats.level !== null) parts.push(t('saves.stage', { stage: stageString(snapshot.stats.level) }))
  if (snapshot.stats.coins !== null) parts.push(t('saves.coins', { coins: snapshot.stats.coins.toLocaleString(locale.value) }))
  return parts.join(' · ')
}

// ---- 创建 ----
const createOpen = ref(false)
const createLabel = ref('')
const createError = ref<string | null>(null)
/** 服务端发现已满（例如另一台设备刚创建过），需要再确认一次 */
const limitOldest = ref<ProfileSnapshotDto | null>(null)
const overwriteTarget = computed(() => limitOldest.value ?? (full.value ? oldest.value : null))

function openCreate() {
  createLabel.value = formatDateTime(new Date(), locale.value)
  createError.value = null
  limitOldest.value = null
  createOpen.value = true
}

async function submitCreate() {
  const label = createLabel.value.trim()
  if (!label) {
    createError.value = t('editor.backup.labelRequired')
    return
  }
  busy.value = true
  createError.value = null
  try {
    // 快照取的是云端当前版本，先把本地进度同步上去
    if (!(await sync.syncNow()) || !key.value) {
      createError.value = t('editor.backup.syncFirst')
      return
    }
    await createSnapshot(key.value, label, overwriteTarget.value !== null)
    createOpen.value = false
    toast.success(t('editor.backup.created', { label }))
    await load()
  }
  catch (error) {
    if (error instanceof SnapshotLimitError) limitOldest.value = error.oldest
    else createError.value = t('editor.backup.failed')
  }
  finally {
    busy.value = false
  }
}

// ---- 重命名 / 删除 / 还原 ----
const renameTarget = ref<ProfileSnapshotDto | null>(null)
const renameOpen = ref(false)
const renameLabel = ref('')
const deleteTarget = ref<ProfileSnapshotDto | null>(null)
const deleteOpen = ref(false)
const restoring = ref<string | null>(null)

// 从菜单里打开对话框要等菜单关闭，否则焦点会被菜单收回
function openRename(snapshot: ProfileSnapshotDto) {
  renameTarget.value = snapshot
  renameLabel.value = snapshot.label
  void nextTick(() => (renameOpen.value = true))
}

function openDelete(snapshot: ProfileSnapshotDto) {
  deleteTarget.value = snapshot
  void nextTick(() => (deleteOpen.value = true))
}

async function submitRename() {
  const target = renameTarget.value
  const label = renameLabel.value.trim()
  if (!target || !key.value || !label) return
  busy.value = true
  try {
    await renameSnapshot(key.value, target.id, label)
    renameOpen.value = false
    await load()
  }
  catch {
    toast.error(t('editor.backup.failed'))
  }
  finally {
    busy.value = false
  }
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target || !key.value) return
  busy.value = true
  try {
    await deleteSnapshot(key.value, target.id)
    deleteOpen.value = false
    toast.success(t('editor.backup.deleted', { label: target.label }))
    await load()
  }
  catch {
    toast.error(t('editor.backup.failed'))
  }
  finally {
    busy.value = false
  }
}

async function restore(snapshot: ProfileSnapshotDto) {
  if (!key.value) return
  restoring.value = snapshot.id
  try {
    await restoreSnapshot(key.value, snapshot.id)
    // 拉取还原后的版本到本地（本地有未上传的改动时会提示冲突）
    await sync.syncNow()
    toast.success(t('editor.backup.restored', { label: snapshot.label }))
  }
  catch {
    toast.error(t('editor.backup.failed'))
  }
  finally {
    restoring.value = null
  }
}
</script>

<template>
  <SettingsSection :title="`${t('editor.backup.snapshots')} · ${snapshots.length} / ${MAX_SNAPSHOTS}`">
    <template #actions>
      <Button
        variant="secondary"
        size="sm"
        :disabled="!key"
        @click="openCreate"
      >
        <Plus />
        {{ t('editor.backup.create') }}
      </Button>
    </template>

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
      :label="t('editor.backup.loadFailed')"
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
      v-else-if="snapshots.length === 0"
      :description="t('editor.backup.empty')"
    />

    <SettingsRow
      v-for="snapshot in snapshots"
      v-else
      :key="snapshot.id"
      :label="snapshot.label"
      :description="describe(snapshot)"
      stack="sm"
    >
      <div class="flex items-center gap-1">
        <TextButton
          as="a"
          :href="key ? snapshotDownloadUrl(key, snapshot.id) : undefined"
        >
          <Download />
          {{ t('editor.backup.export') }}
        </TextButton>
        <ConfirmPopover
          :title="t('editor.backup.restoreTitle', { label: snapshot.label })"
          :message="t('editor.backup.restoreMessage')"
          :confirm-text="t('saves.history.restore')"
          :cancel-text="t('saves.cancel')"
          :loading="restoring === snapshot.id"
          @confirm="restore(snapshot)"
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
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="t('editor.backup.more')"
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @select="openRename(snapshot)">
              <Pencil />
              {{ t('editor.backup.rename') }}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              @select="openDelete(snapshot)"
            >
              <Trash2 />
              {{ t('saves.delete') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SettingsRow>
  </SettingsSection>

  <FormDialogShell
    v-model:open="createOpen"
    :title="t('editor.backup.createTitle')"
    :cancel-text="t('saves.cancel')"
    :submit-text="overwriteTarget ? t('editor.backup.overwriteAndCreate') : t('editor.backup.create')"
    :loading="busy"
    @submit="submitCreate"
  >
    <template #body>
      <div class="space-y-3 pt-4">
        <FieldStack
          :label="t('editor.backup.label')"
          for="snapshot-label"
        >
          <Input
            id="snapshot-label"
            v-model="createLabel"
            :maxlength="MAX_SNAPSHOT_LABEL_LENGTH"
            autocomplete="off"
          />
        </FieldStack>
        <CalloutBanner
          v-if="overwriteTarget"
          tone="warning"
          size="sm"
          :description="t('editor.backup.overwriteWarning', { limit: MAX_SNAPSHOTS, label: snapshotTitle(overwriteTarget) })"
        />
        <CalloutBanner
          v-if="editor.dirty.value"
          tone="neutral"
          size="sm"
          :description="t('editor.backup.unsavedNotIncluded')"
        />
        <CalloutBanner
          v-if="createError"
          tone="destructive"
          size="sm"
          :description="createError"
        />
      </div>
    </template>
  </FormDialogShell>

  <FormDialogShell
    v-model:open="renameOpen"
    :title="t('editor.backup.renameTitle')"
    :cancel-text="t('saves.cancel')"
    :submit-text="t('saves.save')"
    :loading="busy"
    @submit="submitRename"
  >
    <template #body>
      <div class="pt-4">
        <FieldStack
          :label="t('editor.backup.label')"
          for="snapshot-rename"
        >
          <Input
            id="snapshot-rename"
            v-model="renameLabel"
            :maxlength="MAX_SNAPSHOT_LABEL_LENGTH"
            autocomplete="off"
          />
        </FieldStack>
      </div>
    </template>
  </FormDialogShell>

  <ConfirmDeleteDialog
    v-model:open="deleteOpen"
    :title="t('editor.backup.deleteTitle', { label: deleteTarget?.label ?? '' })"
    :description="t('editor.backup.deleteDescription')"
    :cancel-label="t('saves.cancel')"
    :confirm-label="t('saves.delete')"
    :loading="busy"
    @confirm="confirmDelete"
  />
</template>

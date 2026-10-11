<script setup lang="ts">
// 导入存档：选择 ZIP 或文件夹 → 列出识别到的游戏内用户 → 勾选后作为新用户加入
import {
  Button,
  CalloutBanner,
  Checkbox,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
  SettingsRow,
  SettingsSection,
} from '@felinic/ui'
import { findImportCandidates, type ImportCandidate, ImportFailure, readZip } from '@shared/pvz/import'
import { stageString } from '@shared/pvz/userdata'
import { FileArchive, FolderOpen } from 'lucide-vue-next'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameSession } from '@/composables/useGameSession'
import { useLocalSaves } from '@/composables/useLocalSaves'
import { useProfileActions } from '@/composables/useProfileActions'

const open = defineModel<boolean>('open', { default: false })

const { t, locale } = useI18n()
const session = useGameSession()
const actions = useProfileActions()
const { profiles } = useLocalSaves()

const zipInput = useTemplateRef<HTMLInputElement>('zipInput')
const folderInput = useTemplateRef<HTMLInputElement>('folderInput')

const candidates = ref<ImportCandidate[]>([])
const selected = ref<Set<number>>(new Set())
const error = ref<string | null>(null)
const reading = ref(false)

watch(open, (value) => {
  if (!value) return
  candidates.value = []
  selected.value = new Set()
  error.value = null
})

const existingNames = computed(() => new Set(profiles.value.map(profile => profile.name.toLowerCase())))
const skippedLegacy = computed(() => candidates.value.reduce((sum, candidate) => sum + candidate.skippedLegacy, 0))

function describe(candidate: ImportCandidate): string {
  const { level, coins } = candidate.stats
  const parts = level === null
    ? [t('saves.noProgress')]
    : [t('saves.stage', { stage: stageString(level) }), t('saves.coins', { coins: (coins ?? 0).toLocaleString(locale.value) })]
  if (existingNames.value.has(candidate.name.toLowerCase())) parts.push(t('saves.import.willRename'))
  return parts.join(' · ')
}

function toggle(index: number, value: boolean | 'indeterminate') {
  const next = new Set(selected.value)
  if (value === true) next.add(index)
  else next.delete(index)
  selected.value = next
}

function errorText(failure: unknown): string {
  if (failure instanceof ImportFailure) return t(`saves.import.errors.${failure.code}`)
  return t('saves.import.errors.invalid-zip')
}

async function load(read: () => Promise<Map<string, Uint8Array>>) {
  reading.value = true
  error.value = null
  try {
    candidates.value = findImportCandidates(await read())
    selected.value = new Set(candidates.value.map((_, index) => index))
  }
  catch (failure) {
    candidates.value = []
    error.value = errorText(failure)
  }
  finally {
    reading.value = false
  }
}

async function onZip(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await load(async () => readZip(new Uint8Array(await file.arrayBuffer())))
}

async function onFolder(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (files.length === 0) return
  await load(async () => {
    const entries = new Map<string, Uint8Array>()
    for (const file of files) {
      // 只读可能是存档的文件，避免把整个游戏目录读进内存
      if (!/\.(dat|v4|json)$/i.test(file.name)) continue
      entries.set(file.webkitRelativePath || file.name, new Uint8Array(await file.arrayBuffer()))
    }
    return entries
  })
}

async function submit() {
  const chosen = candidates.value.filter((_, index) => selected.value.has(index))
  if (chosen.length === 0) return
  const failure = await actions.importProfiles(chosen)
  if (failure) error.value = failure
  else open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogPanel
      width="lg"
      footer
    >
      <DialogHeader>
        <DialogTitle>{{ t('saves.import.title') }}</DialogTitle>
        <DialogDescription>{{ t('saves.import.description') }}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        <div class="space-y-4 pb-1">
          <div class="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              :loading="reading"
              loading-mode="icon"
              @click="zipInput?.click()"
            >
              <FileArchive />
              {{ t('saves.import.chooseZip') }}
            </Button>
            <Button
              variant="secondary"
              :disabled="reading"
              @click="folderInput?.click()"
            >
              <FolderOpen />
              {{ t('saves.import.chooseFolder') }}
            </Button>
            <input
              ref="zipInput"
              type="file"
              accept=".zip,application/zip"
              hidden
              @change="onZip"
            >
            <input
              ref="folderInput"
              type="file"
              webkitdirectory
              multiple
              hidden
              @change="onFolder"
            >
          </div>

          <CalloutBanner
            v-if="session.isActive.value"
            tone="neutral"
            size="sm"
            :description="t('saves.stopGameFirst')"
          />
          <CalloutBanner
            v-if="error"
            tone="destructive"
            size="sm"
            :description="error"
          />

          <SettingsSection
            v-if="candidates.length > 0"
            bordered
            :title="t('saves.import.found', { count: candidates.length })"
          >
            <SettingsRow
              v-for="(candidate, index) in candidates"
              :key="index"
              :label="candidate.name"
              :description="describe(candidate)"
            >
              <template #leading>
                <Checkbox
                  :model-value="selected.has(index)"
                  :aria-label="candidate.name"
                  @update:model-value="toggle(index, $event)"
                />
              </template>
            </SettingsRow>
          </SettingsSection>

          <p
            v-if="skippedLegacy > 0"
            class="px-2 text-body text-muted-foreground"
          >
            {{ t('saves.import.skippedLegacy', { count: skippedLegacy }) }}
          </p>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="secondary"
          @click="open = false"
        >
          {{ t('saves.cancel') }}
        </Button>
        <Button
          :disabled="selected.size === 0 || session.isActive.value"
          :loading="actions.busy.value"
          @click="submit"
        >
          {{ t('saves.import.submit', { count: selected.size }) }}
        </Button>
      </DialogFooter>
    </DialogPanel>
  </Dialog>
</template>

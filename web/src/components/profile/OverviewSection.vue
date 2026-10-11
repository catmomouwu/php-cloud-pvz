<script setup lang="ts">
// 概览：关键数据（随草稿实时变化）+ 快捷操作；快捷操作只改草稿，保存后才写入存档
import { Button, MetricReadout, NumberField, Popover, PopoverContent, PopoverTrigger, SettingsRow, SettingsSection, toast } from '@felinic/ui'
import { finishAdventure, MAX_COINS, maxCoins, resetProgress, unlockAllModes, unlockEverything } from '@shared/pvz/player-edits'
import type { PlayerData } from '@shared/pvz/player-data'
import { countTrophies } from '@shared/pvz/progress'
import { displayCoins, stageString } from '@shared/pvz/userdata'
import { useNow } from '@vueuse/core'
import { Pencil } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useProfileEditor } from '@/composables/useProfileEditor'
import type { LocalProfile } from '@/composables/useLocalSaves'
import { formatDateTime, formatRelative } from '@/lib/format'

const props = defineProps<{
  profile: LocalProfile
  data: PlayerData
}>()

const { t, locale } = useI18n()
const editor = useProfileEditor()
const now = useNow({ interval: 30_000 })

const trophies = computed(() => countTrophies(props.data))
const trophyCount = computed(() => trophies.value.survival + trophies.value.minigames + trophies.value.puzzles)
const achievements = computed(() => props.data.achievements.filter(Boolean).length)

const lastPlayed = computed(() => {
  const time = props.profile.lastPlayedAt
  if (!time) return t('saves.neverSaved')
  const relative = formatRelative(time, locale.value, now.value.getTime()) ?? t('sync.justNow')
  return `${relative}（${formatDateTime(time, locale.value)}）`
})

const actions = [
  { key: 'unlockEverything', run: unlockEverything },
  { key: 'finishAdventure', run: finishAdventure },
  { key: 'unlockModes', run: unlockAllModes },
  { key: 'maxCoins', run: maxCoins },
] as const

// 金币卡片上的编辑按钮：弹出输入框，确定后写进草稿
const coinsOpen = ref(false)
const coinsInput = ref(0)

function openCoins(open: boolean) {
  if (open) coinsInput.value = displayCoins(props.data.coins)
  coinsOpen.value = open
}

function applyCoins() {
  const value = Math.round((coinsInput.value || 0) / 10)
  editor.apply((data) => {
    data.coins = Math.min(Math.max(value, 0), MAX_COINS)
  })
  coinsOpen.value = false
}

const confirmation = useConfirm()

function run(key: string, change: (data: PlayerData) => void) {
  editor.apply(change)
  toast.success(t('editor.overview.applied', { action: t(`editor.overview.actions.${key}.title`) }))
}

/** 快捷操作都会一次改很多内容，先弹窗确认 */
function askRun(key: string, change: (data: PlayerData) => void) {
  const action = t(`editor.overview.actions.${key}.title`)
  confirmation.ask({
    title: t('editor.confirm.title', { action }),
    description: t('editor.confirm.description', { description: t(`editor.overview.actions.${key}.description`) }),
    confirmLabel: t('editor.overview.apply'),
    run: () => run(key, change),
  })
}

function askReset() {
  confirmation.ask({
    title: t('editor.overview.actions.reset.confirmTitle'),
    description: t('editor.overview.actions.reset.confirmMessage'),
    confirmLabel: t('editor.overview.actions.reset.confirm'),
    destructive: true,
    run: () => run('reset', resetProgress),
  })
}
</script>

<template>
  <div class="space-y-8">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricReadout
        :label="t('saves.detail.stage')"
        :value="stageString(data.level)"
      />
      <!-- 金币卡片右上角是编辑按钮，数值占满整行，窄卡片里也不会被截断 -->
      <div class="relative">
        <MetricReadout
          :label="t('saves.detail.coins')"
          :value="`$${displayCoins(data.coins).toLocaleString(locale)}`"
        />
        <Popover
          :open="coinsOpen"
          @update:open="openCoins"
        >
          <PopoverTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="absolute top-2 right-2 text-muted-foreground"
              :disabled="editor.readonly.value"
              :aria-label="t('editor.overview.editCoins')"
            >
              <Pencil />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            class="w-64"
          >
            <form
              class="space-y-3"
              @submit.prevent="applyCoins"
            >
              <p class="text-label font-medium text-foreground">
                {{ t('editor.overview.editCoins') }}
              </p>
              <NumberField
                v-model="coinsInput"
                size="sm"
                :min="0"
                :max="MAX_COINS * 10"
                :step="10"
                :format-options="{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }"
                :aria-label="t('saves.detail.coins')"
              />
              <p class="text-caption text-muted-foreground">
                {{ t('editor.shop.coinsHint') }}
              </p>
              <div class="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  @click="coinsOpen = false"
                >
                  {{ t('saves.cancel') }}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                >
                  {{ t('editor.overview.confirm') }}
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </div>
      <MetricReadout
        :label="t('saves.detail.trophies')"
        :value="`${trophyCount} / 48`"
      />
      <MetricReadout
        :label="t('saves.detail.achievements')"
        :value="`${achievements} / ${data.achievements.length || 20}`"
      />
    </div>

    <SettingsSection :title="t('saves.detail.progress')">
      <SettingsRow :label="t('saves.detail.lastPlayed')">
        <span class="text-body text-muted-foreground">{{ lastPlayed }}</span>
      </SettingsRow>
      <SettingsRow :label="t('saves.detail.finished')">
        <span class="text-body tabular-nums text-muted-foreground">{{ data.finishedAdventure }}</span>
      </SettingsRow>
      <SettingsRow :label="t('saves.detail.zenGarden')">
        <span class="text-body text-muted-foreground">{{ t('saves.detail.plants', { count: data.pottedPlants.length }) }}</span>
      </SettingsRow>
      <SettingsRow :label="t('saves.detail.midLevel')">
        <span class="text-body text-muted-foreground">
          {{ profile.hasMidLevelSave ? t('saves.detail.midLevelYes') : t('saves.detail.midLevelNo') }}
        </span>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('editor.overview.quickActions')">
      <SettingsRow
        v-for="action in actions"
        :key="action.key"
        :label="t(`editor.overview.actions.${action.key}.title`)"
        :description="t(`editor.overview.actions.${action.key}.description`)"
        stack="sm"
      >
        <Button
          variant="secondary"
          size="sm"
          :disabled="editor.readonly.value"
          @click="askRun(action.key, action.run)"
        >
          {{ t('editor.overview.apply') }}
        </Button>
      </SettingsRow>
      <SettingsRow
        :label="t('editor.overview.actions.reset.title')"
        :description="t('editor.overview.actions.reset.description')"
        stack="sm"
      >
        <Button
          variant="secondary"
          size="sm"
          class="text-destructive"
          :disabled="editor.readonly.value"
          @click="askReset"
        >
          {{ t('editor.overview.actions.reset.confirm') }}
        </Button>
      </SettingsRow>
    </SettingsSection>

    <ConfirmDialog
      v-model:open="confirmation.open.value"
      :title="confirmation.request.value?.title ?? ''"
      :description="confirmation.request.value?.description"
      :confirm-label="confirmation.request.value?.confirmLabel ?? ''"
      :cancel-label="t('saves.cancel')"
      :destructive="confirmation.request.value?.destructive"
      @confirm="confirmation.confirm"
    />
  </div>
</template>

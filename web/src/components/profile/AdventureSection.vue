<script setup lang="ts">
// 冒险：5 个场景 × 10 关的进度格，点一格即把当前关卡设到那里；周目数单独设置
import { NumberField, SettingsRow, SettingsSection } from '@felinic/ui'
import type { PlayerData } from '@shared/pvz/player-data'
import { ADVENTURE_LEVEL_COUNT } from '@shared/pvz/player-edits'
import { ADVENTURE_AREAS, adventureArea } from '@shared/pvz/progress'
import { stageString } from '@shared/pvz/userdata'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProfileEditor } from '@/composables/useProfileEditor'

const props = defineProps<{
  data: PlayerData
}>()

const { t } = useI18n()
const editor = useProfileEditor()

const LEVELS_PER_AREA = ADVENTURE_LEVEL_COUNT / ADVENTURE_AREAS.length
const areas = ADVENTURE_AREAS.map((area, index) => ({
  area,
  levels: Array.from({ length: LEVELS_PER_AREA }, (_, i) => index * LEVELS_PER_AREA + i + 1),
}))

/** 打完 5-10 后 level 会是 51，本周目全部通过 */
const current = computed(() => Math.min(props.data.level, ADVENTURE_LEVEL_COUNT + 1))

function setLevel(level: number) {
  editor.apply((data) => {
    data.level = level
  })
}

const finished = computed({
  get: () => props.data.finishedAdventure,
  set: (value: number | undefined) => editor.apply((data) => {
    data.finishedAdventure = Math.max(0, Math.round(value || 0))
  }),
})
</script>

<template>
  <div class="space-y-8">
    <SettingsSection :title="t('editor.adventure.progress')">
      <div class="space-y-4 p-4">
        <p class="text-body text-muted-foreground">
          {{ current > ADVENTURE_LEVEL_COUNT
            ? t('editor.adventure.allPassed')
            : t('editor.adventure.current', { stage: stageString(current), area: t(`saves.area.${adventureArea(current)}`) }) }}
        </p>
        <div
          v-for="row in areas"
          :key="row.area"
          class="flex items-center gap-3"
        >
          <span class="w-10 shrink-0 text-body text-muted-foreground">{{ t(`saves.area.${row.area}`) }}</span>
          <div class="grid flex-1 grid-cols-10 gap-1">
            <button
              v-for="level in row.levels"
              :key="level"
              type="button"
              class="h-8 rounded-md text-body tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed"
              :class="level === current
                ? 'bg-accent-blue-fill text-accent-blue-foreground'
                : level < current
                  ? 'bg-accent-green-soft text-accent-green-deep hover:bg-accent-green-soft-hover'
                  : 'bg-muted text-muted-foreground hover:text-foreground'"
              :disabled="editor.readonly.value"
              :aria-pressed="level === current"
              :title="t('editor.adventure.setLevel', { stage: stageString(level) })"
              @click="setLevel(level)"
            >
              {{ stageString(level) }}
            </button>
          </div>
        </div>
        <p class="text-caption text-muted-foreground">
          {{ t('editor.adventure.hint') }}
        </p>
      </div>
    </SettingsSection>

    <SettingsSection :title="t('editor.adventure.playthrough')">
      <SettingsRow
        :label="t('editor.adventure.finished')"
        :description="t('editor.adventure.finishedHint')"
        stack="sm"
      >
        <NumberField
          v-model="finished"
          class="w-32"
          size="sm"
          :min="0"
          :max="999"
          :disabled="editor.readonly.value"
        />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>

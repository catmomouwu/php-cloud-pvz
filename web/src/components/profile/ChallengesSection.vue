<script setup lang="ts">
// 挑战：小游戏 / 解谜 / 生存三组。每关显示未解锁 / 已解锁 / 已通关，开关即标记通关；
// 无尽模式没有“通关”，改的是最高纪录。游戏按通关数依次解锁，所以通关前面的关卡会让后面的变成已解锁。
import { NumberField, SettingsRow, SettingsSection, Switch, TextButton } from '@felinic/ui'
import {
  CHALLENGE_PAGES,
  CHALLENGES,
  type ChallengeDef,
  type ChallengePage,
  countBeaten,
  isBeaten,
  isPageUnlocked,
  isUnlocked,
  PAGE_FLAG,
  record,
  setBeaten,
} from '@shared/pvz/challenges'
import { type PlayerData, setFlag } from '@shared/pvz/player-data'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import GameImage from '@/components/game/GameImage.vue'
import IconTile from '@/components/game/IconTile.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useProfileEditor } from '@/composables/useProfileEditor'

const props = defineProps<{
  data: PlayerData
}>()

const { t } = useI18n()
const editor = useProfileEditor()

const pages = computed(() => CHALLENGE_PAGES.map((page) => {
  const defs = CHALLENGES.filter(def => def.page === page)
  return {
    page,
    unlocked: isPageUnlocked(props.data, page),
    beaten: countBeaten(props.data, page),
    total: defs.filter(def => def.kind !== 'endless').length,
    levels: defs.map(def => ({
      def,
      beaten: isBeaten(props.data, def),
      unlocked: isUnlocked(props.data, def),
      record: record(props.data, def.mode),
    })),
  }
}))

function setPageUnlocked(page: ChallengePage, value: boolean) {
  editor.apply(data => setFlag(data, PAGE_FLAG[page], value))
}

const confirmation = useConfirm()

/** 整组通关 / 清除前确认；清除会丢掉已有纪录，按危险操作处理 */
function setAll(page: ChallengePage, beaten: boolean) {
  const name = t(`editor.challenges.pages.${page}`)
  confirmation.ask({
    title: beaten ? t('editor.challenges.beatAllTitle', { page: name }) : t('editor.challenges.clearAllTitle', { page: name }),
    description: beaten ? t('editor.challenges.beatAllMessage') : t('editor.challenges.clearAllMessage'),
    confirmLabel: beaten ? t('editor.challenges.beatAll') : t('editor.challenges.clearAll'),
    destructive: !beaten,
    run: () => editor.apply((data) => {
      for (const def of CHALLENGES) if (def.page === page) setBeaten(data, def, beaten)
    }),
  })
}

function toggle(def: ChallengeDef, beaten: boolean) {
  editor.apply(data => setBeaten(data, def, beaten))
}

function setRecord(def: ChallengeDef, value: number | undefined) {
  editor.apply((data) => {
    data.challengeRecords[def.mode - 1] = Math.max(0, Math.round(value || 0))
  })
}

function statusText(level: { beaten: boolean, unlocked: boolean }): string {
  if (level.beaten) return t('editor.challenges.beaten')
  return level.unlocked ? t('editor.challenges.unlocked') : t('editor.challenges.locked')
}
</script>

<template>
  <div class="space-y-8">
    <p class="text-body text-muted-foreground">
      {{ t('editor.challenges.hint') }}
    </p>

    <SettingsSection
      v-for="group in pages"
      :key="group.page"
      :title="`${t(`editor.challenges.pages.${group.page}`)} · ${group.beaten} / ${group.total}`"
    >
      <SettingsRow
        :label="t('editor.challenges.entry')"
        :description="t(`editor.challenges.entryHint.${group.page}`)"
        stack="sm"
      >
        <div class="flex items-center gap-3">
          <TextButton
            :disabled="editor.readonly.value"
            @click="setAll(group.page, true)"
          >
            {{ t('editor.challenges.beatAll') }}
          </TextButton>
          <TextButton
            :disabled="editor.readonly.value"
            @click="setAll(group.page, false)"
          >
            {{ t('editor.challenges.clearAll') }}
          </TextButton>
          <Switch
            :model-value="group.unlocked"
            :disabled="editor.readonly.value"
            :aria-label="t('editor.challenges.entry')"
            @update:model-value="value => setPageUnlocked(group.page, value)"
          />
        </div>
      </SettingsRow>

      <div class="grid grid-cols-1 gap-x-6 px-4 py-2 sm:grid-cols-2">
        <div
          v-for="level in group.levels"
          :key="level.def.mode"
          class="flex h-14 items-center gap-3"
        >
          <!-- 游戏里的关卡缩略图；未解锁的和游戏一样调暗 -->
          <IconTile>
            <GameImage
              :image="level.def.page === 'survival' ? 'IMAGE_SURVIVAL_THUMBNAILS' : 'IMAGE_CHALLENGE_THUMBNAILS'"
              :cel="{ cols: level.def.page === 'survival' ? 11 : 22, index: level.def.icon }"
              :label="t(`challengeNames.${level.def.key}`)"
              fit="cover"
              class="size-full transition-[filter,opacity]"
              :class="level.unlocked || level.beaten ? '' : 'opacity-50 grayscale'"
            />
          </IconTile>
          <div class="min-w-0 flex-1">
            <p class="truncate text-body text-foreground">
              {{ t(`challengeNames.${level.def.key}`) }}
            </p>
            <p
              class="truncate text-caption"
              :class="level.beaten ? 'text-accent-green' : 'text-muted-foreground'"
            >
              {{ level.def.kind === 'endless' ? t('editor.challenges.endlessHint') : statusText(level) }}
            </p>
          </div>
          <NumberField
            v-if="level.def.kind === 'endless'"
            :model-value="level.record"
            class="w-24 shrink-0"
            size="sm"
            :min="0"
            :max="9999"
            :disabled="editor.readonly.value"
            :aria-label="t('editor.challenges.record')"
            @update:model-value="value => setRecord(level.def, value)"
          />
          <Switch
            v-else
            :model-value="level.beaten"
            :disabled="editor.readonly.value"
            :aria-label="t('editor.challenges.markBeaten')"
            @update:model-value="value => toggle(level.def, value)"
          />
        </div>
      </div>
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

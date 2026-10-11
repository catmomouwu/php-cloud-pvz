<script setup lang="ts">
import {
  Button,
  CalloutBanner,
  ConfirmPopover,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsRow,
  SettingsSection,
  Slider,
  Switch,
} from '@felinic/ui'
import type { ScaleMode } from '@shared/pvz/game-config'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SyncNotice from '@/components/SyncNotice.vue'
import { useGameSession } from '@/composables/useGameSession'
import { useGameSettings } from '@/composables/useGameSettings'
import { useLocalSaves } from '@/composables/useLocalSaves'

const LAST_USER = '__last__'

const { t } = useI18n()
const settings = useGameSettings()
const session = useGameSession()
const { profiles } = useLocalSaves()

const launchUser = computed({
  get: () => settings.value.launchUser ?? LAST_USER,
  set: (value: string) => {
    settings.value.launchUser = value === LAST_USER ? null : value
  },
})

const musicVolume = computed({
  get: () => [settings.value.musicVolume],
  set: (value: number[]) => {
    settings.value.musicVolume = value[0] ?? 0
  },
})

const sfxVolume = computed({
  get: () => [settings.value.sfxVolume],
  set: (value: number[]) => {
    settings.value.sfxVolume = value[0] ?? 0
  },
})

const scale = computed({
  get: () => settings.value.scale,
  set: (value: ScaleMode) => {
    settings.value.scale = value
  },
})

const scaleItems = computed(() => [
  { value: 'fit' as const, label: t('gameSettings.scaleFit') },
  { value: 'integer' as const, label: t('gameSettings.scaleInteger') },
])

// 缩放、静音由外层页面控制，可以即时生效
watch(() => settings.value.scale, value => session.setScale(value))
watch(() => settings.value.muted, value => session.setMuted(value))

const pendingRestart = computed(() => session.status.value === 'running' && session.needsRestart(settings.value))
</script>

<template>
  <div class="space-y-6 p-4">
    <!-- 游戏运行中的同步提示；未运行时显示在游戏画面里 -->
    <SyncNotice
      v-if="session.isActive.value"
      size="sm"
    />

    <div
      v-if="pendingRestart"
      class="space-y-3"
    >
      <CalloutBanner
        tone="neutral"
        size="sm"
        :description="t('gameSettings.pendingRestart')"
      />
      <ConfirmPopover
        :title="t('game.restartConfirmTitle')"
        :message="t('game.restartConfirmMessage')"
        :confirm-text="t('game.restart')"
        :cancel-text="t('game.cancel')"
        @confirm="session.restart(settings)"
      >
        <template #trigger>
          <Button block>
            {{ t('game.restart') }}
          </Button>
        </template>
      </ConfirmPopover>
    </div>

    <SettingsSection :title="t('gameSettings.sectionLaunch')">
      <SettingsRow
        :label="t('gameSettings.launchUser')"
        :description="t('gameSettings.launchUserHint')"
        stack="always"
      >
        <Select v-model="launchUser">
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="LAST_USER">
              {{ t('gameSettings.launchUserLast') }}
            </SelectItem>
            <SelectItem
              v-for="profile in profiles"
              :key="profile.id"
              :value="profile.name"
            >
              {{ profile.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('gameSettings.sectionAudio')">
      <SettingsRow
        :label="t('gameSettings.musicVolume')"
        stack="always"
      >
        <div class="flex items-center gap-3">
          <Slider
            v-model="musicVolume"
            :min="0"
            :max="100"
            :step="1"
            :disabled="settings.muted"
            class="flex-1"
          />
          <span class="w-8 text-right text-body tabular-nums text-muted-foreground">{{ settings.musicVolume }}</span>
        </div>
      </SettingsRow>
      <SettingsRow
        :label="t('gameSettings.sfxVolume')"
        stack="always"
      >
        <div class="flex items-center gap-3">
          <Slider
            v-model="sfxVolume"
            :min="0"
            :max="100"
            :step="1"
            :disabled="settings.muted"
            class="flex-1"
          />
          <span class="w-8 text-right text-body tabular-nums text-muted-foreground">{{ settings.sfxVolume }}</span>
        </div>
      </SettingsRow>
      <SettingsRow :label="t('gameSettings.muted')">
        <Switch v-model="settings.muted" />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection :title="t('gameSettings.sectionDisplay')">
      <SettingsRow
        :label="t('gameSettings.scale')"
        :description="t('gameSettings.scaleHint')"
        stack="always"
      >
        <SegmentedControl
          v-model="scale"
          :items="scaleItems"
          :aria-label="t('gameSettings.scale')"
        />
      </SettingsRow>
      <SettingsRow :label="t('gameSettings.vsync')">
        <Switch v-model="settings.vsync" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>

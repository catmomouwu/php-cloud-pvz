<script setup lang="ts">
import {
  Button,
  DetailPane,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  MetricReadout,
  PageShell,
  SettingsRow,
  SettingsSection,
  SettingsShell,
} from '@felinic/ui'
import { displayCoins, stageString } from '@shared/pvz/userdata'
import { Play } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PageScroll from '@/components/PageScroll.vue'
import ProfileHistory from '@/components/ProfileHistory.vue'
import ProfileMenu from '@/components/ProfileMenu.vue'
import { useLocalSaves } from '@/composables/useLocalSaves'
import { usePlayAs } from '@/composables/usePlayAs'
import { formatPlayTime } from '@/lib/format'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const playAs = usePlayAs()
const { profiles, loaded } = useLocalSaves()

const profile = computed(() => profiles.value.find(item => item.id === Number(route.params.id)) ?? null)
const details = computed(() => profile.value?.details ?? null)

const description = computed(() => {
  if (!profile.value) return ''
  if (profile.value.detailsState === 'missing') return t('saves.noProgress')
  if (profile.value.detailsState === 'unreadable') return t('saves.unreadable')
  return profile.value.isLastUsed ? t('saves.lastUsed') : ''
})

const unlockText = (unlocked: boolean) => (unlocked ? t('saves.detail.unlocked') : t('saves.detail.locked'))

function back() {
  void router.push({ name: 'saves' })
}
</script>

<template>
  <PageScroll>
    <DetailPane
      :back-label="t('saves.detail.back')"
      width="narrow"
      :loading="!loaded"
      @back="back"
    >
      <SettingsShell width="narrow">
        <PageShell
          v-if="!profile"
          variant="tab"
        >
          <Empty class="border">
            <EmptyHeader>
              <EmptyTitle>{{ t('saves.detail.notFoundTitle') }}</EmptyTitle>
              <EmptyDescription>{{ t('saves.detail.notFoundDescription') }}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </PageShell>

        <PageShell
          v-else
          variant="tab"
          :title="profile.name"
          :description="description"
        >
          <template #actions>
            <div class="flex items-center gap-2">
              <ProfileMenu
                :profile="profile"
                trigger="button"
                @deleted="back"
              />
              <Button
                size="sm"
                @click="playAs(profile.name)"
              >
                <Play />
                {{ t('saves.play') }}
              </Button>
            </div>
          </template>

          <div class="space-y-8">
            <template v-if="details">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricReadout
                :label="t('saves.detail.stage')"
                :value="stageString(details.level)"
              />
              <MetricReadout
                :label="t('saves.detail.coins')"
                :value="`$${displayCoins(details.coins).toLocaleString(locale)}`"
              />
              <MetricReadout
                :label="t('saves.detail.playTime')"
                :value="formatPlayTime(details.playTimeActive, t)"
              />
              <MetricReadout
                :label="t('saves.detail.achievements')"
                :value="`${details.achievements.filter(Boolean).length} / ${details.achievements.length || 20}`"
              />
            </div>

            <SettingsSection :title="t('saves.detail.progress')">
              <SettingsRow :label="t('saves.detail.finished')">
                <span class="text-body tabular-nums text-muted-foreground">{{ details.finishedAdventure }}</span>
              </SettingsRow>
              <SettingsRow :label="t('saves.detail.zenGarden')">
                <span class="text-body text-muted-foreground">{{ t('saves.detail.plants', { count: details.pottedPlantCount }) }}</span>
              </SettingsRow>
              <SettingsRow :label="t('saves.detail.midLevel')">
                <span class="text-body text-muted-foreground">
                  {{ profile.hasMidLevelSave ? t('saves.detail.midLevelYes') : t('saves.detail.midLevelNo') }}
                </span>
              </SettingsRow>
            </SettingsSection>

            <SettingsSection :title="t('saves.detail.unlocks')">
              <SettingsRow :label="t('saves.detail.minigames')">
                <span class="text-body text-muted-foreground">{{ unlockText(details.hasUnlockedMinigames) }}</span>
              </SettingsRow>
              <SettingsRow :label="t('saves.detail.puzzle')">
                <span class="text-body text-muted-foreground">{{ unlockText(details.hasUnlockedPuzzle) }}</span>
              </SettingsRow>
              <SettingsRow :label="t('saves.detail.survival')">
                <span class="text-body text-muted-foreground">{{ unlockText(details.hasUnlockedSurvival) }}</span>
              </SettingsRow>
            </SettingsSection>
            </template>

            <ProfileHistory :local-id="profile.id" />
          </div>
        </PageShell>
      </SettingsShell>
    </DetailPane>
  </PageScroll>
</template>

<script setup lang="ts">
import { Avatar, AvatarFallback, Progress, StatusDot, SurfaceCard } from '@felinic/ui'
import { ADVENTURE_LEVELS, adventureArea, adventureProgress, hasGoldTrophy, TROPHY_TOTALS } from '@shared/pvz/progress'
import { displayCoins, stageString } from '@shared/pvz/userdata'
import { useNow } from '@vueuse/core'
import { Trophy } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCloudSync } from '@/composables/useCloudSync'
import type { LocalProfile } from '@/composables/useLocalSaves'
import { formatRelative } from '@/lib/format'
import ProfileMenu from './ProfileMenu.vue'

const props = defineProps<{
  profile: LocalProfile
}>()

const { t, locale } = useI18n()
const sync = useCloudSync()
const now = useNow({ interval: 30_000 })

const details = computed(() => props.profile.details)
const trophies = computed(() => props.profile.trophies)

const subtitle = computed(() => {
  if (props.profile.detailsState === 'missing') return t('saves.noProgress')
  if (!details.value) return t('saves.unreadable')
  const { level, finishedAdventure } = details.value
  const stage = t('saves.stageArea', { stage: stageString(level), area: t(`saves.area.${adventureArea(level)}`) })
  return finishedAdventure > 0 ? `${t('saves.cycle', { n: finishedAdventure + 1 })} · ${stage}` : stage
})

const trophyTotal = computed(() => trophies.value
  ? trophies.value.survival + trophies.value.minigames + trophies.value.puzzles
  : 0)

const stats = computed(() => {
  if (!details.value) return ''
  return [
    t('saves.coins', { coins: displayCoins(details.value.coins).toLocaleString(locale.value) }),
    t('saves.trophies', { count: trophyTotal.value }),
    t('saves.achievements', { count: details.value.achievements.filter(Boolean).length }),
    t('saves.zenGarden', { count: details.value.pottedPlantCount }),
  ].join(' · ')
})

const modes = computed(() => {
  const d = details.value
  const tr = trophies.value
  if (!d || !tr) return ''
  const mode = (kind: keyof typeof TROPHY_TOTALS, unlocked: boolean) => {
    const name = t(`saves.modeName.${kind}`)
    return unlocked
      ? t('saves.modeProgress', { name, count: tr[kind], total: TROPHY_TOTALS[kind] })
      : t('saves.modeLocked', { name })
  }
  return [
    mode('minigames', d.hasUnlockedMinigames),
    mode('puzzles', d.hasUnlockedPuzzle),
    mode('survival', d.hasUnlockedSurvival),
  ].join(' · ')
})

const lastPlayed = computed(() => {
  const time = props.profile.lastPlayedAt
  if (!time) return t('saves.neverSaved')
  return t('saves.lastPlayed', { time: formatRelative(time, locale.value, now.value.getTime()) ?? t('sync.justNow') })
})

/** 单个用户的同步状态：有冲突 / 已同步 / 还没有上传到云端 */
const syncState = computed<'conflict' | 'synced' | 'local'>(() => {
  if (sync.conflicts.value.some(conflict => conflict.localId === props.profile.id)) return 'conflict'
  void sync.remoteProfiles.value
  return sync.keyForLocalId(props.profile.id) ? 'synced' : 'local'
})

const syncDot = computed(() => ({ conflict: 'warning', synced: 'success', local: 'idle' } as const)[syncState.value])
</script>

<template>
  <!-- 整张卡片可点击进入详情。卡片里还有操作菜单，不能做成按钮套按钮，
       所以用铺满卡片的链接层承接点击和悬停（悬停色与 ActionCard 一致），
       内容层叠在上面但不接收指针，只有菜单按钮单独可点。 -->
  <SurfaceCard class="relative">
    <RouterLink
      :to="{ name: 'profile', params: { id: profile.id } }"
      :aria-label="t('saves.viewDetail', { name: profile.name })"
      class="absolute inset-0 cursor-pointer rounded-[inherit] outline-none transition-colors hover:bg-(--action-card-hover) focus-visible:ring-2 focus-visible:ring-ring/30 active:bg-(--action-card-active)"
    />
    <div class="pointer-events-none relative flex flex-col gap-4">
      <div class="flex items-start gap-3">
        <Avatar class="size-9">
          <AvatarFallback>{{ profile.name.slice(0, 1).toUpperCase() }}</AvatarFallback>
        </Avatar>
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-1.5 text-control font-medium text-foreground">
            <span class="truncate">{{ profile.name }}</span>
            <Trophy
              v-if="details && trophies && hasGoldTrophy(details, trophies)"
              class="size-3.5 shrink-0 text-foreground"
              :aria-label="t('saves.goldTrophy')"
            />
          </p>
          <p class="mt-0.5 truncate text-body text-muted-foreground">
            {{ subtitle }}
          </p>
        </div>
        <div class="pointer-events-auto">
          <ProfileMenu :profile="profile" />
        </div>
      </div>

      <div
        v-if="details"
        class="space-y-1.5"
      >
        <div class="flex items-center justify-between text-caption text-muted-foreground">
          <span>{{ t('saves.adventureProgress') }}</span>
          <span class="tabular-nums">{{ Math.min(details.level - 1, ADVENTURE_LEVELS) }}/{{ ADVENTURE_LEVELS }}</span>
        </div>
        <Progress :model-value="adventureProgress(details.level) * 100" />
      </div>

      <div
        v-if="details"
        class="space-y-0.5 text-body text-muted-foreground"
      >
        <p>{{ stats }}</p>
        <p>{{ modes }}</p>
      </div>

      <div class="flex items-center gap-2 text-caption text-muted-foreground">
        <StatusDot :status="syncDot" />
        <span>{{ t(`saves.syncState.${syncState}`) }}</span>
        <span>·</span>
        <span class="truncate">{{ lastPlayed }}</span>
        <template v-if="profile.hasMidLevelSave">
          <span>·</span>
          <span class="truncate">{{ t('saves.midLevelSave') }}</span>
        </template>
      </div>
    </div>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { Avatar, AvatarFallback, Button, SurfaceCard } from '@felinic/ui'
import { displayCoins, stageString } from '@shared/pvz/userdata'
import { Play } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LocalProfile } from '@/composables/useLocalSaves'
import { formatPlayTime } from '@/lib/format'
import ProfileMenu from './ProfileMenu.vue'

const props = defineProps<{
  profile: LocalProfile
}>()

defineEmits<{
  play: []
}>()

const { t, locale } = useI18n()

const meta = computed(() => {
  const details = props.profile.details
  if (props.profile.detailsState === 'missing') return [t('saves.noProgress')]
  if (!details) return [t('saves.unreadable')]
  const parts = [t('saves.stage', { stage: stageString(details.level) })]
  if (details.finishedAdventure > 0) parts.push(t('saves.finished', { count: details.finishedAdventure }))
  parts.push(t('saves.coins', { coins: displayCoins(details.coins).toLocaleString(locale.value) }))
  parts.push(t('saves.playTime', { time: formatPlayTime(details.playTimeActive, t) }))
  return parts
})

const notes = computed(() => [
  props.profile.isLastUsed && t('saves.lastUsed'),
  props.profile.hasMidLevelSave && t('saves.midLevelSave'),
].filter(Boolean).join(' · '))
</script>

<template>
  <SurfaceCard class="flex flex-col gap-4">
    <div class="flex items-start gap-3">
      <!-- 头像与名字区域进入详情页；操作按钮在链接之外，避免嵌套可点击元素 -->
      <RouterLink
        :to="{ name: 'profile', params: { id: profile.id } }"
        :aria-label="t('saves.viewDetail')"
        class="flex min-w-0 flex-1 items-start gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <Avatar class="size-9">
          <AvatarFallback>{{ profile.name.slice(0, 1).toUpperCase() }}</AvatarFallback>
        </Avatar>
        <div class="min-w-0 flex-1">
          <p class="truncate text-control font-medium text-foreground">
            {{ profile.name }}
          </p>
          <p class="mt-0.5 text-body text-muted-foreground">
            {{ meta.join(' · ') }}
          </p>
          <p
            v-if="notes"
            class="mt-0.5 text-body text-muted-foreground"
          >
            {{ notes }}
          </p>
        </div>
      </RouterLink>
      <ProfileMenu :profile="profile" />
    </div>
    <div class="flex justify-end">
      <Button
        size="sm"
        variant="secondary"
        @click="$emit('play')"
      >
        <Play />
        {{ t('saves.play') }}
      </Button>
    </div>
  </SurfaceCard>
</template>

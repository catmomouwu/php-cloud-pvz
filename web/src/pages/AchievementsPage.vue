<script setup lang="ts">
import {
  Button,
  CalloutBanner,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  InlineLoadingRow,
  PageShell,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SurfaceCard,
} from '@felinic/ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AchievementIcon from '@/components/AchievementIcon.vue'
import PageScroll from '@/components/PageScroll.vue'
import { useLocalSaves } from '@/composables/useLocalSaves'
import { ACHIEVEMENT_KEYS } from '@/lib/pvz/achievements'

const { t } = useI18n()
const router = useRouter()
const { profiles, loaded } = useLocalSaves()

// 默认看最近玩过的用户；选中的用户被删掉后回到默认
const chosenId = ref<string>()
const profile = computed(() => profiles.value.find(item => String(item.id) === chosenId.value) ?? profiles.value[0] ?? null)
const selectedId = computed({
  get: () => profile.value ? String(profile.value.id) : undefined,
  set: (value) => { chosenId.value = value },
})

/** 新用户还没写出 user.dat 时视为一个都没拿到 */
const earned = computed(() => profile.value?.details?.achievements ?? [])
const items = computed(() => ACHIEVEMENT_KEYS.map((key, index) => ({ key, index, earned: earned.value[index] === true })))
const earnedCount = computed(() => items.value.filter(item => item.earned).length)
</script>

<template>
  <PageScroll>
    <PageShell
      :title="t('achievements.title')"
    >
      <template
        v-if="profiles.length > 0"
        #actions
      >
        <Select v-model="selectedId">
          <SelectTrigger
            class="w-44"
            :aria-label="t('achievements.player')"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="item in profiles"
              :key="item.id"
              :value="String(item.id)"
            >
              {{ item.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </template>

      <InlineLoadingRow v-if="!loaded">
        {{ t('saves.loading') }}
      </InlineLoadingRow>

      <Empty
        v-else-if="!profile"
        class="border"
      >
        <EmptyHeader>
          <EmptyTitle>{{ t('saves.emptyTitle') }}</EmptyTitle>
          <EmptyDescription>{{ t('achievements.empty') }}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="secondary"
            @click="router.push({ name: 'game' })"
          >
            {{ t('saves.goPlay') }}
          </Button>
        </EmptyContent>
      </Empty>

      <template v-else>
        <CalloutBanner
          v-if="profile.detailsState === 'unreadable'"
          class="mb-6"
          tone="warning"
          :description="t('saves.unreadable')"
        />

        <div class="mb-6 space-y-2">
          <div class="flex items-baseline justify-between text-body">
            <span class="text-muted-foreground">{{ t('achievements.earned') }}</span>
            <span class="text-foreground tabular-nums">{{ earnedCount }} / {{ items.length }}</span>
          </div>
          <Progress :model-value="earnedCount / items.length * 100" />
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SurfaceCard
            v-for="item in items"
            :key="item.key"
            padding="none"
            class="flex select-none items-center gap-3 p-3"
          >
            <!-- 未获得的成就和游戏里一样把图标调淡 -->
            <AchievementIcon
              :index="item.index"
              :label="t(`achievements.items.${item.key}.name`)"
              :class="item.earned ? '' : 'opacity-30 grayscale'"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p
                  class="truncate text-control font-semibold"
                  :class="item.earned ? 'text-foreground' : 'text-muted-foreground'"
                >
                  {{ t(`achievements.items.${item.key}.name`) }}
                </p>
                <span
                  v-if="item.earned"
                  class="shrink-0 text-body text-accent-green"
                >{{ t('achievements.unlocked') }}</span>
              </div>
              <p class="mt-0.5 text-body text-muted-foreground">
                {{ t(`achievements.items.${item.key}.description`) }}
              </p>
            </div>
          </SurfaceCard>
        </div>
      </template>
    </PageShell>
  </PageScroll>
</template>

<script setup lang="ts">
import { Button, CalloutBanner, ConfirmPopover, PanePlaceholder, SurfaceCard, Tooltip, TooltipContent, TooltipTrigger } from '@felinic/ui'
import { useFullscreen } from '@vueuse/core'
import { Maximize, Play, Square } from 'lucide-vue-next'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import GameSettingsPanel from '@/components/GameSettingsPanel.vue'
import SyncNotice from '@/components/SyncNotice.vue'
import { useCloudSync } from '@/composables/useCloudSync'
import { useGameSession } from '@/composables/useGameSession'
import { useGameSettings } from '@/composables/useGameSettings'
import { useResourceStatus } from '@/composables/useResourceStatus'

const { t } = useI18n()
const settings = useGameSettings()
const session = useGameSession()
const { status, error, src } = session
const resources = useResourceStatus()
const sync = useCloudSync()
/** 启动前正在与云端对齐 */
const preparing = ref(false)

const stage = useTemplateRef<HTMLElement>('stage')
const { toggle: toggleFullscreen } = useFullscreen(stage)

const errorCopy = computed(() => error.value === 'missing-resources'
  ? { title: t('game.errors.missingResourcesTitle'), description: t('game.errors.missingResources') }
  : { title: t('game.errors.runtimeFailedTitle'), description: t('game.errors.runtimeFailed') })

// 启动前先与云端对齐；有冲突时不启动，由 SyncNotice 让用户选择
async function start() {
  preparing.value = true
  try {
    if (await sync.prepareLaunch()) session.start(settings.value)
  }
  finally {
    preparing.value = false
  }
}

function bindFrame(el: unknown) {
  session.frame.value = (el as HTMLIFrameElement | null) ?? null
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col lg:flex-row">
    <div class="flex min-h-0 min-w-0 flex-1 items-center justify-center p-4 [container-type:size] md:p-6">
      <!-- 画面 + 工具条一起按 4:3 适配；工具条高 h-9、间距 gap-3，共 3rem -->
      <div class="flex w-[min(100cqw,calc((100cqh-3rem)*4/3))] flex-col gap-3">
        <div
          ref="stage"
          class="relative aspect-[4/3] w-full"
        >
          <SurfaceCard
            padding="none"
            class="size-full"
          >
            <iframe
              v-if="src"
              :ref="bindFrame"
              :src="src"
              :class="['absolute inset-0 size-full border-0', status !== 'running' && 'invisible']"
              allow="fullscreen; autoplay; gamepad"
              title="Cloud PvZ"
            />
            <div
              v-if="status !== 'running'"
              class="absolute inset-0 flex items-center justify-center p-6"
            >
              <PanePlaceholder
                v-if="status === 'loading'"
                loading
              >
                {{ t('game.starting') }}
              </PanePlaceholder>
              <div
                v-else-if="status === 'error'"
                class="w-full max-w-md space-y-4"
              >
                <CalloutBanner
                  tone="destructive"
                  :title="errorCopy.title"
                  :description="errorCopy.description"
                />
                <div class="flex justify-center">
                  <Button
                    variant="secondary"
                    @click="start"
                  >
                    {{ t('game.retry') }}
                  </Button>
                </div>
              </div>
              <div
                v-else
                class="flex w-full max-w-md flex-col items-center gap-4 text-center"
              >
                <div class="space-y-1">
                  <p class="text-title font-semibold text-foreground">
                    {{ t('game.idleTitle') }}
                  </p>
                  <p class="text-body text-muted-foreground">
                    {{ t('game.idleHint') }}
                  </p>
                </div>
                <CalloutBanner
                  v-if="resources.state.value === 'missing'"
                  tone="warning"
                  size="sm"
                  :title="t('game.errors.missingResourcesTitle')"
                  :description="t('game.errors.missingResources')"
                />
                <SyncNotice
                  size="sm"
                  class="text-left"
                />
                <Button
                  size="lg"
                  :disabled="resources.state.value !== 'found' || sync.status.value === 'conflict'"
                  :loading="preparing"
                  loading-mode="icon"
                  @click="start"
                >
                  <Play />
                  {{ t('game.start') }}
                </Button>
              </div>
            </div>
          </SurfaceCard>
        </div>

        <!-- 游戏工具条：紧贴画面下方，与画面同宽 -->
        <div class="flex h-9 items-center justify-between gap-2 px-1">
          <span class="truncate text-body text-muted-foreground">{{ t(`game.status.${status}`) }}</span>
          <div class="flex items-center gap-1">
            <ConfirmPopover
              v-if="status === 'running'"
              :title="t('game.stopConfirmTitle')"
              :message="t('game.stopConfirmMessage')"
              :confirm-text="t('game.stop')"
              :cancel-text="t('game.cancel')"
              variant="destructive"
              @confirm="session.stop()"
            >
              <template #trigger>
                <Button
                  variant="ghost"
                  size="sm"
                >
                  <Square />
                  {{ t('game.stop') }}
                </Button>
              </template>
            </ConfirmPopover>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :aria-label="t('game.fullscreen')"
                  :disabled="status !== 'running'"
                  @click="toggleFullscreen()"
                >
                  <Maximize />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ t('game.fullscreen') }}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>

    <aside class="max-h-[45%] shrink-0 overflow-y-auto pb-16 [scrollbar-gutter:stable] lg:max-h-none lg:w-80">
      <GameSettingsPanel />
    </aside>
  </div>
</template>

<script setup lang="ts">
// 成就图标：从 pak 的图标图集里裁出一格；没有游戏资源时显示奖杯占位
import { Skeleton } from '@felinic/ui'
import { Trophy } from 'lucide-vue-next'
import { ref, useTemplateRef, watch } from 'vue'
import { useGameAssets } from '@/composables/useGameAssets'
import { ACHIEVEMENT_ICON_SIZE, ACHIEVEMENT_ICONS_IMAGE, achievementIconOrigin } from '@/lib/pvz/achievements'

const props = defineProps<{
  index: number
  label: string
}>()

const { state, assets } = useGameAssets()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const drawn = ref(false)
const failed = ref(false)

// 资源可能在页面挂载后才读完，等资源和画布都就绪再画
watch([assets, canvas], async ([current, element]) => {
  if (!current || !element || drawn.value) return
  const sheet = await current.loader.load(ACHIEVEMENT_ICONS_IMAGE)
  const ctx = element.getContext('2d')
  if (!sheet || !ctx) {
    failed.value = true
    return
  }
  const [sx, sy] = achievementIconOrigin(props.index)
  ctx.drawImage(sheet, sx, sy, ACHIEVEMENT_ICON_SIZE, ACHIEVEMENT_ICON_SIZE, 0, 0, ACHIEVEMENT_ICON_SIZE, ACHIEVEMENT_ICON_SIZE)
  drawn.value = true
}, { immediate: true })
</script>

<template>
  <div class="relative size-14 shrink-0">
    <div
      v-if="state === 'missing' || state === 'error' || failed"
      class="flex size-full items-center justify-center rounded-md bg-muted text-muted-foreground"
    >
      <Trophy class="size-6" />
    </div>
    <template v-else>
      <canvas
        ref="canvas"
        :width="ACHIEVEMENT_ICON_SIZE"
        :height="ACHIEVEMENT_ICON_SIZE"
        class="block size-full"
        role="img"
        :aria-label="label"
      />
      <Skeleton
        v-if="!drawn"
        class="absolute inset-0"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// 禅境花园画面：游戏里的背景，按格子摆上花盆和盆栽（静态第一帧）。随草稿变化重画
import { Skeleton } from '@felinic/ui'
import type { PottedPlantView } from '@shared/pvz/zen-garden'
import { ref, useTemplateRef, watch } from 'vue'
import { useGameAssets } from '@/composables/useGameAssets'
import { drawGardenScene, SCENE_HEIGHT, SCENE_WIDTH, type SceneGarden } from '@/lib/pvz/zen-render'

const props = defineProps<{
  garden: SceneGarden
  plants: PottedPlantView[]
  label?: string
}>()

const { state, assets } = useGameAssets()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const drawn = ref(false)
let generation = 0

watch([assets, canvas, () => JSON.stringify(props.plants)], async ([current, element]) => {
  if (!current || !element) return
  const ctx = element.getContext('2d')
  if (!ctx) return
  // 连续修改时只保留最后一次的结果
  const mine = ++generation
  const offscreen = document.createElement('canvas')
  offscreen.width = element.width
  offscreen.height = element.height
  await drawGardenScene(offscreen.getContext('2d')!, current, props.garden, props.plants, new DOMMatrix())
  if (mine !== generation) return
  ctx.clearRect(0, 0, element.width, element.height)
  ctx.drawImage(offscreen, 0, 0)
  drawn.value = true
}, { immediate: true })
</script>

<template>
  <div
    v-if="state === 'missing' || state === 'error'"
    class="hidden"
  />
  <div
    v-else
    class="relative overflow-hidden rounded-lg"
  >
    <canvas
      ref="canvas"
      :width="SCENE_WIDTH"
      :height="SCENE_HEIGHT"
      class="block aspect-[4/3] w-full"
      role="img"
      :aria-label="label"
    />
    <Skeleton
      v-if="!drawn"
      class="absolute inset-0 rounded-none"
    />
  </div>
</template>

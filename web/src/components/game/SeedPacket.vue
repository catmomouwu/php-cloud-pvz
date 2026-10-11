<script setup lang="ts">
// 种子包：卡片背景 + 缩小的植物（与游戏里的卡片一致），用于商店植物等
import { Skeleton } from '@felinic/ui'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useGameAssets } from '@/composables/useGameAssets'
import { PLANTS } from '@/lib/pvz/almanac-entities'
import { createEntityAnimation } from '@/lib/pvz/almanac-render'
import { packetBackground, packetLayout, SEED_IMITATER, SEED_PACKET_HEIGHT, SEED_PACKET_WIDTH } from '@/lib/pvz/seed-packet'

const props = defineProps<{
  /** SeedType 下标（与图鉴植物顺序一致） */
  seed: number
  label?: string
}>()

/** 画布按 2 倍像素绘制，缩小显示时仍然清晰 */
const PIXELS = 2
const { state, assets } = useGameAssets()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const drawn = ref(false)
const unavailable = computed(() => state.value === 'missing' || state.value === 'error')

watch([assets, canvas], async ([current, element]) => {
  if (!current || !element || drawn.value) return
  const ctx = element.getContext('2d')
  if (!ctx) return
  ctx.setTransform(PIXELS, 0, 0, PIXELS, 0, 0)
  if (props.seed === SEED_IMITATER) {
    const image = await current.loader.load('IMAGE_IMITATERSEED')
    if (image) ctx.drawImage(image, 0, 0)
  }
  else {
    const [sheet, animation] = await Promise.all([
      current.loader.load('IMAGE_SEEDS'),
      createEntityAnimation(PLANTS[props.seed]!, current, 0),
    ])
    if (sheet) {
      const width = sheet.width / 9
      ctx.drawImage(sheet, packetBackground(props.seed) * width, 0, width, sheet.height, 0, 0, SEED_PACKET_WIDTH, SEED_PACKET_HEIGHT)
    }
    const layout = packetLayout(props.seed)
    animation.draw(ctx, new DOMMatrix().scale(PIXELS).translate(layout.x, layout.y).scale(layout.scale))
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  drawn.value = true
}, { immediate: true })
</script>

<template>
  <div
    v-if="unavailable"
    class="rounded-sm bg-muted"
  />
  <div
    v-else
    class="relative"
  >
    <canvas
      ref="canvas"
      :width="SEED_PACKET_WIDTH * PIXELS"
      :height="SEED_PACKET_HEIGHT * PIXELS"
      class="block size-full"
      role="img"
      :aria-label="label"
    />
    <Skeleton
      v-if="!drawn"
      class="absolute inset-0"
    />
  </div>
</template>

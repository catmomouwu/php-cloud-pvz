<script setup lang="ts">
// 图鉴大图：地面 + 播放中的动画（只在挂载期间运行）
import { useRafFn } from '@vueuse/core'
import { onMounted, onUnmounted, shallowRef, useTemplateRef } from 'vue'
import type { AlmanacEntity } from '@/lib/pvz/almanac-entities'
import { createEntityRenderer, type EntityRenderer, GROUND_SIZE } from '@/lib/pvz/almanac-render'
import { useGameAssets } from '@/composables/useGameAssets'

const props = defineProps<{
  entity: AlmanacEntity
}>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const renderer = shallowRef<EntityRenderer | null>(null)
const { assets } = useGameAssets()
const scale = 2

let disposed = false
onMounted(async () => {
  if (!assets.value) return
  const created = await createEntityRenderer(props.entity, assets.value)
  if (!disposed) renderer.value = created
})
onUnmounted(() => {
  disposed = true
})

useRafFn(({ delta }) => {
  const ctx = canvas.value?.getContext('2d')
  const current = renderer.value
  if (!ctx || !current) return
  current.update(Math.min(delta / 1000, 0.1))
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (current.ground) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.drawImage(current.ground, 0, 0)
  }
  current.draw(ctx, new DOMMatrix().scale(scale))
})
</script>

<template>
  <canvas
    ref="canvas"
    :width="GROUND_SIZE * scale"
    :height="GROUND_SIZE * scale"
    class="block aspect-square w-full"
  />
</template>

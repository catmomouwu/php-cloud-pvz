<script setup lang="ts">
// 植物 / 僵尸的方形缩略图：图鉴同款草地背景上的本体首帧，按配置裁剪
import { Skeleton } from '@felinic/ui'
import { ref, useTemplateRef, watch } from 'vue'
import { useGameAssets } from '@/composables/useGameAssets'
import type { AlmanacEntity } from '@/lib/pvz/almanac-entities'
import { createEntityRenderer, cropOf, GROUND_SIZE } from '@/lib/pvz/almanac-render'
import type { ColorRule } from '@/lib/pvz/reanim'

const props = defineProps<{
  entity: AlmanacEntity
  label?: string
  /** 轨道着色，如金盏花的花瓣颜色 */
  colors?: ColorRule[]
}>()

const { assets } = useGameAssets()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const ready = ref(false)

// 正方形：以配置的裁剪区域为中心取边长 max(w, h)，并限制在地面范围内
const [rawX, rawY, rawW, rawH] = cropOf(props.entity)
const SIDE = Math.min(Math.max(rawW, rawH), GROUND_SIZE)
const clamp = (value: number) => Math.min(Math.max(value, 0), GROUND_SIZE - SIDE)
const cropX = clamp(rawX + rawW / 2 - SIDE / 2)
const cropY = clamp(rawY + rawH / 2 - SIDE / 2)
const PIXELS = 2

// 资源可能在挂载后才读完
watch([assets, canvas], async ([current, element]) => {
  if (!current || !element || ready.value) return
  const renderer = await createEntityRenderer({ ...props.entity, colors: props.colors }, current, 0)
  const ctx = element.getContext('2d')
  if (!ctx) return
  const base = new DOMMatrix().scale(PIXELS).translate(-cropX, -cropY)
  if (renderer.ground) {
    ctx.setTransform(base)
    ctx.drawImage(renderer.ground, 0, 0)
  }
  renderer.draw(ctx, base)
  ready.value = true
}, { immediate: true })
</script>

<template>
  <div class="relative">
    <canvas
      ref="canvas"
      :width="SIDE * PIXELS"
      :height="SIDE * PIXELS"
      class="block aspect-square size-full"
      :aria-label="label"
      role="img"
    />
    <Skeleton
      v-if="!ready"
      class="absolute inset-0 rounded-none"
    />
  </div>
</template>

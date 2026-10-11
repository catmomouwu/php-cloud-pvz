<script setup lang="ts">
// 游戏图片：从 main.pak 取一张图（或图集里的一格）画到画布上，按原图比例缩放。
// 没有游戏资源时只留一个淡色占位，不影响布局。
import { Skeleton } from '@felinic/ui'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useGameAssets } from '@/composables/useGameAssets'

const props = defineProps<{
  /** 资源 id，如 IMAGE_CHALLENGE_THUMBNAILS */
  image: string
  /** 图集按列等分时取第 index 格 */
  cel?: { cols: number, rows?: number, index: number }
  label?: string
  /** contain：完整显示（默认）；cover：裁剪铺满（如关卡缩略图放进正方形） */
  fit?: 'contain' | 'cover'
}>()

const { state, assets } = useGameAssets()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const size = ref<{ width: number, height: number } | null>(null)
const failed = ref(false)

const unavailable = computed(() => state.value === 'missing' || state.value === 'error' || failed.value)

watch([assets, canvas, () => props.image, () => props.cel?.index], async ([current]) => {
  if (!current) return
  const sheet = await current.loader.load(props.image)
  if (!sheet) {
    failed.value = true
    return
  }
  const cols = props.cel?.cols ?? 1
  const rows = props.cel?.rows ?? 1
  const width = Math.floor(sheet.width / cols)
  const height = Math.floor(sheet.height / rows)
  const index = props.cel?.index ?? 0
  size.value = { width, height }
  // 尺寸变化后画布会清空，等下一帧再画
  await new Promise(requestAnimationFrame)
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(sheet, (index % cols) * width, Math.floor(index / cols) * height, width, height, 0, 0, width, height)
}, { immediate: true })
</script>

<template>
  <div
    v-if="unavailable"
    class="rounded-md bg-muted"
  />
  <div
    v-else
    class="relative"
  >
    <canvas
      ref="canvas"
      :width="size?.width ?? 1"
      :height="size?.height ?? 1"
      :class="fit === 'cover' ? 'object-cover' : 'object-contain'"
      class="block size-full"
      role="img"
      :aria-label="label"
    />
    <Skeleton
      v-if="!size"
      class="absolute inset-0"
    />
  </div>
</template>

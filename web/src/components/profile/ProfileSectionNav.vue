<script setup lang="ts">
// 存档详情的分类列表：纯文字，选中项有一块高亮背景，切换时滑到新的一项（与侧边栏同样的 250ms 曲线）。
// 宽屏竖排在内容右侧，窄屏横排在内容上方。
import { useResizeObserver } from '@vueuse/core'
import { nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProfileSection } from '@/lib/profile-sections'

const props = defineProps<{
  sections: readonly ProfileSection[]
  active: ProfileSection
  orientation: 'vertical' | 'horizontal'
}>()

const emit = defineEmits<{
  select: [section: ProfileSection]
}>()

const { t } = useI18n()
const list = useTemplateRef<HTMLElement>('list')
const indicator = ref<{ x: number, y: number, width: number, height: number } | null>(null)
/** 首次定位不播放动画 */
const animate = ref(false)

function measure() {
  const item = list.value?.querySelector<HTMLElement>(`[data-section="${props.active}"]`)
  indicator.value = item ? { x: item.offsetLeft, y: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight } : null
}

watch(() => props.active, () => void nextTick(measure))
useResizeObserver(list, measure)
onMounted(() => {
  measure()
  requestAnimationFrame(() => (animate.value = true))
})
</script>

<template>
  <nav :aria-label="t('editor.sectionsLabel')">
    <ul
      ref="list"
      class="relative flex"
      :class="orientation === 'vertical' ? 'flex-col gap-0.5' : 'gap-1 overflow-x-auto'"
    >
      <li
        v-if="indicator"
        aria-hidden="true"
        class="pointer-events-none absolute top-0 left-0 rounded-lg bg-sidebar-accent motion-reduce:transition-none"
        :class="animate && 'transition-[translate,width,height] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]'"
        :style="{ translate: `${indicator.x}px ${indicator.y}px`, width: `${indicator.width}px`, height: `${indicator.height}px` }"
      />
      <li
        v-for="section in sections"
        :key="section"
        :data-section="section"
        class="relative shrink-0"
      >
        <button
          type="button"
          class="w-full rounded-lg px-3 py-1.5 text-left text-body whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30"
          :class="section === active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'"
          :aria-current="section === active ? 'page' : undefined"
          @click="emit('select', section)"
        >
          {{ t(`editor.sections.${section}`) }}
        </button>
      </li>
    </ul>
  </nav>
</template>

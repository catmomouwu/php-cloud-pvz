<script setup lang="ts">
// 金盏花颜色：色块按钮，点开是游戏里的 11 种花瓣颜色
import { Button, Popover, PopoverContent, PopoverTrigger } from '@felinic/ui'
import { MARIGOLD_COLORS } from '@shared/pvz/zen-garden'
import { Check } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  disabled?: boolean
}>()

const model = defineModel<number>({ required: true })

const { t } = useI18n()
const open = ref(false)

const css = (index: number) => {
  const [r, g, b] = MARIGOLD_COLORS[index]!
  return `rgb(${r} ${g} ${b})`
}

function pick(index: number) {
  model.value = index
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="disabled"
        :aria-label="t('editor.garden.marigoldColor', { color: t(`editor.garden.marigoldColors.${model}`) })"
      >
        <!-- 色值来自游戏数据，只能用内联样式 -->
        <span
          class="size-4 rounded-full border"
          :style="{ backgroundColor: css(model) }"
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      class="w-auto p-2"
    >
      <div class="grid grid-cols-6 gap-1">
        <button
          v-for="(_, index) in MARIGOLD_COLORS"
          :key="index"
          type="button"
          class="flex size-8 items-center justify-center rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
          :title="t(`editor.garden.marigoldColors.${index}`)"
          :aria-label="t(`editor.garden.marigoldColors.${index}`)"
          :aria-pressed="index === model"
          @click="pick(index)"
        >
          <span
            class="flex size-5 items-center justify-center rounded-full border"
            :style="{ backgroundColor: css(index) }"
          >
            <Check
              v-if="index === model"
              class="size-3 text-foreground"
            />
          </span>
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>

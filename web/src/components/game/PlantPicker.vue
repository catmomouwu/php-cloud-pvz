<script setup lang="ts">
// 植物选择器：外观同下拉框；弹出层顶部可搜索，每项前面是草地背景的植物缩略图
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  selectTriggerClass,
} from '@felinic/ui'
import { Check, ChevronDown } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PLANTS } from '@/lib/pvz/almanac-entities'
import EntityThumb from './EntityThumb.vue'

const props = defineProps<{
  /** 可选的植物（SeedType 下标） */
  seeds: number[]
  disabled?: boolean
  label?: string
}>()

const model = defineModel<number>({ required: true })

const { t } = useI18n()
const open = ref(false)

const nameOf = (seed: number) => t(`almanac.names.${PLANTS[seed]!.key}`)
const current = computed(() => (props.seeds.includes(model.value) ? model.value : props.seeds[0]))

function pick(seed: number) {
  model.value = seed
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger
      :disabled="disabled"
      :aria-label="label"
      data-slot="select-trigger"
      data-size="sm"
      :class="[selectTriggerClass, 'w-44']"
    >
      <span class="flex min-w-0 items-center gap-2">
        <EntityThumb
          v-if="current !== undefined"
          :key="current"
          :entity="PLANTS[current]!"
          class="size-5 shrink-0 overflow-hidden rounded-sm"
        />
        <span class="truncate">{{ current !== undefined ? nameOf(current) : '' }}</span>
      </span>
      <ChevronDown class="size-4 shrink-0 opacity-50" />
    </PopoverTrigger>
    <PopoverContent
      align="end"
      class="w-60 p-0"
    >
      <Command>
        <CommandInput :placeholder="t('editor.garden.searchPlant')" />
        <CommandList class="max-h-72 p-1">
          <CommandEmpty>{{ t('editor.garden.noPlant') }}</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="seed in seeds"
              :key="seed"
              :value="seed"
              class="gap-2"
              @select="pick(seed)"
            >
              <EntityThumb
                :entity="PLANTS[seed]!"
                class="size-8 shrink-0 overflow-hidden rounded-md"
              />
              <span class="min-w-0 flex-1 truncate">{{ nameOf(seed) }}</span>
              <Check
                v-if="seed === current"
                class="size-4 shrink-0"
              />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>

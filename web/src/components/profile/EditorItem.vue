<script setup lang="ts">
// 编辑器里的紧凑一行：左边图标（可选）和名字（可带一行说明），右边控件；放在两列网格里使用
defineProps<{
  label: string
  hint?: string
}>()
</script>

<template>
  <div class="flex h-14 items-center gap-3">
    <slot name="icon" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-body text-foreground">
        {{ label }}
      </p>
      <p
        v-if="hint"
        class="truncate text-caption text-muted-foreground"
      >
        {{ hint }}
      </p>
    </div>
    <slot />
  </div>
</template>

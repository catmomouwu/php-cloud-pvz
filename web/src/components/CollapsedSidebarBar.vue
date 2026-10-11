<script setup lang="ts">
import { useSidebar } from '@felinic/ui'
import SidebarToggle from './SidebarToggle.vue'

// 侧栏完全收起时，才在内容区左上角留出放抽屉按钮的一条；展开时按钮在侧栏内
const { state } = useSidebar()
</script>

<template>
  <div
    v-if="state === 'collapsed'"
    class="flex h-12 shrink-0 items-center px-3"
  >
    <SidebarToggle />
  </div>
</template>

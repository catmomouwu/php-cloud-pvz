<script setup lang="ts">
import RouteTransition from '@/components/RouteTransition.vue'
</script>

<template>
  <div class="flex min-h-svh items-center justify-center bg-background px-4 py-10">
    <div class="w-full max-w-sm">
      <!-- 登录 ↔ 注册：同级淡入 -->
      <RouterView v-slot="{ Component, route }">
        <RouteTransition name="page-fade">
          <component
            :is="Component"
            :key="route.fullPath"
          />
        </RouteTransition>
      </RouterView>
    </div>
  </div>
</template>

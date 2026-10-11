<script setup lang="ts">
// 路由切换动画的外壳：列表 → 详情用 swap-forward，详情 → 列表用 swap-back，同级页面用 page-fade。
// 首次渲染不播（不加 appear），与 Memoh 一致：只有切换时才动。
defineProps<{
  name: 'swap-forward' | 'swap-back' | 'page-fade'
}>()
</script>

<template>
  <!-- overflow-x-clip：滑动时的水平位移不能撑出横向滚动条，也不把这里变成纵向滚动容器 -->
  <div class="relative h-full overflow-x-clip">
    <Transition :name="name">
      <slot />
    </Transition>
  </div>
</template>

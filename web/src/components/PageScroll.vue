<!-- 页面级滚动容器：预留滚动条槽位，避免居中内容在出现滚动条时左右跳动；
     底部留出右下角同步浮层的高度，滚到底时内容不被遮住 -->
<template>
  <div class="h-full overflow-y-auto pb-16 [scrollbar-gutter:stable]">
    <slot />
  </div>
</template>

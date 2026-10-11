<script setup lang="ts">
import { SidebarInset, SidebarProvider } from '@felinic/ui'
import { useMediaQuery, useStorage, useTitle } from '@vueuse/core'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type RouteLocationNormalizedLoaded, useRoute, useRouter } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import CollapsedSidebarBar from '@/components/CollapsedSidebarBar.vue'
import RouteTransition from '@/components/RouteTransition.vue'
import SyncDock from '@/components/SyncDock.vue'
import { useAuth } from '@/composables/useAuth'
import GamePage from '@/pages/GamePage.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { user } = useAuth()

// 会话失效（过期、在别处退出）时回到登录页
watch(user, (value) => {
  if (!value && !route.meta.public) void router.replace({ name: 'login' })
})
// 没有顶栏，页面名写到浏览器标签页标题里
useTitle(computed(() => (route.meta.titleKey ? `${t(route.meta.titleKey)} · ${t('app.name')}` : t('app.name'))))
const isGameRoute = computed(() => route.name === 'game')

// 按页面层级决定切换动画；在导航开始前算好，Transition 才能拿到正确的名字
const transitionName = ref<'swap-forward' | 'swap-back' | 'page-fade'>('page-fade')
const removeGuard = router.beforeEach((to, from) => {
  const delta = (to.meta.depth ?? 1) - (from.meta.depth ?? 1)
  transitionName.value = delta > 0 ? 'swap-forward' : delta < 0 ? 'swap-back' : 'page-fade'
})
onUnmounted(removeGuard)

// 侧栏默认打开，开关状态存在 localStorage。
// 窄屏下侧栏会挤占内容：窄屏时默认收起、切换页面后自动收起，且不改写保存的偏好
const storedOpen = useStorage('cloud-pvz:sidebar-open', true)
const isNarrow = useMediaQuery('(max-width: 767px)')
const narrowOpen = ref(false)
const sidebarOpen = computed({
  get: () => (isNarrow.value ? narrowOpen.value : storedOpen.value),
  set: (value: boolean) => {
    if (isNarrow.value) narrowOpen.value = value
    else storedOpen.value = value
  },
})
watch(() => route.path, () => {
  narrowOpen.value = false
})

/** 页面实例的身份：存档详情里切换分类只换地址，不重建页面（编辑中的草稿要保留） */
function pageKey(current: RouteLocationNormalizedLoaded): string {
  return current.name === 'profile' ? `profile:${String(current.params.id)}` : current.fullPath
}
</script>

<template>
  <SidebarProvider
    v-model:open="sidebarOpen"
    class="h-svh"
  >
    <AppSidebar />
    <SidebarInset class="h-svh min-w-0">
      <CollapsedSidebarBar />
      <div class="relative min-h-0 flex-1">
        <RouterView v-slot="{ Component, route: current }">
          <RouteTransition :name="transitionName">
            <component
              :is="Component"
              :key="pageKey(current)"
            />
          </RouteTransition>
        </RouterView>
        <!-- 游戏页常驻、只做显隐：iframe 一旦被移出文档就会重新加载，游戏会被重启。
             放在路由视图之后，保证显示时叠在最上层、接收点击 -->
        <Transition name="page-fade">
          <div
            v-show="isGameRoute"
            class="absolute inset-0"
          >
            <GamePage />
          </div>
        </Transition>
        <SyncDock class="absolute right-4 bottom-4 z-(--z-raised)" />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>

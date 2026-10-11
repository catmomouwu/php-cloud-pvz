<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@felinic/ui'
import { useResizeObserver } from '@vueuse/core'
import { CircleUserRound, Gamepad2, LogOut, Save, Settings } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useSignOut } from '@/composables/useSignOut'
import AppLogo from './AppLogo.vue'
import SidebarToggle from './SidebarToggle.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const signOut = useSignOut()

const items = [
  { name: 'game', to: '/', icon: Gamepad2, labelKey: 'nav.game' },
  { name: 'saves', to: '/saves', icon: Save, labelKey: 'nav.saves' },
  { name: 'settings', to: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

// 用户详情页属于“存档”
const activeName = computed(() => (route.name === 'profile' ? 'saves' : route.name))

// 当前项的高亮是一块独立的背景，切换页面时滑到新的一项（与组件库分段控件滑块同样的 250ms 曲线）
const menu = useTemplateRef<{ $el: HTMLElement }>('menu')
const indicator = ref<{ top: number, height: number } | null>(null)
/** 首次定位不播放动画，之后才开启过渡 */
const animate = ref(false)

function measure() {
  const item = menu.value?.$el.querySelector<HTMLElement>(`[data-nav="${String(activeName.value)}"]`)
  indicator.value = item ? { top: item.offsetTop, height: item.offsetHeight } : null
}

watch(activeName, () => void nextTick(measure))
// 字号缩放、侧栏展开时尺寸会变
useResizeObserver(() => menu.value?.$el, measure)
onMounted(() => {
  measure()
  requestAnimationFrame(() => (animate.value = true))
})
</script>

<template>
  <!-- offcanvas：收起时整个侧栏移出视口，从顶栏按钮或 ⌘B 打开 -->
  <Sidebar collapsible="offcanvas">
    <!-- 品牌行，右侧是收起侧栏的抽屉按钮 -->
    <div class="flex h-12 shrink-0 items-center gap-2 pr-2 pl-4">
      <AppLogo class="size-4 shrink-0 text-foreground" />
      <span class="min-w-0 flex-1 truncate text-control font-semibold text-foreground">
        {{ t('app.name') }}
      </span>
      <SidebarToggle />
    </div>

    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu
          ref="menu"
          class="relative"
        >
          <li
            v-if="indicator"
            aria-hidden="true"
            class="pointer-events-none absolute inset-x-0 top-0 rounded-lg bg-sidebar-accent motion-reduce:transition-none"
            :class="animate && 'transition-[translate,height] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]'"
            :style="{ translate: `0 ${indicator.top}px`, height: `${indicator.height}px` }"
          />
          <SidebarMenuItem
            v-for="item in items"
            :key="item.name"
            :data-nav="item.name"
          >
            <!-- 高亮背景由上面的滑块负责，按钮自身的选中背景置空，只保留选中的文字样式 -->
            <SidebarMenuButton
              as-child
              :is-active="activeName === item.name"
              class="data-[active=true]:bg-transparent"
            >
              <RouterLink :to="item.to">
                <component :is="item.icon" />
                <span>{{ t(item.labelKey) }}</span>
              </RouterLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu v-if="user">
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton>
                <CircleUserRound />
                <span>{{ user.email }}</span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              class="w-(--reka-dropdown-menu-trigger-width)"
            >
              <DropdownMenuItem @select="router.push({ name: 'settings' })">
                <Settings />
                {{ t('account.settings') }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="signOut">
                <LogOut />
                {{ t('account.signOut') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>

import { h } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { currentUser } from './composables/useAuth'
import AppLayout from './layouts/AppLayout.vue'
import AuthLayout from './layouts/AuthLayout.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** 浏览器标签页标题对应的 i18n key */
    titleKey?: string
    /** 不需要登录即可访问（登录、注册页） */
    public?: boolean
    /** 页面层级：数值变大是进入详情（swap-forward），变小是返回（swap-back），相同为同级切换 */
    depth?: number
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        // 游戏页由 AppLayout 常驻渲染，这里只放一个空元素占位（让切换动画有元素可用）
        { path: '', name: 'game', component: { render: () => h('div', { class: 'h-full' }) }, meta: { titleKey: 'nav.game' } },
        { path: 'saves', name: 'saves', component: () => import('./pages/SavesPage.vue'), meta: { titleKey: 'nav.saves', depth: 1 } },
        { path: 'saves/:id(\\d+)', name: 'profile', component: () => import('./pages/ProfileDetailPage.vue'), meta: { titleKey: 'nav.saves', depth: 2 } },
        // 历史版本已并入各用户的详情页
        { path: 'history', redirect: { name: 'saves' } },
        { path: 'settings', name: 'settings', component: () => import('./pages/SettingsPage.vue'), meta: { titleKey: 'nav.settings' } },
      ],
    },
    {
      path: '/',
      component: AuthLayout,
      children: [
        { path: 'login', name: 'login', component: () => import('./pages/AuthPage.vue'), props: { mode: 'login' }, meta: { public: true } },
        { path: 'register', name: 'register', component: () => import('./pages/AuthPage.vue'), props: { mode: 'register' }, meta: { public: true } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// 必须登录才能使用：未登录一律去登录页，登录后不再停留在登录 / 注册页
router.beforeEach(async (to) => {
  const user = await currentUser()
  if (!to.meta.public && !user) {
    return { name: 'login', query: to.fullPath === '/' ? undefined : { redirect: to.fullPath } }
  }
  if (to.meta.public && user) return { name: 'game' }
  return true
})

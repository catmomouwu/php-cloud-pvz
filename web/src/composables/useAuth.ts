import { until } from '@vueuse/core'
import { computed } from 'vue'
import { authClient } from '@/lib/auth-client'

const session = authClient.useSession()

const user = computed(() => session.value.data?.user ?? null)

/** 路由守卫用：等首次读取会话完成后返回当前用户 */
export async function currentUser() {
  await until(() => session.value.isPending).toBe(false)
  return user.value
}

/** 登录 / 注册成功后等会话刷新，再跳转（否则路由守卫可能还看不到用户） */
export async function waitForUser(timeout = 5000) {
  await until(user).toBeTruthy({ timeout })
  return user.value
}

export function useAuth() {
  return {
    user,
    pending: computed(() => session.value.isPending),
  }
}

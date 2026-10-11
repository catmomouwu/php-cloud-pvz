import { useRouter } from 'vue-router'
import { authClient } from '@/lib/auth-client'
import { useCloudSync } from './useCloudSync'
import { useGameSession } from './useGameSession'

/**
 * 退出登录：停止游戏 → 把本地改动推上云端 → 已同步则清空本机存档（云端有完整副本，
 * 避免下一个登录的账号看到别人的存档）→ 退出并回到登录页。
 */
export function useSignOut() {
  const router = useRouter()
  const session = useGameSession()
  const sync = useCloudSync()

  return async () => {
    if (session.isActive.value) await session.stop()
    await sync.flushBeforeSignOut()
    await sync.clearLocalIfSynced()
    await authClient.signOut()
    await router.push({ name: 'login' })
  }
}

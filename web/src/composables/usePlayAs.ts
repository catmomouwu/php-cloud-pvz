import { useRouter } from 'vue-router'
import { useCloudSync } from './useCloudSync'
import { useGameSession } from './useGameSession'
import { useGameSettings } from './useGameSettings'

/** 以某个游戏内用户开始游戏：设为启动用户，切到游戏页；未运行时先与云端对齐再启动 */
export function usePlayAs() {
  const router = useRouter()
  const settings = useGameSettings()
  const session = useGameSession()
  const sync = useCloudSync()

  return async (name: string) => {
    settings.value.launchUser = name
    void router.push({ name: 'game' })
    if (!session.isActive.value && await sync.prepareLaunch()) session.start(settings.value)
  }
}

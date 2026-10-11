import { useStorage } from '@vueuse/core'
import { DEFAULT_GAME_SETTINGS, type GameSettings } from '@shared/pvz/game-config'

const settings = useStorage<GameSettings>('cloud-pvz:game-settings', { ...DEFAULT_GAME_SETTINGS }, localStorage, {
  mergeDefaults: true,
})

export function useGameSettings() {
  return settings
}

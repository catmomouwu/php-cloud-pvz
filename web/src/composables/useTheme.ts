import { usePreferredDark, useStorage } from '@vueuse/core'
import { watchEffect } from 'vue'

// 与 @felinic/ui 约定一致：深色模式是 <html> 上的 .dark；配色固定用组件库默认方案
export const THEME_MODES = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

const mode = useStorage<ThemeMode>('cloud-pvz:theme', 'system')
const prefersDark = usePreferredDark()

watchEffect(() => {
  const root = document.documentElement
  root.classList.toggle('dark', mode.value === 'dark' || (mode.value === 'system' && prefersDark.value))
})

export function useTheme() {
  return { mode }
}

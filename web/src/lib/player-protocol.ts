// 外层页面与游戏 iframe（player.html）之间的消息约定。
// 启动参数通过 URL hash 传入：游戏运行时无法在同一页面重启，每次启动都重新加载 iframe。

import type { GameSettings, ScaleMode } from '@shared/pvz/game-config'

export const PLAYER_PATH = '/player.html'
export const MESSAGE_SOURCE = 'cloud-pvz'

export type PlayerStatus = 'loading' | 'running' | 'exited' | 'error'

export type PlayerErrorCode = 'missing-resources' | 'runtime-failed'

export type PlayerToParent =
  | { source: typeof MESSAGE_SOURCE, type: 'status', status: PlayerStatus, error?: PlayerErrorCode, detail?: string }
  | { source: typeof MESSAGE_SOURCE, type: 'saves-changed' }
  | { source: typeof MESSAGE_SOURCE, type: 'flushed' }

export type ParentToPlayer =
  | { source: typeof MESSAGE_SOURCE, type: 'set-scale', scale: ScaleMode }
  | { source: typeof MESSAGE_SOURCE, type: 'set-muted', muted: boolean }
  | { source: typeof MESSAGE_SOURCE, type: 'flush' }

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** 发送时由 post/send 自动补上 source */
export type PlayerMessage = DistributiveOmit<PlayerToParent, 'source'>
export type ParentMessage = DistributiveOmit<ParentToPlayer, 'source'>

export function encodeLaunchConfig(settings: GameSettings): string {
  const json = JSON.stringify(settings)
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
}

export function decodeLaunchConfig(hash: string): GameSettings | null {
  try {
    const binary = atob(hash.replace(/^#/, ''))
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as GameSettings
  }
  catch {
    return null
  }
}

export function isPlayerMessage(data: unknown): data is PlayerToParent {
  return typeof data === 'object' && data !== null && (data as { source?: unknown }).source === MESSAGE_SOURCE
}

export function isParentMessage(data: unknown): data is ParentToPlayer {
  return typeof data === 'object' && data !== null && (data as { source?: unknown }).source === MESSAGE_SOURCE
}

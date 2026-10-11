// 游戏会话：管理 iframe 的生命周期与消息。
// 游戏运行时无法重启，停止 = 卸载 iframe，重启 = 换一个新的 iframe。

import { computed, ref, shallowRef } from 'vue'
import type { GameSettings, ScaleMode } from '@shared/pvz/game-config'
import { encodeLaunchConfig, isPlayerMessage, MESSAGE_SOURCE, type ParentMessage, PLAYER_PATH, type PlayerErrorCode } from '@/lib/player-protocol'
import { emitSavesChanged } from '@/lib/save-events'
import { refreshLocalSaves } from './useLocalSaves'

export type SessionStatus = 'idle' | 'loading' | 'running' | 'error'

const FLUSH_TIMEOUT_MS = 3000

const status = ref<SessionStatus>('idle')
const error = ref<PlayerErrorCode | null>(null)
const src = ref<string | null>(null)
/** 当前运行实例启动时使用的设置，用于判断是否有需要重启才生效的改动 */
const launchedWith = shallowRef<GameSettings | null>(null)
const frame = shallowRef<HTMLIFrameElement | null>(null)

let launchCount = 0
let pendingFlush: (() => void) | null = null

function send(message: ParentMessage) {
  frame.value?.contentWindow?.postMessage({ source: MESSAGE_SOURCE, ...message }, location.origin)
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== frame.value?.contentWindow) return
  if (!isPlayerMessage(event.data)) return
  const message = event.data
  switch (message.type) {
    case 'status':
      if (message.status === 'exited') {
        unload()
        void refreshLocalSaves()
        emitSavesChanged()
      }
      else {
        status.value = message.status
        error.value = message.error ?? null
      }
      break
    case 'saves-changed':
      void refreshLocalSaves()
      emitSavesChanged()
      break
    case 'flushed':
      pendingFlush?.()
      break
  }
})

function unload() {
  src.value = null
  launchedWith.value = null
  status.value = 'idle'
  error.value = null
}

/** 请求 iframe 把内存中的存档写入 IndexedDB；超时也继续，避免卡住停止操作 */
function flush(): Promise<void> {
  if (status.value !== 'running') return Promise.resolve()
  return new Promise((resolve) => {
    const timer = window.setTimeout(done, FLUSH_TIMEOUT_MS)
    function done() {
      window.clearTimeout(timer)
      pendingFlush = null
      resolve()
    }
    pendingFlush = done
    send({ type: 'flush' })
  })
}

function start(settings: GameSettings) {
  launchCount += 1
  launchedWith.value = { ...settings }
  status.value = 'loading'
  error.value = null
  // 查询参数只用来强制重新加载 iframe
  src.value = `${PLAYER_PATH}?launch=${launchCount}#${encodeLaunchConfig(settings)}`
}

async function stop() {
  await flush()
  unload()
  void refreshLocalSaves()
  emitSavesChanged()
}

async function restart(settings: GameSettings) {
  await flush()
  start(settings)
}

function setScale(scale: ScaleMode) {
  if (launchedWith.value) launchedWith.value = { ...launchedWith.value, scale }
  send({ type: 'set-scale', scale })
}

function setMuted(muted: boolean) {
  if (launchedWith.value) launchedWith.value = { ...launchedWith.value, muted }
  send({ type: 'set-muted', muted })
}

/** 与运行中实例相比，是否有需要重启才生效的设置改动（缩放、静音可即时生效，不计入） */
function needsRestart(current: GameSettings): boolean {
  const launched = launchedWith.value
  if (!launched) return false
  return (Object.keys(current) as (keyof GameSettings)[])
    .some(key => key !== 'scale' && key !== 'muted' && current[key] !== launched[key])
}

export function useGameSession() {
  return {
    status,
    error,
    src,
    frame,
    isActive: computed(() => src.value !== null),
    start,
    stop,
    restart,
    setScale,
    setMuted,
    needsRestart,
  }
}

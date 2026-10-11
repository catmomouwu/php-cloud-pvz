// 游戏写入存档后（已落到 IndexedDB）的通知，供存档列表刷新与云同步订阅
type Listener = () => void

const listeners = new Set<Listener>()

export function onSavesChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitSavesChanged() {
  for (const listener of listeners) listener()
}

import { ref } from 'vue'

export type ResourceState = 'checking' | 'found' | 'missing'

const state = ref<ResourceState>('checking')
const size = ref(0)
let pending: Promise<void> | null = null

// 开发阶段 main.pak 由 Vite 从 web/public/ 提供；不存在时开发服务器可能回退成 index.html
async function check() {
  state.value = 'checking'
  try {
    const response = await fetch('/main.pak', { method: 'HEAD' })
    const contentType = response.headers.get('content-type') ?? ''
    if (response.ok && !contentType.includes('text/html')) {
      size.value = Number(response.headers.get('content-length') ?? 0)
      state.value = 'found'
      return
    }
  }
  catch {
    // 网络错误按缺失处理
  }
  state.value = 'missing'
}

export function useResourceStatus() {
  if (!pending) pending = check()
  return { state, size, recheck: () => (pending = check()) }
}

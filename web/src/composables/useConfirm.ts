// 在组件里排队一个待确认的操作：ask() 打开弹窗，确认后执行；配合 ConfirmDialog 使用
import { computed, ref } from 'vue'

export interface ConfirmRequest {
  title: string
  description?: string
  confirmLabel: string
  destructive?: boolean
  run: () => void | Promise<void>
}

export function useConfirm() {
  const request = ref<ConfirmRequest | null>(null)
  const open = computed({
    get: () => request.value !== null,
    set: (value: boolean) => {
      if (!value) request.value = null
    },
  })

  function ask(next: ConfirmRequest) {
    request.value = next
  }

  async function confirm() {
    const current = request.value
    request.value = null
    await current?.run()
  }

  return { request, open, ask, confirm }
}

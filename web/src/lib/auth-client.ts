// 自实现的认证客户端，替代 better-auth/vue（PHP 虚拟主机部署用）。
// 接口与 better-auth 客户端一致（useSession / signIn.email / signUp.email / signOut），
// 线格式也保持兼容：POST /api/auth/sign-{in,up}/email 返回 { token, user }，
// GET /api/auth/get-session 返回 { session, user } 或 null，会话通过 HttpOnly cookie 传递。
// 因此同一份前端构建既可对接 PHP 后端，也可对接原 Nitro + better-auth 后端。

import { ref, type Ref } from 'vue'

export interface AuthUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthError {
  code?: string
  message?: string
}

interface SessionPayload {
  session: Record<string, unknown> | null
  user: AuthUser | null
}

interface SessionState {
  data: SessionPayload | null
  isPending: boolean
  error: AuthError | null
}

interface AuthResult {
  data?: unknown
  error?: AuthError
}

const state = ref<SessionState>({ data: null, isPending: true, error: null })
let started = false
let inFlight: Promise<void> | null = null

async function run(): Promise<void> {
  try {
    const response = await fetch('/api/auth/get-session', { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json() as SessionPayload | null
    state.value = { data: payload, isPending: false, error: null }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'request failed'
    state.value = { data: null, isPending: false, error: { message } }
  }
}

function refetch(): Promise<void> {
  if (!inFlight) inFlight = run().finally(() => { inFlight = null })
  return inFlight
}

/** 与 better-auth 客户端相同：返回响应式会话；首次调用触发一次 get-session */
function useSession(): Ref<SessionState> {
  if (!started) {
    started = true
    void refetch()
  }
  return state
}

/** POST 认证端点；不抛异常，失败时返回 { error }，成功后刷新会话 */
async function post(path: string, body: Record<string, unknown>): Promise<AuthResult> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => null) as { code?: string, message?: string, error?: { code?: string, message?: string }, data?: { code?: string, message?: string } } | null
    if (!response.ok) {
      // 兼容多种错误体：PHP 后端为 {statusCode,...,data:{code}}，better-auth 原生为 {code,message}
      const code = payload?.code ?? payload?.data?.code ?? payload?.error?.code
      const message = payload?.message ?? payload?.data?.message ?? payload?.error?.message
      return { error: { code, message } }
    }
    void refetch()
    return { data: payload }
  }
  catch {
    return { error: { message: 'network error' } }
  }
}

export const authClient = {
  useSession,
  signIn: {
    email: (args: { email: string, password: string }) => post('/api/auth/sign-in/email', args),
  },
  signUp: {
    email: (args: { email: string, password: string, name: string }) => post('/api/auth/sign-up/email', args),
  },
  signOut: () => post('/api/auth/sign-out', {}),
}

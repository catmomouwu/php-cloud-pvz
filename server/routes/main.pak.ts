// 部署环境下的游戏资源 main.pak，只给已登录用户：
// - 设置了 NITRO_GAME_PAK_PATH 时从本地文件读取（Docker 里挂载进来）；
// - 否则从存档用的 S3 兼容存储里读取 game/main.pak（如 Cloudflare 上的 R2）。
// 支持 HEAD：设置页用它检查资源是否就绪，只返回大小、不传内容。
// 本地开发时由 Vite 直接提供 web/public/main.pak，不经过这里。

const GAME_PAK_KEY = 'game/main.pak'

/** HEAD 的响应：200 + 文件大小，没有内容（返回 null 会变成 204 并丢掉 content-length） */
function headOnly(headers: Record<string, string>, size: number): Response {
  return new Response(null, { status: 200, headers: { ...headers, 'content-length': String(size) } })
}

export default defineEventHandler(async (event) => {
  const method = event.method
  if (method !== 'GET' && method !== 'HEAD') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }
  await requireUser(event)
  const head = method === 'HEAD'
  const path = useRuntimeConfig(event).gamePakPath
  const headers = { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=86400' }

  if (path) {
    const { stat } = await import('node:fs/promises')
    const info = await stat(path).catch(() => null)
    if (!info?.isFile()) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    if (head) return headOnly(headers, info.size)
    setResponseHeaders(event, { ...headers, 'content-length': info.size })
    const { createReadStream } = await import('node:fs')
    return sendStream(event, createReadStream(path))
  }

  const store = useSaveStore(event)
  if (head) {
    const size = await store.size(GAME_PAK_KEY)
    if (size === null) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    return headOnly(headers, size)
  }
  const object = await store.open(GAME_PAK_KEY)
  if (!object?.body) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const length = object.headers.get('content-length')
  setResponseHeaders(event, length ? { ...headers, 'content-length': Number(length) } : headers)
  return sendStream(event, object.body)
})

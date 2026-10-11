// 部署环境下的游戏资源 main.pak，只给已登录用户：
// - 设置了 NITRO_GAME_PAK_PATH 时从本地文件读取（Docker 里挂载进来）；
// - 否则从存档用的 S3 兼容存储里读取 game/main.pak（如 Cloudflare 上的 R2）。
// 本地开发时由 Vite 直接提供 web/public/main.pak，不经过这里。

const GAME_PAK_KEY = 'game/main.pak'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const path = useRuntimeConfig(event).gamePakPath
  const headers = { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=86400' }

  if (path) {
    const { createReadStream } = await import('node:fs')
    const { stat } = await import('node:fs/promises')
    const info = await stat(path).catch(() => null)
    if (!info?.isFile()) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    setResponseHeaders(event, { ...headers, 'content-length': info.size })
    return sendStream(event, createReadStream(path))
  }

  const object = await useSaveStore(event).open(GAME_PAK_KEY)
  if (!object?.body) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const length = object.headers.get('content-length')
  setResponseHeaders(event, length ? { ...headers, 'content-length': Number(length) } : headers)
  return sendStream(event, object.body)
})

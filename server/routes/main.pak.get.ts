// 部署环境下的游戏资源：从 NITRO_GAME_PAK_PATH 读取（Docker 里挂载进来），只给已登录用户。
// 本地开发时由 Vite 直接提供 web/public/main.pak，不经过这里。
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const path = useRuntimeConfig(event).gamePakPath
  if (!path) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const { createReadStream } = await import('node:fs')
  const { stat } = await import('node:fs/promises')
  const info = await stat(path).catch(() => null)
  if (!info?.isFile()) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  setResponseHeaders(event, {
    'content-type': 'application/octet-stream',
    'content-length': info.size,
    'cache-control': 'private, max-age=3600',
  })
  return sendStream(event, createReadStream(path))
})

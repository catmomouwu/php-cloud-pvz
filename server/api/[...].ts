// 未匹配的 /api/** 一律 404，避免落入 SPA 回退返回 index.html
export default defineEventHandler(() => {
  throw createError({ statusCode: 404, statusMessage: 'Not Found', data: { code: 'NOT_FOUND' } })
})

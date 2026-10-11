// SPA 回退：静态资源之外的页面路由都返回前端 index.html。
// 带扩展名的路径（如 /main.pak）视为文件请求，不存在就是 404，不回退。
export default defineEventHandler(async (event) => {
  const html = /\.[a-z0-9]+$/i.test(event.path.split('?')[0] ?? '')
    ? null
    : await useStorage('assets:spa').getItem<string>('index.html')
  if (!html) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  return html
})

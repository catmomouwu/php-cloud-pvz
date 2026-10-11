// 下载某个历史版本的 zip
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const key = parseProfileKey(event)
  const version = Number(getRouterParam(event, 'version'))
  const row = Number.isInteger(version) ? await getVersion(event, user.id, key, version) : null
  if (!row?.objectKey) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', data: { code: 'VERSION_NOT_FOUND' } })
  }
  const archive = await useSaveStore(event).get(row.objectKey)
  if (!archive) throw createError({ statusCode: 404, statusMessage: 'Not Found', data: { code: 'OBJECT_NOT_FOUND' } })
  setResponseHeaders(event, {
    'content-type': 'application/zip',
    'content-disposition': `attachment; filename="pvz-${encodeURIComponent(row.name)}-v${row.version}.zip"`,
    'cache-control': 'private, no-store',
  })
  return archive
})

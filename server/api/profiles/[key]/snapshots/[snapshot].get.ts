// 导出快照：与存档导入格式相同的 zip
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const row = await getSnapshot(event, user.id, parseProfileKey(event), parseSnapshotId(event))
  const archive = await readSnapshotArchive(event, row)
  setResponseHeaders(event, {
    'content-type': 'application/zip',
    'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`pvz-${row.name}-${row.label}.zip`)}`,
    'cache-control': 'private, no-store',
  })
  return archive
})

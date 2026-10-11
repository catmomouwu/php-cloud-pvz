// 重命名快照
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const row = await getSnapshot(event, user.id, parseProfileKey(event), parseSnapshotId(event))
  const { label: raw } = await readBody<{ label?: unknown }>(event) ?? {}
  const label = normalizeLabel(raw)
  if (!label) throw createError({ statusCode: 400, statusMessage: 'Bad Request', data: { code: 'INVALID_LABEL' } })
  return { snapshot: toSnapshotDto(await renameSnapshot(event, row, label)) }
})

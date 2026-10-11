// 把云端当前版本存为快照；满额时返回 409 SNAPSHOT_LIMIT，客户端确认后带 replaceOldest 重试
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const key = parseProfileKey(event)
  const body = await readBody<{ label?: unknown, replaceOldest?: unknown }>(event) ?? {}
  const label = normalizeLabel(body.label)
  if (!label) throw createError({ statusCode: 400, statusMessage: 'Bad Request', data: { code: 'INVALID_LABEL' } })
  const row = await createSnapshot(event, { userId: user.id, key, label, replaceOldest: body.replaceOldest === true })
  return { snapshot: toSnapshotDto(row) }
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const row = await getSnapshot(event, user.id, parseProfileKey(event), parseSnapshotId(event))
  await removeSnapshot(event, row)
  return { ok: true }
})

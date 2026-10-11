export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await listSnapshots(event, user.id, parseProfileKey(event))
  return { snapshots: rows.map(toSnapshotDto) }
})

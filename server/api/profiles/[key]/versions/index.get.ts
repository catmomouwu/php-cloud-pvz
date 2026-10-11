export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await listVersions(event, user.id, parseProfileKey(event))
  return { versions: rows.map(toVersionDto) }
})

// 把某个历史版本恢复为最新版本（生成新版本；若已删除则同时取消删除）
import { unpackProfile } from '@shared/pvz/profile-archive'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const key = parseProfileKey(event)
  const { version } = await readBody<{ version?: unknown }>(event) ?? {}
  const row = typeof version === 'number' ? await getVersion(event, user.id, key, version) : null
  if (!row?.objectKey) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', data: { code: 'VERSION_NOT_FOUND' } })
  }
  const archive = await useSaveStore(event).get(row.objectKey)
  if (!archive) throw createError({ statusCode: 404, statusMessage: 'Not Found', data: { code: 'OBJECT_NOT_FOUND' } })
  const head = await commitProfile(event, {
    userId: user.id,
    key,
    profile: unpackProfile(archive),
    baseVersion: null,
    source: 'restore',
  })
  return { head: toHeadDto(head) }
})

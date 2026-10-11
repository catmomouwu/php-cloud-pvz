// 把快照还原为最新版本（生成一条新的同步记录；用户已删除时同时取消删除）
import { unpackProfile } from '@shared/pvz/profile-archive'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const key = parseProfileKey(event)
  const row = await getSnapshot(event, user.id, key, parseSnapshotId(event))
  const head = await commitProfile(event, {
    userId: user.id,
    key,
    profile: unpackProfile(await readSnapshotArchive(event, row)),
    baseVersion: null,
    source: 'snapshot',
  })
  return { head: toHeadDto(head) }
})

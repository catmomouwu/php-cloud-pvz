// 当前账号在云端的全部游戏内用户（包含已删除的，供其他设备同步删除）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await listProfiles(event, user.id)
  return { profiles: rows.map(toHeadDto) }
})

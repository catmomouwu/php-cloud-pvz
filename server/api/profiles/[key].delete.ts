// 删除一个用户（打删除标记，历史保留）；base 不一致返回 409
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const row = await deleteProfileHead(event, user.id, parseProfileKey(event), parseBase(event))
  return { head: toHeadDto(row) }
})

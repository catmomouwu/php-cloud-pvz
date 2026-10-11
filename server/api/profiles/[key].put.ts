// 上传一个用户：body 为该用户的 zip 包，base 是客户端基于的版本（新建为 0）。
// base 与云端不一致返回 409 PROFILE_CONFLICT（附云端当前状态）；重名返回 409 NAME_TAKEN。
import { ArchiveError, MAX_ARCHIVE_BYTES } from '@shared/pvz/archive'
import { type ProfileFiles, unpackProfile } from '@shared/pvz/profile-archive'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const key = parseProfileKey(event)
  const base = parseBase(event)

  if (Number(getRequestHeader(event, 'content-length') ?? 0) > MAX_ARCHIVE_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Payload Too Large', data: { code: 'ARCHIVE_TOO_LARGE' } })
  }
  const body = await readRawBody(event, false)
  if (!body) throw createError({ statusCode: 400, statusMessage: 'Bad Request', data: { code: 'EMPTY_ARCHIVE' } })

  let profile: ProfileFiles
  try {
    profile = unpackProfile(new Uint8Array(body))
  }
  catch (error) {
    if (error instanceof ArchiveError) {
      throw createError({ statusCode: 400, statusMessage: 'Bad Request', data: { code: 'INVALID_ARCHIVE', detail: error.message } })
    }
    throw error
  }

  const row = await commitProfile(event, { userId: user.id, key, profile, baseVersion: base, source: 'upload' })
  return { head: toHeadDto(row) }
})

// 云端存档按游戏内用户管理：每个用户独立的版本号、历史与恢复。
// 写入顺序：对象先写 S3，再用条件更新推进 version（乐观并发），最后记录历史并清理旧版本。
// D1 没有交互式事务，这个顺序保证不会出现指向不存在对象的版本。

import {
  type ProfileFiles,
  type ProfileHeadDto,
  type ProfileStats,
  type ProfileVersionDto,
  packProfile,
  profileDigest,
  profileName,
  summarizeProfile,
} from '@shared/pvz/profile-archive'
import { MAX_PROFILE_NAME_LENGTH } from '@shared/pvz/profiles'
import { and, desc, eq, isNull, ne } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { saveProfile, saveProfileVersion } from '../db/schema'

/** 每个用户保留的历史版本数 */
export const KEEP_VERSIONS = 30

type ProfileRow = typeof saveProfile.$inferSelect
type VersionRow = typeof saveProfileVersion.$inferSelect

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function parseProfileKey(event: H3Event): string {
  const key = getRouterParam(event, 'key') ?? ''
  if (!UUID.test(key)) throw createError({ statusCode: 400, statusMessage: 'Bad Request', data: { code: 'INVALID_KEY' } })
  return key
}

export function parseBase(event: H3Event): number {
  const base = Number(getQuery(event).base)
  if (!Number.isInteger(base) || base < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', data: { code: 'INVALID_BASE' } })
  }
  return base
}

export function toHeadDto(row: ProfileRow): ProfileHeadDto {
  return {
    key: row.id,
    name: row.name,
    version: row.version,
    sha256: row.sha256,
    size: row.size,
    stats: JSON.parse(row.stats) as ProfileStats,
    deleted: row.deletedAt !== null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toVersionDto(row: VersionRow): ProfileVersionDto {
  return {
    version: row.version,
    name: row.name,
    sha256: row.sha256,
    size: row.size,
    stats: JSON.parse(row.stats) as ProfileStats,
    source: row.source,
    hasContent: row.objectKey !== null,
    createdAt: row.createdAt.toISOString(),
  }
}

function conflict(row: ProfileRow | null) {
  return createError({
    statusCode: 409,
    statusMessage: 'Conflict',
    data: { code: 'PROFILE_CONFLICT', head: row ? toHeadDto(row) : null },
  })
}

function nameTaken(name: string) {
  return createError({ statusCode: 409, statusMessage: 'Conflict', data: { code: 'NAME_TAKEN', name } })
}

export async function listProfiles(event: H3Event, userId: string): Promise<ProfileRow[]> {
  const db = await useDb(event)
  return db.select().from(saveProfile).where(eq(saveProfile.userId, userId))
}

export async function getProfile(event: H3Event, userId: string, key: string): Promise<ProfileRow | null> {
  const db = await useDb(event)
  const rows = await db.select().from(saveProfile)
    .where(and(eq(saveProfile.id, key), eq(saveProfile.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

/** 账号内未删除的用户不能重名（不区分大小写，与游戏一致） */
async function assertNameAvailable(event: H3Event, userId: string, key: string, name: string) {
  const db = await useDb(event)
  const others = await db.select({ name: saveProfile.name }).from(saveProfile)
    .where(and(eq(saveProfile.userId, userId), ne(saveProfile.id, key), isNull(saveProfile.deletedAt)))
  if (others.some(other => other.name.toLowerCase() === name.toLowerCase())) throw nameTaken(name)
}

interface CommitInput {
  userId: string
  key: string
  profile: ProfileFiles
  /** 客户端基于的版本；null 表示不检查（恢复历史版本） */
  baseVersion: number | null
  source: 'upload' | 'restore'
}

/** 写入一个用户的新版本（新建 / 更新 / 从删除状态恢复） */
export async function commitProfile(event: H3Event, input: CommitInput): Promise<ProfileRow> {
  const db = await useDb(event)
  const store = useSaveStore(event)

  const name = profileName(input.profile).trim()
  if (!name || [...name].length > MAX_PROFILE_NAME_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', data: { code: 'INVALID_NAME' } })
  }
  const sha256 = await profileDigest(input.profile)
  const current = await getProfile(event, input.userId, input.key)

  // 内容与云端一致且未删除：不产生新版本
  if (current && current.deletedAt === null && current.sha256 === sha256) return current
  if (input.baseVersion !== null && input.baseVersion !== (current?.version ?? 0)) throw conflict(current)
  await assertNameAvailable(event, input.userId, input.key, name)

  const archive = packProfile(input.profile)
  const objectKey = `saves/${input.userId}/${input.key}/${crypto.randomUUID()}.zip`
  await store.put(objectKey, archive)

  const stats = JSON.stringify(summarizeProfile(input.profile))
  const now = new Date()
  const values = { name, sha256, size: archive.byteLength, stats, deletedAt: null, updatedAt: now }
  const expected = current?.version ?? 0

  const updated = current
    ? await db.update(saveProfile)
        .set({ ...values, version: expected + 1 })
        .where(and(eq(saveProfile.id, input.key), eq(saveProfile.version, expected)))
        .returning()
    : await db.insert(saveProfile)
        .values({ id: input.key, userId: input.userId, version: 1, createdAt: now, ...values })
        .onConflictDoNothing()
        .returning()

  const row = updated[0]
  if (!row) {
    await store.delete(objectKey)
    throw conflict(await getProfile(event, input.userId, input.key))
  }

  await db.insert(saveProfileVersion).values({
    id: crypto.randomUUID(),
    profileId: row.id,
    userId: input.userId,
    version: row.version,
    objectKey,
    name,
    sha256,
    size: archive.byteLength,
    stats,
    source: input.source,
    createdAt: now,
  })
  await pruneVersions(event, row.id)
  return row
}

/** 删除：打删除标记并推进版本，历史保留 */
export async function deleteProfileHead(event: H3Event, userId: string, key: string, baseVersion: number): Promise<ProfileRow> {
  const db = await useDb(event)
  const current = await getProfile(event, userId, key)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Not Found', data: { code: 'PROFILE_NOT_FOUND' } })
  if (current.deletedAt !== null) return current
  if (current.version !== baseVersion) throw conflict(current)

  const now = new Date()
  const updated = await db.update(saveProfile)
    .set({ version: baseVersion + 1, deletedAt: now, updatedAt: now })
    .where(and(eq(saveProfile.id, key), eq(saveProfile.version, baseVersion)))
    .returning()
  const row = updated[0]
  if (!row) throw conflict(await getProfile(event, userId, key))

  await db.insert(saveProfileVersion).values({
    id: crypto.randomUUID(),
    profileId: key,
    userId,
    version: row.version,
    objectKey: null,
    name: row.name,
    sha256: row.sha256,
    size: 0,
    stats: row.stats,
    source: 'delete',
    createdAt: now,
  })
  await pruneVersions(event, key)
  return row
}

async function pruneVersions(event: H3Event, profileId: string) {
  const db = await useDb(event)
  const store = useSaveStore(event)
  const stale = await db.select().from(saveProfileVersion)
    .where(eq(saveProfileVersion.profileId, profileId))
    .orderBy(desc(saveProfileVersion.version))
    .limit(1000)
    .offset(KEEP_VERSIONS)
  for (const row of stale) {
    if (row.objectKey) await store.delete(row.objectKey)
    await db.delete(saveProfileVersion).where(eq(saveProfileVersion.id, row.id))
  }
}

export async function listVersions(event: H3Event, userId: string, key: string): Promise<VersionRow[]> {
  const db = await useDb(event)
  return db.select().from(saveProfileVersion)
    .where(and(eq(saveProfileVersion.profileId, key), eq(saveProfileVersion.userId, userId)))
    .orderBy(desc(saveProfileVersion.version))
    .limit(KEEP_VERSIONS)
}

export async function getVersion(event: H3Event, userId: string, key: string, version: number): Promise<VersionRow | null> {
  const db = await useDb(event)
  const rows = await db.select().from(saveProfileVersion)
    .where(and(
      eq(saveProfileVersion.profileId, key),
      eq(saveProfileVersion.userId, userId),
      eq(saveProfileVersion.version, version),
    ))
    .limit(1)
  return rows[0] ?? null
}

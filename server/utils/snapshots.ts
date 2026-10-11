// 快照：用户手动保存的某个时刻的存档，每个游戏内用户最多 MAX_SNAPSHOTS 个。
// 快照内容单独复制一份到 S3（saves/{userId}/{profileKey}/snapshots/{uuid}.zip），
// 同步记录被清理时不受影响。满额时需要客户端明确同意覆盖最早的一个。

import { MAX_SNAPSHOT_LABEL_LENGTH, MAX_SNAPSHOTS, type ProfileSnapshotDto, type ProfileStats } from '@shared/pvz/profile-archive'
import { and, desc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { saveProfileSnapshot } from '../db/schema'

type SnapshotRow = typeof saveProfileSnapshot.$inferSelect

export function toSnapshotDto(row: SnapshotRow): ProfileSnapshotDto {
  return {
    id: row.id,
    label: row.label,
    sourceVersion: row.sourceVersion,
    name: row.name,
    size: row.size,
    stats: JSON.parse(row.stats) as ProfileStats,
    createdAt: row.createdAt.toISOString(),
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function parseSnapshotId(event: H3Event): string {
  const id = getRouterParam(event, 'snapshot') ?? ''
  if (!UUID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Bad Request', data: { code: 'INVALID_SNAPSHOT' } })
  return id
}

/** 去掉首尾空白；空名或超长返回 null */
export function normalizeLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const label = value.trim()
  if (!label || [...label].length > MAX_SNAPSHOT_LABEL_LENGTH) return null
  return label
}

function notFound() {
  return createError({ statusCode: 404, statusMessage: 'Not Found', data: { code: 'SNAPSHOT_NOT_FOUND' } })
}

export async function listSnapshots(event: H3Event, userId: string, key: string): Promise<SnapshotRow[]> {
  const db = await useDb(event)
  return db.select().from(saveProfileSnapshot)
    .where(and(eq(saveProfileSnapshot.profileId, key), eq(saveProfileSnapshot.userId, userId)))
    .orderBy(desc(saveProfileSnapshot.createdAt))
}

export async function getSnapshot(event: H3Event, userId: string, key: string, id: string): Promise<SnapshotRow> {
  const db = await useDb(event)
  const rows = await db.select().from(saveProfileSnapshot)
    .where(and(eq(saveProfileSnapshot.id, id), eq(saveProfileSnapshot.profileId, key), eq(saveProfileSnapshot.userId, userId)))
    .limit(1)
  if (!rows[0]) throw notFound()
  return rows[0]
}

export async function readSnapshotArchive(event: H3Event, row: SnapshotRow): Promise<Uint8Array> {
  const archive = await useSaveStore(event).get(row.objectKey)
  if (!archive) throw createError({ statusCode: 404, statusMessage: 'Not Found', data: { code: 'OBJECT_NOT_FOUND' } })
  return archive
}

interface CreateInput {
  userId: string
  key: string
  label: string
  /** 已满额时是否同意删除最早的快照 */
  replaceOldest: boolean
}

/** 把云端当前版本存为快照 */
export async function createSnapshot(event: H3Event, input: CreateInput): Promise<SnapshotRow> {
  const db = await useDb(event)
  const store = useSaveStore(event)

  const head = await getProfile(event, input.userId, input.key)
  if (!head || head.deletedAt !== null) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', data: { code: 'PROFILE_NOT_FOUND' } })
  }

  const existing = await listSnapshots(event, input.userId, input.key)
  const overflow = existing.length - MAX_SNAPSHOTS + 1
  const oldest = [...existing].reverse()
  if (overflow > 0 && !input.replaceOldest) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: { code: 'SNAPSHOT_LIMIT', limit: MAX_SNAPSHOTS, oldest: toSnapshotDto(oldest[0]!) },
    })
  }

  const version = await getVersion(event, input.userId, input.key, head.version)
  if (!version?.objectKey) throw createError({ statusCode: 404, statusMessage: 'Not Found', data: { code: 'VERSION_NOT_FOUND' } })
  const archive = await store.get(version.objectKey)
  if (!archive) throw createError({ statusCode: 404, statusMessage: 'Not Found', data: { code: 'OBJECT_NOT_FOUND' } })

  const id = crypto.randomUUID()
  const objectKey = `saves/${input.userId}/${input.key}/snapshots/${id}.zip`
  await store.put(objectKey, archive)

  const rows = await db.insert(saveProfileSnapshot).values({
    id,
    profileId: input.key,
    userId: input.userId,
    label: input.label,
    sourceVersion: head.version,
    objectKey,
    name: version.name,
    sha256: version.sha256,
    size: archive.byteLength,
    stats: version.stats,
    createdAt: new Date(),
  }).returning()

  // 新快照写好之后才删最早的，失败时不会少一个
  for (const row of oldest.slice(0, Math.max(overflow, 0))) await removeSnapshot(event, row)
  return rows[0]!
}

export async function renameSnapshot(event: H3Event, row: SnapshotRow, label: string): Promise<SnapshotRow> {
  const db = await useDb(event)
  const rows = await db.update(saveProfileSnapshot).set({ label }).where(eq(saveProfileSnapshot.id, row.id)).returning()
  return rows[0]!
}

export async function removeSnapshot(event: H3Event, row: SnapshotRow) {
  const db = await useDb(event)
  await db.delete(saveProfileSnapshot).where(eq(saveProfileSnapshot.id, row.id))
  await useSaveStore(event).delete(row.objectKey)
}


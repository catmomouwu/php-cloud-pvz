// 快照接口：/api/profiles/:key/snapshots

import type { ProfileSnapshotDto } from '@shared/pvz/profile-archive'

/** 已有 MAX_SNAPSHOTS 个快照，需要确认覆盖最早的一个 */
export class SnapshotLimitError extends Error {
  constructor(readonly oldest: ProfileSnapshotDto) {
    super('SNAPSHOT_LIMIT')
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: init.body ? { 'content-type': 'application/json' } : undefined,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { data?: { code?: string, oldest?: ProfileSnapshotDto } } | null
    if (response.status === 409 && body?.data?.code === 'SNAPSHOT_LIMIT' && body.data.oldest) throw new SnapshotLimitError(body.data.oldest)
    throw new Error(`HTTP ${response.status}`)
  }
  return await response.json() as T
}

const base = (key: string) => `/api/profiles/${key}/snapshots`

export function snapshotDownloadUrl(key: string, id: string): string {
  return `${base(key)}/${id}`
}

export async function listSnapshots(key: string): Promise<ProfileSnapshotDto[]> {
  return (await call<{ snapshots: ProfileSnapshotDto[] }>(base(key))).snapshots
}

export async function createSnapshot(key: string, label: string, replaceOldest = false): Promise<ProfileSnapshotDto> {
  const body = JSON.stringify({ label, replaceOldest })
  return (await call<{ snapshot: ProfileSnapshotDto }>(base(key), { method: 'POST', body })).snapshot
}

export async function renameSnapshot(key: string, id: string, label: string): Promise<ProfileSnapshotDto> {
  const body = JSON.stringify({ label })
  return (await call<{ snapshot: ProfileSnapshotDto }>(`${base(key)}/${id}`, { method: 'PATCH', body })).snapshot
}

export async function deleteSnapshot(key: string, id: string): Promise<void> {
  await call(`${base(key)}/${id}`, { method: 'DELETE' })
}

export async function restoreSnapshot(key: string, id: string): Promise<void> {
  await call(`${base(key)}/${id}/restore`, { method: 'POST', body: '{}' })
}

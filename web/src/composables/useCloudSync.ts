// 云同步：按游戏内用户逐个同步。每个用户在云端有稳定的标识（key），本机记录 key → 本地编号 + 基准版本。
// 对每个用户：
// - 本地 = 基准、云端更新了          → 下载覆盖（游戏运行中先标记，停止后再拉取）
// - 本地改了、云端仍是基准版本        → 上传
// - 两边都改了 / 云端删了但本地改了 / 首次同步时同名但内容不同 → 冲突，由用户逐个选择
// - 本地删了                        → 云端打删除标记；若云端在此之后又被改过，则恢复到本地
// - 只在本地 / 只在云端              → 上传新建 / 下载到本地

import { useStorage } from '@vueuse/core'
import type { ArchiveFiles } from '@shared/pvz/archive'
import { renameCurrentUser } from '@shared/pvz/game-config'
import {
  extractProfile,
  type ProfileFiles,
  type ProfileHeadDto,
  packProfile,
  profileDigest,
  unpackProfile,
} from '@shared/pvz/profile-archive'
import { addProfile, copyName, deleteProfile, listProfiles, renameProfile, replaceProfile } from '@shared/pvz/profiles'
import type { ProfileSummary } from '@shared/pvz/userdata'
import { effectScope, ref, shallowRef, watch } from 'vue'
import { readSaveFiles, replaceArchiveFiles, toArchiveFiles, updateSaveFile } from '@/lib/idbfs'
import { onSavesChanged } from '@/lib/save-events'
import { useAuth } from './useAuth'
import { useGameSession } from './useGameSession'
import { useGameSettings } from './useGameSettings'
import { refreshLocalSaves } from './useLocalSaves'

export type SyncStatus =
  | 'signed-out'
  | 'idle'
  | 'syncing'
  | 'synced'
  /** 游戏运行中发现云端有更新，停止游戏后才能载入 */
  | 'remote-newer'
  | 'conflict'
  | 'error'

interface Link {
  localId: number
  version: number
  sha256: string
}

/** 云端 key → 本机同步记录 */
type Links = Record<string, Link>

export interface ProfileConflict {
  key: string
  localId: number
  localName: string
  remote: ProfileHeadDto
  reason: 'both-changed' | 'deleted-remotely' | 'first-sync'
}

const PUSH_DEBOUNCE_MS = 2000

const status = ref<SyncStatus>('signed-out')
const remoteProfiles = shallowRef<ProfileHeadDto[]>([])
const conflicts = shallowRef<ProfileConflict[]>([])
const lastSyncedAt = ref<Date | null>(null)
/** 账号 id → 该账号在本机的同步记录 */
const linkStore = useStorage<Record<string, Links>>('cloud-pvz:sync-links', {})

// ---- 接口 ----

class ApiError extends Error {
  constructor(readonly status: number, readonly data: { code?: string, head?: ProfileHeadDto | null } | undefined) {
    super(`HTTP ${status}`)
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', ...init })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { data?: ApiError['data'] } | null
    throw new ApiError(response.status, body?.data)
  }
  return response.json() as Promise<T>
}

const fetchProfiles = async () => (await api<{ profiles: ProfileHeadDto[] }>('/api/profiles')).profiles

const uploadProfile = async (key: string, base: number, profile: ProfileFiles) =>
  (await api<{ head: ProfileHeadDto }>(`/api/profiles/${key}?base=${base}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/zip' },
    body: packProfile(profile) as BodyInit,
  })).head

const deleteRemoteProfile = async (key: string, base: number) =>
  (await api<{ head: ProfileHeadDto }>(`/api/profiles/${key}?base=${base}`, { method: 'DELETE' })).head

async function downloadProfile(key: string, version: number): Promise<ProfileFiles> {
  const response = await fetch(`/api/profiles/${key}/versions/${version}`, { credentials: 'same-origin' })
  if (!response.ok) throw new ApiError(response.status, undefined)
  return unpackProfile(new Uint8Array(await response.arrayBuffer()))
}

// ---- 本地写回 ----

/** 写回本地存档；改了名的用户同步更新“上次使用的用户”与启动用户 */
async function writeLocal(files: ArchiveFiles, renames: [string, string][]) {
  await replaceArchiveFiles(files)
  const settings = useGameSettings()
  for (const [from, to] of renames) {
    await updateSaveFile('registry.regemu', bytes => renameCurrentUser(bytes, from, to))
    if (settings.value.launchUser === from) settings.value.launchUser = to
  }
  await refreshLocalSaves()
}

// 所有同步操作串行执行
let queue: Promise<unknown> = Promise.resolve()
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task)
  queue = next.catch(() => undefined)
  return next
}

// ---- 对齐 ----

interface PassResult {
  conflicts: ProfileConflict[]
  remoteNewer: boolean
  /** 有用户因重名被改名，需要再跑一轮上传 */
  needsAnotherPass: boolean
}

async function reconcilePass(userId: string, allowWrite: boolean): Promise<PassResult> {
  const remoteList = await fetchProfiles()
  const remoteByKey = new Map(remoteList.map(remote => [remote.key, remote]))
  const original = toArchiveFiles(await readSaveFiles())
  let files = original
  const links: Links = { ...(linkStore.value[userId] ?? {}) }
  const found: ProfileConflict[] = []
  const renames: [string, string][] = []
  let remoteNewer = false
  let needsAnotherPass = false

  let local = listProfiles(files)
  // 安全：本机一个用户都没有却有同步记录（本机存档被清空），按新设备处理，不能把云端全删了
  if (local.length === 0) for (const key of Object.keys(links)) delete links[key]

  const reservedIds = () => Object.values(links).map(link => link.localId)
  const linkedLocalIds = () => new Set(Object.values(links).map(link => link.localId))

  async function tryUpload(key: string, base: number, profile: ProfileSummary) {
    const content = extractProfile(files, profile.id, profile.name)
    try {
      const head = await uploadProfile(key, base, content)
      remoteByKey.set(key, head)
      links[key] = { localId: profile.id, version: head.version, sha256: head.sha256 }
    }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error
      if (error.data?.code === 'PROFILE_CONFLICT' && error.data.head) {
        remoteByKey.set(key, error.data.head)
        found.push({ key, localId: profile.id, localName: profile.name, remote: error.data.head, reason: 'both-changed' })
      }
      else if (error.data?.code === 'NAME_TAKEN' && allowWrite) {
        // 云端已有同名用户（且不是这一个）：本地改用副本名，下一轮再上传
        const taken = [...local, ...remoteList.filter(remote => !remote.deleted).map(remote => ({ id: -1, name: remote.name, useSeq: 0 }))]
        const name = copyName(profile.name, taken)
        files = renameProfile(files, profile.id, name)
        renames.push([profile.name, name])
        needsAnotherPass = true
      }
    }
  }

  async function applyRemote(remote: ProfileHeadDto, localId: number | null) {
    const content = await downloadProfile(remote.key, remote.version)
    if (localId === null) {
      const added = addProfile(files, content, reservedIds())
      files = added.files
      links[remote.key] = { localId: added.id, version: remote.version, sha256: remote.sha256 }
    }
    else {
      const before = local.find(profile => profile.id === localId)
      files = replaceProfile(files, localId, content)
      if (before && before.name !== remote.name) renames.push([before.name, remote.name])
      links[remote.key] = { localId, version: remote.version, sha256: remote.sha256 }
    }
  }

  // 1) 已有同步记录的用户
  for (const [key, link] of Object.entries(links)) {
    const remote = remoteByKey.get(key)
    const profile = local.find(item => item.id === link.localId)

    if (!profile) {
      // 本地已删除
      if (!remote || remote.deleted) {
        delete links[key]
      }
      else if (remote.version === link.version) {
        try {
          remoteByKey.set(key, await deleteRemoteProfile(key, link.version))
          delete links[key]
        }
        catch (error) {
          if (!(error instanceof ApiError) || error.status !== 409) throw error
        }
      }
      else if (allowWrite) {
        // 云端在本地删除之后又被改过：以云端为准，恢复到本地
        delete links[key]
        await applyRemote(remote, null)
      }
      else {
        remoteNewer = true
      }
      continue
    }

    const digest = await profileDigest(extractProfile(files, profile.id, profile.name))
    if (!remote) {
      // 云端没有这个用户（例如云端数据被清空）：重新上传
      await tryUpload(key, 0, profile)
      continue
    }
    if (remote.deleted) {
      if (digest !== link.sha256) {
        found.push({ key, localId: profile.id, localName: profile.name, remote, reason: 'deleted-remotely' })
      }
      else if (allowWrite) {
        files = deleteProfile(files, profile.id)
        delete links[key]
      }
      else {
        remoteNewer = true
      }
      continue
    }
    if (digest === remote.sha256) {
      links[key] = { localId: profile.id, version: remote.version, sha256: digest }
      continue
    }
    const localChanged = digest !== link.sha256
    const remoteChanged = remote.version !== link.version
    if (!localChanged && remoteChanged) {
      if (allowWrite) await applyRemote(remote, profile.id)
      else remoteNewer = true
    }
    else if (localChanged && !remoteChanged) {
      await tryUpload(key, link.version, profile)
    }
    else {
      found.push({ key, localId: profile.id, localName: profile.name, remote, reason: 'both-changed' })
    }
  }

  // 2) 本机还没有同步记录的用户：同名的云端用户视为同一个，否则作为新用户上传
  local = listProfiles(files)
  const claimed = new Set([...Object.keys(links), ...found.map(conflict => conflict.key)])
  for (const profile of local) {
    if (linkedLocalIds().has(profile.id) || found.some(conflict => conflict.localId === profile.id)) continue
    const digest = await profileDigest(extractProfile(files, profile.id, profile.name))
    const same = remoteList.find(remote =>
      !remote.deleted && !claimed.has(remote.key) && remote.name.toLowerCase() === profile.name.toLowerCase())
    if (same) {
      claimed.add(same.key)
      if (same.sha256 === digest) links[same.key] = { localId: profile.id, version: same.version, sha256: digest }
      else found.push({ key: same.key, localId: profile.id, localName: profile.name, remote: same, reason: 'first-sync' })
      continue
    }
    const key = crypto.randomUUID()
    claimed.add(key)
    await tryUpload(key, 0, profile)
  }

  // 3) 只在云端的用户：下载到本机
  for (const remote of remoteList) {
    if (remote.deleted || claimed.has(remote.key)) continue
    if (allowWrite) await applyRemote(remote, null)
    else remoteNewer = true
  }

  if (files !== original) await writeLocal(files, renames)
  linkStore.value = { ...linkStore.value, [userId]: links }
  remoteProfiles.value = [...remoteByKey.values()]
  return { conflicts: found, remoteNewer, needsAnotherPass }
}

/**
 * 对齐本地与云端。allowWrite 为 false 时（游戏运行中）不改写本地存档。
 * 返回 false 表示存在冲突或出错，调用方不应继续（例如不要启动游戏）。
 */
function reconcile(allowWrite: boolean): Promise<boolean> {
  return enqueue(async () => {
    const userId = useAuth().user.value?.id
    if (!userId) {
      status.value = 'signed-out'
      return true
    }
    status.value = 'syncing'
    try {
      let result = await reconcilePass(userId, allowWrite)
      if (result.needsAnotherPass) result = await reconcilePass(userId, allowWrite)
      conflicts.value = result.conflicts
      lastSyncedAt.value = new Date()
      status.value = result.conflicts.length > 0 ? 'conflict' : result.remoteNewer ? 'remote-newer' : 'synced'
      return result.conflicts.length === 0
    }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        status.value = 'signed-out'
        return true
      }
      console.warn('Cloud sync failed', error)
      status.value = 'error'
      return false
    }
  })
}

/** 解决某个用户的冲突：cloud = 以云端为准；local = 以本地为准覆盖云端 */
async function resolveConflict(key: string, choice: 'cloud' | 'local'): Promise<boolean> {
  const ok = await enqueue(async () => {
    const userId = useAuth().user.value?.id
    const conflict = conflicts.value.find(item => item.key === key)
    if (!userId || !conflict) return false
    // 运行中的引擎会用内存里的存档覆盖 IndexedDB，只能在停止游戏后载入云端存档
    if (choice === 'cloud' && useGameSession().isActive.value) return false

    const links: Links = { ...(linkStore.value[userId] ?? {}) }
    const files = toArchiveFiles(await readSaveFiles())
    const profile = listProfiles(files).find(item => item.id === conflict.localId)
    try {
      if (choice === 'cloud') {
        if (conflict.reason === 'deleted-remotely') {
          if (profile) await writeLocal(deleteProfile(files, profile.id), [])
          delete links[key]
        }
        else {
          const content = await downloadProfile(key, conflict.remote.version)
          const renames: [string, string][] = profile && profile.name !== conflict.remote.name ? [[profile.name, conflict.remote.name]] : []
          await writeLocal(replaceProfile(files, conflict.localId, content), renames)
          links[key] = { localId: conflict.localId, version: conflict.remote.version, sha256: conflict.remote.sha256 }
        }
      }
      else if (profile) {
        const head = await uploadProfile(key, conflict.remote.version, extractProfile(files, profile.id, profile.name))
        links[key] = { localId: profile.id, version: head.version, sha256: head.sha256 }
      }
      linkStore.value = { ...linkStore.value, [userId]: links }
      conflicts.value = conflicts.value.filter(item => item.key !== key)
      return true
    }
    catch (error) {
      console.warn('Resolve conflict failed', error)
      return false
    }
  })
  // 处理完再整体对齐一次，刷新状态
  await reconcile(!useGameSession().isActive.value)
  return ok
}

/** 退出登录用：本机每个用户都已与云端一致时清空本机存档与同步记录；否则保留，避免丢数据 */
function clearLocalIfSynced(): Promise<boolean> {
  return enqueue(async () => {
    const userId = useAuth().user.value?.id
    if (!userId) return false
    const files = toArchiveFiles(await readSaveFiles())
    const links = linkStore.value[userId] ?? {}
    const remoteByKey = new Map(remoteProfiles.value.map(remote => [remote.key, remote]))
    for (const profile of listProfiles(files)) {
      const entry = Object.entries(links).find(([, link]) => link.localId === profile.id)
      if (!entry) return false
      const [key, link] = entry
      const digest = await profileDigest(extractProfile(files, profile.id, profile.name))
      if (digest !== link.sha256 || remoteByKey.get(key)?.sha256 !== digest) return false
    }
    await replaceArchiveFiles(new Map())
    const rest = { ...linkStore.value }
    delete rest[userId]
    linkStore.value = rest
    await refreshLocalSaves()
    return true
  })
}

// ---- 自动触发 ----

let started = false
let pushTimer: number | undefined

// 监听放在独立的 effectScope 里：不随首次调用它的组件卸载而停止（例如退出登录跳到登录页）
function start() {
  if (started) return
  started = true
  effectScope(true).run(setupTriggers)
}

function setupTriggers() {
  const { user } = useAuth()
  const session = useGameSession()

  watch(() => user.value?.id, (id) => {
    if (!id) {
      status.value = 'signed-out'
      remoteProfiles.value = []
      conflicts.value = []
      return
    }
    void reconcile(!session.isActive.value)
  }, { immediate: true })

  // 游戏写了存档：稍等片刻再同步，合并连续写入
  onSavesChanged(() => {
    if (!user.value) return
    window.clearTimeout(pushTimer)
    pushTimer = window.setTimeout(() => void reconcile(!session.isActive.value), PUSH_DEBOUNCE_MS)
  })

  // 回到页面时拉取其他设备的更新
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && user.value && status.value !== 'conflict') {
      void reconcile(!session.isActive.value)
    }
  })
}

export function useCloudSync() {
  start()
  return {
    status,
    remoteProfiles,
    conflicts,
    lastSyncedAt,
    /** 启动游戏前调用：返回 false 时不要启动 */
    prepareLaunch: () => reconcile(true),
    syncNow: () => reconcile(!useGameSession().isActive.value),
    resolveConflict,
    /** 退出登录前把本地改动推上去 */
    flushBeforeSignOut: () => reconcile(false),
    clearLocalIfSynced,
    /** 本地用户对应的云端 key（还没同步过时为 null） */
    keyForLocalId: (localId: number): string | null => {
      const userId = useAuth().user.value?.id
      const links = userId ? linkStore.value[userId] ?? {} : {}
      return Object.entries(links).find(([, link]) => link.localId === localId)?.[0] ?? null
    },
  }
}

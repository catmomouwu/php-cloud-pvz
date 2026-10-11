// 单个游戏内用户的云端包（前后端共用）。
// 包内不含本地编号，任何设备都能放进自己的存档目录：
//   profile.json      { "name": "Alice" }
//   user.dat          ← userdata/user{id}.dat
//   game_{mode}.v4    ← userdata/game{id}_{mode}.v4（旧格式 .dat 同理）
// users.dat 不上传：每台设备按自己的用户列表重建。

import { ARCHIVE_DIR, type ArchiveFiles, digestFiles, packZip, unpackZip } from './archive'
import { displayCoins, parsePlayerDat, userDatPath } from './userdata'

export const PROFILE_META = 'profile.json'
const USER_DAT = 'user.dat'
const GAME_FILE = /^game_(\d+)\.(v4|dat)$/

/** 一个用户的云端包内容，键为包内文件名 */
export type ProfileFiles = Map<string, Uint8Array>

export function isProfilePath(path: string): boolean {
  return path === PROFILE_META || path === USER_DAT || GAME_FILE.test(path)
}

const localGameFile = (id: number) => new RegExp(`^game${id}_(\\d+)\\.(v4|dat)$`)

/** 从本地存档目录取出某个用户 */
export function extractProfile(files: ArchiveFiles, id: number, name: string): ProfileFiles {
  const profile: ProfileFiles = new Map()
  profile.set(PROFILE_META, encodeMeta(name))
  const userDat = files.get(userDatPath(id))
  if (userDat) profile.set(USER_DAT, userDat)
  const pattern = localGameFile(id)
  for (const [path, data] of files) {
    const match = pattern.exec(path.slice(ARCHIVE_DIR.length))
    if (path.startsWith(ARCHIVE_DIR) && match) profile.set(`game_${match[1]}.${match[2]}`, data)
  }
  return profile
}

/** 把云端包写进本地存档目录的某个编号下（先清掉该编号原有的文件），不改 users.dat */
export function writeProfileFiles(files: ArchiveFiles, id: number, profile: ProfileFiles): ArchiveFiles {
  const next = new Map(files)
  const pattern = localGameFile(id)
  for (const path of files.keys()) {
    if (path === userDatPath(id) || (path.startsWith(ARCHIVE_DIR) && pattern.test(path.slice(ARCHIVE_DIR.length)))) {
      next.delete(path)
    }
  }
  for (const [name, data] of profile) {
    if (name === USER_DAT) next.set(userDatPath(id), data)
    const match = GAME_FILE.exec(name)
    if (match) next.set(`${ARCHIVE_DIR}game${id}_${match[1]}.${match[2]}`, data)
  }
  return next
}

export function profileName(profile: ProfileFiles): string {
  const meta = profile.get(PROFILE_META)
  if (!meta) throw new Error('profile.json missing')
  const { name } = JSON.parse(new TextDecoder().decode(meta)) as { name?: unknown }
  if (typeof name !== 'string') throw new Error('profile name missing')
  return name
}

export function packProfile(profile: ProfileFiles): Uint8Array {
  return packZip(profile)
}

export function unpackProfile(bytes: Uint8Array): ProfileFiles {
  return unpackZip(bytes, isProfilePath)
}

/** 规范的 profile.json：只含 name，固定编码。摘要和本地取出都用它，避免不同 JSON 写法导致摘要不同 */
function encodeMeta(name: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ name }))
}

/** 内容摘要：先规范化 profile.json 再计算，与上传方的 JSON 写法无关 */
export function profileDigest(profile: ProfileFiles): Promise<string> {
  const canonical = new Map(profile)
  canonical.set(PROFILE_META, encodeMeta(profileName(profile)))
  return digestFiles(canonical)
}

/** 列表与历史里展示的进度摘要 */
export interface ProfileStats {
  level: number | null
  coins: number | null
  finishedAdventure: number | null
  playTimeSeconds: number | null
  hasMidLevelSave: boolean
}

export function summarizeProfile(profile: ProfileFiles): ProfileStats {
  const userDat = profile.get(USER_DAT)
  let details = null
  try {
    details = userDat ? parsePlayerDat(userDat) : null
  }
  catch {
    details = null
  }
  return {
    level: details?.level ?? null,
    coins: details ? displayCoins(details.coins) : null,
    finishedAdventure: details?.finishedAdventure ?? null,
    playTimeSeconds: details?.playTimeActive ?? null,
    hasMidLevelSave: [...profile.keys()].some(name => GAME_FILE.test(name)),
  }
}

/** 接口：云端某个用户的当前状态 */
export interface ProfileHeadDto {
  key: string
  name: string
  version: number
  sha256: string
  size: number
  stats: ProfileStats
  deleted: boolean
  updatedAt: string
}

/** 接口：某个用户的一个历史版本 */
export interface ProfileVersionDto {
  version: number
  name: string
  sha256: string
  size: number
  stats: ProfileStats
  source: 'upload' | 'restore' | 'delete'
  /** 删除记录没有存档内容，不能下载或恢复 */
  hasContent: boolean
  createdAt: string
}

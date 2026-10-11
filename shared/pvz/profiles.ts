// 对存档目录中的单个游戏内用户做管理（前后端共用的纯函数）。
// 规则与 PvZ-Portable 的 ProfileMgr 一致：用户名不区分大小写唯一，最长 12 个字符；
// 删除用户时一并删除 user{id}.dat 与该用户的关卡中途存档（game{id}_*.v4 / .dat）。

import { ARCHIVE_DIR, type ArchiveFiles } from './archive'
import { profileName, type ProfileFiles, writeProfileFiles } from './profile-archive'
import { isMidLevelSaveOf, parseUsersDat, type ProfileSummary, serializeUsersDat, userDatPath } from './userdata'

export const MAX_PROFILE_NAME_LENGTH = 12
export const MAX_PROFILES = 200

const USERS_DAT = `${ARCHIVE_DIR}users.dat`

export type ProfileError = 'empty' | 'too-long' | 'duplicate' | 'not-found' | 'too-many'

export class ProfileOperationError extends Error {
  constructor(readonly code: ProfileError) {
    super(code)
  }
}

/** 本地存档目录里的用户列表（users.dat） */
export function listProfiles(files: ArchiveFiles): ProfileSummary[] {
  const bytes = files.get(USERS_DAT)
  if (!bytes) return []
  try {
    return parseUsersDat(bytes) ?? []
  }
  catch {
    return []
  }
}

const readProfiles = listProfiles

function withProfiles(files: ArchiveFiles, profiles: ProfileSummary[]): ArchiveFiles {
  const next = new Map(files)
  next.set(USERS_DAT, serializeUsersDat(profiles))
  return next
}

function find(profiles: ProfileSummary[], id: number): ProfileSummary {
  const profile = profiles.find(item => item.id === id)
  if (!profile) throw new ProfileOperationError('not-found')
  return profile
}

/** 该用户自己的文件：user{id}.dat 与关卡中途存档 */
function ownFiles(files: ArchiveFiles, id: number): string[] {
  return [...files.keys()].filter((path) => {
    const name = path.slice(ARCHIVE_DIR.length)
    return path === userDatPath(id) || isMidLevelSaveOf(name, id)
  })
}

export function validateProfileName(name: string, profiles: ProfileSummary[], exceptId?: number): string {
  const trimmed = name.trim()
  if (!trimmed) throw new ProfileOperationError('empty')
  if ([...trimmed].length > MAX_PROFILE_NAME_LENGTH) throw new ProfileOperationError('too-long')
  const lower = trimmed.toLowerCase()
  if (profiles.some(profile => profile.id !== exceptId && profile.name.toLowerCase() === lower)) {
    throw new ProfileOperationError('duplicate')
  }
  return trimmed
}

export function renameProfile(files: ArchiveFiles, id: number, name: string): ArchiveFiles {
  const profiles = readProfiles(files)
  find(profiles, id)
  const newName = validateProfileName(name, profiles, id)
  return withProfiles(files, profiles.map(profile => (profile.id === id ? { ...profile, name: newName } : profile)))
}

export function deleteProfile(files: ArchiveFiles, id: number): ArchiveFiles {
  const profiles = readProfiles(files)
  find(profiles, id)
  const next = withProfiles(files, profiles.filter(profile => profile.id !== id))
  for (const path of ownFiles(files, id)) next.delete(path)
  return next
}

/** 生成不重名的副本名：“名字 2”“名字 3”…，超长时截断原名 */
export function copyName(name: string, profiles: ProfileSummary[]): string {
  const taken = new Set(profiles.map(profile => profile.name.toLowerCase()))
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`
    const base = [...name].slice(0, MAX_PROFILE_NAME_LENGTH - suffix.length).join('').trimEnd()
    const candidate = `${base}${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

/** 复制一个用户：新 id、新名字，复制 user{id}.dat 与关卡中途存档（文件里不含 id，只改文件名） */
export function duplicateProfile(files: ArchiveFiles, id: number): { files: ArchiveFiles, id: number, name: string } {
  const profiles = readProfiles(files)
  const source = find(profiles, id)
  if (profiles.length >= MAX_PROFILES) throw new ProfileOperationError('too-many')
  const newId = Math.max(0, ...profiles.map(profile => profile.id)) + 1
  const useSeq = Math.max(0, ...profiles.map(profile => profile.useSeq)) + 1
  const name = copyName(source.name, profiles)

  const next = withProfiles(files, [...profiles, { id: newId, name, useSeq }])
  for (const path of ownFiles(files, id)) {
    const fileName = path.slice(ARCHIVE_DIR.length)
    const renamed = path === userDatPath(id)
      ? userDatPath(newId)
      : `${ARCHIVE_DIR}${fileName.replace(new RegExp(`^game${id}_`), `game${newId}_`)}`
    next.set(renamed, files.get(path)!)
  }
  return { files: next, id: newId, name }
}

/** 导出单个用户：只含该用户的 users.dat 与其文件，可直接放进游戏的 userdata/ */
export function exportProfile(files: ArchiveFiles, id: number): ArchiveFiles {
  const profiles = readProfiles(files)
  const profile = find(profiles, id)
  const exported: ArchiveFiles = new Map()
  exported.set(USERS_DAT, serializeUsersDat([profile]))
  for (const path of ownFiles(files, id)) exported.set(path, files.get(path)!)
  return exported
}

/**
 * 加入一个来自云端的用户：分配新编号（避开 reservedIds，即仍被同步记录引用的旧编号），
 * 名字与本地已有用户重名时改用副本名。
 */
export function addProfile(files: ArchiveFiles, profile: ProfileFiles, reservedIds: number[] = []): { files: ArchiveFiles, id: number, name: string } {
  const profiles = readProfiles(files)
  const id = Math.max(0, ...profiles.map(item => item.id), ...reservedIds) + 1
  const useSeq = Math.max(0, ...profiles.map(item => item.useSeq)) + 1
  const wanted = profileName(profile)
  const taken = profiles.some(item => item.name.toLowerCase() === wanted.toLowerCase())
  const name = taken ? copyName(wanted, profiles) : wanted
  const next = withProfiles(writeProfileFiles(files, id, profile), [...profiles, { id, name, useSeq }])
  return { files: next, id, name }
}

/** 用云端内容替换本地某个用户（保留本地编号与 useSeq，名字跟随云端） */
export function replaceProfile(files: ArchiveFiles, id: number, profile: ProfileFiles): ArchiveFiles {
  const profiles = readProfiles(files)
  find(profiles, id)
  const name = profileName(profile)
  return withProfiles(
    writeProfileFiles(files, id, profile),
    profiles.map(item => (item.id === id ? { ...item, name } : item)),
  )
}

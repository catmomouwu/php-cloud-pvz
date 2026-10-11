// 存档导入：识别用户选择的 ZIP / 文件夹里有哪些游戏内用户。
// 支持三种来源：
//   1. 原版游戏 / PvZ-Portable 的 userdata 目录（含 users.dat，可能有多个用户）
//   2. 本站“导出”的单个用户（同样是 userdata 结构）
//   3. 本站历史版本下载的云端包（profile.json + user.dat + game_{mode}.v4）
// 旧版关卡中途存档 game*_*.dat 是内存转储，跨版本 / 架构加载可能崩溃，导入时跳过，只保留可移植的 .v4。

import { unzipSync } from 'fflate'
import { ARCHIVE_DIR, type ArchiveFiles } from './archive'
import { extractProfile, PROFILE_META, type ProfileFiles, profileName, type ProfileStats, summarizeProfile } from './profile-archive'
import { parseUsersDat } from './userdata'

const MAX_IMPORT_BYTES = 64 * 1024 * 1024
const MAX_IMPORT_FILES = 4096

export type ImportError = 'too-large' | 'invalid-zip' | 'no-saves'

export class ImportFailure extends Error {
  constructor(readonly code: ImportError) {
    super(code)
  }
}

export interface ImportCandidate {
  name: string
  profile: ProfileFiles
  stats: ProfileStats
  /** 被跳过的旧版关卡中途存档数量 */
  skippedLegacy: number
}

/** 解压 ZIP；忽略目录、macOS 附带的 __MACOSX 与隐藏文件 */
export function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new ImportFailure('too-large')
  let count = 0
  let total = 0
  try {
    const entries = unzipSync(bytes, {
      filter: (file) => {
        if (file.name.endsWith('/') || isJunk(file.name)) return false
        count += 1
        total += file.originalSize
        if (count > MAX_IMPORT_FILES || total > MAX_IMPORT_BYTES) throw new ImportFailure('too-large')
        return true
      },
    })
    return new Map(Object.entries(entries))
  }
  catch (error) {
    if (error instanceof ImportFailure) throw error
    throw new ImportFailure('invalid-zip')
  }
}

function isJunk(path: string): boolean {
  return path.split('/').some(part => part === '__MACOSX' || part.startsWith('.'))
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function dirName(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index + 1)
}

/** 从选中的文件里找出可导入的用户（路径为相对路径，大小写不敏感） */
export function findImportCandidates(input: Map<string, Uint8Array>): ImportCandidate[] {
  const files = new Map([...input].filter(([path]) => !isJunk(path)).map(([path, data]) => [path.replace(/\\/g, '/'), data]))
  const candidates: ImportCandidate[] = []

  // 本站云端包：profile.json 所在目录即一个用户
  for (const [path] of files) {
    if (baseName(path).toLowerCase() !== PROFILE_META) continue
    const dir = dirName(path)
    const profile: ProfileFiles = new Map()
    let skippedLegacy = 0
    for (const [other, data] of files) {
      if (dirName(other) !== dir) continue
      const name = baseName(other).toLowerCase()
      if (name === PROFILE_META || name === 'user.dat' || /^game_\d+\.v4$/.test(name)) profile.set(name, data)
      else if (/^game_\d+\.dat$/.test(name)) skippedLegacy += 1
    }
    try {
      candidates.push({ name: profileName(profile), profile, stats: summarizeProfile(profile), skippedLegacy })
    }
    catch {
      // profile.json 损坏：跳过
    }
  }

  // userdata 目录：每个 users.dat 所在目录是一份存档，里面可能有多个用户
  for (const [path, usersDat] of files) {
    if (baseName(path).toLowerCase() !== 'users.dat') continue
    const dir = dirName(path)
    let summaries
    try {
      summaries = parseUsersDat(usersDat) ?? []
    }
    catch {
      continue
    }
    // 归一化成 userdata/xxx 的路径，复用 extractProfile
    const userdata: ArchiveFiles = new Map()
    const legacy = new Map<number, number>()
    for (const [other, data] of files) {
      if (dirName(other) !== dir) continue
      const name = baseName(other).toLowerCase()
      const legacyMatch = /^game(\d+)_\d+\.dat$/.exec(name)
      if (legacyMatch) {
        const id = Number(legacyMatch[1])
        legacy.set(id, (legacy.get(id) ?? 0) + 1)
        continue
      }
      if (/^user\d+\.dat$/.test(name) || /^game\d+_\d+\.v4$/.test(name)) userdata.set(`${ARCHIVE_DIR}${name}`, data)
    }
    for (const summary of summaries) {
      const profile = extractProfile(userdata, summary.id, summary.name)
      candidates.push({ name: summary.name, profile, stats: summarizeProfile(profile), skippedLegacy: legacy.get(summary.id) ?? 0 })
    }
  }

  if (candidates.length === 0) throw new ImportFailure('no-saves')
  return candidates
}

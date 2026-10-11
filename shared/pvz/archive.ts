// 通用的 zip 打包与内容摘要（前后端共用）。
// 本地存档目录用 ArchiveFiles 表示：键为相对 /saves 的路径，如 userdata/users.dat。

import { unzipSync, zipSync } from 'fflate'

export const ARCHIVE_DIR = 'userdata/'
export const MAX_ARCHIVE_BYTES = 4 * 1024 * 1024
export const MAX_ARCHIVE_FILES = 128
export const MAX_UNPACKED_BYTES = 16 * 1024 * 1024

/** 键为相对路径 */
export type ArchiveFiles = Map<string, Uint8Array>

/** 固定时间戳，让同样的内容打出同样的 zip */
const FIXED_MTIME = new Date('2000-01-01T00:00:00Z')

/** 本地存档目录中参与云同步的路径（userdata/ 下的文件） */
export function isSyncedPath(path: string): boolean {
  if (!path.startsWith(ARCHIVE_DIR) || path.length === ARCHIVE_DIR.length) return false
  return path.split('/').every(part => part !== '' && part !== '.' && part !== '..')
}

export class ArchiveError extends Error {}

export function packZip(files: ArchiveFiles): Uint8Array {
  const entries: Record<string, [Uint8Array, { mtime: Date }]> = {}
  for (const [path, data] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    entries[path] = [data, { mtime: FIXED_MTIME }]
  }
  return zipSync(entries, { level: 6 })
}

/** 解压并校验：超限、非法路径都会抛 ArchiveError */
export function unpackZip(bytes: Uint8Array, isAllowed: (path: string) => boolean): ArchiveFiles {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new ArchiveError('archive too large')
  let fileCount = 0
  let unpacked = 0
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes, {
      filter: (file) => {
        fileCount += 1
        unpacked += file.originalSize
        if (fileCount > MAX_ARCHIVE_FILES || unpacked > MAX_UNPACKED_BYTES) throw new ArchiveError('archive too large')
        return !file.name.endsWith('/')
      },
    })
  }
  catch (error) {
    if (error instanceof ArchiveError) throw error
    throw new ArchiveError('invalid archive')
  }
  const files: ArchiveFiles = new Map()
  for (const [path, data] of Object.entries(entries)) {
    if (!isAllowed(path)) throw new ArchiveError(`unexpected path: ${path}`)
    files.set(path, data)
  }
  return files
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** 内容摘要：与 zip 编码无关，只取决于文件路径和内容 */
export async function digestFiles(files: ArchiveFiles): Promise<string> {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  for (const [path, data] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    parts.push(encoder.encode(`${path}\0${data.byteLength}\0`), data)
  }
  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0))
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.byteLength
  }
  return toHex(await crypto.subtle.digest('SHA-256', joined))
}

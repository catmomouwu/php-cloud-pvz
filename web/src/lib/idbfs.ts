// 直接读写引擎的 IDBFS 存储（与游戏 iframe 同源）。
// 约定来自 Emscripten IDBFS：数据库名 = 挂载点 "/saves"，版本 21，对象仓库 "FILE_DATA"（带 timestamp 索引），
// 键为完整路径，值为 { timestamp: Date, mode, contents? }。
// 只能在游戏未运行时写入：运行中的引擎下一次 syncfs 会用内存里的文件覆盖这里。

import { ARCHIVE_DIR, type ArchiveFiles, isSyncedPath } from '@shared/pvz/archive'

const DB_NAME = '/saves'
const DB_VERSION = 21
const STORE_NAME = 'FILE_DATA'
const MOUNT = '/saves/'
const DIR_MODE = 0o40777
const FILE_MODE = 0o100666

interface IdbfsEntry {
  timestamp: Date
  mode: number
  contents?: Uint8Array
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function databaseExists(): Promise<boolean> {
  if (!indexedDB.databases) return true
  const databases = await indexedDB.databases()
  return databases.some(db => db.name === DB_NAME)
}

/** 只读打开：数据库不存在时返回 null，避免抢先创建一个空库 */
async function openExisting(): Promise<IDBDatabase | null> {
  if (!(await databaseExists())) return null
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME)
    req.onupgradeneeded = () => req.transaction?.abort()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

/** 写入时打开：按 IDBFS 的方式创建数据库 */
function openForWrite(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? req.transaction!.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME)
      if (!store.indexNames.contains('timestamp')) store.createIndex('timestamp', 'timestamp', { unique: false })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface SaveEntry {
  contents: Uint8Array
  /** 文件最后修改时间（引擎写入时间） */
  modifiedAt: Date
}

/** 读取 /saves 下的全部文件及修改时间，键为完整路径 */
export async function readSaveEntries(): Promise<Map<string, SaveEntry>> {
  const entries = new Map<string, SaveEntry>()
  const db = await openExisting()
  if (!db) return entries
  try {
    if (!db.objectStoreNames.contains(STORE_NAME)) return entries
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())])
    keys.forEach((key, i) => {
      const value = values[i] as IdbfsEntry | undefined
      if (value?.contents instanceof Uint8Array) {
        entries.set(String(key), { contents: value.contents, modifiedAt: new Date(value.timestamp) })
      }
    })
  }
  finally {
    db.close()
  }
  return entries
}

/** 读取 /saves 下的全部文件，键为完整路径 */
export async function readSaveFiles(): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>()
  for (const [path, entry] of await readSaveEntries()) files.set(path, entry.contents)
  return files
}

/** 取出参与云同步的文件（userdata/ 下），键为相对 /saves 的路径 */
export function toArchiveFiles(saveFiles: Map<string, Uint8Array>): ArchiveFiles {
  const files: ArchiveFiles = new Map()
  for (const [path, data] of saveFiles) {
    const relative = path.startsWith(MOUNT) ? path.slice(MOUNT.length) : ''
    if (isSyncedPath(relative)) files.set(relative, data)
  }
  return files
}

function sameBytes(a: Uint8Array | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * 替换本地 userdata/（registry.regemu、缓存等不动）。
 * 内容没变的文件保留原修改时间；变了的用 modifiedAt 里给的时间（如云端更新时间），否则用当前时间。
 * 修改时间就是“上次游玩”的来源，不能因为同步而被刷新。
 */
export async function replaceArchiveFiles(files: ArchiveFiles, modifiedAt: Map<string, Date> = new Map()): Promise<void> {
  const db = await openForWrite()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const prefix = `${MOUNT}${ARCHIVE_DIR}`
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())])
    const previous = new Map<string, IdbfsEntry>()
    keys.forEach((key, i) => {
      const path = String(key)
      if (path === prefix.slice(0, -1) || path.startsWith(prefix)) {
        previous.set(path, values[i] as IdbfsEntry)
        store.delete(key)
      }
    })

    const now = new Date()
    const dirs = new Set<string>()
    for (const path of files.keys()) {
      const parts = path.split('/').slice(0, -1)
      for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
    }
    dirs.add(ARCHIVE_DIR.slice(0, -1))
    for (const dir of dirs) {
      store.put({ timestamp: now, mode: DIR_MODE } satisfies IdbfsEntry, `${MOUNT}${dir}`)
    }
    for (const [path, contents] of files) {
      const old = previous.get(`${MOUNT}${path}`)
      const timestamp = sameBytes(old?.contents, contents) ? new Date(old!.timestamp) : modifiedAt.get(path) ?? now
      store.put({ timestamp, mode: FILE_MODE, contents } satisfies IdbfsEntry, `${MOUNT}${path}`)
    }
    await transactionDone(tx)
  }
  finally {
    db.close()
  }
}

/** 读改写 /saves 下的单个文件（如 registry.regemu）；update 返回 null 表示不修改 */
export async function updateSaveFile(path: string, update: (current: Uint8Array | null) => Uint8Array | null): Promise<void> {
  const db = await openForWrite()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const entry = await request(store.get(`${MOUNT}${path}`)) as IdbfsEntry | undefined
    const next = update(entry?.contents ?? null)
    if (next) store.put({ timestamp: new Date(), mode: entry?.mode ?? FILE_MODE, contents: next } satisfies IdbfsEntry, `${MOUNT}${path}`)
    await transactionDone(tx)
  }
  finally {
    db.close()
  }
}

/** 写入前发现文件已被别处改过（游戏或云同步），放弃这次写入 */
export class StaleSaveError extends Error {}

/**
 * 在一个事务里改写或删除 /saves 下的若干文件（contents 为 null 表示删除），路径相对 /saves。
 * 改写保留原修改时间：在网页上编辑存档不算“玩过”，不能刷新“上次游玩”。
 * expected 给出改写前应有的内容，与当前不一致时抛 StaleSaveError、不做任何修改。
 */
export async function patchSaveFiles(changes: Map<string, Uint8Array | null>, expected: Map<string, Uint8Array> = new Map()): Promise<void> {
  const db = await openForWrite()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const paths = [...new Set([...changes.keys(), ...expected.keys()])]
    const current = new Map(await Promise.all(paths.map(async path =>
      [path, await request(store.get(`${MOUNT}${path}`)) as IdbfsEntry | undefined] as const)))

    for (const [path, contents] of expected) {
      const entry = current.get(path)
      if (!entry?.contents || !sameBytes(entry.contents, contents)) {
        tx.abort()
        throw new StaleSaveError(path)
      }
    }
    for (const [path, contents] of changes) {
      if (contents === null) {
        store.delete(`${MOUNT}${path}`)
        continue
      }
      const entry = current.get(path)
      store.put({ timestamp: entry ? new Date(entry.timestamp) : new Date(), mode: entry?.mode ?? FILE_MODE, contents } satisfies IdbfsEntry, `${MOUNT}${path}`)
    }
    await transactionDone(tx)
  }
  finally {
    db.close()
  }
}

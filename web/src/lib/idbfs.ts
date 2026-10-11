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

/** 读取 /saves 下的全部文件，键为完整路径 */
export async function readSaveFiles(): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>()
  const db = await openExisting()
  if (!db) return files
  try {
    if (!db.objectStoreNames.contains(STORE_NAME)) return files
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())])
    keys.forEach((key, i) => {
      const contents = (values[i] as IdbfsEntry | undefined)?.contents
      if (contents instanceof Uint8Array) files.set(String(key), contents)
    })
  }
  finally {
    db.close()
  }
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

/** 用云端存档替换本地 userdata/（registry.regemu、缓存等不动） */
export async function replaceArchiveFiles(files: ArchiveFiles): Promise<void> {
  const db = await openForWrite()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const prefix = `${MOUNT}${ARCHIVE_DIR}`
    const keys = await request(store.getAllKeys())
    for (const key of keys) {
      const path = String(key)
      if (path === prefix.slice(0, -1) || path.startsWith(prefix)) store.delete(key)
    }

    const timestamp = new Date()
    const dirs = new Set<string>()
    for (const path of files.keys()) {
      const parts = path.split('/').slice(0, -1)
      for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
    }
    dirs.add(ARCHIVE_DIR.slice(0, -1))
    for (const dir of dirs) {
      store.put({ timestamp, mode: DIR_MODE } satisfies IdbfsEntry, `${MOUNT}${dir}`)
    }
    for (const [path, contents] of files) {
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

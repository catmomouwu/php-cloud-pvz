// 本地 / Docker：使用 Node 内置的 node:sqlite（无原生依赖），经 drizzle 的 sqlite-proxy 接入。
// 首次使用时自动执行 server/db/migrations 下的迁移。

import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import type { H3Event } from 'h3'
import { schema } from './schema'
import type { AppDatabase } from './types'

const MIGRATIONS_TABLE = '__cloud_pvz_migrations'

let instance: Promise<AppDatabase> | null = null

async function migrate(sqlite: DatabaseSync) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`)
  const applied = new Set(
    (sqlite.prepare(`SELECT name FROM ${MIGRATIONS_TABLE}`).all() as { name: string }[]).map(row => row.name),
  )
  const storage = useStorage('assets:migrations')
  const names = (await storage.getKeys()).filter(key => key.endsWith('.sql')).sort()
  for (const name of names) {
    if (applied.has(name)) continue
    const sql = String(await storage.getItem(name) ?? '')
    sqlite.exec('BEGIN')
    try {
      for (const statement of sql.split('--> statement-breakpoint')) {
        if (statement.trim()) sqlite.exec(statement)
      }
      sqlite.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (name, applied_at) VALUES (?, ?)`).run(name, Date.now())
      sqlite.exec('COMMIT')
    }
    catch (error) {
      sqlite.exec('ROLLBACK')
      throw error
    }
  }
}

async function open(): Promise<AppDatabase> {
  const path = resolve(useRuntimeConfig().databasePath)
  mkdirSync(dirname(path), { recursive: true })
  const sqlite = new DatabaseSync(path)
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  await migrate(sqlite)

  return drizzle(async (sql, params, method) => {
    const statement = sqlite.prepare(sql)
    statement.setReturnArrays(true)
    const args = params as SQLInputValue[]
    if (method === 'run') {
      statement.run(...args)
      return { rows: [] }
    }
    if (method === 'get') {
      return { rows: (statement.get(...args) as unknown as unknown[] | undefined) ?? [] }
    }
    return { rows: statement.all(...args) as unknown as unknown[][] }
  }, { schema })
}

export function createDb(_event: H3Event): Promise<AppDatabase> {
  instance ??= open()
  return instance
}

/** node:sqlite 是同步单连接，可以安全使用事务 */
export const supportsTransactions = true

// Cloudflare Workers：使用 D1 绑定（wrangler 配置里的 DB）。迁移用 wrangler d1 migrations apply。

import { drizzle } from 'drizzle-orm/d1'
import type { H3Event } from 'h3'
import { schema } from './schema'
import type { AppDatabase } from './types'

// 不引入 @cloudflare/workers-types，直接用 drizzle 声明的 D1 类型
type D1Database = Parameters<typeof drizzle>[0]

const instances = new WeakMap<D1Database, AppDatabase>()

export async function createDb(event: H3Event): Promise<AppDatabase> {
  const binding = (event.context.cloudflare?.env as { DB?: D1Database } | undefined)?.DB
  if (!binding) throw new Error('D1 binding "DB" is not configured')
  let db = instances.get(binding)
  if (!db) {
    db = drizzle(binding, { schema })
    instances.set(binding, db)
  }
  return db
}

/** D1 不支持交互式事务 */
export const supportsTransactions = false

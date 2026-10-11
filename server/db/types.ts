import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import type { schema } from './schema'

/** node:sqlite（sqlite-proxy）与 D1 两种驱动的公共类型 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDatabase = BaseSQLiteDatabase<'async', any, typeof schema>

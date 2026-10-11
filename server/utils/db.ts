import type { H3Event } from 'h3'
// 由 nitro.config 按部署目标指向 node:sqlite 或 D1 驱动
import { createDb } from '#db-driver'
import type { AppDatabase } from '../db/types'

export function useDb(event: H3Event): Promise<AppDatabase> {
  return createDb(event)
}

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { H3Event } from 'h3'
import { supportsTransactions } from '#db-driver'
import { schema } from '../db/schema'
import type { AppDatabase } from '../db/types'

function createAuth(db: AppDatabase, event: H3Event) {
  const config = useRuntimeConfig(event)
  const list = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean)
  const trustedOrigins = list(config.auth.trustedOrigins)
  const ipAddressHeaders = list(config.auth.ipAddressHeaders)
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', schema, transaction: supportsTransactions }),
    secret: config.auth.secret || undefined,
    baseURL: config.auth.baseUrl || undefined,
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    advanced: ipAddressHeaders.length > 0 ? { ipAddress: { ipAddressHeaders } } : undefined,
  })
}

type Auth = ReturnType<typeof createAuth>

const instances = new WeakMap<AppDatabase, Auth>()

export async function useAuth(event: H3Event): Promise<Auth> {
  const db = await useDb(event)
  let auth = instances.get(db)
  if (!auth) {
    auth = createAuth(db, event)
    instances.set(db, auth)
  }
  return auth
}

/** 需要登录的接口调用；未登录直接 401 */
export async function requireUser(event: H3Event) {
  const auth = await useAuth(event)
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', data: { code: 'UNAUTHORIZED' } })
  }
  return session.user
}

import { defineConfig } from 'drizzle-kit'

// 只用来生成迁移 SQL（pnpm db:generate）。
// 本地 Node 启动时自动执行；Cloudflare D1 用 wrangler d1 migrations apply。
export default defineConfig({
  dialect: 'sqlite',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
})

import { fileURLToPath, URL } from 'node:url'
import { defineNitroConfig } from 'nitropack/config'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// 默认 preset 为 node-server（Docker）；Cloudflare 构建用 NITRO_PRESET=cloudflare_module
const isCloudflare = (process.env.NITRO_PRESET ?? '').startsWith('cloudflare')

export default defineNitroConfig({
  srcDir: 'server',
  compatibilityDate: '2026-10-01',
  alias: {
    '@shared': r('./shared'),
    // 数据库驱动按部署目标选择，CF 构建里不会出现 node:sqlite
    '#db-driver': isCloudflare ? r('./server/db/driver.d1.ts') : r('./server/db/driver.node.ts'),
  },
  // 运行时配置，可用环境变量覆盖：NITRO_AUTH_SECRET、NITRO_S3_ENDPOINT …
  runtimeConfig: {
    databasePath: '.data/cloud-pvz.sqlite',
    // 部署时游戏资源 main.pak 的路径（Docker 里挂载进来）；留空则不提供。只给已登录用户下载
    gamePakPath: '',
    auth: {
      secret: '',
      baseUrl: '',
      trustedOrigins: '',
      // 用于限流识别客户端 IP 的请求头（逗号分隔）。只填可信代理会写入的头：
      // Cloudflare 上是 cf-connecting-ip；Docker 部署在反向代理后面时可设为 x-forwarded-for
      ipAddressHeaders: isCloudflare ? 'cf-connecting-ip' : '',
    },
    s3: {
      endpoint: '',
      region: 'auto',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
    },
  },
  // Vite 构建出的前端（不含 main.pak）
  publicAssets: [{ dir: r('./dist/web'), maxAge: 0 }],
  serverAssets: [
    // SPA 回退用的 index.html，单独放一个目录，避免把 wasm 打进服务端 bundle
    { baseName: 'spa', dir: r('./dist/spa') },
    // 数据库迁移（Node 驱动启动时执行）
    { baseName: 'migrations', dir: r('./server/db/migrations') },
  ],
  // 仅对 cloudflare_module 生效：生成 .output/server/wrangler.json，部署时 wrangler 直接读取
  cloudflare: {
    deployConfig: true,
    wrangler: {
      name: 'cloud-pvz',
      // database_id 部署前替换为 wrangler d1 create cloud-pvz 输出的 id；本地开发任意值即可
      d1_databases: [{
        binding: 'DB',
        database_name: 'cloud-pvz',
        database_id: process.env.CLOUDFLARE_D1_ID ?? 'local',
        // 相对 .output/server/wrangler.json
        migrations_dir: '../../server/db/migrations',
      }],
    },
  },
  routeRules: {
    '/assets/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/game/**': { headers: { 'cache-control': 'public, max-age=86400' } },
  },
})

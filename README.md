# Cloud PVZ

在网页上直接玩 Plants vs. Zombies（基于 [PvZ-Portable](https://github.com/wszqkzqk/PvZ-Portable) 的 WebAssembly 构建），并把存档同步到云端。

> 本仓库**不包含**任何 PopCap / EA 的游戏素材。`main.pak` 需要来自你自己正版的 PvZ GOTY，且只在本地开发时使用，已被 `.gitignore` / `.dockerignore` 排除，构建产物也会检查并拒绝 `*.pak`。

## 当前进度

- [x] 前端框架：Vue 3 + [@felinic/ui](https://github.com/felinics/ui)（git submodule，`packages/ui`）、i18n（简体中文 / English）、浅色 / 深色
- [x] 游戏页：iframe 运行引擎，右侧游戏设置（启动用户、音量、静音、缩放、光标、垂直同步），全屏
- [x] 存档页：读取本浏览器 IndexedDB 中的存档，按游戏内用户展示进度、金币、游戏时长
- [x] 账号注册登录（better-auth，邮箱 + 密码；Drizzle + SQLite / D1）
- [x] 存档云同步（S3 兼容存储，本地 MinIO / 线上 R2）：按游戏内用户单独同步，自动上传、换设备自动下载、逐个用户处理冲突
- [x] 每个用户的历史版本：保留最近 30 个，可下载、可回滚（在用户详情页）
- [x] 存档管理：游戏内用户详情页，重命名、复制、导出、删除
- [x] 必须登录才能使用；退出登录时（已同步的前提下）清空本机存档

## 开发

```bash
git clone --recurse-submodules <repo>
pnpm install
cp .env.example .env                              # 填一个 NITRO_AUTH_SECRET（openssl rand -base64 32）
pnpm dev:s3                                       # 本地 S3：MinIO，API :9100，控制台 :9101
cp /path/to/your/main.pak web/public/main.pak     # 只在本地使用
pnpm dev                                          # http://localhost:5173
```

`pnpm dev` 同时启动 Vite（前端，5173）和 Nitro（后端，3000），Vite 把 `/api` 代理到 Nitro。本地数据库是 `.data/cloud-pvz.sqlite`（Node 内置 `node:sqlite`），首次启动自动迁移。

修改 `server/db/schema.ts` 后运行 `pnpm db:generate` 生成迁移。

## 环境变量

见 [.env.example](.env.example)。均为 Nitro 运行时配置，前缀 `NITRO_`：

| 变量 | 说明 |
|---|---|
| `NITRO_AUTH_SECRET` | better-auth 密钥，必填 |
| `NITRO_AUTH_BASE_URL` / `NITRO_AUTH_TRUSTED_ORIGINS` | 浏览器访问的地址 |
| `NITRO_AUTH_IP_ADDRESS_HEADERS` | 限流用的可信 IP 请求头；Cloudflare 构建默认 `cf-connecting-ip` |
| `NITRO_S3_ENDPOINT` / `REGION` / `BUCKET` / `ACCESS_KEY_ID` / `SECRET_ACCESS_KEY` | S3 兼容存储（R2 的 region 填 `auto`） |
| `NITRO_DATABASE_PATH` | Node / Docker 的 SQLite 文件路径 |

## 构建与部署

| 目标 | 命令 | 说明 |
|---|---|---|
| Node | `pnpm build` → `pnpm preview` | Nitro `node-server` preset，数据库 `node:sqlite` |
| Docker | `docker build -t cloud-pvz .` | `docker run -p 3000:3000 --env-file .env -v cloud-pvz-data:/app/.data cloud-pvz` |
| Cloudflare Workers | `pnpm build:cf` → `npx wrangler deploy` | 数据库 D1（绑定名 `DB`），存档走 R2 的 S3 API |

Cloudflare 首次部署：

```bash
npx wrangler d1 create cloud-pvz                         # 记下 database_id
CLOUDFLARE_D1_ID=<id> pnpm build:cf
npx wrangler d1 migrations apply cloud-pvz --remote -c .output/server/wrangler.json
npx wrangler secret put NITRO_AUTH_SECRET                 # 其余 NITRO_* 同样用 secret 或 vars 配置
npx wrangler deploy
```

## 目录

```
web/            前端（Vite root）
  index.html    主应用
  player.html   游戏 iframe（加载 public/game/ 下的引擎）
  public/game/  PvZ-Portable 0.2.5 的 wasm 构建
server/         Nitro 后端（api/、db/ 结构与迁移、utils/ 认证与存储）
shared/pvz/     存档 / 注册表格式解析、云存档打包（前后端共用）
compose.dev.yaml  本地 MinIO
packages/ui/    @felinic/ui（submodule）
docs/           设计文档
```

## 许可证

本项目以 [GPL-3.0](LICENSE) 发布。PvZ-Portable（开源的跨平台重实现）为 LGPL-3.0-or-later。Plants vs. Zombies 的知识产权归 PopCap / EA 所有。

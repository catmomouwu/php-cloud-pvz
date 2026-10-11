# Cloud PVZ 设计

## 目标

- 账号注册登录
- 每个账号一个云端存档目录，WebUI 管理其中的每个游戏内用户
- 部署在 Cloudflare Workers，存档存 S3 兼容存储（暂用 R2），数据库用 Drizzle + SQLite（线上 D1）
- 尽量不依赖 Cloudflare 专有 SDK，保留切换到 Node / Docker 的能力
- 只需要浏览器就能玩

## 技术栈

| 部分 | 选型 |
|---|---|
| 前端 | Vue 3、vue-router、vue-i18n、@felinic/ui（Tailwind v4） |
| 后端 | Nitro v2（`node-server` / `cloudflare_module`） |
| 账号 | better-auth（邮箱 + 密码），Drizzle 适配器 |
| 数据库 | Drizzle ORM，同一份 schema 与迁移；Node 用内置 `node:sqlite`（经 `sqlite-proxy`，无原生依赖），Cloudflare 用 D1。驱动由 `nitro.config.ts` 的 `#db-driver` 别名按部署目标选择 |
| 对象存储 | `aws4fetch`（S3 兼容），封装为 `SaveStore`；本地 MinIO，线上 R2 |

## 存档模型

PvZ 的一个存档目录（`userdata/`）里本身就能有多个游戏内用户：

- `users.dat`：用户名 → id 的索引
- `user{id}.dat`：每个用户的进度、金币、成就等
- `game{id}_{mode}.v4`：关卡中途存档
- `registry.regemu`：设置与上次使用的用户（`CurUser`）

**一个账号 = 一个存档目录。** 游戏内自带的切换用户可以直接使用；WebUI 对单个用户做管理（需要改写 `users.dat`）。同步时整个目录作为一个整体，带版本号上传。`cache32/` 是编译缓存，不同步。

格式解析见 `shared/pvz/`，均按 PvZ-Portable 源码核对过。

## 云同步（按游戏内用户）

**同步单位是单个游戏内用户**：每个用户在云端有稳定的标识（UUID，与各设备上的本地编号、名字都无关），各自有版本号、历史与回滚。

**云端包**（`shared/pvz/profile-archive.ts`）：`profile.json`（名字）+ `user.dat` + `game_{mode}.v4`，不含本地编号，任何设备都能放进自己的存档目录。`users.dat` 不上传，各设备按自己的用户列表重建；`registry.regemu` 是本机设置，不同步。摘要只取决于规范化后的内容（`profile.json` 统一编码），与 zip 编码和 JSON 写法无关。

**数据**

- `save_profile`：每个用户一行，当前版本号、名字、摘要、进度统计；删除只打 `deleted_at` 标记，让其他设备也删除。
- `save_profile_version`：每个用户保留最近 30 个版本；对象在 S3：`saves/{userId}/{profileKey}/{uuid}.zip`；删除记录没有内容。
- 账号内未删除的用户不能重名（不区分大小写，与游戏一致），重名返回 `409 NAME_TAKEN`。

**接口**：`GET /api/profiles`、`PUT|DELETE /api/profiles/:key?base=N`、`GET /api/profiles/:key/versions[/:version]`、`POST /api/profiles/:key/restore`。上传与删除都是乐观并发：服务端先把对象写进 S3，再条件更新 `version`（`WHERE version = N`），失败则删掉刚写的对象并返回 409 和云端当前状态。

**客户端对齐**（`useCloudSync`）：本机按账号记录 `云端 key → 本地编号 + 基准版本 + 摘要`，对每个用户：

| 情况 | 动作 |
|---|---|
| 本地 = 基准，云端更新了 | 下载覆盖；游戏运行中先提示，停止后再拉取 |
| 本地改了，云端仍是基准版本 | 上传 |
| 两边都改了 / 云端删了但本地改了 / 首次同步时同名但内容不同 | 该用户冲突，用户逐个选择以哪边为准 |
| 本地删了 | 云端打删除标记；若云端在此之后又被改过，则恢复到本地 |
| 只在本地 / 只在云端 | 上传新建 / 下载到本地（本地重名时改用副本名） |

安全措施：本机一个用户都没有却有同步记录（本机存档被清空）时按新设备处理，只丢弃记录，不会删除云端。新分配的本地编号会避开同步记录仍引用的编号。

触发时机：登录、启动游戏前（有冲突时不启动）、游戏写存档后（防抖 2 秒）、停止游戏后、页面重新可见时、手动“立即同步”。写入 IndexedDB 按 IDBFS 的格式（`timestamp` 为 `Date`），只在游戏未运行时进行。

**回滚**：在用户详情页的“历史版本”里恢复某个版本，会生成一个新版本（已删除的用户恢复后取消删除），随后按上表拉取到本地。

**账号与本机存档**：必须登录才能使用（路由守卫）。退出登录时先停止游戏、推送本地改动，每个用户都与云端一致才清空本机 `userdata/` 与同步记录；否则保留，避免丢数据。

**管理单个游戏内用户**（`shared/pvz/profiles.ts`）：重命名 / 复制 / 删除 / 导出都是对 `userdata/` 的纯函数变换，规则与 ProfileMgr 一致（名字不区分大小写唯一、最多 12 个字符；删除时一并删除 `user{id}.dat` 与关卡中途存档；复制时分配新编号并按新编号复制文件）。操作前先与云端对齐，写入后立即同步；游戏运行中不可修改。

**已知限制**：游戏自己删除用户后，若在下次同步前又新建了用户并恰好复用了同一个本地编号，会被当作同一个用户。

## 游戏运行

- 引擎是官方 Release 0.2.5 的 wasm 构建（非 MODULARIZE，依赖全局 `Module`，运行时无法在同页重启）。
- 因此游戏跑在 iframe（`player.html`）里：启动 = 加载 iframe，停止 = 卸载，重启 = 换新的 iframe。
- 游戏页由布局常驻、只做显隐：iframe 一旦被移出文档就会重新加载。
- 启动前补齐两个外置文件：
  - `properties/partner.xml`：提供 `RegistryKey`，否则引擎不读写 `registry.regemu`；
  - `properties/partner_logo.png`：1×1 黑色占位图，引擎启动必需。
- 外层设置在启动前写入 `registry.regemu`（音量、静音、光标、垂直同步、启动用户）；缩放由外层控制，可即时生效。
- 存档目录 `/saves` 挂载 IDBFS。引擎写文件不通知 JS，iframe 拦截 `FS.close/unlink/rename` 发现改动，防抖后 `syncfs` 并通知外层刷新。

## main.pak

只在本地开发使用，放在 `web/public/main.pak`：

1. `.gitignore`、`.dockerignore` 排除 `*.pak`；
2. Vite 构建后从产物删除 `main.pak`；
3. `scripts/postbuild-web.mjs` 发现 `*.pak` 或超过 25 MiB 的文件直接失败；
4. 生产环境 SPA 回退不处理带扩展名的路径，`/main.pak` 返回 404，页面显示“缺少游戏资源”。

## 已知事项

- `@felinic/ui` 依赖的 `@memohai/icon` 声明为 `^0.20.0`，但用到了 0.21.0 才有的 `ErrorIcon`；本项目用 pnpm overrides 固定到 `^0.21.0`。
- `@felinic/ui` 仓库目前没有 LICENSE 文件，正式发布前需要确认许可。
- Workers 免费计划每请求 10ms CPU，登录时的密码哈希可能超限，正式部署时需要实测。
- better-auth 的限流默认存在内存里；Workers 上每个 isolate 各自计数，需要更严格时改用数据库存储。
- better-auth 打包产物里有一处对 `node:sqlite` 的动态导入，只在直接传入 sqlite 实例时才执行，Workers 上不会走到。

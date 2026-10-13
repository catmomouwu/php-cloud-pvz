# Cloud PvZ — PHP 虚拟主机部署说明

把 Cloud PvZ 部署到只有 **PHP 8.3 + MySQL 5.7 + FTP + Nginx** 的虚拟主机上。
后端是零依赖的纯 PHP（无 Composer），前端是构建好的静态文件。

## 目录结构

```
php/
  public/              ← 前端静态产物 + index.php 入口（pnpm run build:php 生成）
  app/                 ← PHP 后端代码（config.php 部署时创建）
  data/                ← 运行时数据：存档 zip（saves/）与 main.pak（game/）
  nginx.conf.example   ← Nginx 配置片段
  router-dev.php       ← 本地测试用（php -S），部署时不需要上传
```

## 一、构建前端（有 Node 22+ 环境时）

```bash
git clone https://github.com/felinics/ui packages/ui   # UI 组件库（子模块）
pnpm install
pnpm run build:php
```

产物在 `php/public/`（约 13.5 MB，含游戏引擎 wasm）。
仓库已带一份构建好的 `php/public/`，不改动前端时可直接使用，跳过本步。

## 二、FTP 上传

按主机类型二选一。两种布局 `index.php` 都能自动识别。

### 布局一：webroot 是子目录（如宝塔 `/www/wwwroot/站点/public`，FTP 能看到 webroot 上级）

```
站点/
  public/   ← 上传 php/public 里的全部内容（index.php、index.html、player.html、assets/、game/）
  app/      ← 上传 php/app
  data/     ← 上传 php/data（含空的 saves/、game/ 子目录）
```

app/ 与 data/ 天然在 webroot 之外，最安全，Nginx 无需 deny 规则。

### 布局二：FTP 根目录就是 webroot（传统虚拟主机）

```
webroot/
  index.php、index.html、player.html、assets/、game/   ← php/public 的内容
  app/      ← php/app
  data/     ← php/data
```

此布局**必须**配置 Nginx 拒绝访问 `/app/` 和 `/data/`（见下节），否则存档和 main.pak 会被直接下载。

## 三、Nginx 配置

完整片段见 [nginx.conf.example](../php/nginx.conf.example)，把其中的 location 块加到站点配置（或面板的"伪静态/Nginx 配置"输入框）：

```nginx
location ^~ /app/  { deny all; }            # 布局一时可删
location ^~ /data/ { deny all; }            # 布局一时可删
location = /main.pak { rewrite ^ /index.php last; }
location ^~ /api/   { rewrite ^ /index.php last; }
location ^~ /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
location ^~ /game/   { add_header Cache-Control "public, max-age=86400"; }
location / { try_files $uri $uri/ /index.html; }
```

要点：

- `/api/**` 和 `/main.pak` 必须进 PHP；其余缺失路径回退 `index.html`（SPA 路由）。
- 面板只提供"伪静态"时用文件末尾的简化版（regex rewrite），但务必确认 `/app`、`/data` 的 deny 生效。
- 若主机限制了请求体大小（`client_max_body_size`），存档上传（最大 4 MB）需要 ≥ 8m。

## 四、创建配置文件

把 `app/config.example.php` 复制为 `app/config.php`（FTP 上传一份再改名编辑即可），填入 MySQL 信息：

```php
'db' => [
    'driver' => 'mysql',
    'host' => 'localhost',      // 主机商给的数据库地址
    'port' => 3306,
    'name' => 'xxx',            // 数据库名
    'user' => 'xxx',
    'pass' => 'xxx',
],
'data_dir' => __DIR__ . '/../data',   // 布局一/二都适用；也可填 webroot 外的绝对路径
```

数据库**无需手动建表**：首次请求时自动创建全部表（幂等）。
如果主机允许，把 `data_dir` 指到 webroot 外的绝对路径更安全（如 `/home/xxx/cloud-pvz-data`），再把 main.pak 放到那里。

## 五、上传 main.pak

把游戏资源 `main.pak` FTP 上传到 `data/game/main.pak`（或在 config.php 里用 `pak_path` 指定任意绝对路径）。
该文件**不要**放进 `public/`；它只通过登录鉴权的 `/main.pak` 接口下发。

### 中文版（汉化）

PvZ-Portable 引擎支持官方中文版资源包。当前 `php/data/game/` 已放置中文版资源：

```
data/game/
  main.pak                    ← 中文版（1.1.0.1056 ZH，约 65 MB）
  properties/default.xml      ← 中文框架字符串覆盖（对话框按钮等）
  properties/Layout.xml       ← 中文排版参数（自动换行等）
```

播放器会在启动时自动尝试加载 `/game-properties/*.xml`（同样走登录鉴权）；
文件不存在时自动跳过，因此只放英文版 `main.pak`（不带 properties）也完全兼容。

如果想换回英文版：删掉 `data/game/properties/` 两个 xml、替换 `main.pak` 即可。

## 六、验证（冒烟清单）

1. 打开 `https://你的域名/api/health` → 应返回 `{"ok":true,...}`
2. 打开站点 → 登录页正常渲染；注册一个账号 → 跳转首页
3. 设置页 → 游戏资源显示"已就绪（约 43.3 MB）"
4. 存档页 → 正常渲染（新账号为空列表）
5. 玩一关 → 存档页出现用户、云端同步状态正常；快照/历史/还原各点一遍

## 七、常见问题

| 现象 | 原因与处理 |
|---|---|
| 页面 500，提到 missing PHP extensions | 主机缺 `pdo_mysql` / `zip` / `mbstring`，在面板 PHP 设置里启用 |
| 页面 500，提到 config missing | 没创建 `app/config.php`（复制 config.example.php 并填写） |
| 注册/登录 500，日志报 SQL 连接失败 | config.php 里数据库信息不对，或数据库账号未授权 |
| 上传存档报错 / 请求被截断 | Nginx `client_max_body_size` 或 PHP `post_max_size` 低于 8M |
| 刷新页面（如 /saves）404 | 伪静态规则未生效：无扩展名路径要回退 index.html |
| 设置页显示缺少游戏资源 | `data/game/main.pak` 未上传，或 `data_dir` 配置错误 |
| data 目录写不进去 | `data/` 及其子目录需要可写权限（一般 775；FTP 客户端右键设权限） |
| main.pak 下载中断 | PHP 执行时间限制过短；代码已 `set_time_limit(0)`，若仍中断检查面板的强制限制 |

## 八、本地测试（可选，不依赖虚拟主机）

```bash
# 任意 PHP 8.3（php.zip 解压后启用 zip/mbstring/pdo_sqlite 扩展）
cp php/app/config.example.php php/app/config.php   # 把 driver 改成 sqlite
php -S 127.0.0.1:8099 -t php/public php/router-dev.php
```

访问 http://127.0.0.1:8099 ，把 `main.pak` 放到 `php/data/game/` 即可完整体验。

## 安全说明

- 会话用 HttpOnly Cookie（`better-auth.session_token`），密码存 bcrypt（`password_hash`）。
- `main.pak` 与全部存档 zip 只在登录后经 PHP 下发；`/app/`、`/data/` 直接访问由 Nginx 拒绝。
- 注册默认开放；如需关闭，可在 `app/auth.php` 的 `auth_sign_up` 开头直接返回 403。

// 组装 PHP 虚拟主机部署包（在 vite build 之后运行，见 package.json 的 build:php）：
// 1. 把 dist/web 静态产物复制进 php/public（index.php 入口保留）；
// 2. 检查部署包里没有游戏资源（*.pak，与 postbuild-web.mjs 的守卫一致）；
// 3. 确保 php/data 运行时目录骨架存在。
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const webDir = join(root, 'dist', 'web')
const publicDir = join(root, 'php', 'public')
const dataDir = join(root, 'php', 'data')

if (!existsSync(join(webDir, 'index.html'))) {
  console.error('缺少 dist/web/index.html：请先运行 vite 构建（pnpm exec vite build）')
  process.exit(1)
}

// 清理上次构建产物（保留手写的 index.php 入口），再复制静态产物
for (const entry of readdirSync(publicDir)) {
  if (entry !== 'index.php') rmSync(join(publicDir, entry), { recursive: true, force: true })
}
for (const entry of readdirSync(webDir)) {
  cpSync(join(webDir, entry), join(publicDir, entry), { recursive: true })
}

// 确保入口存在
const entry = join(publicDir, 'index.php')
if (!existsSync(entry)) {
  console.error(`缺少 ${entry}：php/public/index.php 不得删除`)
  process.exit(1)
}

// 运行时目录骨架
for (const dir of [join(dataDir, 'saves'), join(dataDir, 'game')]) {
  mkdirSync(dir, { recursive: true })
  const stub = join(dir, 'index.html')
  if (!existsSync(stub)) copyFileSync(join(dataDir, 'index.html'), stub)
}

// 安全检查：*.pak 不得进入部署包
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name)
    return item.isDirectory() ? walk(path) : [path]
  })
}

const problems = []
for (const file of walk(publicDir)) {
  if (file.toLowerCase().endsWith('.pak')) problems.push(`游戏资源不得进入部署包：${file}`)
}
if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const bytes = walk(publicDir).reduce((sum, file) => sum + statSync(file).size, 0)
console.log(`build-php: ok（php/public 共 ${(bytes / 1024 / 1024).toFixed(1)} MB，FTP 上传其全部内容到 webroot）`)
console.log('build-php: 部署步骤见 php/README.md（config.php、Nginx 规则、main.pak 上传到 data/game/）')

// Vite 构建后的检查与整理：
// 1. 产物里绝不能出现游戏资源（*.pak），也不能有超过 Workers 单文件上限的文件；
// 2. 把 index.html 复制到 dist/spa/，供 Nitro 做 SPA 回退。
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const WEB_DIR = 'dist/web'
const SPA_DIR = 'dist/spa'
const MAX_FILE_BYTES = 25 * 1024 * 1024

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

const problems = []
for (const file of walk(WEB_DIR)) {
  if (file.toLowerCase().endsWith('.pak')) problems.push(`游戏资源不得进入产物：${file}`)
  else if (statSync(file).size > MAX_FILE_BYTES) problems.push(`文件超过 25 MiB：${file}`)
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}

mkdirSync(SPA_DIR, { recursive: true })
copyFileSync(join(WEB_DIR, 'index.html'), join(SPA_DIR, 'index.html'))
console.log('postbuild-web: ok')

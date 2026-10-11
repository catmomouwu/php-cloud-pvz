import { rmSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// web/public/main.pak 只给本地 dev 用。Vite 构建会整目录复制 public/，
// 这里在产物写完后删掉它；scripts/postbuild-web.mjs 还会再检查一遍。
function stripGameResources(): Plugin {
  let outDir = ''
  return {
    name: 'cloud-pvz:strip-game-resources',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      rmSync(`${outDir}/main.pak`, { force: true })
    },
  }
}

export default defineConfig({
  root: r('./web'),
  plugins: [vue(), tailwindcss(), stripGameResources()],
  resolve: {
    // @felinic/ui 以 workspace 源码形式引入，确保只有一份 vue
    dedupe: ['vue'],
    alias: {
      '@': r('./web/src'),
      '@shared': r('./shared'),
      // @felinic/ui 源码内部使用 # 指向自身 src
      '#': r('./packages/ui/src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: r('./dist/web'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: r('./web/index.html'),
        player: r('./web/player.html'),
      },
    },
  },
})

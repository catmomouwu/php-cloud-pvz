// 在主页面里读取 main.pak（图鉴用）。只加载一次、常驻内存；素材只在本机浏览器里解码使用。

import { shallowRef } from 'vue'
import { type AlmanacAssets, createAlmanacAssets } from '@/lib/pvz/almanac-render'
import { createImageLoader } from '@/lib/pvz/images'
import { parsePak } from '@/lib/pvz/pak'
import { parseStrings } from '@/lib/pvz/strings'

export type AssetsState = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

export interface GameAssets extends AlmanacAssets {
  strings: Map<string, string>
}

const state = shallowRef<AssetsState>('idle')
const assets = shallowRef<GameAssets | null>(null)
let pending: Promise<void> | null = null

async function load() {
  state.value = 'loading'
  try {
    const response = await fetch('/main.pak')
    // 开发服务器对不存在的文件可能回退成 index.html
    if (!response.ok || (response.headers.get('content-type') ?? '').includes('text/html')) {
      state.value = 'missing'
      return
    }
    const pak = parsePak(await response.arrayBuffer())
    const strings = parseStrings(pak.text('properties/LawnStrings.txt') ?? '')
    assets.value = { ...createAlmanacAssets(pak, createImageLoader(pak)), strings }
    state.value = 'ready'
  }
  catch (error) {
    console.warn('Failed to load main.pak', error)
    state.value = 'error'
  }
}

export function useGameAssets() {
  pending ??= load()
  return { state, assets }
}

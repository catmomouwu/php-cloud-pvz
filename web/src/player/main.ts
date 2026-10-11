// 游戏 iframe 的运行时：加载 Emscripten 构建、补齐资源与设置、挂载存档目录并启动引擎。
// 官方构建不是 MODULARIZE，依赖全局 Module；运行时也无法在同一页面重启，所以每次启动都是一个新的 iframe。

import { applySettingsToRegistry, DEFAULT_GAME_SETTINGS, PARTNER_LOGO_PNG_BASE64, PARTNER_XML, type ScaleMode } from '@shared/pvz/game-config'
import { decodeLaunchConfig, isParentMessage, MESSAGE_SOURCE, type PlayerMessage } from '@/lib/player-protocol'

interface EmscriptenFS {
  mkdir: (path: string) => void
  writeFile: (path: string, data: Uint8Array | string) => void
  readFile: (path: string) => Uint8Array
  analyzePath: (path: string) => { exists: boolean }
  mount: (type: unknown, opts: object, mountpoint: string) => void
  syncfs: (populate: boolean, callback: (err: unknown) => void) => void
  filesystems: { IDBFS: unknown }
  close: (stream: { path?: string, flags: number }) => void
  unlink: (path: string) => void
  rename: (oldPath: string, newPath: string) => void
}

interface EmscriptenModule {
  canvas: HTMLCanvasElement
  noInitialRun: boolean
  locateFile: (path: string) => string
  onRuntimeInitialized: () => void
  onAbort: (what: unknown) => void
  print: (text: string) => void
  printErr: (text: string) => void
  FS?: EmscriptenFS
  callMain?: (args: string[]) => void
}

declare global {
  interface Window {
    Module: EmscriptenModule
    onGameExit?: () => void
  }
}

const SAVE_DIR = '/saves'
const REGISTRY_PATH = `${SAVE_DIR}/registry.regemu`
const SYNC_DEBOUNCE_MS = 1500
const SYNC_INTERVAL_MS = 5000
const O_ACCMODE = 3

const settings = { ...DEFAULT_GAME_SETTINGS, ...decodeLaunchConfig(location.hash) }
const canvas = document.getElementById('canvas') as HTMLCanvasElement

function post(message: PlayerMessage) {
  window.parent.postMessage({ source: MESSAGE_SOURCE, ...message }, location.origin)
}

// ---- 画面缩放 ----

let scaleMode: ScaleMode = settings.scale

function resizeCanvas() {
  const fit = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height)
  const scale = scaleMode === 'integer' && fit >= 1 ? Math.floor(fit) : fit
  canvas.style.width = `${Math.floor(canvas.width * scale)}px`
  canvas.style.height = `${Math.floor(canvas.height * scale)}px`
  canvas.dataset.scale = scaleMode
}

window.addEventListener('resize', resizeCanvas)
document.addEventListener('fullscreenchange', resizeCanvas)
canvas.addEventListener('contextmenu', event => event.preventDefault())
resizeCanvas()

// ---- 声音：静音即时生效 ----
// 引擎（SDL）在 wasm 里把音乐和音效混成一路，再接到 AudioContext 的输出上，没有对外的音量接口。
// 这里拦截“接到输出”这一步，在中间插一个总增益节点：静音时把它调到 0，不需要重启游戏。
// 音乐、音效各自的音量只能由引擎在启动时从 registry 读取。

const masterGains: GainNode[] = []
const gainByContext = new WeakMap<BaseAudioContext, GainNode>()
let muted = settings.muted

function installMasterGain() {
  const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown
  AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
    const [destination] = args
    if (destination instanceof AudioDestinationNode) {
      let gain = gainByContext.get(destination.context)
      if (!gain) {
        gain = destination.context.createGain()
        gain.gain.value = muted ? 0 : 1
        connect.call(gain, destination)
        gainByContext.set(destination.context, gain)
        masterGains.push(gain)
      }
      return connect.call(this, gain, ...args.slice(1))
    }
    return connect.apply(this, args)
  } as AudioNode['connect']
}

function setMuted(value: boolean) {
  muted = value
  for (const gain of masterGains) gain.gain.value = value ? 0 : 1
}

installMasterGain()

// ---- Emscripten 运行时 ----

const runtimeReady = new Promise<void>((resolve, reject) => {
  window.Module = {
    canvas,
    noInitialRun: true,
    locateFile: path => `/game/${path}`,
    onRuntimeInitialized: resolve,
    onAbort: what => reject(new Error(String(what))),
    print: text => console.log(text),
    printErr: text => console.warn(text),
  }
})

function loadEngineScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/game/pvz-portable.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load /game/pvz-portable.js'))
    document.body.appendChild(script)
  })
}

function fs(): EmscriptenFS {
  const value = window.Module.FS
  if (!value) throw new Error('Emscripten FS is not available')
  return value
}

function mkdirp(path: string) {
  let current = ''
  for (const part of path.split('/').filter(Boolean)) {
    current += `/${part}`
    if (!fs().analyzePath(current).exists) fs().mkdir(current)
  }
}

function readIfExists(path: string): Uint8Array | null {
  return fs().analyzePath(path).exists ? fs().readFile(path) : null
}

// ---- 存档同步（浏览器 IndexedDB） ----

let mounted = false
let dirty = false
let syncTimer: number | undefined
let syncing: Promise<void> | null = null

function syncSaves(): Promise<void> {
  if (!mounted) return Promise.resolve()
  if (syncing) return syncing
  const wasDirty = dirty
  dirty = false
  syncing = new Promise<void>((resolve) => {
    fs().syncfs(false, (err) => {
      if (err) {
        console.warn('IDBFS sync failed', err)
        dirty = dirty || wasDirty
      }
      else if (wasDirty) {
        post({ type: 'saves-changed' })
      }
      resolve()
    })
  }).finally(() => {
    syncing = null
  })
  return syncing
}

function markDirty() {
  dirty = true
  window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => void syncSaves(), SYNC_DEBOUNCE_MS)
}

// 引擎写存档时不会通知 JS：拦截文件关闭/删除/重命名来发现改动
function watchSaveWrites() {
  const target = fs()
  const close = target.close.bind(target)
  const unlink = target.unlink.bind(target)
  const rename = target.rename.bind(target)
  target.close = (stream) => {
    if (stream.path?.startsWith(`${SAVE_DIR}/`) && (stream.flags & O_ACCMODE) !== 0) markDirty()
    return close(stream)
  }
  target.unlink = (path) => {
    if (path.startsWith(`${SAVE_DIR}/`)) markDirty()
    return unlink(path)
  }
  target.rename = (oldPath, newPath) => {
    if (oldPath.startsWith(`${SAVE_DIR}/`) || newPath.startsWith(`${SAVE_DIR}/`)) markDirty()
    return rename(oldPath, newPath)
  }
}

// ---- 启动流程 ----

async function prepareResources(): Promise<boolean> {
  const response = await fetch('/main.pak')
  const contentType = response.headers.get('content-type') ?? ''
  // 开发服务器对不存在的文件可能回退成 index.html
  if (!response.ok || contentType.includes('text/html')) return false
  fs().writeFile('/main.pak', new Uint8Array(await response.arrayBuffer()))

  mkdirp('/properties')
  fs().writeFile('/properties/partner.xml', PARTNER_XML)
  fs().writeFile('/properties/partner_logo.png', Uint8Array.from(atob(PARTNER_LOGO_PNG_BASE64), c => c.charCodeAt(0)))
  return true
}

async function mountSaves() {
  mkdirp(SAVE_DIR)
  fs().mount(fs().filesystems.IDBFS, {}, SAVE_DIR)
  await new Promise<void>(resolve => fs().syncfs(true, (err) => {
    if (err) console.warn('IDBFS initial sync failed', err)
    resolve()
  }))
  mounted = true
  fs().writeFile(REGISTRY_PATH, applySettingsToRegistry(readIfExists(REGISTRY_PATH), settings))
}

async function start() {
  post({ type: 'status', status: 'loading' })
  try {
    await loadEngineScript()
    await runtimeReady
  }
  catch (error) {
    post({ type: 'status', status: 'error', error: 'runtime-failed', detail: String(error) })
    return
  }

  if (!(await prepareResources())) {
    post({ type: 'status', status: 'error', error: 'missing-resources' })
    return
  }

  await mountSaves()
  watchSaveWrites()
  window.setInterval(() => {
    if (dirty) void syncSaves()
  }, SYNC_INTERVAL_MS)

  window.onGameExit = () => {
    void syncSaves().then(() => post({ type: 'status', status: 'exited' }))
  }

  canvas.focus()
  window.Module.callMain?.([])
  post({ type: 'status', status: 'running' })
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || !isParentMessage(event.data)) return
  const message = event.data
  if (message.type === 'set-scale') {
    scaleMode = message.scale
    resizeCanvas()
  }
  else if (message.type === 'set-muted') {
    setMuted(message.muted)
  }
  else if (message.type === 'flush') {
    dirty = true
    void syncSaves().then(() => post({ type: 'flushed' }))
  }
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void syncSaves()
})

void start()

// 引擎启动前需要补齐的文件与注册表约定。
// 原版安装目录里的外置 properties/ 不在 main.pak 内：
// - partner.xml 提供 RegistryKey，没有它游戏不会读写 registry.regemu（音量、上次用户等都不保存）；
// - partner_logo 是启动时必须加载的图片，这里用 1x1 黑色 PNG 占位（开场黑底上看不见）。

import { getDword, getString, parseRegistry, serializeRegistry, setDword, setString } from './regemu'

export const REGISTRY_KEY_NAME = 'PopCap\\PlantsVsZombies'
/** SexyAppBase::RegistryWrite 使用的完整键名："SOFTWARE\\" + RegistryKey */
export const REGISTRY_KEY = `SOFTWARE\\${REGISTRY_KEY_NAME}`

export const PARTNER_XML = `<?xml version="1.0"?>
<Properties>
  <String id="RegistryKey">${REGISTRY_KEY_NAME}</String>
</Properties>
`

export const PARTNER_LOGO_PNG_BASE64
  = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC'

export type ScaleMode = 'fit' | 'integer'

/** 外层页面可调整的游戏设置；除 scale 外都在启动时写入 registry.regemu */
export interface GameSettings {
  /** 启动时选中的游戏内用户；null 表示沿用游戏记录的上次用户 */
  launchUser: string | null
  musicVolume: number
  sfxVolume: number
  muted: boolean
  customCursors: boolean
  vsync: boolean
  scale: ScaleMode
}

/** 与 SexyAppBase 构造函数中的默认值一致（音量 0.85） */
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  launchUser: null,
  musicVolume: 85,
  sfxVolume: 85,
  muted: false,
  customCursors: true,
  vsync: true,
  scale: 'fit',
}

/** 把设置写进已有的 registry.regemu 内容，返回新文件内容 */
export function applySettingsToRegistry(existing: Uint8Array | null, settings: GameSettings): Uint8Array {
  const registry = parseRegistry(existing)
  setDword(registry, REGISTRY_KEY, 'MusicVolume', Math.round(settings.musicVolume))
  setDword(registry, REGISTRY_KEY, 'SfxVolume', Math.round(settings.sfxVolume))
  setDword(registry, REGISTRY_KEY, 'Muted', settings.muted ? 1 : 0)
  setDword(registry, REGISTRY_KEY, 'CustomCursors', settings.customCursors ? 1 : 0)
  setDword(registry, REGISTRY_KEY, 'WaitForVSync', settings.vsync ? 1 : 0)
  if (settings.launchUser) setString(registry, REGISTRY_KEY, 'CurUser', settings.launchUser)
  return serializeRegistry(registry)
}

/** 改名后同步更新上次使用的用户；不是这个用户时返回 null（不修改） */
export function renameCurrentUser(bytes: Uint8Array | null, oldName: string, newName: string): Uint8Array | null {
  const registry = parseRegistry(bytes)
  if (getString(registry, REGISTRY_KEY, 'CurUser') !== oldName) return null
  setString(registry, REGISTRY_KEY, 'CurUser', newName)
  return serializeRegistry(registry)
}

/** 读取游戏记录的上次使用的用户（正常退出时才会写入） */
export function readCurrentUser(bytes: Uint8Array | null): string | null {
  return getString(parseRegistry(bytes), REGISTRY_KEY, 'CurUser')
}

/** 读取游戏内调整过的设置，用于同步回外层表单 */
export function readSettingsFromRegistry(bytes: Uint8Array | null): Partial<GameSettings> {
  const registry = parseRegistry(bytes)
  const result: Partial<GameSettings> = {}
  const music = getDword(registry, REGISTRY_KEY, 'MusicVolume')
  const sfx = getDword(registry, REGISTRY_KEY, 'SfxVolume')
  const muted = getDword(registry, REGISTRY_KEY, 'Muted')
  const cursors = getDword(registry, REGISTRY_KEY, 'CustomCursors')
  const vsync = getDword(registry, REGISTRY_KEY, 'WaitForVSync')
  if (music !== null) result.musicVolume = music
  if (sfx !== null) result.sfxVolume = sfx
  if (muted !== null) result.muted = muted !== 0
  if (cursors !== null) result.customCursors = cursors !== 0
  if (vsync !== null) result.vsync = vsync !== 0
  return result
}

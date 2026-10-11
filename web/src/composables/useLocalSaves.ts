// 本浏览器中的游戏内用户：直接读取引擎的 IDBFS 存储，不需要启动游戏即可展示。

import { ref, shallowRef } from 'vue'
import { readCurrentUser } from '@shared/pvz/game-config'
import { isMidLevelSaveOf, parsePlayerDat, parseUsersDat, type PlayerDetails } from '@shared/pvz/userdata'
import { readSaveFiles } from '@/lib/idbfs'

const USERDATA_DIR = '/saves/userdata/'

export interface LocalProfile {
  id: number
  name: string
  useSeq: number
  /** missing：游戏还没写出 user{id}.dat（新用户在有进度或正常退出前都是这样） */
  detailsState: 'ok' | 'missing' | 'unreadable'
  details: PlayerDetails | null
  hasMidLevelSave: boolean
  isLastUsed: boolean
}

function safeParse<T>(parse: () => T): T | null {
  try {
    return parse()
  }
  catch {
    return null
  }
}

function buildProfiles(files: Map<string, Uint8Array>): LocalProfile[] {
  const usersDat = files.get(`${USERDATA_DIR}users.dat`)
  const summaries = usersDat ? safeParse(() => parseUsersDat(usersDat)) ?? [] : []
  const lastUser = readCurrentUser(files.get('/saves/registry.regemu') ?? null)
  const userdataNames = [...files.keys()]
    .filter(path => path.startsWith(USERDATA_DIR))
    .map(path => path.slice(USERDATA_DIR.length))

  return summaries
    .map((summary) => {
      const userDat = files.get(`${USERDATA_DIR}user${summary.id}.dat`)
      const details = userDat ? safeParse(() => parsePlayerDat(userDat)) : null
      return {
        ...summary,
        detailsState: !userDat ? 'missing' as const : details ? 'ok' as const : 'unreadable' as const,
        details,
        hasMidLevelSave: userdataNames.some(name => isMidLevelSaveOf(name, summary.id)),
        isLastUsed: summary.name === lastUser,
      }
    })
    .sort((a, b) => b.useSeq - a.useSeq)
}

const profiles = shallowRef<LocalProfile[]>([])
const loading = ref(false)
const loaded = ref(false)

export async function refreshLocalSaves() {
  loading.value = true
  try {
    profiles.value = buildProfiles(await readSaveFiles())
  }
  finally {
    loading.value = false
    loaded.value = true
  }
}

export function useLocalSaves() {
  if (!loaded.value && !loading.value) void refreshLocalSaves()
  return { profiles, loading, loaded, refresh: refreshLocalSaves }
}

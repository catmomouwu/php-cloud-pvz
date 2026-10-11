// 本浏览器中的游戏内用户：直接读取引擎的 IDBFS 存储，不需要启动游戏即可展示。

import { countTrophies, type TrophyCounts } from '@shared/pvz/progress'
import { isMidLevelSaveOf, parsePlayerDat, parseUsersDat, type PlayerDetails } from '@shared/pvz/userdata'
import { ref, shallowRef } from 'vue'
import { readSaveEntries, type SaveEntry } from '@/lib/idbfs'

const USERDATA_DIR = '/saves/userdata/'

export interface LocalProfile {
  id: number
  name: string
  useSeq: number
  /** missing：游戏还没写出 user{id}.dat（新用户在有进度或正常退出前都是这样） */
  detailsState: 'ok' | 'missing' | 'unreadable'
  details: PlayerDetails | null
  trophies: TrophyCounts | null
  hasMidLevelSave: boolean
  /** 关卡中途存档的路径（相对 /saves） */
  midLevelFiles: string[]
  /** user{id}.dat 原始内容，存档编辑器使用 */
  userDat: Uint8Array | null
  /** 该用户存档文件的最后修改时间，即上次游玩时间；从未存档时为 null */
  lastPlayedAt: Date | null
}

function safeParse<T>(parse: () => T): T | null {
  try {
    return parse()
  }
  catch {
    return null
  }
}

function buildProfiles(entries: Map<string, SaveEntry>): LocalProfile[] {
  const usersDat = entries.get(`${USERDATA_DIR}users.dat`)?.contents
  const summaries = usersDat ? safeParse(() => parseUsersDat(usersDat)) ?? [] : []
  const userdata = [...entries]
    .filter(([path]) => path.startsWith(USERDATA_DIR))
    .map(([path, entry]) => ({ name: path.slice(USERDATA_DIR.length), entry }))

  return summaries
    .map((summary) => {
      const userDat = entries.get(`${USERDATA_DIR}user${summary.id}.dat`)
      const details = userDat ? safeParse(() => parsePlayerDat(userDat.contents)) : null
      const own = userdata.filter(file => file.name === `user${summary.id}.dat` || isMidLevelSaveOf(file.name, summary.id))
      const lastPlayed = Math.max(...own.map(file => file.entry.modifiedAt.getTime()))
      return {
        ...summary,
        detailsState: !userDat ? 'missing' as const : details ? 'ok' as const : 'unreadable' as const,
        details,
        trophies: details ? countTrophies(details) : null,
        hasMidLevelSave: own.some(file => isMidLevelSaveOf(file.name, summary.id)),
        midLevelFiles: own.filter(file => isMidLevelSaveOf(file.name, summary.id)).map(file => `userdata/${file.name}`),
        userDat: userDat?.contents ?? null,
        lastPlayedAt: Number.isFinite(lastPlayed) ? new Date(lastPlayed) : null,
      }
    })
    // 最近玩过的排在前面；都没玩过时按游戏里的使用顺序
    .sort((a, b) => (b.lastPlayedAt?.getTime() ?? 0) - (a.lastPlayedAt?.getTime() ?? 0) || b.useSeq - a.useSeq)
}

const profiles = shallowRef<LocalProfile[]>([])
const loading = ref(false)
const loaded = ref(false)

/** 每次刷新的序号：多次刷新同时进行时，只采用最后发起的那次（先发起的可能读到删除、改名之前的旧数据） */
let generation = 0

export async function refreshLocalSaves() {
  const current = ++generation
  loading.value = true
  try {
    const next = buildProfiles(await readSaveEntries())
    if (current === generation) profiles.value = next
  }
  finally {
    if (current === generation) {
      loading.value = false
      loaded.value = true
    }
  }
}

export function useLocalSaves() {
  if (!loaded.value && !loading.value) void refreshLocalSaves()
  return { profiles, loading, loaded, refresh: refreshLocalSaves }
}

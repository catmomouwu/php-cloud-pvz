// 挑战模式（小游戏 / 解谜 / 生存）的关卡定义与解锁规则，与 PvZ-Portable 一致：
// - 关卡表：src/Lawn/Widget/ChallengeScreen.cpp gChallengeDefs（GameMode = 下标 + 1，记录在 challengeRecords[mode − 1]）
// - 通关判定：LawnApp::HasBeatenChallenge（普通生存 ≥ 5 面旗、困难生存 ≥ 10 面旗、无尽模式不算通关、其他 > 0）
// - 解锁判定：ChallengeScreen::MoreTrophiesNeeded / AccomplishmentsNeeded
// 游戏不单独记录“某关已解锁”，而是按已通关的数量依次解锁，所以“解锁某关”= 把它前面的关卡标记为通关。

import { getFlag, type PlayerData, type PlayerFlag } from './player-data'

export type ChallengePage = 'minigames' | 'puzzles' | 'survival'
export type ChallengeKind = 'level' | 'survivalNormal' | 'survivalHard' | 'endless'

export interface ChallengeDef {
  mode: number
  page: ChallengePage
  /** 在页面上的位置（row × 5 + col），解锁规则用 */
  slot: number
  /** LawnStrings 中的名字键，同时用作 i18n 键 */
  key: string
  kind: ChallengeKind
  /** 缩略图在图集里的格子：生存用 IMAGE_SURVIVAL_THUMBNAILS，其余用 IMAGE_CHALLENGE_THUMBNAILS（gChallengeDefs mChallengeIconIndex） */
  icon: number
  /** 解谜的两个系列各自按完成数解锁 */
  series?: 'vasebreaker' | 'izombie'
}

const SURVIVAL_AREAS = ['DAY', 'NIGHT', 'POOL', 'FOG', 'ROOF'] as const

/** 小游戏：名字键与缩略图格子 */
const MINIGAMES: [string, number][] = [
  ['WAR_AND_PEAS', 0], ['WALL_NUT_BOWLING', 6], ['SLOT_MACHINE', 2], ['ITS_RAINING_SEEDS', 3], ['BEGHOULED', 1],
  ['INVISIGHOUL', 8], ['SEEING_STARS', 5], ['ZOMBIQUARIUM', 7], ['BEGHOULED_TWIST', 20], ['LITTLE_TROUBLE', 12],
  ['PORTAL_COMBAT', 15], ['COLUMN_AS_YOU_SEE_EM', 4], ['BOBSLED_BONANZA', 17], ['ZOMBIES_ON_SPEED', 18], ['WHACK_A_ZOMBIE', 16],
  ['LAST_STAND', 21], ['WAR_AND_PEAS_2', 0], ['WALL_NUT_BOWLING_EXTREME', 6], ['POGO_PARTY', 14], ['FINAL_BOSS', 19],
]
const ICON_VASEBREAKER = 10
const ICON_IZOMBIE = 11

export const SURVIVAL_NORMAL_FLAGS = 5
export const SURVIVAL_HARD_FLAGS = 10

export const CHALLENGES: ChallengeDef[] = [
  ...SURVIVAL_AREAS.map((area, i): ChallengeDef => ({ mode: 1 + i, page: 'survival', slot: i, key: `SURVIVAL_${area}_NORMAL`, kind: 'survivalNormal', icon: i })),
  ...SURVIVAL_AREAS.map((area, i): ChallengeDef => ({ mode: 6 + i, page: 'survival', slot: 5 + i, key: `SURVIVAL_${area}_HARD`, kind: 'survivalHard', icon: 5 + i })),
  // 生存页上只有泳池无尽，其余四个无尽在隐藏页
  { mode: 13, page: 'survival', slot: 12, key: 'SURVIVAL_POOL_ENDLESS', kind: 'endless', icon: 10 },
  ...MINIGAMES.map(([key, icon], i): ChallengeDef => ({ mode: 16 + i, page: 'minigames', slot: i, key, kind: 'level', icon })),
  ...Array.from({ length: 9 }, (_, i): ChallengeDef => ({ mode: 51 + i, page: 'puzzles', slot: i, key: `SCARY_POTTER_${i + 1}`, kind: 'level', icon: ICON_VASEBREAKER, series: 'vasebreaker' })),
  { mode: 60, page: 'puzzles', slot: 9, key: 'SCARY_POTTER_ENDLESS', kind: 'endless', icon: ICON_VASEBREAKER, series: 'vasebreaker' },
  ...Array.from({ length: 9 }, (_, i): ChallengeDef => ({ mode: 61 + i, page: 'puzzles', slot: 10 + i, key: `I_ZOMBIE_${i + 1}`, kind: 'level', icon: ICON_IZOMBIE, series: 'izombie' })),
  { mode: 70, page: 'puzzles', slot: 19, key: 'I_ZOMBIE_ENDLESS', kind: 'endless', icon: ICON_IZOMBIE, series: 'izombie' },
]

export const CHALLENGE_PAGES: ChallengePage[] = ['minigames', 'puzzles', 'survival']

/** 各模式入口（主菜单按钮）是否已解锁的标志位 */
export const PAGE_FLAG: Record<ChallengePage, PlayerFlag> = {
  minigames: 'hasUnlockedMinigames',
  puzzles: 'hasUnlockedPuzzleMode',
  survival: 'hasUnlockedSurvivalMode',
}

/** 智慧树高度记录在“智慧树”模式的记录里 */
export const TREE_OF_WISDOM_MODE = 50

export function record(data: PlayerData, mode: number): number {
  return data.challengeRecords[mode - 1] ?? 0
}

export function isBeaten(data: PlayerData, def: ChallengeDef): boolean {
  const value = record(data, def.mode)
  if (def.kind === 'survivalNormal') return value >= SURVIVAL_NORMAL_FLAGS
  if (def.kind === 'survivalHard') return value >= SURVIVAL_HARD_FLAGS
  if (def.kind === 'endless') return false
  return value > 0
}

/** 标记 / 取消通关；无尽模式没有通关概念，不处理 */
export function setBeaten(data: PlayerData, def: ChallengeDef, beaten: boolean) {
  if (def.kind === 'endless') return
  const threshold = def.kind === 'survivalNormal' ? SURVIVAL_NORMAL_FLAGS : def.kind === 'survivalHard' ? SURVIVAL_HARD_FLAGS : 1
  const index = def.mode - 1
  if (beaten) data.challengeRecords[index] = Math.max(data.challengeRecords[index] ?? 0, threshold)
  else data.challengeRecords[index] = 0
}

export function countBeaten(data: PlayerData, page: ChallengePage): number {
  return CHALLENGES.filter(def => def.page === page && isBeaten(data, def)).length
}

export function isUnlocked(data: PlayerData, def: ChallengeDef): boolean {
  const finished = data.finishedAdventure > 0
  if (def.series) {
    const series = CHALLENGES.filter(item => item.series === def.series)
    const completed = series.filter(item => isBeaten(data, item)).length
    const position = series.indexOf(def)
    // 冒险没通关时，系列第 4 关起锁住
    if (position >= 3 && !finished && completed >= 3) return false
    return position - completed <= 0
  }
  if (!finished) return def.slot < 3
  const trophies = countBeaten(data, def.page)
  if (def.kind === 'endless') return trophies >= 10
  return def.slot < trophies + 3
}

export function isPageUnlocked(data: PlayerData, page: ChallengePage): boolean {
  return getFlag(data, PAGE_FLAG[page])
}

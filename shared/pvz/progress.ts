// 由用户数据推导的进度信息（与 PvZ-Portable 的 LawnApp 判定一致）。

import type { PlayerDetails } from './userdata'

export const ADVENTURE_LEVELS = 50
export const ADVENTURE_AREAS = ['day', 'night', 'pool', 'fog', 'roof'] as const
export type AdventureArea = (typeof ADVENTURE_AREAS)[number]

/** 当前冒险关卡所在的场景（1-x 白天 … 5-x 屋顶） */
export function adventureArea(level: number): AdventureArea {
  const index = Math.min(Math.max(Math.floor((level - 1) / 10), 0), ADVENTURE_AREAS.length - 1)
  return ADVENTURE_AREAS[index]!
}

/** 本周目冒险进度 0..1 */
export function adventureProgress(level: number): number {
  return Math.min(Math.max((level - 1) / ADVENTURE_LEVELS, 0), 1)
}

// 奖杯（金向日葵需要全部 48 个）：LawnApp::HasBeatenChallenge / GetNumTrophies
const SURVIVAL_NORMAL = [1, 2, 3, 4, 5]
const SURVIVAL_HARD = [6, 7, 8, 9, 10]
const SURVIVAL_NORMAL_FLAGS = 5
const SURVIVAL_HARD_FLAGS = 10
/** “小游戏”页的 20 个模式（GAMEMODE_CHALLENGE_WAR_AND_PEAS … FINAL_BOSS） */
const MINIGAMES = Array.from({ length: 20 }, (_, i) => 16 + i)
/** 解谜页：砸罐子 1–9、我是僵尸 1–9（无尽不计） */
const PUZZLES = [...Array.from({ length: 9 }, (_, i) => 51 + i), ...Array.from({ length: 9 }, (_, i) => 61 + i)]

export interface TrophyCounts {
  survival: number
  minigames: number
  puzzles: number
}

export const TROPHY_TOTALS: TrophyCounts = { survival: 10, minigames: 20, puzzles: 18 }

export function countTrophies(details: Pick<PlayerDetails, 'challengeRecords'>): TrophyCounts {
  const record = (mode: number) => details.challengeRecords[mode - 1] ?? 0
  return {
    survival: SURVIVAL_NORMAL.filter(mode => record(mode) >= SURVIVAL_NORMAL_FLAGS).length
      + SURVIVAL_HARD.filter(mode => record(mode) >= SURVIVAL_HARD_FLAGS).length,
    minigames: MINIGAMES.filter(mode => record(mode) > 0).length,
    puzzles: PUZZLES.filter(mode => record(mode) > 0).length,
  }
}

/** 金向日葵：通关冒险且拿到全部奖杯 */
export function hasGoldTrophy(details: Pick<PlayerDetails, 'finishedAdventure'>, trophies: TrophyCounts): boolean {
  return details.finishedAdventure > 0
    && trophies.survival + trophies.minigames + trophies.puzzles >= TROPHY_TOTALS.survival + TROPHY_TOTALS.minigames + TROPHY_TOTALS.puzzles
}

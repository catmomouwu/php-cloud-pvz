// 图鉴里“已遇到”的植物和僵尸。游戏不单独记录，而是由冒险进度和商店购买推导（与 PvZ-Portable 一致）：
// - 植物：LawnApp::HasSeedType / GetSeedsAvailable / GetAwardSeedForLevel
// - 僵尸：AlmanacDialog::ZombieIsShown / ZombieHasSilhouette，首次出现关卡见 Zombie.cpp gZombieDefs

import type { PlayerData } from './player-data'
import { STORE_ITEM, STORE_PLANTS } from './store'

/** SEED_GATLINGPEA：从这里起是商店植物 */
const FIRST_STORE_SEED = 40
const ALL_SEEDS = 49
const ADVENTURE_LEVELS = 50

/** 打到第 level 关时已拿到的植物数（GetAwardSeedForLevel） */
function seedsAwardedBefore(level: number): number {
  const area = Math.floor((level - 1) / 10) + 1
  const sub = (level - 1) % 10 + 1
  let count = (area - 1) * 8 + sub
  if (sub >= 10) count -= 2
  else if (sub >= 5) count -= 1
  return Math.min(count, FIRST_STORE_SEED)
}

/** 第 seed 种植物（SeedType，顺序同图鉴）是否已拥有 */
export function hasSeed(data: PlayerData, seed: number): boolean {
  if (seed >= FIRST_STORE_SEED) return (data.purchases[STORE_ITEM[STORE_PLANTS[seed - FIRST_STORE_SEED]!]] ?? 0) > 0
  const available = data.finishedAdventure > 0 || data.level > ADVENTURE_LEVELS ? ALL_SEEDS : seedsAwardedBefore(data.level)
  return seed < available
}

/** 各僵尸（ZombieType，顺序同图鉴）首次出现的冒险关卡 */
const ZOMBIE_STARTING_LEVELS = [1, 1, 3, 6, 8, 11, 13, 16, 18, 18, 21, 23, 26, 26, 28, 31, 33, 36, 38, 40, 41, 43, 46, 48, 48, 50]
const ZOMBIE_YETI = 19
/** 伴舞、雪橇小队、小鬼只随其他僵尸出现：首次出现的那关还没打过时不显示 */
const SPAWNED_ONLY = new Set([9, 13, 24])

export type ZombieDiscovery = 'shown' | 'silhouette' | 'hidden'

export function zombieDiscovery(data: PlayerData, zombie: number): ZombieDiscovery {
  const finished = data.finishedAdventure > 0
  const start = ZOMBIE_STARTING_LEVELS[zombie] ?? Infinity
  if (zombie === ZOMBIE_YETI) {
    // 雪人僵尸要二周目打到第 40 关（或三周目起）才会出现，此前只显示剪影
    const canSpawn = finished && (data.finishedAdventure >= 2 || data.level >= start)
    if (canSpawn) return 'shown'
    return finished || data.level > start ? 'silhouette' : 'hidden'
  }
  if (finished) return 'shown'
  return start < data.level || (start === data.level && !SPAWNED_ONLY.has(zombie)) ? 'shown' : 'hidden'
}

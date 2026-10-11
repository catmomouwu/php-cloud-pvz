// 存档编辑器的批量修改（概览页的快捷操作），都直接改传入的 PlayerData。
// 写入的值与游戏自己产生的一致（StoreScreen::PurchaseItem 等），避免出现游戏里不会有的状态。

import { CHALLENGES, CHALLENGE_PAGES, PAGE_FLAG, setBeaten, TREE_OF_WISDOM_MODE } from './challenges'
import { type PlayerData, setFlag } from './player-data'
import { MAX_PACKET_UPGRADES, MAX_RAKE_USES, purchasedValue, STORE_ITEM, STORE_PLANTS, STORE_UPGRADES } from './store'

/** 金币上限（界面显示为 × 10，即 $999,990，与游戏金币栏能显示的位数一致） */
export const MAX_COINS = 99_999

export const ADVENTURE_LEVEL_COUNT = 50

/** 通关冒险：与游戏打完 5-10 后一样，周目数 +1、关卡回到 1-1；已通关过则不变 */
export function finishAdventure(data: PlayerData) {
  if (data.finishedAdventure > 0) return
  data.finishedAdventure = 1
  data.level = 1
}

export function unlockAllModes(data: PlayerData) {
  for (const page of CHALLENGE_PAGES) setFlag(data, PAGE_FLAG[page], true)
}

/** 所有小游戏、解谜、生存关卡标记为通关（已有更好的纪录则保留） */
export function beatAllChallenges(data: PlayerData) {
  for (const def of CHALLENGES) setBeaten(data, def, true)
}

/** 买下全部商店植物、卡槽升级、一次性工具和耙子（消耗品不动） */
export function buyAllStoreItems(data: PlayerData, now = Math.floor(Date.now() / 1000)) {
  for (const key of STORE_PLANTS) data.purchases[STORE_ITEM[key]] = 1
  for (const key of STORE_UPGRADES) {
    const index = STORE_ITEM[key]
    if (data.purchases[index]) continue
    data.purchases[index] = purchasedValue(key, now)
    if (key === 'treeOfWisdom' && !data.challengeRecords[TREE_OF_WISDOM_MODE - 1]) data.challengeRecords[TREE_OF_WISDOM_MODE - 1] = 1
  }
  data.purchases[STORE_ITEM.packetUpgrade] = MAX_PACKET_UPGRADES
  if (!data.purchases[STORE_ITEM.rake]) data.purchases[STORE_ITEM.rake] = MAX_RAKE_USES
}

export function maxCoins(data: PlayerData) {
  data.coins = MAX_COINS
}

/** 一键解锁全部：通关冒险、开启全部模式、全部挑战通关、买下商店全部物品（成就不动，由游戏自己判定） */
export function unlockEverything(data: PlayerData) {
  finishAdventure(data)
  unlockAllModes(data)
  beatAllChallenges(data)
  buyAllStoreItems(data)
}

/** 重置进度：回到刚创建用户的状态，但保留禅境花园、成就和僵尸头像等数据 */
export function resetProgress(data: PlayerData) {
  data.level = 1
  data.coins = 0
  data.finishedAdventure = 0
  // 智慧树高度也记在挑战记录里，属于禅境花园，保留
  const tree = data.challengeRecords[TREE_OF_WISDOM_MODE - 1] ?? 0
  data.challengeRecords.fill(0)
  data.challengeRecords[TREE_OF_WISDOM_MODE - 1] = tree
  for (const page of CHALLENGE_PAGES) setFlag(data, PAGE_FLAG[page], false)
}

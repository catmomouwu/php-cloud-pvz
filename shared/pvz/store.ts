// 戴夫商店的购买记录（PlayerInfo::mPurchases，下标 = StoreItem，见 PvZ-Portable ConstEnums.h）。
// 记录值的含义因物品而异（StoreScreen::IsItemSoldOut 等）：
// - 一次性物品：非 0 即已购买；蜗牛记录的是时间戳，金盏花记录的是购买当天的日期；
// - 消耗品：PURCHASE_COUNT_OFFSET + 剩余数量（未买过为 0）；
// - 卡槽升级、额外小推车：购买次数。

export const PURCHASE_COUNT_OFFSET = 1000

export const STORE_ITEM = {
  plantGatlingPea: 0,
  plantTwinSunflower: 1,
  plantGloomShroom: 2,
  plantCattail: 3,
  plantWinterMelon: 4,
  plantGoldMagnet: 5,
  plantSpikerock: 6,
  plantCobCannon: 7,
  plantImitater: 8,
  bonusLawnMower: 9,
  pottedMarigold1: 10,
  pottedMarigold2: 11,
  pottedMarigold3: 12,
  goldWateringCan: 13,
  fertilizer: 14,
  bugSpray: 15,
  phonograph: 16,
  gardeningGlove: 17,
  mushroomGarden: 18,
  wheelBarrow: 19,
  stinkyTheSnail: 20,
  packetUpgrade: 21,
  poolCleaner: 22,
  roofCleaner: 23,
  rake: 24,
  aquariumGarden: 25,
  chocolate: 26,
  treeOfWisdom: 27,
  treeFood: 28,
  firstAid: 29,
} as const

export type StoreItemKey = keyof typeof STORE_ITEM

/** 9 种商店植物，与 SEED_GATLINGPEA … SEED_IMITATER 一一对应 */
export const STORE_PLANTS: StoreItemKey[] = [
  'plantGatlingPea', 'plantTwinSunflower', 'plantGloomShroom', 'plantCattail', 'plantWinterMelon',
  'plantGoldMagnet', 'plantSpikerock', 'plantCobCannon', 'plantImitater',
]

/** 只能买一次的工具与升级 */
export const STORE_UPGRADES: StoreItemKey[] = [
  'poolCleaner', 'roofCleaner', 'firstAid', 'goldWateringCan', 'phonograph', 'gardeningGlove',
  'mushroomGarden', 'aquariumGarden', 'wheelBarrow', 'treeOfWisdom', 'stinkyTheSnail',
]

/** 消耗品及商店里能买到的上限 */
export const STORE_CONSUMABLES: { key: StoreItemKey, max: number }[] = [
  { key: 'fertilizer', max: 20 },
  { key: 'bugSpray', max: 20 },
  { key: 'chocolate', max: 10 },
  { key: 'treeFood', max: 10 },
]

export const MAX_PACKET_UPGRADES = 4
export const BASE_SEED_SLOTS = 6
export const MAX_RAKE_USES = 3

export function consumableCount(value: number): number {
  return Math.max(value - PURCHASE_COUNT_OFFSET, 0)
}

/** 写回消耗品数量；从没买过且数量为 0 时保持 0（游戏据此判断是否首次获得） */
export function consumableValue(previous: number, count: number): number {
  if (count <= 0 && previous < PURCHASE_COUNT_OFFSET) return previous
  return PURCHASE_COUNT_OFFSET + Math.max(count, 0)
}

/** 购买一次性物品时写入的值，与 StoreScreen::PurchaseItem 一致 */
export function purchasedValue(key: StoreItemKey, now = Math.floor(Date.now() / 1000)): number {
  return key === 'stinkyTheSnail' ? Math.max(now, 1) : 1
}

/** 商店里各物品的图标（StoreScreen::DrawItemIcon 用到的图片资源） */
export const STORE_ICONS: Partial<Record<StoreItemKey, string>> = {
  packetUpgrade: 'IMAGE_STORE_PACKETUPGRADE',
  poolCleaner: 'IMAGE_ICON_POOLCLEANER',
  roofCleaner: 'IMAGE_ICON_ROOFCLEANER',
  rake: 'IMAGE_ICON_RAKE',
  firstAid: 'IMAGE_STORE_FIRSTAIDWALLNUTICON',
  goldWateringCan: 'IMAGE_WATERINGCANGOLD',
  phonograph: 'IMAGE_PHONOGRAPH',
  gardeningGlove: 'IMAGE_ZEN_GARDENGLOVE',
  mushroomGarden: 'IMAGE_STORE_MUSHROOMGARDENICON',
  aquariumGarden: 'IMAGE_STORE_AQUARIUMGARDENICON',
  wheelBarrow: 'IMAGE_ZEN_WHEELBARROW',
  treeOfWisdom: 'IMAGE_STORE_TREEOFWISDOMICON',
  stinkyTheSnail: 'IMAGE_REANIM_STINKY_TURN3',
  fertilizer: 'IMAGE_FERTILIZER',
  bugSpray: 'IMAGE_BUG_SPRAY',
  chocolate: 'IMAGE_CHOCOLATE',
  treeFood: 'IMAGE_TREEFOOD',
}

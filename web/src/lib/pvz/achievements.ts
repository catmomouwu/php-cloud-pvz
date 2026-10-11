// 成就列表，顺序与 PvZ-Portable 的 AchievementId / user{id}.dat 末尾的 20 个 u16 一致。
// 名字和描述放在 i18n 的 achievements.items.<key> 下；图标来自 pak 里的 IMAGE_ACHEESEMENTS_ICONS，
// 是 70×70 的格子、每行 7 个，第 i 个成就取第 i 格。

export const ACHIEVEMENT_KEYS = [
  'homeLawnSecurity',
  'nobelPeasPrize',
  'betterOffDead',
  'chinaShop',
  'spudow',
  'explodonator',
  'morticulturalist',
  'dontPeaInThePool',
  'rollSomeHeads',
  'grounded',
  'zombologist',
  'pennyPincher',
  'sunnyDays',
  'popcornParty',
  'goodMorning',
  'noFungusAmongUs',
  'beyondTheGrave',
  'immortal',
  'toweringWisdom',
  'mustacheMode',
] as const

export type AchievementKey = typeof ACHIEVEMENT_KEYS[number]

export const ACHIEVEMENT_ICONS_IMAGE = 'IMAGE_ACHEESEMENTS_ICONS'
export const ACHIEVEMENT_ICON_SIZE = 70
const ICONS_PER_ROW = 7

/** 第 index 个成就图标在图集里的左上角 */
export function achievementIconOrigin(index: number): [number, number] {
  return [ACHIEVEMENT_ICON_SIZE * (index % ICONS_PER_ROW), ACHIEVEMENT_ICON_SIZE * Math.floor(index / ICONS_PER_ROW)]
}

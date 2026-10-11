// 禅境花园的盆栽（PlayerInfo::mPottedPlant，每盆 88 字节，字段见 PvZ-Portable PlayerInfo.h PottedPlant）。
// 编辑器只改种类、所在花园、位置、生长阶段和照料时间，其余字节原样保留。
// 花园格子：主花园 8 × 4、蘑菇园和水族馆各 8 格（gMushroomGridPlacement / gAquariumGridPlacement）、手推车 1 格。

import type { PlayerData } from './player-data'
import { STORE_ITEM } from './store'

export type GardenKind = 'main' | 'mushroom' | 'wheelbarrow' | 'aquarium'
/** GardenType 枚举值 */
const GARDEN_VALUE: Record<GardenKind, number> = { main: 0, mushroom: 1, wheelbarrow: 2, aquarium: 3 }
export const GARDENS: GardenKind[] = ['main', 'mushroom', 'aquarium', 'wheelbarrow']

/** 每个花园的格子（x, y） */
export function gardenSpots(garden: GardenKind): [number, number][] {
  if (garden === 'main') return Array.from({ length: 32 }, (_, i) => [i % 8, Math.floor(i / 8)])
  if (garden === 'wheelbarrow') return [[0, 0]]
  return Array.from({ length: 8 }, (_, i) => [i, 0])
}

/** 需要先在商店买下的花园 */
export const GARDEN_PURCHASE: Partial<Record<GardenKind, keyof typeof STORE_ITEM>> = {
  mushroom: 'mushroomGarden',
  aquarium: 'aquariumGarden',
  wheelbarrow: 'wheelBarrow',
}

export const PLANT_AGES = ['sprout', 'small', 'medium', 'full'] as const
export type PlantAge = typeof PLANT_AGES[number]

const SEED_LILYPAD = 16
const SEED_TANGLEKELP = 19
const SEED_SEASHROOM = 24
const SEED_CATTAIL = 43
const SEED_FLOWERPOT = 33
const SEED_MARIGOLD = 38
const AQUATIC = new Set([SEED_LILYPAD, SEED_TANGLEKELP, SEED_SEASHROOM, SEED_CATTAIL])

export const SEED_MARIGOLD_INDEX = SEED_MARIGOLD

/** 金盏花的 11 种花瓣颜色（ReanimatorCache::UpdateReanimationForVariation），对应 VARIATION_MARIGOLD_WHITE … LIGHT_GREEN */
export const MARIGOLD_COLORS: [number, number, number][] = [
  [255, 255, 255], [230, 30, 195], [250, 125, 5], [255, 145, 215], [160, 255, 245], [230, 30, 30],
  [5, 130, 255], [195, 55, 235], [235, 210, 255], [255, 245, 55], [180, 255, 105],
]
const FIRST_MARIGOLD_VARIATION = 2

function marigoldColorOf(seed: number, variation: number): number | null {
  if (seed !== SEED_MARIGOLD) return null
  const index = variation - FIRST_MARIGOLD_VARIATION
  return index >= 0 && index < MARIGOLD_COLORS.length ? index : 0
}

export function isAquatic(seed: number): boolean {
  return AQUATIC.has(seed)
}

/** 能出现在花园里的植物：前 40 种里除了花盆（与 ZenGarden::PickRandomSeedType 及商店金盏花一致） */
export const ZEN_SEEDS = Array.from({ length: 40 }, (_, i) => i).filter(seed => seed !== SEED_FLOWERPOT)

/** 水族馆只能放水生植物 */
export function canPlace(seed: number, garden: GardenKind): boolean {
  return garden !== 'aquarium' || AQUATIC.has(seed)
}

export interface PottedPlantView {
  index: number
  seed: number
  garden: GardenKind
  x: number
  y: number
  age: PlantAge
  facingLeft: boolean
  /** 金盏花的颜色（MARIGOLD_COLORS 下标）；其他植物为 null */
  marigoldColor: number | null
}

const OFFSET = {
  seed: 0,
  garden: 4,
  x: 8,
  y: 12,
  facing: 16,
  lastWateredTime: 24,
  drawVariation: 32,
  age: 36,
  timesFed: 40,
  feedingsPerGrow: 44,
  plantNeed: 48,
  lastNeedFulfilledTime: 56,
} as const

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
const gardenOf = (value: number): GardenKind => (Object.entries(GARDEN_VALUE).find(([, v]) => v === value)?.[0] as GardenKind | undefined) ?? 'main'

export function readPottedPlant(bytes: Uint8Array, index: number): PottedPlantView {
  const dv = view(bytes)
  return {
    index,
    seed: dv.getInt32(OFFSET.seed, true),
    garden: gardenOf(dv.getInt32(OFFSET.garden, true)),
    x: dv.getInt32(OFFSET.x, true),
    y: dv.getInt32(OFFSET.y, true),
    age: PLANT_AGES[dv.getInt32(OFFSET.age, true)] ?? 'sprout',
    facingLeft: dv.getInt32(OFFSET.facing, true) === 1,
    marigoldColor: marigoldColorOf(dv.getInt32(OFFSET.seed, true), dv.getInt32(OFFSET.drawVariation, true)),
  }
}

export function listPottedPlants(data: PlayerData): PottedPlantView[] {
  return data.pottedPlants.map((bytes, index) => readPottedPlant(bytes, index))
}

export function freeSpots(data: PlayerData, garden: GardenKind): [number, number][] {
  const taken = new Set(listPottedPlants(data).filter(plant => plant.garden === garden).map(plant => `${plant.x},${plant.y}`))
  return gardenSpots(garden).filter(([x, y]) => !taken.has(`${x},${y}`))
}

export function isGardenOwned(data: PlayerData, garden: GardenKind): boolean {
  const item = GARDEN_PURCHASE[garden]
  return !item || (data.purchases[STORE_ITEM[item]] ?? 0) > 0
}

/** 复制一份再改、整体替换回去：界面的响应式追踪不到字节数组的原地修改 */
function editPlant(data: PlayerData, index: number, change: (dv: DataView) => void): boolean {
  const original = data.pottedPlants[index]
  if (!original) return false
  const bytes = original.slice()
  change(view(bytes))
  data.pottedPlants[index] = bytes
  return true
}

const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

/** 与 PottedPlant::InitializePottedPlant 一致：随机朝向、3～5 次浇水长大一级；金盏花随机颜色 */
export function addPottedPlant(data: PlayerData, seed: number, garden: GardenKind): boolean {
  const spot = freeSpots(data, garden)[0]
  if (!spot || !canPlace(seed, garden)) return false
  const bytes = new Uint8Array(88)
  const dv = view(bytes)
  dv.setInt32(OFFSET.seed, seed, true)
  dv.setInt32(OFFSET.garden, GARDEN_VALUE[garden], true)
  dv.setInt32(OFFSET.x, spot[0], true)
  dv.setInt32(OFFSET.y, spot[1], true)
  dv.setInt32(OFFSET.facing, randomInt(0, 1), true)
  // VARIATION_MARIGOLD_WHITE … VARIATION_MARIGOLD_LIGHT_GREEN
  dv.setInt32(OFFSET.drawVariation, seed === SEED_MARIGOLD ? randomInt(2, 12) : 0, true)
  dv.setInt32(OFFSET.feedingsPerGrow, randomInt(3, 5), true)
  data.pottedPlants.push(bytes)
  return true
}

export function removePottedPlant(data: PlayerData, index: number) {
  data.pottedPlants.splice(index, 1)
}

/** 搬到另一个花园的空位；没有空位或不能放时返回 false */
export function movePottedPlant(data: PlayerData, index: number, garden: GardenKind): boolean {
  const bytes = data.pottedPlants[index]
  if (!bytes) return false
  const plant = readPottedPlant(bytes, index)
  const spot = freeSpots(data, garden)[0]
  if (plant.garden === garden || !spot || !canPlace(plant.seed, garden)) return false
  return editPlant(data, index, (dv) => {
    dv.setInt32(OFFSET.garden, GARDEN_VALUE[garden], true)
    dv.setInt32(OFFSET.x, spot[0], true)
    dv.setInt32(OFFSET.y, spot[1], true)
  })
}

/** 改生长阶段：重新开始这一阶段的浇水计数，清掉旧的需求 */
export function setPlantAge(data: PlayerData, index: number, age: PlantAge) {
  editPlant(data, index, (dv) => {
    dv.setInt32(OFFSET.age, PLANT_AGES.indexOf(age), true)
    dv.setInt32(OFFSET.timesFed, 0, true)
    dv.setInt32(OFFSET.plantNeed, 0, true)
  })
}

/** 改金盏花的颜色 */
export function setMarigoldColor(data: PlayerData, index: number, color: number) {
  editPlant(data, index, (dv) => {
    dv.setInt32(OFFSET.drawVariation, FIRST_MARIGOLD_VARIATION + color, true)
  })
}

/**
 * 今天都已照料：需求由游戏按时间实时计算（ZenGarden::GetPlantsNeed），存档里没有可直接改的“当前需求”。
 * 把“上次满足需求”的时间设为现在，游戏会认为今天的需求都已满足。
 */
export function careForAll(data: PlayerData, now = Math.floor(Date.now() / 1000)) {
  data.pottedPlants.forEach((_, index) => editPlant(data, index, (dv) => {
    dv.setBigInt64(OFFSET.lastNeedFulfilledTime, BigInt(now), true)
    dv.setInt32(OFFSET.plantNeed, 0, true)
  }))
}

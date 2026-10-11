// 禅境花园场景：背景 + 花盆 + 盆栽，坐标与 PvZ-Portable 一致（800 × 600 画面）。
// - 格子像素位置：ZenGarden.cpp gGreenhouseGridPlacement / gMushroomGridPlacement / gAquariumGridPlacement
// - 植物位置与缩放：Plant::UpdateReanim（绘制高度、朝左镜像、生长阶段 0.5 / 0.75 / 1 倍）
//   + ZenGarden::PlantPottedDrawHeightOffset；花盆用 Pot.reanim 的 anim_zengarden / anim_waterplants
// 只画静态的第一帧。

import { canPlace, type GardenKind, isAquatic, MARIGOLD_COLORS, type PottedPlantView } from '@shared/pvz/zen-garden'
import { PLANTS } from './almanac-entities'
import { type AlmanacAssets, createEntityAnimation } from './almanac-render'
import type { ImageLoader } from './images'

export const SCENE_WIDTH = 800
export const SCENE_HEIGHT = 600

export type SceneGarden = Exclude<GardenKind, 'wheelbarrow'>

const BACKGROUNDS: Record<SceneGarden, string> = {
  main: 'IMAGE_BACKGROUND_GREENHOUSE',
  mushroom: 'IMAGE_BACKGROUND_MUSHROOMGARDEN',
  aquarium: 'IMAGE_AQUARIUM1',
}

/** [像素 x, 像素 y]，按 (gridY × 8 + gridX) 排列 */
const MAIN_SPOTS: [number, number][] = [
  [73, 73], [155, 71], [239, 68], [321, 73], [406, 71], [484, 67], [566, 70], [648, 72],
  [67, 168], [150, 165], [232, 170], [314, 175], [416, 173], [497, 170], [578, 164], [660, 168],
  [41, 268], [130, 266], [219, 260], [310, 266], [416, 267], [504, 261], [594, 265], [684, 269],
  [37, 371], [124, 369], [211, 368], [302, 369], [425, 375], [512, 368], [602, 365], [691, 368],
]
const MUSHROOM_SPOTS: [number, number][] = [[110, 441], [237, 360], [298, 458], [355, 296], [387, 203], [460, 385], [486, 478], [552, 283]]
const AQUARIUM_SPOTS: [number, number][] = [[113, 185], [306, 120], [356, 270], [622, 120], [669, 270], [122, 355], [365, 458], [504, 417]]

function spotOf(garden: SceneGarden, x: number, y: number): [number, number] | null {
  if (garden === 'main') return MAIN_SPOTS[y * 8 + x] ?? null
  return (garden === 'mushroom' ? MUSHROOM_SPOTS : AQUARIUM_SPOTS)[x] ?? null
}

const SEED_PEASHOOTER = 0
const SEED_SUNFLOWER = 1
const SEED_POTATOMINE = 4
const SEED_SNOWPEA = 5
const SEED_CHOMPER = 6
const SEED_REPEATER = 7
const SEED_PUFFSHROOM = 8
const SEED_SUNSHROOM = 9
const SEED_GRAVEBUSTER = 11
const SEED_HYPNOSHROOM = 12
const SEED_SCAREDYSHROOM = 13
const SEED_LILYPAD = 16
const SEED_THREEPEATER = 18
const SEED_TANGLEKELP = 19
const SEED_SPIKEWEED = 21
const SEED_TORCHWOOD = 22
const SEED_SEASHROOM = 24
const SEED_PLANTERN = 25
const SEED_BLOVER = 27
const SEED_STARFRUIT = 29
const SEED_PUMPKIN = 30
const SEED_MAGNETSHROOM = 31
const SEED_CABBAGEPULT = 32
const SEED_MARIGOLD = 38
const SEED_MELONPULT = 39

/** 放进花盆后的高度修正（PlantFlowerPotHeightOffset，花盆缩放为 1） */
function flowerPotOffset(seed: number): number {
  if (seed === SEED_CHOMPER || seed === SEED_PLANTERN) return -10
  if (seed === SEED_SCAREDYSHROOM) return 0
  return -5
}

/** ZenGarden::PlantPottedDrawHeightOffset：[高度, 随缩放的修正] */
const POTTED_OFFSETS: Record<number, [number, number]> = {
  [SEED_GRAVEBUSTER]: [50, 15],
  [SEED_PUFFSHROOM]: [10, 24],
  [SEED_SUNSHROOM]: [10, 17],
  [SEED_SCAREDYSHROOM]: [5, 5],
  [SEED_TANGLEKELP]: [-18, 20],
  [SEED_SEASHROOM]: [-20, 15],
  [SEED_LILYPAD]: [-10, 30],
  [SEED_HYPNOSHROOM]: [0, 10],
  [SEED_MARIGOLD]: [0, 10],
  [SEED_PEASHOOTER]: [0, 10],
  [SEED_REPEATER]: [0, 10],
  [SEED_SNOWPEA]: [0, 10],
  [SEED_THREEPEATER]: [0, 10],
  [SEED_SUNFLOWER]: [0, 10],
  [SEED_STARFRUIT]: [10, 24],
  [SEED_CABBAGEPULT]: [3, 10],
  [SEED_MELONPULT]: [3, 10],
  [SEED_POTATOMINE]: [0, 5],
  [SEED_TORCHWOOD]: [0, 3],
  [SEED_SPIKEWEED]: [-13, 10],
  [SEED_BLOVER]: [0, 10],
  [SEED_PUMPKIN]: [0, 20],
  [SEED_PLANTERN]: [0, -1],
  [SEED_MAGNETSHROOM]: [0, 0],
}

function pottedOffset(seed: number, scale: number): number {
  const [height, fix] = POTTED_OFFSETS[seed] ?? [0, 0]
  return height + (fix * scale - fix)
}

/** 生长阶段：[x 偏移, y 偏移, 缩放]（Plant::UpdateReanim 动画结束时的值） */
const AGE_TRANSFORM = { sprout: [0, 0, 1], small: [20, 40, 0.5], medium: [10, 20, 0.75], full: [0, 0, 1] } as const

/** 花园里是否带花盆：主花园都有；蘑菇园只有水生植物有；水族馆没有 */
function needsPot(garden: SceneGarden, seed: number): boolean {
  if (garden === 'main') return true
  if (garden === 'mushroom') return isAquatic(seed)
  return false
}

async function drawPlant(ctx: CanvasRenderingContext2D, assets: AlmanacAssets, garden: SceneGarden, plant: PottedPlantView, base: DOMMatrix) {
  const spot = spotOf(garden, plant.x, plant.y)
  if (!spot || !canPlace(plant.seed, garden)) return
  const [px, py] = spot
  const pot = needsPot(garden, plant.seed)
  const aquatic = isAquatic(plant.seed)

  if (pot) {
    const potAnimation = await createEntityAnimation({ file: 'Pot', clip: aquatic ? 'anim_waterplants' : 'anim_zengarden' }, assets, 0)
    potAnimation.draw(ctx, base.translate(px, py + 26))
  }

  const sprout = plant.age === 'sprout'
  const entity = PLANTS[plant.seed]
  if (!entity) return
  const animation = sprout
    ? await createEntityAnimation({ file: 'ZenGarden_sprout', clip: plant.seed === SEED_MARIGOLD ? 'anim_idle' : 'anim_idle_noflower' }, assets, 0)
    : await createEntityAnimation({
        ...entity,
        colors: plant.marigoldColor === null ? undefined : [{ match: 'Marigold_petals', exact: true, color: MARIGOLD_COLORS[plant.marigoldColor]! }],
        // 水族馆里的缠绕水草、海蘑菇用专门的水下动作
        clip: garden === 'aquarium' && (plant.seed === SEED_TANGLEKELP || plant.seed === SEED_SEASHROOM) ? 'anim_idle_aquarium' : entity.clip,
      }, assets, 0)

  // 绘制高度：图鉴配置里的 ox / oy / s 就是 PlantDrawHeightOffset 与土豆雷、咖啡豆的缩放
  let offsetX = sprout ? 0 : entity.ox ?? 0
  let offsetY = (sprout ? 0 : entity.oy ?? 0) + (pot ? flowerPotOffset(plant.seed) : 0)
  let scaleX = sprout ? 1 : entity.s ?? 1
  let scaleY = scaleX
  if (plant.facingLeft) {
    offsetX += 80 * scaleX
    scaleX = -scaleX
  }
  const [ageX, ageY, ageScale] = AGE_TRANSFORM[plant.age]
  offsetX += ageX * scaleX
  offsetY += ageY * scaleY
  scaleX *= ageScale
  scaleY *= ageScale
  if (!sprout) offsetY += pottedOffset(plant.seed, scaleY)

  animation.draw(ctx, base.translate(px + offsetX, py + offsetY).scale(scaleX, scaleY))
}

/** 画一个花园：base 把 800 × 600 的游戏坐标映射到画布 */
export async function drawGardenScene(ctx: CanvasRenderingContext2D, assets: AlmanacAssets & { loader: ImageLoader }, garden: SceneGarden, plants: PottedPlantView[], base: DOMMatrix) {
  const background = await assets.loader.load(BACKGROUNDS[garden])
  const sorted = plants
    .filter(plant => plant.garden === garden)
    .sort((a, b) => (spotOf(garden, a.x, a.y)?.[1] ?? 0) - (spotOf(garden, b.x, b.y)?.[1] ?? 0))
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (background) {
    ctx.setTransform(base)
    ctx.drawImage(background, 0, 0)
  }
  for (const plant of sorted) await drawPlant(ctx, assets, garden, plant, base)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

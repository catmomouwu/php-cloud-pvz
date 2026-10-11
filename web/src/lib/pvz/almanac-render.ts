// 按图鉴配置构造动画实例，并在“地面坐标系”（200×200 地面左上为原点）里绘制阴影与本体。

import type { AlmanacEntity, Ground } from './almanac-entities'
import type { GameImage, ImageLoader } from './images'
import type { Pak } from './pak'
import { Animation, type ColorRule, loadReanim, type ReanimDef } from './reanim'

export const GROUND_SIZE = 200

const GROUND_IMAGES: Record<Ground, string> = {
  day: 'IMAGE_ALMANAC_GROUNDDAY',
  night: 'IMAGE_ALMANAC_GROUNDNIGHT',
  pool: 'IMAGE_ALMANAC_GROUNDPOOL',
  nightpool: 'IMAGE_ALMANAC_GROUNDNIGHTPOOL',
  roof: 'IMAGE_ALMANAC_GROUNDROOF',
  ice: 'IMAGE_ALMANAC_GROUNDICE',
}

export interface AlmanacAssets {
  pak: Pak
  loader: ImageLoader
  reanim: (file: string) => Promise<{ def: ReanimDef, images: Map<string, GameImage | null> }>
}

export function createAlmanacAssets(pak: Pak, loader: ImageLoader): AlmanacAssets {
  const cache = new Map<string, Promise<{ def: ReanimDef, images: Map<string, GameImage | null> }>>()
  return {
    pak,
    loader,
    reanim(file) {
      const key = file.toLowerCase()
      let pending = cache.get(key)
      if (!pending) {
        const source = pak.text(`reanim/${file}.reanim`)
        pending = source ? loadReanim(source, loader) : Promise.reject(new Error(`reanim/${file}.reanim not found`))
        cache.set(key, pending)
      }
      return pending
    },
  }
}

export interface EntityRenderer {
  /** 地面图片（大图使用） */
  ground: GameImage | null
  update: (dt: number) => void
  /** base 把地面坐标映射到画布 */
  draw: (ctx: CanvasRenderingContext2D, base: DOMMatrix) => void
}

/** 植物 / 僵尸本体的动画（含挂件），坐标系是游戏里该实体的格子原点；种子包、禅境花园也用它 */
export async function createEntityAnimation(entity: Pick<AlmanacEntity, 'file' | 'clip' | 'rate' | 'noTruncate' | 'hide' | 'show' | 'groups' | 'groupOrder' | 'attachments'> & { colors?: ColorRule[] }, assets: AlmanacAssets, startTime?: number): Promise<Animation> {
  const main = await assets.reanim(entity.file)
  const animation = new Animation(main.def, main.images, {
    clip: entity.clip,
    rate: entity.rate,
    noTruncate: entity.noTruncate,
    hide: entity.hide,
    show: entity.show,
    groups: entity.groups,
    groupOrder: entity.groupOrder,
    colors: entity.colors,
    startTime,
  })
  for (const attachment of entity.attachments ?? []) {
    const source = attachment.file ? await assets.reanim(attachment.file) : main
    const child = new Animation(source.def, source.images, { clip: attachment.clip, rate: attachment.rate ?? entity.rate, startTime })
    animation.attach(child, {
      track: attachment.track,
      basePose: attachment.basePose,
      offset: attachment.offset ? new DOMMatrix(attachment.offset) : undefined,
    })
  }
  return animation
}

/** startTime 为 0 时得到片段首帧（小卡片静态图使用） */
export async function createEntityRenderer(entity: AlmanacEntity & { colors?: ColorRule[] }, assets: AlmanacAssets, startTime?: number): Promise<EntityRenderer> {
  const animation = await createEntityAnimation(entity, assets, startTime)

  const [ground, shadowImage] = await Promise.all([
    assets.loader.load(GROUND_IMAGES[entity.ground ?? 'day']),
    entity.shadow === null ? Promise.resolve(null) : assets.loader.load('IMAGE_PLANTSHADOW'),
  ])

  // 本体与阴影在地面坐标系中的变换
  let body: DOMMatrix
  let shadow: { x: number, y: number, scale: number } | null = null
  if (entity.kind === 'plant') {
    const s = entity.s ?? 1
    const ox = entity.ox ?? 0
    const oy = entity.oy ?? 0
    const originX = 57 + (entity.dx ?? 0)
    const originY = 33 + (entity.dy ?? 0)
    body = new DOMMatrix().translate(originX, originY).multiply(new DOMMatrix([s, 0, 0, s, ox, oy]))
    if (entity.shadow !== null) {
      const [sx, sy, scale] = entity.shadow ?? [-3, 51, 1]
      shadow = { x: originX + sx, y: originY + oy + sy, scale: scale ?? 1 }
    }
  }
  else {
    const s = entity.s ?? 1
    const [offX, offY] = entity.off ?? [0, 0]
    const [adx, ady] = entity.adj ?? [0, 0]
    const originX = 41 + adx
    const originY = 65 + ady
    const ox = offX + 15
    const oy = offY - 8 - (entity.altitude ?? 0)
    body = new DOMMatrix().translate(originX, originY).multiply(new DOMMatrix([s, 0, 0, s, ox + 30 - 30 * s, oy + 120 - 120 * s]))
    if (entity.shadow !== null) {
      const [sx, sy, scale] = entity.shadow ?? [23, 0, 1]
      shadow = { x: originX + offX + 20 * s - 20 + sx, y: originY + offY + sy + 92, scale: (scale ?? 1) * s }
    }
  }

  return {
    ground,
    update: dt => animation.update(dt),
    draw(ctx, base) {
      if (shadow && shadowImage) {
        // 阴影绕图片中心缩放
        const w = shadowImage.width
        const h = shadowImage.height
        ctx.setTransform(base.translate(shadow.x + w / 2, shadow.y + h / 2).scale(shadow.scale).translate(-w / 2, -h / 2))
        ctx.drawImage(shadowImage, 0, 0)
      }
      animation.draw(ctx, base.multiply(body))
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    },
  }
}

/** 小卡片默认裁剪区域（地面坐标系）：植物取本体附近，僵尸取头与上半身 */
export function cropOf(entity: AlmanacEntity): [number, number, number, number] {
  if (entity.crop) return entity.crop
  return entity.kind === 'plant' ? [40, 15, 120, 100] : [45, 25, 110, 92]
}

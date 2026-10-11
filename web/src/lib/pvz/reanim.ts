// Reanim 骨骼动画（与 PvZ-Portable 的 Reanimator 一致）：
// - 每条轨道逐帧“向前填充”：缺省字段沿用上一帧（初值 x=y=kx=ky=0、sx=sy=1、f=0、a=1）；
// - 片段 = 某条同名轨道上 f ≥ 0 的帧范围（只取第一个同名轨道，不区分大小写）；
// - 帧间对 x/y/kx/ky/sx/sy/a 线性插值，图片取前一帧；f 从可见变不可见的那一段按不可见处理（truncate）；
// - 轨道矩阵：[cos(kx)·sx, sin(kx)·sx, −sin(ky)·sy, cos(ky)·sy, x, y]，图片左上角放在轨道原点；
// - 挂件：child 的基准矩阵 = 父基准 · 父轨道(t) · 父轨道(基准帧)⁻¹ · offset，紧接在该轨道之后绘制。

import type { GameImage, ImageLoader } from './images'

interface Frame {
  x: number
  y: number
  kx: number
  ky: number
  sx: number
  sy: number
  f: number
  a: number
  i: string | null
}

interface Track {
  name: string
  frames: Frame[]
}

export interface ReanimDef {
  tracks: Track[]
}

const FIELD = /<(x|y|kx|ky|sx|sy|f|a|i)>([^<]*)<\/\1>/g

export function parseReanim(source: string): ReanimDef {
  const tracks: Track[] = []
  for (const trackMatch of source.matchAll(/<track>([\s\S]*?)<\/track>/g)) {
    const body = trackMatch[1]!
    const name = /<name>(.*?)<\/name>/.exec(body)?.[1] ?? ''
    let previous: Frame = { x: 0, y: 0, kx: 0, ky: 0, sx: 1, sy: 1, f: 0, a: 1, i: null }
    const frames: Frame[] = []
    for (const frameMatch of body.matchAll(/<t>([\s\S]*?)<\/t>/g)) {
      const frame = { ...previous }
      for (const field of frameMatch[1]!.matchAll(FIELD)) {
        const key = field[1] as keyof Frame
        if (key === 'i') frame.i = field[2]! || frame.i
        else frame[key] = Number(field[2])
      }
      frames.push(frame)
      previous = frame
    }
    tracks.push({ name, frames })
  }
  return { tracks }
}

function findTrack(def: ReanimDef, name: string): number {
  const lower = name.toLowerCase()
  const index = def.tracks.findIndex(track => track.name.toLowerCase() === lower)
  return index === -1 ? 0 : index
}

function clipRange(def: ReanimDef, clip: string): { start: number, count: number } {
  const frames = def.tracks[findTrack(def, clip)]?.frames ?? []
  let start = -1
  let end = -1
  frames.forEach((frame, index) => {
    if (frame.f >= 0) {
      if (start < 0) start = index
      end = index
    }
  })
  return start < 0 ? { start: 0, count: 1 } : { start, count: end - start + 1 }
}

const DEG = Math.PI / 180
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function frameMatrix(a: Frame, b: Frame, t: number): DOMMatrix {
  const kx = lerp(a.kx, b.kx, t) * DEG
  const ky = lerp(a.ky, b.ky, t) * DEG
  const sx = lerp(a.sx, b.sx, t)
  const sy = lerp(a.sy, b.sy, t)
  return new DOMMatrix([Math.cos(kx) * sx, Math.sin(kx) * sx, -Math.sin(ky) * sy, Math.cos(ky) * sy, lerp(a.x, b.x, t), lerp(a.y, b.y, t)])
}

/** 轨道匹配规则：prefix 按前缀、exact 按全名（均不区分大小写） */
export interface TrackRule {
  match: string
  exact?: boolean
}

export interface GroupRule extends TrackRule {
  group: number
}

/** 轨道着色（与引擎的 mTrackColor 一致：图片颜色乘以这个颜色），如金盏花的花瓣 */
export interface ColorRule extends TrackRule {
  color: [number, number, number]
}

export interface AnimationOptions {
  clip?: string
  /** 播放速度（每秒推进的帧数） */
  rate?: number
  /** 关闭“消失帧截断”（部分植物 / 僵尸需要） */
  noTruncate?: boolean
  hide?: TrackRule[]
  /** 在 hide 之后强制显示 */
  show?: TrackRule[]
  groups?: GroupRule[]
  /** 绘制哪些组、按什么顺序（默认只画组 0） */
  groupOrder?: number[]
  /** 起始进度 0..1；缺省随机 */
  startTime?: number
  colors?: ColorRule[]
}

export interface AttachmentOptions extends AnimationOptions {
  /** 挂在父动画的哪条轨道上 */
  track: string
  /** 父动画的基准帧；缺省为父片段起点 */
  basePose?: number
  offset?: DOMMatrix
}

const matches = (name: string, rule: TrackRule) => {
  const lower = name.toLowerCase()
  const target = rule.match.toLowerCase()
  return rule.exact ? lower === target : lower.startsWith(target)
}

export class Animation {
  private readonly start: number
  private readonly count: number
  private readonly rate: number
  private readonly truncate: boolean
  private readonly groupOf: number[]
  private readonly colorOf: ([number, number, number] | null)[]
  private readonly groupOrder: number[]
  private readonly attachments: { track: number, base: Frame, child: Animation, offset: DOMMatrix }[] = []
  private time: number

  constructor(
    private readonly def: ReanimDef,
    private readonly images: Map<string, GameImage | null>,
    options: AnimationOptions = {},
  ) {
    const { start, count } = clipRange(def, options.clip ?? 'anim_idle')
    this.start = start
    this.count = count
    this.rate = options.rate ?? 12
    this.truncate = !options.noTruncate
    this.time = options.startTime ?? Math.random()
    this.groupOrder = options.groupOrder ?? [0]
    this.groupOf = def.tracks.map((track) => {
      const hidden = options.hide?.some(rule => matches(track.name, rule))
        && !options.show?.some(rule => matches(track.name, rule))
      if (hidden) return -1
      // 分组规则后写的覆盖先写的
      const rule = [...(options.groups ?? [])].reverse().find(item => matches(track.name, item))
      return rule ? rule.group : 0
    })
    this.colorOf = def.tracks.map(track => options.colors?.find(rule => matches(track.name, rule))?.color ?? null)
  }

  attach(child: Animation, options: AttachmentOptions) {
    const track = findTrack(this.def, options.track)
    const baseIndex = options.basePose ?? this.start
    this.attachments.push({
      track,
      base: this.def.tracks[track]!.frames[baseIndex]!,
      child,
      offset: options.offset ?? new DOMMatrix(),
    })
  }

  update(dt: number) {
    this.time = (this.time + dt * this.rate / this.count) % 1
    for (const attachment of this.attachments) attachment.child.update(dt)
  }

  setTime(time: number) {
    this.time = time
    for (const attachment of this.attachments) attachment.child.setTime(time)
  }

  private frameState() {
    const position = this.start + this.time * (this.count - 1)
    let i0 = Math.floor(position)
    let frac = position - i0
    let i1 = i0 + 1
    if (i0 >= this.start + this.count - 1) {
      i0 = i1 = this.start + this.count - 1
      frac = 0
    }
    return { i0, i1, frac }
  }

  draw(ctx: CanvasRenderingContext2D, base: DOMMatrix) {
    const { i0, i1, frac } = this.frameState()
    for (const group of this.groupOrder) {
      this.def.tracks.forEach((track, index) => {
        if (this.groupOf[index] !== group) return
        const a = track.frames[i0]
        const b = track.frames[i1] ?? a
        if (!a || !b) return
        const visible = a.f >= 0 && !(this.truncate && b.f < 0 && frac > 0)
        const matrix = frameMatrix(a, b, frac)
        if (visible && a.i) {
          const source = this.images.get(a.i)
          const color = this.colorOf[index]
          const image = source && color ? tintImage(source, color) : source
          const alpha = lerp(a.a, b.a, frac)
          if (image && alpha > 0) {
            ctx.setTransform(base.multiply(matrix))
            ctx.globalAlpha = Math.min(alpha, 1)
            ctx.drawImage(image, 0, 0)
          }
        }
        for (const attachment of this.attachments) {
          if (attachment.track !== index) continue
          const inverse = frameMatrix(attachment.base, attachment.base, 0).inverse()
          attachment.child.draw(ctx, base.multiply(matrix).multiply(inverse).multiply(attachment.offset))
        }
      })
    }
    ctx.globalAlpha = 1
  }
}

const tintCache = new WeakMap<GameImage, Map<string, OffscreenCanvas>>()

/** 图片乘以颜色、保留原来的透明度；同一张图同一种颜色只算一次 */
function tintImage(image: GameImage, [r, g, b]: [number, number, number]): GameImage {
  const key = `${r},${g},${b}`
  let byColor = tintCache.get(image)
  if (!byColor) tintCache.set(image, byColor = new Map())
  const cached = byColor.get(key)
  if (cached) return cached
  const canvas = new OffscreenCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = `rgb(${r} ${g} ${b})`
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(image, 0, 0)
  byColor.set(key, canvas)
  return canvas
}

/** 解析 reanim 并预加载它用到的全部图片 */
export async function loadReanim(source: string, loader: ImageLoader): Promise<{ def: ReanimDef, images: Map<string, GameImage | null> }> {
  const def = parseReanim(source)
  const ids = new Set(def.tracks.flatMap(track => track.frames.map(frame => frame.i)).filter((id): id is string => !!id))
  const images = new Map(await Promise.all([...ids].map(async id => [id, await loader.load(id)] as const)))
  return { def, images }
}

// 图片资源 id → pak 内文件，与 PvZ-Portable 的 DefinitionLoadImage 一致：
// 先查 resources.xml（SetDefaults 的 path / idprefix + Image），再按前缀回退到 reanim/、images/ 等目录。
// 扩展名依次尝试 .png / .jpg / .gif；存在 name_ 或 _name 时把它当作透明蒙版（灰度替换 alpha）。

import type { Pak } from './pak'

export type GameImage = ImageBitmap | OffscreenCanvas

export interface ImageLoader {
  load: (id: string) => Promise<GameImage | null>
}

function parseResourceIds(xml: string): Map<string, string> {
  const ids = new Map<string, string>()
  let dir = ''
  let prefix = ''
  for (const match of xml.matchAll(/<(SetDefaults|Image)\b([^>]*)>/g)) {
    const attr = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(match[2]!)?.[1]
    if (match[1] === 'SetDefaults') {
      dir = attr('path') ?? ''
      prefix = attr('idprefix') ?? ''
    }
    else {
      const id = attr('id')
      const path = attr('path')
      if (id && path) ids.set(`${prefix}${id}`.toUpperCase(), dir ? `${dir}/${path}` : path)
    }
  }
  return ids
}

const EXTENSIONS = ['.png', '.jpg', '.gif']

function mimeOf(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.jpg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/png'
}

export function createImageLoader(pak: Pak): ImageLoader {
  const ids = parseResourceIds(pak.text('properties/resources.xml') ?? '')
  const cache = new Map<string, Promise<GameImage | null>>()

  const withExtension = (base: string) => EXTENSIONS.map(ext => base + ext).find(path => pak.has(path)) ?? null

  function resolve(id: string): string | null {
    const upper = id.toUpperCase()
    const bases: string[] = []
    const known = ids.get(upper)
    if (known) bases.push(known)
    if (upper.startsWith('IMAGE_REANIM_')) bases.push(`reanim/${upper.slice(13)}`, `images/${upper.slice(13)}`)
    if (upper.startsWith('IMAGE_')) bases.push(upper.slice(6), `particles/${upper.slice(6)}`)
    for (const base of bases) {
      const path = withExtension(base)
      if (path) return path
    }
    return null
  }

  async function decode(path: string): Promise<GameImage> {
    const bitmap = await createImageBitmap(new Blob([pak.bytes(path)! as BlobPart], { type: mimeOf(path) }))
    const slash = path.lastIndexOf('/') + 1
    const dir = path.slice(0, slash)
    const name = path.slice(slash).replace(/\.[^.]+$/, '')
    const mask = withExtension(`${dir}${name}_`) ?? withExtension(`${dir}_${name}`)
    if (!mask) return bitmap
    const maskBitmap = await createImageBitmap(new Blob([pak.bytes(mask)! as BlobPart], { type: mimeOf(mask) }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(maskBitmap, 0, 0)
    const alpha = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < pixels.data.length; i += 4) pixels.data[i + 3] = alpha[i]!
    ctx.putImageData(pixels, 0, 0)
    return canvas
  }

  return {
    load(id) {
      let pending = cache.get(id)
      if (!pending) {
        const path = resolve(id)
        pending = path ? decode(path).catch(() => null) : Promise.resolve(null)
        cache.set(id, pending)
      }
      return pending
    },
  }
}

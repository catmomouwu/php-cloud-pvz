// 读取 PopCap PAK（main.pak）：整包按字节 XOR 0xF7，文件表在前、数据按顺序紧随其后。
// 路径不区分大小写、分隔符统一为 /，索引键为大写。
// 只在浏览器内存里解码，素材不会被保存或上传。

export interface Pak {
  has: (path: string) => boolean
  bytes: (path: string) => Uint8Array | undefined
  text: (path: string) => string | undefined
}

const latin1 = new TextDecoder('latin1')
const utf8 = new TextDecoder('utf-8')

export function parsePak(buffer: ArrayBuffer): Pak {
  const data = new Uint8Array(buffer)
  for (let i = 0; i < data.length; i++) data[i]! ^= 0xF7
  const view = new DataView(buffer)

  let offset = 8
  const table: [string, number][] = []
  for (;;) {
    const flags = data[offset++]!
    if (flags & 0x80) break
    const length = data[offset++]!
    const name = latin1.decode(data.subarray(offset, offset + length))
    offset += length
    const size = view.getUint32(offset, true)
    offset += 12 // size + filetime
    table.push([name.replace(/\\/g, '/').toUpperCase(), size])
  }

  const files = new Map<string, Uint8Array>()
  for (const [name, size] of table) {
    files.set(name, data.subarray(offset, offset + size))
    offset += size
  }

  const key = (path: string) => path.replace(/\\/g, '/').toUpperCase()
  return {
    has: path => files.has(key(path)),
    bytes: path => files.get(key(path)),
    text: (path) => {
      const bytes = files.get(key(path))
      return bytes ? utf8.decode(bytes) : undefined
    },
  }
}

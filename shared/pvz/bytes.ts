// 小端二进制读写工具。PvZ-Portable 的存档与注册表模拟文件均为小端格式。

const utf8Decoder = new TextDecoder('utf-8')
const utf8Encoder = new TextEncoder()

export class ByteReader {
  private view: DataView
  offset = 0

  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  get remaining(): number {
    return this.bytes.byteLength - this.offset
  }

  private ensure(size: number) {
    if (this.remaining < size) throw new RangeError('Unexpected end of data')
  }

  u16(): number {
    this.ensure(2)
    const value = this.view.getUint16(this.offset, true)
    this.offset += 2
    return value
  }

  u32(): number {
    this.ensure(4)
    const value = this.view.getUint32(this.offset, true)
    this.offset += 4
    return value
  }

  i32(): number {
    this.ensure(4)
    const value = this.view.getInt32(this.offset, true)
    this.offset += 4
    return value
  }

  bytesOf(size: number): Uint8Array {
    this.ensure(size)
    const value = this.bytes.subarray(this.offset, this.offset + size)
    this.offset += size
    return value
  }

  skip(size: number) {
    this.ensure(size)
    this.offset += size
  }

  utf8(size: number): string {
    return utf8Decoder.decode(this.bytesOf(size))
  }
}

export class ByteWriter {
  private chunks: Uint8Array[] = []

  u16(value: number) {
    const chunk = new Uint8Array(2)
    new DataView(chunk.buffer).setUint16(0, value, true)
    this.chunks.push(chunk)
  }

  u32(value: number) {
    const chunk = new Uint8Array(4)
    new DataView(chunk.buffer).setUint32(0, value, true)
    this.chunks.push(chunk)
  }

  raw(bytes: Uint8Array) {
    this.chunks.push(bytes)
  }

  finish(): Uint8Array {
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of this.chunks) {
      out.set(chunk, offset)
      offset += chunk.byteLength
    }
    return out
  }
}

export function encodeUtf8(text: string): Uint8Array {
  return utf8Encoder.encode(text)
}

export function decodeUtf8(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes)
}

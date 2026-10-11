// 读写 PvZ-Portable 的注册表模拟文件 registry.regemu。
// 格式来源：PvZ-Portable src/SexyAppFramework/misc/RegEmu.cpp
//   "REGEMU" + u16 version + u32 keyCount
//   key:   u32 nameLen(含 NUL) + name + NUL + u32 valueCount
//   value: u32 nameLen(含 NUL) + name + NUL + u32 type + u32 length + data

import { ByteReader, ByteWriter, decodeUtf8, encodeUtf8 } from './bytes'

const MAGIC = 'REGEMU'
const VERSION = 1

export const REG_SZ = 1
export const REG_DWORD = 4

export interface RegValue {
  type: number
  data: Uint8Array
}

export type Registry = Map<string, Map<string, RegValue>>

function readCString(reader: ByteReader, size: number): string {
  const bytes = reader.bytesOf(size)
  const end = bytes.indexOf(0)
  return decodeUtf8(end === -1 ? bytes : bytes.subarray(0, end))
}

function writeCString(writer: ByteWriter, text: string) {
  const bytes = encodeUtf8(text)
  writer.u32(bytes.byteLength + 1)
  writer.raw(bytes)
  writer.raw(new Uint8Array(1))
}

/** 解析失败时与游戏行为一致：返回空注册表 */
export function parseRegistry(bytes: Uint8Array | null | undefined): Registry {
  const registry: Registry = new Map()
  if (!bytes) return registry

  try {
    const reader = new ByteReader(bytes)
    if (decodeUtf8(reader.bytesOf(MAGIC.length)) !== MAGIC) return registry
    reader.u16()
    for (let keyCount = reader.u32(); keyCount > 0; keyCount--) {
      const keyName = readCString(reader, reader.u32())
      const values = new Map<string, RegValue>()
      for (let valueCount = reader.u32(); valueCount > 0; valueCount--) {
        const valueName = readCString(reader, reader.u32())
        const type = reader.u32()
        const data = reader.bytesOf(reader.u32()).slice()
        values.set(valueName, { type, data })
      }
      registry.set(keyName, values)
    }
  }
  catch {
    // 截断的文件：保留已读到的部分
  }
  return registry
}

export function serializeRegistry(registry: Registry): Uint8Array {
  const writer = new ByteWriter()
  writer.raw(encodeUtf8(MAGIC))
  writer.u16(VERSION)
  writer.u32(registry.size)
  for (const [keyName, values] of registry) {
    writeCString(writer, keyName)
    writer.u32(values.size)
    for (const [valueName, value] of values) {
      writeCString(writer, valueName)
      writer.u32(value.type)
      writer.u32(value.data.byteLength)
      writer.raw(value.data)
    }
  }
  return writer.finish()
}

function ensureKey(registry: Registry, key: string): Map<string, RegValue> {
  let values = registry.get(key)
  if (!values) {
    values = new Map()
    registry.set(key, values)
  }
  return values
}

export function setDword(registry: Registry, key: string, name: string, value: number) {
  const data = new Uint8Array(4)
  new DataView(data.buffer).setInt32(0, value, true)
  ensureKey(registry, key).set(name, { type: REG_DWORD, data })
}

/** 与 SexyAppBase::RegistryWriteString 一致：不写结尾 NUL */
export function setString(registry: Registry, key: string, name: string, value: string) {
  ensureKey(registry, key).set(name, { type: REG_SZ, data: encodeUtf8(value) })
}

export function getString(registry: Registry, key: string, name: string): string | null {
  const value = registry.get(key)?.get(name)
  if (!value || value.type !== REG_SZ) return null
  const end = value.data.indexOf(0)
  return decodeUtf8(end === -1 ? value.data : value.data.subarray(0, end))
}

export function getDword(registry: Registry, key: string, name: string): number | null {
  const value = registry.get(key)?.get(name)
  if (!value || value.type !== REG_DWORD || value.data.byteLength < 4) return null
  return new DataView(value.data.buffer, value.data.byteOffset, 4).getInt32(0, true)
}

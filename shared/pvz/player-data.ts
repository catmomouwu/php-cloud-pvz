// user{id}.dat 的完整读写，供存档编辑器使用（字段顺序见 PvZ-Portable PlayerInfo::SyncDetails）。
// 编辑器只改认识的字段：禅境花园植物按 88 字节原样保留，成就之后的僵尸头像等数据整体原样写回，
// 保证“读出来再写回去”逐字节不变。

import { ByteReader, ByteWriter } from './bytes'
import { USER_DAT_VERSION } from './userdata'

export const CHALLENGE_RECORD_COUNT = 100
export const PURCHASE_COUNT = 80
export const POTTED_PLANT_SIZE = 88
export const ACHIEVEMENT_COUNT = 20
const FLAG_COUNT = 18

/** 18 个 u32 标志位的下标（PlayerInfo::SyncDetails 中 mPlayTimeInactivePlayer 之后的顺序） */
export const PLAYER_FLAG = {
  hasUsedCheatKeys: 0,
  hasWokenStinky: 1,
  didntPurchasePacketUpgrade: 2,
  lastStinkyChocolateTime: 3,
  stinkyPosX: 4,
  stinkyPosY: 5,
  hasUnlockedMinigames: 6,
  hasUnlockedPuzzleMode: 7,
  hasNewMiniGame: 8,
  hasNewScaryPotter: 9,
  hasNewIZombie: 10,
  hasNewSurvival: 11,
  hasUnlockedSurvivalMode: 12,
  needsMessageOnGameSelector: 13,
  needsMagicTacoReward: 14,
  hasSeenStinky: 15,
  hasSeenUpsell: 16,
  placeHolderPlayerStats: 17,
} as const

export type PlayerFlag = keyof typeof PLAYER_FLAG

export interface PlayerData {
  /** 冒险关卡，从 1 开始（51 表示本周目已打完最后一关） */
  level: number
  /** 原始金币值，界面显示为 coins × 10 */
  coins: number
  finishedAdventure: number
  /** 下标 = GameMode − 1 */
  challengeRecords: number[]
  /** 下标 = StoreItem */
  purchases: number[]
  playTimeActive: number
  playTimeInactive: number
  flags: number[]
  /** 每盆 88 字节原样保留 */
  pottedPlants: Uint8Array[]
  /** 0 / 1；旧文件没有成就段时为空数组 */
  achievements: number[]
  /** 成就之后的数据（僵尸头像、小游戏完成标记等），原样写回 */
  tail: Uint8Array
}

export class PlayerDataError extends Error {}

export function parsePlayerData(bytes: Uint8Array): PlayerData {
  const reader = new ByteReader(bytes)
  if (reader.u32() !== USER_DAT_VERSION) throw new PlayerDataError('Unsupported user.dat version')

  const level = reader.i32()
  const coins = reader.i32()
  const finishedAdventure = reader.u32()
  const challengeRecords = Array.from({ length: CHALLENGE_RECORD_COUNT }, () => reader.u32())
  const purchases = Array.from({ length: PURCHASE_COUNT }, () => reader.u32())
  const playTimeActive = reader.u32()
  const playTimeInactive = reader.u32()
  const flags = Array.from({ length: FLAG_COUNT }, () => reader.u32())
  const pottedPlantCount = reader.u32()
  const pottedPlants = Array.from({ length: pottedPlantCount }, () => reader.bytesOf(POTTED_PLANT_SIZE).slice())

  let achievements: number[] = []
  if (reader.remaining >= ACHIEVEMENT_COUNT * 2) {
    achievements = Array.from({ length: ACHIEVEMENT_COUNT }, () => reader.u16())
  }
  const tail = reader.bytesOf(reader.remaining).slice()

  return { level, coins, finishedAdventure, challengeRecords, purchases, playTimeActive, playTimeInactive, flags, pottedPlants, achievements, tail }
}

export function serializePlayerData(data: PlayerData): Uint8Array {
  const writer = new ByteWriter()
  writer.u32(USER_DAT_VERSION)
  writer.u32(data.level >>> 0)
  writer.u32(data.coins >>> 0)
  writer.u32(data.finishedAdventure >>> 0)
  for (const value of data.challengeRecords) writer.u32(value >>> 0)
  for (const value of data.purchases) writer.u32(value >>> 0)
  writer.u32(data.playTimeActive >>> 0)
  writer.u32(data.playTimeInactive >>> 0)
  for (const value of data.flags) writer.u32(value >>> 0)
  writer.u32(data.pottedPlants.length)
  for (const plant of data.pottedPlants) writer.raw(plant)
  for (const value of data.achievements) writer.u16(value)
  writer.raw(data.tail)
  return writer.finish()
}

export function clonePlayerData(data: PlayerData): PlayerData {
  return {
    ...data,
    challengeRecords: [...data.challengeRecords],
    purchases: [...data.purchases],
    flags: [...data.flags],
    pottedPlants: data.pottedPlants.map(plant => plant.slice()),
    achievements: [...data.achievements],
    tail: data.tail.slice(),
  }
}

export function getFlag(data: PlayerData, flag: PlayerFlag): boolean {
  return data.flags[PLAYER_FLAG[flag]] !== 0
}

export function setFlag(data: PlayerData, flag: PlayerFlag, value: boolean) {
  data.flags[PLAYER_FLAG[flag]] = value ? 1 : 0
}

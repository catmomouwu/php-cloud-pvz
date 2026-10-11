// 解析 PvZ-Portable 的用户数据（userdata/ 目录）。
// 格式来源：PvZ-Portable src/Lawn/System/ProfileMgr.cpp（users.dat）
// 与 src/Lawn/System/PlayerInfo.cpp（user{id}.dat），均为小端。

import { ByteReader, ByteWriter, encodeUtf8 } from './bytes'

export const USERS_DAT_VERSION = 14
export const USER_DAT_VERSION = 12

/** users.dat 中的一条档案摘要：名字 → id，对应 userdata/user{id}.dat */
export interface ProfileSummary {
  name: string
  useSeq: number
  id: number
}

/** user{id}.dat 中 WebUI 关心的字段 */
export interface PlayerDetails {
  /** 冒险模式进度，从 1 开始；通关后重置为 1 */
  level: number
  /** 原始金币值，界面显示为 coins * 10 */
  coins: number
  finishedAdventure: number
  /** 单位：秒 */
  playTimeActive: number
  playTimeInactive: number
  hasUnlockedMinigames: boolean
  hasUnlockedPuzzle: boolean
  hasUnlockedSurvival: boolean
  pottedPlantCount: number
  achievements: boolean[]
  /** 各模式记录，下标 = GameMode - 1（生存为旗数，小游戏 / 解谜为完成次数） */
  challengeRecords: number[]
}

const CHALLENGE_RECORD_COUNT = 100
const PURCHASE_COUNT = 80
const POTTED_PLANT_SIZE = 88
const ACHIEVEMENT_COUNT = 20
const ADVENTURE_AREAS = 5
const LEVELS_PER_AREA = 10

/** 解析 users.dat；版本不符时游戏会忽略整个文件，这里返回 null */
export function parseUsersDat(bytes: Uint8Array): ProfileSummary[] | null {
  const reader = new ByteReader(bytes)
  if (reader.u32() !== USERS_DAT_VERSION) return null

  const profiles: ProfileSummary[] = []
  for (let count = reader.u16(); count > 0; count--) {
    const name = reader.utf8(reader.u16())
    const useSeq = reader.u32()
    const id = reader.u32()
    profiles.push({ name, useSeq, id })
  }
  return profiles
}

/** 写出 users.dat（与 ProfileMgr::SyncState 一致） */
export function serializeUsersDat(profiles: ProfileSummary[]): Uint8Array {
  const writer = new ByteWriter()
  writer.u32(USERS_DAT_VERSION)
  writer.u16(profiles.length)
  for (const profile of profiles) {
    const name = encodeUtf8(profile.name)
    writer.u16(name.byteLength)
    writer.raw(name)
    writer.u32(profile.useSeq)
    writer.u32(profile.id)
  }
  return writer.finish()
}

/** 解析 user{id}.dat；版本不符时游戏会重置为默认值，这里返回 null */
export function parsePlayerDat(bytes: Uint8Array): PlayerDetails | null {
  const reader = new ByteReader(bytes)
  if (reader.u32() !== USER_DAT_VERSION) return null

  const level = reader.i32()
  const coins = reader.i32()
  const finishedAdventure = reader.u32()
  const challengeRecords = Array.from({ length: CHALLENGE_RECORD_COUNT }, () => reader.u32())
  reader.skip(PURCHASE_COUNT * 4)
  const playTimeActive = reader.u32()
  const playTimeInactive = reader.u32()

  // 18 个 u32 标志位，顺序见 PlayerInfo::SyncDetails
  const flags = Array.from({ length: 18 }, () => reader.u32())
  const pottedPlantCount = reader.u32()

  let achievements: boolean[] = []
  // 成就位于禅境花园植物之后；旧文件可能缺失，读不到就留空
  if (reader.remaining >= pottedPlantCount * POTTED_PLANT_SIZE + ACHIEVEMENT_COUNT * 2) {
    reader.skip(pottedPlantCount * POTTED_PLANT_SIZE)
    achievements = Array.from({ length: ACHIEVEMENT_COUNT }, () => reader.u16() !== 0)
  }

  return {
    level,
    coins,
    finishedAdventure,
    playTimeActive,
    playTimeInactive,
    hasUnlockedMinigames: flags[6] !== 0,
    hasUnlockedPuzzle: flags[7] !== 0,
    hasUnlockedSurvival: flags[12] !== 0,
    pottedPlantCount,
    achievements,
    challengeRecords,
  }
}

/** 与 LawnApp::GetStageString 一致：level 12 → "2-2" */
export function stageString(level: number): string {
  const area = Math.min(Math.max(Math.floor((level - 1) / LEVELS_PER_AREA) + 1, 1), ADVENTURE_AREAS + 1)
  const sub = level - (area - 1) * LEVELS_PER_AREA
  return `${area}-${sub}`
}

/** 界面显示的金币数 */
export function displayCoins(coins: number): number {
  return coins * 10
}

export function userDatPath(id: number): string {
  return `userdata/user${id}.dat`
}

/** 关卡中途存档：game{id}_{mode}.v4（以及旧版 .dat） */
export function isMidLevelSaveOf(fileName: string, id: number): boolean {
  return new RegExp(`^game${id}_\\d+\\.(v4|dat)$`).test(fileName)
}

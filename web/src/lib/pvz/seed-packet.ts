// 种子包：卡片背景（IMAGE_SEEDS 第几格）+ 缩小的植物，参数与 PvZ-Portable SeedPacket.cpp DrawSeedPacket 一致。
// 植物以游戏格子原点绘制在 (x, y)，缩放 scale；模仿者在商店里直接用 IMAGE_IMITATERSEED。

export const SEED_PACKET_WIDTH = 50
export const SEED_PACKET_HEIGHT = 70
export const SEED_IMITATER = 48

/** 商店植物（SeedType ≥ 40）用“升级”样式的背景，其余为普通背景 */
export function packetBackground(seed: number): number {
  if (seed === SEED_IMITATER) return 0
  return seed >= 40 ? 1 : 2
}

const DEFAULT_LAYOUT = { scale: 0.5, x: 5, y: 8 }

/** 按 SeedType 下标 */
const LAYOUTS: Record<number, { scale: number, x: number, y: number }> = {
  4: { scale: 0.4, x: 8, y: 12 }, // 土豆雷
  6: { scale: 0.4, x: 8, y: 12 }, // 大嘴花
  10: { scale: 0.4, x: 8, y: 12 }, // 大喷菇
  11: { scale: 0.4, x: 10, y: 15 }, // 墓碑吞噬者
  12: { scale: 0.4, x: 8, y: 12 }, // 魅惑菇
  15: { scale: 0.4, x: 8, y: 12 }, // 毁灭菇
  17: { scale: 0.4, x: 8, y: 12 }, // 窝瓜
  18: { scale: 0.5, x: 5, y: 10 }, // 三线射手
  19: { scale: 0.4, x: 8, y: 12 }, // 缠绕水草
  21: { scale: 0.4, x: 8, y: 12 }, // 地刺
  22: { scale: 0.4, x: 8, y: 12 }, // 火炬树桩
  23: { scale: 0.3, x: 12, y: 22 }, // 高坚果
  25: { scale: 0.4, x: 8, y: 12 }, // 路灯花
  26: { scale: 0.5, x: 9, y: 13 }, // 仙人掌
  27: { scale: 0.4, x: 8, y: 17 }, // 三叶草
  28: { scale: 0.45, x: 12, y: 12 }, // 裂荚射手
  29: { scale: 0.5, x: 6, y: 8 }, // 杨桃
  30: { scale: 0.4, x: 8, y: 12 }, // 南瓜头
  31: { scale: 0.5, x: 5, y: 12 }, // 磁力菇
  32: { scale: 0.4, x: 15, y: 14 }, // 卷心菜投手
  34: { scale: 0.4, x: 13, y: 14 }, // 玉米投手
  37: { scale: 0.5, x: 5, y: 10 }, // 叶子保护伞
  39: { scale: 0.35, x: 18, y: 19 }, // 西瓜投手
  40: { scale: 0.5, x: 2, y: 8 }, // 机枪射手
  41: { scale: 0.45, x: 7, y: 14 }, // 双子向日葵
  42: { scale: 0.45, x: 7, y: 14 }, // 忧郁菇
  43: { scale: 0.45, x: 8, y: 13 }, // 香蒲
  44: { scale: 0.35, x: 18, y: 19 }, // 冰西瓜投手
  46: { scale: 0.4, x: 8, y: 12 }, // 地刺王
  47: { scale: 0.26, x: 6, y: 22 }, // 玉米加农炮
}

export function packetLayout(seed: number) {
  return LAYOUTS[seed] ?? DEFAULT_LAYOUT
}

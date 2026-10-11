// 图鉴实体配置。数据来自 PvZ-Portable 源码（AlmanacDialog / Plant / Zombie），坐标与游戏图鉴一致：
// 植物原点 = 地面左上 + (57, 33) + (dx, dy)，再叠加 [s, 0, ox; 0, s, oy]；
// 僵尸原点 = 地面左上 + (41, 65) + (adx, ady)，再叠加 [s, 0, ox+30−30s; 0, s, oy+120−120s]，ox = offX+15，oy = offY−8。
// 名字中文为常用译名；描述、英文名取自本地 main.pak。

import type { GroupRule, TrackRule } from './reanim'

export type Ground = 'day' | 'night' | 'pool' | 'nightpool' | 'roof' | 'ice'
export type Recharge = 'fast' | 'slow' | 'verySlow'

export interface AttachmentConfig {
  /** 缺省为同一个 reanim 文件 */
  file?: string
  clip: string
  track: string
  rate?: number
  basePose?: number
  offset?: [number, number, number, number, number, number]
}

interface BaseEntity {
  /** LawnStrings 键，同时用作 i18n 的 almanac.names 键 */
  key: string
  file: string
  clip?: string
  rate?: number
  noTruncate?: boolean
  hide?: TrackRule[]
  show?: TrackRule[]
  groups?: GroupRule[]
  groupOrder?: number[]
  attachments?: AttachmentConfig[]
  /** 阴影 [x, y, 缩放]；null 表示不画 */
  shadow?: [number, number, number?] | null
  ground?: Ground
  /** 小卡片裁剪区域（地面坐标系 x, y, w, h） */
  crop?: [number, number, number, number]
}

export interface PlantEntity extends BaseEntity {
  kind: 'plant'
  cost: number | null
  recharge: Recharge | null
  ox?: number
  oy?: number
  s?: number
  dx?: number
  dy?: number
}

export interface ZombieEntity extends BaseEntity {
  kind: 'zombie'
  off?: [number, number]
  adj?: [number, number]
  s?: number
  /** 离地高度（跳跳僵尸） */
  altitude?: number
}

export type AlmanacEntity = PlantEntity | ZombieEntity

const rule = (match: string, exact = false): TrackRule => ({ match, exact })

const plant = (key: string, file: string, cost: number | null, recharge: Recharge | null, extra: Partial<PlantEntity> = {}): PlantEntity =>
  ({ kind: 'plant', key, file, cost, recharge, ...extra })

/** 豌豆射手类：头部是同一文件的第二个实例，挂在茎上 */
const peaHead = (track = 'anim_stem', clip = 'anim_head_idle'): AttachmentConfig => ({ clip, track })

export const PLANTS: PlantEntity[] = [
  plant('PEASHOOTER', 'PeaShooterSingle', 100, 'fast', { rate: 17, attachments: [peaHead()] }),
  plant('SUNFLOWER', 'SunFlower', 50, 'fast'),
  plant('CHERRY_BOMB', 'CherryBomb', 150, 'verySlow'),
  plant('WALL_NUT', 'Wallnut', 50, 'slow'),
  plant('POTATO_MINE', 'PotatoMine', 25, 'slow', { clip: 'anim_armed', ox: 12, oy: 12, s: 0.8 }),
  plant('SNOW_PEA', 'SnowPea', 175, 'fast', { rate: 17, attachments: [peaHead()] }),
  plant('CHOMPER', 'Chomper', 150, 'fast', { shadow: [-21, 57] }),
  plant('REPEATER', 'PeaShooter', 200, 'fast', { rate: 17, attachments: [peaHead()] }),
  plant('PUFF_SHROOM', 'PuffShroom', 0, 'fast', { oy: 5, shadow: [-3, 42, 0.5], ground: 'night' }),
  plant('SUN_SHROOM', 'SunShroom', 25, 'fast', { clip: 'anim_bigidle', shadow: [-3, 42, 0.5], ground: 'night' }),
  plant('FUME_SHROOM', 'FumeShroom', 75, 'fast', { shadow: [-3, 47, 1.3], ground: 'night' }),
  plant('GRAVE_BUSTER', 'Gravebuster', 75, 'fast', { oy: -40, dy: 55, shadow: null, ground: 'night' }),
  plant('HYPNO_SHROOM', 'HypnoShroom', 75, 'slow', { ground: 'night' }),
  plant('SCAREDY_SHROOM', 'ScaredyShroom', 25, 'fast', { oy: -14, shadow: [-9, 55], ground: 'night' }),
  plant('ICE_SHROOM', 'IceShroom', 75, 'verySlow', { ground: 'night' }),
  plant('DOOM_SHROOM', 'DoomShroom', 125, 'verySlow', { ground: 'night' }),
  plant('LILY_PAD', 'LilyPad', 25, 'fast', { oy: 25, shadow: null, ground: 'pool' }),
  plant('SQUASH', 'Squash', 50, 'slow', { shadow: [-3, 56] }),
  plant('THREEPEATER', 'ThreePeater', 325, 'fast', {
    rate: 17,
    attachments: [peaHead('anim_head1', 'anim_head_idle1'), peaHead('anim_head2', 'anim_head_idle2'), peaHead('anim_head3', 'anim_head_idle3')],
  }),
  plant('TANGLE_KELP', 'Tanglekelp', 25, 'slow', { oy: 24, shadow: null, ground: 'pool', noTruncate: true }),
  plant('JALAPENO', 'Jalapeno', 125, 'verySlow'),
  plant('SPIKEWEED', 'Caltrop', 100, 'fast', { oy: 15, shadow: null }),
  plant('TORCHWOOD', 'Torchwood', 175, 'fast'),
  plant('TALL_NUT', 'Tallnut', 125, 'slow', { dy: 18, shadow: [-3, 54, 1.3], crop: [40, 0, 120, 100] }),
  plant('SEA_SHROOM', 'SeaShroom', 0, 'slow', { oy: 28, shadow: null, ground: 'nightpool' }),
  plant('PLANTERN', 'Plantern', 25, 'slow', { shadow: [-3, 57], ground: 'night' }),
  plant('CACTUS', 'Cactus', 125, 'fast', { shadow: [-8, 50] }),
  plant('BLOVER', 'Blover', 100, 'fast', { rate: 10 }),
  plant('SPLIT_PEA', 'SplitPea', 125, 'fast', {
    rate: 17,
    attachments: [peaHead('anim_idle', 'anim_head_idle'), peaHead('anim_idle', 'anim_splitpea_idle')],
  }),
  plant('STARFRUIT', 'Starfruit', 125, 'fast', { oy: 10, shadow: null }),
  plant('PUMPKIN', 'Pumpkin', 125, 'slow', { oy: 15, shadow: [-3, 46, 1.4], groups: [{ match: 'Pumpkin_back', group: 1 }], groupOrder: [1, 0] }),
  plant('MAGNET_SHROOM', 'Magnetshroom', 100, 'fast', { noTruncate: true, ground: 'night' }),
  plant('CABBAGE_PULT', 'Cabbagepult', 100, 'fast', { shadow: [-3, 47] }),
  plant('FLOWER_POT', 'Pot', 25, 'fast', { oy: 26, dy: -20, shadow: [-4, 46], ground: 'roof' }),
  plant('KERNEL_PULT', 'Cornpult', 100, 'fast', { hide: [rule('Cornpult_butter')], shadow: [0, 47] }),
  plant('COFFEE_BEAN', 'Coffeebean', 75, 'fast', { ox: 12, oy: -10, s: 0.8, dy: 20, shadow: [-3, 71] }),
  plant('GARLIC', 'Garlic', 50, 'fast', { noTruncate: true }),
  plant('UMBRELLA_LEAF', 'Umbrellaleaf', 100, 'fast', { shadow: [-7, 52, 0.5] }),
  plant('MARIGOLD', 'Marigold', 50, 'slow', { rate: 17 }),
  plant('MELON_PULT', 'Melonpult', 300, 'fast', { shadow: [-3, 47] }),
  plant('GATLING_PEA', 'GatlingPea', 250, 'verySlow', { rate: 17, attachments: [peaHead('anim_idle')] }),
  plant('TWIN_SUNFLOWER', 'TwinSunflower', 150, 'verySlow'),
  plant('GLOOM_SHROOM', 'GloomShroom', 150, 'verySlow', { shadow: [-3, 47, 1.3], ground: 'night' }),
  plant('CATTAIL', 'Cattail', 225, 'verySlow', { shadow: null, ground: 'pool' }),
  plant('WINTER_MELON', 'WinterMelon', 200, 'verySlow', { shadow: [-3, 47] }),
  plant('GOLD_MAGNET', 'GoldMagnet', 50, 'verySlow', { noTruncate: true }),
  plant('SPIKEROCK', 'SpikeRock', 125, 'verySlow', { oy: 21, shadow: null }),
  plant('COB_CANNON', 'CobCannon', 500, 'verySlow', { dx: -40, shadow: null, crop: [0, 0, 160, 120] }),
  plant('IMITATER', 'Imitater', null, null, { rate: 27 }),
]

/** Zombie.reanim 被多种僵尸共用：默认隐藏各类头饰、旗帜、救生圈、铁门臂等 */
const ZOMBIE_HIDE = ['anim_cone', 'anim_bucket', 'anim_screendoor', 'Zombie_flaghand', 'Zombie_duckytube', 'anim_tongue', 'Zombie_mustache', 'Zombie_outerarm_screendoor', 'Zombie_innerarm_screendoor']
const zombieHide = (except: string[] = [], extra: string[] = []): TrackRule[] =>
  [...ZOMBIE_HIDE.filter(name => !except.includes(name)), ...extra].map(name => rule(name))

const zombie = (key: string, file: string, extra: Partial<ZombieEntity> = {}): ZombieEntity =>
  ({ kind: 'zombie', key, file, rate: 15, ...extra })

export const ZOMBIES: ZombieEntity[] = [
  zombie('ZOMBIE', 'Zombie', { hide: zombieHide() }),
  zombie('FLAG_ZOMBIE', 'Zombie', {
    hide: zombieHide([], ['anim_innerarm']),
    show: [rule('Zombie_flaghand', true), rule('Zombie_innerarm_screendoor', true)],
    attachments: [{ file: 'Zombie_flagpole', clip: 'Zombie_flag', track: 'Zombie_flaghand', rate: 15, basePose: 0 }],
  }),
  zombie('CONEHEAD_ZOMBIE', 'Zombie', { hide: zombieHide(['anim_cone'], ['anim_hair']) }),
  zombie('POLE_VAULTING_ZOMBIE', 'Zombie_polevaulter', { off: [-6, -11], shadow: [36, 11] }),
  zombie('BUCKETHEAD_ZOMBIE', 'Zombie', { hide: zombieHide(['anim_bucket'], ['anim_hair']) }),
  zombie('NEWSPAPER_ZOMBIE', 'Zombie_paper', {
    shadow: [29, 4],
    groups: [{ match: 'Zombie_paper_paper', exact: true, group: 1 }, { match: 'Zombie_paper_hands', group: 3 }],
    groupOrder: [0, 1, 3],
  }),
  zombie('SCREEN_DOOR_ZOMBIE', 'Zombie', {
    hide: zombieHide(['anim_screendoor', 'Zombie_outerarm_screendoor', 'Zombie_innerarm_screendoor'], ['Zombie_outerarm_hand', 'Zombie_outerarm_lower', 'Zombie_outerarm_upper', 'anim_innerarm']),
    groups: [{ match: 'anim_screendoor', group: 1 }, { match: 'Zombie_outerarm_screendoor', group: 3 }],
    groupOrder: [0, 1, 3],
  }),
  zombie('FOOTBALL_ZOMBIE', 'Zombie_football', { hide: [rule('anim_hair')], off: [0, -16], adj: [-10, 0], shadow: [41, 16] }),
  zombie('DANCING_ZOMBIE', 'Zombie_disco', { clip: 'anim_armraise', rate: 12, s: 0.8 }),
  zombie('BACKUP_DANCER', 'Zombie_backup', { clip: 'anim_armraise', rate: 12, s: 0.8 }),
  zombie('DUCKY_TUBE_ZOMBIE', 'Zombie', { hide: zombieHide(['Zombie_duckytube']) }),
  zombie('SNORKEL_ZOMBIE', 'Zombie_snorkle', { shadow: [35, 5] }),
  zombie('ZOMBONI', 'Zombie_zamboni', { clip: 'anim_drive', rate: 12, off: [68, -23], adj: [-30, 5], shadow: null, ground: 'ice', crop: [0, 40, 200, 150] }),
  zombie('ZOMBIE_BOBSLED_TEAM', 'Zombie_bobsled', { off: [0, -12], shadow: [20, 13], ground: 'ice' }),
  zombie('DOLPHIN_RIDER_ZOMBIE', 'Zombie_dolphinrider', { shadow: [19, 11] }),
  zombie('JACK_IN_THE_BOX_ZOMBIE', 'Zombie_jackbox'),
  zombie('BALLOON_ZOMBIE', 'Zombie_balloon', {
    rate: 9,
    noTruncate: true,
    off: [0, 17],
    adj: [0, -20],
    shadow: [23, 13],
    attachments: [{ clip: 'Propeller', track: 'hat', rate: 12 }],
    crop: [40, 0, 120, 120],
  }),
  zombie('DIGGER_ZOMBIE', 'Zombie_digger', { noTruncate: true, shadow: [17, 5] }),
  zombie('POGO_ZOMBIE', 'Zombie_pogo', { clip: 'anim_pogo', rate: 40, off: [0, 16], altitude: 9 }),
  zombie('ZOMBIE_YETI', 'Zombie_yeti', { off: [0, -20], shadow: [3, 20] }),
  zombie('BUNGEE_ZOMBIE', 'Zombie_bungi', {
    clip: 'anim_drop',
    rate: 24,
    noTruncate: true,
    off: [-18, 0],
    adj: [15, 0],
    shadow: null,
    groups: ['Zombie_bungi_rightarm_lower2', 'Zombie_bungi_rightarm_hand2', 'Zombie_bungi_leftarm_lower2', 'Zombie_bungi_leftarm_hand2'].map(match => ({ match, group: 2 })),
    groupOrder: [2, 0],
  }),
  zombie('LADDER_ZOMBIE', 'Zombie_ladder', {
    groups: [{ match: 'Zombie_ladder_1', exact: true, group: 1 }, { match: 'Zombie_outerarm', group: 3 }],
    groupOrder: [0, 1, 3],
  }),
  zombie('CATAPULT_ZOMBIE', 'Zombie_catapult', { rate: 8, off: [-25, -18], adj: [-10, 0], shadow: null, crop: [0, 30, 200, 160] }),
  zombie('GARGANTUAR', 'Zombie_gargantuar', { off: [0, -8], adj: [0, 40], shadow: [27, 7, 1.5], crop: [10, 0, 180, 170] }),
  zombie('IMP', 'Zombie_imp', { clip: 'anim_walk', rate: 12, shadow: [25, 7, 0.6], crop: [50, 60, 100, 100] }),
  zombie('BOSS', 'Zombie_boss', {
    clip: 'anim_head_idle',
    rate: 12,
    adj: [-540, -175],
    shadow: null,
    hide: ['Boss_innerarm', 'Boss_RV', 'Boss_innerleg', 'Boss_outerleg', 'Boss_body2'].map(name => rule(name)),
    attachments: [{ file: 'Zombie_Boss_driver', clip: 'anim_idle', track: 'Boss_head2', rate: 18, basePose: 0, offset: [1.2, 0, 0, 1.2, 28, -84] }],
  }),
]

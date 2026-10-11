// 存档详情页右侧的分类，顺序即显示顺序；地址为 /saves/:id/:section
export const PROFILE_SECTIONS = ['overview', 'adventure', 'challenges', 'almanac', 'shop', 'garden', 'backup'] as const

export type ProfileSection = typeof PROFILE_SECTIONS[number]

export function isProfileSection(value: unknown): value is ProfileSection {
  return typeof value === 'string' && (PROFILE_SECTIONS as readonly string[]).includes(value)
}

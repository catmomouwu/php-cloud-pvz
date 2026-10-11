// 数据库结构：SQLite（本地 node:sqlite / 线上 Cloudflare D1）共用。
// user / session / account / verification 与 better-auth 核心表一致。

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  ...timestamps,
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  ...timestamps,
}, table => [index('session_user_id_idx').on(table.userId)])

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  password: text('password'),
  ...timestamps,
}, table => [index('account_user_id_idx').on(table.userId)])

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  ...timestamps,
}, table => [index('verification_identifier_idx').on(table.identifier)])

/**
 * 云端的一个游戏内用户（按用户单独同步）。id 是云端标识（UUID），与各设备上的本地编号无关。
 * version 用于乐观并发：上传必须带上自己基于的版本号，不一致就是冲突。
 * 删除只打标记（deleted_at），让其他设备也删除，同时保留历史。
 */
export const saveProfile = sqliteTable('save_profile', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  version: integer('version').notNull(),
  sha256: text('sha256').notNull(),
  size: integer('size').notNull(),
  /** JSON：ProfileStats */
  stats: text('stats').notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  ...timestamps,
}, table => [index('save_profile_user_id_idx').on(table.userId)])

/** 用户的历史版本；内容在 S3（object_key），删除记录没有内容 */
export const saveProfileVersion = sqliteTable('save_profile_version', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => saveProfile.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  objectKey: text('object_key'),
  name: text('name').notNull(),
  sha256: text('sha256').notNull(),
  size: integer('size').notNull(),
  stats: text('stats').notNull(),
  /** upload：同步上传；restore：从同步记录还原；snapshot：从快照还原；delete：删除 */
  source: text('source', { enum: ['upload', 'restore', 'snapshot', 'delete'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [uniqueIndex('save_profile_version_profile_version_idx').on(table.profileId, table.version)])

/** 用户手动创建的快照：内容单独存一份，不随同步记录清理 */
export const saveProfileSnapshot = sqliteTable('save_profile_snapshot', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => saveProfile.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  /** 创建快照时云端的版本号 */
  sourceVersion: integer('source_version').notNull(),
  objectKey: text('object_key').notNull(),
  /** 存档里的用户名（快照创建时） */
  name: text('name').notNull(),
  sha256: text('sha256').notNull(),
  size: integer('size').notNull(),
  stats: text('stats').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, table => [index('save_profile_snapshot_profile_id_idx').on(table.profileId)])

export const schema = { user, session, account, verification, saveProfile, saveProfileVersion, saveProfileSnapshot }

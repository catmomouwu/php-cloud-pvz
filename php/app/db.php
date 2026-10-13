<?php

// 数据库：PDO 连接（生产 MySQL 5.7 / 本地测试 SQLite）+ 首次请求时幂等建表。
// 表结构与 server/db/schema.ts 对应（时间一律 BIGINT Unix 毫秒），
// 去掉了未使用的 better-auth account / verification 表，密码列并入 user。

declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = config('db');
    if (!is_array($cfg)) {
        throw new ApiError(500, 'DB_CONFIG_MISSING');
    }
    $driver = $cfg['driver'] ?? 'mysql';

    if ($driver === 'sqlite') {
        $path = $cfg['sqlite_path'] ?? __DIR__ . '/../data/cloud-pvz.sqlite';
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
    } else {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $cfg['host'] ?? 'localhost',
            (int) ($cfg['port'] ?? 3306),
            $cfg['name'] ?? '',
            $cfg['charset'] ?? 'utf8mb4',
        );
        $pdo = new PDO($dsn, $cfg['user'] ?? '', $cfg['pass'] ?? '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    ensure_schema($pdo);
    return $pdo;
}

/** 建表（幂等）：首次部署无需手动导 SQL。并发首建冲突时忽略"已存在"错误。 */
function ensure_schema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $isMysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    foreach (schema_statements($isMysql) as $sql) {
        try {
            $pdo->exec($sql);
        } catch (PDOException $e) {
            // 并发首次建表的竞态：表/索引已存在（42S01）时忽略，其余错误照抛
            if ($e->getCode() !== '42S01') {
                throw $e;
            }
        }
    }
}

/** @return string[] 建表语句（按依赖顺序） */
function schema_statements(bool $isMysql): array
{
    if ($isMysql) {
        return [
            "CREATE TABLE IF NOT EXISTS user (
                id CHAR(36) NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(254) NOT NULL,
                email_verified TINYINT(1) NOT NULL DEFAULT 0,
                image VARCHAR(512) DEFAULT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY user_email_unique (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS session (
                id CHAR(36) NOT NULL,
                token VARCHAR(64) NOT NULL,
                user_id CHAR(36) NOT NULL,
                expires_at BIGINT NOT NULL,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent VARCHAR(255) DEFAULT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY session_token_unique (token),
                KEY session_user_id_idx (user_id),
                FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS save_profile (
                id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                name VARCHAR(64) NOT NULL,
                version INT NOT NULL,
                sha256 CHAR(64) NOT NULL,
                size INT NOT NULL,
                stats TEXT NOT NULL,
                deleted_at BIGINT DEFAULT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                PRIMARY KEY (id),
                KEY save_profile_user_id_idx (user_id),
                FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS save_profile_version (
                id CHAR(36) NOT NULL,
                profile_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                version INT NOT NULL,
                object_key VARCHAR(512) DEFAULT NULL,
                name VARCHAR(64) NOT NULL,
                sha256 CHAR(64) NOT NULL,
                size INT NOT NULL,
                stats TEXT NOT NULL,
                source VARCHAR(16) NOT NULL,
                created_at BIGINT NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY save_profile_version_profile_version_idx (profile_id, version),
                KEY save_profile_version_user_id_idx (user_id),
                FOREIGN KEY (profile_id) REFERENCES save_profile(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS save_profile_snapshot (
                id CHAR(36) NOT NULL,
                profile_id CHAR(36) NOT NULL,
                user_id CHAR(36) NOT NULL,
                label VARCHAR(255) NOT NULL,
                source_version INT NOT NULL,
                object_key VARCHAR(512) NOT NULL,
                name VARCHAR(64) NOT NULL,
                sha256 CHAR(64) NOT NULL,
                size INT NOT NULL,
                stats TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                PRIMARY KEY (id),
                KEY save_profile_snapshot_profile_id_idx (profile_id),
                FOREIGN KEY (profile_id) REFERENCES save_profile(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        ];
    }

    return [
        "CREATE TABLE IF NOT EXISTS user (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            email_verified INTEGER NOT NULL DEFAULT 0,
            image TEXT,
            password_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",

        "CREATE TABLE IF NOT EXISTS session (
            id TEXT PRIMARY KEY,
            token TEXT NOT NULL UNIQUE,
            user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
            expires_at INTEGER NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        'CREATE INDEX IF NOT EXISTS session_user_id_idx ON session(user_id)',

        "CREATE TABLE IF NOT EXISTS save_profile (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            version INTEGER NOT NULL,
            sha256 TEXT NOT NULL,
            size INTEGER NOT NULL,
            stats TEXT NOT NULL,
            deleted_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        'CREATE INDEX IF NOT EXISTS save_profile_user_id_idx ON save_profile(user_id)',

        "CREATE TABLE IF NOT EXISTS save_profile_version (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL REFERENCES save_profile(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
            version INTEGER NOT NULL,
            object_key TEXT,
            name TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            size INTEGER NOT NULL,
            stats TEXT NOT NULL,
            source TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            UNIQUE (profile_id, version)
        )",

        "CREATE TABLE IF NOT EXISTS save_profile_snapshot (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL REFERENCES save_profile(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            source_version INTEGER NOT NULL,
            object_key TEXT NOT NULL,
            name TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            size INTEGER NOT NULL,
            stats TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        'CREATE INDEX IF NOT EXISTS save_profile_snapshot_profile_id_idx ON save_profile_snapshot(profile_id)',
    ];
}

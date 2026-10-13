<?php

// 云端存档业务逻辑（移植 server/utils/profiles.ts）：
// 写入顺序：对象先写磁盘，再用条件更新推进 version（乐观并发），最后记录历史并清理旧版本。

declare(strict_types=1);

/** 每个用户保留的历史版本数 */
const KEEP_VERSIONS = 20;

function parse_profile_key(string $key): string
{
    if (preg_match(UUID_PATTERN, $key) !== 1) {
        throw new ApiError(400, 'INVALID_KEY');
    }
    return $key;
}

/** ?base=N：客户端基于的版本号（新建传 0） */
function parse_base(): int
{
    $raw = $_GET['base'] ?? null;
    if (!is_string($raw) || preg_match('/^\d+$/', $raw) !== 1) {
        throw new ApiError(400, 'INVALID_BASE');
    }
    return (int) $raw;
}

/** @return array{key:string,name:string,version:int,sha256:string,size:int,stats:array,deleted:bool,updatedAt:string} */
function to_head_dto(array $row): array
{
    return [
        'key' => (string) $row['id'],
        'name' => (string) $row['name'],
        'version' => (int) $row['version'],
        'sha256' => (string) $row['sha256'],
        'size' => (int) $row['size'],
        'stats' => json_decode((string) $row['stats'], true),
        'deleted' => $row['deleted_at'] !== null,
        'updatedAt' => iso_ms((int) $row['updated_at']),
    ];
}

/** @return array{version:int,name:string,sha256:string,size:int,stats:array,source:string,hasContent:bool,createdAt:string} */
function to_version_dto(array $row): array
{
    return [
        'version' => (int) $row['version'],
        'name' => (string) $row['name'],
        'sha256' => (string) $row['sha256'],
        'size' => (int) $row['size'],
        'stats' => json_decode((string) $row['stats'], true),
        'source' => (string) $row['source'],
        'hasContent' => $row['object_key'] !== null,
        'createdAt' => iso_ms((int) $row['created_at']),
    ];
}

function conflict_error(?array $row): ApiError
{
    return new ApiError(409, 'PROFILE_CONFLICT', ['head' => $row === null ? null : to_head_dto($row)]);
}

/** 当前账号下的全部游戏内用户（含已删除的，供其他设备同步删除） */
function list_profiles(string $userId): array
{
    $stmt = db()->prepare('SELECT * FROM save_profile WHERE user_id = ?');
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
}

function get_profile(string $userId, string $key): ?array
{
    $stmt = db()->prepare('SELECT * FROM save_profile WHERE id = ? AND user_id = ?');
    $stmt->execute([$key, $userId]);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

/** 账号内未删除的用户不能重名（不区分大小写，与游戏一致） */
function assert_name_available(string $userId, string $key, string $name): void
{
    $stmt = db()->prepare('SELECT name FROM save_profile WHERE user_id = ? AND id != ? AND deleted_at IS NULL');
    $stmt->execute([$userId, $key]);
    foreach ($stmt->fetchAll() as $other) {
        if (mb_strtolower((string) $other['name']) === mb_strtolower($name)) {
            throw new ApiError(409, 'NAME_TAKEN', ['name' => $name]);
        }
    }
}

/**
 * 写入一个用户的新版本（新建 / 更新 / 从删除状态恢复）。
 * $baseVersion 为 null 表示不检查版本（还原历史版本或快照）。
 */
function commit_profile(string $userId, string $key, array $profile, ?int $baseVersion, string $source): array
{
    $name = unicode_trim(profile_name($profile));
    if ($name === '' || mb_strlen($name) > MAX_PROFILE_NAME_LENGTH) {
        throw new ApiError(400, 'INVALID_NAME');
    }

    $sha256 = profile_digest($profile);
    $current = get_profile($userId, $key);

    // 内容与云端一致且未删除：不产生新版本
    if ($current !== null && $current['deleted_at'] === null && (string) $current['sha256'] === $sha256) {
        return $current;
    }
    if ($baseVersion !== null && $baseVersion !== (int) ($current['version'] ?? 0)) {
        throw conflict_error($current);
    }
    assert_name_available($userId, $key, $name);

    $archive = pack_profile($profile);
    $objectKey = "saves/{$userId}/{$key}/" . uuid_v4() . '.zip';
    store_put($objectKey, $archive);

    $stats = (string) json_encode(summarize_profile($profile), JSON_UNESCAPED_UNICODE);
    $now = now_ms();
    $expected = $current === null ? 0 : (int) $current['version'];

    $updated = false;
    if ($current !== null) {
        // 条件更新：version 不匹配说明有并发写入 → 409（version 恒自增，rowCount 可靠）
        $stmt = db()->prepare(
            'UPDATE save_profile SET name = ?, sha256 = ?, size = ?, stats = ?, deleted_at = NULL, updated_at = ?, version = ?
             WHERE id = ? AND version = ?',
        );
        $stmt->execute([$name, $sha256, strlen($archive), $stats, $now, $expected + 1, $key, $expected]);
        $updated = $stmt->rowCount() > 0;
    } else {
        try {
            $stmt = db()->prepare(
                'INSERT INTO save_profile (id, user_id, name, version, sha256, size, stats, deleted_at, created_at, updated_at)
                 VALUES (?, ?, ?, 1, ?, ?, ?, NULL, ?, ?)',
            );
            $stmt->execute([$key, $userId, $name, $sha256, strlen($archive), $stats, $now, $now]);
            $updated = true;
        } catch (PDOException $e) {
            // 并发下主键冲突（23000）→ 走冲突路径；其余错误照抛
            if ($e->getCode() !== '23000') {
                throw $e;
            }
        }
    }

    if (!$updated) {
        store_delete($objectKey);
        throw conflict_error(get_profile($userId, $key));
    }

    $row = get_profile($userId, $key);
    $stmt = db()->prepare(
        'INSERT INTO save_profile_version (id, profile_id, user_id, version, object_key, name, sha256, size, stats, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    $stmt->execute([
        uuid_v4(), $key, $userId, (int) $row['version'], $objectKey,
        $name, $sha256, strlen($archive), $stats, $source, $now,
    ]);
    prune_versions($key);
    return $row;
}

/** 删除：打删除标记并推进版本，历史保留 */
function delete_profile_head(string $userId, string $key, int $baseVersion): array
{
    $current = get_profile($userId, $key);
    if ($current === null) {
        throw new ApiError(404, 'PROFILE_NOT_FOUND');
    }
    if ($current['deleted_at'] !== null) {
        return $current;
    }
    if ((int) $current['version'] !== $baseVersion) {
        throw conflict_error($current);
    }

    $now = now_ms();
    $stmt = db()->prepare(
        'UPDATE save_profile SET version = ?, deleted_at = ?, updated_at = ? WHERE id = ? AND version = ?',
    );
    $stmt->execute([$baseVersion + 1, $now, $now, $key, $baseVersion]);
    if ($stmt->rowCount() === 0) {
        throw conflict_error(get_profile($userId, $key));
    }

    $row = get_profile($userId, $key);
    $stmt = db()->prepare(
        'INSERT INTO save_profile_version (id, profile_id, user_id, version, object_key, name, sha256, size, stats, source, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, 0, ?, ?, ?)',
    );
    $stmt->execute([
        uuid_v4(), $key, $userId, (int) $row['version'],
        $row['name'], $row['sha256'], $row['stats'], 'delete', $now,
    ]);
    prune_versions($key);
    return $row;
}

/** 清理超出保留数的历史版本（先删对象再删行） */
function prune_versions(string $profileId): void
{
    $stmt = db()->prepare(
        'SELECT id, object_key FROM save_profile_version WHERE profile_id = ? ORDER BY version DESC LIMIT 1000 OFFSET ?',
    );
    $stmt->execute([$profileId, KEEP_VERSIONS]);
    foreach ($stmt->fetchAll() as $row) {
        if ($row['object_key'] !== null) {
            store_delete((string) $row['object_key']);
        }
        $delete = db()->prepare('DELETE FROM save_profile_version WHERE id = ?');
        $delete->execute([$row['id']]);
    }
}

/** 历史版本列表（最近 KEEP_VERSIONS 条，version 降序） */
function list_versions(string $userId, string $key): array
{
    $stmt = db()->prepare(
        'SELECT * FROM save_profile_version WHERE profile_id = ? AND user_id = ? ORDER BY version DESC LIMIT ?',
    );
    $stmt->execute([$key, $userId, KEEP_VERSIONS]);
    return $stmt->fetchAll();
}

function get_version(string $userId, string $key, int $version): ?array
{
    $stmt = db()->prepare(
        'SELECT * FROM save_profile_version WHERE profile_id = ? AND user_id = ? AND version = ?',
    );
    $stmt->execute([$key, $userId, $version]);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

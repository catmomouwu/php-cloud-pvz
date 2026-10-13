<?php

// 快照逻辑（移植 server/utils/snapshots.ts）：
// 每个游戏内用户最多 MAX_SNAPSHOTS 个快照，内容单独复制一份，
// 满额时需要客户端明确同意覆盖最早的一个（409 SNAPSHOT_LIMIT + replaceOldest 重试）。

declare(strict_types=1);

/** 每个用户最多保留的快照数 */
const MAX_SNAPSHOTS = 10;
/** 快照名长度上限（字符数） */
const MAX_SNAPSHOT_LABEL_LENGTH = 40;

/** @return array{id:string,label:string,sourceVersion:int,name:string,size:int,stats:array,createdAt:string} */
function to_snapshot_dto(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'label' => (string) $row['label'],
        'sourceVersion' => (int) $row['source_version'],
        'name' => (string) $row['name'],
        'size' => (int) $row['size'],
        'stats' => json_decode((string) $row['stats'], true),
        'createdAt' => iso_ms((int) $row['created_at']),
    ];
}

function parse_snapshot_id(string $id): string
{
    if (preg_match(UUID_PATTERN, $id) !== 1) {
        throw new ApiError(400, 'INVALID_SNAPSHOT');
    }
    return $id;
}

/** 去掉首尾空白；空名或超长返回 null */
function normalize_label(mixed $value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $label = unicode_trim($value);
    if ($label === '' || mb_strlen($label) > MAX_SNAPSHOT_LABEL_LENGTH) {
        return null;
    }
    return $label;
}

/** 快照列表（createdAt 降序） */
function list_snapshots(string $userId, string $key): array
{
    $stmt = db()->prepare(
        'SELECT * FROM save_profile_snapshot WHERE profile_id = ? AND user_id = ? ORDER BY created_at DESC, id DESC',
    );
    $stmt->execute([$key, $userId]);
    return $stmt->fetchAll();
}

function get_snapshot(string $userId, string $key, string $id): array
{
    $stmt = db()->prepare(
        'SELECT * FROM save_profile_snapshot WHERE id = ? AND profile_id = ? AND user_id = ?',
    );
    $stmt->execute([$id, $key, $userId]);
    $row = $stmt->fetch();
    if ($row === false) {
        throw new ApiError(404, 'SNAPSHOT_NOT_FOUND');
    }
    return $row;
}

/** 读取快照内容；对象丢失抛 404 */
function read_snapshot_archive(array $row): string
{
    $archive = store_get((string) $row['object_key']);
    if ($archive === null) {
        throw new ApiError(404, 'OBJECT_NOT_FOUND');
    }
    return $archive;
}

/** 把云端当前版本存为快照；已满额且未同意覆盖时抛 409 SNAPSHOT_LIMIT */
function create_snapshot(string $userId, string $key, string $label, bool $replaceOldest): array
{
    $head = get_profile($userId, $key);
    if ($head === null || $head['deleted_at'] !== null) {
        throw new ApiError(404, 'PROFILE_NOT_FOUND');
    }

    $existing = list_snapshots($userId, $key); // createdAt 降序
    $overflow = count($existing) - MAX_SNAPSHOTS + 1;
    $oldest = array_reverse($existing);
    if ($overflow > 0 && !$replaceOldest) {
        throw new ApiError(409, 'SNAPSHOT_LIMIT', [
            'limit' => MAX_SNAPSHOTS,
            'oldest' => to_snapshot_dto($oldest[0]),
        ]);
    }

    $version = get_version($userId, $key, (int) $head['version']);
    if ($version === null || $version['object_key'] === null) {
        throw new ApiError(404, 'VERSION_NOT_FOUND');
    }
    $archive = store_get((string) $version['object_key']);
    if ($archive === null) {
        throw new ApiError(404, 'OBJECT_NOT_FOUND');
    }

    $id = uuid_v4();
    $objectKey = "saves/{$userId}/{$key}/snapshots/{$id}.zip";
    store_put($objectKey, $archive);

    $stmt = db()->prepare(
        'INSERT INTO save_profile_snapshot (id, profile_id, user_id, label, source_version, object_key, name, sha256, size, stats, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    $stmt->execute([
        $id, $key, $userId, $label, (int) $head['version'], $objectKey,
        $version['name'], $version['sha256'], strlen($archive), $version['stats'], now_ms(),
    ]);

    // 新快照写好之后才删最早的，失败时不会少一个
    foreach (array_slice($oldest, 0, max($overflow, 0)) as $row) {
        remove_snapshot($row);
    }
    return get_snapshot($userId, $key, $id);
}

function rename_snapshot(array $row, string $label): array
{
    $stmt = db()->prepare('UPDATE save_profile_snapshot SET label = ? WHERE id = ?');
    $stmt->execute([$label, $row['id']]);
    $row['label'] = $label;
    return $row;
}

function remove_snapshot(array $row): void
{
    $stmt = db()->prepare('DELETE FROM save_profile_snapshot WHERE id = ?');
    $stmt->execute([$row['id']]);
    store_delete((string) $row['object_key']);
}

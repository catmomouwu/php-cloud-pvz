<?php

// 存档对象存储：data_dir 下的文件系统实现（替代 S3 SaveStore）。
// key 形如 saves/{userId}/{profileKey}/{uuid}.zip、saves/{userId}/{profileKey}/snapshots/{uuid}.zip、
// game/main.pak，与原版的 S3 键结构一致，方便将来迁回对象存储。

declare(strict_types=1);

/** 数据目录（不存在则创建） */
function data_dir(): string
{
    $dir = config('data_dir');
    if (!is_string($dir) || $dir === '') {
        throw new ApiError(500, 'DATA_DIR_MISSING');
    }
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new ApiError(500, 'DATA_DIR_UNWRITABLE', ['dir' => $dir]);
        }
    }
    return $dir;
}

/** key → 绝对路径；拒绝目录穿越（key 均由服务端生成或来自数据库，此处兜底校验） */
function store_path(string $key): string
{
    $parts = explode('/', $key);
    foreach ($parts as $part) {
        if ($part === '' || $part === '.' || $part === '..') {
            throw new ApiError(500, 'BAD_OBJECT_KEY');
        }
    }
    return data_dir() . '/' . implode('/', $parts);
}

function store_put(string $key, string $bytes): void
{
    $path = store_path($key);
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    // 先写临时文件再改名，读方不会拿到半截文件
    $tmp = $path . '.tmp' . bin2hex(random_bytes(4));
    if (file_put_contents($tmp, $bytes) === false) {
        @unlink($tmp);
        throw new ApiError(500, 'STORAGE_ERROR', ['detail' => 'write failed']);
    }
    if (!rename($tmp, $path)) {
        @unlink($tmp);
        throw new ApiError(500, 'STORAGE_ERROR', ['detail' => 'rename failed']);
    }
}

function store_get(string $key): ?string
{
    $path = store_path($key);
    if (!is_file($path)) {
        return null;
    }
    $bytes = file_get_contents($path);
    return $bytes === false ? null : $bytes;
}

function store_size(string $key): ?int
{
    $path = store_path($key);
    if (!is_file($path)) {
        return null;
    }
    $size = filesize($path);
    return $size === false ? null : (int) $size;
}

/** 删除对象；不存在时静默（与 S3 SaveStore.delete 一致） */
function store_delete(string $key): void
{
    $path = store_path($key);
    if (is_file($path)) {
        @unlink($path);
    }
}

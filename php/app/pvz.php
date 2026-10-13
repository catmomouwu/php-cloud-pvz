<?php

// PvZ 云端包格式的 PHP 移植。
// 源：shared/pvz/archive.ts（zip 校验与 digestFiles）、shared/pvz/profile-archive.ts
// （包结构与 summarizeProfile）、shared/pvz/userdata.ts（user.dat 字段偏移）。

declare(strict_types=1);

class ArchiveError extends Exception
{
}

const MAX_ARCHIVE_BYTES = 4 * 1024 * 1024;    // 上传的 zip 上限
const MAX_ARCHIVE_FILES = 128;                // zip 内条目数上限（含目录条目）
const MAX_UNPACKED_BYTES = 16 * 1024 * 1024;  // 解压后总字节数上限
const MAX_PROFILE_NAME_LENGTH = 12;           // 游戏内用户名长度上限（字符数）

const PROFILE_META = 'profile.json';
const PROFILE_USER_DAT = 'user.dat';

/** 云端包允许的文件名：profile.json / user.dat / game_{mode}.v4|dat */
function is_profile_path(string $path): bool
{
    return $path === PROFILE_META
        || $path === PROFILE_USER_DAT
        || (bool) preg_match('/^game_\d+\.(v4|dat)$/', $path);
}

/** 读取 profile.json 里的名字 */
function profile_name(array $files): string
{
    $meta = $files[PROFILE_META] ?? null;
    if (!is_string($meta)) {
        throw new ArchiveError('profile.json missing');
    }
    $parsed = json_decode($meta, true);
    if (!is_array($parsed) || !is_string($parsed['name'] ?? null)) {
        throw new ArchiveError('profile name missing');
    }
    return $parsed['name'];
}

/** 规范的 profile.json：只含 name、固定编码（对齐 TS 侧 encodeMeta 的 JSON.stringify 输出） */
function encode_meta(string $name): string
{
    return (string) json_encode(['name' => $name], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * 解压并校验云端包（对应 unpackZip + unpackProfile）。
 * @return array<string, string> 文件名 => 内容字节
 */
function unpack_profile(string $bytes): array
{
    if (strlen($bytes) > MAX_ARCHIVE_BYTES) {
        throw new ArchiveError('archive too large');
    }

    // ZipArchive 只能操作真实文件；4MB 以内用临时文件中转
    $tmp = tempnam(sys_get_temp_dir(), 'cpvz');
    if ($tmp === false) {
        throw new ApiError(500, 'STORAGE_ERROR', ['detail' => 'tempnam failed']);
    }
    try {
        if (file_put_contents($tmp, $bytes) === false) {
            throw new ArchiveError('invalid archive');
        }
        $zip = new ZipArchive();
        // CHECKCONS：做中央目录一致性检查，坏包直接判非法
        if ($zip->open($tmp, ZipArchive::CHECKCONS) !== true) {
            throw new ArchiveError('invalid archive');
        }
        try {
            if ($zip->numFiles > MAX_ARCHIVE_FILES) {
                throw new ArchiveError('archive too large');
            }
            $files = [];
            $unpacked = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);
                if ($stat === false) {
                    throw new ArchiveError('invalid archive');
                }
                $name = (string) $stat['name'];
                if (str_ends_with($name, '/')) {
                    continue; // 目录条目跳过（仍计入条目数上限）
                }
                $unpacked += (int) $stat['size'];
                if ($unpacked > MAX_UNPACKED_BYTES) {
                    throw new ArchiveError('archive too large');
                }
                if (!is_profile_path($name)) {
                    throw new ArchiveError("unexpected path: {$name}");
                }
                $data = $zip->getFromIndex($i);
                if ($data === false) {
                    throw new ArchiveError('invalid archive');
                }
                // CRC 校验（fflate 解压时也会校验，两侧对齐）
                if ((int) ($stat['crc'] ?? 0) !== crc32($data)) {
                    throw new ArchiveError('invalid archive');
                }
                $files[$name] = $data;
            }
        } finally {
            $zip->close();
        }
        if (!isset($files[PROFILE_META])) {
            throw new ArchiveError('profile.json missing');
        }
        return $files;
    } finally {
        @unlink($tmp);
    }
}

/** 打包云端包（对应 packProfile：条目按路径排序；zip 编码不影响摘要） */
function pack_profile(array $files): string
{
    uksort($files, 'strcmp');
    $tmp = tempnam(sys_get_temp_dir(), 'cpvz');
    if ($tmp === false) {
        throw new ApiError(500, 'STORAGE_ERROR', ['detail' => 'tempnam failed']);
    }
    try {
        $zip = new ZipArchive();
        if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new ApiError(500, 'STORAGE_ERROR', ['detail' => 'zip create failed']);
        }
        foreach ($files as $name => $data) {
            $zip->addFromString($name, $data);
        }
        $zip->close();
        $bytes = file_get_contents($tmp);
        if ($bytes === false) {
            throw new ApiError(500, 'STORAGE_ERROR', ['detail' => 'zip read failed']);
        }
        return $bytes;
    } finally {
        @unlink($tmp);
    }
}

/**
 * 内容摘要（对应 digestFiles）：文件按路径排序后拼接
 *   path\0{字节长度}\0{内容}
 * 再整体 SHA-256。与 zip 编码无关。
 * 排序说明：包内文件名只可能是 profile.json / user.dat / game_N.v4|dat（全小写 ASCII），
 * 此集合下 strcmp（字节序）与 TS 侧 localeCompare 的排序结果一致。
 */
function digest_files(array $files): string
{
    uksort($files, 'strcmp');
    $ctx = hash_init('sha256');
    foreach ($files as $path => $data) {
        hash_update($ctx, "{$path}\0" . strlen($data) . "\0");
        hash_update($ctx, $data);
    }
    return hash_final($ctx);
}

/** 先规范 profile.json 再取摘要（对应 profileDigest），与上传方的 JSON 写法无关 */
function profile_digest(array $files): string
{
    $canonical = $files;
    $canonical[PROFILE_META] = encode_meta(profile_name($files));
    return digest_files($canonical);
}

/**
 * 进度摘要（对应 summarizeProfile + parsePlayerDat 的关键字段）。
 * user.dat 布局（小端，版本 12）：0 u32 版本、4 i32 level、8 i32 coins、12 u32 finishedAdventure、
 * 16..415 挑战记录（100×u32）、416..735 商店购买（80×u32）、736 u32 playTimeActive。
 * @return array{level: int|null, coins: int|null, finishedAdventure: int|null, playTimeSeconds: int|null, hasMidLevelSave: bool}
 */
function summarize_profile(array $files): array
{
    $stats = [
        'level' => null,
        'coins' => null,
        'finishedAdventure' => null,
        'playTimeSeconds' => null,
        'hasMidLevelSave' => false,
    ];

    $dat = $files[PROFILE_USER_DAT] ?? null;
    if (is_string($dat) && strlen($dat) >= 740) {
        $header = unpack('Vversion/Vlevel/Vcoins/VfinishedAdventure', substr($dat, 0, 16));
        if ($header !== false && $header['version'] === 12) {
            $stats['level'] = to_i32($header['level']);
            $stats['coins'] = to_i32($header['coins']) * 10; // displayCoins：界面显示 coins * 10
            $stats['finishedAdventure'] = (int) $header['finishedAdventure'];
            $playTime = unpack('V', substr($dat, 736, 4));
            $stats['playTimeSeconds'] = $playTime === false ? null : (int) $playTime[1];
        }
    }

    foreach (array_keys($files) as $name) {
        if ((bool) preg_match('/^game_\d+\.(v4|dat)$/', $name)) {
            $stats['hasMidLevelSave'] = true;
            break;
        }
    }
    return $stats;
}

/** u32 位模式 → 有符号 32 位整数（对应 TS 的 i32 读取） */
function to_i32(int $value): int
{
    return $value >= 0x80000000 ? $value - 0x100000000 : $value;
}

<?php

// 路由分发与 HTTP 级端点处理（对应 server/api/** 与 server/routes/main.pak.ts）。
// Nginx 把 /api/** 与 /main.pak rewrite 到 index.php；这里按 $_SERVER['REQUEST_URI'] 分发。

declare(strict_types=1);

function route_request(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $path = rawurldecode($path);

    if ($path === '/api/health') {
        if ($method === 'GET') {
            api_json(['ok' => true, 'name' => 'cloud-pvz', 'time' => iso_ms(now_ms())]);
        }
        throw new ApiError(404, 'NOT_FOUND');
    }

    if ($path === '/api/auth' || str_starts_with($path, '/api/auth/')) {
        route_auth($method, $path);
    }

    if ($path === '/api/profiles' || str_starts_with($path, '/api/profiles/')) {
        route_profiles($method, $path);
    }

    if ($path === '/main.pak') {
        serve_main_pak($method);
    }

    if (preg_match('#^/game-properties/([\w.-]+\.xml)$#', $path, $m) === 1) {
        serve_game_property($method, $m[1]);
    }

    if (str_starts_with($path, '/api/')) {
        throw new ApiError(404, 'NOT_FOUND'); // 未匹配的 /api/** 一律 404（不落 SPA 回退）
    }

    http_response_code(404);
    exit;
}

function route_auth(string $method, string $path): never
{
    if ($path === '/api/auth/sign-in/email' && $method === 'POST') {
        auth_sign_in(request_json_body());
    }
    if ($path === '/api/auth/sign-up/email' && $method === 'POST') {
        auth_sign_up(request_json_body());
    }
    if ($path === '/api/auth/sign-out' && $method === 'POST') {
        auth_sign_out();
    }
    if ($path === '/api/auth/get-session' && $method === 'GET') {
        auth_get_session();
    }
    throw new ApiError(404, 'NOT_FOUND');
}

function route_profiles(string $method, string $path): never
{
    $session = require_user();
    $userId = (string) $session['user_id'];

    if ($path === '/api/profiles') {
        if ($method === 'GET') {
            api_json(['profiles' => array_map('to_head_dto', list_profiles($userId))]);
        }
        throw new ApiError(404, 'NOT_FOUND');
    }

    $key = '';
    if (preg_match('#^/api/profiles/([^/]+)$#', $path, $m) === 1) {
        $key = parse_profile_key(rawurldecode($m[1]));
        if ($method === 'PUT') {
            profiles_upload($userId, $key);
        }
        if ($method === 'DELETE') {
            api_json(['head' => to_head_dto(delete_profile_head($userId, $key, parse_base()))]);
        }
        throw new ApiError(404, 'NOT_FOUND');
    }

    if (preg_match('#^/api/profiles/([^/]+)/versions$#', $path, $m) === 1 && $method === 'GET') {
        $key = parse_profile_key(rawurldecode($m[1]));
        api_json(['versions' => array_map('to_version_dto', list_versions($userId, $key))]);
    }

    if (preg_match('#^/api/profiles/([^/]+)/versions/([^/]+)$#', $path, $m) === 1 && $method === 'GET') {
        $key = parse_profile_key(rawurldecode($m[1]));
        profiles_download_version($userId, $key, rawurldecode($m[2]));
    }

    if (preg_match('#^/api/profiles/([^/]+)/restore$#', $path, $m) === 1 && $method === 'POST') {
        $key = parse_profile_key(rawurldecode($m[1]));
        $body = request_json_body();
        $version = $body['version'] ?? null;
        $row = is_int($version) || (is_string($version) && preg_match('/^\d+$/', $version) === 1)
            ? get_version($userId, $key, (int) $version)
            : null;
        if ($row === null || $row['object_key'] === null) {
            throw new ApiError(404, 'VERSION_NOT_FOUND');
        }
        $archive = store_get((string) $row['object_key']);
        if ($archive === null) {
            throw new ApiError(404, 'OBJECT_NOT_FOUND');
        }
        $head = commit_profile($userId, $key, unpack_profile($archive), null, 'restore');
        api_json(['head' => to_head_dto($head)]);
    }

    if (preg_match('#^/api/profiles/([^/]+)/snapshots$#', $path, $m) === 1) {
        $key = parse_profile_key(rawurldecode($m[1]));
        if ($method === 'GET') {
            api_json(['snapshots' => array_map('to_snapshot_dto', list_snapshots($userId, $key))]);
        }
        if ($method === 'POST') {
            $body = request_json_body();
            $label = normalize_label($body['label'] ?? null);
            if ($label === null) {
                throw new ApiError(400, 'INVALID_LABEL');
            }
            $replaceOldest = ($body['replaceOldest'] ?? null) === true;
            api_json(['snapshot' => to_snapshot_dto(create_snapshot($userId, $key, $label, $replaceOldest))]);
        }
        throw new ApiError(404, 'NOT_FOUND');
    }

    if (preg_match('#^/api/profiles/([^/]+)/snapshots/([^/]+)/restore$#', $path, $m) === 1 && $method === 'POST') {
        $key = parse_profile_key(rawurldecode($m[1]));
        $id = parse_snapshot_id(rawurldecode($m[2]));
        $row = get_snapshot($userId, $key, $id);
        $head = commit_profile($userId, $key, unpack_profile(read_snapshot_archive($row)), null, 'snapshot');
        api_json(['head' => to_head_dto($head)]);
    }

    if (preg_match('#^/api/profiles/([^/]+)/snapshots/([^/]+)$#', $path, $m) === 1) {
        $key = parse_profile_key(rawurldecode($m[1]));
        $id = parse_snapshot_id(rawurldecode($m[2]));
        $row = get_snapshot($userId, $key, $id);
        if ($method === 'GET') {
            profiles_download_snapshot($row);
        }
        if ($method === 'PATCH') {
            $body = request_json_body();
            $label = normalize_label($body['label'] ?? null);
            if ($label === null) {
                throw new ApiError(400, 'INVALID_LABEL');
            }
            api_json(['snapshot' => to_snapshot_dto(rename_snapshot($row, $label))]);
        }
        if ($method === 'DELETE') {
            remove_snapshot($row);
            api_json(['ok' => true]);
        }
        throw new ApiError(404, 'NOT_FOUND');
    }

    throw new ApiError(404, 'NOT_FOUND');
}

/** PUT /api/profiles/:key?base=N — body 为该用户的 zip 包 */
function profiles_upload(string $userId, string $key): never
{
    $base = parse_base();

    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > MAX_ARCHIVE_BYTES) {
        throw new ApiError(413, 'ARCHIVE_TOO_LARGE');
    }

    $body = file_get_contents('php://input');
    if ($body === false || $body === '') {
        throw new ApiError(400, 'EMPTY_ARCHIVE');
    }

    try {
        $profile = unpack_profile($body);
    } catch (ArchiveError $e) {
        throw new ApiError(400, 'INVALID_ARCHIVE', ['detail' => $e->getMessage()]);
    }

    $row = commit_profile($userId, $key, $profile, $base, 'upload');
    api_json(['head' => to_head_dto($row)]);
}

/** GET /api/profiles/:key/versions/:version — 下载历史版本 zip */
function profiles_download_version(string $userId, string $key, string $versionParam): never
{
    if (preg_match('/^\d+$/', $versionParam) !== 1) {
        throw new ApiError(404, 'VERSION_NOT_FOUND');
    }
    $row = get_version($userId, $key, (int) $versionParam);
    if ($row === null || $row['object_key'] === null) {
        throw new ApiError(404, 'VERSION_NOT_FOUND');
    }
    $archive = store_get((string) $row['object_key']);
    if ($archive === null) {
        throw new ApiError(404, 'OBJECT_NOT_FOUND');
    }
    prepare_streaming();
    header('content-type: application/zip');
    header('content-disposition: attachment; filename="pvz-' . rawurlencode((string) $row['name']) . '-v' . $row['version'] . '.zip"');
    header('cache-control: private, no-store');
    header('content-length: ' . strlen($archive));
    echo $archive;
    exit;
}

/** GET /api/profiles/:key/snapshots/:id — 导出快照 zip（与导入格式相同） */
function profiles_download_snapshot(array $row): never
{
    $archive = read_snapshot_archive($row);
    prepare_streaming();
    header('content-type: application/zip');
    header("content-disposition: attachment; filename*=UTF-8''" . rawurlencode('pvz-' . $row['name'] . '-' . $row['label'] . '.zip'));
    header('cache-control: private, no-store');
    header('content-length: ' . strlen($archive));
    echo $archive;
    exit;
}

/** GET|HEAD /main.pak — 游戏资源，仅登录用户（本地文件流式下发） */
function serve_main_pak(string $method): never
{
    if ($method !== 'GET' && $method !== 'HEAD') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED');
    }
    require_user();

    $path = config('pak_path');
    if (!is_string($path) || $path === '') {
        $path = data_dir() . '/game/main.pak';
    }
    if (!is_file($path)) {
        throw new ApiError(404, 'NOT_FOUND');
    }
    $size = (int) filesize($path);

    prepare_streaming();
    header('content-type: application/octet-stream');
    header('cache-control: private, max-age=86400');
    header('content-length: ' . $size);
    if ($method === 'HEAD') {
        // HEAD 供设置页检查资源就绪：只返回大小（对齐原版 x-file-size）
        header('x-file-size: ' . $size);
        exit;
    }

    set_time_limit(0);
    $handle = fopen($path, 'rb');
    if ($handle === false) {
        throw new ApiError(500, 'STORAGE_ERROR', ['detail' => 'pak read failed']);
    }
    while (!feof($handle)) {
        echo fread($handle, 1024 * 1024);
        flush();
    }
    fclose($handle);
    exit;
}

/**
 * GET /game-properties/{name}.xml — 语言包的属性覆盖文件（default.xml / Layout.xml，
 * 如中文版资源包携带的），仅登录用户。放在 data/game/properties/ 下；不存在返回 404，
 * 播放器会跳过加载，兼容纯英文版部署。
 */
function serve_game_property(string $method, string $name): never
{
    if ($method !== 'GET' && $method !== 'HEAD') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED');
    }
    require_user();

    $path = data_dir() . '/game/properties/' . $name;
    if (!is_file($path)) {
        throw new ApiError(404, 'NOT_FOUND');
    }

    $content = (string) file_get_contents($path);
    prepare_streaming();
    header('content-type: text/xml; charset=utf-8');
    header('cache-control: private, max-age=86400');
    header('content-length: ' . strlen($content));
    if ($method === 'HEAD') {
        exit;
    }
    echo $content;
    exit;
}

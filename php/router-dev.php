<?php

// 本地开发路由器：php -S 127.0.0.1:8099 php/router-dev.php
// 模拟 Nginx 规则（见 nginx.conf.example）：
//   /api/** 与 /main.pak 进 index.php；存在的文件直出；
//   不存在且无扩展名的路径回退 index.html（带扩展名 404）。

declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$public = __DIR__ . '/public';

if ($uri === '/api' || str_starts_with($uri, '/api/') || $uri === '/main.pak' || str_starts_with($uri, '/game-properties/')) {
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    require $public . '/index.php';
    return true;
}

// 存在的文件交给内置服务器直出（含 /game/pvz-portable.js|wasm、/assets/**）
if ($uri !== '/' && is_file($public . $uri)) {
    return false;
}

// SPA 回退：无扩展名的缺失路径 → index.html；带扩展名 → 404
if (preg_match('/\.[^\/]+$/', $uri) !== 1) {
    $_SERVER['SCRIPT_NAME'] = '/index.html';
    header('content-type: text/html; charset=utf-8');
    readfile($public . '/index.html');
    return true;
}

http_response_code(404);
return true;

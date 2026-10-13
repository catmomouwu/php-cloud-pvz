<?php

// Cloud PvZ PHP 后端入口。
// Nginx 把 /api/** 与 /main.pak rewrite 到这里（见 php/nginx.conf.example）；
// 静态文件（index.html / player.html / assets/ / game/）由 Nginx 直接提供服务。
//
// 兼容两种目录布局（app 与 public 保持同级或父子相邻即可）：
//   布局一（webroot 指向 public/）：  site/public/index.php + site/app + site/data（app/data 在 webroot 外，最安全）
//   布局二（FTP 根目录即 webroot）：  webroot/index.php + webroot/app + webroot/data（依赖 Nginx deny 保护）

declare(strict_types=1);

define('CLOUD_PVZ_ENTRY', true);

$bootstrap = null;
foreach ([__DIR__ . '/../app/bootstrap.php', __DIR__ . '/app/bootstrap.php'] as $candidate) {
    if (is_file($candidate)) {
        $bootstrap = $candidate;
        break;
    }
}
if ($bootstrap === null) {
    http_response_code(500);
    header('content-type: text/plain; charset=utf-8');
    echo "app/ directory not found: expected next to index.php's parent or next to index.php itself";
    exit;
}

require $bootstrap;

try {
    route_request();
} catch (ApiError $e) {
    api_fail($e);
} catch (Throwable $e) {
    // 未预期错误：记录到主机错误日志，返回 500（不向客户端暴露细节）
    error_log('[cloud-pvz] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    header('content-type: application/json; charset=utf-8');
    echo json_encode([
        'statusCode' => 500,
        'statusMessage' => 'Internal Server Error',
        'data' => ['code' => 'INTERNAL_ERROR'],
    ], JSON_UNESCAPED_UNICODE);
}

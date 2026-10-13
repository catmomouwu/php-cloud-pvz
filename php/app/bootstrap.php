<?php

// 启动：入口守卫、加载配置、运行环境检查、加载各模块。
// app/ 内所有文件直接被访问时无任何输出（本文件有入口守卫，其余文件只定义函数）。

declare(strict_types=1);

// 只能由 public/index.php 进入，防止 app 文件被直接请求
if (!defined('CLOUD_PVZ_ENTRY')) {
    http_response_code(404);
    exit;
}

date_default_timezone_set('UTC');

/** 读取部署配置（config.php），缺失时给出明确报错 */
function config(string $key = ''): mixed
{
    static $config = null;
    if ($config === null) {
        $file = __DIR__ . '/config.php';
        if (!is_file($file)) {
            header('content-type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode(['error' => 'config missing: copy app/config.example.php to app/config.php and fill it in'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $config = require $file;
        if (!is_array($config)) {
            header('content-type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode(['error' => 'config invalid: config.php must return an array'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    return $key === '' ? $config : ($config[$key] ?? null);
}

/** 检查 PHP 扩展，缺什么直接报 500 并说明需要开什么 */
function check_extensions(): void
{
    $required = ['zip', 'mbstring'];
    $db = config('db');
    $driver = is_array($db) ? ($db['driver'] ?? 'mysql') : 'mysql';
    $required[] = $driver === 'sqlite' ? 'pdo_sqlite' : 'pdo_mysql';
    $missing = array_filter($required, static fn (string $ext): bool => !extension_loaded($ext));
    if ($missing !== []) {
        header('content-type: application/json; charset=utf-8');
        http_response_code(500);
        echo json_encode(['error' => 'missing PHP extensions: ' . implode(', ', $missing)], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

check_extensions();

require __DIR__ . '/http.php';
require __DIR__ . '/db.php';
require __DIR__ . '/store.php';
require __DIR__ . '/pvz.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/profiles.php';
require __DIR__ . '/snapshots.php';
require __DIR__ . '/router.php';

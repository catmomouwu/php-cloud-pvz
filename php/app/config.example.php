<?php

// 部署配置模板：复制为同目录下的 config.php 并按虚拟主机实际情况修改。

return [
    // 数据库：生产用 MySQL 5.7（utf8mb4），本地测试可用 sqlite
    'db' => [
        'driver' => 'mysql', // 'mysql' | 'sqlite'
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'cloud_pvz',
        'user' => 'cloud_pvz',
        'pass' => '',
        'charset' => 'utf8mb4',
        // driver = sqlite 时的数据库文件路径
        'sqlite_path' => __DIR__ . '/../data/cloud-pvz.sqlite',
    ],

    // 运行时数据目录：存档 zip 都放在这里，main.pak 默认在 data_dir/game/main.pak。
    // 强烈建议放到 webroot 之外（FTP 根目录下与 webroot 平级），此处填绝对路径；
    // 若只能放 webroot 内，必须保证 Nginx 已配置 deny 访问 /data/（见 nginx.conf.example）。
    'data_dir' => __DIR__ . '/../data',

    // main.pak 的位置。null 时使用 data_dir/game/main.pak；也可填绝对路径指向任意位置。
    'pak_path' => null,

    // 会话有效期（天）
    'session_days' => 7,
];

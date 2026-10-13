<?php

// 请求/响应助手：JSON 输出、错误对象（响应体形状对齐 h3 createError，前端读 body.data）、
// 请求体读取、毫秒时间格式化（对齐 JS Date.toISOString）。

declare(strict_types=1);

/** 业务错误：携带 HTTP 状态码与机器可读 code（对应 h3 createError 的 data.code） */
class ApiError extends Exception
{
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        public readonly array $data = [],
    ) {
        parent::__construct($errorCode);
    }
}

/** h3 的状态短语（前端不读它，保持一致即可） */
const STATUS_TEXT = [
    400 => 'Bad Request',
    401 => 'Unauthorized',
    404 => 'Not Found',
    405 => 'Method Not Allowed',
    409 => 'Conflict',
    413 => 'Payload Too Large',
    500 => 'Internal Server Error',
];

/** 输出错误 JSON：{"statusCode":N,"statusMessage":"...","data":{"code":"...",...}} */
function api_fail(ApiError $e): never
{
    http_response_code($e->status);
    header('content-type: application/json; charset=utf-8');
    echo json_encode([
        'statusCode' => $e->status,
        'statusMessage' => STATUS_TEXT[$e->status] ?? 'Error',
        'data' => array_merge(['code' => $e->errorCode], $e->data),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/** 输出 JSON 并结束 */
function api_json(mixed $value): never
{
    header('content-type: application/json; charset=utf-8');
    echo json_encode($value, JSON_UNESCAPED_UNICODE);
    exit;
}

/** 读取 JSON 请求体（POST/PATCH），空 body 返回 []，非法 JSON 抛 400 */
function request_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) {
        throw new ApiError(400, 'INVALID_BODY');
    }
    return $parsed;
}

/** Unix 毫秒 → ISO 8601（含毫秒，与 JS Date.toISOString() 一致） */
function iso_ms(int $ms): string
{
    return gmdate('Y-m-d\TH:i:s', intdiv($ms, 1000)) . sprintf('.%03dZ', $ms % 1000);
}

function now_ms(): int
{
    return (int) (microtime(true) * 1000);
}

/** 生成小写 UUID v4 */
function uuid_v4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

/** 去掉首尾空白（含 Unicode 空白，对齐 JS String.prototype.trim） */
function unicode_trim(string $value): string
{
    return (string) preg_replace('/^[\s\p{Zs}\x{FEFF}\x{2028}\x{2029}]+|[\s\p{Zs}\x{FEFF}\x{2028}\x{2029}]+$/u', '', $value);
}

/** 大文件输出前关闭压缩与缓冲，保证 content-length 正确、流式下发 */
function prepare_streaming(): void
{
    if (ini_get('zlib.output_compression')) {
        @ini_set('zlib.output_compression', '0');
    }
    while (ob_get_level() > 0) {
        ob_end_flush();
    }
}

/**
 * 从原始 Cookie 头解析指定 cookie。
 * PHP 会把 cookie 名里的点与空格换成下划线再放进 $_COOKIE，
 * 而 better-auth 的 cookie 名（better-auth.session_token）带点，必须手动解析。
 */
function cookie_value(string $name): ?string
{
    $header = $_SERVER['HTTP_COOKIE'] ?? '';
    if (!is_string($header) || $header === '') {
        return null;
    }
    foreach (explode(';', $header) as $part) {
        $pair = explode('=', trim($part), 2);
        if (count($pair) === 2 && urldecode($pair[0]) === $name) {
            return urldecode($pair[1]);
        }
    }
    return null;
}

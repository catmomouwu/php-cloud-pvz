<?php

// 邮箱+密码认证与会话，替代 better-auth（本项目只用到它的 4 个端点）。
// 响应线格式与 better-auth 客户端兼容：sign-in/sign-up 返回 { token, user }，
// get-session 返回 { session, user } 或 null；会话用 HttpOnly cookie 传递。

declare(strict_types=1);

const SESSION_COOKIE = 'better-auth.session_token';
const UUID_PATTERN = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/';

/** @return array{id:string,name:string,email:string,emailVerified:bool,image:string|null,createdAt:string,updatedAt:string} */
function user_dto(array $row): array
{
    return [
        'id' => (string) $row['user_id'],
        'name' => (string) $row['user_name'],
        'email' => (string) $row['user_email'],
        'emailVerified' => (bool) $row['user_email_verified'],
        'image' => $row['user_image'] !== null ? (string) $row['user_image'] : null,
        'createdAt' => iso_ms((int) $row['user_created_at']),
        'updatedAt' => iso_ms((int) $row['user_updated_at']),
    ];
}

/** @return array{id:string,userId:string,token:string,expiresAt:string,createdAt:string,updatedAt:string,ipAddress:string|null,userAgent:string|null} */
function session_dto(array $row): array
{
    return [
        'id' => (string) $row['session_id'],
        'userId' => (string) $row['user_id'],
        'token' => (string) $row['session_token'],
        'expiresAt' => iso_ms((int) $row['session_expires_at']),
        'createdAt' => iso_ms((int) $row['session_created_at']),
        'updatedAt' => iso_ms((int) $row['session_updated_at']),
        'ipAddress' => $row['session_ip_address'] !== null ? (string) $row['session_ip_address'] : null,
        'userAgent' => $row['session_user_agent'] !== null ? (string) $row['session_user_agent'] : null,
    ];
}

/** 邮箱规范：trim + 转小写（better-auth 行为）；不合法返回 null */
function normalize_email(mixed $value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $email = mb_strtolower(trim($value));
    return filter_var($email, FILTER_VALIDATE_EMAIL) === false ? null : $email;
}

function is_https(): bool
{
    $https = $_SERVER['HTTPS'] ?? '';
    if ($https !== '' && $https !== 'off') {
        return true;
    }
    return str_starts_with($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '', 'https');
}

/** 建会话并种 cookie；返回会话行 */
function create_session(string $userId): array
{
    $days = (int) (config('session_days') ?: 7);
    $now = now_ms();
    $expires = $now + $days * 86400000;
    $row = [
        'id' => uuid_v4(),
        'token' => bin2hex(random_bytes(32)),
        'user_id' => $userId,
        'expires_at' => $expires,
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
        'user_agent' => isset($_SERVER['HTTP_USER_AGENT']) ? mb_substr($_SERVER['HTTP_USER_AGENT'], 0, 255) : null,
        'created_at' => $now,
        'updated_at' => $now,
    ];

    $stmt = db()->prepare(
        'INSERT INTO session (id, token, user_id, expires_at, ip_address, user_agent, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    $stmt->execute([
        $row['id'], $row['token'], $row['user_id'], $row['expires_at'],
        $row['ip_address'], $row['user_agent'], $row['created_at'], $row['updated_at'],
    ]);

    setcookie(SESSION_COOKIE, $row['token'], [
        'expires' => intdiv($expires, 1000),
        'path' => '/',
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    return $row;
}

/** 当前会话（session 表 JOIN user 表，列带前缀）；无/过期返回 null。过期不删行，留待覆盖或清理。 */
function current_session(): ?array
{
    $token = cookie_value(SESSION_COOKIE);
    if ($token === null || preg_match('/^[0-9a-f]{64}$/', $token) !== 1) {
        return null;
    }
    $stmt = db()->prepare(
        'SELECT s.id AS session_id, s.token AS session_token, s.expires_at AS session_expires_at,
                s.ip_address AS session_ip_address, s.user_agent AS session_user_agent,
                s.created_at AS session_created_at, s.updated_at AS session_updated_at,
                u.id AS user_id, u.name AS user_name, u.email AS user_email,
                u.email_verified AS user_email_verified, u.image AS user_image,
                u.created_at AS user_created_at, u.updated_at AS user_updated_at,
                u.password_hash AS user_password_hash
         FROM session s JOIN user u ON u.id = s.user_id
         WHERE s.token = ?',
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if ($row === false) {
        return null;
    }
    if ((int) $row['session_expires_at'] < now_ms()) {
        return null;
    }
    return $row;
}

/** 需要登录的接口用；未登录抛 401 */
function require_user(): array
{
    $session = current_session();
    if ($session === null) {
        throw new ApiError(401, 'UNAUTHORIZED');
    }
    return $session;
}

// ---- 认证端点 ----

/** POST /api/auth/sign-up/email */
function auth_sign_up(array $body): never
{
    $email = normalize_email($body['email'] ?? null);
    $password = $body['password'] ?? null;
    $name = $body['name'] ?? null;

    if ($email === null) {
        throw new ApiError(400, 'INVALID_EMAIL');
    }
    if (!is_string($password) || strlen($password) < 8) {
        throw new ApiError(400, 'PASSWORD_TOO_SHORT');
    }
    if (!is_string($name) || unicode_trim($name) === '') {
        throw new ApiError(400, 'INVALID_NAME');
    }

    $stmt = db()->prepare('SELECT id FROM user WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch() !== false) {
        throw new ApiError(409, 'USER_ALREADY_EXISTS');
    }

    $now = now_ms();
    $id = uuid_v4();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = db()->prepare(
        'INSERT INTO user (id, name, email, email_verified, image, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, 0, NULL, ?, ?, ?)',
    );
    $stmt->execute([$id, unicode_trim($name), $email, $hash, $now, $now]);

    $session = create_session($id);
    $stmt = db()->prepare(
        'SELECT id AS user_id, name AS user_name, email AS user_email, email_verified AS user_email_verified,
                image AS user_image, created_at AS user_created_at, updated_at AS user_updated_at
         FROM user WHERE id = ?',
    );
    $stmt->execute([$id]);
    $user = $stmt->fetch();

    api_json(['token' => $session['token'], 'user' => user_dto($user)]);
}

/** POST /api/auth/sign-in/email */
function auth_sign_in(array $body): never
{
    $email = normalize_email($body['email'] ?? null);
    $password = $body['password'] ?? null;
    if ($email === null || !is_string($password)) {
        throw new ApiError(401, 'INVALID_EMAIL_OR_PASSWORD');
    }

    $stmt = db()->prepare(
        'SELECT id AS user_id, name AS user_name, email AS user_email, email_verified AS user_email_verified,
                image AS user_image, created_at AS user_created_at, updated_at AS user_updated_at,
                password_hash AS user_password_hash
         FROM user WHERE email = ?',
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if ($user === false || !password_verify($password, (string) $user['user_password_hash'])) {
        throw new ApiError(401, 'INVALID_EMAIL_OR_PASSWORD');
    }

    $session = create_session((string) $user['user_id']);
    api_json(['token' => $session['token'], 'user' => user_dto($user)]);
}

/** POST /api/auth/sign-out */
function auth_sign_out(): never
{
    $token = cookie_value(SESSION_COOKIE);
    if ($token !== null && preg_match('/^[0-9a-f]{64}$/', $token) === 1) {
        $stmt = db()->prepare('DELETE FROM session WHERE token = ?');
        $stmt->execute([$token]);
    }
    setcookie(SESSION_COOKIE, '', [
        'expires' => 1,
        'path' => '/',
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    api_json(['success' => true]);
}

/** GET /api/auth/get-session：无会话时输出 null（与 better-auth 一致） */
function auth_get_session(): never
{
    $session = current_session();
    if ($session === null) {
        header('content-type: application/json; charset=utf-8');
        echo 'null';
        exit;
    }
    api_json(['session' => session_dto($session), 'user' => user_dto($session)]);
}

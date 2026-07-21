<?php
// ================================================================
//  includes/helpers.php  –  UIU Friends Network
//  Shared utility functions used across all API endpoints
// ================================================================

// ── CORS & JSON Headers ───────────────────────────────────────────
function set_json_headers() {
    // Start session early so the session cookie is sent with CORS responses
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'secure'   => false,
            'httponly' => true,
            'samesite' => 'Lax',  // Lax (not Strict) so cross-page navigation works
        ]);
        session_start();
    }

    // Allow any localhost origin (covers :80, :8080, :3000, :8000, XAMPP, WAMP, etc.)
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $is_local = (
        $origin === '' ||
        preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin)
    );

    if ($is_local && $origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
    } elseif ($origin === '') {
        // Same-origin request (no Origin header) — no CORS header needed
    } else {
        // Non-local origin — still respond, but without credentials
        header('Access-Control-Allow-Origin: ' . $origin);
    }

    header('Vary: Origin');
    header('Content-Type: application/json; charset=UTF-8');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token');
    header('Access-Control-Allow-Credentials: true');

    // Handle preflight OPTIONS request
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// ── JSON Response Helpers ─────────────────────────────────────────
function send_success($data = [], $message = 'Success', $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data'    => $data,
    ]);
    exit;
}

function send_error($message = 'An error occurred', $code = 400, $errors = []) {
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'message' => $message,
        'errors'  => $errors,
    ]);
    exit;
}

// ── Session Auth Guard ────────────────────────────────────────────
function get_logged_in_user_id() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!empty($_SESSION['user_id'])) {
        return (int)$_SESSION['user_id'];
    }
    return null;
}

function require_login() {
    $user_id = get_logged_in_user_id();
    if (!$user_id) {
        send_error('Unauthorized. Please log in.', 401);
    }
    return $user_id;
}

// ── CSRF Token helpers ────────────────────────────────────────────
function generate_csrf_token(): string {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf_token(): void {
    if (session_status() === PHP_SESSION_NONE) session_start();
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '';
    if (empty($token) || empty($_SESSION['csrf_token'])) {
        send_error('CSRF token missing or invalid.', 403);
    }
    if (!hash_equals($_SESSION['csrf_token'], $token)) {
        send_error('CSRF token mismatch.', 403);
    }
}

// ── Input sanitisation ────────────────────────────────────────────
function clean_str($value) {
    return htmlspecialchars(strip_tags(trim((string)$value)), ENT_QUOTES, 'UTF-8');
}

function get_post_body() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

// ── Password helpers ─────────────────────────────────────────────
function hash_password($plain) {
    return password_hash($plain, PASSWORD_BCRYPT, ['cost' => 12]);
}

function verify_password($plain, $hash) {
    return password_verify($plain, $hash);
}

// ── Pagination helper ─────────────────────────────────────────────
function get_pagination(int $page = 1, int $per_page = 10): array {
    $page     = max(1, $page);
    $per_page = min(100, max(1, $per_page));
    $offset   = ($page - 1) * $per_page;
    return compact('page', 'per_page', 'offset');
}

// ── Create a notification ─────────────────────────────────────────
function create_notification(PDO $pdo, int $user_id, string $type, string $title, string $body, ?int $ref_id = null, string $ref_type = '') {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO notification (user_id, type, title, body, reference_id, reference_type)
            VALUES (:user_id, :type, :title, :body, :ref_id, :ref_type)
        ");
        $stmt->execute([
            ':user_id'  => $user_id,
            ':type'     => $type,
            ':title'    => $title,
            ':body'     => $body,
            ':ref_id'   => $ref_id,
            ':ref_type' => $ref_type,
        ]);
    } catch (Exception $e) {
        // Non-fatal — don't crash the main action if notification fails
        error_log('create_notification failed: ' . $e->getMessage());
    }
}

// ── File Upload Helper ────────────────────────────────────────────
function handle_file_upload(string $field_name, string $upload_dir, array $allowed_types = ['image/jpeg','image/png','image/webp','application/pdf']): ?string {
    if (!isset($_FILES[$field_name]) || $_FILES[$field_name]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }
    $file  = $_FILES[$field_name];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file['tmp_name']);

    if (!in_array($mime, $allowed_types)) {
        send_error('Invalid file type. Allowed: ' . implode(', ', $allowed_types));
    }

    if ($file['size'] > 5 * 1024 * 1024) {
        send_error('File too large. Maximum 5 MB allowed.');
    }

    $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid('', true) . '.' . strtolower($ext);
    $dest     = rtrim($upload_dir, '/') . '/' . $filename;

    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        send_error('Failed to save uploaded file.');
    }

    return $filename;
}

<?php
// ================================================================
//  api/auth/login.php  –  UIU Friends Network
//  POST → Authenticate a user and start a session
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error('Method not allowed.', 405);
}

// Session is already started by set_json_headers() via helpers.php with correct cookie params

// ── Read Input ───────────────────────────────────────────────────
$body = get_post_body();

// Fix #1: Use plain trim() not clean_str() — htmlspecialchars() breaks email matching (@ → &#64;)
$student_id_or_email = trim($body['studentId'] ?? $_POST['studentId'] ?? '');
$password            = $body['password']       ?? $_POST['password']       ?? '';

if (empty($student_id_or_email) || empty($password)) {
    send_error('Please provide both Student ID/Email and Password.');
}

// ── Fetch user ───────────────────────────────────────────────────
$stmt = $pdo->prepare("
    SELECT user_id, full_name, email, password_hash, student_id, role, is_active, profile_photo
    FROM user
    WHERE student_id = :input_sid OR email = :input_email
    LIMIT 1
");
$stmt->execute([
    ':input_sid'   => $student_id_or_email,
    ':input_email' => $student_id_or_email,
]);
$user = $stmt->fetch();

if (!$user || !verify_password($password, $user['password_hash'])) {
    send_error('Invalid ID/Email or Password. Please try again.', 401);
}

if (!$user['is_active']) {
    send_error('Your account is currently inactive. Please contact an administrator.', 403);
}

// ── Establish Session ────────────────────────────────────────────
// Fix #12: Generate a CSRF token on login and send it to the frontend
$_SESSION['user_id']    = (int)$user['user_id'];
$_SESSION['full_name']  = $user['full_name'];
$_SESSION['email']      = $user['email'];
$_SESSION['student_id'] = $user['student_id'];
$_SESSION['role']       = $user['role'];
$csrf_token = generate_csrf_token();

// ── Send success response ────────────────────────────────────────
send_success([
    'user_id'       => (int)$user['user_id'],
    'full_name'     => $user['full_name'],
    'email'         => $user['email'],
    'student_id'    => $user['student_id'],
    'role'          => $user['role'],
    'profile_photo' => $user['profile_photo'],
    'csrf_token'    => $csrf_token,  // Fix #12: frontend must store and send this
], 'Login successful!');

<?php
// ================================================================
//  api/user/update_profile.php  –  UIU Friends Network
//  POST (multipart) → Upload profile photo
//  POST (application/json) → Update name, phone, department
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error('Method not allowed.', 405);
}

$user_id = require_login();

$content_type = $_SERVER['CONTENT_TYPE'] ?? '';

// ── JSON body: update text fields ─────────────────────────────────
if (strpos($content_type, 'application/json') !== false) {
    $body = get_post_body();

    $full_name  = isset($body['full_name'])  ? trim($body['full_name'])  : null;
    $phone      = isset($body['phone'])      ? trim($body['phone'])      : null;
    $department = isset($body['department']) ? trim($body['department']) : null;

    $fields = [];
    $params = [':id' => $user_id];

    if ($full_name !== null && $full_name !== '') {
        $fields[] = 'full_name = :full_name';
        $params[':full_name'] = htmlspecialchars($full_name, ENT_QUOTES, 'UTF-8');
    }
    if ($phone !== null) {
        $fields[] = 'phone = :phone';
        $params[':phone'] = $phone !== '' ? $phone : null;
    }
    if ($department !== null) {
        $fields[] = 'department = :department';
        $params[':department'] = $department !== '' ? $department : null;
    }

    if (empty($fields)) {
        send_error('No valid fields provided for update.');
    }

    $pdo->prepare('UPDATE user SET ' . implode(', ', $fields) . ' WHERE user_id = :id')
        ->execute($params);

    $stmt = $pdo->prepare('SELECT user_id, full_name, email, phone, student_id, department, profile_photo FROM user WHERE user_id = :id');
    $stmt->execute([':id' => $user_id]);
    send_success($stmt->fetch(), 'Profile updated successfully.');
}

// ── Multipart form: photo upload ──────────────────────────────────
$upload_dir = __DIR__ . '/../../../uploads/profiles/';
$filename   = handle_file_upload('profile_photo', $upload_dir, ['image/jpeg', 'image/png', 'image/webp']);

if (!$filename) {
    send_error('No valid image file provided. Please upload a JPG, PNG, or WebP image (max 5 MB).');
}

$pdo->prepare("UPDATE user SET profile_photo = :photo WHERE user_id = :id")
    ->execute([':photo' => $filename, ':id' => $user_id]);

send_success(['profile_photo' => $filename], 'Profile photo updated successfully.');

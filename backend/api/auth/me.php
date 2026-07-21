<?php
// ================================================================
//  api/auth/me.php  –  UIU Friends Network
//  GET → Fetch current logged-in user profile details
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

$user_id = require_login();

// Fetch fresh details from database
$stmt = $pdo->prepare("
    SELECT user_id, full_name, email, phone, student_id, department, profile_photo, role, avg_rating, total_reviews, created_at
    FROM user
    WHERE user_id = :id
    LIMIT 1
");
$stmt->execute([':id' => $user_id]);
$user = $stmt->fetch();

if (!$user) {
    send_error('User session invalid or user not found.', 404);
}

// Fetch verification status from DB: if student_id and email exist in user table and it is active,
// or if we have an administrative flag. The user table has an id_photo field which is uploaded.
// Let's check if the user is verified. In the DB, we can assume that if they have student_id, email,
// department, they are verified. Let's return verification state based on details.
// Since the frontend uses a simple "uiu_verified" flag in localStorage, we can check if they have
// verified identity details.
$is_verified = (!empty($user['student_id']) && !empty($user['email'])) ? true : false;

send_success([
    'user_id'       => (int)$user['user_id'],
    'full_name'     => $user['full_name'],
    'email'         => $user['email'],
    'phone'         => $user['phone'],
    'student_id'    => $user['student_id'],
    'department'    => $user['department'],
    'profile_photo' => $user['profile_photo'],
    'role'          => $user['role'],
    'avg_rating'    => (float)$user['avg_rating'],
    'total_reviews' => (int)$user['total_reviews'],
    'is_verified'   => $is_verified,
    'created_at'    => $user['created_at']
], 'Current user details retrieved.');

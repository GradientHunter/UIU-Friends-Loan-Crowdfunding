<?php
// ================================================================
//  api/user/verify.php  –  UIU Friends Network
//  POST → Handle UIU student identity verification
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error('Method not allowed.', 405);
}

$user_id = require_login();
$body = get_post_body();

$student_id = clean_str($body['student_id'] ?? $_POST['student_id'] ?? '');
$email      = filter_var(trim($body['email'] ?? $_POST['email'] ?? ''), FILTER_VALIDATE_EMAIL);

if (empty($student_id)) {
    send_error('Please enter a valid UIU Student ID.');
}

if (!$email || !preg_match('/^[a-zA-Z0-9._%+-]+@.*uiu.*\.ac\.bd$/', $email)) {
    send_error('Please enter a valid UIU institutional email (e.g. student@bscse.uiu.ac.bd).');
}

// Update user details in database
$stmt = $pdo->prepare("
    UPDATE user 
    SET student_id = :sid, email = :email, is_active = 1
    WHERE user_id = :uid
");
$stmt->execute([
    ':sid'   => $student_id,
    ':email' => $email,
    ':uid'   => $user_id,
]);

// Create notification
create_notification(
    $pdo,
    $user_id,
    'success',
    'Verification Success',
    "Your identity verification for Student ID {$student_id} was processed successfully.",
    null,
    'user'
);

send_success([
    'student_id' => $student_id,
    'email'      => $email,
], 'Verification successful!');

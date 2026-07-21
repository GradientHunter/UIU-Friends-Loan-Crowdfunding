<?php
// ================================================================
//  api/auth/register.php  –  UIU Friends Network
//  POST → Register a new student user
//
//  Expects multipart/form-data OR application/json:
//    full_name, student_id, email, password, department (opt),
//    semester (opt), id_card [file upload]
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error('Method not allowed.', 405);
}

// ── Read Input ───────────────────────────────────────────────────
$full_name  = clean_str($_POST['full_name']  ?? '');
$student_id = clean_str($_POST['student_id'] ?? '');
$email      = filter_var(trim($_POST['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$password   = $_POST['password'] ?? '';
$department = clean_str($_POST['department'] ?? '');
$phone      = clean_str($_POST['phone'] ?? '');

// ── Validation ───────────────────────────────────────────────────
$errors = [];

if (empty($full_name))  $errors[] = 'Full name is required.';
if (empty($student_id)) $errors[] = 'Student ID is required.';
if (!$email)            $errors[] = 'A valid email address is required.';
if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters.';

// UIU email validation
if ($email && !preg_match('/^[a-zA-Z0-9._%+\-]+@.*uiu.*\.ac\.bd$/', $email)) {
    $errors[] = 'Email must be a valid UIU institutional email (e.g. student@bscse.uiu.ac.bd).';
}

if (!empty($errors)) {
    send_error('Validation failed.', 422, $errors);
}

// ── Check duplicates ─────────────────────────────────────────────
$check = $pdo->prepare("SELECT user_id FROM user WHERE student_id = :sid OR email = :email LIMIT 1");
$check->execute([':sid' => $student_id, ':email' => $email]);
if ($check->fetch()) {
    send_error('A user with this Student ID or Email already exists.', 409);
}

// ── Handle ID card file upload ────────────────────────────────────
// In user table it's id_photo
$upload_dir = __DIR__ . '/../../../uploads/id_cards/'; // Fix #4: public uploads folder
$id_photo_filename = handle_file_upload('id_card', $upload_dir, ['image/jpeg', 'image/png', 'image/webp']);

// ── Insert user ───────────────────────────────────────────────────
// Fix #7: Insert with is_active=1 directly — no need for a second UPDATE query
$hashed_pw = hash_password($password);
$stmt = $pdo->prepare("
    INSERT INTO user
        (full_name, student_id, email, password_hash, department, phone, id_photo, role, is_active)
    VALUES
        (:full_name, :student_id, :email, :password_hash, :department, :phone, :id_photo, 'student', 1)
");
$stmt->execute([
    ':full_name'     => $full_name,
    ':student_id'    => $student_id,
    ':email'         => $email,
    ':password_hash' => $hashed_pw,
    ':department'    => $department ?: null,
    ':phone'         => $phone ?: null,
    ':id_photo'      => $id_photo_filename,
]);

$new_user_id = (int)$pdo->lastInsertId();

send_success(
    ['user_id' => $new_user_id],
    'Registration successful! You can now log in.',
    201
);

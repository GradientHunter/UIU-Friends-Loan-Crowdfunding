<?php
// ================================================================
//  api/user/payment_methods.php  –  UIU Friends Network
//  GET  → List logged-in user's saved payment methods
//  POST → Add a new payment method
//  DELETE → Remove a payment method (?method_id=N)
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

$user_id = require_login();

// ---- Ensure the payment_method table exists (auto-migrate) ----
$pdo->exec("
    CREATE TABLE IF NOT EXISTS `payment_method` (
        `method_id`   INT(11)       NOT NULL AUTO_INCREMENT,
        `user_id`     INT(11)       NOT NULL,
        `type`        ENUM('bkash','nagad','bank','other') NOT NULL DEFAULT 'bkash',
        `account_number` VARCHAR(100) NOT NULL,
        `account_name`   VARCHAR(100) NOT NULL,
        `is_default`  TINYINT(1)    NOT NULL DEFAULT 0,
        `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`method_id`),
        KEY `fk_pm_user` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
");

$method = $_SERVER['REQUEST_METHOD'];

// ---- GET: list payment methods ----
if ($method === 'GET') {
    $stmt = $pdo->prepare("SELECT method_id, type, account_number, account_name, is_default, created_at FROM payment_method WHERE user_id = :uid ORDER BY is_default DESC, created_at ASC");
    $stmt->execute([':uid' => $user_id]);
    $methods = $stmt->fetchAll();

    send_success($methods, 'Payment methods retrieved.');
}

// ---- POST: add new payment method ----
elseif ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];

    $type           = clean_str($body['type']           ?? 'bkash');
    $account_number = clean_str($body['account_number'] ?? '');
    $account_name   = clean_str($body['account_name']   ?? '');

    $allowed_types = ['bkash', 'nagad', 'bank', 'other'];
    if (!in_array($type, $allowed_types)) {
        send_error('Invalid payment method type. Allowed: bkash, nagad, bank, other.');
    }

    if (empty($account_number)) {
        send_error('Account number is required.');
    }

    if (empty($account_name)) {
        send_error('Account holder name is required.');
    }

    // Check if user already has this exact account
    $dup = $pdo->prepare("SELECT method_id FROM payment_method WHERE user_id = :uid AND account_number = :num AND type = :type");
    $dup->execute([':uid' => $user_id, ':num' => $account_number, ':type' => $type]);
    if ($dup->fetch()) {
        send_error('This payment method account is already saved.');
    }

    // Check if this is the first method for the user (make it default)
    $count_stmt = $pdo->prepare("SELECT COUNT(*) FROM payment_method WHERE user_id = :uid");
    $count_stmt->execute([':uid' => $user_id]);
    $is_default = ($count_stmt->fetchColumn() == 0) ? 1 : 0;

    $insert = $pdo->prepare("INSERT INTO payment_method (user_id, type, account_number, account_name, is_default) VALUES (:uid, :type, :num, :name, :def)");
    $insert->execute([
        ':uid'  => $user_id,
        ':type' => $type,
        ':num'  => $account_number,
        ':name' => $account_name,
        ':def'  => $is_default
    ]);

    $new_id = (int)$pdo->lastInsertId();

    send_success([
        'method_id'      => $new_id,
        'type'           => $type,
        'account_number' => $account_number,
        'account_name'   => $account_name,
        'is_default'     => (bool)$is_default
    ], 'Payment method added successfully.');
}

// ---- DELETE: remove a payment method ----
elseif ($method === 'DELETE') {
    $method_id = (int)($_GET['method_id'] ?? 0);

    if (!$method_id) {
        send_error('method_id is required.');
    }

    // Verify ownership
    $check = $pdo->prepare("SELECT method_id, is_default FROM payment_method WHERE method_id = :mid AND user_id = :uid");
    $check->execute([':mid' => $method_id, ':uid' => $user_id]);
    $row = $check->fetch();

    if (!$row) {
        send_error('Payment method not found or access denied.', 404);
    }

    $pdo->prepare("DELETE FROM payment_method WHERE method_id = :mid")->execute([':mid' => $method_id]);

    // If deleted method was default, assign default to remaining first method
    if ($row['is_default']) {
        $pdo->prepare("UPDATE payment_method SET is_default = 1 WHERE user_id = :uid ORDER BY created_at ASC LIMIT 1")->execute([':uid' => $user_id]);
    }

    send_success(['method_id' => $method_id], 'Payment method removed.');
}

// ---- PATCH: set a payment method as default ----
elseif ($method === 'PATCH') {
    $method_id = (int)($_GET['method_id'] ?? 0);

    if (!$method_id) {
        send_error('method_id is required.');
    }

    // Verify ownership
    $check = $pdo->prepare("SELECT method_id FROM payment_method WHERE method_id = :mid AND user_id = :uid");
    $check->execute([':mid' => $method_id, ':uid' => $user_id]);
    if (!$check->fetch()) {
        send_error('Payment method not found or access denied.', 404);
    }

    // Clear existing default for this user, then set new one
    $pdo->prepare("UPDATE payment_method SET is_default = 0 WHERE user_id = :uid")->execute([':uid' => $user_id]);
    $pdo->prepare("UPDATE payment_method SET is_default = 1 WHERE method_id = :mid")->execute([':mid' => $method_id]);

    send_success(['method_id' => $method_id], 'Default payment method updated.');
}

else {
    send_error('Method not allowed.', 405);
}

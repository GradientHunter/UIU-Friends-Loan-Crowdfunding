<?php
// ================================================================
//  api/loan/messages.php  –  UIU Friends Network
//  GET  → Retrieve chat messages for a specific loan agreement
//  POST → Send a chat message (Requires login)
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

$method = $_SERVER['REQUEST_METHOD'];
$user_id = require_login();

// ── GET: Get messages for an agreement ────────────────────────────
if ($method === 'GET') {
    $agreement_id = (int)($_GET['agreement_id'] ?? 0);
    if ($agreement_id <= 0) {
        send_error('Agreement ID is required.');
    }

    // Verify user is a participant
    $ag_stmt = $pdo->prepare("SELECT borrower_id, lender_id FROM loan_agreement WHERE agreement_id = :aid LIMIT 1");
    $ag_stmt->execute([':aid' => $agreement_id]);
    $ag = $ag_stmt->fetch();

    if (!$ag || ($ag['borrower_id'] != $user_id && $ag['lender_id'] != $user_id)) {
        send_error('Unauthorized to view this agreement\'s chat.', 403);
    }

    $stmt = $pdo->prepare("
        SELECT m.message_id, m.sender_id, m.receiver_id, m.content, m.sent_at,
               u.full_name as sender_name
        FROM message m
        JOIN user u ON m.sender_id = u.user_id
        WHERE m.agreement_id = :aid
        ORDER BY m.sent_at ASC
    ");
    $stmt->execute([':aid' => $agreement_id]);
    $messages = [];

    while ($row = $stmt->fetch()) {
        $messages[] = [
            'message_id'  => (int)$row['message_id'],
            'sender_id'   => (int)$row['sender_id'],
            'receiver_id' => (int)$row['receiver_id'],
            'content'     => $row['content'],
            'sent_at'     => $row['sent_at'],
            'sender_name' => $row['sender_name'],
            'is_mine'     => ($row['sender_id'] == $user_id),
        ];
    }

    send_success($messages, 'Messages retrieved.');
}

// ── POST: Send a message ──────────────────────────────────────────
if ($method === 'POST') {
    $body = get_post_body();
    $agreement_id = (int)($body['agreement_id'] ?? $_POST['agreement_id'] ?? 0);
    $content      = clean_str($body['content']      ?? $_POST['content']      ?? '');

    if ($agreement_id <= 0 || empty($content)) {
        send_error('Agreement ID and content are required.');
    }

    // Verify user is participant and find receiver
    $ag_stmt = $pdo->prepare("SELECT borrower_id, lender_id FROM loan_agreement WHERE agreement_id = :aid LIMIT 1");
    $ag_stmt->execute([':aid' => $agreement_id]);
    $ag = $ag_stmt->fetch();

    if (!$ag) {
        send_error('Loan agreement not found.', 404);
    }

    if ($ag['borrower_id'] != $user_id && $ag['lender_id'] != $user_id) {
        send_error('Unauthorized to chat in this agreement room.', 403);
    }

    $receiver_id = ($ag['borrower_id'] == $user_id) ? $ag['lender_id'] : $ag['borrower_id'];

    // Insert message
    $stmt = $pdo->prepare("
        INSERT INTO message (agreement_id, sender_id, receiver_id, content, is_read)
        VALUES (:aid, :sender_id, :receiver_id, :content, 0)
    ");
    $stmt->execute([
        ':aid'         => $agreement_id,
        ':sender_id'   => $user_id,
        ':receiver_id' => $receiver_id,
        ':content'     => $content,
    ]);

    $new_message_id = (int)$pdo->lastInsertId();

    send_success(['message_id' => $new_message_id], 'Message sent.', 201);
}

send_error('Method not allowed.', 405);

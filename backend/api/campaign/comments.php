<?php
// ================================================================
//  api/campaign/comments.php  –  UIU Friends Network
//  GET  → Get comments for a specific campaign
//  POST → Add a comment to a campaign (Requires login)
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: List comments ──────────────────────────────────────────
if ($method === 'GET') {
    $campaign_id = (int)($_GET['campaign_id'] ?? 0);
    if ($campaign_id <= 0) {
        send_error('Campaign ID is required.');
    }

    $stmt = $pdo->prepare("
        SELECT cc.comment_id, cc.campaign_id, cc.user_id, cc.parent_comment_id, cc.content, cc.created_at,
               u.full_name, u.profile_photo
        FROM campaign_comment cc
        JOIN user u ON cc.user_id = u.user_id
        WHERE cc.campaign_id = :cid
        ORDER BY cc.created_at DESC
    ");
    $stmt->execute([':cid' => $campaign_id]);
    $comments = [];

    while ($row = $stmt->fetch()) {
        // Calculate nice relative time
        $time = strtotime($row['created_at']);
        $diff = time() - $time;
        if ($diff < 60) {
            $time_str = 'Just now';
        } elseif ($diff < 3600) {
            $time_str = round($diff / 60) . 'm ago';
        } elseif ($diff < 86400) {
            $time_str = round($diff / 3600) . 'h ago';
        } else {
            $time_str = date('M d', $time);
        }

        $comments[] = [
            'comment_id'    => (int)$row['comment_id'],
            'user_id'       => (int)$row['user_id'],
            'full_name'     => $row['full_name'],
            'profile_photo' => $row['profile_photo'],
            'content'       => $row['content'],
            'time_str'      => $time_str,
            'created_at'    => $row['created_at'],
        ];
    }

    send_success($comments, 'Comments retrieved.');
}

// ── POST: Add a new comment ──────────────────────────────────────
if ($method === 'POST') {
    $user_id = require_login();
    $body = get_post_body();

    $campaign_id = (int)($body['campaign_id'] ?? $_POST['campaign_id'] ?? 0);
    $content     = clean_str($body['content']      ?? $_POST['content']      ?? '');

    if ($campaign_id <= 0 || empty($content)) {
        send_error('Campaign ID and comment content are required.');
    }

    // Insert comment
    $stmt = $pdo->prepare("
        INSERT INTO campaign_comment (campaign_id, user_id, content)
        VALUES (:cid, :uid, :content)
    ");
    $stmt->execute([
        ':cid'     => $campaign_id,
        ':uid'     => $user_id,
        ':content' => $content,
    ]);

    $new_comment_id = (int)$pdo->lastInsertId();

    send_success(['comment_id' => $new_comment_id], 'Comment added successfully.', 201);
}

send_error('Method not allowed.', 405);

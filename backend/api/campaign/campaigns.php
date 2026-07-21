<?php
// ================================================================
//  api/campaign/campaigns.php  –  UIU Friends Network
//  GET  → Retrieve active crowdfunding campaigns
//  POST → Start a new crowdfunding campaign (Requires login)
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: List crowdfunding campaigns ──────────────────────────────
if ($method === 'GET') {
    $search   = clean_str($_GET['search'] ?? '');
    $category = clean_str($_GET['category'] ?? '');
    $my_only  = !empty($_GET['my']) && $_GET['my'] === '1';

    // If ?my=1, only return campaigns by the logged-in user
    $filter_user_id = null;
    if ($my_only) {
        $filter_user_id = get_logged_in_user_id();
    }

    $query = "
        SELECT c.campaign_id, c.creator_id, c.title, c.description, c.target_amount, 
               c.collected_amount, c.category, c.proof_document, c.cover_image, 
               c.status, c.views_count, c.deadline, c.created_at,
               u.full_name as creator_name, u.profile_photo as creator_photo
        FROM campaign c
        JOIN user u ON c.creator_id = u.user_id
        WHERE c.status = 'active'
    ";

    $params = [];
    if ($filter_user_id) {
        $query .= " AND c.creator_id = :creator_id";
        $params[':creator_id'] = $filter_user_id;
    }
    if (!empty($search)) {
        $query .= " AND (c.title LIKE :search OR c.description LIKE :search)";
        $params[':search'] = '%' . $search . '%';
    }
    if (!empty($category)) {
        $query .= " AND c.category = :category";
        $params[':category'] = $category;
    }

    $query .= " ORDER BY c.created_at DESC";

    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $campaigns = [];

    while ($row = $stmt->fetch()) {
        $campaign_id = (int)$row['campaign_id'];

        // Get count of unique donors
        $donors_stmt = $pdo->prepare("SELECT COUNT(DISTINCT donor_id) FROM donation WHERE campaign_id = :cid");
        $donors_stmt->execute([':cid' => $campaign_id]);
        $donors_count = (int)$donors_stmt->fetchColumn();

        // Get avatars for last few donors
        $avatars_stmt = $pdo->prepare("
            SELECT DISTINCT COALESCE(u.full_name, 'Anonymous') as name
            FROM donation d
            LEFT JOIN user u ON d.donor_id = u.user_id
            WHERE d.campaign_id = :cid
            ORDER BY d.created_at DESC
            LIMIT 4
        ");
        $avatars_stmt->execute([':cid' => $campaign_id]);
        $donor_avatars = [];
        while ($avatar_row = $avatars_stmt->fetch()) {
            $names = explode(' ', $avatar_row['name']);
            $initials = '';
            foreach ($names as $n) {
                $initials .= strtoupper(substr($n, 0, 1));
            }
            $donor_avatars[] = substr($initials, 0, 1) ?: 'A';
        }

        // Calculate progress percentage
        $target = (float)$row['target_amount'];
        $collected = (float)$row['collected_amount'];
        $progress = $target > 0 ? round(($collected / $target) * 100) : 0;

        // Calculate days left
        $days_left = 0;
        if (!empty($row['deadline'])) {
            $deadline = new DateTime($row['deadline']);
            $today = new DateTime();
            $diff = $today->diff($deadline);
            $days_left = $diff->invert ? 0 : $diff->days;
        }

        $campaigns[] = [
            'campaign_id'      => $campaign_id,
            'creator_id'       => (int)$row['creator_id'],
            'creator_name'     => $row['creator_name'],
            'creator_photo'    => $row['creator_photo'],
            'title'            => $row['title'],
            'description'      => $row['description'],
            'target_amount'    => $target,
            'collected_amount' => $collected,
            'category'         => $row['category'],
            'proof_document'   => $row['proof_document'],
            'cover_image'      => $row['cover_image'],
            'deadline'         => $row['deadline'],
            'days_left'        => $days_left,
            'progress_percent' => $progress,
            'donors_count'     => $donors_count,
            'donor_avatars'    => $donor_avatars,
            'created_at'       => $row['created_at'],
        ];
    }

    send_success($campaigns, 'Campaigns retrieved.');
}

// ── POST: Create a new campaign ──────────────────────────────────
if ($method === 'POST') {
    $user_id = require_login();

    // Check if files are uploaded
    $upload_dir_cover = __DIR__ . '/../../../uploads/campaigns/covers/'; // Fix #4: public uploads folder
    $upload_dir_proof = __DIR__ . '/../../../uploads/campaigns/proofs/'; // Fix #4: public uploads folder

    $cover_filename = handle_file_upload('cover_image', $upload_dir_cover, ['image/jpeg', 'image/png', 'image/webp']);
    $proof_filename = handle_file_upload('proof_document', $upload_dir_proof, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

    $title         = clean_str($_POST['title']         ?? '');
    $description   = clean_str($_POST['description']   ?? '');
    $target_amount = (float)($_POST['target_amount']   ?? 0);
    $category      = clean_str($_POST['category']      ?? 'other');
    $deadline      = clean_str($_POST['deadline']      ?? '');

    $errors = [];
    if (empty($title))         $errors[] = 'Title is required.';
    if (empty($description))   $errors[] = 'Description is required.';
    if ($target_amount <= 0)   $errors[] = 'Target amount must be greater than 0.';
    if (empty($deadline))      $errors[] = 'Deadline is required.';
    if (!$cover_filename)      $errors[] = 'Cover image is required.';
    if (!$proof_filename)      $errors[] = 'Verification proof document is required.';

    $valid_categories = ['education', 'medical', 'emergency', 'project', 'other'];
    if (!in_array($category, $valid_categories)) {
        $errors[] = 'Invalid category specified.';
    }

    if (!empty($errors)) {
        send_error('Validation failed.', 422, $errors);
    }

    // Insert Campaign
    $stmt = $pdo->prepare("
        INSERT INTO campaign 
            (creator_id, title, description, target_amount, category, cover_image, proof_document, deadline, status)
        VALUES 
            (:creator_id, :title, :description, :target_amount, :category, :cover, :proof, :deadline, 'active')
    ");
    $stmt->execute([
        ':creator_id'    => $user_id,
        ':title'         => $title,
        ':description'   => $description,
        ':target_amount' => $target_amount,
        ':category'      => $category,
        ':cover'         => $cover_filename,
        ':proof'         => $proof_filename,
        ':deadline'      => $deadline,
    ]);

    $new_campaign_id = (int)$pdo->lastInsertId();

    create_notification(
        $pdo,
        $user_id,
        'info',
        'Campaign Launched!',
        "Your crowdfunding campaign '{$title}' is now live.",
        $new_campaign_id,
        'campaign'
    );

    send_success(['campaign_id' => $new_campaign_id], 'Campaign created successfully.', 201);
}

send_error('Method not allowed.', 405);

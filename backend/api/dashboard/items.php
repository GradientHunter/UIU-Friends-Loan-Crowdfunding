<?php
// ================================================================
//  api/dashboard/items.php  –  UIU Friends Network
//  GET → Fetch top items for the dashboard sections
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

// ── 1. Fetch Top 2 Urgent Loan Requests ───────────────────────────
$loans_stmt = $pdo->query("
    SELECT lr.loan_id, lr.borrower_id, lr.amount, lr.purpose, lr.repayment_deadline, lr.max_interest_rate, lr.created_at,
           u.full_name, u.profile_photo
    FROM loan_request lr
    JOIN user u ON lr.borrower_id = u.user_id
    WHERE lr.status = 'open'
    ORDER BY lr.created_at DESC
    LIMIT 2
");
$loans = [];
while ($row = $loans_stmt->fetch()) {
    // Calculate remaining days
    $deadline = new DateTime($row['repayment_deadline']);
    $today = new DateTime();
    $diff = $today->diff($deadline);
    $days_left = $diff->invert ? 0 : $diff->days;

    // Generate user initials for avatar fallback
    $names = explode(' ', $row['full_name']);
    $initials = '';
    foreach ($names as $n) {
        $initials .= strtoupper(substr($n, 0, 1));
    }
    $initials = substr($initials, 0, 2);

    $loans[] = [
        'loan_id'           => (int)$row['loan_id'],
        'borrower_id'       => (int)$row['borrower_id'],
        'full_name'         => $row['full_name'],
        'profile_photo'     => $row['profile_photo'],
        'initials'          => $initials,
        'amount'            => (float)$row['amount'],
        'purpose'           => $row['purpose'],
        'max_interest_rate' => (float)$row['max_interest_rate'],
        'days_left'         => $days_left,
    ];
}

// ── 2. Fetch Top 2 Trending Crowdfunding Campaigns ──────────────────
$campaigns_stmt = $pdo->query("
    SELECT c.campaign_id, c.creator_id, c.title, c.description, c.target_amount, c.collected_amount, c.cover_image, c.created_at,
           u.full_name
    FROM campaign c
    JOIN user u ON c.creator_id = u.user_id
    WHERE c.status = 'active'
    ORDER BY c.created_at DESC
    LIMIT 2
");
$campaigns = [];
while ($row = $campaigns_stmt->fetch()) {
    $campaign_id = (int)$row['campaign_id'];

    // Fetch count of unique donors
    $donors_stmt = $pdo->prepare("SELECT COUNT(DISTINCT donor_id) FROM donation WHERE campaign_id = :cid");
    $donors_stmt->execute([':cid' => $campaign_id]);
    $donors_count = (int)$donors_stmt->fetchColumn();

    // Fetch donor initials or names (last 3 donors to show initials on campaign card)
    $avatars_stmt = $pdo->prepare("
        SELECT DISTINCT COALESCE(u.full_name, 'Anonymous') as name
        FROM donation d
        LEFT JOIN user u ON d.donor_id = u.user_id
        WHERE d.campaign_id = :cid
        ORDER BY d.created_at DESC
        LIMIT 3
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

    $progress_pct = $row['target_amount'] > 0 ? round(($row['collected_amount'] / $row['target_amount']) * 100) : 0;

    $campaigns[] = [
        'campaign_id'      => $campaign_id,
        'creator_id'       => (int)$row['creator_id'],
        'creator_name'     => $row['full_name'],
        'title'            => $row['title'],
        'description'      => $row['description'],
        'target_amount'    => (float)$row['target_amount'],
        'collected_amount' => (float)$row['collected_amount'],
        'cover_image'      => $row['cover_image'],
        'progress_percent' => $progress_pct,
        'donors_count'     => $donors_count,
        'donor_avatars'    => $donor_avatars,
    ];
}

send_success([
    'loans'     => $loans,
    'campaigns' => $campaigns
], 'Dashboard items retrieved.');

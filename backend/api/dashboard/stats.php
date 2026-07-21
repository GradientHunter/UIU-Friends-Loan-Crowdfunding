<?php
// ================================================================
//  api/dashboard/stats.php  –  UIU Friends Network
//  GET → Fetch stats numbers for dashboard cards
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

// Let's get user ID if logged in (not strictly required for global stats, but needed for user-specific stats)
$user_id = get_logged_in_user_id();

// 1. Active Loan Requests count
$stmt = $pdo->query("SELECT COUNT(*) FROM loan_request WHERE status = 'open'");
$active_loans = (int)$stmt->fetchColumn();

// 2. Crowdfunding Campaigns count
$stmt = $pdo->query("SELECT COUNT(*) FROM campaign WHERE status = 'active'");
$active_campaigns = (int)$stmt->fetchColumn();

// 3. User Active Bids count (or '--' if not logged in)
$user_bids = '--';
if ($user_id) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM loan_offer WHERE lender_id = :uid AND status = 'pending'");
    $stmt->execute([':uid' => $user_id]);
    $user_bids = (int)$stmt->fetchColumn();
}

// 4. Total User Donations (or '--' if not logged in)
$user_donations = '--';
if ($user_id) {
    $stmt = $pdo->prepare("SELECT SUM(amount) FROM donation WHERE donor_id = :uid");
    $stmt->execute([':uid' => $user_id]);
    $sum = $stmt->fetchColumn();
    $user_donations = $sum !== null ? (float)$sum : 0.0;
}

send_success([
    'active_loans'     => $active_loans,
    'active_campaigns' => $active_campaigns,
    'user_bids'        => $user_bids,
    'user_donations'   => $user_donations
], 'Dashboard statistics retrieved.');

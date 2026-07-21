<?php
// ================================================================
//  api/campaign/donate.php  –  UIU Friends Network
//  POST → Donate to a crowdfunding campaign
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error('Method not allowed.', 405);
}

// Fix #9: Donations must come from a logged-in user — use require_login() not get_logged_in_user_id()
$user_id = require_login();
$body = get_post_body();

$campaign_id     = (int)($body['campaign_id']     ?? $_POST['campaign_id']     ?? 0);
$amount          = (float)($body['amount']        ?? $_POST['amount']          ?? 0);
$is_anonymous    = (int)($body['is_anonymous']    ?? $_POST['is_anonymous']    ?? 0);
$message         = clean_str($body['message']         ?? $_POST['message']         ?? '');
$transaction_ref = clean_str($body['transaction_ref'] ?? $_POST['transaction_ref'] ?? '');

if ($campaign_id <= 0 || $amount <= 0) {
    send_error('Invalid campaign ID or donation amount.');
}

// Begin Transaction
$pdo->beginTransaction();

try {
    // Check if campaign is active
    $camp_stmt = $pdo->prepare("
        SELECT campaign_id, creator_id, title, collected_amount, target_amount, status 
        FROM campaign 
        WHERE campaign_id = :cid 
        LIMIT 1
        FOR UPDATE
    ");
    $camp_stmt->execute([':cid' => $campaign_id]);
    $campaign = $camp_stmt->fetch();

    if (!$campaign) {
        throw new Exception('Campaign not found.', 404);
    }

    if ($campaign['status'] !== 'active') {
        throw new Exception('This campaign is no longer accepting donations.');
    }

    // Insert donation
    $ins_stmt = $pdo->prepare("
        INSERT INTO donation (campaign_id, donor_id, amount, is_anonymous, message, transaction_ref)
        VALUES (:cid, :donor_id, :amount, :is_anon, :message, :ref)
    ");
    $ins_stmt->execute([
        ':cid'      => $campaign_id,
        ':donor_id' => $user_id ?: null,
        ':amount'   => $amount,
        ':is_anon'  => $is_anonymous,
        ':message'  => $message ?: null,
        ':ref'      => $transaction_ref ?: null,
    ]);

    $donation_id = (int)$pdo->lastInsertId();

    // Update campaign collected amount
    $new_collected = (float)$campaign['collected_amount'] + $amount;
    
    // Check if campaign target has been met
    $new_status = 'active';
    if ($new_collected >= (float)$campaign['target_amount']) {
        $new_status = 'completed';
    }

    $up_stmt = $pdo->prepare("
        UPDATE campaign 
        SET collected_amount = :collected, status = :status 
        WHERE campaign_id = :cid
    ");
    $up_stmt->execute([
        ':collected' => $new_collected,
        ':status'    => $new_status,
        ':cid'       => $campaign_id,
    ]);

    // Send notifications
    $donor_name = 'Anonymous Friend';
    if ($user_id && !$is_anonymous) {
        $user_stmt = $pdo->prepare("SELECT full_name FROM user WHERE user_id = :uid LIMIT 1");
        $user_stmt->execute([':uid' => $user_id]);
        $donor_name = $user_stmt->fetchColumn() ?: 'A friend';
    }

    // Notify campaign creator
    create_notification(
        $pdo,
        (int)$campaign['creator_id'],
        'success',
        'Donation Received!',
        "{$donor_name} donated BDT " . number_format($amount) . " to your campaign '{$campaign['title']}'.",
        $campaign_id,
        'campaign'
    );

    // If campaign is completed, notify creator too
    if ($new_status === 'completed') {
        create_notification(
            $pdo,
            (int)$campaign['creator_id'],
            'success',
            'Campaign Target Achieved!',
            "Congratulations! Your campaign '{$campaign['title']}' has reached its target of BDT " . number_format($campaign['target_amount']) . "!",
            $campaign_id,
            'campaign'
        );
    }

    $pdo->commit();
    send_success([
        'donation_id'      => $donation_id,
        'new_collected'    => $new_collected,
        'campaign_status'  => $new_status
    ], 'Donation processed successfully. Thank you for your support!');

} catch (Exception $e) {
    $pdo->rollBack();
    $code = ($e->getCode() >= 400 && $e->getCode() < 600) ? $e->getCode() : 400;
    send_error($e->getMessage(), $code);
}

<?php
// ================================================================
//  api/loan/bids.php  –  UIU Friends Network
//  POST → Place a loan bid / offer on a loan request (Requires login)
//  GET  → Get bids / offers for a specific loan request
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: Get offers for a specific loan ──────────────────────────
if ($method === 'GET') {
    $loan_id = (int)($_GET['loan_id'] ?? 0);
    if ($loan_id <= 0) {
        send_error('Invalid loan ID.');
    }

    // Optional auth check: only the borrower, the lenders who made offers, or admin should see detailed offers.
    // For simplicity, we permit retrieving offers, but verify the relationship if needed.
    $stmt = $pdo->prepare("
        SELECT lo.offer_id, lo.loan_id, lo.lender_id, lo.interest_rate, lo.conditions, lo.message_to_borrower, lo.status, lo.offered_at,
               u.full_name, u.email, u.avg_rating, u.total_reviews, u.profile_photo
        FROM loan_offer lo
        JOIN user u ON lo.lender_id = u.user_id
        WHERE lo.loan_id = :loan_id
        ORDER BY lo.interest_rate ASC, lo.offered_at DESC
    ");
    $stmt->execute([':loan_id' => $loan_id]);
    $offers = [];

    while ($row = $stmt->fetch()) {
        $names = explode(' ', $row['full_name']);
        $initials = '';
        foreach ($names as $n) {
            $initials .= strtoupper(substr($n, 0, 1));
        }
        $initials = substr($initials, 0, 2);

        $offers[] = [
            'offer_id'            => (int)$row['offer_id'],
            'loan_id'             => (int)$row['loan_id'],
            'lender_id'           => (int)$row['lender_id'],
            'interest_rate'       => (float)$row['interest_rate'],
            'conditions'          => $row['conditions'],
            'message_to_borrower' => $row['message_to_borrower'],
            'status'              => $row['status'],
            'offered_at'          => $row['offered_at'],
            'lender_name'         => $row['full_name'],
            'lender_email'        => $row['email'],
            'lender_rating'       => (float)$row['avg_rating'],
            'lender_reviews'      => (int)$row['total_reviews'],
            'lender_photo'        => $row['profile_photo'],
            'lender_initials'     => $initials,
        ];
    }

    send_success($offers, 'Bids retrieved.');
}

// ── POST: Place a new bid ─────────────────────────────────────────
if ($method === 'POST') {
    $user_id = require_login();
    $body = get_post_body();

    $loan_id             = (int)($body['loan_id']             ?? $_POST['loan_id']             ?? 0);
    $interest_rate       = (float)($body['interest_rate']     ?? $_POST['interest_rate']       ?? 0);
    $conditions          = clean_str($body['conditions']      ?? $_POST['conditions']          ?? '');
    $message_to_borrower = clean_str($body['message']         ?? $_POST['message']             ?? '');

    if ($loan_id <= 0) {
        send_error('Invalid loan ID.');
    }

    // Check if the loan request exists and is open
    $loan_stmt = $pdo->prepare("SELECT borrower_id, amount, max_interest_rate, status FROM loan_request WHERE loan_id = :loan_id LIMIT 1");
    $loan_stmt->execute([':loan_id' => $loan_id]);
    $loan = $loan_stmt->fetch();

    if (!$loan) {
        send_error('Loan request not found.', 404);
    }

    if ($loan['status'] !== 'open') {
        send_error('This loan request is no longer open for bidding.');
    }

    if ($loan['borrower_id'] == $user_id) {
        send_error('You cannot bid on your own loan request.');
    }

    if ($interest_rate < 0 || $interest_rate > $loan['max_interest_rate']) {
        send_error('Interest rate must be between 0% and the borrower\'s maximum allowed rate (' . $loan['max_interest_rate'] . '%).');
    }

    // Insert the bid / offer
    $stmt = $pdo->prepare("
        INSERT INTO loan_offer (loan_id, lender_id, interest_rate, conditions, message_to_borrower, status)
        VALUES (:loan_id, :lender_id, :interest_rate, :conditions, :message_to_borrower, 'pending')
    ");
    $stmt->execute([
        ':loan_id'             => $loan_id,
        ':lender_id'           => $user_id,
        ':interest_rate'       => $interest_rate,
        ':conditions'          => $conditions ?: null,
        ':message_to_borrower' => $message_to_borrower ?: null,
    ]);

    $new_offer_id = (int)$pdo->lastInsertId();

    // Notify the borrower
    $lender_stmt = $pdo->prepare("SELECT full_name FROM user WHERE user_id = :uid LIMIT 1");
    $lender_stmt->execute([':uid' => $user_id]);
    $lender_name = $lender_stmt->fetchColumn() ?: 'A student';

    create_notification(
        $pdo, 
        (int)$loan['borrower_id'], 
        'info', 
        'New Bid Received', 
        "{$lender_name} has placed a bid of {$interest_rate}% interest on your loan request.", 
        $loan_id, 
        'loan_request'
    );

    send_success(['offer_id' => $new_offer_id], 'Bid placed successfully.', 201);
}

send_error('Method not allowed.', 405);

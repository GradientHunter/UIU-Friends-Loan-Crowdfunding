<?php
// ================================================================
//  api/loan/my_loans.php  –  UIU Friends Network
//  GET → Retrieve the logged-in user's loans, offers, and agreements
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

$user_id = require_login();

// ── 1. Loan Requests Created by the User ─────────────────────────
$requests_stmt = $pdo->prepare("
    SELECT loan_id, amount, purpose, repayment_deadline, max_interest_rate, status, created_at
    FROM loan_request
    WHERE borrower_id = :uid
    ORDER BY created_at DESC
");
$requests_stmt->execute([':uid' => $user_id]);
$requests = $requests_stmt->fetchAll();

// ── 2. Bids Made by User (Investment Offers) ───────────────────────
$bids_stmt = $pdo->prepare("
    SELECT lo.offer_id, lo.loan_id, lo.interest_rate, lo.status, lo.offered_at,
           lr.amount as loan_amount, lr.purpose as loan_purpose,
           u.full_name as borrower_name
    FROM loan_offer lo
    JOIN loan_request lr ON lo.loan_id = lr.loan_id
    JOIN user u ON lr.borrower_id = u.user_id
    WHERE lo.lender_id = :uid
    ORDER BY lo.offered_at DESC
");
$bids_stmt->execute([':uid' => $user_id]);
$my_bids = $bids_stmt->fetchAll();

// ── 3. Loan Agreements ───────────────────────────────────────────
$agreements_stmt = $pdo->prepare("
    SELECT la.agreement_id, la.loan_id, la.principal_amount, la.interest_rate, la.total_payable, 
           la.start_date, la.due_date, la.repayment_status, la.created_at,
           la.borrower_id, la.lender_id,
           ub.full_name as borrower_name, ul.full_name as lender_name
    FROM loan_agreement la
    JOIN user ub ON la.borrower_id = ub.user_id
    JOIN user ul ON la.lender_id = ul.user_id
    WHERE la.borrower_id = :uid OR la.lender_id = :uid
    ORDER BY la.created_at DESC
");
$agreements_stmt->execute([':uid' => $user_id]);
$raw_agreements = $agreements_stmt->fetchAll();

$agreements = [];
foreach ($raw_agreements as $ag) {
    $role = ($ag['borrower_id'] == $user_id) ? 'borrower' : 'lender';
    
    // Fetch total repayments made on this agreement
    $repay_stmt = $pdo->prepare("SELECT SUM(amount_paid) FROM repayment WHERE agreement_id = :aid");
    $repay_stmt->execute([':aid' => $ag['agreement_id']]);
    $paid = (float)$repay_stmt->fetchColumn() ?: 0.0;

    $agreements[] = [
        'agreement_id'     => (int)$ag['agreement_id'],
        'loan_id'          => (int)$ag['loan_id'],
        'principal_amount' => (float)$ag['principal_amount'],
        'interest_rate'    => (float)$ag['interest_rate'],
        'total_payable'    => (float)$ag['total_payable'],
        'paid_amount'      => $paid,
        'remaining_amount' => max(0, (float)$ag['total_payable'] - $paid),
        'start_date'       => $ag['start_date'],
        'due_date'         => $ag['due_date'],
        'repayment_status' => $ag['repayment_status'],
        'role'             => $role,
        'borrower_name'    => $ag['borrower_name'],
        'lender_name'      => $ag['lender_name'],
        'created_at'       => $ag['created_at'],
    ];
}

// ── 4. Recent Repayments (for activity feed) ─────────────────────
$rep_stmt = $pdo->prepare("
    SELECT r.repayment_id, r.agreement_id, r.amount_paid, r.paid_on AS paid_at,
           r.payment_method, r.transaction_ref, r.note,
           la.borrower_id, la.lender_id
    FROM repayment r
    JOIN loan_agreement la ON r.agreement_id = la.agreement_id
    WHERE la.borrower_id = :uid OR la.lender_id = :uid2
    ORDER BY r.paid_on DESC
    LIMIT 10
");
$rep_stmt->execute([':uid' => $user_id, ':uid2' => $user_id]);
$repayments = $rep_stmt->fetchAll();

// ── 5. Notifications ──────────────────────────────────────────────
$notif_stmt = $pdo->prepare("
    SELECT notification_id, title, body, type, is_read, created_at
    FROM notification
    WHERE user_id = :uid
    ORDER BY created_at DESC
    LIMIT 20
");
$notif_stmt->execute([':uid' => $user_id]);
$notifications = $notif_stmt->fetchAll();

send_success([
    'requests'      => $requests,
    'my_bids'       => $my_bids,
    'agreements'    => $agreements,
    'repayments'    => $repayments,
    'notifications' => $notifications
], 'User loans information retrieved.');

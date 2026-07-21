<?php
// ================================================================
//  api/loan/repay.php  –  UIU Friends Network
//  POST → Log a loan repayment against a loan agreement (Requires login)
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error('Method not allowed.', 405);
}

$user_id = require_login();
$body = get_post_body();

$agreement_id    = (int)($body['agreement_id']    ?? $_POST['agreement_id']    ?? 0);
$amount_paid     = (float)($body['amount_paid']   ?? $_POST['amount_paid']     ?? 0);
$payment_method  = clean_str($body['payment_method']  ?? $_POST['payment_method']  ?? 'bkash');
$transaction_ref = clean_str($body['transaction_ref'] ?? $_POST['transaction_ref'] ?? '');
$note            = clean_str($body['note']            ?? $_POST['note']            ?? '');

if ($agreement_id <= 0 || $amount_paid <= 0) {
    send_error('Invalid Agreement ID or amount.');
}

// Begin Transaction
$pdo->beginTransaction();

try {
    // Check agreement details
    $ag_stmt = $pdo->prepare("
        SELECT agreement_id, borrower_id, lender_id, total_payable, repayment_status
        FROM loan_agreement
        WHERE agreement_id = :aid
        LIMIT 1
        FOR UPDATE
    ");
    $ag_stmt->execute([':aid' => $agreement_id]);
    $ag = $ag_stmt->fetch();

    if (!$ag) {
        throw new Exception('Loan agreement not found.', 404);
    }

    if ($ag['borrower_id'] != $user_id) {
        throw new Exception('Only the borrower is authorized to pay for this agreement.', 403);
    }

    if ($ag['repayment_status'] === 'completed') {
        throw new Exception('This loan has already been fully repaid.');
    }

    // Check sum of previous payments
    $prev_repaid_stmt = $pdo->prepare("SELECT SUM(amount_paid) FROM repayment WHERE agreement_id = :aid");
    $prev_repaid_stmt->execute([':aid' => $agreement_id]);
    $prev_repaid = (float)$prev_repaid_stmt->fetchColumn() ?: 0.0;
    
    $total_payable = (float)$ag['total_payable'];
    $max_allowed_pay = $total_payable - $prev_repaid;

    if ($amount_paid > $max_allowed_pay + 0.01) { // Floating point leeway
        throw new Exception('Repayment amount exceeds the total remaining balance due (BDT ' . number_format($max_allowed_pay, 2) . ').');
    }

    $new_total_repaid = $prev_repaid + $amount_paid;

    // Log the repayment
    $ins_stmt = $pdo->prepare("
        INSERT INTO repayment (agreement_id, amount_paid, paid_on, payment_method, transaction_ref, note)
        VALUES (:aid, :amount, :paid_on, :method, :ref, :note)
    ");
    $ins_stmt->execute([
        ':aid'     => $agreement_id,
        ':amount'  => $amount_paid,
        ':paid_on' => date('Y-m-d'),
        ':method'  => $payment_method,
        ':ref'     => $transaction_ref ?: null,
        ':note'    => $note ?: null,
    ]);

    $new_repayment_id = (int)$pdo->lastInsertId();

    // Determine status
    if (abs($new_total_repaid - $total_payable) < 0.05) {
        $status = 'completed';
        
        // Also close the corresponding loan request
        $up_lr_stmt = $pdo->prepare("
            UPDATE loan_request lr
            JOIN loan_agreement la ON lr.loan_id = la.loan_id
            SET lr.status = 'closed'
            WHERE la.agreement_id = :aid
        ");
        $up_lr_stmt->execute([':aid' => $agreement_id]);
    } else {
        $status = 'partial';
    }

    // Update agreement status
    $up_ag_stmt = $pdo->prepare("UPDATE loan_agreement SET repayment_status = :status WHERE agreement_id = :aid");
    $up_ag_stmt->execute([
        ':status' => $status,
        ':aid'    => $agreement_id,
    ]);

    // Create notifications for lender
    $borrower_stmt = $pdo->prepare("SELECT full_name FROM user WHERE user_id = :uid LIMIT 1");
    $borrower_stmt->execute([':uid' => $user_id]);
    $borrower_name = $borrower_stmt->fetchColumn() ?: 'Borrower';

    create_notification(
        $pdo,
        (int)$ag['lender_id'],
        'success',
        'Repayment Received',
        "{$borrower_name} sent a repayment of BDT " . number_format($amount_paid) . " (Method: {$payment_method}). Status: " . ucfirst($status),
        $agreement_id,
        'loan_agreement'
    );

    $pdo->commit();
    send_success(['repayment_id' => $new_repayment_id, 'new_status' => $status], 'Repayment recorded successfully.');

} catch (Exception $e) {
    $pdo->rollBack();
    $code = ($e->getCode() >= 400 && $e->getCode() < 600) ? $e->getCode() : 400;
    send_error($e->getMessage(), $code);
}

<?php
// ================================================================
//  api/loan/agreement.php  –  UIU Friends Network
//  GET  → Get details of a specific loan agreement
//  POST → Accept a bid and create a loan agreement
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

$method = $_SERVER['REQUEST_METHOD'];
$user_id = require_login();

// ── GET: View specific loan agreement ─────────────────────────────
if ($method === 'GET') {
    $agreement_id = (int)($_GET['agreement_id'] ?? 0);
    $loan_id      = (int)($_GET['loan_id'] ?? 0);

    if ($agreement_id <= 0 && $loan_id <= 0) {
        send_error('Agreement ID or Loan ID is required.');
    }

    $query = "
        SELECT la.agreement_id, la.loan_id, la.offer_id, la.borrower_id, la.lender_id, 
               la.principal_amount, la.interest_rate, la.total_payable, la.agreed_conditions, 
               la.start_date, la.due_date, la.repayment_status, la.created_at,
               ub.full_name as borrower_name, ub.student_id as borrower_student_id, ub.email as borrower_email,
               ul.full_name as lender_name, ul.student_id as lender_student_id, ul.email as lender_email,
               lr.purpose, lr.reason_details
        FROM loan_agreement la
        JOIN user ub ON la.borrower_id = ub.user_id
        JOIN user ul ON la.lender_id = ul.user_id
        JOIN loan_request lr ON la.loan_id = lr.loan_id
    ";

    $params = [];
    if ($agreement_id > 0) {
        $query .= " WHERE la.agreement_id = :agreement_id";
        $params[':agreement_id'] = $agreement_id;
    } else {
        $query .= " WHERE la.loan_id = :loan_id";
        $params[':loan_id'] = $loan_id;
    }

    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $ag = $stmt->fetch();

    if (!$ag) {
        send_error('Agreement not found or user is unauthorized.', 404);
    }

    // Verify current user is borrower or lender
    if ($ag['borrower_id'] != $user_id && $ag['lender_id'] != $user_id) {
        send_error('Unauthorized access to this agreement.', 403);
    }

    // Fetch repayments list
    $repay_stmt = $pdo->prepare("
        SELECT repayment_id, amount_paid, paid_on, payment_method, transaction_ref, note, created_at
        FROM repayment
        WHERE agreement_id = :aid
        ORDER BY paid_on DESC, created_at DESC
    ");
    $repay_stmt->execute([':aid' => $ag['agreement_id']]);
    $repayments = $repay_stmt->fetchAll();

    $total_repaid = 0.0;
    foreach ($repayments as $r) {
        $total_repaid += (float)$r['amount_paid'];
    }

    send_success([
        'agreement'    => $ag,
        'repayments'   => $repayments,
        'total_repaid' => $total_repaid,
        'balance_due'  => max(0, $ag['total_payable'] - $total_repaid)
    ], 'Agreement details retrieved.');
}

// ── POST: Accept a bid to create an agreement ──────────────────────
if ($method === 'POST') {
    $body = get_post_body();
    $offer_id = (int)($body['offer_id'] ?? $_POST['offer_id'] ?? 0);

    if ($offer_id <= 0) {
        send_error('Offer ID is required.');
    }

    // Begin Transaction
    $pdo->beginTransaction();

    try {
        // Fetch offer and check permissions
        $offer_stmt = $pdo->prepare("
            SELECT lo.offer_id, lo.loan_id, lo.lender_id, lo.interest_rate, lo.conditions as offer_conditions, lo.status as offer_status,
                   lr.borrower_id, lr.amount as principal, lr.status as loan_status, lr.repayment_deadline
            FROM loan_offer lo
            JOIN loan_request lr ON lo.loan_id = lr.loan_id
            WHERE lo.offer_id = :offer_id
            LIMIT 1
            FOR UPDATE
        ");
        $offer_stmt->execute([':offer_id' => $offer_id]);
        $offer = $offer_stmt->fetch();

        if (!$offer) {
            throw new Exception('Offer not found.', 404);
        }

        if ($offer['borrower_id'] != $user_id) {
            throw new Exception('Only the borrower can accept loan bids.', 403);
        }

        if ($offer['loan_status'] !== 'open') {
            throw new Exception('This loan request is already funded or closed.');
        }

        if ($offer['offer_status'] !== 'pending') {
            throw new Exception('This bid is no longer pending.');
        }

        // Calculate total payable (Principal + Interest)
        $principal     = (float)$offer['principal'];
        $interest_rate = (float)$offer['interest_rate'];
        $total_payable = $principal + ($principal * ($interest_rate / 100));

        // Dates
        $start_date = date('Y-m-d');
        $due_date   = $offer['repayment_deadline'];

        // Create Agreement record
        $ag_stmt = $pdo->prepare("
            INSERT INTO loan_agreement 
                (loan_id, offer_id, borrower_id, lender_id, principal_amount, interest_rate, total_payable, agreed_conditions, start_date, due_date, repayment_status)
            VALUES 
                (:loan_id, :offer_id, :borrower_id, :lender_id, :principal, :interest_rate, :total_payable, :conditions, :start_date, :due_date, 'pending')
        ");
        $ag_stmt->execute([
            ':loan_id'       => (int)$offer['loan_id'],
            ':offer_id'      => $offer_id,
            ':borrower_id'   => $user_id,
            ':lender_id'     => (int)$offer['lender_id'],
            ':principal'     => $principal,
            ':interest_rate' => $interest_rate,
            ':total_payable' => $total_payable,
            ':conditions'    => $offer['offer_conditions'],
            ':start_date'    => $start_date,
            ':due_date'      => $due_date,
        ]);

        $agreement_id = (int)$pdo->lastInsertId();

        // Update loan offer status to accepted
        $up_offer = $pdo->prepare("UPDATE loan_offer SET status = 'accepted' WHERE offer_id = :oid");
        $up_offer->execute([':oid' => $offer_id]);

        // Reject other offers on this loan request
        $rej_offers = $pdo->prepare("UPDATE loan_offer SET status = 'rejected' WHERE loan_id = :lid AND offer_id != :oid");
        $rej_offers->execute([
            ':lid' => (int)$offer['loan_id'],
            ':oid' => $offer_id
        ]);

        // Update loan request status to funded
        $up_loan = $pdo->prepare("UPDATE loan_request SET status = 'funded' WHERE loan_id = :lid");
        $up_loan->execute([':lid' => (int)$offer['loan_id']]);

        // Create notifications for borrower and lender
        create_notification(
            $pdo,
            $user_id,
            'success',
            'Loan Agreement Created',
            "You accepted the loan bid. Agreement #{$agreement_id} is now active.",
            $agreement_id,
            'loan_agreement'
        );

        create_notification(
            $pdo,
            (int)$offer['lender_id'],
            'success',
            'Your Bid Was Accepted!',
            "Your bid for interest rate {$interest_rate}% was accepted. Agreement #{$agreement_id} has been created.",
            $agreement_id,
            'loan_agreement'
        );

        $pdo->commit();
        send_success(['agreement_id' => $agreement_id], 'Loan bid accepted and agreement generated successfully!', 201);

    } catch (Exception $e) {
        $pdo->rollBack();
        $code = ($e->getCode() >= 400 && $e->getCode() < 600) ? $e->getCode() : 400;
        send_error($e->getMessage(), $code);
    }
}

send_error('Method not allowed.', 405);

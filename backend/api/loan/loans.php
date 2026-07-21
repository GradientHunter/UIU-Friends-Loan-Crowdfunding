<?php
// ================================================================
//  api/loan/loans.php  –  UIU Friends Network
//  GET  → List all open loan requests
//  POST → Create a new loan request (Requires login)
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: List open loan requests ──────────────────────────────────
if ($method === 'GET') {
    // Optional filters
    $search = clean_str($_GET['search'] ?? '');
    
    $query = "
        SELECT lr.loan_id, lr.borrower_id, lr.amount, lr.purpose, lr.reason_details, 
               lr.repayment_deadline, lr.max_interest_rate, lr.conditions, lr.status, lr.views_count, lr.created_at,
               u.full_name, u.email, u.avg_rating, u.total_reviews, u.profile_photo
        FROM loan_request lr
        JOIN user u ON lr.borrower_id = u.user_id
        WHERE lr.status = 'open'
    ";
    
    $params = [];
    if (!empty($search)) {
        $query .= " AND (lr.purpose LIKE :search OR lr.reason_details LIKE :search OR u.full_name LIKE :search)";
        $params[':search'] = '%' . $search . '%';
    }
    
    $query .= " ORDER BY lr.created_at DESC";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $loans = [];
    
    while ($row = $stmt->fetch()) {
        // Calculate remaining days
        $deadline = new DateTime($row['repayment_deadline']);
        $today = new DateTime();
        $diff = $today->diff($deadline);
        $days_left = $diff->invert ? 0 : $diff->days;

        // Generate initials for borrower avatar fallback
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
            'email'             => $row['email'],
            'avg_rating'        => (float)$row['avg_rating'],
            'total_reviews'     => (int)$row['total_reviews'],
            'amount'            => (float)$row['amount'],
            'purpose'           => $row['purpose'],
            'reason_details'    => $row['reason_details'],
            'repayment_deadline'=> $row['repayment_deadline'],
            'max_interest_rate' => (float)$row['max_interest_rate'],
            'conditions'        => $row['conditions'],
            'views_count'       => (int)$row['views_count'],
            'days_left'         => $days_left,
            'created_at'        => $row['created_at'],
        ];
    }
    
    send_success($loans, 'Loan requests retrieved.');
}

// ── POST: Create a new loan request ────────────────────────────────
if ($method === 'POST') {
    $user_id = require_login();
    
    $body = get_post_body();
    
    // Support JSON body or standard form POST inputs
    $amount             = (float)($body['amount']             ?? $_POST['amount']             ?? 0);
    $purpose            = clean_str($body['purpose']          ?? $_POST['purpose']            ?? '');
    $reason_details     = clean_str($body['reason_details']   ?? $_POST['reason_details']     ?? '');
    $repayment_deadline = clean_str($body['repayment_deadline']?? $_POST['repayment_deadline']?? '');
    $max_interest_rate  = (float)($body['max_interest_rate']  ?? $_POST['max_interest_rate']  ?? 0);
    $conditions         = clean_str($body['conditions']         ?? $_POST['conditions']         ?? '');
    
    $errors = [];
    if ($amount <= 0)            $errors[] = 'Amount must be greater than 0.';
    if (empty($purpose))         $errors[] = 'Purpose is required.';
    if (empty($repayment_deadline)) $errors[] = 'Repayment deadline is required.';
    if ($max_interest_rate < 0)  $errors[] = 'Max interest rate cannot be negative.';
    
    if (!empty($errors)) {
        send_error('Validation failed.', 422, $errors);
    }
    
    // Check if the deadline date is in the future
    $deadline_date = new DateTime($repayment_deadline);
    $today = new DateTime();
    if ($deadline_date <= $today) {
        send_error('Repayment deadline must be a date in the future.', 422);
    }
    
    // Insert into DB
    $stmt = $pdo->prepare("
        INSERT INTO loan_request 
            (borrower_id, amount, purpose, reason_details, repayment_deadline, max_interest_rate, conditions, status)
        VALUES 
            (:borrower_id, :amount, :purpose, :reason_details, :repayment_deadline, :max_interest_rate, :conditions, 'open')
    ");
    $stmt->execute([
        ':borrower_id'        => $user_id,
        ':amount'             => $amount,
        ':purpose'            => $purpose,
        ':reason_details'     => $reason_details ?: null,
        ':repayment_deadline' => $repayment_deadline,
        ':max_interest_rate'  => $max_interest_rate,
        ':conditions'         => $conditions ?: null,
    ]);
    
    $new_loan_id = (int)$pdo->lastInsertId();
    
    // Create an informative notification
    create_notification($pdo, $user_id, 'info', 'Loan Request Created', "Your loan request for BDT " . number_format($amount) . " is now live.", $new_loan_id, 'loan_request');
    
    send_success(['loan_id' => $new_loan_id], 'Loan request created successfully.', 201);
}

send_error('Method not allowed.', 405);

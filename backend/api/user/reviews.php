<?php
// ================================================================
//  api/user/reviews.php  –  UIU Friends Network
//  GET  → Retrieve reviews for a specific user
//  POST → Add a new review for an agreement partner (Requires login)
// ================================================================

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: Fetch reviews for a specific user ─────────────────────────
if ($method === 'GET') {
    $target_user_id = (int)($_GET['user_id'] ?? get_logged_in_user_id() ?? 0);

    if ($target_user_id <= 0) {
        send_error('User ID is required.');
    }

    // Fetch user overall review stats
    $user_stmt = $pdo->prepare("SELECT full_name, avg_rating, total_reviews FROM user WHERE user_id = :uid LIMIT 1");
    $user_stmt->execute([':uid' => $target_user_id]);
    $user_stats = $user_stmt->fetch();

    if (!$user_stats) {
        send_error('User not found.', 404);
    }

    // Fetch detailed reviews list
    $reviews_stmt = $pdo->prepare("
        SELECT r.review_id, r.agreement_id, r.reviewer_id, r.rating, r.comment, r.created_at,
               u.full_name as reviewer_name, u.profile_photo as reviewer_photo
        FROM review r
        JOIN user u ON r.reviewer_id = u.user_id
        WHERE r.reviewee_id = :uid
        ORDER BY r.created_at DESC
    ");
    $reviews_stmt->execute([':uid' => $target_user_id]);
    $reviews = [];

    while ($row = $reviews_stmt->fetch()) {
        $names = explode(' ', $row['reviewer_name']);
        $initials = '';
        foreach ($names as $n) {
            $initials .= strtoupper(substr($n, 0, 1));
        }
        $initials = substr($initials, 0, 2);

        $reviews[] = [
            'review_id'      => (int)$row['review_id'],
            'agreement_id'   => (int)$row['agreement_id'],
            'reviewer_id'    => (int)$row['reviewer_id'],
            'reviewer_name'  => $row['reviewer_name'],
            'reviewer_photo' => $row['reviewer_photo'],
            'reviewer_initials' => $initials,
            'rating'         => (int)$row['rating'],
            'comment'        => $row['comment'],
            'created_at'     => $row['created_at'],
        ];
    }

    // Calculate trust score simulation based on avg_rating and reviews count
    // E.g., Trust Score = (avg_rating / 5) * 100
    $avg_rating = (float)$user_stats['avg_rating'];
    $total_reviews = (int)$user_stats['total_reviews'];
    $trust_score = $total_reviews > 0 ? round(($avg_rating / 5.0) * 100) : 85; // default 85% starting trust score

    send_success([
        'user_name'     => $user_stats['full_name'],
        'avg_rating'    => $avg_rating,
        'total_reviews' => $total_reviews,
        'trust_score'   => $trust_score,
        'reviews'       => $reviews
    ], 'User reviews retrieved.');
}

// ── POST: Post a new review on a completed agreement ────────────────
if ($method === 'POST') {
    $reviewer_id = require_login();
    $body = get_post_body();

    $agreement_id = (int)($body['agreement_id'] ?? $_POST['agreement_id'] ?? 0);
    $rating       = (int)($body['rating']       ?? $_POST['rating']       ?? 0);
    $comment      = clean_str($body['comment']      ?? $_POST['comment']      ?? '');

    if ($agreement_id <= 0) {
        send_error('Agreement ID is required.');
    }

    if ($rating < 1 || $rating > 5) {
        send_error('Rating must be between 1 and 5 stars.');
    }

    // Begin Transaction
    $pdo->beginTransaction();

    try {
        // Retrieve agreement details to confirm participants and status
        $ag_stmt = $pdo->prepare("
            SELECT borrower_id, lender_id, repayment_status 
            FROM loan_agreement 
            WHERE agreement_id = :aid 
            LIMIT 1
        ");
        $ag_stmt->execute([':aid' => $agreement_id]);
        $ag = $ag_stmt->fetch();

        if (!$ag) {
            throw new Exception('Loan agreement not found.', 404);
        }

        // Determine reviewer role and target reviewee
        if ($ag['borrower_id'] == $reviewer_id) {
            $reviewee_id = (int)$ag['lender_id'];
        } elseif ($ag['lender_id'] == $reviewer_id) {
            $reviewee_id = (int)$ag['borrower_id'];
        } else {
            throw new Exception('You are not a participant in this agreement.', 403);
        }

        // Check if reviewer has already reviewed this specific agreement
        $check_stmt = $pdo->prepare("
            SELECT review_id 
            FROM review 
            WHERE agreement_id = :aid AND reviewer_id = :rid AND reviewee_id = :revid
            LIMIT 1
        ");
        $check_stmt->execute([
            ':aid'   => $agreement_id,
            ':rid'   => $reviewer_id,
            ':revid' => $reviewee_id
        ]);
        if ($check_stmt->fetch()) {
            throw new Exception('You have already submitted a review for this agreement.', 409);
        }

        // Insert review
        $ins_stmt = $pdo->prepare("
            INSERT INTO review (agreement_id, reviewer_id, reviewee_id, rating, comment)
            VALUES (:aid, :rid, :revid, :rating, :comment)
        ");
        $ins_stmt->execute([
            ':aid'    => $agreement_id,
            ':rid'    => $reviewer_id,
            ':revid'  => $reviewee_id,
            ':rating' => $rating,
            ':comment'=> $comment ?: null
        ]);

        $new_review_id = (int)$pdo->lastInsertId();

        // Calculate and update reviewee's average rating and total reviews count
        $calc_stmt = $pdo->prepare("
            SELECT COUNT(*), AVG(rating) 
            FROM review 
            WHERE reviewee_id = :revid
        ");
        $calc_stmt->execute([':revid' => $reviewee_id]);
        $calc = $calc_stmt->fetch();
        $total_reviews = (int)$calc['COUNT(*)'];
        $avg_rating    = (float)$calc['AVG(rating)'];

        // Update target user stats
        $up_stmt = $pdo->prepare("
            UPDATE user 
            SET avg_rating = :avg, total_reviews = :total 
            WHERE user_id = :revid
        ");
        $up_stmt->execute([
            ':avg'   => $avg_rating,
            ':total' => $total_reviews,
            ':revid' => $reviewee_id
        ]);

        // Create notification for the reviewee
        $reviewer_name_stmt = $pdo->prepare("SELECT full_name FROM user WHERE user_id = :uid LIMIT 1");
        $reviewer_name_stmt->execute([':uid' => $reviewer_id]);
        $reviewer_name = $reviewer_name_stmt->fetchColumn() ?: 'A student';

        create_notification(
            $pdo,
            $reviewee_id,
            'info',
            'New Review Received',
            "{$reviewer_name} left you a {$rating}-star review: \"{$comment}\".",
            $agreement_id,
            'loan_agreement'
        );

        $pdo->commit();
        send_success([
            'review_id'     => $new_review_id,
            'new_avg'       => $avg_rating,
            'new_total'     => $total_reviews
        ], 'Review submitted successfully!');

    } catch (Exception $e) {
        $pdo->rollBack();
        $code = ($e->getCode() >= 400 && $e->getCode() < 600) ? $e->getCode() : 400;
        send_error($e->getMessage(), $code);
    }
}

send_error('Method not allowed.', 405);

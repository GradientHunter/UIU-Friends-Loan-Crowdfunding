<?php
// ================================================================
//  config/db.php  –  UIU Friends Network
//  Secure PDO database connection configuration
// ================================================================

// ── Database credentials ──────────────────────────────────────────
// Fix #14: Never use root with no password in production.
// Run the SQL in db dump/create_db_user.sql to create a restricted user,
// then update DB_USER and DB_PASS below to match.
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'uiu_flc');      // Change this to your database name
define('DB_USER', 'root');         // CHANGE: use a dedicated low-privilege user
define('DB_PASS', '');             // CHANGE: set a strong password
define('DB_CHARSET', 'utf8mb4');

// ── PDO connection options ────────────────────────────────────────
$pdo_options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

// ── Create PDO connection ─────────────────────────────────────────
try {
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $pdo_options);
} catch (PDOException $e) {
    // Fix #8: Never expose raw connection error details to the client
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed. Please try again later.',
    ]);
    exit;
}

<?php
// ================================================================
//  api/auth/logout.php  –  UIU Friends Network
//  POST/GET → End user session
// ================================================================

require_once __DIR__ . '/../../includes/helpers.php';

set_json_headers();

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Clear all session variables
$_SESSION = [];

// Destroy session cookie if set
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Destroy session
session_destroy();

send_success([], 'Logged out successfully.');

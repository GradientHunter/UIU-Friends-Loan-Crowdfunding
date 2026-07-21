<?php
// ================================================================
//  config/test_db.php  –  UIU Friends Network
//  Simple diagnostic tool to check database connectivity
// ================================================================

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/html; charset=UTF-8');

echo "<h2>UIU Friends Loan & Crowdfunding - DB Connection Test</h2>";

// Load configuration
$db_file = __DIR__ . '/db.php';
if (!file_exists($db_file)) {
    echo "<p style='color:red;'><b>Error:</b> config/db.php not found!</p>";
    exit;
}

echo "<p>Loading configuration from: <code>backend/config/db.php</code>...</p>";

// Temporarily redefine defined constants or inspect them
require_once $db_file;

echo "<p style='color:green;'><b>Success:</b> Loaded configuration files.</p>";
echo "<h3>Current Settings:</h3>";
echo "<ul>";
echo "<li><b>Host:</b> " . DB_HOST . "</li>";
echo "<li><b>Port:</b> " . DB_PORT . "</li>";
echo "<li><b>Database Name:</b> " . DB_NAME . "</li>";
echo "<li><b>Username:</b> " . DB_USER . "</li>";
echo "<li><b>Password:</b> " . (empty(DB_PASS) ? "<i>(Empty)</i>" : "********") . "</li>";
echo "</ul>";

echo "<h3>Attempting Connection...</h3>";

try {
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];
    $test_pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    
    echo "<p style='color:green; font-size:18px;'><b>🎉 Success! Database connection established successfully.</b></p>";
    
    // Check tables
    echo "<h3>Verifying Database Tables:</h3>";
    $tables = ['user', 'campaign', 'loan_request', 'loan_offer', 'loan_agreement', 'repayment', 'message', 'review', 'donation', 'campaign_comment'];
    echo "<ul>";
    foreach ($tables as $table) {
        try {
            $stmt = $test_pdo->query("SELECT COUNT(*) FROM `$table`");
            $count = $stmt->fetchColumn();
            echo "<li>Table <code>$table</code>: <b style='color:green;'>Found</b> (contains $count rows)</li>";
        } catch (PDOException $ex) {
            echo "<li>Table <code>$table</code>: <b style='color:red;'>Not Found or Error</b> (" . $ex->getMessage() . ")</li>";
        }
    }
    echo "</ul>";

    // Describe user table structure
    echo "<h3>User Table Structure (Columns):</h3>";
    try {
        $cols = $test_pdo->query("DESCRIBE `user`")->fetchAll();
        echo "<table border='1' cellpadding='5' style='border-collapse:collapse;'>";
        echo "<tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th><th>Extra</th></tr>";
        foreach ($cols as $col) {
            echo "<tr>";
            echo "<td><code>" . htmlspecialchars($col['Field']) . "</code></td>";
            echo "<td>" . htmlspecialchars($col['Type']) . "</td>";
            echo "<td>" . htmlspecialchars($col['Null']) . "</td>";
            echo "<td>" . htmlspecialchars($col['Key']) . "</td>";
            echo "<td>" . htmlspecialchars($col['Default'] ?? 'NULL') . "</td>";
            echo "<td>" . htmlspecialchars($col['Extra']) . "</td>";
            echo "</tr>";
        }
        echo "</table>";
    } catch (PDOException $ex) {
        echo "<p style='color:red;'>Could not describe user table: " . $ex->getMessage() . "</p>";
    }
    
} catch (PDOException $e) {
    echo "<div style='background-color:#ffebee; border:1px solid #c62828; padding:15px; border-radius:4px; margin-top:20px;'>";
    echo "<h4 style='color:#c62828; margin-top:0;'>❌ Database Connection Failed!</h4>";
    echo "<p><b>Error Message:</b> <code>" . htmlspecialchars($e->getMessage()) . "</code></p>";
    echo "<p><b>Error Code:</b> <code>" . htmlspecialchars($e->getCode()) . "</code></p>";
    echo "<h4>Troubleshooting Checklist:</h4>";
    echo "<ol>";
    echo "<li>Is your MySQL server running (e.g. checked in XAMPP or WampServer Control Panel)?</li>";
    echo "<li>Does the database <code>" . DB_NAME . "</code> exist? (Make sure you created it in phpMyAdmin)</li>";
    echo "<li>Are the username (<code>" . DB_USER . "</code>) and password correct?</li>";
    echo "<li>Is MySQL running on port <code>" . DB_PORT . "</code>? (Some setups run MySQL on 3307 or 3308 instead of 3306)</li>";
    echo "</ol>";
    echo "</div>";
}

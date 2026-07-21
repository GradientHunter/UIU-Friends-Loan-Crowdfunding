# UIU Friends – Setup Guide

## Requirements
- XAMPP, WAMP, or Laragon (PHP 8.0+, MySQL 5.7+)
- A modern browser (Chrome, Firefox, Edge)

---

## Step 1 – Copy Project Files

Place the entire project folder inside your web server's document root:

- **XAMPP** → `C:/xampp/htdocs/UIU_Friends/`
- **WAMP**  → `C:/wamp64/www/UIU_Friends/`
- **Laragon** → `C:/laragon/www/UIU_Friends/`

---

## Step 2 – Start Services

Open XAMPP/WAMP Control Panel and **Start** both:
- ✅ Apache
- ✅ MySQL

---

## Step 3 – Create the Database

1. Open your browser and go to: `http://localhost/phpmyadmin`
2. Click **New** on the left sidebar
3. Create a database named: `uiu_flc`
4. Select `uiu_flc` in the left panel
5. Click **Import** tab → Choose file
6. Import **all `.sql` files** from the `db dump/Structure and data/` folder
   (Do them one by one, in any order)

---

## Step 4 – Configure Database Password (if needed)

Open `backend/config/db.php`:

```php
define('DB_USER', 'root');   // your MySQL username
define('DB_PASS', '');       // your MySQL password (blank for XAMPP default)
```

If your MySQL has a password, enter it there.

---

## Step 5 – Test Database Connection

Go to: `http://localhost/UIU_Friends/backend/config/test_db.php`

You should see: **"Database connection established successfully"** and a list of all tables.

If it fails, check that:
- MySQL is running
- Database name is `uiu_flc`
- Your DB username/password in `db.php` is correct

---

## Step 6 – Open the Application

Go to: `http://localhost/UIU_Friends/login.html`

Register a new account, then log in.

---

## Troubleshooting

### Marketplace shows "Failed to load loan requests"
- Make sure you are on `http://localhost/...` — **not** on `file:///`
- Make sure Apache and MySQL are both running
- Run the DB connection test at `backend/config/test_db.php`

### Login doesn't work / session issues
- Make sure you're using `http://localhost` (not `127.0.0.1`) consistently
- Clear browser cookies for localhost and try again

### "CSRF token missing" error
- Log out and log back in — the CSRF token is issued fresh on each login

---

## File Structure

```
UIU_Friends/
├── backend/
│   ├── api/
│   │   ├── auth/          (login, logout, register, me)
│   │   ├── loan/          (loans, bids, agreement, my_loans, repay)
│   │   ├── campaign/      (campaigns, donate, comments)
│   │   └── user/          (payment_methods, update_profile, verify, reviews)
│   ├── config/
│   │   ├── db.php         ← Edit your DB credentials here
│   │   └── test_db.php    ← Run this to check DB connection
│   └── includes/
│       └── helpers.php    ← Shared utilities, CORS, session
├── db dump/               ← SQL files to import into phpMyAdmin
├── uploads/               ← Profile photos, ID cards, campaign images
└── *.html / *.js / *.css  ← Frontend pages
```

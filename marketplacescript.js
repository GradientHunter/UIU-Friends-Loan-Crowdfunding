// ============================================================
//  marketplacescript.js  –  UIU Loan Marketplace (Fully Fixed)
// ============================================================

var currentSelectedRequestId = null;
var allLoanRequests = [];       // full list from API
var filteredLoans   = [];       // currently displayed (after sort/category/search)
var currentSort     = 'urgent'; // 'urgent' | 'interest' | 'trust'
var currentCategory = '';       // '' = all, or purpose string
var currentSearch   = '';
var currentUserId   = 0;        // set after me.php resolves — never read from localStorage

// ── Helper: stars from avg_rating (0-5 scale) ──────────────────────
function getTrustStars(avgRating) {
    var rating = Math.round(avgRating);
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < rating ? '★' : '☆';
    return stars;
}

// ── Helper: fetch with session cookie + CSRF ──────────────────────
function fetchWithAuth(url, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    if (!options.headers) options.headers = {};
    if (['POST','PUT','DELETE','PATCH'].includes(method)) {
        options.headers['X-CSRF-Token'] = localStorage.getItem('csrf_token') || '';
    }
    options.credentials = 'include';
    return fetch(url, options).then(function(response) {
        return response.json().then(function(data) {
            if (!response.ok) throw new Error(data.message || 'API error');
            return data;
        });
    });
}

// ── Page Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    syncUserProfile();
    loadLoanRequests();

    // Check for direct view param
    var urlParams = new URLSearchParams(window.location.search);
    var viewLoanId = urlParams.get('view-loan');
    if (viewLoanId) viewLoanDetails(parseInt(viewLoanId));

    // Search input (fixed class selector)
    var searchInput = document.getElementById('mp-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            currentSearch = e.target.value.toLowerCase().trim();
            applyFilters();
        });
    }

    // Escape closes modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeLoanDetailsModal();
            closeMpVerificationModal();
            closeLoanModal();
        }
    });
});

// ── Sync user profile into navbar ─────────────────────────────────
function syncUserProfile() {
    fetchWithAuth('backend/api/auth/me.php')
        .then(function(res) {
            var user = res.data;

            // Update navbar name
            var nameEl = document.getElementById('mp-user-name');
            if (nameEl) nameEl.textContent = user.full_name;

            // Update trust score
            var trustEl = document.getElementById('mp-user-trust');
            if (trustEl) {
                var stars = getTrustStars(user.avg_rating || 0);
                trustEl.textContent = 'Trust Score: ' + (stars || '—');
            }

            // Update avatar
            var avatarImg      = document.getElementById('mp-user-avatar-img');
            var avatarInitials = document.getElementById('mp-user-avatar-initials');
            if (user.profile_photo && avatarImg) {
                avatarImg.src          = 'uploads/profiles/' + user.profile_photo;
                avatarImg.style.display = 'block';
                if (avatarInitials) avatarInitials.style.display = 'none';
            } else if (avatarInitials) {
                var parts    = (user.full_name || '').split(' ');
                var initials = parts.map(function(p){ return p.charAt(0).toUpperCase(); }).join('').substring(0,2);
                avatarInitials.textContent  = initials;
                avatarInitials.style.display = 'block';
                if (avatarImg) avatarImg.style.display = 'none';
            }

            // Sidebar trust score
            var sideScore = document.querySelector('.trust-score-box .score');
            if (sideScore) sideScore.textContent = getTrustStars(user.avg_rating || 0) || '☆☆☆☆☆';

            // Store for use in applyFilters — use module var, not localStorage
            currentUserId = parseInt(user.user_id) || 0;
            localStorage.setItem('user_id', user.user_id);
            if (user.is_verified) {
                localStorage.setItem('uiu_verified', 'true');
                localStorage.setItem('uiu_student_id', user.student_id);
                localStorage.setItem('uiu_student_email', user.email);
            } else {
                localStorage.setItem('uiu_verified', 'false');
            }
            updateVerificationBadge();
        })
        .catch(function(err) {
            console.warn('Not logged in or API error:', err.message);
            updateVerificationBadge();
            // Redirect to login if completely unauthenticated
            if (err.message && err.message.toLowerCase().includes('unauthorized')) {
                setTimeout(function(){ window.location.href = 'login.html'; }, 800);
            }
        });
}

// ── Verification badge ─────────────────────────────────────────────
function updateVerificationBadge() {
    var badge = document.getElementById('mp-verification-badge');
    if (!badge) return;
    if (localStorage.getItem('uiu_verified') === 'true') {
        badge.textContent = '✔ Verified Student';
        badge.className   = 'mp-badge verified';
        badge.onclick     = null;
        badge.style.cursor = 'default';
    } else {
        badge.textContent  = '⚠ Unverified — Verify Now';
        badge.className    = 'mp-badge unverified';
        badge.style.cursor = 'pointer';
        badge.onclick      = openVerificationModal;
    }
}

// ── Load all loan requests from API ──────────────────────────────
function loadLoanRequests() {
    var container = document.getElementById('loan-cards-container');
    if (container) container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:#94a3b8;font-size:14px;">Loading loan requests...</div>';

    fetchWithAuth('backend/api/loan/loans.php')
        .then(function(res) {
            allLoanRequests = res.data || [];
            applyFilters();
        })
        .catch(function(err) {
            var container = document.getElementById('loan-cards-container');
            if (container) container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 20px;">' +
                '<span class="material-symbols-outlined" style="font-size:48px;color:#ef4444;display:block;margin-bottom:12px;">error</span>' +
                '<p style="color:#ef4444;font-weight:700;font-size:15px;margin:0 0 6px;">Failed to load loan requests</p>' +
                '<p style="color:#94a3b8;font-size:13px;margin:0;">Error: ' + err.message + '</p>' +
                '<p style="color:#94a3b8;font-size:12px;margin:8px 0 0;">Make sure you are logged in and the backend server is running.</p>' +
                '</div>';
        });
}

// ── Sort button handler ────────────────────────────────────────────
function setSort(btn, sortKey) {
    currentSort = sortKey;
    document.querySelectorAll('.sort-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    applyFilters();
}

// ── Category tag handler ──────────────────────────────────────────
function setCategory(tag, category) {
    currentCategory = category;
    document.querySelectorAll('.category-tag').forEach(function(t){ t.classList.remove('active'); });
    tag.classList.add('active');
    applyFilters();
}

// ── Apply search + category + sort then render ─────────────────────
function applyFilters() {
    // Show ALL loans — own loans get a "Your Post" badge in the card,
    // bid button is disabled for them. No silent hiding.
    var result = allLoanRequests.slice();

    // Filter by search
    if (currentSearch) {
        result = result.filter(function(r) {
            return (r.purpose        || '').toLowerCase().includes(currentSearch) ||
                   (r.reason_details || '').toLowerCase().includes(currentSearch) ||
                   (r.full_name      || '').toLowerCase().includes(currentSearch);
        });
    }

    // Filter by category
    if (currentCategory) {
        result = result.filter(function(r) {
            return (r.purpose || '').toLowerCase().includes(currentCategory.toLowerCase());
        });
    }

    // Sort
    if (currentSort === 'urgent') {
        result.sort(function(a, b){ return a.days_left - b.days_left; });
    } else if (currentSort === 'interest') {
        result.sort(function(a, b){ return a.max_interest_rate - b.max_interest_rate; });
    } else if (currentSort === 'trust') {
        result.sort(function(a, b){ return b.avg_rating - a.avg_rating; });
    }

    filteredLoans = result;
    renderLoanCards(filteredLoans);
}

// ── Render loan cards ─────────────────────────────────────────────
function renderLoanCards(loans) {
    var container = document.getElementById('loan-cards-container');
    if (!container) return;

    if (loans.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 20px;">' +
            '<span class="material-symbols-outlined" style="font-size:48px;color:#cbd5e1;display:block;margin-bottom:12px;">inbox</span>' +
            '<p style="color:#64748b;font-weight:600;font-size:15px;margin:0;">No loan requests found.</p>' +
            '<p style="color:#94a3b8;font-size:13px;margin:6px 0 0;">Try adjusting the search or category filter.</p>' +
            '</div>';
        return;
    }

    var html = '';
    loans.forEach(function(req) {
        var avatarHTML;
        if (req.profile_photo) {
            avatarHTML = '<img src="uploads/profiles/' + req.profile_photo + '" alt="' + escapeHtml(req.full_name) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
        } else {
            avatarHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1E3A8A;color:white;font-weight:700;font-size:14px;border-radius:50%;">' + escapeHtml(req.initials) + '</div>';
        }

        var trustStars = getTrustStars(req.avg_rating || 0);
        var urgencyColor = req.days_left <= 3 ? '#ef4444' : req.days_left <= 7 ? '#f59e0b' : '#10b981';
        var isOwnLoan = (currentUserId > 0 && req.borrower_id === currentUserId);
        var bidButton = isOwnLoan
            ? '<span style="font-size:11px;background:#f1f5f9;color:#94a3b8;padding:7px 12px;border-radius:8px;font-weight:700;white-space:nowrap;">Your Post</span>'
            : '<button type="button" class="request-btn" style="padding:7px 16px;font-size:12px;border-radius:8px;white-space:nowrap;" onclick="viewLoanDetails(' + req.loan_id + ')">View Details</button>';
        var purposeLabel = escapeHtml(req.purpose || 'General');
        var reasonSnip   = req.reason_details
            ? escapeHtml(req.reason_details.substring(0, 130)) + (req.reason_details.length > 130 ? '...' : '')
            : 'No additional details provided.';

        html +=
        '<div class="collapsed-card dynamic-card">' +
            '<div class="collapsed-inner">' +
                '<div class="collapsed-user">' +
                    '<div class="collapsed-avatar" style="width:44px;height:44px;border-radius:50%;overflow:hidden;flex-shrink:0;">' +
                        avatarHTML +
                    '</div>' +
                    '<div style="min-width:0;">' +
                        '<h3 class="collapsed-name" style="font-size:15px;font-weight:700;color:#1e293b;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + purposeLabel + '</h3>' +
                        '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;">' +
                            '<span style="font-size:12px;color:#475569;font-weight:600;">' + escapeHtml(req.full_name) + '</span>' +
                            '<span style="font-size:11px;color:#eab308;letter-spacing:0.5px;">' + trustStars + '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="collapsed-details" style="display:flex;align-items:center;gap:16px;flex-shrink:0;">' +
                    '<div style="text-align:right;">' +
                        '<p style="font-size:17px;font-weight:900;color:#1E3A8A;margin:0;">' + Number(req.amount).toLocaleString() + ' BDT</p>' +
                        '<p style="font-size:11px;color:' + urgencyColor + ';font-weight:700;margin:2px 0 0;">' + req.days_left + ' Days Left</p>' +
                    '</div>' +
                    bidButton +
                '</div>' +
            '</div>' +
            '<p style="font-size:13px;color:#64748b;line-height:1.5;margin:10px 0 0;border-top:1px solid #f1f5f9;padding-top:10px;">' + reasonSnip + '</p>' +
        '</div>';
    });

    container.innerHTML = html;
}

// ── escapeHtml helper ──────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ── View Loan Details Modal ────────────────────────────────────────
function viewLoanDetails(id) {
    currentSelectedRequestId = id;
    var req = allLoanRequests.find(function(r){ return r.loan_id === id; });
    if (!req) {
        fetchWithAuth('backend/api/loan/loans.php')
            .then(function(res) {
                allLoanRequests = res.data || [];
                var found = allLoanRequests.find(function(r){ return r.loan_id === id; });
                if (found) populateDetailsModal(found);
                else showToast('Loan request not found.');
            });
    } else {
        populateDetailsModal(req);
    }
}

function populateDetailsModal(req) {
    document.getElementById('det-modal-ref').textContent   = 'Ref: UIU-L-' + req.loan_id;
    document.getElementById('det-purpose').textContent     = req.purpose || 'Loan Request';
    document.getElementById('det-borrower-name').textContent = req.full_name;
    document.getElementById('det-borrower-dept').textContent = 'UIU Student';
    document.getElementById('det-amount').textContent      = Number(req.amount).toLocaleString() + ' BDT';
    document.getElementById('det-duration').textContent    = req.days_left + ' Days Left';
    document.getElementById('det-trust').textContent       = getTrustStars(req.avg_rating || 0);
    document.getElementById('det-reason').textContent      = req.reason_details || 'No additional details.';

    var avatarEl = document.getElementById('det-borrower-avatar');
    if (avatarEl) {
        avatarEl.src = req.profile_photo
            ? 'uploads/profiles/' + req.profile_photo
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(req.full_name) + '&background=1E3A8A&color=fff';
    }

    var bidRateInput = document.getElementById('detBidAmountInput');
    if (bidRateInput) bidRateInput.placeholder = 'Max: ' + req.max_interest_rate + '%';

    renderDetailsBids(req.loan_id);

    var modal = document.getElementById('loan-details-modal');
    if (modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeLoanDetailsModal() {
    var modal = document.getElementById('loan-details-modal');
    if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
    var inp = document.getElementById('detBidAmountInput');
    if (inp) inp.value = '';
}

// ── Render bids list in details modal ────────────────────────────
function renderDetailsBids(loanId) {
    var listEl  = document.getElementById('det-bids-list');
    var countEl = document.getElementById('det-bid-count');
    if (!listEl) return;
    listEl.innerHTML = '<p style="font-size:12px;color:#94a3b8;text-align:center;padding:12px;">Loading offers...</p>';

    fetchWithAuth('backend/api/loan/bids.php?loan_id=' + loanId)
        .then(function(res) {
            var bids = res.data || [];
            if (countEl) countEl.textContent = bids.length;

            if (bids.length === 0) {
                listEl.innerHTML = '<p style="font-size:12px;color:#94a3b8;text-align:center;padding:12px;margin:0;">No offers yet — be the first to offer!</p>';
                return;
            }

            listEl.innerHTML = bids.map(function(bid) {
                var photo = bid.lender_photo
                    ? 'uploads/profiles/' + bid.lender_photo
                    : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(bid.lender_name) + '&background=10B981&color=fff';
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:6px;">' +
                    '<div style="display:flex;align-items:center;gap:10px;">' +
                        '<img src="' + photo + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" alt="' + escapeHtml(bid.lender_name) + '">' +
                        '<span style="font-size:13px;font-weight:700;color:#1e293b;">' + escapeHtml(bid.lender_name) + '</span>' +
                    '</div>' +
                    '<span class="mp-badge verified" style="font-size:10px;padding:2px 8px;">' + bid.interest_rate + '% Interest</span>' +
                '</div>';
            }).join('');
        })
        .catch(function(err) {
            listEl.innerHTML = '<p style="font-size:12px;color:#ef4444;text-align:center;">Failed to load offers.</p>';
        });
}

// ── Submit a bid ───────────────────────────────────────────────────
function submitLenderBid() {
    if (localStorage.getItem('uiu_verified') !== 'true') {
        closeLoanDetailsModal();
        openVerificationModal();
        return;
    }

    // Prevent bidding on own loan
    var req = allLoanRequests.find(function(r) { return r.loan_id === currentSelectedRequestId; });
    if (req && currentUserId > 0 && req.borrower_id === currentUserId) {
        alert('You cannot bid on your own loan request.');
        return;
    }

    var bidInput = document.getElementById('detBidAmountInput');
    var bidValue = parseFloat(bidInput.value);

    if (isNaN(bidValue) || bidValue <= 0 || bidValue > 20) {
        alert('Please enter a valid interest rate between 0.1% and 20%.');
        return;
    }

    fetchWithAuth('backend/api/loan/bids.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            loan_id:       currentSelectedRequestId,
            interest_rate: bidValue,
            conditions:    'Agreed to terms.',
            message:       'Happy to support your academic need.'
        })
    })
    .then(function() {
        showToast('✅ Bid of ' + bidValue + '% submitted successfully.');
        bidInput.value = '';
        renderDetailsBids(currentSelectedRequestId);
    })
    .catch(function(err) {
        alert('Bid submission failed: ' + err.message);
    });
}

// ── Request a Loan modal ───────────────────────────────────────────
function requestLoan() {
    if (localStorage.getItem('uiu_verified') !== 'true') {
        openVerificationModal();
        return;
    }
    var overlay = document.getElementById('loan-modal-overlay');
    if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; updateLoanSummary(); }
}

function closeLoanModal() {
    var overlay = document.getElementById('loan-modal-overlay');
    if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
}

function handleOverlayClick(event) {
    var box = document.getElementById('loan-modal-box');
    if (box && !box.contains(event.target)) closeLoanModal();
}

// ── Submit loan request ────────────────────────────────────────────
function submitLoanRequest() {
    var agree    = document.getElementById('m-agree-check');
    var amountEl = document.getElementById('m-loan-amount');
    var purposeEl= document.getElementById('m-loan-purpose');
    var durationEl=document.getElementById('m-loan-duration');
    var reasonEl = document.getElementById('m-loan-reason');
    var maxRateEl= document.getElementById('m-loan-max-interest');
    var btn      = document.getElementById('loan-submit-btn');

    if (!agree.checked) { alert('Please agree to the repayment terms before posting.'); return; }
    var amount = parseFloat(amountEl.value);
    if (!amount || amount <= 0) { alert('Please enter a valid loan amount.'); amountEl.focus(); return; }
    if (!reasonEl.value.trim()) { alert('Please explain why you need this loan.'); reasonEl.focus(); return; }

    var maxRate = parseFloat(maxRateEl ? maxRateEl.value : 0) || 5.0;

    // Parse duration to months
    var durationText = durationEl.value; // e.g. "3 Months"
    var months = parseInt(durationText) || 1;
    var targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + months);
    var targetDateStr = targetDate.toISOString().split('T')[0];

    btn.textContent = 'Posting...';
    btn.disabled    = true;

    fetchWithAuth('backend/api/loan/loans.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount:              amount,
            purpose:             purposeEl.value,
            reason_details:      reasonEl.value.trim(),
            repayment_deadline:  targetDateStr,
            max_interest_rate:   maxRate,
            conditions:          'Standard student repayment terms.'
        })
    })
    .then(function() {
        btn.textContent      = '✓ Posted!';
        btn.style.background = '#10b981';
        setTimeout(function() {
            amountEl.value      = '';
            reasonEl.value      = '';
            agree.checked       = false;
            if (maxRateEl) maxRateEl.value = '';
            btn.textContent      = 'Post Loan Request to Marketplace';
            btn.style.background = '';
            btn.disabled         = false;
            closeLoanModal();
            loadLoanRequests();
            showToast('✅ Loan request posted! Check "My Loans" for incoming bids.');
        }, 900);
    })
    .catch(function(err) {
        alert('Loan creation failed: ' + err.message);
        btn.textContent = 'Post Loan Request to Marketplace';
        btn.disabled    = false;
    });
}

// ── Live summary update ────────────────────────────────────────────
function updateLoanSummary() {
    var amount   = document.getElementById('m-loan-amount').value.trim();
    var purpose  = document.getElementById('m-loan-purpose').value;
    var duration = document.getElementById('m-loan-duration').value;
    var sumAmt   = document.getElementById('m-sum-amount');
    var sumPur   = document.getElementById('m-sum-purpose');
    var sumDur   = document.getElementById('m-sum-duration');
    if (!sumAmt) return;
    sumAmt.textContent = (amount && !isNaN(amount) && parseFloat(amount) > 0) ? parseFloat(amount).toLocaleString() + ' BDT' : '0 BDT';
    sumPur.textContent = purpose;
    sumDur.textContent = duration;
}

// ── Verification modal ─────────────────────────────────────────────
function openVerificationModal() {
    var modal = document.getElementById('mp-verification-modal');
    if (modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeMpVerificationModal() {
    var modal = document.getElementById('mp-verification-modal');
    if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
}

function handleMpVerificationOverlayClick(event) {
    var box = document.querySelector('#mp-verification-modal .mp-modal-box');
    if (box && !box.contains(event.target)) closeMpVerificationModal();
}

function handleDetailsOverlayClick(event) {
    var box = document.querySelector('#loan-details-modal .mp-modal-box');
    if (box && !box.contains(event.target)) closeLoanDetailsModal();
}

function submitMpVerification() {
    var studentId    = document.getElementById('mp-student-id').value.trim();
    var studentEmail = document.getElementById('mp-student-email').value.trim();

    if (!studentId) { alert('Please enter your UIU Student ID.'); return; }
    if (!studentEmail || !studentEmail.match(/^[^@]+@.*uiu.*\.ac\.bd$/i)) {
        alert('Please enter a valid UIU institutional email (e.g. student@bscse.uiu.ac.bd).'); return;
    }

    fetchWithAuth('backend/api/user/verify.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, email: studentEmail })
    })
    .then(function() {
        localStorage.setItem('uiu_verified',      'true');
        localStorage.setItem('uiu_student_id',    studentId);
        localStorage.setItem('uiu_student_email', studentEmail);
        closeMpVerificationModal();
        updateVerificationBadge();
        showToast('✅ UIU identity verified! You can now request loans and bid.');
        syncUserProfile();
    })
    .catch(function(err) {
        alert('Verification failed: ' + err.message);
    });
}

// ── Toast ──────────────────────────────────────────────────────────
function showToast(message) {
    var toast = document.getElementById('mp-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'mp-toast';
        toast.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,0.25);max-width:500px;text-align:center;transition:opacity 0.3s;opacity:0;pointer-events:none;';
        document.body.appendChild(toast);
    }
    toast.textContent  = message;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function(){ toast.style.opacity = '0'; }, 4000);
}

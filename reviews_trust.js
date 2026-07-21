// ============================================================
//  reviews_trust.js  –  UIU Reviews & Trust Integration (API Active)
// ============================================================

// Helper for fetching with Auth headers
function fetchWithAuth(url, options = {}) {
  var method = (options.method || 'GET').toUpperCase();
  if (!options.headers) options.headers = {};
  // Fix #12: send CSRF token for all state-changing requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    var csrf = localStorage.getItem('csrf_token') || '';
    options.headers['X-CSRF-Token'] = csrf;
  }
  // Fix #5: removed X-User-ID header (was spoofable) — session cookie handles auth
  options.credentials = 'include'; // Fix #6: send session cookie cross-origin
  return fetch(url, options).then(response => {
    return response.json().then(data => {
      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }
      return data;
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
    syncUserProfile();
    loadReviewsData();

    // Intercept logout link if it exists in sidebar bottom
    var logoutLink = document.querySelector('.logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            fetch('backend/api/auth/logout.php')
                .finally(() => {
                    localStorage.clear();
                    alert('Logged out successfully.');
                    window.location.href = 'login.html';
                });
        });
    }
});

// Sync user details across overview cards and header
function syncUserProfile() {
    fetchWithAuth('backend/api/auth/me.php')
      .then(res => {
        var user = res.data;
        
        // Header
        var unameHdr = document.querySelector('.uname');
        if (unameHdr) unameHdr.textContent = user.full_name;

        var uidHdr = document.querySelector('.uid');
        if (uidHdr) uidHdr.textContent = 'ID: ' + (user.student_id || 'Pending');

        var avatarImg = document.querySelector('.user-group img');
        if (avatarImg) {
          if (user.profile_photo) {
            avatarImg.src = 'uploads/profiles/' + user.profile_photo;
          } else {
            avatarImg.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.full_name) + '&background=1E3A8A&color=fff';
          }
        }

        // Profile Card
        var pCardName = document.querySelector('.profile-info h2');
        if (pCardName) pCardName.textContent = user.full_name;

        var pCardDept = document.querySelector('.profile-info p.dept');
        if (pCardDept) pCardDept.textContent = (user.department || 'UIU Student') + (user.student_id ? ', Batch ' + user.student_id.substring(3, 6) : '');

        var avatarMain = document.querySelector('.avatar-wrap img');
        if (avatarMain) {
          if (user.profile_photo) {
            avatarMain.src = 'uploads/profiles/' + user.profile_photo;
          } else {
            avatarMain.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.full_name) + '&background=1E3A8A&color=fff';
          }
        }

        // UIU ID badge verification sync
        var badgeRow = document.querySelector('.badge-row');
        if (badgeRow) {
            if (user.is_verified) {
                badgeRow.innerHTML = `
                    <span class="badge blue" style="background:#d1fae5; color:#065f46; border:1px solid #a7f3d0;">
                        <span class="material-symbols-outlined">badge</span>
                        UIU ID Verified
                    </span>
                    <span class="badge green" style="background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe;">
                        <span class="material-symbols-outlined">security</span>
                        Active Student
                    </span>
                `;
            } else {
                badgeRow.innerHTML = `
                    <span class="badge red" style="background:#fee2e2; color:#991b1b; border:1px solid #fca5a5;">
                        <span class="material-symbols-outlined">error</span>
                        Unverified Student
                    </span>
                `;
            }
        }
      })
      .catch(function(err) {
        console.log('Not logged in:', err.message);
        window.location.href = 'login.html';
      });
}

// Load reviews data from database
function loadReviewsData() {
    fetchWithAuth('backend/api/user/reviews.php')
      .then(res => {
        var details = res.data;
        updateTrustStarsDisplay(details.avg_rating, details.total_reviews);
        renderReviewsList(details.reviews);
      })
      .catch(err => {
        console.error('Error loading reviews:', err);
      });

    // Load activity + real stats from my_loans + campaigns
    fetchWithAuth('backend/api/loan/my_loans.php')
      .then(res => {
        var data = res.data || {};
        var agreements  = data.agreements  || [];
        var repayments  = data.repayments  || [];
        var requests    = data.requests    || [];

        renderActivityFeed(agreements, repayments);

        // Total Repaid = count of completed borrower agreements
        var totalRepaid = agreements.filter(function(a) {
            return a.role === 'borrower' && a.repayment_status === 'completed';
        }).length;

        // Total Lent = sum of principal on lender agreements
        var totalLent = agreements
            .filter(function(a) { return a.role === 'lender'; })
            .reduce(function(sum, a) { return sum + a.principal_amount; }, 0);

        // Late payments = overdue active agreements where due_date < today
        var today = new Date();
        var lateCount = agreements.filter(function(a) {
            return (a.repayment_status === 'pending' || a.repayment_status === 'partial')
                && new Date(a.due_date) < today;
        }).length;

        // Populate stat boxes
        var repaidEl = document.getElementById('rt-stat-repaid');
        if (repaidEl) repaidEl.textContent = totalRepaid;

        var lentEl = document.getElementById('rt-stat-lent');
        if (lentEl) lentEl.innerHTML = formatBDT(totalLent) + ' <span class="unit">BDT</span>';

        var lateEl = document.getElementById('rt-stat-late');
        if (lateEl) lateEl.textContent = lateCount;

        // Preferred method = most recent payment method type from profile, fallback to active repayment method
        var lastRepayMethod = repayments.length > 0 ? repayments[0].payment_method : null;
        var preferredEl = document.getElementById('rt-preferred-method');
        if (preferredEl && lastRepayMethod) {
            var methodLabels = { bkash: 'bKash', nagad: 'Nagad', bank: 'Bank Transfer', cash: 'Cash' };
            preferredEl.textContent = methodLabels[lastRepayMethod] || lastRepayMethod;
        } else if (preferredEl) {
            preferredEl.textContent = '—';
        }
      })
      .catch(err => {
        console.error('Error loading activity/stats:', err);
      });

    // Crowdfunding count
    fetchWithAuth('backend/api/campaign/campaigns.php?my=1')
      .then(res => {
        var campaigns = res.data || [];
        var cfEl = document.getElementById('rt-stat-crowdfunding');
        if (cfEl) cfEl.textContent = campaigns.length;
      })
      .catch(function() {
        var cfEl = document.getElementById('rt-stat-crowdfunding');
        if (cfEl) cfEl.textContent = '0';
      });
}

function renderActivityFeed(agreements, repayments) {
    var container = document.getElementById('rt-activity-container');
    if (!container) return;

    var items = [];

    // Repayments → "Repaid X BDT"
    (repayments || []).forEach(function(r) {
        items.push({
            dot: 'green',
            title: 'Repaid ' + Number(r.amount_paid).toLocaleString() + ' BDT',
            sub: (r.payment_method || 'Payment') + ' &bull; ' + timeAgo(r.paid_at),
        });
    });

    // Active agreements → "Loan Active"
    (agreements || []).filter(function(a) {
        return a.repayment_status === 'pending' || a.repayment_status === 'partial';
    }).forEach(function(a) {
        items.push({
            dot: 'blue',
            title: a.role === 'borrower' ? 'Loan Active — ' + Number(a.principal_amount).toLocaleString() + ' BDT' : 'Investment Active — ' + Number(a.principal_amount).toLocaleString() + ' BDT',
            sub: (a.role === 'borrower' ? 'From ' + a.lender_name : 'To ' + a.borrower_name) + ' &bull; Due: ' + a.due_date,
        });
    });

    // Completed agreements
    (agreements || []).filter(function(a) {
        return a.repayment_status === 'completed';
    }).forEach(function(a) {
        items.push({
            dot: 'gray',
            title: 'Loan Cleared — ' + Number(a.principal_amount).toLocaleString() + ' BDT',
            sub: (a.role === 'borrower' ? 'Repaid to ' + a.lender_name : 'Recovered from ' + a.borrower_name),
        });
    });

    if (items.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; font-size:13px; text-align:center; padding:12px 0;">No recent activity yet.</p>';
        return;
    }

    container.innerHTML = items.slice(0, 5).map(function(item, idx, arr) {
        var isLast = idx === arr.length - 1;
        return '<div class="timeline-item" style="display:flex; gap:12px; margin-bottom:' + (isLast ? '0' : '12px') + ';">' +
            '<div class="dot-col" style="display:flex; flex-direction:column; align-items:center;">' +
                '<div class="t-dot ' + item.dot + '" style="width:10px; height:10px; border-radius:50%; flex-shrink:0; background:' + ({green:'#10b981',blue:'#1E3A8A',gray:'#94a3b8'}[item.dot] || '#94a3b8') + ';"></div>' +
                (!isLast ? '<div style="width:2px; flex:1; background:#e2e8f0; margin-top:4px;"></div>' : '') +
            '</div>' +
            '<div class="t-body" style="padding-bottom:' + (isLast ? '0' : '8px') + ';">' +
                '<p class="tt" style="font-size:13px; font-weight:700; color:#1e293b; margin:0;">' + item.title + '</p>' +
                '<p class="ts" style="font-size:11px; color:#94a3b8; margin:2px 0 0;">' + item.sub + '</p>' +
            '</div>' +
        '</div>';
    }).join('');
}

function formatBDT(amount) {
    if (amount >= 1000) return Math.round(amount / 1000) + 'k';
    return Number(amount).toLocaleString();
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    var diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + ' min ago';
    if (diff < 86400) return Math.floor(diff/3600) + ' hr ago';
    if (diff < 604800) return Math.floor(diff/86400) + ' days ago';
    return new Date(dateStr).toLocaleDateString();
}

function updateTrustStarsDisplay(avgRating, totalReviews) {
    var rating = Math.round(avgRating);
    var starsHTML = '';
    for (var i = 0; i < 5; i++) {
        starsHTML += `<span class="material-symbols-outlined" style="font-size:36px; font-variation-settings:'FILL' ${i < rating ? 1 : 0}; color:${i < rating ? '#f59e0b' : '#cbd5e1'};">star</span>`;
    }

    var starsWrap = document.querySelector('.stars-wrap');
    if (starsWrap) starsWrap.innerHTML = starsHTML;

    // Sidebar small stars
    var sbStars = document.querySelector('.sidebar-bottom .stars');
    if (sbStars) {
        var sbStarsHTML = '';
        for (var i = 0; i < 5; i++) {
            sbStarsHTML += `<span class="material-symbols-outlined" style="font-size:16px; font-variation-settings:'FILL' ${i < rating ? 1 : 0}; color:#f59e0b;">star</span>`;
        }
        sbStars.innerHTML = sbStarsHTML;
    }

    // Badge / Pill
    var badge = document.querySelector('.exc-badge');
    if (badge) {
        if (avgRating >= 4.5) {
            badge.textContent = 'Excellent Borrower';
            badge.className = 'exc-badge';
            badge.style.background = '#d1fae5';
            badge.style.color = '#065f46';
        } else if (avgRating >= 3.5) {
            badge.textContent = 'Good Standing';
            badge.className = 'exc-badge';
            badge.style.background = '#eff6ff';
            badge.style.color = '#1e40af';
        } else {
            badge.textContent = 'Needs Verification';
            badge.className = 'exc-badge';
            badge.style.background = '#fef3c7';
            badge.style.color = '#92400e';
        }
    }

    var note = document.getElementById('rt-gauge-note') || document.querySelector('.gauge-note');
    if (note) {
        note.textContent = 'Based on ' + totalReviews + ' peer review' + (totalReviews !== 1 ? 's' : '') + ' and transaction records.';
    }
}

// Render dynamic reviews list
function renderReviewsList(reviews) {
    var container = document.querySelector('.reviews-list');
    if (!container) return;

    var headerHTML = `
        <div class="reviews-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="margin:0; font-size:16px; font-weight:800;">Ratings &amp; Reviews</h3>
        </div>
    `;

    if (reviews.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:32px; font-size:13px;">No peer reviews received yet.</p>';
        return;
    }

    var reviewsHTML = reviews.map(r => {
        var photo = r.reviewer_photo
            ? 'uploads/profiles/' + r.reviewer_photo
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(r.reviewer_name) + '&background=1E3A8A&color=fff';

        var starsHTML = '';
        for (var i = 0; i < 5; i++) {
            starsHTML += `<span class="material-symbols-outlined" style="font-variation-settings:'FILL' ${i < r.rating ? 1 : 0}; color:${i < r.rating ? '#f59e0b' : '#cbd5e1'}; font-size:16px;">star</span>`;
        }

        var date = new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        return `
            <div class="review-card" style="background: white; border: 1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:12px;">
                <div class="rev-top" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div class="rev-left" style="display:flex; gap:10px; align-items:center;">
                        <img src="${photo}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" alt="${r.reviewer_name}">
                        <div>
                            <p class="rev-name" style="font-weight:700; font-size:13px; color:#1e293b; margin:0;">${r.reviewer_name}</p>
                            <div class="stars" style="display:flex;">
                                ${starsHTML}
                            </div>
                        </div>
                    </div>
                    <span class="role-tag peer" style="font-size:10px; background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:4px; font-weight:700;">Peer Partner</span>
                </div>
                <p class="rev-text" style="font-size:13px; color:#475569; margin:0 0 10px; line-height:1.4;">"${r.comment || 'No comment left.'}"</p>
                <div class="rev-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f8fafc; padding-top:10px; margin-top:10px;">
                    <span class="rev-date" style="font-size:11px; color:#94a3b8;">${date}</span>
                    <button class="helpful-btn" onclick="markHelpful(this)" style="background:none; border:none; color:#64748b; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:16px;">thumb_up</span>
                        Helpful
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = reviewsHTML;
}

// Keep search/helper methods intact
function setSort(btn) {
    document.querySelectorAll('.sort-btn').forEach(function(b) {
        b.classList.remove('active');
    });
    btn.classList.add('active');
}

function markHelpful(btn) {
    var icon = btn.querySelector('.material-symbols-outlined');
    if (btn.classList.contains('liked')) {
        btn.classList.remove('liked');
        btn.style.color = '';
        icon.style.fontVariationSettings = "'FILL' 0";
    } else {
        btn.classList.add('liked');
        btn.style.color = '#1E3A8A';
        icon.style.fontVariationSettings = "'FILL' 1";
    }
}

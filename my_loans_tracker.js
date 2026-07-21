// ============================================================
//  my_loans_tracker.js  –  UIU My Loans Integration (API Active)
// ============================================================

var selectedMlOffer = null; 
var myLoansData = {}; 

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
    // Sync header profile details
    syncUserProfile();

    // Load user's loan data
    loadMyLoansData();

    // Tab switching event listeners
    var borrowedBtn = document.getElementById('tab-borrowed');
    var lentBtn = document.getElementById('tab-lent');
    var borrowedView = document.getElementById('view-borrowed');
    var lentView = document.getElementById('view-lent');

    if (borrowedBtn && lentBtn && borrowedView && lentView) {
        borrowedBtn.addEventListener('click', function () {
            switchTab('borrowed');
        });

        lentBtn.addEventListener('click', function () {
            switchTab('lent');
        });
    }

    // Intercept notifications button
    var notifBtn = document.getElementById('notif-btn');
    if (notifBtn) {
      notifBtn.addEventListener('click', function () {
        alert('Check dashboard for real-time notifications count.');
      });
    }
});

function switchTab(tab) {
  var borrowedBtn = document.getElementById('tab-borrowed');
  var lentBtn = document.getElementById('tab-lent');
  var borrowedView = document.getElementById('view-borrowed');
  var lentView = document.getElementById('view-lent');

  if (tab === 'borrowed') {
    borrowedBtn.classList.add('active');
    lentBtn.classList.remove('active');
    borrowedView.style.display = '';
    lentView.style.display = 'none';
  } else {
    lentBtn.classList.add('active');
    borrowedBtn.classList.remove('active');
    lentView.style.display = '';
    borrowedView.style.display = 'none';
  }
}

// Sync profile information
function syncUserProfile() {
    fetchWithAuth('backend/api/auth/me.php')
      .then(function(res) {
        var user = res.data;
        
        var nameEl = document.querySelector('.user-name');
        if (nameEl) nameEl.textContent = user.full_name;

        var avatarImg = document.querySelector('.user-profile img');
        if (avatarImg) {
          if (user.profile_photo) {
            avatarImg.src = 'uploads/profiles/' + user.profile_photo;
          } else {
            avatarImg.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.full_name) + '&background=1E3A8A&color=fff';
          }
        }

        // Populate sidebar trust + profile details
        updateSidebarProfile(user);
      })
      .catch(function(err) {
        console.log('Not logged in:', err.message);
        window.location.href = 'login.html';
      });
}

// Load My Loans details
function loadMyLoansData() {
    fetchWithAuth('backend/api/loan/my_loans.php')
        .then(res => {
            myLoansData = res.data;
            renderBorrowedView();
            renderLentView();
        })
        .catch(err => {
            console.error('Error loading my loans:', err);
        });
}

// Render Borrowed view
function renderBorrowedView() {
    var requests = myLoansData.requests || [];
    var agreements = myLoansData.agreements || [];

    var activeAgreements = agreements.filter(function(a) {
      return a.role === 'borrower' && (a.repayment_status === 'pending' || a.repayment_status === 'partial');
    });
    var completedAgreements = agreements.filter(function(a) {
      return a.role === 'borrower' && a.repayment_status === 'completed';
    });

    var totalDebt = activeAgreements.reduce(function(sum, a) { return sum + a.remaining_amount; }, 0);
    // Next installment = remaining on the earliest-due active agreement (not a simulation, real balance)
    var nextDueAg = activeAgreements.length > 0
      ? activeAgreements.slice().sort(function(a, b) { return new Date(a.due_date) - new Date(b.due_date); })[0]
      : null;
    var nextDue = nextDueAg ? nextDueAg.remaining_amount : 0;
    var nextDueDateStr = nextDueAg ? 'Due: ' + nextDueAg.due_date : 'No active loans';

    // Populate stat cards
    var debtEl = document.getElementById('stat-total-debt');
    if (debtEl) debtEl.textContent = totalDebt.toLocaleString() + ' BDT';

    var debtFooter = document.getElementById('stat-debt-footer');
    if (debtFooter) debtFooter.textContent = activeAgreements.length + ' active loan(s)';

    var nextDueEl = document.getElementById('stat-next-due');
    if (nextDueEl) nextDueEl.textContent = nextDue.toLocaleString() + ' BDT';

    var dueFooterEl = document.getElementById('stat-due-footer');
    if (dueFooterEl) dueFooterEl.innerHTML = '<span class="material-symbols-outlined">schedule</span> ' + nextDueDateStr;

    var paidCountEl = document.getElementById('stat-paid-count');
    if (paidCountEl) paidCountEl.textContent = completedAgreements.length;

    var paidFooterEl = document.getElementById('stat-paid-footer');
    if (paidFooterEl) paidFooterEl.textContent = completedAgreements.length + ' loan(s) fully repaid';

    var pendingCountBadge = document.getElementById('pending-count');
    var completedCountBadge = document.getElementById('completed-count');

    // Render Active Agreement Cards
    var activeContainer = document.getElementById('myloans-active-container');
    if (activeContainer) {
      if (activeAgreements.length === 0) {
        activeContainer.innerHTML = '<div class="loan-card" style="padding:28px; text-align:center; color:#94a3b8; font-size:14px;"><span class="material-symbols-outlined" style="font-size:40px; display:block; margin-bottom:10px;">inbox</span>No active borrowed loans right now. <a href="marketplace.html" style="color:#1E3A8A; font-weight:700;">Browse Marketplace</a></div>';
      } else {
        activeContainer.innerHTML = activeAgreements.map(function(ag) {
          var paidPct = ag.total_payable > 0 ? Math.round((ag.paid_amount / ag.total_payable) * 100) : 0;
          return '<div class="loan-card" style="margin-bottom:16px;">' +
            '<div class="loan-card-header" style="padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">' +
              '<div class="loan-card-left" style="display:flex; gap:12px; align-items:center;">' +
                '<div class="loan-icon-box" style="width:40px; height:40px; border-radius:8px; background:rgba(30, 58, 138, 0.1); display:flex; align-items:center; justify-content:center; color:#1E3A8A;">' +
                  '<span class="material-symbols-outlined">school</span>' +
                '</div>' +
                '<div>' +
                  '<div class="loan-title-row" style="display:flex; align-items:center; gap:8px;">' +
                    '<h4 class="loan-title" style="font-weight:700; font-size:15px; margin:0;">Agreement #' + ag.agreement_id + '</h4>' +
                    '<span style="font-size:10px; background:#d1fae5; color:#065f46; padding:2px 6px; border-radius:4px; font-weight:700;">Active</span>' +
                  '</div>' +
                  '<p class="loan-meta" style="font-size:11px; color:#64748b; margin:2px 0 0;">Lender: <strong>' + ag.lender_name + '</strong> &bull; Interest: ' + ag.interest_rate + '% &bull; Due: ' + ag.due_date + '</p>' +
                '</div>' +
              '</div>' +
              '<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">' +
                '<div style="text-align:right;">' +
                  '<p style="font-size:10px; color:#94a3b8; margin:0;">Remaining</p>' +
                  '<p style="font-size:16px; font-weight:900; color:#1E3A8A; margin:0;">' + ag.remaining_amount.toLocaleString() + ' BDT</p>' +
                '</div>' +
                '<a href="agreement.html?agreement_id=' + ag.agreement_id + '" style="background:#f1f5f9; color:#1E3A8A; border:1px solid #e2e8f0; padding:8px 12px; border-radius:10px; font-weight:700; font-size:11px; text-decoration:none; display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">description</span> Agreement</a>' +
                '<button onclick="triggerRepay(' + ag.agreement_id + ', ' + ag.remaining_amount + ')" class="pay-btn" style="background:#1E3A8A; color:white; border:none; padding:8px 16px; border-radius:10px; font-weight:700; font-size:12px; cursor:pointer;">Pay Installment</button>' +
              '</div>' +
            '</div>' +
            '<div class="loan-card-body" style="padding:16px 20px;">' +
              '<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px;">' +
                '<span style="color:#10b981; font-weight:600;">Paid: ' + ag.paid_amount.toLocaleString() + ' BDT</span>' +
                '<span style="color:#64748b;">Total: ' + ag.total_payable.toLocaleString() + ' BDT</span>' +
              '</div>' +
              '<div style="height:6px; background:#e2e8f0; border-radius:4px; overflow:hidden;">' +
                '<div style="height:100%; width:' + paidPct + '%; background:#10b981; border-radius:4px; transition:width 0.5s;"></div>' +
              '</div>' +
              '<p style="font-size:11px; color:#94a3b8; margin:6px 0 0;">' + paidPct + '% repaid</p>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }

    // Render Pending Requests
    var pendingContainer = document.getElementById('myloans-pending-container');
    var pendingReqs = requests.filter(function(r) { return r.status === 'open'; });
    if (pendingCountBadge) pendingCountBadge.textContent = pendingReqs.length;

    if (pendingContainer) {
      if (pendingReqs.length === 0) {
        pendingContainer.innerHTML = '<p style="padding:16px; text-align:center; color:#94a3b8; font-size:13px;">No pending loan requests.</p>';
      } else {
        pendingContainer.innerHTML = pendingReqs.map(function(req) {
          return '<div class="list-item-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f1f5f9;">' +
            '<div class="list-item-left" style="display:flex; gap:10px; align-items:center;">' +
              '<span class="material-symbols-outlined" style="color:#64748b;">description</span>' +
              '<div>' +
                '<p class="item-title" style="font-size:13px; font-weight:700; color:#1e293b; margin:0;">' + req.purpose + '</p>' +
                '<p class="item-meta" style="font-size:11px; color:#94a3b8; margin:0;">Amount: ' + req.amount.toLocaleString() + ' BDT &bull; Deadline: ' + req.repayment_deadline + '</p>' +
              '</div>' +
            '</div>' +
            '<span style="font-size:10px; background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-weight:700;">Awaiting Bids</span>' +
          '</div>';
        }).join('');
      }
    }

    // Render Completed Loans
    var completedContainer = document.getElementById('myloans-completed-container');
    if (completedCountBadge) completedCountBadge.textContent = completedAgreements.length;

    if (completedContainer) {
      if (completedAgreements.length === 0) {
        completedContainer.innerHTML = '<p style="padding:16px; text-align:center; color:#94a3b8; font-size:13px;">No completed loans yet.</p>';
      } else {
        completedContainer.innerHTML = completedAgreements.map(function(ag) {
          return '<div class="completed-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-bottom:1px solid #f1f5f9;">' +
            '<div class="list-item-left" style="display:flex; gap:10px; align-items:center;">' +
              '<span class="material-symbols-outlined" style="color:#10b981;">verified</span>' +
              '<div>' +
                '<p style="font-size:13px; font-weight:700; color:#1e293b; margin:0;">Agreement #' + ag.agreement_id + ' — ' + ag.lender_name + '</p>' +
                '<p style="font-size:11px; color:#94a3b8; margin:0;">Paid: ' + ag.total_payable.toLocaleString() + ' BDT &bull; Due: ' + ag.due_date + '</p>' +
              '</div>' +
            '</div>' +
            '<span style="font-size:10px; background:#d1fae5; color:#065f46; padding:2px 6px; border-radius:4px; font-weight:700;">Cleared</span>' +
          '</div>';
        }).join('');
      }
    }
}

// Render Lent view
function renderLentView() {
    var agreements = myLoansData.agreements || [];
    var bids = myLoansData.my_bids || [];

    var activeLent = agreements.filter(function(a) {
      return a.role === 'lender' && (a.repayment_status === 'pending' || a.repayment_status === 'partial');
    });
    var completedLent = agreements.filter(function(a) {
      return a.role === 'lender' && a.repayment_status === 'completed';
    });
    var pendingBids = bids.filter(function(b) { return b.status === 'pending'; });

    var totalInvested = activeLent.reduce(function(sum, a) { return sum + a.principal_amount; }, 0);
    var expectedReturn = activeLent.reduce(function(sum, a) { return sum + a.remaining_amount; }, 0);
    var interestEarned = completedLent.reduce(function(sum, a) { return sum + (a.total_payable - a.principal_amount); }, 0);

    var investedEl = document.getElementById('stat-total-lent');
    if (investedEl) investedEl.textContent = totalInvested.toLocaleString() + ' BDT';

    var lentFooter = document.getElementById('stat-lent-footer');
    if (lentFooter) lentFooter.textContent = activeLent.length + ' active loan(s) out';

    var expectedEl = document.getElementById('stat-expected-return');
    if (expectedEl) expectedEl.textContent = expectedReturn.toLocaleString() + ' BDT';

    var recoveredEl = document.getElementById('stat-recovered-count');
    if (recoveredEl) recoveredEl.textContent = completedLent.length;

    var recoveredFooter = document.getElementById('stat-recovered-footer');
    if (recoveredFooter) recoveredFooter.textContent = 'Interest earned: ' + interestEarned.toLocaleString() + ' BDT';

    var pendingBidsBadge = document.getElementById('pending-bids-count');
    if (pendingBidsBadge) pendingBidsBadge.textContent = pendingBids.length;

    var recoveredBadge = document.getElementById('recovered-count-badge');
    if (recoveredBadge) recoveredBadge.textContent = completedLent.length;

    // Active Lending
    var lentActiveContainer = document.getElementById('myloans-lent-active-container');
    if (lentActiveContainer) {
      if (activeLent.length === 0) {
        lentActiveContainer.innerHTML = '<div class="loan-card" style="padding:28px; text-align:center; color:#94a3b8; font-size:14px;"><span class="material-symbols-outlined" style="font-size:40px; display:block; margin-bottom:10px;">inbox</span>No active investments right now. <a href="marketplace.html" style="color:#1E3A8A; font-weight:700;">Find a loan to fund</a></div>';
      } else {
        lentActiveContainer.innerHTML = activeLent.map(function(ag) {
          var paidPct = ag.total_payable > 0 ? Math.round((ag.paid_amount / ag.total_payable) * 100) : 0;
          return '<div class="loan-card" style="margin-bottom:16px;">' +
            '<div class="loan-card-header" style="padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">' +
              '<div class="loan-card-left" style="display:flex; gap:12px; align-items:center;">' +
                '<div style="width:40px; height:40px; border-radius:8px; background:rgba(16,185,129,0.1); display:flex; align-items:center; justify-content:center; color:#10b981;">' +
                  '<span class="material-symbols-outlined">person</span>' +
                '</div>' +
                '<div>' +
                  '<div style="display:flex; align-items:center; gap:8px;">' +
                    '<h4 style="font-weight:700; font-size:15px; margin:0;">Lent to ' + ag.borrower_name + '</h4>' +
                    '<span style="font-size:10px; background:#d1fae5; color:#065f46; padding:2px 6px; border-radius:4px; font-weight:700;">Active</span>' +
                  '</div>' +
                  '<p style="font-size:11px; color:#64748b; margin:2px 0 0;">Agreement #' + ag.agreement_id + ' &bull; Interest: ' + ag.interest_rate + '% &bull; Due: ' + ag.due_date + '</p>' +
                '</div>' +
              '</div>' +
              '<div style="text-align:right;">' +
                '<p style="font-size:10px; color:#94a3b8; margin:0;">Receivable</p>' +
                '<p style="font-size:16px; font-weight:900; color:#10b981; margin:0;">' + ag.remaining_amount.toLocaleString() + ' BDT</p>' +
              '</div>' +
            '</div>' +
            '<div style="padding:16px 20px;">' +
              '<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px;">' +
                '<span style="color:#10b981; font-weight:600;">Received: ' + ag.paid_amount.toLocaleString() + ' BDT</span>' +
                '<span style="color:#64748b;">Total: ' + ag.total_payable.toLocaleString() + ' BDT</span>' +
              '</div>' +
              '<div style="height:6px; background:#e2e8f0; border-radius:4px; overflow:hidden;">' +
                '<div style="height:100%; width:' + paidPct + '%; background:#10b981; border-radius:4px;"></div>' +
              '</div>' +
              '<p style="font-size:11px; color:#94a3b8; margin:6px 0 0;">' + paidPct + '% recovered</p>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }

    // Pending Bids
    var bidsContainer = document.getElementById('myloans-lent-bids-container');
    if (bidsContainer) {
      if (pendingBids.length === 0) {
        bidsContainer.innerHTML = '<p style="padding:16px; text-align:center; color:#94a3b8; font-size:13px;">No pending bids. <a href="marketplace.html" style="color:#1E3A8A; font-weight:700;">Browse marketplace</a></p>';
      } else {
        bidsContainer.innerHTML = pendingBids.map(function(b) {
          return '<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f1f5f9;">' +
            '<div style="display:flex; gap:10px; align-items:center;">' +
              '<span class="material-symbols-outlined" style="color:#64748b;">description</span>' +
              '<div>' +
                '<p style="font-size:13px; font-weight:700; color:#1e293b; margin:0;">' + b.loan_purpose + '</p>' +
                '<p style="font-size:11px; color:#94a3b8; margin:0;">Amount: ' + b.loan_amount.toLocaleString() + ' BDT &bull; Your rate: ' + b.interest_rate + '%</p>' +
              '</div>' +
            '</div>' +
            '<span style="font-size:10px; background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-weight:700;">Awaiting</span>' +
          '</div>';
        }).join('');
      }
    }

    // Recovered / Completed Loans
    var lentCompletedContainer = document.getElementById('myloans-lent-completed-container');
    if (lentCompletedContainer) {
      if (completedLent.length === 0) {
        lentCompletedContainer.innerHTML = '<p style="padding:16px; text-align:center; color:#94a3b8; font-size:13px;">No recovered loans yet.</p>';
      } else {
        lentCompletedContainer.innerHTML = completedLent.map(function(ag) {
          return '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-bottom:1px solid #f1f5f9;">' +
            '<div style="display:flex; gap:10px; align-items:center;">' +
              '<span class="material-symbols-outlined" style="color:#10b981;">verified</span>' +
              '<div>' +
                '<p style="font-size:13px; font-weight:700; color:#1e293b; margin:0;">Lent to ' + ag.borrower_name + '</p>' +
                '<p style="font-size:11px; color:#94a3b8; margin:0;">Recovered: ' + ag.total_payable.toLocaleString() + ' BDT &bull; Due: ' + ag.due_date + '</p>' +
              '</div>' +
            '</div>' +
            '<span style="font-size:10px; background:#d1fae5; color:#065f46; padding:2px 6px; border-radius:4px; font-weight:700;">Recovered</span>' +
          '</div>';
        }).join('');
      }
    }
}

// Repay action — let user enter the exact amount they want to pay
function triggerRepay(agreementId, remainingAmount) {
    var inputAmount = prompt(
        'Enter repayment amount (BDT).\nRemaining balance: ' + remainingAmount.toLocaleString() + ' BDT',
        Math.min(remainingAmount, remainingAmount).toFixed(2)
    );
    if (inputAmount === null) return; // cancelled
    var payAmount = parseFloat(inputAmount);
    if (isNaN(payAmount) || payAmount <= 0) {
        alert('Please enter a valid amount greater than 0.');
        return;
    }
    if (payAmount > remainingAmount + 0.01) {
        alert('Amount exceeds remaining balance of ' + remainingAmount.toLocaleString() + ' BDT.');
        return;
    }

    var payMethod = prompt('Enter payment method (bkash / nagad / bank):', 'bkash') || 'bkash';

    fetchWithAuth('backend/api/loan/repay.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agreement_id: agreementId,
            amount_paid: payAmount,
            payment_method: payMethod,
            transaction_ref: 'TXN_T_' + Date.now(),
            note: 'Repayment via My Loans tracker.'
        })
    })
    .then(function(res) {
        alert('Repayment of ' + payAmount.toLocaleString() + ' BDT recorded successfully.');
        loadMyLoansData();
    })
    .catch(function(err) {
        alert('Repayment failed: ' + err.message);
    });
}

// Update sidebar trust score/profile from API response
function updateSidebarProfile(user) {
    var nameEls = document.querySelectorAll('.user-name');
    nameEls.forEach(function(el) { el.textContent = user.full_name; });

    var avatarEl = document.getElementById('sidebar-avatar');
    if (avatarEl) {
        avatarEl.src = user.profile_photo
            ? 'uploads/profiles/' + user.profile_photo
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.full_name) + '&background=1E3A8A&color=fff';
    }

    var idEl = document.getElementById('sidebar-user-id');
    if (idEl) idEl.textContent = 'ID: ' + (user.student_id || '—');

    // Trust score
    var rating = Math.round(user.avg_rating || 0);
    var starsEl = document.getElementById('sidebar-trust-stars');
    if (starsEl) {
        var stars = '';
        for (var i = 0; i < 5; i++) {
            stars += '<span class="star ' + (i < rating ? 'filled' : '') + '">' + (i < rating ? '★' : '☆') + '</span>';
        }
        stars += '<span class="material-symbols-outlined trust-icon">verified_user</span>';
        starsEl.innerHTML = stars;
    }

    var barFill = document.getElementById('trust-bar-fill');
    if (barFill) barFill.style.width = (rating / 5 * 100) + '%';

    var badgeEl = document.getElementById('trust-badge-label');
    if (badgeEl) {
        var labels = ['—', 'POOR', 'FAIR', 'GOOD', 'GREAT', 'EXCELLENT'];
        badgeEl.textContent = labels[rating] || '—';
    }
}

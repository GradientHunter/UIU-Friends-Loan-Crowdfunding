// ============================================================
//  myloansscript.js  –  UIU My Loans Integration (API Active)
// ============================================================

var selectedMlOffer = null; // Stores offer_id for acceptance
var myLoansData = {}; // Cache for loaded data

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
    var borrowedBtn = document.getElementById('borrowedTabBtn');
    var lentBtn = document.getElementById('lentTabBtn');
    var borrowedView = document.getElementById('borrowedView');
    var lentView = document.getElementById('lentView');

    if (borrowedBtn && lentBtn && borrowedView && lentView) {
        borrowedBtn.addEventListener('click', function () {
            borrowedBtn.classList.add('active');
            lentBtn.classList.remove('active');
            borrowedView.classList.remove('hidden');
            lentView.classList.add('hidden');
        });

        lentBtn.addEventListener('click', function () {
            lentBtn.classList.add('active');
            borrowedBtn.classList.remove('active');
            lentView.classList.remove('hidden');
            borrowedView.classList.add('hidden');
        });
    }

    // Intercept logout button
    var logoutLink = document.querySelector('.logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', function (e) {
            e.preventDefault();
            fetch('backend/api/auth/logout.php')
                .finally(() => {
                    localStorage.clear();
                    alert('Logged out successfully.');
        
                });
        });
    }
});

// Sync profile information
function syncUserProfile() {
    fetchWithAuth('backend/api/auth/me.php')
      .then(res => {
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

        var badge = document.getElementById('myloans-verification-badge');
        if (badge) {
          if (user.is_verified) {
            badge.textContent = '✔ Verified Student';
            badge.className = 'ml-badge verified';
            badge.style.backgroundColor = '#22c55e';
            badge.style.color = '#fff';
            localStorage.setItem('uiu_verified', 'true');
          } else {
            badge.textContent = '⚠ Unverified';
            badge.className = 'ml-badge unverified';
            badge.style.backgroundColor = '#94a3b8';
            badge.style.color = '#fff';
            localStorage.setItem('uiu_verified', 'false');
          }
        }
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

// ---- Render Money I Borrowed ----
function renderBorrowedView() {
    var requests = myLoansData.requests || [];
    var agreements = myLoansData.agreements || [];
    
    // Filter agreements
    var activeAgreements = agreements.filter(a => a.role === 'borrower' && (a.repayment_status === 'pending' || a.repayment_status === 'partial'));
    var completedAgreements = agreements.filter(a => a.role === 'borrower' && a.repayment_status === 'completed');

    // Summary calculations
    var totalDebt = activeAgreements.reduce((sum, a) => sum + a.remaining_amount, 0);
    // Next due = full remaining of nearest-due agreement (not a simulated half)
    var nextDueAg = activeAgreements.length > 0
      ? activeAgreements.slice().sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0]
      : null;
    var nextDue = nextDueAg ? nextDueAg.remaining_amount : 0;

    document.getElementById('borrowed-total-debt').textContent = totalDebt.toLocaleString() + ' BDT';
    document.getElementById('borrowed-next-due').textContent = nextDue.toLocaleString() + ' BDT';
    document.getElementById('borrowed-paid-count').textContent = completedAgreements.length;
    document.getElementById('borrowed-paid-footer').textContent = completedAgreements.length + ' loans paid off';

    // Render Active Agreements
    var activeContainer = document.getElementById('myloans-active-container');
    if (activeAgreements.length === 0) {
        activeContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--slate-500); font-weight: 500;">No active borrowed loans right now.</p>';
    } else {
        activeContainer.innerHTML = activeAgreements.map(ag => `
            <div class="loan-card active-card" style="background: white; border: 1px solid var(--slate-200); padding: 20px; border-radius: 12px; margin-bottom: 20px; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <span style="font-size: 11px; background: rgba(30, 58, 138, 0.1); color: var(--primary); padding: 4px 8px; border-radius: 4px; font-weight: 700;">ACTIVE LOAN AGREEMENT #${ag.agreement_id}</span>
                        <h4 style="font-size: 16px; margin: 8px 0 4px; font-weight: 700; color: var(--slate-900);">Borrowed from ${ag.lender_name}</h4>
                        <p style="font-size: 13px; color: var(--slate-500); margin: 0;">Interest Rate: ${ag.interest_rate}% | Repayment Status: ${ag.repayment_status.toUpperCase()}</p>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 18px; font-weight: 900; color: var(--primary);">${ag.remaining_amount.toLocaleString()} BDT</span>
                        <p style="font-size: 11px; color: var(--slate-400); margin: 2px 0 0;">Remaining Balance</p>
                    </div>
                </div>
                <div style="border-top: 1px solid var(--slate-100); padding-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 12px; color: var(--slate-500); font-weight: 600;">Due Date: ${ag.due_date}</span>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <a href="agreement.html?agreement_id=${ag.agreement_id}" style="background: #f1f5f9; color: var(--primary); border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; text-decoration: none;">
                            <span class="material-symbols-outlined" style="font-size: 16px;">description</span> View Agreement
                        </a>
                        <button onclick="triggerRepay(${ag.agreement_id}, ${ag.remaining_amount})" class="pay-btn" style="background: var(--primary); color: white; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <span class="material-symbols-outlined" style="font-size: 16px;">credit_card</span> Repay Installment
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Render Pending Requests & Bids
    var pendingRequests = requests.filter(r => r.status === 'open');
    var pendingContainer = document.getElementById('myloans-pending-container');
    
    var headerHTML = `
        <h3 style="font-size: 16px; font-weight: 800; color: var(--slate-900); margin: 0 0 16px;">Pending Requests &amp; Bids</h3>
    `;

    if (pendingRequests.length === 0) {
        pendingContainer.innerHTML = headerHTML + '<p style="padding: 16px; text-align: center; color: var(--slate-500); font-size: 13px;">No pending loan requests listed.</p>';
    } else {
        // We will fetch bids for each pending request
        pendingContainer.innerHTML = headerHTML;
        
        pendingRequests.forEach(req => {
            var reqDiv = document.createElement('div');
            reqDiv.style.cssText = 'background:white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 16px; margin-bottom: 16px;';
            reqDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                    <div>
                        <h4 style="font-size: 14px; font-weight: 700; color: var(--slate-800); margin:0;">${req.purpose}</h4>
                        <span style="font-size: 11px; color: var(--slate-400);">Requested on ${req.created_at.split(' ')[0]}</span>
                    </div>
                    <span style="font-weight: 800; color: var(--primary); font-size: 14px;">${req.amount.toLocaleString()} BDT</span>
                </div>
                <div class="bids-section" id="req-bids-${req.loan_id}" style="border-top:1px solid #f1f5f9; padding-top:8px; margin-top:8px;">
                    <p style="font-size: 11px; color:#94a3b8;">Loading bids...</p>
                </div>
            `;
            pendingContainer.appendChild(reqDiv);

            // Fetch and render bids for this request
            fetchWithAuth('backend/api/loan/bids.php?loan_id=' + req.loan_id)
                .then(bidRes => {
                    var bids = bidRes.data;
                    var bidsContainer = document.getElementById('req-bids-' + req.loan_id);
                    if (bids.length === 0) {
                        bidsContainer.innerHTML = '<p style="font-size:11px; color:var(--slate-400); margin:0;">No bids received yet.</p>';
                        return;
                    }
                    bidsContainer.innerHTML = bids.map(bid => `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:6px;">
                            <div>
                                <span style="font-size:12px; font-weight:700; color:var(--slate-700);">${bid.lender_name}</span>
                                <span style="font-size:10px; color:var(--emerald); font-weight:bold; margin-left:6px;">${bid.interest_rate}% Interest</span>
                            </div>
                            <button onclick="triggerConfirmMlModal(${bid.offer_id}, '${bid.lender_name}', ${bid.interest_rate}, ${req.amount})" style="background:var(--primary); color:white; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">Accept</button>
                        </div>
                    `).join('');
                });
        });
    }

    // Render Completed Loans
    var completedContainer = document.getElementById('myloans-completed-container');
    var completedHeader = `<h3 style="font-size: 16px; font-weight: 800; color: var(--slate-900); margin: 0 0 16px;">Completed Borrowings</h3>`;
    
    if (completedAgreements.length === 0) {
        completedContainer.innerHTML = completedHeader + '<p style="padding: 16px; text-align: center; color: var(--slate-500); font-size: 13px;">No completed borrowing history found.</p>';
    } else {
        completedContainer.innerHTML = completedHeader + completedAgreements.map(ag => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 12px; margin-bottom: 8px;">
                <div>
                    <h4 style="font-size: 13px; font-weight: 700; color: var(--slate-800); margin:0;">Paid off to ${ag.lender_name}</h4>
                    <span style="font-size: 11px; color: var(--emerald); font-weight:bold;">Successfully Repaid</span>
                </div>
                <span style="font-weight: 700; color: var(--slate-500); font-size: 13px;">${ag.principal_amount.toLocaleString()} BDT</span>
            </div>
        `).join('');
    }
}

// ---- Render Money I Lent ----
function renderLentView() {
    var agreements = myLoansData.agreements || [];
    
    var activeLent = agreements.filter(a => a.role === 'lender' && (a.repayment_status === 'pending' || a.repayment_status === 'partial'));
    var completedLent = agreements.filter(a => a.role === 'lender' && a.repayment_status === 'completed');

    // Summary calculations
    var totalInvested = activeLent.reduce((sum, a) => sum + a.principal_amount, 0);
    var expectedReturn = activeLent.reduce((sum, a) => sum + a.remaining_amount, 0);
    var interestEarned = completedLent.reduce((sum, a) => sum + (a.total_payable - a.principal_amount), 0) + 
                         activeLent.reduce((sum, a) => sum + (a.paid_amount - a.principal_amount > 0 ? a.paid_amount - a.principal_amount : 0), 0);

    document.getElementById('lent-total-invested').textContent = totalInvested.toLocaleString() + ' BDT';
    document.getElementById('lent-expected-repay').textContent = expectedReturn.toLocaleString() + ' BDT';
    document.getElementById('lent-total-interest').textContent = interestEarned.toLocaleString() + ' BDT';

    // Render Lent Active
    var activeContainer = document.getElementById('myloans-lent-active-container');
    if (activeLent.length === 0) {
        activeContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--slate-500); font-weight: 500;">No active investments right now.</p>';
    } else {
        activeContainer.innerHTML = activeLent.map(ag => `
            <div class="loan-card lent-card" style="background: white; border: 1px solid var(--slate-200); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <span style="font-size: 11px; background: rgba(16, 185, 129, 0.1); color: var(--emerald); padding: 4px 8px; border-radius: 4px; font-weight: 700;">ACTIVE INVESTMENT #${ag.agreement_id}</span>
                        <h4 style="font-size: 16px; margin: 8px 0 4px; font-weight: 700; color: var(--slate-900);">Lent to ${ag.borrower_name}</h4>
                        <p style="font-size: 13px; color: var(--slate-500); margin: 0;">Interest Rate: ${ag.interest_rate}% | Collected Back: ${ag.paid_amount.toLocaleString()} / ${ag.total_payable.toLocaleString()} BDT</p>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 18px; font-weight: 900; color: var(--emerald);">${ag.remaining_amount.toLocaleString()} BDT</span>
                        <p style="font-size: 11px; color: var(--slate-400); margin: 2px 0 0;">Remaining Receivable</p>
                    </div>
                </div>
                <div style="border-top: 1px solid var(--slate-100); padding-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 12px; color: var(--slate-500); font-weight: 600;">Expected Date: ${ag.due_date}</span>
                    <div style="display: flex; gap: 8px;">
                        <a href="agreement.html?agreement_id=${ag.agreement_id}" style="background: #f1f5f9; color: #10b981; border: 1px solid #d1fae5; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 11px; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                            <span class="material-symbols-outlined" style="font-size: 14px;">description</span> View Agreement
                        </a>
                        <span style="font-size: 11px; background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-weight: 700;">Ongoing Repayment</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Render Completed Lent
    var completedContainer = document.getElementById('myloans-lent-completed-container');
    var completedHeader = `<h3 style="font-size: 16px; font-weight: 800; color: var(--slate-900); margin: 0 0 16px;">Completed Investments</h3>`;
    
    if (completedLent.length === 0) {
        completedContainer.innerHTML = completedHeader + '<p style="padding: 16px; text-align: center; color: var(--slate-500); font-size: 13px;">No completed investment history found.</p>';
    } else {
        completedContainer.innerHTML = completedHeader + completedLent.map(ag => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:white; border: 1px solid var(--slate-200); border-radius: 12px; padding: 12px; margin-bottom: 8px;">
                <div>
                    <h4 style="font-size: 13px; font-weight: 700; color: var(--slate-800); margin:0;">Lent to ${ag.borrower_name}</h4>
                    <span style="font-size: 11px; color: var(--emerald); font-weight:bold;">Fully Recovered (BDT ${ag.total_payable.toLocaleString()})</span>
                </div>
                <span style="font-weight: 700; color: var(--emerald); font-size: 13px;">+${(ag.total_payable - ag.principal_amount).toLocaleString()} BDT Interest</span>
            </div>
        `).join('');
    }
}

// ---- Repay Installment Action ──────────────────────────
function triggerRepay(agreementId, remainingAmount) {
    // Ask for payment confirmation
    var payAmount = remainingAmount / 2; // pay half of the remaining balance, or they can pay full
    var payConfirmed = confirm('Repay Installment for Agreement #' + agreementId + '?\n\nRepay Amount: ' + payAmount.toLocaleString() + ' BDT\nUsing: bKash (Simulation)');
    
    if (!payConfirmed) return;

    fetchWithAuth('backend/api/loan/repay.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            agreement_id: agreementId,
            amount_paid: payAmount,
            payment_method: 'bkash',
            transaction_ref: 'TXN_' + Date.now(),
            note: 'Regular student installment repayment.'
        })
    })
    .then(res => {
        showToast('✅ Repayment of ' + payAmount.toLocaleString() + ' BDT submitted successfully!');
        loadMyLoansData();
    })
    .catch(err => {
        alert('Repayment failed: ' + err.message);
    });
}

// ---- Accept Bid Confirmation Modal Controls ----
function triggerConfirmMlModal(offerId, lenderName, interestRate, requestedAmount) {
    selectedMlOffer = offerId;
    
    var detailsEl = document.getElementById('myloans-confirm-details');
    detailsEl.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px; text-align:left; background:#f8fafc; padding:12px; border-radius:8px;">
            <span style="font-weight:bold; color:var(--slate-500);">Lender Name:</span>
            <span style="font-weight:bold; color:var(--slate-900);">${lenderName}</span>
            <span style="font-weight:bold; color:var(--slate-500);">Interest Rate:</span>
            <span style="font-weight:bold; color:var(--emerald);">${interestRate}%</span>
            <span style="font-weight:bold; color:var(--slate-500);">Total Repayable:</span>
            <span style="font-weight:bold; color:var(--slate-900);">${(requestedAmount + (requestedAmount * interestRate / 100)).toLocaleString()} BDT</span>
        </div>
    `;

    document.getElementById('myloans-confirm-modal').classList.add('open');
}

function closeMlConfirmModal() {
    document.getElementById('myloans-confirm-modal').classList.remove('open');
    selectedMlOffer = null;
}

function acceptMlOffer() {
    if (!selectedMlOffer) return;

    fetchWithAuth('backend/api/loan/agreement.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            offer_id: selectedMlOffer
        })
    })
    .then(res => {
        showToast('✅ Bid accepted successfully! Agreement is now active.');
        closeMlConfirmModal();
        loadMyLoansData();
    })
    .catch(err => {
        alert('Failed to accept bid: ' + err.message);
        closeMlConfirmModal();
    });
}

// ---- Toast Notification ----
function showToast(message) {
    var toast = document.getElementById('alertToast');
    var msgEl = document.getElementById('toastMessage');
    if (toast && msgEl) {
        msgEl.textContent = message;
        toast.classList.add('show');
        setTimeout(function() {
            toast.classList.remove('show');
        }, 4000);
    } else {
        alert(message);
    }
}

// ============================================================
//  agreementscript.js  –  UIU Agreement Room Integration (API Active)
// ============================================================

var currentAgreementId = null;
var agreementDetails = null;
var chatRefreshInterval = null;

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

    // Determine Agreement ID from URL parameter
    var urlParams = new URLSearchParams(window.location.search);
    var agreementId = urlParams.get('agreement_id');
    
    if (agreementId) {
        currentAgreementId = parseInt(agreementId);
        loadAgreementDetails();
    } else {
        // Fallback: Fetch first agreement
        fetchWithAuth('backend/api/loan/my_loans.php')
            .then(res => {
                var agreements = res.data.agreements;
                if (agreements.length > 0) {
                    currentAgreementId = agreements[0].agreement_id;
                    loadAgreementDetails();
                } else {
                    alert('You have no active agreements yet. Create one by accepting a bid on the "My Loans" page.');
                    window.location.href = 'myloans.html';
                }
            });
    }

    // Intercept send message keypress
    var msgInput = document.getElementById("messageInput");
    if (msgInput) {
        msgInput.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                sendMessage();
            }
        });
    }
});

// Sync profile state
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
      })
      .catch(function(err) {
        console.log('Not logged in:', err.message);
        window.location.href = 'login.html';
      });
}

// Fetch agreement details from API
function loadAgreementDetails() {
    if (!currentAgreementId) return;

    fetchWithAuth('backend/api/loan/agreement.php?agreement_id=' + currentAgreementId)
        .then(res => {
            agreementDetails = res.data.agreement;
            renderAgreementDetails(res.data);
            
            // Start chat syncing
            loadChatMessages();
            clearInterval(chatRefreshInterval);
            chatRefreshInterval = setInterval(loadChatMessages, 3000);
        })
        .catch(err => {
            console.error('Error loading agreement:', err);
            alert('Failed to load agreement room.');
        });
}

// Render values into elements
function renderAgreementDetails(data) {
    var ag = data.agreement;
    
    // Page Title & Reference
    var titleEl = document.querySelector('.page-title h2');
    if (titleEl) titleEl.textContent = 'Active Agreement: ' + ag.purpose;

    var refEl = document.querySelector('.page-title p');
    if (refEl) refEl.textContent = 'Ref ID: UIU-L-AG-' + ag.agreement_id;

    // Status Badge
    var statusText = document.getElementById("statusText");
    var badge = document.getElementById("statusBadge");
    var dot = document.getElementById("pulseDot");

    if (statusText && badge && dot) {
        statusText.textContent = 'Status: ' + ag.repayment_status.toUpperCase();
        if (ag.repayment_status === 'completed') {
            badge.style.backgroundColor = "#d1fae5";
            badge.style.borderColor = "#a7f3d0";
            badge.style.color = "#047857";
            dot.style.backgroundColor = "#10b981";
        } else {
            badge.style.backgroundColor = "#fffbeb";
            badge.style.borderColor = "#fef3c7";
            badge.style.color = "#b45309";
            dot.style.backgroundColor = "#d97706";
        }
    }

    // Borrower & Lender Names
    var borrowerName = document.querySelector('.summary-grid > div:nth-child(1) .summary-name');
    if (borrowerName) borrowerName.textContent = ag.borrower_name;

    var lenderName = document.querySelector('.summary-grid > div:nth-child(2) .summary-name');
    if (lenderName) lenderName.textContent = ag.lender_name;

    // Financial terms
    var principalAmt = document.querySelector('.summary-amount');
    if (principalAmt) principalAmt.textContent = ag.principal_amount.toLocaleString() + ' BDT';

    var rateVal = document.querySelector('.summary-rate');
    if (rateVal) {
        var interestAmt = ag.principal_amount * (ag.interest_rate / 100);
        rateVal.innerHTML = `${ag.interest_rate}% <span>(${interestAmt.toLocaleString()} BDT)</span>`;
    }

    // Repayment deadline
    var deadlineVal = document.querySelector('.summary-deadline');
    if (deadlineVal) {
        deadlineVal.innerHTML = `<span class="material-symbols-outlined">calendar_today</span> ${ag.due_date}`;
    }

    // Action button state
    var btn = document.getElementById("confirmBtn");
    var waitText = document.getElementById("waitingText");
    var spinner = document.getElementById("spinnerIcon");

    if (btn && waitText) {
        var currentUserId = parseInt(localStorage.getItem('user_id') || '0');
        
        if (ag.repayment_status === 'completed') {
            btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Agreement Completed';
            btn.style.backgroundColor = "#10b981";
            btn.disabled = true;
            if (spinner) spinner.style.display = 'none';
            waitText.textContent = 'The loan has been fully repaid. Thank you for using UIU Friends!';
        } else {
            // Active Loan Agreement
            if (ag.borrower_id == currentUserId) {
                btn.innerHTML = `<span class="material-symbols-outlined">payments</span> Repay Installment (BDT ${data.balance_due.toLocaleString()})`;
                btn.style.backgroundColor = "var(--primary)";
                btn.disabled = false;
                btn.onclick = function() { confirmTransfer(data.balance_due); };
                if (spinner) spinner.className = "material-symbols-outlined";
                if (spinner) spinner.innerHTML = "hourglass_empty";
                waitText.textContent = `Please repay via bKash/Nagad using the instructions below.`;
            } else {
                btn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Transfer Awaiting Repayment';
                btn.style.backgroundColor = "#64748b";
                btn.disabled = true;
                if (spinner) spinner.className = "material-symbols-outlined animate-spin";
                if (spinner) spinner.innerHTML = "progress_activity";
                waitText.textContent = `Awaiting borrower installment repayment (Outstanding: ${data.balance_due.toLocaleString()} BDT).`;
            }
        }
    }
}

// ---- Process payment ----
function confirmTransfer(balanceDue) {
    var payAmount = balanceDue;
    var confirmed = confirm(`Repay the outstanding balance of BDT ${payAmount.toLocaleString()} via bKash?\n\nProceed?`);
    
    if (!confirmed) return;

    fetchWithAuth('backend/api/loan/repay.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            agreement_id: currentAgreementId,
            amount_paid: payAmount,
            payment_method: 'bkash',
            transaction_ref: 'TXN_AG_' + Date.now(),
            note: 'Final loan repayment.'
        })
    })
    .then(res => {
        alert('Repayment processed successfully!');
        loadAgreementDetails();
    })
    .catch(err => {
        alert('Repayment failed: ' + err.message);
    });
}

// ---- Load chat room messages ----
function loadChatMessages() {
    if (!currentAgreementId) return;

    fetchWithAuth('backend/api/loan/messages.php?agreement_id=' + currentAgreementId)
        .then(res => {
            var messages = res.data;
            var chatMessages = document.getElementById("chatMessages");
            if (!chatMessages) return;

            var oldHeight = chatMessages.scrollHeight;

            chatMessages.innerHTML = messages.map(msg => {
                var alignment = msg.is_mine ? 'mine' : 'other';
                var time = new Date(msg.sent_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                return `
                    <div class="msg-row ${alignment}">
                        <div class="msg-bubble">
                            ${msg.content}
                            <p class="msg-time">${time}</p>
                        </div>
                    </div>
                `;
            }).join('');

            // Scroll to bottom if new messages appeared
            if (chatMessages.scrollHeight > oldHeight) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        })
        .catch(err => {
            console.error('Error loading chat:', err);
        });
}

// ---- Send a message ----
function sendMessage() {
    var input = document.getElementById("messageInput");
    var message = input.value.trim();
    
    if (message === "" || !currentAgreementId) {
        return;
    }
    
    fetchWithAuth('backend/api/loan/messages.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            agreement_id: currentAgreementId,
            content: message
        })
    })
    .then(res => {
        input.value = "";
        loadChatMessages();
    })
    .catch(err => {
        alert('Failed to send message: ' + err.message);
    });
}

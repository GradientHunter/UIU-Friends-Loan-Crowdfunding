// ============================================================
//  request_loan.js  –  UIU Friends Loan & Crowdfunding (API Active)
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
  // Sync top header profile
  syncUserProfile();

  // Set default view overlay open state (since request_loan.html starts with the modal open)
  var overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }

  // Initialize summary with default values
  updateSummary();

  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }
});

function syncUserProfile() {
  fetchWithAuth('backend/api/auth/me.php')
    .then(res => {
      var user = res.data;
      var nameEl = document.querySelector('.user-name');
      if (nameEl) nameEl.textContent = user.full_name;

      var avatarImg = document.querySelector('.user-avatar');
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

// ---- Update Summary Box when user changes inputs ----
function updateSummary() {
  var amountInput   = document.getElementById('loan-amount');
  var purposeSelect = document.getElementById('loan-purpose');
  var durationSelect= document.getElementById('loan-duration');

  var sumAmount   = document.getElementById('sum-amount');
  var sumPurpose  = document.getElementById('sum-purpose');
  var sumDuration = document.getElementById('sum-duration');

  if (!sumAmount) return;

  // Amount
  var amount = amountInput.value.trim();
  if (amount && !isNaN(amount)) {
    var formatted = parseInt(amount).toLocaleString();
    sumAmount.textContent = formatted + ' BDT';
  } else {
    sumAmount.textContent = '0 BDT';
  }

  // Purpose
  sumPurpose.textContent = purposeSelect.value;

  // Duration
  sumDuration.textContent = durationSelect.value;
}

// ---- Close Modal ----
function closeModal() {
  var overlay = document.getElementById('modal-overlay');
  var box     = document.getElementById('modal-box');

  box.style.transition  = 'opacity 0.2s, transform 0.2s';
  box.style.opacity     = '0';
  box.style.transform   = 'translateY(20px)';

  setTimeout(function () {
    overlay.style.display = 'none';
    window.location.href = 'marketplace.html'; // Go back to marketplace
  }, 220);
}

// ---- Submit Loan Request ──────────────────────────
function submitLoan() {
  var agreeCheck  = document.getElementById('agree-check');
  var amountInput = document.getElementById('loan-amount');
  var reasonInput = document.getElementById('loan-reason');
  var durationSelect = document.getElementById('loan-duration').value;
  var purposeSelect  = document.getElementById('loan-purpose').value;
  var rateInput   = document.querySelector('input[placeholder="e.g., 5"]');

  // Validate: agreement checkbox
  if (!agreeCheck.checked) {
    alert('Please agree to the repayment terms before posting your request.');
    agreeCheck.focus();
    return;
  }

  // Validate: amount filled
  if (!amountInput.value || isNaN(amountInput.value) || parseInt(amountInput.value) <= 0) {
    alert('Please enter a valid loan amount.');
    amountInput.focus();
    return;
  }

  // Validate: reason filled
  if (!reasonInput.value.trim()) {
    alert('Please explain why you need this loan.');
    reasonInput.focus();
    return;
  }

  var maxRate = rateInput ? parseFloat(rateInput.value) : 5.0;
  if (isNaN(maxRate) || maxRate < 0) {
    maxRate = 5.0;
  }

  // Calculate dynamic deadline date based on duration choice (e.g. "3 Months" -> date)
  var months = parseInt(durationSelect) || 3;
  var targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + months);
  var targetDateStr = targetDate.toISOString().split('T')[0];

  // All good – show success state and submit to API
  var submitBtn = document.querySelector('.submit-btn');
  var originalText = submitBtn.textContent;
  submitBtn.textContent = 'Posting...';
  submitBtn.disabled = true;

  fetchWithAuth('backend/api/loan/loans.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: parseFloat(amountInput.value),
      purpose: purposeSelect,
      reason_details: reasonInput.value.trim(),
      repayment_deadline: targetDateStr,
      max_interest_rate: maxRate,
      conditions: 'Standard student repayment terms.'
    })
  })
  .then(res => {
    submitBtn.textContent = '✓ Request Posted!';
    submitBtn.style.background = '#10b981';

    setTimeout(function () {
      alert('Your loan request has been posted to the Marketplace successfully!');
      closeModal();
    }, 800);
  })
  .catch(err => {
    alert('Loan request creation failed: ' + err.message);
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  });
}

// ---- Close modal with Escape key ----
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeModal();
  }
});

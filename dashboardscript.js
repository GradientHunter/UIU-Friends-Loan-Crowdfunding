// ============================================================
//  dashboardscript.js  –  UIU Dashboard Integration (API Active)
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  // Check auth and sync state
  syncUserProfile();

  // Load Dashboard Stats Counters
  loadStats();

  // Load Dashboard Items (Urgent Loans & Trending Campaigns)
  loadDashboardItems();

  // Attach interceptors to action buttons (Request Loan & Start Campaign)
  var requestBtn = document.querySelector('.btn-white');
  if (requestBtn) {
    requestBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (localStorage.getItem('uiu_verified') !== 'true') {
        alert('Verification Required: You must verify your UIU identity before requesting a loan.');
        triggerVerification();
      } else {
        window.location.href = 'request_loan.html';
      }
    });
  }

  var startCampaignBtn = document.querySelector('.btn-green');
  if (startCampaignBtn) {
    startCampaignBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (localStorage.getItem('uiu_verified') !== 'true') {
        alert('Verification Required: You must verify your UIU identity before starting a crowdfunding campaign.');
        triggerVerification();
      } else {
        window.location.href = 'start_campaign.html';
      }
    });
  }

  // Intercept logout button
  var logoutBtn = document.querySelector('.logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
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

// Sync profile and verification state
function syncUserProfile() {
  fetchWithAuth('backend/api/auth/me.php')
    .then(res => {
      var user = res.data;
      
      // Update UI elements
      var nameEl = document.querySelector('.user-name');
      if (nameEl) nameEl.textContent = user.full_name;

      var avatarImg = document.querySelector('.avatar img');
      if (avatarImg) {
        if (user.profile_photo) {
          avatarImg.src = 'uploads/profiles/' + user.profile_photo;
        } else {
          avatarImg.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.full_name) + '&background=1E3A8A&color=fff';
        }
      }

      // Update local storage verification state
      if (user.is_verified) {
        localStorage.setItem('uiu_verified', 'true');
        localStorage.setItem('uiu_student_id', user.student_id);
        localStorage.setItem('uiu_student_email', user.email);
      } else {
        localStorage.setItem('uiu_verified', 'false');
      }

      updateVerificationUI();
    })
    .catch(err => {
      console.log('User not logged in or active session missing:', err.message);
      // Redirect to login if user is not logged in and not on homepage
      if (window.location.pathname.includes('dashboard.html') && !localStorage.getItem('user_id')) {
        window.location.href = 'login.html';
      }
    });
}

// Update Header verification UI based on localStorage
function updateVerificationUI() {
  var badge = document.getElementById('user-verification-badge');
  var text = document.getElementById('verification-text');

  if (localStorage.getItem('uiu_verified') === 'true') {
    if (badge) badge.className = 'trust-score verified';
    if (text) text.textContent = 'Verified Student';
  } else {
    if (badge) badge.className = 'trust-score unverified';
    if (text) text.textContent = 'Unverified - Verify Now';
  }
}

// Open Verification Modal
function triggerVerification() {
  var overlay = document.getElementById('verification-modal-overlay');
  if (overlay) overlay.classList.add('open');
}

// Close Verification Modal
function closeVerificationModal() {
  var overlay = document.getElementById('verification-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

// Handle Form Submit
function submitVerificationForm() {
  var studentId = document.getElementById('v-student-id').value.trim();
  var studentEmail = document.getElementById('v-student-email').value.trim();

  if (!studentId) {
    alert('Please enter a valid UIU Student ID.');
    return;
  }

  var emailPattern = /^[a-zA-Z0-9._%+-]+@.*uiu.*\.ac\.bd$/;
  if (!studentEmail || !emailPattern.test(studentEmail)) {
    alert('Please enter a valid UIU Institutional email (e.g. student@bscse.uiu.ac.bd).');
    return;
  }

  fetchWithAuth('backend/api/user/verify.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      student_id: studentId,
      email: studentEmail
    })
  })
  .then(res => {
    localStorage.setItem('uiu_verified', 'true');
    localStorage.setItem('uiu_student_id', studentId);
    localStorage.setItem('uiu_student_email', studentEmail);

    alert('Success! Your UIU identity has been verified successfully.');
    closeVerificationModal();
    updateVerificationUI();
    syncUserProfile();
  })
  .catch(err => {
    alert('Verification failed: ' + err.message);
  });
}

// Load Stats Counters
function loadStats() {
  fetchWithAuth('backend/api/dashboard/stats.php')
    .then(res => {
      var stats = res.data;
      
      var loanCardVal = document.querySelector('.stats-row > div:nth-child(1) .stat-number');
      if (loanCardVal) loanCardVal.textContent = stats.active_loans;

      var campaignCardVal = document.querySelector('.stats-row > div:nth-child(2) .stat-number');
      if (campaignCardVal) campaignCardVal.textContent = stats.active_campaigns;

      var bidsCardVal = document.querySelector('.stats-row > div:nth-child(3) .stat-number');
      if (bidsCardVal) {
        bidsCardVal.textContent = stats.user_bids;
        if (stats.user_bids !== '--') {
          document.querySelector('.stats-row > div:nth-child(3) .stat-note').innerHTML = `
            <span class="material-symbols-outlined">check_circle</span>
            <span>Active pending offers</span>
          `;
        }
      }

      var donationCardVal = document.querySelector('.stats-row > div:nth-child(4) .stat-number');
      if (donationCardVal) {
        if (stats.user_donations === '--') {
          donationCardVal.innerHTML = '--';
        } else {
          donationCardVal.innerHTML = stats.user_donations.toLocaleString() + ' <small>BDT</small>';
          document.querySelector('.stats-row > div:nth-child(4) .stat-note').innerHTML = `
            <span class="material-symbols-outlined">favorite</span>
            <span>Total contributed</span>
          `;
        }
      }
    })
    .catch(err => {
      console.error('Stats load failed:', err.message);
    });
}

// Load Dashboard Items (Loans & Campaigns)
function loadDashboardItems() {
  fetchWithAuth('backend/api/dashboard/items.php')
    .then(res => {
      var items = res.data;
      renderUrgentLoans(items.loans);
      renderTrendingCampaigns(items.campaigns);
    })
    .catch(err => {
      console.error('Dashboard items load failed:', err.message);
    });
}

// Render Loans inside Dashboard Panel
function renderUrgentLoans(loans) {
  var panel = document.querySelector('.two-col > div:nth-child(1)');
  if (!panel) return;

  // Preserve header
  var headerHTML = `
    <div class="panel-header">
      <h3>Urgent Loan Requests</h3>
      <a href="marketplace.html">View All</a>
    </div>
  `;

  if (loans.length === 0) {
    panel.innerHTML = headerHTML + '<p style="font-size:0.875rem; color:var(--slate-500); padding:20px; text-align:center;">No active loan requests available.</p>';
    return;
  }

  var loansHTML = loans.map(loan => {
    var avatarHTML = loan.profile_photo 
      ? `<img src="uploads/profiles/${loan.profile_photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`
      : loan.initials;

    return `
      <div class="loan-card">
        <div class="loan-top">
          <div class="loan-user">
            <div class="loan-avatar dark-avatar">${avatarHTML}</div>
            <div>
              <div class="loan-name">${loan.full_name}</div>
              <div class="loan-quote">"${loan.purpose}"</div>
            </div>
          </div>
          <div class="loan-amount">
            <div class="amount-value">${loan.amount.toLocaleString()}</div>
            <div class="amount-bdt">BDT</div>
            <div class="amount-type">STUDENT LOAN</div>
          </div>
        </div>
        <div class="loan-meta">
          <div>
            <div class="meta-label">TIME REMAINING</div>
            <div class="meta-value">${loan.days_left} Days Left</div>
          </div>
          <div>
            <div class="meta-label">MAX INTEREST</div>
            <div class="meta-value green-text">${loan.max_interest_rate}%</div>
          </div>
        </div>
        <button type="button" class="btn btn-dark full-btn" onclick="viewLoanOnMarketplace(${loan.loan_id})">View &amp; Bid</button>
      </div>
    `;
  }).join('');

  panel.innerHTML = headerHTML + loansHTML;
}

// Render Campaigns inside Dashboard Panel
function renderTrendingCampaigns(campaigns) {
  var panel = document.querySelector('.two-col > div:nth-child(2)');
  if (!panel) return;

  // Preserve header
  var headerHTML = `
    <div class="panel-header">
      <h3>Trending Donation Campaigns</h3>
      <a href="crowdfunding.html">Explore More</a>
    </div>
  `;

  if (campaigns.length === 0) {
    panel.innerHTML = headerHTML + '<p style="font-size:0.875rem; color:var(--slate-500); padding:20px; text-align:center;">No trending crowdfunding campaigns active.</p>';
    return;
  }

  var campaignsHTML = campaigns.map(camp => {
    // Generate donor avatars lists
    var avatarsHTML = camp.donor_avatars.map((av, idx) => {
      var colors = ['purple', 'orange', 'teal', 'pink'];
      var colorClass = colors[idx % colors.length];
      return `<div class="d-avatar ${colorClass}">${av}</div>`;
    }).join('');

    return `
      <div class="campaign-card">
        <h4>${camp.title}</h4>
        <p>${camp.description}</p>
        <div class="progress-info">
          <span>Progress: ${camp.collected_amount.toLocaleString()} / ${camp.target_amount.toLocaleString()} BDT</span>
          <span class="blue-text">${camp.progress_percent}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${camp.progress_percent}%;"></div>
        </div>
        <div class="donor-row">
          <div class="donor-avatars">
            ${avatarsHTML}
          </div>
          <span class="donor-text">+${camp.donors_count} friends donated</span>
        </div>
        <button class="btn btn-green full-btn" onclick="window.location.href='crowdfunding.html?donate-campaign=${camp.campaign_id}'">Donate Now</button>
      </div>
    `;
  }).join('');

  panel.innerHTML = headerHTML + campaignsHTML;
}

// Redirect to Marketplace and show details modal for a specific loan
function viewLoanOnMarketplace(id) {
  window.location.href = 'marketplace.html?view-loan=' + id;
}

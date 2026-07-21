// ============================================================
//  profilescript.js  –  UIU Profile & Reviews Integration (API Active)
// ============================================================

var currentSelectedRating = 5;
var myAgreementsList = [];

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
  // Sync profile data
  syncUserProfile();

  // Load payment methods dynamically
  loadPaymentMethods();

  // Load reviews list
  loadReviewsFeed();

  // Fetch completed/partial agreements to populate the Review dropdown
  loadReviewDropdown();

  // Fix #3: Set up profile photo upload
  setupPhotoUpload();
});

// ---- Profile Photo Upload (Fix #3) ----
function setupPhotoUpload() {
  var changeBtn = document.getElementById('changePhotoBtn');
  var fileInput = document.getElementById('profilePhotoInput');
  if (!changeBtn || !fileInput) return;

  changeBtn.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    var file = fileInput.files[0];
    if (!file) return;

    var formData = new FormData();
    formData.append('profile_photo', file);

    changeBtn.disabled = true;
    changeBtn.innerHTML = '<span class="material-symbols-outlined" style="color:white;font-size:16px;">hourglass_empty</span>';

    fetch('backend/api/user/update_profile.php', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRF-Token': localStorage.getItem('csrf_token') || ''
        // Note: Do NOT set Content-Type manually for multipart/form-data — browser sets boundary automatically
      },
      body: formData
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) throw new Error(data.message);
      var newUrl = "url('uploads/profiles/" + data.data.profile_photo + "')";
      var pic    = document.querySelector('.profile-pic');
      var topPic = document.querySelector('.user-avatar');
      if (pic)    pic.style.backgroundImage    = newUrl;
      if (topPic) topPic.style.backgroundImage = newUrl;
      alert('Profile photo updated successfully!');
    })
    .catch(function(err) {
      alert('Upload failed: ' + err.message);
    })
    .finally(function() {
      changeBtn.disabled = false;
      changeBtn.innerHTML = '<span class="material-symbols-outlined" style="color:white;font-size:16px;">photo_camera</span>';
      fileInput.value = '';
    });
  });
}

// Sync profile details
function syncUserProfile() {
  fetchWithAuth('backend/api/auth/me.php')
    .then(res => {
      var user = res.data;
      
      // Populate display fields for the edit section
      populateProfileDisplay(user);

      // Overview Sidebar
      var sbName = document.querySelector('.sidebar-user h1, .sidebar-user-name');
      if (sbName) sbName.textContent = user.full_name;

      var sbDetails = document.querySelector('.sidebar-user p');
      if (sbDetails) {
        sbDetails.textContent = `ID: ${user.student_id || 'Pending'} | ${user.department || 'UIU'}`;
      }

      // Identity Header — new IDs
      var hdrName = document.querySelector('.identity-info-group h3, #profile-full-name');
      if (hdrName) hdrName.textContent = user.full_name;

      var hdrDept = document.getElementById('profile-dept') || document.querySelector('.identity-info-group p.dept');
      if (hdrDept) hdrDept.textContent = user.department || 'UIU Student';

      var hdrId = document.getElementById('profile-student-id') || document.querySelector('.identity-info-group p.student-id');
      if (hdrId) hdrId.textContent = `Student ID: ${user.student_id || 'Unverified'}`;

      // Avatar
      var avatar = document.querySelector('.profile-pic');
      if (avatar) {
        if (user.profile_photo) {
          avatar.style.backgroundImage = `url('uploads/profiles/${user.profile_photo}')`;
        } else {
          avatar.style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=1E3A8A&color=fff')`;
        }
      }

      var topAvatar = document.querySelector('.user-avatar');
      if (topAvatar) {
        if (user.profile_photo) {
          topAvatar.style.backgroundImage = `url('uploads/profiles/${user.profile_photo}')`;
        } else {
          topAvatar.style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=1E3A8A&color=fff')`;
        }
      }

      // Sync verification states in badges
      var dot = document.querySelector('.notification-dot');
      var badge = document.querySelector('.badge.verified-identity');
      var verifyBox = document.getElementById('verification-status-box');

      if (user.is_verified) {
        if (dot) dot.style.display = 'none';
        if (badge) {
          badge.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
          badge.style.color = '#10b981';
          badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.875rem;">verified</span> Verified Student';
        }
        if (verifyBox) {
          verifyBox.innerHTML = `
            <div style="background:#d1fae5; border:1px solid #a7f3d0; border-radius:10px; padding:14px 16px; display:flex; gap:10px; align-items:center;">
              <span class="material-symbols-outlined" style="color:#065f46;">verified</span>
              <div>
                <p style="font-size:14px; font-weight:700; color:#065f46; margin:0;">Identity Verified!</p>
                <p style="font-size:12px; color:#047857; margin:2px 0 0;">Student ID: ${user.student_id} | ${user.email}</p>
              </div>
            </div>
          `;
        }
        // Hide verification form inputs if verified
        var form = document.getElementById('verification-form');
        if (form) form.style.display = 'none';
        localStorage.setItem('uiu_verified', 'true');
      } else {
        if (dot) dot.style.display = 'block';
        if (badge) {
          badge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
          badge.style.color = '#ef4444';
          badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.875rem;">error</span> Unverified Student';
        }
        localStorage.setItem('uiu_verified', 'false');
      }
    })
    .catch(err => {
      console.log('Error syncing profile:', err);
    });
}

// ---- Load Peer Reviews Feed ----
function loadReviewsFeed() {
  fetchWithAuth('backend/api/user/reviews.php')
    .then(res => {
      var details = res.data;
      
      // Update trust score label
      var gaugePct = document.querySelector('.gauge-percentage');
      if (gaugePct) {
        var stars = '';
        var rating = Math.round(details.avg_rating);
        for (var i = 0; i < 5; i++) {
          stars += i < rating ? '★' : '☆';
        }
        gaugePct.textContent = stars;
      }

      var headerReviewsVal = document.querySelector('.section-header span');
      if (headerReviewsVal) {
        headerReviewsVal.textContent = details.avg_rating.toFixed(1) + ' ★ Avg.';
      }
      // Also update the profile tab avg rating span
      var profileAvgEl = document.getElementById('profile-avg-rating');
      if (profileAvgEl) {
        profileAvgEl.textContent = details.avg_rating.toFixed(1) + ' ★ Avg.';
      }

      var feed = document.querySelector('.review-feed');
      if (feed) {
        var titleHTML = '<p class="feed-title">Recent Reviews</p>';
        if (details.reviews.length === 0) {
          feed.innerHTML = titleHTML + '<p style="font-size:13px; color:#94a3b8; text-align:center; padding:16px;">No reviews received yet.</p>';
          return;
        }

        var reviewsHTML = details.reviews.map(r => {
          var photo = r.reviewer_photo
            ? 'uploads/profiles/' + r.reviewer_photo
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(r.reviewer_name) + '&background=1E3A8A&color=fff';

          var stars = '';
          for (var i = 0; i < 5; i++) {
            stars += `<span class="material-symbols-outlined" style="font-variation-settings:'FILL' ${i < r.rating ? 1 : 0}; color:${i < r.rating ? '#facc15' : ''}; font-size:16px;">star</span>`;
          }

          var date = new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

          return `
            <div class="review-card" style="background: white; border: 1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:10px;">
                <div class="review-content-wrapper" style="display:flex; gap:12px;">
                    <div class="reviewer-avatar" style="width:40px; height:40px; border-radius:50%; overflow:hidden; background-image: url('${photo}'); background-size: cover; background-position: center; flex-shrink: 0;"></div>
                    <div class="review-details" style="flex:1;">
                        <div class="review-header" style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="reviewer-name" style="font-weight:700; font-size:13px; color:#1e293b;">${r.reviewer_name}</span>
                            <div class="review-stars" style="display:flex;">
                                ${stars}
                            </div>
                        </div>
                        <p class="review-meta" style="font-size:11px; color:#94a3b8; margin:2px 0 6px;">Peer Participant &bull; ${date}</p>
                        <p class="review-text" style="font-size:13px; color:#475569; margin:0; line-height:1.4;">"${r.comment || 'No comment provided.'}"</p>
                    </div>
                </div>
            </div>
          `;
        }).join('');

        feed.innerHTML = titleHTML + reviewsHTML;
      }
    })
    .catch(err => {
      console.error('Reviews load failed:', err);
    });
}

// ---- Populate completed/partial agreements dropdown ----
function loadReviewDropdown() {
  fetchWithAuth('backend/api/loan/my_loans.php')
    .then(res => {
      myAgreementsList = res.data.agreements;
      var select = document.querySelector('.review-form select');
      if (select) {
        if (myAgreementsList.length === 0) {
          select.innerHTML = '<option value="">No loan agreements to review</option>';
          return;
        }

        var optionsHTML = '<option value="">Select a loan agreement to review...</option>' + 
          myAgreementsList.map(ag => {
            var partnerName = ag.role === 'borrower' ? ag.lender_name : ag.borrower_name;
            var label = ag.role === 'borrower' ? 'Lent by' : 'Borrowed by';
            return `<option value="${ag.agreement_id}">Agreement #${ag.agreement_id}: ${label} ${partnerName} (${ag.principal_amount.toLocaleString()} BDT)</option>`;
          }).join('');
          
        select.innerHTML = optionsHTML;
      }
    })
    .catch(err => {
      console.error(err);
    });
}

// ---- Override global setRating ----
window.setRating = function(n) {
  currentSelectedRating = n;
  var stars = document.querySelectorAll('#starRating .material-symbols-outlined');
  stars.forEach(function(s, i) {
    s.classList.toggle('active', i < n);
    s.style.fontVariationSettings = i < n ? "'FILL' 1" : "'FILL' 0";
    s.style.color = i < n ? '#facc15' : '';
  });
};

// ---- Override global submitReview ──────────────────────────
window.submitReview = function() {
  var select = document.querySelector('.review-form select');
  var agreementId = parseInt(select.value);
  var comment = document.querySelector('.review-form textarea').value.trim();

  if (!agreementId) {
    alert('Please select a loan agreement transaction to review.');
    return;
  }

  if (currentSelectedRating < 1 || currentSelectedRating > 5) {
    alert('Please select a star rating.');
    return;
  }

  fetchWithAuth('backend/api/user/reviews.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agreement_id: agreementId,
      rating: currentSelectedRating,
      comment: comment
    })
  })
  .then(res => {
    alert('Review submitted successfully!');
    document.querySelector('.review-form textarea').value = '';
    window.setRating(5);
    loadReviewsFeed(); // Reload reviews lists
  })
  .catch(err => {
    alert('Failed to submit review: ' + err.message);
  });
};

// ---- Override global submitProfileVerification ──────────────────────────
window.submitProfileVerification = function() {
  var studentId = document.getElementById('v-student-id').value.trim();
  var studentEmail = document.getElementById('v-student-email').value.trim();

  if (!studentId) {
    alert('Please enter your UIU Student ID.');
    return;
  }

  var emailPattern = /^[a-zA-Z0-9._%+-]+@.*uiu.*\.ac\.bd$/;
  if (!studentEmail || !emailPattern.test(studentEmail)) {
    alert('Please enter a valid UIU institutional email.');
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
    alert('Success! Your UIU student identity has been verified.');
    syncUserProfile(); // Reload profile details
  })
  .catch(err => {
    alert('Verification failed: ' + err.message);
  });
};

// ================================================================
//  PAYMENT METHODS — Dynamic load, add, delete
// ================================================================

// Load and render payment methods from API
function loadPaymentMethods() {
  var container = document.getElementById('payment-methods-list');
  if (!container) return;

  fetchWithAuth('backend/api/user/payment_methods.php')
    .then(res => {
      var methods = res.data;
      renderPaymentMethods(methods);
    })
    .catch(err => {
      console.error('Failed to load payment methods:', err);
      var container = document.getElementById('payment-methods-list');
      if (container) container.innerHTML = '<p style="font-size:13px; color:#94a3b8; text-align:center; padding:12px;">Could not load payment methods.</p>';
    });
}

// Render the payment methods list
function renderPaymentMethods(methods) {
  var container = document.getElementById('payment-methods-list');
  if (!container) return;

  if (methods.length === 0) {
    container.innerHTML = '<p style="font-size:13px; color:#94a3b8; text-align:center; padding:12px 0;">No payment methods saved yet. Add one below.</p>';
    return;
  }

  var typeLabels = { bkash: 'bKash', nagad: 'Nagad', bank: 'Bank Account', other: 'Other' };
  var typeLogos  = { bkash: 'bK', nagad: 'Ng', bank: 'BK', other: '$$' };
  var typeClass  = { bkash: 'bkash', nagad: 'bkash', bank: 'citybank', other: 'citybank' };

  container.innerHTML = methods.map(m => `
    <div class="payment-card ${typeClass[m.type]}" style="position:relative;">
      <div class="card-content">
        <div class="card-details">
          <span class="card-type">${typeLabels[m.type] || m.type}</span>
          <span class="card-number">${m.account_number}</span>
          <div class="card-footer">
            <span class="card-name">${m.account_name}</span>
            ${m.is_default ? '<span class="card-status" style="background:rgba(16,185,129,0.15); color:#10b981; font-size:10px; padding:2px 7px; border-radius:4px; font-weight:700;">Default</span>' : ''}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
          <div class="card-logo text">${typeLogos[m.type]}</div>
          <div style="display:flex; gap:6px; align-items:center;">
            ${!m.is_default ? `<button onclick="setDefaultPaymentMethod(${m.method_id})" title="Set as Default" style="background:none; border:1px solid #10b981; border-radius:6px; cursor:pointer; color:#10b981; padding:2px 7px; font-size:10px; font-weight:700;">Default</button>` : ''}
            <button onclick="deletePaymentMethod(${m.method_id})" title="Remove" style="background:none; border:none; cursor:pointer; color:#ef4444; padding:0; display:flex; align-items:center;">
              <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// Open the add payment modal
function openAddPaymentModal() {
  var modal = document.getElementById('add-payment-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

// Close the add payment modal
function closeAddPaymentModal() {
  var modal = document.getElementById('add-payment-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    // Reset fields
    var t = document.getElementById('pm-type');
    var n = document.getElementById('pm-number');
    var nm = document.getElementById('pm-name');
    if (t) t.value = 'bkash';
    if (n) n.value = '';
    if (nm) nm.value = '';
  }
}

// Save a new payment method via API
function savePaymentMethod() {
  var type   = document.getElementById('pm-type').value;
  var number = document.getElementById('pm-number').value.trim();
  var name   = document.getElementById('pm-name').value.trim();

  if (!number) { alert('Please enter the account number or phone.'); return; }
  if (!name)   { alert('Please enter the account holder name.'); return; }

  fetchWithAuth('backend/api/user/payment_methods.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, account_number: number, account_name: name })
  })
  .then(res => {
    closeAddPaymentModal();
    loadPaymentMethods();
    showProfileToast('✅ Payment method added successfully!');
  })
  .catch(err => {
    alert('Failed to add payment method: ' + err.message);
  });
}

// Delete a payment method
function deletePaymentMethod(methodId) {
  if (!confirm('Remove this payment method?')) return;

  fetchWithAuth('backend/api/user/payment_methods.php?method_id=' + methodId, { method: 'DELETE' })
    .then(res => {
      loadPaymentMethods();
      showProfileToast('Payment method removed.');
    })
    .catch(err => {
      alert('Failed to remove: ' + err.message);
    });
}

// Simple toast for profile page
function showProfileToast(message) {
  var toast = document.getElementById('profile-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'profile-toast';
    toast.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,0.25);max-width:500px;text-align:center;transition:opacity 0.3s;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() { toast.style.opacity = '0'; }, 3500);
}

// Also update the reviews section header span dynamically
(function patchLoadReviewsFeed() {
  var origLoad = window.loadReviewsFeed;
  if (!origLoad) return;
  // loadReviewsFeed already sets gauge-percentage, we patch to also update profile-avg-rating span
  var _original = document.addEventListener;
  // Just call loadPaymentMethods on DOMContentLoaded since profilescript already runs loadReviewsFeed
})();

// ================================================================
//  PROFILE INFO EDIT
// ================================================================

var _profileData = {}; // cache user data for pre-filling form

// Override syncUserProfile to also populate display fields
var _origSyncUserProfile = window.syncUserProfile;
(function patchSync() {
  // We'll inject into the existing syncUserProfile promise chain
  // by wrapping the DOMContentLoaded to call a post-sync hook
  document.addEventListener('DOMContentLoaded', function() {
    // Already called in main DOMContentLoaded, this just ensures
    // display fields are populated after syncUserProfile resolves.
    // The actual patching is done inside syncUserProfile via _profileData.
  });
})();

// Populate display fields and cache — called from inside syncUserProfile
function populateProfileDisplay(user) {
  _profileData = user;
  var dn = document.getElementById('display-full-name');
  var de = document.getElementById('display-email');
  var dp = document.getElementById('display-phone');
  var dd = document.getElementById('display-department');
  if (dn) dn.textContent = user.full_name || '—';
  if (de) de.textContent = user.email || '—';
  if (dp) dp.textContent = user.phone || '—';
  if (dd) dd.textContent = user.department || '—';
}

// Toggle edit form visibility
function toggleProfileEdit() {
  var form = document.getElementById('profile-edit-form');
  var display = document.getElementById('profile-display');
  var btn = document.getElementById('edit-profile-btn');
  if (!form) return;
  var isHidden = form.style.display === 'none';
  if (isHidden) {
    // Pre-fill inputs with current values
    var nameInput = document.getElementById('edit-full-name');
    var phoneInput = document.getElementById('edit-phone');
    var deptInput = document.getElementById('edit-department');
    if (nameInput) nameInput.value = _profileData.full_name || '';
    if (phoneInput) phoneInput.value = _profileData.phone || '';
    if (deptInput) deptInput.value = _profileData.department || '';
    form.style.display = 'block';
    if (display) display.style.display = 'none';
    if (btn) btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:15px;">close</span> Cancel';
  } else {
    form.style.display = 'none';
    if (display) display.style.display = 'flex';
    if (btn) btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:15px;">edit</span> Edit';
  }
}

// Save profile info (name, phone, department) via API
function saveProfileInfo() {
  var fullName   = (document.getElementById('edit-full-name')   || {}).value || '';
  var phone      = (document.getElementById('edit-phone')       || {}).value || '';
  var department = (document.getElementById('edit-department')  || {}).value || '';

  if (!fullName.trim()) {
    alert('Full name cannot be empty.');
    return;
  }

  var saveBtn = document.querySelector('#profile-edit-form button');
  var origText = saveBtn ? saveBtn.textContent : '';
  if (saveBtn) { saveBtn.textContent = 'Saving...'; saveBtn.disabled = true; }

  fetchWithAuth('backend/api/user/update_profile.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name:  fullName.trim(),
      phone:      phone.trim(),
      department: department.trim()
    })
  })
  .then(res => {
    _profileData = Object.assign(_profileData, res.data);
    populateProfileDisplay(_profileData);
    toggleProfileEdit();
    syncUserProfile(); // refresh header/sidebar
    showProfileToast('✅ Profile updated successfully!');
  })
  .catch(err => {
    alert('Failed to update profile: ' + err.message);
  })
  .finally(() => {
    if (saveBtn) { saveBtn.textContent = origText; saveBtn.disabled = false; }
  });
}

// ================================================================
//  PAYMENT METHOD: Set as Default
// ================================================================

function setDefaultPaymentMethod(methodId) {
  fetchWithAuth('backend/api/user/payment_methods.php?method_id=' + methodId, {
    method: 'PATCH'
  })
  .then(res => {
    loadPaymentMethods();
    showProfileToast('✅ Default payment method updated.');
  })
  .catch(err => {
    alert('Failed to set default: ' + err.message);
  });
}

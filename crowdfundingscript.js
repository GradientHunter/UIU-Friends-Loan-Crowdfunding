// ============================================================
//  crowdfundingscript.js  –  UIU Crowdfunding Integration (API Active)
// ============================================================

var selectedAmount = 1000;
var activeCampaignId = null;
var allCampaigns = []; // Cached campaigns list

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

// ---- Page Init ----
document.addEventListener('DOMContentLoaded', function () {
    syncUserProfile();
    loadCampaigns();

    // Check for direct donate parameter
    var urlParams = new URLSearchParams(window.location.search);
    var campaignId = urlParams.get('donate-campaign');
    if (campaignId) {
        activeCampaignId = parseInt(campaignId);
    }
});

// Sync profile state
function syncUserProfile() {
    fetchWithAuth('backend/api/auth/me.php')
      .then(res => {
        var user = res.data;
        
        var nameEl = document.querySelector('.user-name');
        if (nameEl) nameEl.textContent = user.full_name;

        var avatarImg = document.querySelector('.user-avatar img');
        if (avatarImg) {
          if (user.profile_photo) {
            avatarImg.src = 'uploads/profiles/' + user.profile_photo;
          } else {
            avatarImg.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.full_name) + '&background=1E3A8A&color=fff';
          }
        }

        if (user.is_verified) {
          localStorage.setItem('uiu_verified', 'true');
          localStorage.setItem('uiu_student_id', user.student_id);
          localStorage.setItem('uiu_student_email', user.email);
        } else {
          localStorage.setItem('uiu_verified', 'false');
        }
        updateCfVerificationBadge();
      })
      .catch(function(err) {
        console.log('Not logged in:', err.message);
        window.location.href = 'login.html';
      });
}

// ---- Load Campaigns list from API ----
function loadCampaigns() {
    fetchWithAuth('backend/api/campaign/campaigns.php')
        .then(res => {
            allCampaigns = res.data;
            if (allCampaigns.length > 0) {
                // Set default main campaign if not set
                if (!activeCampaignId) {
                    activeCampaignId = allCampaigns[0].campaign_id;
                }
                renderCampaigns();
            } else {
                var grid = document.querySelector('.content-grid');
                if (grid) {
                    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#64748b;">No active crowdfunding campaigns right now.</div>';
                }
            }
        })
        .catch(err => {
            console.error('Error loading campaigns:', err);
        });
}

// ---- Render Campaigns ----
function renderCampaigns() {
    var mainCampaign = allCampaigns.find(c => c.campaign_id === activeCampaignId);
    if (!mainCampaign && allCampaigns.length > 0) {
        mainCampaign = allCampaigns[0];
        activeCampaignId = mainCampaign.campaign_id;
    }

    renderMainCampaign(mainCampaign);
    renderOtherCampaigns();
}

// Render the primary featured campaign details
function renderMainCampaign(camp) {
    if (!camp) return;

    // Cover Image
    var coverImg = document.querySelector('.campaign-image-container img');
    if (coverImg) {
        coverImg.src = 'uploads/campaigns/covers/' + camp.cover_image;
    }

    // Title & Description
    var titleEl = document.querySelector('.campaign-title');
    if (titleEl) titleEl.textContent = camp.title;

    var descEl = document.querySelector('.campaign-desc');
    if (descEl) descEl.textContent = camp.description;

    // Proof Documents
    var proofGrid = document.querySelector('.proof-grid');
    if (proofGrid && camp.proof_document) {
        proofGrid.innerHTML = `
            <a href="uploads/campaigns/proofs/${camp.proof_document}" target="_blank" style="text-decoration:none; color:inherit; flex: 1;">
                <div class="proof-item" style="cursor:pointer; display:flex; align-items:center; gap:10px;">
                    <span class="material-symbols-outlined proof-icon">verified_user</span>
                    <p class="proof-name">View Proof/Verification Document</p>
                </div>
            </a>
        `;
    }

    // Sticky Donation Box Stats
    var raisedEl = document.querySelector('.amount-raised');
    if (raisedEl) raisedEl.textContent = camp.collected_amount.toLocaleString() + ' BDT';

    var goalEl = document.querySelector('.amount-goal');
    if (goalEl) goalEl.textContent = 'raised of ' + camp.target_amount.toLocaleString() + ' BDT';

    var fillEl = document.querySelector('.progress-track .progress-fill');
    if (fillEl) fillEl.style.width = camp.progress_percent + '%';

    var countEl = document.querySelector('.donor-count');
    if (countEl) countEl.textContent = camp.donors_count + ' people donated';

    // Reset preset buttons and inputs
    selectAmount(1000);

    // Load and render supportive comments
    loadSupportiveComments(camp.campaign_id);
}

// Render other active campaigns in the feed grid at the bottom
function renderOtherCampaigns() {
    var otherFeed = document.querySelector('.feed-grid');
    if (!otherFeed) return;

    // Filter out the active main campaign
    var otherCamps = allCampaigns.filter(c => c.campaign_id !== activeCampaignId);

    if (otherCamps.length === 0) {
        otherFeed.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#94a3b8; font-size:13px; padding:20px;">No other active campaigns available.</p>';
        return;
    }

    otherFeed.innerHTML = otherCamps.map(camp => `
        <div class="feed-card" style="cursor:pointer;" onclick="selectCampaign(${camp.campaign_id})">
            <div class="feed-card-img">
                <img src="uploads/campaigns/covers/${camp.cover_image}" alt="${camp.title}">
                <div class="feed-card-badge">
                    <span class="material-symbols-outlined">verified</span> Admin Verified
                </div>
            </div>
            <div class="feed-card-content">
                <h4 class="feed-card-title">${camp.title}</h4>
                <p class="feed-card-desc">${camp.description.substring(0, 110)}...</p>
                
                <div class="feed-card-progress">
                    <div class="feed-card-stats">
                        <span class="feed-card-amounts">${camp.collected_amount.toLocaleString()} / ${camp.target_amount.toLocaleString()} BDT</span>
                        <span class="feed-card-percent">${camp.progress_percent}%</span>
                    </div>
                    <div class="feed-card-bar">
                        <div class="feed-card-fill" style="width: ${camp.progress_percent}%"></div>
                    </div>
                </div>
                
                <div class="feed-card-footer">
                    <span class="feed-card-donors">${camp.donors_count} people donated</span>
                    <button class="feed-card-btn" onclick="event.stopPropagation(); selectCampaign(${camp.campaign_id});">Donate</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Change the featured active campaign
function selectCampaign(id) {
    activeCampaignId = id;
    renderCampaigns();
    // Scroll smoothly to top content grid
    var grid = document.querySelector('.content-grid');
    if (grid) grid.scrollIntoView({ behavior: 'smooth' });
}

// ---- Load Supportive Comments from Database ----
function loadSupportiveComments(campaignId) {
    var commentsList = document.querySelector('.comments-list');
    if (!commentsList) return;

    fetchWithAuth('backend/api/campaign/comments.php?campaign_id=' + campaignId)
        .then(res => {
            var comments = res.data;
            var listHTML = comments.map(c => {
                var avatar = c.profile_photo 
                    ? 'uploads/profiles/' + c.profile_photo
                    : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.full_name) + '&background=1E3A8A&color=fff';

                return `
                    <div class="comment-row" style="display:flex; gap:12px; margin-bottom:12px; border-bottom:1px solid #f8fafc; padding-bottom:12px;">
                        <div class="comment-avatar" style="width:36px; height:36px; border-radius:50%; overflow:hidden; flex-shrink:0;">
                            <img src="${avatar}" style="width:100%; height:100%; object-fit:cover;" alt="${c.full_name}">
                        </div>
                        <div class="comment-content" style="flex:1;">
                            <div class="comment-header" style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                                <span class="comment-author" style="font-weight:700; font-size:13px; color:#1e293b;">${c.full_name}</span>
                                <span class="comment-time" style="font-size:11px; color:#94a3b8;">${c.time_str}</span>
                            </div>
                            <p class="comment-text" style="font-size:13px; color:#475569; margin:0; line-height:1.4;">${c.content}</p>
                        </div>
                    </div>
                `;
            }).join('');

            // Append a post comment form dynamically!
            var formHTML = `
                <div class="comment-input-box" style="margin-top:20px; display:flex; gap:10px; border-top:1px solid #f1f5f9; padding-top:16px;">
                    <input type="text" id="commentTextInput" placeholder="Write a supportive comment..." style="flex:1; padding:10px 14px; border:2px solid #e2e8f0; border-radius:10px; outline:none; font-size:13px; font-family:inherit; background:#f8fafc; transition: border-color 0.2s;" />
                    <button onclick="postSupportiveComment()" style="background:#1E3A8A; color:white; border:none; padding:10px 20px; border-radius:10px; cursor:pointer; font-size:13px; font-weight:700; display:flex; align-items:center; gap:4px;">Post</button>
                </div>
            `;

            commentsList.innerHTML = listHTML + formHTML;

            // Simple focus visual styling for input
            var input = document.getElementById('commentTextInput');
            if (input) {
                input.addEventListener('focus', function() { input.style.borderColor = '#1E3A8A'; });
                input.addEventListener('blur', function() { input.style.borderColor = '#e2e8f0'; });
                // Support Enter key submit
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') postSupportiveComment();
                });
            }
        })
        .catch(err => {
            console.error('Error loading comments:', err);
        });
}

// ---- Post supportive comment ----
function postSupportiveComment() {
    var textInput = document.getElementById('commentTextInput');
    var commentText = textInput.value.trim();

    if (!commentText) {
        alert('Please enter your comment content.');
        return;
    }

    fetchWithAuth('backend/api/campaign/comments.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            campaign_id: activeCampaignId,
            content: commentText
        })
    })
    .then(res => {
        textInput.value = '';
        loadSupportiveComments(activeCampaignId);
    })
    .catch(err => {
        alert('Failed to post comment: ' + err.message);
    });
}

// ---- Amount Selection ----
function selectAmount(amount) {
    selectedAmount = amount;
    var btn500 = document.getElementById('btn-500');
    var btn1000 = document.getElementById('btn-1000');
    if (btn500) btn500.className = 'preset-btn';
    if (btn1000) btn1000.className = 'preset-btn';
    
    if (amount === 500 && btn500) {
        btn500.className = 'preset-btn active';
    } else if (amount === 1000 && btn1000) {
        btn1000.className = 'preset-btn active';
    }
    
    var custom = document.getElementById('customInput');
    if (custom) custom.value = '';
}

function customInputChanged() {
    var btn500 = document.getElementById('btn-500');
    var btn1000 = document.getElementById('btn-1000');
    if (btn500) btn500.className = 'preset-btn';
    if (btn1000) btn1000.className = 'preset-btn';
    
    var inputValue = document.getElementById('customInput').value;
    selectedAmount = parseInt(inputValue);
}

// ---- Donate (requires UIU verification) ──────────────────────────
function submitDonation() {
    if (localStorage.getItem('uiu_verified') !== 'true') {
        openCfVerificationModal();
        return;
    }

    if (!selectedAmount || selectedAmount <= 0) {
        alert('Please select or enter an amount to donate.');
        return;
    }

    var isAnonymous = document.getElementById('anonymousCheck').checked ? 1 : 0;
    var messagePrompt = 'Confirm your donation of ' + selectedAmount.toLocaleString() + ' BDT.\n\nProceed?';

    var confirmed = confirm(messagePrompt);
    if (!confirmed) return;

    fetchWithAuth('backend/api/campaign/donate.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            campaign_id: activeCampaignId,
            amount: selectedAmount,
            is_anonymous: isAnonymous,
            message: 'Supportive contribution.',
            transaction_ref: 'TXN_D_' + Date.now()
        })
    })
    .then(res => {
        showCfToast('✅ Thank you! Your donation of ' + selectedAmount.toLocaleString() + ' BDT was successful.');
        loadCampaigns(); // Reload campaign details & progress
    })
    .catch(err => {
        alert('Donation failed: ' + err.message);
    });
}

// ---- Start Campaign (requires UIU verification) ----
function startCampaign() {
    if (localStorage.getItem('uiu_verified') !== 'true') {
        openCfVerificationModal();
        return;
    }
    window.location.href = 'start_campaign.html';
}

// ---- Filter Pills ----
function selectFilter(element) {
    var pills = document.getElementsByClassName('filter-pill');
    for (var i = 0; i < pills.length; i++) {
        pills[i].className = 'filter-pill';
    }
    element.className = 'filter-pill active';

    // Map filters to categories
    var category = '';
    var text = element.textContent.toLowerCase();
    if (text.includes('medical')) {
        category = 'medical';
    } else if (text.includes('tuition') || text.includes('education')) {
        category = 'education';
    } else if (text.includes('charity') || text.includes('emergency')) {
        category = 'emergency';
    }

    // Refresh campaigns list based on filtered category
    fetchWithAuth('backend/api/campaign/campaigns.php?category=' + category)
        .then(res => {
            allCampaigns = res.data;
            if (allCampaigns.length > 0) {
                // Keep same active campaign if it exists in filtered result
                var stillExists = allCampaigns.find(c => c.campaign_id === activeCampaignId);
                if (!stillExists) {
                    activeCampaignId = allCampaigns[0].campaign_id;
                }
                renderCampaigns();
            } else {
                // Clear list
                document.querySelector('.feed-grid').innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#94a3b8; font-size:13px; padding:20px;">No campaigns found in this category.</p>';
            }
        })
        .catch(err => {
            console.error(err);
        });
}

// ---- Update verification badge in header ----
function updateCfVerificationBadge() {
    var badge = document.getElementById('cf-verification-badge');
    if (!badge) return;
    if (localStorage.getItem('uiu_verified') === 'true') {
        badge.textContent = '✔ UIU Verified';
        badge.className = 'cf-badge verified';
    } else {
        badge.textContent = '⚠ Verify to Donate';
        badge.className = 'cf-badge unverified';
        badge.onclick = function() { openCfVerificationModal(); };
    }
}

// ---- Verification Modal ----
function openCfVerificationModal() {
    var modal = document.getElementById('cf-verification-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// ---- Close Verification Modal ----
function closeCfVerificationModal() {
    var modal = document.getElementById('cf-verification-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ---- Submit Student Verification ----
function submitCfVerification() {
    var studentId = document.getElementById('cf-student-id').value.trim();
    var studentEmail = document.getElementById('cf-student-email').value.trim();

    if (!studentId) {
        alert('Please enter your UIU Student ID.');
        return;
    }
    
    var emailPattern = /^[a-zA-Z0-9._%+-]+@.*uiu.*\.ac\.bd$/;
    if (!studentEmail || !emailPattern.test(studentEmail)) {
        alert('Please enter a valid UIU institutional email (e.g. student@bscse.uiu.ac.bd).');
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

        closeCfVerificationModal();
        updateCfVerificationBadge();
        showCfToast('✅ Verified! You can now donate and start campaigns.');
        syncUserProfile();
    })
    .catch(err => {
        alert('Verification failed: ' + err.message);
    });
}

// ---- Toast ----
function showCfToast(message) {
    var toast = document.getElementById('cf-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'cf-toast';
        toast.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,0.25);max-width:500px;text-align:center;transition:opacity 0.3s;';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function() { toast.style.opacity = '0'; }, 4000);
}

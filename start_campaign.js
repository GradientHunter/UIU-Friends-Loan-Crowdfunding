// ============================================================
//  start_campaign.js  –  UIU Friends Network (API Active)
// ============================================================

// Global cache of actual File objects selected by the user
var realUploadedFiles = [];

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
  // Sync profile header
  syncUserProfile();
});

function syncUserProfile() {
  fetchWithAuth('backend/api/auth/me.php')
    .then(res => {
      var user = res.data;
      var nameEl = document.querySelector('.leading-none');
      if (nameEl) nameEl.textContent = user.full_name;

      var avatarImg = document.querySelector('.ring-2 img');
      if (avatarImg) {
        if (user.profile_photo) {
          avatarImg.src = 'uploads/profiles/' + user.profile_photo;
        } else {
          avatarImg.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.full_name) + '&background=1E3A8A&color=fff';
        }
      }
    })
    .catch(err => {
      console.log('Not logged in:', err.message);
      if (!localStorage.getItem('user_id')) {
        window.location.href = 'login.html';
      }
    });
}

// ---- Format Text in Story Editor ----
function formatText(style) {
  var textarea = document.getElementById('story-text');
  var start = textarea.selectionStart;
  var end = textarea.selectionEnd;
  var text = textarea.value;
  var selectedText = text.substring(start, end);
  var replacement = "";

  if (style === 'bold') {
    replacement = "**" + selectedText + "**";
  } else if (style === 'italic') {
    replacement = "_" + selectedText + "_";
  }

  textarea.value = text.substring(0, start) + replacement + text.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start + 2, start + 2 + selectedText.length);
}

// ---- Insert List in Editor ----
function insertList() {
  var textarea = document.getElementById('story-text');
  var start = textarea.selectionStart;
  var end = textarea.selectionEnd;
  var text = textarea.value;
  var selectedText = text.substring(start, end);
  
  var replacement = "\n- " + selectedText;
  textarea.value = text.substring(0, start) + replacement + text.substring(end);
  textarea.focus();
}

// ---- Insert Link in Editor ----
function insertLink() {
  var textarea = document.getElementById('story-text');
  var start = textarea.selectionStart;
  var end = textarea.selectionEnd;
  var text = textarea.value;
  
  var url = prompt("Enter the URL:", "https://");
  if (url) {
    var selectedText = text.substring(start, end) || "link text";
    var replacement = "[" + selectedText + "](" + url + ")";
    textarea.value = text.substring(0, start) + replacement + text.substring(end);
  }
  textarea.focus();
}

// ---- Insert Image in Editor ----
function triggerImageUpload() {
  var textarea = document.getElementById('story-text');
  var start = textarea.selectionStart;
  var end = textarea.selectionEnd;
  var text = textarea.value;

  var imageUrl = prompt("Enter Image URL:", "https://example.com/image.jpg");
  if (imageUrl) {
    var replacement = "![image description](" + imageUrl + ")";
    textarea.value = text.substring(0, start) + replacement + text.substring(end);
  }
  textarea.focus();
}

// ---- File Upload Actions ----
function triggerFileInput() {
  document.getElementById('file-input').click();
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.add('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-over');
  
  var files = e.dataTransfer.files;
  addFilesToList(files);
}

function handleFileSelect(e) {
  var files = e.target.files;
  addFilesToList(files);
}

// Process files and update UI list
function addFilesToList(files) {
  var listContainer = document.getElementById('files-list');

  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    
    // Check file size (5MB Limit)
    if (file.size > 5 * 1024 * 1024) {
      alert("File '" + file.name + "' exceeds the 5MB size limit.");
      continue;
    }

    // Determine type icon
    var isPdf = file.name.toLowerCase().endsWith('.pdf');
    var iconName = isPdf ? 'picture_as_pdf' : 'image';

    // Prevent duplicate entries
    var exists = false;
    for (var j = 0; j < realUploadedFiles.length; j++) {
      if (realUploadedFiles[j].name === file.name) {
        exists = true;
        break;
      }
    }

    if (exists) {
      alert("File '" + file.name + "' is already uploaded.");
      continue;
    }

    // Save actual File object to list
    realUploadedFiles.push(file);

    // Create chip HTML
    var chip = document.createElement('div');
    chip.className = 'file-chip flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 group';
    chip.id = 'file-' + file.name.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Let's build the HTML carefully
    var chipContent = `
      <span class="material-symbols-outlined text-slate-400 text-lg">${iconName}</span>
      <span class="text-sm font-medium text-slate-700">${file.name}</span>
      <button type="button" class="text-slate-400 hover:text-red-500 ml-auto" onclick="removeFile('${file.name}')">
        <span class="material-symbols-outlined text-lg">close</span>
      </button>
    `;
    chip.innerHTML = chipContent;
    listContainer.appendChild(chip);
  }
}

// Remove File Chip
function removeFile(fileName) {
  // Remove from array
  realUploadedFiles = realUploadedFiles.filter(function (file) {
    return file.name !== fileName;
  });

  // Remove from DOM
  var safeId = 'file-' + fileName.replace(/[^a-zA-Z0-9]/g, '_');
  var element = document.getElementById(safeId);
  if (element) {
    element.parentNode.removeChild(element);
  }
}

// ---- Footer Nav Action - Back ----
function goBack() {
  window.history.back();
}

// ---- Footer Nav Action - Next Step (Real Submit) ----
function goNext() {
  var title = document.getElementById('campaign-title').value.trim();
  var amount = document.getElementById('target-amount').value.trim().replace(/,/g, '');
  var story = document.getElementById('story-text').value.trim();
  var selectCategory = document.getElementById('campaign-category').value;

  if (!title) {
    alert("Please enter a Campaign Title.");
    document.getElementById('campaign-title').focus();
    return;
  }

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    alert("Please enter a valid Target Amount.");
    document.getElementById('target-amount').focus();
    return;
  }

  if (!story) {
    alert("Please tell your story in the Story section.");
    document.getElementById('story-text').focus();
    return;
  }

  if (realUploadedFiles.length === 0) {
    alert("Please upload at least one verification document.");
    return;
  }

  // Map category select option to DB category enum
  var dbCategory = 'other';
  var catLower = selectCategory.toLowerCase();
  if (catLower.includes('medical') || catLower.includes('surgery')) {
    dbCategory = 'medical';
  } else if (catLower.includes('education') || catLower.includes('tuition')) {
    dbCategory = 'education';
  } else if (catLower.includes('project')) {
    dbCategory = 'project';
  } else if (catLower.includes('general') || catLower.includes('charity')) {
    dbCategory = 'emergency';
  }

  // Set default deadline 30 days in the future
  var targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 30);
  var targetDateStr = targetDate.toISOString().split('T')[0] + ' 23:59:59';

  // Build FormData
  var formData = new FormData();
  formData.append('title', title);
  formData.append('target_amount', parseFloat(amount));
  formData.append('description', story);
  formData.append('category', dbCategory);
  formData.append('deadline', targetDateStr);

  // Cover image is first file, proof is second file (or same if only one)
  formData.append('cover_image', realUploadedFiles[0]);
  formData.append('proof_document', realUploadedFiles[1] || realUploadedFiles[0]);

  // Visual feedback
  var nextBtn = document.getElementById('next-btn');
  var originalHTML = nextBtn.innerHTML;
  nextBtn.innerHTML = '<span>Launching Campaign...</span> <span class="material-symbols-outlined">hourglass_empty</span>';
  nextBtn.disabled = true;
  nextBtn.style.background = '#10B981';

  // Send request to campaigns.php
  var userId = localStorage.getItem('user_id') || '';
  fetch('backend/api/campaign/campaigns.php', {
    method: 'POST',
    headers: {
      'X-User-ID': userId
    },
    body: formData
  })
  .then(response => {
    return response.json().then(data => {
      if (!response.ok) {
        throw new Error(data.message || 'Failed to start campaign.');
      }
      return data;
    });
  })
  .then(data => {
    alert("Congratulations! Your crowdfunding campaign has been launched successfully.");
    window.location.href = "crowdfunding.html";
  })
  .catch(err => {
    alert("Campaign Creation Failed: " + err.message);
    nextBtn.innerHTML = originalHTML;
    nextBtn.style.background = '';
    nextBtn.disabled = false;
  });
}

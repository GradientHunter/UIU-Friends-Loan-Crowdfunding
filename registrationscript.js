// =============================================================
//  UIU Friends Network - Registration Script (API Integrated)
// =============================================================

// The visible "Upload ID Image" button
const uploadBtn = document.getElementById('uploadBtn');

// The hidden <input type="file"> that actually opens the file picker
const idUpload = document.getElementById('idUpload');

// The <span> that shows the selected file name after picking
const fileNameDisplay = document.getElementById('fileName');

// The whole registration form
const registrationForm = document.getElementById('registrationForm');


// ── 1. File Upload Logic ──────────────────────────────────────────────────────
if (uploadBtn && idUpload) {
    uploadBtn.addEventListener('click', function () {
        idUpload.click();
    });

    idUpload.addEventListener('change', function () {
        const selectedFile = idUpload.files[0];
        if (selectedFile) {
            fileNameDisplay.textContent = '✓ ' + selectedFile.name;
            fileNameDisplay.style.display = 'block';
        }
    });
}


// ── 2. Form Submission Logic ──────────────────────────────────────────────────
if (registrationForm) {
    registrationForm.addEventListener('submit', function (event) {
        event.preventDefault();

        // Read values
        const fullName       = document.getElementById('fullName').value.trim();
        const studentId      = document.getElementById('studentId').value.trim();
        const emailUser      = document.getElementById('emailUser').value.trim();
        const password       = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const idFile         = idUpload.files[0];

        // ── Validation checks ──────────────────────────────────────────────────
        if (!fullName || !studentId || !emailUser) {
            alert('Please fill in all required fields.');
            return;
        }

        if (password !== confirmPassword) {
            alert('Passwords do not match. Please try again.');
            return;
        }

        if (password.length < 8) {
            alert('Password must be at least 8 characters long.');
            return;
        }

        if (!idFile) {
            alert('Please upload your UIU Student ID image before submitting.');
            return;
        }

        const fullEmail = emailUser + '@bscse.uiu.ac.bd';

        // ── Build FormData (necessary for file upload) ─────────────────────────
        const formData = new FormData();
        formData.append('full_name', fullName);
        formData.append('student_id', studentId);
        formData.append('email', fullEmail);
        formData.append('password', password);
        formData.append('id_card', idFile); // matches handle_file_upload('id_card', ...)

        // Show loading state
        const submitBtn = registrationForm.querySelector('.submit-button');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Submitting...';

        // Send to backend
        fetch('backend/api/auth/register.php', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            return response.text().then(text => {
                var data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    console.error('Invalid JSON response:', text);
                    throw new Error('Server returned invalid JSON. Response was:\n' + text.substring(0, 300));
                }
                if (!response.ok) {
                    let errMsg = data.message || 'Registration failed';
                    if (data.errors && data.errors.length > 0) {
                        errMsg += ':\n• ' + data.errors.join('\n• ');
                    }
                    throw new Error(errMsg);
                }
                return data;
            });
        })
        .then(data => {
            alert(data.message || 'Registration submitted successfully! You can now log in.');
            window.location.href = 'login.html';
        })
        .catch(error => {
            console.error('Registration error:', error);
            alert('Error: ' + error.message);
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        });
    });
}

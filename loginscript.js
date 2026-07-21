/* ================================================================
   SCRIPT: UIU Friends Network — Login Page (API Integrated)
   ================================================================ */

document.addEventListener('DOMContentLoaded', function () {

    // ── 1. PASSWORD VISIBILITY TOGGLE ─────────────────────────────
    var toggleButton  = document.getElementById('togglePassword');
    var passwordInput = document.getElementById('password');
    var eyeOpenIcon   = document.getElementById('eyeOpen');
    var eyeClosedIcon = document.getElementById('eyeClosed');

    if (toggleButton && passwordInput && eyeOpenIcon && eyeClosedIcon) {
        toggleButton.addEventListener('click', function () {
            var currentType = passwordInput.getAttribute('type');

            if (currentType === 'password') {
                passwordInput.setAttribute('type', 'text');
                eyeOpenIcon.style.display   = 'none';
                eyeClosedIcon.style.display = 'block';
            } else {
                passwordInput.setAttribute('type', 'password');
                eyeOpenIcon.style.display   = 'block';
                eyeClosedIcon.style.display = 'none';
            }
        });
    }


    // ── 2. FORM SUBMISSION HANDLER ────────────────────────────────
    var loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', function (event) {
            event.preventDefault();

            var studentId = document.getElementById('studentId').value.trim();
            var password  = document.getElementById('password').value;

            if (studentId === '' || password === '') {
                alert('Please fill in both fields before signing in.');
                return;
            }

            var submitBtn = loginForm.querySelector('.btn-signin');
            var originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Signing In...';

            // Send POST request to login.php
            fetch('backend/api/auth/login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    studentId: studentId,
                    password: password
                })
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
                        throw new Error(data.message || 'Login failed');
                    }
                    return data;
                });
            })
            .then(data => {
                var user = data.data;
                // Save user session in localStorage
                localStorage.setItem('user_id', user.user_id);
                localStorage.setItem('user_details', JSON.stringify(user));
                // Fix #12: store CSRF token returned by server
                if (data.data.csrf_token) {
                    localStorage.setItem('csrf_token', data.data.csrf_token);
                }
                
                // If they have student_id and email, set verified status
                if (user.student_id && user.email) {
                    localStorage.setItem('uiu_verified', 'true');
                    localStorage.setItem('uiu_student_id', user.student_id);
                    localStorage.setItem('uiu_student_email', user.email);
                } else {
                    localStorage.setItem('uiu_verified', 'false');
                }

                alert('Welcome back, ' + user.full_name + '!');
                window.location.href = 'dashboard.html';
            })
            .catch(error => {
                console.error('Login error:', error);
                alert('Login failed: ' + error.message);
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            });
        });
    }

});

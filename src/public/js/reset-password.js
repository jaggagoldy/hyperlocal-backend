/* Reset Password page — consumes the email link token and sets a new password. */
(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const email = params.get('email');

  const form = document.getElementById('reset-form');
  const messageEl = document.getElementById('message');
  const submitBtn = document.getElementById('submit-btn');

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = 'msg ' + type;
  }

  // Guard against a missing/broken link before the user fills anything in.
  if (!token || !email) {
    form.style.display = 'none';
    showMessage('This password reset link is invalid or incomplete. Please request a new one.', 'error');
    return;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;

    if (password.length < 6) {
      showMessage('Password must be at least 6 characters.', 'error');
      return;
    }
    if (password !== confirm) {
      showMessage('Passwords do not match.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Resetting…';

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, token: token, newPassword: password }),
      });
      const data = await res.json();

      if (res.ok) {
        form.style.display = 'none';
        showMessage('Your password has been reset. Redirecting you to sign in…', 'success');
        setTimeout(function () { window.location.href = '/'; }, 2500);
      } else {
        showMessage(data.message || 'Could not reset password. The link may have expired.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reset Password';
      }
    } catch (err) {
      showMessage('Network error. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reset Password';
    }
  });
})();

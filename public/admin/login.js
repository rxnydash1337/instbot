(function() {
    var p = location.pathname.split('/').filter(Boolean);
    window.ADMIN_BASE = p.length ? '/' + p[0] : '';
})();
var form = document.getElementById('login-form');
form.onsubmit = async function(e) {
    e.preventDefault();
    var err = document.getElementById('login-error');
    err.textContent = '';
    var f = e.target;
    var res = await fetch((window.ADMIN_BASE || '') + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: f.username.value,
            password: f.password.value
        }),
        credentials: 'include'
    });
    var data = await res.json();
    if (data.success) {
        window.location.href = (window.ADMIN_BASE || '') + '/';
    } else {
        err.textContent = data.error || 'Неверный логин или пароль';
    }
};
(function() {
    var params = new URLSearchParams(location.search);
    var u = params.get('username');
    var pw = params.get('password');
    if (u || pw) {
        if (u) form.username.value = decodeURIComponent(u);
        if (pw) form.password.value = decodeURIComponent(pw);
        history.replaceState(null, '', (window.ADMIN_BASE || '') + '/login');
        if (u && pw) setTimeout(function() { form.requestSubmit(); }, 0);
    }
})();

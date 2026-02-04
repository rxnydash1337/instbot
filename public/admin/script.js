let telegramBotInfo = null;

function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + type;
    setTimeout(() => el.classList.remove('show'), 3000);
}

async function loadTelegramInfo() {
    try {
        const res = await fetch('/api/telegram/info', { credentials: 'include' });
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        telegramBotInfo = await res.json();
        const el = document.getElementById('telegram-info');
        if (el) {
            el.className = 'telegram-badge ' + (telegramBotInfo?.available ? 'ok' : 'err');
            el.innerHTML = telegramBotInfo?.available
                ? `✓ @${telegramBotInfo.botUsername}`
                : '✗ Telegram не настроен';
        }
    } catch (e) {
        console.error(e);
    }
}

async function loadPosts() {
    try {
        const res = await fetch('/api/posts', { credentials: 'include' });
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        const posts = await res.json();
        renderPosts(posts);
    } catch (e) {
        document.getElementById('posts-container').innerHTML =
            '<div class="loading">Ошибка: ' + e.message + '</div>';
    }
}

function toggleCard(id) {
    const body = document.getElementById('body-' + id);
    if (body) body.classList.toggle('collapsed');
}

function renderPosts(posts) {
    const container = document.getElementById('posts-container');
    container.classList.remove('loading');
    if (!posts.length) {
        container.innerHTML = '<p style="color: var(--text-muted);">Посты не найдены. Настройте Instagram Graph API.</p>';
        return;
    }
    container.innerHTML = posts.map(post => {
        const status = post.settings?.enabled ? 'active' : post.settings ? 'inactive' : 'none';
        const statusText = post.settings?.enabled ? 'Вкл' : post.settings ? 'Выкл' : '—';
        return `
        <article class="post-card">
            <div class="post-card-header" onclick="toggleCard('${post.id}')">
                <div class="post-meta">
                    <div class="post-id">${post.id}</div>
                    <div class="post-caption">${escapeHtml(post.caption || 'Без описания')}</div>
                    <a href="${escapeHtml(post.permalink || '#')}" target="_blank" class="post-link" onclick="event.stopPropagation()">Открыть в Instagram →</a>
                </div>
                <span class="status ${status}">${statusText}</span>
            </div>
            <div id="body-${post.id}" class="post-card-body collapsed">
                <form class="settings-form" onsubmit="saveSettings(event, '${post.id}')">
                    <div class="section">
                        <div class="section-title">Instagram</div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Кодовое слово *</label>
                                <input type="text" name="codeWord" value="${escapeHtml(post.settings?.codeWord || '')}" required placeholder="SECRET123">
                            </div>
                            <div class="form-group" style="grid-column: 1/-1">
                                <label>Ответ на комментарий</label>
                                <textarea name="commentReply">${escapeHtml(post.settings?.commentReply || 'напиши в директ!')}</textarea>
                            </div>
                            <div class="form-group" style="grid-column: 1/-1">
                                <label>Ответ в директ</label>
                                <textarea name="directReply">${escapeHtml(post.settings?.directReply || 'Спасибо! Нажми кнопку ниже.')}</textarea>
                            </div>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">Telegram — контент для кодового слова</div>
                        <div class="form-row">
                            <div class="form-group" style="grid-column: 1/-1">
                                <label>Сообщение в Telegram</label>
                                <textarea name="telegramMessage" placeholder="Инструкция для пользователя">${escapeHtml(post.settings?.telegramMessage || 'Привет! Вот инструкция.')}</textarea>
                            </div>
                            <div class="form-group">
                                <label>URL редиректа</label>
                                <input type="url" name="redirectUrl" value="${escapeHtml(post.settings?.redirectUrl || '')}" placeholder="t.me/бот?start=код">
                            </div>
                        </div>
                    </div>
                    <div class="form-group checkbox-group">
                        <input type="checkbox" name="enabled" id="enabled-${post.id}" ${post.settings?.enabled !== false ? 'checked' : ''}>
                        <label for="enabled-${post.id}" style="margin:0">Активен</label>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Сохранить</button>
                        ${post.settings ? `<button type="button" class="btn btn-danger" onclick="deleteSettings('${post.id}')">Удалить</button>` : ''}
                    </div>
                </form>
            </div>
        </article>`;
    }).join('');
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

async function saveSettings(event, postId) {
    event.preventDefault();
    const form = event.target;
    const codeWord = form.codeWord.value;
    let redirectUrl = form.redirectUrl.value;
    if (!redirectUrl && telegramBotInfo?.available) {
        redirectUrl = `${telegramBotInfo.botUrl}?start=${encodeURIComponent(codeWord)}`;
    }
    const data = {
        codeWord,
        commentReply: form.commentReply.value,
        directReply: form.directReply.value,
        redirectUrl,
        telegramMessage: form.telegramMessage.value,
        enabled: form.enabled.checked,
    };
    try {
        const res = await fetch(`/api/posts/${postId}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include',
        });
        const result = await res.json();
        if (result.success) {
            toast('Сохранено');
            loadPosts();
        } else {
            toast(result.error || 'Ошибка', 'error');
        }
    } catch (e) {
        toast('Ошибка: ' + e.message, 'error');
    }
}

async function deleteSettings(postId) {
    if (!confirm('Удалить настройки?')) return;
    try {
        const res = await fetch(`/api/posts/${postId}/settings`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const result = await res.json();
        if (result.success) {
            toast('Удалено');
            loadPosts();
        } else {
            toast('Ошибка', 'error');
        }
    } catch (e) {
        toast('Ошибка', 'error');
    }
}

document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
});

loadTelegramInfo().then(() => {
    loadPosts();
    setInterval(loadPosts, 30000);
});

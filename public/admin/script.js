var ADMIN_BASE = (typeof window !== 'undefined' && window.ADMIN_BASE) ? window.ADMIN_BASE : '';
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
        const res = await fetch(ADMIN_BASE + '/api/telegram/info', { credentials: 'include' });
        if (res.status === 401) {
            window.location.href = ADMIN_BASE + '/login';
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
        const res = await fetch(ADMIN_BASE + '/api/posts', { credentials: 'include' });
        if (res.status === 401) {
            window.location.href = ADMIN_BASE + '/login';
            return;
        }
        const posts = await res.json();
        renderPosts(Array.isArray(posts) ? posts : []);
    } catch (e) {
        const c = document.getElementById('posts-container');
        if (c) {
            c.classList.remove('loading');
            c.innerHTML = '<p class="empty-state">Ошибка загрузки постов.</p>';
        }
    }
}

async function loadWords() {
    const container = document.getElementById('words-container');
    if (!container) return;
    try {
        const res = await fetch(ADMIN_BASE + '/api/words', { credentials: 'include' });
        if (res.status === 401) {
            window.location.href = ADMIN_BASE + '/login';
            return;
        }
        const words = await res.json();
        container.classList.remove('loading');
        if (!words.length) {
            container.innerHTML = '<p class="empty-state">Нет кодовых слов. Добавьте ниже.</p>';
            return;
        }
        container.innerHTML = words.map(w => {
            const status = w.enabled ? 'active' : 'inactive';
            const link = (telegramBotInfo?.botUrl && telegramBotInfo?.botUsername) ? `https://t.me/${telegramBotInfo.botUsername}?start=${encodeURIComponent(w.codeWord)}` : '';
            const hasMedia = w.telegramMedia && w.telegramMedia.url;
            const hasButtons = Array.isArray(w.telegramButtons) && w.telegramButtons.length > 0;
            const extras = [];
            if (hasMedia) extras.push('📷');
            if (hasButtons) extras.push('🔘');
            return `
            <div class="word-card">
                <div class="word-card-main">
                    <span class="word-badge">${escapeHtml(w.codeWord)}</span>
                    ${extras.length ? '<span class="word-extras">' + extras.join(' ') + '</span>' : ''}
                    <span class="status ${status}">${w.enabled ? 'Вкл' : 'Выкл'}</span>
                    ${link ? `<a href="${escapeHtml(link)}" target="_blank" class="word-link">Ссылка</a>` : ''}
                </div>
                <p class="word-msg">${escapeHtml((w.telegramMessage || '').slice(0, 80))}${(w.telegramMessage || '').length > 80 ? '…' : ''}</p>
                <button type="button" class="btn btn-small btn-danger" onclick="deleteWord('${escapeHtml(w.id)}')">Удалить</button>
            </div>`;
        }).join('');
    } catch (e) {
        container.classList.remove('loading');
        container.innerHTML = '<p class="empty-state">Ошибка загрузки.</p>';
    }
}

function collectWordButtons() {
    const list = document.getElementById('word-buttons-list');
    if (!list) return [];
    const rows = list.querySelectorAll('.button-row');
    const out = [];
    rows.forEach(row => {
        const text = (row.querySelector('.btn-text') || {}).value;
        const url = (row.querySelector('.btn-url') || {}).value;
        if (text && url) out.push({ text: text.trim(), url: url.trim() });
    });
    return out;
}

function addWordButtonRow(text, url) {
    const list = document.getElementById('word-buttons-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'button-row';
    row.innerHTML = `
        <input type="text" class="form-input btn-text" placeholder="Текст кнопки" value="${escapeHtml(text || '')}">
        <input type="url" class="form-input btn-url" placeholder="https://..." value="${escapeHtml(url || '')}">
        <button type="button" class="btn btn-small btn-danger btn-remove-row">×</button>
    `;
    row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
    list.appendChild(row);
}

async function saveWord(event) {
    event.preventDefault();
    const form = document.getElementById('word-form');
    const codeWord = form.codeWord.value.trim();
    if (!codeWord) return;
    const mediaType = (form.telegramMediaType && form.telegramMediaType.value) || '';
    const mediaUrl = (form.telegramMediaUrl && form.telegramMediaUrl.value && form.telegramMediaUrl.value.trim()) || '';
    const telegramMedia = mediaType && mediaUrl ? { type: mediaType, url: mediaUrl } : null;
    const telegramButtons = collectWordButtons();
    const data = {
        codeWord,
        telegramMessage: form.telegramMessage.value,
        enabled: form.enabled.checked,
        telegramMedia,
        telegramButtons,
    };
    try {
        const res = await fetch(ADMIN_BASE + '/api/words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include',
        });
        const result = await res.json();
        if (result.success) {
            toast('Сохранено');
            form.codeWord.value = '';
            form.telegramMessage.value = '';
            form.enabled.checked = true;
            if (form.telegramMediaType) form.telegramMediaType.value = '';
            const urlInput = document.getElementById('word-media-url');
            if (urlInput) urlInput.value = '';
            const fileInput = document.getElementById('word-media-file');
            if (fileInput) fileInput.value = '';
            const mediaStatus = document.getElementById('word-media-status');
            if (mediaStatus) mediaStatus.textContent = '';
            document.getElementById('word-buttons-list').innerHTML = '';
            loadWords();
        } else {
            toast(result.error || 'Ошибка', 'error');
        }
    } catch (e) {
        toast('Ошибка: ' + e.message, 'error');
    }
}

async function deleteWord(id) {
    if (!confirm('Удалить кодовое слово?')) return;
    try {
        const res = await fetch(ADMIN_BASE + `/api/words/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const result = await res.json();
        if (result.success) {
            toast('Удалено');
            loadWords();
        } else {
            toast(result.error || 'Ошибка', 'error');
        }
    } catch (e) {
        toast('Ошибка', 'error');
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
        container.innerHTML = '<p class="empty-state">Постов нет (Instagram не подключён или посты не найдены). Используйте блок выше для автоответов по ссылке ?start=слово.</p>';
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
                                <label class="form-label">Кодовое слово *</label>
                                <input type="text" name="codeWord" class="form-input" value="${escapeHtml(post.settings?.codeWord || '')}" required placeholder="SECRET123">
                            </div>
                            <div class="form-group form-group-full">
                                <label class="form-label">Ответ на комментарий</label>
                                <textarea name="commentReply" class="form-textarea">${escapeHtml(post.settings?.commentReply || 'напиши в директ!')}</textarea>
                            </div>
                            <div class="form-group form-group-full">
                                <label class="form-label">Ответ в директ</label>
                                <textarea name="directReply" class="form-textarea">${escapeHtml(post.settings?.directReply || 'Спасибо! Нажми кнопку ниже.')}</textarea>
                            </div>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">Telegram — контент для кодового слова</div>
                        <div class="form-row">
                            <div class="form-group form-group-full">
                                <label class="form-label">Сообщение в Telegram</label>
                                <textarea name="telegramMessage" class="form-textarea" placeholder="Инструкция для пользователя">${escapeHtml(post.settings?.telegramMessage || 'Привет! Вот инструкция.')}</textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">URL редиректа</label>
                                <input type="url" name="redirectUrl" class="form-input" value="${escapeHtml(post.settings?.redirectUrl || '')}" placeholder="t.me/instbotqqetest123_bot?start=код">
                            </div>
                        </div>
                        <div class="form-row form-row-media">
                            <div class="form-group">
                                <label class="form-label">Медиа</label>
                                <select name="telegramMediaType" class="form-input">
                                    <option value="">Нет</option>
                                    <option value="photo" ${(post.settings?.telegramMedia?.type || '') === 'photo' ? 'selected' : ''}>Фото</option>
                                    <option value="video" ${(post.settings?.telegramMedia?.type || '') === 'video' ? 'selected' : ''}>Видео</option>
                                    <option value="document" ${(post.settings?.telegramMedia?.type || '') === 'document' ? 'selected' : ''}>Документ</option>
                                </select>
                            </div>
                            <div class="form-group form-group-flex">
                                <label class="form-label">Загрузить файл</label>
                                <input type="file" class="form-input media-file-input" accept="image/*,video/*,.pdf,.doc,.docx">
                                <input type="hidden" name="telegramMediaUrl" value="${escapeHtml(post.settings?.telegramMedia?.url || '')}">
                                <p class="form-hint media-file-status"></p>
                            </div>
                        </div>
                        <div class="buttons-block">
                            <label class="form-label">Кнопки под сообщением</label>
                            <div class="buttons-list post-buttons-list" id="buttons-list-${post.id}">${(Array.isArray(post.settings?.telegramButtons) ? post.settings.telegramButtons : []).map(b => `
                                <div class="button-row">
                                    <input type="text" class="form-input btn-text" placeholder="Текст кнопки" value="${escapeHtml(b.text || '')}">
                                    <input type="url" class="form-input btn-url" placeholder="https://..." value="${escapeHtml(b.url || '')}">
                                    <button type="button" class="btn btn-small btn-danger btn-remove-row">×</button>
                                </div>`).join('')}</div>
                            <button type="button" class="btn btn-small btn-secondary" onclick="addPostButtonRow('${post.id}')">+ Добавить кнопку</button>
                        </div>
                    </div>
                    <div class="form-group checkbox-group">
                        <input type="checkbox" name="enabled" id="enabled-${post.id}" class="form-checkbox" ${post.settings?.enabled !== false ? 'checked' : ''}>
                        <label for="enabled-${post.id}" class="checkbox-label">Активен</label>
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

function addPostButtonRow(postId) {
    const list = document.getElementById('buttons-list-' + postId);
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'button-row';
    row.innerHTML = `
        <input type="text" class="form-input btn-text" placeholder="Текст кнопки">
        <input type="url" class="form-input btn-url" placeholder="https://...">
        <button type="button" class="btn btn-small btn-danger btn-remove-row">×</button>
    `;
    row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
    list.appendChild(row);
}

function collectFormButtons(form) {
    const list = form.querySelector('.buttons-list');
    if (!list) return [];
    const rows = list.querySelectorAll('.button-row');
    const out = [];
    rows.forEach(row => {
        const text = (row.querySelector('.btn-text') || {}).value;
        const url = (row.querySelector('.btn-url') || {}).value;
        if (text && url) out.push({ text: text.trim(), url: url.trim() });
    });
    return out;
}

async function saveSettings(event, postId) {
    event.preventDefault();
    const form = event.target;
    const codeWord = form.codeWord.value;
    let redirectUrl = form.redirectUrl.value;
    if (!redirectUrl && telegramBotInfo?.botUsername) {
        redirectUrl = `https://t.me/${telegramBotInfo.botUsername}?start=${encodeURIComponent(codeWord)}`;
    }
    const mediaType = (form.telegramMediaType && form.telegramMediaType.value) || '';
    const mediaUrl = (form.telegramMediaUrl && form.telegramMediaUrl.value && form.telegramMediaUrl.value.trim()) || '';
    const telegramMedia = mediaType && mediaUrl ? { type: mediaType, url: mediaUrl } : null;
    const telegramButtons = collectFormButtons(form);
    const data = {
        codeWord,
        commentReply: form.commentReply.value,
        directReply: form.directReply.value,
        redirectUrl,
        telegramMessage: form.telegramMessage.value,
        enabled: form.enabled.checked,
        telegramMedia,
        telegramButtons,
    };
    try {
        const res = await fetch(ADMIN_BASE + `/api/posts/${postId}/settings`, {
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
        const res = await fetch(ADMIN_BASE + `/api/posts/${postId}/settings`, {
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
    await fetch(ADMIN_BASE + '/api/logout', { method: 'POST', credentials: 'include' });
    window.location.href = ADMIN_BASE + '/login';
});

document.getElementById('word-form')?.addEventListener('submit', saveWord);
document.getElementById('word-add-button')?.addEventListener('click', () => addWordButtonRow());

document.getElementById('word-media-file')?.addEventListener('change', async function() {
    const file = this.files?.[0];
    const urlInput = document.getElementById('word-media-url');
    const status = document.getElementById('word-media-status');
    urlInput.value = '';
    status.textContent = '';
    if (!file) return;
    status.textContent = 'Загрузка...';
    const fd = new FormData();
    fd.append('file', file);
    try {
        const res = await fetch(ADMIN_BASE + '/api/upload', {
            method: 'POST',
            body: fd,
            credentials: 'include',
        });
        const data = await res.json();
        if (data.url) {
            urlInput.value = data.url;
            status.textContent = 'Загружено: ' + file.name;
            status.style.color = '';
        } else {
            status.textContent = data.error || 'Ошибка загрузки';
            status.style.color = 'var(--danger)';
        }
    } catch (e) {
        status.textContent = 'Ошибка: ' + e.message;
        status.style.color = 'var(--danger)';
    }
});
document.getElementById('posts-container')?.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-remove-row')) {
        const row = e.target.closest('.button-row');
        if (row) row.remove();
    }
});

document.getElementById('posts-container')?.addEventListener('change', async function(e) {
    const input = e.target;
    if (!input.classList.contains('media-file-input')) return;
    const file = input.files?.[0];
    const form = input.closest('form');
    const urlInput = form?.querySelector('input[name="telegramMediaUrl"]');
    const status = form?.querySelector('.media-file-status');
    if (!urlInput || !form) return;
    urlInput.value = '';
    if (status) status.textContent = '';
    if (!file) return;
    if (status) status.textContent = 'Загрузка...';
    const fd = new FormData();
    fd.append('file', file);
    try {
        const res = await fetch(ADMIN_BASE + '/api/upload', { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        if (data.url) {
            urlInput.value = data.url;
            if (status) { status.textContent = 'Загружено: ' + file.name; status.style.color = ''; }
        } else {
            if (status) { status.textContent = data.error || 'Ошибка'; status.style.color = 'var(--danger)'; }
        }
    } catch (err) {
        if (status) { status.textContent = 'Ошибка: ' + err.message; status.style.color = 'var(--danger)'; }
    }
});

loadTelegramInfo().then(() => {
    loadWords();
    loadPosts();
    setInterval(loadWords, 30000);
    setInterval(loadPosts, 30000);
});

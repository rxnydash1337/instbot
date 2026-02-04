let telegramBotInfo = null;

async function loadTelegramInfo() {
    try {
        const response = await fetch('/api/telegram/info', { credentials: 'include' });
        telegramBotInfo = await response.json();
        
        const infoDiv = document.getElementById('telegram-info');
        const statusSpan = document.getElementById('bot-status');
        
        if (telegramBotInfo?.available) {
            infoDiv.style.display = 'block';
            infoDiv.style.background = '#e8f5e9';
            statusSpan.innerHTML = `✅ Настроен: <a href="${telegramBotInfo.botUrl}" target="_blank">@${telegramBotInfo.botUsername}</a>`;
        } else {
            infoDiv.style.display = 'block';
            infoDiv.style.background = '#ffebee';
            statusSpan.innerHTML = '❌ Telegram бот не настроен. Укажите TELEGRAM_BOT_TOKEN в .env файле.';
        }
    } catch (error) {
        console.error('Ошибка загрузки информации о Telegram боте:', error);
    }
}

async function loadPosts() {
    try {
        const response = await fetch('/api/posts', { credentials: 'include' });
        const posts = await response.json();
        renderPosts(posts);
    } catch (error) {
        document.getElementById('posts-container').innerHTML =
            '<div style="color: red;">Ошибка загрузки постов: ' + error.message + '</div>';
    }
}

function renderPosts(posts) {
    const container = document.getElementById('posts-container');
    if (posts.length === 0) {
        container.innerHTML = '<div>Посты не найдены</div>';
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="post-card">
            <div class="post-header">
                <div>
                    <div class="post-id">ID: ${post.id}</div>
                    <div class="post-caption">${post.caption || 'Без описания'}</div>
                    <a href="${post.permalink}" target="_blank" class="post-link">Открыть в Instagram</a>
                </div>
                <span class="status ${post.settings?.enabled ? 'active' : post.settings ? 'inactive' : 'none'}">
                    ${post.settings?.enabled ? 'Активен' : post.settings ? 'Неактивен' : 'Не настроен'}
                </span>
            </div>
            <form class="settings-form" onsubmit="saveSettings(event, '${post.id}')">
                <div class="section instagram">
                    <h3>Instagram</h3>
                    <div class="form-group">
                        <label>Кодовое слово *</label>
                        <input type="text" name="codeWord" value="${post.settings?.codeWord || ''}" required placeholder="Например: SECRET123">
                    </div>
                    <div class="form-group">
                        <label>Ответ на комментарий</label>
                        <textarea name="commentReply">${post.settings?.commentReply || 'напиши в директ!'}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Ответ в директ</label>
                        <textarea name="directReply">${post.settings?.directReply || 'Спасибо за интерес! Нажми на кнопку ниже, чтобы получить инструкцию.'}</textarea>
                    </div>
                </div>
                <div class="section telegram">
                    <h3>Telegram — контент для кодового слова</h3>
                    <p class="section-hint">Сообщение, которое получит пользователь при переходе по ссылке t.me/bot?start=КОДОВОЕ_СЛОВО</p>
                    <div class="form-group">
                        <label>Сообщение в Telegram</label>
                        <textarea name="telegramMessage" placeholder="Инструкция, офер, ссылка...">${post.settings?.telegramMessage || 'Привет! Вот инструкция для тебя.'}</textarea>
                    </div>
                    <div class="form-group">
                        <label>URL редиректа</label>
                        <input type="url" name="redirectUrl" value="${post.settings?.redirectUrl || ''}" placeholder="Авто: t.me/бот?start=код">
                        ${telegramBotInfo?.available ? `<small>Бот: @${telegramBotInfo.botUsername}</small>` : ''}
                    </div>
                </div>
                <div class="form-group checkbox-group">
                    <input type="checkbox" name="enabled" id="enabled-${post.id}" ${post.settings?.enabled !== false ? 'checked' : ''}>
                    <label for="enabled-${post.id}" style="margin: 0;">Активирован</label>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button type="submit">Сохранить</button>
                    ${post.settings ? '<button type="button" class="delete" onclick="deleteSettings(\'' + post.id + '\')">Удалить</button>' : ''}
                </div>
            </form>
        </div>
    `).join('');
}

async function saveSettings(event, postId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const codeWord = formData.get('codeWord');
    
    // Автоматически формируем URL если не указан и есть Telegram бот
    let redirectUrl = formData.get('redirectUrl');
    if (!redirectUrl && telegramBotInfo?.available) {
        redirectUrl = `${telegramBotInfo.botUrl}?start=${encodeURIComponent(codeWord)}`;
    }
    
    const data = {
        codeWord,
        commentReply: formData.get('commentReply'),
        directReply: formData.get('directReply'),
        redirectUrl,
        telegramMessage: formData.get('telegramMessage'),
        enabled: formData.get('enabled') === 'on',
    };

    try {
        const response = await fetch(`/api/posts/${postId}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include',
        });

        const result = await response.json();
        if (result.success) {
            alert('Настройки сохранены!');
            loadPosts();
        } else {
            alert('Ошибка: ' + result.error);
        }
    } catch (error) {
        alert('Ошибка сохранения: ' + error.message);
    }
}

async function deleteSettings(postId) {
    if (!confirm('Удалить настройки для этого поста?')) return;

    try {
        const response = await fetch(`/api/posts/${postId}/settings`, {
            method: 'DELETE',
            credentials: 'include',
        });

        const result = await response.json();
        if (result.success) {
            alert('Настройки удалены!');
            loadPosts();
        } else {
            alert('Ошибка: ' + result.error);
        }
    } catch (error) {
        alert('Ошибка удаления: ' + error.message);
    }
}

// Загружаем информацию о Telegram боте и посты при загрузке страницы
loadTelegramInfo().then(() => {
    loadPosts();
    // Обновляем каждые 30 секунд
    setInterval(loadPosts, 30000);
});


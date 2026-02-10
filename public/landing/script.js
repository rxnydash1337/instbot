const JOIN_ENDPOINT = '/api/landing/join';

async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (data) options.body = JSON.stringify(data);
        const response = await fetch(endpoint, options);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return await response.json();
    } catch (e) {
        console.error('API Error:', e);
        return null;
    }
}

function openTariffModal() {
    const modal = document.getElementById('tariff-modal');
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeTariffModal() {
    const modal = document.getElementById('tariff-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function setupTariffModal() {
    const modal = document.getElementById('tariff-modal');
    const overlay = document.getElementById('tariff-modal-overlay');
    const closeBtn = document.getElementById('tariff-modal-close');
    if (!modal || !overlay) return;

    // Открытие по кнопкам «Присоединиться к курсу»
    document.querySelectorAll('[id^="join-button"]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            openTariffModal();
        });
    });

    // Закрытие по оверлею и кнопке
    overlay.addEventListener('click', closeTariffModal);
    if (closeBtn) closeBtn.addEventListener('click', closeTariffModal);

    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) closeTariffModal();
    });

    // Оплата по выбранному тарифу
    modal.querySelectorAll('.tariff-card__btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.tariff-card');
            if (!card) return;
            const amount = card.getAttribute('data-amount');
            const tariffId = card.getAttribute('data-tariff');
            const description = card.getAttribute('data-description') || '';
            if (!amount || Number(amount) <= 0) return;

            btn.disabled = true;
            btn.textContent = 'Переход к оплате...';
            const data = await apiCall(JOIN_ENDPOINT, 'POST', {
                amount: Number(amount),
                tariffId,
                description,
                timestamp: new Date().toISOString(),
            });
            btn.disabled = false;
            btn.textContent = 'Оплатить';

            if (data && data.redirect) {
                closeTariffModal();
                window.location.href = data.redirect;
            } else if (data && data.message) {
                alert(data.message);
            } else {
                alert('Не удалось создать платёж. Попробуйте позже.');
            }
        });
    });
}

function setupScrollReveal() {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                }
            });
        },
        { rootMargin: '0px 0px -60px 0px', threshold: 0.1 }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
    setupTariffModal();
    setupScrollReveal();
});

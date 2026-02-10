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

function setupJoinButtons() {
    document.querySelectorAll('[id^="join-button"]').forEach(button => {
        button.addEventListener('click', async () => {
            const data = await apiCall(button.getAttribute('data-endpoint') || JOIN_ENDPOINT, 'POST', {
                timestamp: new Date().toISOString(),
            });
            if (data) {
                if (data.redirect) window.location.href = data.redirect;
                else if (data.message) alert(data.message);
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
    setupJoinButtons();
    setupScrollReveal();
});


// API Endpoints
const API_ENDPOINTS = {
    content: '/api/landing/content',
    join: '/api/landing/join',
    gift: '/api/landing/gift',
    reviews: '/api/landing/reviews',
    included: '/api/landing/included',
    forWhom: '/api/landing/for-whom',
    stats: '/api/landing/stats',
};

// Base API call function
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(endpoint, options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        return null;
    }
}

// Load main content
async function loadContent() {
    const data = await apiCall(API_ENDPOINTS.content);
    
    if (data) {
        // Update all elements with data-content attribute
        document.querySelectorAll('[data-content]').forEach(element => {
            const key = element.getAttribute('data-content');
            if (data[key]) {
                element.textContent = data[key];
            }
        });
    }
}

// Load gift content
async function loadGift() {
    const container = document.getElementById('gift-content');
    const data = await apiCall(API_ENDPOINTS.gift);
    
    if (data && container) {
        container.innerHTML = renderGift(data);
    }
}

function renderGift(data) {
    return `
        <div class="gift-item">
            <h3 class="gift-item-title">${data.title || ''}</h3>
            <p class="gift-item-desc">${data.description || ''}</p>
        </div>
    `;
}

// Load reviews
async function loadReviews() {
    const container = document.getElementById('reviews-container');
    const data = await apiCall(API_ENDPOINTS.reviews);
    
    if (data && container) {
        container.innerHTML = renderReviews(data);
    }
}

function renderReviews(data) {
    if (!data || !Array.isArray(data)) return '';
    
    return data.map(review => `
        <div class="review-card">
            <p class="review-text">${review.text || ''}</p>
            <p class="review-author">${review.author || ''}</p>
        </div>
    `).join('');
}

// Load included content
async function loadIncluded() {
    const container = document.getElementById('included-content');
    const data = await apiCall(API_ENDPOINTS.included);
    
    if (data && container) {
        container.innerHTML = renderIncluded(data);
    }
}

function renderIncluded(data) {
    if (!data || !Array.isArray(data)) return '';
    
    return data.map(item => `
        <div class="included-item">
            <h3 class="included-item-title">${item.title || ''}</h3>
            <p class="included-item-text">${item.description || ''}</p>
        </div>
    `).join('');
}

// Load for whom content
async function loadForWhom() {
    const container = document.getElementById('for-whom-content');
    const data = await apiCall(API_ENDPOINTS.forWhom);
    
    if (data && container) {
        container.innerHTML = renderForWhom(data);
    }
}

function renderForWhom(data) {
    if (!data || !Array.isArray(data)) return '';
    
    return data.map(item => `
        <div class="for-whom-item">
            <h3 class="for-whom-item-title">${item.title || ''}</h3>
            <p class="for-whom-item-text">${item.description || ''}</p>
        </div>
    `).join('');
}

// Load stats
async function loadStats() {
    const container = document.getElementById('stats-content');
    const data = await apiCall(API_ENDPOINTS.stats);
    
    if (data && container) {
        container.innerHTML = renderStats(data);
    }
}

function renderStats(data) {
    if (!data || !Array.isArray(data)) return '';
    
    return data.map(stat => `
        <div class="stat-item">
            <div class="stat-number">${stat.number || ''}</div>
            <div class="stat-label">${stat.label || ''}</div>
        </div>
    `).join('');
}

// Handle join button clicks
function setupJoinButtons() {
    document.querySelectorAll('[id^="join-button"]').forEach(button => {
        button.addEventListener('click', async () => {
            const endpoint = button.getAttribute('data-endpoint') || API_ENDPOINTS.join;
            const data = await apiCall(endpoint, 'POST', {
                timestamp: new Date().toISOString(),
            });
            
            if (data) {
                // Handle success (redirect, show modal, etc.)
                if (data.redirect) {
                    window.location.href = data.redirect;
                } else if (data.message) {
                    alert(data.message);
                }
            }
        });
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadContent();
    loadGift();
    loadReviews();
    loadIncluded();
    loadForWhom();
    loadStats();
    setupJoinButtons();
});


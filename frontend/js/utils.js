// Утилиты для работы с данными
export const AREA_NAMES = [
    "Осознание", "Стратегия", "Реинжиниринг", 
    "Проектирование", "Внедрение", "Методология", 
    "Отраслевые", "Soft skills"
];

// Санитизация HTML
export function sanitizeHTML(html) {
    return window.DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['a', 'strong', 'h3', 'br', 'span', 'div', 'p', 'ul', 'li'],
        ALLOWED_ATTR: ['href', 'target', 'style', 'class', 'id']
    });
}

// Форматирование даты
export function formatDate(timestamp) {
    if (!timestamp) return new Date().toLocaleString();
    return timestamp.toDate().toLocaleString();
}

// Валидация email
export function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Дебаунс для оптимизации
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Локальное хранилище с кэшированием
export const cache = {
    set(key, data, ttl = 300000) { // 5 минут по умолчанию
        const item = { data, expiry: Date.now() + ttl };
        localStorage.setItem(key, JSON.stringify(item));
    },
    get(key) {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const parsed = JSON.parse(item);
        if (Date.now() > parsed.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.data;
    },
    clear(key) {
        if (key) localStorage.removeItem(key);
        else localStorage.clear();
    }
};

// Rate limiter для API
export class RateLimiter {
    constructor(limit, window) {
        this.limit = limit;
        this.window = window;
        this.requests = [];
    }
    
    canMakeRequest() {
        const now = Date.now();
        this.requests = this.requests.filter(t => now - t < this.window);
        if (this.requests.length >= this.limit) return false;
        this.requests.push(now);
        return true;
    }
}

// Глобальный rate limiter для рекомендаций
export const recRateLimiter = new RateLimiter(3, 60000); // 3 запроса в минуту
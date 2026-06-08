import { currentUser, currentUserName, handleLogin, handleRegister, handleLogout } from './auth.js';
import { testState, testAreas, startTest, selectAnswer, nextQuestion, prevQuestion, getTotalQuestions, getAnsweredCount, getTestProgress, getCurrentQuestion, getTestProgress as getTestProgressFn } from './test.js';
import { selfState, SELF_ASSESSMENT_AREAS, startSelf, setSelfRating, nextSelf, prevSelf, getTotalSelf, getAnsweredSelf, getSelfProgress, getCurrentSelf, getCurrentRating } from './self.js';
import { userResults, getAllHistory, getLastTest, getLastSelf } from './history.js';
import { generateRec, isGeneratingRec } from './recommendations.js';
import { AREA_NAMES, sanitizeHTML } from './utils.js';

let currentTab = 'test';

export function render() {
    const app = document.getElementById('app');
    
    if (!currentUser) {
        if (currentTab === 'register') {
            app.innerHTML = renderRegister();
        } else {
            app.innerHTML = renderLogin();
        }
        attachLoginHandlers();
        return;
    }
    
    let html = `<div class="container">
        <div class="nav-bar">
            <button class="nav-item ${currentTab === 'test' ? 'active' : ''}" data-tab="test">
                <span>📝</span><span>Тестирование</span>
            </button>
            <button class="nav-item ${currentTab === 'self' ? 'active' : ''}" data-tab="self">
                <span>📊</span><span>Самооценка</span>
            </button>
            <button class="nav-item ${currentTab === 'rec' ? 'active' : ''}" data-tab="rec">
                <span>⭐</span><span>Рекомендации</span>
            </button>
            <button class="nav-item ${currentTab === 'history' ? 'active' : ''}" data-tab="history">
                <span>📜</span><span>История</span>
            </button>
            <button class="nav-item ${currentTab === 'profile' ? 'active' : ''}" data-tab="profile">
                <span>👤</span><span>Профиль</span>
            </button>
        </div>`;
    
    if (currentTab === 'test') {
        if (testState.isActive) {
            html += renderTestTaking();
        } else if (testState.result) {
            html += renderTestResult();
        } else {
            html += renderTestDashboard();
        }
    } else if (currentTab === 'self') {
        if (selfState.isActive) {
            html += renderSelfTaking();
        } else if (selfState.result) {
            html += renderSelfResult();
        } else {
            html += renderSelfDashboard();
        }
    } else if (currentTab === 'rec') {
        html += renderRecommendations();
    } else if (currentTab === 'history') {
        html += renderHistory();
    } else if (currentTab === 'profile') {
        html += renderProfile();
    }
    
    app.innerHTML = html + `</div>`;
    attachEventHandlers();
}

function renderLogin() {
    return `<div class="container">
        <div class="card text-center">
            <div style="font-size:60px">🎓</div>
            <h1>CSM 2.0</h1>
            <p style="color:#666;margin-bottom:30px">Система оценки компетенций</p>
            <div class="input-group">
                <label>Email</label>
                <input id="loginEmail" type="email" placeholder="your@email.com">
            </div>
            <div class="input-group">
                <label>Пароль</label>
                <input id="loginPassword" type="password" placeholder="••••••">
            </div>
            <button class="btn btn-primary" id="loginBtn">Войти</button>
            <p style="margin-top:20px">
                Нет аккаунта? 
                <button class="btn-secondary" style="display:inline-block;width:auto;padding:5px 15px" id="showRegisterBtn">Регистрация</button>
            </p>
        </div>
    </div>`;
}

function renderRegister() {
    return `<div class="container">
        <div class="card text-center">
            <div style="font-size:60px">📝</div>
            <h1>Регистрация</h1>
            <div class="input-group">
                <label>ФИО</label>
                <input id="regName" placeholder="Иван Иванов">
            </div>
            <div class="input-group">
                <label>Email</label>
                <input id="regEmail" type="email" placeholder="ivan@example.com">
            </div>
            <div class="input-group">
                <label>Пароль</label>
                <input id="regPassword" type="password" placeholder="минимум 6 символов">
            </div>
            <div class="input-group">
                <label>Подтвердите</label>
                <input id="regConfirm" type="password" placeholder="повторите пароль">
            </div>
            <button class="btn btn-primary" id="registerBtn">Зарегистрироваться</button>
            <p style="margin-top:20px">
                Уже есть аккаунт? 
                <button class="btn-secondary" style="display:inline-block;width:auto;padding:5px 15px" id="showLoginBtn">Войти</button>
            </p>
        </div>
    </div>`;
}

function renderTestDashboard() {
    return `<div class="card text-center">
        <div style="font-size:60px">📝</div>
        <h1>Тестирование CSM 2.0</h1>
        <p style="color:#666;margin-bottom:20px">Проверка знаний по 8 областям компетенций</p>
        <div class="info-box">
            <div class="info-box-title">📚 Что вас ждет?</div>
            <div class="info-text">
                • 8 областей компетенций<br>
                • Тестовые вопросы с вариантами ответов<br>
                • Мгновенный результат по каждой области<br>
                • Персональные рекомендации
            </div>
        </div>
        <button class="btn btn-primary" id="startTestBtn">▶ Начать тестирование</button>
    </div>`;
}

function renderTestTaking() {
    const q = getCurrentQuestion();
    const answer = testState.answers[q?.id];
    const area = testState.areas[testState.currentAreaIndex];
    
    if (!q) return '';
    
    return `<div class="card">
        <div class="progress-bar">
            <div class="progress-fill" style="width:${getTestProgressFn()}%"></div>
        </div>
        <div class="justify-between flex" style="margin-bottom:16px">
            <span><strong>${area.name}</strong></span>
            <span>${testState.currentQuestionIndex + 1}/${area.questions.length}</span>
        </div>
        <div class="question-card">
            <div class="question-text">${escapeHtml(q.text)}</div>
            ${q.options.map(opt => `
                <div class="option ${answer === opt ? 'selected' : ''}" data-answer="${escapeHtml(opt)}">
                    <div class="option-radio"></div>
                    <span>${escapeHtml(opt)}</span>
                </div>
            `).join('')}
        </div>
        <div class="flex" style="gap:8px">
            ${(testState.currentQuestionIndex > 0 || testState.currentAreaIndex > 0) ? 
                `<button class="btn btn-secondary" id="prevBtn">← Назад</button>` : ''}
            <div style="flex:1"></div>
            <button class="btn btn-primary" id="nextBtn" ${!answer ? 'disabled style="opacity:0.5"' : ''}>
                ${testState.currentAreaIndex === testState.areas.length - 1 && testState.currentQuestionIndex === area.questions.length - 1 ? 'Завершить →' : 'Далее →'}
            </button>
        </div>
    </div>`;
}

function renderTestResult() {
    const r = testState.result;
    const deg = (r.overallScore / 100) * 360;
    
    return `<div class="card text-center">
        <h1>📊 Результаты теста</h1>
        <div class="score-circle" style="background:conic-gradient(#667eea ${deg}deg,#e9ecef 0deg)">
            <div class="score-text">${r.overallScore}%</div>
        </div>
        ${r.areaScores.map((s, i) => `
            <div style="margin-bottom:16px">
                <div class="justify-between flex">
                    <span>${AREA_NAMES[i]}</span>
                    <span>${s}%</span>
                </div>
                <div class="progress-bar" style="height:6px">
                    <div class="progress-fill" style="width:${s}%"></div>
                </div>
            </div>
        `).join('')}
        <div class="info-box">
            <div class="info-box-title">💡 Рекомендации</div>
            <div class="info-text">${r.recommendations || "Рекомендации будут доступны после генерации"}</div>
        </div>
        <div class="flex" style="gap:8px">
            <button class="btn btn-secondary" id="restartTestBtn">Пройти заново</button>
            <button class="btn btn-primary" id="backToDashboardBtn">На главную</button>
        </div>
    </div>`;
}

function renderSelfDashboard() {
    return `<div class="card text-center">
        <div style="font-size:60px">📊</div>
        <h1>Самооценка компетенций CSM 2.0</h1>
        <p style="color:#666;margin-bottom:20px">Оцените свои навыки по 8 областям от 1 до 10</p>
        <div class="info-box">
            <div class="info-box-title">📌 Что означают оценки?</div>
            <div class="info-text" style="text-align:left">
                • 1-2 — Не знаю / Слышал термин<br>
                • 3-4 — Могу дать определение / Изучал теорию<br>
                • 5-6 — Применял под руководством / В простых ситуациях<br>
                • 7-8 — Применяю уверенно / В сложных задачах<br>
                • 9-10 — Могу обучать / Внедрял в масштабе банка
            </div>
        </div>
        <button class="btn btn-primary" id="startSelfBtn">▶ Начать самооценку</button>
    </div>`;
}

function renderSelfTaking() {
    const q = getCurrentSelf();
    const cur = getCurrentRating();
    const area = SELF_ASSESSMENT_AREAS[selfState.currentAreaIndex];
    
    return `<div class="card">
        <div class="progress-bar">
            <div class="progress-fill" style="width:${getSelfProgress()}%"></div>
        </div>
        <div class="justify-between flex" style="margin-bottom:16px">
            <span><strong>${area.name}</strong></span>
            <span>${selfState.currentQuestionIndex + 1}/${area.questions.length}</span>
        </div>
        <div class="question-card">
            <div class="question-text">${escapeHtml(q)}</div>
            <div class="rating-buttons">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => `
                    <button class="rating-btn ${cur === r ? 'selected' : ''}" data-rating="${r}">${r}</button>
                `).join('')}
            </div>
        </div>
        <div class="flex" style="gap:8px">
            ${(selfState.currentQuestionIndex > 0 || selfState.currentAreaIndex > 0) ? 
                `<button class="btn btn-secondary" id="prevSelfBtn">← Назад</button>` : ''}
            <div style="flex:1"></div>
            <button class="btn btn-primary" id="nextSelfBtn" ${!cur ? 'disabled style="opacity:0.5"' : ''}>
                ${selfState.currentAreaIndex === SELF_ASSESSMENT_AREAS.length - 1 && selfState.currentQuestionIndex === area.questions.length - 1 ? 'Завершить →' : 'Далее →'}
            </button>
        </div>
    </div>`;
}

function renderSelfResult() {
    const r = selfState.result;
    const deg = (r.overallScore / 10) * 360;
    
    return `<div class="card text-center">
        <h1>📊 Результаты самооценки</h1>
        <div class="score-circle" style="background:conic-gradient(#28a745 ${deg}deg,#e9ecef 0deg)">
            <div class="score-text" style="color:#28a745">${r.overallScore.toFixed(1)}</div>
        </div>
        <p>из 10</p>
        ${r.areaScores.map((s, i) => `
            <div style="margin-bottom:16px">
                <div class="justify-between flex">
                    <span>${AREA_NAMES[i]}</span>
                    <span>${s.toFixed(1)}</span>
                </div>
                <div class="progress-bar" style="height:6px">
                    <div class="progress-fill" style="width:${s * 10}%;background:#28a745"></div>
                </div>
            </div>
        `).join('')}
        <div class="info-box" style="background:#e8f5e9">
            <div class="info-box-title">💡 Рекомендации</div>
            <div class="info-text">${r.recommendations || "Рекомендации будут доступны после генерации"}</div>
        </div>
        <div class="flex" style="gap:8px">
            <button class="btn btn-secondary" id="restartSelfBtn">Пройти заново</button>
            <button class="btn btn-primary" id="backToSelfDashboardBtn">На главную</button>
        </div>
    </div>`;
}

function renderRecommendations() {
    if (isGeneratingRec) {
        return `<div class="card text-center">
            <div class="spinner"></div>
            <h1>⭐ Рекомендации</h1>
            <p style="color:#666;margin-top:16px">Генерируем персональные рекомендации...</p>
            <p style="font-size:12px;color:#666">⏳ Это может занять 20-30 секунд</p>
        </div>`;
    }
    
    if (userResults.recommendations.length === 0) {
        return `<div class="card text-center">
            <div style="font-size:60px">⭐</div>
            <h1>Рекомендации</h1>
            <p style="color:#666;margin-bottom:20px">Нет сохранённых рекомендаций</p>
            <button class="btn btn-primary" id="generateRecBtn">✨ Получить персональные рекомендации</button>
        </div>`;
    }
    
    return `<div class="card">
        <div class="justify-between flex" style="margin-bottom:20px">
            <h1>⭐ Рекомендации</h1>
            <button class="btn btn-primary" style="width:auto;padding:10px 20px" id="generateNewRecBtn">✨ Новые</button>
        </div>
        ${userResults.recommendations.map(rec => `
            <div class="history-item" data-rec-id="${rec.id}">
                <div class="justify-between flex">
                    <div>
                        <strong>${formatDate(rec.date)}</strong>
                        <p style="font-size:14px;color:#666;margin-top:5px">Персональные рекомендации по CSM 2.0</p>
                    </div>
                    <span style="font-size:20px">→</span>
                </div>
            </div>
        `).join('')}
    </div>
    <div id="recModal" class="modal">
        <div class="modal-content">
            <div class="justify-between flex">
                <h2>⭐ Рекомендации</h2>
                <button id="closeRecModalBtn" style="background:none;border:none;font-size:24px;cursor:pointer">✕</button>
            </div>
            <div id="recText" class="recommendation-text"></div>
        </div>
    </div>`;
}

function renderHistory() {
    const history = getAllHistory();
    
    if (history.length === 0) {
        return `<div class="card text-center">
            <div style="font-size:60px">📜</div>
            <h1>История</h1>
            <p style="color:#666">Нет результатов</p>
        </div>`;
    }
    
    return `<div class="card">
        <h1>📜 История результатов</h1>
        ${history.map(item => `
            <div class="history-item" data-history-id="${item.id}" data-history-type="${item.type}">
                <div class="justify-between flex">
                    <div>
                        <span style="font-size:20px;margin-right:10px">${item.icon}</span>
                        <strong>${item.typeName}</strong>
                        <p style="font-size:12px;color:#666">${formatDate(item.date)}</p>
                    </div>
                    <span style="font-size:20px;font-weight:bold;color:${item.type === 'test' ? '#667eea' : '#28a745'}">
                        ${item.displayScore}
                    </span>
                </div>
            </div>
        `).join('')}
    </div>
    <div id="historyModal" class="modal">
        <div class="modal-content">
            <div class="justify-between flex">
                <h2 id="modalTitle">Детали</h2>
                <button id="closeHistoryModalBtn" style="background:none;border:none;font-size:24px;cursor:pointer">✕</button>
            </div>
            <div id="modalContent"></div>
        </div>
    </div>`;
}

function renderProfile() {
    return `<div class="card text-center">
        <div style="font-size:80px">👤</div>
        <h1>${escapeHtml(currentUserName)}</h1>
        <p style="color:#666;margin-bottom:30px">${currentUser?.email || ''}</p>
        <div class="info-box">
            <div class="info-box-title">📊 Статистика</div>
            <div class="info-text">
                • Тестов: ${userResults.testResults.length}<br>
                • Самооценок: ${userResults.selfResults.length}<br>
                • Рекомендаций: ${userResults.recommendations.length}
            </div>
        </div>
        <button class="btn btn-danger" id="logoutBtn">🚪 Выйти</button>
    </div>`;
}

function attachLoginHandlers() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    
    if (loginBtn) {
        loginBtn.onclick = () => {
            const email = document.getElementById('loginEmail')?.value;
            const pwd = document.getElementById('loginPassword')?.value;
            if (email && pwd) handleLogin(email, pwd);
        };
    }
    
    if (registerBtn) {
        registerBtn.onclick = () => {
            const name = document.getElementById('regName')?.value;
            const email = document.getElementById('regEmail')?.value;
            const pwd = document.getElementById('regPassword')?.value;
            const confirm = document.getElementById('regConfirm')?.value;
            if (pwd !== confirm) alert('Пароли не совпадают');
            else handleRegister(email, pwd, name);
        };
    }
    
    if (showRegisterBtn) {
        showRegisterBtn.onclick = () => { currentTab = 'register'; render(); };
    }
    
    if (showLoginBtn) {
        showLoginBtn.onclick = () => { currentTab = 'login'; render(); };
    }
}

function attachEventHandlers() {
    // Навигация
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
        btn.onclick = () => { currentTab = btn.dataset.tab; render(); };
    });
    
    // Тестирование
    const startTestBtn = document.getElementById('startTestBtn');
    if (startTestBtn) startTestBtn.onclick = () => startTest();
    
    const restartTestBtn = document.getElementById('restartTestBtn');
    if (restartTestBtn) restartTestBtn.onclick = () => startTest();
    
    const backToDashboardBtn = document.getElementById('backToDashboardBtn');
    if (backToDashboardBtn) backToDashboardBtn.onclick = () => { testState.result = null; render(); };
    
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) nextBtn.onclick = () => nextQuestion();
    
    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) prevBtn.onclick = () => prevQuestion();
    
    // Обработка выбора ответов
    document.querySelectorAll('.option').forEach(opt => {
        opt.onclick = () => {
            const answer = opt.dataset.answer;
            const q = getCurrentQuestion();
            if (q) selectAnswer(q.id, answer);
            render();
        };
    });
    
    // Самооценка
    const startSelfBtn = document.getElementById('startSelfBtn');
    if (startSelfBtn) startSelfBtn.onclick = () => startSelf();
    
    const restartSelfBtn = document.getElementById('restartSelfBtn');
    if (restartSelfBtn) restartSelfBtn.onclick = () => startSelf();
    
    const backToSelfDashboardBtn = document.getElementById('backToSelfDashboardBtn');
    if (backToSelfDashboardBtn) backToSelfDashboardBtn.onclick = () => { selfState.result = null; render(); };
    
    const nextSelfBtn = document.getElementById('nextSelfBtn');
    if (nextSelfBtn) nextSelfBtn.onclick = () => nextSelf();
    
    const prevSelfBtn = document.getElementById('prevSelfBtn');
    if (prevSelfBtn) prevSelfBtn.onclick = () => prevSelf();
    
    document.querySelectorAll('.rating-btn').forEach(btn => {
        btn.onclick = () => {
            const rating = parseInt(btn.dataset.rating);
            setSelfRating(selfState.currentAreaIndex, selfState.currentQuestionIndex, rating);
            render();
        };
    });
    
    // Рекомендации
    const generateRecBtn = document.getElementById('generateRecBtn');
    if (generateRecBtn) generateRecBtn.onclick = () => { generateRec(); render(); };
    
    const generateNewRecBtn = document.getElementById('generateNewRecBtn');
    if (generateNewRecBtn) generateNewRecBtn.onclick = () => { generateRec(); render(); };
    
    document.querySelectorAll('.history-item[data-rec-id]').forEach(item => {
        item.onclick = () => showRecModal(item.dataset.recId);
    });
    
    const closeRecModalBtn = document.getElementById('closeRecModalBtn');
    if (closeRecModalBtn) closeRecModalBtn.onclick = () => closeRecModal();
    
    // История
    document.querySelectorAll('.history-item[data-history-id]').forEach(item => {
        item.onclick = () => showHistoryModal(item.dataset.historyId, item.dataset.historyType);
    });
    
    const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
    if (closeHistoryModalBtn) closeHistoryModalBtn.onclick = () => closeHistoryModal();
    
    // Профиль
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = () => handleLogout();
}

function showRecModal(id) {
    const rec = userResults.recommendations.find(r => r.id == id);
    if (!rec) return;
    
    let text = rec.text;
    
    // Преобразуем markdown ссылки
    text = text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#667eea;text-decoration:underline;">$1</a>');
    
    // Заголовки
    text = text.replace(/^### (.+)$/gm, '<h3 style="margin:16px 0 8px;color:#444;">$1</h3>');
    text = text.replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>');
    
    // Жирный текст
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Звёздочки
    text = text.replace(/★/g, '<span style="color:#f5a623;">★</span>');
    text = text.replace(/☆/g, '<span style="color:#ddd;">☆</span>');
    
    // Переносы строк
    text = text.replace(/\n/g, '<br>');
    
    const modal = document.getElementById('recModal');
    const recText = document.getElementById('recText');
    if (modal && recText) {
        recText.innerHTML = `<p style="color:#666;margin-bottom:16px">📅 ${formatDate(rec.date)}</p>${sanitizeHTML(text)}`;
        modal.classList.add('active');
    }
}

function closeRecModal() {
    const modal = document.getElementById('recModal');
    if (modal) modal.classList.remove('active');
}

function showHistoryModal(id, type) {
    let item = type === 'test' 
        ? userResults.testResults.find(r => r.id === id)
        : userResults.selfResults.find(r => r.id === id);
    
    if (!item) return;
    
    const modal = document.getElementById('historyModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');
    
    if (modal && title && content) {
        title.innerText = type === 'test' ? 'Результат теста' : 'Результат самооценки';
        
        content.innerHTML = `
            <p style="color:#666;margin-bottom:16px">${formatDate(item.date)}</p>
            <div class="text-center" style="margin-bottom:20px">
                <span style="font-size:36px;font-weight:bold;color:${type === 'test' ? '#667eea' : '#28a745'}">
                    ${type === 'test' ? item.overallScore + '%' : item.overallScore.toFixed(1) + '/10'}
                </span>
            </div>
            <h3>Детали:</h3>
            ${item.areaScores.map((s, i) => `
                <div style="margin-bottom:12px">
                    <div class="justify-between flex">
                        <span>${AREA_NAMES[i]}</span>
                        <span>${type === 'test' ? s + '%' : s.toFixed(1)}</span>
                    </div>
                    <div class="progress-bar" style="height:4px">
                        <div class="progress-fill" style="width:${type === 'test' ? s : s * 10}%"></div>
                    </div>
                </div>
            `).join('')}
            <div class="info-box" style="margin-top:20px">
                <div class="info-box-title">💡 Рекомендации</div>
                <div class="info-text">${item.recommendations || "Рекомендации не сгенерированы"}</div>
            </div>
        `;
        
        modal.classList.add('active');
    }
}

function closeHistoryModal() {
    const modal = document.getElementById('historyModal');
    if (modal) modal.classList.remove('active');
}

function formatDate(date) {
    if (!date) return new Date().toLocaleString();
    if (typeof date === 'string') return date;
    return date.toLocaleString();
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
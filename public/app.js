const API_URL = '/api'; // Relative path for mobile/network visibility
let ws;
let currentQuiz = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let startTime = null;
let quizTimerInterval;
let quizTimeSeconds = 0;
let currentLanguage = 'en';  // Quiz content language (questions, options)
let currentUILanguage = localStorage.getItem('uiLanguage') || 'en';  // UI labels language

// -- Views --
const views = {
    home: document.getElementById('home-view'),
    lobby: document.getElementById('lobby-view'),
    quiz: document.getElementById('quiz-view'),
    result: document.getElementById('result-view')
};

// -- UI Language & Translation --
function applyUILanguage(lang) {
    currentUILanguage = lang;
    localStorage.setItem('uiLanguage', lang);

    // Set HTML dir and lang attributes
    document.documentElement.setAttribute('dir', isRTL(lang) ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);

    // Update app title
    document.querySelector('header h1').textContent = t('app_title', lang);

    // Update all static text elements that should always be translated
    updateStaticUIText();
}

function updateStaticUIText() {
    // Home view
    const homeTitle = document.querySelector('#home-view h2');
    if (homeTitle) homeTitle.textContent = t('available_quizzes', currentUILanguage);

    // Lobby view
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) backBtn.textContent = '← ' + t('back_to_quizzes', currentUILanguage);

    const leaderboardBtn = document.getElementById('view-leaderboard-btn');
    if (leaderboardBtn) leaderboardBtn.textContent = '🏆 ' + t('leaderboard', currentUILanguage);

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) shareBtn.textContent = t('share_whatsapp', currentUILanguage) + ' 📱';

    const peopleWaitingText = document.querySelector('.participant-count-box');
    if (peopleWaitingText) {
        const count = document.getElementById('participant-count').textContent;
        peopleWaitingText.innerHTML = `<span class="dot"></span> <span id="participant-count">${count}</span> ${t('people_waiting', currentUILanguage)}`;
    }

    const joinFormInput = document.getElementById('username');
    if (joinFormInput) joinFormInput.placeholder = t('enter_name', currentUILanguage);

    const joinFormBtn = document.querySelector('#join-form button[type="submit"]');
    if (joinFormBtn) joinFormBtn.textContent = t('start_quiz', currentUILanguage);

    // Quiz view
    const quizTimerLabel = document.querySelector('.quiz-header');
    if (quizTimerLabel) {
        quizTimerLabel.innerHTML = `<div class="timer">${t('time', currentUILanguage)}: <span id="quiz-timer">00:00</span></div>`;
    }

    const questionNum = document.querySelector('.quiz-header .progress');
    if (questionNum) {
        const current = document.getElementById('current-q-num').textContent;
        const total = document.getElementById('total-q-num').textContent;
        questionNum.innerHTML = `${t('question', currentUILanguage)} <span id="current-q-num">${current}</span>/${t('of', currentUILanguage)} <span id="total-q-num">${total}</span>`;
    }

    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) hintBtn.textContent = '💡 ' + t('need_hint', currentUILanguage);

    // Result view
    const homeBtn = document.querySelector('#result-view .cta-btn.secondary');
    if (homeBtn && homeBtn.textContent === 'Home') {
        homeBtn.textContent = t('home', currentUILanguage);
    }

    const leaderboardTitle = document.querySelector('#result-view h3');
    if (leaderboardTitle) leaderboardTitle.textContent = t('leaderboard', currentUILanguage);
}

// Global function to change UI language
window.changeUILanguage = function(lang) {
    applyUILanguage(lang);
};

function switchView(viewName) {
    Object.values(views).forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('active');
}

// -- Init & Deep Linking --
window.addEventListener('DOMContentLoaded', async () => {
    // Apply saved UI language on load
    applyUILanguage(currentUILanguage);
    // Set the UI language selector to the saved value
    const uiLangSelect = document.getElementById('ui-language-select');
    if (uiLangSelect) uiLangSelect.value = currentUILanguage;

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('quizId');

    if (quizId) {
        // Fetch specific quiz details directly
        try {
            const res = await fetch(`${API_URL}/quizzes/${quizId}`);
            if (res.ok) {
                const quiz = await res.json();
                showLobby(quiz);
                return;
            } else {
                console.error("Quiz not found or access denied");
            }
        } catch (e) {
            console.error(e);
        }
    }

    // Default
    showHome();
});

// -- Home --
async function loadQuizzes() {
    try {
        const res = await fetch(`${API_URL}/quizzes`);
        const quizzes = await res.json();
        const list = document.getElementById('quiz-list');
        list.innerHTML = '';

        if (quizzes.length === 0) {
            list.innerHTML = `<p style="text-align:center;color:var(--text-secondary)">${t('no_quizzes', currentUILanguage)}</p>`;
        }

        quizzes.forEach(q => {
            // Interpret server time as UTC
            const start = new Date(q.start_time.endsWith('Z') ? q.start_time : q.start_time + 'Z');
            const end = q.end_time ? new Date(q.end_time.endsWith('Z') ? q.end_time : q.end_time + 'Z') : null;
            const now = new Date();
            const card = document.createElement('div');
            card.className = 'quiz-card';

            if (q.theme && q.theme.primaryColor) {
                card.style.borderColor = q.theme.primaryColor;
            }

            // Determine quiz status
            let statusBadge = '';
            let timeInfo = '';
            if (end && now > end) {
                statusBadge = `<span class="status-badge archived">${t('status_archived', currentUILanguage)}</span>`;
                timeInfo = `${t('ended', currentUILanguage)}: ${end.toLocaleString()}`;
            } else if (now < start) {
                statusBadge = `<span class="status-badge upcoming">${t('status_upcoming', currentUILanguage)}</span>`;
                timeInfo = `${t('starts', currentUILanguage)}: ${start.toLocaleString()}`;
            } else {
                statusBadge = `<span class="status-badge live">${t('status_live', currentUILanguage)}</span>`;
                timeInfo = `${t('started', currentUILanguage)}: ${start.toLocaleString()}`;
            }

            card.innerHTML = `
                <div class="quiz-content">
                    <h3>${q.title} ${statusBadge}</h3>
                    <div class="quiz-time">${timeInfo}</div>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em; color: var(--text-secondary);">${q.description || ''}</p>
                </div>
                ${q.image_url ? `<img src="${q.image_url}" class="quiz-list-img" alt="${q.title}">` : ''}
            `;
            card.onclick = () => showLobby(q);
            list.appendChild(card);
        });
    } catch (e) {
        console.error("Failed to load quizzes", e);
        document.getElementById('quiz-list').innerHTML = `<p>${t('error_loading_quizzes', currentUILanguage)}</p>`;
    }
}

function showHome() {
    if (ws) ws.close();
    resetTheme();
    // Clear URL params
    const url = new URL(window.location);
    url.search = '';
    window.history.pushState({}, '', url);

    switchView('home');
    loadQuizzes();
}

// -- Theming --
function applyTheme(theme) {
    const root = document.documentElement;
    const bg = document.querySelector('.app-background');

    if (theme) {
        if (theme.primaryColor) root.style.setProperty('--theme-primary', theme.primaryColor);
        if (theme.backgroundColor) {
            root.style.setProperty('--theme-bg', theme.backgroundColor);
            document.body.style.backgroundColor = theme.backgroundColor;
        }
        if (theme.backgroundImageUrl) {
            bg.style.backgroundImage = `url('${theme.backgroundImageUrl}')`;
            bg.style.opacity = '0.3';
        } else {
            bg.style.backgroundImage = 'none';
        }
    }
}

function resetTheme() {
    const root = document.documentElement;
    const bg = document.querySelector('.app-background');
    root.style.setProperty('--theme-primary', '#8b5cf6');
    root.style.setProperty('--theme-bg', '#0f172a');
    document.body.style.backgroundColor = '#0f172a';
    bg.style.backgroundImage = 'none';
}

// -- Lobby --
function showLobby(quiz) {
    currentQuiz = quiz;
    applyTheme(quiz.theme);

    // Set URL for Deep Linking
    const url = new URL(window.location);
    url.searchParams.set('quizId', quiz.id);
    window.history.pushState({}, '', url);

    // Check if quiz is archived
    const now = new Date();
    const tEnd = quiz.end_time;
    const end = tEnd ? new Date(tEnd.endsWith('Z') ? tEnd : tEnd + 'Z') : null;
    if (end && now > end) {
        // Show archived quiz in review mode
        showArchivedQuiz(quiz);
        return;
    }

    switchView('lobby');
    updateStaticUIText();  // Update UI text when showing lobby

    document.getElementById('lobby-quiz-title').textContent = quiz.title;
    document.getElementById('lobby-quiz-desc').textContent = quiz.description;

    // Show Image if exists
    const imgEl = document.getElementById('lobby-quiz-image');
    if (quiz.image_url) {
        imgEl.src = quiz.image_url;
        imgEl.classList.remove('hidden');
    } else {
        imgEl.classList.add('hidden');
    }

    // Update OG Image dynamically (client-side attempt)
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) {
        ogImage.content = quiz.image_url || '/logo.png';
    }

    document.getElementById('participant-count').textContent = '0';

    // Language Selector (for quiz content - questions, options)
    const sel = document.getElementById('language-select');
    sel.innerHTML = `<option value="en">${t('english_default', currentUILanguage)}</option>`;
    if (quiz.languages && quiz.languages.length > 1) {
        sel.classList.remove('hidden');
        quiz.languages.forEach(l => {
            if (l === 'en') return;
            const opt = document.createElement('option');
            opt.value = l;
            opt.textContent = getLangName(l);
            sel.appendChild(opt);
        });
    } else {
        sel.classList.add('hidden');
    }
    currentLanguage = 'en';

    // Reset Form
    const form = document.getElementById('join-form');
    form.classList.add('hidden');
    form.reset();

    checkSchedule();
    connectWS(quiz.id);
}

function connectWS(quizId) {
    if (ws) ws.close();
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${window.location.host}?quizId=${quizId}`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'count') {
            document.getElementById('participant-count').textContent = data.count;
        }
    };
}

let scheduleInterval;
function checkSchedule() {
    if (scheduleInterval) clearInterval(scheduleInterval);

    const update = () => {
        const now = new Date();
        // Interpret server time as UTC
        const startTime = currentQuiz.start_time;
        const start = new Date(startTime.endsWith('Z') ? startTime : startTime + 'Z');
        const diff = start - now;

        const timerEl = document.getElementById('time-remaining');
        const statusEl = document.getElementById('lobby-status');
        const form = document.getElementById('join-form');

        if (diff > 0) {
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            timerEl.textContent = `${t('starts_in', currentUILanguage)} ${minutes}m ${seconds}s`;
            statusEl.textContent = t('waiting_start', currentUILanguage);
            form.classList.add('hidden');
        } else {
            timerEl.textContent = t('event_started', currentUILanguage);
            statusEl.textContent = t('live_now', currentUILanguage);
            form.classList.remove('hidden');
            clearInterval(scheduleInterval);
        }
    };

    update();
    scheduleInterval = setInterval(update, 1000);
}

document.getElementById('join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    if (!username) return;

    try {
        const res = await fetch(`${API_URL}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quizId: currentQuiz.id, participantName: username })
        });

        const data = await res.json();
        if (res.ok) {
            startQuiz();
        } else {
            alert(data.error);
        }
    } catch (err) {
        console.error(err);
        alert(t('error_joining', currentUILanguage));
    }
});


// -- Quiz Logic --
async function startQuiz() {
    try {
        const res = await fetch(`${API_URL}/quiz/${currentQuiz.id}/questions`);
        if (!res.ok) {
            console.log("could not get questions for ", currentQuiz.id)
            throw new Error(await res.text());
        }

        currentQuestions = await res.json();
        currentQuestionIndex = 0;
        userAnswers = {};
        quizTimeSeconds = 0;

        if (currentQuestions.length == 0) {
            throw new Error(t('no_questions_configured', currentUILanguage));
        }

        switchView('quiz');
        requestAnimationFrame(() => renderQuestion());

        if (quizTimerInterval) clearInterval(quizTimerInterval);
        quizTimerInterval = setInterval(() => {
            quizTimeSeconds++;
            const m = Math.floor(quizTimeSeconds / 60).toString().padStart(2, '0');
            const s = (quizTimeSeconds % 60).toString().padStart(2, '0');
            document.getElementById('quiz-timer').textContent = `${m}:${s}`;
        }, 1000);

    } catch (err) {
        alert(t('could_not_load_questions', currentUILanguage) + ": " + err.message);
    }
}

function renderQuestion() {
    const q = currentQuestions[currentQuestionIndex];

    const currentQNumEl = document.getElementById('current-q-num');
    const totalQNumEl = document.getElementById('total-q-num');
    if (currentQNumEl) currentQNumEl.textContent = currentQuestionIndex + 1;
    if (totalQNumEl) totalQNumEl.textContent = currentQuestions.length;

    let qText = q.text;
    let qHint = q.hint;
    let qOptions = q.options;

    // Apply translation
    if (currentLanguage !== 'en' && q.translations && q.translations[currentLanguage]) {
        const translation = q.translations[currentLanguage];
        if (translation.text) qText = translation.text;
        if (translation.hint) qHint = translation.hint;
        if (translation.options) qOptions = translation.options;
    }

    const questionTextEl = document.getElementById('question-text');
    if (questionTextEl) {
        questionTextEl.textContent = qText;
    }

    // Image
    const imgEl = document.getElementById('question-image');
    if (imgEl) {
        if (q.image_url) {
            imgEl.src = q.image_url;
            imgEl.classList.remove('hidden');
        } else {
            imgEl.classList.add('hidden');
        }
    }

    // Hint
    const hintBtn = document.getElementById('hint-btn');
    const hintText = document.getElementById('hint-text');
    if (hintText) hintText.classList.add('hidden');

    if (qHint && hintBtn && hintText) {
        hintBtn.classList.remove('hidden');
        hintText.textContent = qHint;
        hintBtn.onclick = () => hintText.classList.toggle('hidden');
    } else {
        if (hintBtn) hintBtn.classList.add('hidden');
    }

    // Options
    const container = document.getElementById('options-container');
    if (!container) return;

    container.innerHTML = '';

    qOptions.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.onclick = () => selectOption(idx);
        container.appendChild(btn);
    });
}

function selectOption(idx) {
    const q = currentQuestions[currentQuestionIndex];
    userAnswers[q.id] = idx;

    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        finishQuiz();
    }
}

async function finishQuiz() {
    clearInterval(quizTimerInterval);
    const username = document.getElementById('username').value;

    try {
        const res = await fetch(`${API_URL}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quizId: currentQuiz.id,
                participantName: username,
                answers: userAnswers,
                timeTaken: quizTimeSeconds
            })
        });

        const result = await res.json();
        showResult(result.score, result.total);
    } catch (err) {
        alert(t('error_submitting', currentUILanguage));
    }
}

async function showResult(score, total) {
    switchView('result');

    // Show the score display section for normal quiz completion
    const scoreDisplay = document.querySelector('.score-display');
    if (scoreDisplay) {
        scoreDisplay.style.display = 'block';
    }

    // Update the title
    const resultTitle = document.querySelector('#result-view h2');
    if (resultTitle) {
        resultTitle.textContent = t('quiz_completed', currentUILanguage);
    }

    const scoreLabel = document.querySelector('.score-label');
    if (scoreLabel) {
        scoreLabel.textContent = t('your_score', currentUILanguage);
    }

    const homeBtn = document.querySelector('#result-view .cta-btn.secondary');
    if (homeBtn) {
        homeBtn.textContent = t('home', currentUILanguage);
        homeBtn.onclick = () => showHome();
    }

    const leaderboardTitle = document.querySelector('#result-view h3');
    if (leaderboardTitle) {
        leaderboardTitle.textContent = t('leaderboard', currentUILanguage);
    }

    document.getElementById('final-score').textContent = `${score}/${total}`;

    const res = await fetch(`${API_URL}/leaderboard/${currentQuiz.id}`);
    const leaders = await res.json();

    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';

    if (leaders.length === 0) {
        list.innerHTML = `<li>${t('no_participants', currentUILanguage)}</li>`;
    } else {
        leaders.forEach((l, i) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>#${i + 1} ${l.participant_name}</span>
                <span>${l.score} pts (${l.time_taken_seconds}s)</span>
            `;
            list.appendChild(li);
        });
    }
}

// -- Language & Share --
function changeLanguage(lang) {
    currentLanguage = lang;
    if (!views.quiz.classList.contains('hidden')) {
        renderQuestion();
    }
}

function getLangName(code) {
    const names = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', ur: 'اردو', fa: 'فارسی', hi: 'हिन्दी' };
    return names[code] || code.toUpperCase();
}

function shareQuiz() {
    const text = `Join me for the ${currentQuiz.title} quiz!`;
    const url = window.location.href;
    const fullUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
    window.open(fullUrl, '_blank');
}

// -- Archived Quiz Review --
async function showArchivedQuiz(quiz) {
    try {
        // Fetch questions
        const res = await fetch(`${API_URL}/quiz/${quiz.id}/questions`);
        if (!res.ok) throw new Error('Failed to load questions');

        currentQuestions = await res.json();
        currentQuestionIndex = 0;

        switchView('quiz');
        requestAnimationFrame(() => renderArchivedQuestion());
    } catch (err) {
        alert(t('could_not_load_archived', currentUILanguage) + ": " + err.message);
        showHome();
    }
}

function renderArchivedQuestion() {
    const q = currentQuestions[currentQuestionIndex];

    const currentQNumEl = document.getElementById('current-q-num');
    const totalQNumEl = document.getElementById('total-q-num');
    if (currentQNumEl) currentQNumEl.textContent = currentQuestionIndex + 1;
    if (totalQNumEl) totalQNumEl.textContent = currentQuestions.length;

    // Update timer
    const quizTimerEl = document.getElementById('quiz-timer');
    if (quizTimerEl) {
        quizTimerEl.textContent = t('status_archived', currentUILanguage);
    }

    // Handle image
    const imgEl = document.getElementById('question-image');
    if (imgEl) {
        if (q.image_url) {
            imgEl.src = q.image_url;
            imgEl.classList.remove('hidden');
        } else {
            imgEl.classList.add('hidden');
        }
    }

    // Hide hint button for archived mode
    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) hintBtn.classList.add('hidden');

    const hintText = document.getElementById('hint-text');
    if (hintText) hintText.classList.remove('hidden');

    // Use common rendering function
    const container = document.getElementById('options-container');
    if (!container) return;

    // Render the question with common function
    renderQuestion(q, currentLanguage, true, true, {
        questionText: document.getElementById('question-text'),
        hintText: hintText,
        optionsContainer: container
    });

    // Add navigation handlers to option buttons
    const buttons = container.querySelectorAll('.option-btn');
    buttons.forEach((btn, idx) => {
        btn.onclick = () => {
            if (currentQuestionIndex < currentQuestions.length - 1) {
                currentQuestionIndex++;
                renderArchivedQuestion();
            } else {
                showArchivedLeaderboard();
            }
        };
    });
}

async function showArchivedLeaderboard(leaders = null) {
    if (!leaders) {
        const res = await fetch(`${API_URL}/leaderboard/${currentQuiz.id}`);
        leaders = await res.json();
    }

    switchView('result');

    // Hide the score display section for archived quizzes
    const scoreDisplay = document.querySelector('.score-display');
    if (scoreDisplay) {
        scoreDisplay.style.display = 'none';
    }

    // Update the title
    const resultTitle = document.querySelector('#result-view h2');
    if (resultTitle) {
        resultTitle.textContent = t('archived_leaderboard', currentUILanguage);
    }

    const homeBtn = document.querySelector('#result-view .cta-btn.secondary');
    if (homeBtn) {
        homeBtn.textContent = t('home', currentUILanguage);
        homeBtn.onclick = () => showHome();
    }

    const leaderboardTitle = document.querySelector('#result-view h3');
    if (leaderboardTitle) {
        leaderboardTitle.textContent = t('leaderboard', currentUILanguage);
    }

    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';

    if (leaders.length === 0) {
        list.innerHTML = `<li>${t('no_participants', currentUILanguage)}</li>`;
    } else {
        leaders.forEach((l, i) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>#${i + 1} ${l.participant_name}</span>
                <span>${l.score} pts (${l.time_taken_seconds}s)</span>
            `;
            list.appendChild(li);
        });
    }
}

window.viewLobbyLeaderboard = async function () {
    if (!currentQuiz) return;

    try {
        const res = await fetch(`${API_URL}/leaderboard/${currentQuiz.id}`);
        const leaders = await res.json();

        switchView('result');

        // Hide score display since we are just viewing
        const scoreDisplay = document.querySelector('.score-display');
        if (scoreDisplay) scoreDisplay.style.display = 'none';

        // Update title
        const resultTitle = document.querySelector('#result-view h2');
        if (resultTitle) resultTitle.textContent = `${currentQuiz.title} - ${t('leaderboard', currentUILanguage)}`;

        // Update Back button behavior regarding where we came from?
        // actually showHome() is on the result view button.
        // We might want a "Back to Lobby" button if we came from lobby.
        // For now, the "Home" button is there. Let's change it to "Back" if we can, or just leave it.
        // The result view has: <button class="cta-btn secondary" onclick="showHome()">Home</button>
        // We can change this button's text or action temporarily.

        const homeBtn = document.querySelector('#result-view .cta-btn.secondary');
        if (homeBtn) {
            homeBtn.textContent = t('back_to_lobby', currentUILanguage);
            homeBtn.onclick = () => showLobby(currentQuiz);
        }

        const leaderboardTitle = document.querySelector('#result-view h3');
        if (leaderboardTitle) {
            leaderboardTitle.textContent = t('leaderboard', currentUILanguage);
        }

        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';

        if (leaders.length === 0) {
            list.innerHTML = `<li>${t('no_participants', currentUILanguage)}</li>`;
        } else {
            leaders.forEach((l, i) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>#${i + 1} ${l.participant_name}</span>
                    <span>${l.score} pts (${l.time_taken_seconds}s)</span>
                `;
                list.appendChild(li);
            });
        }

    } catch (e) {
        console.error(e);
        alert(t('failed_leaderboard', currentUILanguage));
    }
};

// -- History Navigation --
window.addEventListener('popstate', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (quizId) {
        location.reload();
    } else {
        window.showHome();
    }
});

// Make functions available globally for HTML onclick handlers
window.showHome = showHome;
window.changeLanguage = changeLanguage;
window.shareQuiz = shareQuiz;
window.viewLobbyLeaderboard = viewLobbyLeaderboard;

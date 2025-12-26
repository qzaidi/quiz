const API_URL = '/api'; // Relative path for mobile/network visibility
let ws;
let currentQuiz = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let startTime = null;
let quizTimerInterval;
let quizTimeSeconds = 0;
let currentLanguage = 'en';

// -- Views --
const views = {
    home: document.getElementById('home-view'),
    lobby: document.getElementById('lobby-view'),
    quiz: document.getElementById('quiz-view'),
    result: document.getElementById('result-view')
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
            list.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">No quizzes available.</p>';
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
                statusBadge = '<span class="status-badge archived">Archived</span>';
                timeInfo = `Ended: ${end.toLocaleString()}`;
            } else if (now < start) {
                statusBadge = '<span class="status-badge upcoming">Upcoming</span>';
                timeInfo = `Starts: ${start.toLocaleString()}`;
            } else {
                statusBadge = '<span class="status-badge live">Live</span>';
                timeInfo = `Started: ${start.toLocaleString()}`;
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
        document.getElementById('quiz-list').innerHTML = '<p>Error loading quizzes.</p>';
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

    // Language Selector
    const sel = document.getElementById('language-select');
    sel.innerHTML = '<option value="en">English (Default)</option>';
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
        const t = currentQuiz.start_time;
        const start = new Date(t.endsWith('Z') ? t : t + 'Z');
        const diff = start - now;

        const timerEl = document.getElementById('time-remaining');
        const statusEl = document.getElementById('lobby-status');
        const form = document.getElementById('join-form');

        if (diff > 0) {
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            timerEl.textContent = `Starts in ${minutes}m ${seconds}s`;
            statusEl.textContent = 'Waiting for start time...';
            form.classList.add('hidden');
        } else {
            timerEl.textContent = "Event Started!";
            statusEl.textContent = 'Live now';
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
        alert('Error joining quiz');
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
            throw new Error("No questions configured for this quiz");
        }

        switchView('quiz');
        renderQuestion();

        if (quizTimerInterval) clearInterval(quizTimerInterval);
        quizTimerInterval = setInterval(() => {
            quizTimeSeconds++;
            const m = Math.floor(quizTimeSeconds / 60).toString().padStart(2, '0');
            const s = (quizTimeSeconds % 60).toString().padStart(2, '0');
            document.getElementById('quiz-timer').textContent = `${m}:${s}`;
        }, 1000);

    } catch (err) {
        alert("Could not load questions: " + err.message);
    }
}

function renderQuestion() {
    const q = currentQuestions[currentQuestionIndex];
    document.getElementById('current-q-num').textContent = currentQuestionIndex + 1;
    document.getElementById('total-q-num').textContent = currentQuestions.length;

    let qText = q.text;
    let qHint = q.hint;
    let qOptions = q.options;

    // Apply translation
    if (currentLanguage !== 'en' && q.translations && q.translations[currentLanguage]) {
        const t = q.translations[currentLanguage];
        if (t.text) qText = t.text;
        if (t.hint) qHint = t.hint;
        if (t.options) qOptions = t.options;
    }

    document.getElementById('question-text').textContent = qText;

    // Image
    const imgEl = document.getElementById('question-image');
    if (q.image_url) {
        imgEl.src = q.image_url;
        imgEl.classList.remove('hidden');
    } else {
        imgEl.classList.add('hidden');
    }

    // Hint
    const hintBtn = document.getElementById('hint-btn');
    const hintText = document.getElementById('hint-text');
    hintText.classList.add('hidden');

    if (qHint) {
        hintBtn.classList.remove('hidden');
        hintText.textContent = qHint;
        hintBtn.onclick = () => hintText.classList.toggle('hidden');
    } else {
        hintBtn.classList.add('hidden');
    }

    // Options
    const container = document.getElementById('options-container');
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
        alert("Error submitting results");
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
        resultTitle.textContent = 'Quiz Completed!';
    }

    document.getElementById('final-score').textContent = `${score}/${total}`;

    const res = await fetch(`${API_URL}/leaderboard/${currentQuiz.id}`);
    const leaders = await res.json();

    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';

    leaders.forEach((l, i) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>#${i + 1} ${l.participant_name}</span>
            <span>${l.score} pts (${l.time_taken_seconds}s)</span>
        `;
        list.appendChild(li);
    });
}

// -- Language & Share --
function changeLanguage(lang) {
    currentLanguage = lang;
    if (!views.quiz.classList.contains('hidden')) {
        renderQuestion();
    }
}

function getLangName(code) {
    const names = { en: 'English', es: 'Spanish', fr: 'French', de: 'German' };
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
        renderArchivedQuestion();

        // Load leaderboard
        const lbRes = await fetch(`${API_URL}/leaderboard/${quiz.id}`);
        const leaders = await lbRes.json();

        // Show leaderboard in result view after questions
        setTimeout(() => {
            showArchivedLeaderboard(leaders);
        }, 10000);

    } catch (err) {
        alert("Could not load archived quiz: " + err.message);
        showHome();
    }
}

function renderArchivedQuestion() {
    const q = currentQuestions[currentQuestionIndex];
    document.getElementById('current-q-num').textContent = currentQuestionIndex + 1;
    document.getElementById('total-q-num').textContent = currentQuestions.length;

    let qText = q.text;
    let qHint = q.hint;
    let qOptions = q.options;

    // Apply translation
    if (currentLanguage !== 'en' && q.translations && q.translations[currentLanguage]) {
        const t = q.translations[currentLanguage];
        if (t.text) qText = t.text;
        if (t.hint) qHint = t.hint;
        if (t.options) qOptions = t.options;
    }

    document.getElementById('question-text').textContent = qText + ' (Archived - Review Only)';
    document.getElementById('quiz-timer').textContent = 'Archived';

    // Image
    const imgEl = document.getElementById('question-image');
    if (q.image_url) {
        imgEl.src = q.image_url;
        imgEl.classList.remove('hidden');
    } else {
        imgEl.classList.add('hidden');
    }

    // Hint
    const hintBtn = document.getElementById('hint-btn');
    const hintText = document.getElementById('hint-text');
    hintText.classList.remove('hidden');

    if (qHint) {
        hintBtn.classList.add('hidden');
        hintText.textContent = 'Hint: ' + qHint;
    } else {
        hintBtn.classList.add('hidden');
        hintText.classList.add('hidden');
    }

    // Options - show correct answer
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    qOptions.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        if (idx === q.correct_index) {
            btn.classList.add('correct-answer');
            btn.textContent = '✓ ' + opt + ' (Correct Answer)';
        } else {
            btn.textContent = opt;
            btn.style.opacity = '0.6';
        }
        btn.disabled = true;
        btn.style.cursor = 'default';

        // Navigate to next question on click
        if (currentQuestionIndex < currentQuestions.length - 1) {
            btn.onclick = () => {
                currentQuestionIndex++;
                renderArchivedQuestion();
            };
            btn.style.cursor = 'pointer';
        } else {
            btn.onclick = () => showArchivedLeaderboard();
        }

        container.appendChild(btn);
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
        resultTitle.textContent = 'Archived Quiz - Leaderboard';
    }

    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';

    if (leaders.length === 0) {
        list.innerHTML = '<li>No participants yet</li>';
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
        if (resultTitle) resultTitle.textContent = `${currentQuiz.title} - Leaderboard`;

        // Update Back button behavior regarding where we came from? 
        // actually showHome() is on the result view button. 
        // We might want a "Back to Lobby" button if we came from lobby.
        // For now, the "Home" button is there. Let's change it to "Back" if we can, or just leave it.
        // The result view has: <button class="cta-btn secondary" onclick="showHome()">Home</button>
        // We can change this button's text or action temporarily.

        const homeBtn = document.querySelector('#result-view .cta-btn.secondary');
        if (homeBtn) {
            homeBtn.textContent = 'Back to Lobby';
            homeBtn.onclick = () => showLobby(currentQuiz);
        }

        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';

        if (leaders.length === 0) {
            list.innerHTML = '<li>No participants yet</li>';
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
        alert('Failed to load leaderboard');
    }
};

// -- History Navigation --
window.addEventListener('popstate', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('quizId');
    if (quizId) {
        location.reload();
    } else {
        showHome();
    }
});

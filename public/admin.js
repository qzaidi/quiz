const API_URL = '/api';
let adminToken = localStorage.getItem('adminToken') || '';
let editingQuizId = null;
let addedLanguages = ['en'];
let quizzesTable, questionsTable;

// -- Views --
const views = {
    adminLogin: document.getElementById('admin-login-view'),
    adminDashboard: document.getElementById('admin-dashboard-view'),
    adminTables: document.getElementById('admin-tables-view')
};

function switchView(viewName) {
    Object.values(views).forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('active');
}

// Helper function to handle API errors
async function handleApiResponse(res, successMessage = null) {
    if (res.ok) {
        if (successMessage) alert(successMessage);
        return true;
    } else if (res.status === 401) {
        alert('Authentication failed. Please log in again.');
        logout();
        return false;
    } else {
        try {
            const error = await res.json();
            alert(`Error: ${error.error || error.message || 'Unknown error occurred'}`);
        } catch {
            alert(`Error: ${res.statusText || 'Request failed'}`);
        }
        return false;
    }
}

// -- Admin Login --
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = document.getElementById('admin-password').value;

    try {
        const res = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'x-admin-password': pwd }
        });

        if (res.ok) {
            adminToken = pwd;
            localStorage.setItem('adminToken', pwd);
            showAdminDashboard();
        } else {
            alert('Invalid Password');
        }
    } catch (error) {
        alert('Network error. Please check your connection.');
        console.error(error);
    }
});

function getAdminHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-admin-password': adminToken
    };
}

function logout() {
    adminToken = '';
    localStorage.removeItem('adminToken');
    window.location.href = 'index.html';
}

// -- Admin Dashboard --
async function showAdminDashboard() {
    switchView('adminDashboard');
    loadAdminQuizzes();
}

async function loadAdminQuizzes() {
    try {
        const res = await fetch(`${API_URL}/quizzes`, { headers: getAdminHeaders() });

        if (!res.ok) {
            await handleApiResponse(res);
            return;
        }

        const quizzes = await res.json();
        const list = document.getElementById('admin-quiz-list');
        list.innerHTML = '';

        quizzes.forEach(q => {
            const item = document.createElement('div');
            item.className = 'admin-quiz-item';
            const viz = q.is_visible ? '' : ' (Hidden)';
            item.innerHTML = `
                <span>${q.title}${viz} (${new Date(q.start_time).toLocaleString()})</span>
                <div class="admin-actions">
                    <button class="small-btn" onclick='openAddQuestion(${JSON.stringify(q).replace(/'/g, "&#39;")})'>+ Question</button>
                    <button class="delete-btn" onclick="deleteQuiz(${q.id})">Delete</button>
                </div>
            `;
            list.appendChild(item);
        });
    } catch (error) {
        alert('Failed to load quizzes. Please try again.');
        console.error(error);
    }
}

async function deleteQuiz(id) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;

    try {
        const res = await fetch(`${API_URL}/admin/quizzes/${id}`, {
            method: 'DELETE',
            headers: getAdminHeaders()
        });

        if (await handleApiResponse(res, 'Quiz deleted successfully!')) {
            loadAdminQuizzes();
        }
    } catch (error) {
        alert('Failed to delete quiz. Please try again.');
        console.error(error);
    }
}

// -- Create Quiz Form --
document.getElementById('create-quiz-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('new-quiz-title').value;
    const desc = document.getElementById('new-quiz-desc').value;
    const time = document.getElementById('new-quiz-time').value;
    const endTime = document.getElementById('new-quiz-end-time').value;
    const is_visible = document.getElementById('new-quiz-visible').checked;
    const theme = {
        primaryColor: document.getElementById('theme-primary').value,
        backgroundColor: document.getElementById('theme-bg').value,
        backgroundImageUrl: document.getElementById('theme-img').value
    };

    try {
        const res = await fetch(`${API_URL}/admin/quizzes`, {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify({ title, description: desc, start_time: time, end_time: endTime || null, theme, is_visible })
        });

        if (await handleApiResponse(res, 'Quiz Created!')) {
            e.target.reset();
            loadAdminQuizzes();
        }
    } catch (error) {
        alert('Failed to create quiz. Please try again.');
        console.error(error);
    }
});

// -- Add Questions --
function openAddQuestion(quiz) {
    editingQuizId = quiz.id;
    document.getElementById('add-questions-panel').classList.remove('hidden');
    document.getElementById('selected-quiz-title').textContent = quiz.title;
    document.getElementById('selected-quiz-title').scrollIntoView();
    resetQuestionForm();
}

function doneAddingQuestions() {
    document.getElementById('add-questions-panel').classList.add('hidden');
    editingQuizId = null;
    resetQuestionForm();
}

function resetQuestionForm() {
    document.getElementById('add-question-form').reset();
    addedLanguages = ['en'];

    const container = document.getElementById('lang-inputs-container');
    Array.from(container.children).forEach(child => {
        if (child.getAttribute('data-lang') !== 'en') child.remove();
    });
    renderLangTabs();
    switchTab('en');
}

function renderLangTabs() {
    const tabsContainer = document.getElementById('q-lang-tabs');
    tabsContainer.innerHTML = '';

    addedLanguages.forEach(lang => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tab';
        if (lang === 'en') btn.classList.add('active');
        btn.textContent = getLangName(lang);
        btn.onclick = () => switchTab(lang);
        tabsContainer.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'tab';
    addBtn.textContent = '+ Add Language';
    addBtn.onclick = addLangTab;
    tabsContainer.appendChild(addBtn);
}

function getLangName(code) {
    const names = { en: 'English', es: 'Spanish', fr: 'French', de: 'German' };
    return names[code] || code.toUpperCase();
}

function switchTab(lang) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabs = document.getElementById('q-lang-tabs').children;
    for (let i = 0; i < addedLanguages.length; i++) {
        if (addedLanguages[i] === lang) tabs[i].classList.add('active');
    }

    document.querySelectorAll('.lang-input-group').forEach(g => g.classList.remove('active'));
    document.querySelector(`.lang-input-group[data-lang="${lang}"]`).classList.add('active');
}

function addLangTab() {
    const code = prompt("Enter language code (e.g., es, fr, de):");
    if (!code || addedLanguages.includes(code)) return;

    addedLanguages.push(code);

    const container = document.getElementById('lang-inputs-container');
    const group = document.createElement('div');
    group.className = 'lang-input-group';
    group.setAttribute('data-lang', code);

    group.innerHTML = `
        <textarea class="q-text" placeholder="Question Text (${code})" required></textarea>
        <input type="text" class="q-hint" placeholder="Hint (${code}, Optional)">
        <div class="new-options-container">
            <input type="text" class="q-option" placeholder="Option 1" required>
            <input type="text" class="q-option" placeholder="Option 2" required>
            <input type="text" class="q-option" placeholder="Option 3" required>
            <input type="text" class="q-option" placeholder="Option 4" required>
        </div>
    `;
    container.appendChild(group);

    renderLangTabs();
    switchTab(code);
}

document.getElementById('add-question-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingQuizId) return;

    const enGroup = document.querySelector(`.lang-input-group[data-lang="en"]`);
    const text = enGroup.querySelector('#q-text').value;
    const hint = enGroup.querySelector('#q-hint').value;
    const options = Array.from(enGroup.querySelectorAll('.q-option')).map(i => i.value);

    const image = document.getElementById('q-image').value;
    const correct = parseInt(document.getElementById('q-correct').value);

    const translations = {};
    addedLanguages.forEach(lang => {
        if (lang === 'en') return;
        const group = document.querySelector(`.lang-input-group[data-lang="${lang}"]`);
        translations[lang] = {
            text: group.querySelector('.q-text').value,
            hint: group.querySelector('.q-hint').value,
            options: Array.from(group.querySelectorAll('.q-option')).map(i => i.value)
        };
    });

    const body = {
        quiz_id: editingQuizId,
        text, hint, options, correct_index: correct, image_url: image, translations
    };

    try {
        const res = await fetch(`${API_URL}/admin/questions`, {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify(body)
        });

        if (await handleApiResponse(res, 'Question Added!')) {
            resetQuestionForm();
        }
    } catch (error) {
        alert('Failed to add question. Please try again.');
        console.error(error);
    }
});

// -- DataTables --
function showAdminTables() {
    switchView('adminTables');
    initDataTables();
    switchTableTab('quizzes');
}

function switchTableTab(tab) {
    // Use more specific selectors within admin-tables-view
    const tablesView = document.getElementById('admin-tables-view');
    tablesView.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    tablesView.querySelectorAll('.table-container').forEach(c => c.classList.add('hidden'));

    const tabs = tablesView.querySelector('.tabs').children;
    if (tab === 'quizzes') {
        tabs[0].classList.add('active');
        document.getElementById('table-quizzes-container').classList.remove('hidden');
        if (quizzesTable) quizzesTable.ajax.reload();
    } else {
        tabs[1].classList.add('active');
        document.getElementById('table-questions-container').classList.remove('hidden');
        if (questionsTable) questionsTable.ajax.reload();
    }
}

function initDataTables() {
    if ($.fn.DataTable.isDataTable('#quizzes-table')) return;

    quizzesTable = $('#quizzes-table').DataTable({
        ajax: {
            url: API_URL + '/quizzes',
            beforeSend: (xhr) => xhr.setRequestHeader('x-admin-password', adminToken),
            dataSrc: '',
            error: function (xhr, error, code) {
                if (xhr.status === 401) {
                    alert('Authentication failed. Please log in again.');
                    logout();
                } else {
                    alert('Failed to load quizzes: ' + (xhr.responseJSON?.error || error));
                }
            }
        },
        columns: [
            { data: 'id' },
            { data: 'title' },
            { data: 'start_time', render: (data) => new Date(data).toLocaleString() },
            { data: 'is_visible', render: (data) => data ? 'Yes' : 'No' },
            {
                data: null,
                render: (data, type, row) => `
                    <button class="small-btn" onclick='editQuiz(${JSON.stringify(row).replace(/'/g, "&#39;")})'>Edit</button>
                    <button class="delete-btn" onclick="deleteQuiz(${row.id})">Delete</button>
                `
            }
        ]
    });

    questionsTable = $('#questions-table').DataTable({
        ajax: {
            url: API_URL + '/admin/questions',
            beforeSend: (xhr) => xhr.setRequestHeader('x-admin-password', adminToken),
            dataSrc: '',
            error: function (xhr, error, code) {
                if (xhr.status === 401) {
                    alert('Authentication failed. Please log in again.');
                    logout();
                } else {
                    alert('Failed to load questions: ' + (xhr.responseJSON?.error || error));
                }
            }
        },
        columns: [
            { data: 'id' },
            { data: 'quiz_title' },
            { data: 'text' },
            { data: 'correct_index' },
            {
                data: null,
                render: (data, type, row) => `
                    <button class="small-btn" onclick='editQuestion(${JSON.stringify(row).replace(/'/g, "&#39;")})'>Edit</button>
                `
            }
        ]
    });
}

// -- Edit Modal --
let currentEditType = null;
let currentEditId = null;
let currentEditData = null;

function closeModal() {
    const modal = document.getElementById('edit-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

function editQuiz(data) {
    currentEditType = 'quiz';
    currentEditId = data.id;
    currentEditData = data;
    const form = document.getElementById('edit-form');
    document.getElementById('modal-title').textContent = 'Edit Quiz';

    form.innerHTML = `
        <label>Title</label><input id="e-title" value="${data.title}" required>
        <label>Description</label><textarea id="e-desc">${data.description || ''}</textarea>
        <label>Start Time</label><input id="e-time" type="datetime-local" value="${data.start_time}" required>
        <label>End Time (Optional)</label><input id="e-end-time" type="datetime-local" value="${data.end_time || ''}">
        <div class="checkbox-group">
            <input type="checkbox" id="e-visible" ${data.is_visible ? 'checked' : ''}>
            <label>Visible</label>
        </div>
        <button type="submit" class="cta-btn">Save Changes</button>
    `;

    const modal = document.getElementById('edit-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function editQuestion(data) {
    currentEditType = 'question';
    currentEditId = data.id;
    currentEditData = data;
    const form = document.getElementById('edit-form');
    document.getElementById('modal-title').textContent = 'Edit Question';

    form.innerHTML = `
        <label>Text</label><textarea id="e-q-text" required>${data.text}</textarea>
        <label>Hint</label><input id="e-q-hint" value="${data.hint || ''}">
        <label>Correct Index (0-3)</label><input id="e-q-correct" type="number" min="0" max="3" value="${data.correct_index}" required>
        <label>Image URL</label><input id="e-q-image" value="${data.image_url || ''}">
        <label>Options (JSON)</label><textarea id="e-q-options">${JSON.stringify(data.options)}</textarea>
        <button type="submit" class="cta-btn">Save Changes</button>
    `;

    const modal = document.getElementById('edit-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    let body = {};
    let url = '';

    if (currentEditType === 'quiz') {
        url = `${API_URL}/admin/quizzes/${currentEditId}`;
        body = {
            title: document.getElementById('e-title').value,
            description: document.getElementById('e-desc').value,
            start_time: document.getElementById('e-time').value,
            end_time: document.getElementById('e-end-time').value || null,
            is_visible: document.getElementById('e-visible').checked,
            theme: currentEditData.theme || {},
            languages: currentEditData.languages || ['en']
        };
    } else {
        url = `${API_URL}/admin/questions/${currentEditId}`;
        body = {
            text: document.getElementById('e-q-text').value,
            hint: document.getElementById('e-q-hint').value,
            correct_index: parseInt(document.getElementById('e-q-correct').value),
            image_url: document.getElementById('e-q-image').value,
            options: JSON.parse(document.getElementById('e-q-options').value),
            translations: currentEditData.translations || {}
        };
    }

    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: getAdminHeaders(),
            body: JSON.stringify(body)
        });

        if (await handleApiResponse(res, 'Saved!')) {
            closeModal();
            if (currentEditType === 'quiz') quizzesTable.ajax.reload();
            else questionsTable.ajax.reload();
        }
    } catch (error) {
        alert('Failed to save changes. Please try again.');
        console.error(error);
    }
});

// Check if already logged in
if (adminToken) {
    showAdminDashboard();
}

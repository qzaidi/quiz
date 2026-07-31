// Common rendering functions shared between app.js and admin.js

/**
 * Render a question for display (used in quiz view and preview)
 * @param {Object} q - Question object with text, hint, options, correct_index, translations
 * @param {string} language - Language code for translations (e.g., 'en', 'ur', 'fa', 'hi')
 * @param {boolean} showCorrectAnswer - Whether to highlight the correct answer
 * @param {boolean} isArchived - Whether this is an archived quiz (adds prefix text)
 * @param {Object} elements - DOM elements to update
 */
function renderQuestion(q, language, showCorrectAnswer, isArchived, elements) {
    let qText = q.text;
    let qHint = q.hint;
    let qOptions = q.options;

    // Apply translation
    if (language !== 'en' && q.translations && q.translations[language]) {
        const translation = q.translations[language];
        if (translation.text) qText = translation.text;
        if (translation.hint) qHint = translation.hint;
        if (translation.options) qOptions = translation.options;
    }

    // Set question text with archived prefix if needed
    if (elements.questionText) {
        elements.questionText.textContent = qText + (isArchived ? ' (Archived - Review Only)' : '');
    }

    // Set hint
    if (elements.hintText && qHint) {
        elements.hintText.textContent = 'Hint: ' + qHint;
        elements.hintText.classList.remove('hidden');
    }

    // Render options
    if (elements.optionsContainer) {
        elements.optionsContainer.innerHTML = '';

        qOptions.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';

            if (showCorrectAnswer && idx === q.correct_index) {
                btn.classList.add('correct-answer');
                btn.textContent = '✓ ' + opt + ' (Correct Answer)';
            } else {
                btn.textContent = opt;
            }

            // For archived/preview mode, buttons are clickable for navigation
            if (showCorrectAnswer) {
                btn.style.cursor = 'pointer';
                if (idx !== q.correct_index) {
                    btn.style.opacity = '0.6';
                }
            }

            elements.optionsContainer.appendChild(btn);
        });
    }
}

/**
 * Make functions available globally
 */
window.renderQuestion = renderQuestion;

// -- Site name configuration (from /api/config, backed by SITE_NAME env var) --
window.SITE_NAME = 'Trivia Master';

fetch('/api/config')
    .then(res => res.json())
    .then(cfg => {
        if (!cfg.siteName || cfg.siteName === window.SITE_NAME) return;
        window.SITE_NAME = cfg.siteName;

        // Override app_title translations so a custom site name wins in every language
        if (window.translations) {
            for (const lang of Object.keys(window.translations)) {
                window.translations[lang].app_title = cfg.siteName;
            }
        }

        // Update document title and OG tags
        document.title = document.title.replace(/Trivia Master/g, cfg.siteName);
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.content = ogTitle.content.replace(/Trivia Master/g, cfg.siteName);

        // Update header if it already shows the default name
        const h1 = document.querySelector('header h1');
        if (h1) h1.textContent = h1.textContent.replace(/Trivia Master/g, cfg.siteName);
    })
    .catch(() => { /* keep default site name */ });

// -- UI theme (visual style) management --
// Themes are pure CSS token blocks in themes.css, keyed off data-theme on <html>.
// The initial theme is applied by an inline <head> script to avoid a flash of
// the wrong theme; this just keeps the picker in sync and persists changes.
const UI_THEME_STORAGE_KEY = 'ui-theme';
const UI_THEME_DEFAULT = 'minimal';

function getUITheme() {
    try {
        return localStorage.getItem(UI_THEME_STORAGE_KEY) || UI_THEME_DEFAULT;
    } catch (e) {
        return UI_THEME_DEFAULT;
    }
}

function setUITheme(themeId) {
    document.documentElement.dataset.theme = themeId;
    try {
        localStorage.setItem(UI_THEME_STORAGE_KEY, themeId);
    } catch (e) { /* private mode etc. — theme just won't persist */ }
    syncThemePickers();
}

function syncThemePickers() {
    const current = document.documentElement.dataset.theme || getUITheme();
    document.querySelectorAll('.theme-select').forEach(sel => {
        sel.value = current;
    });
}

window.getUITheme = getUITheme;
window.setUITheme = setUITheme;

document.addEventListener('DOMContentLoaded', syncThemePickers);

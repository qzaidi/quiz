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

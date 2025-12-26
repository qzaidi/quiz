import express from 'express';
import db from '../database.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(adminAuth);

// Check Admin Auth
router.post('/login', (req, res) => {
    res.json({ success: true });
});

// Create Quiz
router.post('/quizzes', (req, res) => {
    const { title, description, start_time, end_time, theme, is_visible } = req.body;
    const visibility = is_visible === undefined ? 1 : (is_visible ? 1 : 0);
    const stmt = db.prepare('INSERT INTO quizzes (title, description, start_time, end_time, theme, is_visible, languages) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(title, description, start_time, end_time || null, JSON.stringify(theme), visibility, '["en"]');
    res.json({ id: info.lastInsertRowid });
});

// Add Question
router.post('/questions', (req, res) => {
    const { quiz_id, text, hint, options, correct_index, image_url, translations } = req.body;

    const stmt = db.prepare('INSERT INTO questions (quiz_id, text, hint, options, correct_index, image_url, translations) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(quiz_id, text, hint, JSON.stringify(options), correct_index, image_url, JSON.stringify(translations || {}));

    // Update Quiz languages
    if (translations) {
        const quiz = db.prepare('SELECT languages FROM quizzes WHERE id = ?').get(quiz_id);
        if (quiz) {
            let langs = JSON.parse(quiz.languages || '["en"]');
            Object.keys(translations).forEach(l => {
                if (!langs.includes(l)) langs.push(l);
            });
            db.prepare('UPDATE quizzes SET languages = ? WHERE id = ?').run(JSON.stringify(langs), quiz_id);
        }
    }

    res.json({ success: true });
});

// Get All Questions (for DataTables)
router.get('/questions', (req, res) => {
    // Join with quizzes to get quiz title for context
    const questions = db.prepare(`
        SELECT q.id, q.quiz_id, q.text, q.hint, q.options, q.correct_index, q.image_url, q.translations, z.title as quiz_title 
        FROM questions q
        JOIN quizzes z ON q.quiz_id = z.id
    `).all();

    questions.forEach(q => {
        try { q.options = JSON.parse(q.options); } catch (e) { }
        try { q.translations = JSON.parse(q.translations); } catch (e) { }
    });
    res.json(questions);
});

// Update Quiz
router.put('/quizzes/:id', (req, res) => {
    const { title, description, start_time, end_time, theme, is_visible, languages } = req.body;
    const id = req.params.id;

    const visibility = (is_visible === true || is_visible === 1 || is_visible === '1') ? 1 : 0;

    const stmt = db.prepare(`
        UPDATE quizzes 
        SET title = ?, description = ?, start_time = ?, end_time = ?, theme = ?, is_visible = ?, languages = ?
        WHERE id = ?
    `);

    stmt.run(title, description, start_time, end_time || null, JSON.stringify(theme || {}), visibility, JSON.stringify(languages || ['en']), id);
    res.json({ success: true });
});

// Update Question
router.put('/questions/:id', (req, res) => {
    const { text, hint, options, correct_index, image_url, translations } = req.body;
    const id = req.params.id;

    const stmt = db.prepare(`
        UPDATE questions 
        SET text = ?, hint = ?, options = ?, correct_index = ?, image_url = ?, translations = ?
        WHERE id = ?
    `);

    stmt.run(text, hint, JSON.stringify(options), correct_index, image_url, JSON.stringify(translations || {}), id);
    res.json({ success: true });
});

// Delete Quiz
router.delete('/quizzes/:id', (req, res) => {
    const id = req.params.id;
    const deleteQuestions = db.prepare('DELETE FROM questions WHERE quiz_id = ?');
    const deleteSessions = db.prepare('DELETE FROM sessions WHERE quiz_id = ?');
    const deleteQuiz = db.prepare('DELETE FROM quizzes WHERE id = ?');

    db.transaction(() => {
        deleteQuestions.run(id);
        deleteSessions.run(id);
        deleteQuiz.run(id);
    })();

    res.json({ success: true });
});

export default router;

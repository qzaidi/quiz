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
    const { title, description, start_time, end_time, theme, is_visible, image_url } = req.body;
    const visibility = is_visible === undefined ? 1 : (is_visible ? 1 : 0);
    const stmt = db.prepare('INSERT INTO quizzes (title, description, start_time, end_time, theme, is_visible, languages, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(title, description, start_time, end_time || null, JSON.stringify(theme), visibility, '["en"]', image_url || null);
    res.json({ id: info.lastInsertRowid });
});

// Add Question
router.post('/questions', (req, res) => {
    const { quiz_id, text, hint, options, correct_index, translations } = req.body;

    const stmt = db.prepare('INSERT INTO questions (quiz_id, text, hint, options, correct_index, translations) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(quiz_id, text, hint, JSON.stringify(options), correct_index, JSON.stringify(translations || {}));

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

// Bulk Import Questions
router.post('/questions/bulk', (req, res) => {
    const { quiz_id, questions } = req.body; // questions is array of question objects

    if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    const insertStmt = db.prepare('INSERT INTO questions (quiz_id, text, hint, options, correct_index, translations) VALUES (?, ?, ?, ?, ?, ?)');

    // Get current quiz languages
    const quiz = db.prepare('SELECT languages FROM quizzes WHERE id = ?').get(quiz_id);
    let quizLangs = JSON.parse(quiz.languages || '["en"]');
    let langsUpdated = false;

    const runTransaction = db.transaction((questions) => {
        for (const q of questions) {
            const { text, hint, options, correct_index, translations } = q;
            insertStmt.run(quiz_id, text, hint || '', JSON.stringify(options), correct_index, JSON.stringify(translations || {}));

            // Collect languages
            if (translations) {
                Object.keys(translations).forEach(l => {
                    if (!quizLangs.includes(l)) {
                        quizLangs.push(l);
                        langsUpdated = true;
                    }
                });
            }
        }

        if (langsUpdated) {
            db.prepare('UPDATE quizzes SET languages = ? WHERE id = ?').run(JSON.stringify(quizLangs), quiz_id);
        }
    });

    try {
        runTransaction(questions);
        res.json({ success: true, count: questions.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to import questions' });
    }
});

// Get All Questions (for DataTables)
router.get('/questions', (req, res) => {
    // Join with quizzes to get quiz title for context
    const questions = db.prepare(`
        SELECT q.id, q.quiz_id, q.text, q.hint, q.options, q.correct_index, q.translations, z.title as quiz_title 
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
    const { title, description, start_time, end_time, theme, is_visible, languages, image_url } = req.body;
    const id = req.params.id;

    const visibility = (is_visible === true || is_visible === 1 || is_visible === '1') ? 1 : 0;

    const stmt = db.prepare(`
        UPDATE quizzes 
        SET title = ?, description = ?, start_time = ?, end_time = ?, theme = ?, is_visible = ?, languages = ?, image_url = ?
        WHERE id = ?
    `);

    stmt.run(title, description, start_time, end_time || null, JSON.stringify(theme || {}), visibility, JSON.stringify(languages || ['en']), image_url || null, id);
    res.json({ success: true });
});

// Update Question
router.put('/questions/:id', (req, res) => {
    const { text, hint, options, correct_index, translations } = req.body;
    const id = req.params.id;

    const stmt = db.prepare(`
        UPDATE questions 
        SET text = ?, hint = ?, options = ?, correct_index = ?, translations = ?
        WHERE id = ?
    `);

    stmt.run(text, hint, JSON.stringify(options), correct_index, JSON.stringify(translations || {}), id);
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

// Get All Sessions
router.get('/sessions', (req, res) => {
    const sessions = db.prepare(`
            SELECT s.id, s.quiz_id, s.participant_name, s.score, s.time_taken_seconds, s.completed_at, z.title as quiz_title
            FROM sessions s
            JOIN quizzes z ON s.quiz_id = z.id
            ORDER BY s.completed_at DESC
        `).all();
    res.json(sessions);
});

// Delete Session
router.delete('/sessions/:id', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

export default router;

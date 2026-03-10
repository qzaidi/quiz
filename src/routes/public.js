import express from 'express';
import db from '../database.js';
import { ADMIN_PASSWORD } from '../middleware/auth.js';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Ensure QR code directory exists
const QR_DIR = path.join(process.cwd(), 'public', 'img', 'qr');
fs.mkdirSync(QR_DIR, { recursive: true });

// Get all quizzes
router.get('/quizzes', (req, res) => {
    let query = 'SELECT id, title, description, start_time, end_time, theme, is_visible, languages, image_url FROM quizzes';

    const adminPwd = req.headers['x-admin-password'];
    if (adminPwd !== ADMIN_PASSWORD) {
        query += ' WHERE is_visible = 1';
    }

    query += ' ORDER BY start_time ASC';

    const quizzes = db.prepare(query).all();

    quizzes.forEach(q => {
        if (q.theme) try { q.theme = JSON.parse(q.theme); } catch (e) { }
        if (q.languages) try { q.languages = JSON.parse(q.languages); } catch (e) { }
    });

    res.json(quizzes);
});

// Get a single quiz details
router.get('/quizzes/:id', (req, res) => {
    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const adminPwd = req.headers['x-admin-password'];
    if (quiz.is_visible === 0 && adminPwd !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Access denied' });
    }

    if (quiz.theme) try { quiz.theme = JSON.parse(quiz.theme); } catch (e) { }
    if (quiz.languages) try { quiz.languages = JSON.parse(quiz.languages); } catch (e) { }

    res.json(quiz);
});

// Join a quiz
router.post('/join', (req, res) => {
    const { quizId, participantName } = req.body;
    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);

    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // Use wall-clock comparison to avoid server timezone mismatches
    const now = new Date();
    const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);

    if (quiz.start_time > localNow) {
        return res.status(403).json({ error: 'Quiz has not started yet' });
    }

    res.json({ success: true, message: 'Joined' });
});

// Get questions
router.get('/quiz/:id/questions', (req, res) => {
    const quizId = req.params.id;
    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);

    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // Same wall-clock check for fetching questions
    const now = new Date();
    const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);

    if (quiz.start_time > localNow) {
        return res.status(403).json({ error: 'Quiz has not started yet' });
    }

    let columns = 'id, text, hint, options, translations';

    // If quiz is archived, include correct answer
    if (quiz.end_time && quiz.end_time < localNow) {
        columns += ', correct_index';
    }

    const questions = db.prepare(`SELECT ${columns} FROM questions WHERE quiz_id = ?`).all(quizId);

    questions.forEach(q => {
        q.options = JSON.parse(q.options);
        if (q.translations) try { q.translations = JSON.parse(q.translations); } catch (e) { }
    });

    res.json(questions);
});

// Submit results
router.post('/submit', (req, res) => {
    const { quizId, participantName, answers, timeTaken } = req.body;

    let score = 0;
    const questions = db.prepare('SELECT id, correct_index FROM questions WHERE quiz_id = ?').all(quizId);

    questions.forEach(q => {
        if (answers[q.id] === q.correct_index) {
            score++;
        }
    });

    const stmt = db.prepare('INSERT INTO sessions (quiz_id, participant_name, score, time_taken_seconds) VALUES (?, ?, ?, ?)');
    stmt.run(quizId, participantName, score, timeTaken);

    res.json({ success: true, score, total: questions.length });
});

// Leaderboard
router.get('/leaderboard/:quizId', (req, res) => {
    const leaderboard = db.prepare('SELECT participant_name, score, time_taken_seconds FROM sessions WHERE quiz_id = ? ORDER BY score DESC, time_taken_seconds ASC LIMIT 10').all(req.params.quizId);
    res.json(leaderboard);
});

// Generate QR code for quiz (cached to file)
router.get('/quiz/:id/qr', async (req, res) => {
    const quizId = req.params.id;
    const quiz = db.prepare('SELECT id, is_visible FROM quizzes WHERE id = ?').get(quizId);

    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const adminPwd = req.headers['x-admin-password'];
    if (quiz.is_visible === 0 && adminPwd !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const size = parseInt(req.query.size) || 300;
    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}/?quizId=${quiz.id}`;

    // Use cached file if available
    const cacheFileName = `quiz-${quizId}-${size}.png`;
    const cachePath = path.join(QR_DIR, cacheFileName);

    try {
        if (fs.existsSync(cachePath)) {
            return res.sendFile(cachePath);
        }

        // Generate new QR code
        await QRCode.toFile(cachePath, url, {
            width: size,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        res.sendFile(cachePath);
    } catch (err) {
        console.error('QR code generation error:', err);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

export default router;

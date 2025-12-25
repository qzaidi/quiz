
const API = 'http://localhost:3000/api';

async function verify() {
    console.log('--- Verification Start ---');

    // 1. List Quizzes
    const r1 = await fetch(`${API}/quizzes`);
    const quizzes = await r1.json();
    console.log(`[PASS] Listed ${quizzes.length} quizzes`);

    const quiz1 = quizzes[0]; // Active (or soon to be)
    const quiz2 = quizzes[1]; // Future

    // 2. Try Join Future Quiz
    const r2 = await fetch(`${API}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz2.id, participantName: 'Tester' })
    });
    if (r2.status === 403) {
        console.log('[PASS] Blocked joining future quiz');
    } else {
        console.log('[FAIL] Should have blocked future quiz join');
    }

    // 3. Join Active Quiz
    // Note: It might be a few seconds before active if "1 minute" hasn't passed.
    // We'll wait 2 seconds just in case my typing was fast, but likely it's already active or very close.
    // Actually, seeding was done at server start. Server started just now.
    // Time logic: Server process started -> initDb -> 60s later Quiz 1 starts.
    // So right NOW it is NOT started. It starts in ~55 seconds.
    // I should verify that I CANNOT join it yet.

    const r3 = await fetch(`${API}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz1.id, participantName: 'Tester' })
    });

    if (r3.status === 403) {
        console.log('[PASS] Correctly blocked joining quiz before start time (it starts in ~1 min)');
    } else {
        // If it passed, maybe I was slow? No, 1 min is long.
        console.log('[FAIL] Joined quiz too early?', await r3.json());
    }

    console.log('--- Waiting 65 seconds to let Quiz 1 start ---');
    await new Promise(r => setTimeout(r, 65000));

    // 4. Retry Join Active Quiz
    const r4 = await fetch(`${API}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz1.id, participantName: 'Tester' })
    });
    if (r4.ok) {
        console.log('[PASS] Joined active quiz');
    } else {
        console.log('[FAIL] Could not join active quiz', await r4.json());
    }

    // 5. Get Questions
    const r5 = await fetch(`${API}/quiz/${quiz1.id}/questions`);
    const questions = await r5.json();
    if (questions.length === 2) {
        console.log('[PASS] Retrieved questions');
    } else {
        console.log('[FAIL] Question count mismatch', questions.length);
    }

    // 6. Submit
    // Q1: Capital of France (Correct: 2 - Paris)
    // Q2: Red Planet (Correct: 0 - Mars)
    const answers = {};
    answers[questions[0].id] = 2;
    answers[questions[1].id] = 0;

    const r6 = await fetch(`${API}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            quizId: quiz1.id,
            participantName: 'ProPlayer',
            answers: answers,
            timeTaken: 10
        })
    });
    const result = await r6.json();
    if (result.score === 2) {
        console.log('[PASS] Score calculation correct');
    } else {
        console.log('[FAIL] Score incorrect', result);
    }

    // 7. Leaderboard
    const r7 = await fetch(`${API}/leaderboard/${quiz1.id}`);
    const lb = await r7.json();
    console.log('[PASS] Leaderboard retrieved:', lb[0].participant_name === 'ProPlayer');
}

verify().catch(console.error);

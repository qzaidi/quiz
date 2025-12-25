const API = 'http://localhost:3000/api';

async function verify() {
    console.log('--- Verification Phase 5 Start ---');

    // 1. Verify specific quiz details (Deep Linking prerequisite API)
    // Fetch all first to get an ID
    const r1 = await fetch(`${API}/quizzes`);
    const quizzes = await r1.json();

    if (quizzes.length > 0) {
        const qId = quizzes[0].id;
        console.log(`[INFO] Found quiz with ID ${qId}. Testing Deep Link API...`);

        const r2 = await fetch(`${API}/quizzes/${qId}`);
        if (r2.ok) {
            console.log('[PASS] GET /api/quizzes/:id worked');
            const q = await r2.json();
            if (q.id === qId) {
                console.log('[PASS] Returned correct quiz ID');
            } else {
                console.log('[FAIL] Returned mismatched ID');
            }
        } else {
            console.log(`[FAIL] GET /api/quizzes/${qId} failed: ${r2.status}`);
        }
    } else {
        console.log('[WARN] No quizzes to test deep link with.');
    }

    console.log('[INFO] Automatic verification of client-side logic (URL parsing) is limited.');
    console.log('[INFO] Please open http://localhost:3000/?quizId=1 manually to verify it jumps to Lobby.');
}

verify().catch(console.error);

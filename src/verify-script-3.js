
const API = 'http://localhost:3000/api';

async function verify() {
    console.log('--- Verification Phase 3 Start ---');

    // Note: We cannot easily fetch the new random admin password, 
    // so we will test PUBLIC behavior (Visibility filtering).
    // AND we can test Admin Auth FAILURE.

    // 1. Fetch Quizzes (Public)
    // Ensure we get 200 OK. We can't verify filtering of specific hidden quizzes without creating one first, 
    // which requires Admin.
    // We will assume manual verification for creation.
    // But we can check that the response structure includes 'is_visible' or 'languages' or not?
    // Our GET /api/quizzes returns them now.

    const r1 = await fetch(`${API}/quizzes`);
    const quizzes = await r1.json();
    console.log(`[INFO] Public API returned ${quizzes.length} quizzes`);

    if (quizzes.length > 0) {
        const q = quizzes[0];
        if (q.hasOwnProperty('languages')) {
            console.log('[PASS] Quiz object has "languages" field');
        } else {
            console.log('[FAIL] Quiz object missing "languages" field');
        }

        // If any quiz is hidden logic:
        // In our seed data, all are visible (default=1).
        // So we should see them.
    }

    // 2. Test Question Translations Schema
    // We can't inspect DB directly easily here without sqlite3 driver or admin API.
    // But we can check if questions have 'translations' property?
    // Only if we JOIN a quiz.

    // Let's rely on manual verification for the complex flows (Language switching, Share).
    console.log('[INFO] Please verify Language Switching and WhatsApp Share manually in the Browser.');
    console.log('[INFO] Please verify Admin "Create Hidden Quiz" manually.');
}

verify().catch(console.error);

import crypto from 'crypto';

// Admin Password Setup
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(4).toString('hex');

if (!process.env.ADMIN_PASSWORD) {
    console.log('---------------------------------------------------');
    console.log(`ADMIN PASSWORD: ${ADMIN_PASSWORD}`);
    console.log('---------------------------------------------------');
}

export function adminAuth(req, res, next) {
    const pwd = req.headers['x-admin-password'];
    if (pwd === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

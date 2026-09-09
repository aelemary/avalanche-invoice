import { json } from './_auth.mjs';

export default { async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, { Allow: 'POST' });
    return json({ authenticated: false }, 200, { 'Set-Cookie': `avalanche_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.VERCEL ? '; Secure' : ''}` });
} };

import { configError, createSession, json, readJson, sessionCookie, sessionUser, verifyPassword } from './_auth.mjs';

export default {
    async fetch(request) {
        if (configError()) return json({ error: 'Login is not configured.' }, 503);
        if (request.method === 'GET') return json({ authenticated: Boolean(sessionUser(request)), username: sessionUser(request) });
        if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, { Allow: 'GET, POST' });
        const parsed = await readJson(request);
        if (parsed.error) return parsed.error;
        const { username, password } = parsed.value ?? {};
        if (typeof username !== 'string' || typeof password !== 'string' || !verifyPassword(username, password)) return json({ error: 'Invalid username or password.' }, 401);
        return json({ authenticated: true, username: process.env.LOGIN_USERNAME }, 200, { 'Set-Cookie': sessionCookie(createSession(process.env.LOGIN_USERNAME)) });
    }
};

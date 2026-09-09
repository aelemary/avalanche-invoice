import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const encoder = new TextEncoder();
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
const base64url = value => Buffer.from(value).toString('base64url');
const unbase64url = value => Buffer.from(value, 'base64url').toString('utf8');

function equal(left, right) {
    const a = Buffer.from(left ?? '');
    const b = Buffer.from(right ?? '');
    return a.length === b.length && timingSafeEqual(a, b);
}

function sessionSignature(payload) {
    return createHmac('sha256', process.env.LOGIN_SESSION_SECRET ?? '').update(payload).digest('base64url');
}

function readCookie(request, name) {
    const value = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
    return value?.slice(name.length + 1);
}

export function configError() {
    return !process.env.LOGIN_USERNAME || !process.env.LOGIN_PASSWORD_SHA256 || !process.env.LOGIN_SESSION_SECRET;
}

export async function readJson(request) {
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return { error: json({ error: 'Use application/json.' }, 415) };
    const text = await request.text();
    if (encoder.encode(text).length > 16384) return { error: json({ error: 'Request body exceeds 16 KB.' }, 413) };
    try { return { value: JSON.parse(text) }; } catch { return { error: json({ error: 'Invalid JSON.' }, 400) }; }
}

export function verifyPassword(username, password) {
    const hash = createHash('sha256').update(password).digest('hex');
    return equal(username, process.env.LOGIN_USERNAME) && equal(hash, process.env.LOGIN_PASSWORD_SHA256);
}

export function createSession(username) {
    const payload = base64url(JSON.stringify({ username, expiresAt: Date.now() + 8 * 60 * 60 * 1000 }));
    return `${payload}.${sessionSignature(payload)}`;
}

export function sessionUser(request) {
    const session = readCookie(request, 'avalanche_session');
    if (!session) return undefined;
    const [payload, signature] = session.split('.');
    if (!payload || !signature || !equal(signature, sessionSignature(payload))) return undefined;
    try {
        const value = JSON.parse(unbase64url(payload));
        return value.expiresAt > Date.now() && value.username === process.env.LOGIN_USERNAME ? value.username : undefined;
    } catch { return undefined; }
}

export function sessionCookie(value) {
    return `avalanche_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.VERCEL ? '; Secure' : ''}`;
}

export { json };

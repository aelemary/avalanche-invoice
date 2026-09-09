import { createSign } from 'node:crypto';
import { HttpError } from './validation.mjs';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function base64url(value) {
    return Buffer.from(value).toString('base64url');
}

function sheetDate(value) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
}

function clientName(value) {
    return value.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? '';
}

export function revenueRow(invoice, input) {
    return [
        sheetDate(invoice.issuedDate),
        sheetDate(invoice.dueDate),
        '',
        '',
        invoice.invoiceNumber,
        clientName(input.billedTo),
        '',
        invoice.subtotal.toFixed(2),
        ''
    ];
}

export function nextInvoiceRow(invoiceNumbers) {
    let lastUsedRow = 0;
    for (const [index, row] of invoiceNumbers.entries()) {
        if (String(row?.[0] ?? '').trim()) lastUsedRow = index + 1;
    }
    return lastUsedRow + 1;
}

function serviceAccountFromEnv(env) {
    const encoded = env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
    if (!encoded) return undefined;
    try {
        const credentials = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
        if (!credentials.client_email || !credentials.private_key) throw new Error('Missing service-account fields.');
        return credentials;
    } catch {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 must contain a valid base64-encoded service-account JSON key.');
    }
}

function assertResponse(response, body) {
    if (response.ok) return;
    const message = body?.error?.message || 'Google Sheets request failed.';
    throw new HttpError(502, `Google Sheets: ${message}`);
}

export function createSheetsWriter({ credentials, spreadsheetId, sheetName = 'Revenue', fetchImpl = fetch }) {
    if (!credentials || !spreadsheetId) return undefined;
    let accessToken;
    let tokenExpiresAt = 0;

    async function token() {
        if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
        const now = Math.floor(Date.now() / 1000);
        const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ iss: credentials.client_email, scope: SHEETS_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }))}`;
        const signer = createSign('RSA-SHA256');
        signer.update(unsigned);
        const assertion = `${unsigned}.${signer.sign(credentials.private_key, 'base64url')}`;
        const response = await fetchImpl(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
        const body = await response.json();
        assertResponse(response, body);
        accessToken = body.access_token;
        tokenExpiresAt = Date.now() + Math.max(0, Number(body.expires_in || 3600) - 60) * 1000;
        return accessToken;
    }

    async function request(url, options = {}) {
        const response = await fetchImpl(url, { ...options, headers: { Authorization: `Bearer ${await token()}`, ...options.headers } });
        const body = await response.json();
        assertResponse(response, body);
        return body;
    }

    return {
        async appendRevenue(invoice, input) {
            const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values`;
            const invoiceNumbers = await request(`${base}/${encodeURIComponent(`${sheetName}!E:E`)}`);
            if ((invoiceNumbers.values ?? []).some(([value]) => value === invoice.invoiceNumber)) return { status: 'already-recorded' };
            const row = nextInvoiceRow(invoiceNumbers.values ?? []);
            const range = `${sheetName}!A${row}:I${row}`;
            const result = await request(`${base}/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [revenueRow(invoice, input)] })
            });
            return { status: 'added', updatedRange: result.updatedRange };
        }
    };
}

export function createSheetsWriterFromEnv(env = process.env) {
    return createSheetsWriter({ credentials: serviceAccountFromEnv(env), spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID, sheetName: env.GOOGLE_SHEETS_SHEET_NAME || 'Revenue' });
}

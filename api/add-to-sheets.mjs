import { createSheetsWriterFromEnv } from '../server/google-sheets.mjs';
import { validateInvoice } from '../server/validation.mjs';
import { configError, json, readJson, sessionUser } from './_auth.mjs';

function invoiceNumber(data) {
    const [year, month, day] = data.issuedDate.split('-');
    const values = [data.dueDate, data.issuedDate, data.billedTo, data.paymentHeading, data.total.toFixed(2), data.taxPercent.toFixed(2), 'GB94MONZ04000520083681', data.paid ? 'paid' : 'due'].join('|');
    let hash = 0x811C9DC5;
    for (const character of values) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 0x01000193); }
    return `I-${day}${month}${year.slice(-2)}-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

export default { async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, { Allow: 'POST' });
    if (configError()) return json({ error: 'Login is not configured.' }, 503);
    if (!sessionUser(request)) return json({ error: 'Sign in before adding an invoice to Google Sheets.' }, 401);
    const parsed = await readJson(request);
    if (parsed.error) return parsed.error;
    try {
        const { issuedDate, dueDate, billedTo, paymentHeading, total, taxPercent, paid, printable } = parsed.value ?? {};
        const input = validateInvoice({ issuedDate, dueDate, billedTo, paymentHeading, total, taxPercent, paid, printable, addToGoogleSheets: true });
        const writer = createSheetsWriterFromEnv();
        if (!writer) return json({ error: 'Google Sheets is not configured.' }, 503);
        const subtotal = Number((input.total / (1 + input.taxPercent / 100)).toFixed(2));
        const googleSheets = await writer.appendRevenue({ ...input, invoiceNumber: invoiceNumber(input), subtotal }, input);
        return json({ googleSheets });
    } catch (error) {
        return json({ error: error.status ? error.message : 'Could not add the invoice to Google Sheets.' }, error.status ?? 502);
    }
} };

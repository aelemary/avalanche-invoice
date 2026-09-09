import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.mjs';
import { validateInvoice } from './validation.mjs';
import { renderInvoice, closeRenderer } from './render.mjs';

const input = { issuedDate: '2026-09-06', dueDate: '2026-09-20', billedTo: 'Example Ltd', paymentHeading: 'Website work', total: 1600, taxPercent: 20 };
test('validates dates, amounts, flags and unexpected fields', () => {
    assert.equal(validateInvoice(input).paid, false);
    for (const update of [{ issuedDate: '2026-02-30' }, { total: -1 }, { total: '1600' }, { taxPercent: 1.001 }, { paid: 'false' }, { url: 'https://example.com' }]) assert.throws(() => validateInvoice({ ...input, ...update }));
});

test('HTTP authentication, validation, JSON and PDF responses', async () => {
    const key = 'test-secret-'.repeat(4);
    let calls = 0;
    const app = createApp({ apiKey: key, render: async () => { calls++; return { invoice: { invoiceNumber: 'I-060926-ABCDEF12' }, pdf: Buffer.from('%PDF-test') }; } });
    await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.address().port}`;
    const post = (body, auth = key) => fetch(`${base}/api/invoices`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` }, body: JSON.stringify(body) });
    try {
        assert.equal((await post(input, 'bad')).status, 401);
        assert.equal((await post({ ...input, total: -1 })).status, 400);
        assert.equal(calls, 0);
        const pdf = await post(input);
        assert.equal(pdf.headers.get('content-type'), 'application/pdf');
        assert.equal(await pdf.text(), '%PDF-test');
        const result = await post({ ...input, format: 'json' });
        assert.equal(result.status, 200);
        assert.equal((await result.json()).pdf.base64, Buffer.from('%PDF-test').toString('base64'));
        assert.equal((await fetch(`${base}/.env`)).status, 404);
    } finally { await new Promise(resolve => app.close(resolve)); }
});

test('adds to Google Sheets only when requested', async () => {
    const key = 'test-secret-'.repeat(4);
    const writes = [];
    const app = createApp({ apiKey: key, render: async () => ({ invoice: { invoiceNumber: 'I-060926-ABCDEF12', issuedDate: '2026-09-06', dueDate: '2026-09-20', subtotal: 1333.33 }, pdf: Buffer.from('%PDF-test') }), sheetsWriter: { appendRevenue: async (invoice, request) => { writes.push({ invoice, request }); return { status: 'added', updatedRange: 'Revenue!A5:I5' }; } } });
    await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
    try {
        const response = await fetch(`http://127.0.0.1:${app.address().port}/api/invoices`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ ...input, addToGoogleSheets: true, format: 'json' }) });
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).invoice.googleSheets, { status: 'added', updatedRange: 'Revenue!A5:I5' });
        assert.equal(writes.length, 1);
    } finally { await new Promise(resolve => app.close(resolve)); }
});

test('real renderer produces PDF and paid metadata', { skip: !process.env.TEST_RENDER }, async () => {
    try {
        const result = await renderInvoice(validateInvoice({ ...input, paid: true, printable: true }));
        assert.equal(result.pdf.subarray(0, 5).toString(), '%PDF-');
        assert.equal(result.invoice.subtotal, 1333.33);
        assert.equal(result.invoice.tax, 266.67);
        assert.equal(result.invoice.outstanding, 0);
        assert.match(result.invoice.invoiceNumber, /^I-060926-[A-F0-9]{8}$/);
        const due = await renderInvoice(validateInvoice(input));
        assert.equal(due.invoice.outstanding, 1600);
        assert.equal(due.invoice.paid, false);
        assert.equal(due.pdf.subarray(0, 5).toString(), '%PDF-');
        await assert.rejects(renderInvoice(validateInvoice({ ...input, billedTo: 'a\nb\nc\nd\ne' })), /four rendered/);
    } finally { await closeRenderer(); }
});

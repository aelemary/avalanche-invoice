import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextInvoiceRow, revenueRow, revenueUpdates } from './google-sheets.mjs';

test('maps a client invoice to the Revenue table columns', () => {
    assert.deepEqual(revenueRow({ issuedDate: '2026-09-06', dueDate: '2026-09-20', invoiceNumber: 'I-060926-ABCDEF12', subtotal: 1333.33 }, { billedTo: 'Example Ltd\n1 Example Street', paymentHeading: 'Website development' }), ['06/09/2026', '20/09/2026', '', '', 'I-060926-ABCDEF12', 'Example Ltd', 'Website development', '1333.33', '']);
});

test('adds VAT, the total and payment status without overwriting calculated columns', () => {
    const invoice = { issuedDate: '2026-09-06', dueDate: '2026-09-20', invoiceNumber: 'I-060926-ABCDEF12', subtotal: 100, total: 120, taxPercent: 20, paid: true };
    const input = { billedTo: 'Example Ltd', paymentHeading: 'Website development' };
    assert.deepEqual(revenueUpdates(invoice, input, 'Revenue', 5), [
        { range: 'Revenue!A5:I5', values: [['06/09/2026', '20/09/2026', '', '', 'I-060926-ABCDEF12', 'Example Ltd', 'Website development', '100.00', '']] },
        { range: 'Revenue!J5', values: [['Yes']] },
        { range: 'Revenue!K5', values: [['20.00']] },
        { range: 'Revenue!L5', values: [['120.00']] },
        { range: 'Revenue!P5', values: [['paid']] }
    ]);
});

test('marks zero-tax invoices as not VAT registered', () => {
    const invoice = { issuedDate: '2026-09-06', dueDate: '2026-09-20', invoiceNumber: 'I-060926-ABCDEF12', subtotal: 100, total: 100, taxPercent: 0, paid: false };
    const updates = revenueUpdates(invoice, { billedTo: 'Example Ltd', paymentHeading: 'Website development' }, 'Revenue', 5);
    assert.deepEqual(updates.slice(1), [
        { range: 'Revenue!J5', values: [['No']] },
        { range: 'Revenue!K5', values: [['0.00']] },
        { range: 'Revenue!L5', values: [['100.00']] },
        { range: 'Revenue!P5', values: [['outstanding']] }
    ]);
});

test('uses the row after the last invoice number rather than formula-only rows', () => {
    assert.equal(nextInvoiceRow([[], [], ['Invoice number'], ['I-060926-ABCDEF12']]), 5);
    assert.equal(nextInvoiceRow([]), 1);
});

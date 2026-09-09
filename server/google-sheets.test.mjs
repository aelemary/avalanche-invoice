import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revenueRow } from './google-sheets.mjs';

test('maps a client invoice to the Revenue table columns', () => {
    assert.deepEqual(revenueRow({ issuedDate: '2026-09-06', dueDate: '2026-09-20', invoiceNumber: 'I-060926-ABCDEF12', subtotal: 1333.33 }, { billedTo: 'Example Ltd\n1 Example Street', paymentHeading: 'Website development' }), ['06/09/2026', '20/09/2026', '', '', 'I-060926-ABCDEF12', 'Example Ltd', '', '1333.33', '']);
});

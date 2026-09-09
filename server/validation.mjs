export class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

export function validateInvoice(input) {
    const fail = message => { throw new HttpError(400, message); };
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Expected a JSON object.');
    const allowed = ['issuedDate', 'dueDate', 'billedTo', 'paymentHeading', 'total', 'taxPercent', 'paid', 'printable', 'addToGoogleSheets', 'format'];
    for (const key of Object.keys(input)) if (!allowed.includes(key)) fail(`Unknown field: ${key}`);
    const result = {};
    for (const key of ['issuedDate', 'dueDate']) {
        const value = input[key];
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail(`${key} must be a valid YYYY-MM-DD date.`);
        result[key] = value;
    }
    for (const [key, max] of [['billedTo', 1000], ['paymentHeading', 42]]) {
        if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max) fail(`${key} must contain 1–${max} characters.`);
        result[key] = input[key].trim();
    }
    for (const [key, max] of [['total', 9999999.99], ['taxPercent', 100]]) {
        const value = input[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) fail(`${key} must be between 0 and ${max}, with at most two decimal places.`);
        result[key] = value;
    }
    for (const key of ['paid', 'printable', 'addToGoogleSheets']) {
        if (input[key] !== undefined && typeof input[key] !== 'boolean') fail(`${key} must be boolean.`);
        result[key] = input[key] ?? false;
    }
    result.format = input.format ?? 'json';
    if (!['json', 'pdf'].includes(result.format)) fail('format must be json or pdf.');
    return result;
}

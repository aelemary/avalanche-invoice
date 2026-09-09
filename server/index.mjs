import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validateInvoice, HttpError } from './validation.mjs';
import { renderInvoice, closeRenderer } from './render.mjs';

const publicFiles = new Set(['index.html', 'home.css', 'privacy-policy.html', ...['client', 'developer'].flatMap(dir => ['index.html', 'script.js', 'styles.css'].map(file => `${dir}/${file}`)), 'client/Avalanche Invoice.editable.svg']);
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml' };
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };

export function createApp({ apiKey, render = renderInvoice } = {}) {
    if (!apiKey || apiKey.length < 32 || apiKey === 'replace-with-a-long-random-secret') throw new Error('Set INVOICE_API_KEY to a random secret of at least 32 characters.');
    return createServer(async (req, res) => {
        try {
            const path = new URL(req.url, 'http://localhost').pathname;
            if (path === '/api/health' && req.method === 'GET') return json(res, 200, { status: 'ok' });
            if (path === '/api/invoices') {
                res.setHeader('Cache-Control', 'no-store');
                if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new HttpError(405, 'Use POST.'); }
                const supplied = Buffer.from(req.headers.authorization ?? '');
                const expected = Buffer.from(`Bearer ${apiKey}`);
                if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new HttpError(401, 'Invalid API key.');
                if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new HttpError(415, 'Use application/json.');
                const chunks = [];
                let size = 0;
                for await (const chunk of req) {
                    size += chunk.length;
                    if (size > 16384) throw new HttpError(413, 'Request body exceeds 16 KB.');
                    chunks.push(chunk);
                }
                let input;
                try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON.'); }
                input = validateInvoice(input);
                const { invoice, pdf } = await render(input);
                if (input.format === 'pdf') {
                    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`, 'X-Invoice-Number': invoice.invoiceNumber });
                    return res.end(pdf);
                }
                return json(res, 200, { invoice, pdf: { filename: `${invoice.invoiceNumber}.pdf`, contentType: 'application/pdf', base64: pdf.toString('base64') } });
            }
            if (!['GET', 'HEAD'].includes(req.method)) throw new HttpError(405, 'Method not allowed.');
            let file = decodeURIComponent(path).slice(1);
            if (!file || file.endsWith('/')) file += 'index.html';
            if (!publicFiles.has(file)) throw new HttpError(404, 'Not found.');
            const bytes = await readFile(new URL(`../${file}`, import.meta.url));
            res.writeHead(200, { 'Content-Type': types[file.split('.').pop()], 'Cache-Control': 'no-cache' });
            res.end(req.method === 'HEAD' ? undefined : bytes);
        } catch (error) {
            json(res, error.status ?? 500, { error: error.status ? error.message : 'Invoice generation failed.' });
        }
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const server = createApp({ apiKey: process.env.INVOICE_API_KEY });
    server.requestTimeout = 30000;
    server.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1', () => console.log(`Invoice API listening on port ${process.env.PORT ?? 3000}`));
    for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => { await closeRenderer(); process.exit(0); }));
}

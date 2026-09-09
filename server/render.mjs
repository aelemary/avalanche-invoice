import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { HttpError } from './validation.mjs';

const root = new URL('../', import.meta.url);
let browserPromise;
let active = 0;
export async function closeRenderer() {
    if (browserPromise) await (await browserPromise).close();
    browserPromise = undefined;
}

export async function renderInvoice(input) {
    if (active >= 2) throw new HttpError(503, 'Renderer busy. Retry shortly.');
    active++;
    let context;
    try {
        browserPromise ??= chromium.launch().catch(error => { browserPromise = undefined; throw error; });
        const browser = await browserPromise;
        context = await browser.newContext();
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        page.setDefaultNavigationTimeout(20000);
        // Only local, known assets are supplied to the browser. No outbound requests.
        const [html, script, svg, font] = await Promise.all([
            readFile(new URL('client/index.html', root), 'utf8'),
            readFile(new URL('client/script.js', root), 'utf8'),
            readFile(new URL('client/Avalanche Invoice.editable.svg', root), 'utf8'),
            readFile(new URL('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', root))
        ]);
        const fontCss = `@font-face{font-family:Inter;font-weight:100 900;src:url(data:font/woff2;base64,${font.toString('base64')})}`;
        await page.route('**/*', route => {
            const path = new URL(route.request().url()).pathname;
            if (path === '/client/') return route.fulfill({ contentType: 'text/html', body: html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '') });
            if (decodeURIComponent(path) === '/client/Avalanche Invoice.editable.svg') return route.fulfill({ contentType: 'image/svg+xml', body: svg });
            return route.abort();
        });
        await page.goto('http://invoice.local/client/');
        await page.addStyleTag({ content: fontCss });
        await page.evaluate(async () => {
            await document.fonts.load('400 40px Inter');
            await document.fonts.load('700 40px Inter');
            window.jspdf = {}; // PDF export uses Chromium; the editor's download button is unused.
        });
        await page.addScriptTag({ content: script });
        await page.waitForFunction(() => typeof editableTemplateDocument !== 'undefined');
        const result = await page.evaluate(({ input, fontCss }) => {
            for (const key of ['issuedDate', 'dueDate', 'billedTo', 'paymentHeading', 'total']) fields[key].value = input[key];
            fields.tax.value = input.taxPercent;
            fields.paid.setAttribute('aria-pressed', String(input.paid));
            fields.addToGoogleSheets.checked = input.addToGoogleSheets;
            const data = invoiceData();
            data.invoiceNumber = invoiceNumber(data);
            // Reject address overflow instead of silently losing details in company workflows.
            if (wrapBilledTo(data.billedTo, 560, 1000).length > 4) throw new Error('ADDRESS_OVERFLOW');
            const doc = new DOMParser().parseFromString(buildInvoiceSvg(data), 'image/svg+xml');
            const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
            style.textContent = fontCss;
            doc.documentElement.prepend(style);
            return { data, svg: new XMLSerializer().serializeToString(doc) };
        }, { input, fontCss });
        const image = Buffer.from(result.svg).toString('base64');
        await page.setContent(`<style>@page{size:A4;margin:0}html,body{margin:0;width:210mm;height:297mm}img{display:block;width:210mm;height:297mm;${input.printable ? 'filter:invert(1)' : ''}}</style><img src="data:image/svg+xml;base64,${image}">`);
        await page.evaluate(() => document.querySelector('img').decode());
        const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, timeout: 20000 });
        return { invoice: { ...result.data, subtotal: Number(result.data.subtotal.toFixed(2)), tax: Number(result.data.tax.toFixed(2)), currency: 'GBP', iban: 'GB94 MONZ 0400 0520 0836 81', outstanding: input.paid ? 0 : input.total, printable: input.printable }, pdf };
    } catch (error) {
        if (error.message.includes('ADDRESS_OVERFLOW')) throw new HttpError(400, 'billedTo exceeds four rendered invoice lines. Shorten the address.');
        throw error;
    } finally {
        try { await context?.close(); } finally { active--; }
    }
}

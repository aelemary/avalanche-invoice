const { jsPDF } = window.jspdf;

const PAGE = { width: 2500, height: 3538 };
const editableTemplateUrl = 'Avalanche Invoice.editable.svg';
let editableTemplateDocument;
let renderVersion = 0;

const form = document.getElementById('invoiceForm');
const previewCanvas = document.getElementById('invoicePreview');
const previewContext = previewCanvas.getContext('2d');
const printableToggle = document.getElementById('printableToggle');
const editorSubtotal = document.getElementById('editorSubtotal');
const updatePreviewButton = document.getElementById('updatePreview');
const fields = {
    dueDate: document.getElementById('dueDate'),
    issuedDate: document.getElementById('issuedDate'),
    billedTo: document.getElementById('billedTo'),
    paymentHeading: document.getElementById('paymentHeading'),
    total: document.getElementById('total'),
    tax: document.getElementById('tax')
};

function todayForInput() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function numberValue(input) {
    const value = Number.parseFloat(input.value);
    return Number.isFinite(value) && value >= 0 ? value : 0;
}

function invoiceData() {
    const total = numberValue(fields.total);
    const taxPercent = numberValue(fields.tax);
    const subtotal = total / (1 + taxPercent / 100);
    const tax = total - subtotal;
    return {
        dueDate: fields.dueDate.value,
        issuedDate: fields.issuedDate.value,
        billedTo: fields.billedTo.value.trim(),
        paymentHeading: fields.paymentHeading.value.trim(),
        subtotal,
        tax,
        total,
        taxPercent
    };
}

function formatMoney(value) {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function formatPercent(value) {
    return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value) {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : '';
}

function invoiceNumberDate(value) {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}${month}${year.slice(-2)}` : '';
}

function invoiceChecksum(data) {
    const values = [
        data.dueDate,
        data.issuedDate,
        data.billedTo,
        data.paymentHeading,
        data.total.toFixed(2),
        data.taxPercent.toFixed(2)
    ].join('|');
    let hash = 0x811C9DC5;
    for (const character of values) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function invoiceNumber(data) {
    const date = invoiceNumberDate(data.issuedDate);
    return date ? `I-${date}-${invoiceChecksum(data)}` : '';
}

function setSvgText(svgDocument, id, value) {
    const element = svgDocument.getElementById(id);
    if (element) element.textContent = value;
}

function wrapBilledTo(value, maxWidth = 560, maxLines = 4) {
    const measureCanvas = document.createElement('canvas');
    const measureContext = measureCanvas.getContext('2d');
    measureContext.font = '400 40px Inter, Arial, sans-serif';
    const lines = [];

    for (const paragraph of value.split(/\r?\n/)) {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        if (!words.length) continue;
        let line = '';
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (measureContext.measureText(candidate).width <= maxWidth) {
                line = candidate;
                continue;
            }
            if (line) lines.push(line);
            if (measureContext.measureText(word).width <= maxWidth) {
                line = word;
                continue;
            }
            let remaining = word;
            while (remaining && measureContext.measureText(remaining).width > maxWidth) {
                let splitAt = remaining.length;
                while (splitAt > 1 && measureContext.measureText(remaining.slice(0, splitAt)).width > maxWidth) {
                    splitAt -= 1;
                }
                lines.push(remaining.slice(0, splitAt));
                remaining = remaining.slice(splitAt);
            }
            line = remaining;
        }
        if (line) lines.push(line);
    }

    if (lines.length <= maxLines) return lines;
    const visibleLines = lines.slice(0, maxLines);
    let finalLine = visibleLines[maxLines - 1];
    while (finalLine && measureContext.measureText(`${finalLine}…`).width > maxWidth) {
        finalLine = finalLine.slice(0, -1).trimEnd();
    }
    visibleLines[maxLines - 1] = `${finalLine}…`;
    return visibleLines;
}

function buildInvoiceSvg(data) {
    const svgDocument = editableTemplateDocument.cloneNode(true);
    setSvgText(svgDocument, 'invoice-due-date', `Due ${formatDate(data.dueDate)}`);
    setSvgText(svgDocument, 'invoice-issued-date', `Issued ${formatDate(data.issuedDate)}`);
    setSvgText(svgDocument, 'invoice-number', data.invoiceNumber);
    const billedToLines = wrapBilledTo(data.billedTo);
    for (let index = 0; index < 4; index += 1) {
        setSvgText(svgDocument, `invoice-billed-to-line-${index + 1}`, billedToLines[index] || '');
    }
    setSvgText(svgDocument, 'invoice-payment-heading', data.paymentHeading);
    setSvgText(svgDocument, 'invoice-tax-label', `Tax (${formatPercent(data.taxPercent)}%)`);
    setSvgText(svgDocument, 'invoice-subtotal', formatMoney(data.subtotal));
    setSvgText(svgDocument, 'invoice-tax', formatMoney(data.tax));
    setSvgText(svgDocument, 'invoice-total', formatMoney(data.total));
    return new XMLSerializer().serializeToString(svgDocument);
}

function loadSvgImage(svgMarkup) {
    return new Promise((resolve, reject) => {
        const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
        const objectUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('The editable SVG could not be rendered.'));
        };
        image.src = objectUrl;
    });
}

async function renderInvoice() {
    if (!editableTemplateDocument) return;
    const version = ++renderVersion;
    const data = invoiceData();
    data.invoiceNumber = invoiceNumber(data);
    editorSubtotal.textContent = formatMoney(data.subtotal);

    const image = await loadSvgImage(buildInvoiceSvg(data));
    if (version !== renderVersion) return;

    previewContext.clearRect(0, 0, PAGE.width, PAGE.height);
    previewContext.save();
    if (printableToggle.checked) previewContext.filter = 'invert(1)';
    previewContext.drawImage(image, 0, 0, PAGE.width, PAGE.height);
    previewContext.restore();
}

function updateTotalReadout() {
    editorSubtotal.textContent = formatMoney(invoiceData().subtotal);
}

function slug(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'invoice';
}

function downloadPdf() {
    const data = invoiceData();
    const documentPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    documentPdf.addImage(previewCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    documentPdf.save(`${slug(data.billedTo.split(/\r?\n/)[0])}-invoice-${data.dueDate}.pdf`);
}

async function loadEditableTemplate() {
    const response = await fetch(editableTemplateUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('The editable invoice SVG could not be loaded.');
    const source = await response.text();
    editableTemplateDocument = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (editableTemplateDocument.querySelector('parsererror')) {
        throw new Error('The editable invoice SVG is invalid.');
    }
    await document.fonts.ready;
    await renderInvoice();
}

fields.issuedDate.value = todayForInput();
loadEditableTemplate().catch(error => {
    console.error(error);
    previewCanvas.setAttribute('aria-label', 'Invoice preview could not be loaded');
});

updatePreviewButton.addEventListener('click', () => { void renderInvoice(); });
form.addEventListener('input', updateTotalReadout);
form.addEventListener('change', updateTotalReadout);
form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    await renderInvoice();
    downloadPdf();
});

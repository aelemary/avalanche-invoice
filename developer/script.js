const { jsPDF } = window.jspdf;

const PAGE = { width: 1240, height: 1754, margin: 74 };
const AVALANCHE = {
  name: 'Avalanche Tech Ltd.',
  address: ['167–169 Great Portland Street', '5th Floor, London, United Kingdom', 'W1W 5PF'],
  email: 'Hello@avalanche-tech.co.uk'
};
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Cambodia','Cameroon','Canada','Cape Verde','Chile','China','Colombia','Comoros','Costa Rica','Croatia','Cyprus','Czechia','Denmark','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guyana','Haiti','Honduras','Hong Kong','Hungary','Iceland','India','Indonesia','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Latvia','Lebanon','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Malaysia','Malta','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Namibia','Nepal','Netherlands','New Zealand','Nigeria','North Macedonia','Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Rwanda','Saudi Arabia','Senegal','Serbia','Singapore','Slovakia','Slovenia','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Tanzania','Thailand','Tunisia','Turkey','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vietnam','Zambia','Zimbabwe'
];

const form = document.getElementById('developerInvoiceForm');
const previewCanvas = document.getElementById('invoicePreview');
const context = previewCanvas.getContext('2d');
const lineItems = document.getElementById('lineItems');
const lineItemTemplate = document.getElementById('lineItemTemplate');
const paymentFields = document.getElementById('paymentFields');
const fields = {
  invoiceNumber: document.getElementById('invoiceNumber'), invoiceDate: document.getElementById('invoiceDate'), paymentTerms: document.getElementById('paymentTerms'), customTerms: document.getElementById('customTerms'), legalName: document.getElementById('legalName'), tradingName: document.getElementById('tradingName'), contractorAddress: document.getElementById('contractorAddress'), contractorEmail: document.getElementById('contractorEmail'), contractorPhone: document.getElementById('contractorPhone'), taxResidence: document.getElementById('taxResidence'), projectReference: document.getElementById('projectReference'), currency: document.getElementById('currency'), nonUkResident: document.getElementById('nonUkResident'), vatRegistered: document.getElementById('vatRegistered'), vatId: document.getElementById('vatId'), paymentMethod: document.getElementById('paymentMethod')
};

function todayForInput() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function numberValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function compact(value) { return String(value || '').trim().replace(/\s+/g, ' '); }

function initials(name) {
  const letters = compact(name).split(' ').filter(Boolean).map(part => part[0]).join('').replace(/[^a-z0-9]/ig, '').toUpperCase();
  return letters.slice(0, 6) || 'DEV';
}

function paymentData() {
  const method = fields.paymentMethod.value;
  const data = { method };
  for (const input of paymentFields.querySelectorAll('input')) data[input.name] = compact(input.value);
  return data;
}

function lineData() {
  return [...lineItems.querySelectorAll('.line-item')].map(row => ({
    description: compact(row.querySelector('.line-description').value),
    amount: numberValue(row.querySelector('.line-amount').value),
    vatRate: fields.vatRegistered.checked ? numberValue(row.querySelector('.line-vat-rate').value) : 0
  }));
}

function invoiceData() {
  const lines = lineData();
  const subtotal = lines.reduce((sum, item) => sum + item.amount, 0);
  const vat = lines.reduce((sum, item) => sum + item.amount * item.vatRate / 100, 0);
  const paymentTerms = fields.paymentTerms.value === 'custom' ? compact(fields.customTerms.value) : fields.paymentTerms.value;
  return {
    invoiceDate: fields.invoiceDate.value,
    paymentTerms,
    legalName: compact(fields.legalName.value), tradingName: compact(fields.tradingName.value), contractorAddress: compact(fields.contractorAddress.value), contractorEmail: compact(fields.contractorEmail.value), contractorPhone: compact(fields.contractorPhone.value), taxResidence: fields.taxResidence.value,
    projectReference: compact(fields.projectReference.value), currency: fields.currency.value, nonUkResident: fields.nonUkResident.checked, vatRegistered: fields.vatRegistered.checked, vatId: compact(fields.vatId.value), payment: paymentData(), lines, subtotal, vat, total: subtotal + vat
  };
}

function metadataFingerprint(data) {
  const snapshot = JSON.stringify({
    invoiceDate: data.invoiceDate,
    paymentTerms: data.paymentTerms,
    legalName: data.legalName,
    tradingName: data.tradingName,
    contractorAddress: data.contractorAddress,
    contractorEmail: data.contractorEmail,
    contractorPhone: data.contractorPhone,
    taxResidence: data.taxResidence,
    projectReference: data.projectReference,
    currency: data.currency,
    nonUkResident: data.nonUkResident,
    vatRegistered: data.vatRegistered,
    vatId: data.vatId,
    payment: data.payment,
    lines: data.lines
  });
  let hash = 2166136261;
  for (let index = 0; index < snapshot.length; index += 1) {
    hash ^= snapshot.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function invoiceNumber(data) {
  if (!data.legalName || !data.invoiceDate) return '';
  return `DEV-${initials(data.legalName)}-${data.invoiceDate.slice(0, 4)}-${metadataFingerprint(data)}`;
}

function currencyFormatter(currency) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMoney(value, currency = fields.currency.value) { return currencyFormatter(currency).format(value); }

function updateTotalsAndNumber(invoiceNumberOverride) {
  const data = invoiceData();
  const number = invoiceNumberOverride ?? invoiceNumber(data);
  fields.invoiceNumber.value = number;
  document.getElementById('subtotalValue').textContent = formatMoney(data.subtotal, data.currency);
  document.getElementById('vatValue').textContent = formatMoney(data.vat, data.currency);
  document.getElementById('totalValue').textContent = formatMoney(data.total, data.currency);
  updateAccountHolderNotice();
  return { ...data, invoiceNumber: number };
}

function setPaymentMarkup(method) {
  const common = '<label class="full">Account holder name<input name="accountHolder" required></label>';
  const options = {
    uk: `<div class="payment-fields"><label class="full">Bank name<input name="bankName" required></label>${common}<label>Sort code<input name="sortCode" required></label><label>Account number<input name="accountNumber" required></label></div>`,
    international: `<div class="payment-fields"><label class="full">Bank name<input name="bankName" required></label>${common}<label>IBAN<input name="iban" required></label><label>SWIFT / BIC code<input name="swiftBic" required></label></div>`,
    wise: `<div class="payment-fields">${common}<label class="full">Wise email ID<input name="wiseEmail" type="email" required></label></div>`,
    payoneer: `<div class="payment-fields">${common}<label class="full">Payoneer email ID<input name="payoneerEmail" type="email" required></label></div>`
  };
  paymentFields.innerHTML = options[method];
}

function updatePaymentFields() {
  const old = paymentData();
  setPaymentMarkup(fields.paymentMethod.value);
  for (const input of paymentFields.querySelectorAll('input')) if (old[input.name]) input.value = old[input.name];
  updateTotalsAndNumber();
}

function updateAccountHolderNotice() {
  const holder = paymentFields.querySelector('[name="accountHolder"]');
  const note = document.getElementById('accountHolderNote');
  if (!holder) return;
  const legalName = fields.legalName.value.trim();
  const accountHolder = holder.value.trim();
  const mismatch = accountHolder && legalName && accountHolder !== legalName;
  holder.setCustomValidity(mismatch ? 'Account holder name must exactly match the contractor legal name.' : '');
  note.textContent = mismatch ? 'Account holder name must exactly match the contractor legal name.' : '';
}

function addLineItem(values = {}) {
  const fragment = lineItemTemplate.content.cloneNode(true);
  const row = fragment.querySelector('.line-item');
  row.querySelector('.line-description').value = values.description || '';
  row.querySelector('.line-amount').value = values.amount || '';
  row.querySelector('.line-vat-rate').value = values.vatRate ?? '';
  row.querySelector('.remove-line').addEventListener('click', () => { if (lineItems.children.length > 1) { row.remove(); updateTotalsAndNumber(); void renderInvoice(); } });
  lineItems.append(fragment);
  syncVatLineItems();
}

function syncVatLineItems() {
  for (const row of lineItems.querySelectorAll('.line-item')) {
    const vatInput = row.querySelector('.line-vat-rate');
    row.classList.toggle('vat-enabled', fields.vatRegistered.checked);
    vatInput.required = fields.vatRegistered.checked;
    vatInput.disabled = !fields.vatRegistered.checked;
  }
  document.getElementById('vatIdWrap').hidden = !fields.vatRegistered.checked;
  fields.vatId.required = fields.vatRegistered.checked;
  fields.vatId.disabled = !fields.vatRegistered.checked;
}

function wrapText(text, maxWidth, font) {
  context.font = font;
  const output = [];
  for (const paragraph of String(text || '').split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width <= maxWidth || !line) line = test;
      else { output.push(line); line = word; }
    }
    if (line) output.push(line);
  }
  return output.length ? output : [''];
}

function drawLines(lines, x, y, options = {}) {
  const { font = '28px Inter, Arial', color = '#111', lineHeight = 40, maxLines = Infinity } = options;
  context.font = font; context.fillStyle = color;
  lines.slice(0, maxLines).forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + Math.min(lines.length, maxLines) * lineHeight;
}

function renderInvoice(invoiceNumberOverride) {
  const data = updateTotalsAndNumber(invoiceNumberOverride);
  context.fillStyle = '#fff'; context.fillRect(0, 0, PAGE.width, PAGE.height);
  const left = PAGE.margin; const right = PAGE.width - PAGE.margin; let y = PAGE.margin;
  context.fillStyle = '#111'; context.font = '700 54px Inter, Arial'; context.fillText('Avalanche', left, y);
  context.textAlign = 'right'; context.font = '700 62px Inter, Arial'; context.fillText('Developer invoice', right, y); context.textAlign = 'left';
  y += 34; context.strokeStyle = '#111'; context.lineWidth = 2; context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke(); y += 48;
  context.font = '700 22px Inter, Arial'; context.fillText('FROM', left, y); context.fillText('TO', 690, y); y += 34;
  const fromLines = [data.legalName || 'Contractor legal name', data.tradingName, ...wrapText(data.contractorAddress || 'Contractor address', 500, '27px Inter, Arial'), data.contractorEmail, data.contractorPhone, data.taxResidence].filter(Boolean);
  drawLines(fromLines, left, y, { font: '27px Inter, Arial', lineHeight: 37 });
  drawLines([AVALANCHE.name, ...AVALANCHE.address, AVALANCHE.email], 690, y, { font: '27px Inter, Arial', lineHeight: 37 });
  y += Math.max(fromLines.length, 5) * 37 + 48;
  context.fillStyle = '#f0f0f0'; context.fillRect(left, y, right - left, 102); context.fillStyle = '#111'; context.font = '700 22px Inter, Arial';
  context.fillText('INVOICE NUMBER', left + 20, y + 30); context.fillText('INVOICE DATE', left + 430, y + 30); context.fillText('PAYMENT TERMS', left + 710, y + 30);
  context.font = '26px Inter, Arial'; context.fillText(data.invoiceNumber, left + 20, y + 70); context.fillText(data.invoiceDate || '—', left + 430, y + 70); context.fillText(data.paymentTerms || '—', left + 710, y + 70); y += 145;
  context.font = '700 26px Inter, Arial'; context.fillText('Project / reference', left, y); y += 35; y = drawLines(wrapText(data.projectReference || 'Project reference', right - left, '30px Inter, Arial'), left, y, { font: '30px Inter, Arial', lineHeight: 42, maxLines: 2 }) + 28;
  context.fillStyle = '#111'; context.fillRect(left, y, right - left, 46); context.fillStyle = '#fff'; context.font = '700 20px Inter, Arial'; context.fillText('DESCRIPTION OF SERVICES', left + 16, y + 30); context.textAlign = 'right'; context.fillText('AMOUNT', right - 16, y + 30); context.textAlign = 'left'; y += 46;
  data.lines.forEach((item, index) => { if (index % 2 === 0) { context.fillStyle = '#f6f6f6'; context.fillRect(left, y, right - left, 58); } const description = item.description || 'Service description'; context.fillStyle = '#111'; context.font = '24px Inter, Arial'; context.fillText(description.slice(0, 74), left + 16, y + 36); context.textAlign = 'right'; context.fillText(formatMoney(item.amount, data.currency), right - 16, y + 36); context.textAlign = 'left'; y += 58; });
  y += 22; const totalsX = 650; context.font = '25px Inter, Arial'; context.fillText('Subtotal', totalsX, y); context.textAlign = 'right'; context.fillText(formatMoney(data.subtotal, data.currency), right, y); y += 40; context.textAlign = 'left'; context.fillText('VAT / sales tax', totalsX, y); context.textAlign = 'right'; context.fillText(formatMoney(data.vat, data.currency), right, y); y += 50; context.strokeStyle = '#111'; context.beginPath(); context.moveTo(totalsX, y - 20); context.lineTo(right, y - 20); context.stroke(); context.font = '700 32px Inter, Arial'; context.textAlign = 'left'; context.fillText('TOTAL AMOUNT DUE', totalsX, y + 15); context.textAlign = 'right'; context.fillText(formatMoney(data.total, data.currency), right, y + 15); context.textAlign = 'left'; y += 94;
  context.font = '700 22px Inter, Arial'; context.fillText('Payment details', left, y); y += 32; const paymentLines = Object.entries(data.payment).filter(([key, value]) => key !== 'method' && value).map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())}: ${value}`); y = drawLines(paymentLines, left, y, { font: '23px Inter, Arial', lineHeight: 33 }) + 25;
  const footer = []; if (!data.vatRegistered) footer.push('Not VAT registered.'); if (data.nonUkResident) footer.push('Declaration: Services were performed entirely outside of the United Kingdom. No UK PAYE or National Insurance applies. The contractor is responsible for local income taxes in their resident jurisdiction.');
  if (footer.length && y < PAGE.height - 125) { context.strokeStyle = '#bbb'; context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke(); y += 30; for (const paragraph of footer) y = drawLines(wrapText(paragraph, right - left, '20px Inter, Arial'), left, y, { font: '20px Inter, Arial', color: '#444', lineHeight: 29 }) + 9; }
}

function validateDynamicFields() {
  const rows = [...lineItems.querySelectorAll('.line-item')];
  const validLines = rows.length > 0 && rows.every(row => row.querySelector('.line-description').value.trim() && numberValue(row.querySelector('.line-amount').value) > 0 && (!fields.vatRegistered.checked || row.querySelector('.line-vat-rate').value !== ''));
  if (!validLines) return false;
  if (fields.paymentTerms.value === 'custom' && !fields.customTerms.value.trim()) return false;
  updateAccountHolderNotice();
  const holder = paymentFields.querySelector('[name="accountHolder"]');
  return !holder || !holder.validationMessage;
}

function downloadPdf(data) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  pdf.addImage(previewCanvas.toDataURL('image/jpeg', .95), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  pdf.save(`${data.invoiceNumber.toLowerCase()}.pdf`);
}

function populateCountries() { COUNTRIES.forEach(country => fields.taxResidence.add(new Option(country, country))); }

fields.invoiceDate.value = todayForInput();
populateCountries();
addLineItem();
updatePaymentFields();
renderInvoice();

document.getElementById('addLineItem').addEventListener('click', () => { addLineItem(); updateTotalsAndNumber(); });
document.getElementById('updatePreview').addEventListener('click', () => renderInvoice());
fields.paymentMethod.addEventListener('change', updatePaymentFields);
fields.paymentTerms.addEventListener('change', () => { const custom = fields.paymentTerms.value === 'custom'; document.getElementById('customTermsWrap').hidden = !custom; fields.customTerms.required = custom; updateTotalsAndNumber(); });
fields.vatRegistered.addEventListener('change', () => { syncVatLineItems(); updateTotalsAndNumber(); renderInvoice(); });
form.addEventListener('input', () => { updateTotalsAndNumber(); });
form.addEventListener('change', () => { updateTotalsAndNumber(); });
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.checkValidity() || !validateDynamicFields()) { form.reportValidity(); return; }
  const data = invoiceData();
  const number = invoiceNumber(data);
  renderInvoice(number);
  downloadPdf({ ...data, invoiceNumber: number });
  updateTotalsAndNumber();
});

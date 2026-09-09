# Invoice API

The API generates **client invoices** using the existing client SVG and JavaScript calculations. The developer/contractor workflow remains available through its browser page.

## Run locally

Requires Node.js 22 or newer and Chromium's system libraries.

Browser installation follows the [official Playwright instructions](https://playwright.dev/docs/browsers).

```bash
npm ci
npm run install:browser
```

Create a `.env` file containing `INVOICE_API_KEY=<your-secret>` (at least 32 characters). Generate a secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Then run `npm start`. The site and API are available at `http://localhost:3000`. Keep the secret on the calling application's backend, never in public browser code. `.env` is excluded from Git.

## Generate an invoice

`POST /api/invoices` requires `Authorization: Bearer <secret>` and `Content-Type: application/json`.

```bash
curl http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $INVOICE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"issuedDate":"2026-09-06","dueDate":"2026-09-20","billedTo":"Example Ltd\n123 Example Street","paymentHeading":"Website development","total":1600,"taxPercent":20,"paid":false,"printable":false,"format":"pdf"}' \
  --output invoice.pdf
```

Export `INVOICE_API_KEY` in the calling shell before using this example; the server's `.env` is not automatically loaded into curl's shell.

Required fields: `issuedDate`, `dueDate` (YYYY-MM-DD), `billedTo`, `paymentHeading` (up to 42 characters), `total` (tax-inclusive GBP amount), and `taxPercent` (0–100). Amounts accept at most two decimal places. Client details must fit four rendered lines; overflow is rejected.

Optional fields: `paid` and `printable` (booleans, default false), and `format` (`pdf` by default, or `json`).

`addToGoogleSheets` is an optional boolean (default `false`), matching the client form toggle. When enabled, the API adds one Revenue row and returns `invoice.googleSheets` with either `added` or `already-recorded`. It does not affect the PDF or invoice number.

JSON responses contain `invoice` metadata (invoice number, dates, recipient, payment heading, GBP total/subtotal/tax, tax percentage, payment status, outstanding balance and IBAN), plus `pdf: {filename, contentType, base64}`. PDF responses return the file bytes and an `X-Invoice-Number` header. Successful generation returns HTTP 200.

Errors return `{ "error": "..." }`: 400 for invalid data, 401 for authentication, 405 for method, 413 for payloads above 16 KB, 415 for content type, 503 when both render slots are occupied, or 500 for a rendering failure. Retry a 503 with backoff. `GET /api/health` checks the HTTP server, not Chromium readiness.

## Company workflow and Google Sheets

Set these server-side variables to enable the integration: `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_SHEET_NAME=Revenue`, and `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` (a base64-encoded Google service-account JSON key). Share the spreadsheet with the service-account email as an Editor. The API writes Invoice Date, Due Date, invoice number, client name, and pre-tax subtotal as Net Amount. Existing work-date, description, and frequency cells are left blank. Existing invoice numbers are detected before a new row is added.

The Vercel client integration uses `/api/login` and `/api/add-to-sheets`. Set `LOGIN_USERNAME`, `LOGIN_PASSWORD_SHA256`, and `LOGIN_SESSION_SECRET` as private Vercel environment variables. A successful sign-in creates an eight-hour, HTTP-only, same-site session cookie; only that session can request a sheet write. The browser never receives the Google credential or session secret.

## Deployment

Run this backend as a Node service/container with Chromium installed, HTTPS at the reverse proxy, and the API key supplied as an environment secret. Set `HOST=0.0.0.0` in containers and use the platform's `PORT`. Install Chromium and its system dependencies during the image build (`npx playwright install --with-deps chromium` on a supported Linux image). Two renders can run concurrently; add deployment-level request limits for your company workload.

The existing Vercel static frontend can remain where it is. This Node server is a separate service; importing the static repository into Vercel alone does not deploy this API. Rendering uses bundled Inter fonts and blocks outbound browser requests.

## Checks

`npm test` checks validation and the HTTP contract. `TEST_RENDER=1 npm test` additionally generates a real PDF and checks address overflow (requires Chromium).

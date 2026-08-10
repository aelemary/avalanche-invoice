# Avalanche Invoice Generators

This static site contains two browser-only invoice generators for Avalanche Tech Ltd. The homepage lets users choose between the existing client invoice workflow and the internal developer/contractor workflow. Both generate PDFs locally in the browser; no invoice or payment details are stored by the site.

## Routes

- `/` — generator chooser.
- `/client/` — the original Avalanche client invoice generator, including its approved dark invoice layout and printable toggle.
- `/developer/` — a plain internal developer invoice generator with contractor details, line items, payment details, VAT/non-UK declarations, browser-local sequential invoice IDs, and A4 PDF download.

## Run locally

No package installation is required. From the project folder, start a local web server:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser.

Use a local server rather than opening the files directly: the client generator needs to load `client/Avalanche Invoice.editable.svg` at runtime, and browsers block that request when a page is opened from the filesystem.

## Client generator

1. Enter the due date, issued date, client details, payment heading, total including tax, and tax rate. The subtotal and tax amount are calculated automatically.
2. Select **Update preview** when you are ready to refresh the invoice preview.
3. Turn on **Printable** if you need the inverted-colour version.
4. Select **Download PDF** to save the A4 invoice.

Client details can use up to four lines. Longer text wraps to the next available line.

## Client calculations

Enter the invoice total including tax and the tax rate. The generator works backwards to calculate the amounts shown on the invoice:

```text
Subtotal = Total / (1 + tax rate / 100)
Tax amount = Total - Subtotal
```

For example, a £1,600 total at 20% tax produces a £1,333.33 subtotal and £266.67 tax amount.

## Client invoice number

Each invoice receives a deterministic number in the form `I-DDMMYY-XXXXXXXX`.

- `DDMMYY` is the issued date.
- `XXXXXXXX` is an eight-character hexadecimal checksum calculated from the due date, issued date, billed-to details, payment heading, total, and tax rate.

The same invoice values produce the same invoice number; changing any of those values produces a different one. It does not use a stored sequential counter.

## Developer invoice number

Developer invoices use `DEV-INITIALS-YYYY-METADATA`, for example `DEV-NH-2026-8F3A2C1D`.

- `INITIALS` comes from the contractor's legal name.
- `YYYY` comes from the invoice date.
- `METADATA` is an eight-character fingerprint of the invoice details, including the contractor, project, services, tax settings, and payment details.

This avoids needing a database, browser storage, or environment variable. The same developer invoice values produce the same ID; meaningful changes create a different ID.

## Deployment

The repository is ready for a standard Vercel static deployment. Import the repository, use the repository root as the project directory, and leave the build command and output directory unset.

## Project files

- `index.html` and `home.css` — homepage generator chooser.
- `client/` — the original client invoice editor, styling, script, and SVG artwork.
- `developer/` — the internal developer generator, styling, and browser-only PDF script.

The generator uses Google Fonts for Inter and jsPDF from a CDN, so an internet connection is needed for the font and PDF library when running it as supplied.

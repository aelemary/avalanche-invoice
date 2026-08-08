# Avalanche Invoice Generator

A small, browser-based invoice generator for Avalanche Tech Ltd. Fill in the approved fields, update the preview, and download an A4 invoice PDF. The printable toggle creates the same layout with inverted colours.

## Run locally

No package installation is required. From the project folder, start a local web server:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser.

Use a local server rather than opening `index.html` directly: the app needs to load `Avalanche Invoice.editable.svg` at runtime, and browsers block that request when a page is opened from the filesystem.

## Use the generator

1. Enter the due date, issued date, client details, payment heading, total including tax, and tax rate. The subtotal and tax amount are calculated automatically.
2. Select **Update preview** when you are ready to refresh the invoice preview.
3. Turn on **Printable** if you need the inverted-colour version.
4. Select **Download PDF** to save the A4 invoice.

Client details can use up to four lines. Longer text wraps to the next available line.

## Calculations

Enter the invoice total including tax and the tax rate. The generator works backwards to calculate the amounts shown on the invoice:

```text
Subtotal = Total / (1 + tax rate / 100)
Tax amount = Total - Subtotal
```

For example, a £1,600 total at 20% tax produces a £1,333.33 subtotal and £266.67 tax amount.

## Invoice number

Each invoice receives a deterministic number in the form `I-DDMMYY-XXXXXXXX`.

- `DDMMYY` is the issued date.
- `XXXXXXXX` is an eight-character hexadecimal checksum calculated from the due date, issued date, billed-to details, payment heading, total, and tax rate.

The same invoice values produce the same invoice number; changing any of those values produces a different one. It does not use a stored sequential counter.

## Project files

- `index.html` — editor and preview interface.
- `styles.css` — generator interface styling.
- `script.js` — SVG value updates, preview rendering, and PDF download.
- `Avalanche Invoice.editable.svg` — the source invoice artwork and editable SVG text fields.

The generator uses Google Fonts for Inter and jsPDF from a CDN, so an internet connection is needed for the font and PDF library when running it as supplied.

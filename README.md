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

1. Enter the due date, issued date, client details, payment heading, subtotal, and tax rate.
2. Select **Update preview** when you are ready to refresh the invoice preview.
3. Turn on **Printable** if you need the inverted-colour version.
4. Select **Download PDF** to save the A4 invoice.

Client details can use up to four lines. Longer text wraps to the next available line.

## Project files

- `index.html` — editor and preview interface.
- `styles.css` — generator interface styling.
- `script.js` — SVG value updates, preview rendering, and PDF download.
- `Avalanche Invoice.editable.svg` — the source invoice artwork and editable SVG text fields.

The generator uses Google Fonts for Inter and jsPDF from a CDN, so an internet connection is needed for the font and PDF library when running it as supplied.

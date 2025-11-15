# Markdown to PDF Converter

A Node.js tool for converting Markdown files to PDF format.

## Installation

Install the required dependencies:

```bash
npm install
```

## Usage

### Convert all markdown files in the docs directory

```bash
npm run convert
# or
node convert.js
```

### Convert specific markdown file(s)

```bash
node convert.js card-system-design-spec.md
node convert.js file1.md file2.md
```

### Convert all markdown files explicitly

```bash
npm run convert:all
# or
node convert.js --all
```

## Output

PDF files are generated in the `converter` directory with the same name as the source markdown file (with `.pdf` extension).

For example:
- `../card-system-design-spec.md` → `card-system-design-spec.pdf`

## Customization

### Styling

Edit `styles.css` to customize the appearance of the generated PDFs. The styles follow GitHub's markdown styling conventions.

### PDF Options

Edit `convert.js` to modify PDF generation options such as:
- Page format (A4, Letter, etc.)
- Margins
- Print background
- Other PDF settings

## Requirements

- Node.js (v12 or higher)
- npm

## Dependencies

- `md-to-pdf`: Converts markdown to PDF using Puppeteer



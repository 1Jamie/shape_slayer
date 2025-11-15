#!/usr/bin/env node

const { mdToPdf } = require('md-to-pdf');
const fs = require('fs');
const path = require('path');

/**
 * Convert a markdown file to PDF
 * @param {string} inputPath - Path to the markdown file
 * @param {string} outputPath - Path for the output PDF file
 */
async function convertMdToPdf(inputPath, outputPath) {
  try {
    console.log(`Converting ${inputPath} to ${outputPath}...`);
    
    const pdf = await mdToPdf(
      { path: inputPath },
      {
        pdf_options: {
          format: 'A4',
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
          },
          printBackground: true
        },
        stylesheet: path.join(__dirname, 'styles.css'),
        body_class: 'markdown-body',
        launch_options: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      }
    );

    if (pdf) {
      fs.writeFileSync(outputPath, pdf.content);
      console.log(`✓ Successfully created ${outputPath}`);
    } else {
      console.error('✗ Failed to generate PDF');
      process.exit(1);
    }
  } catch (error) {
    console.error(`✗ Error converting ${inputPath}:`, error.message);
    process.exit(1);
  }
}

/**
 * Get all markdown files in a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} Array of markdown file paths
 */
function getMarkdownFiles(dir) {
  const files = fs.readdirSync(dir);
  return files
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(dir, file));
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const docsDir = path.join(__dirname, '..');
  const converterDir = __dirname;

  // Check if --all flag is set
  if (args.includes('--all')) {
    const mdFiles = getMarkdownFiles(docsDir);
    
    if (mdFiles.length === 0) {
      console.log('No markdown files found in docs directory');
      return;
    }

    console.log(`Found ${mdFiles.length} markdown file(s):`);
    for (const mdFile of mdFiles) {
      const fileName = path.basename(mdFile, '.md');
      const outputPath = path.join(converterDir, `${fileName}.pdf`);
      await convertMdToPdf(mdFile, outputPath);
    }
  } else if (args.length > 0) {
    // Convert specific file(s)
    for (const arg of args) {
      const inputPath = path.isAbsolute(arg) ? arg : path.join(docsDir, arg);
      
      if (!fs.existsSync(inputPath)) {
        console.error(`✗ File not found: ${inputPath}`);
        continue;
      }

      if (!inputPath.endsWith('.md')) {
        console.error(`✗ Not a markdown file: ${inputPath}`);
        continue;
      }

      const fileName = path.basename(inputPath, '.md');
      const outputPath = path.join(converterDir, `${fileName}.pdf`);
      await convertMdToPdf(inputPath, outputPath);
    }
  } else {
    // Default: convert all markdown files in docs directory
    const mdFiles = getMarkdownFiles(docsDir);
    
    if (mdFiles.length === 0) {
      console.log('No markdown files found in docs directory');
      console.log('\nUsage:');
      console.log('  node convert.js [file1.md] [file2.md] ...  Convert specific files');
      console.log('  node convert.js --all                      Convert all markdown files in docs directory');
      return;
    }

    console.log(`Found ${mdFiles.length} markdown file(s):`);
    for (const mdFile of mdFiles) {
      const fileName = path.basename(mdFile, '.md');
      const outputPath = path.join(converterDir, `${fileName}.pdf`);
      await convertMdToPdf(mdFile, outputPath);
    }
  }
}

// Run the converter
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


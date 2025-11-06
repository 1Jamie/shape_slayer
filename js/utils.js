// Utility functions

// Calculate distance between two points
function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// Normalize a vector
function normalize(x, y) {
    const len = Math.sqrt(x * x + y * y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
}

// Clamp a value between min and max
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Linear interpolation
function lerp(start, end, t) {
    return start + (end - start) * t;
}

// Random number between min and max (inclusive)
function random(min, max) {
    return Math.random() * (max - min) + min;
}

// Random integer between min and max (inclusive)
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simple markdown parser for formatting text
// Returns array of segments: {text: string, bold: boolean, italic: boolean, quote: boolean, color: string, header: number}
function parseMarkdownLine(text) {
    const segments = [];
    let currentText = '';
    let i = 0;
    
    // Check for headers first (## or ###)
    let headerLevel = 0;
    if (text.startsWith('## ')) {
        headerLevel = 2;
        text = text.substring(3).trim();
    } else if (text.startsWith('### ')) {
        headerLevel = 3;
        text = text.substring(4).trim();
    }
    
    while (i < text.length) {
        // Check for **bold**
        if (text[i] === '*' && text[i + 1] === '*') {
            // Save current text if any
            if (currentText) {
                segments.push({ text: currentText, bold: false, italic: false, quote: false, color: null, header: headerLevel });
                currentText = '';
            }
            
            // Find closing **
            i += 2;
            let boldText = '';
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '*')) {
                boldText += text[i];
                i++;
            }
            if (i < text.length) {
                segments.push({ text: boldText, bold: true, italic: false, quote: false, color: null, header: headerLevel });
                i += 2; // Skip closing **
            }
        }
        // Check for *"quote"* (developer dialog/quotes)
        else if (text[i] === '*' && text[i + 1] === '"') {
            // Save current text if any
            if (currentText) {
                segments.push({ text: currentText, bold: false, italic: false, quote: false, color: null, header: headerLevel });
                currentText = '';
            }
            
            // Find closing "*
            i += 2; // Skip *"
            let quoteText = '';
            while (i < text.length && !(text[i] === '"' && text[i + 1] === '*')) {
                quoteText += text[i];
                i++;
            }
            if (i < text.length) {
                // Add opening and closing quotes to the text
                segments.push({ text: `"${quoteText}"`, bold: false, italic: true, quote: true, color: '#88ddff', header: headerLevel });
                i += 2; // Skip "*
            }
        } else {
            currentText += text[i];
            i++;
        }
    }
    
    // Add remaining text
    if (currentText) {
        segments.push({ text: currentText, bold: false, italic: false, quote: false, color: null, header: headerLevel });
    }
    
    return segments;
}

// Render a markdown line with formatting on canvas
// Returns the final position after rendering
function renderMarkdownLine(ctx, line, x, y, maxWidth, baseColor = '#cccccc') {
    const segments = parseMarkdownLine(line);
    let currentX = x;
    
    segments.forEach(segment => {
        // Set font style (italic for quotes, bold for headers)
        const fontSize = '18px';
        let fontStyle = '';
        if (segment.italic) fontStyle = 'italic ';
        if (segment.bold) fontStyle += 'bold ';
        ctx.font = `${fontStyle}${fontSize} Arial`;
        
        // Set color (special color for quotes)
        ctx.fillStyle = segment.color || (segment.bold ? '#ffdd88' : baseColor);
        
        // Word wrap within segment if needed
        const words = segment.text.split(' ');
        words.forEach((word, wordIndex) => {
            const wordWithSpace = wordIndex < words.length - 1 ? word + ' ' : word;
            const wordWidth = ctx.measureText(wordWithSpace).width;
            
            // Check if word fits on current line
            if (currentX + wordWidth > x + maxWidth && currentX > x) {
                // Move to next line
                y += 28;
                currentX = x;
            }
            
            ctx.fillText(wordWithSpace, currentX, y);
            currentX += wordWidth;
        });
    });
    
    return { x: currentX, y: y };
}



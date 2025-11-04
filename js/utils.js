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
// Returns array of segments: {text: string, bold: boolean, color: string}
function parseMarkdownLine(text) {
    const segments = [];
    let currentText = '';
    let i = 0;
    
    while (i < text.length) {
        // Check for **bold**
        if (text[i] === '*' && text[i + 1] === '*') {
            // Save current text if any
            if (currentText) {
                segments.push({ text: currentText, bold: false, color: null });
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
                segments.push({ text: boldText, bold: true, color: null });
                i += 2; // Skip closing **
            }
        } else {
            currentText += text[i];
            i++;
        }
    }
    
    // Add remaining text
    if (currentText) {
        segments.push({ text: currentText, bold: false, color: null });
    }
    
    return segments;
}

// Render a markdown line with formatting on canvas
// Returns the final position after rendering
function renderMarkdownLine(ctx, line, x, y, maxWidth, baseColor = '#cccccc') {
    const segments = parseMarkdownLine(line);
    let currentX = x;
    
    segments.forEach(segment => {
        // Set font style
        const fontSize = '18px';
        ctx.font = segment.bold ? `bold ${fontSize} Arial` : `${fontSize} Arial`;
        ctx.fillStyle = segment.color || baseColor;
        
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



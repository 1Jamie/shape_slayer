const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveUrlPathWithinRoot } = require('./lib/path-security');

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const PORT = 3000;
const IP = getLocalIP();
const ROOT_DIR = path.resolve(__dirname);

const ALLOWED_ROOT_FILES = new Set(['index.html', 'privacy.html', 'manifest.json', 'sw.js']);
const ALLOWED_DIRECTORIES = new Set(['css', 'js', 'ui', 'audio', 'icons', 'fonts']);

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.map': 'application/json',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function resolveGameFilePath(urlPath) {
    return resolveUrlPathWithinRoot(ROOT_DIR, urlPath, {
        defaultFile: 'index.html',
        allowedRootFiles: ALLOWED_ROOT_FILES,
        allowedTopLevelDirectories: ALLOWED_DIRECTORIES
    });
}

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    const filePath = resolveGameFilePath(req.url);
    if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const extname = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`  Shape Slayer Server Running`);
    console.log(`========================================`);
    console.log(`  Local:    http://localhost:${PORT}`);
    console.log(`  Network:  http://${IP}:${PORT}`);
    console.log(`========================================\n`);
});

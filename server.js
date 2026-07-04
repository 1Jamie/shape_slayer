const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Get local network IP address
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

const ALLOWED_ROOT_FILES = new Set(['index.html', 'privacy.html', 'manifest.json']);
const ALLOWED_DIRECTORIES = new Set(['css', 'js', 'ui', 'audio']);

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.map': 'application/json',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function resolveGameFilePath(urlPath) {
    const pathname = new URL(urlPath, 'http://localhost').pathname;
    if (pathname.includes('\0')) {
        return null;
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    if (!relativePath) {
        return null;
    }

    const segments = relativePath.split('/');
    if (segments.some((segment) => !segment || segment === '..' || segment.startsWith('.'))) {
        return null;
    }

    const [rootSegment] = segments;
    const isAllowed = ALLOWED_ROOT_FILES.has(relativePath)
        || ALLOWED_DIRECTORIES.has(rootSegment);
    if (!isAllowed) {
        return null;
    }

    const resolvedPath = path.resolve(ROOT_DIR, relativePath);
    if (resolvedPath !== ROOT_DIR && !resolvedPath.startsWith(ROOT_DIR + path.sep)) {
        return null;
    }

    return resolvedPath;
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

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pipeline } = require('stream');
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

const PORT = Number(process.env.STATIC_PORT || 3000);
const VERBOSE = process.env.STATIC_VERBOSE === '1' || process.env.STATIC_VERBOSE === 'true';
const IP = getLocalIP();
const ROOT_DIR = path.resolve(__dirname);

const ALLOWED_ROOT_FILES = new Set(['index.html', 'privacy.html', 'manifest.json', 'sw.js']);
const ALLOWED_DIRECTORIES = new Set(['src', 'assets']);

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

function cacheControlFor(filePath) {
    const relative = path.relative(ROOT_DIR, filePath).split(path.sep).join('/');
    if (
        relative === 'index.html' ||
        relative === 'sw.js' ||
        relative === 'manifest.json' ||
        relative === 'privacy.html'
    ) {
        return 'no-cache';
    }
    if (relative.startsWith('assets/')) {
        return 'public, max-age=31536000, immutable';
    }
    return 'public, max-age=60';
}

const server = http.createServer((req, res) => {
    if (VERBOSE) {
        console.log(`${req.method} ${req.url}`);
    }

    const filePath = resolveGameFilePath(req.url);
    if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const extname = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.stat(filePath, (statErr, stats) => {
        if (statErr) {
            if (statErr.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + statErr.code);
            }
            return;
        }

        if (!stats.isFile()) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Cache-Control': cacheControlFor(filePath),
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Resource-Policy': 'cross-origin'
        });

        pipeline(fs.createReadStream(filePath), res, (err) => {
            if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
                console.error('[static-server] stream error:', err.message);
            }
        });
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(
            `[static-server] Port ${PORT} is already in use. Set STATIC_PORT to another port and retry.`
        );
        process.exit(1);
    }
    console.error('[static-server] listen error:', err);
    process.exit(1);
});

function shutdown() {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`  Shape Slayer Server Running`);
    console.log(`========================================`);
    console.log(`  Local:    http://localhost:${PORT}`);
    console.log(`  Network:  http://${IP}:${PORT}`);
    console.log(`========================================\n`);
});

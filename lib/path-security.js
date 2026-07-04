const path = require('path');

const TRAVERSAL_PATTERN = /(?:^|[\\/])\.\.(?:[\\/]|$)|%2e%2e|%252e/i;

function containsTraversal(input) {
    if (typeof input !== 'string' || !input) {
        return true;
    }
    if (input.includes('\0')) {
        return true;
    }
    return TRAVERSAL_PATTERN.test(input);
}

function isPathInsideRoot(rootDir, candidatePath) {
    const root = path.resolve(rootDir);
    const resolved = path.resolve(candidatePath);
    return resolved === root || resolved.startsWith(root + path.sep);
}

function resolvePathWithinRoot(rootDir, relativePath) {
    if (typeof relativePath !== 'string' || !relativePath.trim()) {
        return null;
    }

    const normalized = relativePath.replace(/^[/\\]+/, '');
    if (!normalized || containsTraversal(normalized)) {
        return null;
    }

    const segments = normalized.split(/[\\/]+/);
    if (segments.some((segment) => !segment || segment === '.' || segment.startsWith('.'))) {
        return null;
    }

    const resolvedPath = path.resolve(rootDir, normalized);
    if (!isPathInsideRoot(rootDir, resolvedPath)) {
        return null;
    }

    return resolvedPath;
}

function resolveUrlPathWithinRoot(rootDir, urlPath, options = {}) {
    const {
        defaultFile = null,
        allowedRootFiles = null,
        allowedTopLevelDirectories = null
    } = options;

    let pathname;
    try {
        pathname = new URL(urlPath, 'http://localhost').pathname;
    } catch (error) {
        return null;
    }

    if (containsTraversal(pathname)) {
        return null;
    }

    const relativePath = pathname === '/' ? (defaultFile || null) : pathname.replace(/^\/+/, '');
    if (!relativePath) {
        return null;
    }

    if (allowedRootFiles instanceof Set && allowedRootFiles.has(relativePath)) {
        return resolvePathWithinRoot(rootDir, relativePath);
    }

    if (allowedTopLevelDirectories instanceof Set) {
        const [rootSegment] = relativePath.split('/');
        if (!allowedTopLevelDirectories.has(rootSegment)) {
            return null;
        }
    }

    return resolvePathWithinRoot(rootDir, relativePath);
}

function resolveSafeAbsolutePath(requestedPath, defaultPath) {
    const fallback = path.resolve(defaultPath);
    if (!requestedPath) {
        return fallback;
    }

    if (containsTraversal(requestedPath)) {
        throw new Error(`Configured path contains traversal segments: ${requestedPath}`);
    }

    return path.resolve(requestedPath);
}

function resolveConfiguredFilePath(requestedPath, defaultPath, allowedRootDir) {
    const fallback = path.resolve(defaultPath);
    if (!requestedPath) {
        return fallback;
    }

    const resolved = path.resolve(requestedPath);
    if (!isPathInsideRoot(allowedRootDir, resolved)) {
        throw new Error(`Configured path escapes allowed directory: ${requestedPath}`);
    }

    return resolved;
}

function isSafeIdentifier(value, { maxLength = 128, pattern = /^[a-zA-Z0-9_-]+$/ } = {}) {
    return typeof value === 'string'
        && value.length > 0
        && value.length <= maxLength
        && pattern.test(value);
}

function rejectTraversalRequests(req, res, next) {
    const target = `${req.originalUrl || req.url || ''}${req.path || ''}`;
    if (containsTraversal(target)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    next();
}

module.exports = {
    containsTraversal,
    isPathInsideRoot,
    resolvePathWithinRoot,
    resolveUrlPathWithinRoot,
    resolveSafeAbsolutePath,
    resolveConfiguredFilePath,
    isSafeIdentifier,
    rejectTraversalRequests
};

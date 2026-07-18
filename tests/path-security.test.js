const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const {
    containsTraversal,
    isPathInsideRoot,
    resolvePathWithinRoot,
    resolveUrlPathWithinRoot,
    resolveSafeAbsolutePath,
    resolveConfiguredFilePath,
    isSafeIdentifier
} = require('../lib/path-security');

test('containsTraversal detects encoded and literal traversal', () => {
    assert.strictEqual(containsTraversal('/css/app.css'), false);
    assert.strictEqual(containsTraversal('/../etc/passwd'), true);
    assert.strictEqual(containsTraversal('/%2e%2e/secret'), true);
    assert.strictEqual(containsTraversal('/safe/%2e%2e/etc'), true);
    assert.strictEqual(containsTraversal('safe\0hidden'), true);
});

test('resolvePathWithinRoot blocks escape attempts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-security-'));
    try {
        fs.writeFileSync(path.join(root, 'index.html'), 'ok');
        assert.strictEqual(resolvePathWithinRoot(root, 'index.html'), path.join(root, 'index.html'));
        assert.strictEqual(resolvePathWithinRoot(root, '../outside.txt'), null);
        assert.strictEqual(resolvePathWithinRoot(root, '.hidden'), null);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('resolveUrlPathWithinRoot enforces allowlists', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-security-url-'));
    try {
        fs.mkdirSync(path.join(root, 'src', 'js'), { recursive: true });
        fs.writeFileSync(path.join(root, 'index.html'), 'ok');
        fs.writeFileSync(path.join(root, 'src', 'js', 'main.js'), 'ok');

        const options = {
            defaultFile: 'index.html',
            allowedRootFiles: new Set(['index.html']),
            allowedTopLevelDirectories: new Set(['src'])
        };

        assert.ok(resolveUrlPathWithinRoot(root, '/', options));
        assert.ok(resolveUrlPathWithinRoot(root, '/src/js/main.js', options));
        assert.strictEqual(resolveUrlPathWithinRoot(root, '/metrics/secret', options), null);
        assert.strictEqual(resolveUrlPathWithinRoot(root, '/src/js/../../etc/passwd', options), null);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('resolveSafeAbsolutePath rejects traversal in configured paths', () => {
    const defaultPath = path.join(os.tmpdir(), 'metrics.sqlite');
    assert.throws(
        () => resolveSafeAbsolutePath('../outside/metrics.sqlite', defaultPath),
        /traversal segments/
    );
    const resolved = resolveSafeAbsolutePath(path.join(os.tmpdir(), 'nested', 'metrics.sqlite'), defaultPath);
    assert.strictEqual(resolved, path.resolve(path.join(os.tmpdir(), 'nested', 'metrics.sqlite')));
});

test('resolveConfiguredFilePath keeps env paths inside allowed root', () => {
    const allowedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'path-security-db-'));
    const defaultPath = path.join(allowedRoot, 'metrics.sqlite');
    try {
        const inside = path.join(allowedRoot, 'nested', 'metrics.sqlite');
        fs.mkdirSync(path.dirname(inside), { recursive: true });
        assert.strictEqual(
            resolveConfiguredFilePath(inside, defaultPath, allowedRoot),
            inside
        );
        assert.throws(
            () => resolveConfiguredFilePath('/etc/passwd', defaultPath, allowedRoot),
            /escapes allowed directory/
        );
    } finally {
        fs.rmSync(allowedRoot, { recursive: true, force: true });
    }
});

test('isSafeIdentifier validates API ids', () => {
    assert.strictEqual(isSafeIdentifier('run-123'), true);
    assert.strictEqual(isSafeIdentifier('../runs'), false);
    assert.strictEqual(isSafeIdentifier(''), false);
});

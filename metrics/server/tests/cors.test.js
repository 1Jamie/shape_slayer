const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const {
    parseAllowedOrigins,
    resolveCorsOrigin,
    originMatchesPattern,
    DEFAULT_PLAY_ORIGIN_PATTERNS
} = require('../index');

test('default play origins cover gpe, github pages, localhost, and electron null', () => {
    const origins = parseAllowedOrigins(undefined);
    assert.deepStrictEqual(origins, DEFAULT_PLAY_ORIGIN_PATTERNS);

    assert.strictEqual(
        resolveCorsOrigin('https://shape-slayer.gpe.pet', origins),
        'https://shape-slayer.gpe.pet'
    );
    assert.strictEqual(
        resolveCorsOrigin('https://metrics.gpe.pet', origins),
        'https://metrics.gpe.pet'
    );
    assert.strictEqual(
        resolveCorsOrigin('https://1jamie.github.io', origins),
        'https://1jamie.github.io'
    );
    assert.strictEqual(
        resolveCorsOrigin('https://someone.github.io', origins),
        'https://someone.github.io'
    );
    assert.strictEqual(
        resolveCorsOrigin('http://localhost:3000', origins),
        'http://localhost:3000'
    );
    assert.strictEqual(
        resolveCorsOrigin('http://127.0.0.1:8080', origins),
        'http://127.0.0.1:8080'
    );
    assert.strictEqual(resolveCorsOrigin('null', origins), 'null');
    assert.strictEqual(resolveCorsOrigin('https://evil.example', origins), null);
});

test('parseAllowedOrigins supports open * and custom lists', () => {
    assert.deepStrictEqual(parseAllowedOrigins('*'), ['*']);
    assert.deepStrictEqual(
        parseAllowedOrigins('https://a.example, https://b.example'),
        ['https://a.example', 'https://b.example']
    );
    assert.strictEqual(resolveCorsOrigin('https://a.example', ['*']), '*');
    assert.strictEqual(
        resolveCorsOrigin('https://b.example', ['https://a.example', 'https://b.example']),
        'https://b.example'
    );
    assert.strictEqual(
        resolveCorsOrigin('https://c.example', ['https://a.example', 'https://b.example']),
        null
    );
});

test('originMatchesPattern handles wildcard hosts and ports', () => {
    assert.ok(originMatchesPattern('https://foo.gpe.pet', 'https://*.gpe.pet'));
    assert.ok(originMatchesPattern('https://gpe.pet', 'https://*.gpe.pet'));
    assert.ok(!originMatchesPattern('http://foo.gpe.pet', 'https://*.gpe.pet'));
    assert.ok(originMatchesPattern('http://localhost:4000', 'http://localhost:*'));
    assert.ok(!originMatchesPattern('http://localhost', 'http://localhost:*'));
    assert.ok(originMatchesPattern('null', 'null'));
});

test('HTTP preflight reflects allowed play origins', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-cors-'));
    process.env.METRICS_DB_PATH = path.join(tmpDir, 'metrics.sqlite');
    delete process.env.METRICS_ALLOWED_ORIGIN;

    // Fresh require so ALLOWED_ORIGINS picks up unset env → default allowlist
    delete require.cache[require.resolve('../db')];
    delete require.cache[require.resolve('../index')];
    const db = require('../db');
    const { createServer } = require('../index');
    const { app } = createServer({ skipListen: true });

    const server = await new Promise(resolve => {
        const httpServer = http.createServer(app);
        httpServer.listen(0, () => resolve(httpServer));
    });
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        const cases = [
            'https://shape-slayer.gpe.pet',
            'https://1jamie.github.io',
            'http://localhost:3000',
            'null'
        ];

        for (const origin of cases) {
            const res = await fetch(`${baseUrl}/ingest`, {
                method: 'OPTIONS',
                headers: {
                    Origin: origin,
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'content-type'
                }
            });
            assert.strictEqual(res.status, 204, `preflight status for ${origin}`);
            assert.strictEqual(
                res.headers.get('access-control-allow-origin'),
                origin,
                `ACAOrigin for ${origin}`
            );
            assert.ok(
                (res.headers.get('access-control-allow-methods') || '').includes('POST')
            );
        }

        const blocked = await fetch(`${baseUrl}/ingest`, {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://evil.example',
                'Access-Control-Request-Method': 'POST'
            }
        });
        assert.strictEqual(blocked.status, 204);
        assert.strictEqual(blocked.headers.get('access-control-allow-origin'), null);
    } finally {
        await new Promise(resolve => server.close(resolve));
        db.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
        delete process.env.METRICS_DB_PATH;
    }
});

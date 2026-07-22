const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('DOM & Script Loading Order Sanity Checks', async (t) => {
    const root = path.join(__dirname, '..');
    const htmlPath = path.join(root, 'index.html');
    const swPath = path.join(root, 'sw.js');

    assert.ok(fs.existsSync(htmlPath), 'index.html must exist');
    assert.ok(fs.existsSync(swPath), 'sw.js must exist');

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["']/g;
    const scripts = [];
    let match;
    while ((match = scriptRegex.exec(htmlContent)) !== null) {
        scripts.push(match[1]);
    }

    assert.ok(scripts.length > 10, 'index.html must declare script tags');

    await t.test('engine dependencies load before game presentation and simulation modules', () => {
        const engineIndices = {
            camera: scripts.findIndex(s => s.includes('src/engine/camera.js')),
            renderer: scripts.findIndex(s => s.includes('src/engine/renderer.js')),
            split: scripts.findIndex(s => s.includes('src/engine/split.js'))
        };

        const gameIndices = {
            gameCamera: scripts.findIndex(s => s.includes('src/game/presentation/game-camera.js')),
            screenEffects: scripts.findIndex(s => s.includes('src/game/presentation/screen-effects.js')),
            roomTransition: scripts.findIndex(s => s.includes('src/game/simulation/room-transition.js')),
            splitSession: scripts.findIndex(s => s.includes('src/game/simulation/split-session.js')),
            main: scripts.findIndex(s => s.includes('src/game/main.js'))
        };

        if (engineIndices.camera !== -1 && gameIndices.gameCamera !== -1) {
            assert.ok(
                engineIndices.camera < gameIndices.gameCamera,
                'src/engine/camera.js must load BEFORE src/game/presentation/game-camera.js'
            );
        }

        if (gameIndices.gameCamera !== -1 && gameIndices.main !== -1) {
            assert.ok(
                gameIndices.gameCamera < gameIndices.main,
                'src/game/presentation/game-camera.js must load BEFORE src/game/main.js'
            );
        }

        if (gameIndices.roomTransition !== -1 && gameIndices.main !== -1) {
            assert.ok(
                gameIndices.roomTransition < gameIndices.main,
                'src/game/simulation/room-transition.js must load BEFORE src/game/main.js'
            );
        }
    });

    await t.test('sw.js precache array includes all script dependencies from index.html', () => {
        const swContent = fs.readFileSync(swPath, 'utf8');

        scripts.forEach(scriptPath => {
            const relPath = scriptPath.startsWith('./') ? scriptPath : `./${scriptPath}`;
            assert.ok(
                swContent.includes(relPath) || swContent.includes(scriptPath),
                `sw.js PRECACHE_URLS must include script: ${scriptPath}`
            );
        });
    });

    await t.test('every script tag declared in index.html parses as valid JavaScript without syntax errors', () => {
        const vm = require('node:vm');
        scripts.forEach(scriptPath => {
            const fullPath = path.join(root, scriptPath);
            assert.ok(fs.existsSync(fullPath), `Script file must exist on disk: ${scriptPath}`);
            const code = fs.readFileSync(fullPath, 'utf8');
            assert.doesNotThrow(() => {
                new vm.Script(code, { filename: scriptPath });
            }, `SyntaxError in script: ${scriptPath}`);
        });
    });
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

test('FloatingCombatText floats, fades, and renders custom labels', () => {
    const sandbox = {
        console,
        Object,
        Array,
        String,
        Math,
        Number,
        isNaN,
        TypeError,
        DebugFlags: {},
        Game: { damageNumbers: [] }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    // ui.js is large and depends on many globals — extract FloatingCombatText via partial eval
    const source = fs.readFileSync(path.join(ROOT, 'src/game/presentation/ui.js'), 'utf8');
    const start = source.indexOf('class FloatingCombatText');
    const end = source.indexOf('function createFloatingCombatText');
    assert.ok(start >= 0 && end > start);
    const fnStart = end;
    const fnEnd = source.indexOf('\n// Update damage numbers', fnStart);
    const snippet = source.slice(start, fnEnd);
    vm.runInNewContext(snippet + '\nthis.FloatingCombatText = FloatingCombatText;\nthis.createFloatingCombatText = createFloatingCombatText;', sandbox);

    sandbox.createFloatingCombatText(100, 200, '-15', { color: '#ff5533', fontSize: 28, life: 1.0, dy: -70, dx: 0 });
    assert.equal(sandbox.Game.damageNumbers.length, 1);
    const floater = sandbox.Game.damageNumbers[0];
    assert.equal(floater.text, '-15');
    assert.equal(floater.color, '#ff5533');
    assert.equal(floater.update(0.5), true);
    assert.ok(floater.y < 200);
    assert.ok(floater.alpha < 1);
    assert.equal(floater.update(1.0), false);
});

test('ComboMeterUI rank table covers DMC-style Surge tiers', () => {
    const sandbox = {
        console,
        Object,
        Array,
        String,
        Math,
        Number,
        document: {
            readyState: 'complete',
            head: { appendChild() {} },
            body: { appendChild() {} },
            getElementById() { return null; },
            createElement(tag) {
                const el = {
                    tagName: tag,
                    style: {},
                    setAttribute() {},
                    appendChild() {},
                    textContent: '',
                    offsetWidth: 1
                };
                return el;
            },
            addEventListener() {}
        },
        window: null,
        performance: { now: () => 0 },
        requestAnimationFrame() { return 0; },
        setTimeout() {},
        GameBus: {
            subscribe() { return () => {}; }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.window.UIRoot = { ensure: () => sandbox.document.body };
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/ui/components/comboMeter.js'), 'utf8'),
        sandbox
    );
    assert.ok(sandbox.ComboMeterUI);
    assert.equal(sandbox.ComboMeterUI.RANKS[0].name, 'DUST');
    assert.equal(sandbox.ComboMeterUI.RANKS[0].countSize, '48px');
    assert.equal(sandbox.ComboMeterUI.RANKS[0].corners, 'none');

    assert.equal(sandbox.ComboMeterUI.RANKS[1].name, 'SLAYER');
    assert.equal(sandbox.ComboMeterUI.RANKS[1].color, '#00e5ff');

    assert.equal(sandbox.ComboMeterUI.RANKS[2].name, 'RAMPAGE');
    assert.equal(sandbox.ComboMeterUI.RANKS[2].color, '#00ff88');

    assert.equal(sandbox.ComboMeterUI.RANKS[3].name, 'APEX');
    assert.equal(sandbox.ComboMeterUI.RANKS[3].color, '#ff007f');

    assert.equal(sandbox.ComboMeterUI.RANKS[4].name, 'APOCALYPSE');
    assert.equal(sandbox.ComboMeterUI.RANKS[4].color, '#ffcc00');
    assert.equal(sandbox.ComboMeterUI.RANKS[4].countSize, '74px');
    assert.equal(sandbox.ComboMeterUI.RANKS[4].corners, '4-gold-crown');
});


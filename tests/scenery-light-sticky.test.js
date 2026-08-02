const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadRenderQuality() {
    const code = fs.readFileSync(
        path.join(__dirname, '../src/game/presentation/render-quality.js'),
        'utf8'
    );
    const sandbox = {
        window: {},
        globalThis: {},
        Engine: {
            Render: {
                QualityTier: { HIGH: 0, MEDIUM: 1, LOW: 2 },
                Quality: {
                    preset() {
                        return {};
                    }
                }
            }
        }
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.GameRenderQuality;
}

function makeEmitters(count, spacing = 100) {
    const emitters = [];
    for (let i = 0; i < count; i++) {
        emitters.push({
            id: `e${i}`,
            x: i * spacing,
            y: 0,
            radius: 120,
            type: i % 5 === 0 ? 'fixture' : 'scenery'
        });
    }
    return emitters;
}

test('sticky selection stays stable when camera nudges near the cutoff', () => {
    const RQ = loadRenderQuality();
    // Ring of emitters at similar distance so small camera moves reorder the hard top-N.
    const emitters = [];
    for (let i = 0; i < 120; i++) {
        const angle = (i / 120) * Math.PI * 2;
        emitters.push({
            id: `r${i}`,
            x: Math.cos(angle) * 800,
            y: Math.sin(angle) * 800,
            radius: 120,
            type: 'scenery'
        });
    }
    const alwaysVisible = () => true;

    const first = RQ.selectSceneryLightsSticky(emitters, {
        maxLights: 96,
        camX: 0,
        camY: 0,
        isVisible: alwaysVisible
    });
    assert.equal(first.selected.length, 96);

    // Hard nearest-N would reshuffle membership under this nudge.
    const hardBefore = new Set(
        emitters
            .map((e) => {
                const dx = e.x - 0;
                const dy = e.y - 0;
                return { id: e.id, d: dx * dx + dy * dy };
            })
            .sort((a, b) => a.d - b.d)
            .slice(0, 96)
            .map((e) => e.id)
    );
    const hardAfter = new Set(
        emitters
            .map((e) => {
                const dx = e.x - 25;
                const dy = e.y - 18;
                return { id: e.id, d: dx * dx + dy * dy };
            })
            .sort((a, b) => a.d - b.d)
            .slice(0, 96)
            .map((e) => e.id)
    );
    let hardChurn = 0;
    for (const id of hardBefore) {
        if (!hardAfter.has(id)) hardChurn++;
    }
    assert.ok(hardChurn > 0, 'fixture expects hard nearest-N churn on this nudge');

    const second = RQ.selectSceneryLightsSticky(emitters, {
        maxLights: 96,
        camX: 25,
        camY: 18,
        isVisible: alwaysVisible,
        prevIds: first.ids
    });
    assert.equal(second.selected.length, 96);

    let churn = 0;
    for (const id of first.ids) {
        if (!second.ids.has(id)) churn++;
    }
    assert.equal(churn, 0, `expected sticky hold near cutoff, got ${churn} drops`);
});

test('sticky selection eventually admits a clearly closer light', () => {
    const RQ = loadRenderQuality();
    const emitters = makeEmitters(40, 50);
    const alwaysVisible = () => true;

    const first = RQ.selectSceneryLightsSticky(emitters, {
        maxLights: 10,
        camX: 0,
        camY: 0,
        isVisible: alwaysVisible
    });

    // Jump far past the original cluster so previous lights leave the hysteresis band.
    const second = RQ.selectSceneryLightsSticky(emitters, {
        maxLights: 10,
        camX: 1800,
        camY: 0,
        isVisible: alwaysVisible,
        prevIds: first.ids
    });

    assert.equal(second.selected.length, 10);
    let overlap = 0;
    for (const id of first.ids) {
        if (second.ids.has(id)) overlap++;
    }
    assert.ok(overlap < 10, 'camera jump should replace stale sticky lights');
});

test('uncapped path returns all visible emitters', () => {
    const RQ = loadRenderQuality();
    const emitters = makeEmitters(20);
    const picked = RQ.selectSceneryLightsSticky(emitters, {
        maxLights: Infinity,
        camX: 0,
        camY: 0,
        isVisible: (x) => x < 1000
    });
    assert.equal(picked.selected.length, 10);
    assert.equal(picked.ids.size, 10);
});

test('fixture bias prefers lamps over equally distant scenery', () => {
    const RQ = loadRenderQuality();
    const emitters = [
        { id: 's0', x: 100, y: 0, radius: 100, type: 'scenery' },
        { id: 'f0', x: 100, y: 0, radius: 100, type: 'fixture' },
        { id: 's1', x: 200, y: 0, radius: 100, type: 'scenery' }
    ];
    const picked = RQ.selectSceneryLightsSticky(emitters, {
        maxLights: 1,
        camX: 0,
        camY: 0,
        isVisible: () => true
    });
    assert.equal(picked.selected[0].id, 'f0');
});

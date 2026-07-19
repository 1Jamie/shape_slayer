const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createCanvas(options = {}) {
    const width = options.width || 1280;
    const height = options.height || 720;
    const fail2d = !!options.fail2d;
    const ctx = {
        setTransform() {},
        clearRect() {},
        fillRect() {},
        fillStyle: '#000'
    };
    return {
        width,
        height,
        clientWidth: width,
        clientHeight: height,
        style: {},
        getContext(type) {
            if (type !== '2d' || fail2d) return null;
            return ctx;
        }
    };
}

function createDom(canvas) {
    const body = {
        children: [],
        appendChild(node) {
            this.children.push(node);
            node.parentNode = this;
            return node;
        },
        removeChild(node) {
            const index = this.children.indexOf(node);
            if (index >= 0) this.children.splice(index, 1);
            node.parentNode = null;
            return node;
        }
    };
    const uiRoot = {
        id: 'ui-root',
        style: {},
        dataset: {},
        children: [],
        appendChild(node) {
            this.children.push(node);
            node.parentNode = this;
            return node;
        },
        removeChild(node) {
            const index = this.children.indexOf(node);
            if (index >= 0) this.children.splice(index, 1);
            node.parentNode = null;
            return node;
        },
        addEventListener() {},
        removeEventListener() {}
    };
    const elements = new Map([['gameCanvas', canvas], ['ui-root', uiRoot]]);

    function createElement(tag) {
        const el = {
            tagName: String(tag).toUpperCase(),
            className: '',
            hidden: false,
            style: {},
            dataset: {},
            children: [],
            parentNode: null,
            textContent: '',
            disabled: false,
            type: '',
            attributes: Object.create(null),
            listeners: Object.create(null),
            setAttribute(name, value) {
                this.attributes[name] = String(value);
                if (name === 'class') this.className = String(value);
            },
            getAttribute(name) { return this.attributes[name]; },
            querySelector(selector) {
                const attr = /\[data-([^\]]+)\]/.exec(selector);
                if (!attr) return null;
                const raw = attr[1];
                const bootKey = raw.startsWith('boot-') ? raw.slice(5) : raw;
                const walk = (node) => {
                    if (node.dataset) {
                        if (node.dataset[raw] !== undefined || node.dataset[bootKey] !== undefined) return node;
                        if (node.attributes && node.attributes[`data-${raw}`] !== undefined) return node;
                    }
                    for (const child of node.children || []) {
                        const found = walk(child);
                        if (found) return found;
                    }
                    return null;
                };
                return walk(this);
            },
            appendChild(node) {
                this.children.push(node);
                node.parentNode = this;
                return node;
            },
            removeChild(node) {
                const index = this.children.indexOf(node);
                if (index >= 0) this.children.splice(index, 1);
                node.parentNode = null;
                return node;
            },
            addEventListener(type, fn) {
                (this.listeners[type] || (this.listeners[type] = [])).push(fn);
            },
            removeEventListener(type, fn) {
                const list = this.listeners[type] || [];
                const index = list.indexOf(fn);
                if (index >= 0) list.splice(index, 1);
            },
            click() {
                for (const fn of this.listeners.click || []) fn({ preventDefault() {}, stopPropagation() {} });
            }
        };
        el.classList = {
            _owner: el,
            add(...names) {
                const parts = new Set(String(this._owner.className || '').split(/\s+/).filter(Boolean));
                for (const name of names) parts.add(name);
                this._owner.className = Array.from(parts).join(' ');
            },
            remove(...names) {
                const removeSet = new Set(names);
                this._owner.className = String(this._owner.className || '')
                    .split(/\s+/)
                    .filter(name => name && !removeSet.has(name))
                    .join(' ');
            },
            contains(name) {
                return String(this._owner.className || '').split(/\s+/).includes(name);
            }
        };
        Object.defineProperty(el, 'innerHTML', {
            configurable: true,
            get() { return this._html || ''; },
            set(html) {
                this._html = String(html);
                this.children = [];
                const re = /data-boot-([a-z]+)/g;
                let match;
                while ((match = re.exec(this._html)) !== null) {
                    const child = createElement('div');
                    child.dataset[match[1]] = '';
                    child.dataset[`boot-${match[1]}`] = '';
                    child.setAttribute(`data-boot-${match[1]}`, '');
                    this.children.push(child);
                    child.parentNode = this;
                }
            }
        });
        return el;
    }

    return {
        readyState: 'complete',
        body,
        getElementById(id) { return elements.get(id) || null; },
        createElement,
        addEventListener() {},
        removeEventListener() {}
    };
}

// Canvas2D stand-in that records draw calls so tests can assert on the
// cinematic's observable output without a real rasterizer.
function createRecordingContext(log) {
    const calls = log || [];
    const ctx = {
        calls,
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        lineJoin: 'miter',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        font: '',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        measureText(text) { return { width: Math.max(1, String(text).length * 10) }; },
        createRadialGradient() { return { addColorStop() {} }; },
        createLinearGradient() { return { addColorStop() {} }; }
    };
    for (const method of [
        'setTransform', 'resetTransform', 'clearRect', 'fillRect', 'strokeRect',
        'save', 'restore', 'translate', 'rotate', 'scale',
        'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'fill', 'stroke',
        'clip', 'drawImage', 'fillText', 'strokeText'
    ]) {
        ctx[method] = (...args) => {
            calls.push({
                method,
                args,
                composite: ctx.globalCompositeOperation,
                fillStyle: ctx.fillStyle,
                strokeStyle: ctx.strokeStyle,
                font: ctx.font
            });
        };
    }
    return ctx;
}

function loadBootEnvironment(options = {}) {
    const canvas = options.canvas || createCanvas(options);
    const document = options.document || createDom(canvas);
    const storage = options.storage || {
        _data: Object.create(null),
        getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
        setItem(key, value) { this._data[key] = String(value); },
        removeItem(key) { delete this._data[key]; }
    };

    const sandbox = {
        console,
        Math,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        Map,
        Set,
        Date,
        TypeError,
        Error,
        Promise,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        performance: { now: () => Date.now() },
        requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
        devicePixelRatio: options.devicePixelRatio == null ? 2 : options.devicePixelRatio,
        localStorage: options.localStorage === undefined ? storage : options.localStorage,
        navigator: options.navigator || {
            serviceWorker: {},
            hardwareConcurrency: 4,
            deviceMemory: 8
        },
        AudioContext: options.AudioContext === undefined ? function AudioContext() {} : options.AudioContext,
        matchMedia: options.matchMedia || (() => ({ matches: !!options.reducedMotion })),
        document,
        location: { protocol: 'https:', href: 'https://example.test/', reload() { sandbox._reloads = (sandbox._reloads || 0) + 1; } },
        history: { pushState() {} },
        addEventListener() {},
        OffscreenCanvas: class {
            constructor(w, h) { this.width = w; this.height = h; }
            getContext() {
                if (!this._ctx) this._ctx = createRecordingContext();
                return this._ctx;
            }
        },
        window: null,
        globalThis: null,
        Engine: {},
        module: { exports: {} }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    const files = [
        'src/engine/save.js',
        'src/engine/physics.js',
        'src/engine/proc.js',
        'src/engine/graphics.js',
        'src/engine/fx.js',
        'src/engine/render-host.js',
        'src/engine/shell.js',
        'src/engine/ui/root.js',
        'src/engine/ui/boot-cinematic.js',
        'src/engine/ui/boot-screen.js',
        'src/engine/boot.js'
    ];
    for (const relative of files) {
        vm.runInNewContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), sandbox, { filename: relative });
    }

    // Required namespaces not loaded from disk for this focused unit test.
    const stubs = ['System', 'Physics', 'Proc', 'FX', 'Core', 'Audio', 'Input', 'Net', 'UI'];
    for (const name of stubs) {
        sandbox.Engine[name] = sandbox.Engine[name] || { __stub: name };
    }
    sandbox.Engine.System.getProfile = () => ({ isMobile: false, capabilities: {} });
    sandbox.Engine.UI.Root = sandbox.Engine.UI.Root;
    sandbox.Engine.UI.BootScreen = sandbox.Engine.UI.BootScreen;

    return { sandbox, canvas, document, storage };
}

test('Engine.VERSION and Boot probe/verify/initialize publish a frozen ready runtime', () => {
    const { sandbox } = loadBootEnvironment();
    const Boot = sandbox.Engine.Boot;
    assert.equal(sandbox.Engine.VERSION, '0.1a');
    assert.equal(Boot.VERSION, '0.1a');

    const report = Boot.probe({ canvasId: 'gameCanvas', logicalW: 1280, logicalH: 720 });
    assert.equal(report.checks.canvas2d, true);
    const verdict = Boot.verify(report);
    assert.equal(verdict.status, 'ready');

    const runtime = Boot.initialize({ canvasId: 'gameCanvas', logicalW: 1280, logicalH: 720 });
    assert.equal(runtime.ok, true);
    assert.equal(runtime.status, 'ready');
    assert.equal(runtime.version, '0.1a');
    assert.ok(runtime.canvas);
    assert.ok(runtime.ctx);
    assert.equal(runtime.poolWarmed, true);
    assert.ok(Object.isFrozen(runtime));
    assert.equal(Boot.initialize({ canvasId: 'gameCanvas' }), runtime);
});

test('Boot initialize is idempotent until force retry', () => {
    const { sandbox } = loadBootEnvironment();
    const Boot = sandbox.Engine.Boot;
    const first = Boot.initialize({ canvasId: 'gameCanvas', logicalW: 640, logicalH: 360 });
    const second = Boot.initialize({ canvasId: 'gameCanvas', logicalW: 999, logicalH: 999 });
    assert.equal(first, second);
    const forced = Boot.initialize({ canvasId: 'gameCanvas', logicalW: 800, logicalH: 450, force: true });
    assert.notEqual(forced, first);
    assert.equal(forced.logicalW, 800);
});

test('Boot degrades when persistent storage / audio / service worker are unavailable', () => {
    const { sandbox } = loadBootEnvironment({
        localStorage: null,
        AudioContext: null,
        navigator: { hardwareConcurrency: 2 }
    });
    delete sandbox.AudioContext;
    delete sandbox.webkitAudioContext;
    const Boot = sandbox.Engine.Boot;
    const runtime = Boot.initialize({ canvasId: 'gameCanvas', force: true });
    assert.equal(runtime.ok, true);
    assert.equal(runtime.status, 'degraded');
    assert.ok(runtime.warnings.some(item => /storage/i.test(item)));
    assert.ok(runtime.warnings.some(item => /AudioContext/i.test(item)));
    assert.ok(runtime.warnings.some(item => /Service worker/i.test(item)));
});

test('Boot reports fatal when Canvas2D is unavailable', () => {
    const { sandbox } = loadBootEnvironment({ fail2d: true });
    const Boot = sandbox.Engine.Boot;
    const runtime = Boot.initialize({ canvasId: 'gameCanvas', force: true });
    assert.equal(runtime.ok, false);
    assert.equal(runtime.status, 'fatal');
    assert.ok(runtime.fatal.some(item => /Canvas2D/i.test(item)));
});

test('Boot exercises pooled allocation and cleanup', () => {
    const { sandbox } = loadBootEnvironment();
    const pool = sandbox.Engine.Graphics.CanvasPool;
    const beforeBuckets = pool._buckets.size;
    const runtime = sandbox.Engine.Boot.initialize({ canvasId: 'gameCanvas', force: true });
    assert.equal(runtime.poolWarmed, true);
    const bucket = pool._buckets.get('32x32');
    assert.ok(bucket && bucket.length >= 1, 'released pooled canvas should return to the bucket');
    assert.ok(pool._buckets.size >= beforeBuckets);
});

test('Boot.start auto-advances once ready and is not skippable', async () => {
    const { sandbox } = loadBootEnvironment();
    const Boot = sandbox.Engine.Boot;
    const screen = sandbox.Engine.UI.BootScreen;

    const runtime = await Boot.start({
        canvasId: 'gameCanvas',
        logicalW: 1280,
        logicalH: 720,
        minBrandMs: 5,
        autoAdvanceMs: 20,
        statusRevealMs: 0,
        force: true
    });
    assert.equal(runtime.ok, true);
    // The cover holds its frozen READY state after start resolves — the app
    // boots underneath and must report ready before the reveal happens.
    assert.ok(screen.layer, 'cover must stay up until the app hands off');
    assert.equal(screen.layer.hidden, false);
    assert.ok(screen.layer.classList.contains('engine-boot-screen--ready'));

    await Boot.handoff({ afterFrames: 1 });
    assert.equal(screen.layer, null, 'handoff must fully purge the boot overlay');
    assert.equal(await Boot.handoff(), runtime, 'handoff must be idempotent');

    Boot.resetForTests();
    screen.cleanup();
    const startPromise = Boot.start({
        canvasId: 'gameCanvas',
        minBrandMs: 0,
        autoAdvanceMs: 80,
        statusRevealMs: 0,
        force: true
    });
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal(screen.layer.querySelector('[data-boot-hint]'), null);
    // Clicking must not advance early — wait for the timer.
    screen.layer.click();
    const early = await Promise.race([
        startPromise.then(() => 'done'),
        new Promise(resolve => setTimeout(() => resolve('waiting'), 20))
    ]);
    assert.equal(early, 'waiting');
    const finished = await startPromise;
    assert.equal(finished.ok, true);
    await Boot.handoff({ afterFrames: 1 });
    assert.equal(screen.layer, null, 'boot overlay must be purged after handoff');
});

test('Boot-screen phases, reduced motion, fatal controls, and cleanup', async () => {
    const { sandbox } = loadBootEnvironment({ reducedMotion: true });
    const screen = sandbox.Engine.UI.BootScreen;
    let readyChimes = 0;
    sandbox.Engine.Audio = {
        initialized: true,
        context: { state: 'running' },
        playChime() { readyChimes++; }
    };
    screen.show({ version: '0.1a' });
    assert.ok(screen.layer.className.includes('engine-boot-screen--reduced'));
    screen.showBrand('0.1a');
    assert.equal(screen.versionEl.textContent, 'v0.1a');
    screen.setStatus('Initializing…');
    assert.equal(screen.statusEl.textContent, 'Initializing…');
    screen.showReady({ status: 'ready' });
    assert.equal(screen.statusEl.textContent, 'Ready');
    // Reduced motion never animates the sweep, so it stops immediately.
    assert.ok(screen.layer.classList.contains('engine-boot-screen--scan-done'));
    screen.showDegraded({ warnings: ['AudioContext unavailable; audio will stay muted until available.'] });
    assert.match(screen.statusEl.textContent, /Ready/);
    assert.equal(readyChimes, 0, 'the ready state must not play a notification chime');

    let retried = false;
    const errorPromise = screen.showError({ fatal: ['Canvas2D is unavailable.'] }, {
        onRetry: async () => {
            retried = true;
            return { ok: true };
        },
        onReload: () => { sandbox._reloads = 1; }
    });
    assert.match(screen.statusEl.textContent, /Unable to start/);
    const retryBtn = screen.actionsEl.children.find(child => child.textContent === 'Retry');
    assert.ok(retryBtn);
    retryBtn.click();
    const result = await errorPromise;
    assert.equal(retried, true);
    assert.equal(result.ok, true);

    screen.cleanup();
    assert.equal(screen.layer, null);
});

test('scan sweep finishes its current pass before stopping on ready', () => {
    const { sandbox } = loadBootEnvironment();
    const screen = sandbox.Engine.UI.BootScreen;
    screen.show({ version: '0.1a' });
    assert.ok(screen.scanlineEl, 'scanline element must be tracked');

    screen.showReady({ status: 'ready' });
    // The stop is deferred to the animation cycle boundary, not immediate.
    assert.equal(screen.layer.classList.contains('engine-boot-screen--scan-done'), false);
    const handlers = screen.scanlineEl.listeners.animationiteration || [];
    assert.equal(handlers.length, 1, 'ready must wait on the iteration boundary');

    handlers[0]();
    assert.ok(
        screen.layer.classList.contains('engine-boot-screen--scan-done'),
        'sweep must stop at the end of its cycle'
    );
    assert.equal((screen.scanlineEl.listeners.animationiteration || []).length, 0);

    // A retry pass restarts the sweep from a clean state.
    screen.showBrand('0.1a');
    assert.equal(screen.layer.classList.contains('engine-boot-screen--scan-done'), false);

    // Fatal states stop the line immediately for the error panel.
    screen.showError({ fatal: ['Canvas2D is unavailable.'] }, { onRetry: async () => ({ ok: true }) });
    assert.ok(screen.layer.classList.contains('engine-boot-screen--scan-done'));
    screen.cleanup();
});

test('Boot cinematic drives engine primitives through all four beats', () => {
    const { sandbox } = loadBootEnvironment();
    const cinema = sandbox.Engine.UI.BootCinematic;
    assert.ok(cinema, 'Engine.UI.BootCinematic must be defined');
    assert.equal(cinema.supported(), true);

    // Manually stepped rAF so beat timing is deterministic in the test.
    const pending = [];
    sandbox.requestAnimationFrame = (cb) => { pending.push(cb); return pending.length; };
    sandbox.cancelAnimationFrame = () => { pending.length = 0; };
    const tick = (ms) => {
        const cb = pending.shift();
        pending.length = 0;
        assert.ok(cb, `no frame scheduled at ${ms}ms`);
        cb(ms);
    };

    const calls = [];
    const ctx = createRecordingContext(calls);
    const stage = {
        width: 0,
        height: 0,
        clientWidth: 1280,
        clientHeight: 720,
        parentNode: { clientWidth: 1280, clientHeight: 720 },
        getContext: (type) => (type === '2d' ? ctx : null)
    };

    const controller = cinema.start({ canvas: stage, version: '0.1a' });
    assert.ok(controller, 'cinematic controller must start');
    tick(0); // establish t=0

    // Beat 1 (allocation): four raw outlines stroked with polyline vertex markers.
    calls.length = 0;
    tick(500);
    assert.equal(calls.filter(call => call.method === 'stroke').length, 4);
    assert.ok(
        calls.some(call => call.method === 'fillRect' && call.fillStyle === '#00e5ff'),
        'vertex markers must be drawn during allocation'
    );

    // Beat 2 (pipeline): physics impulses launched, trail fade instead of clear.
    calls.length = 0;
    tick(1400);
    assert.ok(
        calls.some(call => call.method === 'fillRect' && String(call.fillStyle).includes('rgba(2, 2, 5')),
        'pipeline beat must keep motion trails via translucent fade'
    );
    assert.ok(
        calls.some(call => call.method === 'stroke' && call.strokeStyle === '#00e5ff'),
        'in-flight primitives must render in accent cyan'
    );

    // Beat 3 (collision): splatter composited from the pooled mask with the
    // wordmark etched at the impact origin.
    calls.length = 0;
    tick(2000);
    assert.ok(calls.some(call => call.method === 'drawImage'), 'splatter mask must composite onto the stage');
    assert.ok(
        calls.some(call => call.method === 'strokeText' && call.args[0] === 'SHAPE ENGINE'),
        'wordmark must be etched during the collision beat'
    );

    // Beat 4 (lock-in): diagnostic line until boot verification signals ready.
    calls.length = 0;
    tick(2700);
    assert.ok(
        calls.some(call => call.method === 'fillText' && String(call.args[0]).startsWith('INITIALIZING')),
        'lock-in must show the diagnostic line before ready'
    );
    controller.ready('', 'CANVAS2D OK · STORAGE OK · AUDIO OK');
    calls.length = 0;
    tick(2800);
    assert.ok(
        calls.some(call => call.method === 'fillText' && call.args[0] === 'READY'),
        'ready signal must snap the READY line in'
    );
    assert.ok(
        calls.some(call => call.method === 'fillText' && call.args[0] === 'v0.1a'),
        'version line must render during lock-in'
    );
    assert.ok(
        calls.some(call => call.method === 'fillText'
            && call.args[0] === 'CANVAS2D OK · STORAGE OK · AUDIO OK'),
        'boot-sector dump must render with the frozen READY state'
    );

    controller.stop();
    assert.equal(cinema.active, null);
    assert.equal(pending.length, 0, 'stop must cancel the frame loop');
});

test('service worker and package test list include engine boot files', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    assert.match(sw, /engine\/ui\/boot-cinematic\.js/);
    assert.match(sw, /engine\/ui\/boot-screen\.js/);
    assert.match(sw, /engine\/boot\.js/);
    assert.match(sw, /CACHE_VERSION = '0\.8\.2\.\d+'/);

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.match(pkg.scripts.test, /engine-boot\.test\.js/);
});

test('boot cinematic uses dedicated layered audio instead of generic gameplay cues', () => {
    const audio = fs.readFileSync(path.join(ROOT, 'src/engine/audio.js'), 'utf8');
    const cinematic = fs.readFileSync(path.join(ROOT, 'src/engine/ui/boot-cinematic.js'), 'utf8');
    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    assert.match(audio, /playBootCharge\s*\(/);
    assert.match(audio, /playBootImpact\s*\(/);
    assert.match(audio, /playBootRumble\s*\(/);
    assert.match(audio, /createDynamicsCompressor\s*\(/);
    assert.match(audio, /createBufferSource\s*\(/);
    assert.match(audio, /createWaveShaper\s*\(/);
    assert.match(audio, /_snapBootLevel\s*\(/);
    assert.match(audio, /aftershock/);
    assert.match(audio, /rumbleFilter/);
    assert.match(cinematic, /audio\.playBootCharge\s*\(/);
    assert.match(cinematic, /audio\.playBootImpact\s*\(/);
    assert.match(cinematic, /audio\.playBootRumble\s*\(/);
    assert.doesNotMatch(cinematic, /audio\.play(?:Chime|Impact|Thud|Sweep)\s*\(/);
    assert.doesNotMatch(cinematic, /(?:src\/game|window\.Game|AudioManager)/);
    assert.ok(
        index.indexOf('src/engine/audio.js') < index.indexOf('src/engine/ui/boot-cinematic.js')
        && index.indexOf('src/engine/ui/boot-cinematic.js') < index.indexOf('src/game/'),
        'boot audio and cinematic must load entirely inside the engine boundary'
    );
});

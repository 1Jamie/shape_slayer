// Engine.Debug — navigable debug shell, metric registry, and pipe diagnosis.
// Optional for boot verify. Core stays agnostic; the game bridges onFrameEnd.

(function (root) {
    'use strict';

    const Engine = root.Engine = root.Engine || {};

    const STYLE = {
        panel: `
            position: fixed; top: 20px; right: 20px; width: 300px;
            max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px);
            overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch; background: rgba(20, 20, 30, 0.95);
            border: 2px solid #00ff00; border-radius: 8px; padding: 0;
            color: #00ff00; font-family: 'Courier New', monospace; font-size: 13px;
            z-index: 10000; display: none; box-shadow: 0 4px 12px rgba(0, 255, 0, 0.3);
            box-sizing: border-box;
        `,
        header: `
            position: sticky; top: 0; z-index: 3; padding: 12px 14px 10px;
            background: rgba(20, 20, 30, 0.98); border-bottom: 1px solid #00ff00;
            display: flex; align-items: center; gap: 8px;
        `,
        body: 'padding: 12px 14px 14px;',
        btn: `
            padding: 5px 8px; background: #1a1a2e; border: 1px solid #00ff00;
            color: #00ff00; cursor: pointer; border-radius: 4px; font-family: inherit; font-size: 12px;
        `,
        btnMuted: `
            padding: 5px 8px; background: #1a1a2e; border: 1px solid #556655;
            color: #88ff88; cursor: pointer; border-radius: 4px; font-family: inherit; font-size: 12px;
        `,
        row: `
            display: flex; align-items: center; justify-content: space-between; gap: 8px;
            padding: 8px 10px; margin-bottom: 6px; background: rgba(26, 26, 46, 0.85);
            border: 1px solid #224422; border-radius: 6px; cursor: pointer; text-align: left;
            width: 100%; color: #00ff00; font-family: inherit; font-size: 13px;
        `,
        nested: 'margin: 6px 0 6px 8px; padding-left: 8px; border-left: 2px solid #224422;',
        label: 'font-size: 12px; color: #88ff88;',
        value: 'color: #fff;',
        footer: 'margin-top: 10px; padding-top: 8px; border-top: 1px solid #00ff00; font-size: 11px; color: #88ff88;'
    };

    const DEFAULT_HISTORY = 60;
    const SANITIZE_DEPTH = 2;
    const SANITIZE_MAX_KEYS = 32;
    const SANITIZE_MAX_ARRAY = 32;

    // --- Flags -----------------------------------------------------------------

    const flagValues = Object.create(null);
    flagValues.USE_CACHING = true;
    flagValues.ADAPTIVE_RENDER_QUALITY = true;
    flagValues.RENDER_TIMING = false;
    flagValues.PIPE_SNAPSHOT = false;

    const flagsApi = {
        register(name, defaultValue) {
            if (typeof name !== 'string' || !name) {
                throw new TypeError('Flag name must be a non-empty string.');
            }
            if (!(name in flagValues)) {
                flagValues[name] = !!defaultValue;
            }
            return this;
        },
        enable(name) {
            if (!(name in flagValues)) {
                console.warn(`[Debug] Unknown flag: ${name}`);
                return;
            }
            flagValues[name] = true;
            console.log(`[Debug] Enabled: ${name}`);
        },
        disable(name) {
            if (!(name in flagValues)) {
                console.warn(`[Debug] Unknown flag: ${name}`);
                return;
            }
            flagValues[name] = false;
            console.log(`[Debug] Disabled: ${name}`);
        },
        get(name) {
            return !!flagValues[name];
        },
        set(name, value) {
            if (!(name in flagValues)) {
                flagValues[name] = !!value;
                return;
            }
            flagValues[name] = !!value;
        },
        hasOwnProperty(name) {
            return Object.prototype.hasOwnProperty.call(flagValues, name);
        },
        keys() {
            return Object.keys(flagValues);
        }
    };

    const flags = new Proxy(flagsApi, {
        get(target, prop) {
            if (prop in target) return target[prop];
            if (typeof prop === 'string' && prop in flagValues) return flagValues[prop];
            return undefined;
        },
        set(target, prop, value) {
            if (typeof prop === 'string' && !(prop in target)) {
                flagValues[prop] = !!value;
                return true;
            }
            return false;
        },
        has(target, prop) {
            return prop in target || (typeof prop === 'string' && prop in flagValues);
        },
        ownKeys() {
            return Object.keys(flagValues).concat(
                Object.getOwnPropertyNames(flagsApi).filter((k) => !(k in flagValues))
            );
        },
        getOwnPropertyDescriptor(target, prop) {
            if (prop in flagValues) {
                return { configurable: true, enumerable: true, writable: true, value: flagValues[prop] };
            }
            return Object.getOwnPropertyDescriptor(target, prop);
        }
    });

    // --- Sanitize --------------------------------------------------------------

    const coerceWarnKeys = Object.create(null);

    function isPlainObject(value) {
        if (!value || typeof value !== 'object') return false;
        const proto = Object.getPrototypeOf(value);
        return proto === Object.prototype || proto === null;
    }

    function sanitizeDebugValue(value, depth, warnKey) {
        if (depth === undefined) depth = SANITIZE_DEPTH;
        if (value === null || value === undefined) return value;
        const t = typeof value;
        if (t === 'boolean' || t === 'string') return value;
        if (t === 'number') return Number.isNaN(value) ? 'NaN' : value;
        if (t === 'bigint') return value.toString() + 'n';
        if (t === 'function') {
            return { $type: 'Function' };
        }
        if (depth <= 0) return '[MaxDepth]';

        if (Array.isArray(value)) {
            const out = [];
            const n = Math.min(value.length, SANITIZE_MAX_ARRAY);
            for (let i = 0; i < n; i++) {
                out.push(sanitizeDebugValue(value[i], depth - 1, warnKey));
            }
            if (value.length > SANITIZE_MAX_ARRAY) {
                out.push(`[+${value.length - SANITIZE_MAX_ARRAY} more]`);
            }
            return out;
        }

        if (isPlainObject(value)) {
            const out = {};
            const keys = Object.keys(value);
            const n = Math.min(keys.length, SANITIZE_MAX_KEYS);
            for (let i = 0; i < n; i++) {
                const k = keys[i];
                out[k] = sanitizeDebugValue(value[k], depth - 1, warnKey || k);
            }
            if (keys.length > SANITIZE_MAX_KEYS) {
                out.$more = keys.length - SANITIZE_MAX_KEYS;
            }
            return out;
        }

        // Class instance / host object — never retain the live reference.
        const typeName = (value.constructor && value.constructor.name) || t;
        if (warnKey && !coerceWarnKeys[warnKey]) {
            coerceWarnKeys[warnKey] = true;
            console.warn(`[Debug] Coerced non-plain value for "${warnKey}" to $type:${typeName}`);
        }
        return { $type: typeName };
    }

    function summarizeBag(bag) {
        if (!bag || typeof bag !== 'object') return null;
        const summary = Object.create(null);
        const keys = Object.keys(bag);
        const n = Math.min(keys.length, SANITIZE_MAX_KEYS);
        for (let i = 0; i < n; i++) {
            const k = keys[i];
            const v = bag[k];
            if (v === null) {
                summary[k] = 'null';
            } else if (v === undefined) {
                summary[k] = 'undefined';
            } else if (Array.isArray(v)) {
                summary[k] = `array(${v.length})`;
            } else if (typeof v === 'number') {
                summary[k] = Number.isNaN(v) ? 'NaN' : 'number';
            } else if (typeof v === 'object') {
                summary[k] = isPlainObject(v)
                    ? `object(${Object.keys(v).length})`
                    : ((v.constructor && v.constructor.name) || 'object');
            } else {
                summary[k] = typeof v;
            }
        }
        summary.$keyCount = keys.length;
        return summary;
    }

    // --- State -----------------------------------------------------------------

    const collectors = [];
    const sections = [];
    const metricGroups = [];
    let runProfileHooks = null;
    let boundPipeline = null;
    /** @type {Record<string, { id: string, label: string, pipeline: object, profile: boolean, snapshot: boolean }>} */
    const pipelineRegistry = Object.create(null);
    let viewingPipelineId = null;
    let activePipelineId = null;

    function setActivePipelineId(id) {
        activePipelineId = id || null;
    }

    let panelElement = null;
    let bodyEl = null;
    let titleEl = null;
    let backBtn = null;
    let visible = false;
    let lastMetricsDomUpdate = 0;
    let lastBreakdown = null;

    // Navigation: { kind:'home' } | { kind:'section', id } | { kind:'pipeline-stage', stageId } | { kind:'pipeline-diff' }
    let view = { kind: 'home' };
    let expandedPerfFolders = Object.create(null);
    expandedPerfFolders.overview = true;

    // Timing samples
    const frameTimes = [];
    const cpuTimes = [];
    const phaseSamples = Object.create(null);

    // Pipe history
    let historySize = DEFAULT_HISTORY;
    const history = [];
    let frameIndex = 0;
    let historyCursor = -1; // -1 = live (latest)
    let pinnedFrame = null;
    let frozen = false;
    let breakMode = 'break'; // 'break' | 'log'
    const breakPredicates = [];
    let currentStageId = null;
    let buildingFrame = null;
    let pipelineFocus = false; // true while Pipeline section / stage / diff is open

    function el(tag, style, html) {
        const node = document.createElement(tag);
        if (style) node.style.cssText = style;
        if (html !== undefined) node.innerHTML = html;
        return node;
    }

    function textBtn(label, onClick, muted) {
        const b = el('button', muted ? STYLE.btnMuted : STYLE.btn, label);
        b.type = 'button';
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick(e);
        });
        return b;
    }

    function checkbox(labelText, checked, onChange, color) {
        const wrap = el('label', 'display:flex;align-items:center;cursor:pointer;user-select:none;margin-bottom:6px;');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!checked;
        input.style.marginRight = '8px';
        input.style.cursor = 'pointer';
        input.addEventListener('change', () => onChange(!!input.checked, input));
        const span = el('span', `color:${color || '#00ffff'};`, labelText);
        wrap.appendChild(input);
        wrap.appendChild(span);
        wrap._input = input;
        return wrap;
    }

    function avg(samples, startTime) {
        let sum = 0;
        let count = 0;
        for (let i = samples.length - 1; i >= 0; i--) {
            const entry = samples[i];
            if (entry.time < startTime) break;
            sum += entry.value;
            count++;
        }
        return count > 0 ? sum / count : 0;
    }

    function pushTimed(list, now, value, windowMs) {
        list.push({ time: now, value });
        const cutoff = now - windowMs;
        while (list.length > 0 && list[0].time < cutoff) list.shift();
    }

    function pushPhase(key, value, now) {
        if (typeof value !== 'number' || !isFinite(value)) return;
        if (!phaseSamples[key]) phaseSamples[key] = [];
        pushTimed(phaseSamples[key], now, value, 1000);
    }

    function phaseAvg(key, now) {
        const samples = phaseSamples[key];
        if (!samples || samples.length === 0) return 0;
        return avg(samples, now - 1000);
    }

    function colorMs(node, ms) {
        if (typeof ms !== 'number' || !isFinite(ms)) {
            node.style.color = '#fff';
            return;
        }
        if (ms < 17) node.style.color = '#00ff00';
        else if (ms < 34) node.style.color = '#ffff00';
        else node.style.color = '#ff0000';
    }

    function fmtMs(v) {
        if (typeof v !== 'number' || !isFinite(v)) return '-';
        return `${v.toFixed(1)}ms`;
    }

    function sortedSections() {
        return sections.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function sortedMetricGroups() {
        return metricGroups.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    function getSelectedHistoryFrame() {
        if (pinnedFrame) return pinnedFrame;
        if (history.length === 0) return null;
        if (historyCursor < 0) return history[history.length - 1];
        return history[Math.max(0, Math.min(history.length - 1, historyCursor))];
    }

    function buildDbg() {
        return {
            flags,
            metrics: lastBreakdown,
            pipeline: boundPipeline,
            frame: getSelectedHistoryFrame(),
            history,
            frozen,
            view
        };
    }

    // --- Collection ------------------------------------------------------------

    function shouldCollect() {
        if (visible) return true;
        if (flagValues.RENDER_TIMING) return true;
        for (let i = 0; i < collectors.length; i++) {
            try {
                if (collectors[i]()) return true;
            } catch (_) { /* ignore */ }
        }
        return false;
    }

    /** Snapshot/trace gate. Optional pipelineId scopes to a registered pipe's attach flag. */
    function shouldSnapshot(pipelineId) {
        const id = pipelineId !== undefined && pipelineId !== null ? pipelineId : activePipelineId;
        if (flagValues.PIPE_SNAPSHOT) return true;
        if (id && pipelineRegistry[id] && pipelineRegistry[id].snapshot) {
            return true;
        }
        if (!id) {
            const ids = Object.keys(pipelineRegistry);
            for (let i = 0; i < ids.length; i++) {
                if (pipelineRegistry[ids[i]].snapshot) return true;
            }
        }
        return false;
    }

    function wantsProfile(pipelineId) {
        if (!pipelineId) return false;
        const entry = pipelineRegistry[pipelineId];
        return !!(entry && entry.profile);
    }

    function wantsSnapshot(pipelineId) {
        return shouldSnapshot(pipelineId);
    }

    function listPipelines() {
        return Object.keys(pipelineRegistry).map((id) => {
            const e = pipelineRegistry[id];
            return {
                id: e.id,
                label: e.label,
                profile: e.profile,
                snapshot: e.snapshot,
                stageCount: e.pipeline && typeof e.pipeline.stages === 'function'
                    ? e.pipeline.stages().length
                    : 0
            };
        });
    }

    function refreshRegistryUi() {
        if (!visible || !bodyEl) return;
        // Registry rows are mount-time DOM — remount Pipeline views; patch home hints.
        if (view.kind === 'section' && view.id === 'pipeline') {
            invalidateMount();
            mountView();
            return;
        }
        if (view.kind === 'pipeline-stage' || view.kind === 'pipeline-diff') {
            invalidateMount();
            mountView();
            return;
        }
        if (view.kind === 'home') {
            patchLive();
        }
    }

    function registerPipeline(id, pipeline, options) {
        if (typeof id !== 'string' || !id) {
            throw new TypeError('registerPipeline requires a non-empty id string.');
        }
        if (!pipeline || typeof pipeline.stages !== 'function') {
            throw new TypeError('registerPipeline requires a pipeline with stages().');
        }
        const opts = options || {};
        const prev = pipelineRegistry[id];
        pipelineRegistry[id] = {
            id,
            label: opts.label || id,
            pipeline,
            profile: prev ? prev.profile : !!opts.profile,
            snapshot: prev ? prev.snapshot : !!opts.snapshot
        };
        if (!boundPipeline || viewingPipelineId === id) {
            boundPipeline = pipeline;
            viewingPipelineId = id;
        }
        refreshRegistryUi();
        return Debug;
    }

    function unregisterPipeline(id) {
        if (!pipelineRegistry[id]) return Debug;
        delete pipelineRegistry[id];
        if (viewingPipelineId === id) {
            viewingPipelineId = null;
            const next = Object.keys(pipelineRegistry)[0];
            boundPipeline = next ? pipelineRegistry[next].pipeline : null;
            viewingPipelineId = next || null;
        }
        refreshRegistryUi();
        return Debug;
    }

    function attach(id, opts) {
        const entry = pipelineRegistry[id];
        if (!entry) {
            console.warn(`[Debug] attach: unknown pipeline "${id}"`);
            return Debug;
        }
        const o = opts || {};
        if (o.profile !== undefined) entry.profile = !!o.profile;
        if (o.snapshot !== undefined) entry.snapshot = !!o.snapshot;
        // Shorthand: attach() with no keys enables both
        if (o.profile === undefined && o.snapshot === undefined) {
            entry.profile = true;
            entry.snapshot = true;
        }
        boundPipeline = entry.pipeline;
        viewingPipelineId = id;
        console.log(`[Debug] Attached "${id}" profile=${entry.profile} snapshot=${entry.snapshot}`);
        refreshRegistryUi();
        return Debug;
    }

    function detach(id, what) {
        const entry = pipelineRegistry[id];
        if (!entry) {
            console.warn(`[Debug] detach: unknown pipeline "${id}"`);
            return Debug;
        }
        if (!what || what === 'all') {
            entry.profile = false;
            entry.snapshot = false;
        } else if (what === 'profile') {
            entry.profile = false;
        } else if (what === 'snapshot') {
            entry.snapshot = false;
        }
        console.log(`[Debug] Detached "${id}" profile=${entry.profile} snapshot=${entry.snapshot}`);
        refreshRegistryUi();
        return Debug;
    }

    function viewPipeline(id) {
        const entry = pipelineRegistry[id];
        if (!entry) {
            console.warn(`[Debug] viewPipeline: unknown pipeline "${id}"`);
            return Debug;
        }
        boundPipeline = entry.pipeline;
        viewingPipelineId = id;
        if (visible && view.kind === 'section' && view.id === 'pipeline') {
            invalidateMount();
            mountView();
        }
        return Debug;
    }

    // --- History / trace -------------------------------------------------------

    function ensureBuildingFrame() {
        if (!buildingFrame) {
            buildingFrame = {
                frameIndex: frameIndex,
                processTime: 0,
                updateTime: 0,
                renderTime: 0,
                stageTimings: Object.create(null),
                stages: [],
                _stageMap: Object.create(null)
            };
        }
        return buildingFrame;
    }

    function ensureStageRec(stageId) {
        const frame = ensureBuildingFrame();
        let rec = frame._stageMap[stageId];
        if (!rec) {
            rec = {
                id: stageId,
                ms: 0,
                bagInSummary: null,
                bagOutSummary: null,
                traces: [],
                snapshots: []
            };
            frame._stageMap[stageId] = rec;
            frame.stages.push(rec);
        }
        return rec;
    }

    function beginStage(stageId) {
        if (!shouldSnapshot() && !shouldCollect()) return;
        currentStageId = stageId;
        if (shouldSnapshot()) {
            ensureStageRec(stageId);
        }
    }

    function endStage(stageId, ms, bagInSummary, bagOutSummary) {
        if (shouldSnapshot()) {
            const rec = ensureStageRec(stageId);
            if (typeof ms === 'number') rec.ms = ms;
            if (bagInSummary) rec.bagInSummary = bagInSummary;
            if (bagOutSummary) rec.bagOutSummary = bagOutSummary;
        }
        if (currentStageId === stageId) currentStageId = null;
    }

    function trace(key, value) {
        if (!shouldSnapshot()) return;
        const stageId = currentStageId || '_ungated';
        const rec = ensureStageRec(stageId);
        rec.traces.push({
            key: String(key),
            value: sanitizeDebugValue(value, SANITIZE_DEPTH, String(key))
        });
    }

    function captureSnapshot(stageId, label, data) {
        if (!shouldSnapshot()) return;
        const rec = ensureStageRec(stageId || currentStageId || '_ungated');
        rec.snapshots.push({
            label: String(label || 'snapshot'),
            data: sanitizeDebugValue(data, SANITIZE_DEPTH, String(label || 'snapshot'))
        });
    }

    function commitHistoryFrame(meta) {
        if (!shouldSnapshot() && !buildingFrame) {
            frameIndex += 1;
            return;
        }
        const frame = ensureBuildingFrame();
        if (meta) {
            frame.processTime = meta.processTime || 0;
            frame.updateTime = meta.updateTime || 0;
            frame.renderTime = meta.renderTime || 0;
            if (meta.stageTimings) {
                frame.stageTimings = Object.assign(Object.create(null), meta.stageTimings);
                const ids = Object.keys(meta.stageTimings);
                for (let i = 0; i < ids.length; i++) {
                    const id = ids[i];
                    const rec = ensureStageRec(id);
                    rec.ms = meta.stageTimings[id];
                }
            }
        }
        delete frame._stageMap;

        if (shouldSnapshot() && !frozen) {
            history.push(frame);
            while (history.length > historySize) history.shift();
        }

        evaluateBreaks(frame);
        buildingFrame = null;
        frameIndex += 1;
        currentStageId = null;
    }

    function evaluateBreaks(frame) {
        if (!breakPredicates.length) return;
        const dbg = { frame, flags, frozen, metrics: lastBreakdown };
        for (let i = 0; i < breakPredicates.length; i++) {
            const pred = breakPredicates[i];
            let hit = false;
            let stageId = null;
            try {
                if (typeof pred === 'function') {
                    hit = !!pred(dbg);
                } else if (pred && typeof pred.test === 'function') {
                    stageId = pred.stageId;
                    const stages = frame.stages || [];
                    for (let s = 0; s < stages.length; s++) {
                        if (stageId && stages[s].id !== stageId) continue;
                        if (pred.test(stages[s], dbg)) {
                            hit = true;
                            stageId = stages[s].id;
                            break;
                        }
                    }
                }
            } catch (err) {
                console.warn('[Debug] breakWhen predicate error', err);
            }
            if (hit) {
                onBreakHit(frame, stageId);
                return;
            }
        }
    }

    function onBreakHit(frame, stageId) {
        console.warn(`[Debug] breakWhen hit${stageId ? ` @ ${stageId}` : ''} frame ${frame.frameIndex}`, frame);
        if (breakMode === 'log') return;
        frozen = true;
        pinnedFrame = frame;
        historyCursor = history.indexOf(frame);
        if (panelElement && visible) renderView();
    }

    // --- Diff ------------------------------------------------------------------

    function shallowDiff(a, b, path) {
        const changes = [];
        const left = a || {};
        const right = b || {};
        const keys = {};
        Object.keys(left).forEach((k) => { keys[k] = true; });
        Object.keys(right).forEach((k) => { keys[k] = true; });
        Object.keys(keys).forEach((k) => {
            const lv = left[k];
            const rv = right[k];
            const p = path ? `${path}.${k}` : k;
            if (!(k in left)) changes.push({ path: p, kind: 'added', to: rv });
            else if (!(k in right)) changes.push({ path: p, kind: 'removed', from: lv });
            else if (JSON.stringify(lv) !== JSON.stringify(rv)) {
                changes.push({ path: p, kind: 'changed', from: lv, to: rv });
            }
        });
        return changes;
    }

    function diffFrames(a, b) {
        if (!a || !b) return { timings: [], traces: [], bags: [] };
        const timings = [];
        const ids = {};
        Object.keys(a.stageTimings || {}).forEach((k) => { ids[k] = true; });
        Object.keys(b.stageTimings || {}).forEach((k) => { ids[k] = true; });
        Object.keys(ids).forEach((id) => {
            const from = (a.stageTimings && a.stageTimings[id]) || 0;
            const to = (b.stageTimings && b.stageTimings[id]) || 0;
            if (Math.abs(from - to) > 0.05) {
                timings.push({ stageId: id, from, to, delta: to - from });
            }
        });

        const mapTraces = (frame) => {
            const m = Object.create(null);
            (frame.stages || []).forEach((st) => {
                (st.traces || []).forEach((t) => {
                    m[`${st.id}:${t.key}`] = t.value;
                });
            });
            return m;
        };
        const traces = shallowDiff(mapTraces(a), mapTraces(b), '');

        const bags = [];
        const stageMap = Object.create(null);
        (a.stages || []).forEach((s) => { stageMap[s.id] = { a: s }; });
        (b.stages || []).forEach((s) => {
            if (!stageMap[s.id]) stageMap[s.id] = {};
            stageMap[s.id].b = s;
        });
        Object.keys(stageMap).forEach((id) => {
            const pair = stageMap[id];
            const left = pair.a && pair.a.bagOutSummary;
            const right = pair.b && pair.b.bagOutSummary;
            if (left || right) {
                const ch = shallowDiff(left, right, id);
                if (ch.length) bags.push({ stageId: id, changes: ch });
            }
        });

        return { timings, traces, bags };
    }

    // --- UI navigation (mount on navigate, patch on tick) ----------------------

    let mountedKey = '';
    let binds = Object.create(null); // id -> HTMLElement
    let bindCache = Object.create(null); // id -> last text (skip unchanged writes)
    let homeRows = Object.create(null); // sectionId -> { btn, hint }
    let pipelineStageBinds = Object.create(null); // stageId -> { msEl }
    let boundPipelineSig = '';

    function viewKey() {
        if (view.kind === 'home') return 'home';
        if (view.kind === 'section') return 'section:' + view.id;
        if (view.kind === 'pipeline-stage') return 'stage:' + view.stageId;
        if (view.kind === 'pipeline-diff') return 'diff';
        return 'unknown';
    }

    function invalidateMount() {
        mountedKey = '';
    }

    function clearBody() {
        while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
        binds = Object.create(null);
        bindCache = Object.create(null);
        homeRows = Object.create(null);
        pipelineStageBinds = Object.create(null);
    }

    function bind(id, node) {
        binds[id] = node;
        return node;
    }

    function setBound(id, text, msForColor) {
        const node = binds[id];
        if (!node) return;
        const next = text == null ? '' : String(text);
        if (bindCache[id] === next) {
            if (typeof msForColor === 'number') colorMs(node, msForColor);
            return;
        }
        bindCache[id] = next;
        node.textContent = next;
        if (typeof msForColor === 'number') colorMs(node, msForColor);
        else if (msForColor === false) { /* keep */ }
        else node.style.color = '#fff';
    }

    function setView(next) {
        view = next;
        pipelineFocus = next.kind === 'section' && next.id === 'pipeline'
            || next.kind === 'pipeline-stage'
            || next.kind === 'pipeline-diff';
        invalidateMount();
        mountView();
    }

    function goHome() {
        setView({ kind: 'home' });
    }

    function goBack() {
        if (view.kind === 'pipeline-stage' || view.kind === 'pipeline-diff') {
            setView({ kind: 'section', id: 'pipeline' });
            return;
        }
        goHome();
    }

    /** Full DOM rebuild — only on navigation / explicit invalidate. */
    function mountView() {
        if (!bodyEl || !titleEl || !backBtn) return;
        const key = viewKey();
        if (key === mountedKey) {
            patchLive();
            return;
        }
        mountedKey = key;
        clearBody();
        const dbg = buildDbg();

        if (view.kind === 'home') {
            backBtn.style.display = 'none';
            titleEl.textContent = 'DEBUG';
            mountHome(bodyEl, dbg);
        } else if (view.kind === 'section') {
            backBtn.style.display = '';
            const sec = sections.find((s) => s.id === view.id);
            titleEl.textContent = (sec && sec.title) || view.id;
            mountSection(bodyEl, sec, dbg);
        } else if (view.kind === 'pipeline-stage') {
            backBtn.style.display = '';
            titleEl.textContent = view.stageId;
            mountPipelineStageDetail(bodyEl, view.stageId);
        } else if (view.kind === 'pipeline-diff') {
            backBtn.style.display = '';
            titleEl.textContent = 'Frame Diff';
            mountPipelineDiff(bodyEl);
        }

        const foot = el('div', STYLE.footer);
        const footLine = el('div', '');
        bind('footer', footLine);
        foot.appendChild(footLine);
        bodyEl.appendChild(foot);
        patchLive();
    }

    /** In-place mutations only — called from the throttled metrics tick. */
    function patchLive() {
        if (!visible || !bodyEl) return;
        const dbg = buildDbg();
        const now = Date.now();
        const snap = (lastBreakdown && lastBreakdown.snapshot) || {};

        setBound('footer', frozen
            ? 'FROZEN — sim paused · Engine.Debug.unfreeze()'
            : 'Ctrl+D toggle · Engine.Debug.toggle()');
        if (binds.footer) {
            binds.footer.style.color = frozen ? '#ffaa00' : '#88ff88';
        }

        if (view.kind === 'home') {
            setBound('homeStatus',
                `FPS ${snap.fps != null ? snap.fps : '-'} · Q ${snap.qualityTier || '-'} · hist ${history.length}`);
            if (binds.freezeBanner) {
                binds.freezeBanner.style.display = frozen ? 'block' : 'none';
            }
            sortedSections().forEach((sec) => {
                const row = homeRows[sec.id];
                if (!row) return;
                let show = true;
                if (typeof sec.visible === 'function') {
                    try { show = !!sec.visible(dbg); } catch (_) { show = false; }
                }
                row.btn.style.display = show ? 'flex' : 'none';
                if (show && row.hint && typeof sec.hint === 'function') {
                    try { setBound('hint:' + sec.id, sec.hint(dbg) || '›'); }
                    catch (_) { setBound('hint:' + sec.id, '›'); }
                }
            });
            return;
        }

        if (view.kind === 'section' && view.id === 'performance') {
            patchPerformance(now, snap);
            return;
        }

        if (view.kind === 'section' && view.id === 'pipeline') {
            patchPipeline();
            return;
        }

        if (view.kind === 'section') {
            const sec = sections.find((s) => s.id === view.id);
            if (sec && typeof sec.update === 'function') {
                try { sec.update(dbg); } catch (_) { /* ignore */ }
            }
        }
        // Stage detail / diff stay static until user navigates (intentional).
    }

    function mountHome(root, dbg) {
        const ban = el('div', 'margin-bottom:10px;padding:8px;border:1px solid #ffaa00;border-radius:6px;color:#ffaa00;font-size:12px;');
        ban.style.display = frozen ? 'block' : 'none';
        const banText = el('div', '', '');
        banText.textContent = 'Debug freeze active';
        ban.appendChild(banText);
        const un = textBtn('Unfreeze', () => Debug.unfreeze());
        un.style.marginTop = '6px';
        ban.appendChild(un);
        bind('freezeBanner', ban);
        root.appendChild(ban);

        const status = el('div', 'font-size:11px;color:#88ff88;margin-bottom:10px;', '-');
        bind('homeStatus', status);
        root.appendChild(status);

        sortedSections().forEach((sec) => {
            const btn = el('button', STYLE.row);
            btn.type = 'button';
            const left = el('span', 'font-weight:bold;', sec.title || sec.id);
            const right = el('span', 'color:#88ff88;font-size:11px;', '›');
            bind('hint:' + sec.id, right);
            btn.appendChild(left);
            btn.appendChild(right);
            btn.addEventListener('click', () => setView({ kind: 'section', id: sec.id }));
            homeRows[sec.id] = { btn, hint: right };
            root.appendChild(btn);
        });
    }

    function mountSection(root, sec, dbg) {
        if (!sec) {
            root.appendChild(el('div', STYLE.label, 'Unknown section'));
            return;
        }
        if (sec.id === 'performance') {
            mountPerformance(root);
            return;
        }
        if (sec.id === 'pipeline') {
            mountPipeline(root);
            return;
        }
        if (typeof sec.mount === 'function') {
            if (!sec._root) {
                sec._root = el('div', '');
                sec.mount(sec._root);
            }
            root.appendChild(sec._root);
            if (typeof sec.update === 'function') {
                try { sec.update(dbg); } catch (err) { console.warn('[Debug] section update', sec.id, err); }
            }
        }
    }

    function boundMetricLine(label, bindId) {
        const line = el('div', 'display:flex;justify-content:space-between;font-size:12px;color:#88ff88;margin:2px 0;');
        line.appendChild(el('span', '', label));
        const v = el('span', STYLE.value, '-');
        bind(bindId, v);
        line.appendChild(v);
        return line;
    }

    function mountFolder(root, id, title) {
        const open = !!expandedPerfFolders[id];
        const head = el('button', STYLE.row);
        head.type = 'button';
        head.style.marginBottom = '4px';
        const headLabel = el('span', '', (open ? '▼ ' : '▶ ') + title);
        head.appendChild(headLabel);
        const body = el('div', STYLE.nested);
        body.style.display = open ? 'block' : 'none';
        head.addEventListener('click', () => {
            expandedPerfFolders[id] = !expandedPerfFolders[id];
            invalidateMount();
            mountView();
        });
        root.appendChild(head);
        root.appendChild(body);
        return body;
    }

    function mountPerformance(root) {
        root.appendChild(checkbox('Use Caching', flagValues.USE_CACHING, (v) => {
            flagValues.USE_CACHING = v;
            console.log(`[Debug] Caching: ${v ? 'ENABLED' : 'DISABLED'}`);
        }));
        root.appendChild(checkbox('Metrics When Hidden', flagValues.RENDER_TIMING, (v) => {
            flagValues.RENDER_TIMING = v;
            console.log(`[Debug] Metrics when hidden: ${v ? 'ENABLED' : 'DISABLED'}`);
        }));
        root.appendChild(checkbox('Pipe Snapshots', flagValues.PIPE_SNAPSHOT, (v) => {
            flagValues.PIPE_SNAPSHOT = v;
            console.log(`[Debug] PIPE_SNAPSHOT: ${v ? 'ENABLED' : 'DISABLED'}`);
        }, '#ffcc66'));

        const overview = mountFolder(root, 'overview', 'Overview');
        if (expandedPerfFolders.overview) {
            overview.appendChild(boundMetricLine('FPS', 'perf.fps'));
            overview.appendChild(boundMetricLine('Quality', 'perf.quality'));
            overview.appendChild(boundMetricLine('Frame 1s', 'perf.ft1'));
            overview.appendChild(boundMetricLine('Frame 5s', 'perf.ft5'));
            overview.appendChild(boundMetricLine('Frame 10s', 'perf.ft10'));
            overview.appendChild(boundMetricLine('CPU 1s', 'perf.cpu1'));
            overview.appendChild(boundMetricLine('CPU 5s', 'perf.cpu5'));
            overview.appendChild(boundMetricLine('CPU 10s', 'perf.cpu10'));
            overview.appendChild(boundMetricLine('Budget 2s', 'perf.budget'));
            overview.appendChild(boundMetricLine('Catch-up', 'perf.catchup'));
            overview.appendChild(boundMetricLine('Accum drop', 'perf.drop'));
        }

        const breakdown = mountFolder(root, 'breakdown', 'Frame Breakdown (1s)');
        if (expandedPerfFolders.breakdown) {
            const grid = el('div', 'display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:12px;color:#88ff88;');
            const rows = [
                ['Upd', 'update'], ['Rnd', 'render'],
                ['Static', 'static'], ['World', 'world'],
                ['Glow', 'worldGlow'], ['Bodies', 'worldBodies'],
                ['Vig', 'vignette'], ['Post', 'postFx'],
                ['UI', 'ui'], ['Other', 'other']
            ];
            sortedMetricGroups().forEach((g) => {
                if (g.id !== 'frameBreakdown' || !g.rows) return;
                g.rows.forEach((r) => {
                    if (!rows.find((x) => x[1] === r.key)) rows.push([r.label, r.key]);
                });
            });
            rows.forEach(([label, key]) => {
                const cell = el('span', '', `${label}: `);
                const span = el('span', STYLE.value, '-');
                bind('phase.' + key, span);
                cell.appendChild(span);
                grid.appendChild(cell);
            });
            breakdown.appendChild(grid);
        }

        const sub = mountFolder(root, 'subtimings', 'Render Sub-Timings (1s)');
        if (expandedPerfFolders.subtimings) {
            const grid = el('div', 'display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:12px;color:#88ff88;');
            [
                ['Loot', 'groundLoot'],
                ['Rings', 'detailRings'],
                ['Remote', 'remoteActors'],
                ['W Glow', 'worldGlow'],
                ['W Body', 'worldBodies']
            ].forEach(([label, key]) => {
                const cell = el('span', '', `${label}: `);
                const span = el('span', STYLE.value, '-');
                bind('sub.' + key, span);
                cell.appendChild(span);
                grid.appendChild(cell);
            });
            sub.appendChild(grid);
        }

        const scene = mountFolder(root, 'scene', 'Scene Counts');
        if (expandedPerfFolders.scene) {
            const counts = el('div', 'font-size:11px;color:#ccc;line-height:1.4;white-space:pre-wrap;', '-');
            bind('perf.scene', counts);
            scene.appendChild(counts);
        }

        const profile = mountFolder(root, 'runprofile', 'Run Profile');
        if (expandedPerfFolders.runprofile) {
            if (!runProfileHooks) {
                profile.appendChild(el('div', STYLE.label, 'No profiler hooked'));
            } else {
                const hooks = runProfileHooks;
                profile.appendChild(checkbox('Auto-start on run', !!hooks.getAutoStart && hooks.getAutoStart(), (v) => {
                    if (hooks.setAutoStart) hooks.setAutoStart(v);
                }, '#ffcc66'));
                const row = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;');
                const startBtn = textBtn('Start', () => { if (hooks.onStart) hooks.onStart(); patchLive(); }, false);
                const stopBtn = textBtn('Stop', () => { if (hooks.onStop) hooks.onStop(); patchLive(); }, false);
                const exportBtn = textBtn('Export', () => { if (hooks.onExport) hooks.onExport(); }, false);
                startBtn.style.borderColor = '#ffcc66';
                startBtn.style.color = '#ffcc66';
                stopBtn.style.borderColor = '#ff8888';
                stopBtn.style.color = '#ff8888';
                exportBtn.style.borderColor = '#88ff88';
                exportBtn.style.color = '#88ff88';
                row.appendChild(startBtn);
                row.appendChild(stopBtn);
                row.appendChild(exportBtn);
                profile.appendChild(row);
                const status = el('div', 'font-size:11px;color:#ccc;line-height:1.35;white-space:pre-wrap;', '-');
                bind('perf.profileStatus', status);
                profile.appendChild(status);
            }
        }
    }

    function patchPerformance(now, snap) {
        setBound('perf.fps', snap.fps != null ? String(snap.fps) : '-');
        setBound('perf.quality', snap.qualityTier || '-');
        const ft1 = avg(frameTimes, now - 1000);
        const ft5 = avg(frameTimes, now - 5000);
        const ft10 = avg(frameTimes, now - 10000);
        setBound('perf.ft1', fmtMs(ft1), ft1);
        setBound('perf.ft5', fmtMs(ft5), ft5);
        setBound('perf.ft10', fmtMs(ft10), ft10);
        const c1 = avg(cpuTimes, now - 1000);
        const c5 = avg(cpuTimes, now - 5000);
        const c10 = avg(cpuTimes, now - 10000);
        setBound('perf.cpu1', fmtMs(c1), c1);
        setBound('perf.cpu5', fmtMs(c5), c5);
        setBound('perf.cpu10', fmtMs(c10), c10);
        if (snap.frameBudget) {
            setBound('perf.budget',
                `${fmtMs(snap.frameBudget.frameAvg)} / ${fmtMs(snap.frameBudget.renderAvg)}`);
        } else {
            setBound('perf.budget', '-');
        }
        setBound('perf.catchup',
            lastBreakdown && Number.isFinite(lastBreakdown.catchupUpdates)
                ? String(lastBreakdown.catchupUpdates) : '-');
        setBound('perf.drop', lastBreakdown && lastBreakdown.accumulatorTruncated ? 'yes' : 'no');

        ['update', 'render', 'static', 'world', 'worldGlow', 'worldBodies', 'vignette', 'postFx', 'ui', 'other']
            .forEach((key) => {
                const v = phaseAvg(key, now);
                setBound('phase.' + key, fmtMs(v), v);
            });

        const sub = snap.subTimings || {};
        ['groundLoot', 'detailRings', 'remoteActors', 'worldGlow', 'worldBodies'].forEach((key) => {
            const v = sub[key];
            setBound('sub.' + key, fmtMs(v), typeof v === 'number' ? v : undefined);
        });

        const c = snap.counts;
        if (c) {
            setBound('perf.scene',
                `Enemies ${c.enemiesVisible}/${c.enemiesTotal}  Proj ${c.projectilesVisible}/${c.projectilesTotal}\n` +
                `Loot ${c.groundLootVisible}/${c.groundLootTotal}  Items ${c.groundItemsVisible}/${c.groundItemsTotal}`);
        } else {
            setBound('perf.scene', '-');
        }

        if (runProfileHooks && runProfileHooks.getStatus) {
            setBound('perf.profileStatus', runProfileHooks.getStatus());
        }
    }

    function resolveTargetName(stage) {
        if (!stage) return '?';
        if (typeof stage.target === 'function') return 'fn→';
        return stage.target || '?';
    }

    function groupStagesByTarget(stages) {
        const groups = [];
        const index = Object.create(null);
        stages.forEach((st, i) => {
            const target = resolveTargetName(st);
            if (!index[target]) {
                index[target] = { target, stages: [] };
                groups.push(index[target]);
            }
            index[target].stages.push({ stage: st, index: i + 1 });
        });
        return groups;
    }

    function pipelineSignature() {
        if (!boundPipeline || typeof boundPipeline.stages !== 'function') return '';
        return boundPipeline.stages().map((s) => s.id + ':' + resolveTargetName(s)).join('|');
    }

    function mountPipeline(root) {
        // Registry attach/detach controls (engine-owned DX)
        const regBox = el('div', 'margin-bottom:10px;padding:8px;border:1px solid #334433;border-radius:6px;');
        regBox.appendChild(el('div', 'font-weight:bold;color:#ffcc66;font-size:12px;margin-bottom:6px;',
            'Pipelines'));
        const registered = listPipelines();
        if (!registered.length) {
            regBox.appendChild(el('div', STYLE.label,
                'None registered. Game: Engine.Debug.registerPipeline(id, pipeline)'));
        } else {
            registered.forEach((info) => {
                const entry = pipelineRegistry[info.id];
                const row = el('div', 'margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #224422;');
                const title = el('div', 'font-size:12px;color:#fff;margin-bottom:4px;', '');
                title.textContent = `${info.label} (${info.stageCount} stages)` +
                    (viewingPipelineId === info.id ? ' · viewing' : '');
                row.appendChild(title);

                row.appendChild(checkbox('Profile stages', entry.profile, (v) => {
                    attach(info.id, { profile: v, snapshot: entry.snapshot });
                }, '#00ffff'));
                row.appendChild(checkbox('Snapshots / traces', entry.snapshot, (v) => {
                    attach(info.id, { profile: entry.profile, snapshot: v });
                }, '#ffcc66'));

                const actions = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;');
                actions.appendChild(textBtn('View', () => viewPipeline(info.id), true));
                actions.appendChild(textBtn('Attach both', () => {
                    attach(info.id, { profile: true, snapshot: true });
                }, true));
                actions.appendChild(textBtn('Detach', () => detach(info.id), true));
                row.appendChild(actions);
                regBox.appendChild(row);
            });
        }
        root.appendChild(regBox);

        const scrub = el('div', 'margin-bottom:10px;padding:8px;border:1px solid #224422;border-radius:6px;');
        const label = el('div', 'font-size:12px;color:#88ff88;margin-bottom:6px;', '-');
        bind('pipe.scrub', label);
        scrub.appendChild(label);
        const nav = el('div', 'display:flex;gap:6px;flex-wrap:wrap;');
        nav.appendChild(textBtn('◀', () => {
            if (history.length === 0) return;
            if (historyCursor < 0) historyCursor = history.length - 1;
            historyCursor = Math.max(0, historyCursor - 1);
            patchLive();
        }, true));
        nav.appendChild(textBtn('Live', () => {
            historyCursor = -1;
            if (!frozen) pinnedFrame = null;
            patchLive();
        }, true));
        nav.appendChild(textBtn('▶', () => {
            if (history.length === 0) return;
            if (historyCursor < 0) return;
            historyCursor = Math.min(history.length - 1, historyCursor + 1);
            if (historyCursor === history.length - 1) historyCursor = -1;
            patchLive();
        }, true));
        nav.appendChild(textBtn('Diff', () => setView({ kind: 'pipeline-diff' })));
        const unfreezeBtn = textBtn('Unfreeze', () => Debug.unfreeze());
        bind('pipe.unfreezeBtn', unfreezeBtn);
        unfreezeBtn.style.display = frozen ? '' : 'none';
        nav.appendChild(unfreezeBtn);
        scrub.appendChild(nav);
        root.appendChild(scrub);

        // Prefer viewing selection; fall back to first registered / bound
        if (!boundPipeline && viewingPipelineId && pipelineRegistry[viewingPipelineId]) {
            boundPipeline = pipelineRegistry[viewingPipelineId].pipeline;
        }
        if (!boundPipeline) {
            const first = Object.keys(pipelineRegistry)[0];
            if (first) {
                boundPipeline = pipelineRegistry[first].pipeline;
                viewingPipelineId = first;
            }
        }

        boundPipelineSig = pipelineSignature();
        if (!boundPipelineSig) {
            const miss = el('div', STYLE.label,
                'No pipeline to inspect. Register one, then View / Attach.');
            bind('pipe.missing', miss);
            root.appendChild(miss);
            return;
        }

        const recipe = boundPipeline.stages();
        const groups = groupStagesByTarget(recipe);
        groups.forEach((g) => {
            root.appendChild(el('div', 'font-weight:bold;color:#ffcc66;margin:10px 0 4px;font-size:12px;',
                `Target: ${g.target}`));
            g.stages.forEach(({ stage, index }) => {
                const btn = el('button', STYLE.row);
                btn.type = 'button';
                btn.style.fontSize = '12px';
                const left = el('span', '', `${index}. ${stage.id}`);
                const right = el('span', 'color:#88ff88;font-size:11px;text-align:right;', '-');
                bind('pipe.stage.' + stage.id, right);
                pipelineStageBinds[stage.id] = { msEl: right };
                btn.appendChild(left);
                btn.appendChild(right);
                btn.addEventListener('click', () => setView({ kind: 'pipeline-stage', stageId: stage.id }));
                root.appendChild(btn);
            });
        });
    }

    function patchPipeline() {
        const sig = pipelineSignature();
        if (sig !== boundPipelineSig) {
            invalidateMount();
            mountView();
            return;
        }
        const frame = getSelectedHistoryFrame();
        setBound('pipe.scrub', frame
            ? `Frame ${frame.frameIndex}${historyCursor < 0 && !pinnedFrame ? ' (live)' : ''} · ${history.length} buffered`
            : 'No history — enable Pipe Snapshots or open this view while collecting');
        if (binds['pipe.unfreezeBtn']) {
            binds['pipe.unfreezeBtn'].style.display = frozen ? '' : 'none';
        }

        const stageRecs = Object.create(null);
        if (frame && frame.stages) {
            frame.stages.forEach((s) => { stageRecs[s.id] = s; });
        }
        const timings = (frame && frame.stageTimings) || Object.create(null);
        Object.keys(pipelineStageBinds).forEach((id) => {
            const rec = stageRecs[id];
            const ms = timings[id] != null ? timings[id] : (rec && rec.ms);
            let badge = '';
            if (rec && rec.traces && rec.traces.length) badge += ` · ${rec.traces.length} traces`;
            if (rec && rec.snapshots && rec.snapshots.length) badge += ` · ${rec.snapshots.length} snaps`;
            if (rec && rec.bagOutSummary && rec.bagOutSummary.$keyCount != null) {
                badge += ` · bagOut ${rec.bagOutSummary.$keyCount} keys`;
            }
            setBound('pipe.stage.' + id, `${fmtMs(ms)}${badge}`, typeof ms === 'number' ? ms : undefined);
        });
    }

    function mountPipelineStageDetail(root, stageId) {
        const frame = getSelectedHistoryFrame();
        const rec = frame && (frame.stages || []).find((s) => s.id === stageId);
        root.appendChild(el('div', 'font-size:12px;color:#88ff88;margin-bottom:8px;',
            frame ? `Frame ${frame.frameIndex}` : 'No frame'));
        root.appendChild(boundMetricLine('Time', 'stage.ms'));
        setBound('stage.ms', fmtMs(rec && rec.ms), typeof (rec && rec.ms) === 'number' ? rec.ms : undefined);

        if (rec && rec.bagInSummary) {
            root.appendChild(el('div', 'font-weight:bold;margin:8px 0 4px;color:#ffcc66;font-size:12px;', 'bagIn'));
            const preIn = el('pre', 'font-size:10px;color:#ccc;white-space:pre-wrap;margin:0;', '');
            preIn.textContent = JSON.stringify(rec.bagInSummary, null, 2);
            root.appendChild(preIn);
        }
        if (rec && rec.bagOutSummary) {
            root.appendChild(el('div', 'font-weight:bold;margin:8px 0 4px;color:#ffcc66;font-size:12px;', 'bagOut'));
            const preOut = el('pre', 'font-size:10px;color:#ccc;white-space:pre-wrap;margin:0;', '');
            preOut.textContent = JSON.stringify(rec.bagOutSummary, null, 2);
            root.appendChild(preOut);
        }

        const traces = (rec && rec.traces) || [];
        root.appendChild(el('div', 'font-weight:bold;margin:8px 0 4px;color:#ffcc66;font-size:12px;',
            `Traces (${traces.length})`));
        if (!traces.length) {
            root.appendChild(el('div', STYLE.label, 'No traces — call Engine.Debug.trace(key, value) in the stage'));
        } else {
            traces.forEach((t) => {
                const line = el('div', 'font-size:11px;color:#88ff88;margin:2px 0;');
                const keyEl = el('span', 'color:#fff;font-weight:bold;', '');
                keyEl.textContent = t.key;
                line.appendChild(keyEl);
                const valEl = el('span', '', '');
                valEl.textContent = ': ' + JSON.stringify(t.value);
                line.appendChild(valEl);
                root.appendChild(line);
            });
        }

        const snaps = (rec && rec.snapshots) || [];
        root.appendChild(el('div', 'font-weight:bold;margin:8px 0 4px;color:#ffcc66;font-size:12px;',
            `Snapshots (${snaps.length})`));
        snaps.forEach((s) => {
            const lab = el('div', 'font-size:11px;color:#ffcc66;margin-top:4px;', '');
            lab.textContent = s.label;
            root.appendChild(lab);
            const pre = el('pre', 'font-size:10px;color:#ccc;white-space:pre-wrap;margin:0;', '');
            pre.textContent = JSON.stringify(s.data, null, 2);
            root.appendChild(pre);
        });
    }

    function mountPipelineDiff(root) {
        if (history.length < 2) {
            root.appendChild(el('div', STYLE.label, 'Need at least 2 history frames. Enable Pipe Snapshots.'));
            return;
        }
        let idx = historyCursor < 0 ? history.length - 1 : historyCursor;
        idx = Math.max(1, idx);
        const a = history[idx - 1];
        const b = history[idx];
        root.appendChild(el('div', 'font-size:12px;color:#88ff88;margin-bottom:8px;',
            `Comparing frame ${a.frameIndex} → ${b.frameIndex}`));

        const diff = diffFrames(a, b);

        root.appendChild(el('div', 'font-weight:bold;color:#ffcc66;font-size:12px;margin:6px 0;', 'Timings'));
        if (!diff.timings.length) root.appendChild(el('div', STYLE.label, 'No timing deltas'));
        diff.timings.forEach((t) => {
            root.appendChild(el('div', 'font-size:11px;color:#88ff88;',
                `${t.stageId}: ${t.from.toFixed(2)} → ${t.to.toFixed(2)} (${t.delta >= 0 ? '+' : ''}${t.delta.toFixed(2)}ms)`));
        });

        root.appendChild(el('div', 'font-weight:bold;color:#ffcc66;font-size:12px;margin:8px 0 4px;', 'Traces'));
        if (!diff.traces.length) root.appendChild(el('div', STYLE.label, 'No trace changes'));
        diff.traces.slice(0, 40).forEach((c) => {
            root.appendChild(el('div', 'font-size:11px;color:#88ff88;margin:2px 0;',
                `${c.kind} ${c.path}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`));
        });

        root.appendChild(el('div', 'font-weight:bold;color:#ffcc66;font-size:12px;margin:8px 0 4px;', 'Bag summaries'));
        if (!diff.bags.length) root.appendChild(el('div', STYLE.label, 'No bag summary changes'));
        diff.bags.forEach((bag) => {
            root.appendChild(el('div', 'font-size:12px;color:#fff;margin-top:4px;', bag.stageId));
            bag.changes.slice(0, 20).forEach((c) => {
                root.appendChild(el('div', 'font-size:11px;color:#88ff88;',
                    `${c.kind} ${c.path}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`));
            });
        });
    }

    // Keep legacy name as alias for any internal call sites during transition
    function renderView() {
        invalidateMount();
        mountView();
    }

    // --- Public API ------------------------------------------------------------

    const Debug = {
        flags,
        get visible() { return visible; },
        get frozen() { return frozen; },
        set frozen(v) { frozen = !!v; },

        init() {
            if (panelElement) return this;

            this.registerSection({
                id: 'performance',
                title: 'Performance',
                order: 20,
                hint: (dbg) => {
                    const s = dbg.metrics && dbg.metrics.snapshot;
                    return s && s.fps != null ? `${s.fps} fps ›` : '›';
                }
            });
            this.registerSection({
                id: 'pipeline',
                title: 'Pipeline',
                order: 30,
                hint: () => {
                    const list = listPipelines();
                    if (!list.length) return 'none ›';
                    const attached = list.filter((p) => p.profile || p.snapshot).length;
                    return attached ? `${attached}/${list.length} on ›` : `${list.length} reg ›`;
                }
            });

            panelElement = el('div', STYLE.panel);
            panelElement.id = 'debugPanel';

            const header = el('div', STYLE.header);
            backBtn = textBtn('←', () => goBack(), true);
            backBtn.style.display = 'none';
            backBtn.style.flexShrink = '0';
            titleEl = el('div', 'flex:1;font-weight:bold;font-size:15px;text-align:center;', 'DEBUG');
            const homeBtn = textBtn('⌂', () => goHome(), true);
            homeBtn.title = 'Home';
            homeBtn.style.flexShrink = '0';
            header.appendChild(backBtn);
            header.appendChild(titleEl);
            header.appendChild(homeBtn);
            panelElement.appendChild(header);

            bodyEl = el('div', STYLE.body);
            panelElement.appendChild(bodyEl);

            document.body.appendChild(panelElement);
            panelElement.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
            panelElement.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
            // Bubble phase only — capture+stopPropagation would kill button clicks before they fire.
            ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend']
                .forEach((type) => {
                    panelElement.addEventListener(type, (e) => e.stopPropagation());
                });

            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggle();
                }
            }, { capture: true });

            mountView();
            return this;
        },

        toggle() {
            if (visible) this.hide();
            else this.show();
            console.log(`Debug panel ${visible ? 'opened' : 'closed'}`);
        },

        show() {
            visible = true;
            if (panelElement) panelElement.style.display = 'block';
            // Remount only if nothing is mounted yet; otherwise patch.
            if (!mountedKey) mountView();
            else patchLive();
        },

        hide() {
            visible = false;
            if (panelElement) panelElement.style.display = 'none';
        },

        registerSection(spec) {
            if (!spec || typeof spec.id !== 'string') {
                throw new TypeError('registerSection requires { id, ... }');
            }
            const existing = sections.findIndex((s) => s.id === spec.id);
            if (existing >= 0) sections[existing] = Object.assign(sections[existing], spec);
            else sections.push(spec);
            if (visible && view.kind === 'home') {
                invalidateMount();
                mountView();
            }
            return this;
        },

        registerMetricGroup(spec) {
            if (!spec || typeof spec.id !== 'string') {
                throw new TypeError('registerMetricGroup requires { id, ... }');
            }
            const existing = metricGroups.findIndex((g) => g.id === spec.id);
            if (existing >= 0) metricGroups[existing] = Object.assign(metricGroups[existing], spec);
            else metricGroups.push(spec);
            return this;
        },

        registerRunProfile(hooks) {
            runProfileHooks = hooks || null;
            return this;
        },

        bindPipeline(pipeline) {
            boundPipeline = pipeline || null;
            viewingPipelineId = null;
            if (pipeline) {
                const ids = Object.keys(pipelineRegistry);
                for (let i = 0; i < ids.length; i++) {
                    if (pipelineRegistry[ids[i]].pipeline === pipeline) {
                        viewingPipelineId = ids[i];
                        break;
                    }
                }
            }
            if (visible && pipelineFocus) {
                invalidateMount();
                mountView();
            }
            return this;
        },

        registerPipeline,
        unregisterPipeline,
        attach,
        detach,
        viewPipeline,
        listPipelines,
        wantsProfile,
        wantsSnapshot,
        setActivePipelineId,
        /** Remount pipeline registry UI after late registration (e.g. post-boot). */
        refresh() {
            refreshRegistryUi();
            return this;
        },

        addCollector(fn) {
            if (typeof fn === 'function') collectors.push(fn);
            return this;
        },

        shouldCollect,
        shouldSnapshot,
        sanitizeDebugValue,

        beginStage,
        endStage,
        trace,
        captureSnapshot,
        summarizeBag,

        setHistorySize(n) {
            historySize = Math.max(1, Math.min(600, Number(n) || DEFAULT_HISTORY));
            while (history.length > historySize) history.shift();
        },

        getHistory() {
            return history.slice();
        },

        breakWhen(pred) {
            breakPredicates.push(pred);
            return this;
        },

        clearBreaks() {
            breakPredicates.length = 0;
            return this;
        },

        setBreakMode(mode) {
            breakMode = mode === 'log' ? 'log' : 'break';
            return this;
        },

        unfreeze() {
            frozen = false;
            pinnedFrame = null;
            if (visible) patchLive();
        },

        update(frameMetrics) {
            lastBreakdown = frameMetrics || null;
            const now = Date.now();

            let deltaTime = null;
            let processTime = null;
            let breakdown = frameMetrics;
            if (arguments.length >= 3) {
                deltaTime = arguments[0];
                processTime = arguments[1];
                breakdown = arguments[2];
                lastBreakdown = breakdown;
            } else if (frameMetrics && typeof frameMetrics === 'object' && 'realDeltaTime' in frameMetrics) {
                deltaTime = frameMetrics.realDeltaTime;
                processTime = frameMetrics.processTime;
                breakdown = frameMetrics;
                lastBreakdown = breakdown;
            }

            if (shouldCollect() || shouldSnapshot()) {
                if (typeof deltaTime === 'number' && isFinite(deltaTime)) {
                    pushTimed(frameTimes, now, deltaTime * 1000, 10000);
                }
                if (typeof processTime === 'number' && isFinite(processTime)) {
                    pushTimed(cpuTimes, now, processTime, 10000);
                }
                if (breakdown && typeof breakdown === 'object') {
                    ['update', 'render', 'static', 'world', 'worldGlow', 'worldBodies', 'vignette', 'postFx', 'ui']
                        .forEach((k) => pushPhase(k, breakdown[k], now));
                    const phaseSum = (breakdown.static || 0) + (breakdown.world || 0) +
                        (breakdown.vignette || 0) + (breakdown.postFx || 0) + (breakdown.ui || 0);
                    const otherRender = typeof breakdown.render === 'number'
                        ? Math.max(0, breakdown.render - phaseSum) : 0;
                    pushPhase('other', otherRender, now);

                    if (shouldSnapshot() || buildingFrame) {
                        commitHistoryFrame({
                            processTime,
                            updateTime: breakdown.update,
                            renderTime: breakdown.render,
                            stageTimings: breakdown.stageTimings ||
                                (breakdown.snapshot && breakdown.snapshot.stageTimings) || null
                        });
                    } else {
                        frameIndex += 1;
                    }
                }
            }

            if (!visible) return;
            if (now - lastMetricsDomUpdate < 200) return;
            lastMetricsDomUpdate = now;
            // Never remount on the tick — mutate bound nodes only.
            patchLive();
        }
    };

    // Expose sanitize for tests
    Debug._sanitizeDebugValue = sanitizeDebugValue;
    Debug._summarizeBag = summarizeBag;
    Debug._diffFrames = diffFrames;

    Engine.Debug = Debug;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Debug;
    }
})(typeof window !== 'undefined' ? window : globalThis);

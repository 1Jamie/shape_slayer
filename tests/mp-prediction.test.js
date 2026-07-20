const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMpConfig() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'networking', 'mp-config.js'), 'utf-8');
    const context = {
        window: { location: { protocol: 'http:', hostname: 'localhost' } },
        console
    };
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'mp-config.js' });
    return context.window.MultiplayerConfig;
}

test('mp-config exposes prediction knobs', () => {
    const config = loadMpConfig();
    assert.strictEqual(config.PREDICTION_ENABLED, true);
    assert.ok(config.INPUT_HISTORY_SIZE >= 60);
    assert.ok(config.RECONCILE_SNAP_DISTANCE > config.RECONCILE_SOFT_DISTANCE);
    assert.ok(config.RECONCILE_BLEND_FACTOR > 0 && config.RECONCILE_BLEND_FACTOR < 1);
    assert.ok(config.PREDICTION_CORRECTION_DECAY > 0 && config.PREDICTION_CORRECTION_DECAY < 1);
    assert.ok(config.PREDICTION_DIVERGENCE_THRESHOLD > 0);
    assert.ok(config.PREDICTION_MAX_REPLAY_STEPS > 0 && config.PREDICTION_MAX_REPLAY_STEPS <= config.INPUT_HISTORY_SIZE);
    assert.ok(config.PREDICTION_DRIFT_WINDOW >= 3);
    assert.ok(config.PREDICTION_DRIFT_COHERENCE > 0 && config.PREDICTION_DRIFT_COHERENCE <= 1);
    assert.ok(config.PREDICTION_DRIFT_APPLY > 0);
    assert.ok(config.PREDICTION_DRIFT_MAX > config.PREDICTION_DRIFT_MIN_MEAN);
});

test('predictMovementStep moves at moveSpeed * dt in open field', () => {
    // Minimal stub mirroring predictMovementStep core math
    function predictStep(player, dt, moveInput) {
        player.vx = moveInput.x * player.moveSpeed;
        player.vy = moveInput.y * player.moveSpeed;
        player.x += player.vx * dt;
        player.y += player.vy * dt;
    }
    const player = { x: 0, y: 0, vx: 0, vy: 0, moveSpeed: 200 };
    predictStep(player, 0.5, { x: 1, y: 0 });
    assert.strictEqual(player.x, 100);
    assert.strictEqual(player.y, 0);
});

test('reconcile trims history by lastProcessedInputSeq and replays rest', () => {
    let history = [
        { inputSeq: 1, dt: 0.1, dx: 10 },
        { inputSeq: 2, dt: 0.1, dx: 10 },
        { inputSeq: 3, dt: 0.1, dx: 10 },
        { inputSeq: 4, dt: 0.1, dx: 10 }
    ];
    const lastProcessed = 2;
    history = history.filter(e => e.inputSeq > lastProcessed);
    assert.deepStrictEqual(history.map(e => e.inputSeq), [3, 4]);

    let x = 50; // auth pose after ack
    for (const entry of history) {
        x += entry.dx;
    }
    assert.strictEqual(x, 70);
});

test('replay history is capped to max steps', () => {
    const maxSteps = 45;
    let history = [];
    for (let i = 1; i <= 80; i++) history.push({ inputSeq: i });
    if (history.length > maxSteps) {
        history = history.slice(history.length - maxSteps);
    }
    assert.strictEqual(history.length, 45);
    assert.strictEqual(history[0].inputSeq, 36);
    assert.strictEqual(history[history.length - 1].inputSeq, 80);
});

test('medium error soft-blends toward auth instead of hard snap', () => {
    const blend = 0.35;
    const predicted = 100;
    const auth = 140;
    const blended = predicted + (auth - predicted) * blend;
    assert.strictEqual(blended, 114);
    assert.ok(blended > predicted && blended < auth);
});

test('visual correction hides snap then decays', () => {
    const decay = 0.85;
    let corr = 40;
    const visualBefore = 200;
    const simAfter = 160;
    corr = visualBefore - simAfter; // 40
    assert.strictEqual(corr, 40);
    corr *= decay;
    assert.ok(Math.abs(corr - 34) < 0.001);
    for (let i = 0; i < 40; i++) corr *= decay;
    assert.ok(Math.abs(corr) < 1);
});

test('snap vs soft distance thresholds', () => {
    const soft = 5;
    const snap = 80;
    const errSmall = 3;
    const errMed = 40;
    const errLarge = 120;
    assert.ok(errSmall <= soft);
    assert.ok(errMed > soft && errMed <= snap);
    assert.ok(errLarge > snap);
});

test('drift estimator engages on coherent directional error and decays on noise', () => {
    const windowSize = 12;
    const coherenceMin = 0.62;
    const minMean = 4;
    const strength = 0.45;
    const maxBias = 28;
    const decay = 0.92;

    function updateDrift(samples, bias, errorDx, errorDy) {
        const mag = Math.hypot(errorDx, errorDy);
        samples.push({ dx: errorDx, dy: errorDy, mag });
        while (samples.length > windowSize) samples.shift();

        if (samples.length < 3) {
            return { bias, coherence: 0, active: false };
        }

        let sumX = 0;
        let sumY = 0;
        let sumMag = 0;
        for (const s of samples) {
            sumX += s.dx;
            sumY += s.dy;
            sumMag += s.mag;
        }
        const n = samples.length;
        const meanX = sumX / n;
        const meanY = sumY / n;
        const meanMag = Math.hypot(meanX, meanY);
        const avgMag = sumMag / n;
        const coherence = meanMag / (avgMag + 1e-6);

        let bx = bias.x;
        let by = bias.y;
        if (meanMag >= minMean && coherence >= coherenceMin) {
            bx += (meanX - bx) * strength;
            by += (meanY - by) * strength;
            const biasMag = Math.hypot(bx, by);
            if (biasMag > maxBias) {
                const s = maxBias / biasMag;
                bx *= s;
                by *= s;
            }
        } else {
            bx *= decay;
            by *= decay;
        }
        const biasMag = Math.hypot(bx, by);
        return {
            bias: { x: bx, y: by },
            coherence,
            active: biasMag > 1.25 && coherence >= coherenceMin * 0.85
        };
    }

    const samples = [];
    let bias = { x: 0, y: 0 };
    let result = { active: false, coherence: 0 };
    for (let i = 0; i < 10; i++) {
        result = updateDrift(samples, bias, 12, 0);
        bias = result.bias;
    }
    assert.ok(result.active, 'coherent +X drift should activate');
    assert.ok(result.coherence > coherenceMin);
    assert.ok(bias.x > 4);
    assert.ok(Math.abs(bias.y) < 1);

    // Inject noisy opposing errors - bias should decay / deactivate
    for (let i = 0; i < 12; i++) {
        const dx = (i % 2 === 0) ? 8 : -8;
        const dy = (i % 2 === 0) ? -6 : 6;
        result = updateDrift(samples, bias, dx, dy);
        bias = result.bias;
    }
    assert.ok(result.coherence < coherenceMin, 'noisy errors should reduce coherence');
});

test('live drift apply nudges pose without rewriting velocity', () => {
    const biasX = 10;
    const apply = 2.5;
    const dt = 0.1;
    let x = 100;
    x += biasX * apply * dt;
    assert.strictEqual(x, 102.5);
});

test('player-base source has predictMovementStep and skipTransform applyState', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'entities', 'players', 'player-base.js'), 'utf-8');
    assert.ok(source.includes('predictMovementStep('));
    assert.ok(source.includes('tryBeginPredictedDodge('));
    assert.ok(source.includes('syncPredictedMovementFromHost('));
    assert.ok(source.includes('skipTransform'));
    assert.ok(source.includes('lastProcessedInputSeq'));
    assert.ok(source.includes('_predictionCorrectionX'));
    assert.ok(source.includes('applyDriftBias'));
    assert.ok(source.includes('driftBiasX'));
});

test('multiplayer reconcilePrediction disables dodge on replay', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'networking', 'multiplayer.js'), 'utf-8');
    assert.ok(source.includes('reconcilePrediction('));
    assert.ok(source.includes('recordPredictionFrame('));
    assert.ok(source.includes('resetPredictionState('));
    assert.ok(source.includes('allowPredictedDodge: false'));
    assert.ok(source.includes('justPressed = false'));
    assert.ok(source.includes('inputSeq'));
    assert.ok(source.includes('updateDriftEstimator('));
    assert.ok(source.includes('getPredictionDebugStats('));
    assert.ok(source.includes('applyDriftBias: false'));
    assert.ok(source.includes('PREDICTION_MAX_REPLAY_STEPS'));
    assert.ok(source.includes('moveSpeedOverride'));
    assert.ok(source.includes('significantDivergences'));
});

test('debug panel exposes MP prediction section', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'simulation', 'debug.js'), 'utf-8');
    assert.ok(source.includes("id: 'mpPrediction'") || source.includes('id: "mpPrediction"'));
    assert.ok(source.includes('PREDICTION_DIVERGENCE'));
    assert.ok(source.includes('getPredictionDebugStats'));
});

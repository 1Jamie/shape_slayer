const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Require extracted presentation & simulation modules
const root = path.join(__dirname, '..');
require(path.join(root, 'src/game/presentation/render-quality.js'));
require(path.join(root, 'src/game/presentation/display-manager.js'));
require(path.join(root, 'src/game/presentation/screen-effects.js'));
require(path.join(root, 'src/game/presentation/game-camera.js'));
require(path.join(root, 'src/game/presentation/boss-intro.js'));
require(path.join(root, 'src/game/simulation/room-transition.js'));
require(path.join(root, 'src/game/simulation/split-session.js'));

test('Zero-Allocation & GC Pressure Hot-Path Guards', async (t) => {
    // Helper to run GC if node was launched with --expose-gc
    const maybeGC = () => {
        if (typeof global.gc === 'function') {
            global.gc();
        }
    };

    await t.test('GameCameraManager updateCamera hot loop produces minimal GC heap pressure', () => {
        const mockGame = {
            player: { x: 100, y: 200, vx: 5, vy: -2, alive: true },
            camera: {
                x: 0, y: 0,
                setViewSize() { return this; },
                setZoom() { return this; },
                follow() { return this; }
            },
            config: { width: 1280, height: 720 },
            getViewZoom: () => 1
        };

        maybeGC();
        // Warm up V8 JIT & hidden classes
        for (let i = 0; i < 200; i++) {
            GameCameraManager.updateCamera(mockGame, 0.0166);
        }
        maybeGC();

        const heapBefore = process.memoryUsage().heapUsed;
        for (let i = 0; i < 1000; i++) {
            GameCameraManager.updateCamera(mockGame, 0.0166);
        }
        maybeGC();
        const heapAfter = process.memoryUsage().heapUsed;
        const growthBytes = Math.max(0, heapAfter - heapBefore);

        // Assert growth for 1,000 hot-loop ticks is under 64 KB
        assert.ok(growthBytes < 65536, `Camera update loop heap growth too high: ${growthBytes} bytes`);
    });

    await t.test('GameScreenEffects updateScreenShake hot loop allocation guard', () => {
        const mockGame = {
            screenShakeIntensity: 10,
            screenShakeDuration: 0.5,
            screenShakeOffset: { x: 0, y: 0 }
        };

        maybeGC();
        for (let i = 0; i < 200; i++) {
            GameScreenEffects.updateScreenShake(mockGame, 0.0166);
        }
        maybeGC();

        const heapBefore = process.memoryUsage().heapUsed;
        for (let i = 0; i < 1000; i++) {
            GameScreenEffects.updateScreenShake(mockGame, 0.0166);
        }
        maybeGC();
        const heapAfter = process.memoryUsage().heapUsed;
        const growthBytes = Math.max(0, heapAfter - heapBefore);

        assert.ok(growthBytes < 65536, `Screen shake update loop heap growth too high: ${growthBytes} bytes`);
    });

    await t.test('GameBossIntro updateBossIntro hot loop allocation guard', () => {
        const mockGame = {
            bossIntroData: {
                boss: { bossName: 'TestBoss', introComplete: false },
                elapsedTime: 0,
                duration: 3.0,
                skipAvailable: false
            },
            endBossIntro: () => {}
        };

        maybeGC();
        for (let i = 0; i < 200; i++) {
            GameBossIntro.updateBossIntro(mockGame, 0.001);
        }
        maybeGC();

        const heapBefore = process.memoryUsage().heapUsed;
        for (let i = 0; i < 1000; i++) {
            GameBossIntro.updateBossIntro(mockGame, 0.001);
        }
        maybeGC();
        const heapAfter = process.memoryUsage().heapUsed;
        const growthBytes = Math.max(0, heapAfter - heapBefore);

        assert.ok(growthBytes < 65536, `Boss intro update loop heap growth too high: ${growthBytes} bytes`);
    });
});

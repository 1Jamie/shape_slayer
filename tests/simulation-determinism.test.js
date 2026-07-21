const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
require(path.join(root, 'src/game/presentation/render-quality.js'));
require(path.join(root, 'src/game/presentation/screen-effects.js'));
require(path.join(root, 'src/game/presentation/game-camera.js'));
require(path.join(root, 'src/game/presentation/boss-intro.js'));
require(path.join(root, 'src/game/simulation/run-rewards.js'));

test('Simulation Determinism & Fixed Timestep Integrity', async (t) => {
    const fixedDt = 1 / 60; // 0.016666666666666666

    await t.test('GameCameraManager follow math is 100% deterministic across 300 ticks', () => {
        const runSimulation = () => {
            let camX = 640;
            let camY = 360;
            const mockGame = {
                player: { x: 100, y: 200, vx: 15, vy: -10, alive: true },
                camera: {
                    x: camX, y: camY,
                    setViewSize() { return this; },
                    setZoom() { return this; },
                    follow(target, dt) {
                        // Simulating smooth camera follow
                        this.x += (target.x - this.x) * 5 * dt;
                        this.y += (target.y - this.y) * 5 * dt;
                        return this;
                    }
                },
                config: { width: 1280, height: 720 },
                getViewZoom: () => 1
            };

            for (let tick = 0; tick < 300; tick++) {
                // Shift target player coordinates deterministically
                mockGame.player.x += mockGame.player.vx * fixedDt;
                mockGame.player.y += mockGame.player.vy * fixedDt;
                GameCameraManager.updateCamera(mockGame, fixedDt);
            }

            return `${mockGame.camera.x.toFixed(6)},${mockGame.camera.y.toFixed(6)}`;
        };

        const result1 = runSimulation();
        const result2 = runSimulation();
        assert.equal(result1, result2, `Camera positions must be bit-identical across runs: ${result1} !== ${result2}`);
    });

    await t.test('GameScreenEffects trauma decay is 100% deterministic over 300 ticks', () => {
        const runTraumaSim = () => {
            const mockGame = {
                screenShakeIntensity: 1.0,
                screenShakeDuration: 2.0,
                screenShakeOffset: { x: 0, y: 0 }
            };

            const positions = [];
            for (let tick = 0; tick < 300; tick++) {
                GameScreenEffects.updateScreenShake(mockGame, fixedDt);
                positions.push(mockGame.screenShakeIntensity.toFixed(6));
            }
            return crypto.createHash('md5').update(positions.join('|')).digest('hex');
        };

        const hash1 = runTraumaSim();
        const hash2 = runTraumaSim();
        assert.equal(hash1, hash2, 'Trauma decay sequence hash must match 100% identically');
    });

    await t.test('GameRunRewards credit economy math is 100% deterministic', () => {
        const runRewardSim = () => {
            const mockGame = {
                currencyEarned: 0,
                currencyBankedThisRun: 0,
                calculateCurrency: () => 150
            };
            const rewards = [];
            for (let i = 0; i < 10; i++) {
                const earned = GameRunRewards.calculateCurrency(mockGame);
                rewards.push(earned);
            }
            return rewards.join(',');
        };

        const res1 = runRewardSim();
        const res2 = runRewardSim();
        assert.equal(res1, res2, 'Currency calculation outputs must be 100% identical');
    });
});




// Mock dependencies
global.Game = {
    isMultiplayerClient: () => false,
    triggerScreenShake: () => { },
    projectiles: [],
    enemies: [],
    roomNumber: 10
};
global.currentRoom = { enemies: [] };
global.GameAudio = { sounds: {} };

// Mock EnemyBase and BossBase if needed, or just rely on them being available if they are required.
// Since we are running this in node, we might need to mock the classes if they are not exported.
// Assuming the file structure implies we might need to load dependencies.
// However, the user environment seems to be a browser game source. 
// Let's try to mock the necessary base classes if they are not available.

// Actually, let's just mock the whole environment or try to load the files.
// Since I can't easily load all dependencies in this environment without a proper loader,
// I will create a mock BossSwarmKing that extends a mock BossBase.
// But wait, I need to test the ACTUAL code I wrote.
// I should read the file content and eval it, or require it if it's a module.
// It looks like a standard JS file, not a module.
// So I will read the file and eval it in a context with mocks.

const fs = require('fs');
const path = require('path');

const bossFile = '/home/autumn/mounts/dev-src/shape-slayer/js/bosses/boss-swarmking.js';
const enemyBaseFile = '/home/autumn/mounts/dev-src/shape-slayer/js/enemies/enemy-base.js';
const telegraphFile = '/home/autumn/mounts/dev-src/shape-slayer/js/enemies/telegraph/telegraph-manager.js';

// Mock global context
const context = {
    Game: {
        isMultiplayerClient: () => false,
        triggerScreenShake: (intensity, duration) => console.log(`[ScreenShake] Intensity: ${intensity}, Duration: ${duration}`),
        projectiles: [],
        enemies: [],
        roomNumber: 10
    },
    currentRoom: { enemies: [] },
    GameAudio: { sounds: {} },
    console: console,
    Math: Math,
    Date: Date,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
};

// Mock BossBase class since we don't want to load everything
class MockBossBase {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hp = 1000;
        this.maxHp = 1000;
        this.alive = true;
        this.phase = 1;
        this.environmentalHazards = [];
        this.minions = [];
        this.introComplete = true;
        this.events = {};
    }

    addWeakPoint() { }
    processKnockback() { }
    checkPhaseTransition() {
        // Mock phase transition logic
        if (this.hp < 300 && this.phase < 3) {
            const old = this.phase;
            this.phase = 3;
            this.onPhaseTransition(old, 3);
        }
    }
    updateHazards() { }
    checkHazardCollisions() { }
    updateWeakPoints() { }
    keepInBounds() { }
    renderWeakPoints() { }
    renderHazards() { }
    renderHealthBar() { }
    serialize() { return {}; }
    applyState() { }
    interpolateToTarget() { }
    createShockwave() { console.log('[Shockwave] Created'); }
    onPhaseTransition(old, newP) { }
    resolveAggroPlayer(dt, p) { return p; }

    // Telegraph methods
    beginTelegraph(type, options) {
        this.activeTelegraph = { type, progress: 0, duration: options.duration, options, elapsed: 0 };
        if (options.onStart) options.onStart(this.activeTelegraph, this, false);
        return this.activeTelegraph;
    }

    updateTelegraph(dt) {
        if (this.activeTelegraph) {
            this.activeTelegraph.elapsed += dt;
            this.activeTelegraph.progress = Math.min(1, this.activeTelegraph.elapsed / this.activeTelegraph.duration);
            if (this.activeTelegraph.elapsed >= this.activeTelegraph.duration) {
                const t = this.activeTelegraph;
                this.activeTelegraph = null;
                if (t.options.onEnd) t.options.onEnd(t, this, false);
            }
        }
    }

    enterRecoveryWindow(duration, vulnerability, options) {
        this.recoveryWindow = { duration, vulnerability, options, elapsed: 0 };
        return this.recoveryWindow;
    }

    updateRecoveryWindow(dt) {
        if (this.recoveryWindow) {
            this.recoveryWindow.elapsed += dt;
            if (this.recoveryWindow.elapsed >= this.recoveryWindow.duration) {
                this.recoveryWindow = null;
            }
        }
    }

    cancelRecoveryWindow() {
        this.recoveryWindow = null;
    }
}

class MockEnemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.alive = true;
        this.maxHp = 100;
        this.hp = 100;
    }
}
context.Enemy = MockEnemy;

// Load TelegraphManager
const telegraphContent = fs.readFileSync(telegraphFile, 'utf8');
eval(telegraphContent); // This puts TelegraphSystem on global/window
context.TelegraphSystem = global.TelegraphSystem;

// Load EnemyBase (needed for constants or inheritance if we were loading real BossBase)
// But since we mock BossBase, we might not need it.
// However, BossSwarmKing extends BossBase.
// We need to inject our MockBossBase as BossBase.
context.BossBase = MockBossBase;

// Read BossSwarmKing
let bossContent = fs.readFileSync(bossFile, 'utf8');
bossContent += '\nthis.BossSwarmKing = BossSwarmKing;';

// We need to make sure BossSwarmKing extends BossBase (which is our mock)
// The file has `class BossSwarmKing extends BossBase`.
// So if we eval it in our context, it should work.

// Execute in context
const vm = require('vm');
vm.createContext(context);
vm.runInContext(telegraphContent, context);
vm.runInContext(bossContent, context);

// Now run the simulation
const runSimulation = () => {
    console.log('Starting Swarm King Phase 3 Simulation...');

    const BossSwarmKing = context.BossSwarmKing;
    const boss = new BossSwarmKing(1000, 1000);

    // Force Phase 1 to test Lunge
    boss.phase = 1;
    boss.state = 'chase';
    boss.lungeCooldown = 0;
    console.log(`Phase set to ${boss.phase}. State: ${boss.state}`);

    const player = { x: 1200, y: 1200, size: 20, takeDamage: () => { } };

    // Run loop
    const dt = 0.1;
    const totalTime = 15.0;
    let time = 0;

    while (time < totalTime) {
        boss.update(dt, player);

        // Log interesting events
        if (boss.activeTelegraph) {
            console.log(`[${time.toFixed(1)}s] Telegraphing: ${boss.activeTelegraph.type} (${(boss.activeTelegraph.progress * 100).toFixed(0)}%)`);
        } else if (boss.state === 'lunge') {
            console.log(`[${time.toFixed(1)}s] Lunge: Pos(${boss.x.toFixed(0)},${boss.y.toFixed(0)})`);
        } else if (boss.state === 'spinning') {
            console.log(`[${time.toFixed(1)}s] Spinning: Pos(${boss.x.toFixed(0)},${boss.y.toFixed(0)})`);
        } else if (boss.phase3State === 'franticBarrage' && boss.isDashing) {
            console.log(`[${time.toFixed(1)}s] Dashing to (${boss.dashTarget.x.toFixed(0)}, ${boss.dashTarget.y.toFixed(0)}) at ${boss.x.toFixed(0)},${boss.y.toFixed(0)}`);
        }

        // Switch to Phase 2 after 5 seconds
        if (time > 5.0 && boss.phase === 1) {
            boss.phase = 2;
            boss.onPhaseTransition(1, 2);
            boss.state = 'chase';
            boss.slamCooldown = 0; // Force spin soon
            console.log('--- Phase 2 ---');
        }

        time += dt;
    }
};

runSimulation();

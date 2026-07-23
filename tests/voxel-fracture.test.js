// Comprehensive unit tests for God-Tier Multi-Variable Voxel Disintegration Engine.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const fs = require('node:fs');

function createMockCtx() {
    const ctx = {
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        filter: 'none',
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        clearRect: () => {},
        setTransform: () => {},
        translate: () => {},
        scale: () => {},
        rotate: () => {},
        fillRect: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        rect: () => {},
        fill: () => {},
        drawImage: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        ellipse: () => {},
        stroke: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        arc: () => {},
        strokeRect: () => {}
    };
    return ctx;
}

function loadVoxelFractureModule() {
    const sandbox = {
        globalThis: {},
        Engine: {
            Graphics: {
                createCanvas: (w, h) => {
                    const ctx = createMockCtx();
                    const canvas = { width: w, height: h, getContext: () => ctx };
                    ctx.canvas = canvas;
                    return canvas;
                }
            }
        },
        Math,
        Uint8Array,
        Float32Array,
        Int16Array,
        Int32Array,
        ArrayBuffer,
        SharedArrayBuffer,
        Map,
        Set,
        Object,
        Array,
        Date,
        console,
        isNaN
    };
    sandbox.globalThis = sandbox;
    sandbox.Engine.Graphics.CanvasPool = {
        acquire: (w, h) => sandbox.Engine.Graphics.createCanvas(w, h),
        release: () => {}
    };
    sandbox.Engine.Graphics.GlowAtlas = {};
    sandbox.document = {
        createElement: (tag) => sandbox.Engine.Graphics.createCanvas(1, 1)
    };

    const procCode = fs.readFileSync(path.join(__dirname, '../src/engine/proc.js'), 'utf8');
    const physCode = fs.readFileSync(path.join(__dirname, '../src/engine/physics.js'), 'utf8');
    const fxCode = fs.readFileSync(path.join(__dirname, '../src/engine/fx.js'), 'utf8');
    const voxelCode = fs.readFileSync(path.join(__dirname, '../src/game/presentation/voxel-fracture.js'), 'utf8');

    vm.createContext(sandbox);
    vm.runInContext(procCode, sandbox);
    vm.runInContext(physCode, sandbox);
    vm.runInContext(fxCode, sandbox);
    vm.runInContext(voxelCode, sandbox);
    return sandbox;
}

test('God-Tier Multi-Variable Voxel Disintegration Engine', async (t) => {
    await t.test('Engine.Proc.VoxelDisintegration computes 4-variable stress score (S)', () => {
        const env = loadVoxelFractureModule();
        const Disintegration = env.Engine.Proc.VoxelDisintegration;

        assert.ok(Disintegration, 'Engine.Proc.VoxelDisintegration should exist');

        const enemyDiamond = { shape: 'diamond', size: 30, maxHp: 100, x: 100, y: 100 };
        const enemyRectangle = { shape: 'rectangle', size: 30, maxHp: 100, x: 100, y: 100 };

        // Core hit on Diamond (compressive stress + high crystalline tension)
        const sCoreDiamond = Disintegration.computeStressScore({ x: 100, y: 100 }, enemyDiamond, 40, 'blast');
        // Edge hit on Rectangle (shear stress + heavy brittle armor)
        const sEdgeRectangle = Disintegration.computeStressScore({ x: 80, y: 100 }, enemyRectangle, 10, 'crush');

        assert.ok(sCoreDiamond > 1.0, `Core blast on Diamond should yield High Stress S > 1.0 (got ${sCoreDiamond})`);
        assert.ok(sEdgeRectangle < 0.5, `Edge crush on Rectangle should yield Low Stress S < 0.5 (got ${sEdgeRectangle})`);
    });

    await t.test('Engine.Proc.VoxelDisintegration partitions mass into micro-cubes vs plating chunks based on S', () => {
        const env = loadVoxelFractureModule();
        const Disintegration = env.Engine.Proc.VoxelDisintegration;

        const grid = { cols: 8, rows: 8, voxelW: 2, voxelH: 2 };
        const cells = [0, 1, 2, 3, 4, 5, 6, 7];

        const particlesHigh = Disintegration.partitionVoxelMass(cells, grid, 1.4, 'blast');
        const particlesLow = Disintegration.partitionVoxelMass(cells, grid, 0.3, 'crush');

        assert.ok(Array.isArray(particlesHigh));
        assert.ok(Array.isArray(particlesLow));
        assert.ok(particlesHigh.length > 0);
        assert.ok(particlesLow.length > 0);

        // High stress still granulates more than gentle crush, but both favor plates over sand.
        assert.ok(particlesHigh.length >= particlesLow.length, 'High stress S should produce higher particle count (more 1x1 micro-cubes)');

        let highMass = 0;
        for (let i = 0; i < particlesHigh.length; i++) highMass += particlesHigh[i].cellCount || 1;
        const highAvg = highMass / particlesHigh.length;
        assert.ok(highAvg >= 1.4, `even high-stress breakup should keep chunky plates (avg=${highAvg})`);
    });

    await t.test('partitionVoxelMass emits real cell-outline shapes and size tiers', () => {
        const env = loadVoxelFractureModule();
        const Disintegration = env.Engine.Proc.VoxelDisintegration;
        const grid = { cols: 8, rows: 8, voxelW: 4, voxelH: 4 };
        // Domino + L: should not collapse to a single scaled square.
        const cells = [0, 1, 8, 9, 10];

        const particles = Disintegration.partitionVoxelMass(cells, grid, 0.35, 'crush');
        assert.ok(particles.length > 0);

        let sawNonRect = false;
        let sawTier = false;
        let covered = 0;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            covered += p.cellCount || 0;
            assert.ok(p.vertCount >= 3, 'outline needs a polygon');
            assert.ok(p.points && p.points.length >= p.vertCount * 2);
            assert.ok(['slab', 'large', 'medium', 'small', 'voxel'].includes(p.tier), `tier=${p.tier}`);
            if (p.cellCount >= 12) {
                assert.equal(p.tier, 'slab', '12+ cell clusters must be slab tier');
            }
            sawTier = true;
            if (p.vertCount > 4) sawNonRect = true;
            // Bounds-scale fallback rects still encode real cell span, not sqrt(N) cubes.
            if (p.vertCount === 4 && p.cellCount >= 2) {
                const xs = [p.points[0], p.points[2], p.points[4], p.points[6]];
                const ys = [p.points[1], p.points[3], p.points[5], p.points[7]];
                const w = Math.max(...xs) - Math.min(...xs);
                const h = Math.max(...ys) - Math.min(...ys);
                assert.ok(w > 0 && h > 0);
            }
        }
        assert.equal(covered, cells.length, 'every destroyed cell belongs to one fragment');
        assert.ok(sawTier);
        // Low-stress connected clumps should often keep non-rect outlines.
        assert.ok(sawNonRect || particles.some((p) => p.cellCount > 1),
            'should preserve multi-cell assembled pieces, not only 1x1 cubes');
    });

    await t.test('flagVoxelDamage triggers multi-variable disintegration flight and settling', () => {
        const env = loadVoxelFractureModule();
        const enemy = {
            shape: 'diamond',
            size: 30,
            maxHp: 100,
            x: 100,
            y: 100,
            _voxelHitSeq: 0
        };

        env.refreshEntityVoxelGrid(enemy);
        env.flagVoxelDamage(enemy, 35, 100, 100, 'blast');

        const grid = enemy._voxelGrid;
        assert.ok(grid.destroyedCount > 0, 'Damage should destroy grid cells');
    });

    await t.test('ShardPool settled shards stamp to VoxelStaticCanvas via onSettledCallback', () => {
        const env = loadVoxelFractureModule();
        const ShardPool = env.Engine.FX.ShardPool;
        assert.ok(ShardPool, 'Engine.FX.ShardPool should exist');
        assert.equal(
            typeof ShardPool.onSettledCallback,
            'function',
            'voxel-fracture must wire ShardPool.onSettledCallback'
        );

        env.resetVoxelStaticCanvas(400, 300);
        assert.ok(env.VoxelStaticCanvas.ctx, 'static canvas ctx required for stamping');
        assert.equal(env.VoxelStaticCanvas.dirty, false);

        const idx = ShardPool.spawn({
            x: 120,
            y: 140,
            vx: 3,
            vy: 3,
            z: 0.05,
            vz: 0,
            life: 2.0,
            r: 0.2, g: 0.8, b: 1.0,
            scale: 2,
            points: new Float32Array([-3, -3, 3, -3, 3, 3, -3, 3]),
            vertCount: 4
        });
        assert.equal(ShardPool.data[idx * 20 + 15], 1, 'spawned shard should be live');

        // Drive until settle (speed < 15, z ~ 0) so the stamp sink runs.
        for (let i = 0; i < 180; i++) {
            env.updateVoxelParticles(1 / 60);
            if (ShardPool.data[idx * 20 + 15] === 0) break;
        }

        assert.equal(ShardPool.data[idx * 20 + 15], 0, 'settled shard must be freed after stamp');
        assert.equal(env.VoxelStaticCanvas.dirty, true, 'static canvas must be marked dirty after stamp');
        assert.equal(ShardPool.settledCount, 0, 'settled queue must be drained each update');
    });

    await t.test('RigidDebris.computeIslandPhysics uses enemy-local centroids in world space', () => {
        const env = loadVoxelFractureModule();
        const RigidDebris = env.Engine.Physics.RigidDebris;
        const island = { centroidX: 10, centroidY: 0, cellCount: 1 };
        const hitPos = { x: 100, y: 200 };
        const impactVel = { vx: 100, vy: 0 };
        const enemyCenter = { x: 100, y: 200 };

        const phys = RigidDebris.computeIslandPhysics(island, hitPos, impactVel, enemyCenter, 'slash');
        // Relative vector should be (+10, 0) from hit → burst bias should be +X, not toward world origin.
        assert.ok(phys.vx > 0, `expected +X burst from local centroid, got vx=${phys.vx}`);
        assert.ok(Math.abs(phys.vy) < Math.abs(phys.vx), 'primary burst axis should be X');
        assert.ok(Math.abs(phys.worldX - 110) < 1e-6, 'worldX should be enemy + local centroid');
        assert.ok(Math.abs(phys.worldY - 200) < 1e-6, 'worldY should be enemy + local centroid');
    });

    await t.test('RigidDebris peel velocity differs by fragment seat on the body', () => {
        const env = loadVoxelFractureModule();
        const RigidDebris = env.Engine.Physics.RigidDebris;
        const hitPos = { x: 100, y: 100 };
        const impactVel = { vx: 200, vy: 0 };
        const enemyCenter = { x: 100, y: 100 };
        const near = RigidDebris.computeIslandPhysics(
            { centroidX: 6, centroidY: 0, cellCount: 3 }, hitPos, impactVel, enemyCenter, 'slash'
        );
        const far = RigidDebris.computeIslandPhysics(
            { centroidX: 24, centroidY: 0, cellCount: 3 }, hitPos, impactVel, enemyCenter, 'slash'
        );
        assert.ok(near.hitInfluence > far.hitInfluence, 'near-wound plates take more strike influence');
        assert.ok(far.vx > 0 && near.vx > 0, 'both plates peel in +X from their seats');
    });

    await t.test('ShardPool wires scenery collision resolver from voxel-fracture', () => {
        const env = loadVoxelFractureModule();
        const ShardPool = env.Engine.FX.ShardPool;
        env.updateVoxelParticles(0);
        assert.equal(typeof ShardPool.resolveWorldCollision, 'function', 'resolveWorldCollision must be wired');
    });

    await t.test('fluid particles settle into opaque puddle stamps instead of vanishing mid-flight', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(400, 300);
        assert.equal(env.VoxelStaticCanvas.dirty, false);

        const enemy = {
            shape: 'circle',
            size: 24,
            maxHp: 80,
            x: 200,
            y: 150,
            color: '#44ddff',
            _voxelHitSeq: 0
        };
        env.refreshEntityVoxelGrid(enemy);
        env.flagVoxelDamage(enemy, 40, 210, 150, 'slash');

        let stamped = false;
        for (let i = 0; i < 240; i++) {
            env.updateVoxelParticles(1 / 60);
            if (env.VoxelStaticCanvas.dirty) {
                stamped = true;
                break;
            }
        }
        assert.ok(stamped, 'fluid/shard debris should stamp to the static canvas');
    });

    await t.test('combat clarity eases from local debris volume around an entity', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(400, 300);

        const enemy = {
            shape: 'circle',
            size: 24,
            maxHp: 80,
            x: 200,
            y: 150,
            color: '#ff4444',
            _voxelHitSeq: 0
        };
        env.refreshEntityVoxelGrid(enemy);

        assert.equal(env.getCombatClarityIntensity(enemy), 0);

        env.flagVoxelDamage(enemy, 50, 205, 150, 'slash');
        let peak = 0;
        for (let i = 0; i < 8; i++) {
            peak = Math.max(peak, env.getCombatClarityIntensity(enemy));
        }
        assert.ok(peak > 0.15, `nearby spray should raise clarity shield (got ${peak})`);

        const far = { x: 20, y: 20, size: 20 };
        assert.ok(env.getCombatClarityIntensity(far) < peak * 0.5, 'far entities should get weaker shield');
    });

    await t.test('clarity body tint shifts more when spray matches body than when colors already contrast', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(400, 300);

        const redEnemy = {
            shape: 'circle',
            size: 24,
            maxHp: 80,
            x: 200,
            y: 150,
            color: '#ff3333',
            _voxelHitSeq: 0
        };
        env.refreshEntityVoxelGrid(redEnemy);
        env.flagVoxelDamage(redEnemy, 55, 205, 150, 'slash');

        // Warm the clarity sample so spray RGB is cached from red fluid.
        let intensity = 0;
        for (let i = 0; i < 10; i++) {
            intensity = Math.max(intensity, env.getCombatClarityIntensity(redEnemy));
        }
        assert.ok(intensity > 0.12, `expected clarity intensity (got ${intensity})`);
        assert.ok(redEnemy._claritySprayR != null, 'spray average should be cached');

        const similar = env.resolveCombatClarityDrawColor(redEnemy, '#ff3333');
        assert.notEqual(similar, '#ff3333', 'same-hue body over own spray should tint');

        const contrasting = env.resolveCombatClarityDrawColor(redEnemy, '#3366ff');
        // Parse delta from base for similar vs contrast cases.
        function rgbDelta(baseHex, out) {
            const n = parseInt(baseHex.slice(1), 16);
            const br = (n >> 16) & 255;
            const bg = (n >> 8) & 255;
            const bb = n & 255;
            if (out === baseHex) return 0;
            const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(out);
            if (!m) return 0;
            return Math.abs(+m[1] - br) + Math.abs(+m[2] - bg) + Math.abs(+m[3] - bb);
        }
        const similarDelta = rgbDelta('#ff3333', similar);
        const contrastDelta = rgbDelta('#3366ff', contrasting);
        assert.ok(
            similarDelta > contrastDelta,
            `similar spray should shift more than contrasting (${similarDelta} vs ${contrastDelta})`
        );
        assert.ok(similarDelta <= 54, `tint must stay subtle (got total delta ${similarDelta})`);

        const sample = env.sampleCombatDebrisVolume(200, 150, 80);
        assert.ok(sample.sprayWeight > 0.15, 'sample should include fluid color weight');
        assert.ok(sample.sprayR > sample.sprayB, 'red spray average should lean red');
    });

    await t.test('clarity spray color still tracks stamped puddles after fluid settles', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(400, 300);

        const enemy = {
            shape: 'circle',
            size: 24,
            maxHp: 80,
            x: 200,
            y: 150,
            color: '#ff3333',
            _voxelHitSeq: 0
        };
        env.refreshEntityVoxelGrid(enemy);
        env.flagVoxelDamage(enemy, 55, 205, 150, 'slash');

        for (let i = 0; i < 300; i++) {
            env.updateVoxelParticles(1 / 60);
        }
        assert.ok(
            env.VoxelParticlePool._activeCount <= 4,
            `airborne fluid should mostly settle (got ${env.VoxelParticlePool._activeCount})`
        );

        const sample = env.sampleCombatDebrisVolume(200, 150, 90);
        assert.ok(sample.sprayWeight > 0.15, `stamps should keep spray weight (got ${sample.sprayWeight})`);
        assert.ok(sample.sprayR > sample.sprayB, 'stamped puddles should still lean red');

        env.getCombatClarityIntensity(enemy);
        assert.ok(enemy._claritySprayR != null, 'settled stamps must feed clarity spray cache');
        const tinted = env.resolveCombatClarityDrawColor(enemy, '#ff3333');
        assert.notEqual(tinted, '#ff3333', 'same-hue body over own stamps should still nudge');
    });

    await t.test('fluid stamp/render matches original source-over puddle + lighter airborne look', () => {
        const src = fs.readFileSync(path.join(__dirname, '../src/game/presentation/voxel-fracture.js'), 'utf8');
        assert.match(src, /const FLUID_DRAG = 0\.935/);
        assert.match(src, /Math\.pow\((?:fastDrag|drag|FLUID_DRAG(?:_FAST)?), dt \* 60\)/);
        assert.match(src, /fluidProfileForFragment|_fluidProfileForFragment/);
        assert.match(src, /rgba\(\$\{r\},\$\{g\},\$\{b\}, 0\.34\)/);
        assert.match(src, /globalCompositeOperation = 'lighter'/);
        assert.match(src, /VoxelParticlePool\.cr\[i\] \* 1\.12 \+ 0\.07/);
        assert.match(src, /baseW \* 2\.45|VoxelParticlePool\.w\[i\] \* 2\.45/);
        assert.match(src, /VoxelParticlePool\.w\[fluidIdx\] = 2\.2 \+ rng\(\) \* 1\.5/);
        assert.match(src, /baseW \* 1\.35/);
        assert.match(src, /\(240 \+ rng\(\) \* 260\)/);
        assert.match(src, /\(230 \+ rng\(\) \* 270\)/);
        assert.match(src, /const FLUID_THROW_SCALE = 1\.15/);
        assert.match(src, /underAlpha != null \? opts\.underAlpha : 0\.5/);
        assert.match(src, /Engine\.Proc\.Rng|\_fxRandom/);
        assert.match(src, /Stable cache key|never per-frame flash/);
        assert.match(src, /_scratchFlash|never paint source-atop on the main framebuffer/);
        const stampBlock = src.slice(src.indexOf('function _stampToStaticCanvas'), src.indexOf('function _spawnImpactFluidBurst'));
        assert.ok(stampBlock.includes("rgba(${r},${g},${b}, 0.34)"), 'soft wash stamp matches main');
        assert.ok(!stampBlock.includes('_stampFluidPuddle'), 'experimental puddle stack removed');
    });

    await t.test('fluid wound color uses shape base color, not flash/telegraph draw tint', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(400, 300);

        const enemy = {
            shape: 'circle',
            size: 24,
            maxHp: 80,
            x: 200,
            y: 150,
            color: '#00cc44',
            _voxelLastDrawColor: '#ffffff',
            damageFlashColor: '#ffffff',
            _voxelHitSeq: 0
        };
        env.refreshEntityVoxelGrid(enemy);
        env.flagVoxelDamage(enemy, 45, 210, 150, 'slash');

        const pool = env.VoxelParticlePool;
        let fluidCount = 0;
        let greenish = 0;
        for (let i = 0; i < pool.alive.length; i++) {
            if (!pool.alive[i] || pool.type[i] !== 1) continue;
            fluidCount++;
            // Base green should dominate; white flash must not win.
            if (pool.cg[i] > pool.cr[i] && pool.cg[i] > pool.cb[i] && pool.cg[i] > 0.35) {
                greenish++;
            }
            assert.ok(pool.cr[i] < 0.85, 'fluid must not be near-white flash');
            // Mild milky wash: each channel should sit above the raw base green's red (0).
            assert.ok(pool.cr[i] > 0.08, 'fluid should be washed toward milky opaque');
            assert.ok(pool.cr[i] < pool.cg[i] - 0.15, 'wash must not erase green identity');
        }
        assert.ok(fluidCount > 0, 'expected fluid particles');
        assert.ok(greenish === fluidCount, 'all fluid droplets should track base green');
    });

    await t.test('fluid spray collides with scenery colliders and stamps on contact', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(800, 600);
        env.currentRoom = {
            width: 800,
            height: 600,
            layout: {
                cachedDebrisColliders: [
                    { kind: 'circle', x: 320, y: 200, radius: 36 }
                ]
            }
        };

        const enemy = {
            shape: 'circle',
            size: 20,
            maxHp: 80,
            x: 180,
            y: 200,
            color: '#ff5555',
            _voxelHitSeq: 0
        };
        env.refreshEntityVoxelGrid(enemy);
        env.flagVoxelDamage(enemy, 50, 190, 200, 'blast');

        const pool = env.VoxelParticlePool;
        let aimed = 0;
        for (let i = 0; i < pool.alive.length; i++) {
            if (!pool.alive[i] || pool.type[i] !== 1) continue;
            pool.px[i] = 250;
            pool.py[i] = 200;
            pool.vx[i] = 420;
            pool.vy[i] = 0;
            pool.life[i] = 2;
            pool.maxLife[i] = 2;
            pool.settleT[i] = 0;
            aimed++;
        }
        assert.ok(aimed > 0, 'need fluid particles to aim at scenery');

        let stamped = false;
        let maxX = 0;
        for (let step = 0; step < 90; step++) {
            env.updateVoxelParticles(1 / 60);
            if (env.VoxelStaticCanvas.dirty) stamped = true;
            for (let i = 0; i < pool.alive.length; i++) {
                if (!pool.alive[i] || pool.type[i] !== 1) continue;
                maxX = Math.max(maxX, pool.px[i]);
            }
        }
        assert.ok(stamped, 'fluid should stamp after scenery contact');
        assert.ok(maxX < 360, `fluid must not tunnel past scenery (maxX=${maxX})`);
    });

    await t.test('partitionVoxelMass deathShatter mixes large/medium/small/voxel tiers', () => {
        const env = loadVoxelFractureModule();
        const Disintegration = env.Engine.Proc.VoxelDisintegration;
        const grid = { cols: 8, rows: 8, voxelW: 3, voxelH: 3 };
        const cells = [];
        for (let i = 0; i < 36; i++) cells.push(i);

        const particles = Disintegration.partitionVoxelMass(cells, grid, 1.5, 'blast', {
            deathShatter: true,
            rng: env.Engine.Proc.Rng.fromSeed('mix:0')
        });
        assert.ok(particles.length > 4);

        const tiers = new Set(particles.map((p) => p.tier));
        assert.ok(tiers.has('voxel') || tiers.has('small'), 'death shatter should include crumbs');
        assert.ok(tiers.has('medium') || tiers.has('large') || tiers.has('slab'), 'death shatter should keep plating pieces');
        assert.ok(tiers.size >= 3, `expected 3+ tiers, got ${[...tiers].join(',')}`);

        const slabs = particles.filter((p) => p.tier === 'slab');
        assert.ok(slabs.length <= 2, `slab tier should be rare (got ${slabs.length})`);
        for (let i = 0; i < slabs.length; i++) {
            assert.ok(slabs[i].cellCount >= 12, 'slab pieces are oversized plates');
        }

        let covered = 0;
        for (let i = 0; i < particles.length; i++) covered += particles[i].cellCount;
        assert.equal(covered, cells.length);
    });

    await t.test('triggerDeathShatter fractures remaining body into shard debris', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(400, 300);
        const enemy = {
            shape: 'circle',
            size: 28,
            maxHp: 80,
            x: 200,
            y: 150,
            color: '#ff5555',
            _voxelHitSeq: 0,
            alive: false
        };
        env.refreshEntityVoxelGrid(enemy);
        // Pre-damage some cells so death shatter works on "what was left".
        env.flagVoxelDamage(enemy, 25, 200, 150, 'slash');
        const before = enemy._voxelGrid.destroyedCount;

        const killContext = env.storeKillContext(enemy, 40, 205, 150, 'slash');
        env.triggerDeathShatter(enemy, killContext);

        assert.ok(enemy._voxelGrid.destroyedCount >= before);
        assert.equal(enemy._voxelGrid.destroyedCount, enemy._voxelGrid.cols * enemy._voxelGrid.rows);

        const ShardPool = env.Engine.FX.ShardPool;
        let liveShards = 0;
        for (let i = 0; i < ShardPool.capacity; i++) {
            if (ShardPool.data[i * 20 + 15] === 1) liveShards++;
        }
        assert.ok(liveShards > 3, `death should spawn layered body shards (got ${liveShards})`);

        const bodyR = enemy.size * 1.35;
        let seated = 0;
        let upright = 0;
        for (let i = 0; i < ShardPool.capacity; i++) {
            const stride = i * 20;
            if (ShardPool.data[stride + 15] !== 1) continue;
            const dx = ShardPool.data[stride] - enemy.x;
            const dy = ShardPool.data[stride + 1] - enemy.y;
            if (Math.hypot(dx, dy) <= bodyR) seated++;
            if (Math.abs(ShardPool.data[stride + 4]) < 1e-6) upright++;
        }
        assert.ok(seated >= liveShards * 0.85,
            `death shards should start on the body silhouette (seated ${seated}/${liveShards})`);
        assert.ok(upright >= liveShards * 0.85,
            `death shards should keep grid orientation, not random tumble (upright ${upright}/${liveShards})`);

        let fluidCount = 0;
        let seamAligned = 0;
        const pool = env.VoxelParticlePool;
        for (let i = 0; i < pool.alive.length; i++) {
            if (!pool.alive[i] || pool.type[i] !== 1) continue;
            fluidCount++;
            // Leaders mark death wake via groupOx; satellites ride a plate leader.
            if (pool.linkLeader[i] >= 0 || pool.groupOx[i] > 0.5) seamAligned++;
        }
        assert.ok(fluidCount >= 10, `death shatter should spray ichor (got ${fluidCount})`);
        assert.ok(seamAligned >= Math.floor(fluidCount * 0.4),
            'most death fluid should be coupled to the fall-apart');
    });

    await t.test('fluid profiles scale with fracture fragment tier', () => {
        const env = loadVoxelFractureModule();
        const rng = () => 0.5;
        const slab = env.fluidProfileForFragment('slab', 14, rng);
        const mist = env.fluidProfileForFragment('voxel', 1, rng);
        const medium = env.fluidProfileForFragment('medium', 5, rng);

        assert.ok(slab.sizeW > medium.sizeW, 'slabs spawn fatter globs than medium plates');
        assert.ok(medium.sizeW > mist.sizeW, 'medium plates spawn larger drops than crumb mist');
        assert.ok(slab.speedMul < mist.speedMul, 'slabs weep slower than crumb mist');
        assert.ok(slab.heavy > mist.heavy, 'slab globs are heavier in drag class');
        assert.ok(slab.satellites >= 1, 'slab globs can carry satellite droplets');
        assert.equal(mist.satellites, 0, 'crumb mist stays solo');
    });

    await t.test('fluid satellites stamp+free with their leader instead of orphaning pool slots', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(800, 600);
        env.currentRoom = { width: 800, height: 600, layout: null };
        env.Game = { renderQuality: { damageFxScale: 1, voxelParticleCap: 512 } };

        const pool = env.VoxelParticlePool;
        const leader = 11;
        const sats = [12, 13];

        function activateManual(idx, opts) {
            pool.alive[idx] = 1;
            pool.type[idx] = 1;
            pool.linkLeader[idx] = opts.leader != null ? opts.leader : -1;
            pool.groupOx[idx] = opts.ox || 0;
            pool.groupOy[idx] = opts.oy != null ? opts.oy : 1.55;
            pool.px[idx] = opts.x;
            pool.py[idx] = opts.y;
            pool.vx[idx] = opts.vx || 0;
            pool.vy[idx] = opts.vy || 0;
            pool.life[idx] = opts.life != null ? opts.life : 0.35;
            pool.maxLife[idx] = pool.life[idx];
            pool.w[idx] = opts.w || 3;
            pool.h[idx] = opts.h || 2.5;
            pool.cr[idx] = 0.85;
            pool.cg[idx] = 0.12;
            pool.cb[idx] = 0.1;
            pool.alpha[idx] = 1;
            pool.rot[idx] = 0;
            pool.rotV[idx] = 0;
            pool.settleT[idx] = 0;
            pool.age[idx] = 0;
            pool.sprite[idx] = null;
        }

        activateManual(leader, { x: 400, y: 300, vx: 40, vy: 10, life: 0.4, w: 3.5, h: 2.8 });
        activateManual(sats[0], { leader, x: 402, y: 301, ox: 2, oy: 1, life: 0.4, w: 1.6, h: 1.4 });
        activateManual(sats[1], { leader, x: 398, y: 299, ox: -2, oy: -1, life: 0.4, w: 1.5, h: 1.3 });

        pool._activeIndices[0] = leader;
        pool._activeIndices[1] = sats[0];
        pool._activeIndices[2] = sats[1];
        pool._activeIndexPos[leader] = 0;
        pool._activeIndexPos[sats[0]] = 1;
        pool._activeIndexPos[sats[1]] = 2;
        pool._activeCount = 3;

        assert.equal(pool._activeCount, 3);
        assert.ok(pool.linkLeader[sats[0]] === leader && pool.linkLeader[sats[1]] === leader);

        for (let step = 0; step < 120; step++) {
            env.updateVoxelParticles(1 / 60);
        }

        let orphaned = 0;
        for (let i = 0; i < pool.alive.length; i++) {
            if (!pool.alive[i]) continue;
            const L = pool.linkLeader[i];
            if (L >= 0 && !pool.alive[L]) orphaned++;
        }
        assert.equal(orphaned, 0, 'no satellite may remain alive after its leader stamps out');
        assert.equal(pool.alive[leader], 0, 'leader must leave the active pool');
        assert.equal(pool.alive[sats[0]], 0, 'satellite 0 must free with leader');
        assert.equal(pool.alive[sats[1]], 0, 'satellite 1 must free with leader');
        assert.equal(pool._activeCount, 0, 'pool must fully recycle after settle');
        assert.equal(env.VoxelStaticCanvas.dirty, true, 'settled spray must stamp to viscera layer');
    });

    await t.test('orphan fluid satellites with a dead leader are stamped and freed', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(400, 300);
        const pool = env.VoxelParticlePool;

        // Manually wire a leader + satellite, then kill only the leader (old bug path).
        const leader = 3;
        const sat = 7;
        pool.alive[leader] = 1;
        pool.alive[sat] = 1;
        pool.type[leader] = 1;
        pool.type[sat] = 1;
        pool.linkLeader[leader] = -1;
        pool.linkLeader[sat] = leader;
        pool.px[leader] = 100;
        pool.py[leader] = 100;
        pool.px[sat] = 102;
        pool.py[sat] = 101;
        pool.vx[leader] = 0;
        pool.vy[leader] = 0;
        pool.vx[sat] = 0;
        pool.vy[sat] = 0;
        pool.life[leader] = 1;
        pool.maxLife[leader] = 1;
        pool.life[sat] = 1;
        pool.maxLife[sat] = 1;
        pool.w[leader] = 3;
        pool.h[leader] = 3;
        pool.w[sat] = 1.5;
        pool.h[sat] = 1.5;
        pool.cr[leader] = pool.cr[sat] = 0.8;
        pool.cg[leader] = pool.cg[sat] = 0.1;
        pool.cb[leader] = pool.cb[sat] = 0.1;
        pool.alpha[leader] = pool.alpha[sat] = 1;
        pool.rot[leader] = pool.rot[sat] = 0;
        pool.settleT[leader] = pool.settleT[sat] = 0;
        pool._activeIndices[0] = leader;
        pool._activeIndices[1] = sat;
        pool._activeIndexPos[leader] = 0;
        pool._activeIndexPos[sat] = 1;
        pool._activeCount = 2;

        // Simulate solo leader deactivate (pre-fix leak).
        pool.alive[leader] = 0;
        pool._activeIndices[0] = sat;
        pool._activeIndexPos[sat] = 0;
        pool._activeIndexPos[leader] = -1;
        pool._activeCount = 1;

        env.updateVoxelParticles(1 / 60);

        assert.equal(pool.alive[sat], 0, 'orphan satellite must be freed');
        assert.equal(pool._activeCount, 0, 'orphaned slot must return to the free budget');
        assert.equal(env.VoxelStaticCanvas.dirty, true, 'orphan cleanup still stamps to viscera');
    });

    await t.test('death fluid size tracks large vs small fracture seats', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(400, 300);
        const enemy = {
            shape: 'circle',
            size: 36,
            maxHp: 120,
            x: 200,
            y: 150,
            color: '#ff5555',
            _voxelHitSeq: 0,
            alive: false
        };
        env.refreshEntityVoxelGrid(enemy);
        const killContext = env.storeKillContext(enemy, 80, 205, 150, 'blast');
        env.triggerDeathShatter(enemy, killContext);

        const pool = env.VoxelParticlePool;
        let maxW = 0;
        let minW = Infinity;
        let fluid = 0;
        let linked = 0;
        for (let i = 0; i < pool.alive.length; i++) {
            if (!pool.alive[i] || pool.type[i] !== 1) continue;
            fluid++;
            maxW = Math.max(maxW, pool.w[i]);
            minW = Math.min(minW, pool.w[i]);
            if (pool.linkLeader[i] >= 0) linked++;
        }
        assert.ok(fluid > 8, `expected death fluid (got ${fluid})`);
        assert.ok(maxW - minW > 0.8, `fracture-tied spray should vary in size (max=${maxW}, min=${minW})`);
        assert.ok(maxW > 2.4, `large plates should weep fat globs (maxW=${maxW})`);
    });

    await t.test('buildDebrisSceneryColliders includes lamps/trails and solid props', () => {
        const env = loadVoxelFractureModule();
        const layout = {
            cachedFixtures: [
                { type: 'supplyCrate', purpose: 'infrastructure', x: 100, y: 120, size: 28 },
                { type: 'facetMarker', purpose: 'corner', x: 160, y: 160, size: 22 },
                { type: 'trailMarker', purpose: 'wayfinding', x: 180, y: 180, size: 18 },
                { type: 'streetLamp', purpose: 'streetLight', x: 220, y: 220, size: 24 },
                { type: 'lostNote', purpose: 'narrative', x: 200, y: 200, size: 12 }
            ]
        };
        const colliders = env.buildDebrisSceneryColliders(layout);
        assert.ok(colliders.some((c) => c.kind === 'circle' && c.x === 100), 'solid crates still block');
        assert.ok(colliders.some((c) => c.kind === 'triangle'), 'trail triangles collide like original');
        assert.ok(colliders.some((c) => c.x === 220 || (c.x1 === 220) || Math.abs((c.x || 0) - 220) < 40), 'lamps collide like original');
        assert.ok(!colliders.some((c) => c.x === 160), 'decorative facet markers do not block');
        assert.ok(!colliders.some((c) => c.x === 200), 'narrative props stay non-colliding');
    });

    await t.test('renderVoxelStaticLayer draws settled debris canvas when dirty', () => {
        const env = loadVoxelFractureModule();
        assert.equal(typeof env.renderVoxelStaticLayer, 'function');
        env.resetVoxelStaticCanvas(400, 300);
        env.VoxelStaticCanvas.dirty = true;
        let drew = false;
        const ctx = {
            drawImage: () => { drew = true; }
        };
        env.renderVoxelStaticLayer(ctx);
        assert.equal(drew, true, 'dirty static layer must blit to the world');
    });

    await t.test('ShardPool grounded shards stay flat 2D without height bounce', () => {
        const env = loadVoxelFractureModule();
        const ShardPool = env.Engine.FX.ShardPool;
        const idx = ShardPool.spawn({
            x: 100,
            y: 100,
            vx: 80,
            vy: 0,
            z: 0,
            vz: 0,
            life: 2,
            points: new Float32Array([-4, -4, 4, -4, 4, 4, -4, 4]),
            vertCount: 4,
            r: 1, g: 0.2, b: 0.2
        });
        for (let i = 0; i < 30; i++) ShardPool.update(1 / 60);
        const stride = idx * 20;
        assert.ok(Math.abs(ShardPool.data[stride + 16]) < 0.2, 'z should stay grounded');
        assert.ok(Math.abs(ShardPool.data[stride + 17]) < 1, 'vz should not accumulate bounce');
    });

    await t.test('ShardPool soft cap rejects spawns beyond governor budget', () => {
        const env = loadVoxelFractureModule();
        const ShardPool = env.Engine.FX.ShardPool;
        assert.ok(ShardPool.capacity >= 512, 'physical shard pool supports headroom boost');
        ShardPool.setSoftCap(4);

        const pts = new Float32Array([-2, -2, 2, -2, 2, 2, -2, 2]);
        const ids = [];
        for (let i = 0; i < 4; i++) {
            const id = ShardPool.spawn({
                x: i * 10, y: 0, vx: 0, vy: 0,
                points: pts, vertCount: 4, life: 2
            });
            assert.ok(id >= 0, `spawn ${i} should succeed under soft cap`);
            ids.push(id);
        }
        const blocked = ShardPool.spawn({
            x: 99, y: 0, vx: 0, vy: 0,
            points: pts, vertCount: 4, life: 2
        });
        assert.equal(blocked, -1, 'spawn past soft cap must fail');
        ShardPool.setSoftCap(ShardPool.capacity);
    });

    await t.test('voxel soft cap can expand up to physical pool max', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(400, 300);
        env.Game = {
            renderQuality: { damageFxScale: 1.35, voxelParticleCap: 1024 }
        };
        assert.equal(env.VoxelParticlePool.alive.length, 1024);

        const enemy = {
            shape: 'circle',
            size: 28,
            maxHp: 80,
            x: 200,
            y: 150,
            color: '#44ff88',
            _voxelHitSeq: 0
        };
        env.refreshEntityVoxelGrid(enemy);
        // Several heavy hits should be allowed to grow well past the old 512 soft ceiling.
        for (let i = 0; i < 8; i++) {
            env.flagVoxelDamage(enemy, 40, 200 + i, 150, 'blast');
        }
        assert.ok(
            env.VoxelParticlePool._activeCount > 200,
            `expected dense spray under raised cap (got ${env.VoxelParticlePool._activeCount})`
        );
    });

    await t.test('spin archetype fluid prefers tangential swirl over pure radial streaks', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(400, 300);
        env.Game = {
            player: {
                x: 100,
                y: 150,
                alive: true,
                whirlwindActive: true,
                whirlwindStartTime: Date.now(),
                playerId: 'p1'
            },
            renderQuality: { damageFxScale: 1, voxelParticleCap: 512 }
        };
        const enemy = {
            shape: 'circle',
            size: 24,
            maxHp: 80,
            hp: 80,
            x: 180,
            y: 150,
            color: '#ff4444',
            lastAttacker: 'p1',
            _voxelHitSeq: 0
        };
        env.refreshEntityVoxelGrid(enemy);
        // Hit the enemy body, but mark as spin so spray pivots around the spinning attacker.
        env.flagVoxelDamage(enemy, 35, 175, 150, 'spin');

        const pool = env.VoxelParticlePool;
        let fluid = 0;
        let tangential = 0;
        for (let i = 0; i < pool.alive.length; i++) {
            if (!pool.alive[i] || pool.type[i] !== 1) continue;
            fluid++;
            // Pivot at player (100,150) → radial mostly +X; tangential spray needs meaningful |vy|.
            if (Math.abs(pool.vy[i]) > Math.abs(pool.vx[i]) * 0.35) tangential++;
        }
        assert.ok(fluid > 5, `expected spin fluid droplets (got ${fluid})`);
        assert.ok(tangential / fluid > 0.35, `spin spray should be mostly tangential (got ${tangential}/${fluid})`);
    });

    await t.test('fluid spray collides with ellipse scenery colliders', () => {
        const env = loadVoxelFractureModule();
        env.resetVoxelStaticCanvas(800, 600);
        env.currentRoom = {
            width: 800,
            height: 600,
            layout: {
                biomeId: 'vortex',
                cellSize: 60,
                cols: 14,
                rows: 10,
                cachedDebrisColliders: [
                    { kind: 'ellipse', x: 340, y: 200, radiusX: 48, radiusY: 22, rotation: 0.4 }
                ]
            }
        };

        const enemy = {
            shape: 'circle',
            size: 20,
            maxHp: 80,
            x: 180,
            y: 200,
            color: '#ff5555',
            _voxelHitSeq: 0
        };
        env.refreshEntityVoxelGrid(enemy);
        env.flagVoxelDamage(enemy, 50, 190, 200, 'blast');

        const pool = env.VoxelParticlePool;
        let aimed = 0;
        for (let i = 0; i < pool.alive.length; i++) {
            if (!pool.alive[i] || pool.type[i] !== 1) continue;
            pool.px[i] = 250;
            pool.py[i] = 200;
            pool.vx[i] = 420;
            pool.vy[i] = 0;
            pool.life[i] = 2;
            pool.maxLife[i] = 2;
            pool.settleT[i] = 0;
            aimed++;
        }
        assert.ok(aimed > 0, 'need fluid particles aimed at ellipse');

        let stamped = false;
        let maxX = 0;
        for (let step = 0; step < 90; step++) {
            env.updateVoxelParticles(1 / 60);
            if (env.VoxelStaticCanvas.dirty) stamped = true;
            for (let i = 0; i < pool.alive.length; i++) {
                if (!pool.alive[i] || pool.type[i] !== 1) continue;
                maxX = Math.max(maxX, pool.px[i]);
            }
        }
        assert.ok(stamped, 'fluid should stamp after ellipse contact');
        assert.ok(maxX < 400, `fluid must not tunnel through ellipse (maxX=${maxX})`);
    });

    await t.test('biome fluid stamp profile skews vortex and diamonds prism puddles', () => {
        const src = fs.readFileSync(path.join(__dirname, '../src/game/presentation/voxel-fracture.js'), 'utf8');
        assert.match(src, /function _biomeFluidStampProfile/);
        assert.match(src, /biomeId === 'vortex'/);
        assert.match(src, /diamond: true/);
        assert.match(src, /stretchX: 1\.4/);
        assert.ok(src.includes("renderRoomObstacles(ctx, this.roomNumber, { occlude: true })")
            || fs.readFileSync(path.join(__dirname, '../src/game/main.js'), 'utf8')
                .includes("renderRoomObstacles(ctx, this.roomNumber, { occlude: true })"),
            'world bodies should occlude viscera with solid silhouettes');
    });
});

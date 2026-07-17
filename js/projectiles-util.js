// Stable projectile IDs for multiplayer matching / interpolation
(function (global) {
    let nextProjectileId = 1;

    function generateProjectileId() {
        const id = `proj-${Date.now()}-${nextProjectileId++}`;
        return id;
    }

    function ensureProjectileId(proj) {
        if (!proj || typeof proj !== 'object') return proj;
        if (!proj.id) {
            proj.id = generateProjectileId();
        }
        return proj;
    }

    function pushGameProjectile(proj, targetArray) {
        ensureProjectileId(proj);
        const list = targetArray
            || (typeof Game !== 'undefined' && Game.projectiles)
            || null;
        if (!list) {
            console.warn('[Projectiles] No projectile array available for push');
            return proj;
        }
        list.push(proj);
        return proj;
    }

    /** Wrap an array so every push assigns a stable id. */
    function createProjectileList(initial) {
        const arr = Array.isArray(initial) ? initial.slice() : [];
        const originalPush = Array.prototype.push;
        arr.push = function (...items) {
            for (let i = 0; i < items.length; i++) {
                ensureProjectileId(items[i]);
            }
            return originalPush.apply(this, items);
        };
        arr._isProjectileList = true;
        return arr;
    }

    /** Snapshot fields for multiplayer game_state (host → clients). */
    function serializeProjectileForNetwork(proj) {
        if (!proj || typeof proj !== 'object') return null;
        ensureProjectileId(proj);
        if (!proj.id) {
            console.warn('[Projectiles] Projectile missing id during serialize');
        }
        return {
            id: proj.id,
            x: proj.x,
            y: proj.y,
            vx: proj.vx,
            vy: proj.vy,
            size: proj.size,
            type: proj.type,
            color: proj.color,
            damage: proj.damage,
            lifetime: proj.lifetime,
            elapsed: proj.elapsed,
            trailLength: proj.trailLength,
            trailColor: proj.trailColor,
            baseAngle: proj.baseAngle,
            baseSpeed: proj.baseSpeed,
            waveAmplitude: proj.waveAmplitude,
            waveFrequency: proj.waveFrequency,
            wavePhase: proj.wavePhase,
            waveClock: proj.waveClock,
            playerId: proj.playerId || proj.ownerId || null,
            ownerId: proj.ownerId || proj.playerId || null,
            // Parallel twin dormancy / identity (0.8.2)
            activateAfter: proj.activateAfter || 0,
            isParallelSecond: !!proj.isParallelSecond,
            isParallelPrimary: !!proj.isParallelPrimary
        };
    }

    global.generateProjectileId = generateProjectileId;
    global.ensureProjectileId = ensureProjectileId;
    global.pushGameProjectile = pushGameProjectile;
    global.createProjectileList = createProjectileList;
    global.serializeProjectileForNetwork = serializeProjectileForNetwork;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            generateProjectileId,
            ensureProjectileId,
            pushGameProjectile,
            createProjectileList,
            serializeProjectileForNetwork
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);

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

    global.generateProjectileId = generateProjectileId;
    global.ensureProjectileId = ensureProjectileId;
    global.pushGameProjectile = pushGameProjectile;
    global.createProjectileList = createProjectileList;
})(typeof window !== 'undefined' ? window : globalThis);

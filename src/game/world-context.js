/**
 * World/context helpers for Shape Slayer game packages.
 * Packages should prefer an explicit world argument; fall back to the active
 * mode world or legacy ambient Game when migrating callers.
 */
(function (root) {
    'use strict';

    function getActiveWorld() {
        if (root.__sessionWorld) {
            return root.__sessionWorld;
        }
        if (root.__activeMode && root.__activeMode.world && root.__activeMode._session) {
            return root.__activeMode._session.world || root.__activeMode.world;
        }
        if (typeof Game !== 'undefined' && Game) {
            return Game;
        }
        return null;
    }

    /**
     * @param {object} [explicit] Preferred world/context from the caller
     * @returns {object|null}
     */
    function resolveWorld(explicit) {
        if (explicit && typeof explicit === 'object') {
            return explicit;
        }
        return getActiveWorld();
    }

    function makeRunSeed(prefix) {
        const p = prefix || 'run';
        const t = Date.now().toString(36);
        const r = Math.floor(Math.random() * 1e9).toString(36);
        return `${p}-${t}-${r}`;
    }

    /**
     * Destroy the active playing room and combat lists so Island hops cannot
     * inherit a dirty Gear/sandbox layout.
     */
    function clearPlayingField(explicit) {
        const world = resolveWorld(explicit);
        const prevRoom = (typeof currentRoom !== 'undefined') ? currentRoom : (root.currentRoom || null);

        if (prevRoom && typeof releaseRoomRenderCaches === 'function') {
            try { releaseRoomRenderCaches(prevRoom); } catch (_) { /* ignore */ }
        }

        if (typeof setCurrentRoom === 'function') {
            setCurrentRoom(null);
        } else if (typeof currentRoom !== 'undefined') {
            currentRoom = null;
            if (typeof window !== 'undefined') window.currentRoom = null;
        } else if (typeof window !== 'undefined') {
            window.currentRoom = null;
        }

        if (!world) return null;

        world.enemies = [];
        world.projectiles = (typeof createProjectileList === 'function'
            ? createProjectileList()
            : []);
        if (Array.isArray(world.particles)) world.particles.length = 0;
        if (world.spatialHash && typeof world.spatialHash.clear === 'function') {
            world.spatialHash.clear();
        }
        if (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot)) {
            groundLoot.length = 0;
        }
        if (typeof itemPylons !== 'undefined' && Array.isArray(itemPylons)) {
            itemPylons.length = 0;
        }
        if (typeof world.hideGroundLootUi === 'function') {
            world.hideGroundLootUi();
        }

        world.enteringSafeRoom = false;
        world.itemsDroppedThisRoom = 0;
        world.roomEnterTransition = null;
        world.doorPulse = 0;
        world.inSafeRoom = false;

        return world;
    }

    root.GameWorld = {
        resolveWorld,
        getActiveWorld,
        makeRunSeed,
        clearPlayingField
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.GameWorld;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

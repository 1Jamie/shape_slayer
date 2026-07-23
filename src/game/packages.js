/**
 * Shape Slayer game packages — reusable pieces built on the engine.
 * Mode packages opt into these by id; load only what you need
 * (classic-script hosts still list script tags; this registry is the contract).
 */
(function (root) {
    'use strict';

    const Packages = Object.freeze({
        combat: Object.freeze({
            id: 'combat',
            title: 'Combat',
            description: 'Hit resolution, scaling hooks, kill rewards',
            scripts: Object.freeze([
                'src/game/simulation/combat.js',
                'src/game/simulation/combat-scaling.js',
                'src/game/simulation/combat-economy.js',
                'src/game/simulation/combat-projectiles.js',
                'src/game/simulation/kill-rewards.js'
            ])
        }),
        entities: Object.freeze({
            id: 'entities',
            title: 'Entities',
            description: 'Players, enemies, bosses, items, projectiles',
            scripts: Object.freeze([
                'src/game/entities/projectiles-util.js',
                'src/game/entities/players/player-base.js',
                'src/game/entities/players/player-warrior.js',
                'src/game/entities/players/player-rogue.js',
                'src/game/entities/players/player-tank.js',
                'src/game/entities/players/player-mage.js',
                'src/game/entities/enemies/enemy-base.js',
                'src/game/entities/enemies/enemy-basic.js',
                'src/game/entities/enemies/enemy-star.js',
                'src/game/entities/enemies/enemy-diamond.js',
                'src/game/entities/enemies/enemy-rectangle.js',
                'src/game/entities/enemies/enemy-octagon.js',
                'src/game/entities/enemies/biome-enemy-mods.js',
                'src/game/entities/enemies/elite-enemy-affixes.js',
                'src/game/entities/enemies/enemy-index-catalog.js',
                'src/game/entities/bosses/hazards.js',
                'src/game/entities/bosses/boss-base.js',
                'src/game/entities/bosses/boss-scaling.js',
                'src/game/entities/bosses/boss-swarmking.js',
                'src/game/entities/bosses/boss-twinprism.js',
                'src/game/entities/bosses/boss-fortress.js',
                'src/game/entities/bosses/boss-fractalcore.js',
                'src/game/entities/bosses/boss-vortex.js',
                'src/game/entities/items/item-definitions.js',
                'src/game/entities/items/item-effects.js',
                'src/game/entities/items/item-manager.js',
                'src/game/entities/items/item-ground.js',
                'src/game/entities/items/item-pylon.js',
                'src/game/entities/items/item-visuals.js'
            ])
        }),
        rooms: Object.freeze({
            id: 'rooms',
            title: 'Rooms',
            description: 'Room clear loop, layouts, doors, transitions',
            scripts: Object.freeze([
                'src/game/simulation/level.js',
                'src/game/simulation/room-layout-generator.js',
                'src/game/simulation/door-controller.js',
                'src/game/simulation/room-transition.js',
                'src/game/simulation/loot-interaction.js',
                'src/game/simulation/room-clear-effects.js',
                'src/game/simulation/barriers.js',
                'src/game/simulation/surge-arena-generator.js',
                'src/game/simulation/wave-director.js',
                'src/game/simulation/arena-mode.js'
            ])
        }),
        telegraph: Object.freeze({
            id: 'telegraph',
            title: 'Telegraph',
            description: 'Attack windup / commit telegraphs',
            scripts: Object.freeze([
                'src/game/entities/enemies/telegraph/telegraph-manager.js'
            ])
        }),
        content: Object.freeze({
            id: 'content',
            title: 'Content',
            description: 'Biomes, gear, loot, feats, save schema helpers',
            scripts: Object.freeze([
                'src/game/content/biomes.js',
                'src/game/content/gear.js',
                'src/game/content/loot-selection.js',
                'src/game/content/feats-registry.js',
                'src/game/content/save.js',
                'src/game/content/version.js'
            ])
        }),
        presentation: Object.freeze({
            id: 'presentation',
            title: 'Presentation',
            description: 'Shared draw helpers, camera, screen FX, voxel fracture',
            scripts: Object.freeze([
                'src/game/presentation/render-pipeline.js',
                'src/game/presentation/render-adapters.js',
                'src/game/presentation/game-camera.js',
                'src/game/presentation/screen-effects.js',
                'src/game/presentation/voxel-fracture.js',
                'src/game/presentation/render-quality.js',
                'src/game/presentation/display-manager.js'
            ])
        }),
        audio: Object.freeze({
            id: 'audio',
            title: 'Audio',
            description: 'Shape Slayer cue and playlist facades over Engine.Audio/Music',
            scripts: Object.freeze([
                'src/game/audio/game-audio.js',
                'src/game/audio/game-music.js'
            ])
        }),
        net: Object.freeze({
            id: 'net',
            title: 'Net',
            description: 'Multiplayer client helpers (optional)',
            scripts: Object.freeze([
                'src/game/networking/mp-config.js',
                'src/game/networking/telemetry.js',
                'src/game/networking/interpolation.js',
                'src/game/networking/multiplayer.js'
            ])
        }),
        world: Object.freeze({
            id: 'world',
            title: 'World',
            description: 'World context, Island bus/host, mode takeover',
            scripts: Object.freeze([
                'src/game/world-context.js',
                'src/game/game-bus.js',
                'src/game/mode-profile.js',
                'src/game/playing-host.js',
                'src/game/mode-takeover.js'
            ])
        })
    });

    function list() {
        return Object.keys(Packages).map((id) => Packages[id]);
    }

    function get(id) {
        return Packages[id] || null;
    }

    function resolveScripts(packageIds) {
        const seen = new Set();
        const out = [];
        for (const id of packageIds || []) {
            const pkg = Packages[id];
            if (!pkg) continue;
            for (const script of pkg.scripts) {
                if (seen.has(script)) continue;
                seen.add(script);
                out.push(script);
            }
        }
        return out;
    }

    /**
     * Attach package facades onto a world/Game object so modes can use
     * world.Combat / world.Rooms without reaching for ambient globals.
     */
    function attach(world) {
        if (!world || typeof world !== 'object') return world;

        world.Packages = Packages;

        world.Combat = world.Combat || {
            get scaling() { return typeof CombatScaling !== 'undefined' ? CombatScaling : null; },
            get economy() { return typeof CombatEconomy !== 'undefined' ? CombatEconomy : null; },
            get killRewards() { return typeof GameKillRewards !== 'undefined' ? GameKillRewards : null; }
        };

        world.Rooms = world.Rooms || {
            get doors() { return typeof GameDoorController !== 'undefined' ? GameDoorController : null; },
            get loot() { return typeof GameLootInteraction !== 'undefined' ? GameLootInteraction : null; },
            get layouts() { return typeof RoomLayoutGenerator !== 'undefined' ? RoomLayoutGenerator : null; },
            get clear() { return typeof GameRoomClear !== 'undefined' ? GameRoomClear : null; },
            get barriers() { return typeof GameBarriers !== 'undefined' ? GameBarriers : null; },
            get arena() { return typeof GameArena !== 'undefined' ? GameArena : null; }
        };

        if (world.Bus == null && typeof GameBus !== 'undefined') {
            world.Bus = GameBus;
        }
        if (world.PlayingHost == null && typeof PlayingHost !== 'undefined') {
            world.PlayingHost = PlayingHost;
        }

        world.Entities = world.Entities || {};
        world.Content = world.Content || {
            get biomes() { return typeof BiomeConfig !== 'undefined' ? BiomeConfig : null; },
            get gear() {
                return (typeof WEAPON_TYPES !== 'undefined') ? { WEAPON_TYPES, ARMOR_TYPES: typeof ARMOR_TYPES !== 'undefined' ? ARMOR_TYPES : null } : null;
            }
        };
        world.Presentation = world.Presentation || {
            get pipeline() { return typeof GameRenderPipeline !== 'undefined' ? GameRenderPipeline : null; }
        };
        world.Audio = world.Audio || {
            get sfx() { return typeof GameAudio !== 'undefined' ? GameAudio : null; },
            get music() { return typeof GameMusic !== 'undefined' ? GameMusic : null; }
        };

        if (typeof world.resolveWorld !== 'function') {
            world.resolveWorld = function resolveWorld(explicit) {
                if (explicit) return explicit;
                return world;
            };
        }

        return world;
    }

    root.GamePackages = {
        Packages,
        list,
        get,
        resolveScripts,
        attach
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.GamePackages;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

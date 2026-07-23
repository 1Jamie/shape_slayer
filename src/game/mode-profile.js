/**
 * ModeProfile — Island configuration (parameters packages may read).
 * Outcomes (XP, advance, exit) live in mode Rules listening on GameBus — not here.
 */
(function (root) {
    'use strict';

    function freezeProfile(profile) {
        if (!profile || typeof profile !== 'object') {
            throw new TypeError('ModeProfile requires an object');
        }
        const room = Object.freeze(Object.assign({
            doors: true,
            advance: true,
            loop: 'advance'
        }, profile.room || {}));
        return Object.freeze(Object.assign({}, profile, {
            id: profile.id || 'unknown',
            contentGameMode: profile.contentGameMode || 'gear',
            packages: Object.freeze((profile.packages || []).slice()),
            hud: profile.hud || 'gear',
            exit: profile.exit || 'returnToNexus',
            usesPlayingPipeline: profile.usesPlayingPipeline !== false,
            room
        }));
    }

    const ROGUELIKE_PACKAGES = Object.freeze([
        'audio', 'content', 'telegraph', 'entities', 'combat',
        'rooms', 'presentation', 'net', 'world'
    ]);

    const SANDBOX_PACKAGES = Object.freeze([
        'audio', 'content', 'telegraph', 'entities', 'combat',
        'rooms', 'presentation', 'world'
    ]);

    const SURGE_ARENA_PACKAGES = ROGUELIKE_PACKAGES;

    const ROGUELIKE = freezeProfile({
        id: 'roguelike',
        contentGameMode: 'gear',
        packages: ROGUELIKE_PACKAGES,
        hud: 'gear',
        exit: 'returnToNexus',
        usesPlayingPipeline: true,
        room: { doors: true, advance: true, loop: 'advance' }
    });

    const SANDBOX = freezeProfile({
        id: 'sandbox',
        contentGameMode: 'gear',
        packages: SANDBOX_PACKAGES,
        hud: 'gear',
        exit: 'endSession',
        usesPlayingPipeline: true,
        room: {
            doors: false,
            advance: false,
            loop: 'none',
            forceCombat: false,
            skipTutorial: true,
            label: 'sandbox'
        }
    });

    const SURGE_ARENA = freezeProfile({
        id: 'surge-arena',
        contentGameMode: 'gear',
        packages: SURGE_ARENA_PACKAGES,
        hud: 'gear',
        exit: 'endSession',
        usesPlayingPipeline: true,
        room: {
            doors: false,
            advance: false,
            loop: 'waitingForTrigger',
            forceCombat: true,
            forceArchetype: 'arena',
            skipTutorial: true,
            label: 'wave',
            startAt: 1
        }
    });

    root.ModeProfile = {
        freeze: freezeProfile,
        Roguelike: ROGUELIKE,
        Sandbox: SANDBOX,
        SurgeArena: SURGE_ARENA
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.ModeProfile;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

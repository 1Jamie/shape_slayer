/**
 * Roguelike run orchestration — Island entry attaches rules then starts PlayingHost.
 */
(function (root) {
    'use strict';

    const RoguelikeRun = {
        begin(world) {
            if (!world) return;
            const profile = (root.ModeProfile && root.ModeProfile.Roguelike)
                ? root.ModeProfile.Roguelike
                : { id: 'roguelike', hud: 'gear', usesPlayingPipeline: true };
            const rules = root.RoguelikeRules || (root.Modes && root.Modes.roguelike && root.Modes.roguelike.Rules);

            if (typeof root.PlayingHost !== 'undefined' && root.PlayingHost.begin) {
                return root.PlayingHost.begin(world, {
                    profile,
                    rules,
                    startRun: true
                });
            }

            // Fallback without PlayingHost
            if (typeof GameModeTakeover !== 'undefined' && GameModeTakeover.flushInputEdges) {
                GameModeTakeover.flushInputEdges();
            }
            if (typeof world._beginRoguelikeRun === 'function') {
                return world._beginRoguelikeRun();
            }
            console.error('[RoguelikeRun] world._beginRoguelikeRun missing');
        },

        returnToNexus(world) {
            if (!world) return;
            // Embedded Island (arena): tear down the session instead of a Gear abandon.
            if (world.activeSessionId
                && typeof root.AppHost !== 'undefined'
                && typeof root.AppHost.endSession === 'function') {
                return root.AppHost.endSession();
            }
            if (typeof root.PlayingHost !== 'undefined' && root.PlayingHost.end) {
                root.PlayingHost.end(world);
            }
            if (typeof GameModeTakeover !== 'undefined' && GameModeTakeover.flushInputEdges) {
                GameModeTakeover.flushInputEdges();
            }
            if (typeof world._returnToNexusImpl === 'function') {
                return world._returnToNexusImpl();
            }
            console.error('[RoguelikeRun] world._returnToNexusImpl missing');
        },

        advance(world) {
            if (!world) return;
            const profile = world.modeProfile || (root.PlayingHost && root.PlayingHost.getActiveProfile && root.PlayingHost.getActiveProfile());
            if (profile && profile.room && profile.room.advance === false) {
                return;
            }
            if (typeof world._advanceToNextRoomImpl === 'function') {
                return world._advanceToNextRoomImpl();
            }
            console.error('[RoguelikeRun] world._advanceToNextRoomImpl missing');
        }
    };

    root.Modes = root.Modes || {};
    if (!root.Modes.roguelike) root.Modes.roguelike = { id: 'roguelike' };
    root.Modes.roguelike.Run = RoguelikeRun;
    root.RoguelikeRun = RoguelikeRun;
})(typeof globalThis !== 'undefined' ? globalThis : window);

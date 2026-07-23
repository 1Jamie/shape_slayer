/**
 * Roguelike Island rules — WHY for Gear Mode progression.
 * Packages emit facts; this module grants XP/loot, opens doors, advances rooms.
 */
(function (root) {
    'use strict';

    const RoguelikeRules = {
        id: 'roguelike',

        /**
         * @param {object} bus - GameBus
         * @returns {function(): void} teardown
         */
        attach(bus) {
            if (!bus || typeof bus.subscribe !== 'function') {
                throw new Error('[RoguelikeRules] GameBus.subscribe required');
            }
            return bus.subscribe({
                'combat:enemyKilled': (payload) => {
                    if (!payload || !payload.enemy) return;
                    if (payload.isBoss) {
                        if (typeof GameKillRewards !== 'undefined' && GameKillRewards.grantBossKill) {
                            GameKillRewards.grantBossKill(payload);
                        }
                        return;
                    }
                    if (typeof GameKillRewards !== 'undefined' && GameKillRewards.grantStandardKill) {
                        GameKillRewards.grantStandardKill(payload);
                    }
                },
                'rooms:cleared': (payload) => {
                    const room = payload && payload.room;
                    const world = (payload && payload.world) || root.Game;
                    if (!room) return;
                    if (typeof GameRoomClear !== 'undefined') {
                        if (GameRoomClear.openDoors) GameRoomClear.openDoors(room);
                        if (GameRoomClear.applyStandardClearEffects) {
                            GameRoomClear.applyStandardClearEffects(room, world);
                        }
                    } else {
                        room.doorOpen = true;
                        room.rewardsGranted = true;
                    }
                },
                'combat:playerDied': () => {
                    // Existing player-base death path still settles shards / death UI.
                    // Future: move creditRewards here fully.
                }
            });
        }
    };

    root.RoguelikeRules = RoguelikeRules;
    root.Modes = root.Modes || {};
    if (!root.Modes.roguelike) root.Modes.roguelike = { id: 'roguelike' };
    root.Modes.roguelike.Rules = RoguelikeRules;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RoguelikeRules;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

/**
 * Room-clear effect verbs — HOW to apply clear side-effects when a mode decides clear matters.
 * rooms package emits rooms:cleared; Island rules call these / decide advance vs respawn.
 */
(function (root) {
    'use strict';

    function resolveWorld(explicit) {
        if (explicit) return explicit;
        if (typeof GameWorld !== 'undefined' && GameWorld.resolveWorld) {
            return GameWorld.resolveWorld();
        }
        return typeof Game !== 'undefined' ? Game : null;
    }

    function openDoors(room) {
        if (!room) return;
        room.doorOpen = true;
        if (typeof GameAudio !== 'undefined' && GameAudio.sounds && GameAudio.sounds.doorOpen) {
            GameAudio.sounds.doorOpen();
        }
    }

    /**
     * Standard Gear clear meta: heal, telemetry, save, feats, MP revive.
     * Idempotent via room.rewardsGranted.
     */
    function applyStandardClearEffects(room, world) {
        const w = resolveWorld(world);
        if (!room || room.rewardsGranted) return false;

        if (room.type === 'tutorial' || room.number === 0) {
            room.rewardsGranted = true;
            return true;
        }

        if (room.type === 'safe') {
            if (w && w.resumeSkipSafeSoftHeal) {
                w.resumeSkipSafeSoftHeal = false;
            } else if (w && w.player) {
                const maxHp = w.player.maxHp || 100;
                const healAmount = Math.floor(maxHp * 0.5);
                w.player.hp = Math.min(w.player.maxHp, w.player.hp + healAmount);
            }
        }

        if (room.type === 'boss' && typeof Engine !== 'undefined' && Engine.Music
            && Engine.Music.currentCategory === 'encounter' && Engine.Music.fadeOutCurrent) {
            Engine.Music.fadeOutCurrent().catch(() => {});
        }

        if (typeof Telemetry !== 'undefined' && Telemetry.recordEvent) {
            Telemetry.recordEvent('roomClearedSummary', {
                roomNumber: room.number,
                metadata: {
                    roomType: room.type,
                    gameMode: (w && w.gameMode) ? w.gameMode : 'gear',
                    enemiesKilled: (w && w.enemiesKilled) || 0,
                    bossesKilled: (w && w.bossesKilled) || 0,
                    itemsDroppedThisRoom: (w && w.itemsDroppedThisRoom) || 0,
                    currencyEarned: (w && w.currencyEarned) || 0,
                    shardsEarned: (w && w.shardsEarned) || 0
                }
            });
            const participants = w && w.collectTelemetryParticipants
                ? w.collectTelemetryParticipants(true)
                : [];
            if (Telemetry.recordRoomCleared) {
                Telemetry.recordRoomCleared(room.number, participants);
            }
        }

        const isClient = w && w.isMultiplayerClient && w.isMultiplayerClient();
        if (!isClient && typeof SaveSystem !== 'undefined' && SaveSystem.recordRoomCleared) {
            SaveSystem.recordRoomCleared(room.number || (w && w.roomNumber) || 0);
        }

        if (typeof window !== 'undefined' && typeof window.updateLifetimeStats === 'function') {
            window.updateLifetimeStats({ totalRoomsCleared: 1 });
        }

        if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent && w && w.player) {
            const hpPct = w.player.maxHp > 0 ? w.player.hp / w.player.maxHp : 1;
            let biomeName = 'None';
            if (room.biomeId) {
                biomeName = room.biomeId;
                if (typeof BiomeConfig !== 'undefined' && BiomeConfig.getBiomeDefinition) {
                    const def = BiomeConfig.getBiomeDefinition(room.biomeId);
                    if (def && def.bossTheme) biomeName = def.bossTheme;
                    else if (def && def.id) biomeName = def.id;
                }
            }
            const isCombat = room.type === 'combat' || room.type === 'boss' || room.type === 'elite';
            LedgerManager.recordEvent('roomCleared', {
                roomNumber: room.number || (w && w.roomNumber) || 0,
                hpPct,
                biomeName,
                isCombat,
                player: w.player
            });
        }

        room.rewardsGranted = true;

        if (w && typeof w.reviveDeadPlayers === 'function' && typeof w.isHost === 'function'
            && w.multiplayerEnabled && w.isHost()) {
            if (w.lastRoomClearReviveRoomNumber !== room.number) {
                w.reviveDeadPlayers({
                    reason: 'room_clear',
                    broadcast: true,
                    respawnStrategy: 'safe'
                });
                w.lastRoomClearReviveRoomNumber = room.number;
            }
        }

        return true;
    }

    /**
     * Respawn a fresh combat wave (sandbox / arena loops).
     * Uses world.waveNumber / roomNumber for Gear-equivalent difficulty scaling.
     */
    function regenerateInPlace(world) {
        const w = resolveWorld(world);
        if (!w) return false;

        const prevRoom = (typeof currentRoom !== 'undefined') ? currentRoom : null;
        if (prevRoom && typeof releaseRoomRenderCaches === 'function') {
            try { releaseRoomRenderCaches(prevRoom); } catch (_) { /* ignore */ }
        }

        w.enemies = [];
        w.projectiles = (typeof createProjectileList === 'function'
            ? createProjectileList()
            : []);
        if (w.spatialHash && typeof w.spatialHash.clear === 'function') {
            w.spatialHash.clear();
        }
        if (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot)) {
            groundLoot.length = 0;
        }
        if (typeof itemPylons !== 'undefined' && Array.isArray(itemPylons)) {
            itemPylons.length = 0;
        }
        w.itemsDroppedThisRoom = 0;
        w.enteringSafeRoom = false;

        const waveNum = Math.max(1, w.waveNumber || w.roomNumber || 1);
        w.waveNumber = waveNum;
        w.roomNumber = waveNum;

        if (typeof generateRoom === 'function') {
            const room = generateRoom(waveNum, { forceCombat: true });
            if (typeof setCurrentRoom === 'function') {
                setCurrentRoom(room);
            } else if (typeof window !== 'undefined') {
                window.currentRoom = room;
            }
            if (room) {
                room._clearEventEmitted = false;
                room.cleared = false;
                room.rewardsGranted = false;
                room.doorOpen = false;
                room.waveNumber = waveNum;
            }
            if (w.player) {
                w.player.dead = false;
                w.player.alive = true;
                if (typeof w.getRoomSpawnPoint === 'function' && room) {
                    const spawn = w.getRoomSpawnPoint(room, 0);
                    if (spawn) {
                        w.player.x = spawn.x;
                        w.player.y = spawn.y;
                    }
                }
            }
            if (room && Array.isArray(room.enemies)) {
                w.enemies = room.enemies.slice();
            }
            if (typeof w.syncInSafeRoomFromCurrentRoom === 'function') {
                w.syncInSafeRoomFromCurrentRoom(room);
            }
            return true;
        }

        if (typeof w.spawnEnemies === 'function') {
            w.spawnEnemies();
            return true;
        }
        return false;
    }

    root.GameRoomClear = {
        openDoors,
        applyStandardClearEffects,
        regenerateInPlace
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.GameRoomClear;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

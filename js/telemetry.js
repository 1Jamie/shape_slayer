(() => {
    const METRICS_ENDPOINT = 'https://metrics.goodgirl.software/ingest';

    function generateRunId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function sanitizeNumber(value) {
        if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
            return 0;
        }
        return value;
    }

    function collectAffixes(gearPiece) {
        if (!gearPiece || !Array.isArray(gearPiece.affixes)) {
            return [];
        }

        return gearPiece.affixes.map(affix => ({
            id: affix.type || affix.id || 'unknown',
            value: affix.value !== undefined ? affix.value : null,
            tier: affix.tier || null
        }));
    }

    function collectPlayerAffixes(player) {
        const all = [];
        ['weapon', 'armor', 'accessory'].forEach(slot => {
            const gear = player && player[slot] ? player[slot] : null;
            all.push(...collectAffixes(gear));
        });
        return all;
    }

    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function captureGearPiece(gear) {
        if (!gear) {
            return null;
        }

        return {
            id: gear.id || null,
            name: gear.name || gear.displayName || gear.internalName || null,
            tier: gear.tier || null,
            type: gear.weaponType || gear.armorType || gear.accessoryType || gear.slot || null,
            classModifier: gear.classModifier
                ? (gear.classModifier.description || gear.classModifier.type || null)
                : null,
            legendaryEffect: gear.legendaryEffect
                ? (gear.legendaryEffect.description || gear.legendaryEffect.type || null)
                : null,
            stats: gear.stats ? deepClone(gear.stats) : null,
            affixes: collectAffixes(gear)
        };
    }

    function captureGearSnapshot(player) {
        const weapon = player && player.weapon ? player.weapon : null;
        const armor = player && player.armor ? player.armor : null;
        const accessory = player && player.accessory ? player.accessory : null;

        return {
            weapon: captureGearPiece(weapon),
            armor: captureGearPiece(armor),
            accessory: captureGearPiece(accessory)
        };
    }

    const PLAYER_STAT_KEYS = [
        'damage',
        'damageMultiplier',
        'defense',
        'defenseMultiplier',
        'moveSpeed',
        'attackSpeedMultiplier',
        'critChance',
        'critDamageMultiplier',
        'hp',
        'maxHp',
        'lifesteal',
        'cooldownReduction',
        'areaOfEffect',
        'projectileSpeedMultiplier',
        'knockbackMultiplier',
        'pierceCount',
        'chainLightningCount',
        'executeBonus',
        'rampageStacks',
        'rampageBonus',
        'fortifyPercent',
        'fortifyShield',
        'fortifyShieldDecay',
        'overchargeChance',
        'phasingChance',
        'dodgeCharges',
        'bonusDodgeCharges',
        'specialCooldownTime',
        'dodgeCooldownTime'
    ];

    function capturePlayerSnapshots(participants = []) {
        if (!Array.isArray(participants)) {
            return [];
        }

        return participants.map(({ player, playerId }) => {
            const snapshot = {
                playerId: playerId || (player && player.playerId) || 'unknown',
                class: player ? (player.playerClass || player.class || 'unknown') : 'unknown',
                level: isFiniteNumber(player && player.level) ? player.level : null,
                stats: {},
                gear: captureGearSnapshot(player)
            };

            if (player) {
                PLAYER_STAT_KEYS.forEach(key => {
                    if (isFiniteNumber(player[key])) {
                        snapshot.stats[key] = player[key];
                    }
                });

                const additional = {
                    baseDamage: player.baseDamage,
                    baseMoveSpeed: player.baseMoveSpeed,
                    xp: player.xp,
                    xpToNext: player.xpToNext
                };

                Object.keys(additional).forEach(key => {
                    if (isFiniteNumber(additional[key])) {
                        snapshot.stats[key] = additional[key];
                    }
                });

                if (!isFiniteNumber(snapshot.stats.hp)) {
                    snapshot.stats.hp = sanitizeNumber(player.hp);
                } else {
                    snapshot.stats.hp = sanitizeNumber(snapshot.stats.hp);
                }

                if (!isFiniteNumber(snapshot.stats.maxHp)) {
                    snapshot.stats.maxHp = sanitizeNumber(player.maxHp);
                } else {
                    snapshot.stats.maxHp = sanitizeNumber(snapshot.stats.maxHp);
                }
            } else {
                snapshot.stats.hp = 0;
                snapshot.stats.maxHp = 0;
            }

            return snapshot;
        });
    }

    function updatePlayerSummariesFromSnapshots(snapshots) {
        if (!state.activeRun || !Array.isArray(snapshots)) return;
        snapshots.forEach(snapshot => {
            if (!snapshot || !snapshot.playerId) return;
            const summary = state.activeRun.playerSummaries.get(snapshot.playerId);
            if (summary) {
                summary.gear = snapshot.gear;
            }
        });
    }

    function summarizePlayer(player, playerId) {
        if (!player) {
            return {
                playerId,
                class: 'unknown',
                deck: [],
                affixes: [],
                gear: captureGearSnapshot(null),
                totalDamageDealt: 0,
                totalDamageTaken: 0,
                hitsTaken: 0,
                roomsCleared: 0,
                deaths: 0
            };
        }

        return {
            playerId,
            class: player.playerClass || player.class || 'unknown',
            deck: Array.isArray(player.loadout) ? deepClone(player.loadout) : [],
            affixes: collectPlayerAffixes(player),
            gear: captureGearSnapshot(player),
            totalDamageDealt: 0,
            totalDamageTaken: 0,
            hitsTaken: 0,
            roomsCleared: 0,
            deaths: 0
        };
    }

    function summarizeAffixPool(players) {
        const unique = new Map();
        players.forEach(player => {
            player.affixes.forEach(affix => {
                const key = affix.id;
                if (!unique.has(key)) {
                    unique.set(key, {
                        id: affix.id,
                        source: 'player',
                        valueRange: []
                    });
                }
                if (affix.value !== null && affix.value !== undefined) {
                    unique.get(key).valueRange.push(affix.value);
                }
            });
        });

        return Array.from(unique.values()).map(entry => {
            if (entry.valueRange.length) {
                entry.minValue = Math.min(...entry.valueRange);
                entry.maxValue = Math.max(...entry.valueRange);
            }
            delete entry.valueRange;
            return entry;
        });
    }

    const state = {
        activeRun: null,
        currentRoom: null
    };

    function ensureRoom(roomNumber) {
        if (!state.activeRun) return null;
        if (!state.activeRun.rooms.has(roomNumber)) {
            state.activeRun.rooms.set(roomNumber, {
                roomId: `room-${roomNumber}`,
                roomNumber,
                type: 'normal',
                enteredAt: nowIso(),
                clearedAt: null,
                durationMs: 0,
                damageDealtByPlayer: {},
                damageTakenByPlayer: {},
                hitsTakenByPlayer: {},
                playerStatsStart: [],
                playerStatsEnd: [],
                events: []
            });
        }
        return state.activeRun.rooms.get(roomNumber);
    }

    function ensurePlayerSummary(playerId) {
        if (!state.activeRun) return null;
        if (!state.activeRun.playerSummaries.has(playerId)) {
            state.activeRun.playerSummaries.set(playerId, summarizePlayer(null, playerId));
        }
        return state.activeRun.playerSummaries.get(playerId);
    }

    function isHostOrSolo() {
        if (typeof Game === 'undefined') return false;
        if (typeof SaveSystem !== 'undefined' && SaveSystem.getTelemetryOptIn) {
            const optIn = SaveSystem.getTelemetryOptIn();
            if (optIn !== true) {
                return false;
            }
        }
        if (!Game.multiplayerEnabled) return true;
        if (typeof Game.isHost === 'function') {
            return Game.isHost();
        }
        return false;
    }

    const Telemetry = {
        shouldCapture() {
            return isHostOrSolo();
        },

        startRun(context = {}) {
            if (!this.shouldCapture()) {
                state.activeRun = null;
                return;
            }

            const runId = generateRunId();
            const startedAt = nowIso();
            const {
                mode = (typeof Game !== 'undefined' && Game.multiplayerEnabled ? 'multiplayer' : 'singleplayer'),
                hostPlayerId = (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local'),
                difficulty = 'default',
                seed = null,
                players = [],
                metadata = {}
            } = context;

            const playerSummaries = players.map(({ player, playerId }) => summarizePlayer(player, playerId));
            const affixPool = summarizeAffixPool(playerSummaries);

            state.activeRun = {
                runId,
                gameVersion: (typeof Game !== 'undefined' && Game.VERSION) ? Game.VERSION : 'unknown',
                mode,
                hostPlayerId,
                startedAt,
                endedAt: null,
                durationMs: 0,
                result: 'unknown',
                seed,
                difficulty,
                metadata,
                affixPool,
                rooms: new Map(),
                playerSummaries: new Map(playerSummaries.map(summary => [summary.playerId, summary])),
                bossEncounters: []
            };

            state.currentRoom = null;
        },

        recordRoomEnter(roomNumber, roomType = 'normal', participants = []) {
            if (!state.activeRun || !this.shouldCapture()) return;
            const roomEntry = ensureRoom(roomNumber);
            if (!roomEntry) return;
            roomEntry.type = roomType || roomEntry.type;
            const timestamp = nowIso();
            roomEntry.enteredAt = timestamp;
            const snapshots = capturePlayerSnapshots(participants);
            roomEntry.playerStatsStart = snapshots;
            updatePlayerSummariesFromSnapshots(snapshots);
            if (snapshots.length) {
                roomEntry.events.push({
                    timestamp,
                    type: 'roomStats',
                    metadata: {
                        phase: 'start',
                        roomNumber,
                        players: snapshots
                    }
                });
            }
            state.currentRoom = roomEntry;
        },

        recordRoomCleared(roomNumber, participants = []) {
            if (!state.activeRun || !this.shouldCapture()) return;
            const roomEntry = ensureRoom(roomNumber);
            if (!roomEntry) return;
            if (!roomEntry.clearedAt) {
                const clearedAt = nowIso();
                roomEntry.clearedAt = clearedAt;
                if (roomEntry.enteredAt) {
                    roomEntry.durationMs = Math.max(0, Date.now() - new Date(roomEntry.enteredAt).getTime());
                }
            }

            const snapshots = capturePlayerSnapshots(participants);
            roomEntry.playerStatsEnd = snapshots;
            updatePlayerSummariesFromSnapshots(snapshots);
            if (snapshots.length) {
                roomEntry.events.push({
                    timestamp: nowIso(),
                    type: 'roomStats',
                    metadata: {
                        phase: 'end',
                        roomNumber,
                        players: snapshots
                    }
                });
            }
        },

        recordDamage({ playerId, amount, enemyId = null, enemyType = null, roomNumber, isBoss = false }) {
            if (!state.activeRun || !this.shouldCapture()) return;
            const safeAmount = sanitizeNumber(amount);
            const roomEntry = ensureRoom(roomNumber);
            if (roomEntry) {
                roomEntry.damageDealtByPlayer[playerId] = (roomEntry.damageDealtByPlayer[playerId] || 0) + safeAmount;
                roomEntry.events.push({
                    timestamp: nowIso(),
                    type: 'damage',
                    playerId,
                    targetId: enemyId,
                    targetType: enemyType,
                    value: safeAmount,
                    metadata: { isBoss }
                });
            }

            const playerSummary = ensurePlayerSummary(playerId);
            if (playerSummary) {
                playerSummary.totalDamageDealt += safeAmount;
            }
        },

        recordPlayerHit({ playerId, amount, roomNumber, sourceId = null, sourceType = null }) {
            if (!state.activeRun || !this.shouldCapture()) return;
            const safeAmount = sanitizeNumber(amount);
            const roomEntry = ensureRoom(roomNumber);
            if (roomEntry) {
                roomEntry.damageTakenByPlayer[playerId] = (roomEntry.damageTakenByPlayer[playerId] || 0) + safeAmount;
                roomEntry.hitsTakenByPlayer[playerId] = (roomEntry.hitsTakenByPlayer[playerId] || 0) + 1;
                roomEntry.events.push({
                    timestamp: nowIso(),
                    type: 'hitTaken',
                    playerId,
                    targetId: playerId,
                    value: safeAmount,
                    metadata: {
                        sourceId,
                        sourceType
                    }
                });
            }

            const playerSummary = ensurePlayerSummary(playerId);
            if (playerSummary) {
                playerSummary.totalDamageTaken += safeAmount;
                playerSummary.hitsTaken += 1;
            }
        },

        recordPlayerDeath(playerId) {
            if (!state.activeRun || !this.shouldCapture()) return;
            const playerSummary = ensurePlayerSummary(playerId);
            if (playerSummary) {
                playerSummary.deaths += 1;
            }
        },

        recordRoomsCleared(roomsClearedByPlayer) {
            if (!state.activeRun || !this.shouldCapture()) return;
            Object.entries(roomsClearedByPlayer || {}).forEach(([playerId, count]) => {
                const playerSummary = ensurePlayerSummary(playerId);
                if (playerSummary) {
                    playerSummary.roomsCleared = count;
                }
            });
        },

        recordBossEncounter(event) {
            if (!state.activeRun || !this.shouldCapture()) return;
            state.activeRun.bossEncounters.push({
                ...event,
                startedAt: event.startedAt || nowIso(),
                endedAt: event.endedAt || null
            });
        },

        completeBossEncounter(bossId, data = {}) {
            if (!state.activeRun || !this.shouldCapture()) return;
            const encounter = state.activeRun.bossEncounters.find(enc => enc.bossId === bossId && !enc.endedAt);
            if (encounter) {
                encounter.endedAt = data.endedAt || nowIso();
                if (encounter.startedAt) {
                    encounter.durationMs = Math.max(
                        0,
                        Date.now() - new Date(encounter.startedAt).getTime()
                    );
                }
                encounter.damageByPlayer = data.damageByPlayer || encounter.damageByPlayer || {};
                encounter.damageToPlayers = data.damageToPlayers || encounter.damageToPlayers || {};
                encounter.hitsTakenByPlayers = data.hitsTakenByPlayers || encounter.hitsTakenByPlayers || {};
                encounter.phases = data.phases || encounter.phases || [];
            }
        },

        completeRun({ result = 'unknown', metadata = {}, roomsClearedByPlayer = {}, finalPlayers = [] } = {}) {
            if (!state.activeRun || !this.shouldCapture()) return;

            const endedAt = nowIso();
            state.activeRun.endedAt = endedAt;
            state.activeRun.result = result;
            state.activeRun.durationMs = Math.max(
                0,
                Date.now() - new Date(state.activeRun.startedAt).getTime()
            );

            const finalSnapshots = capturePlayerSnapshots(finalPlayers);
            const mergedMetadata = {
                ...(state.activeRun.metadata || {}),
                ...metadata
            };
            if (finalSnapshots.length) {
                mergedMetadata.finalPlayerStats = finalSnapshots;
                finalSnapshots.forEach(snapshot => {
                    const summary = state.activeRun.playerSummaries.get(snapshot.playerId);
                    if (summary) {
                        summary.gear = snapshot.gear;
                    }
                });
            }
            state.activeRun.metadata = mergedMetadata;

            this.recordRoomsCleared(roomsClearedByPlayer);

            const payload = this.serialize();
            if (payload) {
                this.submit(payload);
            }

            state.activeRun = null;
            state.currentRoom = null;
        },

        serialize() {
            if (!state.activeRun) return null;

            const rooms = Array.from(state.activeRun.rooms.values()).map(room => {
                if (!room.clearedAt && room.enteredAt) {
                    room.clearedAt = nowIso();
                    room.durationMs = Math.max(
                        0,
                        Date.now() - new Date(room.enteredAt).getTime()
                    );
                }
                return room;
            });

            const players = Array.from(state.activeRun.playerSummaries.values());

            return {
                run: {
                    runId: state.activeRun.runId,
                    gameVersion: state.activeRun.gameVersion,
                    mode: state.activeRun.mode,
                    hostPlayerId: state.activeRun.hostPlayerId,
                    startedAt: state.activeRun.startedAt,
                    endedAt: state.activeRun.endedAt,
                    durationMs: state.activeRun.durationMs,
                    result: state.activeRun.result,
                    seed: state.activeRun.seed,
                    difficulty: state.activeRun.difficulty,
                    players,
                    affixPool: state.activeRun.affixPool,
                    rooms,
                    bossEncounters: state.activeRun.bossEncounters,
                    metadata: state.activeRun.metadata
                },
                submittedAt: nowIso(),
                clientVersion: state.activeRun.gameVersion,
                authToken: null
            };
        },

        async submit(payload) {
            try {
                await fetch(METRICS_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
            } catch (error) {
                console.error('[Telemetry] Failed to submit metrics:', error);
            }
        },

        reset() {
            state.activeRun = null;
            state.currentRoom = null;
        }
    };

    // Expose globally
    window.Telemetry = Telemetry;
})();


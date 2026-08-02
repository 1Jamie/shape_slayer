/**
 * Arena run verbs — HOW for wave arenas (stadium layout, wave spawn via WaveDirector,
 * hard surges, machine bay). Modes (SandboxRules) own WHEN: WFT pylon, unlock machines
 * after every-5 hard clear, director tick, etc.
 */
(function (root) {
    'use strict';

    const MACHINE_GATE_ID = 'arena-machine-gate';
    const ARENA_BOSS_POOL = Object.freeze([
        { name: 'Swarm King', key: 'BossSwarmKing' },
        { name: 'Twin Prism', key: 'BossTwinPrism' },
        { name: 'Fractal Core', key: 'BossFractalCore' },
        { name: 'Vortex', key: 'BossVortex' }
        // Fortress intentionally omitted — unsuitable for arena
    ]);

    function resolveWorld(explicit) {
        if (explicit) return explicit;
        if (typeof GameWorld !== 'undefined' && GameWorld.resolveWorld) {
            return GameWorld.resolveWorld();
        }
        return typeof Game !== 'undefined' ? Game : null;
    }

    function resolveRoom(world) {
        if (typeof currentRoom !== 'undefined' && currentRoom) return currentRoom;
        if (world && world.currentRoom) return world.currentRoom;
        if (typeof window !== 'undefined' && window.currentRoom) return window.currentRoom;
        return null;
    }

    function getArenaHardIndex(wave) {
        const w = Math.max(1, wave || 1);
        if (w < 15) return 1;
        return 2 + Math.floor((w - 15) / 5);
    }

    function isHardWave(wave) {
        return wave === 8 || (wave >= 15 && wave % 5 === 0);
    }

    function getArenaBossCount(wave) {
        const w = Math.max(1, wave || 1);
        const hardIndex = getArenaHardIndex(w);
        if (hardIndex === 1) return 1;
        if (hardIndex === 2) return 2;
        if (hardIndex === 3) return 3;
        if (hardIndex <= 7) {
            // RNG between 3 and 5 for surges 4 to 7 (waves 20 to 35)
            return 3 + Math.floor(Math.random() * 3);
        }
        // Absurd waves (Surge 8+, wave 40+): scale min & max boss counts upward
        const extraSurges = hardIndex - 7;
        const minBosses = Math.min(8, 3 + Math.floor(extraSurges / 2));
        const maxBosses = Math.min(10, minBosses + 2);
        return minBosses + Math.floor(Math.random() * (maxBosses - minBosses + 1));
    }

    function isDoubleBossWave(wave) {
        return getArenaBossCount(wave) > 1;
    }

    /**
     * Map Surge Arena hard waves onto a Gear room equivalent for BossScaling.
     * Early surges (surges 1-3) start gentle (rooms 1, 3, 6), then scaling accelerates
     * past surge 3 so players don't rapidly outscale bosses in mid/late surges.
     */
    function arenaBossScalingRoom(wave) {
        const w = Math.max(1, wave || 1);
        if (w <= 15) return w;
        const extra = w - 15;
        return Math.floor(15 + extra * 1.2 + Math.pow(extra, 1.3) * 0.4);
    }

    function arenaBossHpMult(wave, bossCount) {
        const count = Math.max(1, bossCount || getArenaBossCount(wave));
        if (count === 1) return 0.85;
        if (count === 2) return 0.70;
        if (count === 3) return 0.60;
        return 0.50;
    }

    function arenaBossDamageMult(wave, bossCount) {
        const count = Math.max(1, bossCount || getArenaBossCount(wave));
        if (count === 1) return 0.95;
        if (count === 2) return 0.85;
        return 0.75;
    }

    function pickArenaBosses(wave, count) {
        const hardIndex = getArenaHardIndex(wave);
        let pool = ARENA_BOSS_POOL.slice();
        // Wave 5: lighter openers. Wave 10: no Vortex yet. Wave 15+: full pool.
        if (hardIndex <= 1) {
            pool = pool.filter((b) => b.key === 'BossSwarmKing' || b.key === 'BossTwinPrism');
        } else if (hardIndex === 2) {
            pool = pool.filter((b) => b.key !== 'BossVortex');
        }
        if (!pool.length) pool = ARENA_BOSS_POOL.slice();

        const out = [];
        const n = Math.max(1, count || 1);
        const available = pool.slice();
        for (let i = 0; i < n && available.length; i++) {
            const idx = Math.floor(Math.random() * available.length);
            out.push(available.splice(idx, 1)[0]);
        }
        while (out.length < n) {
            const fallback = pool.length ? pool : ARENA_BOSS_POOL;
            const pick = fallback[Math.floor(Math.random() * fallback.length)];
            out.push(pick);
        }
        return out;
    }

    function constructBoss(entry, x, y, wave, bossCount) {
        let BossCtor = null;
        if (entry.key === 'BossSwarmKing' && typeof BossSwarmKing !== 'undefined') BossCtor = BossSwarmKing;
        else if (entry.key === 'BossTwinPrism' && typeof BossTwinPrism !== 'undefined') BossCtor = BossTwinPrism;
        else if (entry.key === 'BossFractalCore' && typeof BossFractalCore !== 'undefined') BossCtor = BossFractalCore;
        else if (entry.key === 'BossVortex' && typeof BossVortex !== 'undefined') BossCtor = BossVortex;
        if (!BossCtor) return null;

        const boss = new BossCtor(x, y);
        boss.introComplete = true;
        boss.isArenaBoss = true;
        boss.detectionRange = 99999;
        boss.activated = true;
        boss.arenaFullAgro = true;

        const totalCount = bossCount || 1;
        const scaleRoom = arenaBossScalingRoom(wave);
        if (typeof BossScaling !== 'undefined' && BossScaling.applyBossScaling) {
            const mpScaling = (typeof getMultiplayerScaling === 'function')
                ? getMultiplayerScaling()
                : { bossHP: 1, bossDamage: 1 };
            // Full boss encounter (not elite mid-room spawn) at Gear-equivalent room.
            const defaultGrowth = (typeof BossScaling !== 'undefined' && typeof BossScaling.getBossGrowthConstants === 'function')
                ? BossScaling.getBossGrowthConstants()
                : { hpGrowth: 0.052, hpGrowthPost: 0.040, damageGrowth: 0.080, damageGrowthPost: 0.052 };
            const stats = BossScaling.applyBossScaling(boss, scaleRoom, {
                gameMode: 'gear',
                mpScaling,
                isEliteSpawn: false,
                growth: {
                    hpGrowth: defaultGrowth.hpGrowth * 1.05,
                    hpGrowthPost: defaultGrowth.hpGrowthPost * 1.05,
                    damageGrowth: defaultGrowth.damageGrowth,
                    damageGrowthPost: defaultGrowth.damageGrowthPost
                }
            });
            const hpMult = arenaBossHpMult(wave, totalCount);
            const dmgMult = arenaBossDamageMult(wave, totalCount);
            if (stats && stats.maxHp) {
                const tunedHp = Math.max(1, Math.floor(stats.maxHp * hpMult));
                boss.maxHp = tunedHp;
                boss.hp = tunedHp;
            }
            if (stats && stats.damage != null) {
                boss.damage = stats.damage * dmgMult;
            }
            boss.arenaBossScaleRoom = scaleRoom;
            boss.arenaBossHpMult = hpMult;
        }
        return boss;
    }

    /**
     * Attach machines / gate / pylon from GameArenaLayout anchors.
     * Layout collision already owned by the topology director.
     */
    /**
     * @param {object} room
     * @param {object} anchors
     * @param {{ applyBarriers?: boolean }} [options]
     *   applyBarriers (default true): stamp machine-bay gate into the layout.
     *   Multiplayer clients must pass false — host serializes the already-stamped
     *   grid, and re-creating a closed gate here desyncs walkability / prediction.
     */
    function attachArenaFixtures(room, anchors, options) {
        if (!room || !room.layout || !anchors) return room;
        const applyBarriers = !options || options.applyBarriers !== false;
        const bay = anchors.machineBay;
        const pylon = anchors.pylon;
        const spawn = anchors.spawnLip;
        const cx = (bay ? bay.x + bay.w * 0.5 : room.width * 0.5);

        if (bay) {
            room.safeRoomMachines = [
                {
                    id: 'gearUpgrade',
                    name: 'Gear Level Up',
                    icon: '🛠️',
                    x: cx - 110,
                    y: bay.y + bay.h * 0.52,
                    range: 60
                },
                {
                    id: 'affixReroll',
                    name: 'Affix Reroll',
                    icon: '🎲',
                    x: cx + 110,
                    y: bay.y + bay.h * 0.52,
                    range: 60
                }
            ];
            // Host/build path seals by default; synced clients keep prior/network flag.
            if (applyBarriers || room.machinesAccessible == null) {
                room.machinesAccessible = false;
            }
            room.allowSafeRoomMachines = true;
            room.machineBay = { x: bay.x, y: bay.y, w: bay.w, h: bay.h };
            if (applyBarriers && typeof GameBarriers !== 'undefined' && GameBarriers.create) {
                const existingGate = (typeof GameBarriers.get === 'function')
                    ? GameBarriers.get(room, MACHINE_GATE_ID)
                    : null;
                if (!existingGate) {
                    GameBarriers.create(room, {
                        id: MACHINE_GATE_ID,
                        x: bay.x - 16,
                        y: bay.y + bay.h - 6,
                        w: bay.w + 32,
                        h: 52,
                        closed: true,
                        label: 'Machine Bay Gate'
                    });
                }
            }
        }

        if (pylon) {
            const prevActive = room.wavePylon ? !!room.wavePylon.active : false;
            room.wavePylon = {
                x: pylon.x,
                y: pylon.y,
                range: 230,
                padRadius: 195,
                lootClearRadius: 230,
                active: applyBarriers ? false : prevActive,
                label: 'Wave Trigger'
            };
            // Gore-clean pad sits to the right of the wave pylon.
            room.goreCleanPad = {
                x: pylon.x + 320,
                y: pylon.y,
                range: 80,
                padRadius: 68,
                label: 'Clear Viscera'
            };
            // Session spawn / revive is the wave pylon plaza (not the south lip).
            // Host layouts already carry the plaza spawnZone — don't overwrite on sync.
            if (applyBarriers || !room.layout.spawnZone) {
                room.layout.spawnZone = {
                    x: pylon.x,
                    y: pylon.y,
                    radius: Math.max(180, pylon.clearRadius || 200)
                };
            }
            room.spawnZones = [room.layout.spawnZone];
        } else if (spawn && room.layout.spawnZone && applyBarriers) {
            room.layout.spawnZone.x = spawn.x;
            room.layout.spawnZone.y = spawn.y;
            room.layout.spawnZone.radius = spawn.radius || 200;
        }

        room.arenaFloor = anchors.arenaFloor || room.arenaFloor;
        room.isArenaComplex = true;
        room.topologyId = room.layout.topologyId || null;
        return room;
    }

    /** @deprecated Use GameArenaLayout.generate + attachArenaFixtures */
    function decorateArenaLayout(room) {
        return room;
    }

    function setMachinesAccessible(room, accessible) {
        if (!room) return;
        const wantOpen = !!accessible;
        room.machinesAccessible = wantOpen;

        // Sealing the gate while the player (or enemies) sit in the bay leaves them
        // inside walkable pocket / newly-blocked cells → collision thrash feels like
        // random force. Eject before we stamp solids.
        if (!wantOpen) {
            ejectEntitiesFromMachineBay(room);
        }

        if (typeof GameBarriers !== 'undefined' && GameBarriers.setOpen) {
            GameBarriers.setOpen(room, MACHINE_GATE_ID, wantOpen);
        }
        setMachineBayVolumeLocked(room, !wantOpen);
    }

    /**
     * Lock the whole machine bay as non-walkable (grid only — gate keeps the visible slab).
     * Bay interior used to stay walkable behind a thin gate, so WaveDirector could spawn in it.
     */
    function setMachineBayVolumeLocked(room, locked) {
        const bay = room && room.machineBay;
        const layout = room && room.layout;
        if (!bay || !layout || typeof GameBarriers === 'undefined') return;
        if (locked) {
            if (GameBarriers.stampGridRegion) {
                GameBarriers.stampGridRegion(layout, bay.x, bay.y, bay.w, bay.h);
            }
        } else if (GameBarriers.clearGridRegion) {
            GameBarriers.clearGridRegion(layout, bay.x, bay.y, bay.w, bay.h);
        }
        room.machineBayLocked = !!locked;
        // Bust path/render caches so walkability matches the sealed bay.
        if (typeof GameBarriers.refreshVisuals === 'function') {
            GameBarriers.refreshVisuals(room);
        }
    }

    function pointInMachineBay(bay, x, y, pad) {
        if (!bay) return false;
        const p = pad || 0;
        return x >= bay.x - p
            && x <= bay.x + bay.w + p
            && y >= bay.y - p
            && y <= bay.y + bay.h + p;
    }

    function ejectEntitiesFromMachineBay(room) {
        const bay = room && room.machineBay;
        if (!bay) return;
        const exitX = bay.x + bay.w * 0.5;
        const exitY = bay.y + bay.h + 120;
        const mouthBottom = bay.y + bay.h + 70;
        const w = resolveWorld();
        const players = [];
        if (w && w.player) players.push(w.player);
        if (typeof Game !== 'undefined' && Game.getAllAlivePlayers) {
            const all = Game.getAllAlivePlayers();
            const list = all instanceof Map ? Array.from(all.values()) : (Array.isArray(all) ? all : []);
            for (let i = 0; i < list.length; i++) {
                if (list[i] && players.indexOf(list[i]) < 0) players.push(list[i]);
            }
        }
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            if (!p || p.dead) continue;
            const inBayOrMouth = pointInMachineBay(bay, p.x, p.y, 28)
                || (p.x >= bay.x - 40 && p.x <= bay.x + bay.w + 40 && p.y >= bay.y && p.y <= mouthBottom);
            if (!inBayOrMouth) continue;
            p.x = exitX;
            p.y = exitY;
            if (typeof p.impulseVx === 'number') p.impulseVx = 0;
            if (typeof p.impulseVy === 'number') p.impulseVy = 0;
            p.lastSafeX = exitX;
            p.lastSafeY = exitY;
        }
        const enemies = (room.enemies || (w && w.enemies) || []);
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.alive === false) continue;
            if (!pointInMachineBay(bay, e.x, e.y, 8)) continue;
            e.alive = false;
            e.hp = 0;
        }
    }

    function setPylonActive(room, active) {
        if (!room || !room.wavePylon) return;
        room.wavePylon.active = !!active;
    }

    /**
     * Push loot off the wave trigger plaza so G-interact never fights ground gear.
     * @returns {{x:number,y:number}}
     */
    function displaceLootFromWavePad(x, y, options) {
        const opts = options || {};
        const room = opts.room
            || (typeof currentRoom !== 'undefined' ? currentRoom : null)
            || (opts.world && opts.world.currentRoom)
            || null;
        const pylon = room && room.wavePylon;
        if (!pylon || !Number.isFinite(x) || !Number.isFinite(y)) {
            return { x: x, y: y };
        }

        const cleanPad = room.goreCleanPad;
        const clearR = (opts.clearRadius != null)
            ? opts.clearRadius
            : ((pylon.range || pylon.lootClearRadius || 230) + 50); // e.g. 280

        const clearRClean = cleanPad ? ((cleanPad.range || 80) + 40) : 0; // e.g. 120

        let outX = x;
        let outY = y;

        const dx = outX - pylon.x;
        const dy = outY - pylon.y;

        if (cleanPad && outX > pylon.x && outX < cleanPad.x) {
            // Inside the overlap/between-pad horizontal corridor
            const dcx = outX - cleanPad.x;
            const minY = Math.sqrt(Math.max(0, clearR * clearR - dx * dx));
            const minYClean = Math.sqrt(Math.max(0, clearRClean * clearRClean - dcx * dcx));
            const targetDistY = Math.max(minY, minYClean);
            if (Math.abs(dy) < targetDistY) {
                outY = pylon.y + (dy >= 0 ? 1 : -1) * targetDistY;
            }
        } else {
            // Normal radial push for whichever circle we are colliding with
            const dist = Math.hypot(dx, dy);
            if (dist < clearR) {
                let nx = 0;
                let ny = 1;
                if (dist > 0.001) {
                    nx = dx / dist;
                    ny = dy / dist;
                }
                outX = pylon.x + nx * clearR;
                outY = pylon.y + ny * clearR;
            }

            if (cleanPad) {
                const dcx = outX - cleanPad.x;
                const dcy = outY - cleanPad.y;
                const distClean = Math.hypot(dcx, dcy);
                if (distClean < clearRClean) {
                    let ncx = 0;
                    let ncy = 1;
                    if (distClean > 0.001) {
                        ncx = dcx / distClean;
                        ncy = dcy / distClean;
                    }
                    outX = cleanPad.x + ncx * clearRClean;
                    outY = cleanPad.y + ncy * clearRClean;
                }
            }
        }

        const layout = room.layout;
        if (layout && typeof RoomLayoutGenerator !== 'undefined'
            && RoomLayoutGenerator.isPointWalkable
            && !RoomLayoutGenerator.isPointWalkable(layout, outX, outY, 16)) {
            // Fan around the ring until we find a walkable seat.
            // (Use whichever center we are closer to as the pivot)
            const pivotX = (cleanPad && Math.abs(outX - cleanPad.x) < Math.abs(outX - pylon.x)) ? cleanPad.x : pylon.x;
            const pivotY = pylon.y;
            const pivotR = (pivotX === pylon.x) ? clearR : clearRClean;

            const pdx = outX - pivotX;
            const pdy = outY - pivotY;

            for (let i = 0; i < 12; i++) {
                const ang = Math.atan2(pdy, pdx) + (i + 1) * (Math.PI / 6);
                const tx = pivotX + Math.cos(ang) * pivotR;
                const ty = pivotY + Math.sin(ang) * pivotR;
                if (RoomLayoutGenerator.isPointWalkable(layout, tx, ty, 16)) {
                    outX = tx;
                    outY = ty;
                    break;
                }
            }
        }
        return { x: outX, y: outY };
    }

    function clearCombatants(world, room) {
        if (room) room.enemies = [];
        if (world) {
            world.enemies = [];
            world.projectiles = (typeof createProjectileList === 'function'
                ? createProjectileList()
                : []);
            if (world.spatialHash && world.spatialHash.clear) world.spatialHash.clear();
        }
        // Wave rollover: loot only — never wipe VoxelStaticCanvas / viscera mess.
        clearGroundLoot(world);
    }

    /**
     * Clear pickable ground loot + pylons. Does not touch voxel/fluid static debris.
     */
    function clearGroundLoot(world) {
        const loot = (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot))
            ? groundLoot
            : (typeof root !== 'undefined' && root.groundLoot && Array.isArray(root.groundLoot)
                ? root.groundLoot
                : null);
        if (loot) loot.length = 0;
        if (typeof window !== 'undefined' && Array.isArray(window.groundLoot) && window.groundLoot !== loot) {
            window.groundLoot.length = 0;
        }

        const itemsHost = world || (typeof Game !== 'undefined' ? Game : null);
        if (itemsHost && Array.isArray(itemsHost.groundItems)) {
            itemsHost.groundItems.length = 0;
        }

        if (typeof itemPylons !== 'undefined' && Array.isArray(itemPylons)) {
            itemPylons.length = 0;
        }
        if (itemsHost) {
            itemsHost.itemsDroppedThisRoom = 0;
            if (typeof itemsHost.hideGroundLootUi === 'function') {
                itemsHost.hideGroundLootUi();
            }
        }
    }

    /**
     * Size/init the settled gore layer for this arena. Call on arena build (fresh floor).
     * Do NOT call on wave start — mess should accumulate across waves.
     */
    function initArenaGoreLayer(room) {
        if (!room || typeof resetVoxelStaticCanvas !== 'function') return;
        resetVoxelStaticCanvas(room.width || 2400, room.height || 1350);
    }

    /** If the static canvas was never sized (arena skips ENTERING_ROOM), init without wiping prior. */
    function ensureArenaGoreLayer(room) {
        if (!room || typeof resetVoxelStaticCanvas !== 'function') return;
        const canvas = (typeof VoxelStaticCanvas !== 'undefined') ? VoxelStaticCanvas : null;
        const needsInit = !canvas || !canvas.ctx || !canvas.canvas || canvas.canvas.width <= 0;
        if (needsInit) {
            resetVoxelStaticCanvas(room.width || 2400, room.height || 1350);
        }
    }

    function beginWaveDirector(world, wave, options) {
        if (typeof WaveDirector !== 'undefined' && WaveDirector.attachDirector) {
            return WaveDirector.attachDirector(world, wave, options);
        }
        return null;
    }

    function stopWaveDirector(world) {
        if (typeof WaveDirector !== 'undefined' && WaveDirector.stopDirector) {
            WaveDirector.stopDirector(world);
        }
    }

    /**
     * Build the persistent arena once (unique seed + stadium layout).
     * Enemies are NOT dumped — WaveDirector trickles a spawn budget from Modes.
     * @param {object} world
     * @param {number} waveNum
     * @param {{ spawnBudget?: number, allowedEnemyTiers?: string[] }} [options]
     */
    function buildArena(world, waveNum, options) {
        const opts = options || {};
        const w = resolveWorld(world);
        const wave = Math.max(1, waveNum || 1);
        if (w) {
            w.waveNumber = wave;
            w.roomNumber = wave;
            w.arenaPhase = 'combat';
            w.arenaWavePhase = 'horde';
            w.enteringSafeRoom = false;
        }

        const runSeed = (w && w.runSeed) ? String(w.runSeed) : (`arena-${Date.now()}`);
        if (w && !w.runSeed) w.runSeed = runSeed;

        if (typeof releaseRoomRenderCaches === 'function') {
            const oldRoom = (typeof currentRoom !== 'undefined' ? currentRoom : null) || (w && w.currentRoom) || null;
            if (oldRoom) {
                try { releaseRoomRenderCaches(oldRoom); } catch (_) {}
            }
        }

        if (typeof GameArenaLayout === 'undefined' || !GameArenaLayout.generate) {
            console.error('[GameArena] GameArenaLayout.generate missing');
            return null;
        }

        const biomeId = GameArenaLayout.pickBiomeId(runSeed);
        const topologyId = GameArenaLayout.pickTopologyId(runSeed, biomeId);
        const generated = GameArenaLayout.generate({
            seed: runSeed,
            biomeId,
            topologyId,
            roomNumber: wave,
            width: 3000,
            height: 1700
        });

        const room = (typeof Room !== 'undefined') ? new Room(wave) : {
            number: wave,
            enemies: [],
            type: 'normal',
            cleared: false,
            doorOpen: false
        };
        room.number = wave;
        room.type = 'normal';
        room.seed = generated.layout.seed;
        room.runSeed = runSeed;
        room.biomeId = generated.biomeId;
        room.bossTheme = generated.biomeId;
        room.layout = generated.layout;
        room.width = generated.layout.width;
        room.height = generated.layout.height;
        room.walkableGrid = generated.layout.grid;
        room.obstacles = generated.layout.obstacles || [];
        room.spawnZones = [generated.layout.spawnZone];
        room.exitZones = [generated.layout.exitZone];
        room.visualMotifs = generated.layout.visualMotifs || [];
        room.paths = generated.layout.paths || [];
        room.landmarks = generated.layout.landmarks || [];
        room.decorationSeed = generated.layout.decorationSeed;
        room.decorationProfile = generated.layout.decorationProfile;
        room.archetype = 'surgeArena';
        room.layoutHash = generated.layout.hash;
        room.topologyId = generated.topologyId;
        room.enemies = [];
        room.cleared = false;
        room.rewardsGranted = false;
        room._clearEventEmitted = false;
        room.doorOpen = false;

        attachArenaFixtures(room, generated.anchors);
        setMachinesAccessible(room, false);
        setPylonActive(room, false);
        clearCombatants(w, room);

        if (typeof setCurrentRoom === 'function') {
            setCurrentRoom(room);
        } else if (typeof window !== 'undefined') {
            window.currentRoom = room;
        }

        initArenaGoreLayer(room);
        if (typeof prepareRoomRenderCaches === 'function') {
            try { prepareRoomRenderCaches(room, wave); } catch (_) { /* ignore */ }
        } else if (typeof prepareRoomRenderData === 'function') {
            try { prepareRoomRenderData(room, wave); } catch (_) { /* ignore */ }
        }

        if (w) {
            w.enemies = [];
            w.arenaBiomeId = generated.biomeId;
            w.arenaTopologyId = generated.topologyId;
            if (w.player && typeof w.getRoomSpawnPoint === 'function') {
                const spawn = w.getRoomSpawnPoint(room, 0);
                if (spawn) {
                    w.player.x = spawn.x;
                    w.player.y = spawn.y;
                }
            } else if (w.player && room.layout && room.layout.spawnZone) {
                w.player.x = room.layout.spawnZone.x;
                w.player.y = room.layout.spawnZone.y;
            }
            if (typeof w.syncInSafeRoomFromCurrentRoom === 'function') {
                w.syncInSafeRoomFromCurrentRoom(room);
            }
        }

        beginWaveDirector(w, wave, opts);
        return room;
    }

    /**
     * Start a wave: reset combatants and attach a spawn-budget director.
     * Does not regenerate layout or warp the player.
     * @param {object} world
     * @param {number} waveNum
     * @param {{ lockMachines?: boolean, spawnBudget?: number, allowedEnemyTiers?: string[] }} [options]
     */
    function spawnWave(world, waveNum, options) {
        const opts = options || {};
        const w = resolveWorld(world);
        const room = resolveRoom(w);
        if (!room) return false;

        const wave = Math.max(1, waveNum || 1);
        if (w) {
            w.waveNumber = wave;
            w.roomNumber = wave;
            w.arenaPhase = 'combat';
            w.arenaWavePhase = 'horde';
            w.itemsDroppedThisRoom = 0;
        }

        clearCombatants(w, room);
        // Preserve fight mess across waves; only init if canvas was never sized.
        ensureArenaGoreLayer(room);
        setPylonActive(room, false);
        if (opts.lockMachines !== false) {
            setMachinesAccessible(room, false);
        }

        // Reset machine upgrade / reroll transaction flags for the new wave
        if (typeof clearAllGearRarityVisitFlags === 'function') {
            clearAllGearRarityVisitFlags();
        } else if (typeof window !== 'undefined' && typeof window.clearAllGearRarityVisitFlags === 'function') {
            window.clearAllGearRarityVisitFlags();
        }
        if (typeof LedgerManager !== 'undefined' && LedgerManager.getRunState) {
            const rs = LedgerManager.getRunState();
            if (rs) {
                rs.sameSlotRerolls = {};
                rs.maxSameSlotRerolls = 0;
            }
        }

        room.number = wave;
        room.cleared = false;
        room.rewardsGranted = false;
        room._clearEventEmitted = false;
        room.doorOpen = false;
        room.type = 'normal';

        if (w) w.enemies = [];
        beginWaveDirector(w, wave, opts);
        return true;
    }

    function spawnHardBossPhase(world, waveNum) {
        const w = resolveWorld(world);
        const room = resolveRoom(w);
        if (!room) return false;
        const wave = Math.max(1, waveNum || (w && w.waveNumber) || 1);
        stopWaveDirector(w);

        const count = getArenaBossCount(wave);
        const picks = pickArenaBosses(wave, count);
        const layout = room.layout;
        const floor = room.arenaFloor || {
            x: (room.width || 1280) * 0.5,
            y: (room.height || 720) * 0.58
        };

        const spawnedPoints = [];

        picks.forEach((entry, i) => {
            let x = floor.x + (i - (picks.length - 1) / 2) * 140;
            let y = floor.y - 60 + ((i % 2 === 0) ? -30 : 30);
            if (layout && typeof RoomLayoutGenerator !== 'undefined'
                && RoomLayoutGenerator.findSafeSpawnPoint) {
                const avoid = spawnedPoints.slice();
                if (room.machineBay && !room.machinesAccessible) {
                    const b = room.machineBay;
                    avoid.push({
                        x: b.x + b.w * 0.5,
                        y: b.y + b.h * 0.5,
                        distance: Math.hypot(b.w * 0.5, b.h * 0.5) + 80
                    });
                }
                const pt = RoomLayoutGenerator.findSafeSpawnPoint(layout, {
                    radius: 100,
                    margin: 120,
                    maxAttempts: 80,
                    minDistanceFrom: avoid
                });
                if (pt) {
                    x = pt.x;
                    y = pt.y;
                }
            }
            spawnedPoints.push({ x, y, distance: 150 });

            const boss = constructBoss(entry, x, y, wave, picks.length);
            if (boss) {
                room.enemies.push(boss);
            }
        });

        if (w) {
            w.enemies = (room.enemies || []).slice();
            w.arenaWavePhase = 'boss';
            w.arenaPhase = 'combat';
        }
        room.cleared = false;
        room.rewardsGranted = false;
        room._clearEventEmitted = false;
        return true;
    }

    function enterWaitingForTrigger(world, options) {
        const opts = options || {};
        const w = resolveWorld(world);
        const room = resolveRoom(w);
        stopWaveDirector(w);
        if (w) w.arenaPhase = 'waiting';
        if (room) {
            setPylonActive(room, true);
            if (opts.unlockMachines) {
                setMachinesAccessible(room, true);
            }
        }
    }

    /**
     * Called when player activates the central pylon during WFT.
     * @param {object} world
     * @param {{ spawnBudget?: number, allowedEnemyTiers?: string[] }} [plan]
     */
    function triggerNextWave(world, plan) {
        const w = resolveWorld(world);
        const room = resolveRoom(w);
        if (!w || !room || !room.wavePylon || !room.wavePylon.active) return false;
        if (w.arenaPhase !== 'waiting') return false;

        const isMp = w.multiplayerEnabled || w.localSplitEnabled;
        if (isMp) {
            const pylon = room.wavePylon;
            const players = [];
            if (w.player && w.player.alive && w.player.hp > 0) players.push(w.player);
            if (w.remotePlayerInstances) {
                w.remotePlayerInstances.forEach(p => {
                    if (p && p.alive && p.hp > 0) players.push(p);
                });
            }
            const allInside = players.every(p => {
                const dx = pylon.x - p.x;
                const dy = pylon.y - p.y;
                return Math.sqrt(dx * dx + dy * dy) < pylon.range;
            });
            if (!allInside) {
                console.log('[Arena] Cannot trigger next wave: not all players are inside the trigger ring');
                return false;
            }
        }

        const next = Math.max(1, (w.waveNumber || 1) + 1);
        setMachinesAccessible(room, false);
        setPylonActive(room, false);
        spawnWave(w, next, Object.assign({ lockMachines: true }, plan || {}));
        return true;
    }

    /**
     * Handle rooms:cleared during an arena combat wave.
     * @returns {'waiting'|'boss'|'ignore'}
     */
    function onWaveCleared(world) {
        const w = resolveWorld(world);
        if (!w || w.arenaPhase !== 'combat') return 'ignore';
        const wave = w.waveNumber || 1;

        if (isHardWave(wave) && w.arenaWavePhase === 'horde') {
            spawnHardBossPhase(w, wave);
            return 'boss';
        }

        const unlock = isHardWave(wave);
        enterWaitingForTrigger(w, { unlockMachines: unlock });
        return 'waiting';
    }

    root.GameArena = {
        MACHINE_GATE_ID,
        ARENA_BOSS_POOL,
        isHardWave,
        isDoubleBossWave,
        getArenaBossCount,
        arenaBossScalingRoom,
        arenaBossHpMult,
        arenaBossDamageMult,
        pickArenaBosses,
        decorateArenaLayout,
        attachArenaFixtures,
        setMachinesAccessible,
        setMachineBayVolumeLocked,
        pointInMachineBay,
        setPylonActive,
        displaceLootFromWavePad,
        clearGroundLoot,
        initArenaGoreLayer,
        ensureArenaGoreLayer,
        initArenaRoom: buildArena,
        buildArena,
        spawnWave,
        spawnHardBossPhase,
        enterWaitingForTrigger,
        triggerNextWave,
        onWaveCleared
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.GameArena;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

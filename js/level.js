// Level/room system

// Room class
class Room {
    constructor(number) {
        this.number = number;
        this.type = 'normal'; // normal, arena, boss
        // New larger room size: 2400x1350 (87.5% larger than original 1280x720)
        this.width = 2400;
        this.height = 1350;
        this.seed = null;
        this.biomeId = null;
        this.bossTheme = null;
        this.layoutVersion = null;
        this.layoutHash = null;
        this.layout = null;
        this.walkableGrid = null;
        this.obstacles = [];
        this.spawnZones = [];
        this.exitZones = [];
        this.visualMotifs = [];
        this.paths = [];
        this.landmarks = [];
        this.encounterZones = [];
        this.decorationSeed = null;
        this.decorationProfile = null;
        this.archetype = null;
        this.entranceVariant = null;
        this.enemies = [];
        this.loot = [];
        this.cleared = false;
        this.doorOpen = false;
    }
}

// Current room instance
let currentRoom = null;

// Helper function to sync currentRoom to window
function syncCurrentRoomToWindow() {
    window.currentRoom = currentRoom;
}

// Expose globally for DOM components
syncCurrentRoomToWindow();

// Initialize current room
function initializeRoom(roomNumber = 1) {
    currentRoom = new Room(roomNumber);
    syncCurrentRoomToWindow();
    return currentRoom;
}

function applyGeneratedLayoutToRoom(room, roomType) {
    if (!room || typeof RoomLayoutGenerator === 'undefined' || !RoomLayoutGenerator) {
        return room;
    }

    const gameMode = (typeof Game !== 'undefined' && Game.gameMode) ? Game.gameMode : 'gear';
    const plan = RoomLayoutGenerator.buildRoomPlan(room.number, gameMode, roomType || room.type, {});
    const seed = `${gameMode}:${room.number}:${plan.roomType}:${plan.biomeId}:v${plan.layoutVersion}`;
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, seed);

    room.seed = layout.seed;
    room.biomeId = layout.biomeId;
    room.bossTheme = layout.bossTheme;
    room.layoutVersion = layout.layoutVersion;
    room.layoutHash = layout.hash;
    room.layout = layout;
    room.width = layout.width;
    room.height = layout.height;
    room.walkableGrid = layout.grid;
    room.obstacles = layout.obstacles || [];
    room.spawnZones = [layout.spawnZone];
    room.exitZones = [layout.exitZone];
    room.visualMotifs = layout.visualMotifs || [];
    room.paths = layout.paths || [];
    room.landmarks = layout.landmarks || [];
    room.encounterZones = layout.encounterZones || [];
    room.decorationSeed = layout.decorationSeed || null;
    room.decorationProfile = layout.decorationProfile || null;
    room.archetype = layout.archetype || null;
    room.entranceVariant = layout.entranceVariant || null;

    return room;
}

// Get multiplayer scaling multipliers based on player count
// Returns { enemyCount, enemyHP, enemyDamage, bossHP, bossDamage }
function getMultiplayerScaling() {
    return CombatScaling.getMultiplayerScaling();
}

// Generate room with enemies
function generateRoom(roomNumber) {
    const room = new Room(roomNumber);

    // Room 0: purpose-built empty tutorial arena (not a standard generated room)
    if (roomNumber === 0) {
        room.type = 'tutorial';
        if (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.setupRoom) {
            Room0Tutorial.setupRoom(room);
        } else {
            room.width = 1280;
            room.height = 720;
            room.enemies = [];
            room.cleared = false;
            room.doorOpen = false;
        }
        return room;
    }

    // Gear mode room type: Safe Room transition, else boss every 10 rooms
    let roomType = 'normal';
    if (typeof Game !== 'undefined' && Game.enteringSafeRoom) {
        roomType = 'safe';
    } else if (roomNumber >= 10 && roomNumber % 10 === 0) {
        roomType = 'boss';
    }

    room.type = roomType;
    applyGeneratedLayoutToRoom(room, roomType);

    // Spawn pre-boss healer near the exit in rooms preceding a boss (9, 19, 29…).
    // Hidden/unusable until the room is cleared and the boss door opens (see doorOpen gates).
    if ((roomNumber + 1) % 10 === 0 && roomType !== 'safe' && roomType !== 'boss') {
        const door = getRoomDoorPosition(room);
        room.preBossHealer = {
            x: door.x - 90,
            y: door.y - 45,
            range: 60,
            used: false,
            name: "Pre-Boss Healer",
            icon: "💚"
        };
    }

    // Handle boss room generation
    if (roomType === 'boss') {
        const boss = generateBoss(roomNumber);
        room.enemies.push(boss);
        return room;
    }

    // Safe rooms have no enemies - mark as cleared immediately
    if (roomType === 'safe') {
        room.cleared = true;
        room.doorOpen = true;
        room.rewardsGranted = false;
        return room;
    }

    const enemyHpMod = 1.0;
    const enemySpeedMod = 1.0;
    const gameMode = (typeof Game !== 'undefined' && Game.gameMode) ? Game.gameMode : 'gear';
    const scalingCtx = CombatScaling.createContext({
        roomNumber,
        roomType,
        gameMode,
        enemyHpMod,
        enemySpeedMod
    });
    const scalingFactors = CombatScaling.computeScalingFactors(scalingCtx);
    scalingCtx._factors = scalingFactors;

    const mpScaling = getMultiplayerScaling();
    const enemyCount = scalingFactors.enemyCount;

    if (mpScaling.enemyCount > 1.0 || roomNumber > CombatScaling.ENEMY_COUNT_CAP_ROOM) {
        console.log(`[Room ${roomNumber}] Count: ${enemyCount} enemies (${mpScaling.enemyCount}x MP), HP Scale: ${scalingFactors ? scalingFactors.roomHp.toFixed(2) : '?'}x, Damage Scale: ${scalingFactors ? scalingFactors.roomDamage.toFixed(2) : '?'}x, MP HP: ${mpScaling.enemyHP}x, MP Damage: ${mpScaling.enemyDamage}x`);
    }

    // Spawn enemies with buffer from player spawn area
    const margin = 50;

    // Define spawn safety zone (left side where player enters at room center vertically)
    const spawnZone = room.layout && room.layout.spawnZone ? room.layout.spawnZone : { x: 50, y: room.height / 2, radius: 300 };
    const spawnZoneX = spawnZone.x;
    const spawnZoneY = spawnZone.y;
    const spawnZoneRadius = spawnZone.radius || 300;

    const useRouteSpawn = roomType === 'normal' &&
        room.layout &&
        typeof RoomLayoutGenerator !== 'undefined' &&
        typeof RoomLayoutGenerator.buildRouteSpawnGroups === 'function';

    const spawnProtectionDistance = (useRouteSpawn &&
        typeof RoomLayoutGenerator.getPlayerSpawnProtectionDistance === 'function')
        ? RoomLayoutGenerator.getPlayerSpawnProtectionDistance(room.layout)
        : spawnZoneRadius + 420;

    let enemyGroups = [];
    let groupSizes = [];
    let mainRoad = null;

    if (useRouteSpawn) {
        mainRoad = RoomLayoutGenerator.getMainRoadPath(room.layout);
        const routeGroups = RoomLayoutGenerator.buildRouteSpawnGroups(room.layout, enemyCount, {
            minDistFromSpawn: spawnProtectionDistance,
            minGroupSeparation: 220
        });
        if (routeGroups && routeGroups.length) {
            enemyGroups = routeGroups;
            groupSizes = routeGroups.map(group => group.size);
            console.log(`[Room ${roomNumber}] Route spawn: ${enemyCount} enemies in ${routeGroups.length} pockets (${routeGroups.filter(g => g.isOffshoot).length} offshoots)`);
        }
    }

    if (!enemyGroups.length) {
        const avgEnemiesPerGroup = 3.5;
        const numGroups = Math.max(1, Math.ceil(enemyCount / avgEnemiesPerGroup));
        const baseGroupSize = Math.floor(enemyCount / numGroups);
        const remainder = enemyCount % numGroups;

        for (let g = 0; g < numGroups; g++) {
            groupSizes.push(g < remainder ? baseGroupSize + 1 : baseGroupSize);
        }

        console.log(`[Room ${roomNumber}] Spawning ${enemyCount} enemies in ${numGroups} groups:`, groupSizes);

        for (let g = 0; g < numGroups; g++) {
            let groupX, groupY;
            let attempts = 0;
            let validPosition = false;

            const minDistanceFrom = [
                { x: spawnZoneX, y: spawnZoneY, distance: spawnProtectionDistance },
                ...enemyGroups.map(other => ({ x: other.x, y: other.y, distance: 300 }))
            ];

            if (room.layout && typeof RoomLayoutGenerator !== 'undefined') {
                const point = RoomLayoutGenerator.findSafeSpawnPoint(room.layout, {
                    radius: 80,
                    margin: margin + 200,
                    minDistanceFrom,
                    maxAttempts: 160
                });
                if (point) {
                    groupX = point.x;
                    groupY = point.y;
                    validPosition = true;
                }
            }

            while (!validPosition && attempts < 100) {
                groupX = random(margin + 200, room.width - margin - 200);
                groupY = random(margin + 200, room.height - margin - 200);

                const dx = groupX - spawnZoneX;
                const dy = groupY - spawnZoneY;
                const distFromSpawn = Math.sqrt(dx * dx + dy * dy);

                let farFromOtherGroups = true;
                for (let other of enemyGroups) {
                    const odx = groupX - other.x;
                    const ody = groupY - other.y;
                    if (Math.sqrt(odx * odx + ody * ody) < 300) {
                        farFromOtherGroups = false;
                        break;
                    }
                }

                const walkable = !room.layout || typeof RoomLayoutGenerator === 'undefined' ||
                    RoomLayoutGenerator.isPointWalkable(room.layout, groupX, groupY, 80);
                if (distFromSpawn >= spawnProtectionDistance && farFromOtherGroups && walkable) {
                    validPosition = true;
                }
                attempts++;
            }

            enemyGroups.push({ x: groupX, y: groupY, spreadAlongPath: false });
        }
    }

    // Spawn enemies in groups distributed along the route (or legacy arena clusters)
    let enemyIndex = 0;
    for (let groupIndex = 0; groupIndex < enemyGroups.length; groupIndex++) {
        const group = enemyGroups[groupIndex];
        const groupSize = group.size != null ? group.size : groupSizes[groupIndex];

        for (let i = 0; i < groupSize; i++) {
            let x, y;
            let validPosition = false;

            if (useRouteSpawn && mainRoad && typeof RoomLayoutGenerator.scatterEnemyInGroup === 'function') {
                const point = RoomLayoutGenerator.scatterEnemyInGroup(
                    room.layout,
                    group,
                    i,
                    groupSize,
                    mainRoad,
                    { margin }
                );
                x = point.x;
                y = point.y;
                validPosition = RoomLayoutGenerator.isPointWalkable(room.layout, x, y, 30) &&
                    !(typeof RoomLayoutGenerator.isInsidePlayerSpawnProtection === 'function' &&
                        RoomLayoutGenerator.isInsidePlayerSpawnProtection(room.layout, x, y, 0));
            }

            let attempts = 0;
            while (!validPosition && attempts < 100) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * 100;
                x = group.x + Math.cos(angle) * distance;
                y = group.y + Math.sin(angle) * distance;

                x = Math.max(margin, Math.min(room.width - margin, x));
                y = Math.max(margin, Math.min(room.height - margin, y));

                const walkable = !room.layout || typeof RoomLayoutGenerator === 'undefined' ||
                    RoomLayoutGenerator.isPointWalkable(room.layout, x, y, 30);
                const inSpawnSafe = room.layout &&
                    typeof RoomLayoutGenerator.isInsidePlayerSpawnProtection === 'function' &&
                    RoomLayoutGenerator.isInsidePlayerSpawnProtection(room.layout, x, y, 0);
                validPosition = walkable && !inSpawnSafe;
                attempts++;
            }

            if (!validPosition && room.layout && typeof RoomLayoutGenerator !== 'undefined') {
                const point = RoomLayoutGenerator.findSafeSpawnPoint(room.layout, {
                    radius: 30,
                    margin,
                    minDistanceFrom: [{ x: spawnZoneX, y: spawnZoneY, distance: spawnProtectionDistance }],
                    maxAttempts: 120
                });
                if (point) {
                    x = point.x;
                    y = point.y;
                }
            }

            // Choose enemy type based on room number
            let enemy;
            const rand = Math.random();

            if (roomNumber < 3) {
                enemy = new Enemy(x, y);
            } else if (roomNumber < 5) {
                if (rand < 0.6) {
                    enemy = new Enemy(x, y);
                } else {
                    enemy = new StarEnemy(x, y);
                }
            } else if (roomNumber < 7) {
                if (rand < 0.35) {
                    enemy = new Enemy(x, y);
                } else if (rand < 0.7) {
                    enemy = new StarEnemy(x, y);
                } else {
                    enemy = new DiamondEnemy(x, y);
                }
            } else if (roomNumber < 9) {
                if (rand < 0.25) {
                    enemy = new Enemy(x, y);
                } else if (rand < 0.5) {
                    enemy = new StarEnemy(x, y);
                } else if (rand < 0.75) {
                    enemy = new DiamondEnemy(x, y);
                } else {
                    enemy = new RectangleEnemy(x, y);
                }
            } else {
                const octagonChance = 0.05;
                if (rand < octagonChance) {
                    enemy = new OctagonEnemy(x, y);
                } else if (rand < octagonChance + 0.25) {
                    enemy = new Enemy(x, y);
                } else if (rand < octagonChance + 0.50) {
                    enemy = new StarEnemy(x, y);
                } else if (rand < octagonChance + 0.75) {
                    enemy = new DiamondEnemy(x, y);
                } else {
                    enemy = new RectangleEnemy(x, y);
                }
            }

            CombatScaling.applyEnemyScaling(
                enemy,
                CombatScaling.getEnemyProfileIdForInstance(enemy),
                scalingCtx
            );

            const biomeId = room.biomeId
                || (typeof BiomeConfig !== 'undefined' && BiomeConfig.getBiomeIdForRoom
                    ? BiomeConfig.getBiomeIdForRoom(roomNumber, 'gear')
                    : 'swarm');

            if (typeof BiomeEnemyMods !== 'undefined' && BiomeEnemyMods.apply) {
                BiomeEnemyMods.apply(enemy, biomeId);
            }
            if (typeof EliteEnemyAffixes !== 'undefined' && EliteEnemyAffixes.applyEliteAffix) {
                EliteEnemyAffixes.applyEliteAffix(enemy, biomeId, roomNumber);
            }

            if (enemy.hasShield) {
                enemy.maxShieldHealth = Math.floor(enemy.maxHp * 0.5);
                enemy.shieldHealth = enemy.maxShieldHealth;
            }

            // Set initial state to standby (will activate when player gets close)
            enemy.state = 'standby';
            enemy.detectionRange = 800; // Activate when player within ~camera view distance
            enemy.activated = false; // Track if enemy has ever been activated

            room.enemies.push(enemy);
            enemyIndex++;
        }
    }

    // Boss elite enemy system after canonical gear run (room 50): mid-cycle spice
    // Full boss rooms continue at 60, 70, …; elites fill 55, 65, 75, …
    if (roomNumber > 50 && roomType === 'normal') {
        let bossesToSpawn = 0;
        
        // Guaranteed elite boss midway between boss rooms (55, 65, 75, …)
        if (roomNumber % 10 === 5) {
            // After room 80, guarantee 2 elites; rooms 55-75 guarantee 1
            const guaranteedCount = roomNumber > 80 ? 2 : 1;
            bossesToSpawn = guaranteedCount;
            console.log(`[Room ${roomNumber}] Guaranteed ${guaranteedCount} boss(es) as elite enemies`);
        } else {
            // For non-guaranteed rooms, apply random boss spawn chance
            const roomsPast50 = roomNumber - 50;
            const baseBossChance = 0.05; // 5% just after canonical end
            const chancePerRoom = 0.005; // +0.5% per room
            const randomBossChance = baseBossChance + (roomsPast50 * chancePerRoom);
            
            if (Math.random() < randomBossChance) {
                bossesToSpawn = 1;
                
                // Chance for a second random elite as rooms climb past canonical end
                const baseDoubleChance = 0.10;
                const doubleChancePerRoom = 0.005;
                const doubleBossChance = baseDoubleChance + (roomsPast50 * doubleChancePerRoom);
                
                if (Math.random() < doubleBossChance) {
                    bossesToSpawn = 2;
                }
            }
        }
        
        // Spawn bosses at random positions (avoiding player spawn area and other bosses)
        const bossMargin = 200;
        const minBossDistance = 400; // Minimum distance between bosses
        const spawnedBossPositions = []; // Track boss positions to avoid overlap
        
        for (let i = 0; i < bossesToSpawn; i++) {
            let bossX, bossY;
            let attempts = 0;
            let validPosition = false;
            if (room.layout && typeof RoomLayoutGenerator !== 'undefined') {
                const point = RoomLayoutGenerator.findSafeSpawnPoint(room.layout, {
                    radius: 120,
                    margin: bossMargin,
                    minDistanceFrom: [
                        { x: spawnZoneX, y: spawnZoneY, distance: spawnZoneRadius + 200 },
                        ...spawnedBossPositions.map(pos => ({ x: pos.x, y: pos.y, distance: minBossDistance }))
                    ],
                    maxAttempts: 160
                });
                if (point) {
                    bossX = point.x;
                    bossY = point.y;
                    validPosition = true;
                }
            }
            
            while (!validPosition && attempts < 100) {
                bossX = random(bossMargin, room.width - bossMargin);
                bossY = random(bossMargin, room.height - bossMargin);
                
                // Check distance from spawn zone
                const dx = bossX - spawnZoneX;
                const dy = bossY - spawnZoneY;
                const distFromSpawn = Math.sqrt(dx * dx + dy * dy);
                
                // Check distance from other already-spawned bosses
                let farFromOtherBosses = true;
                for (const pos of spawnedBossPositions) {
                    const distDx = bossX - pos.x;
                    const distDy = bossY - pos.y;
                    const dist = Math.sqrt(distDx * distDx + distDy * distDy);
                    if (dist < minBossDistance) {
                        farFromOtherBosses = false;
                        break;
                    }
                }
                
                const walkable = !room.layout || typeof RoomLayoutGenerator === 'undefined' ||
                    RoomLayoutGenerator.isPointWalkable(room.layout, bossX, bossY, 120);

                // Ensure boss is far from spawn zone, other bosses, and static scenery
                if (distFromSpawn >= spawnZoneRadius + 200 && farFromOtherBosses && walkable) {
                    validPosition = true;
                }
                attempts++;
            }
            
            if (validPosition) {
                const boss = spawnBossAsElite(bossX, bossY, roomNumber);
                if (boss) {
                    // Store position to avoid overlap with future bosses
                    spawnedBossPositions.push({ x: bossX, y: bossY });
                    
                    // Elite bosses should activate immediately since they don't use normal activation checks
                    // Assign a target immediately so they start active
                    const allPlayers = boss.getAllAlivePlayers();
                    if (allPlayers.length > 0) {
                        const alivePlayers = allPlayers.filter(p => p.player && p.player.alive !== false);
                        if (alivePlayers.length > 0) {
                            // Pick a random alive player as target for this boss
                            const randomIndex = Math.floor(Math.random() * alivePlayers.length);
                            boss.currentTarget = alivePlayers[randomIndex].id;
                        }
                    }
                    
                    // Set state to active
                    boss.state = 'chase';
                    boss.activated = true;
                    
                    // Give each boss a unique ID to prevent conflicts
                    if (!boss.id) {
                        boss.id = `boss_${roomNumber}_${i}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    }
                    
                    // Mark that this boss is an elite enemy (not in a boss room)
                    boss.isEliteEnemy = true;
                    
                    room.enemies.push(boss);
                    console.log(`[Room ${roomNumber}] Spawned elite boss: ${boss.bossName || 'Unknown'} at (${bossX.toFixed(0)}, ${bossY.toFixed(0)}) - Total bosses: ${spawnedBossPositions.length}`);
                }
            } else {
                console.warn(`[Room ${roomNumber}] Failed to find valid position for boss ${i + 1}/${bossesToSpawn} after ${attempts} attempts`);
            }
        }
        
        if (bossesToSpawn > 0) {
            console.log(`[Room ${roomNumber}] Total elite bosses spawned: ${spawnedBossPositions.length}/${bossesToSpawn}`);
        }
    }

    return room;
}

// Check if room is cleared
function checkRoomCleared() {
    if (!currentRoom) return false;

    // For safe rooms (no enemies), check if already cleared but rewards not granted yet
    const isSafeRoom = currentRoom.type === 'safe';
    const aliveEnemies = currentRoom.enemies.filter(e => e.alive).length;
    const hasNoEnemies = aliveEnemies === 0;

    // Check if room should be marked as cleared (no enemies)
    if (hasNoEnemies && !currentRoom.cleared) {
        // Normal room with no enemies (or rest/treasure room that was just cleared)
        currentRoom.cleared = true;
        // Play door open sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.doorOpen();
        }

        currentRoom.doorOpen = true;
    }

    // Process rewards and special effects if room is cleared and rewards haven't been granted yet
    // This handles both safe rooms (pre-marked as cleared) and normal rooms (just cleared)
    if (currentRoom.cleared && !currentRoom.rewardsGranted) {
        // Tutorial room: open door only - no credits/shards/XP/loot/milestones
        if (currentRoom.type === 'tutorial' || currentRoom.number === 0) {
            currentRoom.rewardsGranted = true;
            return true;
        }

        // Safe room soft landing before machine interactions
        // Resume from checkpoint skips this so snapshot HP wins.
        if (currentRoom.type === 'safe') {
            if (typeof Game !== 'undefined' && Game.resumeSkipSafeSoftHeal) {
                Game.resumeSkipSafeSoftHeal = false;
            } else if (typeof Game !== 'undefined' && Game.player) {
                const maxHp = Game.player.maxHp || 100;
                const healAmount = Math.floor(maxHp * 0.5);
                Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + healAmount);
                console.log(`[Room Clear] safe room: Restored 50% HP (${healAmount})`);
            }
        }

        if (currentRoom.type === 'boss' && typeof MusicManager !== 'undefined' && MusicManager.currentCategory === 'boss') {
            MusicManager.fadeOutCurrent().catch(err => {
                console.error('[Music] Failed to fade out boss music after room clear:', err);
            });
        }

        if (typeof Telemetry !== 'undefined') {
            Telemetry.recordEvent('roomClearedSummary', {
                roomNumber: currentRoom.number,
                metadata: {
                    roomType: currentRoom.type,
                    gameMode: typeof Game !== 'undefined' && Game.gameMode ? Game.gameMode : 'gear',
                    enemiesKilled: typeof Game !== 'undefined' ? Game.enemiesKilled || 0 : 0,
                    bossesKilled: typeof Game !== 'undefined' ? Game.bossesKilled || 0 : 0,
                    itemsDroppedThisRoom: typeof Game !== 'undefined' ? Game.itemsDroppedThisRoom || 0 : 0,
                    currencyEarned: typeof Game !== 'undefined' ? Game.currencyEarned || 0 : 0,
                    shardsEarned: typeof Game !== 'undefined' ? Game.shardsEarned || 0 : 0
                }
            });
            const participants = typeof Game !== 'undefined' && Game && Game.collectTelemetryParticipants
                ? Game.collectTelemetryParticipants(true)
                : [];
            Telemetry.recordRoomCleared(currentRoom.number, participants);
        }

        // Persist highest room cleared for nexus machine gates
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        if (!isClient && typeof SaveSystem !== 'undefined' && SaveSystem.recordRoomCleared) {
            const roomNum = currentRoom.number || (typeof Game !== 'undefined' ? Game.roomNumber : 0);
            SaveSystem.recordRoomCleared(roomNum);
        }

        if (typeof window.updateLifetimeStats === 'function') {
            window.updateLifetimeStats({ totalRoomsCleared: 1 });
        }

        currentRoom.rewardsGranted = true;

        if (typeof Game !== 'undefined' &&
            Game &&
            typeof Game.reviveDeadPlayers === 'function' &&
            typeof Game.isHost === 'function' &&
            Game.multiplayerEnabled &&
            Game.isHost()) {
            if (Game.lastRoomClearReviveRoomNumber !== currentRoom.number) {
                Game.reviveDeadPlayers({
                    reason: 'room_clear',
                    broadcast: true,
                    respawnStrategy: 'safe'
                });
                Game.lastRoomClearReviveRoomNumber = currentRoom.number;
            }
        }
    }

    return currentRoom.cleared;
}

// Get door position and size for collision
function getDoorPosition() {
    // Use current room dimensions if available, otherwise use default
    const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
    const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
    const exitZone = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.layout && currentRoom.layout.exitZone)
        ? currentRoom.layout.exitZone
        : null;
    if (exitZone) {
        return {
            x: exitZone.x - 25,
            y: exitZone.y - 50,
            width: 50,
            height: 100
        };
    }
    return {
        x: roomWidth - 100,
        y: roomHeight / 2 - 50,
        width: 50,
        height: 100
    };
}

// Boss tracking system - track which bosses have been encountered
// Initialize encounteredBosses in Game object if not already present
if (typeof Game !== 'undefined' && !Game.encounteredBosses) {
    Game.encounteredBosses = {};
}

// Get available boss types for random selection (excluding Fortress if already encountered)
function getAvailableBossTypes(roomNumber) {
    const availableBosses = [
        { name: 'Swarm King', constructor: BossSwarmKing },
        { name: 'Twin Prism', constructor: BossTwinPrism },
        { name: 'Fractal Core', constructor: BossFractalCore },
        { name: 'Vortex', constructor: BossVortex }
    ];
    
    // Exclude Fortress if it has already been encountered
    if (typeof Game !== 'undefined' && Game.encounteredBosses && Game.encounteredBosses['Fortress']) {
        // Fortress already encountered, exclude it
        return availableBosses;
    }
    
    // Include Fortress if not yet encountered
    return [
        ...availableBosses,
        { name: 'Fortress', constructor: BossFortress }
    ];
}

// Select a random boss type from available bosses
function selectRandomBossType(roomNumber) {
    const availableBosses = getAvailableBossTypes(roomNumber);
    
    if (availableBosses.length === 0) {
        console.warn('No available bosses - using Swarm King as fallback');
        return { name: 'Swarm King', constructor: BossSwarmKing };
    }
    
    const randomIndex = Math.floor(Math.random() * availableBosses.length);
    return availableBosses[randomIndex];
}

// Generate boss based on room number
function generateBoss(roomNumber) {
    // Boss spawns at center of room (use new room size)
    const roomWidth = 2400;
    const roomHeight = 1350;
    const spawnX = roomWidth / 2; // 1200
    const spawnY = roomHeight / 2; // 675

    // Get multiplayer scaling multipliers
    const mpScaling = getMultiplayerScaling();

    let boss = null;

    // Play boss spawn sound
    if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
        AudioManager.sounds.bossSpawn();
    }

    // Determine which boss to spawn based on room number and game mode
    const gameMode = (typeof Game !== 'undefined' && Game.gameMode) ? Game.gameMode : 'cards';

    // Note: Random boss selection for elite enemies is handled by spawnBossAsElite()
    // This function still uses normal boss selection logic for boss rooms
    if (gameMode === 'gear') {
        // Gear mode: bosses at room 10, 20, 30, 40, 50, etc.
        // Cycle through bosses: Swarm King, Twin Prism, Fortress, Fractal Core, Vortex
        // Formula: (roomNumber - 10) / 10 gives boss index (0, 1, 2, 3, 4, ...)
        const bossInterval = (typeof CombatScaling !== 'undefined' && CombatScaling.GEAR_BOSS_INTERVAL)
            ? CombatScaling.GEAR_BOSS_INTERVAL
            : 10;
        const bossIndex = Math.floor((roomNumber - 10) / bossInterval) % 5;

        if (bossIndex === 0) {
            // Swarm King
            boss = new BossSwarmKing(spawnX, spawnY);
        } else if (bossIndex === 1) {
            // Twin Prism
            boss = new BossTwinPrism(spawnX, spawnY);
        } else if (bossIndex === 2) {
            // Fortress
            boss = new BossFortress(spawnX, spawnY);
        } else if (bossIndex === 3) {
            // Fractal Core
            boss = new BossFractalCore(spawnX, spawnY);
        } else if (bossIndex === 4) {
            // Vortex
            boss = new BossVortex(spawnX, spawnY);
        } else {
            // Fallback
            console.warn(`No boss defined for gear mode room ${roomNumber} - using placeholder`);
            boss = createPlaceholderBoss(spawnX, spawnY, `Boss ${roomNumber}`);
        }
    } else {
        // Card mode: bosses at rooms 12, 22, 32
        if (roomNumber === 12) {
            // Swarm King
            boss = new BossSwarmKing(spawnX, spawnY);
        } else if (roomNumber === 22) {
            // Fortress
            boss = new BossFortress(spawnX, spawnY);
        } else if (roomNumber === 32) {
            // Vortex
            boss = new BossVortex(spawnX, spawnY);
        } else {
            // Default fallback for future boss rooms (35, 40, etc.)
            console.warn(`No boss defined for room ${roomNumber} - using placeholder`);
            boss = createPlaceholderBoss(spawnX, spawnY, `Boss ${roomNumber}`);
        }
    }

    // Track boss appearance (especially Fortress for exclusion)
    if (boss && typeof Game !== 'undefined') {
        if (!Game.encounteredBosses) {
            Game.encounteredBosses = {};
        }
        const bossName = boss.bossName || 'Unknown';
        if (!Game.encounteredBosses[bossName]) {
            Game.encounteredBosses[bossName] = true;
            console.log(`[Boss Tracking] First encounter with ${bossName}`);
        }
    }

    // Skip intro animations for bosses after room 30
    if (boss && roomNumber > 30) {
        boss.introComplete = true;
    }

    if (boss && typeof BossScaling !== 'undefined' && BossScaling.applyBossScaling) {
        const stats = BossScaling.applyBossScaling(boss, roomNumber, {
            gameMode,
            mpScaling,
            isEliteSpawn: false
        });

        if (mpScaling.bossHP > 1.0 && stats) {
            console.log(`[Multiplayer] Boss ${boss.bossName || 'Unknown'} room ${roomNumber}: HP ${stats.maxHp} (${mpScaling.bossHP}x MP), damage ${stats.damage.toFixed(1)}`);
        }
    }

    return boss;
}

// Spawn a boss as an elite enemy (no intro, random position, proper scaling)
function spawnBossAsElite(x, y, roomNumber) {
    // Get multiplayer scaling multipliers
    const mpScaling = getMultiplayerScaling();
    
    // Select random boss type (excluding Fortress if already encountered)
    const bossType = selectRandomBossType(roomNumber);
    let boss = new bossType.constructor(x, y);
    
    // Track boss appearance (especially Fortress for exclusion)
    if (typeof Game !== 'undefined') {
        if (!Game.encounteredBosses) {
            Game.encounteredBosses = {};
        }
        const bossName = boss.bossName || 'Unknown';
        if (!Game.encounteredBosses[bossName]) {
            Game.encounteredBosses[bossName] = true;
            console.log(`[Boss Tracking] First encounter with ${bossName}`);
        }
    }
    
    // Skip intro animation - set introComplete immediately
    boss.introComplete = true;
    
    if (typeof BossScaling !== 'undefined' && BossScaling.applyBossScaling) {
        const gameMode = (typeof Game !== 'undefined' && Game.gameMode) ? Game.gameMode : 'cards';
        BossScaling.applyBossScaling(boss, roomNumber, {
            gameMode,
            mpScaling,
            isEliteSpawn: true
        });
    }

    return boss;
}

// Delegate to combat-scaling.js (single minion scaling entry point)
function scaleMinionStats(minion, healthMultiplier, damageMultiplier, xpMultiplier = null) {
    return CombatScaling.scaleMinionStats(minion, healthMultiplier, damageMultiplier, xpMultiplier);
}

// Placeholder boss class for testing (will be replaced by actual boss implementations)
function createPlaceholderBoss(x, y, name) {
    const boss = new BossBase(x, y);
    boss.bossName = name;
    boss.color = '#ff0044';

    // Basic placeholder rendering
    boss.render = function (ctx) {
        // Draw large circle as placeholder
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Draw border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw health bar
        this.renderHealthBar(ctx);

        // Draw weak points
        this.renderWeakPoints(ctx);
    };

    // Basic placeholder update
    boss.update = function (deltaTime, player) {
        if (!this.introComplete) return; // Don't update during intro

        // Check phase transitions
        this.checkPhaseTransition();

        // Update hazards
        this.updateHazards(deltaTime);

        // Update weak points
        this.updateWeakPoints(deltaTime);

        // Simple chase behavior for placeholder
        if (player && player.alive) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 100) {
                const speed = this.moveSpeed * deltaTime;
                this.x += (dx / distance) * speed * 0.3; // Slow movement
                this.y += (dy / distance) * speed * 0.3;
            }
        }

        // Keep in bounds
        this.keepInBounds();
    };

    // Add a test weak point
    boss.addWeakPoint(20, 20, 8, 0);

    return boss;
}

// Get door position specifically using layout of the room object
function getRoomDoorPosition(room) {
    if (!room) return { x: 2300, y: 625, width: 50, height: 100 };
    const roomWidth = room.width || 2400;
    const roomHeight = room.height || 1350;
    const exitZone = (room.layout && room.layout.exitZone) ? room.layout.exitZone : null;
    if (exitZone) {
        return {
            x: exitZone.x - 25,
            y: exitZone.y - 50,
            width: 50,
            height: 100
        };
    }
    return {
        x: roomWidth - 100,
        y: roomHeight / 2 - 50,
        width: 50,
        height: 100
    };
}

// Retrieve or initialize Safe Room machines (Save Run booth is solo-only)
function getSafeRoomMachines(room) {
    if (!room || room.type !== 'safe') return [];
    const roomWidth = room.width || 1600;
    const roomHeight = room.height || 900;
    const isSolo = typeof Game === 'undefined' || !Game.multiplayerEnabled;

    if (!room.safeRoomMachines) {
        room.safeRoomMachines = [
            { id: 'gearUpgrade', name: 'Gear Level Up', icon: '🛠️', x: roomWidth / 2 - 150, y: roomHeight / 2, range: 60 },
            { id: 'affixReroll', name: 'Affix Reroll', icon: '🎲', x: roomWidth / 2, y: roomHeight / 2, range: 60 },
            { id: 'healMaxHp', name: 'Healer Machine', icon: '❤️', x: roomWidth / 2 + 150, y: roomHeight / 2, range: 60 }
        ];
    }

    const hasSave = room.safeRoomMachines.some(m => m.id === 'runSave');
    if (isSolo && !hasSave) {
        room.safeRoomMachines.push({
            id: 'runSave',
            name: 'Save Run',
            icon: '', // drawn as vector PS2 in main.js
            x: roomWidth / 2,
            y: roomHeight / 2 + 110,
            range: 60
        });
    } else if (!isSolo && hasSave) {
        room.safeRoomMachines = room.safeRoomMachines.filter(m => m.id !== 'runSave');
    }

    return room.safeRoomMachines;
}

// Expose globally
if (typeof window !== 'undefined') {
    window.getRoomDoorPosition = getRoomDoorPosition;
    window.getSafeRoomMachines = getSafeRoomMachines;
}



// Level/room system

// Room class
class Room {
    constructor(number) {
        this.number = number;
        this.type = 'normal'; // normal, arena, boss
        // New larger room size: 2400x1350 (87.5% larger than original 1280x720)
        this.width = 2400;
        this.height = 1350;
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

// Get multiplayer scaling multipliers based on player count
// Returns { enemyCount, enemyHP, enemyDamage, bossHP, bossDamage }
function getMultiplayerScaling() {
    // Default values for solo play
    const defaultScaling = {
        enemyCount: 1.0,
        enemyHP: 1.0,
        enemyDamage: 1.0,
        bossHP: 1.0,
        bossDamage: 1.0
    };

    // Check if multiplayer is enabled
    if (!Game.multiplayerEnabled || typeof multiplayerManager === 'undefined' || !multiplayerManager) {
        return defaultScaling;
    }

    // Get player count from lobby
    const playerCount = multiplayerManager.players ? multiplayerManager.players.length : 1;

    // Solo play - no scaling
    if (playerCount <= 1) {
        return defaultScaling;
    }

    // Multiplayer scaling based on player count
    // Designed with 1:1.1 difficulty curve (slightly harder per player than solo)
    switch (playerCount) {
        case 2:
            return {
                enemyCount: 1.5,    // +50% enemies
                enemyHP: 1.35,      // +35% HP
                enemyDamage: 1.04,  // +4% damage
                bossHP: 1.40,       // +40% boss HP
                bossDamage: 1.10    // +10% boss damage
            };

        case 3:
            return {
                enemyCount: 2.0,    // +100% enemies (2x)
                enemyHP: 1.40,      // +40% HP
                enemyDamage: 1.04,  // +4% damage
                bossHP: 1.80,       // +80% boss HP
                bossDamage: 1.15    // +15% boss damage
            };

        case 4:
            return {
                enemyCount: 2.5,    // +150% enemies (2.5x)
                enemyHP: 1.5,       // +50% HP
                enemyDamage: 1.04,  // +4% damage
                bossHP: 2.20,       // +120% boss HP
                bossDamage: 1.18    // +18% boss damage
            };

        default:
            // For more than 4 players (future-proofing), use 4-player scaling
            return {
                enemyCount: 2.5,
                enemyHP: 2.0,
                enemyDamage: 1.15,
                bossHP: 2.20,
                bossDamage: 1.18
            };
    }
}

// Enemy stat growth per room (compounded)
const ENEMY_HP_GROWTH_PER_ROOM = 0.10;       // 10% per room (increased from 8%)
const ENEMY_DAMAGE_GROWTH_PER_ROOM = 0.15;   // 15% per room (increased from 13%)

// Boss stat growth per boss room (compounded)
const BOSS_HP_GROWTH_PER_ROOM = 0.09;        // 9% per room (reduced from 12% to match new balance)
const BOSS_DAMAGE_GROWTH_PER_ROOM = 0.14;    // 14% per room

// Generate room with enemies
function generateRoom(roomNumber) {
    const room = new Room(roomNumber);

    // Check for Boss Rush FIRST (skip to boss room) - modifier override takes priority
    if (typeof Game !== 'undefined' && Game.bossRushTargetRoom && roomNumber === Game.bossRushTargetRoom) {
        room.type = 'boss';
        const boss = generateBoss(roomNumber);
        room.enemies.push(boss);
        Game.bossRushTargetRoom = null;
        if (Game.nextRoomPackType) Game.nextRoomPackType = null;
        if (Game.nextRoomTypeOverride) Game.nextRoomTypeOverride = null;
        return room;
    }

    // Determine room type from pack selection or default logic
    let roomType = 'normal';
    let packType = null;

    // Check for room type override from room modifier FIRST (takes priority over everything except Boss Rush)
    if (typeof Game !== 'undefined' && Game.nextRoomTypeOverride) {
        roomType = Game.nextRoomTypeOverride;
        Game.nextRoomTypeOverride = null;
        // Room modifier override takes priority - skip boss room check
    } else if (typeof Game !== 'undefined' && Game.nextRoomPackType) {
        // Check for pack type from door selection
        packType = Game.nextRoomPackType;
        // Map pack type to room type
        switch (packType) {
            case 'Elite':
                roomType = 'elite';
                break;
            case 'Challenge':
                roomType = 'challenge';
                break;
            case 'Rest':
                roomType = 'rest';
                break;
            case 'Safe':
            case 'Safe Passage':
                roomType = 'safe';
                break;
            case 'Treasure':
                roomType = 'treasure';
                break;
            case 'Purification':
                roomType = 'purification';
                break;
            case 'Bonus Slot':
                roomType = 'bonus_slot';
                break;
            case 'Truncation':
                roomType = 'truncation';
                break;
            case 'Safe':
                roomType = 'safe';
                break;
            case 'Standard':
            default:
                roomType = 'normal';
                break;
        }
        // Clear pack type after use (one-time effect)
        Game.nextRoomPackType = null;
    } else {
        // Check game mode for boss room progression
        const gameMode = (typeof Game !== 'undefined' && Game.gameMode) ? Game.gameMode : 'cards';

        if (gameMode === 'gear') {
            // Gear mode: bosses at room 10, then every 5 rooms until room 30
            // After room 30, bosses spawn as elite enemies in normal rooms (not boss rooms)
            if (roomNumber >= 10 && roomNumber <= 30 && (roomNumber - 10) % 5 === 0) {
                roomType = 'boss';
            }
        } else {
            // Card mode: Boss rooms per spec at rooms 12, 22, 32 only
            // After room 32, bosses spawn as elite enemies in normal rooms (not boss rooms)
            if (roomNumber === 12 || roomNumber === 22 || roomNumber === 32) {
                roomType = 'boss';
            } else {
                // Default: Safe/Upgrade rooms unlock at room 22; appear periodically
                if (roomNumber >= 22 && (roomNumber % 7 === 2)) {
                    roomType = 'safe';
                }
            }
        }
    }

    room.type = roomType;

    // Handle boss room generation (if room type is boss from either modifier or default)
    if (roomType === 'boss') {
        const boss = generateBoss(roomNumber);
        room.enemies.push(boss);
        // Clear any remaining pack type since boss overrides it
        if (typeof Game !== 'undefined' && Game.nextRoomPackType) {
            Game.nextRoomPackType = null;
        }
        return room;
    }

    // Safe rooms have no enemies - mark as cleared immediately
    if (roomType === 'safe') {
        // No enemies; mark as cleared immediately so rewards are granted
        room.cleared = true;
        room.doorOpen = true;
        room.rewardsGranted = false; // Ensure rewards are processed when checkRoomCleared() is called
        // Note: Rewards will be granted when checkRoomCleared() is called in the update loop
        return room;
    }

    // Get multiplayer scaling multipliers
    const mpScaling = getMultiplayerScaling();

    // IMPROVED SCALING: Cap enemy count at room 18, then scale stats more aggressively
    // This prevents performance issues and visual clutter while maintaining difficulty
    const ENEMY_COUNT_CAP_ROOM = 18;
    const CAPPED_ROOM_ENEMY_COUNT = 26; // Slightly lower cap to lean on smarter AI

    let baseEnemyCount;

    if (roomNumber <= ENEMY_COUNT_CAP_ROOM) {
        // Phase 1: Normal scaling (Rooms 1-18)
        baseEnemyCount = 6 + Math.floor(roomNumber * 1.05);
    } else {
        // Phase 2: Continued scaling (Rooms 19+)
        // Start from cap and add ~1 enemy per room
        baseEnemyCount = CAPPED_ROOM_ENEMY_COUNT + Math.floor((roomNumber - ENEMY_COUNT_CAP_ROOM) * 1.0);
    }

    // Apply room type modifiers to enemy count
    let enemyCountMod = 1.0;
    if (roomType === 'challenge') {
        enemyCountMod = 1.12; // +12% enemy count
    } else if (roomType === 'truncation') {
        enemyCountMod = 0.80; // -20% enemy count
    } else if (roomType === 'bonus_slot') {
        enemyCountMod = 1.0; // Normal count but harder enemies
    }

    baseEnemyCount = Math.floor(baseEnemyCount * enemyCountMod);

    const roomIndex = Math.max(0, roomNumber - 1);
    let enemyHpScale = Math.pow(1 + ENEMY_HP_GROWTH_PER_ROOM, roomIndex);
    let enemyDamageScale = Math.pow(1 + ENEMY_DAMAGE_GROWTH_PER_ROOM, roomIndex);

    // Apply room type difficulty modifiers
    if (roomType === 'elite') {
        enemyHpScale *= 1.15; // +15% HP
        enemyDamageScale *= 1.15; // +15% damage
    } else if (roomType === 'challenge') {
        enemyHpScale *= 1.30; // +30% HP
        enemyDamageScale *= 1.30; // +30% damage
    } else if (roomType === 'truncation') {
        enemyHpScale *= 0.50; // -50% HP
    } else if (roomType === 'rest') {
        enemyHpScale *= 0.80; // -20% HP
        enemyDamageScale *= 0.80; // -20% damage
    } else if (roomType === 'purification') {
        enemyHpScale *= 1.25; // +25% HP
        enemyDamageScale *= 1.25; // +25% damage
    } else if (roomType === 'bonus_slot') {
        enemyHpScale *= 1.50; // +50% HP
        enemyDamageScale *= 1.50; // +50% damage
    }

    // Apply next-room enemy modifiers from room modifier cards (one-time)
    let enemyHpMod = 1.0;
    let enemySpeedMod = 1.0;
    let explosionChance = 0;
    let shieldChance = 0;
    let doubleEnemies = false;

    // Check consolidated modifiers first, then legacy support
    if (typeof Game !== 'undefined' && Game.nextRoomModifiers) {
        const mods = Game.nextRoomModifiers;
        if (Number.isFinite(mods.hpPct) && mods.hpPct !== 0) {
            enemyHpMod *= (1 + mods.hpPct);
        }
        if (Number.isFinite(mods.speedPct) && mods.speedPct !== 0) {
            enemySpeedMod *= (1 + mods.speedPct);
        }
        explosionChance = mods.explosionChance || 0;
        shieldChance = mods.shieldChance || 0;
        doubleEnemies = mods.doubleEnemies || false;

        console.log('[Room Generation] Applying modifiers - explosionChance:', explosionChance, 'shieldChance:', shieldChance, 'hpPct:', mods.hpPct, 'speedPct:', mods.speedPct);

        // Clear modifiers after use
        Game.nextRoomModifiers = null;
    }

    // Legacy support for existing code
    if (typeof Game !== 'undefined' && Game.nextRoomEnemyMod) {
        if (Number.isFinite(Game.nextRoomEnemyMod.hpPct) && Game.nextRoomEnemyMod.hpPct !== 0) {
            enemyHpMod *= (1 + Game.nextRoomEnemyMod.hpPct);
        }
        if (Number.isFinite(Game.nextRoomEnemyMod.speedPct) && Game.nextRoomEnemyMod.speedPct !== 0) {
            enemySpeedMod *= (1 + Game.nextRoomEnemyMod.speedPct);
        }
        // Clear so it only applies to this room
        Game.nextRoomEnemyMod = null;
    }

    // Apply double enemies modifier
    if (doubleEnemies) {
        baseEnemyCount *= 2;
    }

    const enemyCount = Math.floor(baseEnemyCount * mpScaling.enemyCount);

    // Debug logging
    if (mpScaling.enemyCount > 1.0 || roomNumber > ENEMY_COUNT_CAP_ROOM) {
        console.log(`[Room ${roomNumber}] Count: ${baseEnemyCount} → ${enemyCount} enemies (${mpScaling.enemyCount}x), HP Scale: ${enemyHpScale.toFixed(2)}x, Damage Scale: ${enemyDamageScale.toFixed(2)}x, MP HP: ${mpScaling.enemyHP}x, MP Damage: ${mpScaling.enemyDamage}x`);
    }

    // Spawn enemies with buffer from player spawn area
    const minDistance = 200; // Increased from 150 to 200 for better safety buffer
    const margin = 50;

    // Define spawn safety zone (left side where player enters at room center vertically)
    const spawnZoneX = 50;
    const spawnZoneY = room.height / 2; // Center vertically (675 for 1350 height)
    const spawnZoneRadius = 300; // No enemies within 300px of spawn point

    // Calculate number of groups based on enemy count (1 group per 3-4 enemies)
    // This ensures we get multiple groups that are relatively balanced
    const avgEnemiesPerGroup = 3.5;
    const numGroups = Math.max(1, Math.ceil(enemyCount / avgEnemiesPerGroup));
    const enemyGroups = [];

    // Distribute enemies evenly across groups
    const baseGroupSize = Math.floor(enemyCount / numGroups);
    const remainder = enemyCount % numGroups;
    const groupSizes = [];

    for (let g = 0; g < numGroups; g++) {
        // First 'remainder' groups get an extra enemy to distribute evenly
        const size = g < remainder ? baseGroupSize + 1 : baseGroupSize;
        groupSizes.push(size);
    }

    console.log(`[Room ${roomNumber}] Spawning ${enemyCount} enemies in ${numGroups} groups:`, groupSizes);

    // Generate group center positions
    for (let g = 0; g < numGroups; g++) {
        let groupX, groupY;
        let attempts = 0;
        let validPosition = false;

        while (!validPosition && attempts < 100) {
            groupX = random(margin + 200, room.width - margin - 200);
            groupY = random(margin + 200, room.height - margin - 200);

            // Check distance from spawn zone
            const dx = groupX - spawnZoneX;
            const dy = groupY - spawnZoneY;
            const distFromSpawn = Math.sqrt(dx * dx + dy * dy);

            // Ensure group center is far from spawn and other groups
            let farFromOtherGroups = true;
            for (let other of enemyGroups) {
                const odx = groupX - other.x;
                const ody = groupY - other.y;
                const dist = Math.sqrt(odx * odx + ody * ody);
                if (dist < 300) { // Groups at least 300px apart
                    farFromOtherGroups = false;
                    break;
                }
            }

            if (distFromSpawn >= spawnZoneRadius + 200 && farFromOtherGroups) {
                validPosition = true;
            }
            attempts++;
        }

        enemyGroups.push({ x: groupX, y: groupY });
    }

    // Spawn enemies in groups with even distribution
    let enemyIndex = 0;
    for (let groupIndex = 0; groupIndex < numGroups; groupIndex++) {
        const groupSize = groupSizes[groupIndex];
        const group = enemyGroups[groupIndex];

        for (let i = 0; i < groupSize; i++) {
            let x, y;
            let attempts = 0;
            let validPosition = false;

            while (!validPosition && attempts < 100) {
                // Spawn within 100px radius of group center
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * 100;
                x = group.x + Math.cos(angle) * distance;
                y = group.y + Math.sin(angle) * distance;

                // Clamp to room bounds
                x = Math.max(margin, Math.min(room.width - margin, x));
                y = Math.max(margin, Math.min(room.height - margin, y));

                // Position is valid if within bounds
                validPosition = true;
                attempts++;
            }

            // Choose enemy type based on room number, but elite/challenge rooms override restrictions
            let enemy;
            const rand = Math.random();

            // Elite and challenge rooms (from modifiers) can spawn all enemy types regardless of room number
            const isEliteOrChallenge = (roomType === 'elite' || roomType === 'challenge' || roomType === 'bonus_slot');
            const effectiveRoomNumber = isEliteOrChallenge ? Math.max(9, roomNumber) : roomNumber;

            if (effectiveRoomNumber < 3) {
                // Rooms 1-2: Only basic enemies
                enemy = new Enemy(x, y);
            } else if (effectiveRoomNumber < 5) {
                // Rooms 3-4: Mix of basic and star (60% vs 40%)
                if (rand < 0.6) {
                    enemy = new Enemy(x, y);
                } else {
                    enemy = new StarEnemy(x, y);
                }
            } else if (effectiveRoomNumber < 7) {
                // Rooms 5-6: Add diamonds (35%, 35%, 30%)
                if (rand < 0.35) {
                    enemy = new Enemy(x, y);
                } else if (rand < 0.7) {
                    enemy = new StarEnemy(x, y);
                } else {
                    enemy = new DiamondEnemy(x, y);
                }
            } else if (effectiveRoomNumber < 9) {
                // Rooms 7-8: Add rectangles (25% each)
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
                // Room 9+: All types including rare octagons
                // Adjust octagon spawn rate based on room type
                let octagonChance = 0.05; // Default 5%
                if (roomType === 'elite') {
                    octagonChance = 0.25; // 25% for elite rooms
                } else if (roomType === 'challenge') {
                    octagonChance = 0.35; // 35% for challenge rooms
                } else if (roomType === 'bonus_slot') {
                    octagonChance = 0.45; // 45% for bonus slot rooms
                }

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

            // Apply room modifier effects to enemy
            if (explosionChance > 0) {
                const roll = Math.random();
                if (roll < explosionChance) {
                    enemy.explodesOnDeath = true;
                    enemy.explosionChance = explosionChance;
                    console.log('[Enemy Spawn] Enemy set to explode on death (chance:', explosionChance, 'roll:', roll.toFixed(3), ')');
                }
            }
            if (shieldChance > 0 && Math.random() < shieldChance) {
                enemy.hasShield = true;
                // Shield health is based on enemy max HP (50% of max HP)
                enemy.maxShieldHealth = Math.floor(enemy.maxHp * 0.5);
                enemy.shieldHealth = enemy.maxShieldHealth;
                // Purple+ shields reflect projectiles (elite/challenge rooms or high quality modifier)
                enemy.shieldReflects = (roomType === 'elite' || roomType === 'challenge' || shieldChance >= 0.4);
            }

            // Scale enemy stats (room progression + multiplayer scaling)
            enemy.maxHp = Math.floor(enemy.maxHp * enemyHpScale * mpScaling.enemyHP * enemyHpMod);
            enemy.hp = enemy.maxHp;
            enemy.damage = enemy.damage * enemyDamageScale * mpScaling.enemyDamage;
            if (typeof enemy.damageScalingMultiplier === 'number') {
                enemy.damage *= enemy.damageScalingMultiplier;
            }
            enemy.xpValue = Math.floor(enemy.xpValue * enemyHpScale);
            // Tag room-wide speed multiplier for AI that consults it (optional)
            if (Number.isFinite(enemySpeedMod) && enemySpeedMod !== 1.0) {
                enemy.globalSpeedMultiplier = (enemy.globalSpeedMultiplier || 1.0) * enemySpeedMod;
            }

            // Set initial state to standby (will activate when player gets close)
            enemy.state = 'standby';
            enemy.detectionRange = 800; // Activate when player within ~camera view distance
            enemy.activated = false; // Track if enemy has ever been activated

            room.enemies.push(enemy);
            enemyIndex++;
        }
    }

    // Boss elite enemy system after room 30
    if (roomNumber > 30 && roomType === 'normal') {
        let bossesToSpawn = 0;
        
        // Guaranteed boss spawns every 5 rooms after room 30 (35, 40, 45, 50, 55, etc.)
        if (roomNumber > 30 && (roomNumber % 5 === 0)) {
            // After room 50 (starting at room 55), guarantee 2 bosses; rooms 35-50 guarantee 1
            const guaranteedCount = roomNumber > 50 ? 2 : 1;
            bossesToSpawn = guaranteedCount;
            console.log(`[Room ${roomNumber}] Guaranteed ${guaranteedCount} boss(es) as elite enemies`);
        } else {
            // For non-guaranteed rooms, apply random boss spawn chance
            const roomsPast30 = roomNumber - 30;
            const baseBossChance = 0.05; // 5% at room 30
            const chancePerRoom = 0.005; // +0.5% per room
            const randomBossChance = baseBossChance + (roomsPast30 * chancePerRoom);
            
            if (Math.random() < randomBossChance) {
                bossesToSpawn = 1;
                
                // After room 50, chance for second random boss
                if (roomNumber >= 50) {
                    const roomsPast50 = roomNumber - 50;
                    const baseDoubleChance = 0.10; // 10% at room 50
                    const doubleChancePerRoom = 0.005; // +0.5% per room
                    const doubleBossChance = baseDoubleChance + (roomsPast50 * doubleChancePerRoom);
                    
                    if (Math.random() < doubleBossChance) {
                        bossesToSpawn = 2;
                    }
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
                
                // Ensure boss is far from spawn zone and other bosses
                if (distFromSpawn >= spawnZoneRadius + 200 && farFromOtherBosses) {
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
        // First spawn the reward for this room (if any)
        // For Room 1, this generates a random reward
        // For Room 2+, this just checks if selectedDoorReward exists (doesn't modify it)
        if (typeof spawnRoomReward === 'function') {
            spawnRoomReward();
        }

        // Handle special room type clear effects
        if (currentRoom.type === 'safe' || currentRoom.type === 'rest') {
            // Safe/Rest room: Restore 50% max HP to all players
            if (typeof Game !== 'undefined' && Game.player) {
                const maxHp = Game.player.maxHp || 100;
                const healAmount = Math.floor(maxHp * 0.5);
                Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + healAmount);
                console.log(`[Room Clear] ${currentRoom.type} room: Restored 50% HP (${healAmount})`);
            }
        } else if (currentRoom.type === 'treasure') {
            // Treasure room: Restore 25% max HP to all players
            if (typeof Game !== 'undefined' && Game.player) {
                const maxHp = Game.player.maxHp || 100;
                const healAmount = Math.floor(maxHp * 0.25);
                Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + healAmount);
                console.log('[Room Clear] Treasure room: Restored 25% HP');
            }
        } else if (currentRoom.type === 'purification') {
            // Purification room: Remove one curse or grant 40 shards
            if (typeof Game !== 'undefined' && typeof SaveSystem !== 'undefined') {
                // Track last purification room
                Game.lastPurificationRoom = currentRoom.number;
                // Check if player has curses in hand
                const hasCurses = Game.hand && Array.isArray(Game.hand) &&
                    Game.hand.some(card => card.isCurse === true);
                if (hasCurses) {
                    // TODO: Show UI to remove one curse card
                    Game.awaitingPurificationSelection = true;
                    console.log('[Room Clear] Purification room: Player has curses, show removal UI');
                } else {
                    // Grant 40 shards if no curses
                    SaveSystem.addCardShards(40);
                    console.log('[Room Clear] Purification room: No curses, granted 40 shards');
                }
            }
        } else if (currentRoom.type === 'bonus_slot') {
            // Bonus slot room: Grant +1 hand slot and +15 shards
            if (typeof Game !== 'undefined' && typeof SaveSystem !== 'undefined') {
                // Grant +1 hand slot for rest of run
                if (!Game.runHandSizeBonus) Game.runHandSizeBonus = 0;
                Game.runHandSizeBonus += 1;
                // Grant shards
                SaveSystem.addCardShards(15);
                // Mark as used (can only appear once per run)
                Game.bonusSlotRoomUsed = true;
                console.log('[Room Clear] Bonus slot room: Granted +1 hand slot and 15 shards');
            }
        }

        if (currentRoom.type === 'boss' && typeof MusicManager !== 'undefined' && MusicManager.currentCategory === 'boss') {
            MusicManager.fadeOutCurrent().catch(err => {
                console.error('[Music] Failed to fade out boss music after room clear:', err);
            });
        }

        if (typeof Telemetry !== 'undefined') {
            const participants = typeof Game !== 'undefined' && Game && Game.collectTelemetryParticipants
                ? Game.collectTelemetryParticipants(true)
                : [];
            Telemetry.recordRoomCleared(currentRoom.number, participants);
        }

        // Update lifetime stats and check for card unlocks based on room milestone
        if (typeof window.updateLifetimeStats === 'function') {
            window.updateLifetimeStats({ totalRoomsCleared: 1 });
        }
        if (typeof window.checkRoomMilestoneUnlocks === 'function' && typeof Game !== 'undefined' && Game.roomNumber) {
            const unlocked = window.checkRoomMilestoneUnlocks(Game.roomNumber);
            if (unlocked.length > 0) {
                console.log(`[CardUnlocks] Unlocked ${unlocked.length} card(s) at room ${Game.roomNumber}`);
                // Show toast notifications for unlocked cards
                if (typeof window.showToast === 'function') {
                    unlocked.forEach((card, index) => {
                        const cardName = card.name || card.id || 'Card';
                        setTimeout(() => {
                            window.showToast(`New Card Unlocked: ${cardName}!`, 3000);
                        }, index * 200); // Stagger toasts slightly if multiple unlocks
                    });
                }
            }
        }

        // Elite kills are now tracked per enemy death in enemy-base.js die() method
        // This ensures we count all elite enemies, not just one per room

        // Room modifier drops from elite/boss rooms (only in card mode)
        const gameMode = (typeof Game !== 'undefined' && Game.gameMode) ? Game.gameMode : 'cards';
        if (gameMode === 'cards' && (currentRoom.type === 'elite' || currentRoom.type === 'boss') && typeof SaveSystem !== 'undefined' && typeof window.ROOM_MODIFIER_CARDS !== 'undefined') {
            const isElite = currentRoom.type === 'elite';
            const isBoss = currentRoom.type === 'boss';
            const dropChance = isBoss ? 0.40 : 0.25; // Boss: 40%, Elite: 25%

            if (Math.random() < dropChance) {
                // Generate random room modifier card
                const availableMods = window.ROOM_MODIFIER_CARDS.filter(mod => {
                    // Filter by unlock status if needed (for now, allow all)
                    return true;
                });

                if (availableMods.length > 0) {
                    const modDef = availableMods[Math.floor(Math.random() * availableMods.length)];
                    // Determine quality based on room number
                    const roomNum = currentRoom.number || 1;
                    let quality = 'white';
                    if (roomNum >= 22) {
                        // Late game: higher quality
                        const rand = Math.random();
                        if (rand < 0.15) quality = 'orange';
                        else if (rand < 0.35) quality = 'purple';
                        else if (rand < 0.60) quality = 'blue';
                        else if (rand < 0.85) quality = 'green';
                    } else if (roomNum >= 12) {
                        // Mid game
                        const rand = Math.random();
                        if (rand < 0.05) quality = 'orange';
                        else if (rand < 0.15) quality = 'purple';
                        else if (rand < 0.40) quality = 'blue';
                        else if (rand < 0.70) quality = 'green';
                    } else {
                        // Early game
                        const rand = Math.random();
                        if (rand < 0.30) quality = 'green';
                        else quality = 'white';
                    }

                    // Create modifier instance with resolved quality
                    const modInstance = { ...modDef };
                    modInstance._resolvedQuality = quality;

                    // Drop on ground near player
                    if (typeof Game !== 'undefined' && Game.player && typeof CardGround !== 'undefined' && CardGround.dropAt) {
                        const dropX = Game.player.x + 60;
                        const dropY = Game.player.y;
                        CardGround.dropAt(dropX, dropY, modInstance);
                        console.log(`[Room Modifier Drop] ${modDef.family} (${quality}) dropped from ${currentRoom.type} room`);
                    }
                }
            }
        }

        // Grant rewards from previous room's door selection (if any)
        // This happens AFTER the room is cleared, so rewards are only given after defeating all enemies
        // For safe rooms, this happens immediately since there are no enemies
        console.log('[DEBUG] Checking selectedDoorReward:', window.selectedDoorReward);
        console.log('[DEBUG] CardPacks available:', typeof CardPacks !== 'undefined');
        console.log('[DEBUG] CardPacks.applyDoorOption available:', typeof CardPacks !== 'undefined' && typeof CardPacks.applyDoorOption === 'function');
        if (typeof window !== 'undefined' && window.selectedDoorReward && typeof CardPacks !== 'undefined' && CardPacks.applyDoorOption) {
            const reward = window.selectedDoorReward;
            console.log('[Room Clear] Granting rewards from previous door selection:', reward);
            console.log('[DEBUG] Reward type:', reward.rewardType);
            console.log('[DEBUG] Reward payload:', reward.payload);
            // Apply the door option to grant rewards (cards, shards, bonus rewards from modifiers)
            CardPacks.applyDoorOption(reward);
            console.log('[DEBUG] applyDoorOption completed');
            // Clear the selected reward after granting
            window.selectedDoorReward = null;
        } else {
            console.log('[DEBUG] Skipping applyDoorOption - condition failed');
        }

        // Mark that rewards have been granted for this room (prevents duplicate granting)
        currentRoom.rewardsGranted = true;

        // Card system: generate door options for NEXT room (only in card mode)
        if (typeof Game !== 'undefined' && Game.gameMode === 'cards' && typeof CardPacks !== 'undefined' && CardPacks.generateDoorOptions) {
            const forceUpgrade = currentRoom.type === 'safe';
            const count = forceUpgrade ? 1 : (2 + Math.floor(Math.random() * 2));
            if (forceUpgrade) {
                const upgradeOption = {
                    packType: 'Upgrade',
                    rewardType: 'Upgrade',
                    preview: ['+1 quality to a hand card', '+20 shards option'],
                    payload: { upgrade: true, shards: 20 }
                };
                // Validate upgrade option - check if player can actually upgrade
                // IMPORTANT: Account for room reward upgrade that will be picked up before door selection
                const currentRoomNumber = currentRoom.number || (typeof Game !== 'undefined' ? Game.roomNumber : 1);

                // Check if there's a room reward that's an upgrade (from previous room's door selection)
                const roomRewardIsUpgrade = typeof window !== 'undefined' && window.selectedDoorReward
                    && window.selectedDoorReward.rewardType === 'Upgrade'
                    && window.selectedDoorReward.payload
                    && window.selectedDoorReward.payload.upgrade;

                // Count how many cards can be upgraded
                const upgradeableCount = typeof window.countUpgradeableCards === 'function'
                    ? window.countUpgradeableCards(currentRoomNumber)
                    : (typeof window.canUpgradeAnyCard === 'function' && window.canUpgradeAnyCard(currentRoomNumber) ? 1 : 0);

                // If room reward is an upgrade, it will use one upgrade slot
                // So door upgrade options need at least 2 upgradeable cards (1 for room reward, 1 for door option)
                const requiredUpgradeableCount = roomRewardIsUpgrade ? 2 : 1;
                const canUpgrade = upgradeableCount >= requiredUpgradeableCount;

                upgradeOption.canUpgrade = canUpgrade;
                if (!canUpgrade) {
                    const maxQuality = typeof window.getMaxUpgradeQualityForRoom === 'function'
                        ? window.getMaxUpgradeQualityForRoom(currentRoomNumber)
                        : 'orange';
                    if (roomRewardIsUpgrade) {
                        upgradeOption.upgradeWarning = `Room reward is an upgrade. After using it, no cards will be upgradeable (max ${maxQuality} for Room ${currentRoomNumber}). Choose a different reward.`;
                    } else {
                        upgradeOption.upgradeWarning = `All cards are already at maximum upgrade quality (${maxQuality}) for Room ${currentRoomNumber}). Choose a different reward.`;
                    }
                }
                Game.doorOptions = [upgradeOption];
            } else {
                Game.doorOptions = CardPacks.generateDoorOptions(currentRoom.number || 1, count);
            }
            Game.awaitingDoorSelection = true;
        }

        // Spawn physical door selection objects (card packs) for next room
        if (typeof Game !== 'undefined' && Game.gameMode === 'cards' && typeof createDoorSelections === 'function') {
            createDoorSelections();
        }

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
        // Gear mode: bosses at room 10, 15, 20, 25, 30, etc.
        // Cycle through bosses: Swarm King, Twin Prism, Fortress, Fractal Core, Vortex
        // Formula: (roomNumber - 10) / 5 gives boss index (0, 1, 2, 3, 4, ...)
        const bossIndex = Math.floor((roomNumber - 10) / 5) % 5;

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

    // Apply room scaling and multiplayer scaling to boss stats
    // Increased scaling to match faster progression
    if (boss) {
        const roomIndex = Math.max(0, roomNumber - 1);
        const bossHpScale = Math.pow(1 + BOSS_HP_GROWTH_PER_ROOM, roomIndex);
        const bossDamageScale = Math.pow(1 + BOSS_DAMAGE_GROWTH_PER_ROOM, roomIndex);
        const baseHP = boss.maxHp * bossHpScale;
        boss.maxHp = Math.floor(baseHP * mpScaling.bossHP);
        boss.hp = boss.maxHp;
        boss.damage = boss.damage * bossDamageScale * mpScaling.bossDamage;

        // Debug logging for boss scaling
        if (mpScaling.bossHP > 1.0) {
            console.log(`[Multiplayer] Boss ${boss.bossName || 'Unknown'} room ${roomNumber} scaling: HP: ${Math.floor(baseHP)} → ${boss.maxHp} (${mpScaling.bossHP}x), Damage Scale: ${bossDamageScale.toFixed(2)}x, MP Damage: ${mpScaling.bossDamage}x`);
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
    
    // Apply room scaling and multiplayer scaling to boss stats
    const roomIndex = Math.max(0, roomNumber - 1);
    const bossHpScale = Math.pow(1 + BOSS_HP_GROWTH_PER_ROOM, roomIndex);
    const bossDamageScale = Math.pow(1 + BOSS_DAMAGE_GROWTH_PER_ROOM, roomIndex);
    const baseHP = boss.maxHp * bossHpScale;
    boss.maxHp = Math.floor(baseHP * mpScaling.bossHP);
    boss.hp = boss.maxHp;
    boss.damage = boss.damage * bossDamageScale * mpScaling.bossDamage;
    
    // Don't play boss spawn sound for elite spawns (they're mixed with normal enemies)
    
    return boss;
}

// Helper function to scale minion stats based on current room progression
// This ensures minions spawned during combat (by octagons, bosses, etc.) get proper scaling
function scaleMinionStats(minion, healthMultiplier, damageMultiplier, xpMultiplier = null) {
    // Get current room number
    const roomNumber = typeof Game !== 'undefined' ? (Game.roomNumber || 1) :
        (typeof currentRoom !== 'undefined' && currentRoom ? currentRoom.number : 1);

    // Get multiplayer scaling multipliers
    const mpScaling = getMultiplayerScaling();

    // Calculate room-based scaling (same as normal enemies)
    const roomIndex = Math.max(0, roomNumber - 1);
    const enemyHpScale = Math.pow(1 + ENEMY_HP_GROWTH_PER_ROOM, roomIndex);
    const enemyDamageScale = Math.pow(1 + ENEMY_DAMAGE_GROWTH_PER_ROOM, roomIndex);

    // Apply scaling: base stats * room scaling * multiplayer scaling * minion multiplier
    minion.maxHp = Math.floor(minion.maxHp * enemyHpScale * mpScaling.enemyHP * healthMultiplier);
    minion.hp = minion.maxHp;
    minion.damage = minion.damage * enemyDamageScale * mpScaling.enemyDamage * damageMultiplier;

    // Apply XP multiplier if provided
    if (xpMultiplier !== null) {
        minion.xpValue = Math.floor(minion.xpValue * enemyHpScale * xpMultiplier);
    }

    // Handle activation based on whether minion has an inherited target
    // If minion has a currentTarget (inherited from parent), activate immediately
    // If no target, check if we're in a boss room and assign one
    const isBossRoom = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'boss');

    if (minion.currentTarget) {
        // Has inherited target - activate immediately
        if (minion.state === 'standby' || minion.state === undefined) {
            minion.state = 'chase';
        }
        minion.activated = true; // Mark as activated so AI runs immediately
    } else if (isBossRoom) {
        // In boss rooms, assign a target immediately (range doesn't matter)
        const allPlayers = minion.getAllAlivePlayers();
        if (allPlayers.length > 0) {
            const alivePlayers = allPlayers.filter(p => p.player && p.player.alive !== false);
            if (alivePlayers.length > 0) {
                // Pick a random alive player as target
                const randomIndex = Math.floor(Math.random() * alivePlayers.length);
                minion.currentTarget = alivePlayers[randomIndex].id;
                if (minion.state === 'standby' || minion.state === undefined) {
                    minion.state = 'chase';
                }
                minion.activated = true;
            } else {
                // No alive players, keep in standby
                if (minion.state === undefined) {
                    minion.state = 'standby';
                }
                minion.activated = false;
            }
        } else {
            // No players, keep in standby
            if (minion.state === undefined) {
                minion.state = 'standby';
            }
            minion.activated = false;
        }
    } else {
        // No inherited target and not in boss room - keep in standby, will activate via checkDetection() when player gets close
        // This handles the edge case where elite spawns minions before acquiring a target
        if (minion.state === undefined) {
            minion.state = 'standby';
        }
        minion.activated = false; // Will be set to true by checkDetection() when player is nearby
    }

    return minion;
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


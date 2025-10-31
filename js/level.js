// Level/room system

// Room class
class Room {
    constructor(number) {
        this.number = number;
        this.type = 'normal'; // normal, arena, boss
        const roomWidth = typeof Game !== 'undefined' ? Game.config.width : 1280;
        const roomHeight = typeof Game !== 'undefined' ? Game.config.height : 720;
        this.width = roomWidth;
        this.height = roomHeight;
        this.enemies = [];
        this.loot = [];
        this.cleared = false;
        this.doorOpen = false;
    }
}

// Current room instance
let currentRoom = null;

// Initialize current room
function initializeRoom(roomNumber = 1) {
    currentRoom = new Room(roomNumber);
    return currentRoom;
}

// Generate room with enemies
function generateRoom(roomNumber) {
    const room = new Room(roomNumber);
    
    // Check if this is a boss room (every 5 rooms starting at room 10)
    if ((roomNumber % 5 === 0) && (roomNumber >= 10)) {
        room.type = 'boss';
        const boss = generateBoss(roomNumber);
        room.enemies.push(boss);
        return room;
    }
    
    // Calculate enemy count based on room number
    const enemyCount = 3 + Math.floor(roomNumber * 0.5);
    
    // Calculate enemy stat scaling
    const enemyScale = 1 + (roomNumber * 0.19);
    
    // Spawn enemies with buffer from player spawn area
    const minDistance = 200; // Increased from 150 to 200 for better safety buffer
    const margin = 50;
    
    // Define spawn safety zone (left side where player enters)
    const spawnZoneX = 50;
    const spawnZoneY = 300;
    const spawnZoneRadius = 180; // No enemies within 180px of spawn point
    
    for (let i = 0; i < enemyCount; i++) {
        let x, y;
        let attempts = 0;
        let validPosition = false;
        
        const roomWidth = typeof Game !== 'undefined' ? Game.config.width : 1280;
        const roomHeight = typeof Game !== 'undefined' ? Game.config.height : 720;
        while (!validPosition && attempts < 100) {
            x = random(margin, roomWidth - margin);
            y = random(margin, roomHeight - margin);
            
            // Check distance from spawn zone
            const dx = x - spawnZoneX;
            const dy = y - spawnZoneY;
            const distFromSpawn = Math.sqrt(dx * dx + dy * dy);
            
            // Check distance from current player position (if exists)
            let distFromPlayer = 0;
            if (typeof Game !== 'undefined' && Game.player) {
                const dxPlayer = x - Game.player.x;
                const dyPlayer = y - Game.player.y;
                distFromPlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);
            }
            
            // Position is valid if far enough from spawn zone AND from player
            if (distFromSpawn >= spawnZoneRadius && distFromPlayer >= minDistance) {
                validPosition = true;
            }
            attempts++;
        }
        
        // Choose enemy type based on room number
        let enemy;
        const rand = Math.random();
        
        if (roomNumber < 3) {
            // Rooms 1-2: Only basic enemies
            enemy = new Enemy(x, y);
        } else if (roomNumber < 5) {
            // Rooms 3-4: Mix of basic and star (60% vs 40%)
            if (rand < 0.6) {
                enemy = new Enemy(x, y);
            } else {
                enemy = new StarEnemy(x, y);
            }
        } else if (roomNumber < 7) {
            // Rooms 5-6: Add diamonds (35%, 35%, 30%)
            if (rand < 0.35) {
                enemy = new Enemy(x, y);
            } else if (rand < 0.7) {
                enemy = new StarEnemy(x, y);
            } else {
                enemy = new DiamondEnemy(x, y);
            }
        } else if (roomNumber < 9) {
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
            // Room 9+: All types including rare octagons (5% chance)
            if (rand < 0.05) {
                enemy = new OctagonEnemy(x, y);
            } else if (rand < 0.30) {
                enemy = new Enemy(x, y);
            } else if (rand < 0.55) {
                enemy = new StarEnemy(x, y);
            } else if (rand < 0.80) {
                enemy = new DiamondEnemy(x, y);
            } else {
                enemy = new RectangleEnemy(x, y);
            }
        }
        
        // Scale enemy stats
        enemy.maxHp = Math.floor(enemy.maxHp * enemyScale);
        enemy.hp = enemy.maxHp;
        enemy.damage = enemy.damage * enemyScale;
        enemy.xpValue = Math.floor(enemy.xpValue * enemyScale);
        
        room.enemies.push(enemy);
    }
    
    return room;
}

// Check if room is cleared
function checkRoomCleared() {
    if (!currentRoom) return false;
    
    const aliveEnemies = currentRoom.enemies.filter(e => e.alive).length;
    
    if (aliveEnemies === 0 && !currentRoom.cleared) {
        currentRoom.cleared = true;
        currentRoom.doorOpen = true;
    }
    
    return currentRoom.cleared;
}

// Get door position and size for collision
function getDoorPosition() {
    const roomWidth = typeof Game !== 'undefined' ? Game.config.width : 1280;
    const roomHeight = typeof Game !== 'undefined' ? Game.config.height : 720;
    return {
        x: roomWidth - 100,
        y: roomHeight / 2 - 50,
        width: 50,
        height: 100
    };
}

// Generate boss based on room number
function generateBoss(roomNumber) {
    // Boss spawns at center of room
    const roomWidth = typeof Game !== 'undefined' ? Game.config.width : 1280;
    const roomHeight = typeof Game !== 'undefined' ? Game.config.height : 720;
    const spawnX = roomWidth / 2;
    const spawnY = roomHeight / 2;
    
    let boss = null;
    
    // Determine which boss to spawn based on room number
    if (roomNumber === 10) {
        // Swarm King
        boss = new BossSwarmKing(spawnX, spawnY);
    } else if (roomNumber === 15) {
        // Twin Prism
        boss = new BossTwinPrism(spawnX, spawnY);
    } else if (roomNumber === 20) {
        // Fortress
        boss = new BossFortress(spawnX, spawnY);
    } else if (roomNumber === 25) {
        // Fractal Core
        boss = new BossFractalCore(spawnX, spawnY);
    } else if (roomNumber === 30) {
        // Vortex
        boss = new BossVortex(spawnX, spawnY);
    } else {
        // Default fallback for future boss rooms (35, 40, etc.)
        console.warn(`No boss defined for room ${roomNumber} - using placeholder`);
        boss = createPlaceholderBoss(spawnX, spawnY, `Boss ${roomNumber}`);
    }
    
    // Apply room scaling to boss stats
    if (boss) {
        const enemyScale = 1 + (roomNumber * 0.165);
        boss.maxHp = Math.floor(boss.maxHp * enemyScale);
        boss.hp = boss.maxHp;
        boss.damage = boss.damage * enemyScale;
    }
    
    return boss;
}

// Placeholder boss class for testing (will be replaced by actual boss implementations)
function createPlaceholderBoss(x, y, name) {
    const boss = new BossBase(x, y);
    boss.bossName = name;
    boss.color = '#ff0044';
    
    // Basic placeholder rendering
    boss.render = function(ctx) {
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
    boss.update = function(deltaTime, player) {
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


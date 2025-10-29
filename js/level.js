// Level/room system

// Room class
class Room {
    constructor(number) {
        this.number = number;
        this.type = 'normal'; // normal, arena, boss
        this.width = 800;
        this.height = 600;
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
    
    // Calculate enemy count based on room number
    const enemyCount = 3 + Math.floor(roomNumber * 0.5);
    
    // Calculate enemy stat scaling
    const enemyScale = 1 + (roomNumber * 0.15);
    
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
        
        while (!validPosition && attempts < 100) {
            x = random(margin, 800 - margin);
            y = random(margin, 600 - margin);
            
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
    return {
        x: 750,
        y: 250,
        width: 50,
        height: 100
    };
}


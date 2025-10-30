// Nexus room system - Room 0 where players select classes and purchase upgrades

// Nexus room class
class NexusRoom {
    constructor() {
        this.width = 1280;
        this.height = 720;
        
        // Layout definitions - spread out more with larger canvas
        this.classArea = {
            x: 150,
            y: 200,
            width: 300,
            height: 450
        };
        
        this.upgradeArea = {
            x: 830,
            y: 200,
            width: 300,
            height: 450
        };
        
        this.portalPos = {
            x: 640, // Center of screen
            y: 360, // Center of screen
            radius: 50
        };
        
        this.spawnPos = {
            x: 300,
            y: 360
        };
    }
}

// Nexus instance
let nexusRoom = null;

// Class stations
const classStations = [
    { key: 'square', name: 'Warrior', color: '#4a90e2', x: 200, y: 250 },
    { key: 'triangle', name: 'Rogue', color: '#e24ace', x: 200, y: 350 },
    { key: 'pentagon', name: 'Tank', color: '#c72525', x: 200, y: 450 },
    { key: 'hexagon', name: 'Mage', color: '#9c27b0', x: 200, y: 550 }
];

// Upgrade stations
const upgradeStations = [
    { key: 'damage', name: 'Damage', icon: '⚔', x: 980, y: 250 },
    { key: 'defense', name: 'Defense', icon: '🛡', x: 980, y: 380 },
    { key: 'speed', name: 'Speed', icon: '⚡', x: 980, y: 510 }
];

// Initialize nexus
function initNexus() {
    nexusRoom = new NexusRoom();
    
    // Create player for nexus navigation if doesn't exist
    if (!Game.player) {
        Game.player = new Player(nexusRoom.spawnPos.x, nexusRoom.spawnPos.y);
        // Player in nexus doesn't need a class initially
    } else {
        // Reset player position to spawn
        Game.player.x = nexusRoom.spawnPos.x;
        Game.player.y = nexusRoom.spawnPos.y;
        Game.player.dead = false;
        Game.player.alive = true;
        Game.player.hp = Game.player.maxHp;
    }
}

// Update nexus
function updateNexus(ctx, deltaTime) {
    if (!nexusRoom) {
        initNexus();
    }
    
    if (!Game.player) {
        initNexus();
    }
    
    // Update player movement in nexus
    if (Game.player && Game.player.alive) {
        // Handle movement input (WASD)
        Game.player.vx = 0;
        Game.player.vy = 0;
        
        let moveX = 0;
        let moveY = 0;
        
        if (Input.getKeyState('w')) moveY -= 1;
        if (Input.getKeyState('s')) moveY += 1;
        if (Input.getKeyState('a')) moveX -= 1;
        if (Input.getKeyState('d')) moveX += 1;
        
        // Normalize diagonal movement
        const length = Math.sqrt(moveX * moveX + moveY * moveY);
        if (length > 0) {
            const moveSpeed = 200; // Nexus movement speed
            Game.player.vx = (moveX / length) * moveSpeed;
            Game.player.vy = (moveY / length) * moveSpeed;
        }
        
        // Update position
        Game.player.x += Game.player.vx * deltaTime;
        Game.player.y += Game.player.vy * deltaTime;
        
        // Keep player in bounds
        Game.player.x = clamp(Game.player.x, Game.player.size, nexusRoom.width - Game.player.size);
        Game.player.y = clamp(Game.player.y, Game.player.size, nexusRoom.height - Game.player.size);
        
        // Calculate rotation to face mouse
        if (Input.mouse.x !== undefined && Input.mouse.y !== undefined) {
            const dx = Input.mouse.x - Game.player.x;
            const dy = Input.mouse.y - Game.player.y;
            Game.player.rotation = Math.atan2(dy, dx);
        }
    }
    
    // Handle G key interactions
    if (Input.getKeyState('g') && !Game.lastGKeyState) {
        Game.lastGKeyState = true;
        
        // Check class station interactions
        classStations.forEach(station => {
            const dx = station.x - Game.player.x;
            const dy = station.y - Game.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 50) {
                // Select this class
                Game.selectedClass = station.key;
                if (typeof SaveSystem !== 'undefined') {
                    SaveSystem.setSelectedClass(station.key);
                }
                console.log(`Selected class: ${station.name}`);
            }
        });
        
        // Check upgrade station interactions
        if (Game.selectedClass) {
            upgradeStations.forEach(station => {
                const dx = station.x - Game.player.x;
                const dy = station.y - Game.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 50) {
                    purchaseUpgrade(Game.selectedClass, station.key);
                }
            });
        }
        
        // Check portal interaction
        const portalDx = nexusRoom.portalPos.x - Game.player.x;
        const portalDy = nexusRoom.portalPos.y - Game.player.y;
        const portalDistance = Math.sqrt(portalDx * portalDx + portalDy * portalDy);
        
        if (portalDistance < 60 && Game.selectedClass) {
            // Start run
            Game.startGame();
        }
    } else if (!Input.getKeyState('g')) {
        Game.lastGKeyState = false;
    }
}

// Purchase upgrade
function purchaseUpgrade(classType, statType) {
    if (typeof SaveSystem === 'undefined') return;
    
    // Get current upgrade level
    const upgrades = SaveSystem.getUpgrades(classType);
    const currentLevel = upgrades[statType] || 0;
    
    // Calculate cost
    const cost = SaveSystem.getUpgradeCost(statType, currentLevel);
    
    // Check if player has enough currency
    if (Game.currentCurrency >= cost) {
        // Purchase upgrade
        SaveSystem.incrementUpgrade(classType, statType);
        SaveSystem.setCurrency(Game.currentCurrency - cost);
        Game.currentCurrency = SaveSystem.getCurrency();
        
        // Update player stats if this is the current class
        if (Game.player && Game.selectedClass === classType) {
            Game.player.setClass(classType);
        }
        
        console.log(`Upgraded ${classType} ${statType} to level ${currentLevel + 1}`);
    } else {
        console.log(`Not enough currency! Need ${cost}, have ${Game.currentCurrency}`);
    }
}

// Render nexus
function renderNexus(ctx) {
    if (!nexusRoom) {
        initNexus();
    }
    
    // Render background (darker/mystical)
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, nexusRoom.width, nexusRoom.height);
    
    // Render subtle grid pattern
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < nexusRoom.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, nexusRoom.height);
        ctx.stroke();
    }
    for (let y = 0; y < nexusRoom.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(nexusRoom.width, y);
        ctx.stroke();
    }
    
    // Render area labels
    ctx.fillStyle = '#888888';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CLASSES', nexusRoom.classArea.x + nexusRoom.classArea.width / 2, 160);
    ctx.fillText('UPGRADES', nexusRoom.upgradeArea.x + nexusRoom.upgradeArea.width / 2, 160);
    
    // Render separator line (vertical line down the center)
    ctx.strokeStyle = 'rgba(150, 150, 200, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nexusRoom.width / 2, 120);
    ctx.lineTo(nexusRoom.width / 2, nexusRoom.height - 100);
    ctx.stroke();
    
    // Render class stations
    classStations.forEach(station => {
        const isSelected = Game.selectedClass === station.key;
        const dx = station.x - (Game.player ? Game.player.x : 0);
        const dy = station.y - (Game.player ? Game.player.y : 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isNear = distance < 50;
        
        // Draw station background
        ctx.fillStyle = isSelected ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)';
        if (isNear) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        }
        ctx.fillRect(station.x - 60, station.y - 30, 120, 60);
        
        // Draw border
        ctx.strokeStyle = isSelected ? '#ffff00' : station.color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(station.x - 60, station.y - 30, 120, 60);
        
        // Draw class shape
        ctx.fillStyle = station.color;
        ctx.save();
        ctx.translate(station.x - 30, station.y);
        
        if (station.key === 'square') {
            ctx.fillRect(-15, -15, 30, 30);
        } else if (station.key === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(-15, -15);
            ctx.lineTo(-15, 15);
            ctx.closePath();
            ctx.fill();
        } else if (station.key === 'pentagon') {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                const px = Math.cos(angle) * 15;
                const py = Math.sin(angle) * 15;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else if (station.key === 'hexagon') {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const px = Math.cos(angle) * 15;
                const py = Math.sin(angle) * 15;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.restore();
        
        // Draw class name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(station.name, station.x + 10, station.y + 5);
        
        // Draw interaction prompt
        if (isNear) {
            ctx.fillStyle = '#ffff00';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Press G to select', station.x, station.y + 35);
        }
    });
    
    // Render upgrade stations
    if (Game.selectedClass) {
        upgradeStations.forEach(station => {
            const dx = station.x - (Game.player ? Game.player.x : 0);
            const dy = station.y - (Game.player ? Game.player.y : 0);
            const distance = Math.sqrt(dx * dx + dy * dy);
            const isNear = distance < 50;
            
            // Get current upgrade level
            const upgrades = typeof SaveSystem !== 'undefined' ? SaveSystem.getUpgrades(Game.selectedClass) : { damage: 0, defense: 0, speed: 0 };
            const currentLevel = upgrades[station.key] || 0;
            const cost = typeof SaveSystem !== 'undefined' ? SaveSystem.getUpgradeCost(station.key, currentLevel) : 50;
            const canAfford = Game.currentCurrency >= cost;
            
            // Draw station background
            ctx.fillStyle = canAfford && isNear ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(station.x - 60, station.y - 40, 120, 80);
            
            // Draw border
            ctx.strokeStyle = canAfford ? '#00ff00' : '#666666';
            ctx.lineWidth = 2;
            ctx.strokeRect(station.x - 60, station.y - 40, 120, 80);
            
            // Draw icon/name
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(station.icon, station.x, station.y - 15);
            ctx.font = '14px Arial';
            ctx.fillText(station.name, station.x, station.y);
            
            // Draw level
            ctx.font = '12px Arial';
            ctx.fillText(`Level: ${currentLevel}`, station.x, station.y + 15);
            
            // Draw cost
            ctx.fillStyle = canAfford ? '#00ff00' : '#ff6666';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(`Cost: ${cost}`, station.x, station.y + 30);
            
            // Draw interaction prompt
            if (isNear) {
                ctx.fillStyle = '#ffff00';
                ctx.font = '12px Arial';
                ctx.fillText('Press G to upgrade', station.x, station.y + 45);
            }
        });
    }
    
    // Render portal
    const portalDx = nexusRoom.portalPos.x - (Game.player ? Game.player.x : 0);
    const portalDy = nexusRoom.portalPos.y - (Game.player ? Game.player.y : 0);
    const portalDistance = Math.sqrt(portalDx * portalDx + portalDy * portalDy);
    const isNearPortal = portalDistance < 60;
    const portalActive = Game.selectedClass !== null;
    
    // Portal pulsing animation
    const pulseTime = Date.now() * 0.002;
    const pulseSize = nexusRoom.portalPos.radius + Math.sin(pulseTime) * 5;
    const portalAlpha = 0.6 + Math.sin(pulseTime * 2) * 0.2;
    
    // Outer glow
    ctx.fillStyle = portalActive ? `rgba(100, 200, 255, ${portalAlpha})` : `rgba(100, 100, 100, ${portalAlpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(nexusRoom.portalPos.x, nexusRoom.portalPos.y, pulseSize + 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Portal core
    ctx.fillStyle = portalActive ? 'rgba(150, 220, 255, 0.8)' : 'rgba(100, 100, 100, 0.5)';
    ctx.beginPath();
    ctx.arc(nexusRoom.portalPos.x, nexusRoom.portalPos.y, pulseSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Portal border
    ctx.strokeStyle = portalActive ? '#66ccff' : '#666666';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(nexusRoom.portalPos.x, nexusRoom.portalPos.y, pulseSize, 0, Math.PI * 2);
    ctx.stroke();
    
    // Portal interaction prompt
    if (isNearPortal) {
        if (portalActive) {
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Press G to enter portal', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 60);
        } else {
            ctx.fillStyle = '#ff6666';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Select a class first', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 60);
        }
    }
    
    // Render player
    if (Game.player && Game.player.alive) {
        // Render player as simple circle in nexus (no class shape needed)
        ctx.fillStyle = Game.selectedClass ? CLASS_DEFINITIONS[Game.selectedClass].color : '#888888';
        ctx.beginPath();
        ctx.arc(Game.player.x, Game.player.y, Game.player.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw direction indicator
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(
            Game.player.x + Math.cos(Game.player.rotation) * (Game.player.size - 5),
            Game.player.y + Math.sin(Game.player.rotation) * (Game.player.size - 5),
            5, 0, Math.PI * 2
        );
        ctx.fill();
    }
    
    // Render currency display (top right)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Currency: ${Game.currentCurrency}`, nexusRoom.width - 20, 30);
}


// Enemy Squad System - Coordinates enemy behavior and attacks

class EnemySquad {
    constructor(id, roomNumber) {
        this.id = id;
        this.members = [];
        this.leader = null;
        this.attackQueue = []; // Currently attacking enemies
        this.maxAttackers = this.calculateMaxAttackers(roomNumber);
        this.coordinationLevel = this.calculateCoordinationLevel(roomNumber);
        this.formation = 'balanced';
        this.updateTimer = 0;
        this.updateInterval = 0.1; // Update formation every 100ms
        
        // Squad stats
        this.aliveCount = 0;
        this.morale = 1.0; // Affects behavior (1.0 = full, 0.0 = broken)
    }
    
    // Calculate max attackers based on room number and coordination level
    calculateMaxAttackers(roomNumber) {
        if (roomNumber < 3) return 0; // No coordination in rooms 1-2
        if (roomNumber < 10) return 1; // Light coordination (rooms 3-9)
        if (roomNumber < 15) return 2; // Medium coordination (rooms 10-14)
        return 2; // Full coordination (can be 3 for very late game)
    }
    
    // Calculate coordination level based on room number
    calculateCoordinationLevel(roomNumber) {
        if (roomNumber < 3) return 'none'; // Rooms 1-2: no coordination
        if (roomNumber < 10) return 'light'; // Rooms 3-9: light coordination
        if (roomNumber < 15) return 'medium'; // Rooms 10-14: medium coordination
        return 'full'; // Rooms 15+: full coordination
    }
    
    // Check if squad is too small and should be merged/disbanded
    shouldReorganize() {
        // If squad has only 1 member left, it should be reassigned
        return this.aliveCount <= 1;
    }
    
    // Get minimum viable squad size (based on coordination level)
    getMinSquadSize() {
        if (this.coordinationLevel === 'none') return 1;
        if (this.coordinationLevel === 'light') return 2;
        if (this.coordinationLevel === 'medium') return 2;
        return 2; // Full coordination
    }
    
    // Add enemy to squad
    addMember(enemy) {
        if (this.members.indexOf(enemy) === -1) {
            this.members.push(enemy);
            enemy.squad = this;
            enemy.squadId = this.id;
            
            // Select leader if none exists or if this enemy is more important
            this.selectLeader();
            
            this.updateAliveCount();
        }
    }
    
    // Remove enemy from squad (on death)
    removeMember(enemy) {
        const index = this.members.indexOf(enemy);
        if (index !== -1) {
            this.members.splice(index, 1);
            
            // Remove from attack queue if present
            const queueIndex = this.attackQueue.indexOf(enemy);
            if (queueIndex !== -1) {
                this.attackQueue.splice(queueIndex, 1);
            }
            
            // Select new leader if leader died
            if (this.leader === enemy) {
                this.selectLeader();
            }
            
            this.updateAliveCount();
            this.updateMorale();
        }
    }
    
    // Select squad leader (highest priority enemy type)
    selectLeader() {
        if (this.members.length === 0) {
            this.leader = null;
            return;
        }
        
        // Priority order: Elite > Brute > Assassin > Ranged > Swarmer
        const priority = {
            'octagon': 5,
            'rectangle': 4,
            'diamond': 3,
            'star': 2,
            'circle': 1
        };
        
        let bestLeader = null;
        let bestPriority = 0;
        
        this.members.forEach(enemy => {
            if (!enemy.alive) return;
            
            const enemyType = this.getEnemyType(enemy);
            const enemyPriority = priority[enemyType] || 0;
            
            if (enemyPriority > bestPriority) {
                bestPriority = enemyPriority;
                bestLeader = enemy;
            }
        });
        
        this.leader = bestLeader || this.members.find(e => e.alive) || null;
    }
    
    // Get enemy type string
    getEnemyType(enemy) {
        if (enemy instanceof OctagonEnemy) return 'octagon';
        if (enemy instanceof RectangleEnemy) return 'rectangle';
        if (enemy instanceof DiamondEnemy) return 'diamond';
        if (enemy instanceof StarEnemy) return 'star';
        if (enemy instanceof Enemy) return 'circle';
        return 'unknown';
    }
    
    // Request attack permission (returns true if can attack)
    requestAttack(enemy) {
        // No coordination in early rooms
        if (this.coordinationLevel === 'none') {
            return true;
        }
        
        // Check if already attacking
        if (this.attackQueue.indexOf(enemy) !== -1) {
            return true;
        }
        
        // Check if queue is full
        if (this.attackQueue.length >= this.maxAttackers) {
            return false;
        }
        
        // Check if enemy is in range and ready
        if (!enemy.alive) {
            return false;
        }
        
        // Add to queue
        this.attackQueue.push(enemy);
        return true;
    }
    
    // Release attack slot (called when enemy finishes attack)
    releaseAttack(enemy) {
        const index = this.attackQueue.indexOf(enemy);
        if (index !== -1) {
            this.attackQueue.splice(index, 1);
        }
    }
    
    // Check if enemy can attack
    canAttack(enemy) {
        if (this.coordinationLevel === 'none') {
            return true;
        }
        
        return this.attackQueue.indexOf(enemy) !== -1 || 
               this.attackQueue.length < this.maxAttackers;
    }
    
    // Update squad formation and tactics
    update(deltaTime, player) {
        if (!player || !player.alive) return;
        
        // Remove dead enemies from members list
        this.members = this.members.filter(e => e.alive);
        
        // Update alive count and morale
        this.updateAliveCount();
        this.updateMorale();
        
        // Check if leader is still alive
        if (this.leader && !this.leader.alive) {
            this.selectLeader();
        }
        
        this.updateTimer += deltaTime;
        
        // Update formation periodically
        if (this.updateTimer >= this.updateInterval) {
            this.updateFormation(player);
            this.updateTimer = 0;
        }
        
        // Clean up dead enemies from queue
        this.attackQueue = this.attackQueue.filter(e => e.alive);
    }
    
    // Update formation positions
    updateFormation(player) {
        if (this.members.length === 0 || !player) return;
        
        const aliveMembers = this.members.filter(e => e.alive);
        if (aliveMembers.length === 0) return;
        
        // Basic formation: arrange enemies around player
        // Vanguard (melee) in front, ranged behind, flankers on sides
        const playerX = player.x;
        const playerY = player.y;
        
        // Sort by type priority for formation
        aliveMembers.sort((a, b) => {
            const typeA = this.getEnemyType(a);
            const typeB = this.getEnemyType(b);
            const priority = {
                'octagon': 5, 'rectangle': 4, 'circle': 3,
                'diamond': 2, 'star': 1
            };
            return (priority[typeB] || 0) - (priority[typeA] || 0);
        });
        
        // Distribute enemies in formation
        aliveMembers.forEach((enemy, index) => {
            const enemyType = this.getEnemyType(enemy);
            
            // Store desired formation position
            if (!enemy.desiredFormationPos) {
                enemy.desiredFormationPos = { x: 0, y: 0 };
            }
            
            // Calculate formation offset based on enemy type and position
            const formationRadius = this.getFormationRadius(enemyType);
            const angleStep = (Math.PI * 2) / aliveMembers.length;
            const angle = angleStep * index;
            
            // Adjust angle based on enemy type
            let adjustedAngle = angle;
            if (enemyType === 'star') {
                // Ranged enemies stay back
                adjustedAngle = angle;
            } else if (enemyType === 'diamond') {
                // Assassins prefer flanking positions
                adjustedAngle = angle + Math.PI / 2;
            }
            
            enemy.desiredFormationPos.x = playerX + Math.cos(adjustedAngle) * formationRadius;
            enemy.desiredFormationPos.y = playerY + Math.sin(adjustedAngle) * formationRadius;
        });
    }
    
    // Get formation radius based on enemy type
    getFormationRadius(enemyType) {
        const radii = {
            'octagon': 120,
            'rectangle': 100,
            'circle': 80,
            'diamond': 90,
            'star': 150
        };
        return radii[enemyType] || 100;
    }
    
    // Update alive count
    updateAliveCount() {
        this.aliveCount = this.members.filter(e => e.alive).length;
    }
    
    // Update squad morale (affects behavior)
    updateMorale() {
        const totalMembers = this.members.length;
        if (totalMembers === 0) {
            this.morale = 0;
            return;
        }
        
        // Morale based on percentage of squad alive
        this.morale = this.aliveCount / totalMembers;
        
        // Morale penalty if leader is dead
        if (this.leader && !this.leader.alive) {
            this.morale *= 0.7;
        }
    }
    
    // Get squad center position
    getCenter() {
        if (this.members.length === 0) return { x: 0, y: 0 };
        
        const aliveMembers = this.members.filter(e => e.alive);
        if (aliveMembers.length === 0) return { x: 0, y: 0 };
        
        let sumX = 0, sumY = 0;
        aliveMembers.forEach(enemy => {
            sumX += enemy.x;
            sumY += enemy.y;
        });
        
        return {
            x: sumX / aliveMembers.length,
            y: sumY / aliveMembers.length
        };
    }
    
    // Check if squad should retreat (low morale)
    shouldRetreat() {
        return this.morale < 0.3 && this.coordinationLevel !== 'none';
    }
}

// Squad Manager - manages all squads in a room
class SquadManager {
    constructor() {
        this.squads = [];
        this.nextSquadId = 1;
    }
    
    // Create a new squad
    createSquad(roomNumber) {
        const squad = new EnemySquad(this.nextSquadId++, roomNumber);
        this.squads.push(squad);
        return squad;
    }
    
    // Organize enemies into squads
    organizeEnemiesIntoSquads(enemies, roomNumber) {
        // Clear existing squads
        this.squads = [];
        this.nextSquadId = 1;
        
        // No squads for rooms 1-2 (only melee enemies)
        if (roomNumber < 3) {
            enemies.forEach(enemy => {
                enemy.squad = null;
                enemy.squadId = null;
            });
            return;
        }
        
        // Calculate squad size based on room number
        const squadSize = this.calculateSquadSize(roomNumber, enemies.length);
        
        // Group enemies into balanced squads
        const squads = this.createBalancedSquads(enemies, squadSize, roomNumber);
        
        this.squads = squads;
    }
    
    // Calculate optimal squad size
    calculateSquadSize(roomNumber, totalEnemies) {
        if (roomNumber < 3) return 1; // No squads for rooms 1-2
        if (roomNumber < 10) return 2; // Small squads (rooms 3-9)
        if (roomNumber < 15) return 3; // Medium squads (rooms 10-14)
        return Math.min(4, Math.max(2, Math.floor(totalEnemies / 3))); // Larger squads (room 15+)
    }
    
    // Merge a small squad into the nearest larger squad
    mergeSquadIntoNearest(smallSquad, roomNumber) {
        if (smallSquad.aliveCount === 0) return false;
        
        // Find the nearest squad with space
        let nearestSquad = null;
        let nearestDistance = Infinity;
        const smallSquadCenter = smallSquad.getCenter();
        
        this.squads.forEach(squad => {
            // Skip the squad itself
            if (squad === smallSquad) return;
            
            // Only merge into squads that aren't already full
            const maxSquadSize = this.calculateSquadSize(roomNumber, 100); // Use reasonable max
            if (squad.aliveCount >= maxSquadSize) return;
            
            // Calculate distance between squad centers
            const squadCenter = squad.getCenter();
            const dx = squadCenter.x - smallSquadCenter.x;
            const dy = squadCenter.y - smallSquadCenter.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestSquad = squad;
            }
        });
        
        // If we found a nearby squad, merge into it
        if (nearestSquad) {
            const aliveMembers = smallSquad.members.filter(e => e.alive);
            aliveMembers.forEach(enemy => {
                // Remove from old squad
                smallSquad.removeMember(enemy);
                // Add to new squad
                nearestSquad.addMember(enemy);
            });
            return true;
        }
        
        return false;
    }
    
    // Consolidate small squads by merging them into nearby squads
    consolidateSquads(roomNumber) {
        let consolidated = false;
        
        // Get all small squads that need consolidation
        const smallSquads = this.squads.filter(squad => {
            squad.updateAliveCount();
            return squad.shouldReorganize() && squad.aliveCount > 0;
        });
        
        // Try to merge each small squad into the nearest larger squad
        smallSquads.forEach(smallSquad => {
            if (this.mergeSquadIntoNearest(smallSquad, roomNumber)) {
                consolidated = true;
            }
        });
        
        // Remove empty squads after merging
        this.squads = this.squads.filter(squad => squad.members.length > 0);
        
        return consolidated;
    }
    
    // Assign orphaned enemies (not in any squad) to nearest squad
    assignOrphanedEnemies(roomNumber) {
        if (roomNumber < 3) return; // No squads in early rooms
        
        if (typeof Game === 'undefined' || !Game.enemies) return;
        
        const orphanedEnemies = Game.enemies.filter(enemy => {
            return enemy.alive && !enemy.squad;
        });
        
        if (orphanedEnemies.length === 0) return;
        
        orphanedEnemies.forEach(enemy => {
            // Find nearest squad with space
            let nearestSquad = null;
            let nearestDistance = Infinity;
            
            this.squads.forEach(squad => {
                const maxSquadSize = this.calculateSquadSize(roomNumber, 100);
                if (squad.aliveCount >= maxSquadSize) return;
                
                const squadCenter = squad.getCenter();
                const dx = enemy.x - squadCenter.x;
                const dy = enemy.y - squadCenter.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestSquad = squad;
                }
            });
            
            // If we found a nearby squad, add enemy to it
            if (nearestSquad) {
                nearestSquad.addMember(enemy);
            } else if (this.squads.length === 0) {
                // No squads exist, create a new one if we have enough enemies
                const orphanedCount = Game.enemies.filter(e => e.alive && !e.squad).length;
                if (orphanedCount >= 2) {
                    // We'll handle this in a batch later
                }
            }
        });
    }
    
    // Check and handle squad reorganization if needed
    checkAndReorganize(roomNumber) {
        // First, assign any orphaned enemies to nearby squads
        this.assignOrphanedEnemies(roomNumber);
        
        // Then consolidate small squads by merging them
        const consolidated = this.consolidateSquads(roomNumber);
        
        // Handle edge case: if we have multiple orphaned enemies and no squads, create one
        if (typeof Game !== 'undefined' && Game.enemies && this.squads.length === 0 && roomNumber >= 3) {
            const orphanedEnemies = Game.enemies.filter(e => e.alive && !e.squad);
            if (orphanedEnemies.length >= 2) {
                // Create a new squad with orphaned enemies
                const squadSize = this.calculateSquadSize(roomNumber, orphanedEnemies.length);
                const newSquad = this.createSquad(roomNumber);
                for (let i = 0; i < Math.min(squadSize, orphanedEnemies.length); i++) {
                    newSquad.addMember(orphanedEnemies[i]);
                }
            }
        }
        
        return consolidated;
    }
    
    // Create balanced squads with mixed enemy types
    createBalancedSquads(enemies, squadSize, roomNumber) {
        const squads = [];
        
        // Sort enemies by type for balanced distribution
        const enemiesByType = {
            'octagon': [],
            'rectangle': [],
            'diamond': [],
            'star': [],
            'circle': []
        };
        
        enemies.forEach(enemy => {
            const type = this.getEnemyType(enemy);
            if (enemiesByType[type]) {
                enemiesByType[type].push(enemy);
            }
        });
        
        // Create squads with balanced composition
        let squadIndex = 0;
        const typeOrder = ['octagon', 'rectangle', 'circle', 'diamond', 'star'];
        
        // Distribute enemies round-robin style
        let allEnemies = [];
        typeOrder.forEach(type => {
            allEnemies = allEnemies.concat(enemiesByType[type]);
        });
        
        // Create squads
        while (allEnemies.length > 0) {
            const squad = this.createSquad(roomNumber);
            const squadMembers = [];
            
            // Fill squad with enemies
            for (let i = 0; i < squadSize && allEnemies.length > 0; i++) {
                squadMembers.push(allEnemies.shift());
            }
            
            // Add members to squad
            squadMembers.forEach(enemy => {
                squad.addMember(enemy);
            });
            
            squads.push(squad);
        }
        
        return squads;
    }
    
    // Get enemy type
    getEnemyType(enemy) {
        if (enemy instanceof OctagonEnemy) return 'octagon';
        if (enemy instanceof RectangleEnemy) return 'rectangle';
        if (enemy instanceof DiamondEnemy) return 'diamond';
        if (enemy instanceof StarEnemy) return 'star';
        if (enemy instanceof Enemy) return 'circle';
        return 'unknown';
    }
    
    // Update all squads
    update(deltaTime, player, roomNumber) {
        // Update each squad
        this.squads.forEach(squad => {
            squad.update(deltaTime, player);
        });
        
        // Remove dead enemies from squads and clean up
        this.squads.forEach(squad => {
            squad.members = squad.members.filter(e => e.alive);
            squad.updateAliveCount();
        });
        
        // Remove completely empty squads
        this.squads = this.squads.filter(squad => squad.members.length > 0);
        
        // Check for reorganization every second (to avoid constant checks)
        if (!this.lastReorganizeCheck) {
            this.lastReorganizeCheck = 0;
        }
        this.lastReorganizeCheck += deltaTime;
        
        if (this.lastReorganizeCheck >= 1.0) { // Check every second
            this.checkAndReorganize(roomNumber);
            this.lastReorganizeCheck = 0;
        }
    }
    
    // Get all squads
    getAllSquads() {
        return this.squads;
    }
}

// Global squad manager instance
let squadManager = null;

// Initialize squad manager
function initSquadManager() {
    if (!squadManager) {
        squadManager = new SquadManager();
    }
    return squadManager;
}

// Get squad manager
function getSquadManager() {
    if (!squadManager) {
        initSquadManager();
    }
    return squadManager;
}


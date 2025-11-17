// Nexus room system - Room 0 where players select classes and purchase upgrades

// ============================================================================
// TEMPLATE UTILITY FUNCTIONS
// ============================================================================

// Format a value as a percentage (0.15 -> "15%")
function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

// Format a value as a multiplier (2.0 -> "2x")
function formatMultiplier(value) {
    return `${value}x`;
}

// Format radians as degrees (Math.PI/3 -> "60°")
function formatDegrees(radians) {
    return `${Math.round((radians * 180) / Math.PI)}°`;
}

// Fill a template string with values from an object
// Supports format modifiers: {key}, {key|percent}, {key|mult}, {key|degrees}
function fillTemplate(template, values) {
    if (!template || typeof template !== 'string') return template;
    
    return template.replace(/\{([^}|]+)(\|([^}]+))?\}/g, (match, key, _, modifier) => {
        const value = values[key];
        
        if (value === undefined || value === null) {
            return match; // Keep placeholder if value not found
        }
        
        // Apply formatting modifier if specified
        if (modifier === 'percent') {
            return formatPercent(value);
        } else if (modifier === 'mult') {
            return formatMultiplier(value);
        } else if (modifier === 'degrees') {
            return formatDegrees(value);
        }
        
        // Default: return value as-is (with basic formatting)
        return typeof value === 'number' ? value.toFixed(1).replace(/\.0$/, '') : value;
    });
}

// ============================================================================

// Nexus room class
class NexusRoom {
    constructor() {
        // Larger nexus size (between combat rooms and old viewport)
        this.width = 1800;
        this.height = 1100;
        
        // NEW LAYOUT: Portal in center, class pads on left, upgrade pads on right
        this.portalPos = {
            x: 900, // Center of nexus horizontally
            y: 550, // Center of nexus vertically
            radius: 60
        };
        
        // Class selection area - left side of portal
        this.classArea = {
            x: 350,
            y: 200,
            width: 350,
            height: 700
        };
        
        // Upgrade area - right side of portal
        this.upgradeArea = {
            x: 1100,
            y: 200,
            width: 350,
            height: 700
        };
        
        // Spawn point - to the left of class selection area
        this.spawnPos = {
            x: 250,
            y: 550
        };
    }
}

// Nexus instance
let nexusRoom = null;

// Class stations - arranged on left side of portal
const classStations = [
    { key: 'square', name: 'Warrior', color: '#4a90e2', x: 450, y: 300 },
    { key: 'triangle', name: 'Rogue', color: '#ff1493', x: 450, y: 450 },
    { key: 'pentagon', name: 'Tank', color: '#c72525', x: 450, y: 600 },
    { key: 'hexagon', name: 'Mage', color: '#673ab7', x: 450, y: 750 }
];

// Upgrade stations - arranged on right side of portal
const upgradeStations = [
    { key: 'damage', name: 'Damage', icon: '⚔', x: 1350, y: 300 },
    { key: 'defense', name: 'Defense', icon: '🛡', x: 1350, y: 450 },
    { key: 'speed', name: 'Speed', icon: '⚡', x: 1350, y: 600 }
];

// Class config mapping (maps class keys to their config objects)
const CLASS_CONFIGS = {
    square: typeof WARRIOR_CONFIG !== 'undefined' ? WARRIOR_CONFIG : null,
    triangle: typeof ROGUE_CONFIG !== 'undefined' ? ROGUE_CONFIG : null,
    pentagon: typeof TANK_CONFIG !== 'undefined' ? TANK_CONFIG : null,
    hexagon: typeof MAGE_CONFIG !== 'undefined' ? MAGE_CONFIG : null
};

// Generate class description by filling templates with actual config values
function getClassDescription(classKey) {
    const config = CLASS_CONFIGS[classKey];
    const classDef = CLASS_DEFINITIONS[classKey];
    
    if (!config || !config.descriptions || !classDef) {
        // Fallback if config not available
        return {
            name: classDef ? classDef.name : 'Unknown',
            playstyle: 'Class information not available',
            basic: '',
            heavy: '',
            special: '',
            passive: '',
            baseStats: ''
        };
    }
    
    // Merge config and class definition for template filling
    // Config comes first (has actual gameplay values), classDef second (visual properties)
    const templateValues = {
        ...config,
        ...classDef
    };
    
    // Fill all description templates
    return {
        name: classDef.name,
        playstyle: fillTemplate(config.descriptions.playstyle, templateValues),
        basic: fillTemplate(config.descriptions.basic, templateValues),
        heavy: fillTemplate(config.descriptions.heavy, templateValues),
        special: fillTemplate(config.descriptions.special, templateValues),
        passive: fillTemplate(config.descriptions.passive, templateValues),
        baseStats: fillTemplate(config.descriptions.baseStats, templateValues)
    };
}

// Legacy static descriptions (kept as fallback, but getClassDescription() is preferred)
const CLASS_DESCRIPTIONS = {
    triangle: {
        name: 'Rogue',
        playstyle: 'High mobility assassin with critical hits',
        basic: 'Quick Stab - Fast triangle projectile',
        heavy: 'Fan of Knives - 7 knives in 60° spread, 2x damage each',
        special: 'Shadow Clones - Creates 2 decoys for 3 seconds',
        passive: 'Backstab - 2x damage from behind, 3 dodge charges',
        baseStats: '15% Base Crit Chance, High Speed'
    },
    square: {
        name: 'Warrior',
        playstyle: 'Balanced melee fighter with defensive options',
        basic: 'Sword Swing - Wide coverage with 4 hitboxes',
        heavy: 'Forward Thrust - Rush 300px forward, 2x damage + knockback',
        special: 'Whirlwind - Spinning blades rotate around player for 2s',
        passive: 'Block Stance - 50% damage reduction when standing still',
        baseStats: '10% Base Defense, Balanced Stats'
    },
    pentagon: {
        name: 'Tank',
        playstyle: 'Crowd control tank with sustain and aggro management',
        basic: 'Hammer Slam - Wide cone attack with life steal on hit',
        heavy: 'Shout - AoE stun + slow, 0.975x damage + aggro spike',
        special: 'Shield Defense - Block for 2.1s, then wave pulse attack',
        passive: 'Retaliatory Knockback - Small knockback when hit',
        baseStats: '20% Base Defense, 150 HP'
    },
    hexagon: {
        name: 'Mage',
        playstyle: 'Ranged attacker with AoE and mobility',
        basic: 'Magic Bolt - Fast projectile attack',
        heavy: 'AoE Blast - 125px radius, 2.7x damage + knockback',
        special: 'Blink + Nova - Teleport 400px with i-frames, leaves decoy',
        passive: 'Range Bonus - Increased damage at range',
        baseStats: 'High Base Damage, Ranged Focus'
    }
};

// Initialize nexus
function initNexus() {
    nexusRoom = new NexusRoom();
    
    // Create player for nexus navigation if doesn't exist
    if (!Game.player) {
        // Create warrior player for nexus (class doesn't matter in nexus)
        Game.player = createPlayer('square', nexusRoom.spawnPos.x, nexusRoom.spawnPos.y);
        if (typeof Game !== 'undefined' && Game.getLocalPlayerId) {
            Game.player.playerId = Game.getLocalPlayerId(); // Set player ID for damage attribution
        }
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
    
    // Don't process input if pause menu or multiplayer menu is visible
    const pauseMenuOpen = Game && (Game.state === 'PAUSED' || Game.showPauseMenu);
    const mpMenuOpen = typeof multiplayerMenuVisible !== 'undefined' && multiplayerMenuVisible;
    
    if (mpMenuOpen) {
        // Still send multiplayer updates even when menu is open
        if (Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            if (multiplayerManager.isHost) {
                multiplayerManager.sendGameState();
            } else {
                multiplayerManager.sendPlayerState();
            }
        }
        return; // Skip all nexus updates when multiplayer menu is open
    }
    
    if (pauseMenuOpen) {
        return; // Skip all nexus updates when pause menu is open
    }
    
    // MULTIPLAYER: Snapshot input BEFORE updating (preserves justPressed/justReleased)
    if (Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && !multiplayerManager.isHost) {
        // Cache input state before Input.update() resets flags
        multiplayerManager.cachedInputSnapshot = multiplayerManager.serializeInput();
    }
    
    // Update input system (for touch controls)
    if (typeof Input !== 'undefined' && Input.update) {
        Input.update(deltaTime);
    }
    
    // Multiplayer: Send player state updates in Nexus
    if (Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
        if (multiplayerManager.isHost) {
            multiplayerManager.sendGameState();
        } else {
            multiplayerManager.sendPlayerState();
        }
    }
    
    // Update player movement in nexus (host-authoritative in multiplayer)
    if (Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
        if (multiplayerManager.isHost) {
            // HOST: Update local player movement
            if (Game.player && Game.player.alive) {
                const moveInput = Input.getMovementInput ? Input.getMovementInput() : { x: 0, y: 0 };
                
                const moveSpeed = 200; // Nexus movement speed
                Game.player.vx = moveInput.x * moveSpeed;
                Game.player.vy = moveInput.y * moveSpeed;
                
                // Update position
                Game.player.x += Game.player.vx * deltaTime;
                Game.player.y += Game.player.vy * deltaTime;
                
                // Keep player in bounds
                Game.player.x = clamp(Game.player.x, Game.player.size, nexusRoom.width - Game.player.size);
                Game.player.y = clamp(Game.player.y, Game.player.size, nexusRoom.height - Game.player.size);
                
                // Calculate rotation to face aim direction
                if (Input.getAimDirection) {
                    Game.player.rotation = Input.getAimDirection();
                } else if (Input.mouse.x !== undefined && Input.mouse.y !== undefined) {
                    // Use world coordinates (nexus now has camera)
                    const worldMouse = Input.getWorldMousePos ? Input.getWorldMousePos() : Input.mouse;
                    const dx = worldMouse.x - Game.player.x;
                    const dy = worldMouse.y - Game.player.y;
                    Game.player.rotation = Math.atan2(dy, dx);
                }
            }
            
            // HOST: Simulate remote player movement in nexus
            if (Game.remotePlayerInstances) {
                Game.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    const rawInput = Game.getRemotePlayerInput(playerId);
                    if (rawInput) {
                        const inputAdapter = Game.createRemoteInputAdapter(rawInput, playerInstance);
                        
                        // Calculate movement based on input type (mobile or desktop)
                        let moveX = 0, moveY = 0;
                        
                        if (rawInput.isTouchMode && rawInput.touchJoysticks && rawInput.touchJoysticks.movement) {
                            // Touch mode: use movement joystick directly
                            const joystick = rawInput.touchJoysticks.movement;
                            if (joystick.active) {
                                moveX = joystick.direction.x * joystick.magnitude;
                                moveY = joystick.direction.y * joystick.magnitude;
                            }
                        } else {
                            // Desktop mode: use WASD/arrow keys
                            if (rawInput.up) moveY -= 1;
                            if (rawInput.down) moveY += 1;
                            if (rawInput.left) moveX -= 1;
                            if (rawInput.right) moveX += 1;
                            
                            // Normalize diagonal movement
                            if (moveX !== 0 && moveY !== 0) {
                                const len = Math.sqrt(moveX * moveX + moveY * moveY);
                                moveX /= len;
                                moveY /= len;
                            }
                        }
                        
                        const moveSpeed = 200; // Nexus movement speed
                        playerInstance.vx = moveX * moveSpeed;
                        playerInstance.vy = moveY * moveSpeed;
                        playerInstance.x += playerInstance.vx * deltaTime;
                        playerInstance.y += playerInstance.vy * deltaTime;
                        
                        // Bounds checking
                        playerInstance.x = clamp(playerInstance.x, playerInstance.size || 25, nexusRoom.width - (playerInstance.size || 25));
                        playerInstance.y = clamp(playerInstance.y, playerInstance.size || 25, nexusRoom.height - (playerInstance.size || 25));
                        
                        // Calculate rotation based on input type
                        if (rawInput.isTouchMode && rawInput.touchJoysticks) {
                            // Touch mode: use joysticks for aim (same priority as local Input)
                            const heavyAttack = rawInput.touchJoysticks.heavyAttack;
                            const specialAbility = rawInput.touchJoysticks.specialAbility;
                            const basicAttack = rawInput.touchJoysticks.basicAttack;
                            
                            if (heavyAttack && heavyAttack.active && heavyAttack.magnitude > 0.1) {
                                playerInstance.rotation = Math.atan2(heavyAttack.direction.y, heavyAttack.direction.x);
                                playerInstance.lastAimAngle = playerInstance.rotation;
                            } else if (specialAbility && specialAbility.active && specialAbility.magnitude > 0.1) {
                                playerInstance.rotation = Math.atan2(specialAbility.direction.y, specialAbility.direction.x);
                                playerInstance.lastAimAngle = playerInstance.rotation;
                            } else if (basicAttack && basicAttack.active && basicAttack.magnitude > 0.1) {
                                playerInstance.rotation = Math.atan2(basicAttack.direction.y, basicAttack.direction.x);
                                playerInstance.lastAimAngle = playerInstance.rotation;
                            } else {
                                // No joystick active: maintain last rotation
                                playerInstance.rotation = playerInstance.lastAimAngle || 0;
                            }
                        } else {
                            // Desktop mode: use mouse position
                            const dx = rawInput.mouse.x - playerInstance.x;
                            const dy = rawInput.mouse.y - playerInstance.y;
                            playerInstance.rotation = Math.atan2(dy, dx);
                        }
                    }
                });
            }
        } else {
            // CLIENT: Interpolate positions for smooth rendering
            // Local player interpolation (position comes from host)
            if (Game.player && Game.player.alive && Game.player.interpolatePosition) {
                Game.player.interpolatePosition(deltaTime);
                
                // Keep player in bounds (interpolation might push them slightly out)
                Game.player.x = clamp(Game.player.x, Game.player.size, nexusRoom.width - Game.player.size);
                Game.player.y = clamp(Game.player.y, Game.player.size, nexusRoom.height - Game.player.size);
            }
            
            // Remote player shadow instances interpolation
            if (Game.remotePlayerShadowInstances) {
                Game.remotePlayerShadowInstances.forEach((shadowInstance, playerId) => {
                    if (shadowInstance && shadowInstance.alive && shadowInstance.interpolatePosition) {
                        shadowInstance.interpolatePosition(deltaTime);
                        
                        // Keep in bounds
                        const size = shadowInstance.size || 25;
                        shadowInstance.x = clamp(shadowInstance.x, size, nexusRoom.width - size);
                        shadowInstance.y = clamp(shadowInstance.y, size, nexusRoom.height - size);
                    }
                });
            }
        }
    } else {
        // SOLO: Update normally
        if (Game.player && Game.player.alive) {
            const moveInput = Input.getMovementInput ? Input.getMovementInput() : { x: 0, y: 0 };
            
            const moveSpeed = 200; // Nexus movement speed
            Game.player.vx = moveInput.x * moveSpeed;
            Game.player.vy = moveInput.y * moveSpeed;
            
            // Update position
            Game.player.x += Game.player.vx * deltaTime;
            Game.player.y += Game.player.vy * deltaTime;
            
            // Keep player in bounds
            Game.player.x = clamp(Game.player.x, Game.player.size, nexusRoom.width - Game.player.size);
            Game.player.y = clamp(Game.player.y, Game.player.size, nexusRoom.height - Game.player.size);
            
            // Calculate rotation to face aim direction
            if (Input.getAimDirection) {
                Game.player.rotation = Input.getAimDirection();
            } else if (Input.mouse.x !== undefined && Input.mouse.y !== undefined) {
                // Use world coordinates (nexus now has camera)
                const worldMouse = Input.getWorldMousePos ? Input.getWorldMousePos() : Input.mouse;
                const dx = worldMouse.x - Game.player.x;
                const dy = worldMouse.y - Game.player.y;
                Game.player.rotation = Math.atan2(dy, dx);
            }
        }
    }
    
    // Handle interactions (G key or interaction button)
    let shouldInteract = false;
    
    // Check keyboard input (or interaction button simulated G key)
    if (Input.getKeyState('g') && !Game.lastGKeyState) {
        Game.lastGKeyState = true;
        shouldInteract = true;
        console.log('[NEXUS] G key pressed - shouldInteract = true');
    } else if (!Input.getKeyState('g')) {
        Game.lastGKeyState = false;
    }
    
    if (shouldInteract) {
        console.log('[NEXUS] Processing interactions - shouldInteract:', shouldInteract);
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
                
                // Multiplayer: Send class change to other players
                if (Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
                    if (multiplayerManager.isHost) {
                        // Host: Immediately send state update so clients see class change
                        multiplayerManager.sendGameState();
                    } else {
                        // Client: Send state update so host knows our class
                        multiplayerManager.sendPlayerState();
                    }
                }
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
        
        console.log('[NEXUS] Portal check - distance:', portalDistance.toFixed(2), 'selectedClass:', Game.selectedClass, 'player pos:', Game.player.x.toFixed(0), Game.player.y.toFixed(0));
        
        if (portalDistance < 60 && Game.selectedClass) {
            console.log('[NEXUS] ⚠️ PORTAL TRIGGERED! Starting game...');
            // Check multiplayer mode
            const inLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
            
            if (inLobby) {
                // Only host can start the game in multiplayer
                if (multiplayerManager.isHost) {
                    multiplayerManager.startGame();
                    Game.startGame();
                }
            } else {
                // Single player - start normally
                Game.startGame();
            }
        }
    }
    
    // Update nexus camera to follow player
    if (typeof Game !== 'undefined' && Game.updateNexusCamera) {
        Game.updateNexusCamera(deltaTime);
    }
}

// Render class station tooltip when player is near
function renderClassStationTooltip(ctx, player, station) {
    if (!player || !player.alive || !station || !nexusRoom) return;
    
    const dx = station.x - player.x;
    const dy = station.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Show tooltip within interaction range (50 pixels, same as interaction check)
    if (distance < 50) {
        // Use dynamic description generator instead of static CLASS_DESCRIPTIONS
        const classDesc = getClassDescription(station.key);
        if (!classDesc) return;
        
        // Calculate tooltip dimensions based on content
        const padding = 12;
        const topPadding = 18; // Extra padding at top to avoid cramped text
        const titleHeight = 24;
        const playstyleHeight = 18;
        const abilityHeight = 16;
        const abilityCount = 5; // Now includes baseStats line
        const spacing = 4;
        
        const tooltipHeight = titleHeight + playstyleHeight + (abilityHeight * abilityCount) + (spacing * (abilityCount - 1)) + topPadding + padding;
        const tooltipWidth = 400; // Wider to fit ability descriptions without overflow
        
        // Check if mobile/touch mode
        const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
        
        // Calculate initial position (above station)
        let tooltipX = station.x;
        // For mobile, position higher and further to the right to avoid joystick
        if (isMobile) {
            tooltipX = station.x + 180; // Shift further right to avoid left-side joystick
            tooltipY = station.y - 60 - 120; // Position even higher on mobile
        } else {
            tooltipY = station.y - 60 - 20; // Above station (60 is station height, 20 is gap)
        }
        
        // Check bounds and adjust positioning
        const minX = tooltipWidth / 2 + padding;
        const maxX = nexusRoom.width - tooltipWidth / 2 - padding;
        const minY = tooltipHeight / 2 + padding;
        // For mobile, reserve space at bottom for joystick (avoid bottom 200px)
        const maxY = isMobile ? nexusRoom.height - tooltipHeight / 2 - 200 - padding : nexusRoom.height - tooltipHeight / 2 - padding;
        
        // Adjust horizontal position to stay within bounds
        if (tooltipX < minX) {
            tooltipX = minX;
        } else if (tooltipX > maxX) {
            tooltipX = maxX;
        }
        
        // Adjust vertical position - if tooltip would overflow top, position below station (but not on mobile)
        const stationBottom = station.y + 30; // Station is 60 tall, center at station.y
        if (tooltipY - tooltipHeight / 2 < minY) {
            if (!isMobile) {
                // Position below station instead (desktop only)
                tooltipY = stationBottom + 20 + tooltipHeight / 2;
                // Make sure it doesn't overflow bottom either
                if (tooltipY + tooltipHeight / 2 > maxY) {
                    tooltipY = maxY;
                }
            } else {
                // On mobile, just clamp to minimum Y
                tooltipY = minY + tooltipHeight / 2;
            }
        } else if (tooltipY + tooltipHeight / 2 > maxY) {
            // Tooltip would overflow bottom, position it higher
            tooltipY = maxY;
        }
        
        // Draw tooltip background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(tooltipX - tooltipWidth / 2, tooltipY - tooltipHeight / 2, tooltipWidth, tooltipHeight);
        
        // Draw border
        ctx.strokeStyle = station.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(tooltipX - tooltipWidth / 2, tooltipY - tooltipHeight / 2, tooltipWidth, tooltipHeight);
        
        // Draw text
        let currentY = tooltipY - tooltipHeight / 2 + topPadding;
        
        // Class name (bold, larger)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(classDesc.name, tooltipX, currentY);
        currentY += titleHeight;
        
        // Playstyle/description
        ctx.font = '14px Arial';
        ctx.fillStyle = '#cccccc';
        ctx.fillText(classDesc.playstyle, tooltipX, currentY);
        currentY += playstyleHeight + spacing;
        
        // Abilities
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        
        // Basic attack
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Arial';
        ctx.fillText('Basic:', tooltipX - tooltipWidth / 2 + padding, currentY);
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '13px Arial';
        ctx.fillText(classDesc.basic, tooltipX - tooltipWidth / 2 + padding + 55, currentY);
        currentY += abilityHeight + spacing;
        
        // Heavy attack
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Arial';
        ctx.fillText('Heavy:', tooltipX - tooltipWidth / 2 + padding, currentY);
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '13px Arial';
        ctx.fillText(classDesc.heavy, tooltipX - tooltipWidth / 2 + padding + 55, currentY);
        currentY += abilityHeight + spacing;
        
        // Special ability
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Arial';
        ctx.fillText('Special:', tooltipX - tooltipWidth / 2 + padding, currentY);
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '13px Arial';
        ctx.fillText(classDesc.special, tooltipX - tooltipWidth / 2 + padding + 55, currentY);
        currentY += abilityHeight + spacing;
        
        // Passive
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Arial';
        ctx.fillText('Passive:', tooltipX - tooltipWidth / 2 + padding, currentY);
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '13px Arial';
        ctx.fillText(classDesc.passive, tooltipX - tooltipWidth / 2 + padding + 55, currentY);
        currentY += abilityHeight + spacing;
        
        // Base stats (NEW)
        if (classDesc.baseStats) {
            ctx.fillStyle = '#ffdd88';
            ctx.font = 'bold 13px Arial';
            ctx.fillText('Bonus:', tooltipX - tooltipWidth / 2 + padding, currentY);
            ctx.fillStyle = '#ffaa55';
            ctx.font = '13px Arial';
            ctx.fillText(classDesc.baseStats, tooltipX - tooltipWidth / 2 + padding + 55, currentY);
        }
    }
}

// Render simplified remote player visuals in the Nexus using interpolation-friendly data
function renderNexusRemotePlayer(ctx, options) {
    if (!ctx || !options) return;
    
    const {
        x,
        y,
        rotation = 0,
        classKey = 'square',
        name = 'Player',
        size = 20
    } = options;
    
    if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(x) || Number.isNaN(y)) {
        return;
    }
    
    const classDef = CLASS_DEFINITIONS[classKey] || CLASS_DEFINITIONS.square;
    const playerShape = classDef.shape || 'square';
    const playerColor = classDef.color || '#888888';
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = playerColor;
    
    if (playerShape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.5, -size * 0.866);
        ctx.lineTo(-size * 0.5, size * 0.866);
        ctx.closePath();
        ctx.fill();
    } else if (playerShape === 'hexagon') {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = Math.cos(angle) * size;
            const py = Math.sin(angle) * size;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    } else if (playerShape === 'pentagon') {
        const rotationOffset = 18 * Math.PI / 180;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 / 5) * i - Math.PI / 2 + rotationOffset;
            const px = Math.cos(angle) * size;
            const py = Math.sin(angle) * size;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.rect(-size * 0.8, -size * 0.8, size * 1.6, size * 1.6);
        ctx.fill();
    }
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (playerShape === 'pentagon') {
        const rotationOffset = 18 * Math.PI / 180;
        const vertexIndex = 1;
        const vertexAngle = (Math.PI * 2 / 5) * vertexIndex - Math.PI / 2 + rotationOffset;
        const indicatorDistance = size * 0.7;
        const indicatorX = Math.cos(vertexAngle) * indicatorDistance;
        const indicatorY = Math.sin(vertexAngle) * indicatorDistance;
        ctx.arc(indicatorX, indicatorY, 5, 0, Math.PI * 2);
    } else {
        ctx.arc(Math.cos(0) * (size - 5), Math.sin(0) * (size - 5), 5, 0, Math.PI * 2);
    }
    ctx.fill();
    
    ctx.restore();
    
    if (name) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(name, x, y - size - 10);
    }
}

// Helper to retrieve stored remote player metadata (class, name, etc.)
function getRemotePlayerMeta(playerId) {
    if (typeof Game === 'undefined' || !Game || !Array.isArray(Game.remotePlayers)) {
        return null;
    }
    return Game.remotePlayers.find(playerData => playerData && playerData.id === playerId) || null;
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
        // Check if multiplayer mode
        if (Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.connected) {
            // Multiplayer: Send purchase request to host
            if (multiplayerManager.isHost) {
                // Host: Process directly
                const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
                if (localPlayerId) {
                    // Process upgrade purchase locally
                    multiplayerManager.handleUpgradePurchase({
                        playerId: localPlayerId,
                        classType: classType,
                        statType: statType
                    });
                }
            } else {
                // Client: Send request to host via server
                multiplayerManager.send({
                    type: 'upgrade_purchase',
                    data: {
                        classType: classType,
                        statType: statType
                    }
                });
                console.log(`[Multiplayer] Sent upgrade purchase request: ${classType} ${statType}`);
            }
        } else {
            // Single-player: Process immediately
            SaveSystem.incrementUpgrade(classType, statType);
            SaveSystem.setCurrency(Game.currentCurrency - cost);
            Game.currentCurrency = SaveSystem.getCurrency();
            
            // Update player stats if this is the current class
            // Recreate player instance to apply new upgrade stats (loaded in constructor)
            if (Game.player && Game.selectedClass === classType) {
                const currentX = Game.player.x;
                const currentY = Game.player.y;
                const currentPlayerId = Game.player.playerId; // Preserve player ID
                Game.player = createPlayer(classType, currentX, currentY);
                Game.player.playerId = currentPlayerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);
                console.log(`[Single-player] Recreated player to apply upgrade stats`);
            }
            
            console.log(`Upgraded ${classType} ${statType} to level ${currentLevel + 1}`);
        }
    } else {
        console.log(`Not enough currency! Need ${cost}, have ${Game.currentCurrency}`);
    }
}

// Render nexus
function renderNexus(ctx) {
    if (!nexusRoom) {
        initNexus();
    }
    
    // Clear canvas with base color (outside camera transform)
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Apply nexus camera transform with zoom
    ctx.save();
    if (typeof Game !== 'undefined' && Game.nexusCamera) {
        // Detect if desktop (for zoom)
        const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
        const currentZoom = isMobile ? 1.0 : (Game.baseZoom || 1.1); // Desktop: 1.1x zoom
        
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(currentZoom, currentZoom);
        ctx.translate(-Game.nexusCamera.x, -Game.nexusCamera.y);
    }
    
    // Render background fill (in world space)
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, nexusRoom.width, nexusRoom.height);
    
    // Render subtle grid pattern (in world space - fixed to floor)
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
        
        // Draw interaction prompt (only show in desktop mode, moved down to avoid overlap)
        if (isNear && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
            ctx.fillStyle = '#ffff00';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Press G to select', station.x, station.y + 45);
        }
    });
    
    // Render class station tooltips (when player is near)
    if (Game.player && Game.player.alive) {
        classStations.forEach(station => {
            renderClassStationTooltip(ctx, Game.player, station);
        });
    }
    
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
            
            // Draw interaction prompt (only show in desktop mode, moved down to avoid overlap)
            if (isNear && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
                ctx.fillStyle = '#ffff00';
                ctx.font = '12px Arial';
                ctx.fillText('Press G to upgrade', station.x, station.y + 55);
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
    
    // Portal interaction prompt (only show in desktop mode, moved down to avoid overlap)
    if (isNearPortal && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
        const inLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        
        if (portalActive) {
            if (inLobby && !multiplayerManager.isHost) {
                ctx.fillStyle = '#ff6666';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Only host can start', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 70);
            } else {
                ctx.fillStyle = '#ffff00';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Press G to enter portal', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 70);
            }
        } else {
            ctx.fillStyle = '#ff6666';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Select a class first', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 70);
        }
    }
    
    // Render multiplayer lobby status (top of screen)
    const inLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
    if (inLobby) {
        const panelWidth = 350;
        const panelHeight = 120;
        const panelX = (nexusRoom.width - panelWidth) / 2;
        const panelY = 20;
        
        // Panel background
        ctx.fillStyle = 'rgba(30, 30, 50, 0.9)';
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        // Panel border
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // Title
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('MULTIPLAYER LOBBY', panelX + panelWidth / 2, panelY + 30);
        
        // Lobby code
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(`Code: ${multiplayerManager.lobbyCode}`, panelX + panelWidth / 2, panelY + 60);
        
        // Players count
        const playerCount = multiplayerManager.players ? multiplayerManager.players.length : 1;
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.fillText(`Players: ${playerCount}/${MultiplayerConfig.MAX_PLAYERS}`, panelX + panelWidth / 2, panelY + 85);
        
        // Host indicator
        if (multiplayerManager.isHost) {
            ctx.fillStyle = '#ffaa00';
            ctx.font = 'bold 14px Arial';
            ctx.fillText('(You are the host)', panelX + panelWidth / 2, panelY + 105);
        } else {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '14px Arial';
            ctx.fillText('(Waiting for host...)', panelX + panelWidth / 2, panelY + 105);
        }
    }
    
    // Render player with class shape
    if (Game.player && Game.player.alive) {
        const selectedClass = Game.selectedClass;
        const classDef = selectedClass ? CLASS_DEFINITIONS[selectedClass] : null;
        const playerColor = classDef ? classDef.color : '#888888';
        const playerShape = classDef ? classDef.shape : 'square';
        const playerSize = Game.player.size;
        
        ctx.save();
        ctx.translate(Game.player.x, Game.player.y);
        ctx.rotate(Game.player.rotation);
        ctx.fillStyle = playerColor;
        
        // Draw player shape based on class (same as gameplay)
        if (playerShape === 'triangle') {
            // Draw triangle with tip pointing right (forward direction)
            ctx.beginPath();
            ctx.moveTo(playerSize, 0);  // Tip pointing right
            ctx.lineTo(-playerSize * 0.5, -playerSize * 0.866);  // Top back
            ctx.lineTo(-playerSize * 0.5, playerSize * 0.866);  // Bottom back
            ctx.closePath();
            ctx.fill();
        } else if (playerShape === 'hexagon') {
            // Draw hexagon
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const px = Math.cos(angle) * playerSize;
                const py = Math.sin(angle) * playerSize;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else if (playerShape === 'pentagon') {
            // Draw pentagon - rotated clockwise by 18° so a vertex points forward (0°)
            // Vertex index 1 (originally at -18°) becomes 0° when rotated +18°
            // This means a vertex (not a flat edge) points forward - the base is rotated
            const rotationOffset = 18 * Math.PI / 180; // 18 degrees clockwise
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 / 5) * i - Math.PI / 2 + rotationOffset;
                const px = Math.cos(angle) * playerSize;
                const py = Math.sin(angle) * playerSize;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            // Default to square/rectangle
            ctx.beginPath();
            ctx.rect(-playerSize * 0.8, -playerSize * 0.8, playerSize * 1.6, playerSize * 1.6);
            ctx.fill();
        }
        
        // Draw direction indicator
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        
        // For pentagon, align indicator with the front vertex
        if (playerShape === 'pentagon') {
            // After rotating the pentagon by +18°, vertex index 1 is at 0° (forward/right)
            const rotationOffset = 18 * Math.PI / 180;
            const vertexIndex = 1; // The vertex that points forward after rotation
            const vertexAngle = (Math.PI * 2 / 5) * vertexIndex - Math.PI / 2 + rotationOffset;
            
            // Position indicator on the vertex, inside the shape at the tip
            const indicatorDistance = playerSize * 0.7; // Inside the shape, at 70% of size
            const indicatorX = Math.cos(vertexAngle) * indicatorDistance;
            const indicatorY = Math.sin(vertexAngle) * indicatorDistance;
            ctx.arc(indicatorX, indicatorY, 5, 0, Math.PI * 2);
        } else {
            // For other shapes, use standard front position
            ctx.arc(
                Math.cos(0) * (playerSize - 5),
                Math.sin(0) * (playerSize - 5),
                5, 0, Math.PI * 2
            );
        }
        ctx.fill();
        
        ctx.restore();
    }
    
    // Render remote players (multiplayer) in the Nexus
    const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager;
    if (inMultiplayer) {
        if (multiplayerManager.isHost && Game.remotePlayerInstances && Game.remotePlayerInstances.size > 0) {
            Game.remotePlayerInstances.forEach((playerInstance, playerId) => {
                if (!playerInstance || playerInstance.dead || !playerInstance.alive) {
                    return;
                }
                
                const meta = getRemotePlayerMeta(playerId);
                const classKey = playerInstance.playerClass || (meta ? meta.class : null) || 'square';
                
                renderNexusRemotePlayer(ctx, {
                    x: playerInstance.x,
                    y: playerInstance.y,
                    rotation: playerInstance.rotation || 0,
                    classKey,
                    name: meta ? meta.name : 'Player'
                });
            });
        } else if (!multiplayerManager.isHost && Game.remotePlayerShadowInstances && Game.remotePlayerShadowInstances.size > 0) {
            Game.remotePlayerShadowInstances.forEach((shadowInstance, playerId) => {
                if (!shadowInstance || shadowInstance.dead || !shadowInstance.alive) {
                    return;
                }
                
                const meta = getRemotePlayerMeta(playerId);
                const classKey = (meta ? meta.class : null) || shadowInstance.playerClass || shadowInstance.classType || 'square';
                
                renderNexusRemotePlayer(ctx, {
                    x: shadowInstance.x,
                    y: shadowInstance.y,
                    rotation: shadowInstance.rotation || 0,
                    classKey,
                    name: meta ? meta.name : 'Player'
                });
            });
        } else if (Game.remotePlayers && Game.remotePlayers.length > 0) {
            Game.remotePlayers.forEach(remotePlayer => {
                if (!remotePlayer || remotePlayer.dead) {
                    return;
                }
                
                renderNexusRemotePlayer(ctx, {
                    x: remotePlayer.x,
                    y: remotePlayer.y,
                    rotation: remotePlayer.rotation || 0,
                    classKey: remotePlayer.class || 'square',
                    name: remotePlayer.name || 'Player'
                });
            });
        }
    }
    
    // Restore context after camera transform
    ctx.restore();
    
    // Render touch controls overlay (same as gameplay) - screen space
    if (typeof renderTouchControls === 'function') {
        renderTouchControls(ctx);
    }
    
    // Render interaction button (on top of touch controls) - screen space
    if (typeof renderInteractionButton === 'function') {
        renderInteractionButton(ctx);
    }
    
    // Pause button is now handled by DOM UI (pauseButton.js)
    // Only render canvas pause button if DOM UI is disabled
    if (!window.USE_DOM_UI && typeof renderPauseButton === 'function') {
        renderPauseButton(ctx);
    }
}


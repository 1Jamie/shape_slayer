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

        // NEW COMPACT LAYOUT: Single portal in center with mode switcher above it
        // Mode switcher machine - above the portal
        this.modeSwitcherPos = {
            x: 900, // Center of nexus
            y: 350, // Above the portal
            width: 120,
            height: 80
        };

        this.portalPos = {
            x: 900, // Center of nexus horizontally
            y: 600, // Below mode switcher, more vertically centered
            radius: 60
        };

        // Portal mode state - defaults to 'gear'
        this.portalMode = 'gear'; // Can be 'cards' or 'gear'

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

        // Spawn point - left side, vertically centered
        this.spawnPos = {
            x: 300,
            y: 550
        };

        // Index machine - bottom center of nexus
        this.indexMachinePos = {
            x: 900, // Center of nexus horizontally
            y: 1000, // Near bottom
            width: 120,
            height: 80
        };
    }
}

// Nexus instance
let nexusRoom = null;

// Class stations - centered horizontally in nexus
// Nexus width is 1800, center is 900. Stations span 750px (400 to 1150), so center at 775
// Need to shift 125px right to center at 900
const classStations = [
    { key: 'square', name: 'Warrior', color: '#4a90e2', x: 525, y: 200 },
    { key: 'triangle', name: 'Rogue', color: '#ff1493', x: 775, y: 200 },
    { key: 'pentagon', name: 'Tank', color: '#c72525', x: 1025, y: 200 },
    { key: 'hexagon', name: 'Mage', color: '#673ab7', x: 1275, y: 200 }
];

// Upgrade stations - arranged in two columns of three, centered where single column used to be
// Each station is 120px wide (60px on each side of center), so columns touch at edges
const upgradeStations = [
    // Left column (right edge at x: 340)
    { key: 'damage', name: 'Damage', icon: '⚔', x: 280, y: 450 },
    { key: 'defense', name: 'Defense', icon: '🛡', x: 280, y: 600 },
    { key: 'speed', name: 'Speed', icon: '⚡', x: 280, y: 750 },
    // Right column (left edge at x: 340, touching left column)
    { key: 'cooldown', name: 'Cooldown', icon: '⏱', x: 400, y: 450 },
    { key: 'health', name: 'Health', icon: '❤', x: 400, y: 600 },
    { key: 'attackSpeed', name: 'Attack Speed', icon: '💨', x: 400, y: 750 }
];

// Room modifier station - aligned with upgrade machines
const roomModifierStation = {
    key: 'roomModifiers',
    name: 'Room Modifiers',
    icon: '🎴',
    x: 1450,
    y: 450
};

// Deck builder station - aligned with upgrade machines
const deckBuilderStation = {
    key: 'deckBuilder',
    name: 'Deck Builder',
    icon: '🃏',
    x: 1450,
    y: 600
};

// Mastery system station - aligned with upgrade machines
const masteryStation = {
    key: 'mastery',
    name: 'Mastery',
    icon: '⭐',
    x: 1450,
    y: 750
};

// Deck upgrades station - aligned with upgrade machines
const deckUpgradeStation = {
    key: 'deckUpgrades',
    name: 'Deck Upgrades',
    icon: '⬆',
    x: 1450,
    y: 300
};

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
        // Create player with the selected class (or default to warrior if none selected)
        const classToUse = Game.selectedClass || 'square';
        console.log(`[NEXUS INIT] Creating player with class: ${classToUse}`);
        Game.player = createPlayer(classToUse, nexusRoom.spawnPos.x, nexusRoom.spawnPos.y);
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

                const moveSpeed = 300; // Nexus movement speed (1.5x faster)
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

                        const moveSpeed = 300; // Nexus movement speed (1.5x faster)
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

            const moveSpeed = 300; // Nexus movement speed (1.5x faster)
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
    let interactionHandled = false;

    // Check keyboard input (or interaction button simulated G key)
    if (Input.getKeyState('g') && !Game.lastGKeyState) {
        Game.lastGKeyState = true;
        shouldInteract = true;
    } else if (!Input.getKeyState('g')) {
        Game.lastGKeyState = false;
    }

    if (shouldInteract) {

        // Check class station interactions
        classStations.forEach(station => {
            const dx = station.x - Game.player.x;
            const dy = station.y - Game.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 50 && !interactionHandled) {
                // Select this class
                Game.selectedClass = station.key;
                if (typeof SaveSystem !== 'undefined') {
                    SaveSystem.setSelectedClass(station.key);
                }

                // Recreate the player in the nexus with the selected class
                // This ensures the HUD and other systems initialize correctly for the selected class
                if (Game.player) {
                    const currentX = Game.player.x;
                    const currentY = Game.player.y;
                    const currentPlayerId = Game.player.playerId;
                    Game.player = createPlayer(station.key, currentX, currentY);
                    Game.player.playerId = currentPlayerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);
                }

                interactionHandled = true;

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
        if (Game.selectedClass && !interactionHandled) {
            upgradeStations.forEach(station => {
                const dx = station.x - Game.player.x;
                const dy = station.y - Game.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 50 && !interactionHandled) {
                    purchaseUpgrade(Game.selectedClass, station.key);
                    interactionHandled = true;
                }
            });
        }

        // Check room modifier station interaction
        if (!interactionHandled) {
            const modDx = roomModifierStation.x - Game.player.x;
            const modDy = roomModifierStation.y - Game.player.y;
            const modDistance = Math.sqrt(modDx * modDx + modDy * modDy);

            if (modDistance < 50) {
                // Open room modifier selection UI
                if (typeof Game !== 'undefined' && typeof SaveSystem !== 'undefined') {
                    const save = SaveSystem.load();
                    const collection = Array.isArray(save.roomModifierCollection) ? save.roomModifierCollection : [];
                    const slots = (SaveSystem.getDeckUpgrades ? (SaveSystem.getDeckUpgrades().roomModifierCarrySlots || 3) : 3);

                    // Initialize selected modifiers if not set
                    if (!Array.isArray(Game.selectedRoomModifiers)) {
                        Game.selectedRoomModifiers = [];
                    }

                    // Toggle showing selection UI
                    Game.showingRoomModifierSelection = !Game.showingRoomModifierSelection;
                    interactionHandled = true;
                }
            }
        }

        // Check deck builder station interaction
        if (!interactionHandled) {
            const deckDx = deckBuilderStation.x - Game.player.x;
            const deckDy = deckBuilderStation.y - Game.player.y;
            const deckDistance = Math.sqrt(deckDx * deckDx + deckDy * deckDy);

            if (deckDistance < 50) {
                // Open deck builder UI
                if (typeof window !== 'undefined' && typeof window.toggleDeckBuilder === 'function') {
                    window.toggleDeckBuilder();
                    interactionHandled = true;
                }
            }
        }

        // Check mastery station interaction
        if (!interactionHandled) {
            const masteryDx = masteryStation.x - Game.player.x;
            const masteryDy = masteryStation.y - Game.player.y;
            const masteryDistance = Math.sqrt(masteryDx * masteryDx + masteryDy * masteryDy);

            if (masteryDistance < 50) {
                // Open mastery system UI
                if (typeof window !== 'undefined' && typeof window.toggleMasterySystem === 'function') {
                    window.toggleMasterySystem();
                    interactionHandled = true;
                }
            }
        }

        // Check deck upgrades station interaction
        if (!interactionHandled) {
            const upgradeDx = deckUpgradeStation.x - Game.player.x;
            const upgradeDy = deckUpgradeStation.y - Game.player.y;
            const upgradeDistance = Math.sqrt(upgradeDx * upgradeDx + upgradeDy * upgradeDy);

            if (upgradeDistance < 50) {
                // Open deck upgrades UI
                if (typeof window !== 'undefined' && typeof window.toggleDeckUpgrades === 'function') {
                    window.toggleDeckUpgrades();
                    interactionHandled = true;
                }
            }
        }

        // Check index machine interaction
        if (!interactionHandled) {
            const indexDx = nexusRoom.indexMachinePos.x - Game.player.x;
            const indexDy = nexusRoom.indexMachinePos.y - Game.player.y;
            const indexDistance = Math.sqrt(indexDx * indexDx + indexDy * indexDy);

            if (indexDistance < 50) {
                // Open index machine UI
                if (typeof window !== 'undefined' && typeof window.UIIndexMachine !== 'undefined' && typeof window.UIIndexMachine.open === 'function') {
                    window.UIIndexMachine.open();
                    interactionHandled = true;
                }
            }
        }
    }

    // Check mode switcher interaction
    const switcherDx = nexusRoom.modeSwitcherPos.x - Game.player.x;
    const switcherDy = nexusRoom.modeSwitcherPos.y - Game.player.y;
    const switcherDistance = Math.sqrt(switcherDx * switcherDx + switcherDy * switcherDy);
    const isNearSwitcher = switcherDistance < 60;

    // Check if in multiplayer lobby
    const inMultiplayerLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;

    if (isNearSwitcher && shouldInteract && !interactionHandled) {
        if (inMultiplayerLobby) {
            // Cannot switch modes in multiplayer - mode is locked to gear
            console.log('[Nexus] Cannot switch modes in multiplayer lobby');
            // Don't set interactionHandled so other interactions can still work
        } else {
            // Toggle portal mode (single player only)
            nexusRoom.portalMode = nexusRoom.portalMode === 'cards' ? 'gear' : 'cards';
            console.log(`[Nexus] Switched portal mode to: ${nexusRoom.portalMode}`);
            interactionHandled = true;
        }
    }

    // Check portal interaction
    const portalDx = nexusRoom.portalPos.x - Game.player.x;
    const portalDy = nexusRoom.portalPos.y - Game.player.y;
    const portalDistance = Math.sqrt(portalDx * portalDx + portalDy * portalDy);

    if (portalDistance < 60 && Game.selectedClass && shouldInteract && !interactionHandled) {
        // Set game mode based on portal mode and start game
        console.log(`[Nexus] Entering ${nexusRoom.portalMode === 'cards' ? 'Card' : 'Gear'} Mode portal`);
        Game.gameMode = nexusRoom.portalMode;

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
        interactionHandled = true;
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
        const titleHeight = 26; // Increased for larger bold font
        const playstyleHeight = 20; // Increased for larger bold font
        const abilityHeight = 18; // Increased for larger bold font
        const abilityCount = 5; // Now includes baseStats line
        const spacing = 5; // Slightly more spacing

        const tooltipHeight = titleHeight + playstyleHeight + (abilityHeight * abilityCount) + (spacing * (abilityCount - 1)) + topPadding + padding;
        const tooltipWidth = 450; // Wider to fit ability descriptions with Orbitron font

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

        // Round coordinates to avoid sub-pixel rendering artifacts
        const tooltipXRounded = Math.round(tooltipX - tooltipWidth / 2);
        const tooltipYRounded = Math.round(tooltipY - tooltipHeight / 2);

        // Draw tooltip background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(tooltipXRounded, tooltipYRounded, tooltipWidth, tooltipHeight);

        // Draw border
        ctx.strokeStyle = station.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(tooltipXRounded, tooltipYRounded, tooltipWidth, tooltipHeight);

        // Draw text
        let currentY = tooltipY - tooltipHeight / 2 + topPadding;

        // Class name (bold, larger)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(classDesc.name, tooltipX, currentY);
        currentY += titleHeight;

        // Playstyle/description
        ctx.font = 'bold 15px Orbitron';
        ctx.fillStyle = '#cccccc';
        ctx.fillText(classDesc.playstyle, tooltipX, currentY);
        currentY += playstyleHeight + spacing;

        // Abilities
        ctx.font = 'bold 13px Orbitron';
        ctx.textAlign = 'left';

        // Basic attack
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillText('Basic:', tooltipX - tooltipWidth / 2 + padding, currentY);
        ctx.fillStyle = '#aaaaaa';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillText(classDesc.basic, tooltipX - tooltipWidth / 2 + padding + 60, currentY);
        currentY += abilityHeight + spacing;

        // Heavy attack
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillText('Heavy:', tooltipX - tooltipWidth / 2 + padding, currentY);
        ctx.fillStyle = '#aaaaaa';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillText(classDesc.heavy, tooltipX - tooltipWidth / 2 + padding + 60, currentY);
        currentY += abilityHeight + spacing;

        // Special ability
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillText('Special:', tooltipX - tooltipWidth / 2 + padding, currentY);
        ctx.fillStyle = '#aaaaaa';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillText(classDesc.special, tooltipX - tooltipWidth / 2 + padding + 60, currentY);
        currentY += abilityHeight + spacing;

        // Passive
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillText('Passive:', tooltipX - tooltipWidth / 2 + padding, currentY);
        ctx.fillStyle = '#aaaaaa';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillText(classDesc.passive, tooltipX - tooltipWidth / 2 + padding + 60, currentY);
        currentY += abilityHeight + spacing;

        // Base stats (NEW)
        if (classDesc.baseStats) {
            ctx.fillStyle = '#ffdd88';
            ctx.font = 'bold 14px Orbitron';
            ctx.fillText('Bonus:', tooltipX - tooltipWidth / 2 + padding, currentY);
            ctx.fillStyle = '#ffaa55';
            ctx.font = 'bold 14px Orbitron';
            ctx.fillText(classDesc.baseStats, tooltipX - tooltipWidth / 2 + padding + 60, currentY);
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
        ctx.font = 'bold 12px Orbitron';
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
        const currentZoom = isMobile ? (Game.mobileZoom || 1.0) : (Game.baseZoom || 1.1); // Desktop: 1.1x zoom, Mobile: zoom out for 21:9

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
    ctx.font = 'bold 24px Orbitron';
    ctx.textAlign = 'center';
    // CLASSES label - centered above the horizontal class row
    ctx.fillText('CLASSES', 900, 160);
    // UPGRADES label - above the left upgrade column
    ctx.fillText('UPGRADES', 350, 380);
    // CARD SYSTEMS label - above the right card systems column (aligned with UPGRADES label)
    ctx.fillText('CARD SYSTEMS', 1450, 380);

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

        // Draw station background (round coordinates to avoid sub-pixel rendering artifacts)
        const classStationX = Math.round(station.x - 60);
        const classStationY = Math.round(station.y - 30);
        ctx.fillStyle = isSelected ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)';
        if (isNear) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        }
        ctx.fillRect(classStationX, classStationY, 120, 60);

        // Draw border
        ctx.strokeStyle = isSelected ? '#ffff00' : station.color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(classStationX, classStationY, 120, 60);

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
        ctx.font = 'bold 14px Orbitron';
        ctx.textAlign = 'left';
        ctx.fillText(station.name, station.x + 10, station.y + 5);

        // Draw interaction prompt (only show in desktop mode, moved down to avoid overlap)
        if (isNear && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 12px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText('Press G to select', station.x, station.y + 45);
        }
    });

    // Render room modifier station
    const modDx = roomModifierStation.x - (Game.player ? Game.player.x : 0);
    const modDy = roomModifierStation.y - (Game.player ? Game.player.y : 0);
    const modDistance = Math.sqrt(modDx * modDx + modDy * modDy);
    const modIsNear = modDistance < 50;

    // Round coordinates to avoid sub-pixel rendering artifacts
    const modStationX = Math.round(roomModifierStation.x - 70);
    const modStationY = Math.round(roomModifierStation.y - 30);
    ctx.fillStyle = modIsNear ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(modStationX, modStationY, 140, 60);
    ctx.strokeStyle = '#9c27b0';
    ctx.lineWidth = 2;
    ctx.strokeRect(modStationX, modStationY, 140, 60);

    ctx.fillStyle = '#9c27b0';
    ctx.font = 'bold 24px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(roomModifierStation.icon, roomModifierStation.x, roomModifierStation.y - 5);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    // Split text into two lines if needed
    const modText = roomModifierStation.name;
    const words = modText.split(' ');
    if (words.length > 1) {
        ctx.fillText(words[0], roomModifierStation.x, roomModifierStation.y + 15);
        ctx.fillText(words[1], roomModifierStation.x, roomModifierStation.y + 28);
    } else {
        ctx.fillText(modText, roomModifierStation.x, roomModifierStation.y + 15);
    }

    if (modIsNear && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
        ctx.fillStyle = '#ffff00';
        ctx.font = '12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('Press G to select', roomModifierStation.x, roomModifierStation.y + 45);
    }

    // Render deck builder station
    const deckDx = deckBuilderStation.x - (Game.player ? Game.player.x : 0);
    const deckDy = deckBuilderStation.y - (Game.player ? Game.player.y : 0);
    const deckDistance = Math.sqrt(deckDx * deckDx + deckDy * deckDy);
    const deckIsNear = deckDistance < 50;

    // Round coordinates to avoid sub-pixel rendering artifacts
    const deckStationX = Math.round(deckBuilderStation.x - 60);
    const deckStationY = Math.round(deckBuilderStation.y - 30);
    ctx.fillStyle = deckIsNear ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(deckStationX, deckStationY, 120, 60);
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 2;
    ctx.strokeRect(deckStationX, deckStationY, 120, 60);

    ctx.fillStyle = '#4a90e2';
    ctx.font = 'bold 24px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(deckBuilderStation.icon, deckBuilderStation.x, deckBuilderStation.y - 5);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    const deckWords = deckBuilderStation.name.split(' ');
    if (deckWords.length > 1) {
        ctx.fillText(deckWords[0], deckBuilderStation.x, deckBuilderStation.y + 15);
        ctx.fillText(deckWords[1], deckBuilderStation.x, deckBuilderStation.y + 28);
    } else {
        ctx.fillText(deckBuilderStation.name, deckBuilderStation.x, deckBuilderStation.y + 15);
    }

    if (deckIsNear && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
        ctx.fillStyle = '#ffff00';
        ctx.font = '12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('Press G to select', deckBuilderStation.x, deckBuilderStation.y + 45);
    }

    // Render deck upgrades station
    const upgradeDx = deckUpgradeStation.x - (Game.player ? Game.player.x : 0);
    const upgradeDy = deckUpgradeStation.y - (Game.player ? Game.player.y : 0);
    const upgradeDistance = Math.sqrt(upgradeDx * upgradeDx + upgradeDy * upgradeDy);
    const upgradeIsNear = upgradeDistance < 50;

    // Round coordinates to avoid sub-pixel rendering artifacts
    const deckUpgradeX = Math.round(deckUpgradeStation.x - 60);
    const deckUpgradeY = Math.round(deckUpgradeStation.y - 30);
    ctx.fillStyle = upgradeIsNear ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(deckUpgradeX, deckUpgradeY, 120, 60);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(deckUpgradeX, deckUpgradeY, 120, 60);

    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 24px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(deckUpgradeStation.icon, deckUpgradeStation.x, deckUpgradeStation.y - 5);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    const upgradeWords = deckUpgradeStation.name.split(' ');
    if (upgradeWords.length > 1) {
        ctx.fillText(upgradeWords[0], deckUpgradeStation.x, deckUpgradeStation.y + 15);
        ctx.fillText(upgradeWords[1], deckUpgradeStation.x, deckUpgradeStation.y + 28);
    } else {
        ctx.fillText(deckUpgradeStation.name, deckUpgradeStation.x, deckUpgradeStation.y + 15);
    }

    if (upgradeIsNear && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
        ctx.fillStyle = '#ffff00';
        ctx.font = '12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('Press G to select', deckUpgradeStation.x, deckUpgradeStation.y + 45);
    }

    // Render mastery station
    const masteryDx = masteryStation.x - (Game.player ? Game.player.x : 0);
    const masteryDy = masteryStation.y - (Game.player ? Game.player.y : 0);
    const masteryDistance = Math.sqrt(masteryDx * masteryDx + masteryDy * masteryDy);
    const masteryIsNear = masteryDistance < 50;

    // Round coordinates to avoid sub-pixel rendering artifacts
    const masteryX = Math.round(masteryStation.x - 60);
    const masteryY = Math.round(masteryStation.y - 30);
    ctx.fillStyle = masteryIsNear ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(masteryX, masteryY, 120, 60);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(masteryX, masteryY, 120, 60);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 24px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(masteryStation.icon, masteryStation.x, masteryStation.y - 5);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(masteryStation.name, masteryStation.x, masteryStation.y + 15);

    if (masteryIsNear && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
        ctx.fillStyle = '#ffff00';
        ctx.font = '12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('Press G to select', masteryStation.x, masteryStation.y + 45);
    }

    // Render index machine
    const indexDx = nexusRoom.indexMachinePos.x - (Game.player ? Game.player.x : 0);
    const indexDy = nexusRoom.indexMachinePos.y - (Game.player ? Game.player.y : 0);
    const indexDistance = Math.sqrt(indexDx * indexDx + indexDy * indexDy);
    const indexIsNear = indexDistance < 50;

    // Round coordinates to avoid sub-pixel rendering artifacts
    const indexX = Math.round(nexusRoom.indexMachinePos.x - nexusRoom.indexMachinePos.width / 2);
    const indexY = Math.round(nexusRoom.indexMachinePos.y - nexusRoom.indexMachinePos.height / 2);
    ctx.fillStyle = indexIsNear ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(
        indexX,
        indexY,
        nexusRoom.indexMachinePos.width,
        nexusRoom.indexMachinePos.height
    );
    ctx.strokeStyle = '#9c27b0';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        indexX,
        indexY,
        nexusRoom.indexMachinePos.width,
        nexusRoom.indexMachinePos.height
    );

    ctx.fillStyle = '#9c27b0';
    ctx.font = 'bold 24px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('📚', nexusRoom.indexMachinePos.x, nexusRoom.indexMachinePos.y - 5);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('Index', nexusRoom.indexMachinePos.x, nexusRoom.indexMachinePos.y + 15);

    if (indexIsNear && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
        ctx.fillStyle = '#ffff00';
        ctx.font = '12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('Press G to open', nexusRoom.indexMachinePos.x, nexusRoom.indexMachinePos.y + 45);
    }

    // Render upgrade stations
    if (Game.selectedClass) {
        upgradeStations.forEach(station => {
            const dx = station.x - (Game.player ? Game.player.x : 0);
            const dy = station.y - (Game.player ? Game.player.y : 0);
            const distance = Math.sqrt(dx * dx + dy * dy);
            const isNear = distance < 50;

            // Get current upgrade level
            const upgrades = typeof SaveSystem !== 'undefined' ? SaveSystem.getUpgrades(Game.selectedClass) : { damage: 0, defense: 0, speed: 0, cooldown: 0, health: 0, attackSpeed: 0 };
            const currentLevel = upgrades[station.key] || 0;
            const cost = typeof SaveSystem !== 'undefined' ? SaveSystem.getUpgradeCost(station.key, currentLevel) : 50;
            const canAfford = Game.currentCurrency >= cost;

            // Draw station background (round coordinates to avoid sub-pixel rendering artifacts)
            const stationX = Math.round(station.x - 60);
            const stationY = Math.round(station.y - 40);
            ctx.fillStyle = canAfford && isNear ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(stationX, stationY, 120, 80);

            // Draw border
            ctx.strokeStyle = canAfford ? '#00ff00' : '#666666';
            ctx.lineWidth = 2;
            ctx.strokeRect(stationX, stationY, 120, 80);

            // Draw icon/name
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(station.icon, station.x, station.y - 15);
            ctx.font = 'bold 14px Orbitron';
            ctx.fillText(station.name, station.x, station.y);

            // Draw level
            ctx.font = 'bold 12px Orbitron';
            ctx.fillText(`Level: ${currentLevel}`, station.x, station.y + 15);

            // Draw cost
            ctx.fillStyle = canAfford ? '#00ff00' : '#ff6666';
            ctx.font = 'bold 12px Orbitron';
            ctx.fillText(`Cost: ${cost}`, station.x, station.y + 30);

            // Draw interaction prompt (only show in desktop mode, moved down to avoid overlap)
            if (isNear && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
                ctx.fillStyle = '#ffff00';
                ctx.font = 'bold 12px Orbitron';
                ctx.fillText('Press G to upgrade', station.x, station.y + 55);
            }
        });
    }

    // Render mode switcher machine
    const switcherDx = nexusRoom.modeSwitcherPos.x - (Game.player ? Game.player.x : 0);
    const switcherDy = nexusRoom.modeSwitcherPos.y - (Game.player ? Game.player.y : 0);
    const switcherDistance = Math.sqrt(switcherDx * switcherDx + switcherDy * switcherDy);
    const isNearSwitcher = switcherDistance < 60;

    // Check if in multiplayer lobby
    const inMultiplayerLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
    const isDisabled = inMultiplayerLobby;

    // Round coordinates to avoid sub-pixel rendering artifacts
    const switcherX = Math.round(nexusRoom.modeSwitcherPos.x - nexusRoom.modeSwitcherPos.width / 2);
    const switcherY = Math.round(nexusRoom.modeSwitcherPos.y - nexusRoom.modeSwitcherPos.height / 2);

    // Machine body (grayed out if disabled)
    ctx.fillStyle = isDisabled ? '#222222' : '#444444';
    ctx.fillRect(
        switcherX,
        switcherY,
        nexusRoom.modeSwitcherPos.width,
        nexusRoom.modeSwitcherPos.height
    );

    // Machine border (grayed out if disabled)
    ctx.strokeStyle = isDisabled ? '#444444' : '#888888';
    ctx.lineWidth = 3;
    ctx.strokeRect(
        switcherX,
        switcherY,
        nexusRoom.modeSwitcherPos.width,
        nexusRoom.modeSwitcherPos.height
    );

    // Mode indicator light - shows current portal mode (dimmed if disabled)
    const lightColor = nexusRoom.portalMode === 'cards' ? '#66ccff' : '#ff8844';
    const lightPulse = isDisabled ? 0.3 : (0.7 + Math.sin(Date.now() * 0.003) * 0.3);
    ctx.fillStyle = isDisabled ? '#555555' : lightColor;
    ctx.globalAlpha = lightPulse;
    ctx.beginPath();
    ctx.arc(nexusRoom.modeSwitcherPos.x, nexusRoom.modeSwitcherPos.y - 15, 12, 0, Math.PI * 2);
    ctx.fill();
    // Reset alpha and ensure no bleeding
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    // Mode text on machine (grayed out if disabled)
    ctx.fillStyle = isDisabled ? '#666666' : '#ffffff';
    ctx.font = 'bold 14px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(nexusRoom.portalMode === 'cards' ? 'CARD' : 'GEAR', nexusRoom.modeSwitcherPos.x, nexusRoom.modeSwitcherPos.y + 15);

    // Switcher interaction prompt
    if (isNearSwitcher && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
        if (isDisabled) {
            // Show disabled message in multiplayer
            ctx.fillStyle = '#ff6666';
            ctx.font = 'bold 12px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText('Cannot swap modes in multiplayer', nexusRoom.modeSwitcherPos.x, nexusRoom.modeSwitcherPos.y + 60);
        } else {
            // Show normal prompt
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 12px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText('Press G to switch mode', nexusRoom.modeSwitcherPos.x, nexusRoom.modeSwitcherPos.y + 60);
        }
    }

    // Render portal (color and label change based on current mode)
    const portalDx = nexusRoom.portalPos.x - (Game.player ? Game.player.x : 0);
    const portalDy = nexusRoom.portalPos.y - (Game.player ? Game.player.y : 0);
    const portalDistance = Math.sqrt(portalDx * portalDx + portalDy * portalDy);
    const isNearPortal = portalDistance < 60;
    const portalActive = Game.selectedClass !== null;

    // Portal colors based on mode
    const portalColor = nexusRoom.portalMode === 'cards'
        ? { glow: 'rgba(100, 200, 255, ', core: 'rgba(150, 220, 255, 0.8)', border: '#66ccff' }
        : { glow: 'rgba(255, 150, 100, ', core: 'rgba(255, 180, 120, 0.8)', border: '#ff8844' };

    // Portal pulsing animation
    const pulseTime = Date.now() * 0.002;
    const pulseSize = nexusRoom.portalPos.radius + Math.sin(pulseTime) * 5;
    const portalAlpha = 0.6 + Math.sin(pulseTime * 2) * 0.2;

    // Outer glow
    ctx.fillStyle = portalActive ? `${portalColor.glow}${portalAlpha})` : `rgba(100, 100, 100, ${portalAlpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(nexusRoom.portalPos.x, nexusRoom.portalPos.y, pulseSize + 10, 0, Math.PI * 2);
    ctx.fill();

    // Portal core
    ctx.fillStyle = portalActive ? portalColor.core : 'rgba(100, 100, 100, 0.5)';
    ctx.beginPath();
    ctx.arc(nexusRoom.portalPos.x, nexusRoom.portalPos.y, pulseSize, 0, Math.PI * 2);
    ctx.fill();

    // Portal border
    ctx.strokeStyle = portalActive ? portalColor.border : '#666666';
    ctx.lineWidth = 3;

    // Anti-aliasing trick: Add a subtle shadow to soften the edge
    ctx.shadowBlur = 2;
    ctx.shadowColor = ctx.strokeStyle;

    ctx.beginPath();
    ctx.arc(nexusRoom.portalPos.x, nexusRoom.portalPos.y, pulseSize, 0, Math.PI * 2);
    ctx.stroke();

    // Reset shadow and ensure no bleeding
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.globalCompositeOperation = 'source-over';

    // Portal label (changes based on mode)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(nexusRoom.portalMode === 'cards' ? 'CARD MODE' : 'GEAR MODE', nexusRoom.portalPos.x, nexusRoom.portalPos.y - 80);

    // Portal interaction prompt (only show in desktop mode)
    if (isNearPortal && typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
        const inLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;

        if (portalActive) {
            if (inLobby && !multiplayerManager.isHost) {
                ctx.fillStyle = '#ff6666';
                ctx.font = 'bold 14px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillText('Only host can start', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 70);
            } else {
                ctx.fillStyle = '#ffff00';
                ctx.font = 'bold 14px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillText('Press G to enter portal', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 70);
            }
        } else {
            ctx.fillStyle = '#ff6666';
            ctx.font = 'bold 12px Orbitron';
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

        // Round coordinates to avoid sub-pixel rendering artifacts
        const panelXRounded = Math.round(panelX);
        const panelYRounded = Math.round(panelY);

        // Panel background
        ctx.fillStyle = 'rgba(30, 30, 50, 0.9)';
        ctx.fillRect(panelXRounded, panelYRounded, panelWidth, panelHeight);

        // Panel border
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(panelXRounded, panelYRounded, panelWidth, panelHeight);

        // Title
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 24px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('MULTIPLAYER LOBBY', panelX + panelWidth / 2, panelY + 30);

        // Lobby code
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(`Code: ${multiplayerManager.lobbyCode}`, panelX + panelWidth / 2, panelY + 60);

        // Players count
        const playerCount = multiplayerManager.players ? multiplayerManager.players.length : 1;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Orbitron';
        ctx.fillText(`Players: ${playerCount}/${MultiplayerConfig.MAX_PLAYERS}`, panelX + panelWidth / 2, panelY + 85);

        // Host indicator
        if (multiplayerManager.isHost) {
            ctx.fillStyle = '#ffaa00';
            ctx.font = 'bold 14px Orbitron';
            ctx.fillText('(You are the host)', panelX + panelWidth / 2, panelY + 105);
        } else {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = 'bold 14px Orbitron';
            ctx.fillText('(Waiting for host...)', panelX + panelWidth / 2, panelY + 105);
        }
    }

    // Check if in multiplayer (used in both phases)
    const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager;

    // ------------------------------------------
    // PHASE 1: THE GLOWS (The "Neon" look)
    // ------------------------------------------
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Draw Local Player Glow
    if (Game.player && Game.player.alive) {
        const selectedClass = Game.selectedClass;
        const classDef = selectedClass ? CLASS_DEFINITIONS[selectedClass] : null;
        const playerColor = classDef ? classDef.color : '#888888';
        const playerSize = Game.player.size || 20;

        // Draw a radial gradient larger than the player
        const glowSize = playerSize * 2.5;

        // Create a gradient: Color in center -> Transparent at edge
        const grad = ctx.createRadialGradient(
            Game.player.x, Game.player.y, playerSize * 0.2, // Start small
            Game.player.x, Game.player.y, glowSize          // Fade out
        );

        // Use the player's color, but with low opacity
        grad.addColorStop(0, playerColor);
        grad.addColorStop(1, 'rgba(0,0,0,0)'); // Fade to transparent

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(Game.player.x, Game.player.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw Remote Player Glows (multiplayer)
    if (inMultiplayer) {
        if (multiplayerManager.isHost && Game.remotePlayerInstances && Game.remotePlayerInstances.size > 0) {
            Game.remotePlayerInstances.forEach((playerInstance, playerId) => {
                if (!playerInstance || playerInstance.dead || !playerInstance.alive) {
                    return;
                }

                const meta = getRemotePlayerMeta(playerId);
                const classKey = playerInstance.playerClass || (meta ? meta.class : null) || 'square';
                const classDef = CLASS_DEFINITIONS[classKey] || CLASS_DEFINITIONS.square;
                const playerColor = classDef.color || '#888888';
                const playerSize = playerInstance.size || 20;

                // Draw glow for remote player
                const glowSize = playerSize * 2.5;
                const grad = ctx.createRadialGradient(
                    playerInstance.x, playerInstance.y, playerSize * 0.2,
                    playerInstance.x, playerInstance.y, glowSize
                );

                grad.addColorStop(0, playerColor);
                grad.addColorStop(1, 'rgba(0,0,0,0)');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(playerInstance.x, playerInstance.y, glowSize, 0, Math.PI * 2);
                ctx.fill();
            });
        } else if (!multiplayerManager.isHost && Game.remotePlayerShadowInstances && Game.remotePlayerShadowInstances.size > 0) {
            Game.remotePlayerShadowInstances.forEach((shadowInstance, playerId) => {
                if (!shadowInstance || shadowInstance.dead || !shadowInstance.alive) {
                    return;
                }

                const meta = getRemotePlayerMeta(playerId);
                const classKey = (meta ? meta.class : null) || shadowInstance.playerClass || shadowInstance.classType || 'square';
                const classDef = CLASS_DEFINITIONS[classKey] || CLASS_DEFINITIONS.square;
                const playerColor = classDef.color || '#888888';
                const playerSize = shadowInstance.size || 20;

                // Draw glow for shadow instance
                const glowSize = playerSize * 2.5;
                const grad = ctx.createRadialGradient(
                    shadowInstance.x, shadowInstance.y, playerSize * 0.2,
                    shadowInstance.x, shadowInstance.y, glowSize
                );

                grad.addColorStop(0, playerColor);
                grad.addColorStop(1, 'rgba(0,0,0,0)');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(shadowInstance.x, shadowInstance.y, glowSize, 0, Math.PI * 2);
                ctx.fill();
            });
        } else if (Game.remotePlayers && Game.remotePlayers.length > 0) {
            Game.remotePlayers.forEach(remotePlayer => {
                if (!remotePlayer || remotePlayer.dead) {
                    return;
                }

                const classDef = CLASS_DEFINITIONS[remotePlayer.class || 'square'] || CLASS_DEFINITIONS.square;
                const playerColor = classDef.color || '#888888';
                const playerSize = remotePlayer.size || 20;

                // Draw glow for remote player
                const glowSize = playerSize * 2.5;
                const grad = ctx.createRadialGradient(
                    remotePlayer.x, remotePlayer.y, playerSize * 0.2,
                    remotePlayer.x, remotePlayer.y, glowSize
                );

                grad.addColorStop(0, playerColor);
                grad.addColorStop(1, 'rgba(0,0,0,0)');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(remotePlayer.x, remotePlayer.y, glowSize, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }

    ctx.restore(); // Restore to source-over

    // Explicitly reset canvas state to prevent artifacts
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // ------------------------------------------
    // PHASE 2: THE BODIES (The "Solid" look)
    // ------------------------------------------

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
    if (inMultiplayer) {
        if (multiplayerManager.isHost && Game.remotePlayerInstances && Game.remotePlayerInstances.size > 0) {
            Game.remotePlayerInstances.forEach((playerInstance, playerId) => {
                if (!playerInstance || playerInstance.dead || !playerInstance.alive) {
                    return;
                }

                const meta = getRemotePlayerMeta(playerId);
                const classKey = playerInstance.playerClass || (meta ? meta.class : null) || 'square';

                // Get name from multiplayerManager.players first (authoritative source), then meta, then fallback
                let playerName = 'Player';
                if (typeof multiplayerManager !== 'undefined' && multiplayerManager.players) {
                    const playerData = multiplayerManager.players.find(p => p.id === playerId);
                    if (playerData && playerData.name && playerData.name.trim() !== '') {
                        playerName = playerData.name;
                    }
                }
                // Fallback to meta if not found in players list
                if (playerName === 'Player' && meta && meta.name && meta.name.trim() !== '') {
                    playerName = meta.name;
                }

                renderNexusRemotePlayer(ctx, {
                    x: playerInstance.x,
                    y: playerInstance.y,
                    rotation: playerInstance.rotation || 0,
                    classKey,
                    name: playerName
                });
            });
        } else if (!multiplayerManager.isHost && Game.remotePlayerShadowInstances && Game.remotePlayerShadowInstances.size > 0) {
            Game.remotePlayerShadowInstances.forEach((shadowInstance, playerId) => {
                if (!shadowInstance || shadowInstance.dead || !shadowInstance.alive) {
                    return;
                }

                const meta = getRemotePlayerMeta(playerId);
                const classKey = (meta ? meta.class : null) || shadowInstance.playerClass || shadowInstance.classType || 'square';

                // Get name from multiplayerManager.players first (authoritative source), then meta, then fallback
                let playerName = 'Player';
                if (typeof multiplayerManager !== 'undefined' && multiplayerManager.players) {
                    const playerData = multiplayerManager.players.find(p => p.id === playerId);
                    if (playerData && playerData.name && playerData.name.trim() !== '') {
                        playerName = playerData.name;
                    }
                }
                // Fallback to meta if not found in players list
                if (playerName === 'Player' && meta && meta.name && meta.name.trim() !== '') {
                    playerName = meta.name;
                }

                renderNexusRemotePlayer(ctx, {
                    x: shadowInstance.x,
                    y: shadowInstance.y,
                    rotation: shadowInstance.rotation || 0,
                    classKey,
                    name: playerName
                });
            });
        } else if (Game.remotePlayers && Game.remotePlayers.length > 0) {
            Game.remotePlayers.forEach(remotePlayer => {
                if (!remotePlayer || remotePlayer.dead) {
                    return;
                }

                // Get name from multiplayerManager.players first (authoritative source), then remotePlayer, then fallback
                let playerName = 'Player';
                if (typeof multiplayerManager !== 'undefined' && multiplayerManager.players) {
                    const playerData = multiplayerManager.players.find(p => p.id === remotePlayer.id);
                    if (playerData && playerData.name && playerData.name.trim() !== '') {
                        playerName = playerData.name;
                    }
                }
                // Fallback to remotePlayer.name if not found in players list
                if (playerName === 'Player' && remotePlayer.name && remotePlayer.name.trim() !== '') {
                    playerName = remotePlayer.name;
                }

                renderNexusRemotePlayer(ctx, {
                    x: remotePlayer.x,
                    y: remotePlayer.y,
                    rotation: remotePlayer.rotation || 0,
                    classKey: remotePlayer.class || 'square',
                    name: playerName
                });
            });
        }
    }

    // Render class station tooltips last (when player is near) - so they appear on top
    if (Game.player && Game.player.alive) {
        classStations.forEach(station => {
            renderClassStationTooltip(ctx, Game.player, station);
        });
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
}


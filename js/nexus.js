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

// Helper: wrap text to fit within maxWidth, returning an array of line strings
// ctx must already have the desired font set before calling this
function wrapTextLines(ctx, text, maxWidth) {
    if (!text) return [];
    // Try single line first
    if (ctx.measureText(text).width <= maxWidth) return [text];
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth) {
            current = test;
        } else {
            if (current) lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);
    return lines;
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

        // Portal mode state - Gear only (Card Mode removed)
        this.portalMode = 'gear';

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
            y: 940, // Above bottom edge for default landscape viewports
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
    { key: 'attackSpeed', name: 'Atk Speed', icon: '💨', x: 400, y: 750 }
];

// Gear upgrade stations (right side of portal)
// Short nexus labels; modal titles use full names via machine key
// Progression gates (top→bottom):
// Rarity after Room 5, Affixes after Swarm King, Systems after Twin Prism, Efficiency after Fortress
const gearUpgradeStations = [
    { key: 'rarityChance', name: 'Rarity Chances', shortName: 'Rarity', icon: '🔮', x: 1450, y: 430, requiresRoom: 5 },
    { key: 'affixSlots', name: 'Affix Capacity', shortName: 'Affixes', icon: '⚙', x: 1450, y: 545, requiresBoss: 'Swarm King' },
    { key: 'safeRoomSystems', name: 'Safe Room Systems', shortName: 'Systems', icon: '🛠', x: 1450, y: 700, requiresBoss: 'Twin Prism' },
    { key: 'safeRoomEfficiency', name: 'Safe Room Efficiency', shortName: 'Efficiency', icon: '💰', x: 1450, y: 825, requiresBoss: 'Fortress' }
];
window.gearUpgradeStations = gearUpgradeStations;

function isNexusResumeLocked() {
    return typeof SaveSystem !== 'undefined'
        && typeof SaveSystem.hasActiveRunCheckpoint === 'function'
        && SaveSystem.hasActiveRunCheckpoint();
}

const NEXUS_RESUME_LOCK_HINT = 'Resume/finish run';

function getGearStationLockState(station) {
    if (!station) return { locked: false, unlockHint: null };
    if (typeof SaveSystem !== 'undefined' && SaveSystem.getNexusMachineLock) {
        return SaveSystem.getNexusMachineLock(station.key);
    }
    if (station.requiresBoss) {
        return { locked: true, requiredBoss: station.requiresBoss, unlockHint: `Defeat ${station.requiresBoss}` };
    }
    if (station.requiresRoom) {
        return { locked: true, requiredRoom: station.requiresRoom, unlockHint: `Clear Room ${station.requiresRoom}` };
    }
    return { locked: false, unlockHint: null };
}
window.getGearStationLockState = getGearStationLockState;
window.isNexusResumeLocked = isNexusResumeLocked;

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
    if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.enforcePresentationSafety) {
        FeatureTutorials.enforcePresentationSafety();
    }
    if (!nexusRoom) {
        initNexus();
    }

    if (!Game.player) {
        initNexus();
    }

    // Don't process input if a blocking UI modal is open
    const pauseMenuOpen = Game && (Game.state === 'PAUSED' || Game.showPauseMenu);
    const mpMenuOpen = typeof multiplayerMenuVisible !== 'undefined' && multiplayerMenuVisible;
    const gearUpgradeOpen = typeof window !== 'undefined' && window.GearUpgradeMenu && window.GearUpgradeMenu.isOpen;
    const indexOpen = typeof Game !== 'undefined' && Game.showingIndexMachine;
    const safeRoomOpen = typeof window !== 'undefined' && window.SafeRoomMenu && window.SafeRoomMenu.isOpen;
    const sheetOpen = typeof window !== 'undefined' && window.CharacterSheet
        && typeof window.CharacterSheet.isOpen === 'function' && window.CharacterSheet.isOpen();
    const uiBlocking = pauseMenuOpen || mpMenuOpen || gearUpgradeOpen || indexOpen || safeRoomOpen || sheetOpen
        || (window.ControllerNav && typeof window.ControllerNav.isBlockingGameplay === 'function'
            && window.ControllerNav.isBlockingGameplay());

    if (uiBlocking) {
        // Still send multiplayer updates even when menu is open
        if (Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            if (multiplayerManager.isHost) {
                multiplayerManager.sendGameState();
            } else {
                multiplayerManager.sendPlayerState();
            }
        }
        return; // Skip all nexus updates when a modal owns input
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
            // CLIENT: predict local movement; interpolate remotes
            if (Game.player && Game.player.alive) {
                const predictionOn = multiplayerManager.predictionEnabled;
                const nexusBounds = { width: nexusRoom.width, height: nexusRoom.height };
                const nexusSpeed = 300;

                if (predictionOn && typeof Game.player.predictMovementStep === 'function') {
                    const inputSnap = multiplayerManager.serializeInput
                        ? multiplayerManager.serializeInput()
                        : null;
                    multiplayerManager.recordPredictionFrame(deltaTime, inputSnap);
                    Game.player.predictMovementStep(deltaTime, Input, {
                        moveSpeedOverride: nexusSpeed,
                        bounds: nexusBounds,
                        allowPredictedDodge: false,
                        applyForces: false,
                        applyAim: true
                    });
                } else if (Game.player.interpolatePosition) {
                    Game.player.interpolatePosition(deltaTime);
                }

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

    const nexusAllows = (type, detail) => {
        if (typeof RunCheckpoint !== 'undefined' && RunCheckpoint.allowsNexusInteraction
            && !RunCheckpoint.allowsNexusInteraction(type)) {
            return false;
        }
        if (typeof Onboarding !== 'undefined' && Onboarding.allowsInteraction
            && !Onboarding.allowsInteraction(type)) {
            return false;
        }
        if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.allowsInteraction
            && !FeatureTutorials.allowsInteraction(type, detail)) {
            return false;
        }
        return true;
    };

    if (shouldInteract) {

        // Check class station interactions
        if (nexusAllows('class')) {
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

                if (typeof Onboarding !== 'undefined' && Onboarding.notifyClassSelected) {
                    Onboarding.notifyClassSelected();
                }

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
        }

        // Check upgrade station interactions
        if (Game.selectedClass && !interactionHandled
            && nexusAllows('upgrade')) {
            upgradeStations.forEach(station => {
                const dx = station.x - Game.player.x;
                const dy = station.y - Game.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 50 && !interactionHandled) {
                    purchaseUpgrade(Game.selectedClass, station.key);
                    if (typeof Onboarding !== 'undefined' && Onboarding.notifyClassUpgradeOpened) {
                        Onboarding.notifyClassUpgradeOpened();
                    }
                    interactionHandled = true;
                }
            });
        }

        // Check gear upgrade station interactions
        // Per-station allow check only - FeatureTutorials gates by machine id (detail).
        if (!interactionHandled) {
            gearUpgradeStations.forEach(station => {
                const lock = getGearStationLockState(station);
                if (lock.locked) return;
                if (!nexusAllows('gearUpgrade', station.key)) return;
                const dx = station.x - Game.player.x;
                const dy = station.y - Game.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 50 && !interactionHandled) {
                    if (typeof window !== 'undefined' && typeof window.toggleGearUpgrades === 'function') {
                        window.toggleGearUpgrades(true, station.key);
                        interactionHandled = true;
                    }
                }
            });
        }

        // Check index machine interaction
        if (!interactionHandled && nexusAllows('indexMachine')) {
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

    if (isNearSwitcher && shouldInteract && !interactionHandled && nexusAllows('modeSwitcher')) {
        if (inMultiplayerLobby) {
            // Cannot switch modes in multiplayer - mode is locked to gear
            console.log('[Nexus] Cannot switch modes in multiplayer lobby');
            // Don't set interactionHandled so other interactions can still work
        } else {
            // Toggle portal mode (single player only)
            // Portal switcher is locked to Gear Mode - do not toggle, print info log
            console.log('[Nexus] Portal switcher is locked to Gear Mode (Card Mode has been deprecated)');
            interactionHandled = true;
        }
    }

    // Check portal interaction
    const portalDx = nexusRoom.portalPos.x - Game.player.x;
    const portalDy = nexusRoom.portalPos.y - Game.player.y;
    const portalDistance = Math.sqrt(portalDx * portalDx + portalDy * portalDy);
    const hasResumeCheckpoint = typeof SaveSystem !== 'undefined' && SaveSystem.hasActiveRunCheckpoint
        && SaveSystem.hasActiveRunCheckpoint();
    const portalReady = !!(Game.selectedClass || hasResumeCheckpoint);

    if (portalDistance < 60 && portalReady && shouldInteract && !interactionHandled && nexusAllows('portal')) {
        console.log(hasResumeCheckpoint ? '[Nexus] Resuming run from checkpoint' : '[Nexus] Entering Gear Mode portal');
        nexusRoom.portalMode = 'gear';
        Game.gameMode = 'gear';

        // Check multiplayer mode
        const inLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;

        if (inLobby) {
            // Only host can start the game in multiplayer (no solo checkpoint resume in MP)
            if (multiplayerManager.isHost) {
                multiplayerManager.startGame();
                Game.startGame();
            }
        } else if (typeof Game.tryResumeOrStartFromPortal === 'function') {
            Game.tryResumeOrStartFromPortal();
        } else {
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

        // Check if mobile/touch mode
        const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();

        // ---- Layout constants ----
        const padding = 14;
        const labelIndent = 80; // x offset for description text after label
        const tooltipWidth = isMobile ? 340 : 420;
        const descMaxWidth = tooltipWidth - padding - labelIndent - padding; // available width for descriptions
        const titleFont  = 'bold 16px Orbitron';
        const bodyFont   = 'bold 12px Orbitron';
        const labelFont  = 'bold 12px Orbitron';
        const lineH = 16;   // px per text line
        const secGap = 6;   // gap between sections

        // Pre-measure wrapped lines for each ability description
        ctx.font = bodyFont;
        const entries = [
            { label: 'Basic:',   text: classDesc.basic,    labelColor: '#ffffff', descColor: '#aaaaaa' },
            { label: 'Heavy:',   text: classDesc.heavy,    labelColor: '#ffffff', descColor: '#aaaaaa' },
            { label: 'Special:', text: classDesc.special,  labelColor: '#ffffff', descColor: '#aaaaaa' },
            { label: 'Passive:', text: classDesc.passive,  labelColor: '#ffffff', descColor: '#aaaaaa' },
        ];
        if (classDesc.baseStats) {
            entries.push({ label: 'Bonus:', text: classDesc.baseStats, labelColor: '#ffdd88', descColor: '#ffaa55' });
        }
        for (const e of entries) {
            e.lines = wrapTextLines(ctx, e.text, descMaxWidth);
        }

        // Also wrap playstyle
        ctx.font = titleFont;
        const playstyleLines = wrapTextLines(ctx, classDesc.playstyle, tooltipWidth - padding * 2);

        // Compute total tooltip height dynamically
        let contentH = 0;
        contentH += lineH + secGap;                           // title
        contentH += playstyleLines.length * lineH + secGap;   // playstyle
        for (const e of entries) {
            contentH += Math.max(1, e.lines.length) * lineH + secGap;
        }
        const tooltipHeight = contentH + padding * 2;

        // ---- Position tooltip ----
        let tooltipX = station.x;
        let tooltipY;
        if (isMobile) {
            tooltipX = station.x + 160;
            tooltipY = station.y - 60 - 100;
        } else {
            tooltipY = station.y - 60 - 20;
        }

        // Clamp to canvas bounds
        const minX = tooltipWidth / 2 + padding;
        const maxX = nexusRoom.width - tooltipWidth / 2 - padding;
        const minY = tooltipHeight / 2 + padding;
        const maxY = isMobile
            ? nexusRoom.height - tooltipHeight / 2 - 180 - padding
            : nexusRoom.height - tooltipHeight / 2 - padding;

        if (tooltipX < minX) tooltipX = minX;
        else if (tooltipX > maxX) tooltipX = maxX;

        const stationBottom = station.y + 30;
        if (tooltipY - tooltipHeight / 2 < minY) {
            if (!isMobile) {
                tooltipY = stationBottom + 20 + tooltipHeight / 2;
                if (tooltipY + tooltipHeight / 2 > maxY) tooltipY = maxY;
            } else {
                tooltipY = minY + tooltipHeight / 2;
            }
        } else if (tooltipY + tooltipHeight / 2 > maxY) {
            tooltipY = maxY;
        }

        // ---- Draw background & border ----
        const bx = Math.round(tooltipX - tooltipWidth / 2);
        const by = Math.round(tooltipY - tooltipHeight / 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(bx, by, tooltipWidth, tooltipHeight);
        ctx.strokeStyle = station.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, tooltipWidth, tooltipHeight);

        // ---- Draw text ----
        let cy = by + padding;
        const lx = bx + padding; // left x for labels
        const dx = lx + labelIndent; // left x for descriptions

        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = titleFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(classDesc.name, tooltipX, cy);
        cy += lineH + secGap;

        // Playstyle
        ctx.fillStyle = '#cccccc';
        ctx.font = bodyFont;
        ctx.textAlign = 'center';
        for (const line of playstyleLines) {
            ctx.fillText(line, tooltipX, cy);
            cy += lineH;
        }
        cy += secGap;

        // Ability rows
        ctx.textAlign = 'left';
        for (const e of entries) {
            // Label (always one line)
            ctx.fillStyle = e.labelColor;
            ctx.font = labelFont;
            ctx.fillText(e.label, lx, cy);

            // Description (may wrap)
            ctx.fillStyle = e.descColor;
            ctx.font = bodyFont;
            const descLines = e.lines && e.lines.length > 0 ? e.lines : [''];
            for (let i = 0; i < descLines.length; i++) {
                ctx.fillText(descLines[i], dx, cy + i * lineH);
            }
            cy += descLines.length * lineH + secGap;
        }

        // Reset textBaseline back to default
        ctx.textBaseline = 'alphabetic';
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
        const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
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
    ctx.fillText('UPGRADES', 340, 370);
    // GEAR UPGRADES label - above the right upgrades column
    ctx.fillText('GEAR UPGRADES', 1450, 370);
    // SAFE ROOM UPGRADES label - between gear machines and safe-room machines
    ctx.fillText('SAFE ROOM UPGRADES', 1450, 635);

    // Render separator line (vertical line down the center)
    ctx.strokeStyle = 'rgba(150, 150, 200, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nexusRoom.width / 2, 120);
    ctx.lineTo(nexusRoom.width / 2, nexusRoom.height - 100);
    ctx.stroke();

    const resumeLocked = isNexusResumeLocked();

    // Render class stations
    classStations.forEach(station => {
        const classStationWidth = 138; // 15% wider than the original 120px box
        const classStationHeight = 60;
        const isSelected = Game.selectedClass === station.key;
        const dx = station.x - (Game.player ? Game.player.x : 0);
        const dy = station.y - (Game.player ? Game.player.y : 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isNear = distance < 50;
        const mutedColor = '#555555';

        // Draw station background (round coordinates to avoid sub-pixel rendering artifacts)
        const classStationX = Math.round(station.x - classStationWidth / 2);
        const classStationY = Math.round(station.y - 30);
        if (resumeLocked) {
            ctx.fillStyle = 'rgba(40, 40, 40, 0.45)';
        } else {
            ctx.fillStyle = isSelected ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)';
            if (isNear) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            }
        }
        ctx.fillRect(classStationX, classStationY, classStationWidth, classStationHeight);

        // Draw border
        ctx.strokeStyle = resumeLocked ? '#555555' : (isSelected ? '#ffff00' : station.color);
        ctx.lineWidth = !resumeLocked && isSelected ? 3 : 2;
        ctx.strokeRect(classStationX, classStationY, classStationWidth, classStationHeight);

        // Draw class shape
        const classIconX = classStationX + 24;
        const classLabelX = classStationX + 58;
        ctx.fillStyle = resumeLocked ? mutedColor : station.color;
        ctx.save();
        ctx.translate(classIconX, station.y);

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
        ctx.fillStyle = resumeLocked ? '#777777' : '#ffffff';
        ctx.font = 'bold 14px Orbitron';
        ctx.textAlign = 'left';
        ctx.fillText(station.name, classLabelX, station.y + 5);

        // Draw interaction prompt (only show in desktop mode, moved down to avoid overlap)
        if (isNear && typeof Input !== 'undefined' && (!Input.shouldShowWorldInteractionHints || Input.shouldShowWorldInteractionHints())) {
            if (resumeLocked) {
                ctx.fillStyle = '#ff8866';
                ctx.font = 'bold 11px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillText(NEXUS_RESUME_LOCK_HINT, station.x, station.y + 45);
            } else {
                ctx.fillStyle = '#ffff00';
                ctx.font = 'bold 12px Orbitron';
                ctx.textAlign = 'center';
                Input.drawInteractionPrompt ? Input.drawInteractionPrompt(ctx, 'select', station.x, station.y + 45) : ctx.fillText(Input.getInteractionPrompt ? Input.getInteractionPrompt('select') : 'Press G to select', station.x, station.y + 45);
            }
        }
    });

    // Render gear upgrade stations
    gearUpgradeStations.forEach(station => {
        const dx = station.x - (Game.player ? Game.player.x : 0);
        const dy = station.y - (Game.player ? Game.player.y : 0);
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isNear = distance < 50;
        const lock = getGearStationLockState(station);
        const isLocked = !!lock.locked || resumeLocked;
        const lockHint = resumeLocked ? NEXUS_RESUME_LOCK_HINT : lock.unlockHint;

        const boxW = 132;
        const boxH = 70;
        const stationX = Math.round(station.x - boxW / 2);
        const stationY = Math.round(station.y - boxH / 2);
        ctx.fillStyle = isNear && !isLocked
            ? 'rgba(255, 255, 0, 0.2)'
            : (isLocked ? 'rgba(40, 40, 40, 0.45)' : 'rgba(255, 255, 255, 0.05)');
        ctx.fillRect(stationX, stationY, boxW, boxH);

        ctx.strokeStyle = isLocked ? '#555555' : '#4a90e2';
        ctx.lineWidth = 2;
        ctx.strokeRect(stationX, stationY, boxW, boxH);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isLocked ? '#666666' : '#4a90e2';
        ctx.font = 'bold 22px Orbitron';
        ctx.fillText(isLocked ? '🔒' : station.icon, station.x, station.y - 16);

        ctx.fillStyle = isLocked ? '#777777' : '#ffffff';
        ctx.font = 'bold 12px Orbitron';
        const label = station.shortName || station.name;
        ctx.fillText(label, station.x, station.y + 8);

        if (isLocked && lockHint) {
            ctx.fillStyle = '#ff8866';
            ctx.font = 'bold 10px Orbitron';
            ctx.fillText(lockHint, station.x, station.y + 24);
        }
        ctx.textBaseline = 'alphabetic';

        // Only show interaction prompts if not locked
        if (isNear && !isLocked && typeof Input !== 'undefined' && (!Input.shouldShowWorldInteractionHints || Input.shouldShowWorldInteractionHints())) {
            ctx.fillStyle = '#ffff00';
            ctx.font = '12px Orbitron';
            ctx.textAlign = 'center';
            Input.drawInteractionPrompt ? Input.drawInteractionPrompt(ctx, 'select', station.x, station.y + 50) : ctx.fillText(Input.getInteractionPrompt ? Input.getInteractionPrompt('select') : 'Press G to select', station.x, station.y + 50);
        } else if (isNear && isLocked && lockHint) {
            ctx.fillStyle = '#ff8866';
            ctx.font = 'bold 11px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(lockHint, station.x, station.y + 52);
        }
    });

    // Render index machine
    const indexDx = nexusRoom.indexMachinePos.x - (Game.player ? Game.player.x : 0);
    const indexDy = nexusRoom.indexMachinePos.y - (Game.player ? Game.player.y : 0);
    const indexDistance = Math.sqrt(indexDx * indexDx + indexDy * indexDy);
    const indexIsNear = indexDistance < 50;

    // Round coordinates to avoid sub-pixel rendering artifacts
    const indexX = Math.round(nexusRoom.indexMachinePos.x - nexusRoom.indexMachinePos.width / 2);
    const indexY = Math.round(nexusRoom.indexMachinePos.y - nexusRoom.indexMachinePos.height / 2);
    ctx.fillStyle = resumeLocked
        ? 'rgba(40, 40, 40, 0.45)'
        : (indexIsNear ? 'rgba(255, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)');
    ctx.fillRect(
        indexX,
        indexY,
        nexusRoom.indexMachinePos.width,
        nexusRoom.indexMachinePos.height
    );
    ctx.strokeStyle = resumeLocked ? '#555555' : '#9c27b0';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        indexX,
        indexY,
        nexusRoom.indexMachinePos.width,
        nexusRoom.indexMachinePos.height
    );

    ctx.fillStyle = resumeLocked ? '#666666' : '#9c27b0';
    ctx.font = 'bold 24px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(resumeLocked ? '🔒' : '📚', nexusRoom.indexMachinePos.x, nexusRoom.indexMachinePos.y - 5);

    ctx.fillStyle = resumeLocked ? '#777777' : '#ffffff';
    ctx.font = 'bold 12px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('Index', nexusRoom.indexMachinePos.x, nexusRoom.indexMachinePos.y + 15);

    if (indexIsNear && typeof Input !== 'undefined' && (!Input.shouldShowWorldInteractionHints || Input.shouldShowWorldInteractionHints())) {
        if (resumeLocked) {
            ctx.fillStyle = '#ff8866';
            ctx.font = 'bold 11px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(NEXUS_RESUME_LOCK_HINT, nexusRoom.indexMachinePos.x, nexusRoom.indexMachinePos.y + 45);
        } else {
            ctx.fillStyle = '#ffff00';
            ctx.font = '12px Orbitron';
            ctx.textAlign = 'center';
            Input.drawInteractionPrompt ? Input.drawInteractionPrompt(ctx, 'open', nexusRoom.indexMachinePos.x, nexusRoom.indexMachinePos.y + 45) : ctx.fillText(Input.getInteractionPrompt ? Input.getInteractionPrompt('open') : 'Press G to open', nexusRoom.indexMachinePos.x, nexusRoom.indexMachinePos.y + 45);
        }
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
            const canAfford = !resumeLocked && Game.currentCurrency >= cost;

            // Draw station background (round coordinates to avoid sub-pixel rendering artifacts)
            const boxW = 120;
            const boxH = 92;
            const stationX = Math.round(station.x - boxW / 2);
            const stationY = Math.round(station.y - boxH / 2);
            ctx.fillStyle = resumeLocked
                ? 'rgba(40, 40, 40, 0.45)'
                : (canAfford && isNear ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)');
            ctx.fillRect(stationX, stationY, boxW, boxH);

            // Draw border
            ctx.strokeStyle = resumeLocked ? '#555555' : (canAfford ? '#00ff00' : '#666666');
            ctx.lineWidth = 2;
            ctx.strokeRect(stationX, stationY, boxW, boxH);

            // Draw icon/name with clearer vertical rhythm
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = resumeLocked ? '#666666' : '#ffffff';
            ctx.font = 'bold 18px Orbitron';
            ctx.fillText(resumeLocked ? '🔒' : station.icon, station.x, station.y - 26);
            ctx.font = 'bold 13px Orbitron';
            ctx.fillText(station.name, station.x, station.y - 6);

            // Draw level
            ctx.font = '11px Orbitron';
            ctx.fillStyle = resumeLocked ? '#666666' : '#cccccc';
            ctx.fillText(`Level: ${currentLevel}`, station.x, station.y + 14);

            // Draw cost / lock hint
            if (resumeLocked) {
                ctx.fillStyle = '#ff8866';
                ctx.font = 'bold 10px Orbitron';
                ctx.fillText(NEXUS_RESUME_LOCK_HINT, station.x, station.y + 32);
            } else {
                ctx.fillStyle = canAfford ? '#00ff00' : '#ff6666';
                ctx.font = 'bold 12px Orbitron';
                ctx.fillText(`Cost: ${cost}`, station.x, station.y + 32);
            }
            ctx.textBaseline = 'alphabetic';

            // Draw interaction prompt (only show in desktop mode, moved down to avoid overlap)
            if (isNear && typeof Input !== 'undefined' && (!Input.shouldShowWorldInteractionHints || Input.shouldShowWorldInteractionHints())) {
                if (resumeLocked) {
                    ctx.fillStyle = '#ff8866';
                    ctx.font = 'bold 11px Orbitron';
                    ctx.fillText(NEXUS_RESUME_LOCK_HINT, station.x, station.y + 60);
                } else {
                    ctx.fillStyle = '#ffff00';
                    ctx.font = 'bold 12px Orbitron';
                    Input.drawInteractionPrompt ? Input.drawInteractionPrompt(ctx, 'upgrade', station.x, station.y + 60) : ctx.fillText(Input.getInteractionPrompt ? Input.getInteractionPrompt('upgrade') : 'Press G to upgrade', station.x, station.y + 60);
                }
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
    const isDisabled = inMultiplayerLobby || resumeLocked;

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

    // Mode indicator light (dimmed if disabled)
    const lightColor = '#ff8844';
    const lightPulse = isDisabled ? 0.3 : (0.7 + Math.sin(Date.now() * 0.003) * 0.3);
    ctx.fillStyle = isDisabled ? '#555555' : lightColor;
    ctx.globalAlpha = lightPulse;
    ctx.beginPath();
    ctx.arc(nexusRoom.modeSwitcherPos.x, nexusRoom.modeSwitcherPos.y - 15, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    // Mode text on machine (grayed out if disabled)
    ctx.fillStyle = isDisabled ? '#666666' : '#ffffff';
    ctx.font = 'bold 14px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('GEAR', nexusRoom.modeSwitcherPos.x, nexusRoom.modeSwitcherPos.y + 15);

    // Switcher interaction prompt
    if (isNearSwitcher && typeof Input !== 'undefined' && (!Input.shouldShowWorldInteractionHints || Input.shouldShowWorldInteractionHints())) {
        if (resumeLocked) {
            ctx.fillStyle = '#ff8866';
            ctx.font = 'bold 11px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(NEXUS_RESUME_LOCK_HINT, nexusRoom.modeSwitcherPos.x, nexusRoom.modeSwitcherPos.y + 60);
        } else if (isDisabled) {
            // Show disabled message in multiplayer
            ctx.fillStyle = '#ff6666';
            ctx.font = 'bold 12px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText('Cannot swap modes in multiplayer', nexusRoom.modeSwitcherPos.x, nexusRoom.modeSwitcherPos.y + 60);
        } else {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = 'bold 12px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText('Gear Mode only', nexusRoom.modeSwitcherPos.x, nexusRoom.modeSwitcherPos.y + 60);
        }
    }

    // Render portal (color and label change based on current mode)
    const portalDx = nexusRoom.portalPos.x - (Game.player ? Game.player.x : 0);
    const portalDy = nexusRoom.portalPos.y - (Game.player ? Game.player.y : 0);
    const portalDistance = Math.sqrt(portalDx * portalDx + portalDy * portalDy);
    const isNearPortal = portalDistance < 60;
    const portalActive = Game.selectedClass !== null;

    const portalColor = { glow: 'rgba(255, 150, 100, ', core: 'rgba(255, 180, 120, 0.8)', border: '#ff8844' };

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

    // Portal label (changes based on mode / resume)
    const hasResumeCheckpointLabel = typeof SaveSystem !== 'undefined' && SaveSystem.hasActiveRunCheckpoint
        && SaveSystem.hasActiveRunCheckpoint();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(hasResumeCheckpointLabel ? 'RESUME RUN' : 'GEAR MODE', nexusRoom.portalPos.x, nexusRoom.portalPos.y - 95);

    // Resume state: Lost's PS2 sits on the portal as the resume affordance
    if (hasResumeCheckpointLabel && typeof drawLostPs2EasterEgg === 'function') {
        drawLostPs2EasterEgg(ctx, nexusRoom.portalPos.x, nexusRoom.portalPos.y + 4, {
            lit: true,
            near: isNearPortal,
            scale: 0.82,
            groundShadow: false
        });
    }

    // Portal interaction prompt (only show in desktop mode)
    if (isNearPortal && typeof Input !== 'undefined' && (!Input.shouldShowWorldInteractionHints || Input.shouldShowWorldInteractionHints())) {
        const inLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        const portalCanUse = portalActive || hasResumeCheckpointLabel;

        if (portalCanUse) {
            if (inLobby && !multiplayerManager.isHost) {
                ctx.fillStyle = '#ff6666';
                ctx.font = 'bold 14px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillText('Only host can start', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 70);
            } else if (hasResumeCheckpointLabel) {
                ctx.fillStyle = '#ffff00';
                ctx.font = 'bold 14px Orbitron';
                ctx.textAlign = 'center';
                Input.drawInteractionPrompt
                    ? Input.drawInteractionPrompt(ctx, 'resume run', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 70)
                    : ctx.fillText(Input.getInteractionPrompt
                        ? Input.getInteractionPrompt('resume run')
                        : 'Press G to resume run', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 70);
            } else {
                ctx.fillStyle = '#ffff00';
                ctx.font = 'bold 14px Orbitron';
                ctx.textAlign = 'center';
                Input.drawInteractionPrompt ? Input.drawInteractionPrompt(ctx, 'enter portal', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 70) : ctx.fillText(Input.getInteractionPrompt ? Input.getInteractionPrompt('enter portal') : 'Press G to enter portal', nexusRoom.portalPos.x, nexusRoom.portalPos.y + 70);
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

    // Onboarding / feature-tutorial dim layer: above world UI, below local player
    if (typeof Onboarding !== 'undefined' && Onboarding.renderSpotlight) {
        Onboarding.renderSpotlight(ctx);
    }
    if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.renderSpotlight) {
        FeatureTutorials.renderSpotlight(ctx);
    }

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

    // Coach under the cutout; class tooltips draw after so descriptions stay on top
    if (typeof Onboarding !== 'undefined' && Onboarding.renderCoachCard) {
        Onboarding.renderCoachCard(ctx);
    }
    if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.renderCoachCard) {
        FeatureTutorials.renderCoachCard(ctx);
    }

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


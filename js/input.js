// Input system - handles keyboard, mouse, and touch input

const Input = {
    // Key states
    keys: {},

    // Mouse state (screen coordinates)
    mouse: {
        x: 0,
        y: 0
    },
    mouseLeft: false,
    mouseRight: false,

    // Get mouse position in world coordinates (accounting for camera)
    getWorldMousePos() {
        if (typeof Game === 'undefined') {
            return { x: this.mouse.x, y: this.mouse.y };
        }

        // Get current zoom level (desktop only)
        // Mobile UI disabled - always use desktop zoom
        const zoom = Game.baseZoom || 1.1;

        // Combat rooms - use combat camera
        if (Game.camera && Game.state === 'PLAYING') {
            const centerX = Game.config.width / 2;
            const centerY = Game.config.height / 2;

            // Convert screen to world with zoom
            const screenDeltaX = (this.mouse.x - centerX) / zoom;
            const screenDeltaY = (this.mouse.y - centerY) / zoom;

            return {
                x: Game.camera.x + screenDeltaX,
                y: Game.camera.y + screenDeltaY
            };
        }

        // Nexus - use nexus camera
        if (Game.nexusCamera && Game.state === 'NEXUS') {
            const centerX = Game.config.width / 2;
            const centerY = Game.config.height / 2;

            // Convert screen to world with zoom
            const screenDeltaX = (this.mouse.x - centerX) / zoom;
            const screenDeltaY = (this.mouse.y - centerY) / zoom;

            return {
                x: Game.nexusCamera.x + screenDeltaX,
                y: Game.nexusCamera.y + screenDeltaY
            };
        }

        // Fallback - screen coordinates
        return { x: this.mouse.x, y: this.mouse.y };
    },

    // Touch state
    touchActive: false,
    activeTouches: {}, // Map of touchId -> touch data
    touchJoysticks: {}, // Map of joystick name -> VirtualJoystick
    touchButtons: {}, // Map of button name -> TouchButton

    // Control mode
    controlMode: 'auto', // 'auto', 'mobile', 'desktop'

    // Last aim angle (for maintaining direction when joystick is released on mobile)
    lastAimAngle: 0,

    // Class-based input configuration for mobile touch controls
    // Defines which input type each ability uses per class
    // 'button' - Simple button press (instant activation)
    // 'joystick-press-release' - Press and hold to aim, release to fire
    // 'joystick-continuous' - Press and hold to continuously fire
    classInputConfig: {
        triangle: { // Rogue
            dodge: 'joystick-press-release',      // Dash with aim
            heavyAttack: 'joystick-press-release', // Fan of knives with aim
            specialAbility: 'button'                // Shadow clones (instant AOE)
        },
        square: { // Warrior
            dodge: 'button',                        // Standard dodge
            heavyAttack: 'joystick-press-release',  // Forward thrust with aim
            specialAbility: 'button'                // Whirlwind (instant AOE)
        },
        pentagon: { // Tank
            dodge: 'button',                        // Standard dodge
            heavyAttack: 'button',                  // Ground smash
            specialAbility: 'joystick-continuous'   // Shield (directional, continuous)
        },
        hexagon: { // Mage
            dodge: 'button',                        // Standard dodge
            heavyAttack: 'joystick-press-release',  // Energy beam (charge-based, aim with drag)
            specialAbility: 'joystick-press-release' // Blink (directional teleport with aim)
        }
    },

    // Get input type for a specific ability of a class
    getAbilityInputType(classType, ability) {
        if (!this.classInputConfig[classType]) return 'button';
        return this.classInputConfig[classType][ability] || 'button';
    },

    // Device detection - check user agent for mobile/tablet
    // DISABLED: Always return false to force desktop mode
    isMobileDevice() {
        // Primary detection: User Agent patterns
        const ua = navigator.userAgent || '';
        const platform = navigator.platform || '';

        // Android mobile (must have "Mobile" in UA to exclude desktop Android)
        const isAndroidMobile = /Android.*Mobile/i.test(ua);

        // iOS mobile devices (iPhone, iPod - exclude iPad if treating as tablet)
        const isIOSMobile = /iPhone|iPod/i.test(ua);

        // Platform check as secondary validation
        const isMobilePlatform = /iPhone|iPod|Android/i.test(platform);

        // Mobile browser indicators
        const isMobileBrowser = /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

        // Combine checks: must match user agent pattern AND platform (or mobile browser indicator)
        const isMobile = (isAndroidMobile || isIOSMobile || (isMobileBrowser && isMobilePlatform));

        return isMobile;
    },

    // Check if touch mode is active
    isTouchMode() {
        // Check if we're on a mobile device
        if (this.isMobileDevice()) {
            return true;
        }

        // Check control mode setting (if user manually enabled touch controls)
        if (this.controlMode === 'touch') {
            return true;
        }

        // Auto mode: only enable if mobile device
        if (this.controlMode === 'auto') {
            return this.isMobileDevice();
        }

        return false;
    },

    // Initialize input handlers
    init(canvas) {
        // Load control mode setting
        if (typeof SaveSystem !== 'undefined') {
            this.controlMode = SaveSystem.getControlMode() || 'auto';
        }

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            // Don't intercept keys if user is typing in an input field
            const target = e.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                this.keys[e.key.toLowerCase()] = true;
                return; // Don't process game shortcuts when typing
            }

            this.keys[e.key.toLowerCase()] = true;

            // Prevent default Tab behavior (focus shifting) when used for character sheet
            if (e.key === 'Tab') {
                e.preventDefault();
            }

            // Room modifier selection key (M) when doors are shown
            if (e.key.toLowerCase() === 'm') {
                if (typeof Game !== 'undefined' && Game.state === 'PLAYING' && Game.player && Game.awaitingDoorSelection) {
                    // Check if player is near a door pack
                    if (typeof checkDoorInteraction === 'function') {
                        const doorPack = checkDoorInteraction(Game.player);
                        if (doorPack && typeof window.openDoorModifierSelection === 'function') {
                            e.preventDefault();
                            window.openDoorModifierSelection(doorPack);
                            return;
                        }
                    }
                }
            }

            // Pickup key (G) for ground cards and door selection during gameplay
            if (e.key.toLowerCase() === 'g') {
                if (typeof Game !== 'undefined' && Game.state === 'PLAYING' && Game.player) {
                    // First check for door selection
                    if (typeof checkDoorInteraction === 'function' && typeof selectDoor === 'function') {
                        const door = checkDoorInteraction(Game.player);
                        if (door) {
                            selectDoor(door);
                            return; // Don't also try to pick up cards
                        }
                    }
                    // Then check for upgrade pickup
                    if (typeof checkUpgradePickup === 'function' && typeof pickupUpgrade === 'function') {
                        const upgrade = checkUpgradePickup(Game.player);
                        if (upgrade) {
                            pickupUpgrade(upgrade);
                            return; // Don't also try to pick up cards
                        }
                    }
                    // Finally try card pickup
                    if (typeof CardGround !== 'undefined' && CardGround.pickAt) {
                        // Attempt pickup at player position
                        CardGround.pickAt(Game.player.x, Game.player.y);
                    }
                }
            }

            // Cycle ground card selection with [ and ]
            if (typeof Game !== 'undefined' && Game.state === 'PLAYING' && typeof CardGround !== 'undefined') {
                if (e.key === '[') {
                    CardGround.cycleSelection(-1);
                } else if (e.key === ']') {
                    CardGround.cycleSelection(1);
                }
            }

        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Mouse position
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            // Convert screen coordinates to game coordinates
            // Use logical width (Game.config.width) if available, otherwise fallback to canvas.width
            // This handles the supersampling case where canvas.width is 2x rect.width
            const logicalWidth = (typeof Game !== 'undefined' && Game.config) ? Game.config.width : canvas.width;
            const logicalHeight = (typeof Game !== 'undefined' && Game.config) ? Game.config.height : canvas.height;

            const scaleX = logicalWidth / rect.width;
            const scaleY = logicalHeight / rect.height;
            this.mouse.x = (e.clientX - rect.left) * scaleX;
            this.mouse.y = (e.clientY - rect.top) * scaleY;
        });

        // Mouse buttons
        canvas.addEventListener('mousedown', (e) => {
            // When DOM UI is enabled, ignore gameplay mouse when non-gameplay UI is visible
            if (window.USE_DOM_UI && typeof Game !== 'undefined') {
                const inMp = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
                const pauseMenuVisible = Game.state === 'PAUSED' || (inMp && Game.showPauseMenu);
                if (pauseMenuVisible || Game.privacyModalVisible || Game.updateModalVisible || Game.launchModalVisible) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            // Suppress gameplay mouse input during blocking UI flows (e.g., swap)
            if (typeof Game !== 'undefined' && (Game.awaitingHandSwap || Game.awaitingDoorSelection || Game.awaitingUpgradeSelection || Game.awaitingMulligan)) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (typeof CharacterSheet !== 'undefined' && CharacterSheet.isOpen && typeof Game !== 'undefined' && Game.awaitingHandSwap) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (e.button === 0) this.mouseLeft = true;
            if (e.button === 2) this.mouseRight = true;
        });

        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseLeft = false;
            if (e.button === 2) this.mouseRight = false;
        });

        // Prevent context menu
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Touch events
        // Use capture: false so UI handlers (pause button, etc.) can intercept first
        canvas.addEventListener('touchstart', (e) => {
            // Only prevent default if we're actually handling this touch
            // UI handlers in main.js will preventDefault if they handle it
            this.handleTouchStart(e, canvas);
        }, { passive: false, capture: false });

        canvas.addEventListener('touchmove', (e) => {
            if (this.touchActive) {
                e.preventDefault();
            }
            this.handleTouchMove(e, canvas);
        }, { passive: false, capture: false });

        canvas.addEventListener('touchend', (e) => {
            if (this.touchActive) {
                e.preventDefault();
            }
            this.handleTouchEnd(e);
        }, { passive: false, capture: false });

        canvas.addEventListener('touchcancel', (e) => {
            if (this.touchActive) {
                e.preventDefault();
            }
            this.handleTouchEnd(e);
        }, { passive: false, capture: false });

        // Touch controls disabled - mobile UI is disabled
        // document.addEventListener('touchstart', (e) => {
        //     if (this.isTouchMode()) {
        //         // Only prevent default if we're in touch mode
        //         // This prevents scrolling/zooming on mobile
        //     }
        // }, { passive: false });

        // Touch controls disabled - mobile UI is disabled
        // if (this.isTouchMode()) {
        //     this.initTouchControls(canvas);
        // }
    },

    // Initialize touch control UI elements
    initTouchControls(canvas) {
        // Use logical dimensions if available (Game.config), otherwise fallback to canvas dimensions
        // This handles supersampling where canvas.width is 2x logical width
        const width = (typeof Game !== 'undefined' && Game.config) ? Game.config.width : canvas.width;
        const height = (typeof Game !== 'undefined' && Game.config) ? Game.config.height : canvas.height;

        // Get mobile zoom level to adjust positioning
        const mobileZoom = (typeof Game !== 'undefined' && Game.mobileZoom) ? Game.mobileZoom : 1.0;

        // Debug: Log initialization
        if (typeof Game !== 'undefined' && Game.fullscreenEnabled) {
            console.log(`[INIT TOUCH CONTROLS] Canvas: ${canvas.width}x${canvas.height}`);
            const rect = canvas.getBoundingClientRect();
            console.log(`[INIT TOUCH CONTROLS] Display rect: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)} at (${rect.left.toFixed(0)}, ${rect.top.toFixed(0)})`);
            console.log(`[INIT TOUCH CONTROLS] Mobile zoom: ${mobileZoom.toFixed(2)}`);
        }

        // Mobile-optimized layout for thumb reach
        // Design philosophy: Left thumb controls movement, right thumb controls combat
        // All controls positioned in bottom corners for natural thumb reach
        // NO OVERLAPPING - proper spacing between all controls

        // Scale control sizes based on screen width (but clamp to reasonable range)
        const widthScale = Math.max(0.7, Math.min(1.3, width / 1280));
        const baseMovementRadius = 75;
        const baseAttackRadius = 70;
        const baseButtonSize = 58;

        const movementRadius = Math.floor(baseMovementRadius * widthScale);
        const basicAttackRadius = Math.floor(baseAttackRadius * widthScale);
        const buttonSize = Math.floor(baseButtonSize * widthScale);
        const buttonHeight = Math.floor(52 * widthScale);

        // Check if mobile
        const isMobile = this.isTouchMode();
        
        // Note: Controls are rendered in screen space (canvas coordinates), not world space
        // Zoom affects world view, not screen space, so controls don't need zoom adjustment

        // RIGHT SIDE - Combat controls (right thumb zone)
        // Radial layout: Main attack joystick in center, ability buttons arranged around it
        // Position: Lower for better thumb reach, but ensure all controls stay on screen
        const rightX = width - Math.max(130, width * 0.10); // ~10% from right edge, min 130px

        // Radial button layout around the central joystick
        // Create a cohesive cluster with proper spacing (increased spacing to prevent accidental hits)
        const radialRadius = basicAttackRadius + Math.floor(75 * widthScale); // Distance from center (scaled)

        // Ensure all buttons/joysticks stay on screen (account for radial radius + button size)
        // Calculate AFTER radialRadius is defined
        const maxControlReach = Math.max(basicAttackRadius + radialRadius + buttonSize / 2, 140);
        const safeBottomMarginRight = maxControlReach + 20; // max reach + padding
        
        // On mobile, position controls lower for better thumb reach
        // Use a smaller fixed offset from bottom - prioritize percentage over safe margin
        // This ensures controls are positioned lower on the screen
        const mobileBottomOffset = Math.max(height * 0.23, 120); // At least 15% from bottom, minimum 95px
        const rightY = isMobile
            ? height - mobileBottomOffset // Mobile: fixed offset from bottom
            : height - Math.max(140, height * 0.18); // Desktop: ~18% from bottom
        
        // Debug: Log control positioning to verify changes
        if (isMobile) {
            const percentFromBottom = ((height - rightY) / height * 100).toFixed(1);
            console.log(`[TOUCH CONTROLS] Mobile positioning: height=${height}, rightY=${rightY.toFixed(0)}, ${percentFromBottom}% from bottom, mobileBottomOffset=${mobileBottomOffset.toFixed(0)}`);
        }

        // Basic attack joystick (CENTRAL - primary action, main right thumb position)
        const centerX = rightX;
        const centerY = rightY;
        this.touchJoysticks.basicAttack = new VirtualJoystick(centerX, centerY, basicAttackRadius, 20);

        // LEFT SIDE - Movement joystick (left thumb zone)
        // Position: Aligned with center of right cluster (centerY) for consistent thumb height
        const leftX = Math.max(100, width * 0.08); // ~8% from left edge, min 100px
        // On mobile, align with right cluster center; on desktop, use original positioning
        const leftY = isMobile
            ? centerY // Mobile: same height as right cluster center
            : height - Math.max(120, height * 0.16); // Desktop: ~16% from bottom
        this.touchJoysticks.movement = new VirtualJoystick(leftX, leftY, movementRadius, 20);

        // Position buttons at angles around the circle (3 buttons: Heavy, Special, Dodge)
        // Angles optimized for thumb reach: Heavy (upper-left), Special (upper-right), Dodge (bottom)
        const angles = [
            Math.PI * 0.7,   // Heavy: ~126 degrees (upper-left, easily reachable)
            Math.PI * 0.3,   // Special: ~54 degrees (upper-right, easily reachable)
            Math.PI * 1.5    // Dodge: 270 degrees (bottom, natural thumb position)
        ];

        // Heavy attack button (upper-left of center joystick)
        const heavyAngle = angles[0];
        const heavyX = centerX + Math.cos(heavyAngle) * radialRadius;
        const heavyY = centerY + Math.sin(heavyAngle) * radialRadius;
        this.touchButtons.heavyAttack = new TouchButton(
            heavyX - buttonSize / 2,
            heavyY - buttonHeight / 2,
            buttonSize,
            buttonHeight,
            'Heavy'
        );

        // Heavy attack joystick (for warrior class - directional charge attack)
        // Centered on button position - REDUCED SIZE for mobile
        const abilityJoystickRadius = Math.floor(38 * widthScale); // Smaller than before (was 48)
        this.touchJoysticks.heavyAttack = new VirtualJoystick(
            heavyX,
            heavyY,
            abilityJoystickRadius,
            14
        );

        // Special ability button (upper-right of center joystick)
        const specialAngle = angles[1];
        const specialX = centerX + Math.cos(specialAngle) * radialRadius;
        const specialY = centerY + Math.sin(specialAngle) * radialRadius;
        this.touchButtons.specialAbility = new TouchButton(
            specialX - buttonSize / 2,
            specialY - buttonHeight / 2,
            buttonSize,
            buttonHeight,
            'Spcl'
        );

        // Special ability joystick (for directional abilities - centered on button position)
        // REDUCED SIZE for mobile
        this.touchJoysticks.specialAbility = new VirtualJoystick(
            specialX,
            specialY,
            abilityJoystickRadius,
            14
        );

        // Dodge button (bottom of center joystick)
        const dodgeAngle = angles[2];
        const dodgeX = centerX + Math.cos(dodgeAngle) * radialRadius;
        const dodgeY = centerY + Math.sin(dodgeAngle) * radialRadius;
        this.touchButtons.dodge = new TouchButton(
            dodgeX - buttonSize / 2,
            dodgeY - buttonHeight / 2,
            buttonSize,
            buttonHeight,
            'Dodge'
        );

        // Dodge joystick (for triangle/rogue class - directional dash attack)
        // Centered on button position - REDUCED SIZE for mobile
        this.touchJoysticks.dodge = new VirtualJoystick(
            dodgeX,
            dodgeY,
            abilityJoystickRadius,
            14
        );

        // Character sheet button removed - now handled by DOM UI
    },

    // Handle touch start
    handleTouchStart(e, canvas) {
        if (!this.isTouchMode()) return;

        // Check if event was already handled by UI (pause button, interaction button, etc.)
        // UI handlers will call stopPropagation if they handle the touch
        if (e.defaultPrevented) {
            return;
        }

        // Check if character sheet is open and store touch for scrolling
        if (typeof CharacterSheet !== 'undefined' && CharacterSheet.isOpen && e.touches.length > 0) {
            const touch = e.touches[0];
            CharacterSheet.lastTouchY = touch.clientY;
        }

        // Get fresh bounding rect to ensure correct coordinates after resize/fullscreen
        // Force a reflow to ensure rect is up-to-date
        void canvas.offsetWidth; // Force reflow
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            // Canvas not yet sized, skip this touch
            console.warn('[TOUCH] Canvas rect is zero, skipping touch');
            return;
        }

        const touches = Array.from(e.touches);

        // Use Game.screenToGame if available for consistent coordinate conversion
        // Otherwise fall back to manual calculation
        let convertCoords;
        if (typeof Game !== 'undefined' && Game.screenToGame) {
            convertCoords = (clientX, clientY) => {
                return Game.screenToGame(clientX, clientY);
            };
        } else {
            // Fallback: manual conversion using canvas dimensions
            const logicalWidth = (typeof Game !== 'undefined' && Game.config) ? Game.config.width : canvas.width;
            const logicalHeight = (typeof Game !== 'undefined' && Game.config) ? Game.config.height : canvas.height;
            const scaleX = logicalWidth / rect.width;
            const scaleY = logicalHeight / rect.height;
            convertCoords = (clientX, clientY) => {
                return {
                    x: (clientX - rect.left) * scaleX,
                    y: (clientY - rect.top) * scaleY
                };
            };
        }

        touches.forEach(touch => {
            // Convert screen coordinates to game coordinates using consistent method
            const gameCoords = convertCoords(touch.clientX, touch.clientY);
            const x = gameCoords.x;
            const y = gameCoords.y;
            const touchId = touch.identifier;

            // Debug logging for fullscreen issues
            if (typeof Game !== 'undefined' && Game.fullscreenEnabled) {
                console.log(`[TOUCH] Screen: (${touch.clientX.toFixed(0)}, ${touch.clientY.toFixed(0)}) -> Game: (${x.toFixed(0)}, ${y.toFixed(0)}), rect: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}, canvas: ${canvas.width}x${canvas.height}`);
            }

            this.activeTouches[touchId] = { x, y };
            this.touchActive = true;

            // Check character sheet close button if sheet is open (highest priority)
            if (typeof CharacterSheet !== 'undefined' && CharacterSheet.isOpen && CharacterSheet.closeButtonBounds) {
                const bounds = CharacterSheet.closeButtonBounds;
                if (x >= bounds.x && x <= bounds.x + bounds.width &&
                    y >= bounds.y && y <= bounds.y + bounds.height) {
                    CharacterSheet.isOpen = false;
                    return;
                }
            }

            // Check interaction button (high priority UI element)
            if (typeof handleInteractionButtonClick === 'function') {
                if (handleInteractionButtonClick(x, y)) {
                    // Interaction button handled the touch
                    return;
                }
            }

            // Character sheet button removed - now handled by DOM UI

            // Priority-based touch assignment for mobile usability
            // Check buttons FIRST (they have smaller hit areas), then joysticks
            // This prevents joysticks from stealing touches from buttons

            // Use game coordinates for screen middle calculation
            const logicalWidth = (typeof Game !== 'undefined' && Game.config) ? Game.config.width : canvas.width;
            const screenMiddle = logicalWidth / 2;
            const isLeftSide = x < screenMiddle;

            if (isLeftSide) {
                // LEFT SIDE: Movement joystick only
                if (this.touchJoysticks.movement && !this.touchJoysticks.movement.active) {
                    if (this.touchJoysticks.movement.startTouch(touchId, x, y)) {
                        return;
                    }
                }
            } else {
                // RIGHT SIDE: Combat controls
                // Priority 1: Check buttons FIRST with padded bounds (before joysticks)
                // Buttons must be checked first because joysticks have large hit areas
                const buttonOrder = ['heavyAttack', 'dodge', 'specialAbility'];
                let buttonMatched = false;

                // Debug: log button positions in fullscreen
                if (typeof Game !== 'undefined' && Game.fullscreenEnabled) {
                    console.log(`[RIGHT SIDE] Touch at game coords: (${x.toFixed(0)}, ${y.toFixed(0)})`);
                    for (const buttonName of buttonOrder) {
                        const button = this.touchButtons[buttonName];
                        if (button) {
                            console.log(`  ${buttonName}: bounds (${button.x.toFixed(0)}, ${button.y.toFixed(0)}) to (${(button.x + button.width).toFixed(0)}, ${(button.y + button.height).toFixed(0)}), contains: ${button.contains(x, y)}`);
                        }
                    }
                    if (this.touchJoysticks.basicAttack) {
                        const joystick = this.touchJoysticks.basicAttack;
                        const dx = x - joystick.centerX;
                        const dy = y - joystick.centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        console.log(`  basicAttack joystick: center (${joystick.centerX.toFixed(0)}, ${joystick.centerY.toFixed(0)}), distance: ${distance.toFixed(0)}, hit radius: ${joystick.radius * 1.3}`);
                    }
                }

                // Check buttons with padded bounds first (8px padding for easier tapping)
                for (const buttonName of buttonOrder) {
                    const button = this.touchButtons[buttonName];
                    if (button && !button.active) {
                        // Use padded bounds to catch touches near button edges
                        if (button.contains(x, y)) {
                            buttonMatched = true;
                            if (typeof Game !== 'undefined' && Game.fullscreenEnabled) {
                                console.log(`  -> Matched ${buttonName} button!`);
                            }
                            if (button.startTouch(touchId, x, y)) {
                                return;
                            }
                        }
                    }
                }

                // Priority 2: Basic attack joystick (main combat action)
                // Only check if no button was matched and touch is clearly in joystick area
                if (!buttonMatched && this.touchJoysticks.basicAttack && !this.touchJoysticks.basicAttack.active) {
                    const joystick = this.touchJoysticks.basicAttack;
                    const dx = x - joystick.centerX;
                    const dy = y - joystick.centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // Check if touch is within restricted joystick area (just radius, not 2x)
                    // This prevents overlap with radial buttons that are at radius + 75px
                    const restrictedHitRadius = joystick.radius; // 70px - well clear of buttons at 145px

                    if (distance <= restrictedHitRadius) {
                        // Additional safety check: make sure we're not near any button area
                        let tooCloseToButton = false;
                        for (const button of Object.values(this.touchButtons)) {
                            if (button) {
                                // Check if touch is within button's padded area
                                if (button.contains(x, y)) {
                                    tooCloseToButton = true;
                                    break;
                                }
                                // Also check distance from button center to be extra safe
                                const buttonCenterX = button.x + button.width / 2;
                                const buttonCenterY = button.y + button.height / 2;
                                const buttonDx = x - buttonCenterX;
                                const buttonDy = y - buttonCenterY;
                                const buttonDistance = Math.sqrt(buttonDx * buttonDx + buttonDy * buttonDy);
                                // If within button size + padding, consider it too close
                                if (buttonDistance < Math.max(button.width, button.height) / 2 + 15) {
                                    tooCloseToButton = true;
                                    break;
                                }
                            }
                        }

                        // Use restricted hit area when buttons are nearby
                        if (!tooCloseToButton && joystick.startTouch(touchId, x, y, true)) {
                            if (typeof Game !== 'undefined' && Game.fullscreenEnabled) {
                                console.log(`  -> Matched basicAttack joystick!`);
                            }
                            return;
                        }
                    }
                }
            }

            // Fallback: if touch didn't match any control, try joysticks (for edge cases)
            if (isLeftSide) {
                if (this.touchJoysticks.movement && !this.touchJoysticks.movement.active) {
                    if (this.touchJoysticks.movement.startTouch(touchId, x, y)) return;
                }
            } else {
                // Fallback for right side - use restricted hit area to avoid button overlap
                if (this.touchJoysticks.basicAttack && !this.touchJoysticks.basicAttack.active) {
                    const joystick = this.touchJoysticks.basicAttack;
                    const dx = x - joystick.centerX;
                    const dy = y - joystick.centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    // Use restricted radius for fallback too
                    if (distance <= joystick.radius && joystick.startTouch(touchId, x, y, true)) {
                        return;
                    }
                }
            }
        });
    },

    // Handle touch move
    handleTouchMove(e, canvas) {
        if (!this.isTouchMode()) return;

        // Handle character sheet scrolling if open
        if (typeof CharacterSheet !== 'undefined' && CharacterSheet.isOpen && e.touches.length > 0) {
            const touch = e.touches[0];
            if (CharacterSheet.lastTouchY !== null) {
                const deltaY = CharacterSheet.lastTouchY - touch.clientY;
                const gameCoords = typeof Game !== 'undefined' && Game.screenToGame
                    ? Game.screenToGame(touch.clientX, touch.clientY)
                    : { x: touch.clientX, y: touch.clientY };

                if (typeof handleCharacterSheetScroll !== 'undefined' && handleCharacterSheetScroll(gameCoords.x, gameCoords.y, deltaY)) {
                    CharacterSheet.lastTouchY = touch.clientY;
                    e.preventDefault();
                    return;
                }
            }
            CharacterSheet.lastTouchY = touch.clientY;
        }

        // Get fresh bounding rect to ensure correct coordinates after resize/fullscreen
        void canvas.offsetWidth; // Force reflow
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return;
        }

        const touches = Array.from(e.touches);

        // Use Game.screenToGame if available for consistent coordinate conversion
        // Otherwise fall back to manual calculation
        let convertCoords;
        if (typeof Game !== 'undefined' && Game.screenToGame) {
            convertCoords = (clientX, clientY) => {
                return Game.screenToGame(clientX, clientY);
            };
        } else {
            // Fallback: manual conversion using canvas dimensions
            const logicalWidth = (typeof Game !== 'undefined' && Game.config) ? Game.config.width : canvas.width;
            const logicalHeight = (typeof Game !== 'undefined' && Game.config) ? Game.config.height : canvas.height;
            const scaleX = logicalWidth / rect.width;
            const scaleY = logicalHeight / rect.height;
            convertCoords = (clientX, clientY) => {
                return {
                    x: (clientX - rect.left) * scaleX,
                    y: (clientY - rect.top) * scaleY
                };
            };
        }

        touches.forEach(touch => {
            // Convert screen coordinates to game coordinates using consistent method
            const gameCoords = convertCoords(touch.clientX, touch.clientY);
            const x = gameCoords.x;
            const y = gameCoords.y;
            const touchId = touch.identifier;

            if (this.activeTouches[touchId]) {
                this.activeTouches[touchId].x = x;
                this.activeTouches[touchId].y = y;

                // Update joysticks (movement, basic attack, special ability)
                for (const joystick of Object.values(this.touchJoysticks)) {
                    if (joystick && joystick.touchId === touchId) {
                        joystick.updateTouch(touchId, x, y);
                    }
                }

                // Handle heavy attack joystick activation (for warrior and triangle classes - directional charge attack)
                const playerClass = typeof Game !== 'undefined' && Game.player ? Game.player.playerClass : null;
                const usesHeavyJoystick = playerClass && this.getAbilityInputType &&
                    this.getAbilityInputType(playerClass, 'heavyAttack') === 'joystick-press-release';

                if (usesHeavyJoystick && this.touchButtons.heavyAttack && this.touchButtons.heavyAttack.pressed &&
                    this.touchButtons.heavyAttack.touchId === touchId) {
                    // Check if finger moved away from button center (dragging)
                    const button = this.touchButtons.heavyAttack;
                    const buttonCenterX = button.x + button.width / 2;
                    const buttonCenterY = button.y + button.height / 2;
                    const dx = x - buttonCenterX;
                    const dy = y - buttonCenterY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // If moved more than 10px, activate joystick mode for aiming
                    if (distance > 10 && this.touchJoysticks.heavyAttack && !this.touchJoysticks.heavyAttack.active) {
                        // Transfer touch to joystick
                        this.touchJoysticks.heavyAttack.startTouch(touchId, x, y);
                    } else if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.active &&
                        this.touchJoysticks.heavyAttack.touchId === touchId) {
                        // Update joystick if already active
                        this.touchJoysticks.heavyAttack.updateTouch(touchId, x, y);
                    }
                }

                // Handle dodge joystick activation (for triangle/rogue class - directional dash attack)
                const isRogue = typeof Game !== 'undefined' && Game.player && Game.player.playerClass === 'triangle';

                if (isRogue && this.touchButtons.dodge && this.touchButtons.dodge.pressed &&
                    this.touchButtons.dodge.touchId === touchId) {
                    // Check if finger moved away from button center (dragging)
                    const button = this.touchButtons.dodge;
                    const buttonCenterX = button.x + button.width / 2;
                    const buttonCenterY = button.y + button.height / 2;
                    const dx = x - buttonCenterX;
                    const dy = y - buttonCenterY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // If moved more than 10px, activate joystick mode for aiming
                    if (distance > 10 && this.touchJoysticks.dodge && !this.touchJoysticks.dodge.active) {
                        // Transfer touch to joystick
                        this.touchJoysticks.dodge.startTouch(touchId, x, y);
                    } else if (this.touchJoysticks.dodge && this.touchJoysticks.dodge.active &&
                        this.touchJoysticks.dodge.touchId === touchId) {
                        // Update joystick if already active
                        this.touchJoysticks.dodge.updateTouch(touchId, x, y);
                    }
                }

                // Handle special ability joystick activation
                // Use modular config to check if class needs joystick for special ability
                const playerClassForSpecial = typeof Game !== 'undefined' && Game.player ? Game.player.playerClass : null;
                const specialInputType = playerClassForSpecial && this.getAbilityInputType ?
                    this.getAbilityInputType(playerClassForSpecial, 'specialAbility') : 'button';
                const needsSpecialJoystick = specialInputType === 'joystick-press-release' ||
                    specialInputType === 'joystick-continuous';

                if (needsSpecialJoystick && this.touchButtons.specialAbility && this.touchButtons.specialAbility.pressed &&
                    this.touchButtons.specialAbility.touchId === touchId) {
                    // Check if finger moved away from button center (dragging)
                    const button = this.touchButtons.specialAbility;
                    const buttonCenterX = button.x + button.width / 2;
                    const buttonCenterY = button.y + button.height / 2;
                    const dx = x - buttonCenterX;
                    const dy = y - buttonCenterY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // If moved more than 10px, activate joystick mode for directional abilities
                    if (distance > 10 && this.touchJoysticks.specialAbility && !this.touchJoysticks.specialAbility.active) {
                        // Transfer touch to joystick
                        this.touchJoysticks.specialAbility.startTouch(touchId, x, y);
                    } else if (this.touchJoysticks.specialAbility && this.touchJoysticks.specialAbility.active &&
                        this.touchJoysticks.specialAbility.touchId === touchId) {
                        // Update joystick if already active
                        this.touchJoysticks.specialAbility.updateTouch(touchId, x, y);
                    }
                }
            }
        });
    },

    // Handle touch end
    handleTouchEnd(e) {
        if (!this.isTouchMode()) return;

        const touches = Array.from(e.changedTouches);

        touches.forEach(touch => {
            const touchId = touch.identifier;

            // Before ending touches, capture final joystick state for buttons that need it
            // This is especially important for directional abilities like blink and warrior/triangle heavy attack
            const playerClass = typeof Game !== 'undefined' && Game.player ? Game.player.playerClass : null;
            const isRogue = playerClass === 'triangle';
            const needsSpecialJoystick = typeof Game !== 'undefined' && Game.player &&
                (Game.player.playerClass === 'hexagon' || Game.player.playerClass === 'pentagon');

            // Capture heavy attack joystick state for classes that use joystick (warrior and triangle)
            const usesHeavyJoystick = playerClass && this.getAbilityInputType &&
                this.getAbilityInputType(playerClass, 'heavyAttack') === 'joystick-press-release';

            if (usesHeavyJoystick) {
                if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.touchId === touchId) {
                    const joystick = this.touchJoysticks.heavyAttack;
                    if (this.touchButtons.heavyAttack) {
                        this.touchButtons.heavyAttack.finalJoystickState = {
                            direction: joystick.getDirection(),
                            magnitude: joystick.getMagnitude(),
                            angle: joystick.angle
                        };
                    }
                } else if (this.touchButtons.heavyAttack && this.touchButtons.heavyAttack.touchId === touchId && this.touchButtons.heavyAttack.pressed) {
                    if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.active) {
                        const joystick = this.touchJoysticks.heavyAttack;
                        this.touchButtons.heavyAttack.finalJoystickState = {
                            direction: joystick.getDirection(),
                            magnitude: joystick.getMagnitude(),
                            angle: joystick.angle
                        };
                    }
                }
            }

            // Capture dodge joystick state for triangle/rogue
            if (isRogue) {
                if (this.touchJoysticks.dodge && this.touchJoysticks.dodge.touchId === touchId) {
                    const joystick = this.touchJoysticks.dodge;
                    if (this.touchButtons.dodge) {
                        this.touchButtons.dodge.finalJoystickState = {
                            direction: joystick.getDirection(),
                            magnitude: joystick.getMagnitude(),
                            angle: joystick.angle
                        };
                    }
                } else if (this.touchButtons.dodge && this.touchButtons.dodge.touchId === touchId && this.touchButtons.dodge.pressed) {
                    if (this.touchJoysticks.dodge && this.touchJoysticks.dodge.active) {
                        const joystick = this.touchJoysticks.dodge;
                        this.touchButtons.dodge.finalJoystickState = {
                            direction: joystick.getDirection(),
                            magnitude: joystick.getMagnitude(),
                            angle: joystick.angle
                        };
                    }
                }
            }

            // Capture special ability joystick state for classes that use joystick
            const playerClassForSpecial = typeof Game !== 'undefined' && Game.player ? Game.player.playerClass : null;
            const specialInputType = playerClassForSpecial && this.getAbilityInputType ?
                this.getAbilityInputType(playerClassForSpecial, 'specialAbility') : 'button';
            const needsSpecialJoystickCapture = specialInputType === 'joystick-press-release' ||
                specialInputType === 'joystick-continuous';

            if (needsSpecialJoystickCapture) {
                // Check if this touch was associated with the special ability joystick
                if (this.touchJoysticks.specialAbility && this.touchJoysticks.specialAbility.touchId === touchId) {
                    const joystick = this.touchJoysticks.specialAbility;
                    // Store final joystick state in the button for use in activateBlink
                    if (this.touchButtons.specialAbility) {
                        this.touchButtons.specialAbility.finalJoystickState = {
                            direction: joystick.getDirection(),
                            magnitude: joystick.getMagnitude(),
                            angle: joystick.angle
                        };
                    }
                }
                // Also check if button was pressed (for cases where joystick wasn't activated)
                else if (this.touchButtons.specialAbility && this.touchButtons.specialAbility.touchId === touchId && this.touchButtons.specialAbility.pressed) {
                    // Button was pressed but joystick might not have been activated
                    // Try to capture joystick state if it exists
                    if (this.touchJoysticks.specialAbility && this.touchJoysticks.specialAbility.active) {
                        const joystick = this.touchJoysticks.specialAbility;
                        this.touchButtons.specialAbility.finalJoystickState = {
                            direction: joystick.getDirection(),
                            magnitude: joystick.getMagnitude(),
                            angle: joystick.angle
                        };
                    }
                }
            }

            // End joystick interactions
            for (const joystick of Object.values(this.touchJoysticks)) {
                if (joystick) {
                    joystick.endTouch(touchId);
                }
            }

            // End button interactions
            for (const button of Object.values(this.touchButtons)) {
                if (button) {
                    button.endTouch(touchId);
                }
            }

            delete this.activeTouches[touchId];
        });

        // Check if any touches remain
        if (Object.keys(this.activeTouches).length === 0) {
            this.touchActive = false;
        }
    },

    // Update touch controls (call each frame)
    update(deltaTime) {
        if (!this.isTouchMode()) return;

        // Update joysticks
        for (const joystick of Object.values(this.touchJoysticks)) {
            if (joystick) {
                joystick.update(deltaTime);
            }
        }

        // Update buttons
        for (const button of Object.values(this.touchButtons)) {
            if (button) {
                button.update();
            }
        }
    },

    // Unified input methods

    // Get movement input (normalized direction vector)
    getMovementInput() {
        if (this.isTouchMode() && this.touchJoysticks.movement) {
            const dir = this.touchJoysticks.movement.getDirection();
            const mag = this.touchJoysticks.movement.getMagnitude();
            return {
                x: dir.x * mag,
                y: dir.y * mag
            };
        } else {
            // Keyboard input
            let x = 0, y = 0;
            if (this.getKeyState('w')) y -= 1;
            if (this.getKeyState('s')) y += 1;
            if (this.getKeyState('a')) x -= 1;
            if (this.getKeyState('d')) x += 1;

            // Normalize
            const length = Math.sqrt(x * x + y * y);
            if (length > 0) {
                return { x: x / length, y: y / length };
            }
            return { x: 0, y: 0 };
        }
    },

    // Get aim direction (angle in radians)
    getAimDirection() {
        if (this.isTouchMode()) {
            // Check heavy attack joystick first (if active, it takes priority)
            if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.active &&
                this.touchJoysticks.heavyAttack.getMagnitude() > 0.1) {
                const angle = this.touchJoysticks.heavyAttack.getAngle();
                this.lastAimAngle = angle;
                return angle;
            }

            // Check special ability joystick (shield/blink) - second priority
            if (this.touchJoysticks.specialAbility && this.touchJoysticks.specialAbility.active &&
                this.touchJoysticks.specialAbility.getMagnitude() > 0.1) {
                const angle = this.touchJoysticks.specialAbility.getAngle();
                this.lastAimAngle = angle;
                return angle;
            }

            // Otherwise check basic attack joystick
            if (this.touchJoysticks.basicAttack) {
                if (this.touchJoysticks.basicAttack.active) {
                    // Joystick is active: use current angle and store it
                    const angle = this.touchJoysticks.basicAttack.getAngle();
                    this.lastAimAngle = angle;
                    return angle;
                } else {
                    // Joystick is inactive: return last stored angle to maintain facing direction
                    return this.lastAimAngle;
                }
            }

            // No joystick active, return last stored angle
            return this.lastAimAngle;
        } else {
            // Desktop mode: Mouse position (use world coordinates)
            if (typeof Game !== 'undefined' && Game.player) {
                const worldMouse = this.getWorldMousePos();
                const dx = worldMouse.x - Game.player.x;
                const dy = worldMouse.y - Game.player.y;
                return Math.atan2(dy, dx);
            }
            return 0;
        }
    },

    // Check if ability is pressed
    isAbilityPressed(ability) {
        if (this.isTouchMode()) {
            // For joystick abilities, check if joystick is active with magnitude > dead zone
            if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                return this.touchJoysticks.basicAttack.active && this.touchJoysticks.basicAttack.getMagnitude() > 0.1;
            }
            // For button abilities
            if (this.touchButtons[ability]) {
                return this.touchButtons[ability].pressed;
            }
            return false;
        } else {
            // Keyboard/mouse
            if (ability === 'basicAttack') return this.mouseLeft;
            if (ability === 'heavyAttack') return this.mouseRight;
            if (ability === 'specialAbility') return this.getKeyState(' ');
            if (ability === 'dodge') return this.getKeyState('shift');
            return false;
        }
    },

    // Check if ability was just pressed (for one-time actions)
    isAbilityJustPressed(ability) {
        if (this.isTouchMode()) {
            if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                // For continuous abilities, check if magnitude crossed threshold
                return this.touchJoysticks.basicAttack.active && this.touchJoysticks.basicAttack.getMagnitude() > 0.1;
            }
            if (this.touchButtons[ability]) {
                return this.touchButtons[ability].justPressed;
            }
            return false;
        } else {
            // Keyboard/mouse - need to track previous state (handled in player.js)
            if (ability === 'basicAttack') return this.mouseLeft;
            if (ability === 'heavyAttack') return this.mouseRight;
            if (ability === 'specialAbility') return this.getKeyState(' ');
            if (ability === 'dodge') return this.getKeyState('shift');
            return false;
        }
    },

    // Get ability direction (for directional abilities)
    getAbilityDirection(ability) {
        if (this.isTouchMode()) {
            if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                return this.touchJoysticks.basicAttack.getDirection();
            }
            if (ability === 'heavyAttack') {
                // Check if heavy attack joystick is active (for classes that use joystick)
                if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.active) {
                    return this.touchJoysticks.heavyAttack.getDirection();
                }
                // Fallback to basic attack joystick if heavy attack joystick not active
                if (this.touchJoysticks.basicAttack) {
                    return this.touchJoysticks.basicAttack.getDirection();
                }
            }
            if (ability === 'specialAbility' && this.touchJoysticks.specialAbility) {
                // Use modular config to check if class needs joystick for special ability
                const playerClass = typeof Game !== 'undefined' && Game.player ? Game.player.playerClass : null;
                const specialInputType = playerClass && this.getAbilityInputType ?
                    this.getAbilityInputType(playerClass, 'specialAbility') : 'button';
                const needsSpecialJoystick = specialInputType === 'joystick-press-release' ||
                    specialInputType === 'joystick-continuous';
                if (needsSpecialJoystick) {
                    return this.touchJoysticks.specialAbility.getDirection();
                }
            }
            return { x: 0, y: 0 };
        } else {
            // Mouse direction
            if (typeof Game !== 'undefined' && Game.player) {
                const dx = this.mouse.x - Game.player.x;
                const dy = this.mouse.y - Game.player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    return { x: dx / dist, y: dy / dist };
                }
            }
            return { x: 0, y: 0 };
        }
    },

    // Get ability angle (for directional abilities)
    getAbilityAngle(ability) {
        if (this.isTouchMode()) {
            if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                return this.touchJoysticks.basicAttack.getAngle();
            }
            if (ability === 'heavyAttack') {
                // Check if heavy attack joystick is active (for classes that use joystick)
                if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.active) {
                    return this.touchJoysticks.heavyAttack.getAngle();
                }
                // Fallback to basic attack joystick if heavy attack joystick not active
                if (this.touchJoysticks.basicAttack) {
                    return this.touchJoysticks.basicAttack.getAngle();
                }
            }
            if (ability === 'specialAbility' && this.touchJoysticks.specialAbility) {
                // Use modular config to check if class needs joystick for special ability
                const playerClass = typeof Game !== 'undefined' && Game.player ? Game.player.playerClass : null;
                const specialInputType = playerClass && this.getAbilityInputType ?
                    this.getAbilityInputType(playerClass, 'specialAbility') : 'button';
                const needsSpecialJoystick = specialInputType === 'joystick-press-release' ||
                    specialInputType === 'joystick-continuous';
                if (needsSpecialJoystick) {
                    return this.touchJoysticks.specialAbility.getAngle();
                }
            }
            return 0;
        } else {
            return this.getAimDirection();
        }
    },

    // Check if a key is pressed
    isKeyPressed(key) {
        return this.keys[key.toLowerCase()] === true;
    },

    // Get key state
    getKeyState(key) {
        return this.keys[key.toLowerCase()] || false;
    },

    // Render touch controls
    render(ctx) {
        if (!this.isTouchMode()) return;

        // Helper to safely get numeric values
        const getVal = (obj, keys, fallback = 0) => {
            if (!obj) return fallback;
            for (const k of keys) {
                const v = obj[k];
                if (typeof v === 'number' && !Number.isNaN(v)) return v;
            }
            return fallback;
        };

        // Get player for cooldown data
        const player = (typeof Game !== 'undefined') ? Game.player : null;
        const playerClass = player ? (player.playerClass || 'square') : 'square';

        // --- BACKGROUNDS ---

        // LEFT SIDE: Movement joystick background
        if (this.touchJoysticks && this.touchJoysticks.movement) {
            const movement = this.touchJoysticks.movement;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.arc(movement.centerX, movement.centerY, movement.radius + 20, 0, Math.PI * 2);
            ctx.fill();
        }

        // RIGHT SIDE: Combat control cluster background
        if (this.touchJoysticks && this.touchJoysticks.basicAttack) {
            const basicAttack = this.touchJoysticks.basicAttack;
            const centerX = basicAttack.centerX;
            const centerY = basicAttack.centerY;

            // Calculate cluster bounds
            let maxDistance = basicAttack.radius + 20;
            if (this.touchButtons) {
                for (const button of Object.values(this.touchButtons)) {
                    if (button) {
                        const btnCenterX = button.x + button.width / 2;
                        const btnCenterY = button.y + button.height / 2;
                        const dx = btnCenterX - centerX;
                        const dy = btnCenterY - centerY;
                        const dist = Math.sqrt(dx * dx + dy * dy) + Math.max(button.width, button.height) / 2;
                        if (dist > maxDistance) maxDistance = dist;
                    }
                }
            }

            // Draw unified cluster background
            const backgroundRadius = maxDistance / 3;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, backgroundRadius, 0, Math.PI * 2);
            ctx.fill();

            // Outer glow ring
            ctx.strokeStyle = 'rgba(150, 150, 200, 0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, backgroundRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // --- JOYSTICKS ---
        for (const key in this.touchJoysticks) {
            const joystick = this.touchJoysticks[key];
            if (!joystick) continue;

            // Class-specific visibility logic
            if (key === 'specialAbility' && (playerClass === 'triangle' || playerClass === 'square')) {
                continue; // Hide special joystick for Rogue/Warrior
            }
            if (key === 'dodge') {
                if (playerClass !== 'triangle') continue; // Only Rogue uses dodge joystick
            }

            joystick.render(ctx);

            // Radial cooldowns for joysticks (e.g. Rogue Dodge)
            if (key === 'dodge' && playerClass === 'triangle' && player && player.dodgeChargeCooldowns) {
                const radius = joystick.radius + 8;
                const charges = player.dodgeChargeCooldowns.length;
                const anglePerCharge = (Math.PI * 2) / charges;

                for (let i = 0; i < charges; i++) {
                    const cooldown = player.dodgeChargeCooldowns[i];
                    const maxCooldown = Math.max(0.0001, getVal(player, ['dodgeCooldownTime', 'dashCooldownTime'], 1));
                    const clampedCooldown = Math.min(Math.max(cooldown, 0), maxCooldown);
                    const startAngle = -Math.PI / 2 + (anglePerCharge * i);

                    // Draw cooldown arc
                    if (cooldown > 0) {
                        const progress = Math.max(0, Math.min(1, 1 - (clampedCooldown / maxCooldown)));
                        const currentAngle = startAngle + (anglePerCharge * progress);

                        ctx.lineWidth = 4;
                        ctx.strokeStyle = '#ff4444'; // Charging
                        ctx.beginPath();
                        ctx.arc(joystick.centerX, joystick.centerY, radius, startAngle, currentAngle);
                        ctx.stroke();
                    } else {
                        // Ready
                        ctx.lineWidth = 4;
                        ctx.strokeStyle = '#44ff44';
                        ctx.beginPath();
                        ctx.arc(joystick.centerX, joystick.centerY, radius, startAngle, startAngle + anglePerCharge - 0.1);
                        ctx.stroke();
                    }
                }
            }
        }

        // --- BUTTONS ---
        for (const key in this.touchButtons) {
            const button = this.touchButtons[key];
            if (!button) continue;

            // Skip character sheet button - now handled by DOM UI
            if (key === 'characterSheet') continue;

            // Class-specific visibility
            if (key === 'dodge' && playerClass === 'triangle') continue; // Rogue uses joystick

            let cooldown = 0;
            let maxCooldown = 0;
            let charges = null;

            if (player) {
                if (key === 'heavyAttack') {
                    // Check for Hexagon (Beam) which has charges
                    if (player.playerClass === 'hexagon') {
                        const maxCharges = Math.max(1, getVal(player, ['maxBeamCharges'], 2));
                        const chargeCooldowns = player.beamChargeCooldowns || player.heavyChargeCooldowns;
                        maxCooldown = Math.max(0.0001, getVal(player, ['heavyAttackCooldownTime', 'heavyCooldownTime'], 1.5));

                        // Calculate available charges
                        let availableCharges = maxCharges;
                        if (Array.isArray(chargeCooldowns)) {
                            for (let i = 0; i < maxCharges; i++) {
                                if ((chargeCooldowns[i] || 0) > 0) {
                                    availableCharges--;
                                }
                            }
                        }
                        charges = availableCharges;

                        // For cooldown visualization, show the cooldown of the *next* charge to recover
                        if (availableCharges < maxCharges && Array.isArray(chargeCooldowns)) {
                            let maxRem = 0;
                            for (let i = 0; i < maxCharges; i++) {
                                maxRem = Math.max(maxRem, chargeCooldowns[i] || 0);
                            }
                            cooldown = maxRem;
                        }
                    } else {
                        // Standard heavy attack
                        cooldown = getVal(player, ['heavyAttackCooldown', 'heavyCooldown', 'heavyRemaining'], 0);
                        maxCooldown = Math.max(0.0001, getVal(player, ['heavyAttackCooldownTime', 'heavyCooldownTime'], 1.5));
                    }
                } else if (key === 'specialAbility') {
                    cooldown = getVal(player, ['specialCooldown', 'specialRemaining'], 0);
                    maxCooldown = Math.max(0.0001, getVal(player, ['specialCooldownTime', 'specialTime'], 1));
                } else if (key === 'dodge') {
                    const maxCharges = Math.max(1, getVal(player, ['maxDodgeCharges', 'maxDashCharges'], 1));
                    const chargeCooldowns = player.dodgeChargeCooldowns || player.dashChargeCooldowns;
                    maxCooldown = Math.max(0.0001, getVal(player, ['dodgeCooldownTime', 'dashCooldownTime', 'dodgeMaxCooldown'], 1));

                    if (maxCharges > 1) {
                        // Calculate available charges
                        let availableCharges = maxCharges;
                        if (Array.isArray(chargeCooldowns)) {
                            for (let i = 0; i < maxCharges; i++) {
                                if ((chargeCooldowns[i] || 0) > 0) {
                                    availableCharges--;
                                }
                            }
                        }
                        charges = availableCharges;

                        // For visualization, show cooldown if not at full charges
                        if (availableCharges < maxCharges && Array.isArray(chargeCooldowns)) {
                            let maxRem = 0;
                            for (let i = 0; i < maxCharges; i++) {
                                maxRem = Math.max(maxRem, chargeCooldowns[i] || 0);
                            }
                            cooldown = maxRem;
                        }
                    } else {
                        cooldown = getVal(player, ['dodgeCooldown', 'dashCooldown', 'dodgeRemaining', 'dashRemaining'], 0);
                    }
                }
            }

            button.render(ctx, cooldown, maxCooldown, charges);
        }
    }
};



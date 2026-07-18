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

        // Get current zoom level (platform + camera-distance setting)
        const zoom = (typeof Game !== 'undefined' && Game.getViewZoom)
            ? Game.getViewZoom()
            : (Game.baseZoom || 1.1);

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
    controlMode: 'auto', // 'auto', 'mobile', 'desktop', 'gamepad'

    // Gamepad state
    _gamepadIndex: null,          // which slot is the active controller
    _gamepadActive: false,        // true once a controller is the active gameplay input
    _gamepadDeadzone: 0.12,       // radial deadzone (0-1)
    _gamepadStartPrev: false,     // tracks previous Start button state for edge detection
    _gamepadSelectPrev: false,    // tracks Select/Back button state
    _gamepadCanvas: null,         // canvas used to initialize hidden gamepad controls
    _gamepadFamily: 'generic',    // playstation, xbox, nintendo, steam, generic
    _activeInputSource: 'default', // 'default', 'keyboardMouse', 'touch', 'gamepad'
    _lastGamepadInputAt: 0,
    _lastNonGamepadInputAt: 0,
    _inputSourceSwitchDelayMs: 250,
    _hadOnScreenTouchControls: false,
    _touchControlsHiddenForGamepad: false,
    _lifecycleHandlersInstalled: false,
    _gamepadActivationFrames: 0,
    _gamepadActivationFramesRequired: 4,

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
            heavyAttack: 'joystick-press-release',  // Energy beam (hold to aim with telegraph, release to fire)
            specialAbility: 'joystick-press-release' // Blink (stick aims angle; hold time scales distance; auto-fire at max)
        }
    },

    // Get input type for a specific ability of a class
    getAbilityInputType(classType, ability) {
        if (!this.classInputConfig[classType]) return 'button';
        return this.classInputConfig[classType][ability] || 'button';
    },

    getDeviceProfile() {
        if (typeof DeviceDetection !== 'undefined' && DeviceDetection.getProfile) {
            return DeviceDetection.getProfile();
        }
        return {
            formFactor: 'unknown',
            os: 'unknown',
            isMobile: false,
            isPhone: false,
            isTablet: false,
            isDesktop: true,
            confidence: 'low',
            reason: 'device-detection-unavailable',
            capabilities: {}
        };
    },

    // Device detection - delegates to layered DeviceDetection module.
    isMobileDevice() {
        if (typeof DeviceDetection !== 'undefined' && DeviceDetection.isMobileDevice) {
            return DeviceDetection.isMobileDevice();
        }
        return false;
    },

    // Check if a gamepad is the active input device
    isGamepadMode() {
        return this._gamepadActive;
    },

    // Check whether UI/layout should use mobile presentation.
    isMobileUiMode() {
        if (this.controlMode === 'mobile' || this.controlMode === 'touch') return true;
        if (this.controlMode === 'desktop') return false;
        return this.isMobileDevice();
    },

    _syncUiModeClass() {
        document.body.classList.toggle('touch-mode', this.isMobileUiMode());
    },

    shouldShowWorldInteractionHints() {
        return this.isGamepadMode() || !this.isMobileUiMode();
    },

    shouldShowMobileControllerCooldowns() {
        return this.isGamepadMode() && this._touchControlsHiddenForGamepad;
    },

    getActiveInputSource() {
        return this._activeInputSource;
    },

    getInputContext() {
        const viewport = typeof window !== 'undefined'
            ? {
                width: window.innerWidth || null,
                height: window.innerHeight || null,
                dpr: window.devicePixelRatio || 1,
                orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
            }
            : {};
        const device = this.getDeviceProfile();
        return {
            controlMode: this.controlMode,
            activeInputSource: this._activeInputSource,
            mobileUi: this.isMobileUiMode(),
            gamepad: this.isGamepadMode(),
            gamepadFamily: this._gamepadFamily,
            deviceFormFactor: device.formFactor,
            deviceOs: device.os,
            deviceConfidence: device.confidence,
            deviceReason: device.reason,
            touchPrimary: device.capabilities && device.capabilities.touchPrimary,
            fullscreen: !!(typeof document !== 'undefined' && (document.fullscreenElement || document.webkitFullscreenElement ||
                document.mozFullScreenElement)) ||
                !!(typeof Game !== 'undefined' && Game.pseudoFullscreenActive),
            mobileZoom: typeof Game !== 'undefined' && Game.mobileZoom ? Game.mobileZoom : 1,
            viewZoom: typeof Game !== 'undefined' && Game.getViewZoom ? Game.getViewZoom() : 1,
            cameraDistance: typeof Game !== 'undefined' && Game.cameraDistance ? Game.cameraDistance : 'medium',
            viewport
        };
    },

    _recordInputEvent(type, metadata = {}) {
        if (typeof Telemetry === 'undefined' || !Telemetry || !Telemetry.recordEvent) return;
        Telemetry.recordEvent(type, {
            roomNumber: typeof Game !== 'undefined' ? Game.roomNumber : null,
            playerId: typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null,
            metadata: {
                ...this.getInputContext(),
                ...metadata
            }
        });
    },

    _detectGamepadFamily(gamepad) {
        const id = (gamepad && gamepad.id ? gamepad.id : '').toLowerCase();
        if (/dualsense|dualshock|playstation|sony|wireless controller|ps[345]/i.test(id)) return 'playstation';
        if (/nintendo|switch|joy-?con|pro controller|wii/i.test(id)) return 'nintendo';
        if (/steam|valve|hori/i.test(id)) return 'steam';
        if (/xbox|xinput|microsoft|360|series|one controller/i.test(id)) return 'xbox';
        return 'generic';
    },

    _getMappedGamepad(gp) {
        if (!gp) return null;
        if (gp.mapping === 'standard') return gp;

        const id = (gp.id || '').toLowerCase();
        const buttons = [];
        const axes = [];

        for (let i = 0; i < (gp.axes || []).length; i++) {
            axes.push(gp.axes[i] || 0);
        }

        for (let i = 0; i < (gp.buttons || []).length; i++) {
            const b = gp.buttons[i];
            buttons.push({
                pressed: b ? b.pressed : false,
                value: b ? b.value : 0
            });
        }

        // Generic and Steam-specific fallback mapper to align non-standard layouts
        while (axes.length < 4) axes.push(0);
        while (buttons.length < 16) buttons.push({ pressed: false, value: 0 });

        return {
            id: gp.id,
            index: gp.index,
            connected: gp.connected,
            mapping: 'standard',
            buttons: buttons,
            axes: axes
        };
    },

    _getGamepadButtonStyle(button) {
        const styles = {
            playstation: {
                interact: { mark: 'cross', color: '#6d96d8', text: 'Cross' },
                modifier: { mark: 'triangle', color: '#7ee083', text: 'Triangle' }
            },
            xbox: {
                interact: { mark: 'text', label: 'A', color: '#6fcf5f', text: 'A' },
                modifier: { mark: 'text', label: 'Y', color: '#f2d35b', text: 'Y' }
            },
            steam: {
                interact: { mark: 'text', label: 'A', color: '#6fcf5f', text: 'A' },
                modifier: { mark: 'text', label: 'Y', color: '#f2d35b', text: 'Y' }
            },
            nintendo: {
                // Standard Gamepad API index 0 is the bottom face button (B on Nintendo),
                // and index 3 is the top face button (X on Nintendo).
                interact: { mark: 'text', label: 'B', color: '#f06b6b', text: 'B' },
                modifier: { mark: 'text', label: 'X', color: '#6d96d8', text: 'X' }
            },
            generic: {
                interact: { mark: 'text', label: 'A', color: '#ffffff', text: 'A' },
                modifier: { mark: 'text', label: 'Y', color: '#ffffff', text: 'Y' }
            }
        };

        const familyStyles = styles[this._gamepadFamily] || styles.generic;
        return familyStyles[button] || styles.generic[button] || { mark: 'text', label: '?', color: '#ffffff', text: '?' };
    },

    getInputHint(action) {
        const desktopHints = {
            interact: 'G',
            modifier: 'M'
        };

        if (this.isGamepadMode()) {
            return this._getGamepadButtonStyle(action).text;
        }

        return desktopHints[action] || '';
    },

    getInteractionPrompt(actionText = 'interact') {
        if (this.isGamepadMode()) {
            return `Press ${this.getInputHint('interact')} to ${actionText}`;
        }
        if (this.isMobileUiMode()) {
            return `Tap Interact to ${actionText}`;
        }
        return `Press ${this.getInputHint('interact')} to ${actionText}`;
    },

    /**
     * Combat ability prompt for tutorials/coach cards.
     * @param {'primary'|'heavy'|'special'|'dash'} ability
     */
    getCombatPrompt(ability) {
        const key = String(ability || '').toLowerCase();
        const desktop = {
            primary: 'LMB',
            heavy: 'RMB',
            special: 'Space',
            dash: 'Shift'
        };
        const mobile = {
            primary: 'Tap Primary',
            heavy: 'Tap Heavy',
            special: 'Tap Special',
            dash: 'Tap Dodge'
        };
        const gamepad = {
            primary: 'RT',
            heavy: 'LT',
            special: 'LB',
            dash: 'RB'
        };
        if (this.isGamepadMode()) {
            return gamepad[key] || '';
        }
        if (this.isMobileUiMode && this.isMobileUiMode()) {
            return mobile[key] || '';
        }
        return desktop[key] || '';
    },

    getDoorPrompt(hasModifiers = false) {
        const selectHint = this.getInputHint('interact');
        const modifierHint = this.getInputHint('modifier');

        if (this.isGamepadMode()) {
            return hasModifiers
                ? `Press ${selectHint} to Select or ${modifierHint} for Modifier`
                : `Press ${selectHint} to Select`;
        }

        if (this.isMobileUiMode()) {
            return hasModifiers ? 'Tap Interact to Select' : 'Tap Interact to Select';
        }

        return hasModifiers
            ? `Press ${selectHint} to Select or ${modifierHint} for Modifier`
            : `Press ${selectHint} to Select`;
    },

    drawControllerButtonHint(ctx, button, x, y, size = 18) {
        const radius = size / 2;
        const buttonStyle = this._getGamepadButtonStyle(button);
        const markColor = buttonStyle.color || '#ffffff';

        ctx.save();
        ctx.translate(x, y);

        const gradient = ctx.createLinearGradient(0, -radius, 0, radius);
        gradient.addColorStop(0, '#050505');
        gradient.addColorStop(0.58, '#050505');
        gradient.addColorStop(1, '#2c2c2c');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.strokeStyle = markColor;
        ctx.fillStyle = markColor;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';

        if (buttonStyle.mark === 'triangle') {
            const top = -radius * 0.42;
            const bottom = radius * 0.38;
            const halfWidth = radius * 0.46;
            ctx.lineWidth = Math.max(2, size * 0.13);
            ctx.beginPath();
            ctx.moveTo(0, top);
            ctx.lineTo(halfWidth, bottom);
            ctx.lineTo(-halfWidth, bottom);
            ctx.closePath();
            ctx.stroke();
        } else if (buttonStyle.mark === 'cross') {
            const arm = radius * 0.48;
            ctx.lineWidth = Math.max(3, size * 0.16);
            ctx.beginPath();
            ctx.moveTo(-arm, -arm);
            ctx.lineTo(arm, arm);
            ctx.moveTo(arm, -arm);
            ctx.lineTo(-arm, arm);
            ctx.stroke();
        } else {
            ctx.font = `bold ${Math.floor(size * 0.72)}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(buttonStyle.label || '?', 0, 1);
        }

        ctx.restore();
    },

    drawInteractionPrompt(ctx, actionText, x, y) {
        if (!this.isGamepadMode()) {
            ctx.fillText(this.getInteractionPrompt(actionText), x, y);
            return;
        }

        this._drawGamepadPrompt(ctx, [
            { type: 'text', text: 'Press ' },
            { type: 'button', button: 'interact' },
            { type: 'text', text: ` to ${actionText}` }
        ], x, y);
    },

    drawDoorPrompt(ctx, hasModifiers, x, y) {
        if (!this.isGamepadMode()) {
            ctx.fillText(this.getDoorPrompt(hasModifiers), x, y);
            return;
        }

        const parts = [
            { type: 'text', text: 'Press ' },
            { type: 'button', button: 'interact' },
            { type: 'text', text: ' to Select' }
        ];

        if (hasModifiers) {
            parts.push(
                { type: 'text', text: ' or ' },
                { type: 'button', button: 'modifier' },
                { type: 'text', text: ' for Modifier' }
            );
        }

        this._drawGamepadPrompt(ctx, parts, x, y);
    },

    _drawGamepadPrompt(ctx, parts, x, y) {
        const originalAlign = ctx.textAlign;
        const buttonSize = 18;
        const gap = 3;
        let totalWidth = 0;

        for (const part of parts) {
            if (part.type === 'button') {
                totalWidth += buttonSize + gap * 2;
            } else {
                totalWidth += ctx.measureText(part.text).width;
            }
        }

        let cursorX = x;
        if (originalAlign === 'center') {
            cursorX -= totalWidth / 2;
        } else if (originalAlign === 'right' || originalAlign === 'end') {
            cursorX -= totalWidth;
        }

        ctx.save();
        ctx.textAlign = 'left';
        for (const part of parts) {
            if (part.type === 'button') {
                cursorX += gap;
                this.drawControllerButtonHint(ctx, part.button, cursorX + buttonSize / 2, y - buttonSize * 0.35, buttonSize);
                cursorX += buttonSize + gap;
            } else {
                ctx.fillText(part.text, cursorX, y);
                cursorX += ctx.measureText(part.text).width;
            }
        }
        ctx.restore();
    },

    _clearTouchControls() {
        this.touchActive = false;
        this.activeTouches = {};
        this.touchJoysticks = {};
        this.touchButtons = {};
    },

    _applyControlSurface(canvas = this._gamepadCanvas) {
        const hadOnScreenTouchControls = this._hadOnScreenTouchControls;
        const wantsMobileSurface = this.isMobileUiMode() || this.controlMode === 'mobile' || this.controlMode === 'touch';
        this._clearTouchControls();
        this._hadOnScreenTouchControls = false;

        if (this.isGamepadMode()) {
            this._touchControlsHiddenForGamepad = hadOnScreenTouchControls || wantsMobileSurface;
            if (canvas) {
                this._initGamepadControls(canvas);
            }
            return;
        }

        this._touchControlsHiddenForGamepad = false;
        if (this.isMobileUiMode()) {
            if (canvas) {
                this.initTouchControls(canvas);
            }
        }
    },

    _now() {
        return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    },

    // Map KeyboardEvent.code/key pairs to canonical key names used by gameplay.
    _keysFromEvent(e) {
        const keys = [];
        const code = e.code || '';
        const key = (e.key || '').toLowerCase();

        const add = (name) => {
            if (name && !keys.includes(name)) keys.push(name);
        };

        if (code === 'KeyW' || key === 'w') add('w');
        if (code === 'KeyS' || key === 's') add('s');
        if (code === 'KeyA' || key === 'a') add('a');
        if (code === 'KeyD' || key === 'd') add('d');
        if (code === 'ArrowUp' || key === 'arrowup') add('arrowup');
        if (code === 'ArrowDown' || key === 'arrowdown') add('arrowdown');
        if (code === 'ArrowLeft' || key === 'arrowleft') add('arrowleft');
        if (code === 'ArrowRight' || key === 'arrowright') add('arrowright');

        if (code === 'Space' || key === ' ') add(' ');
        if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') add('shift');
        if (code === 'KeyG' || key === 'g') add('g');
        if (code === 'KeyM' || key === 'm') add('m');
        if (code === 'Tab' || key === 'tab') add('tab');
        if (code === 'BracketLeft' || key === '[') add('[');
        if (code === 'BracketRight' || key === ']') add(']');
        if (code === 'KeyI' || key === 'i') add('i');
        if (code === 'Escape' || key === 'escape') add('escape');

        if (keys.length === 0 && key && key.length === 1) add(key);

        return keys;
    },

    _applyKeyEvent(e, pressed) {
        const names = this._keysFromEvent(e);
        for (const name of names) {
            this.keys[name] = pressed;
        }
    },

    _resetKeyboardState(reason = 'manual') {
        this.keys = {};
        this._gamepadStartPrev = false;
        this._gamepadSelectPrev = false;
        this._recordInputEvent('inputReset', { reason, target: 'keyboard' });
    },

    _resetPointerState(reason = 'manual') {
        this.mouseLeft = false;
        this.mouseRight = false;
        this._recordInputEvent('inputReset', { reason, target: 'pointer' });
    },

    _resetTouchState(reason = 'manual') {
        for (const joystick of Object.values(this.touchJoysticks)) {
            if (joystick && joystick.touchId !== null) {
                joystick.endTouch(joystick.touchId);
            }
        }
        for (const button of Object.values(this.touchButtons)) {
            if (button && button.touchId !== null) {
                button.endTouch(button.touchId);
            }
        }
        this.activeTouches = {};
        this.touchActive = false;
        this._recordInputEvent('inputReset', { reason, target: 'touch' });
    },

    _resetInputOnContextLoss(reason) {
        this._resetKeyboardState(reason);
        this._resetPointerState(reason);
        if (this.isTouchMode()) {
            this._resetTouchState(reason);
        }
    },

    _installLifecycleHandlers(canvas) {
        if (typeof window === 'undefined' || this._lifecycleHandlersInstalled) return;
        this._lifecycleHandlersInstalled = true;

        window.addEventListener('blur', () => {
            this._resetInputOnContextLoss('blur');
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this._resetInputOnContextLoss('visibility-hidden');
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseLeft = false;
            if (e.button === 2) this.mouseRight = false;
        });

        if (canvas) {
            canvas.setAttribute('tabindex', '-1');
            const focusCanvas = () => {
                if (typeof canvas.focus !== 'function' || document.activeElement === canvas) return;
                try {
                    canvas.focus({ preventScroll: true });
                } catch (_) {
                    canvas.focus();
                }
            };
            canvas.addEventListener('pointerdown', focusCanvas);
            canvas.addEventListener('mousedown', focusCanvas);
        }
    },

    _emitInputSourceChange() {
        if (typeof window === 'undefined') return;
        const detail = {
            source: this._activeInputSource,
            gamepad: this.isGamepadMode(),
            family: this._gamepadFamily
        };
        window.dispatchEvent(new CustomEvent('inputsourcechange', {
            detail
        }));
        this._recordInputEvent('inputSourceChange', detail);
    },

    _activateGamepadInput(canvas = this._gamepadCanvas) {
        const now = this._now();
        this._lastGamepadInputAt = now;

        if (this._gamepadActive) {
            if (this._activeInputSource !== 'gamepad') {
                this._activeInputSource = 'gamepad';
                this._emitInputSourceChange();
            }
            return true;
        }
        if (now - this._lastNonGamepadInputAt < this._inputSourceSwitchDelayMs) return false;

        this._gamepadActive = true;
        this._activeInputSource = 'gamepad';
        this._applyControlSurface(canvas);
        this._emitInputSourceChange();
        return true;
    },

    _activateNonGamepadInput(source, canvas = this._gamepadCanvas) {
        const now = this._now();
        this._lastNonGamepadInputAt = now;

        if (!this._gamepadActive) {
            if (this._activeInputSource !== source) {
                this._activeInputSource = source;
                this._emitInputSourceChange();
            }
            return true;
        }

        if (now - this._lastGamepadInputAt < this._inputSourceSwitchDelayMs) return false;

        this._gamepadActive = false;
        this._gamepadStartPrev = false;
        this._gamepadSelectPrev = false;
        this._activeInputSource = source;
        this._applyControlSurface(canvas);
        this._emitInputSourceChange();
        return true;
    },

    applyControlMode(mode = this.controlMode, canvas = this._gamepadCanvas) {
        this.controlMode = mode;
        this._gamepadActive = mode === 'gamepad';
        this._activeInputSource = this._gamepadActive ? 'gamepad' : 'default';
        this._syncUiModeClass();

        const game = (typeof Game !== 'undefined') ? Game : window.Game;
        if (game && game.canvas && game.setupResponsiveCanvas) {
            game.setupResponsiveCanvas();
        }
        this._applyControlSurface((game && game.canvas) ? game.canvas : canvas);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('controlmodechange', {
                detail: {
                    mode: this.controlMode,
                    mobileUi: this.isMobileUiMode(),
                    gamepad: this.isGamepadMode(),
                    family: this._gamepadFamily
                }
            }));
        }
        this._recordInputEvent('controlModeChange', {
            mode: this.controlMode,
            gamepad: this.isGamepadMode(),
            family: this._gamepadFamily
        });
    },

    // Check if touch mode is active (also true for gamepad, which reuses the touch input path)
    isTouchMode() {
        if (this.isGamepadMode()) return true;
        if (this.controlMode === 'mobile' || this.controlMode === 'touch') {
            return true;
        }
        if (this.controlMode === 'desktop') {
            return false;
        }
        // Auto mode: default to mobile device detection
        return this.isMobileDevice();
    },

    // Initialize input handlers
    init(canvas) {
        this._gamepadCanvas = canvas;

        // Load control mode setting
        if (typeof SaveSystem !== 'undefined') {
            this.controlMode = SaveSystem.getControlMode() || 'auto';
        }

        this.applyControlMode(this.controlMode, canvas);
        this._installLifecycleHandlers(canvas);

        if (typeof window !== 'undefined') {
            const recheckDeviceProfile = () => {
                if (typeof DeviceDetection !== 'undefined' && DeviceDetection.invalidateCache) {
                    DeviceDetection.invalidateCache();
                }
                if (this.controlMode === 'auto') {
                    this._syncUiModeClass();
                    this._applyControlSurface(this._gamepadCanvas);
                }
            };
            window.addEventListener('resize', recheckDeviceProfile);
            window.addEventListener('orientationchange', recheckDeviceProfile);
        }

        // Keyboard events - window-level so we receive keys regardless of focused DOM element.
        const onKeyDown = (e) => {
            // Don't intercept keys if user is typing in an input field
            const target = e.target;
            if (typeof isFormFieldTarget === 'function' && isFormFieldTarget(target)) {
                this._applyKeyEvent(e, true);
                return; // Don't process game shortcuts when typing
            }

            this._activateNonGamepadInput('keyboardMouse', canvas);
            this._applyKeyEvent(e, true);

            // Prevent default Tab behavior (focus shifting) when used for character sheet
            if (e.key === 'Tab') {
                e.preventDefault();
            }

            // Prevent arrow keys from scrolling the page when cycling ground loot
            if (typeof Game !== 'undefined' && Game.state === 'PLAYING' &&
                (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
                e.preventDefault();
            }

        };

        const onKeyUp = (e) => {
            this._applyKeyEvent(e, false);
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

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
            this._activateNonGamepadInput('keyboardMouse', canvas);
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

        // ---- Gamepad API ----
        window.addEventListener('gamepadconnected', (e) => {
            console.log(`[INPUT] Gamepad connected: "${e.gamepad.id}" (index ${e.gamepad.index})`);
            this._activateGamepad(e.gamepad, canvas);
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log(`[INPUT] Gamepad disconnected: "${e.gamepad.id}" (index ${e.gamepad.index})`);
            if (e.gamepad.index === this._gamepadIndex) {
                this._gamepadIndex = null;
                this._gamepadActive = false;
                this._gamepadStartPrev = false;
                this._gamepadSelectPrev = false;
                this._gamepadFamily = 'generic';
                this._activeInputSource = 'default';
                this._syncUiModeClass();
                this._applyControlSurface(canvas);
            }
        });

        // Some browsers expose pads that were already connected before our listener was registered.
        this._scanConnectedGamepads(canvas);
    },

    _hasGamepadInput(gamepad) {
        if (!gamepad || !gamepad.connected) return false;

        const axisMoved = Array.from(gamepad.axes || []).some(axis => Math.abs(axis) > this._gamepadDeadzone);
        const buttonPressed = Array.from(gamepad.buttons || []).some(button => {
            return button && (button.pressed || button.value > 0.15);
        });

        return axisMoved || buttonPressed;
    },

    _findGamepadWithInput() {
        if (!navigator.getGamepads) return null;
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad && gamepad.connected && this._hasGamepadInput(gamepad)) {
                return gamepad;
            }
        }
        return null;
    },

    _activateGamepad(gamepad, canvas = this._gamepadCanvas, activateInput = false) {
        if (!gamepad || !gamepad.connected) return false;
        if (this._gamepadIndex !== null && this._gamepadIndex !== gamepad.index) return false;

        this._gamepadIndex = gamepad.index;
        this._gamepadFamily = this._detectGamepadFamily(gamepad);
        if (activateInput || this.controlMode === 'gamepad') {
            return this._activateGamepadInput(canvas);
        }
        return true;
    },

    _scanConnectedGamepads(canvas = this._gamepadCanvas, options = {}) {
        if (!navigator.getGamepads) return false;

        const requireInput = options.requireInput === true;
        const activateInput = options.activateInput === true;
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (requireInput && !this._hasGamepadInput(gamepad)) continue;

            if (this._activateGamepad(gamepad, canvas, activateInput)) {
                console.log(`[INPUT] Gamepad detected: "${gamepad.id}" (index ${gamepad.index})`);
                return true;
            }
        }
        return false;
    },

    // Create minimal stub joystick/button objects for gamepad use when touch was never initialized
    _initGamepadControls(canvas) {
        // If touch controls are already set up (mobile user with controller), nothing to do
        if (this.touchJoysticks.movement && this.touchJoysticks.basicAttack) return;

        // Create VirtualJoystick instances at off-screen positions (they won't render)
        const cx = -9999, cy = -9999;
        this.touchJoysticks.movement     = new VirtualJoystick(cx, cy, 60, 14);
        this.touchJoysticks.basicAttack  = new VirtualJoystick(cx, cy, 55, 14);
        this.touchJoysticks.heavyAttack  = new VirtualJoystick(cx, cy, 38, 14);
        this.touchJoysticks.specialAbility = new VirtualJoystick(cx, cy, 38, 14);
        this.touchJoysticks.dodge        = new VirtualJoystick(cx, cy, 38, 14);

        this.touchButtons.heavyAttack    = new TouchButton(-9999, -9999, 48, 44, 'Heavy');
        this.touchButtons.specialAbility = new TouchButton(-9999, -9999, 48, 44, 'Spcl');
        this.touchButtons.dodge          = new TouchButton(-9999, -9999, 48, 44, 'Dodge');
    },

    // Poll the Gamepad API and write its state into the existing touch joystick/button objects.
    // Must be called BEFORE the per-frame button.update() reset inside Input.update().
    _updateGamepad() {
        // Hot-swapping check: if another gamepad has active input, switch to it!
        const activeGamepad = this._findGamepadWithInput();
        if (activeGamepad && activeGamepad.index !== this._gamepadIndex) {
            console.log(`[INPUT] Dynamic hot-swap gamepad to: "${activeGamepad.id}" (index ${activeGamepad.index})`);
            this._gamepadIndex = activeGamepad.index;
            this._gamepadFamily = this._detectGamepadFamily(activeGamepad);
            this._activateGamepadInput();
        }

        if (this._gamepadIndex === null && !this._scanConnectedGamepads()) return;

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        let gp = gamepads[this._gamepadIndex];
        if (!gp || !gp.connected) {
            this._gamepadIndex = null;
            this._gamepadActive = false;
            this._gamepadFamily = 'generic';
            this._activeInputSource = 'default';
            this._applyControlSurface();
            this._scanConnectedGamepads();
            return;
        }

        gp = this._getMappedGamepad(gp);

        if (this._hasGamepadInput(gp) && !this._activateGamepadInput()) return;

        const dz = this._gamepadDeadzone;

        // Radial deadzone helper - returns { x, y, mag } all in 0-1 range
        const applyDeadzone = (rawX, rawY) => {
            const mag = Math.sqrt(rawX * rawX + rawY * rawY);
            if (mag < dz) return { x: 0, y: 0, mag: 0 };
            const scaled = (mag - dz) / (1 - dz); // remap so dz→0 becomes 0 and 1 stays 1
            return { x: (rawX / mag) * scaled, y: (rawY / mag) * scaled, mag: scaled };
        };

        // Helper to push analog stick values into a VirtualJoystick
        const syncJoystick = (joystick, stick, threshold = 0.05) => {
            if (!joystick) return;
            joystick.active    = stick.mag > threshold;
            joystick.magnitude = stick.mag;
            if (stick.mag > threshold) {
                joystick.angle = Math.atan2(stick.y, stick.x);
            }
            // Keep currentX/currentY in sync so rendering (if any) looks right
            joystick.currentX = joystick.centerX + Math.cos(joystick.angle) * joystick.magnitude * joystick.radius;
            joystick.currentY = joystick.centerY + Math.sin(joystick.angle) * joystick.magnitude * joystick.radius;
        };

        const syncAbilityJoystick = (joystick, stick, isDown, threshold = 0.05) => {
            if (!joystick) return;
            joystick.active = isDown && stick.mag > threshold;
            joystick.magnitude = isDown ? stick.mag : 0;
            if (stick.mag > threshold) {
                joystick.angle = Math.atan2(stick.y, stick.x);
            }
            joystick.currentX = joystick.centerX + Math.cos(joystick.angle) * joystick.magnitude * joystick.radius;
            joystick.currentY = joystick.centerY + Math.sin(joystick.angle) * joystick.magnitude * joystick.radius;
        };

        // Helper to push a boolean into a TouchButton, computing justPressed/justReleased
        const syncButton = (button, isDown) => {
            if (!button) return;
            const was = button.pressed;
            button.pressed      = isDown;
            button.justPressed  = isDown && !was;
            button.justReleased = !isDown && was;
            button.active       = isDown;
        };

        // DOM menus own the pad while open - don't also drive the player / interact
        const uiBlocking = window.ControllerNav
            && typeof window.ControllerNav.isBlockingGameplay === 'function'
            && window.ControllerNav.isBlockingGameplay();

        const clearGameplayPad = () => {
            syncJoystick(this.touchJoysticks.movement, { x: 0, y: 0, mag: 0 });
            if (this.touchJoysticks.basicAttack) {
                this.touchJoysticks.basicAttack.active = false;
                this.touchJoysticks.basicAttack.magnitude = 0;
            }
            syncButton(this.touchButtons.heavyAttack, false);
            syncAbilityJoystick(this.touchJoysticks.heavyAttack, { x: 0, y: 0, mag: 0 }, false);
            syncButton(this.touchButtons.specialAbility, false);
            syncAbilityJoystick(this.touchJoysticks.specialAbility, { x: 0, y: 0, mag: 0 }, false);
            syncButton(this.touchButtons.dodge, false);
            syncAbilityJoystick(this.touchJoysticks.dodge, { x: 0, y: 0, mag: 0 }, false);
            this.keys['g'] = false;
            this.keys['m'] = false;
            this.keys['arrowleft'] = false;
            this.keys['arrowright'] = false;
        };

        if (uiBlocking) {
            clearGameplayPad();
            if (!(window.ControllerNav && window.ControllerNav.handlesSystemButtons)) {
                const startNow = gp.buttons[9]?.pressed || false;
                if (startNow && !this._gamepadStartPrev) {
                    if (typeof Game !== 'undefined' && Game.state === 'TITLE' && Game.dismissTitleScreen) {
                        Game.dismissTitleScreen();
                    } else if (typeof Game !== 'undefined' && Game.togglePause) {
                        Game.togglePause();
                    }
                }
                this._gamepadStartPrev = startNow;

                const selectNow = gp.buttons[8]?.pressed || false;
                if (selectNow && !this._gamepadSelectPrev) {
                    this.keys['tab'] = true;
                } else if (!selectNow && this._gamepadSelectPrev) {
                    this.keys['tab'] = false;
                }
                this._gamepadSelectPrev = selectNow;
            }
            return;
        }

        // ---- Left stick → movement ----
        const leftStick = applyDeadzone(gp.axes[0] || 0, gp.axes[1] || 0);
        // D-pad also drives movement as digital override
        const dpadUp    = gp.buttons[12]?.pressed || false;
        const dpadDown  = gp.buttons[13]?.pressed || false;
        const dpadLeft  = gp.buttons[14]?.pressed || false;
        const dpadRight = gp.buttons[15]?.pressed || false;

        // Near stacked loot: D-pad L/R cycles selection (stick still moves)
        const lootCycleActive = typeof LootSelection !== 'undefined'
            && LootSelection.nearbyItems
            && LootSelection.nearbyItems.length > 1
            && (dpadLeft || dpadRight)
            && !dpadUp
            && !dpadDown;

        if (lootCycleActive) {
            syncJoystick(this.touchJoysticks.movement, leftStick);
            this.keys['arrowleft'] = dpadLeft;
            this.keys['arrowright'] = dpadRight;
        } else {
            this.keys['arrowleft'] = false;
            this.keys['arrowright'] = false;
            if (dpadUp || dpadDown || dpadLeft || dpadRight) {
                let dx = 0, dy = 0;
                if (dpadUp)    dy -= 1;
                if (dpadDown)  dy += 1;
                if (dpadLeft)  dx -= 1;
                if (dpadRight) dx += 1;
                const len = Math.sqrt(dx * dx + dy * dy);
                syncJoystick(this.touchJoysticks.movement, { x: dx / len, y: dy / len, mag: 1 });
            } else {
                syncJoystick(this.touchJoysticks.movement, leftStick);
            }
        }

        // ---- Right stick -> aim, RT/R2 -> primary attack ----
        const rightStick = applyDeadzone(gp.axes[2] || 0, gp.axes[3] || 0);
        const primaryDown = (gp.buttons[7]?.value ?? 0) > 0.15;
        if (this.touchJoysticks.basicAttack) {
            const j = this.touchJoysticks.basicAttack;
            j.active = primaryDown;
            if (rightStick.mag > 0.05) {
                j.magnitude = rightStick.mag;
                j.angle     = Math.atan2(rightStick.y, rightStick.x);
            } else if (primaryDown) {
                j.magnitude = 1; // Fire forward at last known angle
            } else {
                // Keep the last aim angle available without firing.
                j.magnitude = rightStick.mag;
            }
            j.currentX = j.centerX + Math.cos(j.angle) * j.magnitude * j.radius;
            j.currentY = j.centerY + Math.sin(j.angle) * j.magnitude * j.radius;
        }

        // ---- Shoulders/triggers -> combat abilities ----
        // Heavy attack: LT / L2 (button 6)
        const heavyDown = (gp.buttons[6]?.value ?? 0) > 0.15;
        syncButton(this.touchButtons.heavyAttack, heavyDown);
        // Attack direction should prefer the right stick; movement is only a fallback while the ability is held.
        syncAbilityJoystick(this.touchJoysticks.heavyAttack, rightStick.mag > 0.05 ? rightStick : leftStick, heavyDown);

        // Special ability: LB / L1 (button 4)
        const specialDown = gp.buttons[4]?.pressed || false;
        syncButton(this.touchButtons.specialAbility, specialDown);
        syncAbilityJoystick(this.touchJoysticks.specialAbility, rightStick.mag > 0.05 ? rightStick : leftStick, specialDown);

        // Dodge: RB / R1 (button 5)
        const dodgeDown = gp.buttons[5]?.pressed || false;
        syncButton(this.touchButtons.dodge, dodgeDown);
        syncAbilityJoystick(this.touchJoysticks.dodge, leftStick, dodgeDown);

        if (!(window.ControllerNav && window.ControllerNav.handlesSystemButtons)) {
            // ---- Start (button 9) → title dismiss or toggle pause ----
            const startNow = gp.buttons[9]?.pressed || false;
            if (startNow && !this._gamepadStartPrev) {
                if (typeof Game !== 'undefined' && Game.state === 'TITLE' && Game.dismissTitleScreen) {
                    Game.dismissTitleScreen();
                } else if (typeof Game !== 'undefined' && Game.togglePause) {
                    Game.togglePause();
                }
            }
            this._gamepadStartPrev = startNow;

            // ---- Select (button 8) → character sheet ----
            const selectNow = gp.buttons[8]?.pressed || false;
            if (selectNow && !this._gamepadSelectPrev) {
                // Simulate pressing Tab to open/close character sheet
                this.keys['tab'] = true;
            } else if (!selectNow && this._gamepadSelectPrev) {
                this.keys['tab'] = false;
            }
            this._gamepadSelectPrev = selectNow;
        }

        // ---- Cross / X (button 0) -> interact (G key) ----
        const interactNow = gp.buttons[0]?.pressed || false;
        this.keys['g'] = interactNow;

        // ---- Triangle / Y (button 3) -> room modifier (M key) ----
        const modifierNow = gp.buttons[3]?.pressed || false;
        this.keys['m'] = modifierNow;
    },


    // Initialize touch control UI elements
    getSafeAreaInsets() {
        if (typeof document === 'undefined') {
            return { top: 0, right: 0, bottom: 0, left: 0 };
        }
        if (!this._safeAreaProbe) {
            const probe = document.createElement('div');
            probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
            document.body.appendChild(probe);
            this._safeAreaProbe = probe;
        }
        const style = getComputedStyle(this._safeAreaProbe);
        return {
            top: parseFloat(style.paddingTop) || 0,
            right: parseFloat(style.paddingRight) || 0,
            bottom: parseFloat(style.paddingBottom) || 0,
            left: parseFloat(style.paddingLeft) || 0
        };
    },

    initTouchControls(canvas) {
        this._hadOnScreenTouchControls = true;
        this._touchControlsHiddenForGamepad = false;

        // Use logical dimensions if available (Game.config), otherwise fallback to canvas dimensions
        // This handles supersampling where canvas.width is 2x logical width
        const width = (typeof Game !== 'undefined' && Game.config) ? Game.config.width : canvas.width;
        const height = (typeof Game !== 'undefined' && Game.config) ? Game.config.height : canvas.height;

        // Get mobile zoom level to adjust positioning
        const mobileZoom = (typeof Game !== 'undefined' && Game.getViewZoom)
            ? Game.getViewZoom()
            : ((typeof Game !== 'undefined' && Game.mobileZoom) ? Game.mobileZoom : 1.0);

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
        const baseMovementRadius = 60;
        const baseAttackRadius = 55;
        const baseButtonSize = 54;

        const movementRadius = Math.floor(baseMovementRadius * widthScale);
        const basicAttackRadius = Math.floor(baseAttackRadius * widthScale);
        const buttonSize = Math.floor(baseButtonSize * widthScale);
        const buttonHeight = buttonSize;

        // Check if mobile
        const isMobile = this.isMobileUiMode();
        
        // Offset controls away from notches/home indicators on mobile
        let safeAreaOffsetY = 0;
        let safeAreaOffsetX = 0;
        if (isMobile && typeof canvas.getBoundingClientRect === 'function') {
            const displayRect = canvas.getBoundingClientRect();
            const scaleX = displayRect.width > 0 ? width / displayRect.width : 1;
            const scaleY = displayRect.height > 0 ? height / displayRect.height : 1;
            const safe = this.getSafeAreaInsets();
            safeAreaOffsetY = safe.bottom * scaleY;
            safeAreaOffsetX = safe.left * scaleX;
        }
        
        // Note: Controls are rendered in screen space (canvas coordinates), not world space
        // Zoom affects world view, not screen space, so controls don't need zoom adjustment

        // RIGHT SIDE - Combat controls (right thumb zone)
        // Radial layout: Main attack joystick in center, ability buttons arranged around it
        // Position: Lower for better thumb reach, but ensure all controls stay on screen
        const rightX = width - Math.max(130, width * 0.10); // ~10% from right edge, min 130px

        // Radial button layout around the central joystick
        // Create a cohesive cluster with proper spacing (increased spacing to prevent accidental hits)
        const radialRadius = basicAttackRadius + Math.floor(58 * widthScale); // Distance from center (scaled)

        // Ensure all buttons/joysticks stay on screen (account for radial radius + button size)
        // Calculate AFTER radialRadius is defined
        const maxControlReach = Math.max(basicAttackRadius + radialRadius + buttonSize / 2, 140);
        const safeBottomMarginRight = maxControlReach + 20; // max reach + padding
        
        // On mobile, position controls lower for better thumb reach
        // Use a smaller fixed offset from bottom - prioritize percentage over safe margin
        // This ensures controls are positioned lower on the screen
        const mobileBottomOffset = Math.max(height * 0.20, 100); // At least 20% from bottom, minimum 100px
        const rightY = (isMobile
            ? height - mobileBottomOffset // Mobile: fixed offset from bottom
            : height - Math.max(140, height * 0.18)) - safeAreaOffsetY; // Desktop: ~18% from bottom
        
        // Debug: Log control positioning to verify changes
        if (isMobile) {
            const percentFromBottom = ((height - rightY) / height * 100).toFixed(1);
            console.log(`[TOUCH CONTROLS] Mobile positioning: height=${height}, rightY=${rightY.toFixed(0)}, ${percentFromBottom}% from bottom, mobileBottomOffset=${mobileBottomOffset.toFixed(0)}, safeAreaOffsetY=${safeAreaOffsetY.toFixed(0)}`);
        }

        // Basic attack joystick (CENTRAL - primary action, main right thumb position)
        const centerX = rightX;
        const centerY = rightY;
        this.touchJoysticks.basicAttack = new VirtualJoystick(centerX, centerY, basicAttackRadius, 20);

        // LEFT SIDE - Movement joystick (left thumb zone)
        // Position: Aligned with center of right cluster (centerY) for consistent thumb height
        const leftX = Math.max(100, width * 0.08) + safeAreaOffsetX; // ~8% from left edge, min 100px
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
        const abilityJoystickRadius = Math.floor(buttonSize * 0.52);
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
        if (!this.isGamepadMode()) {
            this._activateNonGamepadInput('touch', canvas);
        } else if (!this._activateNonGamepadInput('touch', canvas)) {
            return;
        }

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
                    const restrictedHitRadius = joystick.radius * 1.2;

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
                                if (buttonDistance < Math.max(button.width, button.height) / 2 + 10) {
                                    tooCloseToButton = true;
                                    break;
                                }
                            }
                        }

                        // Use restricted hit area when buttons are nearby
                        if (!tooCloseToButton && joystick.startTouch(touchId, x, y, restrictedHitRadius)) {
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
                    const fallbackHitRadius = joystick.radius * 1.15;
                    if (distance <= fallbackHitRadius && joystick.startTouch(touchId, x, y, fallbackHitRadius)) {
                        return;
                    }
                }
            }

            if (!isLeftSide) {
                this._recordInputEvent('mobileTouchMiss', {
                    side: 'right',
                    x: Math.round(x),
                    y: Math.round(y)
                });
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
        if (this._gamepadIndex === null || !this.isGamepadMode()) {
            const gamepad = this._findGamepadWithInput();
            if (gamepad) {
                this._gamepadActivationFrames++;
                if (this._gamepadActivationFrames >= this._gamepadActivationFramesRequired) {
                    this._activateGamepad(gamepad, this._gamepadCanvas, true);
                    this._gamepadActivationFrames = 0;
                }
            } else {
                this._gamepadActivationFrames = 0;
            }
        }

        if (!this.isTouchMode()) return;

        // Poll gamepad state FIRST so player code sees current values,
        // and BEFORE button.update() clears justPressed/justReleased
        if (this.isGamepadMode()) {
            this._updateGamepad();
        }

        // Update joystick snap-back animations (skip for gamepad - we set values directly)
        if (!this.isGamepadMode()) {
            for (const joystick of Object.values(this.touchJoysticks)) {
                if (joystick) {
                    joystick.update(deltaTime);
                }
            }
        }

        // Reset justPressed/justReleased flags (button state itself is preserved)
        for (const button of Object.values(this.touchButtons)) {
            if (button && !this.isGamepadMode()) {
                // Touch buttons manage their own lifecycle via touch events
                button.update(deltaTime);
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
                if (this.touchJoysticks.basicAttack.active ||
                    (this.isGamepadMode() && this.touchJoysticks.basicAttack.getMagnitude() > 0.1)) {
                    // Gamepad can aim with the right stick without firing primary.
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
            if (!this._hasWindowFocus()) return false;
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
            if (!this._hasWindowFocus()) return false;
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

    _hasWindowFocus() {
        return typeof document === 'undefined' || document.hasFocus();
    },

    // Check if a key is pressed
    isKeyPressed(key) {
        if (!this._hasWindowFocus()) return false;
        return this.keys[key.toLowerCase()] === true;
    },

    // Get key state
    getKeyState(key) {
        if (!this._hasWindowFocus()) return false;
        return this.keys[key.toLowerCase()] || false;
    },

    _getNumber(obj, keys, fallback = 0) {
        if (!obj) return fallback;
        for (const key of keys) {
            const value = obj[key];
            if (typeof value === 'number' && Number.isFinite(value)) return value;
        }
        return fallback;
    },

    _getChargeSnapshot(cooldowns, maxCharges, maxCooldown) {
        const chargeCount = Math.max(1, Math.floor(maxCharges || 1));
        const values = Array.isArray(cooldowns) ? cooldowns.slice(0, chargeCount) : [];
        while (values.length < chargeCount) values.push(0);
        const normalized = values.map(value => Math.max(0, Number.isFinite(value) ? value : 0));
        const readyCharges = normalized.filter(value => value <= 0).length;
        const nextCooldown = normalized.reduce((max, value) => Math.max(max, value), 0);
        return {
            charges: readyCharges,
            maxCharges: chargeCount,
            chargeCooldowns: normalized,
            cooldown: nextCooldown,
            maxCooldown
        };
    },

    getMobileCooldownSnapshot(player = (typeof Game !== 'undefined' ? Game.player : null)) {
        const attackMax = Math.max(0.0001, this._getNumber(player, ['attackCooldownTime'], 0.3));
        const attackCooldown = Math.max(0, this._getNumber(player, ['attackCooldown'], 0));

        const heavyMax = Math.max(0.0001, this._getNumber(player, ['heavyAttackCooldownTime', 'heavyCooldownTime'], 1.5));
        let heavy = {
            cooldown: Math.max(0, this._getNumber(player, ['heavyAttackCooldown', 'heavyCooldown', 'heavyRemaining'], 0)),
            maxCooldown: heavyMax,
            charges: null,
            maxCharges: null,
            chargeCooldowns: null
        };
        if (player && player.playerClass === 'hexagon') {
            const maxBeamCharges = Math.max(1, this._getNumber(player, ['maxBeamCharges', 'beamCharges'], 2));
            const beamSnapshot = this._getChargeSnapshot(player.beamChargeCooldowns || player.heavyChargeCooldowns, maxBeamCharges, heavyMax);
            heavy = {
                cooldown: beamSnapshot.cooldown,
                maxCooldown: beamSnapshot.maxCooldown,
                charges: beamSnapshot.charges,
                maxCharges: beamSnapshot.maxCharges,
                chargeCooldowns: beamSnapshot.chargeCooldowns
            };
        }

        const specialMax = Math.max(0.0001, this._getNumber(player, ['specialCooldownTime', 'specialTime'], 1));
        const special = {
            cooldown: Math.max(0, this._getNumber(player, ['specialCooldown', 'specialRemaining'], 0)),
            maxCooldown: specialMax,
            charges: null,
            maxCharges: null,
            chargeCooldowns: null
        };

        const dodgeMax = Math.max(0.0001, this._getNumber(player, ['dodgeCooldownTime', 'dashCooldownTime', 'dodgeMaxCooldown'], 1));
        const maxDodgeCharges = Math.max(1, this._getNumber(player, ['maxDodgeCharges', 'maxDashCharges'], 1));
        const dodgeSnapshot = this._getChargeSnapshot(player && (player.dodgeChargeCooldowns || player.dashChargeCooldowns), maxDodgeCharges, dodgeMax);
        const dodge = {
            cooldown: maxDodgeCharges > 1 ? dodgeSnapshot.cooldown : Math.max(0, this._getNumber(player, ['dodgeCooldown', 'dashCooldown', 'dodgeRemaining', 'dashRemaining'], dodgeSnapshot.cooldown)),
            maxCooldown: dodgeSnapshot.maxCooldown,
            charges: maxDodgeCharges > 1 ? dodgeSnapshot.charges : (dodgeSnapshot.cooldown <= 0 ? 1 : 0),
            maxCharges: dodgeSnapshot.maxCharges,
            chargeCooldowns: dodgeSnapshot.chargeCooldowns
        };

        return {
            attack: { cooldown: attackCooldown, maxCooldown: attackMax },
            heavy,
            special,
            dodge
        };
    },

    // Render touch controls
    render(ctx) {
        if (!this.isMobileUiMode()) return;
        // Gamepad uses the touch code path internally but has no on-screen controls to draw
        if (this.isGamepadMode()) return;

        // Get player for cooldown data
        const player = (typeof Game !== 'undefined') ? Game.player : null;
        const playerClass = player ? (player.playerClass || 'square') : 'square';
        const cooldowns = this.getMobileCooldownSnapshot(player);

        // --- BACKGROUNDS ---

        // LEFT SIDE: Movement joystick background
        if (this.touchJoysticks && this.touchJoysticks.movement) {
            const movement = this.touchJoysticks.movement;
            const bgGradL = ctx.createRadialGradient(
                movement.centerX, movement.centerY, 0,
                movement.centerX, movement.centerY, movement.radius + 28
            );
            bgGradL.addColorStop(0,   'rgba(4, 6, 18, 0.42)');
            bgGradL.addColorStop(0.7, 'rgba(4, 6, 18, 0.25)');
            bgGradL.addColorStop(1,   'rgba(4, 6, 18, 0)');
            ctx.fillStyle = bgGradL;
            ctx.beginPath();
            ctx.arc(movement.centerX, movement.centerY, movement.radius + 28, 0, Math.PI * 2);
            ctx.fill();
        }

        // RIGHT SIDE: Combat control cluster background
        if (this.touchJoysticks && this.touchJoysticks.basicAttack) {
            const basicAttack = this.touchJoysticks.basicAttack;
            const centerX = basicAttack.centerX;
            const centerY = basicAttack.centerY;

            // Measure actual reach of the cluster (buttons + joystick)
            let maxDistance = basicAttack.radius + 24;
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

            // Soft vignette behind the whole cluster (no hard edge)
            const bgGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxDistance + 12);
            bgGrad.addColorStop(0,   'rgba(4, 6, 18, 0.42)');
            bgGrad.addColorStop(0.7, 'rgba(4, 6, 18, 0.25)');
            bgGrad.addColorStop(1,   'rgba(4, 6, 18, 0)');
            ctx.fillStyle = bgGrad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, maxDistance + 12, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- JOYSTICKS ---
        const tutorialHighlight = (typeof Room0Tutorial !== 'undefined'
            && Room0Tutorial.getHighlightControl)
            ? Room0Tutorial.getHighlightControl()
            : null;
        const drawTutorialGlow = (cx, cy, radius) => {
            if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
            const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.01);
            ctx.save();
            ctx.strokeStyle = `rgba(255, 220, 80, ${0.55 + pulse * 0.4})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        };

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

            if (tutorialHighlight === key) {
                drawTutorialGlow(joystick.centerX, joystick.centerY, joystick.radius || 40);
            }

            const renderOptions = { playerClass };
            if (key === 'basicAttack') {
                renderOptions.activationRadius = joystick.radius * 1.2;
                renderOptions.label = 'ATK';
                renderOptions.cooldown = cooldowns.attack.cooldown;
                renderOptions.maxCooldown = cooldowns.attack.maxCooldown;
                renderOptions.primary = true;
            } else if (key === 'movement') {
                renderOptions.fadeWhenIdle = true;
            } else if (key === 'heavyAttack') {
                renderOptions.label = '';
                if (playerClass === 'hexagon') {
                    renderOptions.directional = true;
                    renderOptions.hideText = true;
                }
            } else if (key === 'specialAbility') {
                renderOptions.label = '';
                if (playerClass === 'pentagon' || playerClass === 'hexagon') {
                    renderOptions.directional = true;
                    renderOptions.hideText = true;
                }
            } else if (key === 'dodge') {
                renderOptions.label = '';
                renderOptions.directional = true;
                renderOptions.hideText = true;
                renderOptions.cooldown = cooldowns.dodge.cooldown;
                renderOptions.maxCooldown = cooldowns.dodge.maxCooldown;
                renderOptions.charges = cooldowns.dodge.charges;
            }

            joystick.render(ctx, renderOptions);
        }

        // --- BUTTONS ---
        for (const key in this.touchButtons) {
            const button = this.touchButtons[key];
            if (!button) continue;

            // Skip character sheet button - now handled by DOM UI
            if (key === 'characterSheet') continue;

            // Class-specific visibility
            if (key === 'dodge' && playerClass === 'triangle') continue; // Rogue uses joystick

            if (tutorialHighlight === key) {
                drawTutorialGlow(
                    button.x + button.width / 2,
                    button.y + button.height / 2,
                    Math.max(button.width, button.height) / 2
                );
            }

            let snapshot = { cooldown: 0, maxCooldown: 0, charges: null };
            if (key === 'heavyAttack') snapshot = cooldowns.heavy;
            if (key === 'specialAbility') snapshot = cooldowns.special;
            if (key === 'dodge') snapshot = cooldowns.dodge;

            const isDirectionalButton =
                (key === 'specialAbility' && (playerClass === 'pentagon' || playerClass === 'hexagon')) ||
                (key === 'heavyAttack' && (playerClass === 'square' || playerClass === 'hexagon'));

            button.render(ctx, snapshot.cooldown, snapshot.maxCooldown, snapshot.charges, {
                playerClass,
                armed: button.pressed,
                directional: isDirectionalButton
            });
        }
    }
};

if (typeof window !== 'undefined') {
    window.Input = Input;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Input };
}



// Engine.Input — raw hardware sampling layer.
// BOUNDARY CONTRACT: This file MUST NOT reference any game-specific content.
// It polls keyboard, mouse, pointer, gamepad, and touch hardware and exposes
// a clean generic query API. All game-action vocabulary lives in game/input-map.js.

const inputRoot = typeof window !== 'undefined' ? window : globalThis;
inputRoot.Engine = inputRoot.Engine || {};
const Engine = inputRoot.Engine;

Engine.Input = {
    _hooks: {},

    configure(hooks = {}) {
        this._hooks = Object.assign({}, this._hooks, hooks);
        return this;
    },

    _getLogicalSize(canvas = this._gamepadCanvas) {
        if (typeof this._hooks.getLogicalSize === 'function') {
            const size = this._hooks.getLogicalSize(canvas);
            if (size && Number.isFinite(size.width) && Number.isFinite(size.height)) {
                return size;
            }
        }
        return {
            width: canvas && Number.isFinite(canvas.width) ? canvas.width : 0,
            height: canvas && Number.isFinite(canvas.height) ? canvas.height : 0
        };
    },

    _mapPointer(clientX, clientY, canvas) {
        if (typeof this._hooks.mapPointer === 'function') {
            return this._hooks.mapPointer(clientX, clientY, canvas);
        }
        const rect = canvas.getBoundingClientRect();
        const size = this._getLogicalSize(canvas);
        return {
            x: (clientX - rect.left) * (size.width / rect.width),
            y: (clientY - rect.top) * (size.height / rect.height)
        };
    },

    // Key states
    keys: {},

    // Mouse state (screen coordinates)
    mouse: { x: 0, y: 0 },
    mouseLeft: false,
    mouseRight: false,

    // Touch state
    touchActive: false,
    activeTouches: {},   // Map of touchId -> { x, y }
    touchJoysticks: {},  // Map of joystick name -> VirtualJoystick
    touchButtons: {},    // Map of button name -> TouchButton

    // Control mode
    controlMode: 'auto', // 'auto', 'mobile', 'desktop', 'gamepad'

    // Gamepad state
    _gamepadIndex: null,
    _gamepadActive: false,
    _gamepadDeadzone: 0.12,
    _gamepadStartPrev: false,
    _gamepadSelectPrev: false,
    _gamepadCanvas: null,
    _gamepadFamily: 'generic',
    _activeInputSource: 'default',  // 'default', 'keyboardMouse', 'touch', 'gamepad'
    _lastGamepadInputAt: 0,
    _lastNonGamepadInputAt: 0,
    _inputSourceSwitchDelayMs: 250,
    _hadOnScreenTouchControls: false,
    _touchControlsHiddenForGamepad: false,
    _lifecycleHandlersInstalled: false,
    _gamepadActivationFrames: 0,
    _gamepadActivationFramesRequired: 4,

    // Last aim angle (for maintaining direction when joystick released on mobile)
    lastAimAngle: 0,

    // ------------------------------------------------------------------ helpers

    _now() {
        return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    },

    _hasWindowFocus() {
        return typeof document === 'undefined' || document.hasFocus();
    },

    // ------------------------------------------------------------------ device

    getDeviceProfile() {
        if (typeof DeviceDetection !== 'undefined' && DeviceDetection.getProfile) {
            return DeviceDetection.getProfile();
        }
        return {
            formFactor: 'unknown', os: 'unknown',
            isMobile: false, isPhone: false, isTablet: false, isDesktop: true,
            confidence: 'low', reason: 'device-detection-unavailable', capabilities: {}
        };
    },

    isMobileDevice() {
        if (typeof DeviceDetection !== 'undefined' && DeviceDetection.isMobileDevice) {
            return DeviceDetection.isMobileDevice();
        }
        return false;
    },

    isGamepadMode() { return this._gamepadActive; },

    isMobileUiMode() {
        if (this.controlMode === 'mobile' || this.controlMode === 'touch') return true;
        if (this.controlMode === 'desktop') return false;
        return this.isMobileDevice();
    },

    isTouchMode() {
        if (this.isGamepadMode()) return true;
        if (this.controlMode === 'mobile' || this.controlMode === 'touch') return true;
        if (this.controlMode === 'desktop') return false;
        return this.isMobileDevice();
    },

    getActiveInputSource() { return this._activeInputSource; },

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
            fullscreen: !!(typeof document !== 'undefined' && (document.fullscreenElement ||
                document.webkitFullscreenElement || document.mozFullScreenElement)),
            viewport
        };
    },

    shouldShowWorldInteractionHints() {
        return this.isGamepadMode() || !this.isMobileUiMode();
    },

    shouldShowMobileControllerCooldowns() {
        return this.isGamepadMode() && this._touchControlsHiddenForGamepad;
    },

    usesDomTouchControls() {
        return typeof MobileControlsDOM !== 'undefined' &&
            MobileControlsDOM.layer &&
            !MobileControlsDOM.layer.hidden &&
            !this.isGamepadMode();
    },

    // ------------------------------------------------------------------ telemetry (game-neutral)

    _recordInputEvent(type, metadata = {}) {
        if (typeof Telemetry === 'undefined' || !Telemetry || !Telemetry.recordEvent) return;
        Telemetry.recordEvent(type, { metadata: { ...this.getInputContext(), ...metadata } });
    },

    // ------------------------------------------------------------------ keyboard

    /** Map KeyboardEvent.code/key pairs to canonical key names used by gameplay. */
    _keysFromEvent(e) {
        const keys = [];
        const code = e.code || '';
        const key = (e.key || '').toLowerCase();

        const add = (name) => { if (name && !keys.includes(name)) keys.push(name); };

        if (code === 'KeyW' || key === 'w') add('w');
        if (code === 'KeyS' || key === 's') add('s');
        if (code === 'KeyA' || key === 'a') add('a');
        if (code === 'KeyD' || key === 'd') add('d');
        if (code === 'ArrowUp'    || key === 'arrowup')    add('arrowup');
        if (code === 'ArrowDown'  || key === 'arrowdown')  add('arrowdown');
        if (code === 'ArrowLeft'  || key === 'arrowleft')  add('arrowleft');
        if (code === 'ArrowRight' || key === 'arrowright') add('arrowright');
        if (code === 'Space'      || key === ' ')          add(' ');
        if (code === 'ShiftLeft'  || code === 'ShiftRight' || key === 'shift') add('shift');
        if (code === 'KeyG'       || key === 'g') add('g');
        if (code === 'KeyM'       || key === 'm') add('m');
        if (code === 'Tab'        || key === 'tab') add('tab');
        if (code === 'BracketLeft'  || key === '[') add('[');
        if (code === 'BracketRight' || key === ']') add(']');
        if (code === 'KeyI'       || key === 'i') add('i');
        if (code === 'Escape'     || key === 'escape') add('escape');

        if (keys.length === 0 && key && key.length === 1) add(key);
        return keys;
    },

    _applyKeyEvent(e, pressed) {
        const names = this._keysFromEvent(e);
        for (const name of names) { this.keys[name] = pressed; }
    },

    _resetKeyboardState(reason = 'manual') {
        this.keys = {};
        this._gamepadStartPrev = false;
        this._gamepadSelectPrev = false;
        this._recordInputEvent('inputReset', { reason, target: 'keyboard' });
    },

    /** Returns true if the named key is currently held down. */
    isKeyDown(key) {
        if (!this._hasWindowFocus()) return false;
        return this.keys[key.toLowerCase()] === true;
    },

    /** Alias for isKeyDown — kept for back-compat with call-sites using getKeyState. */
    getKeyState(key) { return this.isKeyDown(key); },

    /** @deprecated Use isKeyDown. Kept for compatibility. */
    isKeyPressed(key) { return this.isKeyDown(key); },

    // ------------------------------------------------------------------ mouse / pointer

    /** Get pointer position in world coordinates through an injected camera hook. */
    getWorldMousePos() {
        if (typeof this._hooks.screenToWorld === 'function') {
            return this._hooks.screenToWorld(this.mouse.x, this.mouse.y);
        }
        return { x: this.mouse.x, y: this.mouse.y };
    },

    _resetPointerState(reason = 'manual') {
        this.mouseLeft = false;
        this.mouseRight = false;
        this._recordInputEvent('inputReset', { reason, target: 'pointer' });
    },

    // ------------------------------------------------------------------ touch

    _resetTouchState(reason = 'manual') {
        for (const joystick of Object.values(this.touchJoysticks)) {
            if (joystick && joystick.touchId !== null) joystick.endTouch(joystick.touchId);
        }
        for (const button of Object.values(this.touchButtons)) {
            if (button && button.touchId !== null) button.endTouch(button.touchId);
        }
        this.activeTouches = {};
        this.touchActive = false;
        this._recordInputEvent('inputReset', { reason, target: 'touch' });
    },

    _resetInputOnContextLoss(reason) {
        this._resetKeyboardState(reason);
        this._resetPointerState(reason);
        if (this.isTouchMode()) this._resetTouchState(reason);
    },

    getSafeAreaInsets() {
        if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
        if (!this._safeAreaProbe) {
            const probe = document.createElement('div');
            probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
                'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) ' +
                'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
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

    _clearTouchControls() {
        this.touchActive = false;
        this.activeTouches = {};
        this.touchJoysticks = {};
        this.touchButtons = {};
    },

    initTouchControls(canvas) {
        this._hadOnScreenTouchControls = true;
        this._touchControlsHiddenForGamepad = false;

        const logicalSize = this._getLogicalSize(canvas);
        const width = logicalSize.width;
        const height = logicalSize.height;
        const isMobile = this.isMobileUiMode();

        let displayScaleX = 1, displayScaleY = 1;
        if (isMobile && canvas && typeof canvas.getBoundingClientRect === 'function') {
            const rect = canvas.getBoundingClientRect();
            displayScaleX = rect.width  > 0 ? width  / rect.width  : 1;
            displayScaleY = rect.height > 0 ? height / rect.height : 1;
        }

        const layoutOptions = { isMobile, safeInsets: this.getSafeAreaInsets(), displayScaleX, displayScaleY };
        const layout = (typeof MobileControlLayout !== 'undefined')
            ? MobileControlLayout.getEffectiveLayout(width, height, layoutOptions)
            : null;

        if (layout && layout.controls) {
            const m = layout.controls.movement;
            const a = layout.controls.basicAttack;
            const h = layout.controls.heavyAttack;
            const s = layout.controls.specialAbility;
            const d = layout.controls.dodge;

            this.touchJoysticks.movement    = new VirtualJoystick(m.x, m.y, m.radius, m.deadZone);
            this.touchJoysticks.basicAttack = new VirtualJoystick(a.x, a.y, a.radius, a.deadZone);

            this.touchButtons.heavyAttack    = new TouchButton(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h, h.label || 'Heavy');
            this.touchJoysticks.heavyAttack  = new VirtualJoystick(h.x, h.y, h.radius, h.deadZone);

            this.touchButtons.specialAbility    = new TouchButton(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, s.label || 'Spcl');
            this.touchJoysticks.specialAbility  = new VirtualJoystick(s.x, s.y, s.radius, s.deadZone);

            this.touchButtons.dodge    = new TouchButton(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, d.label || 'Dodge');
            this.touchJoysticks.dodge  = new VirtualJoystick(d.x, d.y, d.radius, d.deadZone);

            this._activeControlLayout = layout;
        } else {
            // Fallback if layout module missing
            this.touchJoysticks.basicAttack   = new VirtualJoystick(width - 130, height - 140, 55, 20);
            this.touchJoysticks.movement      = new VirtualJoystick(100, height - 140, 60, 20);
            this.touchButtons.heavyAttack     = new TouchButton(width - 220, height - 220, 54, 54, 'Heavy');
            this.touchJoysticks.heavyAttack   = new VirtualJoystick(width - 193, height - 193, 28, 14);
            this.touchButtons.specialAbility  = new TouchButton(width - 100, height - 220, 54, 54, 'Spcl');
            this.touchJoysticks.specialAbility = new VirtualJoystick(width - 73, height - 193, 28, 14);
            this.touchButtons.dodge           = new TouchButton(width - 157, height - 80, 54, 54, 'Dodge');
            this.touchJoysticks.dodge         = new VirtualJoystick(width - 130, height - 53, 28, 14);
        }

        if (typeof MobileControlsDOM !== 'undefined' && MobileControlsDOM.onInputSurfaceReady) {
            MobileControlsDOM.onInputSurfaceReady();
        }
    },

    // ------------------------------------------------------------------ control surface

    _applyControlSurface(canvas = this._gamepadCanvas) {
        const hadOnScreenTouchControls = this._hadOnScreenTouchControls;
        const wantsMobileSurface = this.isMobileUiMode() || this.controlMode === 'mobile' || this.controlMode === 'touch';
        this._clearTouchControls();
        this._hadOnScreenTouchControls = false;

        if (this.isGamepadMode()) {
            this._touchControlsHiddenForGamepad = hadOnScreenTouchControls || wantsMobileSurface;
            if (canvas) this._initGamepadControls(canvas);
            if (typeof MobileControlsDOM !== 'undefined' && MobileControlsDOM.refresh) MobileControlsDOM.refresh();
            return;
        }

        this._touchControlsHiddenForGamepad = false;
        if (this.isMobileUiMode()) {
            if (canvas) this.initTouchControls(canvas);
        } else if (typeof MobileControlsDOM !== 'undefined' && MobileControlsDOM.refresh) {
            MobileControlsDOM.refresh();
        }
    },

    _syncUiModeClass() {
        if (typeof document !== 'undefined' && document.body) {
            document.body.classList.toggle('touch-mode', this.isMobileUiMode());
        }
    },

    applyControlMode(mode = this.controlMode, canvas = this._gamepadCanvas) {
        this.controlMode = mode;
        this._gamepadActive = mode === 'gamepad';
        this._activeInputSource = this._gamepadActive ? 'gamepad' : 'default';
        this._syncUiModeClass();

        if (typeof this._hooks.onControlModeChanged === 'function') {
            this._hooks.onControlModeChanged(this.controlMode, canvas);
        }
        this._applyControlSurface(canvas);

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

    // ------------------------------------------------------------------ gamepad

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

        const buttons = [];
        const axes = [];
        for (let i = 0; i < (gp.axes || []).length; i++) axes.push(gp.axes[i] || 0);
        for (let i = 0; i < (gp.buttons || []).length; i++) {
            const b = gp.buttons[i];
            buttons.push({ pressed: b ? b.pressed : false, value: b ? b.value : 0 });
        }
        while (axes.length    < 4)  axes.push(0);
        while (buttons.length < 16) buttons.push({ pressed: false, value: 0 });

        return { id: gp.id, index: gp.index, connected: gp.connected, mapping: 'standard', buttons, axes };
    },

    /**
     * Returns hardware button-style metadata for the given abstract button name.
     * @param {'interact'|'modifier'} button
     */
    _getGamepadButtonStyle(button) {
        const styles = {
            playstation: {
                interact:  { mark: 'cross',    color: '#6d96d8', text: 'Cross' },
                modifier:  { mark: 'psTri', color: '#7ee083', text: 'Triangle' }
            },
            xbox: {
                interact:  { mark: 'text', label: 'A', color: '#6fcf5f', text: 'A' },
                modifier:  { mark: 'text', label: 'Y', color: '#f2d35b', text: 'Y' }
            },
            steam: {
                interact:  { mark: 'text', label: 'A', color: '#6fcf5f', text: 'A' },
                modifier:  { mark: 'text', label: 'Y', color: '#f2d35b', text: 'Y' }
            },
            nintendo: {
                interact:  { mark: 'text', label: 'B', color: '#f06b6b', text: 'B' },
                modifier:  { mark: 'text', label: 'X', color: '#6d96d8', text: 'X' }
            },
            generic: {
                interact:  { mark: 'text', label: 'A', color: '#ffffff', text: 'A' },
                modifier:  { mark: 'text', label: 'Y', color: '#ffffff', text: 'Y' }
            }
        };
        const familyStyles = styles[this._gamepadFamily] || styles.generic;
        return familyStyles[button] || styles.generic[button] || { mark: 'text', label: '?', color: '#ffffff', text: '?' };
    },

    /**
     * Returns the display hint string for an abstract action ('interact' | 'modifier').
     */
    getInputHint(action) {
        const desktopHints = { interact: 'G', modifier: 'M' };
        if (this.isGamepadMode()) return this._getGamepadButtonStyle(action).text;
        return desktopHints[action] || '';
    },

    getInteractionPrompt(actionText = 'interact') {
        if (this.isGamepadMode()) return `Press ${this.getInputHint('interact')} to ${actionText}`;
        if (this.isMobileUiMode()) return `Tap Interact to ${actionText}`;
        return `Press ${this.getInputHint('interact')} to ${actionText}`;
    },

    getDoorPrompt(hasModifiers = false) {
        const selectHint   = this.getInputHint('interact');
        const modifierHint = this.getInputHint('modifier');
        if (this.isGamepadMode()) {
            return hasModifiers
                ? `Press ${selectHint} to Select or ${modifierHint} for Modifier`
                : `Press ${selectHint} to Select`;
        }
        if (this.isMobileUiMode()) return 'Tap Interact to Select';
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
        gradient.addColorStop(0,    '#050505');
        gradient.addColorStop(0.58, '#050505');
        gradient.addColorStop(1,    '#2c2c2c');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.strokeStyle = markColor;
        ctx.fillStyle   = markColor;
        ctx.lineCap     = 'square';
        ctx.lineJoin    = 'miter';

        if (buttonStyle.mark === 'psTri') {
            const top = -radius * 0.42, bottom = radius * 0.38, half = radius * 0.46;
            ctx.lineWidth = Math.max(2, size * 0.13);
            ctx.beginPath();
            ctx.moveTo(0, top); ctx.lineTo(half, bottom); ctx.lineTo(-half, bottom);
            ctx.closePath(); ctx.stroke();
        } else if (buttonStyle.mark === 'cross') {
            const arm = radius * 0.48;
            ctx.lineWidth = Math.max(3, size * 0.16);
            ctx.beginPath();
            ctx.moveTo(-arm, -arm); ctx.lineTo(arm, arm);
            ctx.moveTo(arm, -arm);  ctx.lineTo(-arm, arm);
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
            { type: 'text',   text: 'Press ' },
            { type: 'button', button: 'interact' },
            { type: 'text',   text: ` to ${actionText}` }
        ], x, y);
    },

    drawDoorPrompt(ctx, hasModifiers, x, y) {
        if (!this.isGamepadMode()) {
            ctx.fillText(this.getDoorPrompt(hasModifiers), x, y);
            return;
        }
        const parts = [
            { type: 'text',   text: 'Press ' },
            { type: 'button', button: 'interact' },
            { type: 'text',   text: ' to Select' }
        ];
        if (hasModifiers) {
            parts.push(
                { type: 'text',   text: ' or ' },
                { type: 'button', button: 'modifier' },
                { type: 'text',   text: ' for Modifier' }
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
            totalWidth += part.type === 'button' ? buttonSize + gap * 2 : ctx.measureText(part.text).width;
        }
        let cursorX = x;
        if (originalAlign === 'center') cursorX -= totalWidth / 2;
        else if (originalAlign === 'right' || originalAlign === 'end') cursorX -= totalWidth;

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

    /** Returns normalized gamepad axis value for the given slot index and axis index. */
    getGamepadAxis(gamepadIndex, axisIndex) {
        if (!navigator.getGamepads) return 0;
        const gamepads = navigator.getGamepads();
        const gp = gamepads[gamepadIndex];
        if (!gp || !gp.connected || !gp.axes) return 0;
        const raw = gp.axes[axisIndex] || 0;
        const dz  = this._gamepadDeadzone;
        const mag  = Math.abs(raw);
        if (mag < dz) return 0;
        return (raw / mag) * ((mag - dz) / (1 - dz));
    },

    _hasGamepadInput(gamepad) {
        if (!gamepad || !gamepad.connected) return false;
        const axisMoved    = Array.from(gamepad.axes || []).some(a => Math.abs(a) > this._gamepadDeadzone);
        const buttonPressed = Array.from(gamepad.buttons || []).some(b => b && (b.pressed || b.value > 0.15));
        return axisMoved || buttonPressed;
    },

    _findGamepadWithInput() {
        if (!navigator.getGamepads) return null;
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad && gamepad.connected && this._hasGamepadInput(gamepad)) return gamepad;
        }
        return null;
    },

    _activateGamepad(gamepad, canvas = this._gamepadCanvas, activateInput = false) {
        if (!gamepad || !gamepad.connected) return false;
        if (this._gamepadIndex !== null && this._gamepadIndex !== gamepad.index) return false;
        this._gamepadIndex  = gamepad.index;
        this._gamepadFamily = this._detectGamepadFamily(gamepad);
        if (activateInput || this.controlMode === 'gamepad') {
            return this._activateGamepadInput(canvas);
        }
        return true;
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
        this._gamepadActive    = true;
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
        this._gamepadActive    = false;
        this._gamepadStartPrev = false;
        this._gamepadSelectPrev = false;
        this._activeInputSource = source;
        this._applyControlSurface(canvas);
        this._emitInputSourceChange();
        return true;
    },

    _emitInputSourceChange() {
        if (typeof window === 'undefined') return;
        const detail = { source: this._activeInputSource, gamepad: this.isGamepadMode(), family: this._gamepadFamily };
        window.dispatchEvent(new CustomEvent('inputsourcechange', { detail }));
        this._recordInputEvent('inputSourceChange', detail);
    },

    _scanConnectedGamepads(canvas = this._gamepadCanvas, options = {}) {
        if (!navigator.getGamepads) return false;
        const requireInput  = options.requireInput  === true;
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

    // Create minimal stub joystick/button objects for gamepad use
    _initGamepadControls(canvas) {
        if (this.touchJoysticks.movement && this.touchJoysticks.basicAttack) return;
        const cx = -9999, cy = -9999;
        this.touchJoysticks.movement       = new VirtualJoystick(cx, cy, 60, 14);
        this.touchJoysticks.basicAttack    = new VirtualJoystick(cx, cy, 55, 14);
        this.touchJoysticks.heavyAttack    = new VirtualJoystick(cx, cy, 38, 14);
        this.touchJoysticks.specialAbility = new VirtualJoystick(cx, cy, 38, 14);
        this.touchJoysticks.dodge          = new VirtualJoystick(cx, cy, 38, 14);
        this.touchButtons.heavyAttack      = new TouchButton(-9999, -9999, 48, 44, 'Heavy');
        this.touchButtons.specialAbility   = new TouchButton(-9999, -9999, 48, 44, 'Spcl');
        this.touchButtons.dodge            = new TouchButton(-9999, -9999, 48, 44, 'Dodge');
    },

    // Poll the Gamepad API and write its state into the existing touch joystick/button objects.
    _updateGamepad() {
        const activeGamepad = this._findGamepadWithInput();
        if (activeGamepad && activeGamepad.index !== this._gamepadIndex) {
            console.log(`[INPUT] Dynamic hot-swap gamepad to: "${activeGamepad.id}" (index ${activeGamepad.index})`);
            this._gamepadIndex  = activeGamepad.index;
            this._gamepadFamily = this._detectGamepadFamily(activeGamepad);
            this._activateGamepadInput();
        }

        if (this._gamepadIndex === null && !this._scanConnectedGamepads()) return;

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        let gp = gamepads[this._gamepadIndex];
        if (!gp || !gp.connected) {
            this._gamepadIndex   = null;
            this._gamepadActive  = false;
            this._gamepadFamily  = 'generic';
            this._activeInputSource = 'default';
            this._applyControlSurface();
            this._scanConnectedGamepads();
            return;
        }

        gp = this._getMappedGamepad(gp);
        if (this._hasGamepadInput(gp) && !this._activateGamepadInput()) return;

        const dz = this._gamepadDeadzone;
        const applyDeadzone = (rawX, rawY) => {
            const mag = Math.sqrt(rawX * rawX + rawY * rawY);
            if (mag < dz) return { x: 0, y: 0, mag: 0 };
            const scaled = (mag - dz) / (1 - dz);
            return { x: (rawX / mag) * scaled, y: (rawY / mag) * scaled, mag: scaled };
        };

        const syncJoystick = (joystick, stick, threshold = 0.05) => {
            if (!joystick) return;
            joystick.active    = stick.mag > threshold;
            joystick.magnitude = stick.mag;
            if (stick.mag > threshold) joystick.angle = Math.atan2(stick.y, stick.x);
            joystick.currentX = joystick.centerX + Math.cos(joystick.angle) * joystick.magnitude * joystick.radius;
            joystick.currentY = joystick.centerY + Math.sin(joystick.angle) * joystick.magnitude * joystick.radius;
        };

        const syncAbilityJoystick = (joystick, stick, isDown, threshold = 0.05) => {
            if (!joystick) return;
            joystick.active    = isDown && stick.mag > threshold;
            joystick.magnitude = isDown ? stick.mag : 0;
            if (stick.mag > threshold) joystick.angle = Math.atan2(stick.y, stick.x);
            joystick.currentX = joystick.centerX + Math.cos(joystick.angle) * joystick.magnitude * joystick.radius;
            joystick.currentY = joystick.centerY + Math.sin(joystick.angle) * joystick.magnitude * joystick.radius;
        };

        const syncButton = (button, isDown) => {
            if (!button) return;
            const was          = button.pressed;
            button.pressed     = isDown;
            button.justPressed  = isDown && !was;
            button.justReleased = !isDown && was;
            button.active       = isDown;
        };

        // DOM menus own the pad while open
        const uiBlocking = window.ControllerNav
            && typeof window.ControllerNav.isBlockingGameplay === 'function'
            && window.ControllerNav.isBlockingGameplay();

        const clearGameplayPad = () => {
            syncJoystick(this.touchJoysticks.movement, { x: 0, y: 0, mag: 0 });
            if (this.touchJoysticks.basicAttack) {
                this.touchJoysticks.basicAttack.active    = false;
                this.touchJoysticks.basicAttack.magnitude = 0;
            }
            syncButton(this.touchButtons.heavyAttack,   false);
            syncAbilityJoystick(this.touchJoysticks.heavyAttack,    { x: 0, y: 0, mag: 0 }, false);
            syncButton(this.touchButtons.specialAbility, false);
            syncAbilityJoystick(this.touchJoysticks.specialAbility, { x: 0, y: 0, mag: 0 }, false);
            syncButton(this.touchButtons.dodge, false);
            syncAbilityJoystick(this.touchJoysticks.dodge,          { x: 0, y: 0, mag: 0 }, false);
            this.keys['g'] = false;
            this.keys['m'] = false;
            this.keys['arrowleft']  = false;
            this.keys['arrowright'] = false;
        };

        if (uiBlocking) {
            clearGameplayPad();
            if (!(window.ControllerNav && window.ControllerNav.handlesSystemButtons)) {
                const startNow = gp.buttons[9]?.pressed || false;
                if (startNow && !this._gamepadStartPrev) {
                    if (typeof this._hooks.onSystemStart === 'function') this._hooks.onSystemStart();
                }
                this._gamepadStartPrev = startNow;
                const selectNow = gp.buttons[8]?.pressed || false;
                if (selectNow && !this._gamepadSelectPrev)       this.keys['tab'] = true;
                else if (!selectNow && this._gamepadSelectPrev)  this.keys['tab'] = false;
                this._gamepadSelectPrev = selectNow;
            }
            return;
        }

        // ---- Left stick → movement ----
        const leftStick = applyDeadzone(gp.axes[0] || 0, gp.axes[1] || 0);
        const dpadUp    = gp.buttons[12]?.pressed || false;
        const dpadDown  = gp.buttons[13]?.pressed || false;
        const dpadLeft  = gp.buttons[14]?.pressed || false;
        const dpadRight = gp.buttons[15]?.pressed || false;

        const lootCycleActive = typeof LootSelection !== 'undefined'
            && LootSelection.nearbyItems && LootSelection.nearbyItems.length > 1
            && (dpadLeft || dpadRight) && !dpadUp && !dpadDown;

        if (lootCycleActive) {
            syncJoystick(this.touchJoysticks.movement, leftStick);
            this.keys['arrowleft']  = dpadLeft;
            this.keys['arrowright'] = dpadRight;
        } else {
            this.keys['arrowleft']  = false;
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

        // ---- Right stick → aim, RT/R2 → primary ----
        const rightStick   = applyDeadzone(gp.axes[2] || 0, gp.axes[3] || 0);
        const primaryDown  = (gp.buttons[7]?.value ?? 0) > 0.15;
        if (this.touchJoysticks.basicAttack) {
            const j  = this.touchJoysticks.basicAttack;
            j.active = primaryDown;
            if (rightStick.mag > 0.05) {
                j.magnitude = rightStick.mag;
                j.angle     = Math.atan2(rightStick.y, rightStick.x);
            } else if (primaryDown) {
                j.magnitude = 1;
            } else {
                j.magnitude = rightStick.mag;
            }
            j.currentX = j.centerX + Math.cos(j.angle) * j.magnitude * j.radius;
            j.currentY = j.centerY + Math.sin(j.angle) * j.magnitude * j.radius;
        }

        // ---- LT/L2 → heavy ----
        const heavyDown = (gp.buttons[6]?.value ?? 0) > 0.15;
        syncButton(this.touchButtons.heavyAttack, heavyDown);
        syncAbilityJoystick(this.touchJoysticks.heavyAttack, rightStick.mag > 0.05 ? rightStick : leftStick, heavyDown);

        // ---- LB/L1 → special ----
        const specialDown = gp.buttons[4]?.pressed || false;
        syncButton(this.touchButtons.specialAbility, specialDown);
        syncAbilityJoystick(this.touchJoysticks.specialAbility, rightStick.mag > 0.05 ? rightStick : leftStick, specialDown);

        // ---- RB/R1 → dodge ----
        const dodgeDown = gp.buttons[5]?.pressed || false;
        syncButton(this.touchButtons.dodge, dodgeDown);
        syncAbilityJoystick(this.touchJoysticks.dodge, leftStick, dodgeDown);

        if (!(window.ControllerNav && window.ControllerNav.handlesSystemButtons)) {
            // Start → title dismiss or toggle pause
            const startNow = gp.buttons[9]?.pressed || false;
            if (startNow && !this._gamepadStartPrev) {
                if (typeof this._hooks.onSystemStart === 'function') this._hooks.onSystemStart();
            }
            this._gamepadStartPrev = startNow;

            // Select → character sheet
            const selectNow = gp.buttons[8]?.pressed || false;
            if (selectNow && !this._gamepadSelectPrev)       this.keys['tab'] = true;
            else if (!selectNow && this._gamepadSelectPrev)  this.keys['tab'] = false;
            this._gamepadSelectPrev = selectNow;
        }

        // Cross/X → interact (G)
        this.keys['g'] = gp.buttons[0]?.pressed || false;
        // Triangle/Y → room modifier (M)
        this.keys['m'] = gp.buttons[3]?.pressed || false;
    },

    // ------------------------------------------------------------------ touch handlers

    handleTouchStart(e, canvas) {
        if (!this.isTouchMode()) return;
        if (!this.isGamepadMode()) {
            this._activateNonGamepadInput('touch', canvas);
        } else if (!this._activateNonGamepadInput('touch', canvas)) {
            return;
        }

        if (e.defaultPrevented) return;

        if (typeof CharacterSheet !== 'undefined' && CharacterSheet.isOpen && e.touches.length > 0) {
            CharacterSheet.lastTouchY = e.touches[0].clientY;
        }

        void canvas.offsetWidth;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            console.warn('[TOUCH] Canvas rect is zero, skipping touch');
            return;
        }

        const touches = Array.from(e.touches);
        const convertCoords = (cx, cy) => this._mapPointer(cx, cy, canvas);

        touches.forEach(touch => {
            const { x, y } = convertCoords(touch.clientX, touch.clientY);
            const touchId = touch.identifier;

            this.activeTouches[touchId] = { x, y };
            this.touchActive = true;

            if (typeof CharacterSheet !== 'undefined' && CharacterSheet.isOpen && CharacterSheet.closeButtonBounds) {
                const b = CharacterSheet.closeButtonBounds;
                if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
                    CharacterSheet.isOpen = false;
                    return;
                }
            }

            if (typeof handleInteractionButtonClick === 'function' && handleInteractionButtonClick(x, y)) return;

            if (this.usesDomTouchControls()) return;

            const logicalWidth = this._getLogicalSize(canvas).width;
            const screenMiddle = logicalWidth / 2;
            const isLeftSide   = x < screenMiddle;

            if (isLeftSide) {
                if (this.touchJoysticks.movement && !this.touchJoysticks.movement.active) {
                    if (this.touchJoysticks.movement.startTouch(touchId, x, y)) return;
                }
            } else {
                const buttonOrder = ['heavyAttack', 'dodge', 'specialAbility'];
                let buttonMatched = false;
                for (const buttonName of buttonOrder) {
                    const button = this.touchButtons[buttonName];
                    if (button && !button.active && button.contains(x, y)) {
                        buttonMatched = true;
                        if (button.startTouch(touchId, x, y)) return;
                    }
                }

                if (!buttonMatched && this.touchJoysticks.basicAttack && !this.touchJoysticks.basicAttack.active) {
                    const joystick = this.touchJoysticks.basicAttack;
                    const dx = x - joystick.centerX, dy = y - joystick.centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const restrictedHitRadius = joystick.radius * 1.2;
                    if (distance <= restrictedHitRadius) {
                        let tooCloseToButton = false;
                        for (const button of Object.values(this.touchButtons)) {
                            if (button && button.contains(x, y)) { tooCloseToButton = true; break; }
                            if (button) {
                                const bcx = button.x + button.width / 2, bcy = button.y + button.height / 2;
                                if (Math.sqrt((x - bcx) ** 2 + (y - bcy) ** 2) < Math.max(button.width, button.height) / 2 + 10) {
                                    tooCloseToButton = true; break;
                                }
                            }
                        }
                        if (!tooCloseToButton && joystick.startTouch(touchId, x, y, restrictedHitRadius)) return;
                    }
                }
            }

            // Fallback
            if (isLeftSide) {
                if (this.touchJoysticks.movement && !this.touchJoysticks.movement.active) {
                    if (this.touchJoysticks.movement.startTouch(touchId, x, y)) return;
                }
            } else {
                if (this.touchJoysticks.basicAttack && !this.touchJoysticks.basicAttack.active) {
                    const joystick = this.touchJoysticks.basicAttack;
                    const dx = x - joystick.centerX, dy = y - joystick.centerY;
                    const fallbackHitRadius = joystick.radius * 1.15;
                    if (Math.sqrt(dx * dx + dy * dy) <= fallbackHitRadius && joystick.startTouch(touchId, x, y, fallbackHitRadius)) return;
                }
            }

            if (!isLeftSide) {
                this._recordInputEvent('mobileTouchMiss', { side: 'right', x: Math.round(x), y: Math.round(y) });
            }
        });
    },

    handleTouchMove(e, canvas) {
        if (!this.isTouchMode()) return;

        if (typeof CharacterSheet !== 'undefined' && CharacterSheet.isOpen && e.touches.length > 0) {
            const touch = e.touches[0];
            if (CharacterSheet.lastTouchY !== null) {
                const deltaY    = CharacterSheet.lastTouchY - touch.clientY;
                const gameCoords = this._mapPointer(touch.clientX, touch.clientY, canvas);
                if (typeof handleCharacterSheetScroll !== 'undefined' &&
                    handleCharacterSheetScroll(gameCoords.x, gameCoords.y, deltaY)) {
                    CharacterSheet.lastTouchY = touch.clientY;
                    e.preventDefault();
                    return;
                }
            }
            CharacterSheet.lastTouchY = touch.clientY;
        }

        if (this.usesDomTouchControls()) return;

        void canvas.offsetWidth;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const touches = Array.from(e.touches);
        const convertCoords = (cx, cy) => this._mapPointer(cx, cy, canvas);

        touches.forEach(touch => {
            const { x, y } = convertCoords(touch.clientX, touch.clientY);
            const touchId = touch.identifier;

            if (!this.activeTouches[touchId]) return;
            this.activeTouches[touchId].x = x;
            this.activeTouches[touchId].y = y;

            for (const joystick of Object.values(this.touchJoysticks)) {
                if (joystick && joystick.touchId === touchId) joystick.updateTouch(touchId, x, y);
            }

            // Directional-control behavior is supplied by the application mapping layer.
            const abilityInputType = this._hooks.getAbilityInputType;
            const classType = typeof this._hooks.getClassType === 'function'
                ? this._hooks.getClassType()
                : null;
            const usesHeavyJoystick = classType && abilityInputType
                ? abilityInputType(classType, 'heavyAttack') === 'joystick-press-release'
                : false;

            if (usesHeavyJoystick && this.touchButtons.heavyAttack && this.touchButtons.heavyAttack.pressed &&
                this.touchButtons.heavyAttack.touchId === touchId) {
                const button = this.touchButtons.heavyAttack;
                const dx = x - (button.x + button.width / 2), dy = y - (button.y + button.height / 2);
                if (Math.sqrt(dx * dx + dy * dy) > 10) {
                    if (this.touchJoysticks.heavyAttack && !this.touchJoysticks.heavyAttack.active) {
                        this.touchJoysticks.heavyAttack.startTouch(touchId, x, y);
                    }
                } else if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.active &&
                    this.touchJoysticks.heavyAttack.touchId === touchId) {
                    this.touchJoysticks.heavyAttack.updateTouch(touchId, x, y);
                }
            }

            // Dodge joystick drag — check if current class uses joystick-type input for dodge
            const usesDodgeJoystick = classType && abilityInputType
                ? abilityInputType(classType, 'dodge') === 'joystick-press-release' : false;
            if (usesDodgeJoystick && this.touchButtons.dodge && this.touchButtons.dodge.pressed &&
                this.touchButtons.dodge.touchId === touchId) {
                const button = this.touchButtons.dodge;
                const dx = x - (button.x + button.width / 2), dy = y - (button.y + button.height / 2);
                if (Math.sqrt(dx * dx + dy * dy) > 10) {
                    if (this.touchJoysticks.dodge && !this.touchJoysticks.dodge.active) {
                        this.touchJoysticks.dodge.startTouch(touchId, x, y);
                    }
                } else if (this.touchJoysticks.dodge && this.touchJoysticks.dodge.active &&
                    this.touchJoysticks.dodge.touchId === touchId) {
                    this.touchJoysticks.dodge.updateTouch(touchId, x, y);
                }
            }

            // Special ability joystick drag
            const specialInputType = (classType && abilityInputType)
                ? abilityInputType(classType, 'specialAbility') : 'button';
            const needsSpecialJoystick = specialInputType === 'joystick-press-release' ||
                specialInputType === 'joystick-continuous';
            if (needsSpecialJoystick && this.touchButtons.specialAbility &&
                this.touchButtons.specialAbility.pressed &&
                this.touchButtons.specialAbility.touchId === touchId) {
                const button = this.touchButtons.specialAbility;
                const dx = x - (button.x + button.width / 2), dy = y - (button.y + button.height / 2);
                if (Math.sqrt(dx * dx + dy * dy) > 10) {
                    if (this.touchJoysticks.specialAbility && !this.touchJoysticks.specialAbility.active) {
                        this.touchJoysticks.specialAbility.startTouch(touchId, x, y);
                    }
                } else if (this.touchJoysticks.specialAbility && this.touchJoysticks.specialAbility.active &&
                    this.touchJoysticks.specialAbility.touchId === touchId) {
                    this.touchJoysticks.specialAbility.updateTouch(touchId, x, y);
                }
            }
        });
    },

    handleTouchEnd(e) {
        if (!this.isTouchMode()) return;

        const touches = Array.from(e.changedTouches);
        if (this.usesDomTouchControls()) {
            touches.forEach(touch => delete this.activeTouches[touch.identifier]);
            if (Object.keys(this.activeTouches).length === 0) this.touchActive = false;
            return;
        }

        const abilityInputType = this._hooks.getAbilityInputType;

        touches.forEach(touch => {
            const touchId = touch.identifier;
            const classType = typeof this._hooks.getClassType === 'function'
                ? this._hooks.getClassType()
                : null;

            const captureJoystickState = (joystick, button) => {
                if (!joystick || !button) return;
                button.finalJoystickState = {
                    direction: joystick.getDirection(),
                    magnitude: joystick.getMagnitude(),
                    angle: joystick.angle
                };
            };

            // Heavy attack joystick capture
            const usesHeavyJoystick = classType && abilityInputType
                ? abilityInputType(classType, 'heavyAttack') === 'joystick-press-release' : false;
            if (usesHeavyJoystick) {
                if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.touchId === touchId) {
                    captureJoystickState(this.touchJoysticks.heavyAttack, this.touchButtons.heavyAttack);
                } else if (this.touchButtons.heavyAttack && this.touchButtons.heavyAttack.touchId === touchId &&
                    this.touchButtons.heavyAttack.pressed && this.touchJoysticks.heavyAttack &&
                    this.touchJoysticks.heavyAttack.active) {
                    captureJoystickState(this.touchJoysticks.heavyAttack, this.touchButtons.heavyAttack);
                }
            }

            // Dodge joystick capture — check if current class uses joystick-type input for dodge
            const usesDodgeJoystick = classType && abilityInputType
                ? abilityInputType(classType, 'dodge') === 'joystick-press-release' : false;
            if (usesDodgeJoystick) {
                if (this.touchJoysticks.dodge && this.touchJoysticks.dodge.touchId === touchId) {
                    captureJoystickState(this.touchJoysticks.dodge, this.touchButtons.dodge);
                } else if (this.touchButtons.dodge && this.touchButtons.dodge.touchId === touchId &&
                    this.touchButtons.dodge.pressed && this.touchJoysticks.dodge && this.touchJoysticks.dodge.active) {
                    captureJoystickState(this.touchJoysticks.dodge, this.touchButtons.dodge);
                }
            }


            const specialInputType = (classType && abilityInputType)
                ? abilityInputType(classType, 'specialAbility') : 'button';
            const needsSpecialJoystickCapture = specialInputType === 'joystick-press-release' ||
                specialInputType === 'joystick-continuous';
            if (needsSpecialJoystickCapture) {
                if (this.touchJoysticks.specialAbility && this.touchJoysticks.specialAbility.touchId === touchId) {
                    captureJoystickState(this.touchJoysticks.specialAbility, this.touchButtons.specialAbility);
                } else if (this.touchButtons.specialAbility && this.touchButtons.specialAbility.touchId === touchId &&
                    this.touchButtons.specialAbility.pressed && this.touchJoysticks.specialAbility &&
                    this.touchJoysticks.specialAbility.active) {
                    captureJoystickState(this.touchJoysticks.specialAbility, this.touchButtons.specialAbility);
                }
            }

            for (const joystick of Object.values(this.touchJoysticks)) { if (joystick) joystick.endTouch(touchId); }
            for (const button  of Object.values(this.touchButtons))    { if (button)  button.endTouch(touchId); }
            delete this.activeTouches[touchId];
        });

        if (Object.keys(this.activeTouches).length === 0) this.touchActive = false;
    },

    // ------------------------------------------------------------------ lifecycle

    _installLifecycleHandlers(canvas) {
        if (typeof window === 'undefined' || this._lifecycleHandlersInstalled) return;
        this._lifecycleHandlersInstalled = true;

        window.addEventListener('blur', () => this._resetInputOnContextLoss('blur'));
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this._resetInputOnContextLoss('visibility-hidden');
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseLeft  = false;
            if (e.button === 2) this.mouseRight = false;
        });

        if (canvas) {
            canvas.setAttribute('tabindex', '-1');
            const focusCanvas = () => {
                if (typeof canvas.focus !== 'function' || document.activeElement === canvas) return;
                try { canvas.focus({ preventScroll: true }); } catch (_) { canvas.focus(); }
            };
            canvas.addEventListener('pointerdown', focusCanvas);
            canvas.addEventListener('mousedown',   focusCanvas);
        }
    },

    /** Initialize all input handlers. Call once with the game canvas. */
    init(canvas) {
        this._gamepadCanvas = canvas;

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
            window.addEventListener('resize',            recheckDeviceProfile);
            window.addEventListener('orientationchange', recheckDeviceProfile);
        }

        // Keyboard
        const onKeyDown = (e) => {
            const target = e.target;
            if (typeof isFormFieldTarget === 'function' && isFormFieldTarget(target)) {
                this._applyKeyEvent(e, true);
                return;
            }
            this._activateNonGamepadInput('keyboardMouse', canvas);
            this._applyKeyEvent(e, true);
            if (e.key === 'Tab') e.preventDefault();
            if (typeof this._hooks.shouldPreventArrowDefault === 'function' &&
                this._hooks.shouldPreventArrowDefault(e) &&
                (e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
                 e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup',   (e) => this._applyKeyEvent(e, false));

        // Mouse position
        canvas.addEventListener('mousemove', (e) => {
            const point = this._mapPointer(e.clientX, e.clientY, canvas);
            this.mouse.x = point.x;
            this.mouse.y = point.y;
        });

        // Mouse buttons
        canvas.addEventListener('mousedown', (e) => {
            if (typeof this._hooks.shouldIgnorePointer === 'function' && this._hooks.shouldIgnorePointer(e)) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            this._activateNonGamepadInput('keyboardMouse', canvas);
            if (e.button === 0) this.mouseLeft  = true;
            if (e.button === 2) this.mouseRight = true;
        });
        canvas.addEventListener('mouseup',      (e) => {
            if (e.button === 0) this.mouseLeft  = false;
            if (e.button === 2) this.mouseRight = false;
        });
        canvas.addEventListener('contextmenu',  (e) => e.preventDefault());

        // Touch
        canvas.addEventListener('touchstart',  (e) => this.handleTouchStart(e, canvas), { passive: false, capture: false });
        canvas.addEventListener('touchmove',   (e) => { if (this.touchActive) e.preventDefault(); this.handleTouchMove(e, canvas); }, { passive: false, capture: false });
        canvas.addEventListener('touchend',    (e) => { if (this.touchActive) e.preventDefault(); this.handleTouchEnd(e); },   { passive: false, capture: false });
        canvas.addEventListener('touchcancel', (e) => { if (this.touchActive) e.preventDefault(); this.handleTouchEnd(e); },   { passive: false, capture: false });

        // Gamepad
        window.addEventListener('gamepadconnected', (e) => {
            console.log(`[INPUT] Gamepad connected: "${e.gamepad.id}" (index ${e.gamepad.index})`);
            this._activateGamepad(e.gamepad, canvas);
        });
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log(`[INPUT] Gamepad disconnected: "${e.gamepad.id}" (index ${e.gamepad.index})`);
            if (e.gamepad.index === this._gamepadIndex) {
                this._gamepadIndex   = null;
                this._gamepadActive  = false;
                this._gamepadStartPrev = false;
                this._gamepadSelectPrev = false;
                this._gamepadFamily  = 'generic';
                this._activeInputSource = 'default';
                this._syncUiModeClass();
                this._applyControlSurface(canvas);
            }
        });

        this._scanConnectedGamepads(canvas);
    },

    /** Call once per frame before game logic runs. */
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

        if (this.isGamepadMode()) this._updateGamepad();

        if (!this.isGamepadMode()) {
            for (const joystick of Object.values(this.touchJoysticks)) {
                if (joystick) joystick.update(deltaTime);
            }
        }

        for (const button of Object.values(this.touchButtons)) {
            if (button && !this.isGamepadMode()) button.update(deltaTime);
        }

        if (typeof MobileControlsDOM !== 'undefined' && MobileControlsDOM.refresh &&
            (this._domRefreshCooldown || 0) <= 0) {
            this._domRefreshCooldown = 0.25;
            if (MobileControlsDOM.shouldShow && MobileControlsDOM.layer) {
                const want = MobileControlsDOM.shouldShow();
                if (want === MobileControlsDOM.layer.hidden) MobileControlsDOM.refresh();
            }
        } else if (this._domRefreshCooldown > 0) {
            this._domRefreshCooldown -= deltaTime;
        }
    },

    // ------------------------------------------------------------------ generic query API

    /** Get normalized movement direction vector from the active input device. */
    getMovementInput() {
        if (this.isTouchMode() && this.touchJoysticks.movement) {
            const dir = this.touchJoysticks.movement.getDirection();
            const mag = this.touchJoysticks.movement.getMagnitude();
            return { x: dir.x * mag, y: dir.y * mag };
        }
        let x = 0, y = 0;
        if (this.isKeyDown('w')) y -= 1;
        if (this.isKeyDown('s')) y += 1;
        if (this.isKeyDown('a')) x -= 1;
        if (this.isKeyDown('d')) x += 1;
        const length = Math.sqrt(x * x + y * y);
        if (length > 0) return { x: x / length, y: y / length };
        return { x: 0, y: 0 };
    },

    /** Get current aim direction as an angle in radians from the active input device. */
    getAimDirection() {
        if (this.isTouchMode()) {
            for (const key of ['heavyAttack', 'specialAbility', 'dodge']) {
                const j = this.touchJoysticks[key];
                if (j && j.active && j.getMagnitude() > 0.1) {
                    const angle = j.getAngle();
                    this.lastAimAngle = angle;
                    return angle;
                }
            }
            if (this.touchJoysticks.basicAttack) {
                const j = this.touchJoysticks.basicAttack;
                if (j.active || (this.isGamepadMode() && j.getMagnitude() > 0.1)) {
                    const angle = j.getAngle();
                    this.lastAimAngle = angle;
                    return angle;
                }
                return this.lastAimAngle;
            }
            return this.lastAimAngle;
        }
        // Desktop: mouse angle
        if (typeof this._hooks.getAimOrigin === 'function') {
            const origin = this._hooks.getAimOrigin();
            if (!origin) return 0;
            const wm = this.getWorldMousePos();
            return Math.atan2(wm.y - origin.y, wm.x - origin.x);
        }
        return 0;
    },

    /**
     * Check if a named ability slot is currently pressed.
     * Ability names are abstract slot names ('basicAttack', 'heavyAttack', 'specialAbility', 'dodge').
     */
    isAbilityPressed(ability) {
        if (this.isTouchMode()) {
            if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                return this.touchJoysticks.basicAttack.active && this.touchJoysticks.basicAttack.getMagnitude() > 0.1;
            }
            return this.touchButtons[ability] ? this.touchButtons[ability].pressed : false;
        }
        if (!this._hasWindowFocus()) return false;
        if (ability === 'basicAttack')    return this.mouseLeft;
        if (ability === 'heavyAttack')    return this.mouseRight;
        if (ability === 'specialAbility') return this.isKeyDown(' ');
        if (ability === 'dodge')          return this.isKeyDown('shift');
        return false;
    },

    /** Check if a named ability slot was just pressed this frame (edge detect). */
    isAbilityJustPressed(ability) {
        if (this.isTouchMode()) {
            if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                return this.touchJoysticks.basicAttack.active && this.touchJoysticks.basicAttack.getMagnitude() > 0.1;
            }
            return this.touchButtons[ability] ? this.touchButtons[ability].justPressed : false;
        }
        if (!this._hasWindowFocus()) return false;
        if (ability === 'basicAttack')    return this.mouseLeft;
        if (ability === 'heavyAttack')    return this.mouseRight;
        if (ability === 'specialAbility') return this.isKeyDown(' ');
        if (ability === 'dodge')          return this.isKeyDown('shift');
        return false;
    },

    /** Get the normalized direction vector for a named ability slot. */
    getAbilityDirection(ability) {
        if (this.isTouchMode()) {
            if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                return this.touchJoysticks.basicAttack.getDirection();
            }
            if (ability === 'heavyAttack') {
                if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.active)
                    return this.touchJoysticks.heavyAttack.getDirection();
                if (this.touchJoysticks.basicAttack) return this.touchJoysticks.basicAttack.getDirection();
            }
            if (ability === 'specialAbility' && this.touchJoysticks.specialAbility) {
                return this.touchJoysticks.specialAbility.getDirection();
            }
            return { x: 0, y: 0 };
        }
        if (typeof this._hooks.getAimOrigin === 'function') {
            const origin = this._hooks.getAimOrigin();
            if (!origin) return { x: 0, y: 0 };
            const worldPointer = this.getWorldMousePos();
            const dx = worldPointer.x - origin.x, dy = worldPointer.y - origin.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) return { x: dx / dist, y: dy / dist };
        }
        return { x: 0, y: 0 };
    },

    /** Get the angle in radians for a named ability slot. */
    getAbilityAngle(ability) {
        if (this.isTouchMode()) {
            if (ability === 'basicAttack' && this.touchJoysticks.basicAttack)
                return this.touchJoysticks.basicAttack.getAngle();
            if (ability === 'heavyAttack') {
                if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.active)
                    return this.touchJoysticks.heavyAttack.getAngle();
                if (this.touchJoysticks.basicAttack) return this.touchJoysticks.basicAttack.getAngle();
            }
            if (ability === 'specialAbility' && this.touchJoysticks.specialAbility)
                return this.touchJoysticks.specialAbility.getAngle();
            return 0;
        }
        return this.getAimDirection();
    },

    /** Canvas render path for on-screen touch controls (legacy). DOM layer preferred. */
    render(ctx) {
        if (!this.isMobileUiMode()) return;
        if (this.isGamepadMode()) return;
        if (typeof MobileControlsDOM !== 'undefined') return;

        // Delegate application-specific rendering through the configured hook.
        if (typeof this._hooks.renderTouchControls === 'function') {
            this._hooks.renderTouchControls(ctx, this);
            return;
        }

        // Generic fallback: draw all joystick/button primitives with no class-specific filtering.
        const tutorialHighlight = (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.getHighlightControl)
            ? Room0Tutorial.getHighlightControl() : null;
        const drawGlow = (cx, cy, radius) => {
            if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
            const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.01);
            ctx.save();
            ctx.strokeStyle = `rgba(255, 220, 80, ${0.55 + pulse * 0.4})`;
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        };
        for (const key in this.touchJoysticks) {
            const joystick = this.touchJoysticks[key];
            if (!joystick) continue;
            if (tutorialHighlight === key) drawGlow(joystick.centerX, joystick.centerY, joystick.radius || 40);
            joystick.render(ctx, {});
        }
        for (const key in this.touchButtons) {
            const button = this.touchButtons[key];
            if (!button) continue;
            if (tutorialHighlight === key) drawGlow(button.x + button.width / 2, button.y + button.height / 2, Math.max(button.width, button.height) / 2);
            button.render(ctx, 0, 0, null, { armed: button.pressed });
        }
    }
};

if (typeof window !== 'undefined') {
    window.Engine = window.Engine || {};
    window.Engine.Input = Engine.Input;
    // Keep window.Input as the canonical reference for all call-sites in game code.
    window.Input = Engine.Input;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Input: Engine.Input };
}

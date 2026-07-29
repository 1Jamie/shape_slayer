/**
 * Engine.Input — raw hardware sampling layer.
 * BOUNDARY CONTRACT: This file MUST NOT reference any game-specific content.
 * It polls keyboard, mouse, pointer, gamepad, and touch hardware and exposes
 * a clean generic query API. All game-action vocabulary lives in game/input-map.js.
 *
 * @typedef {Object} ControlSeat
 * @property {string} id Seat identifier (e.g. 'seat0', 'seat1')
 * @property {number|null} gamepadIndex Associated gamepad index
 * @property {boolean} allowKeyboardMouse True if seat can accept keyboard/mouse inputs
 * @property {number} lastAimAngle Last aim direction angle in radians
 * @property {'keyboardMouse'|'gamepad'|'touch'} inputClass Active input device modality for seat
 *
 * @typedef {Object} TouchSeatControlOptions
 * @property {string} [id]
 * @property {number} [gamepadIndex]
 * @property {boolean} [allowKeyboardMouse]
 */

const inputRoot = typeof window !== 'undefined' ? window : globalThis;
inputRoot.Engine = inputRoot.Engine || {};
const Engine = inputRoot.Engine;

// W3C Standard Gamepad indices — keep combat/UI bindings aligned with launchModal.
const STANDARD_PAD = Object.freeze({
    A: 0, B: 1, X: 2, Y: 3,
    LB: 4, RB: 5, LT: 6, RT: 7,
    SELECT: 8, START: 9,
    L3: 10, R3: 11,
    DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15
});

const ABILITY_BUTTON_MAP = Object.freeze({
    basicAttack: STANDARD_PAD.RT,
    heavyAttack: STANDARD_PAD.LT,
    specialAbility: STANDARD_PAD.LB,
    dodge: STANDARD_PAD.RB
});

function _copyPadButton(button) {
    if (!button) return { pressed: false, value: 0 };
    const value = typeof button.value === 'number' ? button.value : (button.pressed ? 1 : 0);
    return { pressed: !!(button.pressed || value > 0.15), value };
}

function _emptyPadButton() {
    return { pressed: false, value: 0 };
}

/** Normalize a raw trigger axis (0..1 rest-0, or -1..1 rest-at--1) into 0..1. */
function _normalizeTriggerAxis(raw) {
    const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    if (v < 0) return Math.max(0, Math.min(1, (v + 1) / 2));
    return Math.max(0, Math.min(1, v));
}

function _triggerButtonFromAxis(raw) {
    const value = _normalizeTriggerAxis(raw);
    return { pressed: value > 0.15, value };
}

function createInputSeat(input, options = {}) {
    const id = options.id == null ? `seat${input._seats.size}` : String(options.id);
    const seat = {
        id,
        gamepadIndex: Number.isInteger(options.gamepadIndex) ? options.gamepadIndex : null,
        allowKeyboardMouse: options.allowKeyboardMouse === true,
        lastAimAngle: 0,
        _buttons: new Uint8Array(16),
        _previousButtons: new Uint8Array(16),
        _justPressed: new Uint8Array(16),
        _justReleased: new Uint8Array(16),
        _axes: new Float32Array(4),
        _interactPrev: false,
        // Per-seat input class for prompts/gameplay (never borrow global Input source).
        _seatInputSource: null,
        _seatGamepadFamily: 'generic',

        _buttonDown(index) {
            return !!this._buttons[index];
        },

        _buttonJustPressed(index) {
            return !!this._justPressed[index];
        },

        _buttonJustReleased(index) {
            return !!this._justReleased[index];
        },

        _stick(axisX, axisY) {
            return input._applyRadialDeadzone(this._axes[axisX] || 0, this._axes[axisY] || 0);
        },

        _isPadConnected() {
            if (this.gamepadIndex === null) return false;
            const pads = typeof navigator !== 'undefined' && navigator.getGamepads
                ? navigator.getGamepads()
                : [];
            const raw = pads[this.gamepadIndex];
            return !!(raw && raw.connected);
        },

        _padHasLiveInput() {
            for (let i = 0; i < 16; i++) {
                if (this._buttons[i]) return true;
            }
            const dead = (input._gamepadDeadzone != null) ? input._gamepadDeadzone : 0.18;
            for (let i = 0; i < 4; i++) {
                if (Math.abs(this._axes[i] || 0) > dead) return true;
            }
            return false;
        },

        _keyboardMouseHasLiveInput() {
            if (!this.allowKeyboardMouse) return false;
            const keys = input.keys || {};
            if (keys.w || keys.a || keys.s || keys.d || keys.g || keys.m || keys[' '] || keys.shift) return true;
            if (keys.arrowup || keys.arrowdown || keys.arrowleft || keys.arrowright) return true;
            if (input.mouseLeft || input.mouseRight) return true;
            return false;
        },

        /**
         * Keyboard-only seats always use mouse/keys.
         * Pad-only seats always use the pad.
         * Hybrid seats follow this seat's last live input (not the global Input source).
         */
        _usesKeyboardMouse() {
            if (!this.allowKeyboardMouse) return false;
            if (this.gamepadIndex === null) return true;
            return this.getPromptSource() === 'keyboardMouse';
        },

        update() {
            const gamepads = typeof navigator !== 'undefined' && navigator.getGamepads
                ? navigator.getGamepads()
                : [];
            const raw = this.gamepadIndex === null ? null : gamepads[this.gamepadIndex];
            const gamepad = raw && raw.connected ? input._getMappedGamepad(raw) : null;

            const buttonsLen = gamepad && gamepad.buttons ? Math.min(16, gamepad.buttons.length) : 0;
            for (let i = 0; i < 16; i++) {
                this._previousButtons[i] = this._buttons[i];
                if (i < buttonsLen) {
                    const btn = gamepad.buttons[i];
                    const down = btn && (btn.pressed || btn.value > 0.15) ? 1 : 0;
                    this._buttons[i] = down;
                    this._justPressed[i] = (down === 1 && this._previousButtons[i] === 0) ? 1 : 0;
                    this._justReleased[i] = (down === 0 && this._previousButtons[i] === 1) ? 1 : 0;
                } else {
                    this._buttons[i] = 0;
                    this._justPressed[i] = 0;
                    this._justReleased[i] = this._previousButtons[i] === 1 ? 1 : 0;
                }
            }

            const axesLen = gamepad && gamepad.axes ? Math.min(4, gamepad.axes.length) : 0;
            for (let i = 0; i < 4; i++) {
                this._axes[i] = i < axesLen ? gamepad.axes[i] || 0 : 0;
            }

            if (raw && raw.connected && typeof input._detectGamepadFamily === 'function') {
                this._seatGamepadFamily = input._detectGamepadFamily(raw);
            }

            const padLive = !!(gamepad && this._padHasLiveInput());
            const kbLive = this._keyboardMouseHasLiveInput();
            if (padLive) this._seatInputSource = 'gamepad';
            else if (kbLive) this._seatInputSource = 'keyboardMouse';

            return this;
        },

        // Desktop player paths read these fields off Engine.Input; mirror them for KB seats.
        get mouseLeft() {
            return this._usesKeyboardMouse() ? !!input.mouseLeft : false;
        },
        get mouseRight() {
            return this._usesKeyboardMouse() ? !!input.mouseRight : false;
        },
        get mouse() {
            return input.mouse;
        },
        get keys() {
            return this.allowKeyboardMouse ? input.keys : {};
        },

        isTouchMode() {
            return !this._usesKeyboardMouse();
        },

        getMovementInput(out = null) {
            let resX = 0, resY = 0;
            if (this._usesKeyboardMouse()) {
                const keyboard = input._getKeyboardMovementInput();
                if (keyboard.x !== 0 || keyboard.y !== 0) {
                    resX = keyboard.x;
                    resY = keyboard.y;
                }
            }
            if (resX === 0 && resY === 0) {
                const stick = this._stick(0, 1);
                let x = stick.x;
                let y = stick.y;
                if (this._buttonDown(12)) y -= 1;
                if (this._buttonDown(13)) y += 1;
                if (this._buttonDown(14)) x -= 1;
                if (this._buttonDown(15)) x += 1;
                const length = Math.hypot(x, y);
                if (length > 1) {
                    resX = x / length;
                    resY = y / length;
                } else {
                    resX = x;
                    resY = y;
                }
            }
            if (out && typeof out === 'object') {
                out.x = resX;
                out.y = resY;
                return out;
            }
            return { x: resX, y: resY };
        },

        getAimDirection() {
            if (this._usesKeyboardMouse()) {
                return input.getAimDirection();
            }
            const stick = this._stick(2, 3);
            if (stick.mag > 0.05) this.lastAimAngle = Math.atan2(stick.y, stick.x);
            return this.lastAimAngle;
        },

        isAbilityPressed(ability) {
            if (this._usesKeyboardMouse() && input._desktopAbilityDown(ability)) {
                return true;
            }
            const button = ABILITY_BUTTON_MAP[ability];
            return button === undefined ? false : this._buttonDown(button);
        },

        isAbilityJustPressed(ability) {
            if (this._usesKeyboardMouse() && input._desktopAbilityJust[ability]) {
                return true;
            }
            const button = ABILITY_BUTTON_MAP[ability];
            return button === undefined ? false : this._buttonJustPressed(button);
        },

        isAbilityJustReleased(ability) {
            if (this._usesKeyboardMouse() && input._desktopAbilityJustReleased
                && input._desktopAbilityJustReleased[ability]) {
                return true;
            }
            const button = ABILITY_BUTTON_MAP[ability];
            return button === undefined ? false : this._buttonJustReleased(button);
        },

        getAbilityDirection(out = null) {
            const angle = this.getAimDirection();
            const ax = Math.cos(angle);
            const ay = Math.sin(angle);
            if (out && typeof out === 'object') {
                out.x = ax;
                out.y = ay;
                return out;
            }
            return { x: ax, y: ay };
        },

        getAbilityAngle() {
            return this.getAimDirection();
        },

        isKeyDown(key) {
            return this.allowKeyboardMouse ? input.isKeyDown(key) : false;
        },

        getKeyState(key) {
            return this.isKeyDown(key);
        },

        /** Nexus / world interact: G on keyboard seats, South face (A/Cross) on pads. */
        isInteractPressed() {
            if (this._usesKeyboardMouse() && input.isKeyDown('g')) return true;
            return this._buttonDown(0);
        },

        isInteractJustPressed() {
            const pressed = this.isInteractPressed();
            const edge = pressed && !this._interactPrev;
            this._interactPrev = pressed;
            return edge;
        },

        /**
         * Glyph source for THIS seat only:
         * - no pad bound → keyboard/mouse
         * - pad-only seat → that pad's family glyphs
         * - hybrid seat → last live input on this seat (defaults to pad when connected)
         */
        getPromptSource() {
            if (this.gamepadIndex === null) return 'keyboardMouse';
            if (!this.allowKeyboardMouse) return 'gamepad';
            if (this._seatInputSource === 'keyboardMouse' || this._seatInputSource === 'gamepad') {
                return this._seatInputSource;
            }
            // Hybrid seat with a bound pad: prefer that pad's family until KB/M is used here.
            return 'gamepad';
        },

        getGamepadFamily() {
            if (this.gamepadIndex === null) return 'generic';
            if (this._seatGamepadFamily && this._seatGamepadFamily !== 'generic') {
                return this._seatGamepadFamily;
            }
            const pads = typeof navigator !== 'undefined' && navigator.getGamepads
                ? navigator.getGamepads()
                : [];
            const raw = pads[this.gamepadIndex];
            if (raw && raw.connected && typeof input._detectGamepadFamily === 'function') {
                this._seatGamepadFamily = input._detectGamepadFamily(raw);
                return this._seatGamepadFamily;
            }
            return this._seatGamepadFamily || 'generic';
        }
    };
    return seat;
}

Engine.Input = {
    _hooks: {},
    _seats: new Map(),
    _couchSplitActive: false,

    configure(hooks = {}) {
        this._hooks = Object.assign({}, this._hooks, hooks);
        return this;
    },

    createSeat(options = {}) {
        const seat = createInputSeat(this, options);
        if (this._seats.has(seat.id)) throw new Error(`Input seat already exists: ${seat.id}`);
        this._seats.set(seat.id, seat);
        return seat;
    },

    getSeat(id) {
        return this._seats.get(String(id)) || null;
    },

    seats() {
        return Array.from(this._seats.values());
    },

    removeSeat(id) {
        return this._seats.delete(String(id));
    },

    clearSeats() {
        this._seats.clear();
    },

    setCouchSplitActive(active) {
        const next = active === true;
        this._couchSplitActive = next;
        if (next) {
            // Touch is never a local-coop seat — clear any leftover touch state.
            if (typeof this._resetTouchState === 'function') {
                this._resetTouchState('couch-split');
            }
            this.touchActive = false;
            if (this._activeInputSource === 'touch') {
                this._activeInputSource = 'keyboardMouse';
            }
        }
        return this;
    },

    /** True while local co-op owns seats — touch must not drive gameplay. */
    isCouchSplitActive() {
        return !!this._couchSplitActive;
    },

    updateSeats(deltaTime) {
        for (const seat of this._seats.values()) seat.update(deltaTime);
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

    _mapPointer(clientX, clientY, canvas, out = null) {
        if (typeof this._hooks.mapPointer === 'function') {
            return this._hooks.mapPointer(clientX, clientY, canvas);
        }
        const rect = canvas.getBoundingClientRect();
        const size = this._getLogicalSize(canvas);
        const rx = (clientX - rect.left) * (size.width / (rect.width || 1));
        const ry = (clientY - rect.top) * (size.height / (rect.height || 1));
        if (out && typeof out === 'object') {
            out.x = rx;
            out.y = ry;
            return out;
        }
        return { x: rx, y: ry };
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
    activeTouchCount: 0,
    touchJoysticks: {},  // Map of joystick name -> VirtualJoystick
    touchButtons: {},    // Map of button name -> TouchButton
    touchJoystickList: [],
    touchButtonList: [],

    _rebuildTouchLists() {
        this.touchJoystickList.length = 0;
        for (const key in this.touchJoysticks) {
            const val = this.touchJoysticks[key];
            if (val) this.touchJoystickList.push(val);
        }
        this.touchButtonList.length = 0;
        for (const key in this.touchButtons) {
            const val = this.touchButtons[key];
            if (val) this.touchButtonList.push(val);
        }
    },

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

    _applyRadialDeadzone(rawX, rawY, out = null) {
        const magnitude = Math.hypot(rawX, rawY);
        const res = out && typeof out === 'object' ? out : { x: 0, y: 0, mag: 0 };
        if (magnitude < this._gamepadDeadzone) {
            res.x = 0; res.y = 0; res.mag = 0;
            return res;
        }
        const scaled = Math.min(1, (magnitude - this._gamepadDeadzone) / (1 - this._gamepadDeadzone));
        res.x = (rawX / magnitude) * scaled;
        res.y = (rawY / magnitude) * scaled;
        res.mag = scaled;
        return res;
    },

    _hasWindowFocus() {
        return typeof document === 'undefined' || document.hasFocus();
    },

    // ------------------------------------------------------------------ device

    getDeviceProfile() {
        if (Engine.System && Engine.System.getProfile) {
            return Engine.System.getProfile();
        }
        return {
            formFactor: 'unknown', os: 'unknown',
            isMobile: false, isPhone: false, isTablet: false, isDesktop: true,
            confidence: 'low', reason: 'device-detection-unavailable', capabilities: {}
        };
    },

    isMobileDevice() {
        if (Engine.System && Engine.System.isMobileDevice) {
            return Engine.System.isMobileDevice();
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
        if (this._couchSplitActive) return false;
        if (this.isGamepadMode()) return false;
        if (typeof this._hooks.isDomTouchControlsActive === 'function') {
            return this._hooks.isDomTouchControlsActive();
        }
        return false;
    },

    // ------------------------------------------------------------------ event recording (game-neutral)

    _recordInputEvent(type, metadata = {}) {
        if (typeof this._hooks.recordTelemetry === 'function') {
            this._hooks.recordTelemetry(type, { metadata: { ...this.getInputContext(), ...metadata } });
        }
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
        for (let i = 0; i < this.touchJoystickList.length; i++) {
            const joystick = this.touchJoystickList[i];
            if (joystick && joystick.touchId !== null) joystick.endTouch(joystick.touchId);
        }
        for (let i = 0; i < this.touchButtonList.length; i++) {
            const button = this.touchButtonList[i];
            if (button && button.touchId !== null) button.endTouch(button.touchId);
        }
        this.activeTouches = {};
        this.activeTouchCount = 0;
        this.touchActive = false;
        this._recordInputEvent('inputReset', { reason, target: 'touch' });
    },

    _resetInputOnContextLoss(reason) {
        this._resetKeyboardState(reason);
        this._resetPointerState(reason);
        if (this.isTouchMode()) this._resetTouchState(reason);
    },

    /**
     * Clear edge-trigger state so a portal activate click/key does not fire
     * abilities on frame 0 of a new mode session.
     * Held keys stay held; justPressed / justReleased / mouse-down edges are cleared.
     */
    flushEdgeTriggers(reason = 'mode-takeover') {
        // Treat currently-held gamepad buttons as already-seen (no fresh edges).
        if (this._seats && typeof this._seats.values === 'function') {
            for (const seat of this._seats.values()) {
                if (!seat) continue;
                if (seat._justPressed && seat._previousButtons && seat._buttons) {
                    seat._previousButtons.set(seat._buttons);
                    seat._justPressed.fill(0);
                }
                seat._interactPrev = true;
            }
        }
        this._gamepadStartPrev = true;
        this._gamepadSelectPrev = true;

        // Mouse: drop pressed so held click does not carry into session as attack.
        this.mouseLeft = false;
        this.mouseRight = false;

        // Interact / menu keys commonly used on the portal.
        if (this.keys) {
            this.keys['g'] = false;
            this.keys[' '] = false;
            this.keys['escape'] = false;
            this.keys['enter'] = false;
        }

        for (let i = 0; i < this.touchButtonList.length; i++) {
            const button = this.touchButtonList[i];
            if (!button) continue;
            button.justPressed = false;
            button.justReleased = false;
            // If still physically held, mark pressed without edge.
            if (button.pressed) {
                button.justPressed = false;
            } else {
                button.pressed = false;
                button.active = false;
            }
        }

        this._recordInputEvent('inputFlushEdges', { reason, target: 'edge-triggers' });
        return this;
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
        this.activeTouchCount = 0;
        this.touchJoysticks = {};
        this.touchButtons = {};
        this._rebuildTouchLists();
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
        const layout = (typeof this._hooks.getMobileControlLayout === 'function')
            ? this._hooks.getMobileControlLayout(width, height, layoutOptions)
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
            this.touchJoysticks.basicAttack   = new VirtualJoystick(width - 130, height - 170, 55, 20);
            this.touchJoysticks.movement      = new VirtualJoystick(100, height - 170, 60, 20);
            this.touchButtons.heavyAttack     = new TouchButton(width - 220, height - 250, 54, 54, 'Heavy');
            this.touchJoysticks.heavyAttack   = new VirtualJoystick(width - 193, height - 223, 28, 14);
            this.touchButtons.specialAbility  = new TouchButton(width - 100, height - 250, 54, 54, 'Spcl');
            this.touchJoysticks.specialAbility = new VirtualJoystick(width - 73, height - 223, 28, 14);
            this.touchButtons.dodge           = new TouchButton(width - 157, height - 110, 54, 54, 'Dodge');
            this.touchJoysticks.dodge         = new VirtualJoystick(width - 130, height - 83, 28, 14);
        }

        if (typeof this._hooks.onInputSurfaceReady === 'function') {
            this._hooks.onInputSurfaceReady();
        }
        this._rebuildTouchLists();
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
            if (typeof this._hooks.refreshDomTouchControls === 'function') this._hooks.refreshDomTouchControls();
            return;
        }

        this._touchControlsHiddenForGamepad = false;
        if (this.isMobileUiMode()) {
            if (canvas) this.initTouchControls(canvas);
        } else if (typeof this._hooks.refreshDomTouchControls === 'function') {
            this._hooks.refreshDomTouchControls();
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

    /**
     * True when the browser handed us a raw Linux/DirectInput-style pad where
     * indices 6/7 are Back/Start (not LT/RT). DualSense / properly remapped
     * pads report mapping === 'standard' and skip this path. HHD "Xbox" /
     * generic XInput uinput devices often land here — without remapping,
     * Start fires primary because we read button 7 as RT.
     * @param {Gamepad} gp Raw browser Gamepad object
     * @returns {boolean}
     */
    _needsXboxLegacyRemap(gp) {
        if (!gp || gp.mapping === 'standard') return false;
        const family = this._detectGamepadFamily(gp);
        if (family === 'xbox' || family === 'steam') return true;
        if (family === 'playstation' || family === 'nintendo') return false;
        // Generic / unknown: classic joystick node has ~10 face/shoulder/menu
        // buttons and keeps d-pad + triggers on axes (no buttons[12..15]).
        const buttonCount = gp.buttons ? gp.buttons.length : 0;
        const axisCount = gp.axes ? gp.axes.length : 0;
        return buttonCount > 0 && buttonCount <= 11 && axisCount >= 4;
    },

    /**
     * Remap Linux Xbox 360 / HHD Xbox-emu joystick layout → W3C Standard Gamepad.
     * Raw: 0–5 face+bumpers, 6 Back, 7 Start, 8 L3, 9 R3;
     *      axes 0–1 left stick, 2 LT, 3–4 right stick, 5 RT; hat on 6–7.
     * @param {Gamepad} gp Raw browser Gamepad object
     * @returns {Object} Remapped gamepad-like structure
     */
    _remapXboxLegacyToStandard(gp) {
        const srcButtons = gp.buttons || [];
        const srcAxes = gp.axes || [];
        const buttons = new Array(16);
        for (let i = 0; i < 16; i++) buttons[i] = _emptyPadButton();

        for (let i = 0; i <= 5; i++) buttons[i] = _copyPadButton(srcButtons[i]);

        buttons[STANDARD_PAD.SELECT] = _copyPadButton(srcButtons[6]);
        buttons[STANDARD_PAD.START] = _copyPadButton(srcButtons[7]);
        buttons[STANDARD_PAD.L3] = _copyPadButton(srcButtons[8]);
        buttons[STANDARD_PAD.R3] = _copyPadButton(srcButtons[9]);

        if (srcAxes.length >= 6) {
            buttons[STANDARD_PAD.LT] = _triggerButtonFromAxis(srcAxes[2]);
            buttons[STANDARD_PAD.RT] = _triggerButtonFromAxis(srcAxes[5]);
        } else {
            // No dedicated trigger axes — leave LT/RT idle rather than aliasing
            // menu buttons (the bug that made Start fire primary).
            buttons[STANDARD_PAD.LT] = _emptyPadButton();
            buttons[STANDARD_PAD.RT] = _emptyPadButton();
        }

        const hatX = srcAxes.length > 6 ? (srcAxes[6] || 0) : 0;
        const hatY = srcAxes.length > 7 ? (srcAxes[7] || 0) : 0;
        if (hatX < -0.5 || hatX > 0.5 || hatY < -0.5 || hatY > 0.5) {
            buttons[STANDARD_PAD.DPAD_LEFT] = { pressed: hatX < -0.5, value: hatX < -0.5 ? 1 : 0 };
            buttons[STANDARD_PAD.DPAD_RIGHT] = { pressed: hatX > 0.5, value: hatX > 0.5 ? 1 : 0 };
            buttons[STANDARD_PAD.DPAD_UP] = { pressed: hatY < -0.5, value: hatY < -0.5 ? 1 : 0 };
            buttons[STANDARD_PAD.DPAD_DOWN] = { pressed: hatY > 0.5, value: hatY > 0.5 ? 1 : 0 };
        }

        const axes = [
            srcAxes[0] || 0,
            srcAxes[1] || 0,
            srcAxes.length >= 6 ? (srcAxes[3] || 0) : (srcAxes[2] || 0),
            srcAxes.length >= 6 ? (srcAxes[4] || 0) : (srcAxes[3] || 0)
        ];

        return {
            id: gp.id,
            index: gp.index,
            connected: gp.connected,
            mapping: 'standard',
            buttons,
            axes,
            _remappedFrom: 'xbox-legacy'
        };
    },

    _getMappedGamepad(gp) {
        if (!gp) return null;
        if (gp.mapping === 'standard') return gp;

        if (Engine.SDLGameControllerDB) {
            const remapped = Engine.SDLGameControllerDB.remapGamepad(gp);
            if (remapped) return remapped;
        }

        if (this._needsXboxLegacyRemap(gp)) {
            return this._remapXboxLegacyToStandard(gp);
        }

        // Unknown non-standard pad: copy through without claiming standard
        // indices for menu buttons (avoid Start→RT collisions).
        const buttons = [];
        const axes = [];
        for (let i = 0; i < (gp.axes || []).length; i++) axes.push(gp.axes[i] || 0);
        for (let i = 0; i < (gp.buttons || []).length; i++) {
            buttons.push(_copyPadButton(gp.buttons[i]));
        }
        while (axes.length < 4) axes.push(0);
        while (buttons.length < 16) buttons.push(_emptyPadButton());

        return {
            id: gp.id,
            index: gp.index,
            connected: gp.connected,
            mapping: '',
            buttons,
            axes
        };
    },

    /** Load gamecontrollerdb.txt into engine gamepad mapper. */
    async initGameControllerDB(url = 'assets/gamecontrollerdb.txt') {
        if (Engine.SDLGameControllerDB) {
            return await Engine.SDLGameControllerDB.loadFromUrl(url);
        }
        return 0;
    },

    /** Manually add an SDL mapping string (e.g. "030000005e0400008e02000014010000,X360 Controller,a:b0,..."). */
    addGamepadMapping(sdlString) {
        if (Engine.SDLGameControllerDB) {
            return Engine.SDLGameControllerDB.addMapping(sdlString);
        }
        return false;
    },

    /** Load raw gamecontrollerdb mapping text into memory. */
    loadGameControllerDBText(text) {
        if (Engine.SDLGameControllerDB) {
            return Engine.SDLGameControllerDB.loadText(text);
        }
        return 0;
    },

    /**
     * Returns hardware button-style metadata for the given abstract button name.
     * @param {'interact'|'modifier'} button
     * @param {string|null} [family=null] Gamepad family override
     * @returns {Object} Button style metadata
     */
    _getGamepadButtonStyle(button, family = null) {
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
        const familyKey = family || this._gamepadFamily;
        const familyStyles = styles[familyKey] || styles.generic;
        return familyStyles[button] || styles.generic[button] || { mark: 'text', label: '?', color: '#ffffff', text: '?' };
    },

    /**
     * Resolve glyph mode for prompts.
     * @param {{seat?: Object, source?: string, family?: string}|null} [options=null]
     * @returns {{mode: 'gamepad'|'touch'|'keyboard', family: string}}
     */
    _resolvePromptContext(options = null) {
        const opts = options && typeof options === 'object' ? options : null;
        let mode = null;
        let family = this._gamepadFamily || 'generic';

        if (opts && opts.seat) {
            const seat = opts.seat;
            const source = typeof seat.getPromptSource === 'function'
                ? seat.getPromptSource()
                : (seat.gamepadIndex != null ? 'gamepad' : 'keyboardMouse');
            if (source === 'gamepad') mode = 'gamepad';
            else if (source === 'touch') mode = 'touch';
            else mode = 'keyboard';
            if (mode === 'gamepad') {
                if (typeof seat.getGamepadFamily === 'function') {
                    family = seat.getGamepadFamily() || family;
                } else if (seat._seatGamepadFamily) {
                    family = seat._seatGamepadFamily;
                }
            }
        } else if (opts && opts.source) {
            if (opts.source === 'gamepad') mode = 'gamepad';
            else if (opts.source === 'touch' || opts.source === 'mobile') mode = 'touch';
            else mode = 'keyboard';
            if (opts.family) family = opts.family;
        }

        if (!mode) {
            if (this.isGamepadMode()) mode = 'gamepad';
            else if (this.isMobileUiMode()) mode = 'touch';
            else mode = 'keyboard';
        }
        return { mode, family };
    },

    /**
     * Returns the display hint string for an abstract action ('interact' | 'modifier').
     * @param {'interact'|'modifier'} action
     * @param {Object|null} [options=null]
     * @returns {string} Display hint label
     */
    getInputHint(action, options = null) {
        const promptCtx = this._resolvePromptContext(options);
        const desktopHints = { interact: 'G', modifier: 'M' };
        if (promptCtx.mode === 'gamepad') return this._getGamepadButtonStyle(action, promptCtx.family).text;
        return desktopHints[action] || '';
    },

    getInteractionPrompt(actionText = 'interact', options = null) {
        const promptCtx = this._resolvePromptContext(options);
        if (promptCtx.mode === 'gamepad') return `Press ${this.getInputHint('interact', options)} to ${actionText}`;
        if (promptCtx.mode === 'touch') return `Tap Interact to ${actionText}`;
        return `Press ${this.getInputHint('interact', options)} to ${actionText}`;
    },

    getDoorPrompt(hasModifiers = false, options = null) {
        const promptCtx = this._resolvePromptContext(options);
        const selectHint   = this.getInputHint('interact', options);
        const modifierHint = this.getInputHint('modifier', options);
        if (promptCtx.mode === 'gamepad') {
            return hasModifiers
                ? `Press ${selectHint} to Select or ${modifierHint} for Modifier`
                : `Press ${selectHint} to Select`;
        }
        if (promptCtx.mode === 'touch') return 'Tap Interact to Select';
        return hasModifiers
            ? `Press ${selectHint} to Select or ${modifierHint} for Modifier`
            : `Press ${selectHint} to Select`;
    },

    drawControllerButtonHint(ctx, button, x, y, size = 18, options = null) {
        const promptCtx = this._resolvePromptContext(options);
        const radius = size / 2;
        const buttonStyle = this._getGamepadButtonStyle(button, promptCtx.family);
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

    drawInteractionPrompt(ctx, actionText, x, y, options = null) {
        const promptCtx = this._resolvePromptContext(options);
        if (promptCtx.mode !== 'gamepad') {
            ctx.fillText(this.getInteractionPrompt(actionText, options), x, y);
            return;
        }
        this._drawGamepadPrompt(ctx, [
            { type: 'text',   text: 'Press ' },
            { type: 'button', button: 'interact' },
            { type: 'text',   text: ` to ${actionText}` }
        ], x, y, options);
    },

    drawDoorPrompt(ctx, hasModifiers, x, y, options = null) {
        const promptCtx = this._resolvePromptContext(options);
        if (promptCtx.mode !== 'gamepad') {
            ctx.fillText(this.getDoorPrompt(hasModifiers, options), x, y);
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
        this._drawGamepadPrompt(ctx, parts, x, y, options);
    },

    _drawGamepadPrompt(ctx, parts, x, y, options = null) {
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
                this.drawControllerButtonHint(
                    ctx, part.button, cursorX + buttonSize / 2, y - buttonSize * 0.35, buttonSize, options
                );
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
        const rawGp = gamepads[gamepadIndex];
        if (!rawGp || !rawGp.connected) return 0;
        const gp = this._getMappedGamepad(rawGp) || rawGp;
        if (!gp || !gp.axes) return 0;
        const raw = gp.axes[axisIndex] || 0;
        const dz  = (this._gamepadDeadzone != null) ? this._gamepadDeadzone : 0.18;
        const mag  = Math.abs(raw);
        if (mag < dz) return 0;
        return (raw / mag) * ((mag - dz) / (1 - dz));
    },

    _hasGamepadInput(gamepad) {
        if (!gamepad || !gamepad.connected) return false;
        const gp = this._getMappedGamepad(gamepad) || gamepad;
        const dz = (this._gamepadDeadzone != null) ? this._gamepadDeadzone : 0.18;

        if (gp.mapping === 'standard') {
            const buttonPressed = Array.from(gp.buttons || []).some(b => b && (b.pressed || b.value > 0.15));
            const axisMoved = Array.from(gp.axes || []).slice(0, 4).some(a => Math.abs(a) > dz);
            return buttonPressed || axisMoved;
        }

        const buttonPressed = Array.from(gp.buttons || []).some(b => b && (b.pressed || b.value > 0.15));
        const axisMoved = Array.from(gp.axes || []).some(a => {
            if (a == null) return false;
            if (a < -0.8) return false;
            return Math.abs(a) > dz;
        });
        return buttonPressed || axisMoved;
    },

    _findGamepadWithInput() {
        if (!navigator.getGamepads) return null;
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (this._couchSplitActive &&
                this.seats().some(seat => seat.gamepadIndex === gamepad?.index)) {
                continue;
            }
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
        // Local co-op seats are keyboard/mouse and/or gamepads only — never touch.
        if (this._couchSplitActive && source === 'touch') return false;
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
        if (this._couchSplitActive) return false;
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
        this._rebuildTouchLists();
    },

    // Poll the Gamepad API and write its state into the existing touch joystick/button objects.
    _updateGamepad() {
        const activeGamepad = this._findGamepadWithInput();
        if (!this._couchSplitActive && activeGamepad && activeGamepad.index !== this._gamepadIndex) {
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
        const uiBlocking = typeof this._hooks.isUiBlockingGameplay === 'function'
            && this._hooks.isUiBlockingGameplay();

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
            if (!(typeof this._hooks.uiHandlesSystemButtons === 'function' && this._hooks.uiHandlesSystemButtons())) {
                const startNow = gp.buttons[STANDARD_PAD.START]?.pressed || false;
                if (startNow && !this._gamepadStartPrev) {
                    if (typeof this._hooks.onSystemStart === 'function') this._hooks.onSystemStart();
                }
                this._gamepadStartPrev = startNow;
                const selectNow = gp.buttons[STANDARD_PAD.SELECT]?.pressed || false;
                if (selectNow && !this._gamepadSelectPrev)       this.keys['tab'] = true;
                else if (!selectNow && this._gamepadSelectPrev)  this.keys['tab'] = false;
                this._gamepadSelectPrev = selectNow;
            }
            return;
        }

        // ---- Left stick → movement ----
        const leftStick = applyDeadzone(gp.axes[0] || 0, gp.axes[1] || 0);
        const dpadUp    = gp.buttons[STANDARD_PAD.DPAD_UP]?.pressed || false;
        const dpadDown  = gp.buttons[STANDARD_PAD.DPAD_DOWN]?.pressed || false;
        const dpadLeft  = gp.buttons[STANDARD_PAD.DPAD_LEFT]?.pressed || false;
        const dpadRight = gp.buttons[STANDARD_PAD.DPAD_RIGHT]?.pressed || false;

        const lootCycleActive = typeof this._hooks.isLootCycleActive === 'function'
            && this._hooks.isLootCycleActive(dpadLeft, dpadRight, dpadUp, dpadDown);

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

        // Layout (matches launchModal Controller guide):
        // RT primary, LT heavy, LB special, RB dodge, A interact, Y modifier,
        // Start pause, Select character sheet.
        const rightStick = applyDeadzone(gp.axes[2] || 0, gp.axes[3] || 0);
        const rt = gp.buttons[STANDARD_PAD.RT];
        const primaryDown = !!(rt && (rt.pressed || (rt.value ?? 0) > 0.15));
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

        const lt = gp.buttons[STANDARD_PAD.LT];
        const heavyDown = !!(lt && (lt.pressed || (lt.value ?? 0) > 0.15));
        syncButton(this.touchButtons.heavyAttack, heavyDown);
        syncAbilityJoystick(this.touchJoysticks.heavyAttack, rightStick.mag > 0.05 ? rightStick : leftStick, heavyDown);

        const specialDown = gp.buttons[STANDARD_PAD.LB]?.pressed || false;
        syncButton(this.touchButtons.specialAbility, specialDown);
        syncAbilityJoystick(this.touchJoysticks.specialAbility, rightStick.mag > 0.05 ? rightStick : leftStick, specialDown);

        const dodgeDown = gp.buttons[STANDARD_PAD.RB]?.pressed || false;
        const dodgeButton = this.touchButtons.dodge;
        const dodgeWasDown = !!(dodgeButton && dodgeButton.pressed);
        const dodgeStick = this.touchJoysticks.dodge;
        let dodgeReleaseAim = null;
        if (dodgeWasDown && !dodgeDown && dodgeStick) {
            const mag = typeof dodgeStick.getMagnitude === 'function'
                ? dodgeStick.getMagnitude()
                : (dodgeStick.magnitude || 0);
            if (mag > 0.1) {
                const dir = typeof dodgeStick.getDirection === 'function'
                    ? dodgeStick.getDirection()
                    : (dodgeStick.direction || {
                        x: Math.cos(dodgeStick.angle || 0),
                        y: Math.sin(dodgeStick.angle || 0)
                    });
                dodgeReleaseAim = {
                    direction: { x: dir.x, y: dir.y },
                    magnitude: mag,
                    angle: dodgeStick.angle || Math.atan2(dir.y, dir.x)
                };
            }
        }
        syncButton(dodgeButton, dodgeDown);
        syncAbilityJoystick(dodgeStick, leftStick, dodgeDown);
        if (dodgeReleaseAim && dodgeButton) {
            dodgeButton.finalJoystickState = dodgeReleaseAim;
        }

        if (!(typeof this._hooks.uiHandlesSystemButtons === 'function' && this._hooks.uiHandlesSystemButtons())) {
            const startNow = gp.buttons[STANDARD_PAD.START]?.pressed || false;
            if (startNow && !this._gamepadStartPrev) {
                if (typeof this._hooks.onSystemStart === 'function') this._hooks.onSystemStart();
            }
            this._gamepadStartPrev = startNow;

            const selectNow = gp.buttons[STANDARD_PAD.SELECT]?.pressed || false;
            if (selectNow && !this._gamepadSelectPrev)       this.keys['tab'] = true;
            else if (!selectNow && this._gamepadSelectPrev)  this.keys['tab'] = false;
            this._gamepadSelectPrev = selectNow;
        }

        // A/Cross → interact (G); Y/Triangle → room modifier (M)
        this.keys['g'] = gp.buttons[STANDARD_PAD.A]?.pressed || false;
        this.keys['m'] = gp.buttons[STANDARD_PAD.Y]?.pressed || false;
    },

    // ------------------------------------------------------------------ touch handlers

    handleTouchStart(e, canvas) {
        // Local co-op never accepts touch as a seat input.
        if (this._couchSplitActive) return;
        if (!this.isTouchMode()) return;
        if (!this.isGamepadMode()) {
            this._activateNonGamepadInput('touch', canvas);
        } else if (!this._activateNonGamepadInput('touch', canvas)) {
            return;
        }

        if (e.defaultPrevented) return;

        void canvas.offsetWidth;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            console.warn('[TOUCH] Canvas rect is zero, skipping touch');
            return;
        }

        const size = this._getLogicalSize(canvas);
        const mapScratch = { x: 0, y: 0 };

        for (let idx = 0; idx < e.touches.length; idx++) {
            const touch = e.touches[idx];
            const touchId = touch.identifier;

            this._mapPointer(touch.clientX, touch.clientY, canvas, mapScratch);
            const x = mapScratch.x;
            const y = mapScratch.y;

            if (!this.activeTouches[touchId]) {
                this.activeTouches[touchId] = { x: 0, y: 0 };
                this.activeTouchCount++;
            }
            this.activeTouches[touchId].x = x;
            this.activeTouches[touchId].y = y;
            this.touchActive = true;

            if (typeof this._hooks.onCharacterSheetTouchStart === 'function') {
                const firstClientY = e.touches.length > 0 ? e.touches[0].clientY : 0;
                if (this._hooks.onCharacterSheetTouchStart(x, y, firstClientY)) continue;
            }

            if (typeof this._hooks.onInteractionButtonClick === 'function' && this._hooks.onInteractionButtonClick(x, y)) continue;

            if (this.usesDomTouchControls()) continue;

            const screenMiddle = size.width / 2;
            const isLeftSide   = x < screenMiddle;

            if (isLeftSide) {
                if (this.touchJoysticks.movement && !this.touchJoysticks.movement.active) {
                    if (this.touchJoysticks.movement.startTouch(touchId, x, y)) continue;
                }
            } else {
                const buttonOrder = ['heavyAttack', 'dodge', 'specialAbility'];
                let buttonMatched = false;
                for (let b = 0; b < buttonOrder.length; b++) {
                    const buttonName = buttonOrder[b];
                    const button = this.touchButtons[buttonName];
                    if (button && !button.active && button.contains(x, y)) {
                        buttonMatched = true;
                        if (button.startTouch(touchId, x, y)) break;
                    }
                }

                if (!buttonMatched && this.touchJoysticks.basicAttack && !this.touchJoysticks.basicAttack.active) {
                    const joystick = this.touchJoysticks.basicAttack;
                    const dx = x - joystick.centerX, dy = y - joystick.centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const restrictedHitRadius = joystick.radius * 1.2;
                    if (distance <= restrictedHitRadius) {
                        let tooCloseToButton = false;
                        for (let b = 0; b < this.touchButtonList.length; b++) {
                            const button = this.touchButtonList[b];
                            if (button && button.contains(x, y)) { tooCloseToButton = true; break; }
                            if (button) {
                                const bcx = button.x + button.width / 2, bcy = button.y + button.height / 2;
                                const diffX = x - bcx;
                                const diffY = y - bcy;
                                if (Math.sqrt(diffX * diffX + diffY * diffY) < Math.max(button.width, button.height) / 2 + 10) {
                                    tooCloseToButton = true; break;
                                }
                            }
                        }
                        if (!tooCloseToButton && joystick.startTouch(touchId, x, y, restrictedHitRadius)) continue;
                    }
                }
            }

            // Fallback
            if (isLeftSide) {
                if (this.touchJoysticks.movement && !this.touchJoysticks.movement.active) {
                    if (this.touchJoysticks.movement.startTouch(touchId, x, y)) continue;
                }
            } else {
                if (this.touchJoysticks.basicAttack && !this.touchJoysticks.basicAttack.active) {
                    const joystick = this.touchJoysticks.basicAttack;
                    const dx = x - joystick.centerX, dy = y - joystick.centerY;
                    const fallbackHitRadius = joystick.radius * 1.15;
                    if (Math.sqrt(dx * dx + dy * dy) <= fallbackHitRadius && joystick.startTouch(touchId, x, y, fallbackHitRadius)) continue;
                }
            }

            if (!isLeftSide) {
                this._recordInputEvent('mobileTouchMiss', { side: 'right', x: Math.round(x), y: Math.round(y) });
            }
        }
    },

    handleTouchMove(e, canvas) {
        if (this._couchSplitActive) return;
        if (!this.isTouchMode()) return;

        if (e.touches.length > 0 && typeof this._hooks.onCharacterSheetTouchMove === 'function') {
            const touch = e.touches[0];
            const gc = this._mapPointer(touch.clientX, touch.clientY, canvas);
            if (this._hooks.onCharacterSheetTouchMove(gc.x, gc.y, touch.clientY)) {
                e.preventDefault();
                return;
            }
        }

        if (this.usesDomTouchControls()) return;

        void canvas.offsetWidth;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const mapScratch = { x: 0, y: 0 };

        for (let idx = 0; idx < e.touches.length; idx++) {
            const touch = e.touches[idx];
            const touchId = touch.identifier;

            this._mapPointer(touch.clientX, touch.clientY, canvas, mapScratch);
            const x = mapScratch.x;
            const y = mapScratch.y;

            if (!this.activeTouches[touchId]) continue;
            this.activeTouches[touchId].x = x;
            this.activeTouches[touchId].y = y;

            for (let j = 0; j < this.touchJoystickList.length; j++) {
                const joystick = this.touchJoystickList[j];
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
                if (dx * dx + dy * dy > 100) {
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
                if (dx * dx + dy * dy > 100) {
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
                if (dx * dx + dy * dy > 100) {
                    if (this.touchJoysticks.specialAbility && !this.touchJoysticks.specialAbility.active) {
                        this.touchJoysticks.specialAbility.startTouch(touchId, x, y);
                    }
                } else if (this.touchJoysticks.specialAbility && this.touchJoysticks.specialAbility.active &&
                    this.touchJoysticks.specialAbility.touchId === touchId) {
                    this.touchJoysticks.specialAbility.updateTouch(touchId, x, y);
                }
            }
        }
    },

    handleTouchEnd(e) {
        if (this._couchSplitActive) return;
        if (!this.isTouchMode()) return;

        const touches = e.changedTouches;
        if (this.usesDomTouchControls()) {
            for (let idx = 0; idx < touches.length; idx++) {
                const touchId = touches[idx].identifier;
                if (this.activeTouches[touchId]) {
                    delete this.activeTouches[touchId];
                    this.activeTouchCount = Math.max(0, this.activeTouchCount - 1);
                }
            }
            if (this.activeTouchCount === 0) this.touchActive = false;
            return;
        }

        const abilityInputType = this._hooks.getAbilityInputType;

        const captureJoystickState = (joystick, button) => {
            if (!joystick || !button) return;
            button.finalJoystickState = {
                direction: joystick.getDirection(),
                magnitude: joystick.getMagnitude(),
                angle: joystick.angle
            };
        };

        for (let idx = 0; idx < touches.length; idx++) {
            const touch = touches[idx];
            const touchId = touch.identifier;
            const classType = typeof this._hooks.getClassType === 'function'
                ? this._hooks.getClassType()
                : null;

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

            for (let j = 0; j < this.touchJoystickList.length; j++) {
                const joystick = this.touchJoystickList[j];
                if (joystick) joystick.endTouch(touchId);
            }
            for (let b = 0; b < this.touchButtonList.length; b++) {
                const button = this.touchButtonList[b];
                if (button) button.endTouch(touchId);
            }
            if (this.activeTouches[touchId]) {
                delete this.activeTouches[touchId];
                this.activeTouchCount = Math.max(0, this.activeTouchCount - 1);
            }
        }

        if (this.activeTouchCount === 0) this.touchActive = false;
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

        if (typeof this._hooks.loadControlMode === 'function') {
            this.controlMode = this._hooks.loadControlMode() || 'auto';
        }

        this.applyControlMode(this.controlMode, canvas);
        this._installLifecycleHandlers(canvas);

        if (Engine.SDLGameControllerDB && !Engine.SDLGameControllerDB.isLoaded) {
            this.initGameControllerDB();
        }

        if (typeof window !== 'undefined') {
            const recheckDeviceProfile = () => {
                if (Engine.System && Engine.System.invalidateCache) {
                    Engine.System.invalidateCache();
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
            if (e.button === 0) {
                if (this.isMobileUiMode() || this.isTouchMode()) {
                    const point = this._mapPointer(e.clientX, e.clientY, canvas);
                    if (typeof this._hooks.onInteractionButtonClick === 'function' && this._hooks.onInteractionButtonClick(point.x, point.y)) {
                        e.preventDefault();
                        return;
                    }
                }
                this.mouseLeft  = true;
            }
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
            if (!this._couchSplitActive) this._activateGamepad(e.gamepad, canvas);
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
        this._sampleDesktopAbilityEdges();
        this.updateSeats(deltaTime);

        if (!this._couchSplitActive && (this._gamepadIndex === null || !this.isGamepadMode())) {
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
            for (let i = 0; i < this.touchJoystickList.length; i++) {
                const joystick = this.touchJoystickList[i];
                if (joystick) joystick.update(deltaTime);
            }
        }

        for (let i = 0; i < this.touchButtonList.length; i++) {
            const button = this.touchButtonList[i];
            if (button && !this.isGamepadMode()) button.update(deltaTime);
        }

        if ((this._domRefreshCooldown || 0) <= 0) {
            if (typeof this._hooks.refreshDomTouchControls === 'function') {
                this._domRefreshCooldown = 0.25;
                this._hooks.refreshDomTouchControls();
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
        return this._getKeyboardMovementInput();
    },

    _getKeyboardMovementInput() {
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

    _desktopAbilitySlots: ['basicAttack', 'heavyAttack', 'specialAbility', 'dodge'],
    _desktopAbilityPrev: {},
    _desktopAbilityJust: {},
    _desktopAbilityJustReleased: {},

    /** Raw desktop held-state for a named ability slot. */
    _desktopAbilityDown(ability) {
        if (!this._hasWindowFocus()) return false;
        if (ability === 'basicAttack')    return this.mouseLeft;
        if (ability === 'heavyAttack')    return this.mouseRight;
        if (ability === 'specialAbility') return this.isKeyDown(' ');
        if (ability === 'dodge')          return this.isKeyDown('shift');
        return false;
    },

    /**
     * Latch desktop ability rising/falling edges once per frame so
     * isAbilityJustPressed/Released() report one-shot edges instead of
     * mirroring held state. Runs from update() in every control mode.
     */
    _sampleDesktopAbilityEdges() {
        for (const slot of this._desktopAbilitySlots) {
            const down = this._desktopAbilityDown(slot);
            const was = !!this._desktopAbilityPrev[slot];
            this._desktopAbilityJust[slot] = down && !was;
            this._desktopAbilityJustReleased[slot] = !down && was;
            this._desktopAbilityPrev[slot] = down;
        }
    },

    getAbilityInputType(classType, ability) {
        if (typeof this._hooks.getAbilityInputType === 'function') {
            return this._hooks.getAbilityInputType(classType, ability);
        }
        const gi = (typeof window !== 'undefined' && window['Game' + 'Input']) || (typeof globalThis !== 'undefined' && globalThis['Game' + 'Input']);
        if (gi && typeof gi.getAbilityInputType === 'function') {
            return gi.getAbilityInputType(classType, ability);
        }
        return 'button';
    },

    /**
     * Check if a named ability slot is currently pressed.
     * Ability names are abstract slot names ('basicAttack', 'heavyAttack', 'specialAbility', 'dodge').
     * @param {'basicAttack'|'heavyAttack'|'specialAbility'|'dodge'} ability Abstract slot name
     * @returns {boolean}
     */
    isAbilityPressed(ability) {
        if (this.isTouchMode()) {
            if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                return this.touchJoysticks.basicAttack.active && this.touchJoysticks.basicAttack.getMagnitude() > 0.1;
            }
            return this.touchButtons[ability] ? this.touchButtons[ability].pressed : false;
        }
        return this._desktopAbilityDown(ability);
    },

    /** Check if a named ability slot was just pressed this frame (edge detect). */
    isAbilityJustPressed(ability) {
        if (this.isTouchMode()) {
            if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                return this.touchJoysticks.basicAttack.active && this.touchJoysticks.basicAttack.getMagnitude() > 0.1;
            }
            return this.touchButtons[ability] ? this.touchButtons[ability].justPressed : false;
        }
        return !!this._desktopAbilityJust[ability];
    },

    /** Check if a named ability slot was just released this frame (edge detect). */
    isAbilityJustReleased(ability) {
        if (this.isTouchMode()) {
            return this.touchButtons[ability] ? !!this.touchButtons[ability].justReleased : false;
        }
        return !!this._desktopAbilityJustReleased[ability];
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
        if (typeof this._hooks.isDomTouchControlsActive === 'function') return;

        // Delegate application-specific rendering through the configured hook.
        if (typeof this._hooks.renderTouchControls === 'function') {
            this._hooks.renderTouchControls(ctx, this);
            return;
        }

        // Generic fallback: draw all joystick/button primitives with no class-specific filtering.
        const tutorialHighlight = typeof this._hooks.getTutorialHighlightControl === 'function'
            ? this._hooks.getTutorialHighlightControl() : null;
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
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Input: Engine.Input };
}

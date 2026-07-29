// DOM mobile gameplay controls — canvas-rect synced, pointer-capture bridge into Input state.
(function () {
    'use strict';

    const DRAG_TO_JOYSTICK_PX = 10;
    const CONTROL_IDS = ['movement', 'basicAttack', 'heavyAttack', 'specialAbility', 'dodge'];

    const MobileControlsDOM = {
        layer: null,
        stage: null,
        nodes: {},
        layout: null,
        _canvasRect: null,
        _scaleX: 1,
        _scaleY: 1,
        _raf: 0,
        _bound: false,
        _editorMode: false,
        _pointers: new Map(), // pointerId -> { controlId, startX, startY, joystickArmed }
        _controlPointers: new Map(), // controlId -> pointerId; one owner per control

        init() {
            if (this.layer || typeof document === 'undefined') return;
            const root = (window.UIRoot && UIRoot.ensure) ? UIRoot.ensure() : document.getElementById('ui-root');
            if (!root) return;

            this.layer = document.createElement('div');
            this.layer.className = 'mobile-controls-layer';
            this.layer.id = 'mobile-controls-layer';
            this.layer.hidden = true;
            this.layer.setAttribute('aria-hidden', 'true');

            this.stage = document.createElement('div');
            this.stage.className = 'mobile-controls';
            this.layer.appendChild(this.stage);

            for (const id of CONTROL_IDS) {
                this.nodes[id] = this._createControlNode(id);
                this.stage.appendChild(this.nodes[id].el);
            }

            this.interactEl = document.createElement('div');
            this.interactEl.className = 'mc-interact';
            this.interactEl.hidden = true;
            this.interactEl.setAttribute('role', 'button');
            this.interactEl.setAttribute('aria-label', 'interact');
            this.stage.appendChild(this.interactEl);

            const triggerInteract = (e) => {
                if (e.button != null && e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                this.interactEl.classList.add('mc-pressed');
                if (typeof performCurrentInteraction === 'function') {
                    performCurrentInteraction();
                } else if (typeof window.performMobileInteraction === 'function') {
                    window.performMobileInteraction();
                }
            };

            this.interactEl.addEventListener('pointerdown', triggerInteract);
            this.interactEl.addEventListener('touchstart', triggerInteract, { passive: false });
            const releaseInteract = () => this.interactEl.classList.remove('mc-pressed');
            this.interactEl.addEventListener('pointerup', releaseInteract);
            this.interactEl.addEventListener('pointercancel', releaseInteract);
            this.interactEl.addEventListener('touchend', releaseInteract);

            root.appendChild(this.layer);
            this._bindLifecycle();
            this._startLoop();
        },

        _createControlNode(id) {
            const el = document.createElement('div');
            el.className = 'mc-control';
            el.dataset.controlId = id;
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', id);

            const face = document.createElement('div');
            face.className = (id === 'movement' || id === 'basicAttack') ? 'mc-joystick' : 'mc-button';
            if (id === 'basicAttack') face.classList.add('mc-primary');

            const knob = document.createElement('div');
            knob.className = 'mc-knob';
            if (face.classList.contains('mc-joystick')) {
                face.appendChild(knob);
                const ray = document.createElement('div');
                ray.className = 'mc-aim-ray';
                face.appendChild(ray);
            }

            const label = document.createElement('div');
            label.className = 'mc-label';
            face.appendChild(label);

            const cooldown = document.createElement('div');
            cooldown.className = 'mc-cooldown';
            cooldown.hidden = true;
            face.appendChild(cooldown);

            const cdText = document.createElement('div');
            cdText.className = 'mc-cd-text';
            cdText.hidden = true;
            el.appendChild(cdText);

            const badge = document.createElement('div');
            badge.className = 'mc-charge-badge';
            badge.hidden = true;
            el.appendChild(badge);

            el.appendChild(face);

            el.addEventListener('pointerdown', (e) => this._onPointerDown(e, id));
            el.addEventListener('pointermove', (e) => this._onPointerMove(e, id));
            el.addEventListener('pointerup', (e) => this._onPointerUp(e, id));
            el.addEventListener('pointercancel', (e) => this._onPointerUp(e, id));
            el.addEventListener('lostpointercapture', (e) => this._onPointerUp(e, id, true));

            return { el, face, knob, label, cooldown, cdText, badge, ray: face.querySelector('.mc-aim-ray') };
        },

        _bindLifecycle() {
            if (this._bound) return;
            this._bound = true;
            window.addEventListener('resize', () => this.refresh());
            window.addEventListener('orientationchange', () => {
                setTimeout(() => this.refresh(), 100);
            });
            window.addEventListener('controlmodechange', () => this.refresh());
            document.addEventListener('fullscreenchange', () => {
                setTimeout(() => this.refresh(), 50);
            });
            const resetPointers = () => this._resetPointers();
            window.addEventListener('blur', resetPointers);
            window.addEventListener('pagehide', resetPointers);
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) resetPointers();
            });
        },

        _startLoop() {
            const tick = () => {
                this._raf = requestAnimationFrame(tick);
                this._updateFrame();
            };
            this._raf = requestAnimationFrame(tick);
        },

        shouldShow() {
            // Local co-op never uses touch seats — keep on-screen sticks hidden.
            if (typeof Game !== 'undefined' && Game.localSplitEnabled) return false;
            if (Engine.Input.isCouchSplitActive && Engine.Input.isCouchSplitActive()) return false;
            if (!Engine.Input.isMobileUiMode || !Engine.Input.isMobileUiMode()) return false;
            if (Engine.Input.isGamepadMode && Engine.Input.isGamepadMode()) return false;
            if (this._editorMode) return true;
            if (typeof Game === 'undefined') return false;
            if (Game.state === 'SESSION') return false;
            if (typeof GameModeTakeover !== 'undefined' && GameModeTakeover.isSessionState
                && GameModeTakeover.isSessionState(Game)) {
                return false;
            }
            // Hide under blocking menus / title attract when not in gameplay-ish states
            if (Game.state === 'TITLE' && !Game.nexusActive) return false;
            if (typeof CharacterSheet !== 'undefined' && CharacterSheet.isOpen) return false;
            return true;
        },

        refresh() {
            this.init();
            if (!this.layer) return;

            const show = this.shouldShow();
            this.layer.hidden = !show;
            this.layer.setAttribute('aria-hidden', show ? 'false' : 'true');
            if (!show) return;

            this._syncCanvasRect();
            this._applyLayout();
            this._updateClassVisibility();
        },

        setEditorMode(on) {
            if (on) this._resetPointers();
            this._editorMode = !!on;
            if (this.layer) {
                // Lift above pause/modals while editing so controls remain draggable
                this.layer.style.zIndex = this._editorMode ? '10045' : '';
            }
            this.refresh();
            for (const id of CONTROL_IDS) {
                const node = this.nodes[id];
                if (!node) continue;
                node.el.classList.toggle('mc-editing', this._editorMode);
            }
        },

        getControlScreenRect(controlId) {
            const node = this.nodes[controlId];
            if (!node || !node.el) return null;
            return node.el.getBoundingClientRect();
        },

        _syncCanvasRect() {
            const canvas = (typeof Game !== 'undefined' && Game.canvas)
                ? Game.canvas
                : document.getElementById('gameCanvas');
            if (!canvas || !this.stage) return;

            const rect = canvas.getBoundingClientRect();
            this._canvasRect = rect;
            const logicalW = (typeof Game !== 'undefined' && Game.config) ? Game.config.width : rect.width;
            const logicalH = (typeof Game !== 'undefined' && Game.config) ? Game.config.height : rect.height;
            this._scaleX = rect.width > 0 ? rect.width / logicalW : 1;
            this._scaleY = rect.height > 0 ? rect.height / logicalH : 1;

            this.stage.style.left = `${rect.left}px`;
            this.stage.style.top = `${rect.top}px`;
            this.stage.style.width = `${rect.width}px`;
            this.stage.style.height = `${rect.height}px`;
        },

        _logicalSize() {
            const width = (typeof Game !== 'undefined' && Game.config) ? Game.config.width : 1280;
            const height = (typeof Game !== 'undefined' && Game.config) ? Game.config.height : 720;
            return { width, height };
        },

        _buildLayoutOptions() {
            const { width, height } = this._logicalSize();
            const canvas = (typeof Game !== 'undefined' && Game.canvas)
                ? Game.canvas
                : document.getElementById('gameCanvas');
            let displayScaleX = 1;
            let displayScaleY = 1;
            let safeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
            if (canvas && canvas.getBoundingClientRect) {
                const displayRect = canvas.getBoundingClientRect();
                displayScaleX = displayRect.width > 0 ? width / displayRect.width : 1;
                displayScaleY = displayRect.height > 0 ? height / displayRect.height : 1;
            }
            if ((typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.getSafeAreaInsets) {
                safeInsets = Engine.Input.getSafeAreaInsets();
            }
            const isMobile = (typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.isMobileUiMode
                ? Engine.Input.isMobileUiMode()
                : true;
            const playerClass = this._playerClass();
            return { width, height, safeInsets, displayScaleX, displayScaleY, isMobile, playerClass };
        },

        _applyLayout() {
            if (typeof MobileControlLayout === 'undefined') return;
            // Prefer editor draft while open so refresh doesn't wipe in-progress edits
            if (typeof MobileControlEditor !== 'undefined' && MobileControlEditor.isOpen &&
                MobileControlEditor.isOpen() && MobileControlEditor.draft) {
                this.layout = MobileControlEditor.draft;
            } else {
                const opts = this._buildLayoutOptions();
                this.layout = MobileControlLayout.getEffectiveLayout(opts.width, opts.height, opts);
            }

            for (const id of CONTROL_IDS) {
                const cfg = this.layout.controls[id];
                const node = this.nodes[id];
                if (!cfg || !node) continue;

                const left = cfg.x * this._scaleX;
                const top = cfg.y * this._scaleY;
                const size = Math.max(cfg.w, cfg.h) * ((this._scaleX + this._scaleY) * 0.5);

                node.el.style.left = `${left}px`;
                node.el.style.top = `${top}px`;
                node.el.style.width = `${size}px`;
                node.el.style.height = `${size}px`;
                node.el.style.opacity = cfg.opacity != null ? cfg.opacity : 1;
                node.el.hidden = cfg.visible === false;
                node.label.textContent = (MobileControlLayout.SHORT_LABELS && MobileControlLayout.SHORT_LABELS[id])
                    || cfg.label
                    || '';

                // Keep Input state object centers in logical space for any leftover consumers
                this._syncInputGeometry(id, cfg);
            }
        },

        _syncInputGeometry(id, cfg) {
            if ((typeof Engine === 'undefined' || !Engine.Input)) return;
            if (id === 'movement' || id === 'basicAttack') {
                const joy = Engine.Input.touchJoysticks && Engine.Input.touchJoysticks[id];
                if (joy) {
                    joy.centerX = cfg.x;
                    joy.centerY = cfg.y;
                    joy.radius = cfg.radius;
                    joy.deadZoneRadius = cfg.deadZone;
                }
            } else {
                const btn = Engine.Input.touchButtons && Engine.Input.touchButtons[id];
                if (btn) {
                    btn.x = cfg.x - cfg.w / 2;
                    btn.y = cfg.y - cfg.h / 2;
                    btn.width = cfg.w;
                    btn.height = cfg.h;
                    btn.label = cfg.label || btn.label;
                }
                const joy = Engine.Input.touchJoysticks && Engine.Input.touchJoysticks[id];
                if (joy) {
                    joy.centerX = cfg.x;
                    joy.centerY = cfg.y;
                    joy.radius = cfg.radius;
                    joy.deadZoneRadius = cfg.deadZone;
                }
            }
        },

        _playerClass() {
            return (typeof Game !== 'undefined' && Game.player && Game.player.playerClass)
                ? Game.player.playerClass
                : 'square';
        },

        _resolvedType(id) {
            const cfg = this.layout && this.layout.controls[id];
            if (typeof MobileControlLayout !== 'undefined' && MobileControlLayout.resolveControlType) {
                return MobileControlLayout.resolveControlType(id, this._playerClass(), cfg, this.layout);
            }
            return (cfg && cfg.type) || 'button';
        },

        _updateClassVisibility() {
            const playerClass = this._playerClass();
            for (const id of CONTROL_IDS) {
                const node = this.nodes[id];
                if (!node) continue;
                let hide = false;
                // Rogue uses dodge joystick UI (still show dodge control)
                // Special joystick-only visuals: keep button element, mark directional
                const type = this._resolvedType(id);
                const isJoystickFace = id === 'movement' || id === 'basicAttack' ||
                    type === 'joystick' || type === 'joystick-press-release' || type === 'joystick-continuous';

                // Face type: ability controls start as buttons; when dragged they behave as joysticks
                if (id === 'movement' || id === 'basicAttack') {
                    node.face.className = 'mc-joystick' + (id === 'basicAttack' ? ' mc-primary' : '');
                    if (!node.face.querySelector('.mc-knob')) {
                        const knob = document.createElement('div');
                        knob.className = 'mc-knob';
                        node.face.insertBefore(knob, node.face.firstChild);
                        node.knob = knob;
                    }
                } else {
                    node.face.classList.add('mc-button');
                    node.face.classList.remove('mc-joystick', 'mc-primary');
                    const directional =
                        type === 'joystick-press-release' || type === 'joystick-continuous';
                    node.face.classList.toggle('mc-directional', directional);
                }

                if (this.layout && this.layout.controls[id] && this.layout.controls[id].visible === false) {
                    hide = true;
                }
                node.el.hidden = hide;
            }
        },

        _updateInteractNode() {
            if (!this.interactEl) return;
            if (typeof updateInteractionState === 'function') {
                updateInteractionState();
            }
            const activeInteraction = (typeof currentInteraction !== 'undefined')
                ? currentInteraction
                : ((typeof getMobileInteractionState === 'function' && getMobileInteractionState()) ? getMobileInteractionState().raw : null);

            if (activeInteraction) {
                const disabledReason = typeof getInteractionDisabledReason === 'function' ? getInteractionDisabledReason(activeInteraction) : null;
                if (disabledReason) {
                    this.interactEl.hidden = true;
                    return;
                }
                const label = typeof getInteractionLabel === 'function' ? getInteractionLabel(activeInteraction) : 'INTERACT';
                this.interactEl.textContent = label;
                this.interactEl.hidden = false;
            } else {
                this.interactEl.hidden = true;
            }
        },

        _updateFrame() {
            if (!this.layer || this.layer.hidden) return;
            // Keep stage locked to canvas if it moved (address bar show/hide)
            this._syncCanvasRect();
            this._updateInteractNode();

            const player = (typeof Game !== 'undefined') ? Game.player : null;
            const cooldowns = ((typeof Engine !== 'undefined' && Engine.Input) && GameInput.getMobileCooldownSnapshot)
                ? GameInput.getMobileCooldownSnapshot(player)
                : null;

            const highlight = (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.getHighlightControl)
                ? Room0Tutorial.getHighlightControl()
                : null;

            for (const id of CONTROL_IDS) {
                const node = this.nodes[id];
                if (!node || node.el.hidden) continue;
                node.el.classList.toggle('mc-tutorial-glow', highlight === id);

                let snap = { cooldown: 0, maxCooldown: 0, charges: null };
                if (cooldowns) {
                    if (id === 'basicAttack') snap = cooldowns.attack;
                    if (id === 'heavyAttack') snap = cooldowns.heavy;
                    if (id === 'specialAbility') snap = cooldowns.special;
                    if (id === 'dodge') snap = cooldowns.dodge;
                }

                const cd = Math.max(0, snap.cooldown || 0);
                const max = Math.max(0.0001, snap.maxCooldown || 0);
                const pct = max > 0 ? Math.min(1, cd / max) : 0;
                if (pct > 0 && id !== 'movement') {
                    node.cooldown.hidden = false;
                    node.cooldown.style.setProperty('--mc-cd', `${pct * 100}%`);
                    node.cdText.hidden = false;
                    node.cdText.textContent = `${Math.ceil(cd)}s`;
                } else {
                    node.cooldown.hidden = true;
                    node.cdText.hidden = true;
                }

                if (snap.charges != null && snap.maxCharges > 1) {
                    node.badge.hidden = false;
                    node.badge.textContent = String(snap.charges);
                } else {
                    node.badge.hidden = true;
                }

                // Sync knob from Input joystick state (gamepad or pointer)
                const joy = (typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.touchJoysticks
                    ? Engine.Input.touchJoysticks[id]
                    : null;
                let aiming = false;
                if (node.knob && joy) {
                    const mag = joy.getMagnitude ? joy.getMagnitude() : (joy.magnitude || 0);
                    const angle = joy.getAngle ? joy.getAngle() : (joy.angle || 0);
                    const active = !!joy.active && mag > 0.02;
                    aiming = active;
                    node.face.classList.toggle('mc-active', active);
                    const reach = 28; // % of control radius visually
                    const kx = Math.cos(angle) * mag * reach;
                    const ky = Math.sin(angle) * mag * reach;
                    node.knob.style.transform = `translate(calc(-50% + ${kx}%), calc(-50% + ${ky}%))`;
                    if (node.ray) {
                        node.ray.style.transform = `translate(-50%, -100%) rotate(${angle + Math.PI / 2}rad)`;
                        node.ray.style.opacity = active ? '1' : '0';
                    }
                }

                const btn = (typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.touchButtons
                    ? Engine.Input.touchButtons[id]
                    : null;
                if (btn && node.face.classList.contains('mc-button')) {
                    node.face.classList.toggle('mc-pressed', !!btn.pressed);
                    if (btn.pressed && this._resolvedType(id) !== 'button') {
                        aiming = true;
                    }
                }
                node.el.classList.toggle('mc-aiming', aiming && id !== 'movement');
            }
        },

        // --- Pointer bridge ---

        _onPointerDown(e, controlId) {
            if (this._editorMode) return; // editor owns pointers
            if (e.button != null && e.button !== 0) return;
            // Ignore a second finger on the same control. Without explicit ownership,
            // it can overwrite touchId and release the first finger's active state.
            if (this._controlPointers.has(controlId)) return;
            e.preventDefault();
            e.stopPropagation();

            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch (_) { /* ignore */ }

            this._pointers.set(e.pointerId, {
                controlId,
                startX: e.clientX,
                startY: e.clientY,
                joystickArmed: controlId === 'movement' || controlId === 'basicAttack'
            });
            this._controlPointers.set(controlId, e.pointerId);

            if (controlId === 'movement' || controlId === 'basicAttack') {
                this._setJoystickFromEvent(controlId, e, true);
            } else {
                this._pressButton(controlId, true);
                const type = this._resolvedType(controlId);
                if (type === 'joystick-continuous') {
                    this._setJoystickFromEvent(controlId, e, true);
                    const state = this._pointers.get(e.pointerId);
                    if (state) state.joystickArmed = true;
                }
            }
        },

        _onPointerMove(e, controlId) {
            if (this._editorMode) return;
            const state = this._pointers.get(e.pointerId);
            if (!state || state.controlId !== controlId) return;
            e.preventDefault();

            if (controlId === 'movement' || controlId === 'basicAttack') {
                this._setJoystickFromEvent(controlId, e, true);
                return;
            }

            const dx = e.clientX - state.startX;
            const dy = e.clientY - state.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const type = this._resolvedType(controlId);

            if (!state.joystickArmed && dist > DRAG_TO_JOYSTICK_PX &&
                (type === 'joystick-press-release' || type === 'joystick-continuous' || type === 'joystick')) {
                state.joystickArmed = true;
            }

            if (state.joystickArmed || type === 'joystick-continuous') {
                this._setJoystickFromEvent(controlId, e, true);
            }
        },

        _onPointerUp(e, controlId, fromLost) {
            if (this._editorMode) return;
            const state = this._pointers.get(e.pointerId);
            if (!state || state.controlId !== controlId) return;
            if (!fromLost) e.preventDefault();

            if (controlId === 'movement' || controlId === 'basicAttack') {
                this._clearJoystick(controlId);
            } else {
                // Capture final joystick aim before clearing
                const joy = Engine.Input.touchJoysticks && Engine.Input.touchJoysticks[controlId];
                const btn = Engine.Input.touchButtons && Engine.Input.touchButtons[controlId];
                if (btn && joy && (state.joystickArmed || (joy.active && joy.getMagnitude() > 0.1))) {
                    btn.finalJoystickState = {
                        direction: joy.getDirection(),
                        magnitude: joy.getMagnitude(),
                        angle: joy.angle
                    };
                }
                this._clearJoystick(controlId);
                this._pressButton(controlId, false);
            }

            this._pointers.delete(e.pointerId);
            if (this._controlPointers.get(controlId) === e.pointerId) {
                this._controlPointers.delete(controlId);
            }
            try {
                if (e.currentTarget && e.currentTarget.releasePointerCapture) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }
            } catch (_) { /* ignore */ }
        },

        _pressButton(controlId, isDown) {
            const btn = Engine.Input.touchButtons && Engine.Input.touchButtons[controlId];
            if (!btn) return;
            const was = !!btn.pressed;
            btn.pressed = isDown;
            btn.active = isDown;
            btn.justPressed = isDown && !was;
            btn.justReleased = !isDown && was;
            if (isDown && typeof navigator !== 'undefined' && navigator.vibrate) {
                try { navigator.vibrate(8); } catch (_) { /* ignore */ }
            }
        },

        _setJoystickFromEvent(controlId, e, active) {
            const node = this.nodes[controlId];
            const joy = Engine.Input.touchJoysticks && Engine.Input.touchJoysticks[controlId];
            if (!node || !joy) return;

            const rect = node.el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = e.clientX - cx;
            const dy = e.clientY - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxR = Math.max(8, Math.min(rect.width, rect.height) / 2);
            const dead = Math.max(4, maxR * ((joy.deadZoneRadius || 14) / Math.max(1, joy.radius || 40)));

            let mag = 0;
            if (dist > dead) {
                mag = Math.min(1, (dist - dead) / Math.max(1, maxR - dead));
            }
            const angle = Math.atan2(dy, dx);

            joy.active = !!active && mag > 0.01;
            joy.magnitude = joy.active ? mag : (active ? 0 : 0);
            joy.angle = angle;
            // Keep currentX/Y roughly in sync for any code reading them
            joy.currentX = joy.centerX + Math.cos(angle) * mag * (joy.radius || 40);
            joy.currentY = joy.centerY + Math.sin(angle) * mag * (joy.radius || 40);
            joy.touchId = e.pointerId;

            if ((typeof Engine !== 'undefined' && Engine.Input)) {
                Engine.Input.lastAimAngle = angle;
            }
        },

        _clearJoystick(controlId) {
            const joy = Engine.Input.touchJoysticks && Engine.Input.touchJoysticks[controlId];
            if (!joy) return;
            joy.active = false;
            joy.magnitude = 0;
            joy.touchId = null;
            joy.currentX = joy.centerX;
            joy.currentY = joy.centerY;
        },

        _resetPointers() {
            if ((typeof Engine !== 'undefined' && Engine.Input)) {
                for (const id of CONTROL_IDS) {
                    this._clearJoystick(id);
                    if (id !== 'movement' && id !== 'basicAttack') {
                        const button = Engine.Input.touchButtons && Engine.Input.touchButtons[id];
                        if (button) {
                            button.pressed = false;
                            button.active = false;
                            button.justPressed = false;
                            button.justReleased = false;
                            button.finalJoystickState = null;
                        }
                    }
                }
            }
            this._pointers.clear();
            this._controlPointers.clear();
        },

        /** Called by Input when touch surface is (re)built. */
        onInputSurfaceReady() {
            this.refresh();
        },

        /** Screen→logical helper for editor. */
        clientToLogical(clientX, clientY) {
            if (!this._canvasRect) this._syncCanvasRect();
            const rect = this._canvasRect;
            if (!rect) return { x: 0, y: 0 };
            const { width, height } = this._logicalSize();
            return {
                x: ((clientX - rect.left) / Math.max(1, rect.width)) * width,
                y: ((clientY - rect.top) / Math.max(1, rect.height)) * height
            };
        }
    };

    window.MobileControlsDOM = MobileControlsDOM;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MobileControlsDOM.init());
    } else {
        MobileControlsDOM.init();
    }
})();

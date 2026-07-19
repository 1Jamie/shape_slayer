// GameInput — Shape Slayer action mapping layer.
// Consumes Engine.Input (the raw hardware layer) and exposes game-specific
// action semantics: ability prompts, class input configs, and mobile cooldown snapshots.
//
// BOUNDARY: This file IS allowed to reference game content (class names, ability names,
// combat vocabulary). Engine.Input is NOT.

window.GameInput = {

    // ------------------------------------------------------------------ class config
    // Defines which input type each ability uses per class on mobile touch.
    // 'button'                - Simple press (instant activation)
    // 'joystick-press-release' - Press/hold to aim, release to fire
    // 'joystick-continuous'   - Press/hold to continuously fire
    classInputConfig: {
        triangle: { // Rogue
            dodge:          'joystick-press-release',
            heavyAttack:    'joystick-press-release',
            specialAbility: 'button'
        },
        square: { // Warrior
            dodge:          'button',
            heavyAttack:    'joystick-press-release',
            specialAbility: 'button'
        },
        pentagon: { // Tank
            dodge:          'button',
            heavyAttack:    'button',
            specialAbility: 'joystick-continuous'
        },
        hexagon: { // Mage
            dodge:          'button',
            heavyAttack:    'joystick-press-release',
            specialAbility: 'joystick-press-release'
        }
    },

    /**
     * Get input type for a specific ability of a class.
     * @param {string} classType  - 'triangle' | 'square' | 'pentagon' | 'hexagon'
     * @param {string} ability    - 'dodge' | 'heavyAttack' | 'specialAbility'
     * @returns {'button'|'joystick-press-release'|'joystick-continuous'}
     */
    getAbilityInputType(classType, ability) {
        if (typeof MobileControlLayout !== 'undefined' && MobileControlLayout.resolveControlType) {
            const layout = window.Engine && Engine.Input ? Engine.Input._activeControlLayout : null;
            const ctrl = layout && layout.controls ? layout.controls[ability] : null;
            return MobileControlLayout.resolveControlType(ability, classType, ctrl, layout);
        }
        if (!this.classInputConfig[classType]) return 'button';
        return this.classInputConfig[classType][ability] || 'button';
    },

    // ------------------------------------------------------------------ combat prompts

    /**
     * Returns a platform-appropriate label for a combat ability slot.
     * @param {'primary'|'heavy'|'special'|'dash'} ability
     */
    getCombatPrompt(ability) {
        const key = String(ability || '').toLowerCase();

        const desktop = { primary: 'LMB', heavy: 'RMB', special: 'Space', dash: 'Shift' };
        const mobile  = { primary: 'Tap Primary', heavy: 'Tap Heavy', special: 'Tap Special', dash: 'Tap Dodge' };
        const gamepad = { primary: 'RT', heavy: 'LT', special: 'LB', dash: 'RB' };

        const input = Engine.Input;
        if (input.isGamepadMode())     return gamepad[key] || '';
        if (input.isMobileUiMode())    return mobile[key]  || '';
        return desktop[key] || '';
    },

    // ------------------------------------------------------------------ cooldown snapshot

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
        const normalized   = values.map(v => Math.max(0, Number.isFinite(v) ? v : 0));
        const readyCharges = normalized.filter(v => v <= 0).length;
        const nextCooldown = normalized.reduce((max, v) => Math.max(max, v), 0);
        return {
            charges: readyCharges,
            maxCharges: chargeCount,
            chargeCooldowns: normalized,
            cooldown: nextCooldown,
            maxCooldown
        };
    },

    /**
     * Build a cooldown snapshot for the mobile HUD from a player object.
     * Reads Shape Slayer-specific player properties (playerClass, beamChargeCooldowns, etc.)
     */
    getMobileCooldownSnapshot(player = (typeof Game !== 'undefined' ? Game.player : null)) {
        const attackMax      = Math.max(0.0001, this._getNumber(player, ['attackCooldownTime'], 0.3));
        const attackCooldown = Math.max(0, this._getNumber(player, ['attackCooldown'], 0));

        const heavyMax = Math.max(0.0001, this._getNumber(player, ['heavyAttackCooldownTime', 'heavyCooldownTime'], 1.5));
        let heavy = {
            cooldown:    Math.max(0, this._getNumber(player, ['heavyAttackCooldown', 'heavyCooldown', 'heavyRemaining'], 0)),
            maxCooldown: heavyMax,
            charges: null, maxCharges: null, chargeCooldowns: null
        };
        // Mage (hexagon) uses beam charges
        if (player && player.playerClass === 'hexagon') {
            const maxBeamCharges = Math.max(1, this._getNumber(player, ['maxBeamCharges', 'beamCharges'], 2));
            const beamSnapshot   = this._getChargeSnapshot(
                player.beamChargeCooldowns || player.heavyChargeCooldowns, maxBeamCharges, heavyMax);
            heavy = {
                cooldown:       beamSnapshot.cooldown,
                maxCooldown:    beamSnapshot.maxCooldown,
                charges:        beamSnapshot.charges,
                maxCharges:     beamSnapshot.maxCharges,
                chargeCooldowns: beamSnapshot.chargeCooldowns
            };
        }

        const specialMax = Math.max(0.0001, this._getNumber(player, ['specialCooldownTime', 'specialTime'], 1));
        const special    = {
            cooldown:    Math.max(0, this._getNumber(player, ['specialCooldown', 'specialRemaining'], 0)),
            maxCooldown: specialMax,
            charges: null, maxCharges: null, chargeCooldowns: null
        };

        const dodgeMax        = Math.max(0.0001, this._getNumber(player, ['dodgeCooldownTime', 'dashCooldownTime', 'dodgeMaxCooldown'], 1));
        const maxDodgeCharges = Math.max(1, this._getNumber(player, ['maxDodgeCharges', 'maxDashCharges'], 1));
        const dodgeSnapshot   = this._getChargeSnapshot(
            player && (player.dodgeChargeCooldowns || player.dashChargeCooldowns), maxDodgeCharges, dodgeMax);
        const dodge = {
            cooldown: maxDodgeCharges > 1
                ? dodgeSnapshot.cooldown
                : Math.max(0, this._getNumber(player, ['dodgeCooldown', 'dashCooldown', 'dodgeRemaining', 'dashRemaining'], dodgeSnapshot.cooldown)),
            maxCooldown:    dodgeSnapshot.maxCooldown,
            charges:        maxDodgeCharges > 1 ? dodgeSnapshot.charges : (dodgeSnapshot.cooldown <= 0 ? 1 : 0),
            maxCharges:     dodgeSnapshot.maxCharges,
            chargeCooldowns: dodgeSnapshot.chargeCooldowns
        };

        return {
            attack: { cooldown: attackCooldown, maxCooldown: attackMax },
            heavy,
            special,
            dodge
        };
    },

    // ------------------------------------------------------------------ canvas render

    /**
     * Render the on-screen touch controls onto `ctx`.
     * Called by Engine.Input.render() when the DOM layer is not active.
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} inputSurface - the Engine.Input instance (passed by the engine)
     */
    renderTouchControls(ctx, inputSurface) {
        const player      = (typeof Game !== 'undefined') ? Game.player : null;
        const playerClass = player ? (player.playerClass || 'square') : 'square';
        const cooldowns   = this.getMobileCooldownSnapshot(player);

        const touchJoysticks = inputSurface.touchJoysticks;
        const touchButtons   = inputSurface.touchButtons;

        // Left movement joystick background
        if (touchJoysticks && touchJoysticks.movement) {
            const m = touchJoysticks.movement;
            const g = ctx.createRadialGradient(m.centerX, m.centerY, 0, m.centerX, m.centerY, m.radius + 28);
            g.addColorStop(0, 'rgba(4, 6, 18, 0.42)');
            g.addColorStop(0.7, 'rgba(4, 6, 18, 0.25)');
            g.addColorStop(1, 'rgba(4, 6, 18, 0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(m.centerX, m.centerY, m.radius + 28, 0, Math.PI * 2); ctx.fill();
        }

        // Right combat cluster background
        if (touchJoysticks && touchJoysticks.basicAttack) {
            const a = touchJoysticks.basicAttack;
            let maxD = a.radius + 24;
            if (touchButtons) {
                for (const btn of Object.values(touchButtons)) {
                    if (btn) {
                        const bcx = btn.x + btn.width / 2, bcy = btn.y + btn.height / 2;
                        const d = Math.sqrt((bcx - a.centerX) ** 2 + (bcy - a.centerY) ** 2) + Math.max(btn.width, btn.height) / 2;
                        if (d > maxD) maxD = d;
                    }
                }
            }
            const g2 = ctx.createRadialGradient(a.centerX, a.centerY, 0, a.centerX, a.centerY, maxD + 12);
            g2.addColorStop(0, 'rgba(4, 6, 18, 0.42)');
            g2.addColorStop(0.7, 'rgba(4, 6, 18, 0.25)');
            g2.addColorStop(1, 'rgba(4, 6, 18, 0)');
            ctx.fillStyle = g2;
            ctx.beginPath(); ctx.arc(a.centerX, a.centerY, maxD + 12, 0, Math.PI * 2); ctx.fill();
        }

        // Tutorial glow helper
        const tutorialHighlight = (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.getHighlightControl)
            ? Room0Tutorial.getHighlightControl() : null;
        const drawTutorialGlow = (cx, cy, radius) => {
            if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
            const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.01);
            ctx.save();
            ctx.strokeStyle = `rgba(255, 220, 80, ${0.55 + pulse * 0.4})`;
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        };

        // Joysticks — class-specific visibility and render options
        for (const key in touchJoysticks) {
            const joystick = touchJoysticks[key];
            if (!joystick) continue;
            // Class-specific visibility: special joystick hidden for Rogue/Warrior; dodge only for Rogue
            if (key === 'specialAbility' && (playerClass === 'triangle' || playerClass === 'square')) continue;
            if (key === 'dodge' && playerClass !== 'triangle') continue;
            if (tutorialHighlight === key) drawTutorialGlow(joystick.centerX, joystick.centerY, joystick.radius || 40);
            const opts = { playerClass };
            if (key === 'basicAttack') {
                opts.activationRadius = joystick.radius * 1.2;
                opts.label = 'ATK';
                opts.cooldown    = cooldowns.attack.cooldown;
                opts.maxCooldown = cooldowns.attack.maxCooldown;
                opts.primary = true;
            } else if (key === 'movement') {
                opts.fadeWhenIdle = true;
            } else if (key === 'heavyAttack') {
                opts.label = '';
                if (playerClass === 'hexagon') { opts.directional = true; opts.hideText = true; }
            } else if (key === 'specialAbility') {
                opts.label = '';
                if (playerClass === 'pentagon' || playerClass === 'hexagon') { opts.directional = true; opts.hideText = true; }
            } else if (key === 'dodge') {
                opts.label = '';
                opts.directional = true;
                opts.hideText    = true;
                opts.cooldown    = cooldowns.dodge.cooldown;
                opts.maxCooldown = cooldowns.dodge.maxCooldown;
                opts.charges     = cooldowns.dodge.charges;
            }
            joystick.render(ctx, opts);
        }

        // Buttons — class-specific visibility and cooldown decoration
        for (const key in touchButtons) {
            const button = touchButtons[key];
            if (!button) continue;
            if (key === 'characterSheet') continue; // handled by DOM UI
            if (key === 'dodge' && playerClass === 'triangle') continue; // Rogue uses joystick instead
            if (tutorialHighlight === key) {
                drawTutorialGlow(button.x + button.width / 2, button.y + button.height / 2,
                    Math.max(button.width, button.height) / 2);
            }
            let snapshot = { cooldown: 0, maxCooldown: 0, charges: null };
            if (key === 'heavyAttack')    snapshot = cooldowns.heavy;
            if (key === 'specialAbility') snapshot = cooldowns.special;
            if (key === 'dodge')          snapshot = cooldowns.dodge;
            const isDirectionalButton =
                (key === 'specialAbility' && (playerClass === 'pentagon' || playerClass === 'hexagon')) ||
                (key === 'heavyAttack'    && (playerClass === 'square'   || playerClass === 'hexagon'));
            button.render(ctx, snapshot.cooldown, snapshot.maxCooldown, snapshot.charges, {
                playerClass, armed: button.pressed, directional: isDirectionalButton
            });
        }
    }
};

if (typeof window !== 'undefined') {
    window.GameInput = GameInput;

    if (window.Engine && Engine.Touch) {
        Engine.Touch.configure({
            theme: {
                accent: '#78a0ff',
                surface: 'rgba(8, 10, 26, 0.72)',
                muted: 'rgba(180, 205, 255, 0.35)',
                danger: 'rgba(200, 50, 50, 0.35)',
                text: '#eef2ff',
                font: 'bold 11px Orbitron, monospace'
            },
            hooks: {
                haptic(duration) {
                    if (navigator.vibrate) navigator.vibrate(duration);
                },
                drawJoystick(ctx, stick, options, theme) {
                    const cooldown = Math.max(0, Number(options.cooldown) || 0);
                    const maxCooldown = Math.max(0, Number(options.maxCooldown) || 0);
                    const ratio = maxCooldown > 0 ? Math.min(1, cooldown / maxCooldown) : 0;
                    ctx.save();
                    ctx.fillStyle = theme.surface;
                    ctx.strokeStyle = stick.active ? theme.accent : theme.muted;
                    ctx.lineWidth = stick.active ? 3 : 2;
                    ctx.beginPath();
                    ctx.arc(stick.centerX, stick.centerY, stick.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    if (ratio > 0) {
                        ctx.fillStyle = theme.danger;
                        ctx.beginPath();
                        ctx.moveTo(stick.centerX, stick.centerY);
                        ctx.arc(stick.centerX, stick.centerY, stick.radius, -Math.PI / 2,
                            -Math.PI / 2 + Math.PI * 2 * ratio);
                        ctx.closePath();
                        ctx.fill();
                    }
                    ctx.fillStyle = theme.text;
                    ctx.shadowColor = stick.active ? theme.accent : 'transparent';
                    ctx.shadowBlur = stick.active ? 10 : 0;
                    ctx.beginPath();
                    ctx.arc(stick.currentX, stick.currentY, stick.radius * 0.42, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    if (!options.hideText && options.label) {
                        ctx.fillStyle = theme.accent;
                        ctx.font = theme.font;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(options.label, stick.centerX, stick.centerY + stick.radius + 14);
                    }
                    ctx.restore();
                },
                drawButton(ctx, button, state, theme) {
                    const ratio = state.maxCooldown > 0
                        ? Math.min(1, Math.max(0, state.cooldown / state.maxCooldown))
                        : 0;
                    const radius = Math.min(button.width, button.height) / 2;
                    const centerX = button.x + button.width / 2;
                    const centerY = button.y + button.height / 2;
                    ctx.save();
                    ctx.fillStyle = theme.surface;
                    ctx.strokeStyle = button.pressed ? theme.accent : theme.muted;
                    ctx.lineWidth = button.pressed ? 3 : 2;
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    if (ratio > 0) {
                        ctx.fillStyle = theme.danger;
                        ctx.beginPath();
                        ctx.moveTo(centerX, centerY);
                        ctx.arc(centerX, centerY, radius, -Math.PI / 2,
                            -Math.PI / 2 + Math.PI * 2 * ratio);
                        ctx.closePath();
                        ctx.fill();
                    }
                    if (button.label) {
                        ctx.fillStyle = theme.text;
                        ctx.font = theme.font;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(button.label, centerX, centerY);
                    }
                    if (state.charges !== null && state.charges !== undefined) {
                        ctx.fillStyle = '#ffe97a';
                        ctx.beginPath();
                        ctx.arc(button.x + button.width, button.y, 9, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#1a0a00';
                        ctx.font = 'bold 11px Orbitron, monospace';
                        ctx.fillText(state.charges, button.x + button.width, button.y);
                    }
                    ctx.restore();
                }
            }
        });
    }

    if (window.Engine && Engine.Input && typeof Engine.Input.configure === 'function') {
        Engine.Input.configure({
            getLogicalSize(canvas) {
                const game = window.Game;
                return game && game.config
                    ? { width: game.config.width, height: game.config.height }
                    : { width: canvas.width, height: canvas.height };
            },
            mapPointer(clientX, clientY, canvas) {
                const game = window.Game;
                if (game && typeof game.screenToGame === 'function') {
                    return game.screenToGame(clientX, clientY);
                }
                const rect = canvas.getBoundingClientRect();
                const size = this.getLogicalSize(canvas);
                return {
                    x: (clientX - rect.left) * (size.width / rect.width),
                    y: (clientY - rect.top) * (size.height / rect.height)
                };
            },
            screenToWorld(x, y) {
                const game = window.Game;
                if (!game || !game.config) return { x, y };
                let activeViewport = game._activeRenderViewport;
                let camera = game._activeRenderCamera
                    || (game.state === 'NEXUS' ? game.nexusCamera : game.camera);
                // During PLAYING split updates, mouse aim must use P1's left viewport + camera
                // (render-time _activeRender* is unset between passes).
                if (!activeViewport && game.localSplitEnabled && game.localSplitSession
                    && game.state === 'PLAYING') {
                    activeViewport = game.localSplitSession.viewports.seat0;
                    camera = game.camera;
                }
                if (!camera) return { x, y };
                const zoom = typeof game.getViewZoom === 'function'
                    ? game.getViewZoom()
                    : (game.baseZoom || 1.1);
                const viewW = activeViewport ? activeViewport.w : game.config.width;
                const viewH = activeViewport ? activeViewport.h : game.config.height;
                const localX = activeViewport ? x - activeViewport.x : x;
                const localY = activeViewport ? y - activeViewport.y : y;
                return camera
                    .setViewSize(viewW, viewH)
                    .setZoom(zoom)
                    .screenToWorld(localX, localY, game.screenShakeOffset || null);
            },
            getAimOrigin() {
                return window.Game && window.Game.player ? window.Game.player : null;
            },
            getClassType() {
                return window.Game && window.Game.player ? window.Game.player.classType : null;
            },
            getAbilityInputType(classType, ability) {
                return GameInput.getAbilityInputType(classType, ability);
            },
            onSystemStart() {
                const game = window.Game;
                if (!game) return;
                if (game.state === 'TITLE' && typeof game.dismissTitleScreen === 'function') {
                    game.dismissTitleScreen();
                } else if (typeof game.togglePause === 'function') {
                    game.togglePause();
                }
            },
            shouldPreventArrowDefault() {
                return !!(window.Game && window.Game.state === 'PLAYING');
            },
            shouldIgnorePointer() {
                const game = window.Game;
                if (!window.USE_DOM_UI || !game) return false;
                const inSession = game.multiplayerEnabled &&
                    typeof multiplayerManager !== 'undefined' &&
                    multiplayerManager &&
                    multiplayerManager.lobbyCode;
                return game.state === 'PAUSED' ||
                    (inSession && game.showPauseMenu) ||
                    game.privacyModalVisible ||
                    game.updateModalVisible ||
                    game.launchModalVisible;
            },
            onControlModeChanged() {
                const game = window.Game;
                if (game && typeof game.setupResponsiveCanvas === 'function') {
                    game.setupResponsiveCanvas();
                }
            },
            loadControlMode() {
                return typeof SaveSystem !== 'undefined' && SaveSystem.getControlMode
                    ? SaveSystem.getControlMode()
                    : null;
            },
            recordTelemetry(type, metadata) {
                if (typeof Telemetry !== 'undefined' && Telemetry && Telemetry.recordEvent) {
                    Telemetry.recordEvent(type, metadata);
                }
            },
            isDomTouchControlsActive() {
                return typeof MobileControlsDOM !== 'undefined' &&
                    !!MobileControlsDOM.layer &&
                    !MobileControlsDOM.layer.hidden;
            },
            refreshDomTouchControls() {
                if (typeof MobileControlsDOM === 'undefined' || !MobileControlsDOM.refresh) return;
                if (MobileControlsDOM.shouldShow && MobileControlsDOM.layer) {
                    const want = MobileControlsDOM.shouldShow();
                    if (want === MobileControlsDOM.layer.hidden) MobileControlsDOM.refresh();
                }
            },
            onInputSurfaceReady() {
                if (typeof MobileControlsDOM !== 'undefined' && MobileControlsDOM.onInputSurfaceReady) {
                    MobileControlsDOM.onInputSurfaceReady();
                }
            },
            getMobileControlLayout(width, height, options) {
                return typeof MobileControlLayout !== 'undefined' && MobileControlLayout.getEffectiveLayout
                    ? MobileControlLayout.getEffectiveLayout(width, height, options)
                    : null;
            },
            isUiBlockingGameplay() {
                return !!(window.ControllerNav
                    && typeof window.ControllerNav.isBlockingGameplay === 'function'
                    && window.ControllerNav.isBlockingGameplay());
            },
            uiHandlesSystemButtons() {
                return !!(window.ControllerNav && window.ControllerNav.handlesSystemButtons);
            },
            isLootCycleActive(dpadLeft, dpadRight, dpadUp, dpadDown) {
                return typeof LootSelection !== 'undefined'
                    && LootSelection.nearbyItems
                    && LootSelection.nearbyItems.length > 1
                    && (dpadLeft || dpadRight)
                    && !dpadUp
                    && !dpadDown;
            },
            onCharacterSheetTouchStart(x, y, clientY) {
                if (typeof CharacterSheet === 'undefined' || !CharacterSheet.isOpen) return false;
                CharacterSheet.lastTouchY = clientY;
                if (CharacterSheet.closeButtonBounds) {
                    const b = CharacterSheet.closeButtonBounds;
                    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
                        CharacterSheet.isOpen = false;
                        return true;
                    }
                }
                return false;
            },
            onCharacterSheetTouchMove(x, y, clientY) {
                if (typeof CharacterSheet === 'undefined' || !CharacterSheet.isOpen) return false;
                if (CharacterSheet.lastTouchY == null) {
                    CharacterSheet.lastTouchY = clientY;
                    return false;
                }
                const deltaY = CharacterSheet.lastTouchY - clientY;
                if (typeof handleCharacterSheetScroll === 'function' &&
                    handleCharacterSheetScroll(x, y, deltaY)) {
                    CharacterSheet.lastTouchY = clientY;
                    return true;
                }
                CharacterSheet.lastTouchY = clientY;
                return false;
            },
            onInteractionButtonClick(x, y) {
                return typeof handleInteractionButtonClick === 'function'
                    && handleInteractionButtonClick(x, y);
            },
            getTutorialHighlightControl() {
                return typeof Room0Tutorial !== 'undefined' && Room0Tutorial.getHighlightControl
                    ? Room0Tutorial.getHighlightControl()
                    : null;
            },
            renderTouchControls(ctx, inputSurface) {
                GameInput.renderTouchControls(ctx, inputSurface);
            }
        });
    }

}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameInput };
}

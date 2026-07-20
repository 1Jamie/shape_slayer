// Room 0 first-run combat tutorial (solo, once per save)
// Purpose-built empty arena - not a standard generated room.
// Steps: DASH → PRIMARY → HEAVY → SPECIAL → WARNING → KILL → EXIT → DONE

const Room0Tutorial = {
    STEPS: {
        DASH: 'dash',
        PRIMARY: 'primary',
        HEAVY: 'heavy',
        SPECIAL: 'special',
        WARNING: 'warning',
        KILL: 'kill',
        EXIT: 'exit',
        DONE: 'done'
    },

    ARM_DELAY_MS: 550,
    WARNING_DURATION: 1.6,

    /** Compact empty practice floor (independent of layout generator). */
    ROOM_WIDTH: 1280,
    ROOM_HEIGHT: 720,
    CELL_SIZE: 60,

    active: false,
    step: null,
    _armedAt: 0,
    _stepTimer: 0,
    _dashSide: 'left',
    _dashCrossedWhileDodging: false,
    _wasDodging: false,
    markers: null,
    dummy: null,
    _warningFlash: 0,
    _pendingAbility: null,

    shouldEnter() {
        if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode) {
            return false;
        }
        if (typeof Game !== 'undefined' && Game.multiplayerEnabled) {
            return false;
        }
        if (typeof SaveSystem === 'undefined' || !SaveSystem.getOnboarding) {
            return false;
        }
        const ob = SaveSystem.getOnboarding();
        return !ob.room0TutorialDone;
    },

    isActive() {
        return this.active === true && this.step && this.step !== this.STEPS.DONE;
    },

    isTutorialRoom(room) {
        return !!(room && (room.type === 'tutorial' || room.number === 0));
    },

    markDone() {
        if (typeof SaveSystem !== 'undefined' && SaveSystem.setOnboarding) {
            SaveSystem.setOnboarding({ room0TutorialDone: true });
        }
        this.reset();
    },

    reset() {
        this.active = false;
        this.step = null;
        this._armedAt = 0;
        this._stepTimer = 0;
        this._dashCrossedWhileDodging = false;
        this._wasDodging = false;
        this.markers = null;
        this.dummy = null;
        this._warningFlash = 0;
        this._pendingAbility = null;
    },

    /**
     * Hand-authored empty rectangle: spawn left, exit right, fully walkable.
     * Applied onto the Room instance (no RoomLayoutGenerator).
     */
    buildEmptyRoom(room) {
        const width = this.ROOM_WIDTH;
        const height = this.ROOM_HEIGHT;
        const cellSize = this.CELL_SIZE;
        const cols = Math.ceil(width / cellSize);
        const rows = Math.ceil(height / cellSize);
        const midY = height / 2;
        const spawnZone = { x: 160, y: midY, radius: 100 };
        const exitZone = { x: width - 90, y: midY, radius: 90 };

        // Dash strip sits immediately to the right of spawn
        const dashLineX = spawnZone.x + 140;
        // Enemy appears further into the open floor after dash completes
        const dummyX = Math.min(width - 220, dashLineX + 280);
        const dummyY = midY;

        const layout = {
            layoutVersion: 1,
            seed: 'tutorial:room0',
            biomeId: 'swarm',
            bossTheme: null,
            roomType: 'tutorial',
            roomNumber: 0,
            strategy: 'empty',
            archetype: 'tutorial',
            wilds: false,
            entranceVariant: 'leftRight',
            width,
            height,
            cellSize,
            cols,
            rows,
            grid: new Array(cols * rows).fill(0), // 0 = walkable
            obstacles: [],
            visualMotifs: [],
            paths: [],
            landmarks: [],
            encounterZones: [],
            decorationSeed: 'tutorial:room0:decor',
            decorationProfile: 'defaultDust',
            spawnZone,
            exitZone,
            generatedByFallback: true,
            fallbackId: 'room0Empty',
            hash: 'room0-empty-v1',
            tutorial: true
        };

        room.type = 'tutorial';
        room.number = 0;
        room.width = width;
        room.height = height;
        room.seed = layout.seed;
        room.biomeId = layout.biomeId;
        room.bossTheme = null;
        room.layoutVersion = layout.layoutVersion;
        room.layoutHash = layout.hash;
        room.layout = layout;
        room.walkableGrid = layout.grid;
        room.obstacles = [];
        room.spawnZones = [spawnZone];
        room.exitZones = [exitZone];
        room.visualMotifs = [];
        room.paths = [];
        room.landmarks = [];
        room.encounterZones = [];
        room.decorationSeed = layout.decorationSeed;
        room.decorationProfile = layout.decorationProfile;
        room.archetype = 'tutorial';
        room.entranceVariant = 'leftRight';
        room.enemies = [];
        room.loot = [];
        room.cleared = false;
        room.doorOpen = false;
        room.rewardsGranted = false;

        this.markers = {
            dashLine: {
                x: dashLineX,
                y1: Math.max(60, midY - 160),
                y2: Math.min(height - 60, midY + 160)
            },
            dummy: { x: dummyX, y: dummyY },
            exit: { x: exitZone.x, y: exitZone.y, radius: exitZone.radius || 90 }
        };
        room.tutorialMarkers = this.markers;

        return room;
    },

    /**
     * Configure room 0 markers and start on DASH - no enemy until dash succeeds.
     */
    setupRoom(room) {
        if (!room) return room;

        this.reset();
        this.active = true;
        this.buildEmptyRoom(room);
        this._setStep(this.STEPS.DASH);
        return room;
    },

    beginIfNeeded(room) {
        if (!this.isTutorialRoom(room)) {
            if (this.active) this.reset();
            return;
        }
        if (!this.active || !this.step) {
            this.setupRoom(room);
        }
    },

    /** Spawn the practice dummy (called after dash completes). */
    spawnDummy() {
        if (this.dummy && this.dummy.alive) return this.dummy;
        if (!this.markers || !this.markers.dummy) return null;
        if (typeof Enemy !== 'function') return null;

        const { x, y } = this.markers.dummy;
        const enemy = new Enemy(x, y);
        enemy.isTutorialDummy = true;
        enemy.tutorialFrozen = true;
        enemy.moveSpeed = 0;
        enemy.baseMoveSpeed = 0;
        enemy.lootChance = 0;
        enemy.xpValue = 0;
        const paddedHp = Math.max((enemy.maxHp || 100) * 2, 560);
        enemy.maxHp = paddedHp;
        enemy.hp = paddedHp;
        enemy.detectionRange = 99999;
        enemy._room0OriginX = x;
        enemy._room0OriginY = y;

        this.dummy = enemy;

        const room = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom : null;
        if (room) {
            if (!Array.isArray(room.enemies)) room.enemies = [];
            room.enemies.push(enemy);
        }
        if (typeof Game !== 'undefined') {
            if (!Array.isArray(Game.enemies)) Game.enemies = [];
            if (Game.enemies.indexOf(enemy) === -1) {
                Game.enemies.push(enemy);
            }
        }

        return enemy;
    },

    _setStep(step) {
        this.step = step;
        this._armedAt = Date.now() + this.ARM_DELAY_MS;
        this._stepTimer = 0;
        this._dashCrossedWhileDodging = false;
        this._wasDodging = false;
        this._warningFlash = 0;
        this._pendingAbility = null;

        if (step === this.STEPS.DASH && typeof Game !== 'undefined' && Game.player && this.markers) {
            this._dashSide = Game.player.x <= this.markers.dashLine.x ? 'left' : 'right';
        }

        if (step === this.STEPS.PRIMARY) {
            this.spawnDummy();
        }
    },

    isArmed() {
        return Date.now() >= this._armedAt;
    },

    /**
     * @returns {'none'|'dash'|'primary'|'heavy'|'special'|'all'}
     */
    getAllowedAction() {
        if (!this.isActive()) return 'all';
        if (!this.isArmed()) return 'none';
        switch (this.step) {
            case this.STEPS.DASH: return 'dash';
            case this.STEPS.PRIMARY: return 'primary';
            case this.STEPS.HEAVY: return 'heavy';
            case this.STEPS.SPECIAL: return 'special';
            case this.STEPS.KILL: return 'all';
            case this.STEPS.WARNING:
            case this.STEPS.EXIT:
            case this.STEPS.DONE:
                return 'none';
            default:
                return 'none';
        }
    },

    isExitCoachActive() {
        return this.isActive() && this.step === this.STEPS.EXIT;
    },

    /**
     * World-space AABB over the exit door for spotlight cutout.
     */
    getExitSpotlightRect() {
        const door = (typeof getDoorPosition === 'function') ? getDoorPosition() : null;
        if (door) {
            return {
                x: door.x - 18,
                y: door.y - 18,
                w: door.width + 36,
                h: door.height + 36
            };
        }
        const room = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom : null;
        const exit = room && room.layout && room.layout.exitZone
            ? room.layout.exitZone
            : (this.markers && this.markers.exit) || null;
        if (!exit) return null;
        const pad = 48;
        return {
            x: exit.x - pad,
            y: exit.y - pad * 1.2,
            w: pad * 2,
            h: pad * 2.4
        };
    },

    /** Touch control key to glow, or null. */
    getHighlightControl() {
        if (!this.isActive() || !this.isArmed()) return null;
        switch (this.step) {
            case this.STEPS.DASH: return 'dodge';
            case this.STEPS.PRIMARY: return 'basicAttack';
            case this.STEPS.HEAVY: return 'heavyAttack';
            case this.STEPS.SPECIAL: return 'specialAbility';
            default: return null;
        }
    },

    notifyCombatAction(ability) {
        if (!this.isActive() || !this.isArmed()) return;
        if (ability === 'primary' || ability === 'heavy' || ability === 'special') {
            this._pendingAbility = ability;
            // Utility specials may not reliably damage the dummy, so casting
            // them is enough to satisfy the SPECIAL step.
            if (ability === 'special' && this.step === this.STEPS.SPECIAL
                && this._specialCompletesOnCast()) {
                this._pendingAbility = null;
                this._setStep(this.STEPS.WARNING);
            }
        }
    },

    _getClassTutorialProfile() {
        const player = (typeof Game !== 'undefined') ? Game.player : null;
        return (player && player.room0Tutorial) ? player.room0Tutorial : null;
    },

    _specialCompletesOnCast() {
        const profile = this._getClassTutorialProfile();
        return !!(profile && profile.specialCompletesOnCast);
    },

    _formatTutorialBody(template, hintText) {
        const raw = String(template || '');
        if (raw.includes('{hint}')) {
            return raw.replace(/\{hint\}/g, hintText || '');
        }
        return raw;
    },

    _abilityCoachCopy(stepKey, abilityKey, fallbackTitle, fallbackBody) {
        const hint = (() => {
            const p = GameInput.getCombatPrompt(abilityKey);
            return p ? ` (${p})` : '';
        })();
        const profile = this._getClassTutorialProfile();
        const override = profile && profile[stepKey] ? profile[stepKey] : null;
        return {
            title: (override && override.title) ? override.title : fallbackTitle,
            body: this._formatTutorialBody(
                (override && override.body) ? override.body : fallbackBody,
                hint
            )
        };
    },

    onDummyDamaged(enemy) {
        if (!this.isActive() || !this.isArmed()) return;
        if (!enemy || !enemy.isTutorialDummy) return;
        const pending = this._pendingAbility;
        if (!pending) return;

        if (this.step === this.STEPS.PRIMARY && pending === 'primary') {
            this._pendingAbility = null;
            this._setStep(this.STEPS.HEAVY);
        } else if (this.step === this.STEPS.HEAVY && pending === 'heavy') {
            this._pendingAbility = null;
            this._setStep(this.STEPS.SPECIAL);
        } else if (this.step === this.STEPS.SPECIAL && pending === 'special') {
            this._pendingAbility = null;
            this._setStep(this.STEPS.WARNING);
        }
    },

    onDummyDied() {
        if (!this.isActive()) return;
        if (this.step === this.STEPS.KILL || this.step === this.STEPS.WARNING) {
            this._beginExitCoach();
        }
    },

    _beginExitCoach() {
        this._setStep(this.STEPS.EXIT);
    },

    /**
     * Soft camera pull that keeps both exit door + player on screen (critical on mobile).
     */
    getCameraOverride() {
        if (!this.isExitCoachActive()) return null;
        const rect = this.getExitSpotlightRect();
        if (!rect) return null;
        const player = (typeof Game !== 'undefined') ? Game.player : null;
        if (typeof CoachTransition !== 'undefined' && CoachTransition.frameCameraTarget) {
            const framed = CoachTransition.frameCameraTarget({
                focusRect: rect,
                playerX: player ? player.x : null,
                playerY: player ? player.y : null
            });
            if (framed) return framed;
        }
        const exitX = rect.x + rect.w / 2;
        const exitY = rect.y + rect.h / 2;
        if (player) {
            return {
                x: player.x * 0.45 + exitX * 0.55,
                y: player.y * 0.45 + exitY * 0.55
            };
        }
        return { x: exitX, y: exitY };
    },

    activateDummy() {
        const dummy = this.dummy || (typeof currentRoom !== 'undefined' && currentRoom
            && currentRoom.enemies && currentRoom.enemies.find(e => e && e.isTutorialDummy));
        if (!dummy) return;
        this.dummy = dummy;
        dummy.tutorialFrozen = false;
        dummy.moveSpeed = (typeof BASIC_ENEMY_CONFIG !== 'undefined' && BASIC_ENEMY_CONFIG.moveSpeed)
            ? BASIC_ENEMY_CONFIG.moveSpeed
            : 100;
        dummy.baseMoveSpeed = dummy.moveSpeed;
        const baseFightHp = (typeof BASIC_ENEMY_CONFIG !== 'undefined' && BASIC_ENEMY_CONFIG.maxHp)
            ? BASIC_ENEMY_CONFIG.maxHp
            : 80;
        const fightHp = baseFightHp * 2;
        dummy.maxHp = fightHp;
        dummy.hp = fightHp;
    },

    update(dt) {
        if (!this.isActive()) return;
        if (typeof Game === 'undefined' || Game.state !== 'PLAYING') return;

        const player = Game.player;
        if (!player) return;

        if (this.dummy && this.dummy.tutorialFrozen && this.dummy.alive) {
            if (Number.isFinite(this.dummy._room0OriginX)) {
                this.dummy.x = this.dummy._room0OriginX;
                this.dummy.y = this.dummy._room0OriginY;
            }
            this.dummy.vx = 0;
            this.dummy.vy = 0;
        }

        if (this.step === this.STEPS.DASH && this.isArmed() && this.markers) {
            const lineX = this.markers.dashLine.x;
            const dodging = !!player.isDodging;
            if (dodging) {
                const crossed = this._dashSide === 'left'
                    ? player.x > lineX
                    : player.x < lineX;
                if (crossed) this._dashCrossedWhileDodging = true;
            }
            if ((this._wasDodging && !dodging && this._dashCrossedWhileDodging)
                || (dodging && this._dashCrossedWhileDodging)) {
                this._setStep(this.STEPS.PRIMARY);
            }
            this._wasDodging = dodging;
        }

        if (this.step === this.STEPS.WARNING) {
            this._stepTimer += dt;
            this._warningFlash = 0.5 + 0.5 * Math.sin(this._stepTimer * 10);
            if (this._stepTimer >= this.WARNING_DURATION) {
                this.activateDummy();
                this._setStep(this.STEPS.KILL);
            }
        }

        if (this.step === this.STEPS.KILL) {
            const alive = this.dummy && this.dummy.alive;
            const roomAlive = typeof currentRoom !== 'undefined' && currentRoom
                && Array.isArray(currentRoom.enemies)
                && currentRoom.enemies.some(e => e && e.alive);
            if (!alive && !roomAlive) {
                this._beginExitCoach();
            }
        }
    },

    getCoachCopy() {
        if (!this.isActive()) return null;
        switch (this.step) {
            case this.STEPS.DASH:
                return this._abilityCoachCopy(
                    'dash',
                    'dash',
                    'Dash',
                    'Dash across the line{hint} to dodge through danger.'
                );
            case this.STEPS.PRIMARY:
                return this._abilityCoachCopy(
                    'primary',
                    'primary',
                    'Primary',
                    'Use Primary{hint} on the dummy.'
                );
            case this.STEPS.HEAVY:
                return this._abilityCoachCopy(
                    'heavy',
                    'heavy',
                    'Heavy',
                    'Use Heavy{hint} on the dummy.'
                );
            case this.STEPS.SPECIAL:
                return this._abilityCoachCopy(
                    'special',
                    'special',
                    'Special',
                    this._specialCompletesOnCast()
                        ? 'Use Special{hint}.'
                        : 'Use Special{hint} on the dummy.'
                );
            case this.STEPS.WARNING:
                return {
                    title: 'Incoming!',
                    body: 'The enemy is about to awaken. Prepare to fight.'
                };
            case this.STEPS.KILL:
                return {
                    title: 'Fight!',
                    body: 'Defeat the enemy to open the door.'
                };
            case this.STEPS.EXIT: {
                const interactHint = (Engine.Input && typeof Engine.Input.getInteractionPrompt === 'function')
                    ? ` ${Engine.Input.getInteractionPrompt('enter')}.`
                    : ' Press G when nearby.';
                return {
                    title: 'Exit Door',
                    body: `The exit door is open. Walk to it to leave this room and begin your run.${interactHint}`
                };
            }
            default:
                return null;
        }
    },

    renderSpotlight(ctx) {
        if (!this.isExitCoachActive() || !ctx) return;
        if (typeof Game === 'undefined' || Game.state !== 'PLAYING') return;

        const cam = Game.camera || { x: 0, y: 0 };
        const zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;
        const viewHalfW = (Game.config ? Game.config.width : 1920) / (2 * zoom);
        const viewHalfH = (Game.config ? Game.config.height : 1080) / (2 * zoom);
        const viewX = cam.x - viewHalfW;
        const viewY = cam.y - viewHalfH;
        const viewW = viewHalfW * 2;
        const viewH = viewHalfH * 2;
        const rect = this.getExitSpotlightRect();
        if (!rect) return;

        ctx.save();
        // Dim everywhere except the door cutout
        ctx.beginPath();
        ctx.rect(viewX - 40, viewY - 40, viewW + 80, viewH + 80);
        this._roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 12, { restart: false });
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fill('evenodd');

        const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.008);
        ctx.strokeStyle = `rgba(255, 220, 80, ${0.65 + pulse * 0.35})`;
        ctx.lineWidth = 4;
        this._roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 12, { restart: true });
        ctx.stroke();
        ctx.restore();
    },

    renderWorld(ctx) {
        if (!this.isActive() || !this.markers || !ctx) return;

        const dash = this.markers.dashLine;
        if (dash && this.step === this.STEPS.DASH) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 220, 80, 0.85)';
            ctx.lineWidth = 6;
            ctx.setLineDash([18, 12]);
            ctx.beginPath();
            ctx.moveTo(dash.x, dash.y1);
            ctx.lineTo(dash.x, dash.y2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        if (this.step === this.STEPS.WARNING && this._warningFlash > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(255, 40, 40, ${0.08 * this._warningFlash})`;
            const w = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : this.ROOM_WIDTH;
            const h = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : this.ROOM_HEIGHT;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        if (this.dummy && this.dummy.alive && this.dummy.tutorialFrozen
            && (this.step === this.STEPS.PRIMARY || this.step === this.STEPS.HEAVY || this.step === this.STEPS.SPECIAL)) {
            ctx.save();
            ctx.strokeStyle = 'rgba(120, 200, 255, 0.7)';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.arc(this.dummy.x, this.dummy.y, (this.dummy.size || 20) + 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    },

    renderCoachCard(ctx) {
        if (!this.isActive() || !ctx) return;
        if (typeof Game === 'undefined' || Game.state !== 'PLAYING') return;

        const copy = this.getCoachCopy();
        if (!copy) return;

        const cam = Game.camera || { x: 0, y: 0 };
        const zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;
        const viewHalfW = (Game.config ? Game.config.width : 1920) / (2 * zoom);
        const viewHalfH = (Game.config ? Game.config.height : 1080) / (2 * zoom);
        const viewX = cam.x - viewHalfW;
        const viewY = cam.y - viewHalfH;
        const viewW = viewHalfW * 2;
        const viewH = viewHalfH * 2;
        const exitRect = this.isExitCoachActive() ? this.getExitSpotlightRect() : null;

        const isMobile = Engine.Input.isMobileUiMode();
        const padX = isMobile ? 14 : 18;
        const boxW = Math.min(isMobile ? 300 : 400, viewW - 40);
        const titleFont = isMobile ? 'bold 15px Orbitron' : 'bold 17px Orbitron';
        const bodyFont = isMobile ? '12px sans-serif' : '13px sans-serif';
        const lineHeight = isMobile ? 16 : 17;
        const titleH = isMobile ? 22 : 26;
        const topPad = 12;
        const gap = 6;
        const bottomPad = 12;
        const bottomSafe = isMobile ? 150 : 36;

        ctx.save();
        ctx.font = bodyFont;
        const lines = this._wrapText(ctx, copy.body, boxW - padX * 2);
        const boxH = topPad + titleH + gap + Math.max(1, lines.length) * lineHeight + bottomPad;

        let bx = cam.x - boxW / 2;
        let by = viewY + 28;

        if (exitRect) {
            bx = exitRect.x + exitRect.w / 2 - boxW / 2;
            by = exitRect.y + exitRect.h + 16;
            const maxBy = viewY + viewH - boxH - bottomSafe;
            if (by > maxBy) {
                by = Math.max(viewY + 20, exitRect.y - boxH - 16);
            }
        }

        bx = Math.max(viewX + 12, Math.min(bx, viewX + viewW - boxW - 12));
        by = Math.max(viewY + 12, Math.min(by, viewY + viewH - boxH - bottomSafe));

        ctx.fillStyle = 'rgba(8, 10, 18, 0.96)';
        ctx.strokeStyle = '#ffdd55';
        ctx.lineWidth = 3;
        this._roundRectPath(ctx, bx, by, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffdd55';
        ctx.font = titleFont;
        ctx.fillText(copy.title, bx + boxW / 2, by + topPad + titleH / 2);

        ctx.fillStyle = '#f2f2f2';
        ctx.font = bodyFont;
        ctx.textBaseline = 'top';
        let ty = by + topPad + titleH + gap;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], bx + boxW / 2, ty + i * lineHeight);
        }
        ctx.restore();
    },

    _wrapText(ctx, text, maxWidth) {
        const raw = String(text || '').trim();
        if (!raw) return [];
        const words = raw.split(/\s+/);
        const lines = [];
        let line = '';
        for (let i = 0; i < words.length; i++) {
            const test = line ? `${line} ${words[i]}` : words[i];
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = words[i];
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        return lines;
    },

    /**
     * @param {{ restart?: boolean }} options - if restart (default true), begins a new path
     */
    _roundRectPath(ctx, x, y, w, h, r, options = {}) {
        const restart = options.restart !== false;
        const radius = Math.min(r, w / 2, h / 2);
        if (restart) ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    }
};

if (typeof window !== 'undefined') {
    window.Room0Tutorial = Room0Tutorial;
}

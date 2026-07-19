// Feature tutorials: introduce nexus machines as they unlock (FIFO queue, fixed catalog order).
// Runs after first-run Onboarding is complete. In-run unlocks toast via showToast.

const FeatureTutorials = {
    /**
     * Canonical presentation order. Multi-unlock batches always enqueue / present in this order.
     * depth: 'intro' = short basics coach; 'highlight' = just point at the new machine.
     */
    CATALOG: [
        {
            id: 'rarityChance',
            title: 'Rarity Chances',
            shortName: 'Rarity',
            toast: 'Milestone: Rarity machine unlocked - visit it in the Nexus!',
            depth: 'intro',
            body: 'Spend Shards here to improve gear rarity drop weights. Open the machine to continue.'
        },
        {
            id: 'affixSlots',
            title: 'Affix Capacity',
            shortName: 'Affixes',
            toast: 'Milestone: Affix Capacity unlocked - visit it in the Nexus!',
            depth: 'intro',
            body: 'Spend Shards to raise how many affixes gear can roll. Open the machine to continue.'
        },
        {
            id: 'safeRoomSystems',
            title: 'Safe Room Systems',
            shortName: 'Systems',
            toast: 'Milestone: Safe Room Systems unlocked - visit it in the Nexus!',
            depth: 'highlight',
            body: 'New Safe Room Systems machine - healer, level-ups, and reroll capacity.'
        },
        {
            id: 'safeRoomEfficiency',
            title: 'Safe Room Efficiency',
            shortName: 'Efficiency',
            toast: 'Milestone: Safe Room Efficiency unlocked - visit it in the Nexus!',
            depth: 'highlight',
            body: 'New Safe Room Efficiency machine - discounts on Safe Room credit costs.'
        }
    ],

    _armedAt: 0,
    _sessionSuspended: false,
    /** When true, present queue head on next safe Nexus frame (e.g. after skip while paused). */
    _pendingPresent: false,

    catalogIndex(id) {
        return this.CATALOG.findIndex(e => e.id === id);
    },

    getEntry(id) {
        return this.CATALOG.find(e => e.id === id) || null;
    },

    getState() {
        if (typeof SaveSystem !== 'undefined' && SaveSystem.getFeatureTutorials) {
            return SaveSystem.getFeatureTutorials();
        }
        return { initialized: false, completed: {}, toasted: {}, queue: [] };
    },

    patch(partial) {
        if (typeof SaveSystem !== 'undefined' && SaveSystem.setFeatureTutorials) {
            return SaveSystem.setFeatureTutorials(partial);
        }
        return this.getState();
    },

    isMachineUnlocked(machineId) {
        if (typeof SaveSystem === 'undefined' || !SaveSystem.getNexusMachineLock) return false;
        const lock = SaveSystem.getNexusMachineLock(machineId);
        return !(lock && lock.locked);
    },

    isMultiplayerActive() {
        return typeof multiplayerManager !== 'undefined'
            && multiplayerManager
            && !!multiplayerManager.lobbyCode;
    },

    isSuspended() {
        return this._sessionSuspended || this.isMultiplayerActive();
    },

    /** Solo resume checkpoint owns the Nexus - only portal is usable. */
    isBlockedByResumeCheckpoint() {
        return typeof SaveSystem !== 'undefined'
            && typeof SaveSystem.hasActiveRunCheckpoint === 'function'
            && SaveSystem.hasActiveRunCheckpoint();
    },

    /** Nexus itself, or pause opened from Nexus (skip escape hatch still available). */
    isOnNexusContext() {
        if (typeof Game === 'undefined') return false;
        if (Game.state === 'NEXUS') return true;
        if (Game.state === 'PAUSED' && Game.pausedFromState === 'NEXUS') return true;
        return false;
    },

    /** Clear any in-flight coach UI so resume-locked nexus stays portal-only. */
    clearPresentation() {
        this._armedAt = 0;
        if (typeof CoachTransition !== 'undefined' && CoachTransition.clear) {
            CoachTransition.clear();
        }
    },

    /**
     * Hard safety: never leave coach UI up when it cannot be completed.
     * Call every Nexus frame / enter so resume/lock races cannot soft-lock.
     * Does NOT clear arming on pause - players pause/unpause mid-guide.
     */
    enforcePresentationSafety() {
        if (this.isBlockedByResumeCheckpoint() || this.isSuspended()) {
            this.clearPresentation();
            this._pendingPresent = false;
            return false;
        }
        const head = this.getQueueHeadId();
        if (head && !this.isMachineUnlocked(head)) {
            this.syncFromProgress({ showToast: false });
            this.clearPresentation();
            return false;
        }
        if (this._pendingPresent && this.canPresent() && this.getQueueHeadId()) {
            this._pendingPresent = false;
            this.prepareCurrentStep({ leavePlayer: true, snapCamera: false, transitionFrom: null });
            return true;
        }
        return this.canPresent();
    },

    /** First-run coach still owns the nexus - wait until it finishes. */
    canPresent() {
        if (this.isSuspended()) return false;
        if (this.isBlockedByResumeCheckpoint()) return false;
        if (typeof Game === 'undefined' || Game.state !== 'NEXUS') return false;
        if (typeof Onboarding !== 'undefined' && Onboarding.isComplete && !Onboarding.isComplete()) {
            return false;
        }
        // If onboarding module missing, allow after nexus is playable
        return true;
    },

    /** Queue head regardless of whether we are allowed to spotlight it right now. */
    getQueueHeadId() {
        const state = this.ensureInitialized();
        const queue = state.queue || [];
        return queue.length ? queue[0] : null;
    },

    /**
     * True when player can dismiss the current unlock-machine guide
     * (room 5 rarity, Swarm King affixes, Twin Prism systems, Fortress efficiency).
     */
    canSkipGuide() {
        if (this.isSuspended()) return false;
        if (!this.isOnNexusContext()) return false;
        if (!this.getQueueHeadId()) return false;
        // Live spotlight on Nexus
        if (this.isSpotlightActive()) return true;
        // Paused mid-guide (state is PAUSED so isSpotlightActive is false)
        if (typeof Game !== 'undefined' && Game.state === 'PAUSED' && Game.pausedFromState === 'NEXUS') {
            return this._armedAt > 0 || this._pendingPresent === true;
        }
        return false;
    },

    /** Desktop/mobile floating Skip - only while a machine unlock coach is on screen. */
    shouldShowSkipOverlay() {
        if (typeof Game === 'undefined' || Game.state !== 'NEXUS') return false;
        if (Game.showPauseMenu) return false;
        return this.isSpotlightActive() && !!this.getQueueHeadId();
    },

    /**
     * Escape hatch: dismiss only the current queue head.
     * Later unlocks stay queued. Used by pause menu + Skip overlay.
     */
    skipGuide() {
        if (!this.canSkipGuide()) return false;
        const currentId = this.getQueueHeadId();
        if (!currentId) return false;

        const fromRect = this._stationRect(currentId);
        const state = this.ensureInitialized();
        const completed = Object.assign({}, state.completed, { [currentId]: true });
        const toasted = Object.assign({}, state.toasted, { [currentId]: true });
        const queue = this._buildQueue(completed);
        this.patch({ completed, toasted, queue, initialized: true });
        this._armedAt = 0;
        console.log(`[FeatureTutorials] Skipped current guide ${currentId}; queue=`, queue);

        if (queue.length && typeof Game !== 'undefined' && Game.state === 'NEXUS' && this.canPresent()) {
            this.prepareCurrentStep({
                transitionFrom: fromRect,
                leavePlayer: true,
                snapCamera: false
            });
        } else if (queue.length) {
            // Paused / not safe to present yet - resume will arm the next step
            this._pendingPresent = true;
            this.clearPresentation();
        } else {
            this.clearPresentation();
            if (typeof Onboarding !== 'undefined' && Onboarding.maybeShowDeferredUpdateModal) {
                Onboarding.maybeShowDeferredUpdateModal();
            }
        }

        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast('Guide step skipped', 2200);
        }
        return true;
    },

    ensureInitialized() {
        const state = this.getState();
        if (state.initialized) return state;

        const completed = Object.assign({}, state.completed);
        const toasted = Object.assign({}, state.toasted);

        // Veterans who already finished first-run onboarding: skip tutorials for
        // machines they already unlocked so we don't dump a backlog.
        const onboardingDone = typeof Onboarding !== 'undefined' && Onboarding.isComplete
            ? Onboarding.isComplete()
            : false;
        if (onboardingDone) {
            this.CATALOG.forEach(entry => {
                if (this.isMachineUnlocked(entry.id)) {
                    completed[entry.id] = true;
                    toasted[entry.id] = true;
                }
            });
        }

        return this.patch({
            initialized: true,
            completed,
            toasted,
            queue: this._buildQueue(completed)
        });
    },

    /** Rebuild queue: unlocked + not completed, in catalog order (stable FIFO for batches). */
    _buildQueue(completedMap) {
        const completed = completedMap || this.getState().completed || {};
        return this.CATALOG
            .filter(entry => !completed[entry.id] && this.isMachineUnlocked(entry.id))
            .map(entry => entry.id);
    },

    /**
     * Sync unlock → toast (optional) → queue.
     * @param {{ showToast?: boolean }} options
     */
    syncFromProgress(options = {}) {
        const showToast = options.showToast === true;
        let state = this.ensureInitialized();
        const completed = Object.assign({}, state.completed);
        const toasted = Object.assign({}, state.toasted);
        const newlyUnlocked = [];

        this.CATALOG.forEach(entry => {
            if (!this.isMachineUnlocked(entry.id)) return;
            if (completed[entry.id]) return;
            newlyUnlocked.push(entry);
        });

        if (showToast && newlyUnlocked.length) {
            newlyUnlocked.forEach((entry, index) => {
                if (toasted[entry.id]) return;
                toasted[entry.id] = true;
                if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
                    const delay = index * 350;
                    setTimeout(() => {
                        window.showToast(entry.toast, 3500);
                    }, delay);
                }
            });
        } else if (newlyUnlocked.length) {
            // Mark toasted silently when syncing without toast (e.g. nexus enter catch-up)
            newlyUnlocked.forEach(entry => {
                if (!toasted[entry.id]) toasted[entry.id] = true;
            });
        }

        const queue = this._buildQueue(completed);
        state = this.patch({ completed, toasted, queue, initialized: true });
        return { state, newlyUnlocked: newlyUnlocked.map(e => e.id) };
    },

    getCurrentId() {
        if (!this.canPresent()) return null;
        return this.getQueueHeadId();
    },

    getCurrentEntry() {
        const id = this.getCurrentId();
        return id ? this.getEntry(id) : null;
    },

    isSpotlightActive() {
        return !!this.getCurrentId();
    },

    isArmed() {
        if (!this.isSpotlightActive()) return true;
        if (!this._armedAt) return false;
        return Date.now() >= this._armedAt;
    },

    allowsInteraction(type, detail) {
        if (this.isSuspended()) return true;
        // Resume / unlock races must never hard-gate the Nexus
        if (this.isBlockedByResumeCheckpoint()) {
            this.clearPresentation();
            return true;
        }
        if (!this.isSpotlightActive()) return true;
        if (typeof Game === 'undefined' || Game.state !== 'NEXUS') return true;

        const currentId = this.getCurrentId();
        if (!currentId || !this.isMachineUnlocked(currentId)) {
            this.clearPresentation();
            return true;
        }

        // Hard-gate: only the spotlighted gear machine.
        // Outer nexus probes call allowsInteraction('gearUpgrade') with no detail before
        // iterating stations - allow that probe so the per-station check can run.
        // Escape: Skip Guide overlay + Pause → Skip Guide
        if (type === 'gearUpgrade') {
            if (detail == null || detail === '') return true;
            return detail === currentId;
        }
        return false;
    },

    getCoachCopy() {
        const entry = this.getCurrentEntry();
        if (!entry) return null;
        const hint = this._interactHint('open');
        const skipHint = this._skipHint();
        return {
            title: entry.title,
            body: `${entry.body} ${hint}`,
            skipHint
        };
    },

    _interactHint(action) {
        if (typeof Input !== 'undefined' && Input.getInteractionPrompt) {
            return Input.getInteractionPrompt(action);
        }
        return 'Press G to open';
    },

    _skipHint() {
        const gamepad = typeof Input !== 'undefined' && Input.controlMode === 'gamepad';
        if (gamepad) return 'Stuck? Pause → Skip Machine Guide';
        return 'Stuck? Use Skip Guide';
    },

    _stationRect(machineId) {
        if (!machineId || typeof gearUpgradeStations === 'undefined') return null;
        const station = gearUpgradeStations.find(s => s.key === machineId);
        if (!station) return null;
        const pad = 40;
        const halfW = 70;
        const halfH = 48;
        return {
            x: station.x - halfW - pad,
            y: station.y - halfH - pad - 20,
            w: (halfW + pad) * 2,
            h: (halfH + pad) * 2 + 40
        };
    },

    getSpotlightRect() {
        const id = this.getCurrentId();
        const target = this._stationRect(id);
        if (!target) return null;
        if (typeof CoachTransition !== 'undefined' && CoachTransition.isActive()) {
            return CoachTransition.getRect(target);
        }
        return target;
    },

    getCameraOverride() {
        if (!this.isSpotlightActive()) return null;
        // During transition, camera target is already set by CoachTransition
        if (typeof CoachTransition !== 'undefined' && CoachTransition.isActive()) {
            return null;
        }
        const rect = this._stationRect(this.getCurrentId());
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
        return {
            x: rect.x + rect.w / 2,
            y: rect.y + rect.h / 2
        };
    },

    /**
     * Present current queue head.
     * @param {{ transitionFrom?: object, leavePlayer?: boolean, snapCamera?: boolean }} options
     */
    prepareCurrentStep(options = {}) {
        if (!this.enforcePresentationSafety()) return;
        const id = this.getCurrentId();
        if (!id || typeof gearUpgradeStations === 'undefined') return;
        const station = gearUpgradeStations.find(s => s.key === id);
        if (!station || typeof Game === 'undefined') return;

        const leavePlayer = options.leavePlayer === true || !!options.transitionFrom;
        const toRect = this._stationRect(id);

        // Only teleport on cold present (e.g. return-to-nexus with no prior coach)
        if (!leavePlayer && Game.player) {
            Game.player.x = station.x - 180;
            Game.player.y = station.y;
        }

        if (typeof Game.lastGKeyState !== 'undefined') {
            Game.lastGKeyState = true;
        }

        if (typeof CoachTransition !== 'undefined' && toRect) {
            const armMs = CoachTransition.start(options.transitionFrom || null, toRect, {
                snapCamera: options.snapCamera === true && !options.transitionFrom
            });
            this._armedAt = Date.now() + Math.max(armMs, 750);
        } else {
            const cam = {
                x: station.x,
                y: station.y
            };
            if (Game.nexusCamera) {
                if (options.snapCamera !== false && !options.transitionFrom) {
                    Game.nexusCamera.x = cam.x;
                    Game.nexusCamera.y = cam.y;
                }
                Game.nexusCamera.targetX = cam.x;
                Game.nexusCamera.targetY = cam.y;
            }
            this._armedAt = Date.now() + 750;
        }

        console.log(`[FeatureTutorials] Presenting ${id}${leavePlayer ? ' (leave player)' : ''}`);
    },

    /** Smooth handoff from another coach step (e.g. class upgrades → rarity). */
    continueFrom(fromRect) {
        this.syncFromProgress({ showToast: false });
        if (!this.enforcePresentationSafety() || !this.getCurrentId()) return false;
        this.prepareCurrentStep({
            transitionFrom: fromRect || null,
            leavePlayer: true,
            snapCamera: false
        });
        return true;
    },

    notifyMachineOpened(machineId) {
        if (this.isSuspended()) return;
        const current = this.getCurrentId();
        if (!current || machineId !== current) return;
        if (!this.isArmed()) {
            console.log('[FeatureTutorials] Interact ignored until coach is armed');
            return;
        }

        const fromRect = this._stationRect(current);
        const state = this.getState();
        const completed = Object.assign({}, state.completed, { [machineId]: true });
        const queue = this._buildQueue(completed);
        this.patch({ completed, queue });
        this._armedAt = 0;
        console.log(`[FeatureTutorials] Completed ${machineId}; queue=`, queue);

        if (queue.length && typeof Game !== 'undefined' && Game.state === 'NEXUS') {
            this.prepareCurrentStep({
                transitionFrom: fromRect,
                leavePlayer: true,
                snapCamera: false
            });
        } else if (typeof CoachTransition !== 'undefined') {
            CoachTransition.clear();
            if (typeof Onboarding !== 'undefined' && Onboarding.maybeShowDeferredUpdateModal) {
                Onboarding.maybeShowDeferredUpdateModal();
            }
        } else if (typeof Onboarding !== 'undefined' && Onboarding.maybeShowDeferredUpdateModal) {
            Onboarding.maybeShowDeferredUpdateModal();
        }
    },

    onNexusEnter() {
        if (this.isMultiplayerActive()) {
            this._sessionSuspended = true;
            this.clearPresentation();
            return;
        }
        this._sessionSuspended = false;
        this.syncFromProgress({ showToast: false });
        // Keep unlock queue/toasts, but never spotlight machines during resume-only Nexus
        if (!this.enforcePresentationSafety()) {
            console.log('[FeatureTutorials] Deferred spotlight - unsafe to present (resume/MP/lock)');
            return;
        }
        if (this.getCurrentId()) {
            // Cold entry: stage near machine, soft camera pan from spawn
            this.prepareCurrentStep({ leavePlayer: false, snapCamera: false, transitionFrom: null });
        }
    },

    suspendForMultiplayer() {
        this._sessionSuspended = true;
    },

    resumeFromMultiplayer() {
        this._sessionSuspended = false;
        this.onNexusEnter();
    },

    // --- Render (mirrors Onboarding spotlight style) ---

    renderSpotlight(ctx) {
        if (!this.enforcePresentationSafety() || !this.isSpotlightActive() || !ctx) return;
        if (typeof Game === 'undefined') return;
        // Don't stack under first-run onboarding dim
        if (typeof Onboarding !== 'undefined' && Onboarding.isSpotlightActive && Onboarding.isSpotlightActive()) {
            return;
        }

        const cam = Game.nexusCamera || { x: 0, y: 0 };
        const zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;
        const viewHalfW = (Game.config ? Game.config.width : 1920) / (2 * zoom);
        const viewHalfH = (Game.config ? Game.config.height : 1080) / (2 * zoom);
        const viewX = cam.x - viewHalfW;
        const viewY = cam.y - viewHalfH;
        const viewW = viewHalfW * 2;
        const viewH = viewHalfH * 2;
        const rect = this.getSpotlightRect();
        if (!rect) return;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
        ctx.beginPath();
        ctx.rect(viewX, viewY, viewW, viewH);
        ctx.rect(rect.x, rect.y, rect.w, rect.h);
        ctx.fill('evenodd');

        ctx.strokeStyle = 'rgba(120, 200, 255, 0.95)';
        ctx.lineWidth = 3;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
    },

    renderCoachCard(ctx) {
        if (!this.enforcePresentationSafety() || !this.isSpotlightActive() || !ctx) return;
        if (typeof Onboarding !== 'undefined' && Onboarding.isSpotlightActive && Onboarding.isSpotlightActive()) {
            return;
        }
        if (typeof Game === 'undefined') return;
        const copy = this.getCoachCopy();
        const rect = this.getSpotlightRect();
        if (!copy || !rect) return;

        const cam = Game.nexusCamera || { x: 0, y: 0 };
        const zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;
        const viewHalfW = (Game.config ? Game.config.width : 1920) / (2 * zoom);
        const viewHalfH = (Game.config ? Game.config.height : 1080) / (2 * zoom);
        const viewX = cam.x - viewHalfW;
        const viewY = cam.y - viewHalfH;
        const viewW = viewHalfW * 2;
        const viewH = viewHalfH * 2;

        const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
        const padX = isMobile ? 14 : 16;
        const cardW = Math.min(isMobile ? 300 : 400, Math.max(240, Math.min(rect.w + 80, viewW - 40)));
        const lineHeight = isMobile ? 15 : 16;
        const titleH = isMobile ? 22 : 24;
        const skipH = copy.skipHint ? (isMobile ? 14 : 15) : 0;
        const topPad = 12;
        const gap = 6;
        const bottomPad = 12;
        const bottomSafe = isMobile ? 150 : 36;

        ctx.save();
        ctx.font = isMobile ? '12px sans-serif' : '13px sans-serif';
        const lines = this._wrapLines(ctx, copy.body, cardW - padX * 2);
        const cardH = topPad + titleH + gap + Math.max(1, lines.length) * lineHeight
            + (skipH ? gap + skipH : 0) + bottomPad;

        let x = rect.x + rect.w / 2 - cardW / 2;
        let y = rect.y + rect.h + 16;
        const maxY = viewY + viewH - cardH - bottomSafe;
        if (y > maxY) {
            y = Math.max(viewY + 20, rect.y - cardH - 16);
        }
        x = Math.max(viewX + 12, Math.min(x, viewX + viewW - cardW - 12));
        y = Math.max(viewY + 12, Math.min(y, viewY + viewH - cardH - bottomSafe));

        ctx.fillStyle = 'rgba(12, 16, 32, 0.92)';
        ctx.strokeStyle = 'rgba(120, 200, 255, 0.9)';
        ctx.lineWidth = 2;
        this._roundRectPath(ctx, x, y, cardW, cardH, 10);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#9ad0ff';
        ctx.font = isMobile ? 'bold 14px Orbitron, sans-serif' : 'bold 16px Orbitron, sans-serif';
        ctx.fillText(copy.title, x + cardW / 2, y + topPad + titleH / 2);

        ctx.fillStyle = '#e8eef8';
        ctx.font = isMobile ? '12px sans-serif' : '13px sans-serif';
        ctx.textBaseline = 'top';
        const ty = y + topPad + titleH + gap;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x + cardW / 2, ty + i * lineHeight);
        }
        if (copy.skipHint) {
            ctx.fillStyle = '#8fa3b8';
            ctx.font = isMobile ? '11px sans-serif' : '12px sans-serif';
            ctx.fillText(
                copy.skipHint,
                x + cardW / 2,
                ty + Math.max(1, lines.length) * lineHeight + gap
            );
        }
        ctx.restore();
    },

    _roundRectPath(ctx, x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    },

    _wrapLines(ctx, text, maxWidth) {
        const words = String(text || '').trim().split(/\s+/).filter(Boolean);
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
    }
};

if (typeof window !== 'undefined') {
    window.FeatureTutorials = FeatureTutorials;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FeatureTutorials };
}

// First-run nexus onboarding coach (forced once per save)
// Steps: privacy → controls → selectClass → launchRun → (run) → classUpgrades → modeSwitch → complete

const Onboarding = {
    STEPS: {
        PRIVACY: 'privacy',
        CONTROLS: 'controls',
        SELECT_CLASS: 'selectClass',
        LAUNCH_RUN: 'launchRun',
        CLASS_UPGRADES: 'classUpgrades',
        MODE_SWITCH: 'modeSwitch',
        COMPLETE: 'complete'
    },

    /** Session-only: true while lobby is active (also persisted as suspendedForMp). */
    _sessionSuspended: false,

    /** Pending update modal after onboarding finishes. */
    _deferredUpdateModal: false,

    /**
     * Earliest time class-upgrade interact may complete the coach.
     * Prevents spawn-on-top-of-stations + sticky G from instantly dismissing the step.
     */
    _classUpgradesArmedAt: 0,

    /**
     * Earliest time mode-switch interact may complete the coach.
     */
    _modeSwitchArmedAt: 0,

    getProgress() {
        if (typeof SaveSystem !== 'undefined' && SaveSystem.getOnboarding) {
            return SaveSystem.getOnboarding();
        }
        return {
            selectClassDone: false,
            launchRunDone: false,
            classUpgradesDone: false,
            modeSwitchDone: false,
            firstRunStarted: false,
            complete: false,
            suspendedForMp: false
        };
    },

    patch(partial) {
        if (typeof SaveSystem !== 'undefined' && SaveSystem.setOnboarding) {
            return SaveSystem.setOnboarding(partial);
        }
        return this.getProgress();
    },

    isMultiplayerActive() {
        return typeof multiplayerManager !== 'undefined'
            && multiplayerManager
            && !!multiplayerManager.lobbyCode;
    },

    isSuspended() {
        return this._sessionSuspended || this.isMultiplayerActive();
    },

    isComplete() {
        const p = this.getProgress();
        const required = (typeof SaveSystem !== 'undefined' && SaveSystem.ONBOARDING_TUTORIAL_VERSION)
            ? SaveSystem.ONBOARDING_TUTORIAL_VERSION
            : 1;
        return !!p.complete && Number(p.tutorialVersion) >= required;
    },

    /**
     * Resolve current coach step from save flags + modal / nexus context.
     * Returns null when no coach UI should be shown (complete, suspended, mid-run, etc.).
     */
    getStep() {
        if (this.isComplete()) return this.STEPS.COMPLETE;
        if (this.isSuspended()) return null;

        const p = this.getProgress();
        const privacyDone = typeof SaveSystem !== 'undefined' && SaveSystem.hasAcknowledgedPrivacy
            ? SaveSystem.hasAcknowledgedPrivacy()
            : true;
        if (!privacyDone) return this.STEPS.PRIVACY;

        const controlsDone = typeof SaveSystem !== 'undefined' && SaveSystem.getHasSeenLaunchModal
            ? SaveSystem.getHasSeenLaunchModal()
            : true;
        if (!controlsDone) return this.STEPS.CONTROLS;

        if (!p.selectClassDone) return this.STEPS.SELECT_CLASS;
        if (!p.launchRunDone) return this.STEPS.LAUNCH_RUN;

        // classUpgrades only after a first run has actually started and player is back in nexus
        if (p.firstRunStarted && !p.classUpgradesDone) {
            if (typeof Game !== 'undefined' && Game.state === 'NEXUS') {
                return this.STEPS.CLASS_UPGRADES;
            }
            return null;
        }

        // modeSwitch after class upgrades
        if (p.firstRunStarted && p.classUpgradesDone && !p.modeSwitchDone) {
            if (typeof Game !== 'undefined' && Game.state === 'NEXUS') {
                return this.STEPS.MODE_SWITCH;
            }
            return null;
        }

        if (p.selectClassDone && p.launchRunDone && p.classUpgradesDone && p.modeSwitchDone) {
            if (!p.complete) this.markComplete();
            return this.STEPS.COMPLETE;
        }

        return null;
    },

    /** Nexus itself, or pause opened from Nexus (skip escape still available). */
    isOnNexusContext() {
        if (typeof Game === 'undefined') return false;
        if (Game.state === 'NEXUS') return true;
        if (Game.state === 'PAUSED' && Game.pausedFromState === 'NEXUS') return true;
        return false;
    },

    /** True when canvas spotlight hard-gates are active in nexus. */
    isSpotlightActive() {
        if (this.isSuspended() || this.isComplete()) return false;
        if (typeof Game === 'undefined' || Game.state !== 'NEXUS') return false;
        const step = this.getStep();
        return step === this.STEPS.SELECT_CLASS
            || step === this.STEPS.LAUNCH_RUN
            || step === this.STEPS.CLASS_UPGRADES
            || step === this.STEPS.MODE_SWITCH;
    },

    /**
     * Current skippable Nexus coach step (works while paused from Nexus too).
     * Privacy / controls modals are not skippable here.
     */
    getSkippableStep() {
        if (this.isSuspended() || this.isComplete()) return null;
        if (!this.isOnNexusContext()) return null;
        const p = this.getProgress();
        if (!p.selectClassDone) return this.STEPS.SELECT_CLASS;
        if (!p.launchRunDone) return this.STEPS.LAUNCH_RUN;
        if (p.firstRunStarted && !p.classUpgradesDone) {
            return this.STEPS.CLASS_UPGRADES;
        }
        if (p.firstRunStarted && p.classUpgradesDone && !p.modeSwitchDone) {
            return this.STEPS.MODE_SWITCH;
        }
        return null;
    },

    /** True when the current Nexus coach step can be dismissed. */
    canSkipGuide() {
        return !!this.getSkippableStep();
    },

    /** Desktop/mobile floating Skip while onboarding spotlight is on screen. */
    shouldShowSkipOverlay() {
        if (typeof Game === 'undefined' || Game.state !== 'NEXUS') return false;
        if (Game.showPauseMenu) return false;
        return this.canSkipGuide() && this.isSpotlightActive();
    },

    /**
     * Escape hatch: dismiss only the current coach step.
     * Later steps stay for normal progression. Used by pause menu + Skip overlay.
     */
    skipGuide() {
        const step = this.getSkippableStep();
        if (!step) return false;

        if (step === this.STEPS.SELECT_CLASS) {
            // Need a class so portal / upgrades work
            if (typeof Game !== 'undefined' && !Game.selectedClass) {
                Game.selectedClass = 'square';
                if (Game.player && typeof createPlayer === 'function') {
                    const x = Game.player.x;
                    const y = Game.player.y;
                    const pid = Game.player.playerId;
                    Game.player = createPlayer('square', x, y);
                    Game.player.playerId = pid || null;
                }
            }
            this.notifyClassSelected();
            console.log('[Onboarding] Skipped current step: selectClass');
        } else if (step === this.STEPS.LAUNCH_RUN) {
            // Only open the portal gate - first-run / class-upgrades still await a real run
            this.patch({ launchRunDone: true });
            if (typeof CoachTransition !== 'undefined' && CoachTransition.clear) {
                CoachTransition.clear();
            }
            console.log('[Onboarding] Skipped current step: launchRun');
        } else if (step === this.STEPS.CLASS_UPGRADES) {
            // Same completion as opening a station, without requiring interact arming
            const fromRect = this._targetSpotlightRect();
            this.patch({ classUpgradesDone: true });
            this._classUpgradesArmedAt = 0;
            const nextStep = this.getStep();
            if (nextStep === this.STEPS.MODE_SWITCH) {
                this.prepareModeSwitchStep(fromRect);
            } else {
                this.markComplete();
                let handedOff = false;
                if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.continueFrom) {
                    handedOff = !!FeatureTutorials.continueFrom(fromRect);
                } else if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.onNexusEnter) {
                    FeatureTutorials.onNexusEnter();
                    handedOff = typeof FeatureTutorials.getCurrentId === 'function'
                        && !!FeatureTutorials.getCurrentId();
                }
                if (!handedOff) {
                    if (typeof CoachTransition !== 'undefined' && CoachTransition.clear) {
                        CoachTransition.clear();
                    }
                    this.maybeShowDeferredUpdateModal();
                }
            }
            console.log('[Onboarding] Skipped current step: classUpgrades');
        } else if (step === this.STEPS.MODE_SWITCH) {
            const fromRect = this._targetSpotlightRect();
            this.patch({ modeSwitchDone: true });
            this.markComplete();
            this._modeSwitchArmedAt = 0;
            let handedOff = false;
            if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.continueFrom) {
                handedOff = !!FeatureTutorials.continueFrom(fromRect);
            } else if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.onNexusEnter) {
                FeatureTutorials.onNexusEnter();
                handedOff = typeof FeatureTutorials.getCurrentId === 'function'
                    && !!FeatureTutorials.getCurrentId();
            }
            if (!handedOff) {
                if (typeof CoachTransition !== 'undefined' && CoachTransition.clear) {
                    CoachTransition.clear();
                }
                this.maybeShowDeferredUpdateModal();
            }
            console.log('[Onboarding] Skipped current step: modeSwitch');
        } else {
            return false;
        }

        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast('Guide step skipped', 2200);
        }
        return true;
    },

    /** Forced modal that cannot be dismissed without completing. */
    isForcedModalActive() {
        if (this.isSuspended() || this.isComplete()) return false;
        const step = this.getStep();
        return step === this.STEPS.PRIVACY || step === this.STEPS.CONTROLS;
    },

    /**
     * Interaction allowlist for nexus hard-gates.
     * Types: 'class' | 'portal' | 'upgrade' | 'gearUpgrade' | 'indexMachine' | 'modeSwitcher'
     */
    allowsInteraction(type) {
        if (this.isSuspended() || this.isComplete()) return true;
        if (typeof Game === 'undefined' || Game.state !== 'NEXUS') return true;

        const step = this.getStep();
        if (!step || step === this.STEPS.COMPLETE) return true;
        if (step === this.STEPS.PRIVACY || step === this.STEPS.CONTROLS) return false;

        if (step === this.STEPS.SELECT_CLASS) {
            return type === 'class';
        }
        if (step === this.STEPS.LAUNCH_RUN) {
            return type === 'portal' || type === 'class';
        }
        if (step === this.STEPS.CLASS_UPGRADES) {
            return type === 'upgrade';
        }
        if (step === this.STEPS.MODE_SWITCH) {
            return type === 'modeSwitcher';
        }
        return true;
    },

    getCoachCopy() {
        const step = this.getStep();
        const hint = (action) => (Engine.Input && typeof Engine.Input.getInteractionPrompt === 'function')
            ? Engine.Input.getInteractionPrompt(action)
            : `Press G to ${action}`;
        if (step === this.STEPS.SELECT_CLASS) {
            return {
                title: 'Welcome',
                body: `Walk to a class pedestal. ${hint('select')}.`
            };
        }
        if (step === this.STEPS.LAUNCH_RUN) {
            return {
                title: 'Start a run',
                body: `Enter the portal to begin. ${hint('enter portal')}.`
            };
        }
        if (step === this.STEPS.CLASS_UPGRADES) {
            const skipHint = (Engine.Input && Engine.Input.controlMode === 'gamepad')
                ? 'Stuck? Pause → Skip Guide'
                : 'Stuck? Use Skip Guide';
            return {
                title: 'Class upgrades',
                body: `Walk left and open an UPGRADES station (${hint('upgrade')}). Opening continues - Credits optional. ${skipHint}`
            };
        }
        if (step === this.STEPS.MODE_SWITCH) {
            const skipHint = (Engine.Input && Engine.Input.controlMode === 'gamepad')
                ? 'Stuck? Pause → Skip Guide'
                : 'Stuck? Use Skip Guide';
            return {
                title: 'Mode Switcher',
                body: `Walk to the Mode Switcher above the portal. ${hint('switch mode')}.`
            };
        }
        return null;
    },

    /** World-space AABB for current spotlight cutout (+ padding). Target rect only. */
    _targetSpotlightRect() {
        const step = this.getStep();
        const pad = 36;

        if (step === this.STEPS.SELECT_CLASS && typeof classStations !== 'undefined') {
            return this._aabbFromPoints(classStations.map(s => ({ x: s.x, y: s.y })), 90, 50, pad);
        }
        if (step === this.STEPS.LAUNCH_RUN && typeof nexusRoom !== 'undefined' && nexusRoom && nexusRoom.portalPos) {
            const p = nexusRoom.portalPos;
            const r = (p.radius || 50) + 48;
            return {
                x: p.x - r - pad,
                y: p.y - r - pad - 50,
                w: (r + pad) * 2,
                h: (r + pad) * 2 + 70
            };
        }
        if (step === this.STEPS.CLASS_UPGRADES && typeof upgradeStations !== 'undefined') {
            return this._aabbFromPoints(upgradeStations.map(s => ({ x: s.x, y: s.y })), 78, 58, pad);
        }
        if (step === this.STEPS.MODE_SWITCH && typeof nexusRoom !== 'undefined' && nexusRoom && nexusRoom.modeSwitcherPos) {
            const p = nexusRoom.modeSwitcherPos;
            const halfW = (p.width || 120) / 2;
            const halfH = (p.height || 80) / 2;
            return {
                x: p.x - halfW - pad,
                y: p.y - halfH - pad - 20,
                w: (halfW + pad) * 2,
                h: (halfH + pad) * 2 + 40
            };
        }
        return null;
    },

    getSpotlightRect() {
        const target = this._targetSpotlightRect();
        if (!target) return null;
        if (typeof CoachTransition !== 'undefined' && CoachTransition.isActive()) {
            return CoachTransition.getRect(target);
        }
        return target;
    },

    _aabbFromPoints(points, halfW, halfH, pad) {
        if (!points || !points.length) return null;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x - halfW);
            minY = Math.min(minY, p.y - halfH);
            maxX = Math.max(maxX, p.x + halfW);
            maxY = Math.max(maxY, p.y + halfH);
        }
        return {
            x: minX - pad,
            y: minY - pad,
            w: (maxX - minX) + pad * 2,
            h: (maxY - minY) + pad * 2
        };
    },

    /** Camera target override while spotlight is active. */
    getCameraOverride() {
        if (!this.isSpotlightActive()) return null;
        if (typeof CoachTransition !== 'undefined' && CoachTransition.isActive()) {
            return null; // target already set by CoachTransition
        }
        const rect = this._targetSpotlightRect();
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

    // --- Advance hooks ---

    notifyPrivacyDone() {
        // Flags already set by SaveSystem in handlePrivacyChoice
        this.syncBootModals();
    },

    notifyControlsDone() {
        if (typeof SaveSystem !== 'undefined' && SaveSystem.setHasSeenLaunchModal) {
            SaveSystem.setHasSeenLaunchModal(true);
        }
        if (typeof Game !== 'undefined') {
            Game.launchModalVisible = false;
        }
        this.maybeShowDeferredUpdateModal();
    },

    notifyClassSelected() {
        if (this.isSuspended()) return;
        const p = this.getProgress();
        if (p.selectClassDone) return;
        const fromRect = this._targetSpotlightRect();
        this.patch({ selectClassDone: true });
        const toRect = this._targetSpotlightRect();
        if (fromRect && toRect && typeof CoachTransition !== 'undefined') {
            CoachTransition.start(fromRect, toRect, { snapCamera: false });
        }
    },

    notifyRunStarted() {
        if (this.isSuspended()) return;
        const p = this.getProgress();
        const next = { launchRunDone: true, firstRunStarted: true };
        if (!p.selectClassDone) next.selectClassDone = true;
        this.patch(next);
        if (typeof CoachTransition !== 'undefined') {
            CoachTransition.clear();
        }
    },

    /** True once the class-upgrades coach has been visible long enough to accept completion. */
    isClassUpgradesArmed() {
        if (this.getStep() !== this.STEPS.CLASS_UPGRADES) return true;
        if (!this._classUpgradesArmedAt) return false;
        return Date.now() >= this._classUpgradesArmedAt;
    },

    notifyClassUpgradeOpened() {
        if (this.isSuspended()) return;
        const p = this.getProgress();
        if (p.classUpgradesDone) return;
        // Ignore accidental interact while still spawning / camera snapping into the step
        if (!this.isClassUpgradesArmed()) {
            console.log('[Onboarding] Class upgrade interact ignored until coach is armed');
            return;
        }
        // Capture cutout BEFORE completing - next step needs a smooth handoff origin
        const fromRect = this._targetSpotlightRect();
        this.patch({ classUpgradesDone: true });

        const nextStep = this.getStep();
        if (nextStep === this.STEPS.MODE_SWITCH) {
            this.prepareModeSwitchStep(fromRect);
            return;
        }

        this.markComplete();
        this._classUpgradesArmedAt = 0;

        let handedOff = false;
        if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.continueFrom) {
            handedOff = !!FeatureTutorials.continueFrom(fromRect);
        } else if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.onNexusEnter) {
            setTimeout(() => FeatureTutorials.onNexusEnter(), 0);
            handedOff = typeof FeatureTutorials.getCurrentId === 'function'
                && !!FeatureTutorials.getCurrentId();
        }

        // Patch notes wait until feature-tutorial queue is also idle
        if (!handedOff) {
            this.maybeShowDeferredUpdateModal();
        }
    },

    /** True once the mode-switch coach has been visible long enough to accept completion. */
    isModeSwitchArmed() {
        if (this.getStep() !== this.STEPS.MODE_SWITCH) return true;
        if (!this._modeSwitchArmedAt) return false;
        return Date.now() >= this._modeSwitchArmedAt;
    },

    notifyModeSwitchOpened() {
        if (this.isSuspended()) return;
        const p = this.getProgress();
        if (p.modeSwitchDone) return;
        // Ignore accidental interact while still spawning / camera snapping into the step
        if (!this.isModeSwitchArmed()) {
            console.log('[Onboarding] Mode switch interact ignored until coach is armed');
            return;
        }
        // Capture cutout BEFORE completing - next step needs a smooth handoff origin
        const fromRect = this._targetSpotlightRect();
        this.patch({ modeSwitchDone: true });
        this.markComplete();
        this._modeSwitchArmedAt = 0;

        let handedOff = false;
        if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.continueFrom) {
            handedOff = !!FeatureTutorials.continueFrom(fromRect);
        } else if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.onNexusEnter) {
            setTimeout(() => FeatureTutorials.onNexusEnter(), 0);
            handedOff = typeof FeatureTutorials.getCurrentId === 'function'
                && !!FeatureTutorials.getCurrentId();
        }

        // Patch notes wait until feature-tutorial queue is also idle
        if (!handedOff) {
            this.maybeShowDeferredUpdateModal();
        }
        console.log('[Onboarding] Completed modeSwitch step');
    },

    markComplete() {
        const version = (typeof SaveSystem !== 'undefined' && SaveSystem.ONBOARDING_TUTORIAL_VERSION)
            ? SaveSystem.ONBOARDING_TUTORIAL_VERSION
            : 1;
        this.patch({
            complete: true,
            classUpgradesDone: true,
            modeSwitchDone: true,
            tutorialVersion: version
        });
    },

    suspendForMultiplayer() {
        this._sessionSuspended = true;
        this.patch({ suspendedForMp: true });
        if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.suspendForMultiplayer) {
            FeatureTutorials.suspendForMultiplayer();
        }
        if (typeof Game !== 'undefined') {
            // Clear forced modals that would block lobby UI (keep privacy ack / flags intact)
            if (Game.launchModalVisible && this.getProgress().selectClassDone === false) {
                // Don't auto-skip controls permanently - just hide for lobbies
            }
            // Always clear canvas gates by session suspend; leave persisted step flags alone
        }
        console.log('[Onboarding] Suspended for multiplayer');
    },

    resumeFromMultiplayer() {
        this._sessionSuspended = false;
        this.patch({ suspendedForMp: false });
        console.log('[Onboarding] Resumed after multiplayer');
        this.syncBootModals();
        if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.resumeFromMultiplayer) {
            FeatureTutorials.resumeFromMultiplayer();
        }
    },

    /**
     * Boot / nexus enter: open forced modals for incomplete early steps;
     * queue update modal until onboarding is done.
     */
    syncBootModals() {
        if (typeof Game === 'undefined') return;
        if (this.isSuspended()) return;

        if (this.isComplete()) {
            this.maybeShowDeferredUpdateModal();
            return;
        }

        const step = this.getStep();
        if (step === this.STEPS.PRIVACY) {
            if (!Game.privacyModalVisible && Game.openPrivacyModal) {
                Game.openPrivacyModal('onboarding');
            }
            return;
        }
        if (step === this.STEPS.CONTROLS) {
            Game.launchModalVisible = true;
            return;
        }
        // Spotlight steps: ensure modals closed
        if (Game.privacyModalVisible && Game.privacyModalContext === 'onboarding') {
            // stay until acknowledged
        }
    },

    deferUpdateModal() {
        this._deferredUpdateModal = true;
        if (typeof Game !== 'undefined') {
            Game.updateModalVisible = false;
        }
    },

    maybeShowDeferredUpdateModal() {
        if (!this._deferredUpdateModal) return;
        // Still mid first-run coach
        if (!this.isComplete()) return;
        // Still introducing unlocked machines - don't interrupt the queue
        if (typeof FeatureTutorials !== 'undefined') {
            if (FeatureTutorials.isSpotlightActive && FeatureTutorials.isSpotlightActive()) return;
            if (FeatureTutorials.getCurrentId && FeatureTutorials.getCurrentId()) return;
        }
        this._deferredUpdateModal = false;
        if (typeof SaveSystem !== 'undefined' && SaveSystem.shouldShowUpdateModal && SaveSystem.shouldShowUpdateModal()) {
            if (typeof Game !== 'undefined') Game.updateModalVisible = true;
        }
    },

    onNexusEnter() {
        if (this.isMultiplayerActive()) {
            this.suspendForMultiplayer();
            return;
        }
        if (this.getProgress().suspendedForMp && !this.isMultiplayerActive()) {
            this.resumeFromMultiplayer();
        }
        this.syncBootModals();
        
        const step = this.getStep();
        if (step === this.STEPS.CLASS_UPGRADES) {
            this.prepareClassUpgradesStep();
        } else if (step === this.STEPS.MODE_SWITCH) {
            this.prepareModeSwitchStep();
        }
    },

    /**
     * Post-run class-upgrades coach: stage the player away from the upgrade
     * column (default nexus spawn sits inside it) and snap the camera to the cutout.
     * Gear/rarity unlocks do not advance or skip this step.
     */
    prepareClassUpgradesStep() {
        if (typeof Game === 'undefined' || Game.state !== 'NEXUS') return;
        if (this.isSuspended() || this.isComplete()) return;
        if (this.getStep() !== this.STEPS.CLASS_UPGRADES) return;

        // Staging spot: east of the upgrade columns, west of the portal - must walk left to interact
        const stageX = 620;
        const stageY = 600;
        if (Game.player) {
            Game.player.x = stageX;
            Game.player.y = stageY;
        }

        const toRect = this._targetSpotlightRect();
        if (toRect && typeof CoachTransition !== 'undefined') {
            const armMs = CoachTransition.start(null, toRect, { snapCamera: false });
            this._classUpgradesArmedAt = Date.now() + Math.max(armMs, 150);
        } else {
            const cam = this.getCameraOverride();
            if (cam && Game.nexusCamera) {
                Game.nexusCamera.targetX = cam.x;
                Game.nexusCamera.targetY = cam.y;
            }
            this._classUpgradesArmedAt = Date.now() + 150;
        }

        if (typeof Game.lastGKeyState !== 'undefined') {
            Game.lastGKeyState = true;
        }

        console.log('[Onboarding] Class upgrades coach armed');
    },

    /**
     * Mode switcher coach: stage the player below the mode switcher machine
     * (default nexus spawn sits inside it) and snap/pan the camera to the cutout.
     */
    prepareModeSwitchStep(fromRect = null) {
        if (typeof Game === 'undefined' || Game.state !== 'NEXUS') return;
        if (this.isSuspended() || this.isComplete()) return;
        if (this.getStep() !== this.STEPS.MODE_SWITCH) return;

        // Stage player just below the mode switcher / above the portal
        if (!fromRect && Game.player) {
            Game.player.x = 900;
            Game.player.y = 480;
        }

        const toRect = this._targetSpotlightRect();
        if (toRect && typeof CoachTransition !== 'undefined') {
            const armMs = CoachTransition.start(fromRect || null, toRect, { snapCamera: false });
            this._modeSwitchArmedAt = Date.now() + Math.max(armMs, 150);
        } else {
            const cam = this.getCameraOverride();
            if (cam && Game.nexusCamera) {
                Game.nexusCamera.targetX = cam.x;
                Game.nexusCamera.targetY = cam.y;
            }
            this._modeSwitchArmedAt = Date.now() + 150;
        }

        if (typeof Game.lastGKeyState !== 'undefined') {
            Game.lastGKeyState = true;
        }

        console.log('[Onboarding] Mode switch coach armed');
    },

    // --- Render ---

    renderSpotlight(ctx) {
        if (!this.isSpotlightActive() || !ctx) return;
        if (typeof Game === 'undefined') return;

        const cam = Game.nexusCamera || { x: 0, y: 0 };
        const zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;

        const viewHalfW = (Game.config ? Game.config.width : 1920) / (2 * zoom);
        const viewHalfH = (Game.config ? Game.config.height : 1080) / (2 * zoom);
        const viewX = cam.x - viewHalfW;
        const viewY = cam.y - viewHalfH;
        const viewW = viewHalfW * 2;
        const viewH = viewHalfH * 2;

        const rect = this.getSpotlightRect();
        ctx.save();

        // Dim everywhere except the cutout (evenodd: outer rect minus hole)
        // NOTE: hole path must NOT call beginPath or it clears the outer rect.
        ctx.beginPath();
        ctx.rect(viewX - 40, viewY - 40, viewW + 80, viewH + 80);
        if (rect) {
            this._roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 12, { restart: false });
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.fill('evenodd');

        if (rect) {
            ctx.strokeStyle = '#ffdd55';
            ctx.lineWidth = 4;
            this._roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 12, { restart: true });
            ctx.stroke();
        }

        ctx.restore();
    },

    renderCoachCard(ctx) {
        if (!this.isSpotlightActive() || !ctx) return;
        if (typeof Game === 'undefined') return;

        const copy = this.getCoachCopy();
        if (!copy) return;

        const cam = Game.nexusCamera || { x: 0, y: 0 };
        const zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;
        const viewHalfW = (Game.config ? Game.config.width : 1920) / (2 * zoom);
        const viewHalfH = (Game.config ? Game.config.height : 1080) / (2 * zoom);
        const viewX = cam.x - viewHalfW;
        const viewY = cam.y - viewHalfH;
        const viewW = viewHalfW * 2;
        const viewH = viewHalfH * 2;
        const rect = this.getSpotlightRect();

        const isMobile = (Engine.Input && typeof Engine.Input.isMobileUiMode === 'function') ? Engine.Input.isMobileUiMode() : false;
        const padX = isMobile ? 14 : 18;
        const boxW = Math.min(isMobile ? 300 : 420, viewW - 40);
        const titleFont = isMobile ? 'bold 15px Orbitron' : 'bold 17px Orbitron';
        const bodyFont = isMobile ? '12px sans-serif' : '13px sans-serif';
        const lineHeight = isMobile ? 16 : 17;
        const titleH = isMobile ? 22 : 26;
        const topPad = 12;
        const gap = 6;
        const bottomPad = 12;
        // Keep clear of touch/controller HUD along the bottom
        const bottomSafe = isMobile ? 150 : 36;

        ctx.save();
        ctx.font = bodyFont;
        const lines = this._wrapText(ctx, copy.body, boxW - padX * 2);
        const boxH = topPad + titleH + gap + Math.max(1, lines.length) * lineHeight + bottomPad;

        let bx = cam.x - boxW / 2;
        let by = viewY + 36;

        if (rect) {
            bx = rect.x + rect.w / 2 - boxW / 2;
            by = rect.y + rect.h + 16;
            const maxBy = viewY + viewH - boxH - bottomSafe;
            if (by > maxBy) {
                by = Math.max(viewY + 20, rect.y - boxH - 16);
            }
        }

        bx = Math.max(viewX + 12, Math.min(bx, viewX + viewW - boxW - 12));
        by = Math.max(viewY + 12, Math.min(by, viewY + viewH - boxH - bottomSafe));

        ctx.fillStyle = 'rgba(8, 10, 18, 0.96)';
        ctx.strokeStyle = '#ffdd55';
        ctx.lineWidth = 3;
        this._roundRectPath(ctx, bx, by, boxW, boxH, 8, { restart: true });
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
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    },

    /** Word-wrap helper for coach body copy. */
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

window.Onboarding = Onboarding;

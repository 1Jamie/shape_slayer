/**
 * Display & Viewport Manager for Shape Slayer.
 * Handles fullscreen states, orientation locking, and landscape overlays.
 */

const GameDisplayManager = {
    isNativeFullscreenActive() {
        return !!(document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement);
    },

    isFullscreenActive(game) {
        return this.isNativeFullscreenActive() || !!(game && game.pseudoFullscreenActive);
    },

    setupFullscreenListeners(game) {
        const fullscreenChange = () => {
            const isFullscreen = this.isNativeFullscreenActive();
            if (game) {
                game.fullscreenEnabled = isFullscreen || !!game.pseudoFullscreenActive;
            }

            console.log(`[FULLSCREEN] Changed to: ${isFullscreen}`);

            if (typeof SaveSystem !== 'undefined') {
                SaveSystem.setFullscreenPreference(isFullscreen);
            }

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (game && typeof game.setupResponsiveCanvas === 'function') {
                            game.setupResponsiveCanvas();
                        }

                        if (game && game.canvas) {
                            void game.canvas.offsetWidth;
                            void game.canvas.offsetHeight;
                            const rect = game.canvas.getBoundingClientRect();
                            console.log(`[FULLSCREEN] Canvas rect after resize: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)} at (${rect.left.toFixed(0)}, ${rect.top.toFixed(0)})`);
                        }

                        if (typeof Engine !== 'undefined' && Engine.Input && Engine.Input.isMobileUiMode && Engine.Input.isMobileUiMode()) {
                            if (Engine.Input.touchJoysticks) {
                                for (const joystick of Object.values(Engine.Input.touchJoysticks)) {
                                    if (joystick && joystick.active && joystick.touchId !== null) {
                                        joystick.endTouch(joystick.touchId);
                                    }
                                }
                                Engine.Input.touchJoysticks = {};
                            }
                            if (Engine.Input.touchButtons) {
                                for (const button of Object.values(Engine.Input.touchButtons)) {
                                    if (button && button.active && button.touchId !== null) {
                                        button.endTouch(button.touchId);
                                    }
                                }
                                Engine.Input.touchButtons = {};
                            }
                            if (Engine.Input.activeTouches) {
                                Engine.Input.activeTouches = {};
                            }
                            Engine.Input.touchActive = false;

                            setTimeout(() => {
                                if (game && game.canvas && typeof Engine !== 'undefined' && Engine.Input && Engine.Input.initTouchControls) {
                                    void game.canvas.offsetWidth;
                                    const rect = game.canvas.getBoundingClientRect();
                                    console.log(`[FULLSCREEN] Reinitializing controls, rect: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`);
                                    Engine.Input.initTouchControls(game.canvas);
                                    console.log('[FULLSCREEN] Touch controls reinitialized');
                                }
                            }, 100);
                        }

                        this.updatePortraitRotateOverlay(game);
                        this.lockLandscapeOrientation();
                    });
                });
            });
        };

        document.addEventListener('fullscreenchange', fullscreenChange);
        document.addEventListener('webkitfullscreenchange', fullscreenChange);
        document.addEventListener('mozfullscreenchange', fullscreenChange);
    },

    setupLandscapeMode(game) {
        this.ensurePortraitRotateOverlay(game);
        this.updatePortraitRotateOverlay(game);
        this.lockLandscapeOrientation();

        const refresh = () => {
            setTimeout(() => {
                this.updatePortraitRotateOverlay(game);
                this.lockLandscapeOrientation();
            }, 100);
        };

        window.addEventListener('orientationchange', refresh);
        window.addEventListener('resize', () => {
            this.updatePortraitRotateOverlay(game);
        });

        const lockOnGesture = () => {
            this.lockLandscapeOrientation();
        };
        ['pointerdown', 'touchstart', 'click'].forEach((eventType) => {
            window.addEventListener(eventType, lockOnGesture, { once: true, capture: true });
        });
    },

    ensurePortraitRotateOverlay(game) {
        if ((game && game._rotateOverlay) || typeof document === 'undefined') {
            return (game && game._rotateOverlay) || null;
        }

        const overlay = document.createElement('div');
        overlay.id = 'rotate-landscape-overlay';
        overlay.setAttribute('aria-live', 'polite');
        overlay.innerHTML = [
            '<div class="rotate-landscape-icon" aria-hidden="true"></div>',
            '<p>Rotate your device to landscape to play Shape Slayer.</p>'
        ].join('');
        document.body.appendChild(overlay);
        if (game) {
            game._rotateOverlay = overlay;
        }
        return overlay;
    },

    shouldForceLandscape() {
        if (typeof Engine === 'undefined' || !Engine.System) {
            return false;
        }
        if (Engine.System.isTv && Engine.System.isTv()) {
            return false;
        }
        if (Engine.System.isInstalledDisplayMode && Engine.System.isInstalledDisplayMode()) {
            return true;
        }
        return !!(Engine.System.isMobileDevice && Engine.System.isMobileDevice());
    },

    lockLandscapeOrientation() {
        if (!this.shouldForceLandscape()) {
            return Promise.resolve(false);
        }
        if (typeof Engine !== 'undefined' && Engine.System && Engine.System.isLandscapeUsableViewport && Engine.System.isLandscapeUsableViewport()) {
            return Promise.resolve(false);
        }
        if (typeof Engine === 'undefined' || !Engine.System || !Engine.System.lockLandscapeOrientation) {
            return Promise.resolve(false);
        }
        return Engine.System.lockLandscapeOrientation();
    },

    updatePortraitRotateOverlay(game) {
        const overlay = this.ensurePortraitRotateOverlay(game);
        if (!overlay) {
            return;
        }

        const forceLandscape = this.shouldForceLandscape();
        const landscapeUsable = (typeof Engine !== 'undefined' && Engine.System && Engine.System.isLandscapeUsableViewport)
            ? Engine.System.isLandscapeUsableViewport()
            : (typeof window !== 'undefined' && window.innerWidth >= window.innerHeight);

        const show = forceLandscape && !landscapeUsable;
        overlay.classList.toggle('is-visible', show);
        if (document.body) {
            document.body.classList.toggle('portrait-blocked', show);
        }
    },

    toggleFullscreen(game) {
        if (!game || typeof document === 'undefined') return;

        const nativeActive = this.isNativeFullscreenActive();
        const pseudoActive = !!(game && game.pseudoFullscreenActive);
        const currentlyFullscreen = nativeActive || pseudoActive;

        if (currentlyFullscreen) {
            // EXIT FULLSCREEN (both native and pseudo)
            if (pseudoActive) {
                game.pseudoFullscreenActive = false;
                if (document.body) document.body.classList.remove('pseudo-fullscreen');
            }

            if (nativeActive) {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.webkitCancelFullScreen) {
                    document.webkitCancelFullScreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }

            game.fullscreenEnabled = false;
            if (typeof SaveSystem !== 'undefined' && SaveSystem.setFullscreenPreference) {
                SaveSystem.setFullscreenPreference(false);
            }
            if (typeof game.setupResponsiveCanvas === 'function') {
                game.setupResponsiveCanvas();
            }
            if (typeof window.showToast === 'function') {
                window.showToast('Exited fullscreen', 2000);
            }
        } else {
            // ENTER FULLSCREEN
            const supportsNative = typeof Engine !== 'undefined' && Engine.System &&
                Engine.System.supportsElementFullscreen &&
                Engine.System.supportsElementFullscreen();

            if (!supportsNative) {
                // Fall back to pseudo-fullscreen (e.g. iOS Safari)
                game.pseudoFullscreenActive = true;
                if (document.body) document.body.classList.add('pseudo-fullscreen');
                game.fullscreenEnabled = true;
                if (typeof SaveSystem !== 'undefined' && SaveSystem.setFullscreenPreference) {
                    SaveSystem.setFullscreenPreference(true);
                }
                if (typeof game.setupResponsiveCanvas === 'function') {
                    game.setupResponsiveCanvas();
                }
                if (typeof window.showToast === 'function') {
                    window.showToast('Expanded to screen - add to Home Screen for true fullscreen on iOS', 2500);
                }
                return;
            }

            const element = document.documentElement || (game.canvas ? game.canvas.parentElement : null) || document.body;
            if (!element) return;

            let promise = null;
            if (element.requestFullscreen) {
                promise = element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                promise = element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                promise = element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                promise = element.msRequestFullscreen();
            }

            if (promise && typeof promise.catch === 'function') {
                promise.catch((err) => {
                    console.warn('[FULLSCREEN] Request rejected, falling back to pseudo-fullscreen:', err);
                    game.pseudoFullscreenActive = true;
                    if (document.body) document.body.classList.add('pseudo-fullscreen');
                    game.fullscreenEnabled = true;
                    if (typeof game.setupResponsiveCanvas === 'function') {
                        game.setupResponsiveCanvas();
                    }
                });
            }
        }
    }
};

if (typeof window !== 'undefined') {
    window.GameDisplayManager = GameDisplayManager;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameDisplayManager = GameDisplayManager;
}

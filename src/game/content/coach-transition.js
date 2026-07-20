// Shared coach spotlight transitions: lerp cutout + camera between steps (no hard jump).

const CoachTransition = {
    TRANSITION_MS: 1100,
    ARM_PADDING_MS: 500,
    CAMERA_SPEED_DURING: 5.5,

    /** World-space buffers so mobile (small viewport) keeps both subjects on-screen. */
    FOCUS_BUFFER: 48,
    PLAYER_BUFFER_DESKTOP: 70,
    PLAYER_BUFFER_MOBILE: 110,

    _active: null,
    _savedCameraSpeed: null,

    isActive() {
        return !!this._active;
    },

    _isMobile() {
        return (Engine.Input && typeof Engine.Input.isMobileUiMode === 'function') ? Engine.Input.isMobileUiMode() : false;
    },

    _viewHalfExtents() {
        if (typeof Game === 'undefined' || !Game.config) {
            return { halfW: 640, halfH: 360 };
        }
        const zoom = (typeof Game !== 'undefined' && Game.getViewZoom)
            ? Game.getViewZoom()
            : (this._isMobile() ? (Game.mobileZoom || 1.0) : (Game.baseZoom || 1.0));
        return {
            halfW: Game.config.width / (2 * zoom),
            halfH: Game.config.height / (2 * zoom)
        };
    },

    _playerBuffer() {
        return this._isMobile() ? this.PLAYER_BUFFER_MOBILE : this.PLAYER_BUFFER_DESKTOP;
    },

    /**
     * Camera center that keeps a focus rect AND the player on screen with buffers.
     * If the union is larger than the viewport, bias so the player stays inset.
     */
    frameCameraTarget(options = {}) {
        const focusRect = options.focusRect || null;
        const playerX = options.playerX;
        const playerY = options.playerY;
        const focusBuffer = options.focusBuffer != null ? options.focusBuffer : this.FOCUS_BUFFER;
        const playerBuffer = options.playerBuffer != null ? options.playerBuffer : this._playerBuffer();
        const view = options.viewHalfW != null
            ? { halfW: options.viewHalfW, halfH: options.viewHalfH }
            : this._viewHalfExtents();

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let hasFocus = false;

        if (focusRect && typeof focusRect.w === 'number') {
            hasFocus = true;
            minX = focusRect.x - focusBuffer;
            minY = focusRect.y - focusBuffer;
            maxX = focusRect.x + focusRect.w + focusBuffer;
            maxY = focusRect.y + focusRect.h + focusBuffer;
        }

        const hasPlayer = Number.isFinite(playerX) && Number.isFinite(playerY);
        if (hasPlayer) {
            const pMinX = playerX - playerBuffer;
            const pMinY = playerY - playerBuffer;
            const pMaxX = playerX + playerBuffer;
            const pMaxY = playerY + playerBuffer;
            if (!hasFocus) {
                minX = pMinX;
                minY = pMinY;
                maxX = pMaxX;
                maxY = pMaxY;
            } else {
                minX = Math.min(minX, pMinX);
                minY = Math.min(minY, pMinY);
                maxX = Math.max(maxX, pMaxX);
                maxY = Math.max(maxY, pMaxY);
            }
        }

        if (!Number.isFinite(minX)) {
            return null;
        }

        let camX = (minX + maxX) / 2;
        let camY = (minY + maxY) / 2;

        // Union larger than viewport: keep the player inset with a margin
        if (hasPlayer && view.halfW > 0 && view.halfH > 0) {
            const marginX = Math.min(playerBuffer, view.halfW * 0.4);
            const marginY = Math.min(playerBuffer, view.halfH * 0.4);
            const unionHalfW = (maxX - minX) / 2;
            const unionHalfH = (maxY - minY) / 2;
            if (unionHalfW > view.halfW) {
                camX = Math.min(
                    Math.max(camX, playerX - (view.halfW - marginX)),
                    playerX + (view.halfW - marginX)
                );
            }
            if (unionHalfH > view.halfH) {
                camY = Math.min(
                    Math.max(camY, playerY - (view.halfH - marginY)),
                    playerY + (view.halfH - marginY)
                );
            }
        }

        return { x: camX, y: camY };
    },

    /**
     * Start lerping the spotlight from `fromRect` to `toRect`.
     * Sets camera *target* framed around destination + player (does not snap unless snapCamera).
     * @returns {number} ms until interact should be armed
     */
    start(fromRect, toRect, options = {}) {
        if (!toRect || typeof toRect.w !== 'number') return 0;

        const now = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();

        let from = fromRect && typeof fromRect.w === 'number'
            ? this._copyRect(fromRect)
            : null;

        if (!from && typeof Game !== 'undefined' && Game.nexusCamera) {
            // Expand from a small hole at the current camera center
            const cx = Game.nexusCamera.x;
            const cy = Game.nexusCamera.y;
            from = { x: cx - 36, y: cy - 36, w: 72, h: 72 };
        }
        if (!from) from = this._copyRect(toRect);

        const duration = options.duration != null ? options.duration : this.TRANSITION_MS;
        this._active = {
            from,
            to: this._copyRect(toRect),
            start: now,
            duration
        };

        if (typeof Game !== 'undefined' && Game.nexusCamera) {
            const player = Game.player;
            const framed = this.frameCameraTarget({
                focusRect: toRect,
                playerX: player ? player.x : null,
                playerY: player ? player.y : null
            }) || {
                x: toRect.x + toRect.w / 2,
                y: toRect.y + toRect.h / 2
            };
            Game.nexusCamera.targetX = framed.x;
            Game.nexusCamera.targetY = framed.y;
            if (options.snapCamera) {
                Game.nexusCamera.x = framed.x;
                Game.nexusCamera.y = framed.y;
            }
            if (this._savedCameraSpeed == null) {
                this._savedCameraSpeed = Game.nexusCamera.smoothSpeed;
            }
            Game.nexusCamera.smoothSpeed = this.CAMERA_SPEED_DURING;
        }

        return duration + this.ARM_PADDING_MS;
    },

    /** Interpolated rect while active; otherwise `fallback`. */
    getRect(fallback) {
        if (!this._active) return fallback;

        const now = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
        const rawT = (now - this._active.start) / Math.max(1, this._active.duration);
        const t = Math.max(0, Math.min(1, rawT));
        const e = t * t * (3 - 2 * t); // smoothstep

        if (t >= 1) {
            this._finish();
            return fallback || this._active && this._active.to;
        }

        return this._lerpRect(this._active.from, this._active.to, e);
    },

    clear() {
        this._finish();
        this._active = null;
    },

    _finish() {
        if (typeof Game !== 'undefined' && Game.nexusCamera && this._savedCameraSpeed != null) {
            Game.nexusCamera.smoothSpeed = this._savedCameraSpeed;
            this._savedCameraSpeed = null;
        }
        this._active = null;
    },

    _copyRect(r) {
        return { x: r.x, y: r.y, w: r.w, h: r.h };
    },

    _lerpRect(a, b, t) {
        return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            w: a.w + (b.w - a.w) * t,
            h: a.h + (b.h - a.h) * t
        };
    }
};

if (typeof window !== 'undefined') {
    window.CoachTransition = CoachTransition;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CoachTransition };
}

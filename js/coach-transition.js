// Shared coach spotlight transitions: lerp cutout + camera between steps (no hard jump).

const CoachTransition = {
    TRANSITION_MS: 1100,
    ARM_PADDING_MS: 500,
    CAMERA_SPEED_DURING: 5.5,

    _active: null,
    _savedCameraSpeed: null,

    isActive() {
        return !!this._active;
    },

    /**
     * Start lerping the spotlight from `fromRect` to `toRect`.
     * Sets camera *target* to the destination (does not snap unless snapCamera).
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
            const cx = toRect.x + toRect.w / 2;
            const cy = toRect.y + toRect.h / 2;
            Game.nexusCamera.targetX = cx;
            Game.nexusCamera.targetY = cy;
            if (options.snapCamera) {
                Game.nexusCamera.x = cx;
                Game.nexusCamera.y = cy;
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

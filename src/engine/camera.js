/**
 * @typedef {Object} CameraOptions
 * @property {number} [x=0] Initial world X position
 * @property {number} [y=0] Initial world Y position
 * @property {number} [targetX] Initial target X position
 * @property {number} [targetY] Initial target Y position
 * @property {number} [offsetX=0] Dynamic lookahead offset X
 * @property {number} [offsetY=0] Dynamic lookahead offset Y
 * @property {number} [smoothSpeed=5] Lerp smoothing speed factor
 * @property {number} [offsetAmount=0] Max lookahead lead distance
 * @property {number} [deadzone=0] Velocity deadzone threshold
 * @property {number} [zoom=1] Zoom scale multiplier (> 0)
 * @property {number} [viewWidth=0] Viewport logical width in CSS pixels
 * @property {number} [viewHeight=0] Viewport logical height in CSS pixels
 *
 * @typedef {Object} CameraBounds
 * @property {number} [x] World X origin
 * @property {number} [y] World Y origin
 * @property {number} [width] World bounding width
 * @property {number} [height] World bounding height
 */

(function(root) {
    const Engine = root.Engine = root.Engine || {};

    /**
     * 2D World Camera tracker with smooth target lerp, velocity lookahead, and viewport projection.
     */
    class Camera {
        /**
         * @param {CameraOptions} [options]
         */
        constructor(options = {}) {
            this.x = Number.isFinite(options.x) ? options.x : 0;
            this.y = Number.isFinite(options.y) ? options.y : 0;
            this.targetX = Number.isFinite(options.targetX) ? options.targetX : this.x;
            this.targetY = Number.isFinite(options.targetY) ? options.targetY : this.y;
            this.offsetX = Number.isFinite(options.offsetX) ? options.offsetX : 0;
            this.offsetY = Number.isFinite(options.offsetY) ? options.offsetY : 0;
            this.smoothSpeed = Number.isFinite(options.smoothSpeed) ? options.smoothSpeed : 5;
            this.offsetAmount = Number.isFinite(options.offsetAmount) ? options.offsetAmount : 0;
            this.deadzone = Number.isFinite(options.deadzone) ? options.deadzone : 0;
            this.zoom = Number.isFinite(options.zoom) && options.zoom > 0 ? options.zoom : 1;
            this.viewWidth = Number.isFinite(options.viewWidth) ? options.viewWidth : 0;
            this.viewHeight = Number.isFinite(options.viewHeight) ? options.viewHeight : 0;
        }

        /**
         * Update logical viewport size.
         * @param {number} width
         * @param {number} height
         * @returns {Camera}
         */
        setViewSize(width, height) {
            this.viewWidth = Math.max(0, Number(width) || 0);
            this.viewHeight = Math.max(0, Number(height) || 0);
            return this;
        }

        /**
         * Set zoom scale factor.
         * @param {number} zoom
         * @returns {Camera}
         */
        setZoom(zoom) {
            if (Number.isFinite(zoom) && zoom > 0) this.zoom = zoom;
            return this;
        }

        /**
         * @returns {number} Current zoom level.
         */
        getZoom() {
            return this.zoom;
        }

        /**
         * Linear interpolation helper.
         * @param {number} from
         * @param {number} to
         * @param {number} amount
         * @returns {number}
         */
        lerp(from, to, amount) {
            return from + (to - from) * amount;
        }

        /**
         * Instantly snap camera position and target to world coordinates.
         * @param {number} x
         * @param {number} y
         * @returns {Camera}
         */
        snapTo(x, y) {
            this.x = Number(x) || 0;
            this.y = Number(y) || 0;
            this.targetX = this.x;
            this.targetY = this.y;
            this.offsetX = 0;
            this.offsetY = 0;
            return this;
        }

        /**
         * Set target focus coordinates for smooth lerping.
         * @param {number} x
         * @param {number} y
         * @returns {Camera}
         */
        setTarget(x, y) {
            this.targetX = Number(x) || 0;
            this.targetY = Number(y) || 0;
            return this;
        }

        /**
         * Update velocity lookahead offsets.
         * @param {number} vx Velocity X
         * @param {number} vy Velocity Y
         * @param {{deadzone?: number, amount?: number, fullSpeed?: number, decay?: number}} [options]
         * @returns {Camera}
         */
        updateOffset(vx, vy, options = {}) {
            const speed = Math.hypot(vx || 0, vy || 0);
            const threshold = Number.isFinite(options.deadzone) ? options.deadzone : this.deadzone;
            const amount = Number.isFinite(options.amount) ? options.amount : this.offsetAmount;
            const fullSpeed = Math.max(1, Number(options.fullSpeed) || 300);

            if (speed > threshold) {
                const scale = Math.min(speed / fullSpeed, 1);
                this.offsetX = (vx / speed) * amount * scale;
                this.offsetY = (vy / speed) * amount * scale;
            } else {
                const decay = Number.isFinite(options.decay) ? options.decay : 0.9;
                this.offsetX *= decay;
                this.offsetY *= decay;
                if (Math.abs(this.offsetX) < 0.1) this.offsetX = 0;
                if (Math.abs(this.offsetY) < 0.1) this.offsetY = 0;
            }
            return this;
        }

        /**
         * Smoothly follow a target entity subject.
         * @param {{x: number, y: number, vx?: number, vy?: number}} subject Target entity
         * @param {number} deltaTime Delta time in seconds
         * @param {CameraBounds} [bounds] World clamp bounds
         * @param {{deadzone?: number, amount?: number, fullSpeed?: number, decay?: number}} [options] Lookahead options
         * @returns {Camera}
         */
        follow(subject, deltaTime, bounds, options = {}) {
            if (!subject) return this;
            this.updateOffset(subject.vx || 0, subject.vy || 0, options);
            this.setTarget(subject.x + this.offsetX, subject.y + this.offsetY);
            if (bounds) this.clampToBounds(bounds);
            return this.update(deltaTime);
        }

        /**
         * Clamp target position to stay within world bounds.
         * @param {CameraBounds} bounds
         * @returns {Camera}
         */
        clampToBounds(bounds) {
            if (!bounds) return this;
            const width = Math.max(0, Number(bounds.width) || 0);
            const height = Math.max(0, Number(bounds.height) || 0);
            const halfWidth = this.viewWidth / (2 * this.zoom);
            const halfHeight = this.viewHeight / (2 * this.zoom);

            this.targetX = width <= halfWidth * 2
                ? width / 2
                : Math.max(halfWidth, Math.min(width - halfWidth, this.targetX));
            this.targetY = height <= halfHeight * 2
                ? height / 2
                : Math.max(halfHeight, Math.min(height - halfHeight, this.targetY));
            return this;
        }

        /**
         * Step camera smoothing lerp.
         * @param {number} deltaTime Delta time in seconds
         * @returns {Camera}
         */
        update(deltaTime) {
            const amount = 1 - Math.exp(-this.smoothSpeed * Math.max(0, deltaTime || 0));
            this.x = this.lerp(this.x, this.targetX, amount);
            this.y = this.lerp(this.y, this.targetY, amount);
            return this;
        }

        /**
         * Convert screen canvas coordinates to world coordinates.
         * @param {number} screenX
         * @param {number} screenY
         * @param {{x?: number, y?: number}|null} [offset=null] Viewport offset
         * @param {{x: number, y: number}|null} [out=null] Zero-allocation out target point
         * @returns {{x: number, y: number}}
         */
        screenToWorld(screenX, screenY, offset = null, out = null) {
            const dx = offset && Number.isFinite(offset.x) ? offset.x : 0;
            const dy = offset && Number.isFinite(offset.y) ? offset.y : 0;
            const wx = this.x + (screenX - this.viewWidth / 2 - dx) / this.zoom;
            const wy = this.y + (screenY - this.viewHeight / 2 - dy) / this.zoom;
            if (out && typeof out === 'object') {
                out.x = wx;
                out.y = wy;
                return out;
            }
            return { x: wx, y: wy };
        }

        /**
         * Convert world coordinates to screen canvas coordinates.
         * @param {number} worldX
         * @param {number} worldY
         * @param {{x?: number, y?: number}|null} [offset=null] Viewport offset
         * @param {{x: number, y: number}|null} [out=null] Zero-allocation out target point
         * @returns {{x: number, y: number}}
         */
        worldToScreen(worldX, worldY, offset = null, out = null) {
            const dx = offset && Number.isFinite(offset.x) ? offset.x : 0;
            const dy = offset && Number.isFinite(offset.y) ? offset.y : 0;
            const sx = (worldX - this.x) * this.zoom + this.viewWidth / 2 + dx;
            const sy = (worldY - this.y) * this.zoom + this.viewHeight / 2 + dy;
            if (out && typeof out === 'object') {
                out.x = sx;
                out.y = sy;
                return out;
            }
            return { x: sx, y: sy };
        }

        /**
         * Get current visible world bounding box.
         * @param {number} [margin=0] Extra padding margin around viewport
         * @param {{x?: number, y?: number}|null} [offset=null] Viewport offset
         * @param {{x: number, y: number, width: number, height: number}|null} [out=null] Zero-allocation out box
         * @returns {{x: number, y: number, width: number, height: number}}
         */
        viewBounds(margin = 0, offset = null, out = null) {
            const padding = Math.max(0, Number(margin) || 0);
            const halfWidth = this.viewWidth / (2 * this.zoom);
            const halfHeight = this.viewHeight / (2 * this.zoom);
            const offsetX = offset && Number.isFinite(offset.x) ? Math.abs(offset.x) : 0;
            const offsetY = offset && Number.isFinite(offset.y) ? Math.abs(offset.y) : 0;
            const extraPaddingX = padding + offsetX;
            const extraPaddingY = padding + offsetY;
            const bx = this.x - halfWidth - extraPaddingX;
            const by = this.y - halfHeight - extraPaddingY;
            const bw = halfWidth * 2 + extraPaddingX * 2;
            const bh = halfHeight * 2 + extraPaddingY * 2;
            if (out && typeof out === 'object') {
                out.x = bx;
                out.y = by;
                out.width = bw;
                out.height = bh;
                return out;
            }
            return { x: bx, y: by, width: bw, height: bh };
        }

        /**
         * Check if world point is within current visible camera viewport.
         * @param {number} x World X coordinate
         * @param {number} y World Y coordinate
         * @param {number} [margin=0] Padding margin
         * @param {{x?: number, y?: number}|null} [offset=null] Viewport offset
         * @returns {boolean}
         */
        inView(x, y, margin = 0, offset = null) {
            const padding = Math.max(0, Number(margin) || 0);
            const halfWidth = this.viewWidth / (2 * this.zoom);
            const halfHeight = this.viewHeight / (2 * this.zoom);
            const offsetX = offset && Number.isFinite(offset.x) ? Math.abs(offset.x) : 0;
            const offsetY = offset && Number.isFinite(offset.y) ? Math.abs(offset.y) : 0;
            const minX = this.x - halfWidth - padding - offsetX;
            const maxX = this.x + halfWidth + padding + offsetX;
            const minY = this.y - halfHeight - padding - offsetY;
            const maxY = this.y + halfHeight + padding + offsetY;
            return x >= minX && x <= maxX && y >= minY && y <= maxY;
        }
    }

    Engine.Camera = Camera;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Camera;
    }
})(typeof window !== 'undefined' ? window : globalThis);

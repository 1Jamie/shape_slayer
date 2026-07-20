(function(root) {
    const Engine = root.Engine = root.Engine || {};

    class Camera {
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

        setViewSize(width, height) {
            this.viewWidth = Math.max(0, Number(width) || 0);
            this.viewHeight = Math.max(0, Number(height) || 0);
            return this;
        }

        setZoom(zoom) {
            if (Number.isFinite(zoom) && zoom > 0) this.zoom = zoom;
            return this;
        }

        getZoom() {
            return this.zoom;
        }

        lerp(from, to, amount) {
            return from + (to - from) * amount;
        }

        snapTo(x, y) {
            this.x = Number(x) || 0;
            this.y = Number(y) || 0;
            this.targetX = this.x;
            this.targetY = this.y;
            this.offsetX = 0;
            this.offsetY = 0;
            return this;
        }

        setTarget(x, y) {
            this.targetX = Number(x) || 0;
            this.targetY = Number(y) || 0;
            return this;
        }

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

        follow(subject, deltaTime, bounds, options = {}) {
            if (!subject) return this;
            this.updateOffset(subject.vx || 0, subject.vy || 0, options);
            this.setTarget(subject.x + this.offsetX, subject.y + this.offsetY);
            if (bounds) this.clampToBounds(bounds);
            return this.update(deltaTime);
        }

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

        update(deltaTime) {
            const amount = 1 - Math.exp(-this.smoothSpeed * Math.max(0, deltaTime || 0));
            this.x = this.lerp(this.x, this.targetX, amount);
            this.y = this.lerp(this.y, this.targetY, amount);
            return this;
        }

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

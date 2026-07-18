(function(root) {
    const Engine = root.Engine = root.Engine || {};

    const Touch = {
        theme: {
            accent: '#ffffff',
            surface: 'rgba(0, 0, 0, 0.45)',
            muted: 'rgba(255, 255, 255, 0.35)',
            danger: 'rgba(255, 255, 255, 0.25)',
            text: '#ffffff',
            font: 'bold 12px sans-serif'
        },
        hooks: {},

        configure(options = {}) {
            if (options.theme) this.theme = Object.assign({}, this.theme, options.theme);
            if (options.hooks) this.hooks = Object.assign({}, this.hooks, options.hooks);
            return this;
        },

        resolveTheme(options) {
            if (typeof this.hooks.resolveTheme === 'function') {
                return Object.assign({}, this.theme, this.hooks.resolveTheme(options || {}));
            }
            return this.theme;
        },

        pulse(duration) {
            if (typeof this.hooks.haptic === 'function') {
                this.hooks.haptic(duration);
            }
        }
    };

    function now() {
        return typeof performance !== 'undefined' && performance.now
            ? performance.now()
            : Date.now();
    }

    class VirtualJoystick {
        constructor(x, y, radius = 60, deadZoneRadius = 15) {
            this.centerX = x;
            this.centerY = y;
            this.radius = radius;
            this.deadZoneRadius = deadZoneRadius;
            this.active = false;
            this.touchId = null;
            this.currentX = x;
            this.currentY = y;
            this.angle = 0;
            this.magnitude = 0;
            this._snapDecay = 18;
            this._lastInteractionAt = now();
        }

        startTouch(touchId, x, y, restrictedHitArea = false) {
            const distance = Math.hypot(x - this.centerX, y - this.centerY);
            const hitRadius = typeof restrictedHitArea === 'number'
                ? restrictedHitArea
                : (restrictedHitArea ? this.radius : this.radius * 1.3);
            if (distance > hitRadius) return false;

            this.active = true;
            this.touchId = touchId;
            this._lastInteractionAt = now();
            Touch.pulse(6);
            this.updateTouch(touchId, x, y);
            return true;
        }

        updateTouch(touchId, x, y) {
            if (!this.active || this.touchId !== touchId) return;
            this._lastInteractionAt = now();
            const dx = x - this.centerX;
            const dy = y - this.centerY;
            const distance = Math.hypot(dx, dy);
            const scale = distance > this.radius && distance > 0 ? this.radius / distance : 1;
            this.currentX = this.centerX + dx * scale;
            this.currentY = this.centerY + dy * scale;
            this.angle = Math.atan2(dy, dx);

            const effectiveDistance = Math.hypot(
                this.currentX - this.centerX,
                this.currentY - this.centerY
            );
            const usableRange = Math.max(1, this.radius - this.deadZoneRadius);
            this.magnitude = effectiveDistance <= this.deadZoneRadius
                ? 0
                : Math.min(1, (effectiveDistance - this.deadZoneRadius) / usableRange);
        }

        endTouch(touchId) {
            if (this.touchId !== touchId) return;
            this.active = false;
            this.touchId = null;
            this.magnitude = 0;
        }

        update(deltaTime) {
            if (this.active) return;
            const amount = 1 - Math.exp(-this._snapDecay * (deltaTime || 0.016));
            this.currentX += (this.centerX - this.currentX) * amount;
            this.currentY += (this.centerY - this.currentY) * amount;
            if (Math.hypot(this.centerX - this.currentX, this.centerY - this.currentY) < 0.5) {
                this.currentX = this.centerX;
                this.currentY = this.centerY;
            }
            this.magnitude = 0;
        }

        getDirection() {
            return this.magnitude === 0
                ? { x: 0, y: 0 }
                : { x: Math.cos(this.angle), y: Math.sin(this.angle) };
        }

        getMagnitude() {
            return this.magnitude;
        }

        getAngle() {
            return this.angle;
        }

        render(ctx, options = {}) {
            if (typeof Touch.hooks.drawJoystick === 'function') {
                Touch.hooks.drawJoystick(ctx, this, options, Touch.resolveTheme(options));
                return;
            }
            const theme = Touch.resolveTheme(options);
            ctx.save();
            ctx.fillStyle = theme.surface;
            ctx.strokeStyle = this.active ? theme.accent : theme.muted;
            ctx.lineWidth = this.active ? 3 : 2;
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = theme.accent;
            ctx.beginPath();
            ctx.arc(this.currentX, this.currentY, this.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    class TouchButton {
        constructor(x, y, width, height, label = '') {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.label = label;
            this.active = false;
            this.touchId = null;
            this.pressed = false;
            this.justPressed = false;
            this.justReleased = false;
            this.finalState = null;
            this._pressFlash = 0;
        }

        contains(x, y, padding = 8) {
            return x >= this.x - padding && x <= this.x + this.width + padding &&
                y >= this.y - padding && y <= this.y + this.height + padding;
        }

        containsExact(x, y) {
            return this.contains(x, y, 0);
        }

        startTouch(touchId, x, y) {
            if (!this.contains(x, y)) return false;
            this.active = true;
            this.touchId = touchId;
            if (!this.pressed) {
                this.pressed = true;
                this.justPressed = true;
                this._pressFlash = 0.18;
                Touch.pulse(8);
            }
            return true;
        }

        endTouch(touchId) {
            if (this.touchId !== touchId) return;
            this.active = false;
            this.touchId = null;
            if (this.pressed) {
                this.pressed = false;
                this.justReleased = true;
                this.finalState = {
                    pressed: true,
                    x: this.x + this.width / 2,
                    y: this.y + this.height / 2
                };
            }
        }

        update(deltaTime) {
            this.justPressed = false;
            this.justReleased = false;
            this._pressFlash = Math.max(0, this._pressFlash - (deltaTime || 0.016));
        }

        drawRoundedRect(ctx, x, y, width, height, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        }

        render(ctx, cooldown = 0, maxCooldown = 0, charges = null, options = {}) {
            if (typeof Touch.hooks.drawButton === 'function') {
                Touch.hooks.drawButton(
                    ctx,
                    this,
                    { cooldown, maxCooldown, charges, options },
                    Touch.resolveTheme(options)
                );
                return;
            }
            const theme = Touch.resolveTheme(options);
            const ratio = maxCooldown > 0 ? Math.max(0, Math.min(1, cooldown / maxCooldown)) : 0;
            ctx.save();
            ctx.fillStyle = theme.surface;
            ctx.strokeStyle = this.pressed ? theme.accent : theme.muted;
            ctx.lineWidth = this.pressed ? 3 : 2;
            this.drawRoundedRect(ctx, this.x, this.y, this.width, this.height, Math.min(this.width, this.height) / 2);
            ctx.fill();
            ctx.stroke();
            if (ratio > 0) {
                ctx.fillStyle = theme.danger;
                ctx.fillRect(this.x, this.y + this.height * (1 - ratio), this.width, this.height * ratio);
            }
            if (this.label) {
                ctx.fillStyle = theme.text;
                ctx.font = theme.font;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2);
            }
            ctx.restore();
        }
    }

    Touch.VirtualJoystick = VirtualJoystick;
    Touch.TouchButton = TouchButton;
    Engine.Touch = Touch;
    root.VirtualJoystick = VirtualJoystick;
    root.TouchButton = TouchButton;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Touch;
    }
})(typeof window !== 'undefined' ? window : globalThis);

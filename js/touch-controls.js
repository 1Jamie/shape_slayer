// Touch controls system - Virtual joysticks and touch input handling

// UI accent colour — matches the game's global blue theme used across all HUD elements
const UI_ACCENT = { r: 120, g: 160, b: 255 };

function _accentRgb(_playerClass) {
    return UI_ACCENT;
}

function _rgba(c, a) {
    return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function _now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function _pulseHaptic(duration = 8) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(duration);
    }
}

function _drawSpacedText(ctx, text, x, y, spacing = 1.2) {
    if (!text || text.length <= 1 || spacing <= 0) {
        ctx.fillText(text, x, y);
        return;
    }
    const chars = text.split('');
    const widths = chars.map(ch => ctx.measureText(ch).width);
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) + spacing * (chars.length - 1);
    let cursor = x - totalWidth / 2;
    for (let i = 0; i < chars.length; i++) {
        ctx.fillText(chars[i], cursor + widths[i] / 2, y);
        cursor += widths[i] + spacing;
    }
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

        // Exponential snapback — target ~80 ms to settle
        this._snapDecay = 18; // units: 1/second
        this._lastInteractionAt = _now();
    }

    startTouch(touchId, x, y, restrictedHitArea = false) {
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const hitRadius = typeof restrictedHitArea === 'number'
            ? restrictedHitArea
            : (restrictedHitArea ? this.radius : this.radius * 1.3);

        if (distance <= hitRadius) {
            this.active = true;
            this.touchId = touchId;
            this._lastInteractionAt = _now();
            _pulseHaptic(6);
            this.updateTouch(touchId, x, y);
            return true;
        }
        return false;
    }

    updateTouch(touchId, x, y) {
        if (!this.active || this.touchId !== touchId) return;
        this._lastInteractionAt = _now();

        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > this.radius) {
            const clampedDistance = this.radius;
            this.currentX = this.centerX + (dx / distance) * clampedDistance;
            this.currentY = this.centerY + (dy / distance) * clampedDistance;
        } else {
            this.currentX = x;
            this.currentY = y;
        }

        const effectiveDx = this.currentX - this.centerX;
        const effectiveDy = this.currentY - this.centerY;
        const effectiveDistance = Math.sqrt(effectiveDx * effectiveDx + effectiveDy * effectiveDy);

        this.angle = Math.atan2(effectiveDy, effectiveDx);

        if (effectiveDistance <= this.deadZoneRadius) {
            this.magnitude = 0;
        } else {
            const usableRange = this.radius - this.deadZoneRadius;
            this.magnitude = Math.min(1, (effectiveDistance - this.deadZoneRadius) / usableRange);
        }
    }

    endTouch(touchId) {
        if (this.touchId === touchId) {
            this.active = false;
            this.touchId = null;
            this.magnitude = 0;
        }
    }

    update(deltaTime) {
        if (!this.active) {
            const dx = this.centerX - this.currentX;
            const dy = this.centerY - this.currentY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0.5) {
                // Exponential ease-out: fast at first, decelerates to centre
                const t = 1 - Math.exp(-this._snapDecay * (deltaTime || 0.016));
                this.currentX += dx * t;
                this.currentY += dy * t;
            } else {
                this.currentX = this.centerX;
                this.currentY = this.centerY;
            }

            this.magnitude = 0;
        }
    }

    getDirection() {
        if (this.magnitude === 0) return { x: 0, y: 0 };
        return { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    }

    getMagnitude() { return this.magnitude; }
    getAngle()     { return this.angle; }

    render(ctx, options = {}) {
        const accent = _accentRgb(options.playerClass);
        const activationRadius = Math.max(this.radius, options.activationRadius || this.radius);
        const cooldown = Math.max(0, Number.isFinite(options.cooldown) ? options.cooldown : 0);
        const maxCooldown = Math.max(0, Number.isFinite(options.maxCooldown) ? options.maxCooldown : 0);
        const cooldownPct = maxCooldown > 0 ? Math.max(0, Math.min(1, cooldown / maxCooldown)) : 0;
        const isReady = cooldownPct <= 0;
        const now = _now();
        const activePulse = this.active ? (Math.sin(now * 0.018) * 0.5 + 0.5) : 0;
        const idleMs = now - this._lastInteractionAt;
        const idleFade = options.fadeWhenIdle && !this.active && idleMs > 2200 ? 0.42 : 1;

        ctx.save();
        ctx.globalAlpha *= idleFade;

        // --- Activation halo (dashed outer ring, only when wider than base) ---
        if (activationRadius > this.radius + 1) {
            ctx.strokeStyle = this.active
                ? _rgba(accent, 0.28 + activePulse * 0.18)
                : 'rgba(180, 200, 255, 0.12)';
            ctx.lineWidth = this.active ? 1.8 + activePulse : 1.5;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, activationRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // --- Active ambient glow behind the ring ---
        if (this.active) {
            const glow = ctx.createRadialGradient(
                this.centerX, this.centerY, this.radius * 0.6,
                this.centerX, this.centerY, this.radius * 1.35
            );
            glow.addColorStop(0, _rgba(accent, 0.18));
            glow.addColorStop(1, _rgba(accent, 0));
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, this.radius * 1.35, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Base fill (deep navy, slightly frosted, shaded like a shallow socket) ---
        const baseGrad = ctx.createRadialGradient(
            this.centerX - this.radius * 0.25, this.centerY - this.radius * 0.35, 0,
            this.centerX, this.centerY, this.radius
        );
        baseGrad.addColorStop(0, 'rgba(28, 34, 64, 0.72)');
        baseGrad.addColorStop(0.58, 'rgba(8, 10, 26, 0.68)');
        baseGrad.addColorStop(1, 'rgba(0, 0, 8, 0.78)');
        ctx.fillStyle = baseGrad;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // --- Cooldown pie overlay (clock-sweep on the interior) ---
        if (cooldownPct > 0) {
            ctx.fillStyle = 'rgba(200, 50, 50, 0.22)';
            ctx.beginPath();
            ctx.moveTo(this.centerX, this.centerY);
            ctx.arc(
                this.centerX, this.centerY, this.radius,
                -Math.PI / 2,
                -Math.PI / 2 + Math.PI * 2 * cooldownPct
            );
            ctx.closePath();
            ctx.fill();
        }

        // --- Outer ring border ---
        // Ready: accent colour. On cooldown: red-tinted. Active: full brightness.
        let ringColor;
        if (this.active) {
            ringColor = _rgba(accent, 0.82 + activePulse * 0.18);
        } else if (!isReady) {
            ringColor = 'rgba(200, 80, 80, 0.70)';
        } else {
            ringColor = _rgba(accent, 0.45);
        }

        ctx.strokeStyle = ringColor;
        ctx.lineWidth = this.active ? 3.2 + activePulse * 1.2 : 2.5;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (options.primary) {
            const hexRadius = this.radius * 0.76;
            ctx.strokeStyle = this.active ? _rgba(accent, 0.34 + activePulse * 0.20) : _rgba(accent, 0.20);
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = -Math.PI / 2 + i * Math.PI / 3;
                const x = this.centerX + Math.cos(angle) * hexRadius;
                const y = this.centerY + Math.sin(angle) * hexRadius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // --- Cooldown arc on the ring edge (progress track atop the ring) ---
        if (cooldownPct > 0) {
            // Dim track (full circle)
            ctx.strokeStyle = 'rgba(150, 40, 40, 0.35)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
            ctx.stroke();

            // Remaining cooldown arc (swept)
            ctx.strokeStyle = 'rgba(220, 80, 80, 0.80)';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(
                this.centerX, this.centerY, this.radius,
                -Math.PI / 2,
                -Math.PI / 2 + Math.PI * 2 * cooldownPct
            );
            ctx.stroke();
            ctx.lineCap = 'butt';
        }

        // --- Knob (follows finger) ---
        const innerRadius = Math.round(this.radius * 0.42);
        const kx = this.currentX;
        const ky = this.currentY;

        // Soft drop shadow under the thumb nub so it reads as raised.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
        ctx.beginPath();
        ctx.ellipse(kx + 1, ky + 4, innerRadius * 0.9, innerRadius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = this.active ? _rgba(accent, 0.58 + activePulse * 0.18) : 'rgba(0, 0, 0, 0.28)';
        ctx.shadowBlur = this.active ? 12 + activePulse * 5 : 5;

        // Knob fill — radial shading gives the nub a pressed-glass feel.
        const knobGrad = ctx.createRadialGradient(
            kx - innerRadius * 0.35, ky - innerRadius * 0.4, 0,
            kx, ky, innerRadius
        );
        knobGrad.addColorStop(0, this.active ? 'rgba(255, 255, 255, 0.98)' : 'rgba(245, 248, 255, 0.72)');
        knobGrad.addColorStop(0.58, this.active ? 'rgba(220, 230, 255, 0.90)' : 'rgba(190, 205, 245, 0.56)');
        knobGrad.addColorStop(1, this.active ? 'rgba(95, 130, 215, 0.76)' : 'rgba(75, 95, 150, 0.42)');
        ctx.fillStyle = knobGrad;
        ctx.beginPath();
        ctx.arc(kx, ky, innerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Subtle highlight on top-left of knob (glass effect)
        const hlGrad = ctx.createRadialGradient(
            kx - innerRadius * 0.3, ky - innerRadius * 0.35, 0,
            kx, ky, innerRadius
        );
        hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.50)');
        hlGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.10)');
        hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = hlGrad;
        ctx.beginPath();
        ctx.arc(kx, ky, innerRadius, 0, Math.PI * 2);
        ctx.fill();

        // Knob ring
        ctx.strokeStyle = this.active
            ? _rgba(accent, 0.80)
            : 'rgba(200, 210, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(kx, ky, innerRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Neutral marker: tiny centre dot remains visible through the nub and helps players read rest position.
        ctx.fillStyle = this.active ? _rgba(accent, 0.75) : 'rgba(180, 205, 255, 0.55)';
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, Math.max(2.5, this.radius * 0.055), 0, Math.PI * 2);
        ctx.fill();

        // Directional affordance for controls like Rogue dodge: subtle four-way ticks around neutral.
        if (options.directional) {
            ctx.strokeStyle = this.active ? _rgba(accent, 0.48) : 'rgba(180, 205, 255, 0.24)';
            ctx.lineWidth = 1.4;
            ctx.lineCap = 'round';
            const tickInner = this.radius * 0.53;
            const tickOuter = this.radius * 0.64;
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(this.centerX + Math.cos(a) * tickInner, this.centerY + Math.sin(a) * tickInner);
                ctx.lineTo(this.centerX + Math.cos(a) * tickOuter, this.centerY + Math.sin(a) * tickOuter);
                ctx.stroke();
            }
            ctx.lineCap = 'butt';
        }

        // --- Aim ray (from knob edge outward, not from centre) ---
        if (this.active && this.magnitude > 0.08) {
            const cos = Math.cos(this.angle);
            const sin = Math.sin(this.angle);

            // Start from the knob edge
            const rayStartX = kx + cos * innerRadius;
            const rayStartY = ky + sin * innerRadius;

            // End just outside the outer ring
            const rayEndX = this.centerX + cos * (this.radius + 18);
            const rayEndY = this.centerY + sin * (this.radius + 18);

            // Tapered fading line
            const rayGrad = ctx.createLinearGradient(rayStartX, rayStartY, rayEndX, rayEndY);
            rayGrad.addColorStop(0, _rgba(accent, 0.20));
            rayGrad.addColorStop(0.6, _rgba(accent, 0.70));
            rayGrad.addColorStop(1, _rgba(accent, 0.90));

            ctx.strokeStyle = rayGrad;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(rayStartX, rayStartY);
            ctx.lineTo(rayEndX, rayEndY);
            ctx.stroke();

            // Small arrowhead at the tip
            const arrowSize = 6;
            const perpX = -sin;
            const perpY = cos;
            ctx.fillStyle = _rgba(accent, 0.85);
            ctx.beginPath();
            ctx.moveTo(rayEndX, rayEndY);
            ctx.lineTo(rayEndX - cos * arrowSize + perpX * arrowSize * 0.5, rayEndY - sin * arrowSize + perpY * arrowSize * 0.5);
            ctx.lineTo(rayEndX - cos * arrowSize - perpX * arrowSize * 0.5, rayEndY - sin * arrowSize - perpY * arrowSize * 0.5);
            ctx.closePath();
            ctx.fill();

            ctx.lineCap = 'butt';
        }

        // --- Cooldown label (below the ring) ---
        if (!options.hideText && cooldownPct > 0) {
            ctx.font = `bold 11px Orbitron, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 210, 210, 0.95)';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 3;
            ctx.fillText(`${Math.ceil(cooldown)}s`, this.centerX, this.centerY + this.radius + 14);
            ctx.shadowBlur = 0;
        } else if (!options.hideText && options.label) {
            ctx.font = `bold 10px Orbitron, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = _rgba(accent, 0.60);
            _drawSpacedText(ctx, options.label, this.centerX, this.centerY + this.radius + 14, 1.1);
        }

        if (options.charges !== null && options.charges !== undefined) {
            const badgeR = 9;
            const badgeX = this.centerX + this.radius * 0.72;
            const badgeY = this.centerY - this.radius * 0.72;
            const badgeGrad = ctx.createRadialGradient(badgeX - 2, badgeY - 2, 0, badgeX, badgeY, badgeR);
            badgeGrad.addColorStop(0, '#ffe97a');
            badgeGrad.addColorStop(1, '#cc8800');

            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
            ctx.fillStyle = badgeGrad;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.55)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.font = 'bold 12px Orbitron, monospace';
            ctx.fillStyle = '#1a0a00';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;
            ctx.fillText(options.charges, badgeX, badgeY + 0.5);
        }
        ctx.restore();
    }
}

// Touch button (for non-joystick abilities)
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
        this._pressFlash = 0; // seconds remaining for press flash
        this._chargeBounce = 0;
        this._lastCharges = null;
    }

    contains(x, y) {
        const padding = 8;
        return x >= this.x - padding && x <= this.x + this.width + padding &&
            y >= this.y - padding && y <= this.y + this.height + padding;
    }

    containsExact(x, y) {
        return x >= this.x && x <= this.x + this.width &&
            y >= this.y && y <= this.y + this.height;
    }

    startTouch(touchId, x, y) {
        if (this.contains(x, y)) {
            this.active = true;
            this.touchId = touchId;
            if (!this.pressed) {
                this.pressed = true;
                this.justPressed = true;
                this._pressFlash = 0.18; // 180 ms flash
                _pulseHaptic(8);
            }
            return true;
        }
        return false;
    }

    endTouch(touchId) {
        if (this.touchId === touchId) {
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
    }

    update(deltaTime) {
        this.justPressed = false;
        this.justReleased = false;
        if (this._pressFlash > 0) {
            this._pressFlash = Math.max(0, this._pressFlash - (deltaTime || 0.016));
        }
        if (this._chargeBounce > 0) {
            this._chargeBounce = Math.max(0, this._chargeBounce - (deltaTime || 0.016));
        }
    }

    _drawRoundedRect(ctx, x, y, width, height, radius) {
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

    // Legacy alias used by old code paths
    drawRoundedRect(ctx, x, y, width, height, radius) {
        return this._drawRoundedRect(ctx, x, y, width, height, radius);
    }

    render(ctx, cooldown = 0, maxCooldown = 0, charges = null, options = {}) {
        const accent = _accentRgb(options.playerClass);
        const cooldownPct = maxCooldown > 0 ? Math.max(0, Math.min(1, cooldown / maxCooldown)) : 0;
        const isReady = charges !== null ? charges > 0 : cooldownPct === 0;
        const isPressed = this.pressed;
        const flashT = Math.max(0, this._pressFlash / 0.18); // 0–1
        if (charges !== null && charges !== undefined) {
            if (this._lastCharges !== null && charges > this._lastCharges) {
                this._chargeBounce = 0.22;
            }
            this._lastCharges = charges;
        }

        const r = Math.min(this.width, this.height) / 2; // circular touch buttons
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const pressScale = isPressed ? 0.93 : (flashT > 0 ? 1 - flashT * 0.025 : 1);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(pressScale, pressScale);
        ctx.translate(-cx, -cy);

        // --- Background ---
        const bgAlpha = isPressed ? 0.88 : (isReady ? 0.60 : 0.42);
        ctx.fillStyle = `rgba(8, 10, 24, ${bgAlpha})`;
        this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, r);
        ctx.fill();

        // --- Cooldown overlay: circular arc clipped to button rect ---
        if (cooldownPct > 0) {
            ctx.save();
            this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, r);
            ctx.clip();

            // Dark sweep fill
            ctx.fillStyle = 'rgba(160, 40, 40, 0.40)';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const sweepRadius = Math.max(this.width, this.height) * 0.85;
            ctx.arc(cx, cy, sweepRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cooldownPct);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        // --- Border ---
        let borderColor;
        if (isPressed) {
            borderColor = `rgba(255, 255, 255, ${0.5 + flashT * 0.5})`;
        } else if (!isReady) {
            borderColor = 'rgba(180, 60, 60, 0.60)';
        } else {
            borderColor = _rgba(accent, 0.50);
        }
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = isPressed ? 3.5 : 2;
        this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, r);
        ctx.stroke();

        // Directional ability buttons need a visible affordance on the top layer.
        // The joystick underneath can be covered by the button face, so draw a small reticle here.
        if (options.directional) {
            const pulse = isPressed ? 1 : 0;
            const reticleAlpha = isReady ? 0.42 : 0.24;
            const innerR = Math.min(this.width, this.height) * 0.27;
            const outerR = Math.min(this.width, this.height) * 0.40;

            ctx.strokeStyle = _rgba(accent, reticleAlpha + pulse * 0.18);
            ctx.lineWidth = 1.35;
            ctx.beginPath();
            ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
            ctx.stroke();

            ctx.lineCap = 'round';
            ctx.lineWidth = 1.8;
            for (let i = 0; i < 4; i++) {
                const angle = i * Math.PI / 2;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const baseX = cx + cos * outerR;
                const baseY = cy + sin * outerR;
                const wing = 4.2;
                const back = 5.2;
                const perpX = -sin;
                const perpY = cos;

                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.lineTo(baseX - cos * back + perpX * wing, baseY - sin * back + perpY * wing);
                ctx.moveTo(baseX, baseY);
                ctx.lineTo(baseX - cos * back - perpX * wing, baseY - sin * back - perpY * wing);
                ctx.stroke();
            }
            ctx.lineCap = 'butt';

            ctx.strokeStyle = _rgba(accent, isReady ? 0.30 : 0.16);
            ctx.lineWidth = 1;
            this._drawRoundedRect(ctx, this.x + 5, this.y + 5, this.width - 10, this.height - 10, Math.max(4, r - 5));
            ctx.stroke();
        }

        // --- Press flash: expanding glow ring ---
        if (flashT > 0) {
            const expansion = (1 - flashT) * 14;
            ctx.strokeStyle = `rgba(255, 255, 255, ${flashT * 0.7})`;
            ctx.lineWidth = flashT * 3;
            this._drawRoundedRect(
                ctx,
                this.x - expansion, this.y - expansion,
                this.width + expansion * 2, this.height + expansion * 2,
                r + expansion
            );
            ctx.stroke();
        }

        // --- Label ---
        if (this.label) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Fit label within button width; leave 12 px gutter (6 each side)
            const maxLabelWidth = this.width - 12;
            let fontSize = 10; // start conservative — Orbitron has a tall cap-height
            ctx.font = `bold ${fontSize}px Orbitron, monospace`;
            // grow up rather than shrink down to avoid the while-loop sizing past the real limit
            while (fontSize < 13 && ctx.measureText(this.label).width < maxLabelWidth) {
                fontSize++;
                ctx.font = `bold ${fontSize}px Orbitron, monospace`;
            }
            // step back one if we overshot
            if (ctx.measureText(this.label).width > maxLabelWidth && fontSize > 8) {
                fontSize--;
                ctx.font = `bold ${fontSize}px Orbitron, monospace`;
            }

            // Cooldown active: large timer centred, small label above (both use cy as anchor)
            if (!isReady && cooldownPct > 0) {
                // Small label sits 8 px above centre — consistent gap regardless of fontSize
                ctx.font = `bold 8px Orbitron, monospace`;
                ctx.fillStyle = 'rgba(200, 180, 180, 0.55)';
                ctx.shadowBlur = 0;
                ctx.fillText(this.label, cx, cy - 9);

                // Timer centred in the lower half of the button
                ctx.font = `bold ${Math.min(fontSize + 1, 12)}px Orbitron, monospace`;
                ctx.fillStyle = 'rgba(255, 200, 200, 0.90)';
                ctx.shadowColor = 'rgba(0,0,0,0.9)';
                ctx.shadowBlur = 4;
                ctx.fillText(`${Math.ceil(cooldown)}s`, cx, cy + 7);
                ctx.shadowBlur = 0;
            } else {
                // Idle / ready: single label perfectly centred
                ctx.fillStyle = isPressed ? '#ffffff' : (isReady ? 'rgba(230, 235, 255, 0.92)' : 'rgba(180, 180, 200, 0.70)');
                ctx.shadowColor = 'rgba(0,0,0,0.85)';
                ctx.shadowBlur = 3;
                ctx.fillText(this.label, cx, cy);
                ctx.shadowBlur = 0;
            }

            // --- Charge count badge (gold, matches game palette) ---
            if (charges !== null && charges !== undefined) {
                const badgeR = 9;
                const badgeX = this.x + this.width + 1;
                const badgeY = this.y - 1;
                const bounceT = this._chargeBounce > 0 ? this._chargeBounce / 0.22 : 0;
                const badgeScale = 1 + Math.sin(bounceT * Math.PI) * 0.22;

                // Gold badge background
                const badgeGrad = ctx.createRadialGradient(badgeX - 2, badgeY - 2, 0, badgeX, badgeY, badgeR);
                badgeGrad.addColorStop(0, '#ffe97a');
                badgeGrad.addColorStop(1, '#cc8800');

                ctx.save();
                ctx.translate(badgeX, badgeY);
                ctx.scale(badgeScale, badgeScale);
                ctx.translate(-badgeX, -badgeY);

                ctx.beginPath();
                ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
                ctx.fillStyle = badgeGrad;
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.font = 'bold 12px Orbitron, monospace';
                ctx.fillStyle = '#1a0a00';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowBlur = 0;
                ctx.fillText(charges, badgeX, badgeY + 0.5);
                ctx.restore();
            }
        }
        ctx.restore();
    }
}

// Generic canvas rendering host, camera math, screen shake, and particle pooling.
// Fully decoupled from application state and content.

window.Engine = window.Engine || {};
Engine.FX = Engine.FX || {};
Engine.FX.ShakeBias = Engine.FX.ShakeBias || Object.freeze({
    NONE: null,
    VERTICAL: 'vertical',
    HORIZONTAL: 'horizontal'
});

const Renderer = {
    // Screen shake accumulator state
    screenShakeOffset: { x: 0, y: 0 },
    screenShakeIntensity: 0,
    screenShakeDuration: 0,
    screenShakeDirection: null,

    // Compatibility facade over the typed SoA effect store.
    get particles() {
        return Engine.FX.Particles.toArray();
    },

    set particles(values) {
        Engine.FX.Particles.clear();
        for (const value of values || []) Engine.FX.Particles.spawn(value);
    },

    // Clear canvas host
    clear(ctx, width, height, color = '#1a1a2e') {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
    },

    // Camera transform projection (translate and scale zoom)
    applyCameraTransform(ctx, centerX, centerY, cameraX, cameraY, zoom) {
        ctx.translate(centerX + this.screenShakeOffset.x, centerY + this.screenShakeOffset.y);
        ctx.scale(zoom, zoom);
        ctx.translate(-cameraX, -cameraY);
    },

    // Screen shake update tick
    updateScreenShake(deltaTime, rng = Math.random) {
        if (this.screenShakeDuration > 0) {
            this.screenShakeDuration -= deltaTime;
            const baseShake = this.screenShakeIntensity * 10;
            let xOffset = 0;
            let yOffset = 0;

            if (this.screenShakeDirection === Engine.FX.ShakeBias.VERTICAL) {
                xOffset = (rng() - 0.5) * baseShake * 0.4;
                yOffset = (rng() - 0.5) * baseShake * 1.2;
            } else if (this.screenShakeDirection === Engine.FX.ShakeBias.HORIZONTAL) {
                xOffset = (rng() - 0.5) * baseShake * 1.2;
                yOffset = (rng() - 0.5) * baseShake * 0.4;
            } else {
                xOffset = (rng() - 0.5) * baseShake;
                yOffset = (rng() - 0.5) * baseShake;
            }

            this.screenShakeOffset.x = xOffset;
            this.screenShakeOffset.y = yOffset;

            if (this.screenShakeDuration <= 0) {
                this.screenShakeDuration = 0;
                this.screenShakeOffset.x = 0;
                this.screenShakeOffset.y = 0;
                this.screenShakeDirection = null;
            }
        }
    },

    // Trigger new screen shake intensity/duration
    triggerScreenShake(intensity, duration, direction = null) {
        const shouldReplace = this.screenShakeDuration <= 0 || intensity >= this.screenShakeIntensity;
        if (shouldReplace) {
            this.screenShakeIntensity = intensity;
            this.screenShakeDuration = duration;
            this.screenShakeDirection = direction;
        } else {
            this.screenShakeDuration = Math.max(this.screenShakeDuration, duration * 0.45);
        }
    },

    // Draw regular polygon
    polygon(ctx, x, y, radius, sides, rotation, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        ctx.fillStyle = color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;

            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    },

    // Flat Particle submission pipeline
    submitParticle(x, y, vx, vy, color, size, life) {
        return Engine.FX.Particles.spawn({ x, y, vx, vy, color, size, life });
    },

    updateParticles(deltaTime) {
        return Engine.FX.Particles.update(deltaTime);
    },

    renderParticles(ctx, viewX, viewY, viewW, viewH) {
        const viewBounds = viewX === undefined
            ? null
            : { x: viewX, y: viewY, width: viewW, height: viewH };
        return Engine.FX.Particles.render(ctx, viewBounds);
    }
};

Engine.Renderer = Renderer;

if (typeof window !== 'undefined') {
    window.Engine = window.Engine || {};
    window.Engine.Renderer = Renderer;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Engine, Particle: Engine.FX.ParticleSystem };
}

// Generic canvas rendering host, camera math, screen shake, and particle pooling.
// Fully decoupled from application state and content.

window.Engine = window.Engine || {};
Engine.FX = Engine.FX || {};
Engine.FX.ShakeBias = Engine.FX.ShakeBias || Object.freeze({
    NONE: null,
    VERTICAL: 'vertical',
    HORIZONTAL: 'horizontal'
});

class Particle {
    constructor(x, y, vx, vy, color, size, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = life;
        this.maxLife = life;
        this.alpha = 1.0;
    }

    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.life -= deltaTime;
        this.alpha = this.life / this.maxLife;

        // Apply constant gravity downward
        this.vy += 200 * deltaTime;

        return this.life > 0;
    }

    render(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Particle pool limit configuration
const MAX_POOL_SIZE = 200;
const particlePool = [];

function getParticle() {
    return particlePool.length > 0 ? particlePool.pop() : null;
}

function releaseParticle(p) {
    if (particlePool.length < MAX_POOL_SIZE) {
        particlePool.push(p);
    }
}

const Renderer = {
    // Screen shake accumulator state
    screenShakeOffset: { x: 0, y: 0 },
    screenShakeIntensity: 0,
    screenShakeDuration: 0,
    screenShakeDirection: null,

    // Particles system
    particles: [],

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
    updateScreenShake(deltaTime) {
        if (this.screenShakeDuration > 0) {
            this.screenShakeDuration -= deltaTime;
            const baseShake = this.screenShakeIntensity * 10;
            let xOffset = 0;
            let yOffset = 0;

            if (this.screenShakeDirection === Engine.FX.ShakeBias.VERTICAL) {
                xOffset = (Math.random() - 0.5) * baseShake * 0.4;
                yOffset = (Math.random() - 0.5) * baseShake * 1.2;
            } else if (this.screenShakeDirection === Engine.FX.ShakeBias.HORIZONTAL) {
                xOffset = (Math.random() - 0.5) * baseShake * 1.2;
                yOffset = (Math.random() - 0.5) * baseShake * 0.4;
            } else {
                xOffset = (Math.random() - 0.5) * baseShake;
                yOffset = (Math.random() - 0.5) * baseShake;
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
        let p = getParticle();
        if (p) {
            p.x = x;
            p.y = y;
            p.vx = vx;
            p.vy = vy;
            p.color = color;
            p.size = size;
            p.life = life;
            p.maxLife = life;
            p.alpha = 1.0;
        } else {
            p = new Particle(x, y, vx, vy, color, size, life);
        }
        this.particles.push(p);
    },

    updateParticles(deltaTime) {
        this.particles = this.particles.filter(p => {
            const alive = p.update(deltaTime);
            if (!alive) {
                releaseParticle(p);
            }
            return alive;
        });
    },

    renderParticles(ctx, viewX, viewY, viewW, viewH) {
        const useCulling = viewX !== undefined;
        this.particles.forEach(p => {
            if (!useCulling || (p.x >= viewX && p.x <= viewX + viewW && p.y >= viewY && p.y <= viewY + viewH)) {
                p.render(ctx);
            }
        });
    }
};

Engine.Renderer = Renderer;

if (typeof window !== 'undefined') {
    window.Engine = window.Engine || {};
    window.Engine.Renderer = Renderer;
    // Keep global fallback for browser runtime compatibility
    window.Renderer = Renderer;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Engine, Particle };
}

// Rendering functions

// Particle class for visual effects
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
        
        // Fade out over time
        this.alpha = this.life / this.maxLife;
        
        // Apply gravity
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

// Particle pooling
const particlePool = [];
const MAX_POOL_SIZE = 200;

function getParticle() {
    if (particlePool.length > 0) {
        return particlePool.pop();
    }
    return null;
}

function releaseParticle(p) {
    if (particlePool.length < MAX_POOL_SIZE) {
        particlePool.push(p);
    }
}

// Create burst of particles at position
function createParticleBurst(x, y, color, count = 10) {
    if (typeof Game === 'undefined') return;
    if (!Game.particles) Game.particles = [];
    
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const speed = 100 + Math.random() * 100;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        
        let particle = getParticle();
        if (!particle) {
            particle = new Particle(x, y, vx, vy, color, 3 + Math.random() * 3, 0.5);
        } else {
            particle.x = x;
            particle.y = y;
            particle.vx = vx;
            particle.vy = vy;
            particle.color = color;
            particle.size = 3 + Math.random() * 3;
            particle.life = 0.5;
            particle.maxLife = 0.5;
            particle.alpha = 1.0;
        }
        
        Game.particles.push(particle);
    }
}

// Update and render particles
function updateParticles(deltaTime) {
    if (!Game || !Game.particles) return;
    
    Game.particles = Game.particles.filter(particle => {
        const alive = particle.update(deltaTime);
        if (!alive) {
            releaseParticle(particle);
        }
        return alive;
    });
}

function renderParticles(ctx) {
    if (!Game || !Game.particles) return;
    
    Game.particles.forEach(particle => {
        particle.render(ctx);
    });
}

const Renderer = {
    // Draw circle
    circle(ctx, x, y, radius, color, fill = true) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        if (fill) {
            ctx.fillStyle = color;
            ctx.fill();
        } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    },

    // Draw rectangle
    rect(ctx, x, y, width, height, color, fill = true) {
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        if (fill) {
            ctx.fillStyle = color;
            ctx.fill();
        } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    },

    // Clear canvas with background color
    clear(ctx, width, height, color = '#1a1a2e') {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
    },
    
    // Draw door
    door(ctx, x, y, width, height, pulse = 0) {
        // Outer glow for pulse effect
        const pulseSize = 3 + Math.sin(pulse) * 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffaa00';
        
        // Draw door body (gold/yellow)
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(x, y, width, height);
        
        // Draw door outline
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
        
        // Draw door handle
        ctx.fillStyle = '#996600';
        ctx.beginPath();
        ctx.arc(x + width - 10, y + height / 2, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
};


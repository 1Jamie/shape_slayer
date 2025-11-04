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

// Biome definitions for different room ranges
const BIOMES = {
    // Rooms 1-10: Swarm King biome (insect/swarm theme)
    swarm: {
        baseColor: '#1a2518',
        gridColor: 'rgba(150, 200, 100, 0.12)',
        gridSize: 50,
        accentColor: '#8fcc66',
        pattern: 'grid'
    },
    // Rooms 11-15: Twin Prism biome (crystal/prism theme)
    prism: {
        baseColor: '#1a1525',
        gridColor: 'rgba(150, 200, 255, 0.15)',
        gridSize: 60,
        accentColor: '#6699ff',
        pattern: 'grid'
    },
    // Rooms 16-20: Fortress biome (stone/defensive theme)
    fortress: {
        baseColor: '#25201a',
        gridColor: 'rgba(180, 160, 140, 0.1)',
        gridSize: 40,
        accentColor: '#cc9966',
        pattern: 'grid'
    },
    // Rooms 21-25: Fractal Core biome (geometric/fractal theme)
    fractal: {
        baseColor: '#151a25',
        gridColor: 'rgba(255, 150, 255, 0.18)',
        gridSize: 55,
        accentColor: '#ff66ff',
        pattern: 'diagonal'
    },
    // Rooms 26-30: Vortex biome (dark/void theme)
    vortex: {
        baseColor: '#0f0a15',
        gridColor: 'rgba(150, 100, 200, 0.1)',
        gridSize: 45,
        accentColor: '#9966cc',
        pattern: 'grid'
    },
    // Rooms 31+: Endless (darker, more intense)
    endless: {
        baseColor: '#0a0a15',
        gridColor: 'rgba(200, 150, 255, 0.12)',
        gridSize: 50,
        accentColor: '#cc99ff',
        pattern: 'grid'
    }
};

// Get biome for a room number
function getBiomeForRoom(roomNumber) {
    if (roomNumber <= 10) return BIOMES.swarm;
    if (roomNumber <= 15) return BIOMES.prism;
    if (roomNumber <= 20) return BIOMES.fortress;
    if (roomNumber <= 25) return BIOMES.fractal;
    if (roomNumber <= 30) return BIOMES.vortex;
    return BIOMES.endless;
}

// Render room background with biome styling (should be called inside camera transform)
function renderRoomBackground(ctx, roomNumber) {
    // Use room size (larger than canvas/viewport)
    const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
    const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
    const biome = getBiomeForRoom(roomNumber);
    
    // NOTE: Base color is already cleared outside camera transform in main.js
    // We only draw the grid pattern here (in world space, so it stays fixed to floor)
    
    // Render grid pattern over entire room (world space - fixed to floor)
    ctx.strokeStyle = biome.gridColor;
    ctx.lineWidth = 1;
    
    if (biome.pattern === 'grid') {
        // Standard grid pattern
        for (let x = 0; x < roomWidth; x += biome.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, roomHeight);
            ctx.stroke();
        }
        for (let y = 0; y < roomHeight; y += biome.gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(roomWidth, y);
            ctx.stroke();
        }
    } else if (biome.pattern === 'diagonal') {
        // Diagonal grid pattern for fractal biome
        const spacing = biome.gridSize;
        for (let i = -roomHeight; i < roomWidth + roomHeight; i += spacing) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + roomHeight, roomHeight);
            ctx.stroke();
        }
        for (let i = -roomWidth; i < roomWidth + roomHeight; i += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(roomWidth, i + roomWidth);
            ctx.stroke();
        }
    }
    
    // Add subtle accent overlay for boss rooms
    if (roomNumber % 5 === 0 && roomNumber >= 10) {
        // Boss room - add subtle pulsing effect
        const pulseTime = Date.now() * 0.001;
        const pulseAlpha = 0.05 + Math.sin(pulseTime) * 0.02;
        
        // Parse hex color to RGB
        const hex = biome.accentColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pulseAlpha})`;
        ctx.fillRect(0, 0, roomWidth, roomHeight);
    }
}

// Render room boundaries (visible walls at edges)
function renderRoomBoundaries(ctx, roomNumber) {
    const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
    const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
    const biome = getBiomeForRoom(roomNumber);
    
    const wallThickness = 20;
    
    // Parse biome accent color
    const hex = biome.accentColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Draw walls with biome-colored borders
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
    ctx.strokeStyle = biome.accentColor;
    ctx.lineWidth = 3;
    
    // Top wall
    ctx.fillRect(0, 0, roomWidth, wallThickness);
    ctx.strokeRect(0, 0, roomWidth, wallThickness);
    
    // Bottom wall
    ctx.fillRect(0, roomHeight - wallThickness, roomWidth, wallThickness);
    ctx.strokeRect(0, roomHeight - wallThickness, roomWidth, wallThickness);
    
    // Left wall
    ctx.fillRect(0, 0, wallThickness, roomHeight);
    ctx.strokeRect(0, 0, wallThickness, roomHeight);
    
    // Right wall
    ctx.fillRect(roomWidth - wallThickness, 0, wallThickness, roomHeight);
    ctx.strokeRect(roomWidth - wallThickness, 0, wallThickness, roomHeight);
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
    },
    
    // Draw polygon (for pentagon and hexagon shapes)
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
    }
};


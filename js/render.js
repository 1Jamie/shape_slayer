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

function createDirectionalParticleBurst(x, y, dirX, dirY, color, options = {}) {
    if (typeof Game === 'undefined') return;
    if (!Game.particles) Game.particles = [];
    
    const count = options.count || 12;
    const spread = options.spread !== undefined ? options.spread : Math.PI / 5;
    const baseSpeed = options.speed || 220;
    const baseSize = options.size || 3;
    const life = options.life || 0.4;
    
    const magnitude = Math.sqrt((dirX || 0) * (dirX || 0) + (dirY || 0) * (dirY || 0));
    const normX = magnitude > 0.0001 ? dirX / magnitude : 1;
    const normY = magnitude > 0.0001 ? dirY / magnitude : 0;
    const baseAngle = Math.atan2(normY, normX);
    
    const safeColor = color || '#ffffff';
    
    for (let i = 0; i < count; i++) {
        const offset = (Math.random() - 0.5) * spread * 2;
        const speedScale = 0.6 + Math.random() * 0.6;
        const angle = baseAngle + offset;
        const speed = baseSpeed * speedScale;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        
        let particle = getParticle();
        const particleSize = baseSize + Math.random() * (options.sizeVariance || 2);
        const particleLife = life * (0.8 + Math.random() * 0.4);
        
        if (!particle) {
            particle = new Particle(x, y, vx, vy, safeColor, particleSize, particleLife);
        } else {
            particle.x = x;
            particle.y = y;
            particle.vx = vx;
            particle.vy = vy;
            particle.color = safeColor;
            particle.size = particleSize;
            particle.life = particleLife;
            particle.maxLife = particleLife;
            particle.alpha = 1.0;
        }
        
        // Slight perpendicular drift for ribbon effect
        const perpX = -normY;
        const perpY = normX;
        particle.vx += perpX * baseSpeed * 0.15 * (Math.random() - 0.5);
        particle.vy += perpY * baseSpeed * 0.15 * (Math.random() - 0.5);
        
        Game.particles.push(particle);
    }
}

// Create lightning arc visual effect between two points
function createLightningArc(x1, y1, x2, y2) {
    if (typeof Game === 'undefined') return;
    if (!Game.lightningArcs) Game.lightningArcs = [];
    
    // Create lightning arc object
    const arc = {
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        life: 0.3, // Short duration for lightning
        maxLife: 0.3,
        alpha: 1.0,
        segments: [] // Zigzag points for lightning effect
    };
    
    // Generate zigzag lightning path
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const segmentCount = Math.floor(distance / 30) + 2; // One segment per 30px
    
    arc.segments.push({ x: x1, y: y1 });
    
    for (let i = 1; i < segmentCount - 1; i++) {
        const t = i / (segmentCount - 1);
        const baseX = x1 + dx * t;
        const baseY = y1 + dy * t;
        
        // Add random perpendicular offset for zigzag
        const perpX = -dy / distance;
        const perpY = dx / distance;
        const offset = (Math.random() - 0.5) * 20;
        
        arc.segments.push({
            x: baseX + perpX * offset,
            y: baseY + perpY * offset
        });
    }
    
    arc.segments.push({ x: x2, y: y2 });
    
    Game.lightningArcs.push(arc);
}

// Update lightning arcs
function updateLightningArcs(deltaTime) {
    if (!Game || !Game.lightningArcs) return;
    
    Game.lightningArcs = Game.lightningArcs.filter(arc => {
        arc.life -= deltaTime;
        arc.alpha = arc.life / arc.maxLife;
        return arc.life > 0;
    });
}

// Render lightning arcs
function renderLightningArcs(ctx) {
    if (!Game || !Game.lightningArcs) return;
    
    Game.lightningArcs.forEach(arc => {
        ctx.save();
        ctx.globalAlpha = arc.alpha;
        
        // Draw outer glow
        ctx.strokeStyle = `rgba(150, 200, 255, ${arc.alpha * 0.6})`;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        arc.segments.forEach((segment, i) => {
            if (i === 0) {
                ctx.moveTo(segment.x, segment.y);
            } else {
                ctx.lineTo(segment.x, segment.y);
            }
        });
        ctx.stroke();
        
        // Draw inner core
        ctx.strokeStyle = `rgba(255, 255, 255, ${arc.alpha})`;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        arc.segments.forEach((segment, i) => {
            if (i === 0) {
                ctx.moveTo(segment.x, segment.y);
            } else {
                ctx.lineTo(segment.x, segment.y);
            }
        });
        ctx.stroke();
        
        ctx.restore();
    });
}

// Render burn effect on an enemy (orange/red pulsing glow with rising particles)
function renderBurnEffect(ctx, enemy) {
    if (!enemy || !enemy.burning) return;
    
    ctx.save();
    
    // Pulsing orange/red glow
    const burnPulse = Math.sin(Date.now() / 100) * 0.5 + 0.5;
    const glowRadius = enemy.size + 5 + burnPulse * 3;
    
    // Outer glow
    ctx.fillStyle = `rgba(255, 100, 0, ${0.3 * burnPulse})`;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner glow
    ctx.fillStyle = `rgba(255, 150, 50, ${0.5 * burnPulse})`;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.size + 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Rising fire particles
    if (Math.random() < 0.3) { // 30% chance per frame to spawn particle
        const angle = Math.random() * Math.PI * 2;
        const offset = Math.random() * enemy.size;
        const px = enemy.x + Math.cos(angle) * offset;
        const py = enemy.y + Math.sin(angle) * offset;
        
        let particle = getParticle();
        if (!particle) {
            particle = new Particle(px, py, 0, -50 - Math.random() * 30, '#ff6600', 2 + Math.random() * 2, 0.3);
        } else {
            particle.x = px;
            particle.y = py;
            particle.vx = 0;
            particle.vy = -50 - Math.random() * 30; // Rise upward
            particle.color = '#ff6600';
            particle.size = 2 + Math.random() * 2;
            particle.life = 0.3;
            particle.maxLife = 0.3;
            particle.alpha = 1.0;
        }
        
        if (typeof Game !== 'undefined' && Game.particles) {
            Game.particles.push(particle);
        }
    }
    
    ctx.restore();
}

// Render freeze/slow effect on an enemy (blue/cyan glow with frost)
function renderFreezeEffect(ctx, enemy) {
    if (!enemy || !enemy.slowed) return;
    
    ctx.save();
    
    // Pulsing blue/cyan glow
    const freezePulse = Math.sin(Date.now() / 150) * 0.5 + 0.5;
    const glowRadius = enemy.size + 4 + freezePulse * 2;
    
    // Outer glow
    ctx.fillStyle = `rgba(100, 200, 255, ${0.25 * freezePulse})`;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner glow
    ctx.fillStyle = `rgba(150, 220, 255, ${0.4 * freezePulse})`;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.size + 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Ice crystals/frost particles around enemy
    const time = Date.now() / 1000;
    for (let i = 0; i < 4; i++) {
        const angle = (time + i * Math.PI / 2) * 0.5; // Slow rotation
        const distance = enemy.size + 8;
        const px = enemy.x + Math.cos(angle) * distance;
        const py = enemy.y + Math.sin(angle) * distance;
        
        ctx.fillStyle = `rgba(200, 240, 255, ${0.7 * freezePulse})`;
        ctx.beginPath();
        // Draw small diamond crystal
        ctx.moveTo(px, py - 3);
        ctx.lineTo(px + 2, py);
        ctx.lineTo(px, py + 3);
        ctx.lineTo(px - 2, py);
        ctx.closePath();
        ctx.fill();
    }
    
    ctx.restore();
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


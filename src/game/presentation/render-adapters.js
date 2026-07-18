// Create burst of particles at position
function createParticleBurst(x, y, color, count = 10) {
    if (typeof Engine === 'undefined' || !Engine.Renderer) return;

    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const speed = 100 + Math.random() * 100;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        Engine.Renderer.submitParticle(x, y, vx, vy, color, 3 + Math.random() * 3, 0.5);
    }
}

function createDirectionalParticleBurst(x, y, dirX, dirY, color, options = {}) {
    if (typeof Engine === 'undefined' || !Engine.Renderer) return;

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

        const particleSize = baseSize + Math.random() * (options.sizeVariance || 2);
        const particleLife = life * (0.8 + Math.random() * 0.4);

        // Slight perpendicular drift for ribbon effect
        const perpX = -normY;
        const perpY = normX;
        const finalVx = vx + perpX * baseSpeed * 0.15 * (Math.random() - 0.5);
        const finalVy = vy + perpY * baseSpeed * 0.15 * (Math.random() - 0.5);

        Engine.Renderer.submitParticle(x, y, finalVx, finalVy, safeColor, particleSize, particleLife);
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

    // Viewport culling helper
    const isArcVisible = (arc) => {
        if (!Game.camera || !Game.config) return true; // Render if no camera

        const zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;
        const margin = 50; // Small margin for arcs

        const screenW = Game.config.width / zoom;
        const screenH = Game.config.height / zoom;

        const viewX = Game.camera.x - screenW / 2 - margin;
        const viewY = Game.camera.y - screenH / 2 - margin;
        const viewW = screenW + margin * 2;
        const viewH = screenH + margin * 2;

        // Check if either endpoint is visible
        const p1Visible = arc.x1 >= viewX && arc.x1 <= viewX + viewW &&
            arc.y1 >= viewY && arc.y1 <= viewY + viewH;
        const p2Visible = arc.x2 >= viewX && arc.x2 <= viewX + viewW &&
            arc.y2 >= viewY && arc.y2 <= viewY + viewH;

        return p1Visible || p2Visible;
    };

    Game.lightningArcs.forEach(arc => {
        // CULLING: Skip if off-screen
        if (!isArcVisible(arc)) return;

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
        const vy = -50 - Math.random() * 30; // Rise upward

        if (typeof Engine !== 'undefined' && Engine.Renderer) {
            Engine.Renderer.submitParticle(px, py, 0, vy, '#ff6600', 2 + Math.random() * 2, 0.3);
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
    if (typeof Engine !== 'undefined' && Engine.Renderer) {
        Engine.Renderer.updateParticles(deltaTime);
    }
}

function renderParticles(ctx) {
    if (typeof Engine === 'undefined' || !Engine.Renderer || !Game) return;

    // Viewport Culling
    let viewX = undefined, viewY = undefined, viewW = undefined, viewH = undefined;

    if (Game.camera && Game.config) {
        const zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;
        const padding = 100; // Margin for particles

        const screenW = Game.config.width / zoom;
        const screenH = Game.config.height / zoom;

        viewX = Game.camera.x - screenW / 2 - padding;
        viewY = Game.camera.y - screenH / 2 - padding;
        viewW = screenW + padding * 2;
        viewH = screenH + padding * 2;
    }

    Engine.Renderer.renderParticles(ctx, viewX, viewY, viewW, viewH);
}

// Biome definitions for different room ranges
const RENDER_FALLBACK_BIOMES = {
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
    const gameMode = (typeof Game !== 'undefined' && Game.gameMode) ? Game.gameMode : 'cards';
    if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.biomeId && typeof BiomeConfig !== 'undefined') {
        return BiomeConfig.getBiomeDefinition(currentRoom.biomeId);
    }
    if (typeof BiomeConfig !== 'undefined') {
        return BiomeConfig.getBiomeForRoomNumber(roomNumber, gameMode);
    }
    if (roomNumber <= 10) return RENDER_FALLBACK_BIOMES.swarm;
    if (roomNumber <= 20) return RENDER_FALLBACK_BIOMES.prism;
    if (roomNumber <= 30) return RENDER_FALLBACK_BIOMES.fortress;
    if (roomNumber <= 40) return RENDER_FALLBACK_BIOMES.fractal;
    if (roomNumber <= 50) return RENDER_FALLBACK_BIOMES.vortex;
    return RENDER_FALLBACK_BIOMES.endless;
}

// Pattern cache to avoid recreating patterns every frame
const patternCache = new Map();

// Helper to get or create a cached pattern for a biome
function getBiomeGridPattern(ctx, biome, isMask, isParallax) {
    const cacheKey = `${biome.pattern}_${biome.gridColor}_${biome.accentColor}_${isMask}_${isParallax}`;

    if (patternCache.has(cacheKey)) {
        return patternCache.get(cacheKey);
    }

    // Create offscreen canvas for the pattern tile
    const patternCanvas = document.createElement('canvas');
    const pCtx = patternCanvas.getContext('2d');

    // Determine grid size and scaling
    // Parallax grid is 2x larger
    const scale = isParallax ? 2 : 1;
    const gridSize = biome.gridSize * scale;

    // Set canvas size based on pattern
    // For diagonal, we need a larger tile to ensure seamless tiling
    const tileSize = (biome.pattern === 'diagonal' || biome.pattern === 'triangle' || biome.pattern === 'rings') ? gridSize * 2 : gridSize;
    patternCanvas.width = tileSize;
    patternCanvas.height = tileSize;

    // Parse color
    const hex = biome.accentColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Style settings
    // If it's a mask (for vignette), we want to "cut" through darkness.
    // We use white/alpha for the mask to control how much darkness is removed.
    // If it's normal render, we use the biome colors.

    const glowWidth = isParallax ? 2 : 3;
    const coreWidth = 1;

    // Alpha values
    let glowAlpha, coreAlpha;
    let glowColor, coreColor;

    if (isMask) {
        // For vignette mask:
        // We want to remove darkness, so we draw with opacity.
        // Higher alpha = more darkness removed = brighter glow.
        // User feedback: "a little darker". reduced slightly more.
        glowAlpha = isParallax ? 0.015 : 0.04;
        coreAlpha = isParallax ? 0.04 : 0.12;

        // Use white for mask (alpha controls intensity)
        glowColor = `rgba(255, 255, 255, ${glowAlpha})`;
        coreColor = `rgba(255, 255, 255, ${coreAlpha})`;
    } else {
        // Normal render
        // Floor motifs are intentionally faint: solid scenery is filled and outlined elsewhere.
        glowAlpha = isParallax ? 0.045 : 0.09;
        coreAlpha = isParallax ? 0.06 : 0.14;

        glowColor = `rgba(${r}, ${g}, ${b}, ${glowAlpha})`;
        // Core is usually the grid color, but we can use accent for "neon" look
        // biome.gridColor is usually very faint. Let's use accent with low alpha for core.
        coreColor = `rgba(${r}, ${g}, ${b}, ${coreAlpha})`;
    }

    // Draw Pattern
    pCtx.lineCap = 'square';

    const drawLine = (x1, y1, x2, y2, width, color) => {
        pCtx.beginPath();
        pCtx.lineWidth = width;
        pCtx.strokeStyle = color;
        pCtx.moveTo(x1, y1);
        pCtx.lineTo(x2, y2);
        pCtx.stroke();
    };

    if (biome.pattern === 'grid') {
        // Draw Glow (Vertical & Horizontal)
        // We draw at 0 and tileSize to ensure wrapping?
        // Actually for a pattern, drawing at x=0.5 or similar helps crispness, 
        // but for glow we want soft.
        // Draw lines along top and left edges. 
        // Since it repeats, top edge of one is bottom of another.

        // Vertical
        drawLine(0, 0, 0, tileSize, glowWidth, glowColor);
        drawLine(0, 0, 0, tileSize, coreWidth, coreColor);

        // Horizontal
        drawLine(0, 0, tileSize, 0, glowWidth, glowColor);
        drawLine(0, 0, tileSize, 0, coreWidth, coreColor);

    } else if (biome.pattern === 'diagonal') {
        pCtx.setLineDash([tileSize * 0.06, tileSize * 0.08]);
        // Diagonal X pattern
        // Line 1: Top-Left to Bottom-Right
        drawLine(0, 0, tileSize, tileSize, glowWidth, glowColor);
        drawLine(0, 0, tileSize, tileSize, coreWidth, coreColor);

        // Line 2: Top-Right to Bottom-Left
        drawLine(tileSize, 0, 0, tileSize, glowWidth, glowColor);
        drawLine(tileSize, 0, 0, tileSize, coreWidth, coreColor);
        pCtx.setLineDash([]);
    } else if (biome.pattern === 'triangle') {
        pCtx.setLineDash([tileSize * 0.06, tileSize * 0.08]);
        drawLine(0, tileSize, tileSize / 2, 0, glowWidth, glowColor);
        drawLine(tileSize / 2, 0, tileSize, tileSize, glowWidth, glowColor);
        drawLine(0, tileSize, tileSize, tileSize, glowWidth, glowColor);
        drawLine(0, tileSize, tileSize / 2, 0, coreWidth, coreColor);
        drawLine(tileSize / 2, 0, tileSize, tileSize, coreWidth, coreColor);
        drawLine(0, tileSize, tileSize, tileSize, coreWidth, coreColor);
        pCtx.setLineDash([]);
    } else if (biome.pattern === 'rings') {
        pCtx.beginPath();
        pCtx.setLineDash([tileSize * 0.08, tileSize * 0.08]);
        pCtx.lineWidth = glowWidth;
        pCtx.strokeStyle = glowColor;
        pCtx.arc(tileSize / 2, tileSize / 2, tileSize * 0.35, 0, Math.PI * 2);
        pCtx.stroke();
        pCtx.beginPath();
        pCtx.lineWidth = coreWidth;
        pCtx.strokeStyle = coreColor;
        pCtx.arc(tileSize / 2, tileSize / 2, tileSize * 0.35, 0, Math.PI * 2);
        pCtx.stroke();
        pCtx.setLineDash([]);
    }

    // Create pattern
    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    patternCache.set(cacheKey, pattern);
    return pattern;
}

function drawBiomeGrid(ctx, roomNumber, isVignetteMask = false, forceNoCulling = false) {
    // Use room size (larger than canvas/viewport)
    const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
    const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
    const biome = getBiomeForRoom(roomNumber);

    // Viewport Culling Calculation
    let viewX = 0, viewY = 0, viewW = roomWidth, viewH = roomHeight;
    let zoom = 1.0;

    if (!forceNoCulling && typeof Game !== 'undefined' && Game.camera && Game.config) {
        // Get camera position and zoom
        zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;

        // Calculate visible world area
        const padding = 200;
        const screenW = Game.config.width / zoom;
        const screenH = Game.config.height / zoom;

        viewX = Game.camera.x - screenW / 2 - padding;
        viewY = Game.camera.y - screenH / 2 - padding;
        viewW = screenW + padding * 2;
        viewH = screenH + padding * 2;
    }

    // --- PARALLAX GRID (Background Layer) ---
    if (typeof Game !== 'undefined' && Game.camera) {
        ctx.save();

        const parallaxFactor = 0.5;
        const offsetX = Game.camera.x * (1 - parallaxFactor);
        const offsetY = Game.camera.y * (1 - parallaxFactor);

        ctx.translate(offsetX, offsetY);

        // Calculate visible bounds for parallax
        const paraViewX = viewX - offsetX;
        const paraViewY = viewY - offsetY;

        // Clamp to room bounds (extended)
        const startX = Math.max(-roomWidth, paraViewX);
        const endX = Math.min(roomWidth * 2, paraViewX + viewW);
        const startY = Math.max(-roomHeight, paraViewY);
        const endY = Math.min(roomHeight * 2, paraViewY + viewH);

        const width = endX - startX;
        const height = endY - startY;

        if (width > 0 && height > 0) {
            const pattern = getBiomeGridPattern(ctx, biome, isVignetteMask, true);
            ctx.fillStyle = pattern;

            // We need to offset the fillRect to align pattern?
            // createPattern 'repeat' starts at 0,0 of the canvas (or transformed origin).
            // Since we translated context, 0,0 is at offsetX, offsetY.
            // The pattern should align naturally if we just fill the rect.
            ctx.fillRect(startX, startY, width, height);
        }

        ctx.restore();
    }

    // --- MAIN GRID (Foreground Layer) ---
    ctx.save();

    // Calculate visible bounds for main layer
    const mainStartX = Math.max(0, viewX);
    const mainEndX = Math.min(roomWidth, viewX + viewW);
    const mainStartY = Math.max(0, viewY);
    const mainEndY = Math.min(roomHeight, viewY + viewH);

    const mainW = mainEndX - mainStartX;
    const mainH = mainEndY - mainStartY;

    if (mainW > 0 && mainH > 0) {
        const pattern = getBiomeGridPattern(ctx, biome, isVignetteMask, false);
        ctx.fillStyle = pattern;
        ctx.fillRect(mainStartX, mainStartY, mainW, mainH);
    }

    ctx.restore();
}

const ROOM_STATIC_CACHE_MAX_DPR = 1.5;
const ROOM_STATIC_CACHE_MAX_PIXELS = 1920 * 1080;

function getRoomStaticCacheKey(room, roomNumber) {
    if (!room) return '';
    const biome = typeof getBiomeForRoom !== 'undefined' ? getBiomeForRoom(roomNumber || room.number || 1) : null;
    const biomeKey = biome ? `${biome.id || room.biomeId || 'fallback'}:${biome.pattern}:${biome.gridSize}:${biome.accentColor}:${biome.baseColor}` : 'fallback';
    return [
        roomNumber || room.number || 1,
        room.type || 'normal',
        room.biomeId || 'unknown',
        room.layoutVersion || (room.layout && room.layout.layoutVersion) || 0,
        room.layoutHash || (room.layout && room.layout.hash) || 'no-layout',
        room.width || 2400,
        room.height || 1350,
        room.layout && room.layout.cellSize ? room.layout.cellSize : 0,
        biomeKey
    ].join('|');
}

function getRoomStaticCacheScale(room) {
    const roomWidth = Math.max(1, room && room.width ? room.width : 2400);
    const roomHeight = Math.max(1, room && room.height ? room.height : 1350);
    const dpr = (typeof Game !== 'undefined' && Game && Game.dpr) ? Game.dpr : (typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1);
    const pixelCapScale = Math.sqrt(ROOM_STATIC_CACHE_MAX_PIXELS / Math.max(1, roomWidth * roomHeight));
    return Math.max(0.25, Math.min(dpr, ROOM_STATIC_CACHE_MAX_DPR, pixelCapScale));
}

function releaseRoomRenderCaches(room) {
    if (!room || !room.renderCache) return;
    const cache = room.renderCache;
    if (cache.staticSceneCanvas) {
        cache.staticSceneCanvas.width = 0;
        cache.staticSceneCanvas.height = 0;
    }
    if (cache.staticLightCanvas) {
        cache.staticLightCanvas.width = 0;
        cache.staticLightCanvas.height = 0;
    }
    room.renderCache = null;
}

function computeBlockedRuns(layout) {
    const runs = [];
    if (!layout || !Array.isArray(layout.grid)) return runs;
    for (let row = 0; row < layout.rows; row++) {
        let runStart = -1;
        for (let col = 0; col <= layout.cols; col++) {
            const blocked = col < layout.cols && layout.grid[row * layout.cols + col] === 1;
            if (blocked && runStart === -1) {
                runStart = col;
            } else if (!blocked && runStart !== -1) {
                const runLength = col - runStart;
                runs.push({
                    row,
                    startCol: runStart,
                    col: runStart,
                    length: runLength,
                    x: runStart * layout.cellSize,
                    y: row * layout.cellSize,
                    width: runLength * layout.cellSize,
                    height: layout.cellSize,
                    centerX: (runStart + runLength / 2) * layout.cellSize,
                    centerY: row * layout.cellSize + layout.cellSize / 2
                });
                runStart = -1;
            }
        }
    }
    return runs;
}

function computeSwarmHiveClusters(layout) {
    if (!layout || !Array.isArray(layout.grid)) return [];
    const visited = new Set();
    const clusters = [];
    const keyFor = (col, row) => `${col},${row}`;
    const isBlocked = (col, row) => (
        col >= 0 &&
        row >= 0 &&
        col < layout.cols &&
        row < layout.rows &&
        layout.grid[row * layout.cols + col] === 1
    );

    for (let row = 0; row < layout.rows; row++) {
        for (let col = 0; col < layout.cols; col++) {
            if (!isBlocked(col, row)) continue;
            const startKey = keyFor(col, row);
            if (visited.has(startKey)) continue;

            const cluster = [];
            const stack = [{ col, row }];
            visited.add(startKey);

            while (stack.length > 0) {
                const cell = stack.pop();
                cluster.push(cell);
                [
                    { col: cell.col + 1, row: cell.row },
                    { col: cell.col - 1, row: cell.row },
                    { col: cell.col, row: cell.row + 1 },
                    { col: cell.col, row: cell.row - 1 }
                ].forEach(neighbor => {
                    const neighborKey = keyFor(neighbor.col, neighbor.row);
                    if (!visited.has(neighborKey) && isBlocked(neighbor.col, neighbor.row)) {
                        visited.add(neighborKey);
                        stack.push(neighbor);
                    }
                });
            }

            clusters.push(cluster);
        }
    }

    return clusters;
}

function prepareRoomRenderData(room, roomNumber) {
    if (!room || !room.layout) return;
    const layout = room.layout;
    const generatedKey = `${layout.hash || room.layoutHash || 'no-hash'}:${layout.biomeId || room.biomeId || 'unknown'}`;
    if (layout.renderDataKey === generatedKey) return;

    layout.cachedBlockedRuns = computeBlockedRuns(layout);
    room.blockedRuns = layout.cachedBlockedRuns;

    if (typeof RoomLayoutGenerator !== 'undefined') {
        const limits = layout.contentLimits || (typeof RoomLayoutGenerator.getContentLimits === 'function'
            ? RoomLayoutGenerator.getContentLimits(layout.width, layout.height, layout.archetype || 'road')
            : null);
        const decorLimit = limits ? limits.decorations : (layout.biomeId === 'swarm' ? 70 : 90);
        const outerDecorLimit = limits ? Math.round(limits.decorations * 0.55) : (layout.biomeId === 'swarm' ? 26 : 50);
        const fixtureLimit = limits ? limits.fixtures : (layout.biomeId === 'swarm' ? 18 : 32);
        if (typeof RoomLayoutGenerator.generateDecorations === 'function') {
            layout.cachedOuterDecorations = RoomLayoutGenerator.generateDecorations(layout, outerDecorLimit);
            layout.cachedDecorations = RoomLayoutGenerator.generateDecorations(layout, decorLimit);
        }
        if (typeof RoomLayoutGenerator.generateSceneryFixtures === 'function') {
            layout.cachedFixtures = RoomLayoutGenerator.generateSceneryFixtures(layout, fixtureLimit);
            layout.cachedLightFixtures = RoomLayoutGenerator.generateSceneryFixtures(layout, Math.min(fixtureLimit + 8, 72));
        }
    }

    if (typeof buildDebrisSceneryColliders === 'function') {
        layout.cachedDebrisColliders = buildDebrisSceneryColliders(layout);
        room.debrisSceneryColliders = layout.cachedDebrisColliders;
    }

    layout.cachedSwarmHiveClusters = layout.biomeId === 'swarm' ? computeSwarmHiveClusters(layout) : [];

    const lightRadius = Math.max(80, layout.cellSize * 1.35);
    const emitters = layout.cachedBlockedRuns.map(run => ({
        x: run.centerX,
        y: run.centerY,
        radius: lightRadius + Math.min(140, run.length * layout.cellSize * 0.25),
        type: 'scenery'
    }));
    const fixtures = Array.isArray(layout.cachedLightFixtures) ? layout.cachedLightFixtures : [];
    fixtures.forEach(fixture => {
        if (!fixture || !fixture.glow) return;
        emitters.push({
            x: fixture.x,
            y: fixture.y,
            radius: Math.max(110, (fixture.size || layout.cellSize * 0.35) * 5.2),
            type: 'fixture'
        });
    });

    layout.cachedSceneryLightEmitters = emitters;
    room.sceneryLightEmitters = emitters;
    layout.renderDataKey = generatedKey;
}

function bakeRoomStaticSceneCache(room, roomNumber) {
    if (!room) return null;

    const cacheKey = getRoomStaticCacheKey(room, roomNumber);
    const cacheScale = getRoomStaticCacheScale(room);
    const canvasWidth = Math.max(1, Math.floor((room.width || 2400) * cacheScale));
    const canvasHeight = Math.max(1, Math.floor((room.height || 1350) * cacheScale));
    const existing = room.renderCache;
    if (existing && existing.key === cacheKey && existing.scale === cacheScale && existing.staticSceneCanvas && existing.staticSceneCanvas.width === canvasWidth && existing.staticSceneCanvas.height === canvasHeight) {
        return existing;
    }

    releaseRoomRenderCaches(room);

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const cacheCtx = canvas.getContext('2d');
    cacheCtx.imageSmoothingEnabled = true;
    cacheCtx.save();
    cacheCtx.scale(cacheScale, cacheScale);
    cacheCtx.clearRect(0, 0, room.width || 2400, room.height || 1350);
    if (typeof drawBiomeGrid === 'function') drawBiomeGrid(cacheCtx, roomNumber || room.number || 1, false, true);
    if (typeof renderRoomVisualMotifs === 'function') renderRoomVisualMotifs(cacheCtx, roomNumber || room.number || 1);
    if (typeof renderRoomSemanticScenery === 'function') renderRoomSemanticScenery(cacheCtx, roomNumber || room.number || 1, { skipAmbientLife: true, skipDebrisInteractiveFixtures: true });
    if (typeof renderRoomBoundaries === 'function') renderRoomBoundaries(cacheCtx, roomNumber || room.number || 1);
    if (typeof renderRoomObstacles === 'function') renderRoomObstacles(cacheCtx, roomNumber || room.number || 1);
    cacheCtx.restore();

    room.renderCache = {
        key: cacheKey,
        scale: cacheScale,
        staticSceneCanvas: canvas,
        width: room.width || 2400,
        height: room.height || 1350
    };
    return room.renderCache;
}

function prepareRoomRenderCaches(room, roomNumber) {
    if (!room) return null;
    prepareRoomRenderData(room, roomNumber);
    return bakeRoomStaticSceneCache(room, roomNumber);
}

function renderCachedRoomStaticLayer(ctx, roomNumber) {
    if (typeof currentRoom === 'undefined' || !currentRoom) return false;
    if (typeof DebugFlags !== 'undefined' && DebugFlags.USE_CACHING === false) return false;
    const cache = prepareRoomRenderCaches(currentRoom, roomNumber);
    if (!cache || !cache.staticSceneCanvas) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cache.staticSceneCanvas, 0, 0, cache.width, cache.height);
    ctx.restore();
    return true;
}

// Render room background with biome styling (should be called inside camera transform)
function renderRoomBackground(ctx, roomNumber) {
    // NOTE: Base color is already cleared outside camera transform in main.js
    // We only draw the grid pattern here (in world space, so it stays fixed to floor)

    drawBiomeGrid(ctx, roomNumber, false);
    renderRoomVisualMotifs(ctx, roomNumber);
    renderRoomSemanticScenery(ctx, roomNumber, { skipDebrisInteractiveFixtures: true });

    // Add subtle accent overlay for boss rooms (gear: every 10 from 10)
    if (roomNumber % 10 === 0 && roomNumber >= 10) {
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
        const biome = getBiomeForRoom(roomNumber);

        // Boss room - add subtle pulsing effect
        const pulseTime = Date.now() * 0.001;
        const pulseAlpha = 0.05 + Math.sin(pulseTime) * 0.02;

        // Parse hex color to RGB for glow effects
        const hex = biome.accentColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pulseAlpha})`;
        ctx.fillRect(0, 0, roomWidth, roomHeight);
    }
}

function renderRoomVisualMotifs(ctx, roomNumber) {
    if (typeof currentRoom === 'undefined' || !currentRoom || !Array.isArray(currentRoom.visualMotifs)) return;
    const biome = getBiomeForRoom(roomNumber);
    const roomWidth = currentRoom.width || 2400;
    const roomHeight = currentRoom.height || 1350;
    const centerX = roomWidth / 2;
    const centerY = roomHeight / 2;
    const hex = biome.accentColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.035)`;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 14]);
    ctx.shadowBlur = 0;

    currentRoom.visualMotifs.forEach(motif => {
        if (!motif || !motif.type) return;

        if (motif.type === 'swarmBossArena') {
            for (let ring = 0; ring < 3; ring++) {
                const radius = 210 + ring * 150;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = Math.PI / 6 + (Math.PI * 2 * i) / 6;
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius * 0.72;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();
            }
        } else if (motif.type === 'prismDashLanes') {
            ctx.beginPath();
            ctx.moveTo(centerX - 850, centerY - 430);
            ctx.lineTo(centerX + 850, centerY + 430);
            ctx.moveTo(centerX + 850, centerY - 430);
            ctx.lineTo(centerX - 850, centerY + 430);
            ctx.moveTo(centerX - 850, centerY);
            ctx.lineTo(centerX + 850, centerY);
            ctx.stroke();
        } else if (motif.type === 'fortressBossLanes') {
            ctx.strokeRect(centerX - 620, centerY - 390, 1240, 780);
            ctx.strokeRect(centerX - 360, centerY - 220, 720, 440);
            ctx.beginPath();
            ctx.moveTo(centerX - 900, centerY);
            ctx.lineTo(centerX + 900, centerY);
            ctx.moveTo(centerX, centerY - 520);
            ctx.lineTo(centerX, centerY + 520);
            ctx.stroke();
        } else if (motif.type === 'fractalBossIslands') {
            for (let i = 0; i < 4; i++) {
                const radius = 170 + i * 125;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY - radius * 0.65);
                ctx.lineTo(centerX + radius, centerY);
                ctx.lineTo(centerX, centerY + radius * 0.65);
                ctx.lineTo(centerX - radius, centerY);
                ctx.closePath();
                ctx.stroke();
            }
        } else if (motif.type === 'vortexOrbitLanes' || motif.type === 'radialRings') {
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, 250 + i * 140, (250 + i * 140) * 0.62, i * 0.18, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    });

    ctx.setLineDash([]);
    ctx.restore();
}

function isDebrisInteractiveFixture(fixture) {
    if (!fixture) return false;
    const lampTypes = new Set(['streetLamp', 'prismLamp', 'runeLamp', 'voidLamp', 'riftLamp']);
    return fixture.type === 'trailMarker'
        || fixture.purpose === 'wayfinding'
        || fixture.purpose === 'streetLight'
        || lampTypes.has(fixture.type)
        || fixture.type === 'bioLantern';
}

function renderDebrisInteractiveFixtures(ctx, roomNumber) {
    renderRoomSemanticScenery(ctx, roomNumber, { debrisInteractiveOnly: true });
}

function renderRoomSemanticScenery(ctx, roomNumber, options = {}) {
    if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.layout) return;
    const layout = currentRoom.layout;
    if (typeof prepareRoomRenderData === 'function') {
        prepareRoomRenderData(currentRoom, roomNumber);
    }
    const paths = Array.isArray(layout.paths) ? layout.paths : [];
    const landmarks = Array.isArray(layout.landmarks) ? layout.landmarks : [];
    const plazas = Array.isArray(layout.plazas) ? layout.plazas : [];
    if (!options.debrisInteractiveOnly && paths.length === 0 && landmarks.length === 0) return;

    const biome = getBiomeForRoom(roomNumber);
    const hex = biome.accentColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const scenery = biome.scenery || {};

    // Add ambient outer zone coverage to prevent void-floating enemies
    const renderOuterAmbience = () => {
        ctx.save();
        
        // Create subtle floor texture in outer zones
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
        
        // Draw outer zone ambient base
        const margin = 60;
        const centerX = layout.width / 2;
        const centerY = layout.height / 2;
        const maxRadius = Math.max(layout.width, layout.height) * 0.75;
        
        // Radial fade from center
        const gradient = ctx.createRadialGradient(centerX, centerY, maxRadius * 0.3, centerX, centerY, maxRadius);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.05)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.12)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, layout.width, layout.height);
        
        // Add sparse scatter elements in outer zones
        const outerDecorations = Array.isArray(layout.cachedOuterDecorations)
            ? layout.cachedOuterDecorations
            : (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator.generateDecorations
                ? RoomLayoutGenerator.generateDecorations(layout, layout.biomeId === 'swarm' ? 26 : 50)
                : []);
        if (outerDecorations.length > 0) {
            outerDecorations.forEach(decoration => {
                // Only draw decorations in outer zones (away from roads/landmarks)
                let nearStructure = false;
                landmarks.forEach(landmark => {
                    const dx = decoration.x - landmark.x;
                    const dy = decoration.y - landmark.y;
                    if (Math.sqrt(dx * dx + dy * dy) < landmark.radius * 2.5) {
                        nearStructure = true;
                    }
                });
                
                // Also check distance from paths
                if (!nearStructure && Array.isArray(layout.paths)) {
                    layout.paths.forEach(path => {
                        if (Array.isArray(path.points)) {
                            path.points.forEach(point => {
                                const dx = decoration.x - point.x;
                                const dy = decoration.y - point.y;
                                if (Math.sqrt(dx * dx + dy * dy) < (path.width || 150) + 60) {
                                    nearStructure = true;
                                }
                            });
                        }
                    });
                }
                
                if (!nearStructure) {
                    ctx.globalAlpha = layout.biomeId === 'swarm' ? 0.10 : 0.18;
                    drawDecoration(decoration);
                }
            });
        }
        
        // Add subtle grid/texture to break up completely empty areas
        ctx.globalAlpha = 0.03;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
        ctx.lineWidth = 0.5;
        
        // Very sparse grid lines in empty areas
        for (let x = layout.cellSize * 3; x < layout.width; x += layout.cellSize * 8) {
            for (let y = layout.cellSize * 3; y < layout.height; y += layout.cellSize * 8) {
                let inEmptyZone = true;
                
                // Check if this grid position is away from structures
                landmarks.forEach(landmark => {
                    const dx = x - landmark.x;
                    const dy = y - landmark.y;
                    if (Math.sqrt(dx * dx + dy * dy) < landmark.radius * 3) {
                        inEmptyZone = false;
                    }
                });
                
                if (inEmptyZone) {
                    ctx.beginPath();
                    ctx.moveTo(x - layout.cellSize * 0.3, y);
                    ctx.lineTo(x + layout.cellSize * 0.3, y);
                    ctx.moveTo(x, y - layout.cellSize * 0.3);
                    ctx.lineTo(x, y + layout.cellSize * 0.3);
                    ctx.stroke();
                }
            }
        }
        
        ctx.restore();
    };

    const drawPlaza = (plaza) => {
        if (!plaza) return;
        const radius = plaza.radius || layout.cellSize * 2;
        ctx.save();
        ctx.globalAlpha = 0.24;
        ctx.fillStyle = `rgba(0, 0, 0, 0.34)`;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.28)`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.18)`;

        if (layout.biomeId === 'prism') {
            drawPolygon(plaza.x, plaza.y, radius, 4, 1, Math.PI / 4);
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 0.18;
            drawPolygon(plaza.x, plaza.y, radius * 0.62, 4, 1, 0);
            ctx.stroke();
        } else if (layout.biomeId === 'fortress') {
            drawRotatedRect(plaza.x, plaza.y, radius * 1.65, radius * 1.15, 0, true, true);
            ctx.globalAlpha = 0.16;
            drawRotatedRect(plaza.x, plaza.y, radius * 1.18, radius * 0.74, 0, false, true);
        } else if (layout.biomeId === 'fractal') {
            for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = 0.24 - i * 0.045;
                drawPolygon(plaza.x, plaza.y, radius * (1 - i * 0.22), 4, 1, Math.PI / 4 + i * 0.35);
                if (i === 0) ctx.fill();
                ctx.stroke();
            }
        } else if (layout.biomeId === 'vortex') {
            ctx.beginPath();
            ctx.ellipse(plaza.x, plaza.y, radius, radius * 0.62, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 0.20;
            ctx.beginPath();
            ctx.ellipse(plaza.x, plaza.y, radius * 0.62, radius * 0.34, Math.PI / 5, 0, Math.PI * 2);
            ctx.stroke();
        } else if (layout.biomeId === 'endless') {
            drawPolygon(plaza.x - radius * 0.12, plaza.y, radius * 0.82, 5, 0.78, -Math.PI / 2);
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 0.18;
            drawRotatedRect(plaza.x + radius * 0.2, plaza.y - radius * 0.08, radius * 0.78, radius * 0.36, -0.35, false, true);
        } else {
            ctx.beginPath();
            ctx.arc(plaza.x, plaza.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    };

    const drawPath = (path) => {
        if (!path || !Array.isArray(path.points) || path.points.length < 2) return;

        const pathWidth = path.width || 150;
        const isAccess = path.type && path.type.includes('Access');
        const isOffshoot = path.type === 'offshoot';

        if (isOffshoot) {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([18, 14]);
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = path.color || `rgba(${r}, ${g}, ${b}, 0.18)`;
            ctx.lineWidth = pathWidth * 0.65;
            ctx.beginPath();
            path.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.lineCap = path.type === 'stoneRoad' ? 'butt' : 'round';
        ctx.lineJoin = 'round';

        // Draw elevated road base with depth shadow
        ctx.globalAlpha = 0.65;
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(0, 0, 0, 0.45)`;
        ctx.strokeStyle = `rgba(${Math.floor(r * 0.2)}, ${Math.floor(g * 0.2)}, ${Math.floor(b * 0.2)}, 0.35)`;
        ctx.lineWidth = pathWidth * (isAccess ? 1.25 : 1.35);
        ctx.beginPath();
        path.points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();

        // Draw main road surface with biome-specific texture
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.25)`;
        ctx.globalAlpha = isAccess ? 0.78 : 0.88;

        if (path.type === 'hiveTrail') {
            // Swarm: Organic hex tile pattern
            ctx.strokeStyle = path.color || scenery.roadColor || `rgba(${r}, ${g}, ${b}, 0.22)`;
            ctx.lineWidth = pathWidth * 0.95;
            ctx.beginPath();
            path.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();

            // Add hex pattern overlay
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.24;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
            ctx.lineWidth = 1.5;
            
            path.points.forEach((point, segmentIndex) => {
                if (segmentIndex === 0) return;
                const prevPoint = path.points[segmentIndex - 1];
                const segmentLength = Math.sqrt((point.x - prevPoint.x) ** 2 + (point.y - prevPoint.y) ** 2);
                const hexSpacing = 72;
                const hexCount = Math.floor(segmentLength / hexSpacing);
                
                for (let i = 0; i < hexCount; i++) {
                    const t = (i + 0.5) / hexCount;
                    const hexX = prevPoint.x + (point.x - prevPoint.x) * t;
                    const hexY = prevPoint.y + (point.y - prevPoint.y) * t;
                    
                    // Draw small hex tiles on road surface
                    drawPolygon(hexX, hexY, 12, 6, 1, Math.PI / 6);
                    ctx.stroke();
                }
            });

        } else if (path.type === 'crystalCauseway' || path.type === 'mirrorLane') {
            ctx.strokeStyle = path.color || scenery.roadColor || `rgba(${r}, ${g}, ${b}, 0.22)`;
            ctx.lineWidth = pathWidth * 0.9;
            ctx.beginPath();
            path.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.46;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.32)`;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.68)`;
            ctx.lineWidth = 1.5;
            path.points.forEach((point, segmentIndex) => {
                if (segmentIndex === 0) return;
                const prevPoint = path.points[segmentIndex - 1];
                const segmentLength = Math.sqrt((point.x - prevPoint.x) ** 2 + (point.y - prevPoint.y) ** 2);
                const facets = Math.floor(segmentLength / 70);
                for (let i = 0; i < facets; i++) {
                    const t = (i + 0.5) / facets;
                    drawPolygon(prevPoint.x + (point.x - prevPoint.x) * t, prevPoint.y + (point.y - prevPoint.y) * t, 8, 3, 1, -Math.PI / 2);
                    ctx.fill();
                    ctx.stroke();
                }
            });
        } else if (path.type === 'fractalPath' || path.type === 'recursiveTrace' || path.type === 'recursiveTraceAccess' || layout.biomeId === 'fractal') {
            // Fractal: Segmented diamond causeway
            ctx.strokeStyle = path.color || scenery.roadColor || `rgba(${r}, ${g}, ${b}, 0.22)`;
            ctx.lineWidth = pathWidth * 0.9;
            
            // Draw segmented base
            const segmentLength = 48;
            path.points.forEach((point, segmentIndex) => {
                if (segmentIndex === 0) return;
                const prevPoint = path.points[segmentIndex - 1];
                const totalLength = Math.sqrt((point.x - prevPoint.x) ** 2 + (point.y - prevPoint.y) ** 2);
                const segments = Math.floor(totalLength / segmentLength);
                
                for (let i = 0; i < segments; i++) {
                    const t1 = (i * segmentLength) / totalLength;
                    const t2 = ((i + 0.7) * segmentLength) / totalLength; // 70% coverage per segment
                    
                    const x1 = prevPoint.x + (point.x - prevPoint.x) * t1;
                    const y1 = prevPoint.y + (point.y - prevPoint.y) * t1;
                    const x2 = prevPoint.x + (point.x - prevPoint.x) * t2;
                    const y2 = prevPoint.y + (point.y - prevPoint.y) * t2;
                    
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            });

            // Add diamond inlays between segments
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.72;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.45)`;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
            ctx.lineWidth = 1.5;
            
            path.points.forEach((point, segmentIndex) => {
                if (segmentIndex === 0) return;
                const prevPoint = path.points[segmentIndex - 1];
                const totalLength = Math.sqrt((point.x - prevPoint.x) ** 2 + (point.y - prevPoint.y) ** 2);
                const segments = Math.floor(totalLength / segmentLength);
                
                for (let i = 0; i < segments; i++) {
                    const t = ((i + 0.85) * segmentLength) / totalLength; // Diamond at segment gap
                    const diamondX = prevPoint.x + (point.x - prevPoint.x) * t;
                    const diamondY = prevPoint.y + (point.y - prevPoint.y) * t;
                    
                    drawPolygon(diamondX, diamondY, 6, 4, 1, Math.PI / 4);
                    ctx.fill();
                    ctx.stroke();
                }
            });

        } else if (path.type === 'stoneRoad' || path.type === 'serviceRoad') {
            // Fortress: Worn stone blocks
            ctx.strokeStyle = path.color || scenery.roadColor || `rgba(${r}, ${g}, ${b}, 0.22)`;
            ctx.lineWidth = pathWidth;
            ctx.setLineDash([42, 18]);
            ctx.beginPath();
            path.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.setLineDash([]);

            // Add worn edge texture
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = `rgba(${Math.floor(r * 0.6)}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.6)}, 0.55)`;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 12, 3, 12]);
            ctx.beginPath();
            path.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.setLineDash([]);

        } else if (path.type === 'spiralWake' || path.type === 'orbitArc') {
            ctx.strokeStyle = path.color || scenery.roadColor || `rgba(${r}, ${g}, ${b}, 0.22)`;
            ctx.lineWidth = pathWidth;
            ctx.beginPath();
            path.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.34;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.58)`;
            ctx.lineWidth = 2;
            path.points.slice(1, -1).forEach(point => {
                ctx.beginPath();
                ctx.ellipse(point.x, point.y, pathWidth * 0.45, pathWidth * 0.18, 0.5, 0, Math.PI * 2);
                ctx.stroke();
            });
        } else if (path.type === 'corruptedRoad' || path.type === 'riftAlley') {
            ctx.strokeStyle = path.color || scenery.roadColor || `rgba(${r}, ${g}, ${b}, 0.22)`;
            ctx.lineWidth = pathWidth;
            ctx.setLineDash([34, 16, 8, 12]);
            ctx.beginPath();
            path.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Default/Vortex: Smooth energy flow
            ctx.strokeStyle = path.color || scenery.roadColor || `rgba(${r}, ${g}, ${b}, 0.22)`;
            ctx.lineWidth = pathWidth;
            ctx.beginPath();
            path.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
        }

        // Add road edge highlights for depth
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.65)`;
        ctx.lineWidth = Math.max(4, pathWidth * (isAccess ? 0.12 : 0.14));
        ctx.beginPath();
        path.points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();

        ctx.restore();
    };

    const drawRotatedRect = (x, y, width, height, rotation, fill, stroke) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation || 0);
        if (fill) ctx.fillRect(-width / 2, -height / 2, width, height);
        if (stroke) ctx.strokeRect(-width / 2, -height / 2, width, height);
        ctx.restore();
    };

    const drawPolygon = (x, y, radius, sides, scaleY, rotation) => {
        ctx.beginPath();
        const baseRotation = rotation !== undefined ? rotation : -Math.PI / 2;
        for (let i = 0; i < sides; i++) {
            const angle = baseRotation + (Math.PI * 2 * i) / sides;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius * (scaleY || 1);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    };

    const transformLocal = (originX, originY, localX, localY, rotation) => {
        const cos = Math.cos(rotation || 0);
        const sin = Math.sin(rotation || 0);
        return {
            x: originX + localX * cos - localY * sin,
            y: originY + localX * sin + localY * cos
        };
    };

    const drawAlignedHex = (originX, originY, localX, localY, radius, rotation, alpha, fill) => {
        const point = transformLocal(originX, originY, localX, localY, rotation);
        ctx.globalAlpha = alpha;
        drawPolygon(point.x, point.y, radius, 6, 1, rotation);
        if (fill) ctx.fill();
        ctx.stroke();
    };

    const drawLandmarkFoundation = (landmark) => {
        if (!landmark || !landmark.footprint) return;
        const footprint = landmark.footprint;
        const rotation = footprint.rotation || 0;
        const width = footprint.width || landmark.radius * 2.4;
        const height = footprint.height || landmark.radius * 1.55;

        ctx.save();

        if (layout.biomeId === 'swarm') {
            const padRadius = Math.max(width, height) * 0.36;
            const cellRadius = Math.max(12, padRadius * 0.16);
            const stepX = cellRadius * 1.72;
            const stepY = cellRadius * 1.5;
            const honeycombCells = [
                { x: 0, y: 0, s: 1 },
                { x: -stepX, y: 0, s: 0.86 },
                { x: stepX, y: 0, s: 0.86 },
                { x: -stepX / 2, y: -stepY, s: 0.76 },
                { x: stepX / 2, y: -stepY, s: 0.76 },
                { x: -stepX / 2, y: stepY, s: 0.76 },
                { x: stepX / 2, y: stepY, s: 0.76 }
            ];

            ctx.globalAlpha = 0.28;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
            ctx.shadowBlur = 14;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            drawPolygon(footprint.x, footprint.y, padRadius * 1.12, 6, 1, rotation);
            ctx.fill();

            ctx.shadowBlur = 12;
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.35)`;
            ctx.globalAlpha = 0.42;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.10)`;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.56)`;
            ctx.lineWidth = 2.5;
            drawPolygon(footprint.x, footprint.y, padRadius, 6, 1, rotation);
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.lineWidth = 2;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.08)`;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.64)`;
            honeycombCells.forEach((cell, index) => {
                drawAlignedHex(
                    footprint.x,
                    footprint.y,
                    cell.x,
                    cell.y,
                    cellRadius * cell.s,
                    rotation,
                    index === 0 ? 0.50 : 0.38,
                    true
                );
            });

            ctx.restore();
            return;
        }

        // Draw deeper courtyard floor for depth layering
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = `rgba(0, 0, 0, 0.35)`; // Darker recessed floor
        ctx.shadowBlur = 15;
        ctx.shadowColor = `rgba(0, 0, 0, 0.45)`;
        
        if (layout.biomeId === 'swarm' && footprint.type === 'nestBed') {
            // Swarm: Hexagonal foundation (keep it structured)
            drawPolygon(footprint.x, footprint.y, Math.max(width, height) * 0.45, 6, 0.75, rotation);
            ctx.fill();
        } else if (footprint.type === 'orbitPad') {
            ctx.beginPath();
            ctx.ellipse(footprint.x, footprint.y, width * 0.6, height * 0.6, rotation, 0, Math.PI * 2);
            ctx.fill();
        } else if (footprint.type === 'courtyard') {
            drawRotatedRect(footprint.x, footprint.y, width * 1.1, height * 1.1, rotation, true, false);
        } else {
            // Default deeper foundation
            if (layout.biomeId === 'swarm') {
                // Swarm foundations maintain hex structure
                drawPolygon(footprint.x, footprint.y, Math.max(width, height) * 0.4, 6, 0.8, rotation);
                ctx.fill();
            } else {
                drawRotatedRect(footprint.x, footprint.y, width * 1.05, height * 1.05, rotation, true, false);
            }
        }

        // Now draw the elevated foundation surface
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.22)`;
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.075)`;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.30)`;
        ctx.lineWidth = 2;

        if (footprint.type === 'mirrorCourt' || footprint.type === 'spireCourt') {
            drawPolygon(footprint.x, footprint.y, Math.max(width, height) * 0.36, 4, 1, rotation + Math.PI / 4);
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 0.30;
            drawPolygon(footprint.x, footprint.y, Math.max(width, height) * 0.22, 4, 1, rotation);
            ctx.stroke();
            ctx.globalAlpha = 0.18;
            for (let i = -1; i <= 1; i++) {
                const p1 = transformLocal(footprint.x, footprint.y, i * width * 0.18, -height * 0.36, rotation);
                const p2 = transformLocal(footprint.x, footprint.y, i * width * 0.18, height * 0.36, rotation);
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        } else if (footprint.type === 'recursivePad' || footprint.type === 'glitchPad') {
            for (let i = 0; i < 4; i++) {
                ctx.globalAlpha = 0.34 - i * 0.045;
                drawPolygon(footprint.x, footprint.y, Math.max(width, height) * (0.36 - i * 0.055), 4, 1, rotation + Math.PI / 4 + i * 0.38);
                if (i === 0) ctx.fill();
                ctx.stroke();
            }
        } else if (footprint.type === 'gravityWell' || footprint.type === 'orbitPad') {
            ctx.beginPath();
            ctx.ellipse(footprint.x, footprint.y, width / 2, height / 2, rotation, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 0.32;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.ellipse(footprint.x, footprint.y, width * (0.22 + i * 0.12), height * (0.16 + i * 0.09), rotation + i * 0.52, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (footprint.type === 'riftYard' || footprint.type === 'brokenGateYard') {
            drawPolygon(footprint.x, footprint.y, Math.max(width, height) * 0.34, 5, 0.78, rotation);
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 0.24;
            drawRotatedRect(footprint.x, footprint.y, width * 0.58, height * 0.28, rotation + 0.45, false, true);
        } else if (footprint.type === 'gateCourt' || footprint.type === 'watchYard' || footprint.type === 'supplyYard') {
            drawRotatedRect(footprint.x, footprint.y, width, height, rotation, true, true);
            ctx.globalAlpha = 0.26;
            if (footprint.type === 'watchYard') {
                drawRotatedRect(footprint.x, footprint.y, width * 0.44, height * 0.80, rotation, false, true);
            } else if (footprint.type === 'gateCourt') {
                drawRotatedRect(footprint.x, footprint.y, width * 0.82, height * 0.42, rotation, false, true);
            } else {
                for (let i = -1; i <= 1; i++) {
                    const crate = transformLocal(footprint.x, footprint.y, i * width * 0.18, 0, rotation);
                    drawRotatedRect(crate.x, crate.y, width * 0.16, height * 0.20, rotation, false, true);
                }
            }
        } else if (footprint.type === 'nestBed') {
            if (layout.biomeId === 'swarm') {
                // Organic hive foundation
                const detailScale = footprint.detailScale || 1;
                const baseRadius = Math.min(width, height) * 0.15 * detailScale;
                
                // Main organic blob
                const organicRadius = Math.max(width, height) * 0.38;
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = rotation + (Math.PI * 2 * i) / 8;
                    const radiusVar = 0.85 + 0.25 * Math.sin(i * 2.1);
                    const x = footprint.x + Math.cos(angle) * organicRadius * radiusVar;
                    const y = footprint.y + Math.sin(angle) * organicRadius * radiusVar * 0.75;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Add proper hex cells inside (keep them as clean hexagons)
                ctx.shadowBlur = 0;
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.36)`;
                ctx.lineWidth = 1.5;
                const stepX = baseRadius * 1.52;
                const stepY = baseRadius * 1.18;
                const honeycombCells = [
                    { x: 0, y: 0, s: 1.0 },
                    { x: -stepX, y: 0, s: 0.82 },
                    { x: stepX, y: 0, s: 0.82 },
                    { x: -stepX / 2, y: -stepY, s: 0.72 },
                    { x: stepX / 2, y: -stepY, s: 0.72 },
                    { x: -stepX / 2, y: stepY, s: 0.72 },
                    { x: stepX / 2, y: stepY, s: 0.72 }
                ];
                honeycombCells.forEach((cell, index) => {
                    drawAlignedHex(footprint.x, footprint.y, cell.x, cell.y, baseRadius * cell.s, rotation, index === 0 ? 0.34 : 0.26);
                });
            } else {
                // Non-swarm nest beds remain geometric
                drawPolygon(footprint.x, footprint.y, Math.max(width, height) * 0.40, 6, 0.72, rotation);
                ctx.fill();
                ctx.stroke();
            }
        } else if (footprint.type === 'orbitPad') {
            ctx.beginPath();
            ctx.ellipse(footprint.x, footprint.y, width / 2, height / 2, rotation, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(footprint.x, footprint.y, width * 0.34, height * 0.34, rotation + 0.35, 0, Math.PI * 2);
            ctx.stroke();
        } else if (footprint.type === 'courtyard') {
            drawRotatedRect(footprint.x, footprint.y, width, height, rotation, true, true);
            ctx.globalAlpha = 0.24;
            drawRotatedRect(footprint.x, footprint.y, width * 0.72, height * 0.58, rotation, false, true);
            ctx.globalAlpha = 0.20;
            for (let i = -1; i <= 1; i++) {
                const p1 = transformLocal(footprint.x, footprint.y, i * width * 0.22, -height * 0.45, rotation);
                const p2 = transformLocal(footprint.x, footprint.y, i * width * 0.22, height * 0.45, rotation);
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        } else {
            if (layout.biomeId === 'swarm') {
                // Organic foundation but maintain hex structure
                drawPolygon(footprint.x, footprint.y, Math.max(width, height) * 0.35, 6, 0.8, rotation);
                ctx.fill();
                ctx.stroke();
                ctx.globalAlpha = 0.24;
                drawPolygon(footprint.x, footprint.y, Math.max(width, height) * 0.22, 6, 0.8, rotation + Math.PI / 6);
                ctx.stroke();
            } else {
                drawRotatedRect(footprint.x, footprint.y, width, height, rotation, true, true);
                ctx.globalAlpha = 0.24;
                drawRotatedRect(footprint.x, footprint.y, width * 0.66, height * 0.66, rotation + Math.PI / 4, false, true);
                ctx.globalAlpha = 0.18;
                ctx.beginPath();
                ctx.ellipse(footprint.x, footprint.y, width * 0.28, height * 0.28, rotation, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        ctx.restore();
    };

    const drawLandmark = (landmark) => {
        if (!landmark) return;
        const radius = landmark.radius || 120;
        const footprint = landmark.footprint || {};
        const buildingRotation = footprint.rotation || 0;
        const buildingWidth = footprint.width || radius * 2.4;
        const buildingHeight = footprint.height || radius * 1.55;
        
        ctx.save();
        if (landmark.beacon) {
            const pulse = 0.55 + Math.sin(Date.now() / 350) * 0.2;
            const beaconGrad = ctx.createRadialGradient(landmark.x, landmark.y, radius * 0.2, landmark.x, landmark.y, radius * 3.2);
            beaconGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.22 * pulse})`);
            beaconGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            ctx.fillStyle = beaconGrad;
            ctx.beginPath();
            ctx.arc(landmark.x, landmark.y, radius * 3.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.18)`;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.75)`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.45)`;

        // Draw main building structure with biome-specific architecture
        if (layout.biomeId === 'prism' || layout.biomeId === 'fractal') {
            const landmarkIndex = layout.landmarks.indexOf(landmark);
            if (layout.biomeId === 'prism') {
                const shardCount = landmark.type === 'crystalGrove' ? 5 : landmark.type === 'lightSpire' ? 3 : landmark.type === 'lensArray' ? 6 : 4;
                for (let i = 0; i < shardCount; i++) {
                    const localAngle = buildingRotation + (Math.PI * 2 * i) / shardCount;
                    const distance = landmark.type === 'lensArray'
                        ? Math.min(buildingWidth, buildingHeight) * 0.24
                        : i === 0 ? 0 : Math.min(buildingWidth, buildingHeight) * (0.16 + (i % 2) * 0.08);
                    const shardX = landmark.x + Math.cos(localAngle) * distance;
                    const shardY = landmark.y + Math.sin(localAngle) * distance * 0.72;
                    const shardRadius = Math.min(buildingWidth, buildingHeight) * (landmark.type === 'mirrorWell' ? 0.18 : i === 0 ? 0.22 : 0.15);
                    ctx.globalAlpha = i === 0 ? 0.52 : 0.38;
                    drawPolygon(shardX, shardY, shardRadius, 4, landmark.type === 'lightSpire' ? 1.35 : 1, buildingRotation + Math.PI / 4 + i * 0.12);
                    ctx.fill();
                    ctx.stroke();
                }
                ctx.globalAlpha = 0.32;
                ctx.beginPath();
                ctx.moveTo(landmark.x - buildingWidth * 0.34, landmark.y);
                ctx.lineTo(landmark.x + buildingWidth * 0.34, landmark.y);
                ctx.moveTo(landmark.x, landmark.y - buildingHeight * 0.28);
                ctx.lineTo(landmark.x, landmark.y + buildingHeight * 0.28);
                ctx.stroke();
            } else {
                const nestCount = landmark.type === 'glitchMonolith' || landmark.type === 'logicGate' ? 5 : 4 + (landmarkIndex % 2);
                for (let i = 0; i < nestCount; i++) {
                    ctx.globalAlpha = 0.50 - i * 0.055;
                    drawPolygon(
                        landmark.x + (i - nestCount / 2) * buildingWidth * 0.08,
                        landmark.y + (i % 2 === 0 ? -1 : 1) * buildingHeight * (landmark.type === 'echoFork' ? 0.09 : 0.045),
                        Math.min(buildingWidth, buildingHeight) * (0.28 - i * 0.025),
                        4,
                        1,
                        buildingRotation + Math.PI / 4 + i * 0.42
                    );
                    if (i === 0) ctx.fill();
                    ctx.stroke();
                }
            }
            
        } else if (layout.biomeId === 'fortress') {
            // Fortress buildings - varied defensive architecture with height variation
            const landmarkIndex = layout.landmarks.indexOf(landmark);
            const heightVariation = 0.6 + (landmarkIndex % 4) * 0.2;
            const isTower = landmark.type === 'watchTower' || landmarkIndex % 3 === 0;
            const isWall = landmark.type === 'gatehouse' || landmarkIndex % 3 === 1;
            const isDepot = landmark.type === 'supplyDepot' || landmark.type === 'barracks';
            
            ctx.globalAlpha = 0.4 + heightVariation * 0.25;
            ctx.shadowBlur = 10 + heightVariation * 12;
            
            if (isDepot) {
                const depotWidth = buildingWidth * (landmark.type === 'barracks' ? 1.35 : 1.1);
                const depotHeight = buildingHeight * (landmark.type === 'barracks' ? 0.72 : 0.92);
                drawRotatedRect(landmark.x, landmark.y, depotWidth, depotHeight, buildingRotation, true, true);
                ctx.globalAlpha = 0.38;
                for (let i = -1; i <= 1; i++) {
                    const p = transformLocal(landmark.x, landmark.y, i * depotWidth * 0.22, 0, buildingRotation);
                    drawRotatedRect(p.x, p.y, depotWidth * 0.14, depotHeight * 0.45, buildingRotation, false, true);
                }
            } else if (isTower) {
                // Tall thin tower
                const towerWidth = buildingWidth * 0.4;
                const towerHeight = buildingHeight * (1.2 + heightVariation);
                drawRotatedRect(landmark.x, landmark.y, towerWidth, towerHeight, buildingRotation, true, true);
                
                // Add tower crown
                ctx.globalAlpha = 0.65;
                ctx.lineWidth = 3;
                const crownCount = 5;
                for (let i = 0; i < crownCount; i++) {
                    const crownX = (i - crownCount/2) * towerWidth * 0.2;
                    const crownY = -towerHeight * 0.48;
                    const cos = Math.cos(buildingRotation);
                    const sin = Math.sin(buildingRotation);
                    const worldCrownX = landmark.x + crownX * cos - crownY * sin;
                    const worldCrownY = landmark.y + crownX * sin + crownY * cos;
                    
                    drawRotatedRect(worldCrownX, worldCrownY, towerWidth * 0.08, buildingHeight * 0.15, buildingRotation, true, true);
                }
                
            } else if (isWall) {
                // Wide low wall section
                const wallWidth = buildingWidth * (1.4 + heightVariation * 0.3);
                const wallHeight = buildingHeight * 0.6;
                drawRotatedRect(landmark.x, landmark.y, wallWidth, wallHeight, buildingRotation, true, true);
                
                // Add crenellations
                ctx.globalAlpha = 0.55;
                ctx.lineWidth = 2.5;
                const battlementCount = Math.floor(wallWidth / (buildingWidth * 0.2));
                for (let i = 0; i < battlementCount; i++) {
                    const battlementX = (i - battlementCount/2) * wallWidth * 0.15;
                    const battlementY = -wallHeight * 0.45;
                    const cos = Math.cos(buildingRotation);
                    const sin = Math.sin(buildingRotation);
                    const worldBattlementX = landmark.x + battlementX * cos - battlementY * sin;
                    const worldBattlementY = landmark.y + battlementX * sin + battlementY * cos;
                    
                    if (i % 2 === 0) { // Alternating pattern
                        drawRotatedRect(worldBattlementX, worldBattlementY, wallWidth * 0.08, wallHeight * 0.25, buildingRotation, true, true);
                    }
                }
                
            } else {
                // Standard keep building
                drawRotatedRect(landmark.x, landmark.y, buildingWidth, buildingHeight, buildingRotation, true, true);
                
                // Add defensive towers on corners
                ctx.globalAlpha = 0.55 + heightVariation * 0.15;
                ctx.lineWidth = 2.5;
                const corners = [
                    { x: -buildingWidth * 0.35, y: -buildingHeight * 0.35 },
                    { x: buildingWidth * 0.35, y: -buildingHeight * 0.35 },
                    { x: buildingWidth * 0.35, y: buildingHeight * 0.35 },
                    { x: -buildingWidth * 0.35, y: buildingHeight * 0.35 }
                ];
                
                corners.forEach((corner, i) => {
                    if (i % 2 === 0) { // Only place towers on alternating corners
                        const cos = Math.cos(buildingRotation);
                        const sin = Math.sin(buildingRotation);
                        const worldCornerX = landmark.x + corner.x * cos - corner.y * sin;
                        const worldCornerY = landmark.y + corner.x * sin + corner.y * cos;
                        
                        drawRotatedRect(worldCornerX, worldCornerY, 
                            buildingWidth * 0.18, 
                            buildingHeight * (0.4 + heightVariation * 0.2), 
                            buildingRotation, true, true);
                    }
                });
            }
            
        } else if (layout.biomeId === 'vortex') {
            // Vortex buildings - curved, flowing architecture
            ctx.beginPath();
            ctx.ellipse(landmark.x, landmark.y, buildingWidth/2, buildingHeight/2, buildingRotation, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Add orbital ring details
            ctx.globalAlpha = 0.45;
            ctx.lineWidth = 2;
            const ringCount = landmark.type === 'eventHorizon' ? 4 : 3;
            for (let ring = 1; ring <= ringCount; ring++) {
                ctx.beginPath();
                ctx.ellipse(landmark.x, landmark.y, 
                    buildingWidth * (0.25 + ring * 0.15) / 2, 
                    buildingHeight * (0.18 + ring * 0.12) / 2, 
                    buildingRotation + ring * 0.3, 0, Math.PI * 2);
                ctx.stroke();
            }
            if (landmark.type === 'tetherArray') {
                ctx.globalAlpha = 0.32;
                for (let i = 0; i < 4; i++) {
                    const angle = buildingRotation + (Math.PI * 2 * i) / 4;
                    ctx.beginPath();
                    ctx.moveTo(landmark.x, landmark.y);
                    ctx.lineTo(landmark.x + Math.cos(angle) * buildingWidth * 0.42, landmark.y + Math.sin(angle) * buildingHeight * 0.34);
                    ctx.stroke();
                }
            }
            
        } else if (layout.biomeId === 'swarm') {
            // Swarm buildings are a compact hive core inside the larger hex yard.
            const landmarkIndex = layout.landmarks.indexOf(landmark);
            const heightVariation = 0.75 + (landmarkIndex % 3) * 0.12;
            const coreRadius = Math.min(buildingWidth, buildingHeight) * 0.22;

            ctx.globalAlpha = 0.40 + heightVariation * 0.18;
            ctx.shadowBlur = 10 + heightVariation * 6;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.16)`;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.78)`;
            ctx.lineWidth = 3;
            drawPolygon(landmark.x, landmark.y, coreRadius, 6, 1, buildingRotation);
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.lineWidth = 2;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.09)`;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.62)`;
            drawAlignedHex(landmark.x, landmark.y, 0, 0, coreRadius * 0.42, buildingRotation, 0.45, true);
            drawAlignedHex(landmark.x, landmark.y, -coreRadius * 0.55, 0, coreRadius * 0.28, buildingRotation, 0.32, false);
            drawAlignedHex(landmark.x, landmark.y, coreRadius * 0.55, 0, coreRadius * 0.28, buildingRotation, 0.32, false);
            
        } else {
            // Endless/Generic buildings - mixed architectural styles
            if (layout.biomeId === 'endless' && landmark.type === 'lostMonument') {
                drawPolygon(landmark.x, landmark.y, Math.min(buildingWidth, buildingHeight) * 0.36, 5, 0.82, buildingRotation);
                ctx.fill();
                ctx.stroke();
            } else if (layout.biomeId === 'endless' && landmark.type === 'riftMarket') {
                for (let i = -1; i <= 1; i++) {
                    const stall = transformLocal(landmark.x, landmark.y, i * buildingWidth * 0.18, (i % 2) * buildingHeight * 0.12, buildingRotation);
                    drawRotatedRect(stall.x, stall.y, buildingWidth * 0.22, buildingHeight * 0.28, buildingRotation + i * 0.18, true, true);
                }
            } else {
                drawRotatedRect(landmark.x, landmark.y, buildingWidth, buildingHeight, buildingRotation, true, true);
            }
            
            // Add eclectic details
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = 2;
            drawPolygon(landmark.x, landmark.y, Math.min(buildingWidth, buildingHeight) * 0.25, 6, 0.8, buildingRotation);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.ellipse(landmark.x, landmark.y, buildingWidth * 0.15, buildingHeight * 0.12, buildingRotation + Math.PI/4, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (layout.biomeId !== 'swarm') {
            // Add wall segments to define building perimeter more clearly.
            ctx.globalAlpha = 0.65;
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;

            const wallSegments = 8;
            for (let i = 0; i < wallSegments; i++) {
                const startAngle = buildingRotation + (Math.PI * 2 * i) / wallSegments;
                const endAngle = buildingRotation + (Math.PI * 2 * (i + 0.7)) / wallSegments;

                const startX = landmark.x + Math.cos(startAngle) * buildingWidth * 0.42;
                const startY = landmark.y + Math.sin(startAngle) * buildingHeight * 0.35;
                const endX = landmark.x + Math.cos(endAngle) * buildingWidth * 0.42;
                const endY = landmark.y + Math.sin(endAngle) * buildingHeight * 0.35;

                if (i % 2 === 0) {
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                }
            }
        }

        ctx.restore();
    };

    const drawDecoration = (decoration) => {
        if (!decoration) return;
        ctx.save();
        ctx.translate(decoration.x, decoration.y);
        ctx.rotate(decoration.rotation || 0);
        ctx.globalAlpha = decoration.alpha || 0.45;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.42)`;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.58)`;
        ctx.lineWidth = 1.5;

        const size = decoration.size || 8;
        if (decoration.type && (decoration.type.includes('Shard') || decoration.type.includes('Diamond') || decoration.type.includes('Facet'))) {
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.lineTo(size * 0.7, 0);
            ctx.lineTo(0, size);
            ctx.lineTo(-size * 0.7, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (decoration.type && (decoration.type.includes('Vein') || decoration.type.includes('Crack') || decoration.type.includes('Arc') || decoration.type.includes('Scratch'))) {
            ctx.beginPath();
            ctx.moveTo(-size, 0);
            ctx.quadraticCurveTo(0, -size * 0.45, size, 0);
            ctx.stroke();
        } else if (decoration.type && (decoration.type.includes('Plate') || decoration.type.includes('Cell') || decoration.type.includes('Glyph'))) {
            ctx.strokeRect(-size, -size * 0.55, size * 2, size * 1.1);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    };

    const drawFixture = (fixture) => {
        if (!fixture) return;
        const size = fixture.size || 20;
        const isLight = fixture.glow || fixture.purpose === 'streetLight' || (fixture.type && fixture.type.includes('Lamp')) || fixture.type === 'bioLantern';
        ctx.save();
        ctx.translate(fixture.x, fixture.y);
        ctx.rotate(fixture.rotation || 0);

        if (isLight) {
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3.4);
            glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.28)`);
            glow.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.09)`);
            glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, size * 3.4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 0.82;
        ctx.shadowBlur = isLight ? 10 : 3;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.65)`;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.82)`;
        ctx.fillStyle = `rgba(${Math.floor(r * 0.45)}, ${Math.floor(g * 0.45)}, ${Math.floor(b * 0.45)}, 0.58)`;
        ctx.lineWidth = 2;

        const drawLampSilhouette = (variant) => {
            const headY = -size * 0.9;
            const baseY = size * 0.95;
            const armX = size * 0.42;
            const lampColor = `rgba(${r}, ${g}, ${b}, 0.88)`;
            const coreColor = `rgba(255, 245, 180, 0.88)`;

            ctx.save();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.34;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.16)`;
            ctx.beginPath();
            ctx.ellipse(armX * 0.45, headY + size * 0.1, size * 1.55, size * 0.82, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.strokeStyle = lampColor;
            ctx.fillStyle = `rgba(${Math.floor(r * 0.22)}, ${Math.floor(g * 0.22)}, ${Math.floor(b * 0.22)}, 0.72)`;
            ctx.lineWidth = Math.max(2, size * 0.12);

            ctx.beginPath();
            ctx.moveTo(0, baseY);
            ctx.lineTo(0, -size * 0.35);
            ctx.quadraticCurveTo(0, headY, armX, headY);
            ctx.stroke();

            ctx.lineWidth = Math.max(1.5, size * 0.075);
            ctx.beginPath();
            ctx.arc(0, baseY, size * 0.34, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if (variant === 'prism') {
                drawPolygon(armX, headY, size * 0.38, 4, 1, -Math.PI / 2);
                ctx.fill();
                ctx.stroke();
            } else if (variant === 'void' || variant === 'rift') {
                ctx.beginPath();
                ctx.ellipse(armX, headY, size * 0.44, size * 0.30, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(armX, headY, size * 0.18, 0, Math.PI * 2);
                ctx.stroke();
            } else if (variant === 'rune') {
                ctx.strokeRect(armX - size * 0.28, headY - size * 0.28, size * 0.56, size * 0.56);
                ctx.beginPath();
                ctx.moveTo(armX - size * 0.2, headY);
                ctx.lineTo(armX + size * 0.2, headY);
                ctx.moveTo(armX, headY - size * 0.2);
                ctx.lineTo(armX, headY + size * 0.2);
                ctx.stroke();
            } else {
                ctx.fillRect(armX - size * 0.32, headY - size * 0.24, size * 0.64, size * 0.48);
                ctx.strokeRect(armX - size * 0.32, headY - size * 0.24, size * 0.64, size * 0.48);
            }

            ctx.fillStyle = coreColor;
            ctx.shadowBlur = 8;
            ctx.shadowColor = coreColor;
            ctx.beginPath();
            ctx.arc(armX, headY, size * 0.16, 0, Math.PI * 2);
            ctx.fill();
        };

        const drawCornerPost = (variant) => {
            const postHeight = size * 1.2;
            ctx.lineWidth = Math.max(2, size * 0.15);
            ctx.beginPath();
            ctx.moveTo(0, postHeight);
            ctx.lineTo(0, 0);
            ctx.stroke();

            if (variant === 'guardPost') {
                ctx.fillRect(-size * 0.25, 0, size * 0.5, size * 0.4);
                ctx.strokeRect(-size * 0.25, 0, size * 0.5, size * 0.4);
                ctx.beginPath();
                ctx.moveTo(-size * 0.15, 0);
                ctx.lineTo(size * 0.15, 0);
                ctx.stroke();
            } else if (variant === 'sporePost') {
                drawPolygon(0, 0, size * 0.35, 6, 0.8, 0);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, -size * 0.1, size * 0.12, 0, Math.PI * 2);
                ctx.fill();
            } else if (variant === 'facetMarker') {
                drawPolygon(0, 0, size * 0.32, 4, 1, -Math.PI / 4);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        };

        const drawEntranceGate = (variant) => {
            const gateWidth = size * 1.4;
            const gateHeight = size * 1.1;

            if (variant === 'hiveGate') {
                drawPolygon(0, 0, gateWidth * 0.45, 6, 0.7, 0);
                ctx.stroke();
                ctx.globalAlpha = 0.25;
                ctx.fill();
                ctx.globalAlpha = 0.82;
                drawPolygon(0, 0, gateWidth * 0.25, 6, 0.7, 0);
                ctx.stroke();
            } else if (variant === 'crystalArch') {
                ctx.beginPath();
                ctx.moveTo(-gateWidth/2, gateHeight/2);
                ctx.lineTo(-gateWidth/4, -gateHeight/2);
                ctx.lineTo(gateWidth/4, -gateHeight/2);
                ctx.lineTo(gateWidth/2, gateHeight/2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, -gateHeight/2);
                ctx.lineTo(0, gateHeight/3);
                ctx.stroke();
            } else if (variant === 'gatePost') {
                ctx.strokeRect(-gateWidth/2, -gateHeight/4, gateWidth/8, gateHeight);
                ctx.strokeRect(gateWidth/2 - gateWidth/8, -gateHeight/4, gateWidth/8, gateHeight);
                ctx.beginPath();
                ctx.moveTo(-gateWidth/3, 0);
                ctx.lineTo(gateWidth/3, 0);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.ellipse(0, 0, gateWidth/2, gateHeight/3, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(0, 0, gateWidth/4, gateHeight/5, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        };

        const drawYardFixture = (variant) => {
            if (variant === 'growthPod') {
                drawPolygon(0, 0, size * 0.6, 6, 0.6, 0);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, -size * 0.2, size * 0.15, 0, Math.PI * 2);
                ctx.fill();
            } else if (variant === 'reflectionPool') {
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.8, size * 0.5, 0, 0, Math.PI * 2);
                ctx.globalAlpha = 0.25;
                ctx.fill();
                ctx.globalAlpha = 0.82;
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.5, size * 0.3, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (variant === 'statueBase') {
                ctx.fillRect(-size * 0.4, -size * 0.3, size * 0.8, size * 0.6);
                ctx.strokeRect(-size * 0.4, -size * 0.3, size * 0.8, size * 0.6);
                ctx.beginPath();
                ctx.arc(0, -size * 0.1, size * 0.25, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
                ctx.fill();
            }
        };

        const drawInfrastructure = (variant) => {
            if (variant === 'supplyCrate') {
                ctx.fillRect(-size * 0.4, -size * 0.3, size * 0.8, size * 0.6);
                ctx.strokeRect(-size * 0.4, -size * 0.3, size * 0.8, size * 0.6);
                ctx.beginPath();
                ctx.moveTo(-size * 0.2, -size * 0.3);
                ctx.lineTo(-size * 0.2, size * 0.3);
                ctx.moveTo(size * 0.2, -size * 0.3);
                ctx.lineTo(size * 0.2, size * 0.3);
                ctx.stroke();
            } else if (variant === 'nutrientNode') {
                drawPolygon(0, 0, size * 0.4, 6, 1, 0);
                ctx.fill();
                ctx.stroke();
                for (let i = 0; i < 3; i++) {
                    const angle = (Math.PI * 2 * i) / 3;
                    const x = Math.cos(angle) * size * 0.25;
                    const y = Math.sin(angle) * size * 0.25;
                    ctx.beginPath();
                    ctx.arc(x, y, size * 0.08, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, -size * 0.5);
                ctx.lineTo(0, size * 0.5);
                ctx.moveTo(-size * 0.5, 0);
                ctx.lineTo(size * 0.5, 0);
                ctx.stroke();
            }
        };

        // Render based on fixture purpose and type
        if (fixture.type === 'trailMarker' || fixture.purpose === 'wayfinding') {
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.78)`;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 14;
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.85)`;
            ctx.beginPath();
            ctx.moveTo(0, -size * 1.15);
            ctx.lineTo(size * 0.38, size * 0.55);
            ctx.lineTo(-size * 0.38, size * 0.55);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            return;
        } else if (fixture.purpose === 'corner') {
            const variant = fixture.type === 'guardPost' ? 'guardPost'
                : fixture.type === 'sporePost' ? 'sporePost'
                : fixture.type === 'facetMarker' ? 'facetMarker'
                : 'generic';
            drawCornerPost(variant);
        } else if (fixture.purpose === 'entrance') {
            const variant = fixture.type === 'hiveGate' ? 'hiveGate'
                : fixture.type === 'crystalArch' ? 'crystalArch'
                : fixture.type === 'gatePost' ? 'gatePost'
                : 'generic';
            drawEntranceGate(variant);
        } else if (fixture.purpose === 'yard') {
            const variant = fixture.type === 'growthPod' ? 'growthPod'
                : fixture.type === 'reflectionPool' ? 'reflectionPool'
                : fixture.type === 'statueBase' ? 'statueBase'
                : 'generic';
            drawYardFixture(variant);
        } else if (fixture.purpose === 'infrastructure') {
            const variant = fixture.type === 'supplyCrate' ? 'supplyCrate'
                : fixture.type === 'nutrientNode' ? 'nutrientNode'
                : 'generic';
            drawInfrastructure(variant);
        } else if (fixture.type === 'streetLamp' || fixture.type === 'prismLamp' || fixture.type === 'runeLamp' || fixture.type === 'voidLamp' || fixture.type === 'riftLamp') {
            const variant = fixture.type === 'prismLamp' ? 'prism'
                : fixture.type === 'runeLamp' ? 'rune'
                    : fixture.type === 'voidLamp' ? 'void'
                        : fixture.type === 'riftLamp' ? 'rift'
                            : 'street';
            drawLampSilhouette(variant);
        } else if (fixture.type === 'bioLantern') {
            ctx.save();
            ctx.globalAlpha = 0.30;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.14)`;
            ctx.beginPath();
            ctx.ellipse(0, 0, size * 1.45, size * 0.92, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.beginPath();
            ctx.moveTo(0, size * 1.05);
            ctx.lineTo(0, size * 0.32);
            ctx.stroke();
            drawPolygon(0, 0, size * 0.7, 6, 0.72, 0);
            ctx.fill();
            ctx.stroke();
            drawPolygon(0, 0, size * 0.38, 6, 0.72, 0);
            ctx.stroke();
            ctx.fillStyle = 'rgba(230, 255, 170, 0.82)';
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Generic fallback for unrecognized types
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    };

    // Add subtle ambient life particles
    const renderAmbientLife = () => {
        if (!landmarks || landmarks.length === 0) return;
        
        ctx.save();
        const time = Date.now() * 0.001; // Use time for animation
        
        landmarks.forEach((landmark, index) => {
            const particleCount = layout.biomeId === 'swarm' ? 4 : 2;
            
            for (let p = 0; p < particleCount; p++) {
                const particleAngle = time * 0.3 + index + p * 2;
                const orbitRadius = (landmark.radius || 120) * (0.8 + 0.4 * Math.sin(time * 0.4 + p));
                const particleX = landmark.x + Math.cos(particleAngle) * orbitRadius;
                const particleY = landmark.y + Math.sin(particleAngle) * orbitRadius * 0.7;
                
                // Pulsing glow
                const pulseAlpha = 0.15 + 0.1 * Math.sin(time * 1.2 + index * 2 + p);
                ctx.globalAlpha = pulseAlpha;
                
                if (layout.biomeId === 'swarm') {
                    // Drifting spores
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
                    ctx.beginPath();
                    ctx.arc(particleX, particleY, 2 + Math.sin(time + p) * 1, 0, Math.PI * 2);
                    ctx.fill();
                } else if (layout.biomeId === 'prism') {
                    // Prismatic sparkles
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
                    ctx.lineWidth = 1;
                    const sparkleSize = 3 + Math.sin(time * 2 + p) * 1;
                    ctx.beginPath();
                    ctx.moveTo(particleX - sparkleSize, particleY);
                    ctx.lineTo(particleX + sparkleSize, particleY);
                    ctx.moveTo(particleX, particleY - sparkleSize);
                    ctx.lineTo(particleX, particleY + sparkleSize);
                    ctx.stroke();
                } else {
                    // Generic floating motes
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
                    ctx.beginPath();
                    ctx.arc(particleX, particleY, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
        
        ctx.restore();
    };

    ctx.save();
    if (!options.debrisInteractiveOnly) {
        renderOuterAmbience();
        plazas.forEach(drawPlaza);
        paths.forEach(drawPath);
        if (layout.biomeId !== 'swarm') {
            landmarks.forEach(drawLandmarkFoundation);
        }
        landmarks.forEach(drawLandmark);
        if (!options.skipAmbientLife) {
            renderAmbientLife();
        }
    }
    const fixtures = Array.isArray(layout.cachedFixtures)
        ? layout.cachedFixtures
        : (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator.generateSceneryFixtures
            ? RoomLayoutGenerator.generateSceneryFixtures(layout, layout.biomeId === 'swarm' ? 18 : 32)
            : []);
    const debrisInteractiveOnly = options.debrisInteractiveOnly === true;
    const skipDebrisInteractive = options.skipDebrisInteractiveFixtures === true;
    fixtures.forEach(fixture => {
        if (!fixture) return;
        const interactive = isDebrisInteractiveFixture(fixture);
        if (debrisInteractiveOnly && !interactive) return;
        if (!debrisInteractiveOnly && skipDebrisInteractive && interactive) return;
        drawFixture(fixture);
    });

    if (!options.debrisInteractiveOnly) {
        const decorations = Array.isArray(layout.cachedDecorations)
            ? layout.cachedDecorations
            : (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator.generateDecorations
                ? RoomLayoutGenerator.generateDecorations(layout, layout.biomeId === 'swarm' ? 28 : 70)
                : []);
        decorations.forEach(drawDecoration);
    }
    ctx.restore();
}

function renderRoomAmbientLife(ctx, roomNumber) {
    if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.layout) return;
    const layout = currentRoom.layout;
    const landmarks = Array.isArray(layout.landmarks) ? layout.landmarks : [];
    if (landmarks.length === 0) return;

    const biome = getBiomeForRoom(roomNumber);
    const hex = biome.accentColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const time = Date.now() * 0.001;

    ctx.save();
    landmarks.forEach((landmark, index) => {
        const particleCount = layout.biomeId === 'swarm' ? 4 : 2;
        for (let p = 0; p < particleCount; p++) {
            const particleAngle = time * 0.3 + index + p * 2;
            const orbitRadius = (landmark.radius || 120) * (0.8 + 0.4 * Math.sin(time * 0.4 + p));
            const particleX = landmark.x + Math.cos(particleAngle) * orbitRadius;
            const particleY = landmark.y + Math.sin(particleAngle) * orbitRadius * 0.7;
            const pulseAlpha = 0.15 + 0.1 * Math.sin(time * 1.2 + index * 2 + p);
            ctx.globalAlpha = pulseAlpha;

            if (layout.biomeId === 'swarm') {
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
                ctx.beginPath();
                ctx.arc(particleX, particleY, 2 + Math.sin(time + p) * 1, 0, Math.PI * 2);
                ctx.fill();
            } else if (layout.biomeId === 'prism') {
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
                ctx.lineWidth = 1;
                const sparkleSize = 3 + Math.sin(time * 2 + p) * 1;
                ctx.beginPath();
                ctx.moveTo(particleX - sparkleSize, particleY);
                ctx.lineTo(particleX + sparkleSize, particleY);
                ctx.moveTo(particleX, particleY - sparkleSize);
                ctx.lineTo(particleX, particleY + sparkleSize);
                ctx.stroke();
            } else {
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
                ctx.beginPath();
                ctx.arc(particleX, particleY, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });
    ctx.restore();
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

function renderRoomObstacles(ctx, roomNumber) {
    if (typeof currentRoom === 'undefined' || !currentRoom) return;
    const biome = getBiomeForRoom(roomNumber);
    const hex = biome.accentColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const drawSolidBlock = (x, y, width, height, layout, row, startCol, runLength) => {
        const borderInset = 4;
        ctx.fillStyle = `rgba(${Math.floor(r * 0.28)}, ${Math.floor(g * 0.28)}, ${Math.floor(b * 0.28)}, 0.78)`;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.98)`;
        ctx.lineWidth = 3;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
        ctx.shadowBlur = 14;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);

        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255, 255, 255, 0.22)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + borderInset, y + borderInset, Math.max(1, width - borderInset * 2), Math.max(1, height - borderInset * 2));

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.26)`;
        ctx.lineWidth = 1;
        if ((row + startCol) % 2 === 0 && width >= layout.cellSize * 1.5) {
            const midY = y + height / 2;
            ctx.beginPath();
            ctx.moveTo(x + 8, midY);
            ctx.lineTo(x + width - 8, midY);
            ctx.stroke();
        }
        if (runLength >= 3) {
            for (let i = 1; i < runLength; i++) {
                const seamX = x + i * layout.cellSize;
                ctx.beginPath();
                ctx.moveTo(seamX, y + 6);
                ctx.lineTo(seamX, y + height - 6);
                ctx.stroke();
            }
        }
    };

    const drawSwarmHiveCell = (centerX, centerY, radius) => {
        const rotation = Math.PI / 6;

        ctx.fillStyle = `rgba(${Math.floor(r * 0.26)}, ${Math.floor(g * 0.34)}, ${Math.floor(b * 0.22)}, 0.70)`;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.86)`;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.62)`;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = rotation + (Math.PI * 2 * i) / 6;
            const px = centerX + Math.cos(angle) * radius;
            const py = centerY + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = `rgba(230, 255, 190, 0.30)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = rotation + (Math.PI * 2 * i) / 6;
            const px = centerX + Math.cos(angle) * radius * 0.56;
            const py = centerY + Math.sin(angle) * radius * 0.56;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 1;
    };

    const drawThemedGridCell = (col, row, layout) => {
        const cellSize = layout.cellSize;
        const centerX = col * cellSize + cellSize / 2;
        const centerY = row * cellSize + cellSize / 2;
        const radius = cellSize * 0.48;
        ctx.fillStyle = `rgba(${Math.floor(r * 0.26)}, ${Math.floor(g * 0.28)}, ${Math.floor(b * 0.32)}, 0.68)`;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.82)`;
        ctx.lineWidth = 2;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.55)`;
        ctx.shadowBlur = 9;

        if (layout.biomeId === 'prism') {
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - radius);
            ctx.lineTo(centerX + radius * 0.72, centerY);
            ctx.lineTo(centerX, centerY + radius);
            ctx.lineTo(centerX - radius * 0.72, centerY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - radius * 0.72);
            ctx.lineTo(centerX, centerY + radius * 0.72);
            ctx.stroke();
            ctx.globalAlpha = 1;
        } else if (layout.biomeId === 'fractal') {
            for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = 0.72 - i * 0.15;
                ctx.beginPath();
                const currentRadius = radius * (1 - i * 0.24);
                for (let p = 0; p < 4; p++) {
                    const angle = Math.PI / 4 + i * 0.28 + (Math.PI * 2 * p) / 4;
                    const px = centerX + Math.cos(angle) * currentRadius;
                    const py = centerY + Math.sin(angle) * currentRadius;
                    if (p === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                if (i === 0) ctx.fill();
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        } else if (layout.biomeId === 'vortex') {
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radius, radius * 0.64, (col + row) * 0.34, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radius * 0.58, radius * 0.28, (col + row) * 0.34 + Math.PI / 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        } else if (layout.biomeId === 'endless') {
            const sides = (col + row) % 3 === 0 ? 5 : 4;
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const angle = -Math.PI / 2 + (col % 2) * 0.22 + (Math.PI * 2 * i) / sides;
                const px = centerX + Math.cos(angle) * radius;
                const py = centerY + Math.sin(angle) * radius * (sides === 5 ? 0.82 : 1);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    };

    const drawSwarmHiveCluster = (cluster, layout) => {
        const radius = layout.cellSize * 0.53;
        const cells = cluster.map(cell => {
            return {
                x: cell.col * layout.cellSize + layout.cellSize / 2,
                y: cell.row * layout.cellSize + layout.cellSize / 2
            };
        });

        const padRadius = radius * (cluster.length <= 2 ? 1.45 : 1.7);
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.22)`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        cells.forEach(cell => {
            ctx.globalAlpha = 0.28;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = Math.PI / 6 + (Math.PI * 2 * i) / 6;
                const px = cell.x + Math.cos(angle) * padRadius;
                const py = cell.y + Math.sin(angle) * padRadius;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });
        ctx.restore();

        cells.forEach(cell => drawSwarmHiveCell(cell.x, cell.y, layout.cellSize * 0.58));
    };

    const getSwarmHiveClusters = (layout) => {
        const visited = new Set();
        const clusters = [];
        const keyFor = (col, row) => `${col},${row}`;
        const isBlocked = (col, row) => (
            col >= 0 &&
            row >= 0 &&
            col < layout.cols &&
            row < layout.rows &&
            layout.grid[row * layout.cols + col] === 1
        );

        for (let row = 0; row < layout.rows; row++) {
            for (let col = 0; col < layout.cols; col++) {
                if (!isBlocked(col, row)) continue;
                const startKey = keyFor(col, row);
                if (visited.has(startKey)) continue;

                const cluster = [];
                const stack = [{ col, row }];
                visited.add(startKey);

                while (stack.length > 0) {
                    const cell = stack.pop();
                    cluster.push(cell);
                    [
                        { col: cell.col + 1, row: cell.row },
                        { col: cell.col - 1, row: cell.row },
                        { col: cell.col, row: cell.row + 1 },
                        { col: cell.col, row: cell.row - 1 }
                    ].forEach(neighbor => {
                        const neighborKey = keyFor(neighbor.col, neighbor.row);
                        if (!visited.has(neighborKey) && isBlocked(neighbor.col, neighbor.row)) {
                            visited.add(neighborKey);
                            stack.push(neighbor);
                        }
                    });
                }

                clusters.push(cluster);
            }
        }

        return clusters;
    };

    ctx.save();
    if (currentRoom.layout && Array.isArray(currentRoom.layout.grid)) {
        const layout = currentRoom.layout;
        if (typeof prepareRoomRenderData === 'function') {
            prepareRoomRenderData(currentRoom, roomNumber);
        }
        ctx.shadowColor = biome.accentColor;
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.16)`;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
        ctx.lineWidth = 1.5;

        if (layout.biomeId === 'swarm') {
            const clusters = Array.isArray(layout.cachedSwarmHiveClusters)
                ? layout.cachedSwarmHiveClusters
                : getSwarmHiveClusters(layout);
            clusters.forEach(cluster => drawSwarmHiveCluster(cluster, layout));

            ctx.restore();
            return;
        }

        if (layout.biomeId === 'prism' || layout.biomeId === 'fractal' || layout.biomeId === 'vortex' || layout.biomeId === 'endless') {
            for (let row = 0; row < layout.rows; row++) {
                for (let col = 0; col < layout.cols; col++) {
                    if (layout.grid[row * layout.cols + col] === 1) {
                        drawThemedGridCell(col, row, layout);
                    }
                }
            }

            ctx.restore();
            return;
        }

        const blockedRuns = Array.isArray(layout.cachedBlockedRuns) ? layout.cachedBlockedRuns : computeBlockedRuns(layout);
        blockedRuns.forEach(run => {
            drawSolidBlock(run.x, run.y, run.width, run.height, layout, run.row, run.startCol, run.length);
        });

        // With generated layouts, the collision grid is the only source of solid scenery truth.
        // Stamped metadata may be partly carved away for lanes/safety zones, so drawing it
        // separately can imply non-colliding shapes are solid.
        ctx.restore();
        return;
    }

    if (!Array.isArray(currentRoom.obstacles)) {
        ctx.restore();
        return;
    }

    currentRoom.obstacles.forEach(obstacle => {
        if (obstacle.blocksMovement === false && obstacle.preset === 'decorative') return;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${obstacle.destructible ? 0.16 : 0.22})`;
        ctx.strokeStyle = obstacle.destructible ? '#ffdd88' : biome.accentColor;
        ctx.lineWidth = obstacle.destructible ? 2 : 3;
        ctx.shadowColor = biome.accentColor;
        ctx.shadowBlur = 12;

        if (obstacle.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (obstacle.shape === 'diamond') {
            ctx.beginPath();
            ctx.moveTo(obstacle.x, obstacle.y - obstacle.radius);
            ctx.lineTo(obstacle.x + obstacle.radius, obstacle.y);
            ctx.lineTo(obstacle.x, obstacle.y + obstacle.radius);
            ctx.lineTo(obstacle.x - obstacle.radius, obstacle.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (obstacle.shape === 'rect') {
            const cellSize = currentRoom.layout ? currentRoom.layout.cellSize : 75;
            if (obstacle.gap && obstacle.gap.row !== undefined) {
                const gapY = obstacle.gap.row * cellSize;
                const gapH = obstacle.gap.size * cellSize;
                const topH = Math.max(0, gapY - obstacle.y);
                const bottomY = gapY + gapH;
                const bottomH = Math.max(0, obstacle.y + obstacle.height - bottomY);
                if (topH > 0) {
                    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, topH);
                    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, topH);
                }
                if (bottomH > 0) {
                    ctx.fillRect(obstacle.x, bottomY, obstacle.width, bottomH);
                    ctx.strokeRect(obstacle.x, bottomY, obstacle.width, bottomH);
                }
            } else if (obstacle.gap && obstacle.gap.col !== undefined) {
                const gapX = obstacle.gap.col * cellSize;
                const gapW = obstacle.gap.size * cellSize;
                const leftW = Math.max(0, gapX - obstacle.x);
                const rightX = gapX + gapW;
                const rightW = Math.max(0, obstacle.x + obstacle.width - rightX);
                if (leftW > 0) {
                    ctx.fillRect(obstacle.x, obstacle.y, leftW, obstacle.height);
                    ctx.strokeRect(obstacle.x, obstacle.y, leftW, obstacle.height);
                }
                if (rightW > 0) {
                    ctx.fillRect(rightX, obstacle.y, rightW, obstacle.height);
                    ctx.strokeRect(rightX, obstacle.y, rightW, obstacle.height);
                }
            } else {
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            }
        }
    });
    ctx.restore();
}

function renderExitChevron(ctx) {
    if (!ctx || typeof Game === 'undefined' || Game.state !== 'PLAYING') return;
    if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.layout || !currentRoom.layout.exitZone) return;

    const layout = currentRoom.layout;
    const exitZone = layout.exitZone;
    const camera = Game.camera;
    const config = Game.config;
    if (!camera || !config) return;

    const zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;
    const canvasWidth = config.width;
    const canvasHeight = config.height;
    const exitTarget = {
        x: exitZone.x,
        y: exitZone.y,
        size: exitZone.radius || 40
    };

    if (typeof isEnemyInViewport === 'function' && isEnemyInViewport(exitTarget, camera, zoom, canvasWidth, canvasHeight)) {
        return;
    }

    const player = Game.player;
    if (!player || typeof worldToScreen !== 'function') return;

    const EXIT_CHEVRON_COLORS = {
        swarm: '#88ff44',
        prism: '#44aaff',
        fortress: '#ffaa44',
        fractal: '#ff44ff',
        vortex: '#aa44ff',
        endless: '#aaaaaa'
    };
    const color = EXIT_CHEVRON_COLORS[layout.biomeId] || '#ffffff';
    const roomCleared = !!currentRoom.cleared;
    const pulseSpeed = roomCleared ? 150 : 200;
    const baseAlpha = roomCleared ? 0.6 : 0.4;
    const alpha = baseAlpha + Math.sin(Date.now() / pulseSpeed) * 0.3;

    const dx = exitTarget.x - player.x;
    const dy = exitTarget.y - player.y;
    const angle = Math.atan2(dy, dx);
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const edgePad = 28;
    const tX = Math.abs(dx) > 0.001 ? (canvasWidth / 2 - edgePad) / Math.abs(Math.cos(angle)) : Infinity;
    const tY = Math.abs(dy) > 0.001 ? (canvasHeight / 2 - edgePad) / Math.abs(Math.sin(angle)) : Infinity;
    const t = Math.min(tX, tY);
    const arrowX = centerX + Math.cos(angle) * t;
    const arrowY = centerY + Math.sin(angle) * t;

    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    const size = 14;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.55, -size * 0.85);
    ctx.lineTo(-size * 0.55, size * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function renderRoomLayoutDebug(ctx) {
    if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.layout) return;
    const layout = currentRoom.layout;
    ctx.save();
    for (let row = 0; row < layout.rows; row++) {
        for (let col = 0; col < layout.cols; col++) {
            const blocked = layout.grid[row * layout.cols + col] === 1;
            if (!blocked) continue;
            ctx.fillStyle = 'rgba(255, 64, 64, 0.18)';
            ctx.fillRect(col * layout.cellSize, row * layout.cellSize, layout.cellSize, layout.cellSize);
        }
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    for (let col = 0; col <= layout.cols; col++) {
        ctx.beginPath();
        ctx.moveTo(col * layout.cellSize, 0);
        ctx.lineTo(col * layout.cellSize, layout.height);
        ctx.stroke();
    }
    for (let row = 0; row <= layout.rows; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * layout.cellSize);
        ctx.lineTo(layout.width, row * layout.cellSize);
        ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(80, 255, 120, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(layout.spawnZone.x, layout.spawnZone.y, layout.spawnZone.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(layout.exitZone.x, layout.exitZone.y, layout.exitZone.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

// Extend Renderer namespace with game-specific methods
if (typeof window !== 'undefined') {
    window.Renderer = window.Renderer || {};
    
    // Door Cache System
    window.Renderer.doorCache = new Map();
    
    // Helper to get or create a cached door sprite
    window.Renderer.getCachedDoor = function(width, height) {
        // Round dimensions to reduce fragmentation
        const keyWidth = Math.ceil(width);
        const keyHeight = Math.ceil(height);
        const key = `${keyWidth}_${keyHeight}`;

        if (this.doorCache.has(key)) {
            return this.doorCache.get(key);
        }

        // Create new cached door
        const canvas = document.createElement('canvas');
        // Size includes glow + padding
        const padding = 25;
        canvas.width = keyWidth + padding * 2;
        canvas.height = keyHeight + padding * 2;
        const ctx = canvas.getContext('2d');

        // Offset to draw centered in canvas with padding
        const x = padding;
        const y = padding;

        // Outer glow for pulse effect (baked in at max intensity or base intensity?)
        // We bake the base glow. Pulse scaling will be applied at draw time.
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffaa00';

        // Draw door body (gold/yellow)
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(x, y, keyWidth, keyHeight);

        // Draw door outline
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, keyWidth, keyHeight);

        // Draw door handle
        ctx.fillStyle = '#996600';
        ctx.beginPath();
        ctx.arc(x + keyWidth - 10, y + keyHeight / 2, 5, 0, Math.PI * 2);
        ctx.fill();

        this.doorCache.set(key, canvas);
        return canvas;
    };

    // Draw door
    window.Renderer.door = function(ctx, x, y, width, height, pulse = 0) {
        // Check debug flag
        if (typeof DebugFlags !== 'undefined' && DebugFlags.USE_CACHING === false) {
            // Fallback to original rendering
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
            return;
        }

        // Get cached door
        const cachedCanvas = this.getCachedDoor(width, height);

        // Pulse effect
        const pulseScale = 1.0 + Math.sin(pulse) * 0.02; // Subtle pulse scale

        ctx.save();

        // Center of the door for scaling
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        ctx.translate(centerX, centerY);
        ctx.scale(pulseScale, pulseScale);

        // Draw cached image centered
        ctx.drawImage(cachedCanvas, -cachedCanvas.width / 2, -cachedCanvas.height / 2);

        ctx.restore();
    };
}


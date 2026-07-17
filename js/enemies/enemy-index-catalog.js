// Player-facing Index catalog for enemy bases + biomes (0.8.2+)
(function (global) {
    const ENEMY_TYPE_INDEX = {
        circle: {
            id: 'circle',
            name: 'Circle',
            role: 'Swarmer',
            color: '#ff6666',
            blurb: 'Melee pack pressure - lunges after a short telegraph',
            description: 'The basic melee shape. Closes in, winds up a lunge, and commits. Later rooms add feints, combo lunges, surround pressure, and smarter group behavior.',
            tells: 'Telegraph flash before the lunge. Watch pack spacing - they push together.'
        },
        diamond: {
            id: 'diamond',
            name: 'Diamond',
            role: 'Assassin',
            color: '#00ffff',
            blurb: 'Orbits, then snaps in with a fast dash',
            description: 'Keeps mid-range, circles you, and dashes through after a very short telegraph. Later rooms unlock feints, combo dashes, and nastier positioning.',
            tells: 'Cyan diamond weaving at orbit distance - dash is fast; the windup is short.'
        },
        star: {
            id: 'star',
            name: 'Triangle',
            role: 'Ranger',
            color: '#ffaa00',
            blurb: 'Keeps distance and shoots - panics when you close',
            description: 'Ranged triangle that tries to stay outside your comfort zone. Burst fire, predictive aim, and volleys unlock as rooms climb. Get close and it backpedals with messy panic shots.',
            tells: 'Orange triangle at long range. Projectile windups before shots; wider fans when cornered.'
        },
        rectangle: {
            id: 'rectangle',
            name: 'Rectangle',
            role: 'Brute',
            color: '#8b0000',
            blurb: 'Slow windup into a slam AoE',
            description: 'Tanky and deliberate. Charges a slam, then hits a wide ground AoE. Later rooms add fake-out timing, combos, and defensive tricks when low.',
            tells: 'Big red charge ring while winding up. Leave the circle or interrupt the commit.'
        },
        octagon: {
            id: 'octagon',
            name: 'Octagon',
            role: 'Commander',
            color: '#bb86fc',
            blurb: 'Hybrid elite base - spin, charge, shots, and minions',
            description: 'Heavier hybrid that mixes melee spin/charge with projectile volleys and minion summons. Treat it like a mini-commander, not a normal trash mob.',
            tells: 'Purple outline. Watch for spin telegraphs, shot volleys, and circle spawns around it.'
        }
    };

    const BIOME_INDEX = {
        swarm: {
            id: 'swarm',
            name: 'Swarm',
            color: '#ff8866',
            blurb: 'Pack pressure - denser, slightly faster packs'
        },
        prism: {
            id: 'prism',
            name: 'Prism',
            color: '#88aaff',
            blurb: 'Wider ranged volleys and messier projectile spreads'
        },
        fortress: {
            id: 'fortress',
            name: 'Fortress',
            color: '#ccaa66',
            blurb: 'Braced - tankier, longer telegraphs, harder hits'
        },
        fractal: {
            id: 'fractal',
            name: 'Fractal',
            color: '#ff66ff',
            blurb: 'Echo afterimages on hit/death (pooled hitboxes, not new enemies)'
        },
        vortex: {
            id: 'vortex',
            name: 'Vortex',
            color: '#66ffcc',
            blurb: 'Pull during telegraphs - get dragged into commits'
        },
        endless: {
            id: 'endless',
            name: 'Endless',
            color: '#aaaaaa',
            blurb: 'Late mix - light echoes + pull pressure'
        }
    };

    function resolveEnemyIndexId(enemy) {
        if (!enemy) return null;
        if (enemy.isBoss) return null;
        if (enemy.isTutorialDummy) return null;
        const shape = enemy.shape;
        if (shape && ENEMY_TYPE_INDEX[shape]) return shape;
        const name = (enemy.constructor && enemy.constructor.name) || '';
        if (name === 'DiamondEnemy') return 'diamond';
        if (name === 'StarEnemy') return 'star';
        if (name === 'RectangleEnemy') return 'rectangle';
        if (name === 'OctagonEnemy') return 'octagon';
        if (name === 'Enemy' || shape === 'circle') return 'circle';
        return null;
    }

    /**
     * Unlock Index entries the first time this enemy is seen/fought.
     * Safe to call often - SaveSystem dedupes; enemy flag prevents spam.
     */
    function discoverFromEnemy(enemy) {
        if (!enemy || enemy._indexDiscovered) return;
        if (enemy.isTitleAttract || enemy.isTutorialDummy) return;
        if (typeof Game !== 'undefined' && typeof Game.allowsMetaProgression === 'function'
            && !Game.allowsMetaProgression()) {
            return;
        }
        if (typeof SaveSystem === 'undefined') return;
        const enemyId = resolveEnemyIndexId(enemy);
        if (!enemyId && !(enemy.eliteAffix && enemy.eliteAffix.type) && !enemy.biomeId) return;

        enemy._indexDiscovered = true;
        if (enemyId && SaveSystem.discoverEnemy) {
            SaveSystem.discoverEnemy(enemyId);
        }
        if (enemy.eliteAffix && enemy.eliteAffix.type && SaveSystem.discoverEliteAffix) {
            SaveSystem.discoverEliteAffix(enemy.eliteAffix.type);
        }
        if (enemy.biomeId && SaveSystem.discoverBiome) {
            SaveSystem.discoverBiome(enemy.biomeId);
        }
    }

    function drawEnemyShape(ctx, enemyId, cx, cy, size, options) {
        options = options || {};
        const entry = ENEMY_TYPE_INDEX[enemyId];
        const color = options.color || (entry && entry.color) || '#ff6666';
        const alpha = options.alpha != null ? options.alpha : 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.strokeStyle = options.stroke || '#ffffff';
        ctx.lineWidth = options.lineWidth != null ? options.lineWidth : 1.5;

        switch (enemyId) {
            case 'diamond': {
                ctx.rotate(Math.PI / 4);
                const s = size * 0.85;
                ctx.beginPath();
                ctx.rect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
                ctx.fill();
                break;
            }
            case 'star': {
                // Triangle (in-game "star" ranger)
                const h = size * 1.35;
                const b = size * 1.15;
                ctx.beginPath();
                ctx.moveTo(h * 0.55, 0);
                ctx.lineTo(-h * 0.4, b * 0.5);
                ctx.lineTo(-h * 0.4, -b * 0.5);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#ff8800';
                ctx.stroke();
                break;
            }
            case 'rectangle': {
                const w = size * 0.95;
                const h = size * 1.45;
                ctx.beginPath();
                ctx.rect(-w * 0.8, -h * 0.8, w * 1.6, h * 1.6);
                ctx.fill();
                break;
            }
            case 'octagon': {
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI / 4) * i;
                    const px = Math.cos(angle) * size;
                    const py = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#dda0dd';
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
            }
            case 'circle':
            default: {
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
        }

        // Facing pip (matches in-game white direction cue)
        if (options.showFacing !== false && enemyId !== 'star') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(size + 4, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function paintEnemyPreview(canvas, enemyId, timeSec) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#141418';
        ctx.fillRect(0, 0, w, h);
        // subtle floor ring
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.38, 0, Math.PI * 2);
        ctx.stroke();
        const size = Math.min(w, h) * 0.22;
        drawEnemyShape(ctx, enemyId, w / 2, h / 2, size);
    }

    function createEnemyPreviewCanvas(enemyId, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width || 72;
        canvas.height = height || 72;
        canvas.style.display = 'block';
        canvas.style.borderRadius = '8px';
        canvas.style.background = '#141418';
        paintEnemyPreview(canvas, enemyId, 0);
        return canvas;
    }

    global.EnemyIndexCatalog = {
        enemies: ENEMY_TYPE_INDEX,
        biomes: BIOME_INDEX,
        enemyOrder: ['circle', 'diamond', 'star', 'rectangle', 'octagon'],
        biomeOrder: ['swarm', 'prism', 'fortress', 'fractal', 'vortex', 'endless'],
        resolveEnemyIndexId,
        discoverFromEnemy,
        drawEnemyShape,
        paintEnemyPreview,
        createEnemyPreviewCanvas
    };
})(typeof window !== 'undefined' ? window : globalThis);

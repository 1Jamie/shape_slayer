// Title-screen attract mode — real enemies, real player attacks, real combat VFX.
(function (global) {
    const TARGET_ENEMIES = 8;
    const MIN_ENEMIES = 5;
    const GRID_STEP = 48;
    const DEATH_LINGER = 0.55;
    // Keep the scrap in a centered play pocket so nobody kites to the bezel
    const PLAY_INSET_X = 0.14;
    const PLAY_INSET_Y = 0.20;
    const HERO_CLASSES = ['square', 'triangle', 'pentagon', 'hexagon'];

    const ENEMY_SPAWNERS = [
        function (x, y) { return typeof Enemy === 'function' ? new Enemy(x, y) : null; },
        function (x, y) { return typeof DiamondEnemy === 'function' ? new DiamondEnemy(x, y) : null; },
        function (x, y) { return typeof StarEnemy === 'function' ? new StarEnemy(x, y) : null; },
        function (x, y) { return typeof RectangleEnemy === 'function' ? new RectangleEnemy(x, y) : null; },
        // Octagon omitted — summons flood the attract sandbox
        function (x, y) { return typeof Enemy === 'function' ? new Enemy(x, y) : null; },
        function (x, y) { return typeof DiamondEnemy === 'function' ? new DiamondEnemy(x, y) : null; },
        function (x, y) { return typeof StarEnemy === 'function' ? new StarEnemy(x, y) : null; }
    ];

    let width = 1280;
    let height = 720;
    let initialized = false;
    let arenaRoom = null;
    let hero = null;
    let heroHeavyPulse = false;
    let heroSpecialPulse = false;
    let heroDodgePulse = false;
    let heroHeavyTimer = 0;
    let heroSpecialTimer = 0;
    let heroDodgeTimer = 0;
    let respawnCooldown = 0;
    let _interactPrev = false;
    let timeSec = 0;

    let saved = {
        currentRoom: null,
        roomNumber: null,
        player: null,
        enemies: null,
        projectiles: null,
        particles: null,
        discoverFromEnemy: null
    };

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function pick(arr) {
        return arr[(Math.random() * arr.length) | 0];
    }

    function ensureGameLists() {
        if (typeof Game === 'undefined') return;
        if (!Array.isArray(Game.enemies)) Game.enemies = [];
        if (!Array.isArray(Game.projectiles)) Game.projectiles = [];
        if (!Array.isArray(Game.particles)) Game.particles = [];
    }

    function setCurrentRoom(room) {
        try {
            currentRoom = room;
        } catch (e) {
            // ignore
        }
        if (typeof window !== 'undefined') {
            window.currentRoom = room;
        }
        if (typeof syncCurrentRoomToWindow === 'function') {
            syncCurrentRoomToWindow();
        }
    }

    function playBounds() {
        return {
            left: width * PLAY_INSET_X,
            right: width * (1 - PLAY_INSET_X),
            top: height * PLAY_INSET_Y,
            bottom: height * (1 - PLAY_INSET_Y)
        };
    }

    function softContainEntity(entity, strength) {
        if (!entity) return;
        const b = playBounds();
        const pad = 24;
        const pull = strength != null ? strength : 220;
        if (entity.x < b.left + pad) entity.vx = (entity.vx || 0) + pull * 0.016;
        if (entity.x > b.right - pad) entity.vx = (entity.vx || 0) - pull * 0.016;
        if (entity.y < b.top + pad) entity.vy = (entity.vy || 0) + pull * 0.016;
        if (entity.y > b.bottom - pad) entity.vy = (entity.vy || 0) - pull * 0.016;
        entity.x = Math.max(b.left, Math.min(b.right, entity.x));
        entity.y = Math.max(b.top, Math.min(b.bottom, entity.y));
    }

    function hardenEnemy(enemy) {
        if (!enemy) return enemy;
        enemy.isTutorialDummy = true;
        enemy.isTitleAttract = true;
        enemy.lootChance = 0;
        enemy.xpValue = 0;
        enemy.detectionRange = Math.max(enemy.detectionRange || 0, 99999);
        enemy.activated = true;
        // Compress kite ranges so fights stay readable on the title canvas
        if (enemy.shootRange != null) {
            enemy.shootRange = Math.min(enemy.shootRange, 210);
            enemy.minRange = Math.min(enemy.minRange != null ? enemy.minRange : 170, 160);
            enemy.maxRange = Math.min(enemy.maxRange != null ? enemy.maxRange : 250, 250);
            enemy.meleePressureRange = Math.min(enemy.meleePressureRange != null ? enemy.meleePressureRange : 140, 140);
        }
        if (enemy.optimalDistance != null) {
            enemy.optimalDistance = Math.min(enemy.optimalDistance, 140);
        }
        // Slightly squishier so kills actually read
        if (enemy.maxHp != null) {
            enemy.maxHp = Math.max(28, Math.floor(enemy.maxHp * 0.7));
            enemy.hp = enemy.maxHp;
        }
        if (typeof enemy.assignInitialTarget === 'function') {
            enemy.assignInitialTarget();
        } else if (typeof Game !== 'undefined' && Game.getLocalPlayerId) {
            enemy.currentTarget = Game.getLocalPlayerId();
        }

        // Visuals-only death: keep shatter juice, skip economy / lifetime stats
        enemy.die = function () {
            this.alive = false;
            this.deathTime = Date.now();
            this.lastAttacker = null;
            if (typeof this.triggerDeathVisuals === 'function') {
                this.triggerDeathVisuals();
            } else if (typeof createParticleBurst === 'function') {
                createParticleBurst(this.x, this.y, this.color || '#ffffff', 16);
            }
        };

        return enemy;
    }

    function spawnEnemyAt(x, y) {
        const factory = pick(ENEMY_SPAWNERS);
        let enemy = null;
        try {
            enemy = factory(x, y);
        } catch (err) {
            console.warn('[TitleAttract] enemy spawn failed', err);
            return null;
        }
        if (!enemy) return null;
        hardenEnemy(enemy);

        if (arenaRoom) {
            if (!Array.isArray(arenaRoom.enemies)) arenaRoom.enemies = [];
            arenaRoom.enemies.push(enemy);
        }
        if (typeof Game !== 'undefined') {
            if (!Array.isArray(Game.enemies)) Game.enemies = [];
            Game.enemies.push(enemy);
        }
        return enemy;
    }

    function randomArenaPos(margin) {
        margin = margin || 40;
        const b = playBounds();
        return {
            x: rand(b.left + margin, b.right - margin),
            y: rand(b.top + margin, b.bottom - margin)
        };
    }

    function spawnAwayFromHero(margin) {
        margin = margin || 70;
        for (let attempt = 0; attempt < 12; attempt++) {
            const pos = randomArenaPos(margin);
            if (!hero) return pos;
            const dx = pos.x - hero.x;
            const dy = pos.y - hero.y;
            if (dx * dx + dy * dy > 140 * 140) return pos;
        }
        return randomArenaPos(margin);
    }

    function countLivingEnemies() {
        if (typeof Game === 'undefined' || !Game.enemies) return 0;
        let n = 0;
        for (let i = 0; i < Game.enemies.length; i++) {
            if (Game.enemies[i] && Game.enemies[i].alive) n++;
        }
        return n;
    }

    function fillEnemies(targetCount) {
        const need = targetCount - countLivingEnemies();
        for (let i = 0; i < need; i++) {
            const pos = spawnAwayFromHero();
            spawnEnemyAt(pos.x, pos.y);
        }
    }

    let bot = {
        moveX: 0,
        moveY: 0,
        aimX: 0,
        aimY: 0,
        target: null,
        retargetIn: 0,
        strafeSign: 1,
        strafeFlipIn: 0,
        burstRemaining: 0,
        burstPauseIn: 0,
        commitIn: 0,
        wanderAngle: 0,
        style: 'engage' // engage | circle | reset
    };

    function resetBotState(player) {
        bot.moveX = 0;
        bot.moveY = 0;
        bot.aimX = player ? player.x + 80 : width * 0.5;
        bot.aimY = player ? player.y : height * 0.5;
        bot.target = null;
        bot.retargetIn = 0;
        bot.strafeSign = Math.random() < 0.5 ? -1 : 1;
        bot.strafeFlipIn = rand(0.7, 1.6);
        bot.burstRemaining = 0;
        bot.burstPauseIn = rand(0.15, 0.45);
        bot.commitIn = rand(0.1, 0.35);
        bot.wanderAngle = Math.random() * Math.PI * 2;
        bot.style = 'engage';
    }

    function createHero() {
        if (typeof createPlayer !== 'function') return null;
        const classType = pick(HERO_CLASSES);
        const spawn = randomArenaPos(50);
        const player = createPlayer(classType, spawn.x, spawn.y);
        if (!player) return null;

        player.playerId = (typeof Game !== 'undefined' && Game.getLocalPlayerId)
            ? Game.getLocalPlayerId()
            : 'local';
        player.alive = true;
        player.dead = false;
        player.invulnerable = false;
        player.invulnerabilityTime = 0;
        // Feel hits, never lose HP / die / progress
        player.takeDamage = function (damage, sourceEnemy) {
            return playAttractHitFeel(this, damage, sourceEnemy);
        };

        resetBotState(player);
        return player;
    }

    function playAttractHitFeel(player, damage, sourceEnemy) {
        if (!player || player.dead) return 0;
        if (player.invulnerable || player.isDodging) return 0;

        const raw = Math.max(1, Number(damage) || 8);
        const maxHp = player.maxHp > 0 ? player.maxHp : 100;
        // Fake a meaningful chunk so shake / trauma scale like a real hit
        const felt = Math.min(maxHp * 0.22, Math.max(maxHp * 0.08, raw));

        player.lastDamageTime = Date.now() / 1000;
        player.lastDamageAmount = felt;
        player.invulnerable = true;
        player.invulnerabilityTime = 0.45;
        player.hp = maxHp;
        player.alive = true;
        player.dead = false;

        if (typeof Game !== 'undefined') {
            const hitRatio = felt / maxHp;
            const normalized = Math.min(hitRatio / 0.45, 1.0);
            const intensity = 0.7 + 2.2 * (0.1 + 0.9 * normalized);
            if (typeof Game.triggerScreenShake === 'function') {
                Game.triggerScreenShake(intensity, 0.22, 'player');
            }
            if (typeof Game.triggerChromaticTrauma === 'function') {
                Game.triggerChromaticTrauma(7, 0.55 + 0.35 * normalized);
            }
            if (typeof Game.triggerHitPause === 'function') {
                Game.triggerHitPause(0.03);
            }
        }

        if (typeof createParticleBurst === 'function') {
            createParticleBurst(player.x, player.y, '#ff6666', 10);
        }
        if (typeof createDamageNumber === 'function') {
            createDamageNumber(player.x, player.y - (player.size || 16), Math.floor(felt), true, false);
        }
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds && AudioManager.sounds.hitNormal) {
            AudioManager.sounds.hitNormal(0.45);
        }

        // Tank passive knockback still reads great on title
        if (typeof player.triggerPassiveKnockback === 'function'
            && (player.passiveKnockbackCooldown || 0) <= 0) {
            player.triggerPassiveKnockback();
            if (typeof TANK_CONFIG !== 'undefined' && TANK_CONFIG.passiveKnockbackCooldown != null) {
                player.passiveKnockbackCooldown = TANK_CONFIG.passiveKnockbackCooldown;
            } else {
                player.passiveKnockbackCooldown = 1.5;
            }
        }

        return 0;
    }

    function keepHeroAlive(player) {
        if (!player) return;
        player.alive = true;
        player.dead = false;
        if (player.hp != null && player.maxHp != null) {
            player.hp = player.maxHp;
        }
    }

    function countNearbyEnemies(from, radius) {
        if (typeof Game === 'undefined' || !Game.enemies) return 0;
        const r2 = radius * radius;
        let n = 0;
        for (let i = 0; i < Game.enemies.length; i++) {
            const e = Game.enemies[i];
            if (!e || !e.alive) continue;
            const dx = e.x - from.x;
            const dy = e.y - from.y;
            if (dx * dx + dy * dy <= r2) n++;
        }
        return n;
    }

    function getClassCombatProfile(playerClass) {
        switch (playerClass) {
            case 'triangle': // Rogue
                return {
                    preferred: 165,
                    attackRange: 340,
                    meleeHold: false,
                    lead: 0.18,
                    aimLag: 8,
                    moveSmooth: 7,
                    burstLen: [0.35, 0.85],
                    burstGap: [0.2, 0.55]
                };
            case 'hexagon': // Mage
                return {
                    preferred: 215,
                    attackRange: 400,
                    meleeHold: false,
                    lead: 0.22,
                    aimLag: 6.5,
                    moveSmooth: 6,
                    burstLen: [0.45, 1.1],
                    burstGap: [0.25, 0.7]
                };
            case 'pentagon': // Tank
                return {
                    preferred: 78,
                    attackRange: 140,
                    meleeHold: true,
                    lead: 0.05,
                    aimLag: 10,
                    moveSmooth: 5.5,
                    burstLen: [0.55, 1.2],
                    burstGap: [0.15, 0.4]
                };
            case 'square': // Warrior
            default:
                return {
                    preferred: 72,
                    attackRange: 150,
                    meleeHold: true,
                    lead: 0.08,
                    aimLag: 9,
                    moveSmooth: 6.5,
                    burstLen: [0.4, 0.95],
                    burstGap: [0.18, 0.45]
                };
        }
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function approach(current, target, rate, dt) {
        const t = 1 - Math.exp(-rate * dt);
        return lerp(current, target, t);
    }

    function normalize2(x, y) {
        const len = Math.sqrt(x * x + y * y);
        if (len < 0.0001) return { x: 0, y: 0, len: 0 };
        return { x: x / len, y: y / len, len: len };
    }

    function buildBotInput(player, aimX, aimY, moveX, moveY, wantsPrimary, wantsHeavy, wantsSpecial, wantsDodge) {
        const spaceDown = !!wantsSpecial;
        return {
            mouseLeft: !!wantsPrimary,
            mouseRight: !!wantsHeavy,
            mouse: { x: aimX, y: aimY },
            keys: {
                ' ': spaceDown,
                'Shift': !!wantsDodge,
                'shift': !!wantsDodge
            },
            getMovementInput: function () {
                return { x: moveX, y: moveY };
            },
            getAimDirection: function () {
                return Math.atan2(aimY - player.y, aimX - player.x);
            },
            getWorldMousePos: function () {
                return { x: aimX, y: aimY };
            },
            getKeyState: function (key) {
                if (key === ' ' || key === 'Space') return spaceDown;
                if (key === 'Shift' || key === 'shift') return !!wantsDodge;
                return false;
            },
            isTouchMode: function () { return false; },
            isAbilityPressed: function () { return false; }
        };
    }

    function installSandbox() {
        ensureGameLists();

        saved.currentRoom = (typeof currentRoom !== 'undefined') ? currentRoom : null;
        saved.roomNumber = (typeof Game !== 'undefined') ? Game.roomNumber : null;
        saved.player = (typeof Game !== 'undefined') ? Game.player : null;
        saved.enemies = (typeof Game !== 'undefined' && Array.isArray(Game.enemies)) ? Game.enemies.slice() : [];
        saved.projectiles = (typeof Game !== 'undefined' && Array.isArray(Game.projectiles)) ? Game.projectiles.slice() : [];
        saved.particles = (typeof Game !== 'undefined' && Array.isArray(Game.particles)) ? Game.particles.slice() : [];
        saved.discoverFromEnemy = null;

        arenaRoom = {
            width: width,
            height: height,
            number: 1,
            type: 'tutorial',
            enemies: [],
            layout: null,
            doorOpen: false
        };
        setCurrentRoom(arenaRoom);

        if (typeof Game !== 'undefined') {
            Game.roomNumber = 1;
            Game.enemies = [];
            Game.projectiles = [];
            Game.particles = Game.particles || [];
            Game.particles.length = 0;
        }

        // Don't pollute Index discovery from attract combat
        if (typeof EnemyIndexCatalog !== 'undefined' && EnemyIndexCatalog.discoverFromEnemy) {
            saved.discoverFromEnemy = EnemyIndexCatalog.discoverFromEnemy;
            EnemyIndexCatalog.discoverFromEnemy = function () { };
        }

        hero = createHero();
        if (typeof Game !== 'undefined') {
            Game.player = hero;
        }

        fillEnemies(TARGET_ENEMIES);
    }

    function teardownSandbox() {
        if (saved.discoverFromEnemy && typeof EnemyIndexCatalog !== 'undefined') {
            EnemyIndexCatalog.discoverFromEnemy = saved.discoverFromEnemy;
        }

        if (typeof Game !== 'undefined') {
            if (Array.isArray(Game.enemies)) Game.enemies.length = 0;
            if (Array.isArray(Game.projectiles)) Game.projectiles.length = 0;
            if (Array.isArray(Game.particles)) Game.particles.length = 0;
            Game.player = saved.player != null ? saved.player : null;
            if (saved.roomNumber != null) Game.roomNumber = saved.roomNumber;
        }

        setCurrentRoom(saved.currentRoom != null ? saved.currentRoom : null);

        hero = null;
        arenaRoom = null;
        saved = {
            currentRoom: null,
            roomNumber: null,
            player: null,
            enemies: null,
            projectiles: null,
            particles: null,
            discoverFromEnemy: null
        };
    }

    function keepHeroInBounds(player) {
        softContainEntity(player, 320);
    }

    function scoreCombatTarget(from, enemy) {
        const cx = width * 0.5;
        const cy = height * 0.52;
        const dx = enemy.x - from.x;
        const dy = enemy.y - from.y;
        const distHero = Math.sqrt(dx * dx + dy * dy);
        const distCenter = Math.sqrt((enemy.x - cx) * (enemy.x - cx) + (enemy.y - cy) * (enemy.y - cy));
        // Prefer nearby threats that aren't stuck on the bezel
        return distHero + distCenter * 0.55;
    }

    function pickCombatTarget(from, sticky) {
        if (typeof Game === 'undefined' || !Game.enemies) return null;
        if (sticky && sticky.alive) {
            // Keep focus unless something much closer/better appears
            const stickyScore = scoreCombatTarget(from, sticky);
            let challenger = null;
            let challengerScore = Infinity;
            for (let i = 0; i < Game.enemies.length; i++) {
                const e = Game.enemies[i];
                if (!e || !e.alive || e === sticky) continue;
                const s = scoreCombatTarget(from, e);
                if (s < challengerScore) {
                    challengerScore = s;
                    challenger = e;
                }
            }
            if (!challenger || challengerScore > stickyScore * 0.62) return sticky;
            return challenger;
        }

        let best = null;
        let bestScore = Infinity;
        for (let i = 0; i < Game.enemies.length; i++) {
            const e = Game.enemies[i];
            if (!e || !e.alive) continue;
            const score = scoreCombatTarget(from, e);
            if (score < bestScore) {
                bestScore = score;
                best = e;
            }
        }
        return best;
    }

    function enemyCentroid() {
        if (typeof Game === 'undefined' || !Game.enemies) {
            return { x: width * 0.5, y: height * 0.52, count: 0 };
        }
        let sx = 0;
        let sy = 0;
        let n = 0;
        for (let i = 0; i < Game.enemies.length; i++) {
            const e = Game.enemies[i];
            if (!e || !e.alive) continue;
            sx += e.x;
            sy += e.y;
            n++;
        }
        if (!n) return { x: width * 0.5, y: height * 0.52, count: 0 };
        return { x: sx / n, y: sy / n, count: n };
    }

    function leadPoint(enemy, lead) {
        const vx = enemy.vx || enemy.velX || 0;
        const vy = enemy.vy || enemy.velY || 0;
        return {
            x: enemy.x + vx * lead,
            y: enemy.y + vy * lead
        };
    }

    function updateHero(dt) {
        if (!hero || !hero.alive) {
            hero = createHero();
            if (typeof Game !== 'undefined') Game.player = hero;
            if (!hero) return;
            heroHeavyTimer = rand(2.5, 4.5);
            heroSpecialTimer = rand(4, 7);
            heroDodgeTimer = rand(2, 4);
        }

        // Keep the sim immortal, but allow real brief i-frames so hits can land for feel
        keepHeroAlive(hero);

        const profile = getClassCombatProfile(hero.playerClass);
        const cluster = enemyCentroid();

        bot.retargetIn -= dt;
        bot.strafeFlipIn -= dt;
        bot.commitIn -= dt;
        if (bot.strafeFlipIn <= 0) {
            bot.strafeSign *= -1;
            bot.strafeFlipIn = rand(0.55, 1.8);
            // Occasional style change — humans don't always push the same angle
            const roll = Math.random();
            if (roll < 0.18) bot.style = 'circle';
            else if (roll < 0.28) bot.style = 'reset';
            else bot.style = 'engage';
        }

        if (bot.retargetIn <= 0 || !bot.target || !bot.target.alive) {
            bot.target = pickCombatTarget(hero, bot.target);
            bot.retargetIn = rand(0.35, 0.95);
        } else {
            // Soft re-evaluate less often while sticky
            bot.target = pickCombatTarget(hero, bot.target);
        }

        const target = bot.target;
        let desiredMoveX = 0;
        let desiredMoveY = 0;
        let dist = 9999;
        let aimTX = bot.aimX;
        let aimTY = bot.aimY;

        if (target) {
            const dx = target.x - hero.x;
            const dy = target.y - hero.y;
            dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / dist;
            const ny = dy / dist;
            const preferred = profile.preferred;
            const band = profile.meleeHold ? 16 : 28;

            if (bot.style === 'reset' || dist > preferred + band * 2.2) {
                desiredMoveX = nx;
                desiredMoveY = ny;
            } else if (dist < preferred - band) {
                desiredMoveX = -nx * 0.9;
                desiredMoveY = -ny * 0.9;
                // Drift sideways while backing so retreat isn't a straight line
                desiredMoveX += -ny * bot.strafeSign * 0.35;
                desiredMoveY += nx * bot.strafeSign * 0.35;
            } else if (bot.style === 'circle') {
                desiredMoveX = -ny * bot.strafeSign * 0.95;
                desiredMoveY = nx * bot.strafeSign * 0.95;
                // Tiny radial nudge to stay in the pocket
                desiredMoveX += nx * ((preferred - dist) / preferred) * 0.25;
                desiredMoveY += ny * ((preferred - dist) / preferred) * 0.25;
            } else {
                // Engage: mostly hold range with light orbit
                desiredMoveX = -ny * bot.strafeSign * 0.55;
                desiredMoveY = nx * bot.strafeSign * 0.55;
                if (dist > preferred + 8) {
                    desiredMoveX += nx * 0.45;
                    desiredMoveY += ny * 0.45;
                } else if (dist < preferred - 8) {
                    desiredMoveX -= nx * 0.4;
                    desiredMoveY -= ny * 0.4;
                }
            }

            const lead = leadPoint(target, profile.lead);
            // Small aim wobble — not sniper-perfect
            const wobble = 10 + Math.sin(performance.now() * 0.004 + bot.wanderAngle) * 6;
            aimTX = lead.x + Math.cos(bot.wanderAngle) * wobble * 0.15;
            aimTY = lead.y + Math.sin(bot.wanderAngle * 1.3) * wobble * 0.15;
            bot.wanderAngle += dt * (0.6 + Math.random() * 0.4);

            if (profile.meleeHold && (hero.isAttacking || hero.attackRecoveryRemaining > 0)) {
                desiredMoveX *= 0.18;
                desiredMoveY *= 0.18;
            }
        } else if (cluster.count > 0) {
            const dx = cluster.x - hero.x;
            const dy = cluster.y - hero.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            desiredMoveX = dx / d;
            desiredMoveY = dy / d;
            aimTX = cluster.x;
            aimTY = cluster.y;
        } else {
            const cx = width * 0.5;
            const cy = height * 0.52;
            const dx = cx - hero.x;
            const dy = cy - hero.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            if (d > 36) {
                desiredMoveX = dx / d * 0.5;
                desiredMoveY = dy / d * 0.5;
            }
            aimTX = cx + Math.cos(bot.wanderAngle) * 40;
            aimTY = cy + Math.sin(bot.wanderAngle) * 28;
            bot.wanderAngle += dt * 0.8;
        }

        // Soft pack + center gravity (less twitchy than hard redirects)
        if (cluster.count > 0) {
            const cdx = cluster.x - hero.x;
            const cdy = cluster.y - hero.y;
            const cd = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
            desiredMoveX += (cdx / cd) * 0.22;
            desiredMoveY += (cdy / cd) * 0.22;
        }
        {
            const cx = width * 0.5;
            const cy = height * 0.52;
            const dx = cx - hero.x;
            const dy = cy - hero.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            if (d > height * 0.2) {
                desiredMoveX += (dx / d) * 0.38;
                desiredMoveY += (dy / d) * 0.38;
            }
        }

        let nMove = normalize2(desiredMoveX, desiredMoveY);
        // Brief hesitation before fully committing to a new vector
        if (bot.commitIn > 0) {
            nMove = {
                x: nMove.x * 0.35,
                y: nMove.y * 0.35,
                len: nMove.len
            };
        }

        bot.moveX = approach(bot.moveX, nMove.x, profile.moveSmooth, dt);
        bot.moveY = approach(bot.moveY, nMove.y, profile.moveSmooth, dt);
        const smoothed = normalize2(bot.moveX, bot.moveY);
        // Keep a little stick magnitude so approach doesn't feel binary
        const moveMag = Math.min(1, smoothed.len > 0.05 ? 0.55 + smoothed.len * 0.45 : 0);
        const moveX = smoothed.x * moveMag;
        const moveY = smoothed.y * moveMag;
        bot.moveX = moveX;
        bot.moveY = moveY;

        bot.aimX = approach(bot.aimX, aimTX, profile.aimLag, dt);
        bot.aimY = approach(bot.aimY, aimTY, profile.aimLag, dt);

        heroHeavyTimer -= dt;
        heroSpecialTimer -= dt;
        heroDodgeTimer -= dt;

        // Burst fire: humans hold attack in clumps, then release
        if (bot.burstRemaining > 0) {
            bot.burstRemaining -= dt;
            if (bot.burstRemaining <= 0) {
                bot.burstPauseIn = rand(profile.burstGap[0], profile.burstGap[1]);
            }
        } else {
            bot.burstPauseIn -= dt;
            if (bot.burstPauseIn <= 0 && target && dist <= profile.attackRange * 1.05) {
                bot.burstRemaining = rand(profile.burstLen[0], profile.burstLen[1]);
                bot.commitIn = rand(0.05, 0.18);
            }
        }
        const wantsPrimary = !!(target && dist <= profile.attackRange && bot.burstRemaining > 0);

        let wantsHeavy = false;
        let wantsSpecial = false;
        let wantsDodge = false;

        if (heroHeavyPulse) {
            wantsHeavy = true;
            heroHeavyPulse = false;
        } else if (target && heroHeavyTimer <= 0 && (hero.heavyAttackCooldown || 0) <= 0 && dist < profile.attackRange + 40) {
            heroHeavyPulse = true;
            wantsHeavy = true;
            heroHeavyTimer = rand(3.2, 6.0);
            bot.commitIn = rand(0.08, 0.22);
        }

        const nearby = countNearbyEnemies(hero, 140);
        if (heroSpecialPulse) {
            wantsSpecial = true;
            heroSpecialPulse = false;
        } else if (heroSpecialTimer <= 0 && (hero.specialCooldown || 0) <= 0 && nearby >= 2) {
            heroSpecialPulse = true;
            wantsSpecial = true;
            heroSpecialTimer = rand(5, 9);
            bot.commitIn = rand(0.1, 0.28);
        }

        if (heroDodgePulse) {
            wantsDodge = true;
            heroDodgePulse = false;
        } else if (heroDodgeTimer <= 0 && dist < 80 && nearby >= 1) {
            heroDodgePulse = true;
            wantsDodge = true;
            heroDodgeTimer = rand(2.5, 5);
            bot.strafeSign *= -1;
            bot.commitIn = rand(0.05, 0.15);
        }

        const botInput = buildBotInput(
            hero,
            bot.aimX,
            bot.aimY,
            moveX,
            moveY,
            wantsPrimary,
            wantsHeavy,
            wantsSpecial,
            wantsDodge
        );

        if (typeof hero.update === 'function') {
            hero.update(dt, botInput);
        }

        // Re-assert immortality after update (never die / never drain HP)
        keepHeroAlive(hero);

        keepHeroInBounds(hero);

        if (typeof checkAttacksVsEnemies === 'function' && hero.attackHitboxes && hero.attackHitboxes.length) {
            const pid = hero.playerId || 'local';
            checkAttacksVsEnemies(hero, Game.enemies, pid);
        }
    }

    function updateEnemies(dt) {
        if (typeof Game === 'undefined' || !Game.enemies) return;
        const now = Date.now();

        for (let i = Game.enemies.length - 1; i >= 0; i--) {
            const enemy = Game.enemies[i];
            if (!enemy) {
                Game.enemies.splice(i, 1);
                continue;
            }

            if (enemy.alive) {
                if (typeof enemy.update === 'function') {
                    enemy.update(dt);
                }
                softContainEntity(enemy, 260);
            } else {
                const age = (now - (enemy.deathTime || now)) / 1000;
                const juiceVisible = (typeof isEnemyDeathJuiceVisible === 'function')
                    ? isEnemyDeathJuiceVisible(enemy)
                    : age < DEATH_LINGER;
                if (!juiceVisible && age >= DEATH_LINGER) {
                    Game.enemies.splice(i, 1);
                    if (arenaRoom && Array.isArray(arenaRoom.enemies)) {
                        const idx = arenaRoom.enemies.indexOf(enemy);
                        if (idx !== -1) arenaRoom.enemies.splice(idx, 1);
                    }
                }
            }
        }

        // Keep arena enemies list synced
        if (arenaRoom) {
            arenaRoom.enemies = Game.enemies.slice();
        }
    }

    function maintainPopulation(dt) {
        respawnCooldown -= dt;
        const living = countLivingEnemies();
        if (living < MIN_ENEMIES && respawnCooldown <= 0) {
            const pos = spawnAwayFromHero();
            spawnEnemyAt(pos.x, pos.y);
            respawnCooldown = rand(0.35, 0.9);
        } else if (living < TARGET_ENEMIES && respawnCooldown <= 0) {
            const pos = spawnAwayFromHero();
            spawnEnemyAt(pos.x, pos.y);
            respawnCooldown = rand(0.8, 1.6);
        }
    }

    function drawGrid(ctx) {
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.strokeStyle = 'rgba(0, 220, 255, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += GRID_STEP) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += GRID_STEP) {
            ctx.beginPath();
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(width, y + 0.5);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawVignette(ctx) {
        const g = ctx.createRadialGradient(
            width * 0.5, height * 0.45, Math.min(width, height) * 0.2,
            width * 0.5, height * 0.5, Math.max(width, height) * 0.72
        );
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.72)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
    }

    function drawProjectiles(ctx) {
        if (typeof Game === 'undefined' || !Game.projectiles) return;
        for (let i = 0; i < Game.projectiles.length; i++) {
            const projectile = Game.projectiles[i];
            if (!projectile) continue;

            if (projectile.trailLength && projectile.vx !== undefined && projectile.vy !== undefined) {
                const trailLength = Math.min(6, Math.max(1, projectile.trailLength));
                const speed = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) || 1;
                const dirX = projectile.vx / speed;
                const dirY = projectile.vy / speed;
                const color = projectile.trailColor || projectile.color || '#ffff00';
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                for (let t = trailLength; t >= 1; t--) {
                    const alpha = (1 - t / (trailLength + 1)) * 0.35;
                    const offset = t * (projectile.size || 4) * 1.35;
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(
                        projectile.x - dirX * offset,
                        projectile.y - dirY * offset,
                        (projectile.size || 4) * (1 - t * 0.1),
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
                ctx.restore();
            }

            if (projectile.type === 'knife') {
                ctx.save();
                ctx.translate(projectile.x, projectile.y);
                ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
                ctx.fillStyle = projectile.color || '#ff1493';
                ctx.beginPath();
                ctx.moveTo(projectile.size, 0);
                ctx.lineTo(-projectile.size / 2, -projectile.size / 2);
                ctx.lineTo(-projectile.size / 2, projectile.size / 2);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            } else if (projectile.type === 'magic') {
                ctx.fillStyle = projectile.color || '#673ab7';
                ctx.beginPath();
                ctx.arc(projectile.x, projectile.y, projectile.size || 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.fillStyle = projectile.color || '#ffff00';
                ctx.beginPath();
                ctx.arc(projectile.x, projectile.y, projectile.size || 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function pollDismissInput() {
        if (typeof Game === 'undefined' || Game.state !== 'TITLE') return;
        if (typeof Input === 'undefined') return;
        const interactNow = !!(Input.keys && Input.keys['g']);
        if (interactNow && !_interactPrev) {
            if (typeof Game.dismissTitleScreen === 'function') {
                Game.dismissTitleScreen();
            }
        }
        _interactPrev = interactNow;
    }

    function init(w, h) {
        width = w || 1280;
        height = h || 720;
        timeSec = 0;
        heroHeavyTimer = rand(2, 4);
        heroSpecialTimer = rand(4, 7);
        heroDodgeTimer = rand(2, 4);
        heroHeavyPulse = false;
        heroSpecialPulse = false;
        heroDodgePulse = false;
        respawnCooldown = 0;
        _interactPrev = false;
        installSandbox();
        initialized = true;
    }

    function resize(w, h) {
        width = w || width;
        height = h || height;
        if (!initialized) {
            init(width, height);
            return;
        }
        if (arenaRoom) {
            arenaRoom.width = width;
            arenaRoom.height = height;
        }
        if (hero) keepHeroInBounds(hero);
    }

    function update(dt) {
        if (!initialized) {
            init(width, height);
        }
        timeSec += dt;

        updateHero(dt);
        updateEnemies(dt);

        if (typeof Game !== 'undefined' && typeof Game.updateProjectiles === 'function') {
            Game.updateProjectiles(dt);
        }
        // Knife / magic bolt hits (not covered by updateProjectiles alone)
        if (typeof Game !== 'undefined' && typeof Game.checkProjectilesVsPlayer === 'function') {
            Game.checkProjectilesVsPlayer();
        }
        // Melee / contact hits so the hero actually "feels" getting touched
        if (typeof checkEnemiesVsPlayer === 'function' && typeof Game !== 'undefined' && Game.enemies && hero) {
            checkEnemiesVsPlayer(hero, Game.enemies);
        }

        if (typeof updateParticles === 'function') {
            updateParticles(dt);
        }
        if (typeof updateDamageNumbers === 'function') {
            updateDamageNumbers(dt);
        }

        maintainPopulation(dt);
        pollDismissInput();
    }

    function render(ctx) {
        if (!initialized) {
            init(width, height);
        }
        if (!ctx) return;

        ctx.save();
        if (typeof Game !== 'undefined' && Game.screenShakeOffset) {
            ctx.translate(Game.screenShakeOffset.x || 0, Game.screenShakeOffset.y || 0);
        }

        drawGrid(ctx);

        if (typeof renderVoxelStaticLayer === 'function') {
            renderVoxelStaticLayer(ctx);
        }

        if (typeof Game !== 'undefined' && Game.enemies) {
            for (let i = 0; i < Game.enemies.length; i++) {
                const enemy = Game.enemies[i];
                if (!enemy) continue;
                if (!enemy.alive) {
                    const juiceVisible = (typeof isEnemyDeathJuiceVisible === 'function')
                        ? isEnemyDeathJuiceVisible(enemy)
                        : true;
                    if (!juiceVisible) continue;
                }
                if (typeof enemy.render === 'function') {
                    enemy.render(ctx);
                }
            }
        }

        if (hero && typeof hero.render === 'function') {
            const flash = getAttractHitFlash(hero);
            if (flash > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const glow = ctx.createRadialGradient(
                    hero.x, hero.y, 0,
                    hero.x, hero.y, (hero.size || 18) * 2.4
                );
                glow.addColorStop(0, `rgba(255, 70, 90, ${0.55 * flash})`);
                glow.addColorStop(1, 'rgba(255, 40, 60, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(hero.x, hero.y, (hero.size || 18) * 2.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            hero.render(ctx);
        }

        drawProjectiles(ctx);

        if (typeof renderVoxelActiveParticles === 'function') {
            renderVoxelActiveParticles(ctx);
        }
        if (typeof renderParticles === 'function') {
            renderParticles(ctx);
        }
        if (typeof renderDamageNumbers === 'function') {
            renderDamageNumbers(ctx);
        }

        drawVignette(ctx);
        ctx.restore();
    }

    function getAttractHitFlash(player) {
        if (!player || !player.lastDamageTime) return 0;
        const elapsed = (Date.now() / 1000) - player.lastDamageTime;
        if (elapsed < 0 || elapsed > 0.35) return 0;
        return 1 - (elapsed / 0.35);
    }

    function dispose() {
        teardownSandbox();
        initialized = false;
    }

    global.TitleAttract = {
        init: init,
        resize: resize,
        update: update,
        render: render,
        dispose: dispose
    };
})(typeof window !== 'undefined' ? window : globalThis);

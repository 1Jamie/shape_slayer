// Combat system - damage calculation and combat checks

function combatWorld(explicit) {
    if (typeof GameWorld !== 'undefined' && typeof GameWorld.resolveWorld === 'function') {
        return GameWorld.resolveWorld(explicit);
    }
    if (explicit) return explicit;
    return typeof Game !== 'undefined' ? Game : null;
}

// Host → clients: floating damage numbers (display-only on clients)
function hostBroadcastDamageNumber(x, y, damage, options = {}) {
    const world = combatWorld();
    if (!world || !world.multiplayerEnabled) return;
    if (typeof multiplayerManager === 'undefined' || !multiplayerManager || !multiplayerManager.isHost) return;
    multiplayerManager.sendDamageNumber({
        enemyId: options.enemyId || null,
        x,
        y,
        damage,
        isCrit: !!options.isCrit,
        isWeakPoint: !!options.isWeakPoint
    });
}

// Host → clients: particles / lightning / explosions (display-only on clients)
function hostBroadcastCombatFx(fx) {
    const world = combatWorld();
    if (!world || !world.multiplayerEnabled) return;
    if (typeof multiplayerManager === 'undefined' || !multiplayerManager || !multiplayerManager.isHost) return;
    multiplayerManager.sendCombatFx(fx);
}

// --- Weapon-type on-hit policy (0.8.2) ---
function getPlayerWeaponTypeDef(player) {
    if (!player || !player.weapon || !player.weapon.weaponType) return null;
    if (typeof WEAPON_TYPES === 'undefined') return null;
    return WEAPON_TYPES[player.weapon.weaponType] || null;
}

/**
 * Style Engine attack tag for combo variety.
 * Prefer explicit styleTag on the hit source; otherwise infer from hitbox/player state.
 * Untagged sources should stay null so variety stays neutral (no false MONOTONE).
 */
function resolvePlayerStyleTag(player, hitSource) {
    const src = hitSource || {};
    if (src.styleTag) return src.styleTag;
    if (src.isDashAttack || src.dashAttack) return 'dashAttack';
    if (player && player.isDodging) return 'dashAttack';
    if (src.isHeavy || src.type === 'thrust' || src.type === 'hammer') return 'heavy';
    if (src.isSpecial || src.fromSpecial || src.specialAbility) return 'special';
    if (player && player.styleActionTag) return player.styleActionTag;
    if (player && (player.specialActive || player.isUsingSpecial || player.isChannelingSpecial
        || player.beamActive || player.shoutActive || player.isChargingHeavy)) {
        if (player.isChargingHeavy) return 'heavy';
        return 'special';
    }
    // Default player hitboxes / projectiles are primary unless marked otherwise.
    if (src.fromPlayer || src.isPlayerProjectile || src.ownerIsPlayer || src._isPlayerHitbox) {
        return 'primary';
    }
    if (player) return 'primary';
    return null;
}

function stampEnemyStyleTag(enemy, styleTag) {
    if (!enemy || !styleTag) return;
    enemy.lastStyleTag = styleTag;
}

function applyStyleLifeSteal(player, damageDealt) {
    if (!player || !(damageDealt > 0)) return;
    const rate = player.styleLifeSteal
        || (typeof Game !== 'undefined' ? Game.styleLifeSteal : 0)
        || 0;
    if (!(rate > 0)) return;
    const heal = damageDealt * rate;
    // Soft per-hit cap so AoE can't fully refill in one swing.
    const cap = Math.max(4, (player.maxHp || 100) * 0.04);
    const amount = Math.min(heal, cap);
    if (amount <= 0) return;
    player.hp = Math.min(player.maxHp || player.hp, (player.hp || 0) + amount);
}

function getWeaponOnHitPolicy(player) {
    const type = getPlayerWeaponTypeDef(player);
    return (type && type.onHitPolicy) || { status: 'perSwing', proc: 'perSwing', sustain: 'perSwing' };
}

function getWeaponPerHitDamageShare(player) {
    const type = getPlayerWeaponTypeDef(player);
    if (!type) return 1.0;
    return Number.isFinite(type.perHitDamageShare) ? type.perHitDamageShare : 1.0;
}

function getWeaponDualStaggerSec(player) {
    const type = getPlayerWeaponTypeDef(player);
    if (!type || !type.dualStaggerMs) return 0;
    return type.dualStaggerMs / 1000;
}

function getWeaponHitpauseScale(player) {
    const type = getPlayerWeaponTypeDef(player);
    return (type && type.hitpauseScale != null) ? type.hitpauseScale : 1.0;
}

function shouldApplyWeaponStatusOnHit(player, hitbox) {
    const policy = getWeaponOnHitPolicy(player);
    if (policy.status === 'perContact') return true;
    return !hitbox || !hitbox.isParallelSecond;
}

function shouldRollWeaponProcOnHit(player, hitbox) {
    const policy = getWeaponOnHitPolicy(player);
    if (policy.proc === 'perContact') return true;
    return !hitbox || !hitbox.isParallelSecond;
}

function shouldApplyWeaponSustainOnHit(player, hitbox) {
    const policy = getWeaponOnHitPolicy(player);
    if (policy.sustain === 'perContact') return true;
    return !hitbox || !hitbox.isParallelSecond;
}

function getEnemyStableId(enemy) {
    if (!enemy) return null;
    if (enemy.id != null) return enemy.id;
    if (enemy.enemyId != null) return enemy.enemyId;
    return null;
}

function findEnemyByStableId(enemies, id) {
    if (id == null || !enemies) return null;
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e) continue;
        if (e.id === id || e.enemyId === id) return e;
    }
    return null;
}

function isEnemyAliveForParallel(enemy) {
    return !!(enemy && enemy.alive !== false && !enemy.isDead && !enemy.dead && (enemy.hp == null || enemy.hp > 0));
}

function playerWeaponIsParallel(player) {
    if (player && (player.weaponHitCount || 1) >= 2) return true;
    const type = getPlayerWeaponTypeDef(player);
    return !!(type && (type.hitCount || 1) >= 2);
}

/**
 * Half damage on primary + delayed twin projectile for Parallel ranged weapons.
 * Returns twin to push, or null. Mutates projectile damage in place.
 */
function configureParallelPlayerProjectile(player, projectile) {
    if (!player || !projectile || !playerWeaponIsParallel(player)) return null;
    if (projectile.isParallelSecond || projectile.skipParallelTwin) return null;
    const share = getWeaponPerHitDamageShare(player);
    projectile.damage *= share;
    projectile.isParallelPrimary = true;
    const twin = Object.assign({}, projectile);
    twin.isParallelSecond = true;
    twin.isParallelPrimary = false;
    twin.skipParallelTwin = true;
    twin.activateAfter = getWeaponDualStaggerSec(player);
    twin.elapsed = 0;
    twin.hasChainedLegendary = false;
    // Must not share the primary's networked id (clients key projectiles by id)
    delete twin.id;
    if (twin.hitEnemies) delete twin.hitEnemies;
    return twin;
}

function projectileHitboxProxy(projectile) {
    return { isParallelSecond: !!(projectile && projectile.isParallelSecond) };
}

/** Melee / dash / beam reach (Vector: 1.5). */
function getWeaponMeleeReachMult(player) {
    return (player && player.weaponRangeMultiplier) || 1.0;
}

/**
 * Projectile / travel reach. Vector uses the larger of rangeMultiplier and 1+projectileRangeBonus.
 */
function getWeaponProjectileReachMult(player) {
    if (!player) return 1.0;
    const range = player.weaponRangeMultiplier || 1.0;
    const bonus = player.weaponProjectileRangeBonus || 0;
    return Math.max(range, 1 + bonus);
}

function getWeaponKnockbackMult(player) {
    const bonus = (player && player.weaponKnockbackBonus) || 0;
    return 1 + bonus;
}

function tryPerfectInterrupt(player, enemy, hitbox) {
    if (!enemy || !player) return { forcedCrit: false, staggered: false };
    // Strict spool window: active telegraph object or explicit telegraph state / remaining timers
    const telegraphing = !!(enemy.activeTelegraph
        || (enemy.telegraphController && enemy.telegraphController.activeTelegraph)
        || enemy.state === 'telegraph');
    const spooling = telegraphing
        || (enemy.chargeTelegraphRemaining != null && enemy.chargeTelegraphRemaining > 0)
        || (enemy.spinTelegraphRemaining != null && enemy.spinTelegraphRemaining > 0);
    if (!spooling) return { forcedCrit: false, staggered: false };

    // Don't re-trigger interrupt spam on the same telegraph / multi-hitbox swing
    const telegraphKey = enemy.activeTelegraph
        ? (enemy.activeTelegraph.type || 'tele')
        : (enemy.state || 'spool');
    const ikey = `${getEnemyStableId(enemy) || 'e'}_${telegraphKey}`;
    if (enemy._lastPerfectInterruptKey === ikey && (Date.now() - (enemy._lastPerfectInterruptAt || 0)) < 400) {
        return { forcedCrit: false, staggered: false };
    }
    enemy._lastPerfectInterruptKey = ikey;
    enemy._lastPerfectInterruptAt = Date.now();

    const result = { forcedCrit: true, staggered: false };
    const isBossOrElite = !!(enemy.isBoss || enemy.isElite || enemy.eliteAffix);
    const now = Date.now();
    const lockoutMs = 5000;
    if (enemy.lastInterruptTime == null) enemy.lastInterruptTime = 0;

    if (!isBossOrElite || (now - enemy.lastInterruptTime > lockoutMs)) {
        if (typeof enemy.applyStun === 'function') {
            enemy.applyStun(0.75);
        }
        if (typeof enemy.cancelTelegraph === 'function') {
            enemy.cancelTelegraph({ reason: 'perfect_interrupt' });
        } else if (enemy.telegraphController && typeof enemy.telegraphController.cancel === 'function') {
            enemy.telegraphController.cancel({ reason: 'perfect_interrupt' });
        }
        enemy.lastInterruptTime = now;
        result.staggered = true;
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(enemy.x, enemy.y, '#ffe066', 10);
        }
        hostBroadcastCombatFx({
            kind: 'particle_burst',
            x: enemy.x,
            y: enemy.y,
            color: '#ffe066',
            count: 10
        });
        if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
            LedgerManager.recordEvent('perfectInterrupt', { player, enemy, now: Date.now() });
        }
    } else {
        enemy.hyperArmorFlashUntil = now + 250;
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(enemy.x, enemy.y, '#aaaaaa', 6);
        }
        hostBroadcastCombatFx({
            kind: 'particle_burst',
            x: enemy.x,
            y: enemy.y,
            color: '#aaaaaa',
            count: 6
        });
    }
    return result;
}

function grantPerfectDodgeCooldown(player) {
    if (!player) return;
    const usesCharges = typeof player.usesChargeBasedDodge === 'function' && player.usesChargeBasedDodge();
    if (usesCharges && player.dodgeChargeCooldowns && player.dodgeChargeCooldowns.length) {
        // Halve the largest remaining charge cooldown (the one just spent)
        let maxIdx = 0;
        let maxVal = player.dodgeChargeCooldowns[0] || 0;
        for (let i = 1; i < player.dodgeChargeCooldowns.length; i++) {
            const v = player.dodgeChargeCooldowns[i] || 0;
            if (v > maxVal) {
                maxVal = v;
                maxIdx = i;
            }
        }
        if (maxVal > 0) {
            player.dodgeChargeCooldowns[maxIdx] = maxVal * 0.5;
        }
        if (typeof player.getNextChargeReadyTime === 'function') {
            player.dodgeCooldown = player.getNextChargeReadyTime(player.dodgeChargeCooldowns);
        }
        let ready = 0;
        for (let i = 0; i < player.dodgeChargeCooldowns.length; i++) {
            if ((player.dodgeChargeCooldowns[i] || 0) <= 0) ready++;
        }
        player.dodgeCharges = ready;
    } else if (player.dodgeCooldown > 0) {
        player.dodgeCooldown *= 0.5;
        if (player.dodgeChargeCooldowns && player.dodgeChargeCooldowns.length > 0) {
            player.dodgeChargeCooldowns[0] = player.dodgeCooldown;
        }
    }
    if (typeof createParticleBurst !== 'undefined') {
        createParticleBurst(player.x, player.y, '#66ffcc', 8);
    }
    hostBroadcastCombatFx({
        kind: 'particle_burst',
        x: player.x,
        y: player.y,
        color: '#66ffcc',
        count: 8
    });
}

function tryRegisterPerfectDodge(player, enemy, playerId) {
    if (!player || !enemy) return;
    // Only active dodge frames count - not post-hit / post-dodge invuln leftovers
    if (!player.isDodging) return;
    const threatActive = enemy.state === 'dash' || enemy.state === 'lunge' || enemy.state === 'spin'
        || enemy.state === 'charge' || enemy.state === 'slam' || enemy.state === 'telegraph'
        || !!enemy.activeTelegraph
        || (enemy.chargeTelegraphRemaining != null && enemy.chargeTelegraphRemaining > 0)
        || (enemy.spinTelegraphRemaining != null && enemy.spinTelegraphRemaining > 0)
        || (enemy.attacking === true);
    if (!threatActive) return;
    if (!player._perfectDodgeThreatKeys) player._perfectDodgeThreatKeys = new Set();
    const key = `${getEnemyStableId(enemy) || enemy.x}_${enemy.state || 'atk'}`;
    if (player._perfectDodgeThreatKeys.has(key)) return;
    player._perfectDodgeThreatKeys.add(key);
    // Clear stale keys periodically
    if (player._perfectDodgeThreatKeys.size > 32) player._perfectDodgeThreatKeys.clear();

    grantPerfectDodgeCooldown(player);
    if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
        LedgerManager.recordEvent('perfectDodge', { player, enemy, now: Date.now() });
    }
}

// Circle collision detection helper
function checkCircleCollision(x1, y1, r1, x2, y2, r2) {
    return Engine.Physics.Geometry.circlesOverlap(x1, y1, r1, x2, y2, r2);
}

function getEnemyCollisionBodies(enemy) {
    if (enemy && typeof enemy.getDamageCollisionBodies === 'function') {
        return enemy.getDamageCollisionBodies();
    }
    if (!enemy) return [];
    return [{ x: enemy.x, y: enemy.y, radius: enemy.size }];
}

function checkEnemyCircleCollision(attackX, attackY, attackRadius, enemy) {
    const bodies = getEnemyCollisionBodies(enemy);
    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (checkCircleCollision(attackX, attackY, attackRadius, body.x, body.y, body.radius)) {
            return { hit: true, hitX: body.x, hitY: body.y, radius: body.radius, part: body.part };
        }
    }
    return { hit: false, hitX: enemy.x, hitY: enemy.y, radius: enemy.size };
}

function resolveEnemyAttackHit(attackX, attackY, attackRadius, enemy) {
    const bodyHit = checkEnemyCircleCollision(attackX, attackY, attackRadius, enemy);
    let hitWeakPoint = false;

    if (enemy.isBoss && typeof enemy.checkWeakPointHit === 'function') {
        hitWeakPoint = !!enemy.checkWeakPointHit(attackX, attackY, attackRadius);
    }

    if (!bodyHit.hit && hitWeakPoint && enemy.weakPoints && enemy.weakPoints.length > 0) {
        const wp = enemy.weakPoints[0];
        return {
            hit: true,
            hitWeakPoint: true,
            hitX: enemy.x + (wp.offsetX || 0),
            hitY: enemy.y + (wp.offsetY || 0),
            radius: wp.hitRadius || wp.radius || 8,
            part: 'core'
        };
    }

    return {
        hit: bodyHit.hit,
        hitWeakPoint,
        hitX: bodyHit.hitX,
        hitY: bodyHit.hitY,
        radius: bodyHit.radius,
        part: bodyHit.part
    };
}

function getEnemyBeamHit(enemy, origin, dirX, dirY, beamRange, beamWidth) {
    const bodies = getEnemyCollisionBodies(enemy);
    let best = null;
    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const dx = body.x - origin.x;
        const dy = body.y - origin.y;
        const projection = dx * dirX + dy * dirY;
        if (projection < 0 || projection > beamRange) continue;
        const perpX = dx - projection * dirX;
        const perpY = dy - projection * dirY;
        const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
        if (perpDist <= beamWidth / 2 + body.radius) {
            if (!best || projection < best.distance) {
                best = { distance: projection, hitX: body.x, hitY: body.y };
            }
        }
    }
    return best;
}

// Resolve positional overlap between an enemy and a player by pushing the enemy out
function resolveEnemyPlayerOverlap(enemy, player, extraBuffer = 0) {
    if (!enemy || !player) return;

    // Skip separation when either side is in a state that intentionally permits overlap (e.g., dodge roll, lunge)
    const playerAllowsOverlap =
        (player.isDodging === true) ||
        (typeof player.isInSpecialMovement === 'function' && player.isInSpecialMovement());
    
    const enemyState = enemy.state || null;
    const isSwarmKingDash = enemy.bossName === 'Swarm King' && (enemyState === 'dash' || enemy.isDashing);

    if (isSwarmKingDash) {
        const playerRadius = player.collisionRadius || player.size || 20;
        const enemyRadius = enemy.collisionRadius || enemy.size || 20;
        const minimumSeparation = playerRadius + enemyRadius + extraBuffer;

        let dx = player.x - enemy.x;
        let dy = player.y - enemy.y;
        let distanceSq = dx * dx + dy * dy;

        if (distanceSq === 0) {
            const angle = Math.random() * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distanceSq = 1;
        }

        const distance = Math.sqrt(distanceSq);
        if (distance >= minimumSeparation) {
            return;
        }

        const overlap = minimumSeparation - distance;
        const normalX = dx / distance;
        const normalY = dy / distance;
        const pushDistance = overlap;

        player.x += normalX * pushDistance;
        player.y += normalY * pushDistance;

        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.layout && typeof RoomLayoutGenerator !== 'undefined') {
            player.x = clamp(player.x, player.size, currentRoom.width - player.size);
            player.y = clamp(player.y, player.size, currentRoom.height - player.size);
            const resolved = RoomLayoutGenerator.resolveCircleCollision(
                currentRoom.layout,
                player.x,
                player.y,
                player.size,
                player.lastSafeX || player.x,
                player.lastSafeY || player.y
            );
            player.x = resolved.x;
            player.y = resolved.y;
        }
        return;
    }

    const enemyAllowsOverlap =
        enemy.allowOverlapDuringAbility === true ||
        (enemyState && ['dash', 'charge', 'slam'].includes(enemyState));
    
    if (playerAllowsOverlap || enemyAllowsOverlap) {
        return;
    }

    const playerRadius = player.collisionRadius || player.size || 20;
    const enemyRadius = enemy.collisionRadius || enemy.size || 20;
    const minimumSeparation = playerRadius + enemyRadius + extraBuffer;

    let dx = enemy.x - player.x;
    let dy = enemy.y - player.y;
    let distanceSq = dx * dx + dy * dy;

    if (distanceSq === 0) {
        const angle = Math.random() * Math.PI * 2;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distanceSq = 1;
    }

    const distance = Math.sqrt(distanceSq);
    if (distance >= minimumSeparation) {
        return;
    }

    const overlap = minimumSeparation - distance;
    const normalX = dx / distance;
    const normalY = dy / distance;
    const pushDistance = overlap;

    enemy.x += normalX * pushDistance;
    enemy.y += normalY * pushDistance;

    if (typeof enemy.keepInBounds === 'function') {
        enemy.keepInBounds();
    }

    if (enemy.vx !== undefined && enemy.vy !== undefined) {
        const relativeSpeed = enemy.vx * normalX + enemy.vy * normalY;
        if (relativeSpeed < 0) {
            enemy.vx -= relativeSpeed * normalX;
            enemy.vy -= relativeSpeed * normalY;
        }
    }

    if (enemy.impulseVx !== undefined && enemy.impulseVy !== undefined) {
        const relativeKnockback = enemy.impulseVx * normalX + enemy.impulseVy * normalY;
        if (relativeKnockback < 0) {
            enemy.impulseVx -= relativeKnockback * normalX;
            enemy.impulseVy -= relativeKnockback * normalY;
        }
    } else if (enemy.knockbackVx !== undefined && enemy.knockbackVy !== undefined) {
        const relativeKnockback = enemy.knockbackVx * normalX + enemy.knockbackVy * normalY;
        if (relativeKnockback < 0) {
            enemy.knockbackVx -= relativeKnockback * normalX;
            enemy.knockbackVy -= relativeKnockback * normalY;
        }
    }
}

// Get a projected damage point in front of an enemy so contact damage applies without overlapping the player
function getEnemyDamagePoint(enemy, targetPlayer = null) {
    if (!enemy) {
        return { x: 0, y: 0, radius: 10 };
    }
    
    const enemyRadius = enemy.collisionRadius || enemy.size || 20;
    const projectionMultiplier = enemy.damageProjectionMultiplier || 0.9; // Distance out from enemy center
    const projectedRadius = enemy.damageProjectionRadius || Math.max(8, enemyRadius * 0.7);
    
    let dirX = 0;
    let dirY = 0;
    
    // Primary: use facing rotation if available
    if (typeof enemy.rotation === 'number') {
        dirX = Math.cos(enemy.rotation);
        dirY = Math.sin(enemy.rotation);
    }
    
    // Fallback: use velocity vector
    if (dirX === 0 && dirY === 0 && enemy.vx !== undefined && enemy.vy !== undefined) {
        const speedSq = enemy.vx * enemy.vx + enemy.vy * enemy.vy;
        if (speedSq > 0.001) {
            const speed = Math.sqrt(speedSq);
            dirX = enemy.vx / speed;
            dirY = enemy.vy / speed;
        }
    }
    
    // Fallback: aim directly at target player
    if ((dirX === 0 && dirY === 0) && targetPlayer) {
        const dx = targetPlayer.x - enemy.x;
        const dy = targetPlayer.y - enemy.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0.001) {
            const dist = Math.sqrt(distSq);
            dirX = dx / dist;
            dirY = dy / dist;
        }
    }
    
    // Final fallback: point to the right
    if (dirX === 0 && dirY === 0) {
        dirX = 1;
        dirY = 0;
    }
    
    const projectionDistance = enemyRadius * projectionMultiplier;
    
    return {
        x: enemy.x + dirX * projectionDistance,
        y: enemy.y + dirY * projectionDistance,
        radius: projectedRadius
    };
}

// Calculate final damage with all modifiers
function calculateDamage(baseDamage, gearMultiplier = 1, defense = 0, critMultiplier = 1) {
    const mitigatedDamage = baseDamage * gearMultiplier * (1 - defense);
    return mitigatedDamage * critMultiplier;
}

// Lifesteal tuning - cleave/multi-hitbox attacks previously procced once per hitbox.
const LIFESTEAL_CONFIG = {
    // Flat cap: high lifesteal % must not raise the heal ceiling.
    baseCapPercentMaxHpPerSec: 0.010,
    capScalePerLifestealPoint: 0,
    absoluteCapPercentMaxHpPerSec: 0.012,
    bossHealMultiplier: 0.30,
    // Stacked affixes above soft cap lose efficiency (11% gear → ~7.1% effective).
    statSoftCap: 0.05,
    excessStatEfficiency: 0.35,
    sourceMultipliers: {
        melee: 1.0,
        hammer: 1.0,
        hammerHeal: 1.0,
        shout: 0.50,
        whirlwind: 0.15,
        beam: 0.30,
        chain: 0.40,
        aoe: 0.25,
        projectile: 0.85,
        ability: 0.70,
        lifeOnCrit: 0.80
    }
};

const FORTIFY_CONFIG = {
    maxShieldPercentMaxHp: 0.10,
    maxGainPercentMaxHpPerSec: 0.012,
    bossGainMultiplier: 0.40
};

function getLifestealEnemyKey(enemy) {
    if (!enemy) return null;
    return enemy.enemyId || enemy.id || enemy.bossName || `${Math.round(enemy.x)}:${Math.round(enemy.y)}`;
}

function getEffectiveLifestealRate(player) {
    const raw = Math.max(0, player.lifesteal || 0);
    const softCap = LIFESTEAL_CONFIG.statSoftCap;
    const excessEff = LIFESTEAL_CONFIG.excessStatEfficiency;
    if (raw <= softCap) return raw;
    return softCap + (raw - softCap) * excessEff;
}

function getLifestealHealCapPerSec(player) {
    if (!player || !player.maxHp) return 0;
    const capRate = Math.min(
        LIFESTEAL_CONFIG.baseCapPercentMaxHpPerSec,
        LIFESTEAL_CONFIG.absoluteCapPercentMaxHpPerSec
    );
    return player.maxHp * capRate;
}

function getSustainSourceMultiplier(source) {
    if (!source) return 1;
    const mult = LIFESTEAL_CONFIG.sourceMultipliers[source];
    return mult != null ? mult : 1;
}

function applyBossSustainPenalty(healAmount, enemy, respectBossPenalty) {
    if (respectBossPenalty !== false && enemy && enemy.isBoss) {
        return healAmount * LIFESTEAL_CONFIG.bossHealMultiplier;
    }
    return healAmount;
}

function beginLifestealAttackSwing(player) {
    if (!player) return;
    player._lifestealSwingId = (player._lifestealSwingId || 0) + 1;
}

const MELEE_SWING_SUSTAIN_SOURCES = new Set(['melee', 'hammer', 'shout', 'hammerHeal']);

function registerSustainProc(player, options = {}) {
    const enemy = options.enemy;
    if (!enemy) return false;

    const enemyKey = getLifestealEnemyKey(enemy);
    if (!enemyKey) return false;

    let procKey = null;
    const source = options.source || 'melee';

    if (options.pulseKey != null) {
        procKey = `pulse:${options.pulseKey}:${enemyKey}`;
    } else if (options.batchId != null) {
        procKey = `batch:${options.batchId}:${enemyKey}`;
    } else if (MELEE_SWING_SUSTAIN_SOURCES.has(source)) {
        procKey = `swing:${player._lifestealSwingId || 0}:${enemyKey}`;
    }

    if (!procKey) return false;

    if (!player._sustainProcs) player._sustainProcs = {};
    if (player._sustainProcs[procKey]) return true;
    player._sustainProcs[procKey] = true;
    if (Object.keys(player._sustainProcs).length > 128) {
        player._sustainProcs = { [procKey]: true };
    }
    return false;
}

function applySustainHeal(player, healAmount, options = {}) {
    const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
    if (isClient) return 0;
    if (!player || !Number.isFinite(healAmount) || healAmount <= 0) return 0;

    const enemy = options.enemy || null;
    if (registerSustainProc(player, options)) return 0;

    healAmount = applyBossSustainPenalty(healAmount, enemy, options.respectBossPenalty);

    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    if (!player._lifestealHealBudget) {
        player._lifestealHealBudget = { windowStart: now, healed: 0 };
    }
    const budget = player._lifestealHealBudget;
    if (now - budget.windowStart >= 1.0) {
        budget.windowStart = now;
        budget.healed = 0;
    }
    const remaining = Math.max(0, getLifestealHealCapPerSec(player) - budget.healed);
    healAmount = Math.min(healAmount, remaining);
    if (healAmount <= 0) return 0;

    budget.healed += healAmount;
    player.hp = Math.min(player.hp + healAmount, player.maxHp);

    if (options.showHealNumber && typeof createHealNumber !== 'undefined') {
        createHealNumber(player.x, player.y, healAmount);
    }

    return healAmount;
}

function applyLifesteal(player, damageDealt, options = {}) {
    if (!player || !player.lifesteal || player.lifesteal <= 0) return 0;
    if (!Number.isFinite(damageDealt) || damageDealt <= 0) return 0;

    const source = options.source || 'melee';
    let healAmount = damageDealt * getEffectiveLifestealRate(player);
    healAmount *= getSustainSourceMultiplier(source);

    return applySustainHeal(player, healAmount, {
        ...options,
        source,
        respectBossPenalty: true
    });
}

function applyFortifyGain(player, damageDealt, options = {}) {
    const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
    if (isClient) return 0;
    if (!player || !player.fortifyPercent || player.fortifyPercent <= 0) return 0;
    if (!Number.isFinite(damageDealt) || damageDealt <= 0 || !player.maxHp) return 0;

    let gain = damageDealt * player.fortifyPercent;
    if (options.enemy && options.enemy.isBoss) {
        gain *= FORTIFY_CONFIG.bossGainMultiplier;
    }

    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    if (!player._fortifyGainBudget) {
        player._fortifyGainBudget = { windowStart: now, gained: 0 };
    }
    const budget = player._fortifyGainBudget;
    if (now - budget.windowStart >= 1.0) {
        budget.windowStart = now;
        budget.gained = 0;
    }
    const maxGainPerSec = player.maxHp * FORTIFY_CONFIG.maxGainPercentMaxHpPerSec;
    const remaining = Math.max(0, maxGainPerSec - budget.gained);
    gain = Math.min(gain, remaining);
    if (gain <= 0) return 0;

    budget.gained += gain;
    const maxPool = player.maxHp * FORTIFY_CONFIG.maxShieldPercentMaxHp;
    player.fortifyShield = Math.min(maxPool, (player.fortifyShield || 0) + gain);
    player.fortifyShieldDecay = 0.1;
    return gain;
}

function applyHammerHeal(player, damageDealt, options = {}) {
    if (!player || player.playerClass !== 'pentagon') return 0;
    if (!Number.isFinite(damageDealt) || damageDealt <= 0) return 0;
    const baseHealPercent = typeof TANK_CONFIG !== 'undefined' ? TANK_CONFIG.hammerHealOnHit : 0.075;
    const healPercent = baseHealPercent + (player.hammerHealBonus || 0);
    const healed = applySustainHeal(player, damageDealt * healPercent, {
        ...options,
        source: 'hammerHeal',
        showHealNumber: true
    });
    if (healed > 0 && typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
        LedgerManager.recordEvent('hammerLifesteal', {
            healed,
            maxHp: player.maxHp,
            player
        });
    }
    return healed;
}

function applyLifeOnCritHeal(player, damageDealt, lifeOnCritRate, options = {}) {
    if (!player || !lifeOnCritRate || lifeOnCritRate <= 0) return 0;
    if (!Number.isFinite(damageDealt) || damageDealt <= 0) return 0;
    let healAmount = damageDealt * lifeOnCritRate;
    healAmount *= getSustainSourceMultiplier('lifeOnCrit');
    return applySustainHeal(player, healAmount, {
        ...options,
        source: 'lifeOnCrit',
        respectBossPenalty: true
    });
}

function getMeleeHitboxSustainSource(hitbox) {
    if (!hitbox) return 'melee';
    if (hitbox.type === 'hammer') return 'hammer';
    if (hitbox.type === 'shout') return 'shout';
    return 'melee';
}

// Apply legendary effects to an enemy (host/solo only)
function applyLegendaryEffects(player, enemy, damageDealt, attackerId) {
    // Only apply on host/solo (not clients)
    const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
    if (isClient) return;
    
    if (!player || !player.activeLegendaryEffects || !enemy) return;
    // Parallel contact-2 may still apply status legendaries when policy is perContact;
    // callers should pass hitbox via options when available - default allow.
    
    player.activeLegendaryEffects.forEach(effect => {
        if (effect.type === 'incendiary') {
            // Apply burn DoT
            if (enemy.applyBurn) {
                const burnDPS = damageDealt * effect.burnDPS; // DPS as percentage of damage dealt
                enemy.applyBurn(burnDPS, effect.burnDuration, attackerId);
            }
        } else if (effect.type === 'freezing') {
            // Apply slow with chance
            if (enemy.applySlow && Math.random() < effect.slowChance) {
                enemy.applySlow(effect.slowAmount, effect.slowDuration);
            }
        } else if (effect.type === 'chain_lightning') {
            // Note: chain lightning is applied separately from this function
            // to prevent duplicate chains (controlled by hasChained flags)
        }
    });
}

// Check attacks vs enemies and handle collisions
function checkAttacksVsEnemies(player, enemies, playerId = null) {
    const perHitShare = getWeaponPerHitDamageShare(player);
    const dualStagger = getWeaponDualStaggerSec(player);
    const isDual = (player.weaponHitCount || 1) >= 2 && dualStagger > 0;

    // Parallel: only ONE hitbox per swing runs contact-2 (warrior cleave has multiple boxes)
    let parallelPrimaryHitbox = null;
    if (isDual && player.attackHitboxes && player.attackHitboxes.length) {
        for (let i = 0; i < player.attackHitboxes.length; i++) {
            const hb = player.attackHitboxes[i];
            if (hb && !hb.parallelSuppressContact2) {
                parallelPrimaryHitbox = hb;
                break;
            }
        }
        for (let i = 0; i < player.attackHitboxes.length; i++) {
            const hb = player.attackHitboxes[i];
            if (!hb || hb === parallelPrimaryHitbox) continue;
            hb.parallelSuppressContact2 = true;
            hb.parallelSecondFired = true; // never fire contact-2 on secondary cleave boxes
            if (hb.parallelCachedIds == null) hb.parallelCachedIds = [];
        }
    }

    player.attackHitboxes.forEach((hitbox) => {
        // Initialize hitEnemies set if it doesn't exist (for existing hitboxes created before this change)
        if (!hitbox.hitEnemies) {
            hitbox.hitEnemies = new Set();
        }
        
        // Store original damage for pierce calculations (if not already stored)
        if (!hitbox.originalDamage) {
            // Parallel: each contact deals perHitDamageShare of swing damage
            const share = ((player.weaponHitCount || 1) >= 2) ? perHitShare : 1.0;
            hitbox.originalDamage = hitbox.damage * share;
            hitbox.damage = hitbox.originalDamage;
        }
        if (isDual && hitbox.parallelCachedIds == null) {
            hitbox.parallelCachedIds = [];
            hitbox.parallelSecondFired = !!hitbox.parallelSuppressContact2;
            hitbox.isParallelSecond = false;
        }

        // Parallel contact 2: cached IDs only (alive check); no fresh spatial query
        // Only primary hitbox fires contact-2 to avoid cleave × dual multiplicative damage
        if (isDual && hitbox === parallelPrimaryHitbox && !hitbox.parallelSecondFired
            && hitbox.elapsed >= dualStagger && hitbox.parallelCachedIds.length > 0) {
            hitbox.parallelSecondFired = true;
            hitbox.isParallelSecond = true;
            hitbox.hitEnemies = new Set();
            hitbox.parallelCachedIds.forEach(id => {
                const enemy = findEnemyByStableId(enemies, id);
                if (!isEnemyAliveForParallel(enemy)) return;
                processMeleeHitOnEnemy(player, enemies, hitbox, enemy, playerId);
            });
            hitbox.isParallelSecond = false;
        }
        
        enemies.forEach(enemy => {
            if (!enemy.alive || hitbox.hitEnemies.has(enemy)) return;
            if (enemy.phasingActive) return;
            
            // Check body collision first (supports multi-part bosses and exposed weak points)
            const bodyHit = resolveEnemyAttackHit(hitbox.x, hitbox.y, hitbox.radius, enemy);
            const bodyCollision = bodyHit.hit;
            
            if (bodyCollision) {
                processMeleeHitOnEnemy(player, enemies, hitbox, enemy, playerId, bodyHit);
                // Aggregate cache onto primary hitbox so contact-2 covers whole cleave swing
                if (isDual && !hitbox.parallelSecondFired) {
                    const sid = getEnemyStableId(enemy);
                    const cacheHb = parallelPrimaryHitbox || hitbox;
                    if (sid != null && cacheHb.parallelCachedIds
                        && cacheHb.parallelCachedIds.indexOf(sid) === -1) {
                        cacheHb.parallelCachedIds.push(sid);
                    }
                }
            }
        });
    });
}

function processMeleeHitOnEnemy(player, enemies, hitbox, enemy, playerId, bodyHit) {
                if (!hitbox.hitEnemies) hitbox.hitEnemies = new Set();
                if (hitbox.hitEnemies.has(enemy)) return;
                const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
                if (!bodyHit) {
                    bodyHit = resolveEnemyAttackHit(hitbox.x, hitbox.y, hitbox.radius, enemy);
                }
                // Check for weak point hit (for bosses only)
                let hitWeakPoint = bodyHit.hitWeakPoint;
                if (!hitWeakPoint && enemy.isBoss && enemy.checkWeakPointHit) {
                    const weakPoint = enemy.checkWeakPointHit(hitbox.x, hitbox.y, hitbox.radius);
                    hitWeakPoint = !!weakPoint;
                }
                
                // Check for backstab (Rogue passive: player must be behind enemy)
                let isBackstab = false;
                if (player.playerClass === 'triangle') {
                    // Calculate vector from enemy to player
                    const enemyToPlayerX = player.x - enemy.x;
                    const enemyToPlayerY = player.y - enemy.y;
                    const enemyToPlayerDist = Math.sqrt(enemyToPlayerX * enemyToPlayerX + enemyToPlayerY * enemyToPlayerY);
                    
                    if (enemyToPlayerDist > 0) {
                        // Normalize enemy-to-player vector
                        const enemyToPlayerNormX = enemyToPlayerX / enemyToPlayerDist;
                        const enemyToPlayerNormY = enemyToPlayerY / enemyToPlayerDist;
                        
                        // Enemy forward direction
                        const enemyForwardX = Math.cos(enemy.rotation);
                        const enemyForwardY = Math.sin(enemy.rotation);
                        
                        // Dot product: negative means player is behind enemy
                        const dot = enemyToPlayerNormX * enemyForwardX + enemyToPlayerNormY * enemyForwardY;
                        isBackstab = dot < 0; // Player is behind enemy
                    }
                }
                
                const interrupt = tryPerfectInterrupt(player, enemy, hitbox);

                // Apply crit multiplier if applicable
                let critMultiplier = 1.0;
                let isCrit = false;
                const styleCrit = player.styleCritBonus || 0;
                const effectiveCrit = (player.critChance || 0) + styleCrit;
                if (hitbox.crit || interrupt.forcedCrit || (shouldRollWeaponProcOnHit(player, hitbox) && effectiveCrit && Math.random() < effectiveCrit)) {
                    critMultiplier = 2.0 * (player.critDamageMultiplier || 1.0); // Use affix crit damage
                    hitbox.displayCrit = true;
                    isCrit = true;
                }
                
                // Precision card bonuses: lifeOnCrit and vulnOnCrit (Purple/Orange) - applied after damage calculation
                // Note: We'll apply these after finalDamage is calculated so we can use the correct damage value
                
                const cardMultiplier = 1.0;

                // Apply pierce damage reduction if this is a pierced hit
                let pierceDamageMultiplier = 1.0;
                const enemiesHitBefore = hitbox.hitEnemies ? hitbox.hitEnemies.size : 0;
                if (enemiesHitBefore > 0) {
                    // This is a pierced hit (not the first enemy)
                    if (player.itemPierceDamagePercent > 0) {
                        // Use item pierce damage percent (80% for second target, etc.)
                        pierceDamageMultiplier = player.itemPierceDamagePercent;
                    } else {
                        // Default: 25% damage reduction per pierce
                        const damageReduction = 0.25 * enemiesHitBefore;
                        pierceDamageMultiplier = Math.max(0, 1 - damageReduction);
                    }
                }
                
                // Calculate final damage with backstab and crit multipliers
                let finalDamage = hitbox.originalDamage * pierceDamageMultiplier * critMultiplier * cardMultiplier;
                
                // Apply vulnerability debuff multiplier (Precision Orange bonus)
                if (enemy.vulnerable && enemy.vulnerabilityMultiplier && enemy.vulnerabilityMultiplier > 1.0) {
                    finalDamage *= enemy.vulnerabilityMultiplier;
                }
                
                if (isBackstab) {
                    const backstabMultiplier = 2 + (player.backstabMultiplierBonus || 0); // Apply class modifier
                    finalDamage *= backstabMultiplier;
                    
                    // Track backstab damage for lifetime stats (track the extra damage from backstab)
                    if (!isClient && typeof window.trackLifetimeStat === 'function') {
                        const backstabExtraDamage = hitbox.damage * critMultiplier * cardMultiplier * (backstabMultiplier - 1);
                        window.trackLifetimeStat('totalBackstabDamage', backstabExtraDamage);
                    }
                }
                
                // Legacy execute bonus
                if (player.executeBonus && player.executeBonus > 0) {
                    const hpPercent = enemy.hp / (enemy.maxHp || enemy.hp);
                    if (hpPercent < 0.3) {
                        finalDamage *= (1 + player.executeBonus);
                        hitbox.displayExecute = true;
                    }
                }
                
                // Executioner's Mark: bonus damage to low HP enemies
                if (player.itemExecuteDamagePercent > 0 && player.itemExecuteThreshold > 0) {
                    const hpPercent = (enemy.hp / (enemy.maxHp || enemy.hp)) * 100;
                    if (hpPercent <= player.itemExecuteThreshold) {
                        finalDamage *= (1 + player.itemExecuteDamagePercent / 100);
                        hitbox.displayExecute = true;
                    }
                }
                
                // Rampage bonus: apply stacking damage
                if (player.rampageStacks && player.rampageStacks > 0 && player.rampageBonus) {
                    const rampageMultiplier = 1 + (player.rampageStacks * player.rampageBonus);
                    finalDamage *= rampageMultiplier;
                }
                
                // Get attacker ID for aggro system
                // Use provided playerId (for remote players) or fall back to local player ID
                const attackerId = playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);
                
                // Only apply damage if we're the host or in solo mode
                // Clients send damage events and wait for host's authoritative response
                
                // Calculate actual damage dealt BEFORE applying damage (accounting for weak point multiplier)
                const weakPointMultiplier = enemy.weakPointDamageMultiplier || 3;
                let damageDealt = hitWeakPoint ? finalDamage * weakPointMultiplier : finalDamage;
                // Don't cap by enemy.hp on clients since they don't have authoritative HP
                if (!isClient) {
                    damageDealt = Math.min(damageDealt, enemy.hp);
                }

                // Multiplayer clients apply boss hit shake locally (host applies via takeDamage).
                if (isClient && enemy.isBoss && typeof enemy.triggerBossHitScreenShake === 'function') {
                    const localId = typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
                    const attackerId = playerId || localId;
                    if (!attackerId || attackerId === localId) {
                        enemy.triggerBossHitScreenShake(damageDealt, { weakPoint: hitWeakPoint });
                    }
                }
                
                if (!isClient) {
                    // Host or solo: Apply damage locally
                    let vArchetype = 'slash';
                    if (hitbox.type === 'shout') vArchetype = 'blast';
                    else if (hitbox.type === 'hammer') vArchetype = 'slash';
                    else if (hitbox.type === 'knife' || hitbox.pierce) vArchetype = 'pierce';
                    else if (hitbox.type === 'magic' || hitbox.type === 'beam') vArchetype = 'magic';
                    else if (hitbox.displayCrit) vArchetype = 'blast';
                    enemy._lastHitIsCrit = !!hitbox.displayCrit;

                    // Ensure hitboxes are tagged for Style variety (lingering / delayed hits keep origin tag).
                    if (!hitbox.styleTag) {
                        hitbox.styleTag = resolvePlayerStyleTag(player, hitbox);
                        hitbox._isPlayerHitbox = true;
                    }
                    stampEnemyStyleTag(enemy, hitbox.styleTag);

                    if (enemy.isBoss && typeof enemy.takeDamage === 'function') {
                        enemy.takeDamage(finalDamage, hitbox.x, hitbox.y, hitbox.radius, attackerId, vArchetype);
                    } else {
                        enemy.takeDamage(finalDamage, attackerId, hitbox.x, hitbox.y, vArchetype);
                    }

                    applyStyleLifeSteal(player, finalDamage);
                    
                    // Bleeding Edge: Apply bleed debuff on hit
                    if (shouldApplyWeaponStatusOnHit(player, hitbox) && player.itemBleedDamagePercent > 0 && enemy && typeof enemy.applyDebuff === 'function') {
                        const enemyMaxHp = enemy.maxHp || enemy.hp;
                        const bleedDPS = enemyMaxHp * (player.itemBleedDamagePercent / 100);
                        enemy.applyDebuff({
                            type: 'bleed',
                            dps: bleedDPS,
                            duration: player.itemBleedDuration,
                            attackerId: attackerId,
                            maxStacks: player.itemBleedMaxStacks
                        });
                        // Visual feedback for bleed application
                        if (typeof createParticleBurst !== 'undefined') {
                            createParticleBurst(enemy.x, enemy.y, '#ff0000', 5);
                        }
                        hostBroadcastCombatFx({
                            kind: 'particle_burst',
                            x: enemy.x,
                            y: enemy.y,
                            color: '#ff0000',
                            count: 5
                        });
                    }
                    
                    // Volatile Core: Chance to explode on hit
                    if (shouldRollWeaponProcOnHit(player, hitbox) && player.itemVolatileChance > 0 && Math.random() < player.itemVolatileChance) {
                        const explosionDamage = damageDealt * (player.itemVolatileDamagePercent / 100);
                        const explosionRadius = player.itemVolatileRadius;
                        
                        // Find nearby enemies and damage them
                        enemies.forEach(nearbyEnemy => {
                            if (!nearbyEnemy || !nearbyEnemy.alive || nearbyEnemy === enemy) return;
                            
                            const dx = nearbyEnemy.x - enemy.x;
                            const dy = nearbyEnemy.y - enemy.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            if (distance <= explosionRadius) {
                                nearbyEnemy.takeDamage(explosionDamage, attackerId);
                                
                                // Visual feedback
                                if (typeof createDamageNumber !== 'undefined') {
                                    createDamageNumber(nearbyEnemy.x, nearbyEnemy.y, Math.floor(explosionDamage), false, false);
                                }
                                hostBroadcastDamageNumber(nearbyEnemy.x, nearbyEnemy.y, explosionDamage, {
                                    enemyId: nearbyEnemy.id
                                });
                            }
                        });
                        
                        // Visual feedback for explosion
                        if (typeof createParticleBurst !== 'undefined') {
                            createParticleBurst(enemy.x, enemy.y, '#ff6600', 15);
                            createParticleBurst(enemy.x, enemy.y, '#ff9900', 10);
                        }
                        hostBroadcastCombatFx({
                            kind: 'explosion',
                            x: enemy.x,
                            y: enemy.y,
                            color: '#ff6600',
                            radius: explosionRadius,
                            count: 15
                        });
                    }
                    
                }
                
                if (!isClient && typeof Telemetry !== 'undefined' && attackerId) {
                    const enemyId = enemy.enemyId || enemy.id || enemy.bossName || enemy.type || null;
                    const enemyType = enemy.isBoss ? 'boss' : (enemy.type || (enemy.constructor && enemy.constructor.name) || 'enemy');
                    const roomNumber = typeof Game !== 'undefined' && typeof Game.roomNumber === 'number'
                        ? Game.roomNumber
                        : null;
                    
                    Telemetry.recordDamage({
                        playerId: attackerId,
                        amount: damageDealt,
                        enemyId,
                        enemyType,
                        roomNumber,
                        isBoss: !!enemy.isBoss
                    });
                }
                
                // Apply hammer-specific effects (knockback and stun)
                if (hitbox.type === 'hammer') {
                    // Calculate knockback direction (away from player center)
                    const knockbackDx = enemy.x - player.x;
                    const knockbackDy = enemy.y - player.y;
                    const knockbackDist = Math.sqrt(knockbackDx * knockbackDx + knockbackDy * knockbackDy);
                    
                    if (knockbackDist > 0) {
                        const weaponKb = typeof getWeaponKnockbackMult === 'function' ? getWeaponKnockbackMult(player) : 1.0;
                        const hammerKb = player.hammerKnockbackMultiplier || 1.0;
                        // Cap the combined multiplier to 2.5x so stacked affixes/cards don't send enemies across the map
                        const combinedMult = Math.min((player.knockbackMultiplier || 1.0) * weaponKb * hammerKb, 2.5);
                        const knockbackForce = 68 * combinedMult;
                        const knockbackX = (knockbackDx / knockbackDist) * knockbackForce;
                        const knockbackY = (knockbackDy / knockbackDist) * knockbackForce;
                        const sourceId = player.playerId || player.id || attackerId || null;
                        if (typeof enemy.applyImpulse === 'function') {
                            enemy.applyImpulse(knockbackX, knockbackY, { sourceId });
                        } else if (typeof enemy.applyKnockback === 'function') {
                            enemy.applyKnockback(knockbackX, knockbackY, sourceId);
                        }
                    }
                    
                    // Apply light stun (0.5-0.8 seconds)
                    const stunDuration = 0.65;
                    enemy.applyStun(stunDuration);
                    
                    // Tank heal on hit (host/solo only) - shares sustain cap with lifesteal
                    if (!isClient && shouldApplyWeaponSustainOnHit(player, hitbox) && player.playerClass === 'pentagon') {
                        applyHammerHeal(player, damageDealt, { enemy });
                    }
                }

                // Weapon-feel hitpause: first connect of the swing only (~1 frame, weapon-scaled)
                if (!isClient && !hitbox.isParallelSecond && enemiesHitBefore === 0
                    && typeof Game !== 'undefined' && typeof Game.triggerHitPause === 'function') {
                    const scale = getWeaponHitpauseScale(player);
                    if (scale > 0) {
                        Game.triggerHitPause(0.014 * scale);
                    }
                }
                
                // Track damage stats (host/solo only for consistency)
                if (!isClient) {
                    const metaOk = typeof Game === 'undefined'
                        || typeof Game.allowsMetaProgression !== 'function'
                        || Game.allowsMetaProgression();

                    // Track lifetime damage stat
                    if (metaOk && typeof window.trackLifetimeStat === 'function') {
                        window.trackLifetimeStat('totalDamageDealt', damageDealt);
                    }

                    if (metaOk && typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                        const isBackstabCrit = !!(isBackstab && isCrit);
                        LedgerManager.recordEvent('damageHit', {
                            damage: damageDealt,
                            player,
                            weaponType: player.weapon && player.weapon.weaponType,
                            isBasic: !(hitbox && (hitbox.type === 'thrust' || hitbox.isHeavy)),
                            isHeavy: !!(hitbox && (hitbox.type === 'thrust' || hitbox.isHeavy)),
                            isBackstabCrit,
                            breaksBackstabCombo: !isBackstabCrit
                        });
                    }
                    
                    if (metaOk && typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                        const stats = Game.getPlayerStats(attackerId);
                        if (stats) {
                            stats.addStat('damageDealt', damageDealt);
                        }
                    }
                    
                    // Track damage toward XP (on kill)
                    if (metaOk && enemy.hp <= 0) {
                        // Track lifetime kills stat
                        if (typeof window.trackLifetimeStat === 'function') {
                            window.trackLifetimeStat('totalKills', 1);
                        }
                        
                        const stats = typeof Game !== 'undefined' && Game.getPlayerStats ? Game.getPlayerStats(attackerId) : null;
                        if (stats) {
                            stats.addStat('kills', 1);
                        }
                    }
                    
                    // Phoenix Down recharge: track damage toward next charge
                    if (player.hasPhoenixDown && player.phoenixDownCharges < 1) {
                        player.phoenixDownDamageProgress += damageDealt;
                        if (player.phoenixDownDamageProgress >= player.phoenixDownDamageThreshold) {
                            player.phoenixDownCharges = 1;
                            player.phoenixDownDamageProgress = 0;
                            console.log('Phoenix Down recharged!');
                            // Visual effect for recharge
                            if (typeof createParticleBurst !== 'undefined') {
                                createParticleBurst(player.x, player.y, '#ffaa00', 15);
                            }
                        }
                    }
                }
                
                // Apply lifesteal once per enemy per melee swing (host/solo only)
                if (!isClient && shouldApplyWeaponSustainOnHit(player, hitbox)) {
                    applyLifesteal(player, damageDealt, {
                        enemy,
                        source: getMeleeHitboxSustainSource(hitbox)
                    });
                }
                
                // Fortify: Convert damage to shield (host/solo only, capped)
                if (!isClient && shouldApplyWeaponSustainOnHit(player, hitbox)) {
                    applyFortifyGain(player, damageDealt, { enemy });
                }
                
                // Rampage: Gain stack on kill (host/solo only) - legacy affix
                if (!isClient && player.rampageBonus && player.rampageBonus > 0 && enemy.hp <= 0) {
                    const maxStacks = 5;
                    if (player.rampageStacks < maxStacks) {
                        player.rampageStacks++;
                        player.rampageStackDecay = 5.0; // 5 seconds until decay
                    }
                }
                
                // Chain Lightning affix (host/solo only) - legacy affix
                if (!isClient && shouldRollWeaponProcOnHit(player, hitbox) && player.chainLightningCount && player.chainLightningCount > 0 && !hitbox.hasChainedAffix) {
                    chainLightningAffix(player, enemy, player.chainLightningCount, hitbox.damage * 0.5, enemies);
                    hitbox.hasChainedAffix = true;
                }
                
                // Explosive Attacks: Chance to create AoE (host/solo only) - legacy affix
                if (!isClient && shouldRollWeaponProcOnHit(player, hitbox) && player.explosiveChance && player.explosiveChance > 0 && Math.random() < player.explosiveChance) {
                    createExplosion(enemy.x, enemy.y, 40, hitbox.damage * 0.5, player, enemies);
                }
                
                // Check for chain lightning legendary effect (host/solo only)
                if (!isClient && shouldRollWeaponProcOnHit(player, hitbox) && player.activeLegendaryEffects && !hitbox.hasChained) {
                    player.activeLegendaryEffects.forEach(effect => {
                        if (effect.type === 'chain_lightning') {
                            chainLightningAttack(player, enemy, effect, hitbox.damage);
                            hitbox.hasChained = true;
                        }
                    });
                }
                
                // Legacy thin-client enemy_damaged path removed: clients no longer run attack checks;
                // host simulates all melee and syncs via game_state + damage_number / combat_fx.
                
                // Create damage number (host only - clients receive via damage_number event)
                if (!isClient && typeof createDamageNumber !== 'undefined') {
                    const isCrit = hitbox.displayCrit || false;
                    // Position damage number at weak point if hit, otherwise at the struck body
                    let damageX = bodyHit.hitX;
                    let damageY = bodyHit.hitY;
                    if (hitWeakPoint && enemy.weakPoints && enemy.weakPoints.length > 0) {
                        // Use first hit weak point position
                        damageX = enemy.x + enemy.weakPoints[0].offsetX;
                        damageY = enemy.y + enemy.weakPoints[0].offsetY;
                    }
                    createDamageNumber(damageX, damageY, damageDealt, isCrit, hitWeakPoint);
                    
                    // In multiplayer, send damage number event to clients
                    hostBroadcastDamageNumber(damageX, damageY, damageDealt, {
                        enemyId: enemy.id,
                        isCrit,
                        isWeakPoint: hitWeakPoint
                    });
                }
                
                // Play impact sound based on hit type
                if (typeof GameAudio !== 'undefined' && GameAudio.sounds) {
                    // Normalize damage for intensity (assuming typical damage ranges from 10-100)
                    const intensity = Math.min(damageDealt / 50, 2.0);
                    
                    if (hitWeakPoint) {
                        GameAudio.sounds.hitWeakPoint(intensity);
                    } else if (hitbox.displayCrit) {
                        GameAudio.sounds.hitCritical(intensity);
                    } else if (isBackstab) {
                        GameAudio.sounds.hitBackstab(intensity);
                    } else {
                        GameAudio.sounds.hitNormal(intensity);
                    }
                    
                    // Play death sound if enemy died
                    if (!isClient && enemy.hp <= 0) {
                        setTimeout(() => {
                            if (GameAudio.sounds) {
                                GameAudio.sounds.enemyDeath();
                            }
                        }, 50);
                    }
                }

                if (!isClient && shouldApplyWeaponStatusOnHit(player, hitbox) && typeof applyLegendaryEffects === 'function') {
                    applyLegendaryEffects(player, enemy, damageDealt, attackerId);
                }

                // Fractal/endless echo: only from real weapon hits (not DoT / echo recursion)
                if (!isClient && enemy.biomeFlags && enemy.biomeFlags.echoOnHit
                    && typeof BiomeEnemyMods !== 'undefined' && BiomeEnemyMods.scheduleEcho) {
                    BiomeEnemyMods.scheduleEcho(enemy, enemy.biomeEchoDelay || 0.28);
                }
                
                // Track that we hit this enemy so we don't hit it again with this hitbox
                hitbox.hitEnemies.add(enemy);
}

// Check enemies vs player (and all remote players in multiplayer)
function checkEnemiesVsPlayer(player, enemies) {
    // Only run on host in multiplayer (host simulates all collisions)
    if (typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient()) {
        return;
    }
    
    // Initialize damage cooldown tracking if not exists
    if (!checkEnemiesVsPlayer.damageCooldowns) {
        checkEnemiesVsPlayer.damageCooldowns = new Map();
    }
    
    const currentTime = Date.now();
    const damageCooldownMs = 350; // Brief debounce window between contact hits
    
    const playersToCheck = [];
    
    // Add local player if alive (check invulnerability later to track successful dodges)
    if (player && player.alive) {
        // Get local player ID for consistent identification
        const localPlayerId = typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
        
        playersToCheck.push({
            id: localPlayerId,
            player: player,
            isPlayerInstance: true
        });
    }
    
    // Add remote player INSTANCES (host simulates these)
    if (typeof Game !== 'undefined' && Game.remotePlayerInstances) {
        Game.remotePlayerInstances.forEach((playerInstance, playerId) => {
            if (playerInstance && playerInstance.alive) {
                playersToCheck.push({
                    id: playerId,
                    player: playerInstance,
                    isPlayerInstance: true
                });
            }
        });
    }
    
    // Check each enemy against each player
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        playersToCheck.forEach(({ id, player: p, isPlayerInstance }) => {
            const playerRadius = p.collisionRadius || p.size || 20;
            const enemyRadius = enemy.collisionRadius || enemy.size || 20;
            
            // Project damage point in front of enemy
            const damagePoint = getEnemyDamagePoint(enemy, p);
            const hasProjectedHit = checkCircleCollision(damagePoint.x, damagePoint.y, damagePoint.radius,
                                                         p.x, p.y, playerRadius);
            
            if (hasProjectedHit) {
                const contactDamageMultiplier = typeof enemy.getContactDamageMultiplier === 'function'
                    ? enemy.getContactDamageMultiplier(p)
                    : (enemy.contactDamageMultiplier !== undefined ? enemy.contactDamageMultiplier : 1);
                if (contactDamageMultiplier <= 0) {
                    return;
                }

                // Check if player is dodging/invulnerable - if so, count as successful dodge
                if (p.invulnerable || p.isDodging) {
                    // Track successful dodge (attack would have hit, but player dodged it)
                    // Only track for local player to avoid double-counting in multiplayer
                    const localPlayerId = typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
                    if (id === localPlayerId && typeof window.trackLifetimeStat === 'function') {
                        // Use a cooldown to prevent counting the same attack multiple times
                        const dodgeTrackKey = `dodge_${enemy.id}_${id}`;
                        if (!checkEnemiesVsPlayer.dodgeTrackCooldowns) {
                            checkEnemiesVsPlayer.dodgeTrackCooldowns = new Map();
                        }
                        const lastDodgeTrack = checkEnemiesVsPlayer.dodgeTrackCooldowns.get(dodgeTrackKey) || 0;
                        if (currentTime - lastDodgeTrack >= damageCooldownMs) {
                            window.trackLifetimeStat('totalDodges', 1);
                            checkEnemiesVsPlayer.dodgeTrackCooldowns.set(dodgeTrackKey, currentTime);
                            if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                                LedgerManager.recordEvent('dodge', { player: p });
                            }
                        }
                    }
                    // Perfect dodge: action-dependent cooldown relief (client-predict OK for feel)
                    if (p.isDodging) {
                        tryRegisterPerfectDodge(p, enemy, id);
                    }
                    // Skip damage application but still resolve overlap
                    resolveEnemyPlayerOverlap(enemy, p);
                    return; // Skip to next player
                }

                // Artillery Barrage proximity tracking
                if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                    const pdx = enemy.x - p.x;
                    const pdy = enemy.y - p.y;
                    LedgerManager.recordEvent('enemyProximity', {
                        dist: Math.sqrt(pdx * pdx + pdy * pdy)
                    });
                }
                
                // For diamond enemies, check if dash has already hit (prevents continuous damage)
                // Check dashHasHit flag regardless of current state (dash or cooldown after dash)
                if (enemy.shape === 'diamond' && enemy.dashHasHit === true) {
                    // Dash already hit, skip damage to prevent continuous hits
                    resolveEnemyPlayerOverlap(enemy, p);
                    return; // Skip to next player
                }
                
                const cooldownKey = `${enemy.id}-${id}`;
                const lastDamageTime = checkEnemiesVsPlayer.damageCooldowns.get(cooldownKey) || 0;
                
                if (currentTime - lastDamageTime >= damageCooldownMs) {
                    // For diamond enemies in dash state, mark that dash has hit
                    // This prevents multiple hits from the same dash attack
                    if (enemy.shape === 'diamond' && (enemy.state === 'dash' || enemy.state === 'cooldown')) {
                        enemy.dashHasHit = true;
                    }
                    // Get local player ID for comparison
                    const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';

                    let contactDmg = enemy.damage * contactDamageMultiplier;
                    if (typeof EliteEnemyAffixes !== 'undefined') {
                        if (EliteEnemyAffixes.maybeEliteExecuteDamage) {
                            contactDmg = EliteEnemyAffixes.maybeEliteExecuteDamage(enemy, p, contactDmg);
                        }
                        if (EliteEnemyAffixes.triggerEliteRampage) {
                            EliteEnemyAffixes.triggerEliteRampage(enemy);
                        }
                    }
                    
                    // Distinguish between local and remote players
                    if (id === localPlayerId) {
                        // Local player: call takeDamage directly (pass enemy for thorns)
                        p.takeDamage(contactDmg, enemy);
                    } else {
                        // Remote player: use damageRemotePlayer to track on host
                        // HP syncs to clients via game_state, not individual damage events
                        if (typeof Game !== 'undefined' && Game.damageRemotePlayer) {
                            Game.damageRemotePlayer(id, contactDmg);
                        }
                    }
                    
                    checkEnemiesVsPlayer.damageCooldowns.set(cooldownKey, currentTime);
                    
                    // Apply directional knockback to the player based on enemy momentum
                    if (typeof p.applyDamageKnockback === 'function') {
                        let impactDirX;
                        let impactDirY;
                        
                        if (typeof enemy.rotation === 'number') {
                            impactDirX = Math.cos(enemy.rotation);
                            impactDirY = Math.sin(enemy.rotation);
                        }
                        
                        if ((impactDirX === undefined || impactDirY === undefined) ||
                            (impactDirX === 0 && impactDirY === 0)) {
                            const dirX = p.x - enemy.x;
                            const dirY = p.y - enemy.y;
                            const dirDist = Math.sqrt(dirX * dirX + dirY * dirY);
                            if (dirDist > 0) {
                                impactDirX = dirX / dirDist;
                                impactDirY = dirY / dirDist;
                            } else {
                                impactDirX = 1;
                                impactDirY = 0;
                            }
                        }
                        
                        const knockbackStrength = enemy.contactKnockback || 120;
                        p.applyDamageKnockback(
                            impactDirX * knockbackStrength,
                            impactDirY * knockbackStrength,
                            enemy.id || null
                        );
                    }
                }
                
                resolveEnemyPlayerOverlap(enemy, p);
            }
        });
    });
    
    // Clean up old cooldown entries
    const cleanupThreshold = currentTime - 2000;
    for (const [key, time] of checkEnemiesVsPlayer.damageCooldowns.entries()) {
        if (time < cleanupThreshold) {
            checkEnemiesVsPlayer.damageCooldowns.delete(key);
        }
    }
    
    // Clean up old dodge tracking cooldown entries
    if (checkEnemiesVsPlayer.dodgeTrackCooldowns) {
        for (const [key, time] of checkEnemiesVsPlayer.dodgeTrackCooldowns.entries()) {
            if (time < cleanupThreshold) {
                checkEnemiesVsPlayer.dodgeTrackCooldowns.delete(key);
            }
        }
    }
}

// Check enemies vs clones/decoys (shadow clones and blink decoys)
function checkEnemiesVsClones(player, enemies) {
    // Only run on host in multiplayer (host simulates all collisions)
    if (typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient()) {
        return; // Clients don't check enemy collisions, host does
    }
    
    if (!enemies || enemies.length === 0) return;
    
    // Get all players to check their clones
    const playersToCheck = [];
    
    // Add local player
    if (player && player.alive) {
        playersToCheck.push(player);
    }
    
    // Add remote player INSTANCES (host simulates these)
    if (typeof Game !== 'undefined' && Game.remotePlayerInstances) {
        Game.remotePlayerInstances.forEach((playerInstance, playerId) => {
            if (playerInstance && playerInstance.alive) {
                playersToCheck.push(playerInstance);
            }
        });
    }
    
    // Initialize damage cooldown tracking if not exists
    if (!checkEnemiesVsClones.damageCooldowns) {
        checkEnemiesVsClones.damageCooldowns = new Map();
    }
    
    const currentTime = Date.now();
    const damageCooldownMs = 500; // 0.5 second cooldown between damage ticks
    
    playersToCheck.forEach(p => {
        // Check shadow clones (Rogue)
        if (p.shadowClonesActive && p.shadowClones && p.shadowClones.length > 0) {
            p.shadowClones.forEach((clone, cloneIndex) => {
                if (clone && clone.alive !== false && (clone.health === undefined || clone.health > 0)) {
                    enemies.forEach(enemy => {
                        if (!enemy.alive) return;
                        
                        // Check collision
                        if (checkCircleCollision(enemy.x, enemy.y, enemy.size, 
                                                clone.x, clone.y, p.size || 20)) {
                            // Create unique key for this enemy-clone pair
                            const cooldownKey = `${enemy.id}-clone-${cloneIndex}`;
                            const lastDamageTime = checkEnemiesVsClones.damageCooldowns.get(cooldownKey) || 0;
                            
                            // Only apply damage if cooldown has passed
                            if (currentTime - lastDamageTime >= damageCooldownMs) {
                                // Clone takes damage from enemy
                                const damageAmount = enemy.damage || 5;
                                if (clone.takeDamage) {
                                    clone.takeDamage(damageAmount, {
                                        particleColor: '#666666'
                                    });
                                }
                                if ((enemy.isBoss || enemy.bossName) && typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                                    LedgerManager.recordEvent('cloneHit', {
                                        player: p,
                                        enemy,
                                        now: Date.now()
                                    });
                                } else if (clone.health !== undefined) {
                                    clone.health = Math.max(0, clone.health - damageAmount);
                                    clone.hp = clone.health;
                                    if (clone.health <= 0) {
                                        clone.alive = false;
                                        clone.dead = true;
                                    }
                                }
                                
                                // Update cooldown
                                checkEnemiesVsClones.damageCooldowns.set(cooldownKey, currentTime);
                                
                                if (!clone.takeDamage) {
                                    if (typeof createDamageNumber !== 'undefined') {
                                        createDamageNumber(clone.x, clone.y, damageAmount, false, false);
                                    }
                                    if (typeof createParticleBurst !== 'undefined') {
                                        createParticleBurst(clone.x, clone.y, '#666666', 4);
                                    }
                                    hostBroadcastDamageNumber(clone.x, clone.y, damageAmount);
                                    hostBroadcastCombatFx({
                                        kind: 'particle_burst',
                                        x: clone.x,
                                        y: clone.y,
                                        color: '#666666',
                                        count: 4
                                    });
                                }
                            }
                        }
                    });
                }
            });
        }
        
        // Check blink decoy (Mage)
        if (p.blinkDecoyActive && p.blinkDecoyHealth !== undefined) {
            enemies.forEach(enemy => {
                if (!enemy.alive) return;
                
                // Check collision
                if (checkCircleCollision(enemy.x, enemy.y, enemy.size, 
                                        p.blinkDecoyX, p.blinkDecoyY, p.size || 20)) {
                    // Create unique key for this enemy-decoy pair
                    const cooldownKey = `${enemy.id}-decoy`;
                    const lastDamageTime = checkEnemiesVsClones.damageCooldowns.get(cooldownKey) || 0;
                    
                    // Only apply damage if cooldown has passed
                    if (currentTime - lastDamageTime >= damageCooldownMs) {
                        // Decoy takes damage from enemy
                        const damageAmount = enemy.damage || 5;
                        const decoyHpBefore = p.blinkDecoyHealth;
                        if (typeof p.applyBlinkDecoyDamage === 'function') {
                            p.applyBlinkDecoyDamage(damageAmount, {
                                particleColor: '#96c8ff'
                            });
                        } else {
                            p.blinkDecoyHealth -= damageAmount;
                            
                            // Create damage number if available
                            if (typeof createDamageNumber !== 'undefined') {
                                createDamageNumber(p.blinkDecoyX, p.blinkDecoyY, damageAmount, false, false);
                            }
                            
                            // Visual feedback: particles
                            if (typeof createParticleBurst !== 'undefined') {
                                createParticleBurst(p.blinkDecoyX, p.blinkDecoyY, '#96c8ff', 4);
                            }
                            hostBroadcastDamageNumber(p.blinkDecoyX, p.blinkDecoyY, damageAmount);
                            hostBroadcastCombatFx({
                                kind: 'particle_burst',
                                x: p.blinkDecoyX,
                                y: p.blinkDecoyY,
                                color: '#96c8ff',
                                count: 4
                            });
                            
                            if (p.blinkDecoyHealth <= 0) {
                                p.blinkDecoyActive = false;
                                p.blinkDecoyHealth = 0;
                            }
                        }
                        // Perfect Displace: decoy soaked a lethal-scale hit while player blink i-frames clear danger
                        if (p.invulnerable && (
                            damageAmount >= (p.hp || 0) ||
                            decoyHpBefore - (p.blinkDecoyHealth || 0) >= decoyHpBefore * 0.5 ||
                            (p.blinkDecoyHealth || 0) <= 0
                        )) {
                            if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                                LedgerManager.recordEvent('decoyAbsorb', { player: p, lethal: true });
                            }
                        }
                        
                        // Update cooldown
                        checkEnemiesVsClones.damageCooldowns.set(cooldownKey, currentTime);
                    }
                }
            });
        }
    });
    
    // Clean up old cooldown entries (older than 5 seconds)
    const cleanupThreshold = currentTime - 5000;
    for (const [key, time] of checkEnemiesVsClones.damageCooldowns.entries()) {
        if (time < cleanupThreshold) {
            checkEnemiesVsClones.damageCooldowns.delete(key);
        }
    }
}

// Chain Lightning legendary effect - chains to nearby enemies
function chainLightningAttack(player, sourceEnemy, effect, damage) {
    if (!effect || typeof Game === 'undefined' || !Game.enemies) return;
    
    const enemies = Game.enemies;
    const chainCount = effect.chainCount || 2;
    const chainDamageMultiplier = effect.chainDamage || 0.7;
    const chainRange = effect.chainRange || 150;
    
    // Get player ID for damage attribution
    const attackerId = player ? (player.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null)) : null;
    
    const hitEnemies = new Set([sourceEnemy]);
    let currentTarget = sourceEnemy;
    
    for (let i = 0; i < chainCount; i++) {
        // Find nearest enemy within range that hasn't been hit
        let nearestEnemy = null;
        let nearestDist = chainRange;
        
        enemies.forEach(enemy => {
            if (!enemy.alive || hitEnemies.has(enemy)) return;
            
            const dx = enemy.x - currentTarget.x;
            const dy = enemy.y - currentTarget.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        });
        
        if (nearestEnemy) {
            // Apply reduced damage per chain
            const chainDamage = damage * Math.pow(chainDamageMultiplier, i + 1);
            const damageDealt = Math.min(chainDamage, nearestEnemy.hp);
            
            nearestEnemy.takeDamage(chainDamage, attackerId);
            hitEnemies.add(nearestEnemy);
            
            // Track stats (host/solo only)
            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
            if (!isClient) {
                // Track lifetime damage stat
                if (typeof window.trackLifetimeStat === 'function') {
                    window.trackLifetimeStat('totalDamageDealt', damageDealt);
                }
                
                if (typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                    const stats = Game.getPlayerStats(attackerId);
                    if (stats) {
                        stats.addStat('damageDealt', damageDealt);
                    }
                    
                    // Track kill if enemy died
                    if (nearestEnemy.hp <= 0) {
                        const killStats = Game.getPlayerStats(attackerId);
                        if (killStats) {
                            killStats.addStat('kills', 1);
                        }
                    }
                }
            }
            
            // Apply lifesteal
            if (player) {
                applyLifesteal(player, damageDealt, { enemy: nearestEnemy, source: 'chain' });
            }
            
            // Create visual arc
            if (typeof createLightningArc !== 'undefined') {
                createLightningArc(currentTarget.x, currentTarget.y, nearestEnemy.x, nearestEnemy.y);
            }
            hostBroadcastCombatFx({
                kind: 'lightning_arc',
                x1: currentTarget.x,
                y1: currentTarget.y,
                x2: nearestEnemy.x,
                y2: nearestEnemy.y
            });
            
            // Damage number
            if (typeof createDamageNumber !== 'undefined') {
                createDamageNumber(nearestEnemy.x, nearestEnemy.y, Math.floor(chainDamage), false, false);
            }
            hostBroadcastDamageNumber(nearestEnemy.x, nearestEnemy.y, chainDamage, {
                enemyId: nearestEnemy.id
            });
            
            currentTarget = nearestEnemy;
        } else {
            break; // No more enemies in range
        }
    }
}

// Chain Lightning affix - chains to nearby enemies
// Card-based chain lightning (Fractal Conduit)
function chainLightningCard(player, sourceEnemy, chainCount, damage, enemies, range, lifeOnChain) {
    if (!enemies || enemies.length === 0) return;
    
    const attackerId = player ? (player.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null)) : null;
    const chainRange = range || 300;
    const hitEnemies = new Set([sourceEnemy]);
    let currentTarget = sourceEnemy;
    const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
    
    for (let i = 0; i < chainCount; i++) {
        let nearestEnemy = null;
        let nearestDist = chainRange;
        
        enemies.forEach(enemy => {
            if (!enemy.alive || hitEnemies.has(enemy)) return;
            
            const dx = enemy.x - currentTarget.x;
            const dy = enemy.y - currentTarget.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        });
        
        if (nearestEnemy) {
            const chainDamage = damage; // Already reduced by card's chainDamage multiplier
            const damageDealt = Math.min(chainDamage, nearestEnemy.hp);
            
            nearestEnemy.takeDamage(chainDamage, attackerId);
            hitEnemies.add(nearestEnemy);
            
            // Lifesteal on chain if available (uses player's lifesteal stat via card bonus)
            if (!isClient && lifeOnChain && lifeOnChain > 0 && player) {
                const savedLifesteal = player.lifesteal;
                player.lifesteal = lifeOnChain;
                applyLifesteal(player, damageDealt, { enemy: nearestEnemy, source: 'chain' });
                player.lifesteal = savedLifesteal;
            }
            
            // Track stats (host/solo only)
            if (!isClient) {
                // Track lifetime damage stat
                if (typeof window.trackLifetimeStat === 'function') {
                    window.trackLifetimeStat('totalDamageDealt', damageDealt);
                }
                
                if (typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                    const stats = Game.getPlayerStats(attackerId);
                    if (stats) {
                        stats.addStat('damageDealt', damageDealt);
                        if (nearestEnemy.hp <= 0) {
                            // Track lifetime kills stat
                            if (typeof window.trackLifetimeStat === 'function') {
                                window.trackLifetimeStat('totalKills', 1);
                            }
                            stats.addStat('kills', 1);
                        }
                    }
                }
            }
            
            currentTarget = nearestEnemy;
        } else {
            break; // No more targets in range
        }
    }
}

function chainLightningAffix(player, sourceEnemy, chainCount, damage, enemies) {
    if (!enemies || enemies.length === 0) return;
    
    // Get player ID for damage attribution
    const attackerId = player ? (player.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null)) : null;
    
    const chainRange = 150;
    const hitEnemies = new Set([sourceEnemy]);
    let currentTarget = sourceEnemy;
    
    for (let i = 0; i < chainCount; i++) {
        // Find nearest enemy within range that hasn't been hit
        let nearestEnemy = null;
        let nearestDist = chainRange;
        
        enemies.forEach(enemy => {
            if (!enemy.alive || hitEnemies.has(enemy)) return;
            
            const dx = enemy.x - currentTarget.x;
            const dy = enemy.y - currentTarget.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        });
        
        if (nearestEnemy) {
            // Apply reduced damage
            const chainDamage = damage * Math.pow(0.7, i + 1); // 70% per chain
            const damageDealt = Math.min(chainDamage, nearestEnemy.hp);
            
            nearestEnemy.takeDamage(chainDamage, attackerId);
            hitEnemies.add(nearestEnemy);
            
            // Track stats (host/solo only)
            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
            if (!isClient && typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                const stats = Game.getPlayerStats(attackerId);
                if (stats) {
                    stats.addStat('damageDealt', damageDealt);
                }
                
                // Track kill if enemy died
                if (nearestEnemy.hp <= 0) {
                    const killStats = Game.getPlayerStats(attackerId);
                    if (killStats) {
                        killStats.addStat('kills', 1);
                    }
                }
            }
            
            // Apply lifesteal
            if (player) {
                applyLifesteal(player, damageDealt, { enemy: nearestEnemy, source: 'chain' });
            }
            
            // Create visual arc
            if (typeof createLightningArc !== 'undefined') {
                createLightningArc(currentTarget.x, currentTarget.y, nearestEnemy.x, nearestEnemy.y);
            }
            hostBroadcastCombatFx({
                kind: 'lightning_arc',
                x1: currentTarget.x,
                y1: currentTarget.y,
                x2: nearestEnemy.x,
                y2: nearestEnemy.y
            });
            
            // Damage number
            if (typeof createDamageNumber !== 'undefined') {
                createDamageNumber(nearestEnemy.x, nearestEnemy.y, Math.floor(chainDamage), false, false);
            }
            hostBroadcastDamageNumber(nearestEnemy.x, nearestEnemy.y, chainDamage, {
                enemyId: nearestEnemy.id
            });
            
            currentTarget = nearestEnemy;
        } else {
            break; // No more enemies in range
        }
    }
}

// Create explosion AoE from explosive attacks affix
function createExplosion(x, y, radius, damage, player, enemies) {
    if (!enemies || enemies.length === 0) return;
    
    // Get player ID for damage attribution
    const attackerId = player ? (player.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null)) : null;
    
    // Visual effect
    if (typeof createParticleBurst !== 'undefined') {
        createParticleBurst(x, y, '#ff9900', 12);
    }
    hostBroadcastCombatFx({
        kind: 'explosion',
        x,
        y,
        color: '#ff9900',
        radius,
        count: 12
    });
    
    // Damage all enemies in radius
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        const dx = enemy.x - x;
        const dy = enemy.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < radius + enemy.size) {
            const damageDealt = Math.min(damage, enemy.hp);
            
            enemy.takeDamage(damage, attackerId);
            
            // Track stats (host/solo only)
            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
            if (!isClient && typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                const stats = Game.getPlayerStats(attackerId);
                if (stats) {
                    stats.addStat('damageDealt', damageDealt);
                }
                
                // Track kill if enemy died
                if (enemy.hp <= 0) {
                    const killStats = Game.getPlayerStats(attackerId);
                    if (killStats) {
                        killStats.addStat('kills', 1);
                    }
                }
            }
            
            // Apply lifesteal
            if (player) {
                applyLifesteal(player, damageDealt, { enemy, source: 'aoe' });
            }
            
            // Damage number
            if (typeof createDamageNumber !== 'undefined') {
                createDamageNumber(enemy.x, enemy.y, Math.floor(damage), false, false);
            }
            hostBroadcastDamageNumber(enemy.x, enemy.y, damage, { enemyId: enemy.id });
        }
    });
}

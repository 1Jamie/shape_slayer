/**
 * Shared impulse accumulator for dynamic entities.
 * Forces add into impulseVx/Vy, integrate through a collision-aware moveFn,
 * and optionally trigger wall-slam damage when a high-speed impulse is blocked.
 */
const ImpulsePhysics = {
    DEFAULTS: {
        primaryMaxSpeed: 800,
        enemyMaxSpeed: 900,
        primaryDecay: 0.2125,
        enemyDecay: 0.5,
        primaryCutoff: 12,
        enemyCutoff: 1,
        maxDuration: 2.0,
        wallSlamSpeedThreshold: 220,
        wallSlamBlockedFraction: 0.3,
        wallSlamDamagePerSpeed: 0.085,
        wallSlamMinDamage: 4,
        wallSlamMaxDamage: 48,
        wallSlamCooldown: 0.35,
        // Strip into-wall impulse when this much of the intended move was lost
        wallContactLostFraction: 0.08,
        // Extra damp on remaining tangential velocity after a hard wall hit
        wallImpactFriction: 0.55,
        // Treat as a hard hit (apply friction) when actual move is below this fraction
        wallHardHitFraction: 0.35,
        aiDampStartSpeed: 40,
        aiDampFullSpeed: 280,
        aiDampMinScale: 0.1
    },

    ensureFields(entity, options = {}) {
        if (!entity) return;
        if (typeof entity.impulseVx !== 'number') entity.impulseVx = 0;
        if (typeof entity.impulseVy !== 'number') entity.impulseVy = 0;
        if (typeof entity.impulseDecay !== 'number') {
            entity.impulseDecay = options.decay != null ? options.decay : this.DEFAULTS.enemyDecay;
        }
        if (typeof entity.impulseMaxSpeed !== 'number') {
            entity.impulseMaxSpeed = options.maxSpeed != null ? options.maxSpeed : this.DEFAULTS.enemyMaxSpeed;
        }
        if (typeof entity.impulseCutoff !== 'number') {
            entity.impulseCutoff = options.cutoff != null ? options.cutoff : this.DEFAULTS.enemyCutoff;
        }
        if (typeof entity.impulseMaxDuration !== 'number') {
            entity.impulseMaxDuration = options.maxDuration != null ? options.maxDuration : this.DEFAULTS.maxDuration;
        }
        if (typeof entity.impulseTimer !== 'number') entity.impulseTimer = 0;
        if (entity.lastImpulseSourceId === undefined) entity.lastImpulseSourceId = null;
        if (typeof entity.wallSlamCooldown !== 'number') entity.wallSlamCooldown = 0;
    },

    getSpeed(entity) {
        const vx = entity && entity.impulseVx ? entity.impulseVx : 0;
        const vy = entity && entity.impulseVy ? entity.impulseVy : 0;
        return Math.hypot(vx, vy);
    },

    clamp(entity, maxSpeed) {
        if (!entity) return;
        const limit = maxSpeed != null ? maxSpeed : (entity.impulseMaxSpeed || this.DEFAULTS.enemyMaxSpeed);
        const speed = this.getSpeed(entity);
        if (speed > limit && speed > 0) {
            const scale = limit / speed;
            entity.impulseVx *= scale;
            entity.impulseVy *= scale;
        }
    },

    /**
     * Apply an impulse. By default accumulates; set replace:true to overwrite.
     */
    apply(entity, forceX, forceY, options = {}) {
        if (!entity) return false;
        this.ensureFields(entity, options);

        if (entity.hasKnockbackImmunity) {
            return false;
        }

        const fx = forceX || 0;
        const fy = forceY || 0;
        if (fx === 0 && fy === 0) return false;

        const resistance = Math.max(0.1, options.resistance != null
            ? options.resistance
            : (entity.knockbackResistance || 1.0));

        const appliedX = fx / resistance;
        const appliedY = fy / resistance;

        if (options.replace) {
            entity.impulseVx = appliedX;
            entity.impulseVy = appliedY;
        } else {
            entity.impulseVx = (entity.impulseVx || 0) + appliedX;
            entity.impulseVy = (entity.impulseVy || 0) + appliedY;
        }

        const maxSpeed = options.maxSpeed != null ? options.maxSpeed : entity.impulseMaxSpeed;
        this.clamp(entity, maxSpeed);

        if (options.sourceId != null) {
            entity.lastImpulseSourceId = options.sourceId;
        }

        entity.impulseTimer = 0;
        return true;
    },

    /**
     * Scale AI / non-impulse movement while under strong impulse so same-frame
     * AI steps cannot fully cancel knockback.
     */
    getAiMoveScale(entity) {
        const speed = this.getSpeed(entity);
        const start = this.DEFAULTS.aiDampStartSpeed;
        const full = this.DEFAULTS.aiDampFullSpeed;
        const minScale = this.DEFAULTS.aiDampMinScale;
        if (speed <= start) return 1;
        if (speed >= full) return minScale;
        const t = (speed - start) / (full - start);
        return 1 - t * (1 - minScale);
    },

    computeWallSlamDamage(speed, options = {}) {
        const threshold = options.speedThreshold != null
            ? options.speedThreshold
            : this.DEFAULTS.wallSlamSpeedThreshold;
        if (speed < threshold) return 0;
        const perSpeed = options.damagePerSpeed != null
            ? options.damagePerSpeed
            : this.DEFAULTS.wallSlamDamagePerSpeed;
        const minDamage = options.minDamage != null ? options.minDamage : this.DEFAULTS.wallSlamMinDamage;
        const maxDamage = options.maxDamage != null ? options.maxDamage : this.DEFAULTS.wallSlamMaxDamage;
        const raw = (speed - threshold) * perSpeed;
        return Math.max(minDamage, Math.min(maxDamage, raw));
    },

    /**
     * When an impulse move hits scenery/bounds, remove the into-wall velocity
     * so entities don't stay pinned until the impulse decays.
     * Keeps tangential slide; hard hits also apply friction to the remainder.
     *
     * Wall normal convention: outward (points into free space).
     */
    resolveWallContact(entity, info = {}, options = {}) {
        if (!entity) return false;

        const intendedDx = info.intendedDx || 0;
        const intendedDy = info.intendedDy || 0;
        const intendedMoved = info.intendedMoved != null
            ? info.intendedMoved
            : Math.hypot(intendedDx, intendedDy);
        if (intendedMoved < 0.0001) return false;

        const actualDx = info.actualDx != null ? info.actualDx : 0;
        const actualDy = info.actualDy != null ? info.actualDy : 0;
        const actualMoved = info.actualMoved != null
            ? info.actualMoved
            : Math.hypot(actualDx, actualDy);

        const lostFraction = options.wallContactLostFraction != null
            ? options.wallContactLostFraction
            : this.DEFAULTS.wallContactLostFraction;
        const lostEnough = actualMoved < intendedMoved * (1 - lostFraction);
        if (!info.blocked && !lostEnough) return false;

        let nx = info.normalX;
        let ny = info.normalY;
        if (nx == null || ny == null || !Number.isFinite(nx) || !Number.isFinite(ny)) {
            const lostDx = intendedDx - actualDx;
            const lostDy = intendedDy - actualDy;
            const lost = Math.hypot(lostDx, lostDy);
            if (lost > 0.0001) {
                // Outward normal opposes the displacement that was prevented
                nx = -lostDx / lost;
                ny = -lostDy / lost;
            } else {
                nx = -intendedDx / intendedMoved;
                ny = -intendedDy / intendedMoved;
            }
        }

        const nLen = Math.hypot(nx, ny);
        if (nLen < 0.0001) return false;
        nx /= nLen;
        ny /= nLen;

        // Velocity into the wall is opposite the outward normal
        const vn = (entity.impulseVx || 0) * nx + (entity.impulseVy || 0) * ny;
        if (vn >= 0) {
            // Already moving away from / along the wall — nothing to strip
            return false;
        }

        // Remove inward component (slide along wall)
        entity.impulseVx = (entity.impulseVx || 0) - vn * nx;
        entity.impulseVy = (entity.impulseVy || 0) - vn * ny;

        const hardHitFraction = options.wallHardHitFraction != null
            ? options.wallHardHitFraction
            : this.DEFAULTS.wallHardHitFraction;
        const isHardHit = info.blocked || actualMoved < intendedMoved * hardHitFraction;
        if (isHardHit) {
            const friction = options.wallImpactFriction != null
                ? options.wallImpactFriction
                : this.DEFAULTS.wallImpactFriction;
            entity.impulseVx *= friction;
            entity.impulseVy *= friction;
        }

        return true;
    },

    /**
     * Integrate impulse velocity for one frame.
     * moveFn(dx, dy) should move the entity and return:
     *   { ok, blocked, actualMoved, intendedMoved, actualDx, actualDy, normalX, normalY }
     *   or a boolean (ok).
     */
    integrate(entity, deltaTime, options = {}) {
        if (!entity || !(deltaTime > 0)) {
            return { moved: false, wallSlam: null, wallContact: false };
        }
        this.ensureFields(entity, options);

        if (typeof entity.wallSlamCooldown === 'number' && entity.wallSlamCooldown > 0) {
            entity.wallSlamCooldown = Math.max(0, entity.wallSlamCooldown - deltaTime);
        }

        const vx = entity.impulseVx || 0;
        const vy = entity.impulseVy || 0;
        if (vx === 0 && vy === 0) {
            entity.impulseTimer = 0;
            return { moved: false, wallSlam: null, wallContact: false };
        }

        entity.impulseTimer = (entity.impulseTimer || 0) + deltaTime;
        const maxDuration = options.maxDuration != null
            ? options.maxDuration
            : (entity.impulseMaxDuration || this.DEFAULTS.maxDuration);
        if (maxDuration > 0 && entity.impulseTimer >= maxDuration) {
            entity.impulseVx = 0;
            entity.impulseVy = 0;
            entity.impulseTimer = 0;
            return { moved: false, wallSlam: null, wallContact: false };
        }

        const intendedDx = vx * deltaTime;
        const intendedDy = vy * deltaTime;
        const intendedMoved = Math.hypot(intendedDx, intendedDy);
        const speedBefore = Math.hypot(vx, vy);

        let moveResult = {
            ok: true,
            blocked: false,
            actualMoved: intendedMoved,
            intendedMoved,
            actualDx: intendedDx,
            actualDy: intendedDy
        };
        if (typeof options.moveFn === 'function') {
            const raw = options.moveFn(intendedDx, intendedDy);
            if (typeof raw === 'boolean') {
                const blocked = !raw;
                moveResult = {
                    ok: raw,
                    blocked,
                    actualMoved: blocked ? 0 : intendedMoved,
                    intendedMoved,
                    actualDx: blocked ? 0 : intendedDx,
                    actualDy: blocked ? 0 : intendedDy
                };
            } else if (raw && typeof raw === 'object') {
                const actualDx = raw.actualDx != null ? raw.actualDx : (raw.ok === false ? 0 : intendedDx);
                const actualDy = raw.actualDy != null ? raw.actualDy : (raw.ok === false ? 0 : intendedDy);
                moveResult = {
                    ok: raw.ok !== false,
                    blocked: !!raw.blocked,
                    actualMoved: raw.actualMoved != null ? raw.actualMoved : Math.hypot(actualDx, actualDy),
                    intendedMoved: raw.intendedMoved != null ? raw.intendedMoved : intendedMoved,
                    actualDx,
                    actualDy,
                    normalX: raw.normalX,
                    normalY: raw.normalY
                };
            }
        } else {
            entity.x = (entity.x || 0) + intendedDx;
            entity.y = (entity.y || 0) + intendedDy;
        }

        let wallSlam = null;
        const enableWallSlam = options.enableWallSlam === true;
        const blockedFraction = options.blockedFraction != null
            ? options.blockedFraction
            : this.DEFAULTS.wallSlamBlockedFraction;
        const heavilyBlocked = intendedMoved > 0.001
            && moveResult.actualMoved < intendedMoved * blockedFraction;

        if (enableWallSlam && typeof options.onWallSlam === 'function') {
            const speedThreshold = options.slamSpeedThreshold != null
                ? options.slamSpeedThreshold
                : this.DEFAULTS.wallSlamSpeedThreshold;
            const onCooldown = (entity.wallSlamCooldown || 0) > 0;
            if (!onCooldown && heavilyBlocked && speedBefore >= speedThreshold) {
                const damage = this.computeWallSlamDamage(speedBefore, options);
                if (damage > 0) {
                    wallSlam = {
                        damage,
                        speed: speedBefore,
                        sourceId: entity.lastImpulseSourceId || null
                    };
                    entity.wallSlamCooldown = options.slamCooldown != null
                        ? options.slamCooldown
                        : this.DEFAULTS.wallSlamCooldown;
                    options.onWallSlam(wallSlam);
                }
            }
        }

        // Kill into-wall impulse so knockback/push doesn't pin the entity until decay
        const skipWallResolve = options.resolveWallContact === false;
        const wallContact = !skipWallResolve && this.resolveWallContact(entity, {
            blocked: moveResult.blocked || heavilyBlocked,
            intendedDx,
            intendedDy,
            intendedMoved,
            actualDx: moveResult.actualDx,
            actualDy: moveResult.actualDy,
            actualMoved: moveResult.actualMoved,
            normalX: moveResult.normalX,
            normalY: moveResult.normalY
        }, options);

        const decay = options.decay != null ? options.decay : (entity.impulseDecay || this.DEFAULTS.enemyDecay);
        const decayFactor = Math.pow(decay, deltaTime);
        entity.impulseVx *= decayFactor;
        entity.impulseVy *= decayFactor;

        if (typeof options.afterDecay === 'function') {
            options.afterDecay(entity, deltaTime);
        }

        const cutoff = options.cutoff != null ? options.cutoff : (entity.impulseCutoff || this.DEFAULTS.enemyCutoff);
        if (Math.abs(entity.impulseVx) < cutoff) entity.impulseVx = 0;
        if (Math.abs(entity.impulseVy) < cutoff) entity.impulseVy = 0;
        if (entity.impulseVx === 0 && entity.impulseVy === 0) {
            entity.impulseTimer = 0;
        }

        return {
            moved: moveResult.actualMoved > 0.0001,
            blocked: !!moveResult.blocked,
            wallSlam,
            wallContact
        };
    }
};

const Geometry = {
    projectPointOnSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq <= 0) {
            const dist = Math.hypot(px - ax, py - ay);
            return { x: ax, y: ay, t: 0, distSq: dist * dist };
        }
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
        const projX = ax + dx * t;
        const projY = ay + dy * t;
        const distX = px - projX;
        const distY = py - projY;
        return { x: projX, y: projY, t, distSq: distX * distX + distY * distY };
    },

    distancePointToSegment(px, py, ax, ay, bx, by) {
        return Math.sqrt(this.projectPointOnSegment(px, py, ax, ay, bx, by).distSq);
    },

    circlesOverlap(x1, y1, r1, x2, y2, r2, options = {}) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const limit = (r1 || 0) + (r2 || 0);
        const distSq = dx * dx + dy * dy;
        const bound = limit * limit;
        return options.inclusive ? distSq <= bound : distSq < bound;
    },

    circleAabbOverlap(x, y, radius, left, top, width, height) {
        const r = radius || 0;
        const closestX = Math.max(left, Math.min(x, left + width));
        const closestY = Math.max(top, Math.min(y, top + height));
        const dx = x - closestX;
        const dy = y - closestY;
        return (dx * dx + dy * dy) <= r * r;
    }
};

ImpulsePhysics.Geometry = Geometry;

window.Engine = window.Engine || {};
window.Engine.Physics = ImpulsePhysics;

// Support existing global and Node imports
window.ImpulsePhysics = ImpulsePhysics;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImpulsePhysics;
}

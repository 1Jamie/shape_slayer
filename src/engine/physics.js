/**
 * @typedef {Object} PhysicsEntity
 * @property {number} x World X position
 * @property {number} y World Y position
 * @property {number} [impulseVx=0] Accumulated impulse X velocity
 * @property {number} [impulseVy=0] Accumulated impulse Y velocity
 * @property {number} [impulseDecay] Exponential decay rate per second
 * @property {number} [impulseMaxSpeed] Maximum speed ceiling
 * @property {number} [impulseCutoff] Velocity cutoff below which impulse is zeroed
 * @property {number} [impulseMaxDuration] Max active impulse duration
 * @property {number} [impulseTimer=0] Active impulse timer accumulator
 * @property {number} [wallSlamCooldown=0] Cooldown timer before next wall slam damage
 * @property {number} [knockbackResistance=1] Mass/resistance scaling factor (>= 0.1)
 * @property {boolean} [hasKnockbackImmunity=false] True if entity ignores all impulse forces
 * @property {any} [lastImpulseSourceId] Source ID for analytics/attribution
 *
 * @typedef {Object} IntegrateResult
 * @property {boolean} moved True if entity moved significantly
 * @property {boolean} blocked True if entity was blocked by wall/obstacle
 * @property {{damage: number, speed: number, sourceId: any}|null} wallSlam Wall slam event payload if triggered
 * @property {boolean} wallContact True if entity impacted a wall during integration
 *
 * @typedef {Object} MoveResult
 * @property {number} actualDx
 * @property {number} actualDy
 * @property {number} actualMoved
 * @property {boolean} [blocked]
 * @property {number} [normalX]
 * @property {number} [normalY]
 */

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

    /**
     * Ensure required impulse fields exist on an entity object.
     * @param {PhysicsEntity} entity
     * @param {{decay?: number, maxSpeed?: number, cutoff?: number, maxDuration?: number}} [options]
     */
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

    /**
     * Calculate scalar speed magnitude of current impulse vector.
     * @param {PhysicsEntity} entity
     * @returns {number}
     */
    getSpeed(entity) {
        const vx = entity && entity.impulseVx ? entity.impulseVx : 0;
        const vy = entity && entity.impulseVy ? entity.impulseVy : 0;
        return Math.hypot(vx, vy);
    },

    /**
     * Clamp impulse velocity magnitude to maxSpeed ceiling.
     * @param {PhysicsEntity} entity
     * @param {number} [maxSpeed]
     */
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
     * Apply an impulse force. By default accumulates into impulseVx/Vy; set replace:true to overwrite.
     * @param {PhysicsEntity} entity Target entity
     * @param {number} forceX Force vector X component
     * @param {number} forceY Force vector Y component
     * @param {Object} [options]
     * @param {number} [options.resistance] Knockback resistance override
     * @param {boolean} [options.replace] Replace existing velocity instead of adding
     * @param {number} [options.maxSpeed] Speed cap override
     * @param {any} [options.sourceId] Source ID for attribution
     * @returns {boolean} True if force was applied successfully.
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
     * @param {PhysicsEntity} entity
     * @returns {number} Scale factor between 0.1 and 1.0.
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
     * @param {PhysicsEntity} entity
     * @param {Object} [info] Contact move collision metadata
     * @param {Object} [options]
     * @returns {boolean} True if wall contact was resolved
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
    /** Non-reentrant scratch objects for zero-allocation integration. */
    _scratchMoveResult: {
        ok: true,
        blocked: false,
        actualMoved: 0,
        intendedMoved: 0,
        actualDx: 0,
        actualDy: 0,
        normalX: null,
        normalY: null
    },
    _scratchWallContactInfo: {
        blocked: false,
        intendedDx: 0,
        intendedDy: 0,
        intendedMoved: 0,
        actualDx: 0,
        actualDy: 0,
        actualMoved: 0,
        normalX: null,
        normalY: null
    },
    _NO_MOVE_RESULT: Object.freeze({
        moved: false,
        blocked: false,
        wallSlam: null,
        wallContact: false
    }),

    /**
     * Integrate impulse velocity for one frame.
     * moveFn(dx, dy) should move the entity and return:
     *   { ok, blocked, actualMoved, intendedMoved, actualDx, actualDy, normalX, normalY }
     *   or a boolean (ok).
     *
     * Note: Uses internal non-reentrant scratch objects for zero-allocation performance.
     * @param {PhysicsEntity} entity
     * @param {number} deltaTime
     * @param {Object} [options]
     * @param {Object} [out] Zero-allocation output object target
     * @returns {Object} Integration result object containing {moved, blocked, wallSlam, wallContact}
     */
    integrate(entity, deltaTime, options = {}, out = null) {
        if (!entity || !(deltaTime > 0)) {
            if (out && typeof out === 'object') {
                out.moved = false;
                out.blocked = false;
                out.wallSlam = null;
                out.wallContact = false;
                return out;
            }
            return this._NO_MOVE_RESULT;
        }
        this.ensureFields(entity, options);

        if (typeof entity.wallSlamCooldown === 'number' && entity.wallSlamCooldown > 0) {
            entity.wallSlamCooldown = Math.max(0, entity.wallSlamCooldown - deltaTime);
        }

        const vx = entity.impulseVx || 0;
        const vy = entity.impulseVy || 0;
        if (vx === 0 && vy === 0) {
            entity.impulseTimer = 0;
            if (out && typeof out === 'object') {
                out.moved = false;
                out.blocked = false;
                out.wallSlam = null;
                out.wallContact = false;
                return out;
            }
            return this._NO_MOVE_RESULT;
        }

        entity.impulseTimer = (entity.impulseTimer || 0) + deltaTime;
        const maxDuration = options.maxDuration != null
            ? options.maxDuration
            : (entity.impulseMaxDuration || this.DEFAULTS.maxDuration);
        if (maxDuration > 0 && entity.impulseTimer >= maxDuration) {
            entity.impulseVx = 0;
            entity.impulseVy = 0;
            entity.impulseTimer = 0;
            if (out && typeof out === 'object') {
                out.moved = false;
                out.blocked = false;
                out.wallSlam = null;
                out.wallContact = false;
                return out;
            }
            return this._NO_MOVE_RESULT;
        }

        const intendedDx = vx * deltaTime;
        const intendedDy = vy * deltaTime;
        const intendedMoved = Math.hypot(intendedDx, intendedDy);
        const speedBefore = Math.hypot(vx, vy);

        const moveResult = this._scratchMoveResult;
        moveResult.ok = true;
        moveResult.blocked = false;
        moveResult.actualMoved = intendedMoved;
        moveResult.intendedMoved = intendedMoved;
        moveResult.actualDx = intendedDx;
        moveResult.actualDy = intendedDy;
        moveResult.normalX = null;
        moveResult.normalY = null;

        if (typeof options.moveFn === 'function') {
            const raw = options.moveFn(intendedDx, intendedDy);
            if (typeof raw === 'boolean') {
                const blocked = !raw;
                moveResult.ok = raw;
                moveResult.blocked = blocked;
                moveResult.actualMoved = blocked ? 0 : intendedMoved;
                moveResult.actualDx = blocked ? 0 : intendedDx;
                moveResult.actualDy = blocked ? 0 : intendedDy;
            } else if (raw && typeof raw === 'object') {
                const actualDx = raw.actualDx != null ? raw.actualDx : (raw.ok === false ? 0 : intendedDx);
                const actualDy = raw.actualDy != null ? raw.actualDy : (raw.ok === false ? 0 : intendedDy);
                moveResult.ok = raw.ok !== false;
                moveResult.blocked = !!raw.blocked;
                moveResult.actualMoved = raw.actualMoved != null ? raw.actualMoved : Math.hypot(actualDx, actualDy);
                moveResult.intendedMoved = raw.intendedMoved != null ? raw.intendedMoved : intendedMoved;
                moveResult.actualDx = actualDx;
                moveResult.actualDy = actualDy;
                moveResult.normalX = raw.normalX;
                moveResult.normalY = raw.normalY;
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
        let wallContact = false;
        if (!skipWallResolve) {
            const contactInfo = this._scratchWallContactInfo;
            contactInfo.blocked = moveResult.blocked || heavilyBlocked;
            contactInfo.intendedDx = intendedDx;
            contactInfo.intendedDy = intendedDy;
            contactInfo.intendedMoved = intendedMoved;
            contactInfo.actualDx = moveResult.actualDx;
            contactInfo.actualDy = moveResult.actualDy;
            contactInfo.actualMoved = moveResult.actualMoved;
            contactInfo.normalX = moveResult.normalX;
            contactInfo.normalY = moveResult.normalY;
            wallContact = this.resolveWallContact(entity, contactInfo, options);
        }

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

        const moved = moveResult.actualMoved > 0.0001;
        const blocked = !!moveResult.blocked;
        if (out && typeof out === 'object') {
            out.moved = moved;
            out.blocked = blocked;
            out.wallSlam = wallSlam;
            out.wallContact = wallContact;
            return out;
        }

        return {
            moved,
            blocked,
            wallSlam,
            wallContact
        };
    },

    /**
     * Batch integrate impulse physics over an array or typed buffer of entities.
     * Fast-path SIMD/L1-cache warm loop with scratch vector reuse.
     * @param {Array<PhysicsEntity>} entities
     * @param {number} deltaTime
     * @param {Object} [options]
     * @param {Array|Float32Array|Float64Array|null} [outResults=null] Optional buffer target
     * @returns {Array|Float32Array|Float64Array} Integrated results buffer
     */
    integrateBatch(entities, deltaTime, options = {}, outResults = null) {
        if (!Array.isArray(entities) || entities.length === 0 || !(deltaTime > 0)) {
            return outResults || [];
        }
        const count = entities.length;
        const isTypedOut = outResults && (outResults instanceof Float32Array || outResults instanceof Float64Array);
        const resArray = !isTypedOut ? (outResults || new Array(count)) : null;

        const scratchOut = this._scratchMoveResult; // Scratch reuse
        for (let i = 0; i < count; i++) {
            const entity = entities[i];
            if (!entity) continue;
            const res = this.integrate(entity, deltaTime, options, scratchOut);
            if (isTypedOut) {
                const offset = i * 4;
                if (offset + 3 < outResults.length) {
                    outResults[offset] = res.moved ? 1 : 0;
                    outResults[offset + 1] = res.blocked ? 1 : 0;
                    outResults[offset + 2] = res.wallContact ? 1 : 0;
                    outResults[offset + 3] = entity.impulseVx || 0;
                }
            } else if (resArray) {
                if (!resArray[i] || typeof resArray[i] !== 'object') {
                    resArray[i] = { moved: res.moved, blocked: res.blocked, wallSlam: res.wallSlam, wallContact: res.wallContact };
                } else {
                    resArray[i].moved = res.moved;
                    resArray[i].blocked = res.blocked;
                    resArray[i].wallSlam = res.wallSlam;
                    resArray[i].wallContact = res.wallContact;
                }
            }
        }
        return isTypedOut ? outResults : resArray;
    }
};

const Geometry = {
    projectPointOnSegment(px, py, ax, ay, bx, by, out = null) {
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSq = dx * dx + dy * dy;
        const res = out && typeof out === 'object' ? out : { x: 0, y: 0, t: 0, distSq: 0 };
        if (lengthSq <= 0) {
            const dist = Math.hypot(px - ax, py - ay);
            res.x = ax;
            res.y = ay;
            res.t = 0;
            res.distSq = dist * dist;
            return res;
        }
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
        const projX = ax + dx * t;
        const projY = ay + dy * t;
        const distX = px - projX;
        const distY = py - projY;
        res.x = projX;
        res.y = projY;
        res.t = t;
        res.distSq = distX * distX + distY * distY;
        return res;
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

class SpatialHash {
    constructor(cellSize = 64) {
        this.cellSize = Math.max(8, Number(cellSize) || 64);
        this.grid = new Map();
    }

    _key(cx, cy) {
        return (cx & 0xFFFF) | ((cy & 0xFFFF) << 16);
    }

    clear() {
        this.grid.clear();
    }

    insert(entity) {
        if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number') return;
        const rad = Math.max(0, Number(entity.radius || entity.size || 0));
        const minX = Math.floor((entity.x - rad) / this.cellSize);
        const maxX = Math.floor((entity.x + rad) / this.cellSize);
        const minY = Math.floor((entity.y - rad) / this.cellSize);
        const maxY = Math.floor((entity.y + rad) / this.cellSize);

        for (let cx = minX; cx <= maxX; cx++) {
            for (let cy = minY; cy <= maxY; cy++) {
                const key = this._key(cx, cy);
                let cell = this.grid.get(key);
                if (!cell) {
                    cell = [];
                    this.grid.set(key, cell);
                }
                cell.push(entity);
            }
        }
    }

    queryRadius(x, y, radius, outResults = null) {
        const results = outResults || [];
        results.length = 0;
        const minX = Math.floor((x - radius) / this.cellSize);
        const maxX = Math.floor((x + radius) / this.cellSize);
        const minY = Math.floor((y - radius) / this.cellSize);
        const maxY = Math.floor((y + radius) / this.cellSize);
        const seen = new Set();

        for (let cx = minX; cx <= maxX; cx++) {
            for (let cy = minY; cy <= maxY; cy++) {
                const key = this._key(cx, cy);
                const cell = this.grid.get(key);
                if (!cell) continue;
                for (let i = 0; i < cell.length; i++) {
                    const item = cell[i];
                    if (seen.has(item)) continue;
                    seen.add(item);
                    const dx = item.x - x;
                    const dy = item.y - y;
                    const itemRad = Math.max(0, Number(item.radius || item.size || 0));
                    const totalRad = radius + itemRad;
                    if (dx * dx + dy * dy <= totalRad * totalRad) {
                        results.push(item);
                    }
                }
            }
        }
        return results;
    }
}

const RigidDebris = {
    computeImpactTorque(hitPoint, center, velocity, mass, category = 'ARC_SLASH') {
        const rx = (hitPoint ? hitPoint.x : 0) - (center ? center.x : 0);
        const ry = (hitPoint ? hitPoint.y : 0) - (center ? center.y : 0);
        const vx = velocity ? (velocity.vx || velocity.x || 0) : 0;
        const vy = velocity ? (velocity.vy || velocity.y || 0) : 0;

        const cross = rx * vy - ry * vx;
        const r2 = rx * rx + ry * ry;

        let massMultiplier = 1.0;
        if (category === 'HEAVY_CRUSH') massMultiplier = 3.5;
        else if (category === 'LINE_PIERCE') massMultiplier = 0.4;
        else if (category === 'ARC_SLASH') massMultiplier = 0.6;
        else if (category === 'THERMAL_BEAM') massMultiplier = 0.8;

        const effectiveMass = Math.max(0.1, (Number(mass) || 1.0) * massMultiplier);
        const inertia = 0.5 * effectiveMass * (r2 + 16);
        return cross / inertia;
    },

    computeIslandPhysics(island, hitPos, impactVel, enemyCenter, archetype = 'slash') {
        const N = Math.max(1, island.cellCount || 1);
        const hx = hitPos ? (hitPos.x || hitPos.hitX || 0) : 0;
        const hy = hitPos ? (hitPos.y || hitPos.hitY || 0) : 0;
        // island.centroid* is enemy-local; hitPos is world — convert via enemyCenter.
        const ex = enemyCenter ? (enemyCenter.x || 0) : 0;
        const ey = enemyCenter ? (enemyCenter.y || 0) : 0;
        const worldCx = ex + (island.centroidX || 0);
        const worldCy = ey + (island.centroidY || 0);

        // Vectors from the wound and from the body center — motion comes from where
        // the plate actually sat, not a shared cup-toss direction.
        const fromHitX = worldCx - hx;
        const fromHitY = worldCy - hy;
        const fromHitDist = Math.hypot(fromHitX, fromHitY) || 1;
        const hitNx = fromHitX / fromHitDist;
        const hitNy = fromHitY / fromHitDist;

        const fromCenterX = worldCx - ex;
        const fromCenterY = worldCy - ey;
        const fromCenterDist = Math.hypot(fromCenterX, fromCenterY) || 1;
        const peelX = fromCenterX / fromCenterDist;
        const peelY = fromCenterY / fromCenterDist;

        const ivx = impactVel ? (impactVel.vx || impactVel.x || 0) : 0;
        const ivy = impactVel ? (impactVel.vy || impactVel.y || 0) : 0;
        const impactLen = Math.hypot(ivx, ivy) || 1;

        const massScale = 0.45 + 0.55 / Math.sqrt(N);
        // Near-wound plates take more of the strike; far plates mostly peel apart.
        const bodySize = Math.max(18, fromCenterDist * 1.15);
        const hitInfluence = Math.exp(-fromHitDist / (bodySize * 0.9));

        const peelSpeed = (70 + 95 / Math.sqrt(N)) * massScale;
        const hitBurst = (55 + 80 / Math.sqrt(N)) * massScale * hitInfluence;
        const impactShare = 0.18 + 0.22 * hitInfluence;

        const vx = ivx * impactShare * massScale
            + peelX * peelSpeed
            + hitNx * hitBurst;
        const vy = ivy * impactShare * massScale
            + peelY * peelSpeed
            + hitNy * hitBurst;

        // Torque from the strike lever arm — keep orientation coherent (no dice spin).
        const cross = fromHitX * ivy - fromHitY * ivx;
        const r2 = fromHitX * fromHitX + fromHitY * fromHitY;
        const inertia = 0.5 * N * (r2 + 16);
        const rotV = (cross / Math.max(inertia, 1))
            * (0.55 / Math.sqrt(N))
            * hitInfluence
            * (impactLen / Math.max(impactLen, 200));

        return {
            vx,
            vy,
            rotV,
            worldX: worldCx,
            worldY: worldCy,
            hitInfluence,
            peelX,
            peelY
        };
    },

    integrateShardPhysics(shard, dt, bounds) {
        dt = Math.min(0.05, Number(dt) || 0.016);
        shard.x += shard.vx * dt;
        shard.y += shard.vy * dt;
        shard.rotation = (shard.rotation || 0) + (shard.rotV || 0) * dt;

        const drag = 1.0 - (shard.drag || 2.5) * dt;
        shard.vx *= Math.max(0, drag);
        shard.vy *= Math.max(0, drag);
        shard.rotV *= Math.max(0, 1.0 - (shard.rotDrag || 3.0) * dt);

        if (bounds) {
            if (shard.x < bounds.minX) { shard.x = bounds.minX; shard.vx *= -0.6; }
            if (shard.x > bounds.maxX) { shard.x = bounds.maxX; shard.vx *= -0.6; }
            if (shard.y < bounds.minY) { shard.y = bounds.minY; shard.vy *= -0.6; }
            if (shard.y > bounds.maxY) { shard.y = bounds.maxY; shard.vy *= -0.6; }
        }
    }
};

ImpulsePhysics.Geometry = Geometry;
ImpulsePhysics.SpatialHash = SpatialHash;
ImpulsePhysics.RigidDebris = RigidDebris;

const root = typeof window !== 'undefined' ? window : globalThis;
root.Engine = root.Engine || {};
root.Engine.Physics = ImpulsePhysics;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImpulsePhysics;
}

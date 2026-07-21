/**
 * @typedef {Object} StateInterpolationResult
 * @property {any} older
 * @property {any} newer
 * @property {number} t Interpolation factor
 * @property {number} olderTime
 * @property {number} newerTime
 *
 * @typedef {Object} StateVelocityResult
 * @property {number} vx
 * @property {number} vy
 * @property {number} vr
 */

(function(root) {
    const Engine = root.Engine = root.Engine || {};

    const DEFAULTS = Object.freeze({
        interpolationDelay: 100,
        maxInterpolationDelay: 200,
        extrapolationLimit: 100,
        stateBufferSize: 15,
        snapDistance: 100,
        extrapolationWeight: 0.7,
        smoothingFactor: 0.15,
        maxExtrapolationDistance: 50,
        maxExtrapolationSeconds: 0.2,
        jitterCompensationScale: 1.5,
        maxJitterCompensation: 50
    });

    class StateBuffer {
        constructor(maxSize = DEFAULTS.stateBufferSize) {
            this.states = [];
            this.maxSize = maxSize;
            this.adaptiveMaxSize = maxSize;
            this._wrapperPool = [];
        }

        adjustSize(jitter, packetLossRate) {
            let multiplier = 1;
            if (jitter > 50) multiplier = 1.5;
            else if (jitter > 20) multiplier = 1.2;
            if (packetLossRate > 0.1) multiplier = Math.max(multiplier, 1.8);
            else if (packetLossRate > 0.05) multiplier = Math.max(multiplier, 1.3);
            this.adaptiveMaxSize = Math.ceil(this.maxSize * multiplier);
            return this.adaptiveMaxSize;
        }

        addState(timestamp, data) {
            let i = this.states.length - 1;
            while (i >= 0 && this.states[i].timestamp > timestamp) {
                const discarded = this.states.pop();
                if (this._wrapperPool.length < 64) this._wrapperPool.push(discarded);
                i--;
            }

            let entry;
            if (this._wrapperPool.length > 0) {
                entry = this._wrapperPool.pop();
                entry.timestamp = timestamp;
                entry.data = data;
            } else {
                entry = { timestamp, data };
            }
            this.states.push(entry);

            const limit = this.adaptiveMaxSize || this.maxSize;
            while (this.states.length > limit) {
                const removed = this.states.shift();
                if (this._wrapperPool.length < 64) this._wrapperPool.push(removed);
            }
        }

        getInterpolatedState(targetTime, delay = DEFAULTS.interpolationDelay, out = null) {
            if (this.states.length < 2) return null;
            const renderTime = targetTime - delay;
            let older = null;
            let newer = null;

            for (let i = 0; i < this.states.length - 1; i++) {
                if (this.states[i].timestamp <= renderTime && renderTime <= this.states[i + 1].timestamp) {
                    older = this.states[i];
                    newer = this.states[i + 1];
                    break;
                }
            }
            if (!older && renderTime < this.states[0].timestamp) {
                older = this.states[0];
                newer = this.states[1];
            }
            if (!older) {
                older = this.states[this.states.length - 2];
                newer = this.states[this.states.length - 1];
            }

            const range = newer.timestamp - older.timestamp;
            let amount = range > 0 ? (renderTime - older.timestamp) / range : 0;
            if (renderTime < older.timestamp) amount = -0.1;
            else if (renderTime > newer.timestamp) amount = 1.1;

            if (out && typeof out === 'object') {
                out.older = older.data;
                out.newer = newer.data;
                out.t = amount;
                out.olderTime = older.timestamp;
                out.newerTime = newer.timestamp;
                return out;
            }
            return {
                older: older.data,
                newer: newer.data,
                t: amount,
                olderTime: older.timestamp,
                newerTime: newer.timestamp
            };
        }

        getLatestState() {
            return this.states.length ? this.states[this.states.length - 1].data : null;
        }

        getPreviousState() {
            return this.states.length > 1 ? this.states[this.states.length - 2].data : null;
        }

        calculateVelocity(out = null) {
            if (this.states.length < 2) return null;
            const latestEntry = this.states[this.states.length - 1];
            const previousEntry = this.states[this.states.length - 2];
            const elapsed = (latestEntry.timestamp - previousEntry.timestamp) / 1000;
            if (elapsed <= 0) return null;
            const latest = latestEntry.data;
            const previous = previousEntry.data;
            const vx = (latest.x - previous.x) / elapsed;
            const vy = (latest.y - previous.y) / elapsed;
            const vr = latest.rotation !== undefined && previous.rotation !== undefined
                ? this.normalizeRotationDiff(latest.rotation - previous.rotation) / elapsed
                : 0;
            if (out && typeof out === 'object') {
                out.vx = vx;
                out.vy = vy;
                out.vr = vr;
                return out;
            }
            return { vx, vy, vr };
        }

        normalizeRotationDiff(diff) {
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            return diff;
        }

        cleanup(maxAge = 1000, currentTime = Date.now()) {
            let keepCount = 0;
            for (let i = 0; i < this.states.length; i++) {
                if (currentTime - this.states[i].timestamp < maxAge) {
                    this.states[keepCount++] = this.states[i];
                } else if (this._wrapperPool.length < 64) {
                    this._wrapperPool.push(this.states[i]);
                }
            }
            this.states.length = keepCount;
        }

        clear() {
            while (this.states.length > 0) {
                const item = this.states.pop();
                if (this._wrapperPool.length < 64) this._wrapperPool.push(item);
            }
        }
    }

    class Interpolator {
        constructor(options = {}) {
            const supplied = options.config || options;
            this.config = Object.assign({}, DEFAULTS, supplied);
            this.getStats = typeof options.getStats === 'function' ? options.getStats : null;
            this.buffers = new Map();
            this.networkLatency = 0;
            this.jitter = 0;
            this.packetLossRate = 0;
            this.baseInterpolationDelay = this.config.interpolationDelay;
            this.interpolationDelay = this.baseInterpolationDelay;
        }

        updateLatency(roundTripTime) {
            this.networkLatency = Math.max(0, roundTripTime || 0) / 2;
            this.updateInterpolationDelay();
        }

        updateJitter(jitter) {
            this.jitter = Math.max(0, jitter || 0);
            this.updateInterpolationDelay();
        }

        updateStats(stats = {}) {
            if (Number.isFinite(stats.rtt)) this.networkLatency = Math.max(0, stats.rtt) / 2;
            if (Number.isFinite(stats.jitter)) this.jitter = Math.max(0, stats.jitter);
            if (Number.isFinite(stats.packetLossRate)) {
                this.packetLossRate = Math.max(0, stats.packetLossRate);
            }
            this.updateInterpolationDelay();
        }

        updateInterpolationDelay() {
            const compensation = Math.min(
                this.jitter * this.config.jitterCompensationScale,
                this.config.maxJitterCompensation
            );
            this.interpolationDelay = Math.min(
                this.baseInterpolationDelay + this.networkLatency + compensation,
                this.config.maxInterpolationDelay
            );
        }

        addEntityState(entityId, timestamp, stateData) {
            if (!this.buffers.has(entityId)) {
                this.buffers.set(entityId, new StateBuffer(this.config.stateBufferSize));
            }
            const stats = this.getStats ? this.getStats() : null;
            if (stats) this.updateStats(stats);
            const buffer = this.buffers.get(entityId);
            buffer.adjustSize(this.jitter, this.packetLossRate);
            const sourceTime = stateData.timestamp || stateData.serverSendTime || timestamp;
            buffer.addState(sourceTime, stateData);
        }

        getInterpolatedState(entityId, currentTime) {
            const buffer = this.buffers.get(entityId);
            return buffer ? buffer.getInterpolatedState(currentTime, this.interpolationDelay) : null;
        }

        getExtrapolatedState(entityId, currentTime, limit = this.config.extrapolationLimit) {
            const buffer = this.buffers.get(entityId);
            if (!buffer || !buffer.states.length) return null;
            const latestEntry = buffer.states[buffer.states.length - 1];
            const elapsedMs = currentTime - latestEntry.timestamp;
            if (elapsedMs > limit) return null;
            const velocity = buffer.calculateVelocity();
            if (!velocity) return latestEntry.data;
            const elapsed = elapsedMs / 1000;
            return Object.assign({}, latestEntry.data, {
                x: latestEntry.data.x + velocity.vx * elapsed,
                y: latestEntry.data.y + velocity.vy * elapsed,
                rotation: latestEntry.data.rotation !== undefined
                    ? latestEntry.data.rotation + velocity.vr * elapsed
                    : latestEntry.data.rotation
            });
        }

        getSmoothedPosition(entityId, currentX, currentY, currentRotation, targetX, targetY, targetRotation, deltaTime, currentTime = Date.now()) {
            const buffer = this.buffers.get(entityId);
            if (!buffer || !buffer.states.length) {
                return { x: targetX, y: targetY, rotation: targetRotation };
            }
            const latestTime = buffer.states[buffer.states.length - 1].timestamp;
            const elapsed = Math.max(0, (currentTime - latestTime) / 1000);
            let projectedX = targetX;
            let projectedY = targetY;
            if (elapsed > 0 && elapsed < this.config.maxExtrapolationSeconds) {
                const velocity = buffer.calculateVelocity();
                if (velocity) {
                    const dx = velocity.vx * elapsed;
                    const dy = velocity.vy * elapsed;
                    const distance = Math.hypot(dx, dy);
                    if (distance > 0 && distance < this.config.maxExtrapolationDistance) {
                        projectedX += dx;
                        projectedY += dy;
                    }
                }
            }

            const weight = this.config.extrapolationWeight;
            const blendedX = targetX * (1 - weight) + projectedX * weight;
            const blendedY = targetY * (1 - weight) + projectedY * weight;
            const dx = blendedX - currentX;
            const dy = blendedY - currentY;
            const distance = Math.hypot(dx, dy);
            if (distance > this.config.snapDistance || distance < 0.5) {
                return { x: targetX, y: targetY, rotation: targetRotation };
            }

            const amount = 1 - Math.pow(1 - this.config.smoothingFactor, deltaTime * 60);
            let rotation = currentRotation;
            if (targetRotation !== null && targetRotation !== undefined) {
                let diff = targetRotation - currentRotation;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                rotation += diff * amount;
            }
            return {
                x: currentX + dx * amount,
                y: currentY + dy * amount,
                rotation
            };
        }

        removeEntity(entityId) {
            this.buffers.delete(entityId);
        }

        cleanup(maxAge, currentTime = Date.now()) {
            this.buffers.forEach(buffer => buffer.cleanup(maxAge, currentTime));
        }

        clear() {
            this.buffers.clear();
        }
    }

    function deepClone(value, seen = new WeakMap()) {
        if (value === null || typeof value !== 'object') {
            return value;
        }
        if (seen.has(value)) {
            return null;
        }
        let clone;
        if (Array.isArray(value)) {
            clone = [];
            seen.set(value, clone);
            value.forEach((item, index) => {
                clone[index] = deepClone(item, seen);
            });
            return clone;
        }
        clone = {};
        seen.set(value, clone);
        Object.keys(value).forEach(key => {
            clone[key] = deepClone(value[key], seen);
        });
        return clone;
    }

    function valuesEqual(a, b, tolerance = 0) {
        if (a === b) return true;
        if (a === undefined || b === undefined) return false;
        if (a === null || b === null) return a === b;

        if (typeof a === 'number' && typeof b === 'number') {
            if (!Number.isFinite(a) || !Number.isFinite(b)) {
                return a === b;
            }
            return Math.abs(a - b) <= tolerance;
        }

        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (!valuesEqual(a[i], b[i], tolerance)) {
                    return false;
                }
            }
            return true;
        }

        if (typeof a === 'object' && typeof b === 'object') {
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);
            if (aKeys.length !== bKeys.length) return false;
            for (const key of aKeys) {
                if (!valuesEqual(a[key], b[key], tolerance)) {
                    return false;
                }
            }
            return true;
        }

        return false;
    }

    function computeObjectDiff(current, previous, options = {}, keyName) {
        const diff = {};
        let hasChanges = false;
        const ignore = options.ignoreKeys || [];
        const tolerance = options.numericTolerance || 0;
        const criticalFields = options.criticalFields || [];

        Object.keys(current).forEach(prop => {
            if (prop === keyName) return;
            if (ignore.includes(prop)) return;
            const currVal = current[prop];
            const prevVal = previous[prop];
            const isCritical = criticalFields.includes(prop);
            const fieldTolerance = isCritical ? 0 : tolerance;

            if (!valuesEqual(currVal, prevVal, fieldTolerance)) {
                diff[prop] = deepClone(currVal);
                hasChanges = true;
            }
        });

        return hasChanges ? diff : null;
    }

    function diffById(currentList = [], previousList = [], key = 'id', options = {}) {
        const changed = [];
        const removed = [];

        const prevMap = new Map();
        if (Array.isArray(previousList)) {
            previousList.forEach(item => {
                if (item && item[key] !== undefined && item[key] !== null) {
                    prevMap.set(item[key], item);
                }
            });
        }

        const seenIds = new Set();
        if (Array.isArray(currentList)) {
            currentList.forEach(item => {
                if (!item || item[key] === undefined || item[key] === null) return;
                const id = item[key];
                seenIds.add(id);

                const prevItem = prevMap.get(id);
                if (!prevItem) {
                    changed.push(deepClone(item));
                    return;
                }

                const diff = computeObjectDiff(item, prevItem, options, key);
                if (diff) {
                    diff[key] = id;
                    changed.push(diff);
                }
            });
        }

        prevMap.forEach((_value, id) => {
            if (!seenIds.has(id)) {
                removed.push(id);
            }
        });

        return { changed, removed };
    }

    Engine.Net = {
        DEFAULTS,
        StateBuffer,
        Interpolator,
        deepClone,
        valuesEqual,
        computeObjectDiff,
        diffById
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Engine.Net;
    }
})(typeof window !== 'undefined' ? window : globalThis);

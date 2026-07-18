// Client-side interpolation and smoothing system for multiplayer
// Provides smooth rendering at 60fps despite 30Hz network updates

class StateBuffer {
    constructor(maxSize = 15) {
        this.states = []; // Array of {timestamp, data} objects
        this.maxSize = maxSize;
        this.adaptiveMaxSize = maxSize; // Adaptive size based on network conditions
    }
    
    // Adjust buffer size based on network conditions (jitter, packet loss)
    adjustSize(jitter, packetLossRate) {
        // Increase buffer size during high jitter or packet loss
        let sizeMultiplier = 1.0;
        
        if (jitter > 50) {
            // High jitter - increase buffer
            sizeMultiplier = 1.5;
        } else if (jitter > 20) {
            // Moderate jitter
            sizeMultiplier = 1.2;
        }
        
        if (packetLossRate > 0.1) {
            // High packet loss - increase buffer more
            sizeMultiplier = Math.max(sizeMultiplier, 1.8);
        } else if (packetLossRate > 0.05) {
            // Moderate packet loss
            sizeMultiplier = Math.max(sizeMultiplier, 1.3);
        }
        
        this.adaptiveMaxSize = Math.ceil(this.maxSize * sizeMultiplier);
    }
    
    // Add a new state snapshot
    addState(timestamp, data) {
        // Remove states older than the new one (shouldn't happen, but safety)
        this.states = this.states.filter(s => s.timestamp <= timestamp);
        
        // Add new state
        this.states.push({ timestamp, data });
        
        // Sort by timestamp (oldest first)
        this.states.sort((a, b) => a.timestamp - b.timestamp);
        
        // Limit buffer size (use adaptive size)
        const maxSize = this.adaptiveMaxSize || this.maxSize;
        if (this.states.length > maxSize) {
            this.states.shift(); // Remove oldest
        }
    }
    
    // Get interpolated state at a specific time
    // Returns null if we don't have enough data
    getInterpolatedState(targetTime, interpolationDelay = 100) {
        const renderTime = targetTime - interpolationDelay;
        
        // Need at least 2 states to interpolate
        if (this.states.length < 2) {
            return null;
        }
        
        // Find the two states to interpolate between
        let olderState = null;
        let newerState = null;
        
        for (let i = 0; i < this.states.length - 1; i++) {
            const state1 = this.states[i];
            const state2 = this.states[i + 1];
            
            if (state1.timestamp <= renderTime && renderTime <= state2.timestamp) {
                olderState = state1;
                newerState = state2;
                break;
            }
        }
        
        // If renderTime is before all states, use oldest two for extrapolation
        if (!olderState && this.states.length >= 2) {
            olderState = this.states[0];
            newerState = this.states[1];
        }
        
        // If renderTime is after all states, use newest two for extrapolation
        if (!olderState && this.states.length >= 2) {
            olderState = this.states[this.states.length - 2];
            newerState = this.states[this.states.length - 1];
        }
        
        if (!olderState || !newerState) {
            return null;
        }
        
        // Calculate interpolation factor
        const timeRange = newerState.timestamp - olderState.timestamp;
        let t = 0;
        
        if (timeRange > 0) {
            t = (renderTime - olderState.timestamp) / timeRange;
        }
        
        // Clamp t for interpolation (0-1), allow slight extrapolation beyond
        if (renderTime < olderState.timestamp) {
            t = -0.1; // Slight backward extrapolation
        } else if (renderTime > newerState.timestamp) {
            t = 1.1; // Slight forward extrapolation
        }
        
        return {
            older: olderState.data,
            newer: newerState.data,
            t: t,
            olderTime: olderState.timestamp,
            newerTime: newerState.timestamp
        };
    }
    
    // Get the most recent state
    getLatestState() {
        if (this.states.length === 0) return null;
        return this.states[this.states.length - 1].data;
    }
    
    // Get the second most recent state (for velocity calculation)
    getPreviousState() {
        if (this.states.length < 2) return null;
        return this.states[this.states.length - 2].data;
    }
    
    // Calculate velocity from last two states
    calculateVelocity() {
        const latest = this.getLatestState();
        const previous = this.getPreviousState();
        
        if (!latest || !previous || !latest.timestamp || !previous.timestamp) {
            return null;
        }
        
        const dt = (latest.timestamp - previous.timestamp) / 1000; // Convert to seconds
        if (dt <= 0) return null;
        
        const dx = latest.x - previous.x;
        const dy = latest.y - previous.y;
        
        return {
            vx: dx / dt,
            vy: dy / dt,
            vr: latest.rotation !== undefined && previous.rotation !== undefined 
                ? this.normalizeRotationDiff(latest.rotation - previous.rotation) / dt 
                : 0
        };
    }
    
    // Normalize rotation difference to [-PI, PI]
    normalizeRotationDiff(diff) {
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return diff;
    }
    
    // Clean up old states (called periodically)
    cleanup(maxAge = 1000) {
        const now = Date.now();
        this.states = this.states.filter(s => (now - s.timestamp) < maxAge);
    }
    
    // Clear all states
    clear() {
        this.states = [];
    }
}

class InterpolationManager {
    constructor() {
        this.buffers = new Map(); // Map<entityId, StateBuffer>
        this.networkLatency = 0; // Estimated RTT / 2
        this.interpolationDelay = MultiplayerConfig.INTERPOLATION_DELAY;
        this.jitter = 0; // Measured jitter from packet arrival times
        this.baseInterpolationDelay = MultiplayerConfig.INTERPOLATION_DELAY;
    }
    
    // Update network latency estimate
    updateLatency(rtt) {
        this.networkLatency = rtt / 2; // One-way latency
        // Adjust interpolation delay based on latency, but cap it
        this.updateInterpolationDelay();
    }
    
    // Update jitter measurement and adjust interpolation delay
    updateJitter(jitter) {
        this.jitter = jitter || 0;
        this.updateInterpolationDelay();
    }
    
    // Calculate adaptive interpolation delay based on latency and jitter
    updateInterpolationDelay() {
        // Base delay + latency + jitter compensation
        // Jitter compensation: add extra buffer for high jitter to smooth out irregularities
        const jitterCompensation = Math.min(this.jitter * 1.5, 50); // Cap jitter compensation at 50ms
        const adaptiveDelay = this.baseInterpolationDelay + this.networkLatency + jitterCompensation;
        
        // Cap at maximum delay
        this.interpolationDelay = Math.min(
            adaptiveDelay,
            MultiplayerConfig.MAX_INTERPOLATION_DELAY
        );
    }
    
    // Add state update for an entity
    // Uses authoritative timestamp from host/server for accurate interpolation timing
    addEntityState(entityId, timestamp, stateData) {
        if (!this.buffers.has(entityId)) {
            this.buffers.set(entityId, new StateBuffer(MultiplayerConfig.STATE_BUFFER_SIZE));
        }
        
        const buffer = this.buffers.get(entityId);
        
        // Adjust buffer size based on network conditions
        if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.getPacketMetrics) {
            const metrics = multiplayerManager.getPacketMetrics();
            buffer.adjustSize(metrics.jitter || 0, metrics.packetLossRate || 0);
        }
        
        // Use authoritative timestamp from stateData if available (more accurate than local timestamp)
        const authoritativeTimestamp = stateData.timestamp || stateData.serverSendTime || timestamp;
        buffer.addState(authoritativeTimestamp, stateData);
    }
    
    // Get interpolated state for an entity
    getInterpolatedState(entityId, currentTime) {
        const buffer = this.buffers.get(entityId);
        if (!buffer) return null;
        
        return buffer.getInterpolatedState(currentTime, this.interpolationDelay);
    }
    
    // Get extrapolated state (when buffer is empty or too old)
    getExtrapolatedState(entityId, currentTime, maxExtrapolation = MultiplayerConfig.EXTRAPOLATION_LIMIT) {
        const buffer = this.buffers.get(entityId);
        if (!buffer) return null;
        
        const latest = buffer.getLatestState();
        if (!latest) return null;
        
        const latestTimestamp = buffer.states[buffer.states.length - 1]?.timestamp;
        if (!latestTimestamp) return null;
        
        const timeSinceUpdate = currentTime - latestTimestamp;
        if (timeSinceUpdate > maxExtrapolation) {
            return null; // Too old, don't extrapolate
        }
        
        // Calculate velocity from last two states
        const velocity = buffer.calculateVelocity();
        if (!velocity) return latest;
        
        // Extrapolate position based on velocity
        const extrapolationTime = timeSinceUpdate / 1000; // Convert to seconds
        
        return {
            x: latest.x + velocity.vx * extrapolationTime,
            y: latest.y + velocity.vy * extrapolationTime,
            rotation: latest.rotation !== undefined 
                ? latest.rotation + velocity.vr * extrapolationTime 
                : latest.rotation,
            // Copy other properties from latest
            ...latest
        };
    }
    
    // Smooth interpolation with velocity-based extrapolation for players
    // Returns the position to render at, given current position and target
    getSmoothedPosition(entityId, currentX, currentY, currentRotation, targetX, targetY, targetRotation, deltaTime) {
        const snapDistance = typeof MultiplayerConfig !== 'undefined' 
            ? MultiplayerConfig.SNAP_DISTANCE 
            : 100;
        const extrapolationWeight = typeof MultiplayerConfig !== 'undefined'
            ? MultiplayerConfig.EXTRAPOLATION_WEIGHT
            : 0.7;
        const smoothingFactor = typeof MultiplayerConfig !== 'undefined'
            ? MultiplayerConfig.SMOOTHING_FACTOR
            : 0.15;
        const maxExtrapolationDist = typeof MultiplayerConfig !== 'undefined'
            ? MultiplayerConfig.MAX_EXTRAPOLATION_DISTANCE
            : 50;
        
        // Get buffer for velocity calculation
        const buffer = this.buffers.get(entityId);
        if (!buffer) {
            // No buffer, just return target
            return { x: targetX, y: targetY, rotation: targetRotation };
        }
        
        // Calculate time since last update
        const latestTimestamp = buffer.states[buffer.states.length - 1]?.timestamp;
        const timeSinceUpdate = latestTimestamp 
            ? (Date.now() - latestTimestamp) / 1000 
            : 0;
        
        // Calculate velocity-based extrapolated position
        let extrapolatedX = targetX;
        let extrapolatedY = targetY;
        
        if (timeSinceUpdate > 0 && timeSinceUpdate < 0.2) { // Max 200ms extrapolation
            const velocity = buffer.calculateVelocity();
            if (velocity) {
                const extrapolationDx = velocity.vx * timeSinceUpdate;
                const extrapolationDy = velocity.vy * timeSinceUpdate;
                
                // Limit extrapolation distance to prevent overshooting
                const extrapolationDist = Math.sqrt(extrapolationDx * extrapolationDx + extrapolationDy * extrapolationDy);
                if (extrapolationDist > 0 && extrapolationDist < maxExtrapolationDist) {
                    extrapolatedX = targetX + extrapolationDx;
                    extrapolatedY = targetY + extrapolationDy;
                }
            }
        }
        
        // Blend between target position and extrapolated position
        const blendedTargetX = targetX * (1 - extrapolationWeight) + extrapolatedX * extrapolationWeight;
        const blendedTargetY = targetY * (1 - extrapolationWeight) + extrapolatedY * extrapolationWeight;
        
        // Calculate distance to blended target
        const dx = blendedTargetX - currentX;
        const dy = blendedTargetY - currentY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If very far from target, snap to prevent rubber-banding
        if (distance > snapDistance) {
            return { x: targetX, y: targetY, rotation: targetRotation };
        }
        
        // Use exponential smoothing for very smooth interpolation
        const smoothingT = 1 - Math.pow(1 - smoothingFactor, deltaTime * 60);
        
        const newX = currentX + dx * smoothingT;
        const newY = currentY + dy * smoothingT;
        
        // Interpolate rotation (handle wrapping)
        let newRotation = currentRotation;
        if (targetRotation !== null && targetRotation !== undefined) {
            let rotDiff = targetRotation - currentRotation;
            // Normalize to [-PI, PI]
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            newRotation = currentRotation + rotDiff * smoothingT;
        }
        
        // Snap to target if very close to prevent micro-jitter
        if (distance < 0.5) {
            return { x: targetX, y: targetY, rotation: targetRotation };
        }
        
        return { x: newX, y: newY, rotation: newRotation };
    }
    
    // Remove entity buffer (when entity is destroyed)
    removeEntity(entityId) {
        this.buffers.delete(entityId);
    }
    
    // Clean up old buffers
    cleanup() {
        this.buffers.forEach(buffer => buffer.cleanup());
    }
    
    // Clear all buffers
    clear() {
        this.buffers.clear();
    }
}

// Global interpolation manager instance
let interpolationManager = null;

// Initialize interpolation manager
function initInterpolation() {
    if (!interpolationManager) {
        interpolationManager = new InterpolationManager();
    }
    return interpolationManager;
}

// Export for global access
if (typeof window !== 'undefined') {
    window.InterpolationManager = InterpolationManager;
    window.StateBuffer = StateBuffer;
    window.interpolationManager = null;
    window.initInterpolation = initInterpolation;
}









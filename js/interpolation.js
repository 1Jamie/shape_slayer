// Client-side interpolation and smoothing system for multiplayer
// Provides smooth rendering at 60fps despite 30Hz network updates

class StateBuffer {
    constructor(maxSize = 15) {
        this.states = []; // Array of {timestamp, data} objects
        this.maxSize = maxSize;
    }
    
    // Add a new state snapshot
    addState(timestamp, data) {
        // Remove states older than the new one (shouldn't happen, but safety)
        this.states = this.states.filter(s => s.timestamp <= timestamp);
        
        // Add new state
        this.states.push({ timestamp, data });
        
        // Sort by timestamp (oldest first)
        this.states.sort((a, b) => a.timestamp - b.timestamp);
        
        // Limit buffer size
        if (this.states.length > this.maxSize) {
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
    }
    
    // Update network latency estimate
    updateLatency(rtt) {
        this.networkLatency = rtt / 2; // One-way latency
        // Adjust interpolation delay based on latency, but cap it
        this.interpolationDelay = Math.min(
            MultiplayerConfig.INTERPOLATION_DELAY + this.networkLatency,
            MultiplayerConfig.MAX_INTERPOLATION_DELAY
        );
    }
    
    // Add state update for an entity
    addEntityState(entityId, timestamp, stateData) {
        if (!this.buffers.has(entityId)) {
            this.buffers.set(entityId, new StateBuffer(MultiplayerConfig.STATE_BUFFER_SIZE));
        }
        
        const buffer = this.buffers.get(entityId);
        buffer.addState(timestamp, stateData);
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


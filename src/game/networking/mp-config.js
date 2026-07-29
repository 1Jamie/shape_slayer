// Multiplayer server configuration
// This file is always loaded (small footprint) so the multiplayer module can access it

const DEFAULT_PRODUCTION_MP_SERVER = 'wss://shape-slayer.gpe.pet';

// Hostnames where the game and MP server share the same origin (Caddy reverse-proxies WS).
const SAME_ORIGIN_MP_HOSTS = new Set([
    'shape-slayer.gpe.pet',
    'www.shape-slayer.gpe.pet'
]);

function hostUsesSameOriginMultiplayer(hostname) {
    if (!hostname) {
        return false;
    }
    if (SAME_ORIGIN_MP_HOSTS.has(hostname)) {
        return true;
    }
    return hostname.endsWith('.gpe.pet') && !hostname.startsWith('metrics.');
}

function resolveMultiplayerServerUrl() {
    if (typeof window !== 'undefined') {
        if (typeof window.MULTIPLAYER_SERVER_URL === 'string' && window.MULTIPLAYER_SERVER_URL.trim()) {
            return window.MULTIPLAYER_SERVER_URL.trim();
        }

        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'ws://localhost:4000';
        }

        if (window.location.protocol === 'https:' && hostUsesSameOriginMultiplayer(host)) {
            return `wss://${host}`;
        }
    }

    return DEFAULT_PRODUCTION_MP_SERVER;
}

const MultiplayerConfig = {
    SERVER_URL: resolveMultiplayerServerUrl(),

    // Connection settings
    RECONNECT_ATTEMPTS: 3,
    RECONNECT_DELAY: 2000, // milliseconds
    HEARTBEAT_INTERVAL: 30000, // milliseconds (30 seconds)
    MAX_REDIRECT_HOPS: 2, // directory-owner redirects before aborting

    // State synchronization settings
    STATE_UPDATE_RATE: 30, // Hz - host sends game state at this rate (30 = 30 updates per second)

    // Sequence tracking and packet loss detection
    MAX_SEQUENCE_GAP: 3, // Maximum allowed sequence gap before requesting resync
    SEQUENCE_BUFFER_SIZE: 10, // Buffer size for out-of-order packet handling
    RESYNC_REQUEST_COOLDOWN: 1000, // Milliseconds between resync requests (prevent spam)

    // Lobby settings
    MAX_PLAYERS: 4,
    CODE_LENGTH: 6,

    // Interpolation settings
    INTERPOLATION_DELAY: 100, // milliseconds - buffer states before rendering
    MAX_INTERPOLATION_DELAY: 200, // milliseconds - max delay even with high latency
    EXTRAPOLATION_LIMIT: 100, // milliseconds - max time to extrapolate without updates
    STATE_BUFFER_SIZE: 15, // maximum number of state snapshots to buffer
    BASE_LERP_SPEED: 10, // base interpolation speed (higher = faster catch-up)
    MIN_LERP_SPEED: 5, // minimum lerp speed
    MAX_LERP_SPEED: 20, // maximum lerp speed
    SNAP_DISTANCE: 100, // pixels - snap to target if further than this

    // Advanced interpolation parameters for smoother movement
    EXTRAPOLATION_WEIGHT: 0.7, // Blend factor for extrapolation (0-1, higher = more prediction)
    SMOOTHING_FACTOR: 0.15, // Exponential smoothing factor (0-1, lower = smoother)
    VELOCITY_SMOOTHING: 0.8, // Smooth velocity changes (0-1, higher = more smoothing)
    MAX_EXTRAPOLATION_DISTANCE: 50, // Max pixels to extrapolate from last known position
    POSITION_HISTORY_SIZE: 3, // Number of recent positions to track for velocity calculation

    // Client movement prediction / rollback
    PREDICTION_ENABLED: true,
    INPUT_HISTORY_SIZE: 90, // ~1.5s at 60fps
    RECONCILE_SNAP_DISTANCE: 80, // Hard snap if error exceeds this (px)
    RECONCILE_SOFT_DISTANCE: 5, // Ignore tiny errors (px)
    RECONCILE_BLEND_FACTOR: 0.35, // Medium-error: pull toward auth before replay (0-1)
    PREDICTION_CORRECTION_DECAY: 0.85, // Per-frame decay of visual correction offset (higher = linger longer)
    PREDICTION_DIVERGENCE_THRESHOLD: 8, // px - count as significant when reconcile moves pose by more than this
    PREDICTION_MAX_REPLAY_STEPS: 45, // Cap rewind/replay length to limit compounding

    // Mobile specific prediction tuning for touch controls
    MOBILE_RECONCILE_SOFT_DISTANCE: 12, // Ignore larger touch jitter (px)
    MOBILE_RECONCILE_BLEND_FACTOR: 0.20, // Gentler pull towards auth state on touch
    MOBILE_PREDICTION_CORRECTION_DECAY: 0.70, // Faster decay of visual offsets to prevent rubberband lingering

    // Systematic drift self-correction (client-side bias from reconcile patterns)
    PREDICTION_DRIFT_WINDOW: 12, // Recent reconcile samples for pattern detection
    PREDICTION_DRIFT_COHERENCE: 0.62, // Mean/avgMagnitude - how consistent direction must be
    PREDICTION_DRIFT_MIN_MEAN: 4, // px mean correction before engaging bias
    PREDICTION_DRIFT_STRENGTH: 0.45, // How strongly to adopt detected mean into bias
    PREDICTION_DRIFT_APPLY: 2.5, // Bias velocity scale (px/s per px of bias) during live predict
    PREDICTION_DRIFT_MAX: 28, // Cap bias magnitude (px)
    PREDICTION_DRIFT_DECAY: 0.92 // Per-reconcile decay when pattern breaks
};

if (typeof window !== 'undefined') {
    window.MultiplayerConfig = MultiplayerConfig;
    console.log(`[Multiplayer] Server URL: ${MultiplayerConfig.SERVER_URL}`);
}

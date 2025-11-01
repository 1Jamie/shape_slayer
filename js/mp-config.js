// Multiplayer server configuration
// This file is always loaded (small footprint) so the multiplayer module can access it

const MultiplayerConfig = {
    // CHANGE THIS to point to your multiplayer server
    // For local testing: 'ws://localhost:4000'
    // For production: 'wss://yourdomain.com' or 'ws://your-server-ip:4000'
    SERVER_URL: 'wss://shape-slayer.goodgirl.software',
    
    // Connection settings
    RECONNECT_ATTEMPTS: 3,
    RECONNECT_DELAY: 2000, // milliseconds
    HEARTBEAT_INTERVAL: 30000, // milliseconds (30 seconds)
    
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
    SNAP_DISTANCE: 100 // pixels - snap to target if further than this
};


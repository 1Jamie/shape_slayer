// Load environment variables from .env file
require('dotenv').config();

const os = require('os');

// ============================================================================
// CONFIGURATION - Modify these settings as needed
// ============================================================================
// All settings can be configured via .env file or environment variables
// See .env.example for full documentation
// ============================================================================

// ----------------------------------------------------------------------------
// SERVER MODE - Choose one of three modes:
// ----------------------------------------------------------------------------
// 'single'     - Single server, single thread (default, simplest)
//                Best for: 100-1,000 players, development
//
// 'multi'      - Single server, multi-core with Redis (acts as master)
//                Best for: 1,000-5,000 players, production single-server
//                Requires: Docker installed (auto-manages Redis)
//
// 'slave'      - Multi-server mode, connects to master's Redis
//                Best for: 5,000+ players, horizontal scaling
//                Requires: MASTER_SERVER_IP configured
// ----------------------------------------------------------------------------
const SERVER_MODE = process.env.SERVER_MODE || 'single';

// ----------------------------------------------------------------------------
// MASTER SERVER CONNECTION (required for 'slave' mode)
// ----------------------------------------------------------------------------
// Set these to connect to your master server when running in slave mode
// Example: MASTER_SERVER_IP='10.0.0.100' MASTER_SERVER_PORT=6379
function parseIntEnv(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = parseInt(raw, 10);
    return Number.isFinite(value) ? value : fallback;
}

function parseFloatEnv(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = parseFloat(raw);
    return Number.isFinite(value) ? value : fallback;
}

const MASTER_SERVER_IP = process.env.MASTER_SERVER_IP || 'localhost';
const MASTER_SERVER_PORT = parseIntEnv('MASTER_SERVER_PORT', 6379);

// ----------------------------------------------------------------------------
// WORKER/THREADING CONFIGURATION
// ----------------------------------------------------------------------------
// Number of worker processes to spawn (only applies to 'multi' and 'slave' modes)
// Recommendation: Use 2-4 workers, max (CPU cores - 2) to avoid OS starvation
const WORKER_COUNT = parseIntEnv('WORKER_COUNT', 2);

// Maximum connections per worker before considered overloaded
const MAX_CONNECTIONS_PER_WORKER = parseIntEnv('MAX_CONNECTIONS_PER_WORKER', 500);

// Maximum lobbies per worker before considered overloaded
const MAX_LOBBIES_PER_WORKER = parseIntEnv('MAX_LOBBIES_PER_WORKER', 100);

// Maximum messages per second per worker before overloaded
const MAX_MESSAGES_PER_SECOND = parseIntEnv('MAX_MESSAGES_PER_SECOND', 1000);

// Per-socket inbound message rate (enforced); defaults below aggregate worker load threshold
const MAX_MESSAGES_PER_SOCKET_PER_SECOND = parseIntEnv('MAX_MESSAGES_PER_SOCKET_PER_SECOND', 120);

// Maximum event loop lag (ms) before worker considered overloaded
const MAX_EVENT_LOOP_LAG = parseIntEnv('MAX_EVENT_LOOP_LAG', 100);

// ----------------------------------------------------------------------------
// SERVER CONFIGURATION
// ----------------------------------------------------------------------------
// WebSocket server port
const PORT = parseIntEnv('PORT', 4000);

// Hostname clients use in redirect URLs (ws://PUBLIC_HOST:workerPort)
const PUBLIC_HOST = process.env.PUBLIC_HOST || 'localhost';

// Unique identifier for this server (useful for multi-server setups)
const SERVER_ID = process.env.SERVER_ID || `server-${Date.now()}`;

// Server region (optional, for future geo-distribution)
const SERVER_REGION = process.env.SERVER_REGION || 'default';

// ----------------------------------------------------------------------------
// REDIS CONFIGURATION (for 'multi' and 'slave' modes)
// ----------------------------------------------------------------------------
// Redis port (default: 6379)
const REDIS_PORT = parseIntEnv('REDIS_PORT', 6379);
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const LOBBY_DIRECTORY_TTL_SECONDS = parseIntEnv('LOBBY_DIRECTORY_TTL_SECONDS', 60);

// Redis password (optional, leave empty if no password)
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

// Auto-manage Redis Docker container (applies to 'multi' mode only)
const REDIS_AUTO_MANAGE = process.env.REDIS_AUTO_MANAGE !== 'false';

// Redis Docker image (when auto-managing)
const REDIS_IMAGE = process.env.REDIS_IMAGE || 'redis:alpine';

// Redis container name (when auto-managing)
const REDIS_CONTAINER_NAME = process.env.REDIS_CONTAINER_NAME || 'shapeslayer-redis';

// ----------------------------------------------------------------------------
// LOBBY CONFIGURATION
// ----------------------------------------------------------------------------
// Maximum players per lobby
const MAX_PLAYERS_PER_LOBBY = parseIntEnv('MAX_PLAYERS_PER_LOBBY', 4);

// Lobby code length (characters)
const LOBBY_CODE_LENGTH = parseIntEnv('LOBBY_CODE_LENGTH', 6);

// Auto-cleanup lobbies older than this (milliseconds)
const LOBBY_MAX_AGE = parseIntEnv('LOBBY_MAX_AGE', 60 * 60 * 1000); // 1 hour

// How often to check for old lobbies to cleanup (milliseconds)
const LOBBY_CLEANUP_INTERVAL = parseIntEnv('LOBBY_CLEANUP_INTERVAL', 5 * 60 * 1000); // 5 minutes

// Grace period before removing a disconnected player from a lobby (milliseconds)
const DISCONNECT_GRACE_MS = parseIntEnv('DISCONNECT_GRACE_MS', 15000);

// ----------------------------------------------------------------------------
// LOAD BALANCING CONFIGURATION (for 'multi' and 'slave' modes)
// ----------------------------------------------------------------------------
// Enable/disable dynamic load balancing
const ENABLE_LOAD_BALANCING = process.env.ENABLE_LOAD_BALANCING !== 'false';

// Health check interval (milliseconds)
const HEALTH_CHECK_INTERVAL = parseIntEnv('HEALTH_CHECK_INTERVAL', 2000);

// Migration threshold (0.0-1.0) - minimum load difference to trigger migration
const MIGRATION_THRESHOLD = parseFloatEnv('MIGRATION_THRESHOLD', 0.3);

// Migration cooldown (milliseconds) - min time between migrations for same lobby
const MIGRATION_COOLDOWN = parseIntEnv('MIGRATION_COOLDOWN', 30000);

// ----------------------------------------------------------------------------
// LOGGING CONFIGURATION
// ----------------------------------------------------------------------------
// Log level: 'debug', 'info', 'warn', 'error'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Log worker health metrics every 2 seconds
const LOG_HEALTH_METRICS = process.env.LOG_HEALTH_METRICS === 'true';

// Log load balancing decisions
const LOG_LOAD_BALANCING = process.env.LOG_LOAD_BALANCING === 'true';

// ============================================================================
// END CONFIGURATION - Code below automatically configures based on mode
// ============================================================================

// Determine configuration based on mode
const isClustered = SERVER_MODE === 'multi' || SERVER_MODE === 'slave';
const useRedis = SERVER_MODE === 'multi' || SERVER_MODE === 'slave';
const isMaster = SERVER_MODE === 'multi';
const isSlave = SERVER_MODE === 'slave';

// Build configuration object
const config = {
    // Server mode
    mode: SERVER_MODE,
    
    // Server configuration
    port: PORT,
    host: '0.0.0.0',
    publicHost: PUBLIC_HOST,
    
    // Clustering configuration
    clustering: {
        enabled: isClustered,
        workerCount: WORKER_COUNT,
        autoRestart: true,
        restartDelay: 1000
    },
    
    // Load balancing configuration
    // Directory+redirect model: automatic mid-match migration stays off until
    // full state transfer lands; redis affinity handles cross-worker joins.
    loadBalancing: {
        enabled: isClustered && ENABLE_LOAD_BALANCING && process.env.ENABLE_LOBBY_MIGRATION === 'true',
        healthCheckInterval: HEALTH_CHECK_INTERVAL,
        thresholds: {
            maxConnections: MAX_CONNECTIONS_PER_WORKER,
            maxLobbies: MAX_LOBBIES_PER_WORKER,
            maxMessagesPerSecond: MAX_MESSAGES_PER_SECOND,
            maxEventLoopLag: MAX_EVENT_LOOP_LAG
        },
        migrationThreshold: MIGRATION_THRESHOLD,
        migrationCooldown: MIGRATION_COOLDOWN
    },
    
    // Lobby configuration
    lobby: {
        maxPlayers: MAX_PLAYERS_PER_LOBBY,
        codeLength: LOBBY_CODE_LENGTH,
        maxAge: LOBBY_MAX_AGE,
        cleanupInterval: LOBBY_CLEANUP_INTERVAL,
        disconnectGraceMs: DISCONNECT_GRACE_MS
    },

    limits: {
        maxPayloadBytes: parseIntEnv('WS_MAX_PAYLOAD_BYTES', 256 * 1024),
        maxMessagesPerSocketPerSecond: MAX_MESSAGES_PER_SOCKET_PER_SECOND
    },
    
    // Logging configuration
    logging: {
        level: LOG_LEVEL,
        logHealthMetrics: LOG_HEALTH_METRICS,
        logLoadBalancing: LOG_LOAD_BALANCING
    },
    
    // Redis configuration
    redis: {
        enabled: useRedis,
        isMaster: isMaster,
        isSlave: isSlave,
        host: isSlave ? MASTER_SERVER_IP : REDIS_HOST,
        port: isSlave ? MASTER_SERVER_PORT : REDIS_PORT,
        password: REDIS_PASSWORD,
        autoManage: isMaster && REDIS_AUTO_MANAGE,
        containerName: REDIS_CONTAINER_NAME,
        image: REDIS_IMAGE,
        lobbyTtlSeconds: LOBBY_DIRECTORY_TTL_SECONDS
    },
    
    // Server identification
    server: {
        id: SERVER_ID,
        region: SERVER_REGION
    }
};

/** Resolve this process's listen port and public WS endpoint. */
config.resolveWorkerEndpoint = function resolveWorkerEndpoint() {
    const workerIndex = parseIntEnv('WORKER_INDEX', 0);
    const workerPort = parseIntEnv('WORKER_PORT', config.port + workerIndex);
    const scheme = process.env.PUBLIC_WS_SCHEME || 'ws';
    return {
        workerIndex,
        workerPort,
        endpoint: `${scheme}://${config.publicHost}:${workerPort}`
    };
};

// ============================================================================
// VALIDATION
// ============================================================================

// Validate server mode
const validModes = ['single', 'multi', 'slave'];
if (!validModes.includes(SERVER_MODE)) {
    console.error(`[Config] Error: Invalid SERVER_MODE '${SERVER_MODE}'. Must be one of: ${validModes.join(', ')}`);
    process.exit(1);
}

// Validate worker count
if (config.clustering.workerCount < 1) {
    console.error('[Config] Error: WORKER_COUNT must be at least 1');
    process.exit(1);
}

// Warn if worker count exceeds CPU cores
const cpuCount = os.cpus().length;
if (config.clustering.workerCount > cpuCount) {
    console.warn(`[Config] Warning: WORKER_COUNT (${config.clustering.workerCount}) exceeds CPU cores (${cpuCount})`);
}

// Validate slave mode configuration
if (isSlave && MASTER_SERVER_IP === 'localhost') {
    console.error('[Config] Error: SERVER_MODE=slave requires MASTER_SERVER_IP to be set');
    console.error('[Config]        Set MASTER_SERVER_IP to the IP address of your master server');
    process.exit(1);
}

// Display mode information
console.log(`[Config] Server Mode: ${SERVER_MODE.toUpperCase()}`);
if (SERVER_MODE === 'single') {
    console.log('[Config] Running in single-threaded mode (simplest, recommended for most users)');
} else if (SERVER_MODE === 'multi') {
    console.log(`[Config] Running in multi-core mode with ${WORKER_COUNT} workers + Redis directory`);
    if (REDIS_AUTO_MANAGE) {
        console.log('[Config] Redis Docker auto-manage is enabled (harness owns container lifecycle)');
    } else {
        console.log(`[Config] Expect Redis at ${REDIS_HOST}:${REDIS_PORT}`);
    }
} else if (SERVER_MODE === 'slave') {
    console.log(`[Config] Running as slave server connecting to master at ${MASTER_SERVER_IP}`);
    console.log(`[Config] Workers: ${WORKER_COUNT}`);
}

module.exports = config;

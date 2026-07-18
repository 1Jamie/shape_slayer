#!/usr/bin/env node

/**
 * Shape Slayer Multiplayer Server
 * Main entry point - detects and routes to master or worker process
 */

const cluster = require('cluster');
const os = require('os');
const config = require('./config');

// Get local network IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Main entry point
if (config.clustering.enabled && cluster.isMaster) {
    // Run as master process (cluster coordinator)
    require('./mp-server-master');
    
    const IP = getLocalIP();
    
    // Display connection info after a brief delay (let workers start)
    setTimeout(() => {
        console.log(`\n========================================`);
        console.log(`  Connection Information`);
        console.log(`========================================`);
        console.log(`  Local:    ws://localhost:${config.port}`);
        console.log(`  Network:  ws://${IP}:${config.port}`);
        console.log(`========================================\n`);
        
        console.log(`Server ready to accept connections!`);
        console.log(`\nConfiguration:`);
        console.log(`  - Workers: ${config.clustering.workerCount}`);
        console.log(`  - Max Connections/Worker: ${config.loadBalancing.thresholds.maxConnections}`);
        console.log(`  - Max Lobbies/Worker: ${config.loadBalancing.thresholds.maxLobbies}`);
        console.log(`  - Load Balancing: ${config.loadBalancing.enabled ? 'Enabled' : 'Disabled'}`);
        console.log(`\nEnvironment Variables:`);
        console.log(`  - WORKER_COUNT: Set number of worker processes (default: 2)`);
        console.log(`  - ENABLE_CLUSTERING: Set to 'true' to enable multi-core mode (default: false)`);
        console.log(`  - ENABLE_LOAD_BALANCING: Set to 'false' to disable dynamic load balancing`);
        console.log(`  - LOG_LEVEL: Set to 'debug' for verbose logging`);
        console.log(`\nPress Ctrl+C to stop the server.\n`);
    }, 1000);
    
} else if (config.clustering.enabled && cluster.isWorker) {
    // Run as worker process (handles WebSocket connections)
    require('./mp-server-worker');
    
} else {
    // Run in single-threaded mode (for debugging or when clustering is disabled)
    console.log(`\n========================================`);
    console.log(`  Shape Slayer Multiplayer Server`);
    console.log(`  SINGLE-THREADED MODE`);
    console.log(`========================================`);
    console.log(`  Port:     ${config.port}`);
    console.log(`  Status:   Starting...`);
    console.log(`========================================\n`);
    console.log(`Note: Clustering is disabled by default. Set ENABLE_CLUSTERING=true to enable multi-core mode.\n`);
    
    // In single-threaded mode, we need to start the server directly
    // We'll use the worker implementation but without clustering
    require('./mp-server-worker');
    
    const IP = getLocalIP();
    
    setTimeout(() => {
        console.log(`\n========================================`);
        console.log(`  Connection Information`);
        console.log(`========================================`);
        console.log(`  Local:    ws://localhost:${config.port}`);
        console.log(`  Network:  ws://${IP}:${config.port}`);
        console.log(`========================================\n`);
        console.log(`Server ready to accept connections!\n`);
    }, 500);
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n[Server] Shutting down gracefully...');
    
    if (cluster.isMaster && config.clustering.enabled) {
        // Close all workers
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
    }
    
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n[Server] Received SIGTERM, shutting down...');
    
    if (cluster.isMaster && config.clustering.enabled) {
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
    }
    
    process.exit(0);
});

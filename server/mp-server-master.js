const cluster = require('cluster');
const os = require('os');
const config = require('./config');

// Master process - coordinates worker processes
class MasterProcess {
    constructor() {
        this.workers = new Map(); // workerId -> worker info
        this.lobbyDirectory = new Map(); // lobbyCode -> workerId
        this.workerMetrics = new Map(); // workerId -> metrics
        this.lastMigrationTime = new Map(); // lobbyCode -> timestamp
        
        console.log(`\n========================================`);
        console.log(`  Shape Slayer Multiplayer Server`);
        console.log(`  MASTER PROCESS (Multi-Core Mode)`);
        console.log(`========================================`);
        console.log(`  Port:          ${config.port}`);
        console.log(`  Workers:       ${config.clustering.workerCount}`);
        console.log(`  CPU Cores:     ${os.cpus().length}`);
        console.log(`  Load Balancing: ${config.loadBalancing.enabled ? 'Enabled' : 'Disabled'}`);
        console.log(`========================================\n`);
    }
    
    start() {
        // Fork worker processes
        for (let i = 0; i < config.clustering.workerCount; i++) {
            this.forkWorker(i);
        }
        
        // Start health monitoring if load balancing is enabled
        if (config.loadBalancing.enabled) {
            this.startHealthMonitoring();
        }
        
        // Handle worker exits
        cluster.on('exit', (worker, code, signal) => {
            console.log(`[Master] Worker ${worker.id} died (${signal || code})`);
            
            // Clean up worker data
            this.cleanupWorker(worker.id);
            
            // Restart worker if auto-restart is enabled
            if (config.clustering.autoRestart) {
                console.log(`[Master] Restarting worker in ${config.clustering.restartDelay}ms...`);
                setTimeout(() => {
                    this.forkWorker();
                }, config.clustering.restartDelay);
            }
        });
    }
    
    forkWorker(preferredId = null) {
        const worker = cluster.fork();
        const workerId = worker.id;
        
        this.workers.set(workerId, {
            worker,
            id: workerId,
            startedAt: Date.now(),
            lobbies: new Set()
        });
        
        // Initialize metrics
        this.workerMetrics.set(workerId, {
            connections: 0,
            lobbies: 0,
            messagesPerSecond: 0,
            eventLoopLag: 0,
            lastUpdate: Date.now()
        });
        
        // Setup IPC message handlers
        worker.on('message', (msg) => this.handleWorkerMessage(workerId, msg));
        
        console.log(`[Master] Forked worker ${workerId} (PID: ${worker.process.pid})`);
        
        return workerId;
    }
    
    handleWorkerMessage(workerId, msg) {
        const { type, data } = msg;
        
        switch (type) {
            case 'lobby_created':
                this.handleLobbyCreated(workerId, data);
                break;
                
            case 'lobby_deleted':
                this.handleLobbyDeleted(workerId, data);
                break;
                
            case 'lobby_lookup':
                this.handleLobbyLookup(workerId, data);
                break;
                
            case 'health_metrics':
                this.handleHealthMetrics(workerId, data);
                break;
                
            case 'request_least_loaded_worker':
                this.handleLeastLoadedWorkerRequest(workerId);
                break;
                
            default:
                console.warn(`[Master] Unknown message type from worker ${workerId}:`, type);
        }
    }
    
    handleLobbyCreated(workerId, data) {
        const { code } = data;
        this.lobbyDirectory.set(code, workerId);
        
        const workerInfo = this.workers.get(workerId);
        if (workerInfo) {
            workerInfo.lobbies.add(code);
        }
        
        if (config.logging.level === 'debug') {
            console.log(`[Master] Lobby ${code} created on worker ${workerId}`);
        }
    }
    
    handleLobbyDeleted(workerId, data) {
        const { code } = data;
        this.lobbyDirectory.delete(code);
        this.lastMigrationTime.delete(code);
        
        const workerInfo = this.workers.get(workerId);
        if (workerInfo) {
            workerInfo.lobbies.delete(code);
        }
        
        if (config.logging.level === 'debug') {
            console.log(`[Master] Lobby ${code} deleted from worker ${workerId}`);
        }
    }
    
    handleLobbyLookup(workerId, data) {
        const { code, requestId } = data;
        const targetWorkerId = this.lobbyDirectory.get(code);
        
        const worker = this.workers.get(workerId);
        if (worker) {
            worker.worker.send({
                type: 'lobby_lookup_response',
                data: {
                    requestId,
                    code,
                    workerId: targetWorkerId || null,
                    found: targetWorkerId !== undefined
                }
            });
        }
    }
    
    handleHealthMetrics(workerId, data) {
        this.workerMetrics.set(workerId, {
            ...data,
            lastUpdate: Date.now()
        });
        
        if (config.logging.logHealthMetrics) {
            console.log(`[Master] Worker ${workerId} metrics:`, data);
        }
    }
    
    handleLeastLoadedWorkerRequest(workerId) {
        const leastLoadedId = this.getLeastLoadedWorker();
        const worker = this.workers.get(workerId);
        
        if (worker) {
            worker.worker.send({
                type: 'least_loaded_worker_response',
                data: { workerId: leastLoadedId }
            });
        }
    }
    
    startHealthMonitoring() {
        setInterval(() => {
            this.checkWorkerHealth();
        }, config.loadBalancing.healthCheckInterval);
        
        console.log(`[Master] Health monitoring started (interval: ${config.loadBalancing.healthCheckInterval}ms)`);
    }
    
    checkWorkerHealth() {
        const overloadedWorkers = [];
        const underloadedWorkers = [];
        
        for (const [workerId, metrics] of this.workerMetrics.entries()) {
            const load = this.calculateWorkerLoad(metrics);
            
            if (this.isWorkerOverloaded(metrics)) {
                overloadedWorkers.push({ workerId, load, metrics });
            } else if (load < 0.5) { // Less than 50% capacity
                underloadedWorkers.push({ workerId, load, metrics });
            }
        }
        
        // If we have overloaded and underloaded workers, consider migration
        if (overloadedWorkers.length > 0 && underloadedWorkers.length > 0) {
            this.considerLobbyMigration(overloadedWorkers, underloadedWorkers);
        }
    }
    
    isWorkerOverloaded(metrics) {
        const thresholds = config.loadBalancing.thresholds;
        
        return (
            metrics.connections > thresholds.maxConnections ||
            metrics.lobbies > thresholds.maxLobbies ||
            metrics.messagesPerSecond > thresholds.maxMessagesPerSecond ||
            metrics.eventLoopLag > thresholds.maxEventLoopLag
        );
    }
    
    calculateWorkerLoad(metrics) {
        const thresholds = config.loadBalancing.thresholds;
        
        // Calculate load as percentage of thresholds (0.0 to 1.0+)
        const connectionLoad = metrics.connections / thresholds.maxConnections;
        const lobbyLoad = metrics.lobbies / thresholds.maxLobbies;
        const messageLoad = metrics.messagesPerSecond / thresholds.maxMessagesPerSecond;
        const lagLoad = metrics.eventLoopLag / thresholds.maxEventLoopLag;
        
        // Return weighted average (prioritize event loop lag and connections)
        return (connectionLoad * 0.4 + lobbyLoad * 0.2 + messageLoad * 0.2 + lagLoad * 0.2);
    }
    
    considerLobbyMigration(overloadedWorkers, underloadedWorkers) {
        // Sort by load (highest first for overloaded, lowest first for underloaded)
        overloadedWorkers.sort((a, b) => b.load - a.load);
        underloadedWorkers.sort((a, b) => a.load - b.load);
        
        const sourceWorker = overloadedWorkers[0];
        const targetWorker = underloadedWorkers[0];
        
        // Check if migration would be beneficial
        const loadDifference = sourceWorker.load - targetWorker.load;
        if (loadDifference < config.loadBalancing.migrationThreshold) {
            return; // Not enough difference to justify migration
        }
        
        // Find a lobby to migrate from source worker
        const workerInfo = this.workers.get(sourceWorker.workerId);
        if (!workerInfo || workerInfo.lobbies.size === 0) {
            return;
        }
        
        // Select a lobby that hasn't been migrated recently
        const now = Date.now();
        let lobbyToMigrate = null;
        
        for (const lobbyCode of workerInfo.lobbies) {
            const lastMigration = this.lastMigrationTime.get(lobbyCode) || 0;
            if (now - lastMigration > config.loadBalancing.migrationCooldown) {
                lobbyToMigrate = lobbyCode;
                break;
            }
        }
        
        if (!lobbyToMigrate) {
            return; // No eligible lobbies to migrate
        }
        
        // Initiate migration
        this.migrateLobby(lobbyToMigrate, sourceWorker.workerId, targetWorker.workerId);
    }
    
    migrateLobby(lobbyCode, sourceWorkerId, targetWorkerId) {
        if (config.logging.logLoadBalancing) {
            console.log(`[Master] Migrating lobby ${lobbyCode} from worker ${sourceWorkerId} to ${targetWorkerId}`);
        }
        
        const sourceWorker = this.workers.get(sourceWorkerId);
        const targetWorker = this.workers.get(targetWorkerId);
        
        if (!sourceWorker || !targetWorker) {
            console.error(`[Master] Migration failed: invalid worker IDs`);
            return;
        }
        
        // Update directory
        this.lobbyDirectory.set(lobbyCode, targetWorkerId);
        this.lastMigrationTime.set(lobbyCode, Date.now());
        
        // Update worker info
        sourceWorker.lobbies.delete(lobbyCode);
        targetWorker.lobbies.add(lobbyCode);
        
        // Send migration command to source worker
        sourceWorker.worker.send({
            type: 'migrate_lobby',
            data: {
                lobbyCode,
                targetWorkerId
            }
        });
    }
    
    getLeastLoadedWorker() {
        let minLoad = Infinity;
        let leastLoadedId = null;
        
        for (const [workerId, metrics] of this.workerMetrics.entries()) {
            const load = this.calculateWorkerLoad(metrics);
            if (load < minLoad) {
                minLoad = load;
                leastLoadedId = workerId;
            }
        }
        
        // If no metrics yet, return first worker
        if (leastLoadedId === null && this.workers.size > 0) {
            return Array.from(this.workers.keys())[0];
        }
        
        return leastLoadedId;
    }
    
    cleanupWorker(workerId) {
        // Remove worker
        this.workers.delete(workerId);
        this.workerMetrics.delete(workerId);
        
        // Clean up lobby directory entries for this worker
        for (const [lobbyCode, assignedWorkerId] of this.lobbyDirectory.entries()) {
            if (assignedWorkerId === workerId) {
                this.lobbyDirectory.delete(lobbyCode);
                this.lastMigrationTime.delete(lobbyCode);
            }
        }
    }
    
    getStats() {
        return {
            workers: this.workers.size,
            totalLobbies: this.lobbyDirectory.size,
            metrics: Array.from(this.workerMetrics.entries()).map(([id, metrics]) => ({
                workerId: id,
                ...metrics
            }))
        };
    }
}

// Start master process
const master = new MasterProcess();
master.start();

module.exports = master;











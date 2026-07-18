#!/usr/bin/env node

'use strict';

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { waitForRedis } = require('./redis-ready');

const harnessDir = __dirname;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const SERVICES = {
  multiplayer: {
    label: 'Multiplayer Server',
    cwd: path.resolve(harnessDir, '..', 'multiplayer'),
    logFile: 'multiplayer.log',
    command: npmCommand,
    args: ['run', 'start'],
    entry: path.resolve(harnessDir, '..', 'multiplayer', 'mp-server.js')
  },
  metrics: {
    label: 'Metrics Server',
    cwd: path.resolve(harnessDir, '..', 'metrics', 'server'),
    logFile: 'metrics-server.log',
    command: npmCommand,
    args: ['run', 'start'],
    entry: path.resolve(harnessDir, '..', 'metrics', 'server', 'index.js')
  },
  metricsGui: {
    label: 'Metrics GUI',
    cwd: path.resolve(harnessDir, '..', 'metrics', 'gui'),
    logFile: 'metrics-gui.log',
    command: npmCommand,
    args: ['run', 'start'],
    entry: path.resolve(harnessDir, '..', 'metrics', 'gui', 'server.js')
  }
};

const SERVICE_ALIASES = {
  multiplayer: 'multiplayer',
  mp: 'multiplayer',
  metrics: 'metrics',
  ingestion: 'metrics',
  gui: 'metricsGui',
  'metrics-gui': 'metricsGui',
  dashboard: 'metricsGui'
};

const args = process.argv.slice(2);
const options = parseArguments(args);

const logDir = options.logDir || path.join(harnessDir, 'logs');
fs.mkdirSync(logDir, { recursive: true });

if (options.help) {
  printHelp();
  process.exit(0);
}

if (options.list) {
  printServiceList();
  process.exit(0);
}

const selectedServices = resolveServices(options);
if (!selectedServices.length) {
  console.error('No services selected to run. Use --help for usage information.');
  process.exit(1);
}

const processes = [];
let shuttingDown = false;
let exitCode = 0;

async function main() {
  console.log(
    `Harness starting ${selectedServices.length} service(s): ${selectedServices
      .map((key) => SERVICES[key].label)
      .join(', ')}`
  );
  console.log(`Logs directory: ${logDir}`);

  setupSignalHandlers();

  if (selectedServices.includes('multiplayer')) {
    await ensureRedisInfrastructure();
  }

  for (const key of selectedServices) {
    const service = SERVICES[key];
    ensureServiceDependencies(service.cwd);
    launchService(key, service);
  }
}

main().catch((error) => {
  console.error(`[Harness] Startup failed: ${error.message}`);
  process.exit(1);
});

function envFlagTrue(name, defaultTrue = false) {
  const raw = process.env[name];
  if (raw === undefined) return defaultTrue;
  return raw !== 'false' && raw !== '0';
}

async function ensureRedisInfrastructure() {
  const mode = process.env.SERVER_MODE || 'single';
  const redisRequired = mode === 'multi' || mode === 'slave';
  const autoManage = envFlagTrue('REDIS_AUTO_MANAGE', redisRequired);
  const redisHost = process.env.REDIS_HOST || (mode === 'slave' ? process.env.MASTER_SERVER_IP : null) || '127.0.0.1';
  const redisPort = Number(process.env.REDIS_PORT || process.env.MASTER_SERVER_PORT || 6379);
  const containerName = process.env.REDIS_CONTAINER_NAME || 'shapeslayer-redis';
  const image = process.env.REDIS_IMAGE || 'redis:alpine';

  if (!redisRequired && !autoManage) {
    return;
  }

  if (autoManage && mode !== 'slave') {
    console.log('[Harness] REDIS_AUTO_MANAGE enabled. Verifying Redis container...');
    ensureRedisContainer(containerName, image, redisPort);
  }

  if (redisRequired || autoManage) {
    console.log(`[Harness] Waiting for Redis at ${redisHost}:${redisPort}...`);
    try {
      await waitForRedis({ host: redisHost, port: redisPort, timeoutMs: 15000 });
      console.log('[Harness] Redis is ready (RESP PONG).');
    } catch (error) {
      console.error(`[Harness] ${error.message}`);
      if (redisRequired || options.exitOnFailure) {
        process.exit(1);
      }
    }
  }
}

function resolveContainerCli() {
  const candidates = [
    ['docker'],
    ['podman'],
    ['host-spawn', 'podman'],
    ['distrobox-host-exec', 'podman']
  ];
  for (const argv of candidates) {
    const probe = spawnSync(argv[0], [...argv.slice(1), 'version'], {
      encoding: 'utf8',
      timeout: 8000
    });
    if (probe.status === 0) {
      return argv;
    }
  }
  return null;
}

function containerSpawn(cli, args) {
  return spawnSync(cli[0], [...cli.slice(1), ...args], { encoding: 'utf8' });
}

function ensureRedisContainer(containerName, image, hostPort) {
  const cli = resolveContainerCli();
  if (!cli) {
    console.error('[Harness] REDIS_AUTO_MANAGE needs docker or podman (host podman via host-spawn is OK).');
    if (options.exitOnFailure || (process.env.SERVER_MODE || 'single') !== 'single') {
      process.exit(1);
    }
    return;
  }

  // Prefer fully-qualified image when using podman short-name policy.
  const resolvedImage = image.includes('/') ? image : `docker.io/library/${image}`;
  console.log(`[Harness] Using container CLI: ${cli.join(' ')}`);

  const running = containerSpawn(cli, ['ps', '-q', '-f', `name=^${containerName}$`]);
  if (running.status !== 0) {
    console.error('[Harness] Container list failed:', running.stderr || running.error?.message);
    if (options.exitOnFailure || (process.env.SERVER_MODE || 'single') !== 'single') {
      process.exit(1);
    }
    return;
  }

  if (running.stdout.trim()) {
    console.log(`[Harness] Container ${containerName} is already active.`);
    return;
  }

  const exists = containerSpawn(cli, ['ps', '-aq', '-f', `name=^${containerName}$`]);
  if (exists.stdout && exists.stdout.trim()) {
    console.log(`[Harness] Starting existing container ${containerName}...`);
    const started = containerSpawn(cli, ['start', containerName]);
    if (started.status !== 0) {
      console.error(`[Harness] Failed to start ${containerName}: ${started.stderr}`);
      process.exit(1);
    }
    return;
  }

  console.log(`[Harness] Spawning Redis container ${containerName}...`);
  const run = containerSpawn(cli, [
    'run',
    '-d',
    '--name',
    containerName,
    '-p',
    `${hostPort}:6379`,
    resolvedImage
  ]);
  if (run.status !== 0) {
    console.error(`[Harness] Container run failed: ${run.stderr}`);
    process.exit(1);
  }
}

function ensureServiceDependencies(cwd) {
  const nodeModulesPath = path.join(cwd, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    return;
  }

  console.log(`[Harness] Installing dependencies in ${cwd}...`);
  const result = spawnSync(npmCommand, ['install'], {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    console.error(`[Harness] npm install failed in ${cwd} (exit ${result.status})`);
    process.exit(result.status || 1);
  }
}

function launchService(key, service) {
  const timestamp = new Date().toISOString();
  const logPath = path.join(logDir, service.logFile);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n[${timestamp}] === Starting ${service.label} ===\n`);

  // Spawn node entry directly so the tracked PID is the real service process.
  const child = spawn(process.execPath, [service.entry], {
    cwd: service.cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32'
  });

  const tracked = {
    key,
    child,
    exited: false,
    exitCode: null,
    logStream
  };

  const prefix = `[${service.label}]`;

  child.stdout.on('data', (data) => {
    const message = data.toString();
    logStream.write(message);
    process.stdout.write(formatOutput(prefix, message));
  });

  child.stderr.on('data', (data) => {
    const message = data.toString();
    logStream.write(message);
    process.stderr.write(formatOutput(prefix, message));
  });

  child.on('error', (error) => {
    const message = `[${new Date().toISOString()}] Error spawning ${service.label}: ${error.message}\n`;
    logStream.write(message);
    process.stderr.write(formatOutput(prefix, message));
  });

  child.on('close', (code, signal) => {
    tracked.exited = true;
    tracked.exitCode = code;
    const message = `[${new Date().toISOString()}] ${service.label} exited with code ${code}${
      signal ? ` (signal ${signal})` : ''
    }\n`;
    logStream.write(message);
    logStream.end();

    if (!shuttingDown) {
      process.stderr.write(
        formatOutput(prefix, `Process exited unexpectedly. Check log at ${logPath}\n`)
      );
      exitCode = code || 1;
      if (options.exitOnFailure) {
        shutdown(exitCode);
      }
    }
  });

  processes.push(tracked);
  console.log(`${prefix} spawned with PID ${child.pid}`);
}

function formatOutput(prefix, message) {
  return message
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `${prefix} ${line}\n`)
    .join('');
}

function killTracked(tracked, signal) {
  const { child } = tracked;
  if (tracked.exited || !child.pid) {
    return;
  }
  try {
    if (process.platform !== 'win32' && child.pid) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch (error) {
    if (error.code !== 'ESRCH') {
      console.error(`[Harness] Failed to signal ${tracked.key}: ${error.message}`);
    }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  exitCode = code;
  console.log('Harness shutting down services...');

  for (const tracked of processes) {
    if (!tracked.exited) {
      console.log(`Stopping ${SERVICES[tracked.key].label} (PID ${tracked.child.pid})`);
      killTracked(tracked, 'SIGTERM');
    }
  }

  setTimeout(() => {
    for (const tracked of processes) {
      if (!tracked.exited) {
        console.log(`Force-killing ${SERVICES[tracked.key].label} (PID ${tracked.child.pid})`);
        killTracked(tracked, 'SIGKILL');
      }
    }
    process.exit(exitCode);
  }, 5000);
}

function setupSignalHandlers() {
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
}

function parseArguments(argv) {
  const config = {
    include: null,
    exclude: new Set(),
    logDir: null,
    help: false,
    list: false,
    exitOnFailure: false
  };

  for (const rawArg of argv) {
    if (rawArg === '--help' || rawArg === '-h') {
      config.help = true;
      continue;
    }
    if (rawArg === '--list') {
      config.list = true;
      continue;
    }
    if (rawArg === '--exit-on-failure') {
      config.exitOnFailure = true;
      continue;
    }
    if (rawArg.startsWith('--log-dir=')) {
      config.logDir = path.resolve(harnessDir, rawArg.split('=')[1]);
      continue;
    }
    if (rawArg.startsWith('--only=')) {
      config.include = new Set(parseServiceList(rawArg.split('=')[1]));
      continue;
    }
    if (rawArg.startsWith('--skip=')) {
      for (const target of parseServiceList(rawArg.split('=')[1])) {
        config.exclude.add(target);
      }
      continue;
    }
    console.warn(`Unknown argument: ${rawArg}`);
  }

  return config;
}

function parseServiceList(listValue) {
  if (!listValue) return [];
  return listValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeServiceKey)
    .filter(Boolean);
}

function normalizeServiceKey(input) {
  return SERVICE_ALIASES[input.toLowerCase()] || null;
}

function resolveServices(config) {
  const allKeys = Object.keys(SERVICES);
  let selected = config.include ? Array.from(config.include) : allKeys;
  if (config.exclude.size > 0) {
    selected = selected.filter((key) => !config.exclude.has(key));
  }
  return [...new Set(selected)].filter((key) => SERVICES[key]);
}

function printHelp() {
  console.log(`Usage: node harness/index.js [options]

Options:
  --help, -h           Show this help message.
  --list               List available services.
  --only=a,b,c         Run only the specified services (aliases: mp, metrics, gui).
  --skip=a,b,c         Skip the specified services.
  --log-dir=PATH       Override the default log directory.
  --exit-on-failure    Stop all services if one exits unexpectedly.

Redis (when starting multiplayer with SERVER_MODE=multi|slave):
  REDIS_AUTO_MANAGE=true   Ensure Redis container shapeslayer-redis is running
                           (docker, or host podman via host-spawn/distrobox-host-exec)
  REDIS_PORT=6379          Redis port for readiness check / publish
  REDIS_AUTO_MANAGE=false  Skip container bootstrap when Redis is already up

Examples:
  SERVER_MODE=multi REDIS_AUTO_MANAGE=true node harness/index.js --only=mp
  SERVER_MODE=multi REDIS_AUTO_MANAGE=false node harness/index.js --only=mp
  node harness/index.js --skip=metrics --exit-on-failure
`);
}

function printServiceList() {
  console.log('Available services:');
  for (const [key, service] of Object.entries(SERVICES)) {
    console.log(`- ${key}: ${service.label}`);
  }
}

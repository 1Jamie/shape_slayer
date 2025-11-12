#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const harnessDir = __dirname;

const args = process.argv.slice(2);
const options = parseArguments(args);

const logDir = options.logDir || path.join(harnessDir, 'logs');
fs.mkdirSync(logDir, { recursive: true });

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const SERVICES = {
  multiplayer: {
    label: 'Multiplayer Server',
    cwd: path.resolve(harnessDir, '..', 'server'),
    logFile: 'multiplayer.log',
    command: npmCommand,
    args: ['run', 'start']
  },
  metrics: {
    label: 'Metrics Server',
    cwd: path.resolve(harnessDir, '..', 'metrics', 'server'),
    logFile: 'metrics-server.log',
    command: npmCommand,
    args: ['run', 'start']
  },
  metricsGui: {
    label: 'Metrics GUI',
    cwd: path.resolve(harnessDir, '..', 'metrics', 'gui'),
    logFile: 'metrics-gui.log',
    command: npmCommand,
    args: ['run', 'start']
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

console.log(`Harness starting ${selectedServices.length} service(s): ${selectedServices.map((key) => SERVICES[key].label).join(', ')}`);
console.log(`Logs directory: ${logDir}`);

const processes = [];
let shuttingDown = false;

for (const key of selectedServices) {
  const service = SERVICES[key];
  launchService(key, service);
}

setupSignalHandlers();

function launchService(key, service) {
  const timestamp = new Date().toISOString();
  const logPath = path.join(logDir, service.logFile);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n[${timestamp}] === Starting ${service.label} ===\n`);

  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  });

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
    const message = `[${new Date().toISOString()}] ${service.label} exited with code ${code}${signal ? ` (signal ${signal})` : ''}\n`;
    logStream.write(message);
    logStream.end();

    if (!shuttingDown) {
      process.stderr.write(formatOutput(prefix, `Process exited unexpectedly. Check log at ${logPath}\n`));
    }
  });

  processes.push({ key, child });

  console.log(`${prefix} spawned with PID ${child.pid}`);
}

function formatOutput(prefix, message) {
  return message
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `${prefix} ${line}\n`)
    .join('');
}

function setupSignalHandlers() {
  const shutdown = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log('Harness shutting down services...');

    for (const { key, child } of processes) {
      if (!child.killed) {
        console.log(`Stopping ${SERVICES[key].label} (PID ${child.pid})`);
        child.kill('SIGTERM');
      }
    }

    setTimeout(() => {
      for (const { child } of processes) {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }
      process.exit(0);
    }, 5000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', shutdown);
}

function parseArguments(argv) {
  const config = {
    include: null,
    exclude: new Set(),
    logDir: null,
    help: false,
    list: false
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

    if (rawArg.startsWith('--log-dir=')) {
      config.logDir = path.resolve(harnessDir, rawArg.split('=')[1]);
      continue;
    }

    if (rawArg.startsWith('--only=')) {
      const targets = parseServiceList(rawArg.split('=')[1]);
      config.include = new Set(targets);
      continue;
    }

    if (rawArg.startsWith('--skip=')) {
      const targets = parseServiceList(rawArg.split('=')[1]);
      for (const target of targets) {
        config.exclude.add(target);
      }
      continue;
    }

    console.warn(`Unknown argument: ${rawArg}`);
  }

  return config;
}

function parseServiceList(listValue) {
  if (!listValue) {
    return [];
  }

  return listValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeServiceKey)
    .filter(Boolean);
}

function normalizeServiceKey(input) {
  const key = input.toLowerCase();
  return SERVICE_ALIASES[key] || null;
}

function resolveServices(config) {
  const allKeys = Object.keys(SERVICES);
  let selected = config.include ? Array.from(config.include) : allKeys;

  if (config.exclude.size > 0) {
    selected = selected.filter((key) => !config.exclude.has(key));
  }

  const unique = [...new Set(selected)].filter((key) => {
    if (!SERVICES[key]) {
      console.warn(`Unknown service key ignored: ${key}`);
      return false;
    }
    return true;
  });

  return unique;
}

function printHelp() {
  console.log(`Usage: node harness/index.js [options]

Options:
  --help, -h           Show this help message.
  --list               List available services.
  --only=a,b,c         Run only the specified services (aliases: mp, metrics, gui).
  --skip=a,b,c         Skip the specified services.
  --log-dir=PATH       Override the default log directory.

Examples:
  node harness/index.js --only=mp
  node harness/index.js --skip=metrics
  node harness/index.js --log-dir=/tmp/shape-slayer-logs
`);
}

function printServiceList() {
  console.log('Available services:');
  for (const [key, service] of Object.entries(SERVICES)) {
    const aliases = Object.entries(SERVICE_ALIASES)
      .filter(([, value]) => value === key && value !== key)
      .map(([alias]) => alias);
    const aliasText = aliases.length ? ` (aliases: ${aliases.join(', ')})` : '';
    console.log(`- ${key}${aliasText}: ${service.label}`);
  }
}



const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

let tmpDir;
let server;
let baseUrl;
let db;
let createServer;

function freshRequire(modulePath) {
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
}

async function startHttpServer(app) {
    return new Promise(resolve => {
        const httpServer = http.createServer(app);
        httpServer.listen(0, () => resolve(httpServer));
    });
}

test.describe('metrics ingestion API', { concurrency: false }, suite => {
    suite.beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-test-'));
        process.env.METRICS_DB_PATH = path.join(tmpDir, 'metrics.sqlite');
        db = freshRequire('../db');
        ({ createServer } = freshRequire('../index'));

        const { app } = createServer({ skipListen: true });
        server = await startHttpServer(app);
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    suite.afterEach(async () => {
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
        if (db) {
            db.close();
        }
        if (tmpDir) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        delete process.env.METRICS_DB_PATH;
        tmpDir = null;
        server = null;
        db = null;
    });

    suite.test('rejects invalid payloads', async () => {
        const res = await fetch(`${baseUrl}/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        assert.strictEqual(res.status, 400);
        const body = await res.json();
        assert.strictEqual(body.error, 'Invalid telemetry payload');
    });

    suite.test('ingests run telemetry and is idempotent', async () => {
        const now = new Date().toISOString();
        const payload = {
            run: {
                runId: 'test-run-1',
                gameVersion: '1.0.0',
                mode: 'singleplayer',
                hostPlayerId: 'local',
                startedAt: now,
                endedAt: now,
                durationMs: 12345,
                result: 'success',
                seed: null,
                difficulty: 'default',
                metadata: { branch: 'test' },
                players: [
                    {
                        playerId: 'local',
                        class: 'warrior',
                        deck: [],
                        affixes: [],
                        gear: {
                            weapon: {
                                id: 'sword',
                                name: 'Test Sword',
                                tier: 'blue',
                                affixes: [{ type: 'attackSpeed', value: 0.1, tier: 'basic' }]
                            },
                            armor: {
                                id: 'armor',
                                name: 'Test Armor',
                                tier: 'green',
                                affixes: [{ type: 'maxHealth', value: 30, tier: 'basic' }]
                            },
                            accessory: null
                        },
                        totalDamageDealt: 500,
                        totalDamageTaken: 120,
                        hitsTaken: 7,
                        roomsCleared: 3,
                        deaths: 0
                    }
                ],
                affixPool: [
                    { id: 'attackSpeed', source: 'player', minValue: 0.1, maxValue: 0.1 }
                ],
                rooms: [
                    {
                        roomId: 'room-1',
                        roomNumber: 1,
                        type: 'combat',
                        enteredAt: now,
                        clearedAt: now,
                        durationMs: 60000,
                        damageDealtByPlayer: { local: 500 },
                        damageTakenByPlayer: { local: 120 },
                        hitsTakenByPlayer: { local: 7 },
                        playerStatsStart: [
                            {
                                playerId: 'local',
                                class: 'warrior',
                                level: 4,
                                stats: { damage: 40, defense: 0.2, moveSpeed: 300, hp: 95, maxHp: 100 },
                                gear: {
                                    weapon: { id: 'sword', name: 'Test Sword', tier: 'blue', affixes: [] },
                                    armor: { id: 'armor', name: 'Test Armor', tier: 'green', affixes: [] },
                                    accessory: null
                                }
                            }
                        ],
                        playerStatsEnd: [
                            {
                                playerId: 'local',
                                class: 'warrior',
                                level: 4,
                                stats: { damage: 45, defense: 0.25, moveSpeed: 305, hp: 80, maxHp: 100 },
                                gear: {
                                    weapon: { id: 'sword', name: 'Test Sword', tier: 'blue', affixes: [] },
                                    armor: { id: 'armor', name: 'Test Armor', tier: 'green', affixes: [] },
                                    accessory: null
                                }
                            }
                        ],
                        events: [
                            {
                                timestamp: now,
                                type: 'damage',
                                playerId: 'local',
                                targetId: 'enemy-1',
                                value: 320,
                                metadata: {}
                            }
                        ]
                    }
                ],
                bossEncounters: []
            },
            submittedAt: now,
            clientVersion: '1.0.0',
            authToken: null
        };

        const first = await fetch(`${baseUrl}/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        assert.strictEqual(first.status, 201);

        const runRow = db.prepare('SELECT * FROM runs WHERE run_id = ?').get('test-run-1');
        assert.ok(runRow, 'run stored');
        assert.strictEqual(runRow.mode, 'singleplayer');

        const playerCount = db.prepare('SELECT COUNT(*) AS count FROM run_players WHERE run_id = ?').get('test-run-1');
        assert.strictEqual(playerCount.count, 1);

        const gearRow = db.prepare('SELECT gear FROM run_players WHERE run_id = ?').get('test-run-1');
        assert.ok(gearRow.gear, 'gear stored');
        const parsedGear = JSON.parse(gearRow.gear);
        assert.strictEqual(parsedGear.weapon.name, 'Test Sword');

        const roomRow = db.prepare('SELECT player_stats_start, player_stats_end FROM rooms WHERE run_id = ?').get('test-run-1');
        const statsStart = JSON.parse(roomRow.player_stats_start);
        const statsEnd = JSON.parse(roomRow.player_stats_end);
        assert.strictEqual(statsStart[0].stats.damage, 40);
        assert.strictEqual(statsEnd[0].stats.moveSpeed, 305);

        const second = await fetch(`${baseUrl}/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        assert.strictEqual(second.status, 200);

        const runCount = db.prepare('SELECT COUNT(*) AS count FROM runs WHERE run_id = ?').get('test-run-1');
        assert.strictEqual(runCount.count, 1, 'idempotent insert');
    });
});


/* eslint-disable no-console */
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const Ajv = require('ajv');

const db = require('./db');

const PORT = process.env.METRICS_PORT ? Number(process.env.METRICS_PORT) : 4001;
const INGEST_TOKEN = process.env.METRICS_INGEST_TOKEN || null;
const ALLOWED_ORIGIN = process.env.METRICS_ALLOWED_ORIGIN || '*';

const ajv = new Ajv({ allErrors: true, strict: false });

const telemetrySchema = {
    type: 'object',
    required: ['run', 'submittedAt', 'clientVersion'],
    properties: {
        run: {
            type: 'object',
            required: [
                'runId',
                'mode',
                'hostPlayerId',
                'startedAt',
                'endedAt',
                'durationMs',
                'result',
                'players',
                'affixPool',
                'rooms',
                'bossEncounters'
            ],
            properties: {
                runId: { type: 'string', minLength: 1 },
                gameVersion: { type: 'string' },
                mode: { type: 'string', enum: ['singleplayer', 'multiplayer'] },
                hostPlayerId: { type: 'string', minLength: 1 },
                startedAt: { type: 'string', minLength: 1 },
                endedAt: { type: 'string', minLength: 1 },
                durationMs: { type: 'number', minimum: 0 },
                result: { type: 'string', minLength: 1 },
                seed: { type: ['string', 'null'] },
                difficulty: { type: ['string', 'null'] },
                metadata: { type: ['object', 'null'], additionalProperties: true },
                players: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['playerId'],
                        properties: {
                            playerId: { type: 'string', minLength: 1 },
                            class: { type: ['string', 'null'] },
                            deck: { type: 'array', items: { type: 'string' } },
                            affixes: { type: 'array', items: { type: 'object' } },
                            totalDamageDealt: { type: 'number' },
                            totalDamageTaken: { type: 'number' },
                            hitsTaken: { type: 'number' },
                            roomsCleared: { type: 'number' },
                            deaths: { type: 'number' }
                        }
                    }
                },
                affixPool: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            source: { type: 'string' },
                            minValue: { type: ['number', 'null'] },
                            maxValue: { type: ['number', 'null'] }
                        }
                    }
                },
                rooms: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['roomId', 'roomNumber'],
                        properties: {
                            roomId: { type: 'string', minLength: 1 },
                            roomNumber: { type: 'number' },
                            type: { type: ['string', 'null'] },
                            enteredAt: { type: ['string', 'null'] },
                            clearedAt: { type: ['string', 'null'] },
                            durationMs: { type: ['number', 'null'] },
                            damageDealtByPlayer: { type: 'object' },
                            damageTakenByPlayer: { type: 'object' },
                            hitsTakenByPlayer: { type: 'object' },
                            events: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        timestamp: { type: 'string' },
                                        type: { type: 'string' },
                                        playerId: { type: ['string', 'null'] },
                                        targetId: { type: ['string', 'null'] },
                                        value: { type: ['number', 'null'] },
                                        metadata: { type: ['object', 'null'] }
                                    }
                                }
                            }
                        }
                    }
                },
                bossEncounters: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['bossId'],
                        properties: {
                            bossId: { type: 'string', minLength: 1 },
                            startedAt: { type: ['string', 'null'] },
                            endedAt: { type: ['string', 'null'] },
                            durationMs: { type: ['number', 'null'] },
                            damageByPlayer: { type: ['object', 'null'] },
                            damageToPlayers: { type: ['object', 'null'] },
                            hitsTakenByPlayers: { type: ['object', 'null'] },
                            phases: { type: 'array', items: { type: 'object' } }
                        }
                    }
                }
            }
        },
        submittedAt: { type: 'string', minLength: 1 },
        clientVersion: { type: 'string', minLength: 1 },
        authToken: { type: ['string', 'null'] }
    }
};

const validateTelemetry = ajv.compile(telemetrySchema);

const insertRunStmt = db.prepare(`
    INSERT INTO runs (
        run_id,
        game_version,
        mode,
        host_player_id,
        started_at,
        ended_at,
        duration_ms,
        result,
        seed,
        difficulty,
        metadata,
        submitted_at,
        client_version
    ) VALUES (
        @run_id,
        @game_version,
        @mode,
        @host_player_id,
        @started_at,
        @ended_at,
        @duration_ms,
        @result,
        @seed,
        @difficulty,
        @metadata,
        @submitted_at,
        @client_version
    );
`);

const insertPlayerStmt = db.prepare(`
    INSERT INTO run_players (
        run_id,
        player_id,
        class,
        deck,
        affixes,
        gear,
        total_damage_dealt,
        total_damage_taken,
        hits_taken,
        rooms_cleared,
        deaths
    ) VALUES (
        @run_id,
        @player_id,
        @class,
        @deck,
        @affixes,
        @gear,
        @total_damage_dealt,
        @total_damage_taken,
        @hits_taken,
        @rooms_cleared,
        @deaths
    );
`);

const insertAffixStmt = db.prepare(`
    INSERT INTO affix_pool (
        run_id,
        affix_id,
        source,
        min_value,
        max_value
    ) VALUES (
        @run_id,
        @affix_id,
        @source,
        @min_value,
        @max_value
    );
`);

const insertRoomStmt = db.prepare(`
    INSERT INTO rooms (
        run_id,
        room_id,
        room_number,
        type,
        entered_at,
        cleared_at,
        duration_ms,
        damage_dealt_by_player,
        damage_taken_by_player,
        hits_taken_by_player,
        player_stats_start,
        player_stats_end
    ) VALUES (
        @run_id,
        @room_id,
        @room_number,
        @type,
        @entered_at,
        @cleared_at,
        @duration_ms,
        @damage_dealt_by_player,
        @damage_taken_by_player,
        @hits_taken_by_player,
        @player_stats_start,
        @player_stats_end
    );
`);

const insertRoomEventStmt = db.prepare(`
    INSERT INTO room_events (
        run_id,
        room_id,
        timestamp,
        event_type,
        player_id,
        target_id,
        value,
        metadata
    ) VALUES (
        @run_id,
        @room_id,
        @timestamp,
        @event_type,
        @player_id,
        @target_id,
        @value,
        @metadata
    );
`);

const insertBossEncounterStmt = db.prepare(`
    INSERT INTO boss_encounters (
        run_id,
        boss_id,
        started_at,
        ended_at,
        duration_ms,
        damage_by_player,
        damage_to_players,
        hits_taken_by_players,
        phases
    ) VALUES (
        @run_id,
        @boss_id,
        @started_at,
        @ended_at,
        @duration_ms,
        @damage_by_player,
        @damage_to_players,
        @hits_taken_by_players,
        @phases
    );
`);

const selectRunStmt = db.prepare('SELECT run_id FROM runs WHERE run_id = ?');

function toJson(value) {
    if (value === null || value === undefined) {
        return null;
    }
    return JSON.stringify(value);
}

function requireAuth(req, res, next) {
    if (!INGEST_TOKEN) {
        return next();
    }

    const headerToken =
        req.get('x-metrics-token') ||
        (req.get('authorization') || '').replace(/^Bearer\s+/i, '');

    if (headerToken && headerToken === INGEST_TOKEN) {
        return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
}

function buildApp() {
    const app = express();

    app.use(helmet());
    app.use(express.json({ limit: '2mb' }));
    app.use(morgan('combined'));
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
        res.header(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, X-Metrics-Token, x-metrics-token'
        );
        res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        return next();
    });

    app.get('/health', (req, res) => {
        return res.json({ status: 'ok', time: new Date().toISOString() });
    });

    app.get('/status', (req, res) => {
        return res.json({
            status: 'ok',
            uptimeSeconds: Math.round(process.uptime()),
            version: process.env.METRICS_VERSION || 'unknown'
        });
    });

    app.post('/ingest', requireAuth, (req, res) => {
    const payload = req.body;

    if (!validateTelemetry(payload)) {
        return res.status(400).json({
            error: 'Invalid telemetry payload',
            details: validateTelemetry.errors
        });
    }

    const run = payload.run;
    const existing = selectRunStmt.get(run.runId);
    if (existing) {
        return res.status(200).json({ status: 'ok', message: 'Run already ingested' });
    }

    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
        insertRunStmt.run({
            run_id: run.runId,
            game_version: run.gameVersion || payload.clientVersion || null,
            mode: run.mode,
            host_player_id: run.hostPlayerId,
            started_at: run.startedAt,
            ended_at: run.endedAt,
            duration_ms: Math.round(run.durationMs || 0),
            result: run.result,
            seed: run.seed || null,
            difficulty: run.difficulty || null,
            metadata: toJson(run.metadata),
            submitted_at: payload.submittedAt || now,
            client_version: payload.clientVersion || null
        });

        (run.players || []).forEach(player => {
            insertPlayerStmt.run({
                run_id: run.runId,
                player_id: player.playerId,
                class: player.class || null,
                deck: toJson(player.deck || []),
                affixes: toJson(player.affixes || []),
        gear: toJson(player.gear || null),
                total_damage_dealt: player.totalDamageDealt || 0,
                total_damage_taken: player.totalDamageTaken || 0,
                hits_taken: player.hitsTaken || 0,
                rooms_cleared: player.roomsCleared || 0,
                deaths: player.deaths || 0
            });
        });

        (run.affixPool || []).forEach(affix => {
            insertAffixStmt.run({
                run_id: run.runId,
                affix_id: affix.id || 'unknown',
                source: affix.source || null,
                min_value: affix.minValue !== undefined ? affix.minValue : null,
                max_value: affix.maxValue !== undefined ? affix.maxValue : null
            });
        });

        (run.rooms || []).forEach(room => {
            insertRoomStmt.run({
                run_id: run.runId,
                room_id: room.roomId,
                room_number: room.roomNumber,
                type: room.type || null,
                entered_at: room.enteredAt || null,
                cleared_at: room.clearedAt || null,
                duration_ms: room.durationMs !== undefined ? Math.round(room.durationMs) : null,
                damage_dealt_by_player: toJson(room.damageDealtByPlayer || {}),
                damage_taken_by_player: toJson(room.damageTakenByPlayer || {}),
        hits_taken_by_player: toJson(room.hitsTakenByPlayer || {}),
        player_stats_start: toJson(room.playerStatsStart || []),
        player_stats_end: toJson(room.playerStatsEnd || [])
            });

            if (room.events && room.events.length) {
                room.events.forEach(event => {
                    insertRoomEventStmt.run({
                        run_id: run.runId,
                        room_id: room.roomId,
                        timestamp: event.timestamp || null,
                        event_type: event.type || 'event',
                        player_id: event.playerId || null,
                        target_id: event.targetId || null,
                        value: event.value !== undefined ? event.value : null,
                        metadata: toJson(event.metadata || {})
                    });
                });
            }
        });

        (run.bossEncounters || []).forEach(encounter => {
            insertBossEncounterStmt.run({
                run_id: run.runId,
                boss_id: encounter.bossId,
                started_at: encounter.startedAt || null,
                ended_at: encounter.endedAt || null,
                duration_ms: encounter.durationMs !== undefined ? Math.round(encounter.durationMs) : null,
                damage_by_player: toJson(encounter.damageByPlayer || {}),
                damage_to_players: toJson(encounter.damageToPlayers || {}),
                hits_taken_by_players: toJson(encounter.hitsTakenByPlayers || {}),
                phases: toJson(encounter.phases || [])
            });
        });
    });

    try {
        transaction();
    } catch (error) {
        console.error('[metrics] failed to persist telemetry', error);
        return res.status(500).json({ error: 'Failed to persist telemetry' });
    }

        return res.status(201).json({ status: 'ok' });
    });

    return app;
}

function createServer(options = {}) {
    const app = buildApp();
    const port = options.port || PORT;
    if (!options.skipListen) {
        app.listen(port, () => {
            console.log(`[metrics] listening on port ${port}`);
        });
    }
    return { app };
}

if (require.main === module) {
    createServer();
}

module.exports = { createServer };


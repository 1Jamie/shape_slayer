/* eslint-disable no-console */
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const Database = require('better-sqlite3');

const PORT = process.env.METRICS_GUI_PORT ? Number(process.env.METRICS_GUI_PORT) : 5000;
const DB_PATH = path.join(__dirname, '..', 'server', 'data', 'metrics.sqlite');

let db;
try {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma('foreign_keys = ON;');
} catch (error) {
    console.warn('[metrics-gui] Failed to open database. Some routes will be unavailable until telemetry is captured.', error);
}

function buildApp() {
    const app = express();

    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginEmbedderPolicy: false,
        originAgentCluster: false
    }));
    app.use(compression());
    app.use(morgan('combined'));

    app.use(express.static(path.join(__dirname, 'public'), {
        extensions: ['html']
    }));

function ensureDb(req, res) {
    if (!db) {
        res.status(503).json({ error: 'Metrics database not available' });
        return false;
    }
    return true;
}

const selectRunsStmt = db
    ? db.prepare(`
        SELECT run_id,
               game_version,
               mode,
               host_player_id,
               started_at,
               ended_at,
               duration_ms,
               result,
               difficulty
        FROM runs
        ORDER BY datetime(started_at) DESC
        LIMIT @limit;
    `)
    : null;

const selectRunStmt = db
    ? db.prepare('SELECT * FROM runs WHERE run_id = ?')
    : null;

const selectRunPlayersStmt = db
    ? db.prepare(`
        SELECT player_id,
               class,
               deck,
               affixes,
               gear,
               total_damage_dealt,
               total_damage_taken,
               hits_taken,
               rooms_cleared,
               deaths
        FROM run_players
        WHERE run_id = ?
    `)
    : null;

const selectRoomsStmt = db
    ? db.prepare(`
        SELECT room_id,
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
        FROM rooms
        WHERE run_id = ?
        ORDER BY room_number ASC
    `)
    : null;

const selectRoomEventsStmt = db
    ? db.prepare(`
        SELECT room_id,
               event_type,
               COUNT(*) as count
        FROM room_events
        WHERE run_id = ?
        GROUP BY room_id, event_type
    `)
    : null;

const selectBossEncountersStmt = db
    ? db.prepare(`
        SELECT boss_id,
               started_at,
               ended_at,
               duration_ms,
               damage_by_player,
               damage_to_players,
               hits_taken_by_players,
               phases
        FROM boss_encounters
        WHERE run_id = ?
    `)
    : null;

const selectAffixesStmt = db
    ? db.prepare(`
        SELECT affix_id,
               source,
               min_value,
               max_value
        FROM affix_pool
        WHERE run_id = ?
    `)
    : null;

const selectDamageAggregationStmt = db
    ? db.prepare(`
        SELECT run_id,
               SUM(total_damage_dealt) AS total_damage_dealt,
               SUM(total_damage_taken) AS total_damage_taken,
               SUM(hits_taken) AS total_hits_taken
        FROM run_players
        GROUP BY run_id
    `)
    : null;

const selectRunResultsStmt = db
    ? db.prepare(`
        SELECT result, COUNT(*) as count
        FROM runs
        GROUP BY result
    `)
    : null;

const selectModeCountsStmt = db
    ? db.prepare(`
        SELECT mode, COUNT(*) as count
        FROM runs
        GROUP BY mode
    `)
    : null;

const selectTopAffixesStmt = db
    ? db.prepare(`
        SELECT affix_id, COUNT(*) as count
        FROM affix_pool
        GROUP BY affix_id
        ORDER BY count DESC
        LIMIT 10
    `)
    : null;

const selectBossSummaryStmt = db
    ? db.prepare(`
        SELECT boss_id,
               COUNT(*) as encounters,
               AVG(duration_ms) as avg_duration_ms
        FROM boss_encounters
        GROUP BY boss_id
        ORDER BY encounters DESC
    `)
    : null;

    app.get('/api/runs', (req, res) => {
    if (!ensureDb(req, res)) return;

    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
    const runs = selectRunsStmt.all({ limit });

    const runsWithAggregates = runs.map(run => {
        const players = selectRunPlayersStmt.all(run.run_id).map(player => ({
            ...player,
            deck: player.deck ? JSON.parse(player.deck) : [],
            affixes: player.affixes ? JSON.parse(player.affixes) : []
        }));

        const totalDamageDealt = players.reduce((sum, player) => sum + (player.total_damage_dealt || 0), 0);
        const totalDamageTaken = players.reduce((sum, player) => sum + (player.total_damage_taken || 0), 0);
        const totalHitsTaken = players.reduce((sum, player) => sum + (player.hits_taken || 0), 0);

        return {
            ...run,
            totalDamageDealt,
            totalDamageTaken,
            totalHitsTaken,
            playerCount: players.length
        };
    });

        res.json({ runs: runsWithAggregates });
    });

    app.get('/api/runs/:runId', (req, res) => {
    if (!ensureDb(req, res)) return;

    const run = selectRunStmt.get(req.params.runId);
    if (!run) {
        return res.status(404).json({ error: 'Run not found' });
    }

    const playersRaw = selectRunPlayersStmt.all(run.run_id);
    const players = playersRaw.map(player => ({
        playerId: player.player_id,
        class: player.class,
        deck: player.deck ? JSON.parse(player.deck) : [],
        affixes: player.affixes ? JSON.parse(player.affixes) : [],
        gear: player.gear ? JSON.parse(player.gear) : null,
        totalDamageDealt: player.total_damage_dealt || 0,
        totalDamageTaken: player.total_damage_taken || 0,
        hitsTaken: player.hits_taken || 0,
        roomsCleared: player.rooms_cleared || 0,
        deaths: player.deaths || 0
    }));

    const roomsRaw = selectRoomsStmt.all(run.run_id);
    const roomEvents = selectRoomEventsStmt.all(run.run_id);
    const eventMap = {};
    roomEvents.forEach(event => {
        const key = `${event.room_id}:${event.event_type}`;
        eventMap[key] = event.count;
    });

    const rooms = roomsRaw.map(room => ({
        roomId: room.room_id,
        roomNumber: room.room_number,
        type: room.type,
        enteredAt: room.entered_at,
        clearedAt: room.cleared_at,
        durationMs: room.duration_ms,
        damageDealtByPlayer: room.damage_dealt_by_player ? JSON.parse(room.damage_dealt_by_player) : {},
        damageTakenByPlayer: room.damage_taken_by_player ? JSON.parse(room.damage_taken_by_player) : {},
        hitsTakenByPlayer: room.hits_taken_by_player ? JSON.parse(room.hits_taken_by_player) : {},
        playerStatsStart: room.player_stats_start ? JSON.parse(room.player_stats_start) : [],
        playerStatsEnd: room.player_stats_end ? JSON.parse(room.player_stats_end) : [],
        eventCounts: ['damage', 'hitTaken', 'affixTriggered', 'bossPhase'].reduce((acc, type) => {
            const key = `${room.room_id}:${type}`;
            const value = eventMap[key];
            if (value !== undefined) {
                acc[type] = value;
            }
            return acc;
        }, {})
    }));

    const bossEncounters = selectBossEncountersStmt.all(run.run_id).map(encounter => ({
        bossId: encounter.boss_id,
        startedAt: encounter.started_at,
        endedAt: encounter.ended_at,
        durationMs: encounter.duration_ms,
        damageByPlayer: encounter.damage_by_player ? JSON.parse(encounter.damage_by_player) : {},
        damageToPlayers: encounter.damage_to_players ? JSON.parse(encounter.damage_to_players) : {},
        hitsTakenByPlayers: encounter.hits_taken_by_players ? JSON.parse(encounter.hits_taken_by_players) : {},
        phases: encounter.phases ? JSON.parse(encounter.phases) : []
    }));

    const affixPool = selectAffixesStmt.all(run.run_id).map(affix => ({
        id: affix.affix_id,
        source: affix.source,
        minValue: affix.min_value,
        maxValue: affix.max_value
    }));

        res.json({
        run: {
            ...run,
            metadata: run.metadata ? JSON.parse(run.metadata) : {}
        },
        players,
        rooms,
        bossEncounters,
        affixPool
    });
});

app.get('/api/summary', (req, res) => {
    if (!ensureDb(req, res)) return;

    const damageRows = selectDamageAggregationStmt.all();
    const runResults = selectRunResultsStmt.all();
    const modeCounts = selectModeCountsStmt.all();
    const topAffixes = selectTopAffixesStmt.all();
    const bossSummary = selectBossSummaryStmt.all();

    const totalRuns = damageRows.length;
    const totalDamage = damageRows.reduce((sum, row) => sum + (row.total_damage_dealt || 0), 0);
    const totalHits = damageRows.reduce((sum, row) => sum + (row.total_hits_taken || 0), 0);
    const damagePerRun = totalRuns ? totalDamage / totalRuns : 0;
    const hitsPerRun = totalRuns ? totalHits / totalRuns : 0;

    const durationStats = db.prepare('SELECT AVG(duration_ms) AS avg_duration, MAX(duration_ms) AS max_duration, MIN(duration_ms) AS min_duration FROM runs').get();

        res.json({
        totals: {
            runs: totalRuns,
            averageDamagePerRun: damagePerRun,
            averageHitsPerRun: hitsPerRun,
            averageDurationMs: durationStats.avg_duration || 0,
            longestDurationMs: durationStats.max_duration || 0,
            shortestDurationMs: durationStats.min_duration || 0
        },
        runResults,
        modeCounts,
        topAffixes,
        bossSummary
    });
    });

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    return app;
}

function createServer(options = {}) {
    const app = buildApp();
    const port = options.port || PORT;
    if (!options.skipListen) {
        app.listen(port, () => {
            console.log(`[metrics-gui] listening on port ${port}`);
        });
    }
    return { app };
}

if (require.main === module) {
    createServer();
}

module.exports = { createServer };


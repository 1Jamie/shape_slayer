/* eslint-disable no-console */
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const Database = require('better-sqlite3');

const PORT = process.env.METRICS_GUI_PORT ? Number(process.env.METRICS_GUI_PORT) : 5000;
const DB_PATH = process.env.METRICS_DB_PATH
    ? path.resolve(process.env.METRICS_DB_PATH)
    : path.join(__dirname, '..', 'server', 'data', 'metrics.sqlite');

let db;
try {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma('foreign_keys = ON;');
} catch (error) {
    console.warn('[metrics-gui] Failed to open database. Some routes will be unavailable until telemetry is captured.', error);
}

function ensureDb(req, res) {
    if (!db) {
        res.status(503).json({ error: 'Metrics database not available' });
        return false;
    }
    return true;
}

function buildRunsQuery(filters = {}) {
    const clauses = [];
    const params = { limit: filters.limit || 25 };

    if (filters.mode) {
        clauses.push('mode = @mode');
        params.mode = filters.mode;
    }
    if (filters.gameMode) {
        clauses.push('COALESCE(game_mode, \'unknown\') = @game_mode');
        params.game_mode = filters.gameMode;
    }
    if (filters.result) {
        clauses.push('result = @result');
        params.result = filters.result;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    return {
        sql: `
            SELECT run_id,
                   game_version,
                   mode,
                   game_mode,
                   player_count,
                   host_player_id,
                   started_at,
                   ended_at,
                   duration_ms,
                   result,
                   difficulty
            FROM runs
            ${where}
            ORDER BY datetime(started_at) DESC
            LIMIT @limit;
        `,
        params
    };
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

    app.get('/api/runs', (req, res) => {
        if (!ensureDb(req, res)) return;

        const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
        const { sql, params } = buildRunsQuery({
            limit,
            mode: req.query.mode || null,
            gameMode: req.query.game_mode || req.query.gameMode || null,
            result: req.query.result || null
        });

        const selectRunsStmt = db.prepare(sql);
        const selectRunPlayersStmt = db.prepare(`
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
        `);

        const runs = selectRunsStmt.all(params);
        const runsWithAggregates = runs.map(run => {
            const players = selectRunPlayersStmt.all(run.run_id).map(player => ({
                ...player,
                deck: player.deck ? JSON.parse(player.deck) : [],
                affixes: player.affixes ? JSON.parse(player.affixes) : [],
                gear: player.gear ? JSON.parse(player.gear) : null
            }));

            const totalDamageDealt = players.reduce((sum, player) => sum + (player.total_damage_dealt || 0), 0);
            const totalDamageTaken = players.reduce((sum, player) => sum + (player.total_damage_taken || 0), 0);
            const totalHitsTaken = players.reduce((sum, player) => sum + (player.hits_taken || 0), 0);

            return {
                ...run,
                totalDamageDealt,
                totalDamageTaken,
                totalHitsTaken,
                playerCount: run.player_count || players.length
            };
        });

        res.json({ runs: runsWithAggregates });
    });

    app.get('/api/runs/:runId', (req, res) => {
        if (!ensureDb(req, res)) return;

        const selectRunStmt = db.prepare('SELECT * FROM runs WHERE run_id = ?');
        const selectRunPlayersStmt = db.prepare(`
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
        `);
        const selectRoomsStmt = db.prepare(`
            SELECT room_id,
                   room_number,
                   type,
                   biome_id,
                   archetype,
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
        `);
        const selectRoomEventsStmt = db.prepare(`
            SELECT room_id,
                   event_type,
                   COUNT(*) as count
            FROM room_events
            WHERE run_id = ?
            GROUP BY room_id, event_type
        `);
        const selectBossEncountersStmt = db.prepare(`
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
        `);
        const selectAffixesStmt = db.prepare(`
            SELECT affix_id,
                   source,
                   min_value,
                   max_value
            FROM affix_pool
            WHERE run_id = ?
        `);

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

        const rooms = roomsRaw.map(room => ({
            roomId: room.room_id,
            roomNumber: room.room_number,
            type: room.type,
            biomeId: room.biome_id,
            archetype: room.archetype,
            enteredAt: room.entered_at,
            clearedAt: room.cleared_at,
            durationMs: room.duration_ms,
            damageDealtByPlayer: room.damage_dealt_by_player ? JSON.parse(room.damage_dealt_by_player) : {},
            damageTakenByPlayer: room.damage_taken_by_player ? JSON.parse(room.damage_taken_by_player) : {},
            hitsTakenByPlayer: room.hits_taken_by_player ? JSON.parse(room.hits_taken_by_player) : {},
            playerStatsStart: room.player_stats_start ? JSON.parse(room.player_stats_start) : [],
            playerStatsEnd: room.player_stats_end ? JSON.parse(room.player_stats_end) : [],
            eventCounts: roomEvents.reduce((acc, event) => {
                if (event.room_id !== room.room_id) return acc;
                acc[event.event_type] = event.count;
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

        const modeFilter = req.query.mode || null;
        const gameModeFilter = req.query.game_mode || req.query.gameMode || null;

        const runFilterClauses = [];
        const runFilterParams = {};
        if (modeFilter) {
            runFilterClauses.push('mode = @mode');
            runFilterParams.mode = modeFilter;
        }
        if (gameModeFilter) {
            runFilterClauses.push('COALESCE(game_mode, \'unknown\') = @game_mode');
            runFilterParams.game_mode = gameModeFilter;
        }
        const runWhere = runFilterClauses.length ? `WHERE ${runFilterClauses.join(' AND ')}` : '';

        const damageRows = db.prepare(`
            SELECT rp.run_id,
                   SUM(rp.total_damage_dealt) AS total_damage_dealt,
                   SUM(rp.total_damage_taken) AS total_damage_taken,
                   SUM(rp.hits_taken) AS total_hits_taken
            FROM run_players rp
            JOIN runs r ON r.run_id = rp.run_id
            ${runWhere}
            GROUP BY rp.run_id
        `).all(runFilterParams);

        const runResults = db.prepare(`
            SELECT result, COUNT(*) as count
            FROM runs
            ${runWhere}
            GROUP BY result
        `).all(runFilterParams);

        const modeCounts = db.prepare(`
            SELECT mode, COUNT(*) as count
            FROM runs
            ${runWhere}
            GROUP BY mode
        `).all(runFilterParams);

        const gameModeCounts = db.prepare(`
            SELECT COALESCE(game_mode, 'unknown') AS game_mode, COUNT(*) as count
            FROM runs
            ${runWhere}
            GROUP BY COALESCE(game_mode, 'unknown')
        `).all(runFilterParams);

        const eventTypeSummary = db.prepare(`
            SELECT re.event_type, COUNT(*) as count
            FROM room_events re
            JOIN runs r ON r.run_id = re.run_id
            ${runWhere.replace(/mode =/g, 'r.mode =').replace(/COALESCE\(game_mode/g, 'COALESCE(r.game_mode')}
            GROUP BY re.event_type
            ORDER BY count DESC
            LIMIT 20
        `).all(runFilterParams);

        const topAffixes = db.prepare(`
            SELECT ap.affix_id, COUNT(*) as count
            FROM affix_pool ap
            JOIN runs r ON r.run_id = ap.run_id
            ${runWhere.replace(/mode =/g, 'r.mode =').replace(/COALESCE\(game_mode/g, 'COALESCE(r.game_mode')}
            GROUP BY ap.affix_id
            ORDER BY count DESC
            LIMIT 10
        `).all(runFilterParams);

        const bossSummary = db.prepare(`
            SELECT be.boss_id,
                   COUNT(*) as encounters,
                   AVG(be.duration_ms) as avg_duration_ms
            FROM boss_encounters be
            JOIN runs r ON r.run_id = be.run_id
            ${runWhere.replace(/mode =/g, 'r.mode =').replace(/COALESCE\(game_mode/g, 'COALESCE(r.game_mode')}
            GROUP BY be.boss_id
            ORDER BY encounters DESC
        `).all(runFilterParams);

        const totalRuns = damageRows.length;
        const totalDamage = damageRows.reduce((sum, row) => sum + (row.total_damage_dealt || 0), 0);
        const totalHits = damageRows.reduce((sum, row) => sum + (row.total_hits_taken || 0), 0);
        const damagePerRun = totalRuns ? totalDamage / totalRuns : 0;
        const hitsPerRun = totalRuns ? totalHits / totalRuns : 0;

        const durationStats = db.prepare(`
            SELECT AVG(duration_ms) AS avg_duration,
                   MAX(duration_ms) AS max_duration,
                   MIN(duration_ms) AS min_duration
            FROM runs
            ${runWhere}
        `).get(runFilterParams);

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
            gameModeCounts,
            topAffixes,
            bossSummary,
            eventTypeSummary
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

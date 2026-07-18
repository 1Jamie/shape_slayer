'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

function loadRunProfiler() {
    const context = {
        window: {},
        performance: { now: () => Date.now() },
        console,
        GameVersion: { VERSION: 'test' },
        Game: { roomNumber: 1 }
    };
    context.window.Engine = {};
    context.Engine = context.window.Engine;
    vm.runInNewContext(fs.readFileSync(`${__dirname}/../src/engine/profiler.js`, 'utf8'), context);
    vm.runInNewContext(fs.readFileSync(`${__dirname}/../src/game/run-profiler.js`, 'utf8'), context);
    return context.window.RunProfiler;
}

test('RunProfiler aggregates frame samples and ranks phases', () => {
    const RunProfiler = loadRunProfiler();
    RunProfiler.start({ gameMode: 'cards', selectedClass: 'square' });
    RunProfiler.markRoomEnter(1, 'normal', 'swarm');

    for (let i = 0; i < 20; i++) {
        RunProfiler.recordFrame(0.016, 14, {
            update: 2,
            render: 10,
            static: 1,
            world: 3,
            worldGlow: 1,
            worldBodies: 2,
            vignette: 4,
            postFx: 0.5,
            ui: 1,
            catchupUpdates: i === 5 ? 3 : 0,
            accumulatorTruncated: i === 7,
            snapshot: {
                qualityTier: i % 4 === 0 ? 'medium' : 'normal',
                counts: { enemiesVisible: 5 + i, enemiesTotal: 8 },
                subTimings: { groundLoot: 0.4, detailRings: 0.2, remoteActors: 0 }
            }
        }, { state: 'PLAYING', roomNumber: 1 });
        RunProfiler.lastSampleTime = 0;
    }

    RunProfiler.markRoomEnter(2, 'elite', 'prism');
    for (let i = 0; i < 10; i++) {
        RunProfiler.recordFrame(0.04, 30, {
            update: 4,
            render: 22,
            static: 2,
            world: 6,
            vignette: 10,
            postFx: 1,
            ui: 2,
            snapshot: {
                qualityTier: 'heavy',
                counts: { enemiesVisible: 12, enemiesTotal: 15 },
                subTimings: { groundLoot: 1.2, detailRings: 0.5, remoteActors: 0 }
            }
        }, { state: 'PLAYING', roomNumber: 2 });
        RunProfiler.lastSampleTime = 0;
    }

    const report = RunProfiler.stop();
    assert.equal(report.version, 1);
    assert.ok(report.global.sampleCount >= 30);
    assert.equal(report.rooms.length, 2);
    assert.ok(report.summary.render.avg > 0);
    assert.ok(report.summary.phaseRanking.length > 0);
    assert.equal(report.summary.phaseRanking[0].phase, 'vignette');
    assert.ok(report.summary.worstRooms.length >= 1);
    assert.ok(report.summary.totalSpikes >= 1);
});

test('RunProfiler exportJson returns JSON without requiring download', () => {
    const RunProfiler = loadRunProfiler();
    RunProfiler.start({ gameMode: 'gear' });
    RunProfiler.recordFrame(0.02, 15, { render: 8, snapshot: { qualityTier: 'normal' } }, { state: 'PLAYING', roomNumber: 1 });
    RunProfiler.lastSampleTime = 0;
    const json = RunProfiler.exportJson({ download: false });
    const parsed = JSON.parse(json);
    assert.equal(parsed.meta.gameMode, 'gear');
    assert.ok(parsed.summary.frame);
});

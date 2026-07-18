// Game-specific wrapper for Engine.Profiler, annotating details for Shape Slayer.

(function () {
    if (typeof Engine === 'undefined' || !Engine.Profiler) {
        // Fallback object if loaded in standalone node tests before profiler.js
        if (typeof window === 'undefined') {
            global.Engine = global.Engine || {};
            global.Engine.Profiler = require('../../src/engine/profiler.js').Profiler;
        } else {
            console.error('[RunProfiler] Engine.Profiler not loaded!');
            return;
        }
    }

    const helpers = Engine.Profiler._helpers;
    const PHASE_KEYS = helpers.PHASE_KEYS;
    const SCENE_COUNT_KEYS = helpers.SCENE_COUNT_KEYS;
    const pushValue = helpers.pushValue;
    const createMetricSet = helpers.createMetricSet;
    const finalizeMetricSet = helpers.finalizeMetricSet;
    const mergeMetricSets = helpers.mergeMetricSets;
    const buildPhaseRanking = helpers.buildPhaseRanking;

    const RunProfiler = {
        active: false,
        autoStartOnRun: false,
        get sampleIntervalMs() { return this.engineProfiler.sampleIntervalMs; },
        set sampleIntervalMs(v) { this.engineProfiler.sampleIntervalMs = v; },
        get lastSampleTime() { return this.engineProfiler.lastSampleTime; },
        set lastSampleTime(v) { this.engineProfiler.lastSampleTime = v; },
        runMeta: null,
        startedAt: 0,
        endedAt: 0,
        endReason: null,
        currentRoomStats: null,
        rooms: [],
        transitions: [],
        pendingTransition: null,
        spikes: [],
        timeline: [],

        engineProfiler: new Engine.Profiler(),

        isActive() {
            return this.active;
        },

        start(meta) {
            this.active = true;
            this.startedAt = performance.now();
            this.endedAt = 0;
            this.endReason = null;
            this.lastSampleTime = 0;
            this.rooms = [];
            this.spikes = [];
            this.timeline = [];
            this.transitions = [];
            this.pendingTransition = null;
            this.currentRoomStats = null;
            
            this.runMeta = Object.assign({
                gameMode: null,
                selectedClass: null,
                multiplayer: false,
                version: typeof GameVersion !== 'undefined' ? GameVersion.VERSION : null
            }, meta || {});

            this.engineProfiler.start();
            console.log('[RunProfiler] Started');
        },

        stop() {
            if (!this.active) {
                return null;
            }
            this._closeCurrentRoom();
            this.active = false;
            this.endedAt = performance.now();
            this.engineProfiler.stop();
            console.log('[RunProfiler] Stopped');
            return this.buildReport();
        },

        endRun(reason) {
            this.endReason = reason || 'ended';
            return this.stop();
        },

        markRoomTransitionStart() {
            if (!this.active) {
                return;
            }
            this.pendingTransition = { startedAt: performance.now(), roomNumber: null };
        },

        markRoomTransitionEnd(roomNumber) {
            if (!this.active || !this.pendingTransition) {
                return;
            }
            const durationMs = performance.now() - this.pendingTransition.startedAt;
            this.transitions.push({
                roomNumber: roomNumber != null ? roomNumber : this.pendingTransition.roomNumber,
                durationMs,
                atMs: Math.round(performance.now() - this.startedAt)
            });
            this.pendingTransition = null;
        },

        markRoomEnter(roomNumber, roomType, biomeId) {
            if (!this.active) {
                return;
            }
            this._closeCurrentRoom();
            this.currentRoomStats = createMetricSet();
            this.currentRoomStats.startedAt = performance.now();
            this.currentRoomStats.meta = {
                roomNumber: roomNumber || 1,
                roomType: roomType || 'normal',
                biomeId: biomeId || null
            };
            if (this.pendingTransition) {
                this.pendingTransition.roomNumber = roomNumber || 1;
            }
        },

        _closeCurrentRoom() {
            if (!this.currentRoomStats) {
                return;
            }
            this.currentRoomStats.endedAt = performance.now();
            const finalized = finalizeMetricSet(this.currentRoomStats);
            finalized.meta = Object.assign({}, this.currentRoomStats.meta);
            this.rooms.push(finalized);
            this.currentRoomStats = null;
        },

        recordFrame(frameTimeMs, processTimeMs, breakdown, context) {
            if (!this.active) {
                return;
            }

            // Update underlying engine profiler and let it handle throttling
            const recorded = this.engineProfiler.recordFrame(frameTimeMs, processTimeMs, breakdown, context);
            if (!recorded) {
                return;
            }

            // Record room specific sample count & metrics
            if (this.currentRoomStats) {
                this.currentRoomStats.sampleCount += 1;
                const frameMs = frameTimeMs * 1000;
                const b = breakdown || {};
                const snapshot = b.snapshot || {};
                const sub = snapshot.subTimings || {};
                const phaseSum = (b.static || 0) + (b.world || 0) + (b.vignette || 0) + (b.postFx || 0) + (b.ui || 0);
                const otherRender = typeof b.render === 'number' ? Math.max(0, b.render - phaseSum) : 0;

                const values = {
                    frame: frameMs,
                    process: processTimeMs,
                    update: b.update || 0,
                    render: b.render || 0,
                    static: b.static || 0,
                    world: b.world || 0,
                    worldGlow: b.worldGlow || 0,
                    worldBodies: b.worldBodies || 0,
                    vignette: b.vignette || 0,
                    postFx: b.postFx || 0,
                    ui: b.ui || 0,
                    other: otherRender,
                    groundLoot: sub.groundLoot || 0,
                    detailRings: sub.detailRings || 0,
                    remoteActors: sub.remoteActors || 0
                };

                PHASE_KEYS.forEach(key => {
                    pushValue(this.currentRoomStats.metrics[key], values[key]);
                });
                const counts = snapshot.counts || {};
                SCENE_COUNT_KEYS.forEach(key => {
                    if (typeof counts[key] === 'number') {
                        pushValue(this.currentRoomStats.sceneCounts[key], counts[key]);
                    }
                });
                const tier = snapshot.qualityTier || 'unknown';
                this.currentRoomStats.qualityTier[tier] = (this.currentRoomStats.qualityTier[tier] || 0) + 1;
                if (Number.isFinite(b.catchupUpdates) && b.catchupUpdates > 1) {
                    this.currentRoomStats.catchupFrames += 1;
                }
                if (b.accumulatorTruncated) {
                    this.currentRoomStats.accumulatorDrops += 1;
                }

                const SPIKE_FRAME_MS = 33;
                const SPIKE_RENDER_MS = 22;
                if (frameMs >= SPIKE_FRAME_MS || (b.render || 0) >= SPIKE_RENDER_MS) {
                    this.currentRoomStats.spikes += 1;
                }
            }

            // Sync timeline and spikes from the engine profiler
            this.spikes = this.engineProfiler.spikes;
            this.timeline = this.engineProfiler.timeline;
        },

        buildReport() {
            const report = this.engineProfiler.buildReport();
            
            // Enrich reports with game-specific room-by-room performance statistics
            const endedAt = this.endedAt || performance.now();
            const rooms = this.rooms.slice();
            if (this.currentRoomStats) {
                const partial = finalizeMetricSet(Object.assign({}, this.currentRoomStats, { endedAt }));
                partial.meta = Object.assign({}, this.currentRoomStats.meta);
                partial.partial = true;
                rooms.push(partial);
            }

            const worstRooms = this.rooms.slice()
                .sort((a, b) => (b.metrics.render.p95 || 0) - (a.metrics.render.p95 || 0))
                .slice(0, 8)
                .map(room => ({
                    roomNumber: room.meta.roomNumber,
                    roomType: room.meta.roomType,
                    biomeId: room.meta.biomeId,
                    durationMs: Math.round(room.durationMs),
                    sampleCount: room.sampleCount,
                    renderAvgMs: room.metrics.render.avg,
                    renderP95Ms: room.metrics.render.p95,
                    frameP95Ms: room.metrics.frame.p95,
                    vignetteP95Ms: room.metrics.vignette.p95,
                    spikes: room.spikes,
                    qualityTier: room.qualityTier
                }));

            const transitionAvgMs = this.transitions.length > 0
                ? this.transitions.reduce((sum, t) => sum + t.durationMs, 0) / this.transitions.length
                : 0;

            report.endReason = this.endReason;
            report.meta = Object.assign({}, this.runMeta, {
                finalRoomNumber: typeof Game !== 'undefined' && Game ? Game.roomNumber : null,
                roomsVisited: this.rooms.length
            });
            report.summary.worstRooms = worstRooms;
            report.summary.roomTransitionAvgMs = transitionAvgMs;
            report.rooms = rooms;
            report.transitions = this.transitions;

            return report;
        },

        getSummaryText() {
            const report = this.buildReport();
            const s = report.summary;
            if (!s || !s.render) {
                return 'No profile data collected yet.';
            }
            const lines = [
                `Run profile (${Math.round(report.durationMs / 1000)}s, ${report.meta.roomsVisited} rooms, ${report.global ? report.global.sampleCount : 0} samples)`,
                `Frame avg/p95: ${s.frame.avg.toFixed(1)} / ${s.frame.p95.toFixed(1)} ms`,
                `Render avg/p95: ${s.render.avg.toFixed(1)} / ${s.render.p95.toFixed(1)} ms`,
                `Spikes: ${s.totalSpikes}, catch-up frames: ${s.catchupFrames}, acc drops: ${s.accumulatorDrops}`
            ];
            if (s.phaseRanking && s.phaseRanking.length > 0) {
                lines.push('Top render phases (by p95-weighted score):');
                s.phaseRanking.slice(0, 5).forEach((p, i) => {
                    lines.push(`  ${i + 1}. ${p.phase}: avg ${p.avgMs.toFixed(1)}ms, p95 ${p.p95Ms.toFixed(1)}ms (${(p.shareOfRenderAvg * 100).toFixed(0)}% of render)`);
                });
            }
            if (s.worstRooms && s.worstRooms.length > 0) {
                lines.push('Heaviest rooms (render p95):');
                s.worstRooms.slice(0, 3).forEach(room => {
                    lines.push(`  Room ${room.roomNumber} (${room.roomType}): ${room.renderP95Ms.toFixed(1)}ms p95, ${room.spikes} spikes`);
                });
            }
            if (s.qualityTierShare) {
                lines.push(`Quality time: normal ${(s.qualityTierShare.normal * 100 || 0).toFixed(0)}%, medium ${(s.qualityTierShare.medium * 100 || 0).toFixed(0)}%, heavy ${(s.qualityTierShare.heavy * 100 || 0).toFixed(0)}%`);
            }
            return lines.join('\n');
        },

        exportJson(options) {
            const opts = options || {};
            const report = this.buildReport();
            const json = JSON.stringify(report, null, opts.pretty === false ? 0 : 2);
            if (opts.download !== false && typeof document !== 'undefined') {
                const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = opts.filename || `shape-slayer-profile-${stamp}.json`;
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(url);
                console.log(`[RunProfiler] Exported ${filename}`);
            }
            return json;
        }
    };

    if (typeof window !== 'undefined') {
        window.RunProfiler = RunProfiler;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RunProfiler;
    }
})();

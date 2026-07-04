// Run-length performance profiler — samples across a full run for export and analysis.
(function () {
    const PHASE_KEYS = [
        'frame', 'process', 'update', 'render',
        'static', 'world', 'worldGlow', 'worldBodies',
        'vignette', 'postFx', 'ui', 'other',
        'groundLoot', 'gearRings', 'remotePlayers'
    ];

    const SCENE_COUNT_KEYS = [
        'enemiesVisible', 'enemiesTotal',
        'projectilesVisible', 'projectilesTotal',
        'groundLootVisible', 'groundLootTotal',
        'groundCardsVisible', 'groundCardsTotal',
        'groundItemsVisible', 'groundItemsTotal'
    ];

    const RESERVOIR_MAX = 256;
    const MAX_SPIKES = 80;
    const MAX_TIMELINE = 720;
    const DEFAULT_SAMPLE_INTERVAL_MS = 500;
    const SPIKE_FRAME_MS = 33;
    const SPIKE_RENDER_MS = 22;

    function createAccumulator() {
        return {
            count: 0,
            sum: 0,
            min: Infinity,
            max: -Infinity,
            reservoir: []
        };
    }

    function pushValue(acc, value) {
        if (typeof value !== 'number' || !isFinite(value) || value < 0) {
            return;
        }
        acc.count += 1;
        acc.sum += value;
        acc.min = Math.min(acc.min, value);
        acc.max = Math.max(acc.max, value);
        if (acc.reservoir.length < RESERVOIR_MAX) {
            acc.reservoir.push(value);
            return;
        }
        const replaceIndex = Math.floor(Math.random() * acc.count);
        if (replaceIndex < RESERVOIR_MAX) {
            acc.reservoir[replaceIndex] = value;
        }
    }

    function percentile(values, p) {
        if (!values || values.length === 0) {
            return 0;
        }
        const sorted = values.slice().sort((a, b) => a - b);
        const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
        return sorted[idx];
    }

    function finalizeAccumulator(acc) {
        if (!acc || acc.count === 0) {
            return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
        }
        return {
            count: acc.count,
            avg: acc.sum / acc.count,
            min: acc.min === Infinity ? 0 : acc.min,
            max: acc.max === -Infinity ? 0 : acc.max,
            p50: percentile(acc.reservoir, 0.5),
            p95: percentile(acc.reservoir, 0.95),
            p99: percentile(acc.reservoir, 0.99)
        };
    }

    function createMetricSet() {
        const metrics = {};
        PHASE_KEYS.forEach(key => {
            metrics[key] = createAccumulator();
        });
        const sceneCounts = {};
        SCENE_COUNT_KEYS.forEach(key => {
            sceneCounts[key] = createAccumulator();
        });
        return {
            metrics,
            sceneCounts,
            qualityTier: { normal: 0, medium: 0, heavy: 0, unknown: 0 },
            catchupFrames: 0,
            accumulatorDrops: 0,
            spikes: 0,
            sampleCount: 0,
            startedAt: 0,
            endedAt: 0
        };
    }

    function finalizeMetricSet(set) {
        const metrics = {};
        PHASE_KEYS.forEach(key => {
            metrics[key] = finalizeAccumulator(set.metrics[key]);
        });
        const sceneCounts = {};
        SCENE_COUNT_KEYS.forEach(key => {
            sceneCounts[key] = finalizeAccumulator(set.sceneCounts[key]);
        });
        return {
            sampleCount: set.sampleCount,
            durationMs: Math.max(0, (set.endedAt || performance.now()) - (set.startedAt || 0)),
            metrics,
            sceneCounts,
            qualityTier: Object.assign({}, set.qualityTier),
            catchupFrames: set.catchupFrames,
            accumulatorDrops: set.accumulatorDrops,
            spikes: set.spikes
        };
    }

    function mergeMetricSets(into, from) {
        PHASE_KEYS.forEach(key => {
            const src = from.metrics[key];
            if (!src || src.count === 0) {
                return;
            }
            const dst = into.metrics[key];
            dst.count += src.count;
            dst.sum += src.sum;
            dst.min = Math.min(dst.min, src.min);
            dst.max = Math.max(dst.max, src.max);
            src.reservoir.forEach(v => pushValue(dst, v));
        });
        SCENE_COUNT_KEYS.forEach(key => {
            const src = from.sceneCounts[key];
            if (!src || src.count === 0) {
                return;
            }
            const dst = into.sceneCounts[key];
            dst.count += src.count;
            dst.sum += src.sum;
            dst.min = Math.min(dst.min, src.min);
            dst.max = Math.max(dst.max, src.max);
            src.reservoir.forEach(v => pushValue(dst, v));
        });
        Object.keys(from.qualityTier).forEach(tier => {
            into.qualityTier[tier] = (into.qualityTier[tier] || 0) + (from.qualityTier[tier] || 0);
        });
        into.catchupFrames += from.catchupFrames || 0;
        into.accumulatorDrops += from.accumulatorDrops || 0;
        into.spikes += from.spikes || 0;
        into.sampleCount += from.sampleCount || 0;
    }

    function buildPhaseRanking(metrics) {
        const renderAvg = metrics.render && metrics.render.avg ? metrics.render.avg : 0;
        return PHASE_KEYS
            .filter(key => key !== 'frame' && key !== 'process' && key !== 'update' && key !== 'render')
            .map(key => {
                const m = metrics[key] || { avg: 0, p95: 0, max: 0, count: 0 };
                return {
                    phase: key,
                    avgMs: m.avg || 0,
                    p95Ms: m.p95 || 0,
                    maxMs: m.max || 0,
                    shareOfRenderAvg: renderAvg > 0 ? (m.avg || 0) / renderAvg : 0,
                    score: (m.p95 || 0) * 0.6 + (m.avg || 0) * 0.4
                };
            })
            .filter(entry => entry.avgMs > 0.01 || entry.p95Ms > 0.01)
            .sort((a, b) => b.score - a.score);
    }

    const RunProfiler = {
        active: false,
        autoStartOnRun: false,
        sampleIntervalMs: DEFAULT_SAMPLE_INTERVAL_MS,
        lastSampleTime: 0,
        runMeta: null,
        startedAt: 0,
        endedAt: 0,
        endReason: null,
        currentRoomStats: null,
        rooms: [],
        global: null,
        spikes: [],
        timeline: [],
        transitions: [],
        pendingTransition: null,

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
            this.global = createMetricSet();
            this.global.startedAt = this.startedAt;
            this.runMeta = Object.assign({
                gameMode: null,
                selectedClass: null,
                multiplayer: false,
                version: typeof GameVersion !== 'undefined' ? GameVersion.VERSION : null
            }, meta || {});
            console.log('[RunProfiler] Started');
        },

        stop() {
            if (!this.active) {
                return null;
            }
            this._closeCurrentRoom();
            this.active = false;
            this.endedAt = performance.now();
            if (this.global) {
                this.global.endedAt = this.endedAt;
            }
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
            mergeMetricSets(this.global, this.currentRoomStats);
            this.currentRoomStats = null;
        },

        recordFrame(frameTimeMs, processTimeMs, breakdown, context) {
            if (!this.active) {
                return;
            }

            const now = performance.now();
            if (this.lastSampleTime > 0 && now - this.lastSampleTime < this.sampleIntervalMs) {
                return;
            }
            this.lastSampleTime = now;

            const frameMs = frameTimeMs * 1000;
            const sets = [this.global];
            if (this.currentRoomStats) {
                sets.push(this.currentRoomStats);
            }

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
                gearRings: sub.gearRings || 0,
                remotePlayers: sub.remotePlayers || 0
            };

            sets.forEach(set => {
                set.sampleCount += 1;
                PHASE_KEYS.forEach(key => {
                    pushValue(set.metrics[key], values[key]);
                });
                const counts = snapshot.counts || {};
                SCENE_COUNT_KEYS.forEach(key => {
                    if (typeof counts[key] === 'number') {
                        pushValue(set.sceneCounts[key], counts[key]);
                    }
                });
                const tier = snapshot.qualityTier || 'unknown';
                set.qualityTier[tier] = (set.qualityTier[tier] || 0) + 1;
                if (Number.isFinite(b.catchupUpdates) && b.catchupUpdates > 1) {
                    set.catchupFrames += 1;
                }
                if (b.accumulatorTruncated) {
                    set.accumulatorDrops += 1;
                }
            });

            if (frameMs >= SPIKE_FRAME_MS || (b.render || 0) >= SPIKE_RENDER_MS) {
                this._recordSpike(now, frameMs, values, context || {}, snapshot);
            }

            this._pushTimeline(now, values, context || {}, snapshot);
        },

        _recordSpike(now, frameMs, values, context, snapshot) {
            if (this.currentRoomStats) {
                this.currentRoomStats.spikes += 1;
            }
            if (this.global) {
                this.global.spikes += 1;
            }
            const spike = {
                atMs: Math.round(now - this.startedAt),
                frameMs,
                roomNumber: context.roomNumber || null,
                state: context.state || null,
                qualityTier: snapshot.qualityTier || null,
                phases: {
                    update: values.update,
                    render: values.render,
                    static: values.static,
                    world: values.world,
                    vignette: values.vignette,
                    postFx: values.postFx,
                    ui: values.ui,
                    groundLoot: values.groundLoot,
                    gearRings: values.gearRings,
                    remotePlayers: values.remotePlayers
                },
                counts: snapshot.counts || null,
                catchupUpdates: context.catchupUpdates || 0,
                accumulatorTruncated: !!context.accumulatorTruncated
            };
            this.spikes.push(spike);
            if (this.spikes.length > MAX_SPIKES) {
                this.spikes.sort((a, b) => b.frameMs - a.frameMs);
                this.spikes.length = MAX_SPIKES;
            }
        },

        _pushTimeline(now, values, context, snapshot) {
            this.timeline.push({
                atMs: Math.round(now - this.startedAt),
                frameMs: values.frame,
                renderMs: values.render,
                vignetteMs: values.vignette,
                roomNumber: context.roomNumber || null,
                state: context.state || null,
                qualityTier: snapshot.qualityTier || null,
                enemies: snapshot.counts ? snapshot.counts.enemiesVisible : null
            });
            if (this.timeline.length > MAX_TIMELINE) {
                this.timeline.shift();
            }
        },

        buildReport() {
            const endedAt = this.endedAt || performance.now();
            const rooms = this.rooms.slice();
            if (this.currentRoomStats) {
                const partial = finalizeMetricSet(Object.assign({}, this.currentRoomStats, { endedAt }));
                partial.meta = Object.assign({}, this.currentRoomStats.meta);
                partial.partial = true;
                rooms.push(partial);
            }

            const globalWorking = createMetricSet();
            globalWorking.startedAt = this.global ? this.global.startedAt : this.startedAt;
            globalWorking.endedAt = endedAt;
            if (this.global) {
                mergeMetricSets(globalWorking, this.global);
            }
            if (this.currentRoomStats) {
                mergeMetricSets(globalWorking, this.currentRoomStats);
            }
            const global = finalizeMetricSet(globalWorking);
            const metrics = global ? global.metrics : {};
            const phaseRanking = buildPhaseRanking(metrics);
            const qualityTotal = global
                ? Object.values(global.qualityTier).reduce((sum, n) => sum + n, 0)
                : 0;
            const qualityTierShare = {};
            if (global && qualityTotal > 0) {
                Object.keys(global.qualityTier).forEach(tier => {
                    qualityTierShare[tier] = (global.qualityTier[tier] || 0) / qualityTotal;
                });
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

            return {
                version: 1,
                exportedAt: new Date().toISOString(),
                startedAtMs: Math.round(this.startedAt),
                endedAtMs: Math.round(endedAt),
                durationMs: Math.round(endedAt - this.startedAt),
                endReason: this.endReason,
                meta: Object.assign({}, this.runMeta, {
                    finalRoomNumber: typeof Game !== 'undefined' && Game ? Game.roomNumber : null,
                    roomsVisited: this.rooms.length
                }),
                summary: {
                    frame: metrics.frame || null,
                    process: metrics.process || null,
                    render: metrics.render || null,
                    update: metrics.update || null,
                    vignette: metrics.vignette || null,
                    world: metrics.world || null,
                    groundLoot: metrics.groundLoot || null,
                    gearRings: metrics.gearRings || null,
                    phaseRanking,
                    qualityTierShare,
                    totalSpikes: global ? global.spikes : 0,
                    catchupFrames: global ? global.catchupFrames : 0,
                    accumulatorDrops: global ? global.accumulatorDrops : 0,
                    roomTransitionAvgMs: transitionAvgMs,
                    worstRooms
                },
                global,
                rooms: this.rooms,
                transitions: this.transitions,
                spikes: this.spikes.slice().sort((a, b) => b.frameMs - a.frameMs),
                timeline: this.timeline
            };
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
})();

/**
 * Boot cinematic: a micro tech-demo executed with real engine primitives.
 *
 * Beat 1  (0.0s-1.0s)   Allocation — four raw polyline primitives (triangle,
 *                       square, circle, diamond) fade in at the corners and
 *                       pulse once as their vertex buffers come online.
 * Beat 2  (1.0s-impact) Pipeline — Engine.Physics pulls the primitives into a
 *                       gravity well at the origin: they start slow and
 *                       violently snap to the center, smeared by substepped
 *                       motion blur over pooled-canvas trails.
 * Beat 3  (impact)      Collision — the frame the bodies actually reach the
 *                       origin, a deterministic, momentum-driven Engine.FX
 *                       splatter erupts and the words SHAPE ENGINE are punched
 *                       out of the splatter's negative space. The wordmark and
 *                       version snap in on that exact frame — no easing.
 * Beat 4  (impact+0.7s) Lock-in — the particle field freezes instantly and
 *                       READY snaps in once boot verification signals.
 *
 * Everything is deterministic (Engine.Proc.Rng) and game-agnostic.
 */
(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const UI = Engine.UI = Engine.UI || {};

    const CYAN = '#00e5ff';
    const WHITE = '#ffffff';
    const BEAT_PIPELINE = 1.0;
    // The physical arrival normally lands around 1.75s; the fallback only
    // guards environments where frame delivery is too coarse to integrate.
    const FALLBACK_COLLISION_T = 2.0;
    const FREEZE_DELAY = 0.7;
    // Gravity-well travel target used to derive the base acceleration.
    const TRAVEL_SECONDS = 0.85;
    const SEED = 'shape-engine-boot';

    function regularPolygon(sides, radius, rotation) {
        const points = [];
        for (let i = 0; i <= sides; i++) {
            const angle = rotation + (i / sides) * Math.PI * 2;
            points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
        }
        return points;
    }

    /**
     * Micro tech-demo cinematic controller for engine boot branding.
     */
    const BootCinematic = {
        /** @type {Object|null} */
        active: null,

        /**
         * Check if canvas and engine dependencies support running the cinematic.
         * @returns {boolean}
         */
        supported() {
            return !!(root.document
                && typeof root.requestAnimationFrame === 'function'
                && Engine.FX && Engine.FX.ParticleSystem && Engine.FX.burst
                && Engine.Physics && typeof Engine.Physics.apply === 'function'
                && Engine.Proc && Engine.Proc.Rng && Engine.Proc.Polyline
                && Engine.Graphics && Engine.Graphics.CanvasPool && Engine.Graphics.GlowAtlas);
        },

        /**
         * Start the sequence on the supplied canvas. Returns a controller or
         * null when the canvas cannot provide a 2d context.
         * @param {Object} [options]
         * @returns {Object|null} Cinematic session controller instance
         */
        start(options = {}) {
            if (!this.supported() || !options.canvas) return null;
            const canvas = options.canvas;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            if (this.active) this.active.stop();

            const state = {
                canvas,
                ctx,
                version: options.version ? `v${options.version}` : '',
                statusNote: '',
                detailsLine: '',
                launchCuePlayed: false,
                rumbleCuePlayed: false,
                readySignaled: false,
                frozen: false,
                exploded: false,
                impactT: 0,
                startTs: null,
                lastTs: 0,
                raf: null,
                mask: null,
                maskCtx: null,
                w: 0,
                h: 0,
                dpr: 1,
                shakeMag: 0,
                rng: Engine.Proc.Rng.fromSeed(SEED),
                particles: new Engine.FX.ParticleSystem({ particleCap: 640 }),
                bodies: [],
                stopped: false
            };

            this._fit(state);
            this._layout(state);

            const step = (ts) => {
                if (state.stopped) return;
                if (state.startTs == null) {
                    state.startTs = ts;
                    state.lastTs = ts;
                }
                const t = (ts - state.startTs) / 1000;
                const dt = Math.min(0.05, Math.max(0, (ts - state.lastTs) / 1000));
                state.lastTs = ts;
                try {
                    this._frame(state, t, dt);
                } catch (_) {
                    // A render fault must never block boot; the DOM fallback
                    // panel is still underneath.
                    this._release(state);
                    return;
                }
                state.raf = root.requestAnimationFrame(step);
            };
            state.raf = root.requestAnimationFrame(step);

            const controller = {
                /** Snap the READY line in (beat 4 gate). */
                ready: (note, details) => {
                    state.readySignaled = true;
                    if (note) state.statusNote = String(note);
                    if (details) state.detailsLine = String(details);
                },
                stop: () => {
                    state.stopped = true;
                    if (state.raf != null && typeof root.cancelAnimationFrame === 'function') {
                        root.cancelAnimationFrame(state.raf);
                    }
                    this._release(state);
                    if (this.active === controller) this.active = null;
                }
            };
            this.active = controller;
            return controller;
        },

        _fit(state) {
            const canvas = state.canvas;
            const parent = canvas.parentNode;
            const w = Math.max(1, (parent && parent.clientWidth) || canvas.clientWidth || 1280);
            const h = Math.max(1, (parent && parent.clientHeight) || canvas.clientHeight || 720);
            const dpr = Math.min(2, Math.max(1, Number(root.devicePixelRatio) || 1));
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            state.w = w;
            state.h = h;
            state.dpr = dpr;
        },

        _layout(state) {
            const { w, h } = state;
            const m = Math.min(w, h);
            const radius = Math.max(10, m * 0.045);
            const insetX = w * 0.18;
            const insetY = h * 0.22;
            const corners = [
                { x: insetX, y: insetY },
                { x: w - insetX, y: insetY },
                { x: w - insetX, y: h - insetY },
                { x: insetX, y: h - insetY }
            ];
            // Raw geometry primitives: triangle, square, circle, diamond.
            const prototypes = [
                regularPolygon(3, radius, -Math.PI / 2),
                regularPolygon(4, radius, Math.PI / 4),
                regularPolygon(24, radius, 0),
                regularPolygon(4, radius * 1.05, 0)
            ];
            state.bodies = corners.map((corner, index) => {
                const body = {
                    x: corner.x,
                    y: corner.y,
                    prevX: corner.x,
                    prevY: corner.y,
                    angle: 0,
                    spin: (index % 2 === 0 ? 1 : -1) * 2.4,
                    points: prototypes[index],
                    launched: false,
                    dirX: 0,
                    dirY: 0,
                    startDist: 1
                };
                Engine.Physics.ensureFields(body, { decay: 1, maxSpeed: 20000, cutoff: 0 });
                return body;
            });
        },

        /**
         * Best-effort procedural audio through Engine.Audio. Browser autoplay
         * policy may keep the context suspended until a gesture; installed
         * PWA/desktop shells play these natively. Silence never blocks boot.
         */
        _audio() {
            const audio = Engine.Audio;
            if (!audio) return null;
            try {
                if (!audio.initialized && typeof audio.init === 'function') audio.init();
                if (!audio.context) return null;
                if (audio.context.state !== 'running') {
                    if (typeof audio.resume === 'function') audio.resume();
                    if (audio.context.state !== 'running') return null;
                }
                return audio;
            } catch (_) {
                return null;
            }
        },

        _launch(state) {
            const cx = state.w / 2;
            const cy = state.h / 2;
            if (!state.launchCuePlayed) {
                state.launchCuePlayed = true;
                // Four engine voices converge as the pipeline pulls the
                // primitives in.
                try {
                    const audio = this._audio();
                    if (audio && typeof audio.playBootCharge === 'function') {
                        audio.playBootCharge(0.78);
                    }
                } catch (_) {
                    // Audio is atmosphere, never a dependency.
                }
            }
            for (const body of state.bodies) {
                if (body.launched) continue;
                body.launched = true;
                const dx = cx - body.x;
                const dy = cy - body.y;
                const dist = Math.hypot(dx, dy) || 1;
                body.dirX = dx / dist;
                body.dirY = dy / dist;
                body.startDist = dist;
            }
        },

        /**
         * Gravity-well integration. Bodies accelerate the whole way in — slow
         * off the line, violent at the well — and report the exact frame the
         * first body crosses the origin.
         * @param {Object} state
         * @param {number} t
         * @param {number} dt
         * @returns {boolean} True if body arrived at origin
         */
        _updateBodies(state, t, dt) {
            if (t < BEAT_PIPELINE || dt <= 0) return false;
            this._launch(state);
            const cx = state.w / 2;
            const cy = state.h / 2;
            let arrived = false;

            for (const body of state.bodies) {
                body.prevX = body.x;
                body.prevY = body.y;

                const dx = cx - body.x;
                const dy = cy - body.y;
                const dist = Math.hypot(dx, dy);
                // Base pull sized so the trip takes ~TRAVEL_SECONDS, ramped
                // hard as the body closes so the arrival reads as a snap.
                const progress = Math.max(0, Math.min(1, 1 - dist / body.startDist));
                const baseAccel = (2 * body.startDist) / (TRAVEL_SECONDS * TRAVEL_SECONDS);
                const accel = baseAccel * (0.35 + 2.6 * progress * progress);
                if (dist > 0.5) {
                    Engine.Physics.apply(body, (dx / dist) * accel * dt, (dy / dist) * accel * dt, {
                        maxSpeed: 20000,
                        resistance: 1
                    });
                }
                Engine.Physics.integrate(body, dt, { decay: 1, cutoff: 0, maxDuration: 0 });
                body.angle += body.spin * dt * (1 + progress * 2);

                // Impact = proximity or overshoot past the origin.
                const ndx = cx - body.x;
                const ndy = cy - body.y;
                const overshot = ndx * body.dirX + ndy * body.dirY <= 0;
                if (overshot || Math.hypot(ndx, ndy) < Math.min(state.w, state.h) * 0.02) {
                    body.x = cx;
                    body.y = cy;
                    arrived = true;
                }
            }
            return arrived;
        },

        _explode(state, t) {
            state.exploded = true;
            state.impactT = t;
            state.shakeMag = Math.min(state.w, state.h) * 0.016;

            // The collision is the sound: a physical hit, not a notification.
            try {
                const audio = this._audio();
                if (audio && typeof audio.playBootImpact === 'function') {
                    audio.playBootImpact(1.0);
                }
            } catch (_) {
                // Audio is atmosphere, never a dependency.
            }
            const cx = state.w / 2;
            const cy = state.h / 2;
            const m = Math.min(state.w, state.h);
            const rng = state.rng;

            // Momentum transfer: each body ejects a jagged jet roughly along
            // its incoming trajectory, with per-jet speed/spread/drag chaos so
            // the splatter is uneven rather than a uniform ring.
            for (const body of state.bodies) {
                const speed = Math.hypot(body.impulseVx || 0, body.impulseVy || 0);
                const heading = speed > 1
                    ? Math.atan2(body.impulseVy, body.impulseVx)
                    : Math.atan2(body.dirY, body.dirX);
                Engine.FX.burst(state.particles, {
                    x: cx,
                    y: cy,
                    count: rng.int(34, 62),
                    angle: heading + rng.float(-0.45, 0.45),
                    spread: rng.float(0.5, 1.2),
                    speed: [m * rng.float(0.1, 0.2), m * rng.float(0.85, 1.3)],
                    size: [0.8, 4.6],
                    life: [0.22, 1.7],
                    drag: rng.float(1.0, 2.4),
                    color: [CYAN, CYAN, '#7df4ff', WHITE],
                    rng
                });
            }

            // Chaotic interstitial debris — wide velocity and lifetime bands.
            Engine.FX.burst(state.particles, {
                x: cx,
                y: cy,
                count: 70,
                speed: [m * 0.04, m * 0.6],
                size: [1.0, 3.6],
                life: [0.3, 1.4],
                drag: 1.3,
                color: [CYAN, '#7df4ff', WHITE],
                rng
            });

            // A few heavy slow chunks so the field has mass, not just sparks.
            Engine.FX.burst(state.particles, {
                x: cx,
                y: cy,
                count: 12,
                speed: [m * 0.02, m * 0.2],
                size: [3.2, 6.0],
                life: [0.9, 2.1],
                drag: 0.8,
                color: [CYAN, WHITE],
                rng
            });
        },

        _titleFont(state) {
            const { ctx, w, h } = state;
            const m = Math.min(w, h);
            // Sized as an engine stamp, not a game title: roughly half the
            // viewport width with a modest cap on large displays.
            let px = Math.max(14, m * 0.08);
            ctx.font = `700 ${px}px Orbitron, sans-serif`;
            const measured = ctx.measureText('SHAPE ENGINE').width || 1;
            const target = Math.min(w * 0.46, m * 0.82);
            px = Math.max(12, px * (target / measured));
            return px;
        },

        _frame(state, t, dt) {
            const { ctx, w, h } = state;

            if (!state.rumbleCuePlayed) {
                state.rumbleCuePlayed = true;
                // Looming rumble bed swelling under the whole sequence until
                // the collision releases it.
                try {
                    const audio = this._audio();
                    if (audio && typeof audio.playBootRumble === 'function') {
                        audio.playBootRumble(FALLBACK_COLLISION_T);
                    }
                } catch (_) {
                    // Audio is atmosphere, never a dependency.
                }
            }

            ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

            // The pipeline beat keeps prior frames at reduced alpha for motion
            // trails; every other beat starts from a clean buffer.
            const trailing = t >= BEAT_PIPELINE && !state.exploded;
            if (trailing) {
                ctx.fillStyle = 'rgba(2, 2, 5, 0.38)';
                ctx.fillRect(0, 0, w, h);
            } else {
                ctx.clearRect(0, 0, w, h);
            }

            // Impact shake, decaying deterministically. Frozen means frozen:
            // no jitter once the field locks.
            if (!state.frozen && state.shakeMag > 0.2) {
                const jitterX = (state.rng.next() - 0.5) * state.shakeMag;
                const jitterY = (state.rng.next() - 0.5) * state.shakeMag;
                ctx.translate(jitterX, jitterY);
                state.shakeMag *= Math.pow(0.0005, dt);
            }

            if (!state.exploded) {
                const arrived = this._updateBodies(state, t, dt);
                if (arrived || t >= FALLBACK_COLLISION_T) {
                    // Beat 3 triggers on the physical impact frame itself.
                    this._explode(state, t);
                } else {
                    this._renderBodies(state, t);
                }
            }

            if (state.exploded) {
                if (!state.frozen) {
                    state.particles.update(dt);
                    if (t >= state.impactT + FREEZE_DELAY) state.frozen = true;
                }
                this._drawSplatterWithTitlePunch(state);
                this._drawLockInText(state, t);
            }
        },

        _renderBodies(state, t) {
            const { ctx } = state;
            const Polyline = Engine.Proc.Polyline;

            // Allocation fade-in plus a single "buffers online" pulse.
            const fade = Math.max(0, Math.min(1, t / 0.35));
            const pulsePhase = Math.max(0, Math.min(1, (t - 0.55) / 0.3));
            const pulse = pulsePhase > 0 && pulsePhase < 1 ? Math.sin(pulsePhase * Math.PI) : 0;
            const inFlight = t >= BEAT_PIPELINE;

            for (const body of state.bodies) {
                const scale = 1 + pulse * 0.16;
                const cos = Math.cos(body.angle);
                const sin = Math.sin(body.angle);
                const shape = (originX, originY) => body.points.map(point => ({
                    x: originX + (point.x * cos - point.y * sin) * scale,
                    y: originY + (point.x * sin + point.y * cos) * scale
                }));

                ctx.save();
                ctx.strokeStyle = inFlight ? CYAN : WHITE;
                ctx.lineJoin = 'round';

                // Substepped motion smear: interpolated ghosts between the
                // previous and current integration positions read as a
                // continuous blur instead of discrete echoes.
                const stepX = body.x - body.prevX;
                const stepY = body.y - body.prevY;
                if (inFlight && Math.hypot(stepX, stepY) > 1) {
                    const substeps = 4;
                    for (let s = 1; s <= substeps; s++) {
                        const f = s / (substeps + 1);
                        const ghost = shape(body.prevX + stepX * f, body.prevY + stepY * f);
                        ctx.globalAlpha = fade * 0.16 * (s / substeps);
                        ctx.lineWidth = 1.2;
                        ctx.beginPath();
                        ctx.moveTo(ghost[0].x, ghost[0].y);
                        for (let i = 1; i < ghost.length; i++) ctx.lineTo(ghost[i].x, ghost[i].y);
                        ctx.stroke();
                    }
                }

                const points = shape(body.x, body.y);
                ctx.globalAlpha = fade * (0.75 + pulse * 0.25);
                ctx.lineWidth = 1.5 + pulse * 1.2;
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
                ctx.stroke();

                // Raw vertex markers, walked along the outline through the
                // engine's polyline arc sampler.
                const routeLength = Polyline.routeLength(points);
                const vertexCount = Math.min(points.length - 1, 12);
                ctx.fillStyle = CYAN;
                for (let i = 0; i < vertexCount; i++) {
                    const sample = Polyline.pointAtArc(points, (i / vertexCount) * routeLength);
                    ctx.fillRect(sample.x - 1.5, sample.y - 1.5, 3, 3);
                }
                ctx.restore();
            }
        },

        _drawSplatterWithTitlePunch(state) {
            const { ctx, w, h, dpr } = state;
            const Graphics = Engine.Graphics;
            const cx = w / 2;
            const cy = h / 2;

            if (!state.mask) {
                state.mask = Graphics.CanvasPool.acquire(Math.round(w * dpr), Math.round(h * dpr));
                state.maskCtx = state.mask.getContext('2d');
            }
            const mctx = state.maskCtx;
            mctx.setTransform(1, 0, 0, 1, 0, 0);
            mctx.clearRect(0, 0, state.mask.width, state.mask.height);
            mctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Bloom pass under crisp particle cores.
            const particles = state.particles;
            for (let i = 0; i < particles.count; i++) {
                const lifeFrac = Math.max(0, particles.life[i] / particles.maxLife[i]);
                Graphics.GlowAtlas.draw(
                    mctx,
                    particles.x[i],
                    particles.y[i],
                    particles.size[i] * 6,
                    CYAN,
                    { alpha: 0.32 * lifeFrac }
                );
            }
            particles.render(mctx);

            // Punch the wordmark (and its attribution line) out of the
            // splatter: the explosion renders the text as negative space.
            const titlePx = this._titleFont(state);
            const taglinePx = Math.max(9, titlePx * 0.26);
            const taglineY = cy - titlePx * 0.95;
            mctx.save();
            mctx.globalCompositeOperation = 'destination-out';
            mctx.textAlign = 'center';
            mctx.textBaseline = 'middle';
            mctx.fillStyle = '#000000';
            mctx.font = `700 ${titlePx}px Orbitron, sans-serif`;
            mctx.fillText('SHAPE ENGINE', cx, cy);
            mctx.font = `500 ${taglinePx}px Orbitron, sans-serif`;
            mctx.fillText('POWERED BY', cx, taglineY);
            mctx.restore();

            ctx.drawImage(state.mask, 0, 0, w, h);

            // The etched wordmark snaps in on the impact frame — the collision
            // forces the text onto the screen, no easing, no fade.
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `500 ${taglinePx}px Orbitron, sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillText('POWERED BY', cx, taglineY);
            ctx.font = `700 ${titlePx}px Orbitron, sans-serif`;
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.9)';
            ctx.lineWidth = 1;
            ctx.strokeText('SHAPE ENGINE', cx, cy);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
            ctx.fillText('SHAPE ENGINE', cx, cy);
            ctx.restore();
        },

        _drawLockInText(state, t) {
            const { ctx, w, h } = state;
            const m = Math.min(w, h);
            const titlePx = this._titleFont(state);
            const cx = w / 2;
            const baseY = h / 2 + titlePx * 0.85;
            const linePx = Math.max(10, m * 0.032);

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (state.version) {
                ctx.font = `500 ${linePx}px Orbitron, sans-serif`;
                ctx.fillStyle = CYAN;
                ctx.fillText(state.version, cx, baseY);
            }

            ctx.font = `500 ${linePx}px Orbitron, sans-serif`;
            if (state.readySignaled) {
                ctx.fillStyle = CYAN;
                const label = state.statusNote ? `READY — ${state.statusNote}` : 'READY';
                ctx.fillText(label, cx, baseY + linePx * 1.9);
                // Boot-sector dump: the capability readout rides along in the
                // frozen state while the application loads underneath.
                if (state.detailsLine) {
                    const dumpPx = Math.max(8, linePx * 0.62);
                    ctx.font = `500 ${dumpPx}px Orbitron, sans-serif`;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                    ctx.fillText(state.detailsLine, cx, baseY + linePx * 3.4);
                }
            } else {
                // Diagnostic tick while verification is still running.
                const dots = '·'.repeat(1 + (Math.floor((t - state.impactT) / 0.32) % 3));
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.fillText(`INITIALIZING${dots}`, cx, baseY + linePx * 1.9);
            }
            ctx.restore();
        },

        _release(state) {
            if (state.mask && Engine.Graphics && Engine.Graphics.CanvasPool) {
                Engine.Graphics.CanvasPool.release(state.mask);
            }
            state.mask = null;
            state.maskCtx = null;
            state.particles.clear();
        }
    };

    UI.BootCinematic = BootCinematic;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = BootCinematic;
    }
})(typeof window !== 'undefined' ? window : globalThis);

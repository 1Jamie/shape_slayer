(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const FX = Engine.FX = Engine.FX || {};

    function getGraphics() {
        if (!Engine.Graphics || !Engine.Graphics.CanvasPool || !Engine.Graphics.GlowAtlas) {
            throw new Error('Engine.FX requires Engine.Graphics.');
        }
        return Engine.Graphics;
    }

    class LightMaskBuffer {
        constructor(options = {}) {
            this.canvasPool = options.canvasPool || null;
            this.canvas = null;
            this.ctx = null;
            this.logicalW = 0;
            this.logicalH = 0;
            this.dpr = 1;
            this.scale = 0.5;
        }

        _pool() {
            return this.canvasPool || getGraphics().CanvasPool;
        }

        ensure(logicalW, logicalH, options = {}) {
            const width = Math.max(1, Number(logicalW) || 1);
            const height = Math.max(1, Number(logicalH) || 1);
            const dpr = Math.max(0.25, Number(options.dpr) || 1);
            const scale = Math.max(0.05, Number(options.scale) || 0.5);
            const pixelWidth = Math.max(1, Math.round(width * dpr * scale));
            const pixelHeight = Math.max(1, Math.round(height * dpr * scale));

            if (!this.canvas || this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
                if (this.canvas) this._pool().release(this.canvas);
                this.canvas = this._pool().acquire(pixelWidth, pixelHeight);
                this.ctx = this.canvas.getContext('2d');
            }
            this.logicalW = width;
            this.logicalH = height;
            this.dpr = dpr;
            this.scale = scale;
            return this;
        }

        begin(options = {}) {
            if (options.logicalW || options.logicalH || !this.canvas) {
                this.ensure(
                    options.logicalW || this.logicalW || 1,
                    options.logicalH || this.logicalH || 1,
                    options
                );
            }
            const ctx = this.ctx;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
            ctx.fillStyle = options.color || '#000000';
            ctx.globalAlpha = Number.isFinite(options.darkness) ? options.darkness : 0.72;
            ctx.fillRect(0, 0, this.logicalW, this.logicalH);
            ctx.globalAlpha = 1;
            return ctx;
        }

        addLight(x, y, radius, color = '#ffffff', options = {}) {
            if (!this.ctx) throw new Error('LightMask.begin must be called before addLight.');
            const ctx = this.ctx;
            ctx.globalCompositeOperation = options.composite || 'destination-out';
            getGraphics().GlowAtlas.draw(ctx, x, y, Math.max(0, radius), color, {
                alpha: Number.isFinite(options.alpha) ? options.alpha : 1
            });
            ctx.globalCompositeOperation = 'source-over';
            return this;
        }

        composite(ctx, options = {}) {
            if (!this.canvas) return false;
            const x = Number(options.x) || 0;
            const y = Number(options.y) || 0;
            const width = Number.isFinite(options.width) ? options.width : this.logicalW;
            const height = Number.isFinite(options.height) ? options.height : this.logicalH;
            ctx.save();
            ctx.globalAlpha *= Number.isFinite(options.alpha) ? options.alpha : 1;
            if (options.composite) ctx.globalCompositeOperation = options.composite;
            ctx.imageSmoothingEnabled = options.smoothing !== false;
            ctx.drawImage(this.canvas, x, y, width, height);
            ctx.restore();
            return true;
        }

        release() {
            if (!this.canvas) return false;
            this._pool().release(this.canvas);
            this.canvas = null;
            this.ctx = null;
            return true;
        }
    }

    function chromaticAberration(ctx, options = {}) {
        if (!ctx || typeof ctx.drawImage !== 'function') {
            throw new TypeError('A Canvas2D context is required.');
        }
        const Graphics = getGraphics();
        const originalSource = options.source || ctx.canvas;
        if (!originalSource) throw new TypeError('A source canvas is required.');
        const sourceWidth = Math.max(1, originalSource.width || 1);
        const sourceHeight = Math.max(1, originalSource.height || 1);
        const drawWidth = Number.isFinite(options.width) ? options.width : sourceWidth;
        const drawHeight = Number.isFinite(options.height) ? options.height : sourceHeight;
        const x = Number(options.x) || 0;
        const y = Number(options.y) || 0;
        const offset = Math.max(0, Number(options.offset) || 0);
        const intensity = Math.max(0, Math.min(1, Number(options.intensity) || 0));
        if (intensity <= 0 || offset <= 0) return false;

        let source = originalSource;
        let snapshot = null;
        if (originalSource === ctx.canvas) {
            snapshot = Graphics.CanvasPool.acquire(sourceWidth, sourceHeight);
            const snapshotCtx = snapshot.getContext('2d');
            snapshotCtx.globalCompositeOperation = 'copy';
            snapshotCtx.drawImage(originalSource, 0, 0);
            source = snapshot;
        }

        const channel = Graphics.CanvasPool.acquire(sourceWidth, sourceHeight);
        const channelCtx = channel.getContext('2d');
        if (options.replace !== false) {
            ctx.clearRect(x, y, drawWidth, drawHeight);
            ctx.drawImage(source, x, y, drawWidth, drawHeight);
        }

        ctx.save();
        ctx.globalCompositeOperation = options.composite || 'lighter';
        ctx.globalAlpha = intensity;
        const drawChannel = (color, shift) => {
            channelCtx.setTransform(1, 0, 0, 1, 0, 0);
            channelCtx.globalAlpha = 1;
            channelCtx.globalCompositeOperation = 'copy';
            channelCtx.drawImage(source, 0, 0, sourceWidth, sourceHeight);
            channelCtx.globalCompositeOperation = 'multiply';
            channelCtx.fillStyle = color;
            channelCtx.fillRect(0, 0, sourceWidth, sourceHeight);
            ctx.drawImage(channel, x + shift, y, drawWidth, drawHeight);
        };
        drawChannel('#ff0000', -offset);
        drawChannel('#0000ff', offset);
        ctx.restore();

        Graphics.CanvasPool.release(channel);
        if (snapshot) Graphics.CanvasPool.release(snapshot);
        return true;
    }

    function normalizeSegment(segment) {
        if (!segment) return null;
        const a = segment.a || { x: segment.x1, y: segment.y1 };
        const b = segment.b || { x: segment.x2, y: segment.y2 };
        if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null;
        return {
            a: { x: a.x, y: a.y },
            b: { x: b.x, y: b.y }
        };
    }

    function normalizeBounds(bounds = {}) {
        const left = Number.isFinite(bounds.left) ? bounds.left : Number(bounds.x) || 0;
        const top = Number.isFinite(bounds.top) ? bounds.top : Number(bounds.y) || 0;
        const right = Number.isFinite(bounds.right)
            ? bounds.right
            : left + Math.max(0, Number(bounds.width) || 0);
        const bottom = Number.isFinite(bounds.bottom)
            ? bounds.bottom
            : top + Math.max(0, Number(bounds.height) || 0);
        return { left, top, right, bottom, width: right - left, height: bottom - top };
    }

    function segmentTouchesBounds(segment, bounds) {
        const minX = Math.min(segment.a.x, segment.b.x);
        const maxX = Math.max(segment.a.x, segment.b.x);
        const minY = Math.min(segment.a.y, segment.b.y);
        const maxY = Math.max(segment.a.y, segment.b.y);
        return maxX >= bounds.left && minX <= bounds.right
            && maxY >= bounds.top && minY <= bounds.bottom;
    }

    function cross(ax, ay, bx, by) {
        return ax * by - ay * bx;
    }

    function castRay(originX, originY, angle, radius, segments) {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let nearest = radius;
        for (const segment of segments) {
            const sx = segment.b.x - segment.a.x;
            const sy = segment.b.y - segment.a.y;
            const denominator = cross(dx, dy, sx, sy);
            if (Math.abs(denominator) < 1e-9) continue;
            const qx = segment.a.x - originX;
            const qy = segment.a.y - originY;
            const distance = cross(qx, qy, sx, sy) / denominator;
            const along = cross(qx, qy, dx, dy) / denominator;
            if (distance >= 0 && distance <= nearest && along >= 0 && along <= 1) nearest = distance;
        }
        return {
            x: originX + dx * nearest,
            y: originY + dy * nearest,
            angle
        };
    }

    class ShadowCaster {
        constructor(options = {}) {
            this.maxLights = Math.max(0, Math.floor(options.maxLights ?? 16));
            this.maxRays = Math.max(3, Math.floor(options.maxRays ?? 128));
            this.occluders = [];
            this.visibleOccluders = [];
            this.viewBounds = null;
            this.activeContext = null;
            this.lightCount = 0;
        }

        setOccluders(segments) {
            this.occluders = Array.from(segments || [], normalizeSegment).filter(Boolean);
            return this;
        }

        begin(ctx, viewBounds) {
            if (!ctx || typeof ctx.save !== 'function') throw new TypeError('A Canvas2D context is required.');
            this.viewBounds = normalizeBounds(viewBounds);
            const bounds = this.viewBounds;
            const corners = [
                { x: bounds.left, y: bounds.top },
                { x: bounds.right, y: bounds.top },
                { x: bounds.right, y: bounds.bottom },
                { x: bounds.left, y: bounds.bottom }
            ];
            this.visibleOccluders = this.occluders.filter(segment => segmentTouchesBounds(segment, bounds));
            for (let index = 0; index < corners.length; index++) {
                this.visibleOccluders.push({
                    a: corners[index],
                    b: corners[(index + 1) % corners.length]
                });
            }
            this.lightCount = 0;
            this.activeContext = ctx;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            return this;
        }

        drawLight(ctx, x, y, radius, color = '#ffffff') {
            if (!this.viewBounds || this.activeContext !== ctx) {
                throw new Error('ShadowCaster.begin must be called before drawLight.');
            }
            if (this.lightCount >= this.maxLights || radius <= 0) return false;
            const bounds = this.viewBounds;
            if (x + radius < bounds.left || x - radius > bounds.right
                || y + radius < bounds.top || y - radius > bounds.bottom) return false;

            const nearby = this.visibleOccluders.filter(segment => {
                const minX = Math.min(segment.a.x, segment.b.x);
                const maxX = Math.max(segment.a.x, segment.b.x);
                const minY = Math.min(segment.a.y, segment.b.y);
                const maxY = Math.max(segment.a.y, segment.b.y);
                return maxX >= x - radius && minX <= x + radius
                    && maxY >= y - radius && minY <= y + radius;
            });
            const epsilon = 0.00001;
            let angles = [];
            const baseRayCount = Math.min(this.maxRays, 24);
            for (let index = 0; index < baseRayCount; index++) {
                angles.push(index * Math.PI * 2 / baseRayCount);
            }
            for (const segment of nearby) {
                for (const point of [segment.a, segment.b]) {
                    const angle = Math.atan2(point.y - y, point.x - x);
                    angles.push(angle - epsilon, angle, angle + epsilon);
                }
            }
            if (!angles.length) {
                const steps = Math.min(this.maxRays, 32);
                for (let index = 0; index < steps; index++) angles.push(index * Math.PI * 2 / steps);
            }
            angles.sort((a, b) => a - b);
            if (angles.length > this.maxRays) {
                const reduced = [];
                const stride = angles.length / this.maxRays;
                for (let index = 0; index < this.maxRays; index++) {
                    reduced.push(angles[Math.floor(index * stride)]);
                }
                angles = reduced;
            }
            const points = angles.map(angle => castRay(x, y, angle, radius, nearby));
            if (points.length < 3) return false;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y);
            ctx.closePath();
            ctx.clip();
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
            ctx.restore();
            this.lightCount++;
            return true;
        }

        end(ctx) {
            if (!this.activeContext) return false;
            const target = ctx || this.activeContext;
            if (target !== this.activeContext) throw new Error('ShadowCaster.end context must match begin.');
            target.restore();
            this.activeContext = null;
            this.viewBounds = null;
            this.visibleOccluders = [];
            return true;
        }
    }

    const COLOR_RGB_CACHE = new Map();

    function getCachedRgbString(r, g, b) {
        const ir = Math.round(Math.max(0, Math.min(1, r)) * 255);
        const ig = Math.round(Math.max(0, Math.min(1, g)) * 255);
        const ib = Math.round(Math.max(0, Math.min(1, b)) * 255);
        const key = (ir << 16) | (ig << 8) | ib;
        let cached = COLOR_RGB_CACHE.get(key);
        if (!cached) {
            cached = `rgb(${ir},${ig},${ib})`;
            COLOR_RGB_CACHE.set(key, cached);
        }
        return cached;
    }

    function parseColorToRgb(color) {
        if (!color) return [1, 1, 1];
        if (typeof color === 'string') {
            const str = color.trim().toLowerCase();
            if (str.startsWith('#')) {
                if (str.length === 4) {
                    const r = parseInt(str[1] + str[1], 16) / 255;
                    const g = parseInt(str[2] + str[2], 16) / 255;
                    const b = parseInt(str[3] + str[3], 16) / 255;
                    return [r, g, b];
                } else if (str.length >= 7) {
                    const r = parseInt(str.substring(1, 3), 16) / 255;
                    const g = parseInt(str.substring(3, 5), 16) / 255;
                    const b = parseInt(str.substring(5, 7), 16) / 255;
                    return [r, g, b];
                }
            } else if (str.startsWith('rgb')) {
                const match = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
                if (match) {
                    return [
                        Number(match[1]) / 255,
                        Number(match[2]) / 255,
                        Number(match[3]) / 255
                    ];
                }
            }
        } else if (Array.isArray(color)) {
            return [
                color[0] > 1 ? color[0] / 255 : color[0],
                color[1] > 1 ? color[1] / 255 : color[1],
                color[2] > 1 ? color[2] / 255 : color[2]
            ];
        } else if (typeof color === 'object') {
            const rVal = color.r ?? color.cr ?? 1;
            const gVal = color.g ?? color.cg ?? 1;
            const bVal = color.b ?? color.cb ?? 1;
            return [
                rVal > 1 ? rVal / 255 : rVal,
                gVal > 1 ? gVal / 255 : gVal,
                bVal > 1 ? bVal / 255 : bVal
            ];
        }
        return [1, 1, 1];
    }

    class ParticleSystem {
        constructor(options = {}) {
            this.particleCap = Math.max(0, Math.floor(options.particleCap ?? 1000));
            this.count = 0;
            this.gravityX = Number(options.gravityX) || 0;
            this.gravityY = Number(options.gravityY) || 0;
            this.x = new Float32Array(this.particleCap);
            this.y = new Float32Array(this.particleCap);
            this.vx = new Float32Array(this.particleCap);
            this.vy = new Float32Array(this.particleCap);
            this.size = new Float32Array(this.particleCap);
            this.life = new Float32Array(this.particleCap);
            this.maxLife = new Float32Array(this.particleCap);
            this.gravity = new Float32Array(this.particleCap);
            this.drag = new Float32Array(this.particleCap);
            this.bounce = new Float32Array(this.particleCap);
            this.cr = new Float32Array(this.particleCap);
            this.cg = new Float32Array(this.particleCap);
            this.cb = new Float32Array(this.particleCap);
            this.circleColliders = [];
            this.segmentColliders = [];
        }

        get colors() {
            const result = new Array(this.particleCap);
            for (let index = 0; index < this.count; index++) {
                result[index] = getCachedRgbString(this.cr[index], this.cg[index], this.cb[index]);
            }
            return result;
        }

        set colors(val) {
            // Support legacy array setter if needed
            if (Array.isArray(val)) {
                for (let index = 0; index < Math.min(val.length, this.particleCap); index++) {
                    if (val[index]) {
                        const [r, g, b] = parseColorToRgb(val[index]);
                        this.cr[index] = r;
                        this.cg[index] = g;
                        this.cb[index] = b;
                    }
                }
            }
        }

        setParticleCap(cap) {
            const nextCap = Math.max(0, Math.floor(cap));
            if (nextCap === this.particleCap) return this;
            const nextCount = Math.min(this.count, nextCap);
            for (const name of [
                'x', 'y', 'vx', 'vy', 'size', 'life',
                'maxLife', 'gravity', 'drag', 'bounce',
                'cr', 'cg', 'cb'
            ]) {
                const values = new Float32Array(nextCap);
                values.set(this[name].subarray(0, nextCount));
                this[name] = values;
            }
            this.particleCap = nextCap;
            this.count = nextCount;
            return this;
        }

        spawn(options = {}) {
            if (this.count >= this.particleCap) return -1;
            const index = this.count++;
            const life = Math.max(0.0001, Number(options.life) || 1);
            this.x[index] = Number(options.x) || 0;
            this.y[index] = Number(options.y) || 0;
            this.vx[index] = Number(options.vx) || 0;
            this.vy[index] = Number(options.vy) || 0;
            this.size[index] = Math.max(0, Number(options.size) || 1);
            this.life[index] = life;
            this.maxLife[index] = life;
            this.gravity[index] = Number(options.gravity) || 0;
            this.drag[index] = Math.max(0, Number(options.drag) || 0);
            this.bounce[index] = Math.max(0, Math.min(1, Number(options.bounce) || 0));
            const [cr, cg, cb] = parseColorToRgb(options.color || '#ffffff');
            this.cr[index] = cr;
            this.cg[index] = cg;
            this.cb[index] = cb;
            return index;
        }

        setColliders(colliders = {}) {
            this.circleColliders = Array.from(colliders.circles || []).filter(collider => {
                return collider && Number.isFinite(collider.x) && Number.isFinite(collider.y)
                    && Number.isFinite(collider.radius);
            });
            this.segmentColliders = Array.from(colliders.segments || [], normalizeSegment).filter(Boolean);
            return this;
        }

        addCircleCollider(collider) {
            return this.setColliders({
                circles: this.circleColliders.concat(collider),
                segments: this.segmentColliders
            });
        }

        addSegmentCollider(segment) {
            return this.setColliders({
                circles: this.circleColliders,
                segments: this.segmentColliders.concat(segment)
            });
        }

        _reflect(index, nx, ny) {
            const projection = this.vx[index] * nx + this.vy[index] * ny;
            if (projection >= 0) return;
            const scale = (1 + this.bounce[index]) * projection;
            this.vx[index] -= scale * nx;
            this.vy[index] -= scale * ny;
        }

        _collide(index) {
            const radius = this.size[index];
            for (const collider of this.circleColliders) {
                const dx = this.x[index] - collider.x;
                const dy = this.y[index] - collider.y;
                const minimum = radius + Math.max(0, collider.radius);
                const distanceSquared = dx * dx + dy * dy;
                if (distanceSquared >= minimum * minimum) continue;
                const distance = Math.sqrt(distanceSquared) || 1;
                const nx = distanceSquared > 0 ? dx / distance : 1;
                const ny = distanceSquared > 0 ? dy / distance : 0;
                this.x[index] = collider.x + nx * minimum;
                this.y[index] = collider.y + ny * minimum;
                this._reflect(index, nx, ny);
            }
            for (const segment of this.segmentColliders) {
                const sx = segment.b.x - segment.a.x;
                const sy = segment.b.y - segment.a.y;
                const lengthSquared = sx * sx + sy * sy;
                if (lengthSquared <= 1e-12) continue;
                const amount = Math.max(0, Math.min(1,
                    ((this.x[index] - segment.a.x) * sx + (this.y[index] - segment.a.y) * sy)
                    / lengthSquared
                ));
                const closestX = segment.a.x + sx * amount;
                const closestY = segment.a.y + sy * amount;
                let dx = this.x[index] - closestX;
                let dy = this.y[index] - closestY;
                const distanceSquared = dx * dx + dy * dy;
                if (distanceSquared >= radius * radius) continue;
                const distance = Math.sqrt(distanceSquared);
                if (distance > 1e-6) {
                    dx /= distance;
                    dy /= distance;
                } else {
                    const inverseLength = 1 / Math.sqrt(lengthSquared);
                    dx = -sy * inverseLength;
                    dy = sx * inverseLength;
                    if (this.vx[index] * dx + this.vy[index] * dy > 0) {
                        dx = -dx;
                        dy = -dy;
                    }
                }
                this.x[index] = closestX + dx * radius;
                this.y[index] = closestY + dy * radius;
                this._reflect(index, dx, dy);
            }
        }

        _remove(index) {
            const last = --this.count;
            if (index === last) return;
            for (const field of [
                this.x, this.y, this.vx, this.vy, this.size, this.life,
                this.maxLife, this.gravity, this.drag, this.bounce,
                this.cr, this.cg, this.cb
            ]) {
                field[index] = field[last];
            }
        }

        update(deltaTime) {
            const dt = Math.max(0, Number(deltaTime) || 0);
            for (let index = this.count - 1; index >= 0; index--) {
                this.life[index] -= dt;
                if (this.life[index] <= 0) {
                    this._remove(index);
                    continue;
                }
                this.vx[index] += this.gravityX * dt;
                this.vy[index] += (this.gravityY + this.gravity[index]) * dt;
                const damping = Math.max(0, 1 - this.drag[index] * dt);
                this.vx[index] *= damping;
                this.vy[index] *= damping;
                this.x[index] += this.vx[index] * dt;
                this.y[index] += this.vy[index] * dt;
                this._collide(index);
            }
            return this.count;
        }

        render(ctx, viewBounds) {
            const bounds = viewBounds ? normalizeBounds(viewBounds) : null;
            ctx.save();
            for (let index = 0; index < this.count; index++) {
                const radius = this.size[index];
                if (bounds && (this.x[index] + radius < bounds.left
                    || this.x[index] - radius > bounds.right
                    || this.y[index] + radius < bounds.top
                    || this.y[index] - radius > bounds.bottom)) continue;
                ctx.globalAlpha = Math.max(0, this.life[index] / this.maxLife[index]);
                ctx.fillStyle = getCachedRgbString(this.cr[index], this.cg[index], this.cb[index]);
                ctx.beginPath();
                ctx.arc(this.x[index], this.y[index], radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            return this.count;
        }

        clear() {
            this.count = 0;
        }

        toArray() {
            const result = [];
            for (let index = 0; index < this.count; index++) {
                result.push({
                    x: this.x[index],
                    y: this.y[index],
                    vx: this.vx[index],
                    vy: this.vy[index],
                    color: getCachedRgbString(this.cr[index], this.cg[index], this.cb[index]),
                    size: this.size[index],
                    life: this.life[index],
                    maxLife: this.maxLife[index]
                });
            }
            return result;
        }
    }

    function burst(systemOrOptions, maybeOptions) {
        const system = systemOrOptions instanceof ParticleSystem ? systemOrOptions : FX.Particles;
        const options = systemOrOptions instanceof ParticleSystem ? (maybeOptions || {}) : (systemOrOptions || {});
        const count = Math.max(0, Math.floor(options.count ?? 12));
        const baseAngle = Number(options.angle) || 0;
        const spread = Number.isFinite(options.spread) ? options.spread : Math.PI * 2;
        const random = options.rng && typeof options.rng.next === 'function'
            ? () => options.rng.next()
            : (typeof options.rng === 'function' ? options.rng : Math.random);
        const range = (value, fallback) => {
            if (Array.isArray(value)) return value[0] + (value[1] - value[0]) * random();
            return Number.isFinite(value) ? value : fallback;
        };
        let spawned = 0;
        for (let index = 0; index < count; index++) {
            const angle = baseAngle + (random() - 0.5) * spread;
            const speed = range(options.speed, 100);
            const colors = Array.isArray(options.color) ? options.color : null;
            const result = system.spawn({
                x: options.x,
                y: options.y,
                vx: Math.cos(angle) * speed + (Number(options.vx) || 0),
                vy: Math.sin(angle) * speed + (Number(options.vy) || 0),
                color: colors ? colors[Math.floor(random() * colors.length)] : options.color,
                size: range(options.size, 2),
                life: range(options.life, 0.5),
                gravity: options.gravity,
                drag: options.drag,
                bounce: options.bounce
            });
            if (result < 0) break;
            spawned++;
        }
        return spawned;
    }

    FX.LightMask = new LightMaskBuffer();
    FX.LightMask.create = options => new LightMaskBuffer(options);
    FX.Post = FX.Post || {};
    FX.Post.chromaticAberration = chromaticAberration;
    FX.ShadowCaster = ShadowCaster;
    FX.ParticleSystem = ParticleSystem;
    FX.Particles = FX.Particles || new ParticleSystem({ particleCap: 2000, gravityY: 200 });
    FX.burst = burst;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FX;
    }
})(typeof window !== 'undefined' ? window : globalThis);

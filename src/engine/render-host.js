(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const Render = Engine.Render = Engine.Render || {};

    Render.QualityTier = Object.freeze({
        HIGH: 0,
        MEDIUM: 1,
        LOW: 2
    });

    const QUALITY_PRESETS = Object.freeze({
        [Render.QualityTier.HIGH]: Object.freeze({
            dprCap: 2,
            maxLights: 64,
            maxShadowRays: 256,
            particleCap: 2000,
            atlasMaxEntries: 256
        }),
        [Render.QualityTier.MEDIUM]: Object.freeze({
            dprCap: 1.5,
            maxLights: 32,
            maxShadowRays: 128,
            particleCap: 1200,
            atlasMaxEntries: 128
        }),
        [Render.QualityTier.LOW]: Object.freeze({
            dprCap: 1,
            maxLights: 12,
            maxShadowRays: 48,
            particleCap: 600,
            atlasMaxEntries: 64
        })
    });

    function requireStringKey(key) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new TypeError('Layer keys must be non-empty strings.');
        }
    }

    Render.configureCanvas = function(canvas, options = {}) {
        if (!canvas || typeof canvas.getContext !== 'function') {
            throw new TypeError('A canvas element is required.');
        }
        const logicalW = Math.max(1, Number(options.logicalW) || 1);
        const logicalH = Math.max(1, Number(options.logicalH) || 1);
        const cap = Math.max(0.25, Number(options.dprCap) || 1);
        const sourceDpr = Number(root.devicePixelRatio) || 1;
        const dpr = Math.min(sourceDpr, cap);
        const pixelWidth = Math.max(1, Math.round(logicalW * dpr));
        const pixelHeight = Math.max(1, Math.round(logicalH * dpr));

        if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
        if (canvas.style) {
            canvas.style.width = `${logicalW}px`;
            canvas.style.height = `${logicalH}px`;
        }

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { canvas, ctx, dpr, logicalW, logicalH, pixelWidth, pixelHeight };
    };

    Render.applyCamera = function(ctx, cameraState = {}) {
        const zoom = Number.isFinite(cameraState.zoom) ? cameraState.zoom : 1;
        const x = Number(cameraState.x) || 0;
        const y = Number(cameraState.y) || 0;
        const centerX = Number.isFinite(cameraState.centerX)
            ? cameraState.centerX
            : (Number(cameraState.viewWidth) || 0) / 2;
        const centerY = Number.isFinite(cameraState.centerY)
            ? cameraState.centerY
            : (Number(cameraState.viewHeight) || 0) / 2;
        const offsetX = Number(cameraState.offsetX) || 0;
        const offsetY = Number(cameraState.offsetY) || 0;

        ctx.translate(centerX + offsetX, centerY + offsetY);
        if (cameraState.rotation) ctx.rotate(cameraState.rotation);
        ctx.scale(zoom, zoom);
        ctx.translate(-x, -y);
        return ctx;
    };

    Render.cullPoints = function(entities, viewBounds, outArray = null) {
        if (!Array.isArray(entities)) return outArray || [];
        const bounds = viewBounds || {};
        const left = Number.isFinite(bounds.left) ? bounds.left : Number(bounds.x) || 0;
        const top = Number.isFinite(bounds.top) ? bounds.top : Number(bounds.y) || 0;
        const right = Number.isFinite(bounds.right)
            ? bounds.right
            : left + (Number(bounds.width) || 0);
        const bottom = Number.isFinite(bounds.bottom)
            ? bounds.bottom
            : top + (Number(bounds.height) || 0);

        if (outArray) {
            outArray.length = 0;
            for (let i = 0; i < entities.length; i++) {
                const entity = entities[i];
                if (!entity) continue;
                const margin = Math.max(0, Number(entity.cullRadius ?? entity.radius) || 0);
                if (entity.x + margin >= left
                    && entity.x - margin <= right
                    && entity.y + margin >= top
                    && entity.y - margin <= bottom) {
                    outArray.push(entity);
                }
            }
            return outArray;
        }

        return entities.filter(entity => {
            if (!entity) return false;
            const margin = Math.max(0, Number(entity.cullRadius ?? entity.radius) || 0);
            return entity.x + margin >= left
                && entity.x - margin <= right
                && entity.y + margin >= top
                && entity.y - margin <= bottom;
        });
    };

    class StaticLayer {
        constructor(options = {}) {
            this.layers = new Map();
            this.canvasPool = options.canvasPool || null;
        }

        _getPool() {
            return this.canvasPool || (Engine.Graphics && Engine.Graphics.CanvasPool);
        }

        bake(key, options = {}) {
            requireStringKey(key);
            if (typeof options.draw !== 'function') {
                throw new TypeError('StaticLayer.bake requires a draw callback.');
            }
            const logicalW = Math.max(1, Number(options.logicalW ?? options.width) || 1);
            const logicalH = Math.max(1, Number(options.logicalH ?? options.height) || 1);
            const dprCap = Math.max(0.25, Number(options.dprCap) || 1);
            const pool = this._getPool();
            if (!pool || typeof pool.acquire !== 'function') {
                throw new Error('StaticLayer requires Engine.Graphics.CanvasPool or an injected pool.');
            }

            this.release(key);
            const sourceDpr = Number(root.devicePixelRatio) || 1;
            const dpr = Math.min(sourceDpr, dprCap);
            const canvas = pool.acquire(
                Math.max(1, Math.round(logicalW * dpr)),
                Math.max(1, Math.round(logicalH * dpr))
            );
            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, logicalW, logicalH);
            options.draw(ctx, {
                key,
                canvas,
                logicalW,
                logicalH,
                dpr,
                data: options.data
            });

            const layer = { key, canvas, logicalW, logicalH, dpr };
            this.layers.set(key, layer);
            return layer;
        }

        draw(ctx, key, options = {}) {
            requireStringKey(key);
            const layer = this.layers.get(key);
            if (!layer) return false;
            const x = Number(options.x) || 0;
            const y = Number(options.y) || 0;
            const width = Number.isFinite(options.width) ? options.width : layer.logicalW;
            const height = Number.isFinite(options.height) ? options.height : layer.logicalH;
            ctx.drawImage(layer.canvas, x, y, width, height);
            return true;
        }

        release(key) {
            requireStringKey(key);
            const layer = this.layers.get(key);
            if (!layer) return false;
            this.layers.delete(key);
            const pool = this._getPool();
            if (pool && typeof pool.release === 'function') pool.release(layer.canvas);
            return true;
        }

        clear() {
            for (const key of Array.from(this.layers.keys())) this.release(key);
        }
    }

    Render.StaticLayer = StaticLayer;
    Render.Quality = Object.freeze({
        preset(tier) {
            const preset = QUALITY_PRESETS[tier] || QUALITY_PRESETS[Render.QualityTier.HIGH];
            return { ...preset };
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalThis.Engine.Render;
}

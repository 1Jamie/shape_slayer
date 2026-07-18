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

    FX.LightMask = new LightMaskBuffer();
    FX.LightMask.create = options => new LightMaskBuffer(options);
    FX.Post = FX.Post || {};
    FX.Post.chromaticAberration = chromaticAberration;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FX;
    }
})(typeof window !== 'undefined' ? window : globalThis);

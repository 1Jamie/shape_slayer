(function(root) {
    const Engine = root.Engine = root.Engine || {};

    function requireStringKey(key) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new TypeError('Cache keys must be non-empty strings.');
        }
        return key;
    }

    function hashSeed(seed) {
        const text = String(seed);
        let hash = 2166136261;
        for (let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function seededRandom(seed) {
        let state = hashSeed(seed);
        return function() {
            state += 0x6D2B79F5;
            let value = state;
            value = Math.imul(value ^ value >>> 15, value | 1);
            value ^= value + Math.imul(value ^ value >>> 7, value | 61);
            return ((value ^ value >>> 14) >>> 0) / 4294967296;
        };
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function normalizeHue(hue) {
        return ((hue % 360) + 360) % 360;
    }

    function hslToHex(hue, saturation, lightness) {
        const h = normalizeHue(Number(hue) || 0);
        const s = clamp((Number(saturation) || 0) / 100, 0, 1);
        const l = clamp((Number(lightness) || 0) / 100, 0, 1);
        const chroma = (1 - Math.abs(2 * l - 1)) * s;
        const segment = h / 60;
        const secondary = chroma * (1 - Math.abs(segment % 2 - 1));
        let red = 0;
        let green = 0;
        let blue = 0;

        if (segment < 1) [red, green] = [chroma, secondary];
        else if (segment < 2) [red, green] = [secondary, chroma];
        else if (segment < 3) [green, blue] = [chroma, secondary];
        else if (segment < 4) [green, blue] = [secondary, chroma];
        else if (segment < 5) [red, blue] = [secondary, chroma];
        else [red, blue] = [chroma, secondary];

        const match = l - chroma / 2;
        return `#${[red, green, blue]
            .map(channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
            .join('')}`;
    }

    function parseHexColor(color) {
        const value = String(color).trim();
        const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value);
        if (short) return short.slice(1).map(channel => parseInt(channel + channel, 16));
        const full = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})(?:[\da-f]{2})?$/i.exec(value);
        return full ? full.slice(1, 4).map(channel => parseInt(channel, 16)) : null;
    }

    function lerp(from, to, amount) {
        const t = clamp(Number(amount) || 0, 0, 1);
        if (typeof from === 'number' && typeof to === 'number') {
            return from + (to - from) * t;
        }
        const start = parseHexColor(from);
        const end = parseHexColor(to);
        if (!start || !end) throw new TypeError('Color lerp requires hexadecimal CSS colors.');
        return `#${start.map((channel, index) => {
            return Math.round(channel + (end[index] - channel) * t).toString(16).padStart(2, '0');
        }).join('')}`;
    }

    function withAlpha(color, alpha) {
        const channels = parseHexColor(color);
        if (!channels) throw new TypeError('withAlpha requires a hexadecimal CSS color.');
        return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${clamp(Number(alpha) || 0, 0, 1)})`;
    }

    const ColorScheme = Object.freeze({
        MONO: 'mono',
        ANALOGOUS: 'analogous',
        TRIADIC: 'triadic',
        COMPLEMENTARY: 'complementary'
    });

    function generatePalette(seed, options = {}) {
        const random = seededRandom(seed);
        const scheme = Object.values(ColorScheme).includes(options.scheme)
            ? options.scheme
            : ColorScheme.ANALOGOUS;
        const baseHue = Number.isFinite(options.hue) ? normalizeHue(options.hue) : random() * 360;
        const saturation = clamp(
            Number.isFinite(options.saturation) ? options.saturation : 62 + random() * 24,
            0,
            100
        );
        const lightness = clamp(
            Number.isFinite(options.lightness) ? options.lightness : 48 + random() * 14,
            0,
            100
        );
        const spread = Number.isFinite(options.hueSpread) ? options.hueSpread : 30;
        let secondaryHue = baseHue;
        let accentHue = baseHue;
        let secondaryLightness = lightness + 13;
        let accentLightness = lightness - 8;

        if (scheme === ColorScheme.ANALOGOUS) {
            secondaryHue = baseHue + spread;
            accentHue = baseHue - spread;
        } else if (scheme === ColorScheme.TRIADIC) {
            secondaryHue = baseHue + 120;
            accentHue = baseHue + 240;
        } else if (scheme === ColorScheme.COMPLEMENTARY) {
            secondaryHue = baseHue + 180;
            accentHue = baseHue + 180;
            secondaryLightness = lightness + 9;
            accentLightness = lightness - 12;
        } else {
            secondaryLightness = lightness + 18;
            accentLightness = lightness - 16;
        }

        const backgroundLightness = clamp(
            Number.isFinite(options.backgroundLightness) ? options.backgroundLightness : 7 + random() * 6,
            0,
            100
        );
        return {
            primary: hslToHex(baseHue, saturation, lightness),
            secondary: hslToHex(secondaryHue, saturation * 0.88, clamp(secondaryLightness, 0, 100)),
            accent: hslToHex(accentHue, clamp(saturation * 1.08, 0, 100), clamp(accentLightness, 0, 100)),
            background: hslToHex(baseHue, saturation * 0.28, backgroundLightness)
        };
    }

    const Color = Object.freeze({
        Scheme: ColorScheme,
        generatePalette,
        hslToHex,
        lerp,
        withAlpha
    });

    function regularPolygonPath(ctx, x, y, radius, sides, rotation = 0, scaleY = 1) {
        const count = Math.max(3, Math.floor(sides || 0));
        ctx.beginPath();
        for (let index = 0; index < count; index++) {
            const angle = rotation + index * Math.PI * 2 / count;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius * scaleY;
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        return ctx;
    }

    function polygon(ctx, options = {}) {
        regularPolygonPath(
            ctx,
            Number(options.x) || 0,
            Number(options.y) || 0,
            Math.max(0, Number(options.radius) || 0),
            options.sides,
            Number(options.rotation) || 0,
            Number.isFinite(options.scaleY) ? options.scaleY : 1
        );
        if (options.fill !== undefined && options.fill !== null) {
            ctx.fillStyle = options.fill;
            ctx.fill();
        }
        if (options.stroke !== undefined && options.stroke !== null) {
            ctx.strokeStyle = options.stroke;
            ctx.lineWidth = Number(options.lineWidth) || 1;
            ctx.stroke();
        }
        return ctx;
    }

    const CanvasPool = {
        _buckets: new Map(),
        _factory: null,
        maxPerSize: 8,

        configure(options = {}) {
            if (typeof options.createCanvas === 'function') this._factory = options.createCanvas;
            if (Number.isFinite(options.maxPerSize)) {
                this.maxPerSize = Math.max(0, Math.floor(options.maxPerSize));
            }
            return this;
        },

        _create(width, height) {
            if (this._factory) return this._factory(width, height);
            if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
            if (root.document && typeof root.document.createElement === 'function') {
                const canvas = root.document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                return canvas;
            }
            throw new Error('No Canvas2D factory is available.');
        },

        acquire(width, height) {
            const pixelWidth = Math.max(1, Math.ceil(width || 1));
            const pixelHeight = Math.max(1, Math.ceil(height || 1));
            const bucketKey = `${pixelWidth}x${pixelHeight}`;
            const bucket = this._buckets.get(bucketKey);
            const canvas = bucket && bucket.length ? bucket.pop() : this._create(pixelWidth, pixelHeight);
            if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
            if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
            return canvas;
        },

        release(canvas) {
            if (!canvas || !Number.isFinite(canvas.width) || !Number.isFinite(canvas.height)) return false;
            const bucketKey = `${canvas.width}x${canvas.height}`;
            let bucket = this._buckets.get(bucketKey);
            if (!bucket) {
                bucket = [];
                this._buckets.set(bucketKey, bucket);
            }
            if (bucket.length >= this.maxPerSize) return false;
            const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
            if (ctx) {
                if (typeof ctx.resetTransform === 'function') ctx.resetTransform();
                else if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            bucket.push(canvas);
            return true;
        },

        clear() {
            this._buckets.clear();
        }
    };

    function normalizeSpriteCacheEntry(entry) {
        if (entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'value')) {
            return entry;
        }
        return { value: entry, dispose: null };
    }

    function disposeSpriteCacheEntry(entry) {
        if (entry && typeof entry.dispose === 'function') {
            entry.dispose(entry.value);
        }
    }

    const SpriteCache = {
        _entries: new Map(),

        get(key, factory, disposeFn) {
            requireStringKey(key);
            if (this._entries.has(key)) return normalizeSpriteCacheEntry(this._entries.get(key)).value;
            if (typeof factory !== 'function') return null;
            const value = factory(key);
            this._entries.set(key, {
                value,
                dispose: typeof disposeFn === 'function' ? disposeFn : null
            });
            return value;
        },

        set(key, value, disposeFn) {
            requireStringKey(key);
            if (this._entries.has(key)) {
                disposeSpriteCacheEntry(normalizeSpriteCacheEntry(this._entries.get(key)));
            }
            this._entries.set(key, {
                value,
                dispose: typeof disposeFn === 'function' ? disposeFn : null
            });
            return value;
        },

        release(key) {
            requireStringKey(key);
            const raw = this._entries.get(key);
            if (!raw) return null;
            const entry = normalizeSpriteCacheEntry(raw);
            this._entries.delete(key);
            disposeSpriteCacheEntry(entry);
            return entry.value;
        },

        clear(prefix) {
            if (prefix === undefined) {
                for (const raw of this._entries.values()) {
                    disposeSpriteCacheEntry(normalizeSpriteCacheEntry(raw));
                }
                this._entries.clear();
                return;
            }
            requireStringKey(prefix);
            for (const key of Array.from(this._entries.keys())) {
                if (key.startsWith(prefix)) this.release(key);
            }
        }
    };

    const PatternCache = {
        _contexts: new WeakMap(),

        get(ctx, key, tileFactory, repetition = 'repeat') {
            requireStringKey(key);
            if (!ctx || typeof ctx.createPattern !== 'function') {
                throw new TypeError('A Canvas2D context is required.');
            }
            let entries = this._contexts.get(ctx);
            if (!entries) {
                entries = new Map();
                this._contexts.set(ctx, entries);
            }
            const fullKey = `${key}:${repetition}`;
            if (entries.has(fullKey)) return entries.get(fullKey);
            if (typeof tileFactory !== 'function') return null;
            const tile = tileFactory(key);
            const pattern = ctx.createPattern(tile, repetition);
            entries.set(fullKey, pattern);
            return pattern;
        },

        clear(ctx) {
            if (ctx) this._contexts.delete(ctx);
            else this._contexts = new WeakMap();
        }
    };

    const TileBaker = {
        _entries: new Map(),
        qualityTier: 0,

        setQualityTier(tier) {
            this.qualityTier = tier;
            this._evict();
            return this;
        },

        _maxEntries() {
            const Render = Engine.Render;
            if (!Render || !Render.Quality || typeof Render.Quality.preset !== 'function') return 64;
            const preset = Render.Quality.preset(this.qualityTier);
            return Math.max(1, Math.floor(preset.atlasMaxEntries || 64));
        },

        _touch(key, token) {
            this._entries.delete(key);
            this._entries.set(key, token);
        },

        _evict() {
            const limit = this._maxEntries();
            while (this._entries.size > limit) {
                const oldestKey = this._entries.keys().next().value;
                const token = this._entries.get(oldestKey);
                this._entries.delete(oldestKey);
                token.valid = false;
                CanvasPool.release(token.canvas);
            }
        },

        bake(key, width, height, drawFn) {
            requireStringKey(key);
            const existing = this._entries.get(key);
            if (existing) {
                this._touch(key, existing);
                return existing;
            }
            if (typeof drawFn !== 'function') throw new TypeError('TileBaker.bake requires a draw callback.');
            const w = Math.max(1, Math.ceil(Number(width) || 1));
            const h = Math.max(1, Math.ceil(Number(height) || 1));
            const canvas = CanvasPool.acquire(w, h);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, w, h);
            drawFn(ctx, { key, width: w, height: h, canvas });
            const token = { key, canvas, width: w, height: h, valid: true };
            this._entries.set(key, token);
            this._evict();
            return token;
        },

        blit(ctx, token, x, y, options = {}) {
            if (!token || !token.valid || !this._entries.has(token.key)) return false;
            this._touch(token.key, token);
            const width = Number.isFinite(options.width) ? options.width : token.width;
            const height = Number.isFinite(options.height) ? options.height : token.height;
            const anchorX = Number(options.anchorX) || 0;
            const anchorY = Number(options.anchorY) || 0;
            const scaleX = Number.isFinite(options.scaleX) ? options.scaleX : 1;
            const scaleY = Number.isFinite(options.scaleY) ? options.scaleY : 1;

            ctx.save();
            ctx.globalAlpha *= Number.isFinite(options.alpha) ? options.alpha : 1;
            if (options.composite) ctx.globalCompositeOperation = options.composite;
            if (typeof options.smoothing === 'boolean') ctx.imageSmoothingEnabled = options.smoothing;
            ctx.translate(x, y);
            if (options.rotation) ctx.rotate(options.rotation);
            ctx.scale(scaleX, scaleY);
            ctx.drawImage(token.canvas, -anchorX * width, -anchorY * height, width, height);
            ctx.restore();
            return true;
        },

        release(key) {
            requireStringKey(key);
            const token = this._entries.get(key);
            if (!token) return false;
            this._entries.delete(key);
            token.valid = false;
            CanvasPool.release(token.canvas);
            return true;
        },

        clear() {
            for (const key of Array.from(this._entries.keys())) this.release(key);
        }
    };

    const GlowAtlas = {
        size: 128,
        _prefix: 'glow:',

        get(color) {
            const key = `${this._prefix}${String(color)}`;
            return SpriteCache.get(key, () => {
                const canvas = CanvasPool.acquire(this.size, this.size);
                const ctx = canvas.getContext('2d');
                const center = this.size / 2;
                const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
                gradient.addColorStop(0, color);
                gradient.addColorStop(0.28, color);
                gradient.addColorStop(1, 'transparent');
                ctx.clearRect(0, 0, this.size, this.size);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, this.size, this.size);
                return canvas;
            }, canvas => CanvasPool.release(canvas));
        },

        draw(ctx, x, y, radius, color, options = {}) {
            const sprite = this.get(color);
            const diameter = Math.max(0, radius * 2);
            ctx.save();
            ctx.globalAlpha *= Number.isFinite(options.alpha) ? options.alpha : 1;
            if (options.composite) ctx.globalCompositeOperation = options.composite;
            ctx.drawImage(sprite, x - radius, y - radius, diameter, diameter);
            ctx.restore();
            return sprite;
        },

        prewarm(colors) {
            return Array.from(colors || [], color => this.get(color));
        },

        clear() {
            SpriteCache.clear(this._prefix);
        }
    };

    const NeonMode = Object.freeze({
        AUTO: 'auto',
        SHADOW_BLUR: 'shadowBlur',
        MULTIPASS_LIGHTER: 'multipass'
    });

    function resolveNeonMode(mode) {
        if (mode && mode !== NeonMode.AUTO) return mode;
        const system = Engine.System;
        return system && typeof system.isGeckoFamily === 'function' && system.isGeckoFamily()
            ? NeonMode.MULTIPASS_LIGHTER
            : NeonMode.SHADOW_BLUR;
    }

    function neonStrokeRect(ctx, rect, color, blur = 8, lineWidth = 2, options = {}) {
        const mode = resolveNeonMode(options.mode);
        ctx.save();
        if (mode === NeonMode.SHADOW_BLUR) {
            ctx.shadowColor = color;
            ctx.shadowBlur = blur;
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        } else {
            ctx.globalCompositeOperation = 'lighter';
            const passes = options.passes || 3;
            for (let pass = passes; pass > 0; pass--) {
                ctx.globalAlpha = 0.12 + (passes - pass) * 0.08;
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth + pass * Math.max(1, blur / passes);
                ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            }
            ctx.globalAlpha = 1;
            ctx.lineWidth = lineWidth;
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        }
        ctx.restore();
    }

    function neonFillText(ctx, text, x, y, color, blur = 8, options = {}) {
        const mode = resolveNeonMode(options.mode);
        ctx.save();
        ctx.fillStyle = color;
        if (mode === NeonMode.SHADOW_BLUR) {
            ctx.shadowColor = color;
            ctx.shadowBlur = blur;
            ctx.fillText(text, x, y);
        } else {
            ctx.globalCompositeOperation = 'lighter';
            const passes = options.passes || 3;
            for (let pass = passes; pass > 0; pass--) {
                ctx.globalAlpha = 0.12 + (passes - pass) * 0.08;
                const offset = pass * Math.max(0.5, blur / (passes * 4));
                ctx.fillText(text, x - offset, y);
                ctx.fillText(text, x + offset, y);
                ctx.fillText(text, x, y - offset);
                ctx.fillText(text, x, y + offset);
            }
            ctx.globalAlpha = 1;
            ctx.fillText(text, x, y);
        }
        ctx.restore();
    }

    Engine.Graphics = {
        Color,
        NeonMode,
        regularPolygonPath,
        polygon,
        neonStrokeRect,
        neonFillText,
        GlowAtlas,
        CanvasPool,
        SpriteCache,
        PatternCache,
        TileBaker
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Engine.Graphics;
    }
})(typeof window !== 'undefined' ? window : globalThis);

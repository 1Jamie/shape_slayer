// Engine.Music - generic playlist transport: buffer cache, playSet, fade, duck, pause/resume, stop, loadManifest

const EngineMusic = {
    config: null,
    _manifestUrl: null,
    _manifest: null,
    initialized: false,
    initPromise: null,
    context: null,
    musicBus: null,
    buffers: new Map(),
    pendingLoads: new Map(),
    backgroundWarmStarted: false,
    fallbackWarmQueue: [],
    fallbackWarmQueued: new Set(),
    fallbackWarmRunning: false,
    currentSetId: null,
    currentCategory: null,
    currentTrack: null,
    currentSource: null,
    currentGain: null,
    currentLoop: false,
    currentStartTime: 0,
    currentOffset: 0,
    currentBufferDuration: 0,
    currentSetSnapshot: null,
    currentTrackIndex: 0,
    pausedTrackInfo: null,
    shuffleMemory: new Map(), // setId -> last index
    duckingActive: false,
    pendingFadeTimeout: null,
    scheduledNextTimeout: null,
    pendingStop: null,

    /**
     * Inject the playlist manifest. The transport never assumes a location or
     * a content schema; the application supplies either a URL to fetch or the
     * manifest object itself before (or instead of) init().
     */
    configure(options = {}) {
        if (options.manifestUrl !== undefined) {
            this._manifestUrl = options.manifestUrl ? String(options.manifestUrl) : null;
        }
        if (options.manifest !== undefined) {
            this._manifest = options.manifest && typeof options.manifest === 'object'
                ? options.manifest
                : null;
        }
        return this;
    },

    /** Load the manifest from a URL or accept it as an object directly. */
    async loadManifest(source) {
        if (source && typeof source === 'object') {
            this.config = source;
            return this.config;
        }
        const url = (typeof source === 'string' && source) ? source : this._manifestUrl;
        if (!url) {
            throw new Error('Engine.Music has no manifest; call configure({ manifestUrl }) or loadManifest(urlOrObject) first.');
        }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load music manifest ${url} (${response.status})`);
        }
        this.config = await response.json();
        return this.config;
    },

    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            if (!Engine.Audio) {
                throw new Error('Engine.Audio is required before initializing Engine.Music.');
            }

            Engine.Audio.init();
            this.context = Engine.Audio.context;
            this.musicBus = Engine.Audio.getMusicBus();

            if (!this.context || !this.musicBus) {
                throw new Error('Failed to acquire Engine.Audio music bus.');
            }

            if (!this.config) {
                await this.loadManifest(this._manifest || this._manifestUrl);
            }
            this.initialized = true;
            this.startBackgroundAudioWarm();
        })().catch(error => {
            console.error('[Engine.Music] Initialization failed:', error);
            this.initPromise = null;
            throw error;
        });

        return this.initPromise;
    },

    /**
     * Collect every track referenced by the manifest for cache warming.
     * Schema-agnostic: walks the whole config and gathers any `tracks`
     * string-array, so the transport needs no knowledge of how the
     * application organizes its playlists.
     */
    collectAllTrackUrls() {
        if (!this.config) {
            return [];
        }

        const names = new Set();
        const seen = new Set();
        const visit = (node) => {
            if (!node || typeof node !== 'object' || seen.has(node)) {
                return;
            }
            seen.add(node);
            if (Array.isArray(node)) {
                node.forEach(visit);
                return;
            }
            if (Array.isArray(node.tracks)) {
                node.tracks.forEach((track) => {
                    if (typeof track === 'string' && track) {
                        names.add(track);
                    }
                });
            }
            Object.keys(node).forEach((key) => visit(node[key]));
        };
        visit(this.config);

        return Array.from(names).map((name) => this.basePath + name);
    },

    postAudioWarmMessage(type, urls) {
        if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
            return false;
        }

        const message = { type, urls };
        const controller = navigator.serviceWorker.controller;
        if (controller) {
            controller.postMessage(message);
            return true;
        }

        navigator.serviceWorker.ready.then((registration) => {
            if (registration.active) {
                registration.active.postMessage(message);
            }
        }).catch(() => {
            // Ignore - fallback warm still runs.
        });
        return false;
    },

    enqueueFallbackAudioWarm(urls, prioritize) {
        if (!Array.isArray(urls) || urls.length === 0) {
            return;
        }

        const toAdd = [];
        urls.forEach((url) => {
            if (!url || this.buffers.has(url) || this.pendingLoads.has(url) || this.fallbackWarmQueued.has(url)) {
                return;
            }
            this.fallbackWarmQueued.add(url);
            toAdd.push(url);
        });

        if (toAdd.length === 0) {
            return;
        }

        if (prioritize) {
            this.fallbackWarmQueue = toAdd.concat(this.fallbackWarmQueue);
        } else {
            this.fallbackWarmQueue = this.fallbackWarmQueue.concat(toAdd);
        }

        this.pumpFallbackAudioWarm();
    },

    pumpFallbackAudioWarm() {
        if (this.fallbackWarmRunning) {
            return;
        }
        this.fallbackWarmRunning = true;

        const runNext = async () => {
            while (this.fallbackWarmQueue.length > 0) {
                const url = this.fallbackWarmQueue.shift();
                this.fallbackWarmQueued.delete(url);
                try {
                    // Fetch only - do not decode. Keeps RAM low while filling HTTP/SW cache.
                    const response = await fetch(url, { credentials: 'same-origin' });
                    if (response && response.ok) {
                        await response.arrayBuffer();
                    }
                } catch (error) {
                    // Best-effort background warm.
                }
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
            this.fallbackWarmRunning = false;
        };

        runNext().catch(() => {
            this.fallbackWarmRunning = false;
        });
    },

    prioritizeAudioWarm(urls) {
        if (!Array.isArray(urls) || urls.length === 0) {
            return;
        }
        const sent = this.postAudioWarmMessage('PRIORITIZE_AUDIO', urls);
        if (!sent) {
            this.enqueueFallbackAudioWarm(urls, true);
        }
    },

    startBackgroundAudioWarm() {
        if (this.backgroundWarmStarted || !this.config) {
            return;
        }
        this.backgroundWarmStarted = true;

        const urls = this.collectAllTrackUrls();
        if (urls.length === 0) {
            return;
        }

        this.postAudioWarmMessage('WARM_AUDIO_LIBRARY', urls);

        const hasController = typeof navigator !== 'undefined' &&
            navigator.serviceWorker &&
            navigator.serviceWorker.controller;

        if (hasController) {
            // Service worker owns the library warm - avoid competing downloads.
            return;
        }

        // First visit / SW not controlling yet: page-side fetch fills cache until then.
        this.enqueueFallbackAudioWarm(urls, false);

        if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
            return;
        }

        const handoffToServiceWorker = () => {
            this.fallbackWarmQueue.length = 0;
            this.fallbackWarmQueued.clear();
            this.postAudioWarmMessage('WARM_AUDIO_LIBRARY', urls);
        };

        navigator.serviceWorker.ready.then((registration) => {
            if (registration.active) {
                registration.active.postMessage({ type: 'WARM_AUDIO_LIBRARY', urls });
            }
            if (navigator.serviceWorker.controller) {
                handoffToServiceWorker();
            }
        }).catch(() => {});

        navigator.serviceWorker.addEventListener('controllerchange', handoffToServiceWorker, { once: true });
    },

    get basePath() {
        // The manifest owns its asset location; without one, tracks resolve
        // relative to the page.
        return (this.config && this.config.settings && this.config.settings.basePath) || '';
    },

    get crossfadeSeconds() {
        return (this.config && this.config.settings && this.config.settings.crossfadeSeconds) || 1.5;
    },

    get introFadeSeconds() {
        return (this.config && this.config.settings && this.config.settings.introFadeSeconds) || 0.6;
    },

    get outroFadeSeconds() {
        return (this.config && this.config.settings && this.config.settings.outroFadeSeconds) || this.crossfadeSeconds;
    },

    get resumeFadeSeconds() {
        return (this.config && this.config.settings && this.config.settings.resumeFadeSeconds) || 0.8;
    },

    get duckSettings() {
        return (this.config && this.config.settings && this.config.settings.ducking) || {
            attenuatedGain: 0.4,
            lowpassFrequency: 1000,
            attackSeconds: 0.25,
            releaseSeconds: 0.7
        };
    },

    stopScheduledNext() {
        if (this.scheduledNextTimeout) {
            clearTimeout(this.scheduledNextTimeout);
            this.scheduledNextTimeout = null;
        }
    },

    clearPendingStop() {
        if (this.pendingStop) {
            clearTimeout(this.pendingStop);
            this.pendingStop = null;
        }
    },

    applyDucking(enable) {
        if (!this.musicBus || !this.musicBus.duckGain || !this.musicBus.filter) {
            return;
        }

        const { attenuatedGain, lowpassFrequency, attackSeconds, releaseSeconds } = this.duckSettings;
        const now = this.context.currentTime;

        if (enable) {
            if (this.duckingActive) return;
            this.duckingActive = true;

            const targetGain = Math.max(0.0, Math.min(1.0, attenuatedGain));
            this.musicBus.filter.frequency.cancelScheduledValues(now);
            this.musicBus.filter.frequency.setTargetAtTime(lowpassFrequency, now, Math.max(0.01, attackSeconds));

            this.musicBus.duckGain.gain.cancelScheduledValues(now);
            this.musicBus.duckGain.gain.setTargetAtTime(targetGain, now, Math.max(0.01, attackSeconds));
        } else {
            if (!this.duckingActive) return;
            this.duckingActive = false;

            this.musicBus.filter.frequency.cancelScheduledValues(now);
            this.musicBus.filter.frequency.setTargetAtTime(20000, now, Math.max(0.01, releaseSeconds));

            this.musicBus.duckGain.gain.cancelScheduledValues(now);
            this.musicBus.duckGain.gain.setTargetAtTime(1.0, now, Math.max(0.01, releaseSeconds));
        }
    },

    async playSet(setConfig, category, options = {}) {
        if (!setConfig || !Array.isArray(setConfig.tracks) || setConfig.tracks.length === 0) {
            console.warn('[Engine.Music] Empty track list supplied to playSet().');
            return;
        }

        this.applyDucking(false);
        this.clearPendingStop();
        this.pausedTrackInfo = null;

        if (Engine.Audio && typeof Engine.Audio.resume === 'function') {
            Engine.Audio.resume();
        }

        const selectionMode = setConfig.selection?.mode || 'loop';
        const manualTrack = options.trackIndex !== undefined;
        let nextTrackIndex = 0;
        let loop = selectionMode !== 'shuffle';

        if (manualTrack) {
            const poolSize = setConfig.tracks.length;
            nextTrackIndex = ((options.trackIndex % poolSize) + poolSize) % poolSize;
        } else if (selectionMode === 'shuffle') {
            const lastIndex = this.shuffleMemory.get(setConfig.id);
            const poolSize = setConfig.tracks.length;
            if (poolSize === 1) {
                nextTrackIndex = 0;
            } else {
                let attempts = 0;
                do {
                    nextTrackIndex = Math.floor(Math.random() * poolSize);
                    attempts++;
                } while (nextTrackIndex === lastIndex && attempts < 5);
            }
            this.shuffleMemory.set(setConfig.id, nextTrackIndex);
            loop = false;
        }

        const trackName = setConfig.tracks[nextTrackIndex];
        if (!manualTrack && trackName === this.currentTrack && setConfig.id === this.currentSetId && this.currentCategory === category) {
            this.resumeIfNeeded();
            return;
        }

        if (!options.resume && category !== 'pause') {
            this.pausedTrackInfo = null;
        }

        const trackUrl = this.basePath + trackName;
        // Prefer the track we're about to play, then the rest of this set, for cache warming.
        const setUrls = setConfig.tracks.map((name) => this.basePath + name);
        this.prioritizeAudioWarm([trackUrl].concat(setUrls.filter((url) => url !== trackUrl)));

        const buffer = await this.loadBuffer(trackUrl);
        if (!buffer) {
            console.warn(`[Engine.Music] Could not load buffer for ${trackUrl}`);
            return;
        }

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;

        const gainNode = this.context.createGain();
        gainNode.gain.value = 0;

        source.connect(gainNode);
        gainNode.connect(this.musicBus.input);

        const now = this.context.currentTime;

        if (this.currentGain) {
            this.currentGain.gain.cancelScheduledValues(now);
            this.currentGain.gain.setValueAtTime(this.currentGain.gain.value, now);
            this.currentGain.gain.linearRampToValueAtTime(0, now + this.outroFadeSeconds);

            if (this.currentSource) {
                const stopTime = now + this.outroFadeSeconds + 0.1;
                this.currentSource.stop(stopTime);
            }
        }

        const fadeIn = this.introFadeSeconds;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(1, now + fadeIn);

        const bufferDuration = buffer.duration || 0;
        let startOffset = Math.max(0, options.offset || 0);
        if (bufferDuration > 0) {
            startOffset = startOffset % bufferDuration;
        } else {
            startOffset = 0;
        }

        source.start(now, startOffset);

        if (!loop) {
            const remaining = bufferDuration > 0 ? Math.max(0, bufferDuration - startOffset) : 0;
            const fadeLead = Math.max(0.5, this.crossfadeSeconds);
            const timeoutMs = Math.max(0, (remaining - fadeLead) * 1000);
            this.stopScheduledNext();
            this.scheduledNextTimeout = setTimeout(() => {
                this.scheduledNextTimeout = null;
                if (this.currentSetId === setConfig.id && this.currentCategory === category) {
                    this.playSet(setConfig, category).catch(err => {
                        console.error('[Engine.Music] Failed to advance shuffle track:', err);
                    });
                }
            }, timeoutMs);
        } else {
            this.stopScheduledNext();
        }

        this.currentSource = source;
        this.currentGain = gainNode;
        this.currentTrack = trackName;
        this.currentSetId = setConfig.id;
        this.currentCategory = category;
        this.currentLoop = loop;
        this.currentTrackIndex = nextTrackIndex;
        this.currentBufferDuration = bufferDuration;
        this.currentOffset = startOffset;
        this.currentStartTime = now - startOffset;
        this.currentSetSnapshot = {
            id: setConfig.id,
            tracks: setConfig.tracks.slice(),
            selection: setConfig.selection ? { ...setConfig.selection } : { mode: 'loop' },
            loop
        };

        source.onended = () => {
            if (this.currentSource === source && !loop) {
                this.currentSource = null;
                this.currentGain = null;
                this.currentTrack = null;
                this.currentLoop = false;
            }
        };
    },

    resumeIfNeeded() {
        if (!this.currentGain || !this.context) return;
        const now = this.context.currentTime;
        const target = 1.0;
        this.currentGain.gain.cancelScheduledValues(now);
        this.currentGain.gain.setTargetAtTime(target, now, Math.max(0.01, this.resumeFadeSeconds));
    },

    pauseCurrentPlayback() {
        if (!this.currentSource || !this.context) return Promise.resolve(false);
        if (this.currentCategory === 'pause') return Promise.resolve(false);
        const bufferDuration = this.currentBufferDuration || (this.currentSource.buffer ? this.currentSource.buffer.duration : 0);
        let offset = 0;
        if (bufferDuration > 0) {
            const now = this.context.currentTime;
            const elapsed = Math.max(0, now - this.currentStartTime);
            offset = (this.currentOffset + elapsed) % bufferDuration;
        }
        this.pausedTrackInfo = {
            setId: this.currentSetId,
            category: this.currentCategory,
            trackIndex: this.currentTrackIndex,
            offset,
            setSnapshot: this.currentSetSnapshot ? {
                id: this.currentSetSnapshot.id,
                tracks: this.currentSetSnapshot.tracks ? this.currentSetSnapshot.tracks.slice() : [],
                selection: this.currentSetSnapshot.selection ? { ...this.currentSetSnapshot.selection } : { mode: 'loop' },
                loop: !!this.currentSetSnapshot.loop
            } : null
        };
        return this.fadeOutCurrent(Math.min(0.3, this.outroFadeSeconds)).then(() => true);
    },

    async resumePausedTrack() {
        const info = this.pausedTrackInfo;
        if (!info) return false;
        this.pausedTrackInfo = null;
        let setConfig = info.setSnapshot;
        if (!setConfig) {
            console.warn('[Engine.Music] Missing set snapshot for resume; skipping resume.');
            return false;
        }
        await this.playSet(setConfig, info.category, {
            trackIndex: info.trackIndex,
            offset: info.offset,
            resume: true
        });
        return true;
    },

    async fadeOutCurrent(duration = this.outroFadeSeconds) {
        await this.init();

        if (!this.currentGain || !this.currentSource) {
            return;
        }

        this.stopScheduledNext();
        this.clearPendingStop();

        const source = this.currentSource;
        const gainNode = this.currentGain;
        const now = this.context.currentTime;
        const fadeSeconds = Math.max(0.1, duration || 0.1);

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + fadeSeconds);

        try {
            source.stop(now + fadeSeconds + 0.05);
        } catch (err) {
            console.warn('[Engine.Music] Failed to schedule stop during fade:', err);
        }

        await new Promise(resolve => {
            this.pendingStop = setTimeout(() => {
                this.pendingStop = null;
                if (this.currentSource === source) {
                    this.clearCurrentState();
                }
                resolve();
            }, Math.max(0, fadeSeconds * 1000 + 80));
        });

        this.applyDucking(false);
    },

    clearCurrentState() {
        this.currentSource = null;
        this.currentGain = null;
        this.currentTrack = null;
        this.currentSetId = null;
        this.currentLoop = false;
        this.currentCategory = null;
        this.currentTrackIndex = 0;
        this.currentBufferDuration = 0;
        this.currentOffset = 0;
        this.currentStartTime = 0;
        this.currentSetSnapshot = null;
    },

    stop() {
        this.stopScheduledNext();
        this.clearPendingStop();
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // ignored
            }
        }
        this.clearCurrentState();
        this.pausedTrackInfo = null;
        this.applyDucking(false);
    },

    async loadBuffer(url) {
        if (this.buffers.has(url)) {
            return this.buffers.get(url);
        }

        if (this.pendingLoads.has(url)) {
            return this.pendingLoads.get(url);
        }

        const loadPromise = (async () => {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[Engine.Music] Failed to fetch ${url} (${response.status})`);
                return null;
            }

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.buffers.set(url, audioBuffer);
            return audioBuffer;
        })().catch((error) => {
            console.error(`[Engine.Music] Failed to load ${url}:`, error);
            return null;
        }).finally(() => {
            this.pendingLoads.delete(url);
        });

        this.pendingLoads.set(url, loadPromise);
        return loadPromise;
    }
};

window.Engine = window.Engine || {};
window.Engine.Music = EngineMusic;

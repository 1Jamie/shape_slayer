// MusicManager - handles MP3 background music with smooth transitions and config-driven playlists

const MusicManager = {
    config: null,
    initialized: false,
    initPromise: null,
    context: null,
    musicBus: null,
    buffers: new Map(),
    currentSetId: null,
    currentCategory: null, // 'normal', 'boss', 'pause', 'nexus', 'gameOver'
    lastNonPauseSetId: null,
    lastNonPauseCategory: null,
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
    randomAssignments: new Map(), // key -> setId
    duckingActive: false,
    pendingFadeTimeout: null,
    scheduledNextTimeout: null,
    pendingStop: null,
    
    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }
        
        this.initPromise = (async () => {
            if (typeof AudioManager === 'undefined') {
                throw new Error('AudioManager is required before initializing MusicManager.');
            }
            
            AudioManager.init();
            this.context = AudioManager.context;
            this.musicBus = AudioManager.getMusicBus();
            
            if (!this.context || !this.musicBus) {
                throw new Error('Failed to acquire AudioManager music bus.');
            }
            
            const response = await fetch('audio/music-config.json');
            if (!response.ok) {
                throw new Error(`Failed to load music-config.json (${response.status})`);
            }
            
            this.config = await response.json();
            this.initialized = true;
        })().catch(error => {
            console.error('[MusicManager] Initialization failed:', error);
            this.initPromise = null;
            throw error;
        });
        
        return this.initPromise;
    },
    
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('MusicManager.init() must be called before use.');
        }
    },
    
    get basePath() {
        return (this.config && this.config.settings && this.config.settings.basePath) || 'audio/';
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
    
    async setRoom(roomNumber) {
        await this.init();
        this.ensureInitialized();
        
        const resolved = this.resolveRoomSet(roomNumber);
        if (!resolved) {
            console.warn(`[MusicManager] No playlist found for room ${roomNumber}.`);
            return;
        }
        
        if (resolved.id === this.currentSetId && this.currentCategory === 'normal') {
            // Already playing this set, ensure playback continues
            this.resumeIfNeeded();
            return;
        }
        
        await this.playSet(resolved, 'normal');
        this.lastNonPauseCategory = 'normal';
        this.lastNonPauseSetId = resolved.id;
    },
    
    async setBossPhase(roomNumber, phaseIndex) {
        await this.init();
        this.ensureInitialized();
        
        const resolved = this.resolveBossPhase(roomNumber, phaseIndex);
        if (!resolved) {
            console.warn(`[MusicManager] No boss playlist resolved for room ${roomNumber} phase ${phaseIndex}.`);
            return;
        }
        
        if (resolved.id === this.currentSetId && this.currentCategory === 'boss' && this.currentTrack && resolved.loop === this.currentLoop) {
            this.resumeIfNeeded();
            return;
        }
        
        await this.playSet(resolved, 'boss');
        this.lastNonPauseCategory = 'boss';
        this.lastNonPauseSetId = resolved.id;
    },
    
    async playPauseMenu() {
        await this.init();
        this.ensureInitialized();
        
        const pauseConfig = this.config && this.config.pauseMenu;
        if (pauseConfig && Array.isArray(pauseConfig.tracks) && pauseConfig.tracks.length > 0) {
            await this.pauseCurrentPlayback();
            const pauseSet = this.normalizeSet({
                id: '__pause__',
                tracks: pauseConfig.tracks.slice(),
                selection: pauseConfig.selection || { mode: 'loop' }
            });
            await this.playSet(pauseSet, 'pause');
        } else {
            this.applyDucking(true);
        }
    },
    
    async resumeFromPause() {
        await this.init();
        this.ensureInitialized();
        
        let resumed = false;
        
        if (this.currentCategory === 'pause') {
            await this.fadeOutCurrent(this.outroFadeSeconds);
        }
        
        this.applyDucking(false);
        
        if (this.pausedTrackInfo) {
            resumed = await this.resumePausedTrack();
        }
        
        return resumed;
    },
    
    async setNexus() {
        await this.init();
        this.ensureInitialized();
        
        const nexusSet = this.getSpecialSet('nexus');
        if (!nexusSet) {
            console.warn('[MusicManager] No nexus playlist defined.');
            return;
        }
        
        if (this.currentCategory === 'nexus' && this.currentSetId === nexusSet.id) {
            this.resumeIfNeeded();
            return;
        }
        
        await this.playSet(nexusSet, 'nexus');
        this.lastNonPauseCategory = 'nexus';
        this.lastNonPauseSetId = nexusSet.id;
    },
    
    async playGameOver() {
        await this.init();
        this.ensureInitialized();
        
        const gameOverSet = this.getSpecialSet('gameOver');
        if (!gameOverSet) {
            console.warn('[MusicManager] No game over playlist defined.');
            return;
        }
        
        if (this.currentCategory === 'gameOver' && this.currentSetId === gameOverSet.id) {
            this.resumeIfNeeded();
            return;
        }
        
        await this.playSet(gameOverSet, 'gameOver');
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
            console.warn('[MusicManager] Empty track list supplied to playSet().');
            return;
        }
        
        this.applyDucking(false);
        this.clearPendingStop();
        this.pausedTrackInfo = null;
        
        if (typeof AudioManager !== 'undefined' && AudioManager && typeof AudioManager.resume === 'function') {
            AudioManager.resume();
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
        const buffer = await this.loadBuffer(trackUrl);
        if (!buffer) {
            console.warn(`[MusicManager] Could not load buffer for ${trackUrl}`);
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
                        console.error('[MusicManager] Failed to advance shuffle track:', err);
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
            console.warn('[MusicManager] Missing set snapshot for resume; skipping resume.');
            return false;
        }
        await this.playSet(setConfig, info.category, {
            trackIndex: info.trackIndex,
            offset: info.offset,
            resume: true
        });
        return true;
    },
    
    pauseForBackground() {
        if (!this.context) return Promise.resolve(false);
        if (this.currentCategory === 'pause') {
            return this.fadeOutCurrent(Math.min(0.3, this.outroFadeSeconds));
        }
        return this.pauseCurrentPlayback();
    },
    
    async fadeOutCurrent(duration = this.outroFadeSeconds) {
        await this.init();
        this.ensureInitialized();
        
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
            console.warn('[MusicManager] Failed to schedule stop during fade:', err);
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
        
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[MusicManager] Failed to fetch ${url} (${response.status})`);
            return null;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.buffers.set(url, audioBuffer);
        return audioBuffer;
    },
    
    getSpecialSet(key) {
        if (!this.config || !this.config.special) {
            return null;
        }
        const entry = this.config.special[key];
        if (!entry || !Array.isArray(entry.tracks) || entry.tracks.length === 0) {
            return null;
        }
        return this.normalizeSet({
            id: `__special_${key}__`,
            tracks: entry.tracks.slice(),
            selection: entry.selection || { mode: 'loop' }
        });
    },
    
    resolveRoomSet(roomNumber) {
        if (!this.config || !Array.isArray(this.config.roomSets)) {
            return null;
        }
        
        const explicit = this.config.roomSets.find(set => {
            return set.ranges && set.ranges.some(range => {
                const start = range.start || range.room || 0;
                const end = range.end || start;
                return roomNumber >= start && roomNumber <= end;
            });
        });
        
        if (explicit) {
            return this.normalizeSet(explicit);
        }
        
        // Determine cycle key for fallback consistency
        const fallbackKey = this.getFallbackKey('normal', roomNumber);
        const fallbackSetId = this.randomAssignments.get(fallbackKey) || this.pickRandomFallback('normal');
        if (!fallbackSetId) {
            return null;
        }
        this.randomAssignments.set(fallbackKey, fallbackSetId);
        const set = this.getSetById(fallbackSetId);
        return this.normalizeSet(set);
    },
    
    resolveBossPhase(roomNumber, phaseIndex) {
        if (!this.config || !Array.isArray(this.config.bosses)) {
            return null;
        }
        
        const bossEntry = this.config.bosses.find(boss => {
            if (!Array.isArray(boss.rooms)) return false;
            return boss.rooms.includes(roomNumber);
        });
        
        let normalized = null;
        
        if (bossEntry && bossEntry.phases) {
            const phases = bossEntry.phases;
            let phaseNumber = phaseIndex;
            while (phaseNumber >= 1) {
                const phaseConfig = phases[String(phaseNumber)];
                if (phaseConfig && Array.isArray(phaseConfig.tracks) && phaseConfig.tracks.length > 0) {
                    normalized = this.normalizeSet({
                        id: bossEntry.id || `boss-${roomNumber}`,
                        tracks: phaseConfig.tracks,
                        selection: phaseConfig.selection,
                        loop: phaseConfig.selection?.mode !== 'shuffle'
                    });
                    break;
                }
                phaseNumber--;
            }
        }
        
        if (normalized) {
            return normalized;
        }
        
        const fallbackKey = this.getFallbackKey('boss', roomNumber);
        const fallbackSetId = this.randomAssignments.get(fallbackKey) || this.pickRandomFallback('boss');
        if (!fallbackSetId) return null;
        this.randomAssignments.set(fallbackKey, fallbackSetId);
        const fallbackBoss = this.config.bosses.find(b => (b.id || '').toString() === fallbackSetId);
        if (!fallbackBoss) return null;
        const basePhase = fallbackBoss.phases?.['1'];
        if (!basePhase) return null;
        return this.normalizeSet({
            id: fallbackBoss.id,
            tracks: basePhase.tracks,
            selection: basePhase.selection,
            loop: basePhase.selection?.mode !== 'shuffle'
        });
    },
    
    normalizeSet(setConfig) {
        if (!setConfig) return null;
        
        const tracks = Array.isArray(setConfig.tracks) ? setConfig.tracks.slice() : [];
        if (tracks.length === 0) return null;
        
        const rawSelection = setConfig.selection || { mode: 'loop' };
        const selection = { ...rawSelection };
        const loop = selection.mode !== 'shuffle';
        
        return {
            id: setConfig.id || '__anonymous__',
            tracks,
            selection,
            loop
        };
    },
    
    getSetById(setId) {
        if (!setId || !this.config || !Array.isArray(this.config.roomSets)) {
            return null;
        }
        const set = this.config.roomSets.find(s => s.id === setId);
        return set ? this.normalizeSet(set) : null;
    },
    
    pickRandomFallback(type) {
        const pools = this.config && this.config.fallbackPools;
        if (!pools) return null;
        const pool = pools[type];
        if (!Array.isArray(pool) || pool.length === 0) return null;
        const index = Math.floor(Math.random() * pool.length);
        return pool[index];
    },
    
    getFallbackKey(type, roomNumber) {
        if (type === 'boss') {
            if (roomNumber < 10) return 'boss-pre-10';
            const cycleIndex = Math.floor((roomNumber - 10) / 5);
            return `boss-${cycleIndex}`;
        }
        
        if (roomNumber < 10) {
            return roomNumber <= 4 ? 'normal-opening' : 'normal-preboss';
        }
        
        const cycleIndex = Math.floor((roomNumber - 10) / 5);
        return `normal-${cycleIndex}`;
    }
};


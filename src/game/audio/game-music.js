// GameMusic - content policy facade for Shape Slayer music cues.
// Resolves game context (room number, encounter phase, hub, title) to Engine.Music playlist sets.
// All transport (buffer loading, fade, duck, pause/resume) is delegated to Engine.Music.

const GameMusic = {
    MANIFEST_URL: 'assets/audio/music-config.json',
    lastNonPauseSetId: null,
    lastNonPauseCategory: null,
    randomAssignments: new Map(), // fallback key -> setId

    async setRoom(roomNumber) {
        await Engine.Music.init();
        if (!Engine.Music.initialized) return;

        const resolved = this.resolveRoomSet(roomNumber);
        if (!resolved) {
            console.warn(`[GameMusic] No playlist found for room ${roomNumber}.`);
            return;
        }

        if (resolved.id === Engine.Music.currentSetId && Engine.Music.currentCategory === 'normal') {
            Engine.Music.resumeIfNeeded();
            return;
        }

        await Engine.Music.playSet(resolved, 'normal');
        this.lastNonPauseCategory = 'normal';
        this.lastNonPauseSetId = resolved.id;
    },

    async setEncounterPhase(roomNumber, phaseIndex) {
        await Engine.Music.init();
        if (!Engine.Music.initialized) return;

        const resolved = this.resolveEncounterPhase(roomNumber, phaseIndex);
        if (!resolved) {
            console.warn(`[GameMusic] No encounter playlist resolved for room ${roomNumber} phase ${phaseIndex}.`);
            return;
        }

        if (
            resolved.id === Engine.Music.currentSetId &&
            Engine.Music.currentCategory === 'encounter' &&
            Engine.Music.currentTrack &&
            resolved.loop === Engine.Music.currentLoop
        ) {
            Engine.Music.resumeIfNeeded();
            return;
        }

        await Engine.Music.playSet(resolved, 'encounter');
        this.lastNonPauseCategory = 'encounter';
        this.lastNonPauseSetId = resolved.id;
    },

    async setTitle() {
        await Engine.Music.init();
        if (!Engine.Music.initialized) return;

        const titleSet = this.getSpecialSet('title');
        if (!titleSet) {
            console.warn('[GameMusic] No title playlist defined.');
            return;
        }

        if (Engine.Music.currentCategory === 'title' && Engine.Music.currentSetId === titleSet.id) {
            Engine.Music.resumeIfNeeded();
            return;
        }

        await Engine.Music.playSet(titleSet, 'title');
        this.lastNonPauseCategory = 'title';
        this.lastNonPauseSetId = titleSet.id;
    },

    async setHub() {
        await Engine.Music.init();
        if (!Engine.Music.initialized) return;

        const hubSet = this.getSpecialSet('hub');
        if (!hubSet) {
            console.warn('[GameMusic] No hub playlist defined.');
            return;
        }

        if (Engine.Music.currentCategory === 'hub' && Engine.Music.currentSetId === hubSet.id) {
            Engine.Music.resumeIfNeeded();
            return;
        }

        await Engine.Music.playSet(hubSet, 'hub');
        this.lastNonPauseCategory = 'hub';
        this.lastNonPauseSetId = hubSet.id;
    },

    async playGameOver() {
        await Engine.Music.init();
        if (!Engine.Music.initialized) return;

        const gameOverSet = this.getSpecialSet('gameOver');
        if (!gameOverSet) {
            console.warn('[GameMusic] No game over playlist defined.');
            return;
        }

        if (Engine.Music.currentCategory === 'gameOver' && Engine.Music.currentSetId === gameOverSet.id) {
            Engine.Music.resumeIfNeeded();
            return;
        }

        await Engine.Music.playSet(gameOverSet, 'gameOver');
    },

    async playPauseMenu() {
        await Engine.Music.init();
        if (!Engine.Music.initialized) return;

        const pauseConfig = Engine.Music.config && Engine.Music.config.pauseMenu;
        if (pauseConfig && Array.isArray(pauseConfig.tracks) && pauseConfig.tracks.length > 0) {
            await Engine.Music.pauseCurrentPlayback();
            const pauseSet = this.normalizeSet({
                id: '__pause__',
                tracks: pauseConfig.tracks.slice(),
                selection: pauseConfig.selection || { mode: 'loop' }
            });
            await Engine.Music.playSet(pauseSet, 'pause');
        } else {
            Engine.Music.applyDucking(true);
        }
    },

    async resumeFromPause() {
        await Engine.Music.init();
        if (!Engine.Music.initialized) return false;

        let resumed = false;

        if (Engine.Music.currentCategory === 'pause') {
            await Engine.Music.fadeOutCurrent(Engine.Music.outroFadeSeconds);
        }

        Engine.Music.applyDucking(false);

        if (Engine.Music.pausedTrackInfo) {
            resumed = await Engine.Music.resumePausedTrack();
        }

        return resumed;
    },

    pauseForBackground() {
        if (!Engine.Music.context) return Promise.resolve(false);
        if (Engine.Music.currentCategory === 'pause') {
            return Engine.Music.fadeOutCurrent(Math.min(0.3, Engine.Music.outroFadeSeconds));
        }
        return Engine.Music.pauseCurrentPlayback();
    },

    // Resolution helpers encoding the Shape Slayer music-config.json schema

    resolveRoomSet(roomNumber) {
        const config = Engine.Music.config;
        if (!config || !Array.isArray(config.roomSets)) return null;

        const explicit = config.roomSets.find(set => {
            return set.ranges && set.ranges.some(range => {
                const start = range.start || range.room || 0;
                const end = range.end || start;
                return roomNumber >= start && roomNumber <= end;
            });
        });

        if (explicit) return this.normalizeSet(explicit);

        const fallbackKey = this.getFallbackKey('normal', roomNumber);
        const fallbackSetId = this.randomAssignments.get(fallbackKey) || this.pickRandomFallback('normal');
        if (!fallbackSetId) return null;
        this.randomAssignments.set(fallbackKey, fallbackSetId);
        const set = this.getSetById(fallbackSetId);
        return this.normalizeSet(set);
    },

    resolveEncounterPhase(roomNumber, phaseIndex) {
        const config = Engine.Music.config;
        if (!config || !Array.isArray(config.encounters)) return null;

        const encounterEntry = config.encounters.find(entry => {
            if (!Array.isArray(entry.rooms)) return false;
            return entry.rooms.includes(roomNumber);
        });

        let normalized = null;

        if (encounterEntry && encounterEntry.phases) {
            const phases = encounterEntry.phases;
            let phaseNumber = phaseIndex;
            while (phaseNumber >= 1) {
                const phaseConfig = phases[String(phaseNumber)];
                if (phaseConfig && Array.isArray(phaseConfig.tracks) && phaseConfig.tracks.length > 0) {
                    normalized = this.normalizeSet({
                        id: encounterEntry.id || `encounter-${roomNumber}`,
                        tracks: phaseConfig.tracks,
                        selection: phaseConfig.selection,
                        loop: phaseConfig.selection?.mode !== 'shuffle'
                    });
                    break;
                }
                phaseNumber--;
            }
        }

        if (normalized) return normalized;

        const fallbackKey = this.getFallbackKey('encounter', roomNumber);
        const fallbackSetId = this.randomAssignments.get(fallbackKey) || this.pickRandomFallback('encounter');
        if (!fallbackSetId) return null;
        this.randomAssignments.set(fallbackKey, fallbackSetId);
        const fallbackEncounter = config.encounters.find(entry => (entry.id || '').toString() === fallbackSetId);
        if (!fallbackEncounter) return null;
        const basePhase = fallbackEncounter.phases?.['1'];
        if (!basePhase) return null;
        return this.normalizeSet({
            id: fallbackEncounter.id,
            tracks: basePhase.tracks,
            selection: basePhase.selection,
            loop: basePhase.selection?.mode !== 'shuffle'
        });
    },

    getSpecialSet(key) {
        const config = Engine.Music.config;
        if (!config || !config.special) return null;
        const entry = config.special[key];
        if (!entry || !Array.isArray(entry.tracks) || entry.tracks.length === 0) return null;
        return this.normalizeSet({
            id: `__special_${key}__`,
            tracks: entry.tracks.slice(),
            selection: entry.selection || { mode: 'loop' }
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
        const config = Engine.Music.config;
        if (!setId || !config || !Array.isArray(config.roomSets)) return null;
        const set = config.roomSets.find(s => s.id === setId);
        return set ? this.normalizeSet(set) : null;
    },

    pickRandomFallback(type) {
        const config = Engine.Music.config;
        const pools = config && config.fallbackPools;
        if (!pools) return null;
        const pool = pools[type];
        if (!Array.isArray(pool) || pool.length === 0) return null;
        const index = Math.floor(Math.random() * pool.length);
        return pool[index];
    },

    getFallbackKey(type, roomNumber) {
        if (type === 'encounter') {
            if (roomNumber < 10) return 'encounter-pre-10';
            const cycleIndex = Math.floor((roomNumber - 10) / 10);
            return `encounter-${cycleIndex}`;
        }

        if (roomNumber < 10) {
            return roomNumber <= 4 ? 'normal-opening' : 'normal-pre-event';
        }

        const cycleIndex = Math.floor((roomNumber - 10) / 10);
        return `normal-${cycleIndex}`;
    }
};

// The engine transport is content-agnostic; the game owns the manifest location.
if (typeof Engine !== 'undefined' && Engine.Music && typeof Engine.Music.configure === 'function') {
    Engine.Music.configure({ manifestUrl: GameMusic.MANIFEST_URL });
}

window.GameMusic = GameMusic;

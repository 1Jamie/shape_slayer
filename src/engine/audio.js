/**
 * @typedef {Object} SoundEffectOptions
 * @property {number} [frequency=440] Base oscillator frequency in Hz
 * @property {OscillatorType} [type='sine'] Waveform shape type
 * @property {number} [duration=0.2] Duration in seconds
 * @property {number} [gain=0.5] Peak volume gain scale
 * @property {number} [detune=0] Pitch detune in cents
 * @property {function(AudioParam, number): void} [pitchEnv] Pitch envelope automation callback
 * @property {function(AudioParam, number): void} [gainEnv] Gain envelope automation callback
 *
 * @typedef {Object} AudioBus
 * @property {GainNode} input
 * @property {GainNode} duckGain
 * @property {BiquadFilterNode} filter
 */

const EngineAudio = {
    /** @type {AudioContext|null} */
    context: null,
    /** @type {GainNode|null} */
    masterGain: null,
    /** @type {GainNode|null} */
    musicGain: null,
    /** @type {GainNode|null} */
    musicDuckGain: null,
    /** @type {BiquadFilterNode|null} */
    musicFilter: null,
    /** @type {GainNode|null} */
    sfxGain: null,
    /** @type {AudioBus|null} */
    musicBus: null,
    
    // Settings
    masterVolume: 0.5,
    musicVolume: 0.5,
    sfxVolume: 1.0,
    muted: false,
    targetMasterVolume: 0.5,
    pendingMasterFade: false,
    fadeInDuration: 1.5,
    
    // Sound pool tracking
    /** @type {Array<any>} */
    activeSounds: [],
    maxConcurrentSounds: 32,
    
    // Initialization state
    initialized: false,

    // Injected settings store (set via configure())
    _settingsStore: null,

    /**
     * Inject a settings store adapter; returns this for chaining.
     * @param {{settingsStore?: Object}} [options]
     * @returns {EngineAudio}
     */
    configure(options = {}) {
        if (options.settingsStore) this._settingsStore = options.settingsStore;
        return this;
    },
    
    /**
     * Initialize Web Audio API AudioContext and gain node graph.
     */
    init() {
        if (this.initialized) return;
        
        try {
            // Create audio context (with vendor prefixes for compatibility)
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();
            
            // Create master gain node for volume control
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            this.masterGain.gain.value = 0;
            this.targetMasterVolume = this.masterVolume;
            this.pendingMasterFade = !this.muted;
            
            // Create channel gain nodes
            this.sfxGain = this.context.createGain();
            this.sfxGain.gain.value = this.sfxVolume;
            this.sfxGain.connect(this.masterGain);
            
            this.musicGain = this.context.createGain();
            this.musicGain.gain.value = this.musicVolume;
            
            this.musicDuckGain = this.context.createGain();
            this.musicDuckGain.gain.value = 1.0;
            
            this.musicFilter = this.context.createBiquadFilter();
            this.musicFilter.type = 'lowpass';
            this.musicFilter.frequency.value = 20000;
            this.musicFilter.Q.value = 0.7;
            
            this.musicGain.connect(this.musicDuckGain);
            this.musicDuckGain.connect(this.musicFilter);
            this.musicFilter.connect(this.masterGain);
            
            this.musicBus = {
                input: this.musicGain,
                duckGain: this.musicDuckGain,
                filter: this.musicFilter
            };
            
            // Load saved volume settings
            this.loadSettings();
            this.prepareMasterGain();
            
            this.initialized = true;
            console.log('EngineAudio initialized');
            
            this.tryResumeContext();
            
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('audiocontextresume'));
            }
        } catch (error) {
            console.error('Failed to initialize EngineAudio:', error);
        }
    },
    
    // Ensure audio context is running (required for autoplay policies)
    resume() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume().then(() => {
                this.onContextUnlocked();
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('audiocontextresume'));
                }
            }).catch(error => {
                console.warn('EngineAudio resume failed:', error);
            });
        } else if (this.context && this.context.state === 'running') {
            this.onContextUnlocked();
        }
    },
    
    tryResumeContext() {
        if (!this.context) return;
        this.context.resume().then(() => {
            this.onContextUnlocked();
        }).catch(() => {
            // Autoplay policy prevented unlock; wait for explicit gesture
        });
    },
    
    prepareMasterGain() {
        if (!this.masterGain) return;
        this.targetMasterVolume = this.masterVolume;
        if (this.muted) {
            this.masterGain.gain.value = 0;
            this.pendingMasterFade = false;
        } else if (this.context && this.context.state === 'running') {
            this.masterGain.gain.value = this.masterVolume;
            this.pendingMasterFade = false;
        } else {
            this.masterGain.gain.value = 0;
            this.pendingMasterFade = true;
        }
    },
    
    scheduleMasterFade() {
        if (!this.masterGain || !this.context) return;
        const now = this.context.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(
            this.targetMasterVolume,
            now + Math.max(0.1, this.fadeInDuration)
        );
    },
    
    onContextUnlocked() {
        if (!this.masterGain || !this.context) return;
        if (this.muted) {
            this.pendingMasterFade = false;
            this.masterGain.gain.setValueAtTime(0, this.context.currentTime);
            return;
        }
        
        if (this.pendingMasterFade) {
            this.scheduleMasterFade();
            this.pendingMasterFade = false;
        } else {
            this.masterGain.gain.setValueAtTime(this.targetMasterVolume, this.context.currentTime);
        }
    },
    
    // Load volume settings from injected settings store
    loadSettings() {
        const store = this._settingsStore;
        if (!store) return;

        const savedVolume = store.getAudioVolume();
        const savedMuted = store.getAudioMuted();

        if (savedVolume !== null && savedVolume !== undefined) {
            this.masterVolume = savedVolume;
            this.targetMasterVolume = this.masterVolume;
        }

        if (store.getMusicVolume) {
            const savedMusic = store.getMusicVolume();
            if (savedMusic !== null && savedMusic !== undefined) {
                this.musicVolume = savedMusic;
                if (this.musicGain) {
                    this.musicGain.gain.value = this.musicVolume;
                }
            }
        }

        if (store.getSfxVolume) {
            const savedSfx = store.getSfxVolume();
            if (savedSfx !== null && savedSfx !== undefined) {
                this.sfxVolume = savedSfx;
                if (this.sfxGain) {
                    this.sfxGain.gain.value = this.sfxVolume;
                }
            }
        }

        if (savedMuted !== null && savedMuted !== undefined) {
            this.muted = savedMuted;
            if (this.masterGain && this.muted) {
                this.masterGain.gain.value = 0;
            }
        }
    },
    
    // Save volume settings to injected settings store
    saveSettings() {
        const store = this._settingsStore;
        if (!store) return;
        store.setAudioVolume(this.masterVolume);
        store.setAudioMuted(this.muted);
        if (store.setMusicVolume) {
            store.setMusicVolume(this.musicVolume);
        }
        if (store.setSfxVolume) {
            store.setSfxVolume(this.sfxVolume);
        }
    },
    
    // Set master volume (0-1)
    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.targetMasterVolume = this.masterVolume;
        if (this.masterGain && !this.muted) {
            if (this.context && this.context.state === 'running' && !this.pendingMasterFade) {
                const now = this.context.currentTime;
                this.masterGain.gain.cancelScheduledValues(now);
                this.masterGain.gain.setValueAtTime(this.masterVolume, now);
            }
        }
        this.saveSettings();
    },
    
    // Set music volume (0-1)
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.musicGain) {
            this.musicGain.gain.value = this.musicVolume;
        }
        this.saveSettings();
    },
    
    // Set SFX volume (0-1)
    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        if (this.sfxGain) {
            this.sfxGain.gain.value = this.sfxVolume;
        }
        this.saveSettings();
    },
    
    // Toggle mute
    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
        }
        this.saveSettings();
        return this.muted;
    },
    
    // Set mute state
    setMute(muted) {
        this.muted = muted;
        if (this.masterGain) {
            if (this.muted) {
                this.pendingMasterFade = false;
                if (this.context) {
                    const now = this.context.currentTime;
                    this.masterGain.gain.cancelScheduledValues(now);
                    this.masterGain.gain.setValueAtTime(0, now);
                } else {
                    this.masterGain.gain.value = 0;
                }
            } else {
                this.targetMasterVolume = this.masterVolume;
                if (this.context && this.context.state === 'running') {
                    this.scheduleMasterFade();
                    this.pendingMasterFade = false;
                } else {
                    this.masterGain.gain.value = 0;
                    this.pendingMasterFade = true;
                }
            }
        }
        this.saveSettings();
    },
    
    getMusicBus() {
        if (!this.initialized) {
            this.init();
        }
        return this.musicBus;
    },
    
    connectToSfx(node) {
        if (this.sfxGain) {
            node.connect(this.sfxGain);
        } else if (this.masterGain) {
            node.connect(this.masterGain);
        }
    },
    
    // Dynamic quality tier voice capacity adjustment (HIGH: 32, MEDIUM: 16, LOW: 8)
    setQualityTier(tier) {
        if (tier === 2) this.maxConcurrentSounds = 8;
        else if (tier === 1) this.maxConcurrentSounds = 16;
        else this.maxConcurrentSounds = 32;
    },

    _tickSoundCounts: new Map(),
    _lastTickTime: 0,

    // Clean up finished sounds from active pool without array allocation
    cleanupSounds() {
        if (!this.context) return;
        const now = this.context.currentTime;
        let writeIdx = 0;
        for (let i = 0; i < this.activeSounds.length; i++) {
            if (this.activeSounds[i].endTime > now) {
                this.activeSounds[writeIdx++] = this.activeSounds[i];
            }
        }
        this.activeSounds.length = writeIdx;
    },
    
    // Check if we can play a new sound (pool limiting + Priority Voice Stealing + duplicate throttling)
    canPlaySound(soundId = 'generic', priority = 1, stopFn = null) {
        if (!this.context) return false;
        this.cleanupSounds();
        const now = this.context.currentTime;

        // Same-tick duplicate throttling (max 3 instances per soundId per frame tick)
        const frameWindow = Math.floor(now * 60);
        if (frameWindow !== this._lastTickTime) {
            this._tickSoundCounts.clear();
            this._lastTickTime = frameWindow;
        }
        const count = (this._tickSoundCounts.get(soundId) || 0);
        if (count >= 3 && priority < 10) {
            return false;
        }
        this._tickSoundCounts.set(soundId, count + 1);

        if (this.activeSounds.length < this.maxConcurrentSounds) {
            return true;
        }

        // Priority voice stealing: steal oldest voice with lower priority
        let lowestIdx = -1;
        let lowestPriority = priority;
        for (let i = 0; i < this.activeSounds.length; i++) {
            const sound = this.activeSounds[i];
            if (sound.priority < lowestPriority) {
                lowestPriority = sound.priority;
                lowestIdx = i;
            }
        }
        if (lowestIdx !== -1) {
            const victim = this.activeSounds[lowestIdx];
            if (typeof victim.stopFn === 'function') {
                try { victim.stopFn(); } catch (_) {}
            }
            this.activeSounds.splice(lowestIdx, 1);
            return true;
        }
        return false;
    },
    
    // Register a sound in the active pool
    registerSound(endTime, priority = 1, soundId = 'generic', stopFn = null) {
        this.activeSounds.push({ endTime, priority, soundId, stopFn });
    },
    
    // ============================================================================
    // PROCEDURAL SOUND GENERATORS
    // ============================================================================
    
    // Generate a sharp digital beep (basic attacks)
    playBeep(frequency = 440, duration = 0.1, waveType = 'square', volume = 0.3) {
        if (!this.initialized || !this.canPlaySound()) return;
        this.resume();
        
        const now = this.context.currentTime;
        
        // Create oscillator
        const oscillator = this.context.createOscillator();
        oscillator.type = waveType;
        oscillator.frequency.value = frequency;
        
        // Create gain envelope
        const gainNode = this.context.createGain();
        gainNode.gain.value = 0;
        
        // ADSR envelope: sharp attack, quick decay
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volume, now + 0.01); // Attack
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // Decay
        
        // Connect nodes
        oscillator.connect(gainNode);
        this.connectToSfx(gainNode);
        
        // Start and stop
        oscillator.start(now);
        oscillator.stop(now + duration);
        
        this.registerSound(now + duration);
    },
    
    // Generate a frequency sweep (charges, abilities)
    playSweep(startFreq = 200, endFreq = 800, duration = 0.3, waveType = 'sawtooth', volume = 0.25) {
        if (!this.initialized || !this.canPlaySound()) return;
        this.resume();
        
        const now = this.context.currentTime;
        
        // Create oscillator
        const oscillator = this.context.createOscillator();
        oscillator.type = waveType;
        oscillator.frequency.setValueAtTime(startFreq, now);
        oscillator.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
        
        // Create gain envelope
        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        // Connect nodes
        oscillator.connect(gainNode);
        this.connectToSfx(gainNode);
        
        // Start and stop
        oscillator.start(now);
        oscillator.stop(now + duration);
        
        this.registerSound(now + duration);
    },
    
    // Generate a sharp impact sound (hits)
    playImpact(intensity = 1.0, pitch = 1.0) {
        if (!this.initialized || !this.canPlaySound()) return;
        this.resume();
        
        const now = this.context.currentTime;
        const duration = 0.12 * intensity;
        const volume = 0.4 * Math.min(intensity, 1.5);
        
        // Create punchy impact with frequency sweep and noise
        const frequencies = [60, 120, 200, 350].map(f => f * pitch);
        
        frequencies.forEach((freq, index) => {
            const oscillator = this.context.createOscillator();
            oscillator.type = index < 2 ? 'triangle' : 'square'; // Mix of waveforms
            // Pitch drop for impact feel
            oscillator.frequency.setValueAtTime(freq * 1.5, now);
            oscillator.frequency.exponentialRampToValueAtTime(freq, now + duration * 0.3);
            
            const gainNode = this.context.createGain();
            const volMult = 1.0 / (index * 0.5 + 1);
            // Sharper attack, longer decay
            gainNode.gain.setValueAtTime(volume * volMult, now);
            gainNode.gain.setValueAtTime(volume * volMult * 0.7, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
            
            oscillator.connect(gainNode);
            this.connectToSfx(gainNode);
            
            oscillator.start(now);
            oscillator.stop(now + duration);
        });
        
        this.registerSound(now + duration);
    },
    
    // Generate a low-frequency thud (heavy attacks)
    playThud(intensity = 1.0) {
        if (!this.initialized || !this.canPlaySound()) return;
        this.resume();
        
        const now = this.context.currentTime;
        const duration = 0.2 * intensity;
        const volume = 0.45 * Math.min(intensity, 1.5);
        
        // Deep impact with punch
        const oscillator1 = this.context.createOscillator();
        oscillator1.type = 'sine';
        // Pitch drop for heavy feel
        oscillator1.frequency.setValueAtTime(120, now);
        oscillator1.frequency.exponentialRampToValueAtTime(50, now + duration * 0.4);
        
        const oscillator2 = this.context.createOscillator();
        oscillator2.type = 'triangle';
        oscillator2.frequency.setValueAtTime(100, now);
        oscillator2.frequency.exponentialRampToValueAtTime(60, now + duration * 0.3);
        
        // Add high frequency click for attack
        const clickOsc = this.context.createOscillator();
        clickOsc.type = 'square';
        clickOsc.frequency.value = 200;
        
        const clickGain = this.context.createGain();
        clickGain.gain.setValueAtTime(volume * 0.3, now);
        clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.02);
        
        const gainNode = this.context.createGain();
        // Sharp attack for punch
        gainNode.gain.setValueAtTime(volume, now);
        gainNode.gain.setValueAtTime(volume * 0.8, now + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        clickOsc.connect(clickGain);
        
        this.connectToSfx(gainNode);
        this.connectToSfx(clickGain);
        
        oscillator1.start(now);
        oscillator2.start(now);
        clickOsc.start(now);
        oscillator1.stop(now + duration);
        oscillator2.stop(now + duration);
        clickOsc.stop(now + 0.02);
        
        this.registerSound(now + duration);
    },

    // ============================================================================
    // BOOT SEQUENCE AUDIO (engine-owned cinematic signature)
    // ============================================================================

    // The master bus normally fades in over 1.5 s after unlock to avoid pops.
    // Boot cues are the first thing the engine plays; letting them ride a
    // half-open master bus is why they sound thin. Snap straight to target.
    _snapBootLevel() {
        if (!this.masterGain || !this.context || this.muted) return;
        this.pendingMasterFade = false;
        const now = this.context.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.targetMasterVolume, now);
    },

    // Soft-clip saturation for the boot low end. Pure sub sine below ~60 Hz is
    // inaudible on most real speakers; tanh saturation generates harmonics so
    // the weight survives laptops and phones while headphones keep the sub.
    _bootSaturator() {
        const ctx = this.context;
        if (typeof ctx.createWaveShaper !== 'function') return null;
        const shaper = ctx.createWaveShaper();
        const curve = new Float32Array(257);
        for (let i = 0; i < 257; i++) {
            const x = i / 128 - 1;
            curve[i] = Math.tanh(2.6 * x);
        }
        shaper.curve = curve;
        shaper.oversample = '2x';
        return shaper;
    },

    // Deterministic noise buffer shared by the boot rumble and impact debris.
    _bootNoiseBuffer(duration = 0.6) {
        const ctx = this.context;
        if (typeof ctx.createBuffer !== 'function') return null;
        const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let seed = 0x51A9E;
        for (let i = 0; i < data.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            data[i] = (seed / 4294967295) * 2 - 1;
        }
        return buffer;
    },

    // Looming bed under the whole boot sequence: a saturated sub drone with a
    // slow tremolo shudder plus looped ground-noise, swelling into the impact.
    playBootRumble(duration = 2.0) {
        if (!this.initialized || !this.context || !this.canPlaySound()) return false;
        this.resume();
        if (this.context.state !== 'running') return false;
        this._snapBootLevel();

        const ctx = this.context;
        const now = ctx.currentTime;
        const holdSeconds = Math.max(0.5, Number(duration) || 2.0);
        const end = now + holdSeconds;

        const output = ctx.createGain();
        output.gain.setValueAtTime(0.0001, now);
        output.gain.exponentialRampToValueAtTime(0.9, now + holdSeconds * 0.85);
        output.gain.exponentialRampToValueAtTime(0.0001, end + 0.3);
        const saturator = this._bootSaturator();
        if (saturator) {
            saturator.connect(output);
        }
        const lowBus = saturator || output;
        this.connectToSfx(output);

        // Sub drone that slowly climbs — the "something is coming" note.
        const drone = ctx.createOscillator();
        const droneGain = ctx.createGain();
        drone.type = 'sine';
        drone.frequency.setValueAtTime(41, now);
        drone.frequency.exponentialRampToValueAtTime(55, end);
        droneGain.gain.value = 0.55;
        drone.connect(droneGain);
        droneGain.connect(lowBus);
        drone.start(now);
        drone.stop(end + 0.32);

        // ~6.5 Hz tremolo makes it shudder like load, not hum like a tone.
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 6.5;
        lfoGain.gain.value = 0.22;
        lfo.connect(lfoGain);
        lfoGain.connect(droneGain.gain);
        lfo.start(now);
        lfo.stop(end + 0.32);

        // Looped ground noise through a tight lowpass: broadband rumble body.
        const buffer = this._bootNoiseBuffer(0.9);
        if (buffer && typeof ctx.createBufferSource === 'function') {
            const source = ctx.createBufferSource();
            const lowpass = ctx.createBiquadFilter();
            const noiseGain = ctx.createGain();
            source.buffer = buffer;
            source.loop = true;
            source.playbackRate.value = 0.5;
            lowpass.type = 'lowpass';
            lowpass.frequency.setValueAtTime(85, now);
            lowpass.frequency.exponentialRampToValueAtTime(150, end);
            lowpass.Q.value = 1.2;
            noiseGain.gain.value = 0.85;
            source.connect(lowpass);
            lowpass.connect(noiseGain);
            noiseGain.connect(lowBus);
            source.start(now);
            source.stop(end + 0.32);
        }

        this.registerSound(end + 0.32);
        return true;
    },

    // Shape Engine boot signature: four raw tones converge into one gravity
    // well. This is deliberately restrained so the collision has headroom.
    playBootCharge(duration = 0.78) {
        if (!this.initialized || !this.context || !this.canPlaySound()) return false;
        this.resume();
        if (this.context.state !== 'running') return false;
        this._snapBootLevel();

        const ctx = this.context;
        const now = ctx.currentTime;
        const end = now + Math.max(0.2, duration);
        const bus = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        bus.gain.setValueAtTime(0.0001, now);
        bus.gain.exponentialRampToValueAtTime(0.16, now + duration * 0.7);
        bus.gain.exponentialRampToValueAtTime(0.0001, end);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, now);
        filter.frequency.exponentialRampToValueAtTime(1800, end);
        filter.Q.value = 1.4;
        bus.connect(filter);
        this.connectToSfx(filter);

        // Four inharmonic primitives collapse toward a common pitch.
        [73, 103, 151, 211].forEach((frequency, index) => {
            const oscillator = ctx.createOscillator();
            const voice = ctx.createGain();
            oscillator.type = index < 2 ? 'sine' : 'triangle';
            oscillator.frequency.setValueAtTime(frequency, now);
            oscillator.frequency.exponentialRampToValueAtTime(420, end);
            voice.gain.value = index < 2 ? 0.34 : 0.16;
            oscillator.connect(voice);
            voice.connect(bus);
            oscillator.start(now);
            oscillator.stop(end + 0.02);
        });

        // Low pressure bed: felt more than heard as the gravity well builds.
        const pressure = ctx.createOscillator();
        const pressureGain = ctx.createGain();
        pressure.type = 'sine';
        pressure.frequency.setValueAtTime(38, now);
        pressure.frequency.exponentialRampToValueAtTime(64, end);
        pressureGain.gain.setValueAtTime(0.0001, now);
        pressureGain.gain.exponentialRampToValueAtTime(0.32, now + duration * 0.72);
        pressureGain.gain.exponentialRampToValueAtTime(0.0001, end);
        pressure.connect(pressureGain);
        pressureGain.connect(bus);
        pressure.start(now);
        pressure.stop(end + 0.02);

        this.registerSound(end + 0.02);
        return true;
    },

    // Purpose-built cinematic collision. The layers each have one job:
    // transient crack, chest-frequency body, sub drop, debris blast, and a
    // short geometric resonance tail. A compressor glues them together
    // without flattening the initial punch.
    playBootImpact(intensity = 1.0) {
        if (!this.initialized || !this.context || !this.canPlaySound()) return false;
        this.resume();
        if (this.context.state !== 'running') return false;
        this._snapBootLevel();

        const ctx = this.context;
        const now = ctx.currentTime;
        const amount = Math.max(0.25, Math.min(1.35, Number(intensity) || 1));
        const output = ctx.createGain();
        output.gain.value = 1.0 * amount;

        let destination = output;
        if (typeof ctx.createDynamicsCompressor === 'function') {
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.value = -12;
            compressor.knee.value = 8;
            compressor.ratio.value = 4;
            compressor.attack.value = 0.004;
            compressor.release.value = 0.28;
            output.connect(compressor);
            destination = compressor;
        }
        this.connectToSfx(destination);

        // All low layers run through tanh saturation: the added harmonics are
        // what make the hit read as mass on speakers that cannot move 30 Hz.
        const saturator = this._bootSaturator();
        if (saturator) saturator.connect(output);
        const lowBus = saturator || output;

        const tone = (options) => {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            const at = now + (options.delay || 0);
            oscillator.type = options.type || 'sine';
            oscillator.frequency.setValueAtTime(options.from, at);
            oscillator.frequency.exponentialRampToValueAtTime(options.to, at + options.duration);
            if (options.delay) {
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.setValueAtTime(0.0001, at);
                gain.gain.exponentialRampToValueAtTime(options.gain * amount, at + 0.012);
            } else {
                gain.gain.setValueAtTime(options.gain * amount, at);
            }
            gain.gain.exponentialRampToValueAtTime(0.0001, at + options.duration);
            oscillator.connect(gain);
            gain.connect(options.low ? lowBus : output);
            oscillator.start(at);
            oscillator.stop(at + options.duration + 0.02);
        };

        // Primary slam: sub drop plus a mid-bass body layer, both saturated.
        tone({ from: 130, to: 36, duration: 0.85, gain: 1.15, type: 'sine', low: true });
        tone({ from: 260, to: 58, duration: 0.4, gain: 0.55, type: 'triangle', low: true });

        // Delayed sub aftershock: displaced mass settling after the collision.
        tone({ from: 74, to: 30, duration: 0.95, gain: 0.85, type: 'sine', low: true, delay: 0.05 });

        // Deterministic noise gives the impact a physical crack and irregular
        // debris instead of another stack of synthetic beeps.
        const noise = this._bootNoiseBuffer(0.6);
        if (noise && typeof ctx.createBufferSource === 'function') {
            const shaped = (options) => {
                const source = ctx.createBufferSource();
                const filter = ctx.createBiquadFilter();
                const gain = ctx.createGain();
                source.buffer = noise;
                if (options.rate) source.playbackRate.value = options.rate;
                filter.type = options.filterType;
                filter.frequency.setValueAtTime(options.from, now);
                if (options.to) {
                    filter.frequency.exponentialRampToValueAtTime(options.to, now + options.duration);
                }
                filter.Q.value = options.q || 0.8;
                gain.gain.setValueAtTime(options.gain * amount, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
                source.connect(filter);
                filter.connect(gain);
                gain.connect(options.low ? lowBus : output);
                source.start(now);
                source.stop(now + options.duration + 0.02);
            };

            // Debris blast sweeping down as fragments disperse.
            shaped({ filterType: 'lowpass', from: 5200, to: 380, duration: 0.5, gain: 0.85 });

            // Long saturated ground-rumble tail carrying the low end out.
            const rumbleFilter = { filterType: 'lowpass', from: 170, to: 48, duration: 1.15, gain: 0.9, rate: 0.5, q: 1.2, low: true };
            shaped(rumbleFilter);

            // 18 ms high-passed crack keeps the frame-perfect transient on top.
            shaped({ filterType: 'highpass', from: 2400, duration: 0.02, gain: 0.8 });
        }

        // Four short, non-musical resonances imply shattered geometry without
        // turning the completion into a cheerful UI chime.
        [317, 461, 673, 887].forEach((frequency, index) => {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            const duration = 0.16 + index * 0.035;
            oscillator.type = index % 2 ? 'triangle' : 'sine';
            oscillator.frequency.setValueAtTime(frequency, now);
            oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, now + duration);
            gain.gain.setValueAtTime((0.11 / (index + 1)) * amount, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            oscillator.connect(gain);
            gain.connect(output);
            oscillator.start(now);
            oscillator.stop(now + duration + 0.02);
        });

        this.registerSound(now + 1.2);
        return true;
    },
    
    // Generate a whoosh sound (dodges, dashes)
    playWhoosh(duration = 0.2, pitch = 1.0, volume = 0.3) {
        if (!this.initialized || !this.canPlaySound()) return;
        this.resume();
        
        const now = this.context.currentTime;
        
        // Higher pitched, rising sweep for energetic feeling
        const oscillator = this.context.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400 * pitch, now); // Higher start
        oscillator.frequency.exponentialRampToValueAtTime(1200 * pitch, now + duration * 0.3); // Rise up
        oscillator.frequency.exponentialRampToValueAtTime(600 * pitch, now + duration); // Gentle fall
        
        // Filter for whoosh character with higher range
        const filter = this.context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, now); // Higher filter
        filter.frequency.exponentialRampToValueAtTime(800, now + duration);
        filter.Q.value = 2.0; // More resonance
        
        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volume, now + duration * 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        this.connectToSfx(gainNode);
        
        oscillator.start(now);
        oscillator.stop(now + duration);
        
        this.registerSound(now + duration);
    },
    
    // Generate an explosion sound (AoE, explosions)
    playExplosion(intensity = 1.0) {
        if (!this.initialized || !this.canPlaySound()) return;
        this.resume();
        
        const now = this.context.currentTime;
        const duration = 0.3 * intensity;
        const volume = 0.45 * Math.min(intensity, 1.5);
        
        // Multi-frequency burst with punch
        const frequencies = [50, 80, 140, 220, 400];
        
        frequencies.forEach((freq, index) => {
            const oscillator = this.context.createOscillator();
            oscillator.type = index < 2 ? 'sine' : 'square';
            // Pitch drop for explosion feel
            oscillator.frequency.setValueAtTime(freq * 1.8, now);
            oscillator.frequency.exponentialRampToValueAtTime(freq * 0.5, now + duration);
            
            const gainNode = this.context.createGain();
            const volMult = 1.0 / (index * 0.5 + 1);
            // Sharp attack for impact
            gainNode.gain.setValueAtTime(volume * volMult, now);
            gainNode.gain.setValueAtTime(volume * volMult * 0.8, now + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
            
            oscillator.connect(gainNode);
            this.connectToSfx(gainNode);
            
            oscillator.start(now);
            oscillator.stop(now + duration);
        });
        
        this.registerSound(now + duration);
    },
    
    // Generate an electrical zap (lightning, magic)
    playZap(duration = 0.08, pitch = 1.0, volume = 0.3) {
        if (!this.initialized || !this.canPlaySound()) return;
        this.resume();
        
        const now = this.context.currentTime;
        
        // High-frequency crackle
        const oscillator = this.context.createOscillator();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800 * pitch, now);
        oscillator.frequency.exponentialRampToValueAtTime(200 * pitch, now + duration);
        
        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        oscillator.connect(gainNode);
        this.connectToSfx(gainNode);
        
        oscillator.start(now);
        oscillator.stop(now + duration);
        
        this.registerSound(now + duration);
    },
    
    // Generate rhythmic pulses (whirlwind, shield)
    playPulse(frequency = 220, pulses = 4, pulseDuration = 0.05, gapDuration = 0.05, volume = 0.25) {
        if (!this.initialized || !this.canPlaySound()) return;
        this.resume();
        
        const now = this.context.currentTime;
        const totalDuration = pulses * (pulseDuration + gapDuration);
        
        for (let i = 0; i < pulses; i++) {
            const startTime = now + i * (pulseDuration + gapDuration);
            
            const oscillator = this.context.createOscillator();
            oscillator.type = 'square';
            oscillator.frequency.value = frequency;
            
            const gainNode = this.context.createGain();
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
            gainNode.gain.setValueAtTime(volume, startTime + pulseDuration - 0.01);
            gainNode.gain.linearRampToValueAtTime(0, startTime + pulseDuration);
            
            oscillator.connect(gainNode);
            this.connectToSfx(gainNode);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + pulseDuration);
        }
        
        this.registerSound(now + totalDuration);
    },
    
    // Generate a chime (UI sounds, pickups)
    playChime(baseFreq = 523, duration = 0.3, volume = 0.25) {
        if (!this.initialized || !this.canPlaySound()) return;
        this.resume();
        
        const now = this.context.currentTime;
        
        // Harmonious tones
        const frequencies = [baseFreq, baseFreq * 1.5, baseFreq * 2];
        
        frequencies.forEach((freq, index) => {
            const oscillator = this.context.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = freq;
            
            const gainNode = this.context.createGain();
            const volMult = 1.0 / (index + 1);
            gainNode.gain.setValueAtTime(volume * volMult, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
            
            oscillator.connect(gainNode);
            this.connectToSfx(gainNode);
            
            oscillator.start(now + index * 0.05);
            oscillator.stop(now + duration + index * 0.05);
        });
        
        this.registerSound(now + duration + 0.1);
    }
};

// Initialize / unlock on first user interaction (required for autoplay policies)
function unlockAudioContext() {
    if (!EngineAudio.initialized) {
        EngineAudio.init();
    } else {
        EngineAudio.resume();
    }
}

['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(eventType => {
    window.addEventListener(eventType, unlockAudioContext, { once: true });
});

window.addEventListener('keydown', () => {
    unlockAudioContext();
}, { once: true });

window.Engine = window.Engine || {};
window.Engine.Audio = EngineAudio;

// Also try to initialize immediately (will work if autoplay is allowed)
if (document.readyState === 'complete') {
    EngineAudio.init();
} else {
    window.addEventListener('load', () => EngineAudio.init());
}

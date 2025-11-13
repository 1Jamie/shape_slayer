// Audio Manager - Procedural sound generation using Web Audio API
// Generates all game sounds procedurally to match mathematical/geometric aesthetic

const AudioManager = {
    // Core audio context
    context: null,
    masterGain: null,
    musicGain: null,
    musicDuckGain: null,
    musicFilter: null,
    sfxGain: null,
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
    activeSounds: [],
    maxConcurrentSounds: 32,
    
    // Initialization state
    initialized: false,
    
    // Initialize audio context and master gain
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
            console.log('AudioManager initialized');
            
            this.tryResumeContext();
            
            if (typeof Game !== 'undefined' && Game && typeof Game.updateMusicForCurrentRoom === 'function') {
                Game.updateMusicForCurrentRoom();
            }
        } catch (error) {
            console.error('Failed to initialize AudioManager:', error);
        }
    },
    
    // Ensure audio context is running (required for autoplay policies)
    resume() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume().then(() => {
                this.onContextUnlocked();
                if (typeof Game !== 'undefined' && Game && typeof Game.updateMusicForCurrentRoom === 'function') {
                    Game.updateMusicForCurrentRoom();
                }
            }).catch(error => {
                console.warn('AudioManager resume failed:', error);
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
    
    // Load volume settings from save system
    loadSettings() {
        if (typeof SaveSystem !== 'undefined') {
            const savedVolume = SaveSystem.getAudioVolume();
            const savedMuted = SaveSystem.getAudioMuted();
            
            if (savedVolume !== null && savedVolume !== undefined) {
                this.masterVolume = savedVolume;
                this.targetMasterVolume = this.masterVolume;
            }
            
            if (SaveSystem.getMusicVolume) {
                const savedMusic = SaveSystem.getMusicVolume();
                if (savedMusic !== null && savedMusic !== undefined) {
                    this.musicVolume = savedMusic;
                    if (this.musicGain) {
                        this.musicGain.gain.value = this.musicVolume;
                    }
                }
            }
            
            if (SaveSystem.getSfxVolume) {
                const savedSfx = SaveSystem.getSfxVolume();
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
        }
    },
    
    // Save volume settings
    saveSettings() {
        if (typeof SaveSystem !== 'undefined') {
            SaveSystem.setAudioVolume(this.masterVolume);
            SaveSystem.setAudioMuted(this.muted);
            if (SaveSystem.setMusicVolume) {
                SaveSystem.setMusicVolume(this.musicVolume);
            }
            if (SaveSystem.setSfxVolume) {
                SaveSystem.setSfxVolume(this.sfxVolume);
            }
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
    
    // Clean up finished sounds from active pool
    cleanupSounds() {
        const now = this.context.currentTime;
        this.activeSounds = this.activeSounds.filter(sound => sound.endTime > now);
    },
    
    // Check if we can play a new sound (pool limiting)
    canPlaySound() {
        this.cleanupSounds();
        return this.activeSounds.length < this.maxConcurrentSounds;
    },
    
    // Register a sound in the active pool
    registerSound(endTime) {
        this.activeSounds.push({ endTime });
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
    },
    
    // ============================================================================
    // HIGH-LEVEL SOUND EFFECTS
    // ============================================================================
    
    // Player attack sounds
    sounds: {
        // Warrior sounds
        warriorBasicAttack() {
            // Melee swing with impact
            AudioManager.playBeep(180, 0.06, 'square', 0.2);
            AudioManager.playImpact(0.7, 1.0);
        },
        
        warriorHeavyAttack() {
            AudioManager.playSweep(180, 400, 0.25, 'sawtooth', 0.3);
            setTimeout(() => AudioManager.playThud(1.4), 250);
        },
        
        warriorWhirlwindStart() {
            AudioManager.playSweep(200, 600, 0.3, 'square', 0.3);
        },
        
        warriorWhirlwindHit() {
            AudioManager.playPulse(330, 1, 0.04, 0, 0.2);
        },
        
        // Rogue sounds
        rogueBasicAttack() {
            AudioManager.playZap(0.06, 1.5, 0.25);
        },
        
        rogueHeavyAttack() {
            // Fan of knives - multiple quick zaps
            for (let i = 0; i < 7; i++) {
                setTimeout(() => {
                    AudioManager.playZap(0.05, 1.3 + i * 0.1, 0.2);
                }, i * 20);
            }
        },
        
        rogueShadowClones() {
            AudioManager.playSweep(400, 200, 0.2, 'triangle', 0.25);
            setTimeout(() => AudioManager.playBeep(300, 0.1, 'triangle', 0.2), 100);
        },
        
        rogueDodge() {
            AudioManager.playWhoosh(0.18, 1.8, 0.3);
            AudioManager.playZap(0.05, 2.5, 0.18);
        },
        
        // Tank sounds
        tankBasicAttack() {
            // Heavy hammer swing with big impact
            AudioManager.playThud(1.2);
            setTimeout(() => AudioManager.playImpact(1.1, 0.8), 15);
        },
        
        tankHeavyAttack() {
            AudioManager.playExplosion(1.8);
            setTimeout(() => AudioManager.playThud(1.5), 50);
            AudioManager.playSweep(100, 50, 0.4, 'sine', 0.3);
        },
        
        tankShieldStart() {
            AudioManager.playBeep(150, 0.2, 'sine', 0.25);
        },
        
        tankShieldHit() {
            AudioManager.playImpact(0.8, 0.8);
        },
        
        // Mage sounds
        mageBasicAttack() {
            AudioManager.playZap(0.08, 1.2, 0.25);
        },
        
        mageHeavyAttackStart() {
            AudioManager.playSweep(300, 500, 0.3, 'sine', 0.25);
        },
        
        mageHeavyAttackBeam() {
            AudioManager.playBeep(450, 0.5, 'sine', 0.2);
        },
        
        mageBlink() {
            AudioManager.playSweep(600, 300, 0.15, 'sine', 0.25);
            setTimeout(() => AudioManager.playBeep(400, 0.05, 'sine', 0.2), 150);
        },
        
        // Generic dodge
        dodge() {
            AudioManager.playWhoosh(0.2, 1.2, 0.28);
        },
        
        // Impact sounds
        hitNormal(intensity = 1.0) {
            AudioManager.playImpact(intensity * 0.9, 1.0);
        },
        
        hitCritical(intensity = 1.0) {
            AudioManager.playImpact(intensity * 1.1, 1.3);
            AudioManager.playBeep(660, 0.05, 'square', 0.25);
        },
        
        hitBackstab(intensity = 1.0) {
            AudioManager.playImpact(intensity * 0.85, 1.5);
        },
        
        hitWeakPoint(intensity = 1.0) {
            AudioManager.playImpact(intensity * 1.3, 0.9);
            AudioManager.playChime(400, 0.15, 0.25);
        },
        
        enemyDeath() {
            AudioManager.playSweep(300, 100, 0.2, 'square', 0.2);
        },
        
        // Enemy sounds
        enemyLunge() {
            AudioManager.playBeep(180, 0.08, 'triangle', 0.2);
            setTimeout(() => AudioManager.playImpact(0.5, 1.0), 50);
        },
        
        enemyDash() {
            AudioManager.playWhoosh(0.15, 1.1, 0.22);
        },
        
        enemySlam() {
            AudioManager.playThud(1.5);
            setTimeout(() => AudioManager.playImpact(1.2, 0.7), 30);
        },
        
        enemyShoot() {
            AudioManager.playZap(0.06, 1.1, 0.2);
        },
        
        // Projectile sounds
        projectileSpawn() {
            AudioManager.playBeep(350, 0.04, 'sine', 0.15);
        },
        
        projectileHit() {
            AudioManager.playImpact(0.75, 1.2);
        },
        
        // UI sounds
        gearPickup() {
            AudioManager.playChime(523, 0.25, 0.25);
        },
        
        levelUp() {
            AudioManager.playChime(440, 0.15, 0.2);
            setTimeout(() => AudioManager.playChime(554, 0.15, 0.2), 80);
            setTimeout(() => AudioManager.playChime(659, 0.2, 0.25), 160);
        },
        
        doorOpen() {
            AudioManager.playSweep(200, 400, 0.4, 'sine', 0.25);
        },
        
        bossSpawn() {
            AudioManager.playSweep(100, 300, 0.5, 'sawtooth', 0.3);
            setTimeout(() => AudioManager.playExplosion(1.2), 300);
        },
        
        playerDeath() {
            AudioManager.playSweep(400, 100, 0.6, 'triangle', 0.3);
        }
    }
};

// Initialize / unlock on first user interaction (required for autoplay policies)
function unlockAudioContext() {
    if (!AudioManager.initialized) {
        AudioManager.init();
    } else {
        AudioManager.resume();
    }
}

['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(eventType => {
    window.addEventListener(eventType, unlockAudioContext, { once: true });
});

window.addEventListener('keydown', () => {
    unlockAudioContext();
}, { once: true });

// Also try to initialize immediately (will work if autoplay is allowed)
if (document.readyState === 'complete') {
    AudioManager.init();
} else {
    window.addEventListener('load', () => AudioManager.init());
}


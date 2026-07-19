(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const audio = () => Engine.Audio;

    const GameAudio = {
        // Wire SaveSystem when available
        bindSettings() {
            if (!Engine.Audio) return;
            Engine.Audio.configure({
                settingsStore: {
                    getAudioVolume: () => (typeof SaveSystem !== 'undefined' ? SaveSystem.getAudioVolume() : null),
                    getAudioMuted: () => (typeof SaveSystem !== 'undefined' ? SaveSystem.getAudioMuted() : null),
                    getMusicVolume: () => (typeof SaveSystem !== 'undefined' && SaveSystem.getMusicVolume ? SaveSystem.getMusicVolume() : null),
                    getSfxVolume: () => (typeof SaveSystem !== 'undefined' && SaveSystem.getSfxVolume ? SaveSystem.getSfxVolume() : null),
                    setAudioVolume: (v) => { if (typeof SaveSystem !== 'undefined') SaveSystem.setAudioVolume(v); },
                    setAudioMuted: (v) => { if (typeof SaveSystem !== 'undefined') SaveSystem.setAudioMuted(v); },
                    setMusicVolume: (v) => { if (typeof SaveSystem !== 'undefined' && SaveSystem.setMusicVolume) SaveSystem.setMusicVolume(v); },
                    setSfxVolume: (v) => { if (typeof SaveSystem !== 'undefined' && SaveSystem.setSfxVolume) SaveSystem.setSfxVolume(v); }
                }
            });
            if (typeof Engine.Audio.loadSettings === 'function') Engine.Audio.loadSettings();
        },

        sounds: {
            // Warrior sounds
            warriorBasicAttack() {
                audio().playBeep(180, 0.06, 'square', 0.2);
                audio().playImpact(0.7, 1.0);
            },

            warriorHeavyAttack() {
                audio().playSweep(180, 400, 0.25, 'sawtooth', 0.3);
                setTimeout(() => audio().playThud(1.4), 250);
            },

            warriorWhirlwindStart() {
                audio().playSweep(200, 600, 0.3, 'square', 0.3);
            },

            warriorWhirlwindHit() {
                audio().playPulse(330, 1, 0.04, 0, 0.2);
            },

            // Rogue sounds
            rogueBasicAttack() {
                audio().playZap(0.06, 1.5, 0.25);
            },

            rogueHeavyAttack() {
                for (let i = 0; i < 7; i++) {
                    setTimeout(() => {
                        audio().playZap(0.05, 1.3 + i * 0.1, 0.2);
                    }, i * 20);
                }
            },

            rogueShadowClones() {
                audio().playSweep(400, 200, 0.2, 'triangle', 0.25);
                setTimeout(() => audio().playBeep(300, 0.1, 'triangle', 0.2), 100);
            },

            rogueDodge() {
                audio().playWhoosh(0.18, 1.8, 0.3);
                audio().playZap(0.05, 2.5, 0.18);
            },

            // Tank sounds
            tankBasicAttack() {
                audio().playThud(1.2);
                setTimeout(() => audio().playImpact(1.1, 0.8), 15);
            },

            tankHeavyAttack() {
                audio().playExplosion(1.8);
                setTimeout(() => audio().playThud(1.5), 50);
                audio().playSweep(100, 50, 0.4, 'sine', 0.3);
            },

            tankShieldStart() {
                audio().playBeep(150, 0.2, 'sine', 0.25);
            },

            tankShieldHit() {
                audio().playImpact(0.8, 0.8);
            },

            // Mage sounds
            mageBasicAttack() {
                audio().playZap(0.08, 1.2, 0.25);
            },

            mageHeavyAttackStart() {
                audio().playSweep(300, 500, 0.3, 'sine', 0.25);
            },

            mageHeavyAttackBeam() {
                audio().playBeep(450, 0.5, 'sine', 0.2);
            },

            mageBlink() {
                audio().playSweep(600, 300, 0.15, 'sine', 0.25);
                setTimeout(() => audio().playBeep(400, 0.05, 'sine', 0.2), 150);
            },

            // Generic dodge
            dodge() {
                audio().playWhoosh(0.2, 1.2, 0.28);
            },

            // Impact sounds
            hitNormal(intensity = 1.0) {
                audio().playImpact(intensity * 0.9, 1.0);
            },

            hitCritical(intensity = 1.0) {
                audio().playImpact(intensity * 1.1, 1.3);
                audio().playBeep(660, 0.05, 'square', 0.25);
            },

            hitBackstab(intensity = 1.0) {
                audio().playImpact(intensity * 0.85, 1.5);
            },

            hitWeakPoint(intensity = 1.0) {
                audio().playImpact(intensity * 1.3, 0.9);
                audio().playChime(400, 0.15, 0.25);
            },

            enemyDeath() {
                audio().playSweep(300, 100, 0.2, 'square', 0.2);
            },

            // Enemy sounds
            enemyLunge() {
                audio().playBeep(180, 0.08, 'triangle', 0.2);
                setTimeout(() => audio().playImpact(0.5, 1.0), 50);
            },

            enemyDash() {
                audio().playWhoosh(0.15, 1.1, 0.22);
            },

            enemySlam() {
                audio().playThud(1.5);
                setTimeout(() => audio().playImpact(1.2, 0.7), 30);
            },

            enemyShoot() {
                audio().playZap(0.06, 1.1, 0.2);
            },

            // Projectile sounds
            projectileSpawn() {
                audio().playBeep(350, 0.04, 'sine', 0.15);
            },

            projectileHit() {
                audio().playImpact(0.75, 1.2);
            },

            // UI sounds
            pickupChime() {
                audio().playChime(523, 0.25, 0.25);
            },

            levelUp() {
                audio().playChime(440, 0.15, 0.2);
                setTimeout(() => audio().playChime(554, 0.15, 0.2), 80);
                setTimeout(() => audio().playChime(659, 0.2, 0.25), 160);
            },

            doorOpen() {
                audio().playSweep(200, 400, 0.4, 'sine', 0.25);
            },

            majorSpawn() {
                audio().playSweep(100, 300, 0.5, 'sawtooth', 0.3);
                setTimeout(() => audio().playExplosion(1.2), 300);
            },

            swarmPheromoneWindup() {
                audio().playSweep(160, 520, 0.58, 'triangle', 0.18);
                setTimeout(() => audio().playBeep(260, 0.04, 'square', 0.11), 80);
                setTimeout(() => audio().playBeep(340, 0.04, 'square', 0.12), 210);
                setTimeout(() => audio().playBeep(460, 0.05, 'square', 0.13), 360);
            },

            vortexInhale() {
                audio().playSweep(70, 180, 1.2, 'sawtooth', 0.28);
                setTimeout(() => audio().playBeep(110, 0.18, 'sine', 0.16), 450);
            },

            vortexPolarityBurst() {
                audio().playBeep(740, 0.05, 'square', 0.25);
                audio().playSweep(520, 120, 0.45, 'sine', 0.24);
                setTimeout(() => audio().playExplosion(0.7), 25);
            },

            vortexOrbitBlades() {
                audio().playSweep(260, 420, 0.32, 'triangle', 0.22);
                setTimeout(() => audio().playBeep(330, 0.08, 'triangle', 0.18), 110);
                setTimeout(() => audio().playBeep(390, 0.08, 'triangle', 0.18), 220);
            },

            vortexSpiralGate() {
                audio().playZap(0.07, 0.75, 0.16);
            },

            vortexWells() {
                audio().playSweep(140, 220, 0.7, 'sine', 0.18);
            },

            vortexEventHorizon() {
                audio().playSweep(45, 70, 0.5, 'sine', 0.16);
                setTimeout(() => audio().playSweep(80, 260, 0.8, 'sawtooth', 0.28), 500);
            },

            vortexFinaleStep() {
                audio().playImpact(0.6, 0.65);
                audio().playBeep(180, 0.05, 'sine', 0.16);
            },

            vortexOverload() {
                audio().playExplosion(1.0);
                audio().playSweep(90, 360, 0.55, 'sawtooth', 0.26);
            },

            vortexRecovery() {
                audio().playSweep(360, 180, 0.28, 'sine', 0.16);
                setTimeout(() => audio().playChime(620, 0.16, 0.16), 80);
            },

            avatarDefeat() {
                audio().playSweep(400, 100, 0.6, 'triangle', 0.3);
            }
        }
    };

    root.GameAudio = GameAudio;

    // Attempt bindSettings immediately if SaveSystem is already loaded
    if (typeof SaveSystem !== 'undefined') {
        GameAudio.bindSettings();
    }
})(typeof window !== 'undefined' ? window : globalThis);

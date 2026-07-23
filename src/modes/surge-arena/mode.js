/**
 * Surge Arena Island — persistent complex + XP/combo wave escalation.
 * Same packages / HUD / combat as Gear; SurgeArenaRules owns WFT pacing.
 */
(function (root) {
    'use strict';

    const SURGE_PACKAGES = (root.ModeProfile && root.ModeProfile.SurgeArena && root.ModeProfile.SurgeArena.packages)
        ? root.ModeProfile.SurgeArena.packages
        : Object.freeze([
            'audio', 'content', 'telegraph', 'entities', 'combat',
            'rooms', 'presentation', 'world'
        ]);

    // Escape / pause must open the host pause menu — not tear down the Island.
    // Exit is only via pause "Return to Nexus" → run:exitRequested / AppHost.endSession.

    function createSession() {
        let _stash = null;
        let _started = false;

        return {
            id: 'surge-arena',
            usesPlayingPipeline: true,
            profile: root.ModeProfile && root.ModeProfile.SurgeArena,

            start(ctx) {
                if (_started) return;
                _started = true;
                const hostWorld = (ctx && ctx.hostWorld) || root.Game;
                if (!hostWorld) {
                    console.error('[Modes.surge-arena] no host world');
                    return;
                }

                if (typeof GameWorld !== 'undefined' && GameWorld.clearPlayingField) {
                    GameWorld.clearPlayingField(hostWorld);
                }

                hostWorld.runSeed = (typeof GameWorld !== 'undefined' && GameWorld.makeRunSeed)
                    ? GameWorld.makeRunSeed('arena')
                    : (`arena-${Date.now()}`);
                hostWorld.waveNumber = 1;
                hostWorld.roomNumber = 1;
                hostWorld.totalXpEarned = 0;
                hostWorld.highestCombo = 0;
                hostWorld.arenaPrevSpawnBudget = 70;
                hostWorld.comboCreditMultiplier = 1;
                hostWorld.comboEnemyOverdrive = false;
                hostWorld.styleEnemyLevel = 0;
                hostWorld.styleDirectorOverdrive = false;
                hostWorld.styleCrashPickups = [];
                hostWorld.styleHealOrbs = [];

                if (typeof GameModeTakeover !== 'undefined' && GameModeTakeover.begin) {
                    _stash = GameModeTakeover.begin({
                        world: hostWorld,
                        sessionId: 'surge-arena',
                        playingIsland: true
                    });
                }

                const profile = root.ModeProfile && root.ModeProfile.SurgeArena;
                const rules = root.SurgeArenaRules;
                if (typeof root.PlayingHost !== 'undefined' && root.PlayingHost.begin) {
                    root.PlayingHost.begin(hostWorld, {
                        profile: profile || {
                            id: 'surge-arena',
                            hud: 'gear',
                            room: { doors: false, advance: false, forceCombat: true, label: 'wave' }
                        },
                        rules,
                        startRun: true
                    });
                } else if (typeof hostWorld._beginRoguelikeRun === 'function') {
                    hostWorld._beginRoguelikeRun();
                }

                const plan = (rules && typeof rules.planInitialWave === 'function')
                    ? rules.planInitialWave(hostWorld)
                    : { spawnBudget: 70, allowedEnemyTiers: ['basic'] };

                if (typeof GameArena !== 'undefined' && GameArena.buildArena) {
                    GameArena.buildArena(hostWorld, 1, plan);
                }

                hostWorld.activeSessionId = 'surge-arena';
                hostWorld.state = 'PLAYING';
                hostWorld.waveNumber = hostWorld.waveNumber || 1;
                hostWorld.roomNumber = hostWorld.waveNumber;
                hostWorld.arenaPhase = 'combat';
            },

            update(dt) {
                const rules = root.SurgeArenaRules;
                if (rules && typeof rules.update === 'function') {
                    rules.update(dt);
                }
            },

            render() {},

            stop() {
                _started = false;
                if (typeof root.PlayingHost !== 'undefined' && root.PlayingHost.end) {
                    root.PlayingHost.end(root.Game);
                }
                if (typeof GameWorld !== 'undefined' && GameWorld.clearPlayingField) {
                    GameWorld.clearPlayingField(root.Game);
                }
                if (root.Game) {
                    root.Game.runSeed = null;
                    root.Game.waveNumber = null;
                    root.Game.comboEnemyOverdrive = false;
                    root.Game.comboCreditMultiplier = 1;
                    root.Game.styleEnemyLevel = 0;
                    root.Game.styleDirectorOverdrive = false;
                    root.Game.styleCrashPickups = [];
                    root.Game.styleHealOrbs = [];
                    if (root.Game.player) {
                        root.Game.player.cooldownRegenMult = 1;
                        root.Game.player.styleMoveSpeedMult = 1;
                        root.Game.player.styleCritBonus = 0;
                        root.Game.player.styleDashIFramesBonus = 0;
                        root.Game.player.styleLifeSteal = 0;
                    }
                    if (typeof Engine !== 'undefined' && Engine.Music && Engine.Music.applyStyleIntensity) {
                        Engine.Music.applyStyleIntensity(0);
                    }
                }
                if (typeof GameModeTakeover !== 'undefined' && GameModeTakeover.end) {
                    GameModeTakeover.end({ world: root.Game, stash: _stash });
                }
                _stash = null;
            }
        };
    }

    root.Modes = root.Modes || {};
    root.Modes['surge-arena'] = {
        id: 'surge-arena',
        packages: SURGE_PACKAGES,
        Rules: root.SurgeArenaRules,
        createSession,
        create() {
            const session = createSession();
            return {
                id: 'surge-arena',
                packages: SURGE_PACKAGES,
                world: null,
                start() {
                    session.start({ hostWorld: root.Game });
                },
                stop() { session.stop(); },
                update(dt) {
                    if (session.update) session.update(dt);
                    if (root.Game && typeof root.Game.update === 'function' && root.Game.state === 'PLAYING') {
                        root.Game.update(dt);
                    }
                },
                render(ctx, alpha) {
                    if (root.Game && typeof root.Game.render === 'function') {
                        root.Game._renderAlpha = Number.isFinite(alpha) ? alpha : 0;
                        root.Game.render();
                    }
                }
            };
        }
    };

    if (typeof GameModeCatalog !== 'undefined' && GameModeCatalog.register) {
        GameModeCatalog.register({
            id: 'surge-arena',
            title: 'Surge Arena',
            shortLabel: 'SURGE',
            portalLabel: 'SURGE ARENA',
            nexusSelectable: true,
            multiplayerOk: true,
            requiresClass: true,
            supportsResume: false,
            contentGameMode: 'gear',
            packages: SURGE_PACKAGES,
            theme: {
                glow: 'rgba(120, 200, 255, ',
                core: 'rgba(140, 210, 255, 0.8)',
                border: '#66aaff',
                light: '#88ccff'
            },
            enterFromPortal(ctx) {
                const inLobby = typeof multiplayerManager !== 'undefined'
                    && multiplayerManager
                    && multiplayerManager.lobbyCode;
                if (inLobby) {
                    if (multiplayerManager.isHost) {
                        multiplayerManager.startGame('surge-arena');
                        if (typeof AppHost !== 'undefined' && AppHost.launchSession) {
                            AppHost.launchSession('surge-arena');
                        }
                    }
                } else {
                    if (typeof AppHost !== 'undefined' && AppHost.launchSession) {
                        AppHost.launchSession('surge-arena');
                    } else if (typeof Game !== 'undefined' && Game) {
                        Game.selectedModeId = 'surge-arena';
                    }
                }
            }
        });
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

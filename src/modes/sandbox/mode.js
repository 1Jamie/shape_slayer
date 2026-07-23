/**
 * Sandbox Island — blank-slate mechanical testing ground.
 * Surge Arena owns the persistent arena complex + wave escalation.
 */
(function (root) {
    'use strict';

    const SANDBOX_PACKAGES = (root.ModeProfile && root.ModeProfile.Sandbox && root.ModeProfile.Sandbox.packages)
        ? root.ModeProfile.Sandbox.packages
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
            id: 'sandbox',
            usesPlayingPipeline: true,
            profile: root.ModeProfile && root.ModeProfile.Sandbox,

            start(ctx) {
                if (_started) return;
                _started = true;
                const hostWorld = (ctx && ctx.hostWorld) || root.Game;
                if (!hostWorld) {
                    console.error('[Modes.sandbox] no host world');
                    return;
                }

                if (typeof GameWorld !== 'undefined' && GameWorld.clearPlayingField) {
                    GameWorld.clearPlayingField(hostWorld);
                }

                if (typeof GameModeTakeover !== 'undefined' && GameModeTakeover.begin) {
                    _stash = GameModeTakeover.begin({
                        world: hostWorld,
                        sessionId: 'sandbox',
                        playingIsland: true
                    });
                }

                const profile = root.ModeProfile && root.ModeProfile.Sandbox;
                const rules = root.SandboxRules;
                if (typeof root.PlayingHost !== 'undefined' && root.PlayingHost.begin) {
                    root.PlayingHost.begin(hostWorld, {
                        profile: profile || { id: 'sandbox', hud: 'gear', room: { doors: false, advance: false } },
                        rules,
                        startRun: true
                    });
                } else if (typeof hostWorld._beginRoguelikeRun === 'function') {
                    hostWorld._beginRoguelikeRun();
                }

                hostWorld.activeSessionId = 'sandbox';
                hostWorld.state = 'PLAYING';
            },

            update(dt) {
                const rules = root.SandboxRules;
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
                if (typeof GameModeTakeover !== 'undefined' && GameModeTakeover.end) {
                    GameModeTakeover.end({ world: root.Game, stash: _stash });
                }
                _stash = null;
            }
        };
    }

    root.Modes = root.Modes || {};
    root.Modes.sandbox = {
        id: 'sandbox',
        packages: SANDBOX_PACKAGES,
        Rules: root.SandboxRules,
        createSession,
        create() {
            const session = createSession();
            return {
                id: 'sandbox',
                packages: SANDBOX_PACKAGES,
                world: null,
                start() { session.start({ hostWorld: root.Game }); },
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

    // Blank-slate sandbox stays launchable via ?mode=sandbox but is not Nexus-selectable.
    if (typeof GameModeCatalog !== 'undefined' && GameModeCatalog.register) {
        GameModeCatalog.register({
            id: 'sandbox',
            title: 'Sandbox',
            shortLabel: 'SANDBOX',
            portalLabel: 'SANDBOX',
            nexusSelectable: false,
            multiplayerOk: false,
            requiresClass: true,
            supportsResume: false,
            contentGameMode: 'gear',
            packages: SANDBOX_PACKAGES,
            theme: {
                glow: 'rgba(160, 160, 160, ',
                core: 'rgba(180, 180, 180, 0.8)',
                border: '#999999',
                light: '#bbbbbb'
            },
            enterFromPortal() {
                if (typeof AppHost !== 'undefined' && AppHost.launchSession) {
                    AppHost.launchSession('sandbox');
                }
            }
        });
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

/**
 * Sandbox Island rules — blank-slate mechanical test bed.
 * Arena / combo / wave escalation live in SurgeArenaRules.
 */
(function (root) {
    'use strict';

    function endSessionToNexus() {
        if (typeof root.AppHost !== 'undefined' && typeof root.AppHost.endSession === 'function') {
            root.AppHost.endSession();
            return;
        }
        const shell = root.__activeMode;
        if (shell && typeof shell.endSession === 'function') {
            shell.endSession();
        }
    }

    const SandboxRules = {
        id: 'sandbox',

        attach(bus) {
            if (!bus || typeof bus.subscribe !== 'function') {
                throw new Error('[SandboxRules] GameBus.subscribe required');
            }
            return bus.subscribe({
                'combat:enemyKilled': (payload) => {
                    if (!payload || !payload.enemy) return;
                    if (payload.isBoss) {
                        if (typeof GameKillRewards !== 'undefined' && GameKillRewards.grantBossKill) {
                            GameKillRewards.grantBossKill(payload);
                        }
                        return;
                    }
                    if (typeof GameKillRewards !== 'undefined' && GameKillRewards.grantStandardKill) {
                        GameKillRewards.grantStandardKill(payload);
                    }
                },
                'combat:playerDied': () => {
                    // Stay in PLAYING so DeathOverlay can show (Gear UX).
                    // Return to Nexus is explicit via overlay / pause menu.
                },
                'run:exitRequested': () => {
                    endSessionToNexus();
                }
            });
        },

        update(_dt) {
            // Blank slate — no WaveDirector / arena pacing.
        }
    };

    root.SandboxRules = SandboxRules;
    root.Modes = root.Modes || {};
    if (!root.Modes.sandbox) root.Modes.sandbox = { id: 'sandbox' };
    root.Modes.sandbox.Rules = SandboxRules;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SandboxRules;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

/**
 * Title Screen Attract & Handoff Transition Manager for Shape Slayer.
 * Encapsulates title exit animation timing, ease curves, overlay fades, and handoff to the Nexus.
 */

const GameTitleTransition = {
    dismissTitleScreen(game) {
        if (!game || game.state !== 'TITLE' || game.titleExitTransition) return;

        game.titleExitTransition = {
            phase: 'fadeOut',
            elapsed: 0,
            fadeOutSec: 0.45,
            holdSec: 0.14,
            fadeInSec: 0.55,
            swapped: false
        };

        if (typeof window !== 'undefined' && window.TitleScreen && typeof window.TitleScreen.beginExit === 'function') {
            window.TitleScreen.beginExit(game.titleExitTransition.fadeOutSec);
        }
    },

    updateTitleExitTransition(game, dt) {
        if (!game) return;
        const tr = game.titleExitTransition;
        if (!tr) return;

        tr.elapsed += dt;

        if (tr.phase === 'fadeOut') {
            if (tr.elapsed >= tr.fadeOutSec) {
                this.swapTitleToNexus(game);
                tr.phase = 'hold';
                tr.elapsed = 0;
            }
            return;
        }

        if (tr.phase === 'hold') {
            if (tr.elapsed >= tr.holdSec) {
                tr.phase = 'fadeIn';
                tr.elapsed = 0;
            }
            return;
        }

        if (tr.phase === 'fadeIn' && tr.elapsed >= tr.fadeInSec) {
            game.titleExitTransition = null;
            this.applyDeferredBootModals(game);
        }
    },

    swapTitleToNexus(game) {
        if (!game) return;
        const tr = game.titleExitTransition;
        if (tr && tr.swapped) return;
        if (tr) tr.swapped = true;

        if (typeof TitleAttract !== 'undefined' && TitleAttract.dispose) {
            TitleAttract.dispose();
        }

        game.state = 'NEXUS';
        if (typeof initNexus !== 'undefined') {
            initNexus();
        }
        if (typeof game.updateMusicForCurrentRoom === 'function') {
            game.updateMusicForCurrentRoom();
        }
    },

    applyDeferredBootModals(game) {
        if (!game) return;
        const pending = game.pendingBootModals;
        game.pendingBootModals = null;
        if (!pending) return;

        if (pending.privacy) {
            if (typeof game.openPrivacyModal === 'function') {
                game.openPrivacyModal('onboarding');
            } else {
                game.privacyModalVisible = true;
                game.privacyModalContext = 'onboarding';
            }
        } else if (pending.launch) {
            game.launchModalVisible = true;
        }

        if (pending.update) {
            game.updateModalVisible = true;
        }

        if (typeof Onboarding !== 'undefined' && Onboarding.onNexusEnter) {
            setTimeout(() => {
                Onboarding.onNexusEnter();
                if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.onNexusEnter) {
                    FeatureTutorials.onNexusEnter();
                }
            }, 0);
        } else if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.onNexusEnter) {
            setTimeout(() => FeatureTutorials.onNexusEnter(), 0);
        }
    },

    getTitleExitFadeAlpha(game) {
        if (!game) return 0;
        const tr = game.titleExitTransition;
        if (!tr) return 0;

        const easeInOut = (t) => {
            const x = Math.max(0, Math.min(1, t));
            return x * x * (3 - 2 * x);
        };

        if (tr.phase === 'fadeOut') {
            return easeInOut(tr.elapsed / Math.max(0.0001, tr.fadeOutSec));
        }
        if (tr.phase === 'hold') return 1;
        if (tr.phase === 'fadeIn') {
            return 1 - easeInOut(tr.elapsed / Math.max(0.0001, tr.fadeInSec));
        }
        return 0;
    },

    renderTitleExitOverlay(game, ctx) {
        if (!game || !ctx) return;
        const alpha = this.getTitleExitFadeAlpha(game);
        if (alpha <= 0.001) return;
        const width = game.config ? game.config.width : 1280;
        const height = game.config ? game.config.height : 720;

        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillStyle = '#05070f';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
};

if (typeof window !== 'undefined') {
    window.GameTitleTransition = GameTitleTransition;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameTitleTransition = GameTitleTransition;
}

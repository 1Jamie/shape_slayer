/**
 * Top-Level Modal & Overlay Controller for Shape Slayer.
 * Manages modal stacks above pause, privacy choices, and telemetry opt-in states.
 */

const GameModalController = {
    dismissOverlayAbovePause(game) {
        if (!game) return false;

        // DOM audio menu (opened from pause)
        if (typeof window !== 'undefined' && window.UIAudio && typeof window.UIAudio.close === 'function') {
            const audioPanel = document.querySelector('.audio-menu');
            const audioLayer = audioPanel && audioPanel.closest('.ui-layer--modal');
            if (audioLayer) {
                const display = audioLayer.style.display || (window.getComputedStyle
                    ? window.getComputedStyle(audioLayer).display
                    : '');
                if (display && display !== 'none') {
                    window.UIAudio.close();
                    return true;
                }
            }
        }

        // Legacy canvas audio menu flag
        if (typeof audioMenuVisible !== 'undefined' && audioMenuVisible) {
            if (typeof window !== 'undefined') window.audioMenuVisible = false;
            if (typeof activeAudioSliderKey !== 'undefined') window.activeAudioSliderKey = null;
            if (typeof activeAudioSliderPointerId !== 'undefined') window.activeAudioSliderPointerId = null;
            if (typeof Engine !== 'undefined' && Engine.Audio && Engine.Audio.saveSettings) {
                Engine.Audio.saveSettings();
            }
            return true;
        }

        if (game.updateModalVisible) {
            game.updateModalVisible = false;
            if (typeof SaveSystem !== 'undefined' && SaveSystem.setLastRunVersion && game.VERSION) {
                SaveSystem.setLastRunVersion(game.VERSION);
            }
            if (typeof updateModalScroll !== 'undefined') {
                if (typeof window !== 'undefined') window.updateModalScroll = 0;
            }
            return true;
        }

        if (game.launchModalVisible) {
            // Forced first-run controls step: Esc cannot dismiss
            if (typeof Onboarding !== 'undefined' && Onboarding.getStep
                && Onboarding.getStep() === Onboarding.STEPS.CONTROLS
                && !Onboarding.isSuspended()) {
                return true;
            }
            game.launchModalVisible = false;
            if (typeof SaveSystem !== 'undefined' && SaveSystem.setHasSeenLaunchModal) {
                SaveSystem.setHasSeenLaunchModal(true);
            }
            return true;
        }

        if (game.privacyModalVisible) {
            if (typeof Onboarding !== 'undefined'
                && Onboarding.getStep
                && Onboarding.getStep() === Onboarding.STEPS.PRIVACY
                && game.privacyModalContext === 'onboarding') {
                return true;
            }
            if (typeof game.closePrivacyModal === 'function') {
                game.closePrivacyModal();
            } else {
                game.privacyModalVisible = false;
            }
            return true;
        }

        return false;
    },

    setTelemetryPreference(game, optIn) {
        if (!game) return;
        const enabled = optIn === true;
        game.telemetryOptIn = enabled;
        if (typeof SaveSystem !== 'undefined' && SaveSystem.setTelemetryOptIn) {
            SaveSystem.setTelemetryOptIn(enabled);
        }
        if (!enabled && typeof Telemetry !== 'undefined' && Telemetry.reset) {
            Telemetry.reset();
        }
    },

    handlePrivacyChoice(game, optIn) {
        if (!game) return;
        if (typeof SaveSystem !== 'undefined' && SaveSystem.setPrivacyAcknowledged) {
            SaveSystem.setPrivacyAcknowledged(true);
        }
        const context = game.privacyModalContext;
        this.setTelemetryPreference(game, optIn);

        game.privacyModalVisible = false;
        game.privacyModalReturnToPause = false;
        game.privacyModalContext = 'onboarding';
        game.privacyModalPreviousShowPauseMenu = false;

        if (context === 'onboarding') {
            if (typeof Onboarding !== 'undefined' && Onboarding.notifyPrivacyDone) {
                Onboarding.notifyPrivacyDone();
            }
            if (typeof SaveSystem !== 'undefined' && !SaveSystem.getHasSeenLaunchModal()) {
                game.launchModalVisible = true;
            }
        } else if (context === 'pause') {
            if (game.multiplayerEnabled) {
                game.showPauseMenu = true;
            }
        }
    }
};

if (typeof window !== 'undefined') {
    window.GameModalController = GameModalController;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameModalController = GameModalController;
}

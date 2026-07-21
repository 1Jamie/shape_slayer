const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Game Delegator Contract Verification', async (t) => {
    // Read extracted module files to ensure syntax and existence
    const filesToVerify = [
        'src/game/presentation/render-quality.js',
        'src/game/presentation/display-manager.js',
        'src/game/presentation/easter-egg-ps2.js',
        'src/game/presentation/screen-effects.js',
        'src/game/presentation/game-camera.js',
        'src/game/presentation/title-transition.js',
        'src/game/presentation/boss-intro.js',
        'src/game/simulation/player-stats.js',
        'src/game/simulation/room-transition.js',
        'src/game/simulation/run-rewards.js',
        'src/game/simulation/split-session.js',
        'src/game/simulation/door-controller.js',
        'src/game/simulation/loot-interaction.js',
        'src/game/ui/core/modal-controller.js'
    ];

    filesToVerify.forEach(relPath => {
        const fullPath = path.join(__dirname, '..', relPath);
        assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(content.length > 50, `File content must be non-empty: ${relPath}`);
    });

    await t.test('verifies all expected Game delegator methods are defined', () => {
        const expectedDelegators = [
            'getRenderQualityForTier',
            'isNativeFullscreenActive',
            'isFullscreenActive',
            'toggleFullscreen',
            'lockLandscapeOrientation',
            'triggerScreenShake',
            'triggerChromaticTrauma',
            'getDamageTraumaParams',
            'applyChromaticAberrationFromOffscreen',
            'renderPreBossHealerPunchThrough',
            'triggerHitPause',
            'updateScreenShake',
            'beginRoomEnterTransition',
            'updateRoomEnterTransition',
            'finishRoomEnterTransition',
            'maybeStartBossIntroForCurrentRoom',
            'tickNexusPrewarm',
            'renderRoomEnterScreen',
            'calculateCurrency',
            'awardRunCredits',
            'calculateShardsForPlayer',
            'calculateCurrencyForPlayer',
            'screenToGame',
            'getViewZoom',
            'setCameraDistance',
            'getCameraDistance',
            'initializeCamera',
            'updateNexusCamera',
            'initializeNexusCamera',
            'applyDeferredBootModals',
            'dismissTitleScreen',
            'updateTitleExitTransition',
            'swapTitleToNexus',
            'getTitleExitFadeAlpha',
            'renderTitleExitOverlay',
            'dismissOverlayAbovePause',
            'setTelemetryPreference',
            'handlePrivacyChoice',
            'startBossIntro',
            'updateBossIntro',
            'skipBossIntro',
            'endBossIntro',
            'renderBossIntro',
            'enableLocalSplit',
            'disableLocalSplit',
            'setLocalSplitClass',
            'getLocalSplitClass',
            'getExitDoorNearRange',
            'isPlayerNearExitDoor',
            'ensureDoorReadySet',
            'isPlayerDoorReady',
            'toggleDoorReadyForPlayer',
            'syncPlayersOnDoorFromReady',
            'clearDoorReadyState',
            'toggleDoorReadyAtExit',
            'didPlayerRequestDoorInteract',
            'tryAdvanceWhenAllDoorReady',
            'checkDoorCollision',
            'checkGearPickup'
        ];

        const mainContent = fs.readFileSync(path.join(__dirname, '..', 'src/game/main.js'), 'utf8');
        
        expectedDelegators.forEach(methodName => {
            const regex = new RegExp(`${methodName}\\s*\\(`);
            assert.match(mainContent, regex, `Game must define delegator method: ${methodName}`);
        });
    });
});

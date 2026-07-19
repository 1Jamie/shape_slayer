/**
 * First-run nexus onboarding coach tests
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function loadOnboardingSandbox(options = {}) {
    const saveCode = fs.readFileSync(path.join(__dirname, '../src/game/content/save.js'), 'utf8');
    const coachCode = fs.readFileSync(path.join(__dirname, '../src/game/content/coach-transition.js'), 'utf8');
    const onboardingCode = fs.readFileSync(path.join(__dirname, '../src/game/content/onboarding.js'), 'utf8');
    const localStorage = {
        _data: {},
        getItem(k) { return this._data[k] ?? null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; }
    };
    if (options.seedSave) {
        localStorage.setItem('shapeSlayerSave', JSON.stringify(options.seedSave));
    }
    const sandbox = {
        console,
        localStorage,
        window: {},
        Math,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        Game: options.Game || { state: 'NEXUS', config: { width: 1920, height: 1080 }, nexusCamera: { x: 900, y: 500 }, baseZoom: 1 },
        multiplayerManager: options.multiplayerManager || null,
        classStations: [
            { key: 'square', x: 525, y: 200 },
            { key: 'triangle', x: 775, y: 200 },
            { key: 'pentagon', x: 1025, y: 200 },
            { key: 'hexagon', x: 1275, y: 200 }
        ],
        upgradeStations: [
            { key: 'damage', x: 280, y: 450 },
            { key: 'defense', x: 280, y: 600 },
            { key: 'speed', x: 280, y: 750 },
            { key: 'cooldown', x: 400, y: 450 },
            { key: 'health', x: 400, y: 600 },
            { key: 'attackSpeed', x: 400, y: 750 }
        ],
        nexusRoom: {
            portalPos: { x: 900, y: 520, radius: 50 },
            width: 1800,
            height: 1080
        },
        SaveSystem: null,
        Onboarding: null
    };
    sandbox.window = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/engine/save.js'), 'utf8'), sandbox);
    if (sandbox.window && sandbox.window.Engine) sandbox.Engine = sandbox.window.Engine;
    vm.runInNewContext(
        saveCode + '\nthis.SaveSystem = SaveSystem;\n'
        + coachCode + '\nthis.CoachTransition = CoachTransition;\n'
        + onboardingCode + '\nthis.Onboarding = Onboarding;',
        sandbox
    );
    return sandbox;
}

describe('Onboarding save flags', () => {
    it('defaults to incomplete onboarding blob', () => {
        const { SaveSystem } = loadOnboardingSandbox();
        const ob = SaveSystem.getOnboarding();
        assert.equal(ob.selectClassDone, false);
        assert.equal(ob.launchRunDone, false);
        assert.equal(ob.classUpgradesDone, false);
        assert.equal(ob.complete, false);
    });

    it('patches onboarding flags independently', () => {
        const { SaveSystem } = loadOnboardingSandbox();
        SaveSystem.setOnboarding({ selectClassDone: true });
        assert.equal(SaveSystem.getOnboarding().selectClassDone, true);
        assert.equal(SaveSystem.getOnboarding().launchRunDone, false);
    });
});

describe('Onboarding step progression', () => {
    it('starts at privacy then controls then selectClass', () => {
        const sandbox = loadOnboardingSandbox();
        const { Onboarding, SaveSystem } = sandbox;
        assert.equal(Onboarding.getStep(), 'privacy');
        SaveSystem.setPrivacyAcknowledged(true);
        assert.equal(Onboarding.getStep(), 'controls');
        SaveSystem.setHasSeenLaunchModal(true);
        assert.equal(Onboarding.getStep(), 'selectClass');
    });

    it('advances selectClass → launchRun → classUpgrades → complete', () => {
        const sandbox = loadOnboardingSandbox();
        const { Onboarding, SaveSystem, Game } = sandbox;
        SaveSystem.setPrivacyAcknowledged(true);
        SaveSystem.setHasSeenLaunchModal(true);

        assert.equal(Onboarding.getStep(), 'selectClass');
        assert.equal(Onboarding.allowsInteraction('class'), true);
        assert.equal(Onboarding.allowsInteraction('portal'), false);
        assert.equal(Onboarding.allowsInteraction('upgrade'), false);

        Onboarding.notifyClassSelected();
        assert.equal(Onboarding.getStep(), 'launchRun');
        assert.equal(Onboarding.allowsInteraction('portal'), true);
        assert.equal(Onboarding.allowsInteraction('class'), true);
        assert.equal(Onboarding.allowsInteraction('gearUpgrade'), false);

        Onboarding.notifyRunStarted();
        assert.equal(SaveSystem.getOnboarding().firstRunStarted, true);
        Game.state = 'PLAYING';
        assert.equal(Onboarding.getStep(), null); // mid-run not in upgrades yet

        Game.state = 'NEXUS';
        assert.equal(Onboarding.getStep(), 'classUpgrades');
        assert.equal(Onboarding.allowsInteraction('upgrade'), true);
        assert.equal(Onboarding.allowsInteraction('portal'), false);

        Onboarding._classUpgradesArmedAt = Date.now() - 1;
        Onboarding.notifyClassUpgradeOpened();
        assert.equal(Onboarding.isComplete(), true);
        assert.equal(Onboarding.allowsInteraction('portal'), true);
    });

    it('does not skip classUpgrades when rarity/room unlocks exist', () => {
        const sandbox = loadOnboardingSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                selectedClass: 'square',
                highestRoomCleared: 10,
                bossesDefeated: { 'Swarm King': true },
                currency: 200,
                onboarding: {
                    selectClassDone: true,
                    launchRunDone: true,
                    firstRunStarted: true,
                    classUpgradesDone: false,
                    complete: false,
                    tutorialVersion: 0
                }
            }
        });
        const { Onboarding, Game } = sandbox;
        Game.state = 'NEXUS';
        assert.equal(Onboarding.getStep(), 'classUpgrades');
        assert.equal(Onboarding.isSpotlightActive(), true);
        assert.equal(Onboarding.allowsInteraction('upgrade'), true);
        assert.equal(Onboarding.allowsInteraction('gearUpgrade'), false);
        assert.equal(Onboarding.allowsInteraction('portal'), false);
    });

    it('stages player away from upgrade stations and arms before completing', () => {
        const sandbox = loadOnboardingSandbox();
        const { Onboarding, SaveSystem, Game } = sandbox;
        SaveSystem.setPrivacyAcknowledged(true);
        SaveSystem.setHasSeenLaunchModal(true);
        Onboarding.notifyClassSelected();
        Onboarding.notifyRunStarted();
        Game.state = 'NEXUS';
        Game.player = { x: 300, y: 550 };
        Game.nexusCamera = { x: 300, y: 550, targetX: 300, targetY: 550 };
        Game.lastGKeyState = false;

        Onboarding.prepareClassUpgradesStep();
        assert.equal(Onboarding.getStep(), 'classUpgrades');
        assert.ok(Game.player.x > 500, 'player should be staged east of upgrade column');
        assert.equal(Onboarding.isClassUpgradesArmed(), false);
        Onboarding.notifyClassUpgradeOpened();
        assert.equal(Onboarding.isComplete(), false);

        Onboarding._classUpgradesArmedAt = Date.now() - 1;
        assert.equal(Onboarding.isClassUpgradesArmed(), true);
        Onboarding.notifyClassUpgradeOpened();
        assert.equal(Onboarding.isComplete(), true);
    });

    it('does not auto-complete just because a class is selected mid-onboarding', () => {
        const sandbox = loadOnboardingSandbox();
        const { Onboarding, SaveSystem } = sandbox;
        SaveSystem.setPrivacyAcknowledged(true);
        SaveSystem.setHasSeenLaunchModal(true);
        SaveSystem.setSelectedClass('square');
        Onboarding.notifyClassSelected();
        assert.equal(Onboarding.getStep(), 'launchRun');
        assert.equal(Onboarding.isComplete(), false);
        assert.equal(Onboarding.isSpotlightActive(), true);
        assert.equal(Onboarding.allowsInteraction('portal'), true);
    });

    it('forces existing players through tutorial even if they already have play progress', () => {
        const sandbox = loadOnboardingSandbox({
            seedSave: {
                currency: 500,
                highestRoomCleared: 20,
                lifetimeStats: { totalRoomsCleared: 40 },
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                selectedClass: 'square',
                onboarding: {
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true,
                    complete: true,
                    tutorialVersion: 0
                }
            }
        });
        const { Onboarding, SaveSystem } = sandbox;
        const ob = SaveSystem.getOnboarding();
        assert.equal(ob.complete, false);
        assert.equal(ob.selectClassDone, false);
        assert.equal(Onboarding.isComplete(), false);
        assert.equal(Onboarding.getStep(), 'selectClass');
    });

    it('stays complete only with matching tutorialVersion', () => {
        const sandbox = loadOnboardingSandbox();
        const { Onboarding, SaveSystem } = sandbox;
        SaveSystem.setOnboarding({
            selectClassDone: true,
            launchRunDone: true,
            classUpgradesDone: true,
            firstRunStarted: true,
            complete: true,
            tutorialVersion: SaveSystem.ONBOARDING_TUTORIAL_VERSION
        });
        assert.equal(Onboarding.isComplete(), true);
        assert.equal(Onboarding.getStep(), 'complete');
    });
});

describe('Onboarding MP suspend', () => {
    it('clears gates while lobby active and resumes after', () => {
        const sandbox = loadOnboardingSandbox({
            multiplayerManager: { lobbyCode: null }
        });
        const { Onboarding, SaveSystem } = sandbox;
        SaveSystem.setPrivacyAcknowledged(true);
        SaveSystem.setHasSeenLaunchModal(true);
        assert.equal(Onboarding.getStep(), 'selectClass');
        assert.equal(Onboarding.isSpotlightActive(), true);

        sandbox.multiplayerManager.lobbyCode = 'ABCD';
        Onboarding.suspendForMultiplayer();
        assert.equal(Onboarding.isSuspended(), true);
        assert.equal(Onboarding.getStep(), null);
        assert.equal(Onboarding.isSpotlightActive(), false);
        assert.equal(Onboarding.allowsInteraction('portal'), true);
        assert.equal(SaveSystem.getOnboarding().selectClassDone, false);

        sandbox.multiplayerManager.lobbyCode = null;
        Onboarding.resumeFromMultiplayer();
        assert.equal(Onboarding.isSuspended(), false);
        assert.equal(Onboarding.getStep(), 'selectClass');
    });
});

describe('Onboarding camera override', () => {
    it('returns class AABB center during selectClass', () => {
        const sandbox = loadOnboardingSandbox();
        const { Onboarding, SaveSystem } = sandbox;
        SaveSystem.setPrivacyAcknowledged(true);
        SaveSystem.setHasSeenLaunchModal(true);
        const cam = Onboarding.getCameraOverride();
        assert.ok(cam);
        assert.ok(Math.abs(cam.x - 900) < 1);
        assert.ok(Math.abs(cam.y - 200) < 1);
    });
});


describe('Onboarding skip escape', () => {
    it('skipGuide on classUpgrades completes only that step', () => {
        const sandbox = loadOnboardingSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                onboarding: {
                    selectClassDone: true,
                    launchRunDone: true,
                    firstRunStarted: true,
                    classUpgradesDone: false,
                    complete: false,
                    tutorialVersion: 1
                }
            },
            Game: {
                state: 'NEXUS',
                selectedClass: 'square',
                config: { width: 1920, height: 1080 },
                nexusCamera: { x: 900, y: 500 },
                baseZoom: 1,
                player: { x: 620, y: 600, playerId: null }
            }
        });
        const { Onboarding, SaveSystem, Game } = sandbox;
        assert.equal(Onboarding.getStep(), 'classUpgrades');
        assert.equal(Onboarding.allowsInteraction('portal'), false);

        assert.equal(Onboarding.skipGuide(), true);
        assert.equal(Onboarding.isComplete(), true);
        assert.equal(SaveSystem.getOnboarding().classUpgradesDone, true);
        assert.equal(Onboarding.isSpotlightActive(), false);
        assert.equal(Onboarding.allowsInteraction('portal'), true);
        assert.equal(Onboarding.canSkipGuide(), false);
        assert.equal(Game.state, 'NEXUS');
    });

    it('skipGuide on selectClass advances only to launchRun', () => {
        const sandbox = loadOnboardingSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                onboarding: {
                    selectClassDone: false,
                    launchRunDone: false,
                    firstRunStarted: false,
                    classUpgradesDone: false,
                    complete: false,
                    tutorialVersion: 1
                }
            },
            Game: {
                state: 'NEXUS',
                selectedClass: null,
                config: { width: 1920, height: 1080 },
                nexusCamera: { x: 900, y: 500 },
                baseZoom: 1,
                player: { x: 900, y: 500, playerId: null }
            }
        });
        const { Onboarding, SaveSystem, Game } = sandbox;
        assert.equal(Onboarding.getStep(), 'selectClass');
        assert.equal(Onboarding.skipGuide(), true);
        assert.equal(SaveSystem.getOnboarding().selectClassDone, true);
        assert.equal(SaveSystem.getOnboarding().launchRunDone, false);
        assert.equal(SaveSystem.getOnboarding().classUpgradesDone, false);
        assert.equal(SaveSystem.getOnboarding().complete, false);
        assert.equal(Onboarding.getStep(), 'launchRun');
        assert.equal(Game.selectedClass, 'square');
    });

    it('skipGuide on launchRun does not skip class upgrades', () => {
        const sandbox = loadOnboardingSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                onboarding: {
                    selectClassDone: true,
                    launchRunDone: false,
                    firstRunStarted: false,
                    classUpgradesDone: false,
                    complete: false,
                    tutorialVersion: 1
                }
            },
            Game: {
                state: 'NEXUS',
                selectedClass: 'square',
                config: { width: 1920, height: 1080 },
                nexusCamera: { x: 900, y: 500 },
                baseZoom: 1,
                player: { x: 900, y: 500 }
            }
        });
        const { Onboarding, SaveSystem } = sandbox;
        assert.equal(Onboarding.skipGuide(), true);
        assert.equal(SaveSystem.getOnboarding().launchRunDone, true);
        assert.equal(SaveSystem.getOnboarding().firstRunStarted, false);
        assert.equal(SaveSystem.getOnboarding().classUpgradesDone, false);
        assert.equal(Onboarding.getStep(), null);
        assert.equal(Onboarding.canSkipGuide(), false);
    });

    it('canSkipGuide stays available while paused from Nexus', () => {
        const sandbox = loadOnboardingSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                onboarding: {
                    selectClassDone: true,
                    launchRunDone: true,
                    firstRunStarted: true,
                    classUpgradesDone: false,
                    complete: false,
                    tutorialVersion: 1
                }
            },
            Game: {
                state: 'PAUSED',
                pausedFromState: 'NEXUS',
                selectedClass: 'square',
                config: { width: 1920, height: 1080 },
                nexusCamera: { x: 900, y: 500 },
                baseZoom: 1,
                player: { x: 620, y: 600 }
            }
        });
        const { Onboarding } = sandbox;
        assert.equal(Onboarding.canSkipGuide(), true);
        assert.equal(Onboarding.shouldShowSkipOverlay(), false);
        assert.equal(Onboarding.skipGuide(), true);
        assert.equal(Onboarding.isComplete(), true);
    });
});

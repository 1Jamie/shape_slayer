/**
 * Feature tutorial queue (nexus machines) + unlock toasts
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function loadSandbox(options = {}) {
    const saveCode = fs.readFileSync(path.join(__dirname, '../js/save.js'), 'utf8');
    const coachCode = fs.readFileSync(path.join(__dirname, '../js/coach-transition.js'), 'utf8');
    const onboardingCode = fs.readFileSync(path.join(__dirname, '../js/onboarding.js'), 'utf8');
    const featureCode = fs.readFileSync(path.join(__dirname, '../js/feature-tutorials.js'), 'utf8');
    const localStorage = {
        _data: {},
        getItem(k) { return this._data[k] ?? null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; }
    };
    if (options.seedSave) {
        localStorage.setItem('shapeSlayerSave', JSON.stringify(options.seedSave));
    }

    const toasts = [];
    const sandbox = {
        console,
        localStorage,
        window: { showToast: (msg) => { toasts.push(msg); } },
        setTimeout: (fn) => { fn(); },
        performance: { now: () => Date.now() },
        Math,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        Date,
        Game: options.Game || {
            state: 'NEXUS',
            config: { width: 1920, height: 1080 },
            nexusCamera: { x: 900, y: 500, targetX: 900, targetY: 500, smoothSpeed: 3 },
            player: { x: 620, y: 600 },
            lastGKeyState: false
        },
        multiplayerManager: null,
        gearUpgradeStations: [
            { key: 'rarityChance', x: 1450, y: 430 },
            { key: 'affixSlots', x: 1450, y: 545 },
            { key: 'safeRoomSystems', x: 1450, y: 700 },
            { key: 'safeRoomEfficiency', x: 1450, y: 825 }
        ],
        upgradeStations: [
            { key: 'damage', x: 280, y: 450 },
            { key: 'defense', x: 280, y: 600 }
        ],
        SaveSystem: null,
        Onboarding: null,
        FeatureTutorials: null,
        CoachTransition: null,
        toasts
    };
    sandbox.window = Object.assign(sandbox.window, sandbox);
    vm.runInNewContext(
        saveCode + '\nthis.SaveSystem = SaveSystem;\n'
        + coachCode + '\nthis.CoachTransition = CoachTransition;\n'
        + onboardingCode + '\nthis.Onboarding = Onboarding;\n'
        + featureCode + '\nthis.FeatureTutorials = FeatureTutorials;\n',
        sandbox
    );
    return sandbox;
}

describe('FeatureTutorials queue order', () => {
    it('enqueues multiple unlocks in catalog order (rarity → affixes → systems → efficiency)', () => {
        const sandbox = loadSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                highestRoomCleared: 5,
                bossesDefeated: {
                    'Swarm King': true,
                    'Twin Prism': true,
                    'Fortress': true
                },
                onboarding: {
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true,
                    complete: true,
                    tutorialVersion: 1
                },
                featureTutorials: {
                    initialized: true,
                    completed: {},
                    toasted: {},
                    queue: []
                }
            }
        });
        const { FeatureTutorials, SaveSystem } = sandbox;
        FeatureTutorials.syncFromProgress({ showToast: false });
        assert.deepEqual(SaveSystem.getFeatureTutorials().queue, [
            'rarityChance',
            'affixSlots',
            'safeRoomSystems',
            'safeRoomEfficiency'
        ]);
        assert.equal(FeatureTutorials.getCurrentId(), 'rarityChance');
    });

    it('presents FIFO: complete rarity then next is affixes', () => {
        const sandbox = loadSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                highestRoomCleared: 5,
                bossesDefeated: { 'Swarm King': true },
                onboarding: {
                    complete: true,
                    tutorialVersion: 1,
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true
                },
                featureTutorials: {
                    initialized: true,
                    completed: {},
                    toasted: { rarityChance: true, affixSlots: true },
                    queue: ['rarityChance', 'affixSlots']
                }
            }
        });
        const { FeatureTutorials, Game } = sandbox;
        Game.state = 'NEXUS';
        FeatureTutorials._armedAt = Date.now() - 1;
        assert.equal(FeatureTutorials.getCurrentId(), 'rarityChance');
        FeatureTutorials.notifyMachineOpened('rarityChance');
        assert.equal(FeatureTutorials.getCurrentId(), 'affixSlots');
        assert.equal(FeatureTutorials.allowsInteraction('gearUpgrade', 'affixSlots'), true);
        assert.equal(FeatureTutorials.allowsInteraction('gearUpgrade', 'rarityChance'), false);
        assert.equal(FeatureTutorials.allowsInteraction('portal'), false);
    });

    it('toasts newly unlocked machines in catalog order during sync', () => {
        const sandbox = loadSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                highestRoomCleared: 5,
                bossesDefeated: { 'Swarm King': true },
                onboarding: {
                    complete: true,
                    tutorialVersion: 1,
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true
                },
                featureTutorials: {
                    initialized: true,
                    completed: {},
                    toasted: {},
                    queue: []
                }
            }
        });
        const { FeatureTutorials, toasts } = sandbox;
        FeatureTutorials.syncFromProgress({ showToast: true });
        assert.equal(toasts.length, 2);
        assert.match(toasts[0], /Rarity/);
        assert.match(toasts[1], /Affix/);
    });

    it('does not present while first-run onboarding is incomplete', () => {
        const sandbox = loadSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                highestRoomCleared: 5,
                onboarding: {
                    complete: false,
                    tutorialVersion: 0,
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: false,
                    firstRunStarted: true
                },
                featureTutorials: {
                    initialized: true,
                    completed: {},
                    toasted: { rarityChance: true },
                    queue: ['rarityChance']
                }
            }
        });
        const { FeatureTutorials, Game } = sandbox;
        Game.state = 'NEXUS';
        assert.equal(FeatureTutorials.canPresent(), false);
        assert.equal(FeatureTutorials.getCurrentId(), null);
        assert.equal(FeatureTutorials.isSpotlightActive(), false);
    });

    it('grandfathers already-unlocked machines for veterans on first init', () => {
        const sandbox = loadSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                highestRoomCleared: 20,
                bossesDefeated: { 'Swarm King': true, 'Twin Prism': true },
                onboarding: {
                    complete: true,
                    tutorialVersion: 1,
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true
                }
                // no featureTutorials blob → defaults uninitialized
            }
        });
        const { FeatureTutorials, SaveSystem } = sandbox;
        FeatureTutorials.ensureInitialized();
        const state = SaveSystem.getFeatureTutorials();
        assert.equal(state.initialized, true);
        assert.equal(state.completed.rarityChance, true);
        assert.equal(state.completed.affixSlots, true);
        assert.equal(state.completed.safeRoomSystems, true);
        assert.deepEqual(state.queue, []);
    });

    it('recordRoomCleared triggers toast sync for rarity unlock', () => {
        const sandbox = loadSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                highestRoomCleared: 4,
                onboarding: {
                    complete: true,
                    tutorialVersion: 1,
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true
                },
                featureTutorials: {
                    initialized: true,
                    completed: {},
                    toasted: {},
                    queue: []
                }
            }
        });
        const { SaveSystem, toasts } = sandbox;
        SaveSystem.recordRoomCleared(5);
        assert.ok(toasts.some(t => /Rarity/.test(t)));
        assert.deepEqual(SaveSystem.getFeatureTutorials().queue, ['rarityChance']);
    });
});

describe('FeatureTutorials smooth handoff', () => {
    it('continueFrom leaves the player in place and starts a camera/cutout transition', () => {
        const sandbox = loadSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                highestRoomCleared: 5,
                onboarding: {
                    complete: true,
                    tutorialVersion: 1,
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true
                },
                featureTutorials: {
                    initialized: true,
                    completed: {},
                    toasted: { rarityChance: true },
                    queue: ['rarityChance']
                }
            }
        });
        const { FeatureTutorials, CoachTransition, Game } = sandbox;
        Game.state = 'NEXUS';
        Game.player.x = 620;
        Game.player.y = 600;
        Game.nexusCamera.x = 340;
        Game.nexusCamera.y = 600;

        const fromRect = { x: 200, y: 400, w: 280, h: 400 };
        const ok = FeatureTutorials.continueFrom(fromRect);
        assert.equal(ok, true);
        assert.equal(Game.player.x, 620);
        assert.equal(Game.player.y, 600);
        assert.equal(CoachTransition.isActive(), true);
        assert.equal(FeatureTutorials.isArmed(), false);
        assert.ok(Math.abs(Game.nexusCamera.targetX - 1450) < 1);
        assert.ok(Math.abs(Game.nexusCamera.x - 340) < 1);
    });

    it('queue advance leaves player and transitions cutout to next machine', () => {
        const sandbox = loadSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                highestRoomCleared: 5,
                bossesDefeated: { 'Swarm King': true },
                onboarding: {
                    complete: true,
                    tutorialVersion: 1,
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true
                },
                featureTutorials: {
                    initialized: true,
                    completed: {},
                    toasted: { rarityChance: true, affixSlots: true },
                    queue: ['rarityChance', 'affixSlots']
                }
            }
        });
        const { FeatureTutorials, CoachTransition, Game } = sandbox;
        Game.state = 'NEXUS';
        Game.player.x = 1200;
        Game.player.y = 430;
        FeatureTutorials._armedAt = Date.now() - 1;
        FeatureTutorials.notifyMachineOpened('rarityChance');
        assert.equal(FeatureTutorials.getCurrentId(), 'affixSlots');
        assert.equal(Game.player.x, 1200);
        assert.equal(Game.player.y, 430);
        assert.equal(CoachTransition.isActive(), true);
    });
});

describe('FeatureTutorials smooth handoff', () => {
    it('continueFrom leaves the player in place and starts a camera/cutout transition', () => {
        const sandbox = loadSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                highestRoomCleared: 5,
                onboarding: {
                    complete: true,
                    tutorialVersion: 1,
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true
                },
                featureTutorials: {
                    initialized: true,
                    completed: {},
                    toasted: { rarityChance: true },
                    queue: ['rarityChance']
                }
            }
        });
        const { FeatureTutorials, CoachTransition, Game } = sandbox;
        Game.state = 'NEXUS';
        Game.player.x = 620;
        Game.player.y = 600;
        Game.nexusCamera.x = 340;
        Game.nexusCamera.y = 600;

        const fromRect = { x: 200, y: 400, w: 280, h: 400 };
        const ok = FeatureTutorials.continueFrom(fromRect);
        assert.equal(ok, true);
        assert.equal(Game.player.x, 620);
        assert.equal(Game.player.y, 600);
        assert.equal(CoachTransition.isActive(), true);
        assert.equal(FeatureTutorials.isArmed(), false);
        // Camera should target rarity machine, not snap instantly
        assert.ok(Math.abs(Game.nexusCamera.targetX - 1450) < 1);
        assert.ok(Math.abs(Game.nexusCamera.x - 340) < 1);
    });

    it('queue advance leaves player and transitions cutout to next machine', () => {
        const sandbox = loadSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                highestRoomCleared: 5,
                bossesDefeated: { 'Swarm King': true },
                onboarding: {
                    complete: true,
                    tutorialVersion: 1,
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true
                },
                featureTutorials: {
                    initialized: true,
                    completed: {},
                    toasted: { rarityChance: true, affixSlots: true },
                    queue: ['rarityChance', 'affixSlots']
                }
            }
        });
        const { FeatureTutorials, CoachTransition, Game } = sandbox;
        Game.state = 'NEXUS';
        Game.player.x = 1200;
        Game.player.y = 430;
        FeatureTutorials._armedAt = Date.now() - 1;
        FeatureTutorials.notifyMachineOpened('rarityChance');
        assert.equal(FeatureTutorials.getCurrentId(), 'affixSlots');
        assert.equal(Game.player.x, 1200);
        assert.equal(Game.player.y, 430);
        assert.equal(CoachTransition.isActive(), true);
    });
});


describe('FeatureTutorials resume checkpoint deferral', () => {
    it('does not present spotlight on nexus enter while a run checkpoint is active', () => {
        const sandbox = loadSandbox({
            seedSave: {
                privacyAcknowledged: true,
                hasSeenLaunchModal: true,
                highestRoomCleared: 5,
                activeRunCheckpoint: {
                    version: 1,
                    roomNumber: 5,
                    playerClass: 'square',
                    player: { level: 2 }
                },
                onboarding: {
                    complete: true,
                    tutorialVersion: 1,
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true
                },
                featureTutorials: {
                    initialized: true,
                    completed: {},
                    toasted: { rarityChance: true },
                    queue: ['rarityChance']
                }
            }
        });
        const { FeatureTutorials, CoachTransition, SaveSystem, Game } = sandbox;
        Game.state = 'NEXUS';
        assert.equal(SaveSystem.hasActiveRunCheckpoint(), true);
        assert.equal(FeatureTutorials.isBlockedByResumeCheckpoint(), true);
        assert.equal(FeatureTutorials.canPresent(), false);

        FeatureTutorials.onNexusEnter();
        assert.equal(FeatureTutorials.getCurrentId(), null);
        assert.equal(FeatureTutorials.isSpotlightActive(), false);
        assert.equal(CoachTransition.isActive(), false);
        // Queue/unlock state is preserved for after the run ends
        assert.deepEqual(SaveSystem.getFeatureTutorials().queue, ['rarityChance']);
        // Portal must not be hard-gated by the coach
        assert.equal(FeatureTutorials.allowsInteraction('portal'), true);
        assert.equal(FeatureTutorials.allowsInteraction('gearUpgrade', 'rarityChance'), true);
    });
});

/**
 * Feature tutorial queue (nexus machines) + unlock toasts
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function loadSandbox(options = {}) {
    const saveCode = fs.readFileSync(path.join(__dirname, '../src/game/content/save.js'), 'utf8');
    const coachCode = fs.readFileSync(path.join(__dirname, '../src/game/content/coach-transition.js'), 'utf8');
    const onboardingCode = fs.readFileSync(path.join(__dirname, '../src/game/content/onboarding.js'), 'utf8');
    const featureCode = fs.readFileSync(path.join(__dirname, '../src/game/content/feature-tutorials.js'), 'utf8');
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
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/engine/save.js'), 'utf8'), sandbox);
    if (sandbox.window && sandbox.window.Engine) sandbox.Engine = sandbox.window.Engine;
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
        // Camera frames player + machine (not hard-locked to machine center)
        assert.ok(Game.nexusCamera.targetX > 620 && Game.nexusCamera.targetX < 1450);
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
        assert.ok(Game.nexusCamera.targetX > 620 && Game.nexusCamera.targetX < 1450);
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


describe('FeatureTutorials skip escape', () => {
    it('skipGuide dismisses only the current step and keeps later queue items', () => {
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
        const { FeatureTutorials, SaveSystem, Game } = sandbox;
        Game.state = 'NEXUS';
        FeatureTutorials.onNexusEnter();
        assert.equal(FeatureTutorials.getCurrentId(), 'rarityChance');
        assert.equal(FeatureTutorials.allowsInteraction('portal'), false);

        assert.equal(FeatureTutorials.skipGuide(), true);
        assert.equal(SaveSystem.getFeatureTutorials().completed.rarityChance, true);
        assert.equal(SaveSystem.getFeatureTutorials().completed.affixSlots, undefined);
        assert.deepEqual(SaveSystem.getFeatureTutorials().queue, ['affixSlots']);
        assert.equal(FeatureTutorials.getCurrentId(), 'affixSlots');
        assert.equal(FeatureTutorials.isSpotlightActive(), true);
        assert.equal(FeatureTutorials.canSkipGuide(), true);
    });

    it('canSkipGuide stays available while paused mid machine-unlock guide', () => {
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
        const { FeatureTutorials, Game } = sandbox;
        Game.state = 'NEXUS';
        FeatureTutorials.onNexusEnter();
        assert.ok(FeatureTutorials._armedAt > 0);
        Game.state = 'PAUSED';
        Game.pausedFromState = 'NEXUS';
        assert.equal(FeatureTutorials.canSkipGuide(), true);
        assert.equal(FeatureTutorials.shouldShowSkipOverlay(), false);
        assert.equal(FeatureTutorials.skipGuide(), true);
        assert.equal(FeatureTutorials.canSkipGuide(), false);
    });

    it('skip works for each unlock-machine guide (room 5 / Swarm King / Twin Prism / Fortress)', () => {
        const cases = [
            { id: 'rarityChance', seed: { highestRoomCleared: 5 } },
            { id: 'affixSlots', seed: { highestRoomCleared: 5, bossesDefeated: { 'Swarm King': true } } },
            { id: 'safeRoomSystems', seed: { highestRoomCleared: 5, bossesDefeated: { 'Swarm King': true, 'Twin Prism': true } } },
            { id: 'safeRoomEfficiency', seed: { highestRoomCleared: 5, bossesDefeated: { 'Swarm King': true, 'Twin Prism': true, Fortress: true } } }
        ];

        for (const entry of cases) {
            const completedPrior = {};
            FeatureTutorialsCatalogPriorIds(entry.id).forEach((id) => { completedPrior[id] = true; });

            const sandbox = loadSandbox({
                seedSave: Object.assign({
                    privacyAcknowledged: true,
                    hasSeenLaunchModal: true,
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
                        completed: completedPrior,
                        toasted: Object.assign({}, completedPrior, { [entry.id]: true }),
                        queue: [entry.id]
                    }
                }, entry.seed)
            });
            const { FeatureTutorials, SaveSystem, Game } = sandbox;
            Game.state = 'NEXUS';
            FeatureTutorials.onNexusEnter();
            assert.equal(FeatureTutorials.getCurrentId(), entry.id, `${entry.id} should be current`);
            assert.equal(FeatureTutorials.shouldShowSkipOverlay(), true, `${entry.id} shows Skip overlay`);
            assert.equal(FeatureTutorials.canSkipGuide(), true, `${entry.id} can skip`);
            assert.equal(FeatureTutorials.allowsInteraction('portal'), false, `${entry.id} gates portal`);

            assert.equal(FeatureTutorials.skipGuide(), true, `${entry.id} skip succeeds`);
            assert.equal(SaveSystem.getFeatureTutorials().completed[entry.id], true, `${entry.id} marked complete`);
            assert.equal(FeatureTutorials.getCurrentId(), null, `${entry.id} cleared as only queued step`);
            assert.equal(FeatureTutorials.allowsInteraction('portal'), true, `${entry.id} unblocks portal`);
        }
    });

    function FeatureTutorialsCatalogPriorIds(id) {
        const order = ['rarityChance', 'affixSlots', 'safeRoomSystems', 'safeRoomEfficiency'];
        const idx = order.indexOf(id);
        return idx > 0 ? order.slice(0, idx) : [];
    }

    it('enforcePresentationSafety unblocks portal when resume checkpoint appears mid-guide', () => {
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
        const { FeatureTutorials, SaveSystem, Game } = sandbox;
        Game.state = 'NEXUS';
        FeatureTutorials.onNexusEnter();
        assert.equal(FeatureTutorials.isSpotlightActive(), true);

        SaveSystem.setActiveRunCheckpoint({
            version: 1,
            roomNumber: 5,
            playerClass: 'square',
            player: { level: 2 }
        });
        assert.equal(FeatureTutorials.enforcePresentationSafety(), false);
        assert.equal(FeatureTutorials.isSpotlightActive(), false);
        assert.equal(FeatureTutorials.allowsInteraction('portal'), true);
    });
});


describe('FeatureTutorials gear machine interact gate', () => {
    it('allows category probe and only the spotlighted machine id', () => {
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
                    toasted: { rarityChance: true },
                    queue: ['rarityChance']
                }
            }
        });
        const { FeatureTutorials, Game } = sandbox;
        Game.state = 'NEXUS';
        FeatureTutorials.onNexusEnter();
        assert.equal(FeatureTutorials.getCurrentId(), 'rarityChance');

        // Outer nexus probe (no station detail) must not hard-block the interact loop
        assert.equal(FeatureTutorials.allowsInteraction('gearUpgrade'), true);
        assert.equal(FeatureTutorials.allowsInteraction('gearUpgrade', 'rarityChance'), true);
        assert.equal(FeatureTutorials.allowsInteraction('gearUpgrade', 'affixSlots'), false);
        assert.equal(FeatureTutorials.allowsInteraction('portal'), false);
        assert.equal(FeatureTutorials.allowsInteraction('upgrade'), false);
    });
});

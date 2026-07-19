/**
 * Room 0 first-run combat tutorial
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function loadSandbox(options = {}) {
    const saveCode = fs.readFileSync(path.join(__dirname, '../src/game/content/save.js'), 'utf8');
    const room0Code = fs.readFileSync(path.join(__dirname, '../src/game/content/room0-tutorial.js'), 'utf8');
    const coachCode = fs.readFileSync(path.join(__dirname, '../src/game/content/coach-transition.js'), 'utf8');

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
        Date,
        performance: { now: () => Date.now() },
        setTimeout: (fn) => fn(),
        Game: options.Game || {
            state: 'PLAYING',
            config: { width: 1920, height: 1080 },
            camera: { x: 900, y: 500 },
            baseZoom: 1,
            mobileZoom: 1,
            player: { x: 200, y: 500, isDodging: false },
            multiplayerEnabled: !!options.multiplayer,
            roomNumber: 0
        },
        multiplayerManager: options.multiplayer
            ? { lobbyCode: 'ABCD' }
            : null,
        currentRoom: options.currentRoom || null,
        SaveSystem: null,
        Room0Tutorial: null,
        Engine: null,
        GameInput: null,
        Enemy: options.Enemy || class Enemy {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.alive = true;
                this.maxHp = 80;
                this.hp = 80;
                this.moveSpeed = 100;
                this.baseMoveSpeed = 100;
                this.lootChance = 0.1;
                this.xpValue = 10;
                this.size = 20;
            }
        },
        BASIC_ENEMY_CONFIG: { maxHp: 80, moveSpeed: 100, xpValue: 10 }
    };
    sandbox.window = Object.assign(sandbox.window, sandbox);

    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/engine/save.js'), 'utf8'), sandbox);
    if (sandbox.window && sandbox.window.Engine) sandbox.Engine = sandbox.window.Engine;
    vm.runInNewContext(
        saveCode + '\nthis.SaveSystem = SaveSystem;\n'
        + coachCode + '\nthis.CoachTransition = CoachTransition;\n'
        + room0Code + '\nthis.Room0Tutorial = Room0Tutorial;\n',
        sandbox
    );

    const inputMode = options.inputMode || 'desktop';
    if (!sandbox.Engine) sandbox.Engine = {};
    sandbox.Engine.Input = {
        _mode: inputMode,
        isGamepadMode() { return this._mode === 'gamepad'; },
        isMobileUiMode() { return this._mode === 'mobile'; }
    };
    sandbox.GameInput = {
        getCombatPrompt(ability) {
            const key = String(ability || '').toLowerCase();
            const desktop = { primary: 'LMB', heavy: 'RMB', special: 'Space', dash: 'Shift' };
            const mobile = { primary: 'Tap Primary', heavy: 'Tap Heavy', special: 'Tap Special', dash: 'Tap Dodge' };
            const gamepad = { primary: 'RT', heavy: 'LT', special: 'LB', dash: 'RB' };
            const input = sandbox.Engine.Input;
            if (input.isGamepadMode()) return gamepad[key] || '';
            if (input.isMobileUiMode()) return mobile[key] || '';
            return desktop[key] || '';
        }
    };
    sandbox.window.Engine = sandbox.Engine;
    sandbox.window.GameInput = sandbox.GameInput;

    return sandbox;
}

/** Mirror the advanceToNextRoom room-0 / safe-room guard from main.js */
function simulateAdvanceRoomNumber(state) {
    if (state.roomNumber === 0 || state.roomType === 'tutorial') {
        state.roomNumber = 1;
        state.enteringSafeRoom = false;
        return state;
    }
    if (state.gameMode === 'gear' && state.roomType !== 'safe') {
        if (state.roomNumber > 0 && state.roomNumber % 5 === 0) {
            state.enteringSafeRoom = true;
        } else {
            state.roomNumber++;
        }
    } else {
        state.roomNumber++;
    }
    return state;
}

describe('Room0Tutorial save flag', () => {
    it('defaults room0TutorialDone to false for new saves', () => {
        const { SaveSystem } = loadSandbox();
        const ob = SaveSystem.getOnboarding();
        assert.equal(ob.room0TutorialDone, false);
    });

    it('grandfathers veterans with completed onboarding and no explicit flag', () => {
        const { SaveSystem } = loadSandbox({
            seedSave: {
                onboarding: {
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true,
                    complete: true,
                    tutorialVersion: 1
                    // room0TutorialDone intentionally omitted
                }
            }
        });
        const ob = SaveSystem.getOnboarding();
        assert.equal(ob.room0TutorialDone, true);
    });

    it('persists markDone via SaveSystem', () => {
        const { SaveSystem, Room0Tutorial } = loadSandbox();
        assert.equal(SaveSystem.getOnboarding().room0TutorialDone, false);
        Room0Tutorial.markDone();
        assert.equal(SaveSystem.getOnboarding().room0TutorialDone, true);
        assert.equal(Room0Tutorial.isActive(), false);
    });

    it('skips entry in multiplayer lobby', () => {
        const { Room0Tutorial } = loadSandbox({ multiplayer: true });
        assert.equal(Room0Tutorial.shouldEnter(), false);
    });

    it('enters when solo and flag unset', () => {
        const { Room0Tutorial } = loadSandbox();
        assert.equal(Room0Tutorial.shouldEnter(), true);
    });
});

describe('Room0Tutorial steps', () => {
    it('starts empty, then spawns dummy after dash', () => {
        const sandbox = loadSandbox();
        const { Room0Tutorial } = sandbox;
        Room0Tutorial.ARM_DELAY_MS = 0;

        const room = { number: 0, type: 'tutorial', enemies: [] };
        sandbox.currentRoom = room;
        Room0Tutorial.setupRoom(room);

        assert.equal(room.width, Room0Tutorial.ROOM_WIDTH);
        assert.equal(room.height, Room0Tutorial.ROOM_HEIGHT);
        assert.equal(room.layout.archetype, 'tutorial');
        assert.equal(room.enemies.length, 0);
        assert.equal(Room0Tutorial.step, Room0Tutorial.STEPS.DASH);
        assert.equal(Room0Tutorial.getAllowedAction(), 'dash');

        // Dash line sits just to the right of left spawn
        const spawnX = room.layout.spawnZone.x;
        assert.ok(Room0Tutorial.markers.dashLine.x > spawnX);
        assert.ok(Room0Tutorial.markers.dashLine.x - spawnX < 220);

        sandbox.Game.player.x = Room0Tutorial.markers.dashLine.x - 40;
        Room0Tutorial._dashSide = 'left';
        sandbox.Game.player.isDodging = true;
        sandbox.Game.player.x = Room0Tutorial.markers.dashLine.x + 40;
        Room0Tutorial.update(0.016);

        assert.equal(Room0Tutorial.step, Room0Tutorial.STEPS.PRIMARY);
        assert.equal(room.enemies.length, 1);
        assert.equal(room.enemies[0].tutorialFrozen, true);
        assert.equal(room.enemies[0].xpValue, 0);

        const dummy = room.enemies[0];
        Room0Tutorial.notifyCombatAction('primary');
        Room0Tutorial.onDummyDamaged(dummy);
        assert.equal(Room0Tutorial.step, Room0Tutorial.STEPS.HEAVY);

        Room0Tutorial.notifyCombatAction('heavy');
        Room0Tutorial.onDummyDamaged(dummy);
        assert.equal(Room0Tutorial.step, Room0Tutorial.STEPS.SPECIAL);

        Room0Tutorial.notifyCombatAction('special');
        Room0Tutorial.onDummyDamaged(dummy);
        assert.equal(Room0Tutorial.step, Room0Tutorial.STEPS.WARNING);
    });

    it('completes SPECIAL on cast for utility specials', () => {
        const sandbox = loadSandbox();
        const { Room0Tutorial } = sandbox;
        Room0Tutorial.ARM_DELAY_MS = 0;
        const room = { number: 0, type: 'tutorial', enemies: [] };
        sandbox.currentRoom = room;
        Room0Tutorial.setupRoom(room);
        Room0Tutorial.spawnDummy();

        // Mobility, defense, and decoy specials mark casting as sufficient via profile.
        sandbox.Game.player.room0Tutorial = { specialCompletesOnCast: true };

        Room0Tutorial._setStep(Room0Tutorial.STEPS.SPECIAL);
        Room0Tutorial._armedAt = 0;
        Room0Tutorial.notifyCombatAction('special');

        assert.equal(Room0Tutorial.step, Room0Tutorial.STEPS.WARNING);
    });

    it('uses class-fed coach copy for ability steps', () => {
        const sandbox = loadSandbox();
        const { Room0Tutorial } = sandbox;
        Room0Tutorial.ARM_DELAY_MS = 0;
        const room = { number: 0, type: 'tutorial', enemies: [] };
        sandbox.currentRoom = room;
        Room0Tutorial.setupRoom(room);
        sandbox.Game.player.room0Tutorial = {
            specialCompletesOnCast: true,
            dash: {
                title: 'Dash',
                body: 'Dash across the line{hint}. Rogues have two dodge charges.'
            },
            primary: {
                title: 'Knife Throw',
                body: 'Throw a knife{hint} at the dummy.'
            },
            heavy: {
                title: 'Fan of Knives',
                body: 'Fan knives{hint} into the dummy.'
            },
            special: {
                title: 'Shadow Clones',
                body: 'Deploy Shadow Clones{hint} — decoys that draw attention.'
            }
        };

        Room0Tutorial._setStep(Room0Tutorial.STEPS.DASH);
        Room0Tutorial._armedAt = 0;
        let copy = Room0Tutorial.getCoachCopy();
        assert.equal(copy.title, 'Dash');
        assert.match(copy.body, /two dodge charges/);
        assert.match(copy.body, /\(Shift\)/);

        Room0Tutorial._setStep(Room0Tutorial.STEPS.PRIMARY);
        Room0Tutorial._armedAt = 0;
        copy = Room0Tutorial.getCoachCopy();
        assert.equal(copy.title, 'Knife Throw');
        assert.match(copy.body, /Throw a knife \(LMB\) at the dummy/);

        Room0Tutorial._setStep(Room0Tutorial.STEPS.SPECIAL);
        Room0Tutorial._armedAt = 0;
        copy = Room0Tutorial.getCoachCopy();
        assert.equal(copy.title, 'Shadow Clones');
        assert.match(copy.body, /Deploy Shadow Clones \(Space\)/);
        assert.doesNotMatch(copy.body, /dummy/i);
    });

    it('falls back to generic coach copy without a class profile', () => {
        const sandbox = loadSandbox();
        const { Room0Tutorial } = sandbox;
        Room0Tutorial.ARM_DELAY_MS = 0;
        const room = { number: 0, type: 'tutorial', enemies: [] };
        sandbox.currentRoom = room;
        Room0Tutorial.setupRoom(room);
        Room0Tutorial._setStep(Room0Tutorial.STEPS.PRIMARY);
        Room0Tutorial._armedAt = 0;

        const copy = Room0Tutorial.getCoachCopy();
        assert.equal(copy.title, 'Primary');
        assert.match(copy.body, /Use Primary \(LMB\) on the dummy/);
    });

    it('routes every class special activation through the tutorial notifier', () => {
        const playersDir = path.join(__dirname, '../src/game/entities/players');
        const activations = {
            'player-mage.js': 'activateBlink',
            'player-rogue.js': 'activateShadowClones',
            'player-tank.js': 'activateShield',
            'player-warrior.js': 'activateWhirlwind'
        };

        for (const [file, method] of Object.entries(activations)) {
            const source = fs.readFileSync(path.join(playersDir, file), 'utf8');
            const methodStart = source.indexOf(`\n    ${method}(`);
            assert.notEqual(methodStart, -1, `${file} is missing ${method}`);
            const methodBody = source.slice(methodStart, methodStart + 240);
            assert.match(
                methodBody,
                /notifyTutorialCombatAction\('special'\)/,
                `${file} must notify room 0 when its special activates`
            );
        }

        for (const file of ['player-mage.js', 'player-rogue.js', 'player-tank.js']) {
            const source = fs.readFileSync(path.join(playersDir, file), 'utf8');
            assert.match(
                source,
                /specialCompletesOnCast:\s*true/,
                `${file} utility special should complete on cast via room0Tutorial`
            );
            assert.match(
                source,
                /this\.room0Tutorial\s*=/,
                `${file} must assign room0Tutorial onto the player instance`
            );
        }

        const warriorSource = fs.readFileSync(path.join(playersDir, 'player-warrior.js'), 'utf8');
        assert.match(warriorSource, /specialCompletesOnCast:\s*false/);
        assert.match(warriorSource, /this\.room0Tutorial\s*=/);
    });

    it('does not complete PRIMARY or HEAVY on cast even with the decoy flag', () => {
        const sandbox = loadSandbox();
        const { Room0Tutorial } = sandbox;
        Room0Tutorial.ARM_DELAY_MS = 0;
        const room = { number: 0, type: 'tutorial', enemies: [] };
        sandbox.currentRoom = room;
        Room0Tutorial.setupRoom(room);
        Room0Tutorial.spawnDummy();
        sandbox.Game.player.room0Tutorial = { specialCompletesOnCast: true };

        Room0Tutorial._setStep(Room0Tutorial.STEPS.PRIMARY);
        Room0Tutorial._armedAt = 0;
        Room0Tutorial.notifyCombatAction('primary');
        assert.equal(Room0Tutorial.step, Room0Tutorial.STEPS.PRIMARY);

        Room0Tutorial._setStep(Room0Tutorial.STEPS.HEAVY);
        Room0Tutorial._armedAt = 0;
        Room0Tutorial.notifyCombatAction('heavy');
        assert.equal(Room0Tutorial.step, Room0Tutorial.STEPS.HEAVY);
    });

    it('doubles dummy HP for practice and fight phases', () => {
        const sandbox = loadSandbox();
        const { Room0Tutorial } = sandbox;
        Room0Tutorial.ARM_DELAY_MS = 0;
        const room = { number: 0, type: 'tutorial', enemies: [] };
        sandbox.currentRoom = room;
        Room0Tutorial.setupRoom(room);
        const dummy = Room0Tutorial.spawnDummy();

        // Practice dummy: at least 2x base enemy HP, floor of 560
        assert.equal(dummy.maxHp, 560);
        assert.equal(dummy.hp, 560);

        // Fight phase: 2x BASIC_ENEMY_CONFIG.maxHp (80 in sandbox)
        Room0Tutorial.activateDummy();
        assert.equal(dummy.maxHp, 160);
        assert.equal(dummy.hp, 160);
    });

    it('blocks combat until arm delay elapses', () => {
        const { Room0Tutorial } = loadSandbox();
        Room0Tutorial.ARM_DELAY_MS = 5000;
        Room0Tutorial.active = true;
        Room0Tutorial.step = Room0Tutorial.STEPS.PRIMARY;
        Room0Tutorial._armedAt = Date.now() + 5000;
        assert.equal(Room0Tutorial.getAllowedAction(), 'none');
        assert.equal(Room0Tutorial.isArmed(), false);
    });

    it('activates dummy after warning and allows all combat on KILL', () => {
        const sandbox = loadSandbox();
        const { Room0Tutorial } = sandbox;
        Room0Tutorial.ARM_DELAY_MS = 0;
        const room = { number: 0, type: 'tutorial', enemies: [] };
        sandbox.currentRoom = room;
        Room0Tutorial.setupRoom(room);
        Room0Tutorial.spawnDummy();
        Room0Tutorial._setStep(Room0Tutorial.STEPS.WARNING);
        Room0Tutorial._armedAt = 0;
        Room0Tutorial._stepTimer = Room0Tutorial.WARNING_DURATION;
        Room0Tutorial.update(0.016);
        assert.equal(Room0Tutorial.step, Room0Tutorial.STEPS.KILL);
        assert.equal(Room0Tutorial.getAllowedAction(), 'all');
        assert.equal(room.enemies[0].tutorialFrozen, false);
        assert.ok(room.enemies[0].moveSpeed > 0);
    });

    it('opens exit-door coach with spotlight after the kill', () => {
        const sandbox = loadSandbox();
        const { Room0Tutorial } = sandbox;
        Room0Tutorial.ARM_DELAY_MS = 0;
        const room = { number: 0, type: 'tutorial', enemies: [] };
        sandbox.currentRoom = room;
        Room0Tutorial.setupRoom(room);
        Room0Tutorial.spawnDummy();
        Room0Tutorial._setStep(Room0Tutorial.STEPS.KILL);
        Room0Tutorial._armedAt = 0;

        room.enemies[0].alive = false;
        Room0Tutorial.onDummyDied();

        assert.equal(Room0Tutorial.step, Room0Tutorial.STEPS.EXIT);
        assert.equal(Room0Tutorial.isExitCoachActive(), true);
        assert.equal(Room0Tutorial.getAllowedAction(), 'none');
        const copy = Room0Tutorial.getCoachCopy();
        assert.equal(copy.title, 'Exit Door');
        assert.match(copy.body, /exit door/i);
        const rect = Room0Tutorial.getExitSpotlightRect();
        assert.ok(rect);
        assert.ok(rect.w > 0 && rect.h > 0);
        const cam = Room0Tutorial.getCameraOverride();
        assert.ok(cam && Number.isFinite(cam.x));
    });
});

describe('GameInput.getCombatPrompt', () => {
    it('returns desktop / mobile / gamepad labels', () => {
        const desktop = loadSandbox({ inputMode: 'desktop' });
        assert.equal(desktop.GameInput.getCombatPrompt('primary'), 'LMB');
        assert.equal(desktop.GameInput.getCombatPrompt('dash'), 'Shift');

        const mobile = loadSandbox({ inputMode: 'mobile' });
        assert.equal(mobile.GameInput.getCombatPrompt('heavy'), 'Tap Heavy');

        const gamepad = loadSandbox({ inputMode: 'gamepad' });
        assert.equal(gamepad.GameInput.getCombatPrompt('special'), 'LB');
        assert.equal(gamepad.GameInput.getCombatPrompt('dash'), 'RB');
    });
});

describe('advanceToNextRoom room 0 guard', () => {
    it('goes 0 → 1 without inserting a safe room', () => {
        const state = {
            roomNumber: 0,
            roomType: 'tutorial',
            gameMode: 'gear',
            enteringSafeRoom: false
        };
        simulateAdvanceRoomNumber(state);
        assert.equal(state.roomNumber, 1);
        assert.equal(state.enteringSafeRoom, false);
    });

    it('still inserts safe rooms after room 5', () => {
        const state = {
            roomNumber: 5,
            roomType: 'normal',
            gameMode: 'gear',
            enteringSafeRoom: false
        };
        simulateAdvanceRoomNumber(state);
        assert.equal(state.enteringSafeRoom, true);
        assert.equal(state.roomNumber, 5);
    });

    it('does not treat roomNumber % 5 === 0 as safe when leaving tutorial was the only trap', () => {
        // 0 % 5 === 0 - the old buggy condition
        assert.equal(0 % 5 === 0, true);
        const state = { roomNumber: 0, roomType: 'tutorial', gameMode: 'gear', enteringSafeRoom: false };
        simulateAdvanceRoomNumber(state);
        assert.equal(state.enteringSafeRoom, false);
    });
});

describe('tutorial reward skip', () => {
    it('isTutorialRoom detects type and room number', () => {
        const { Room0Tutorial } = loadSandbox();
        assert.equal(Room0Tutorial.isTutorialRoom({ type: 'tutorial', number: 0 }), true);
        assert.equal(Room0Tutorial.isTutorialRoom({ type: 'normal', number: 1 }), false);
        assert.equal(Room0Tutorial.isTutorialRoom({ type: 'normal', number: 0 }), true);
    });

    it('cleared tutorial room sets rewardsGranted without spawning loot path', () => {
        // Mirrors checkRoomCleared early-out for tutorial rooms
        const room = {
            type: 'tutorial',
            number: 0,
            cleared: true,
            doorOpen: true,
            rewardsGranted: false,
            enemies: []
        };
        if (room.cleared && !room.rewardsGranted) {
            if (room.type === 'tutorial' || room.number === 0) {
                room.rewardsGranted = true;
            }
        }
        assert.equal(room.rewardsGranted, true);
        assert.equal(room.doorOpen, true);
    });
});


describe('CoachTransition framing', () => {
    it('frames camera so player stays visible with spotlight on a small mobile viewport', () => {
        const { CoachTransition } = loadSandbox({
            Game: {
                state: 'PLAYING',
                config: { width: 800, height: 450 },
                camera: { x: 0, y: 0 },
                baseZoom: 1,
                mobileZoom: 1.15,
                player: { x: 200, y: 360, size: 28 },
                multiplayerEnabled: false,
                roomNumber: 0
            }
        });
        // Force mobile buffers via stub
        const oldMobile = CoachTransition._isMobile;
        CoachTransition._isMobile = () => true;
        const focusRect = { x: 1100, y: 300, w: 80, h: 100 };
        const framed = CoachTransition.frameCameraTarget({
            focusRect,
            playerX: 200,
            playerY: 360,
            viewHalfW: 800 / (2 * 1.15),
            viewHalfH: 450 / (2 * 1.15)
        });
        CoachTransition._isMobile = oldMobile;
        assert.ok(framed);
        const halfW = 800 / (2 * 1.15);
        const halfH = 450 / (2 * 1.15);
        // Player must remain inside the camera window with margin
        assert.ok(Math.abs(framed.x - 200) <= halfW - 40, `player X offscreen: cam=${framed.x}`);
        assert.ok(Math.abs(framed.y - 360) <= halfH - 40, `player Y offscreen: cam=${framed.y}`);
    });
});


describe('Multiplayer Room 0 gate', () => {
    it('blocks multiplayer until room0TutorialDone', () => {
        const { SaveSystem } = loadSandbox();
        assert.equal(SaveSystem.hasFinishedRoom0Tutorial(), false);
        assert.equal(SaveSystem.canAccessMultiplayer(), false);
        assert.match(SaveSystem.getMultiplayerLockHint(), /Room 0|first run/i);
    });

    it('allows multiplayer after Room 0 is marked done', () => {
        const { SaveSystem, Room0Tutorial } = loadSandbox();
        Room0Tutorial.markDone();
        assert.equal(SaveSystem.hasFinishedRoom0Tutorial(), true);
        assert.equal(SaveSystem.canAccessMultiplayer(), true);
        assert.equal(SaveSystem.getMultiplayerLockHint(), null);
    });

    it('allows multiplayer for grandfathered veterans', () => {
        const { SaveSystem } = loadSandbox({
            seedSave: {
                onboarding: {
                    selectClassDone: true,
                    launchRunDone: true,
                    classUpgradesDone: true,
                    firstRunStarted: true,
                    complete: true,
                    tutorialVersion: 1
                }
            }
        });
        assert.equal(SaveSystem.canAccessMultiplayer(), true);
    });
});

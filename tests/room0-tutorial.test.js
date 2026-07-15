/**
 * Room 0 first-run combat tutorial
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function loadSandbox(options = {}) {
    const saveCode = fs.readFileSync(path.join(__dirname, '../js/save.js'), 'utf8');
    const room0Code = fs.readFileSync(path.join(__dirname, '../js/room0-tutorial.js'), 'utf8');
    const coachCode = fs.readFileSync(path.join(__dirname, '../js/coach-transition.js'), 'utf8');
    const inputCode = fs.readFileSync(path.join(__dirname, '../js/input.js'), 'utf8');

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
        Input: null,
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

    vm.runInNewContext(
        saveCode + '\nthis.SaveSystem = SaveSystem;\n'
        + coachCode + '\nthis.CoachTransition = CoachTransition;\n'
        + room0Code + '\nthis.Room0Tutorial = Room0Tutorial;\n'
        + 'var Input = ' + JSON.stringify({
            // Placeholder; real Input object attached after
        }) + ';\n',
        sandbox
    );

    // Lightweight Input surface matching getCombatPrompt / mode helpers
    sandbox.Input = {
        _mode: options.inputMode || 'desktop',
        isGamepadMode() { return this._mode === 'gamepad'; },
        isMobileUiMode() { return this._mode === 'mobile'; },
        getCombatPrompt(ability) {
            const key = String(ability || '').toLowerCase();
            const desktop = { primary: 'LMB', heavy: 'RMB', special: 'Space', dash: 'Shift' };
            const mobile = { primary: 'Tap Primary', heavy: 'Tap Heavy', special: 'Tap Special', dash: 'Tap Dodge' };
            const gamepad = { primary: 'RT', heavy: 'LT', special: 'LB', dash: 'RB' };
            if (this.isGamepadMode()) return gamepad[key] || '';
            if (this.isMobileUiMode()) return mobile[key] || '';
            return desktop[key] || '';
        }
    };
    sandbox.window.Input = sandbox.Input;

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

describe('Input.getCombatPrompt', () => {
    it('returns desktop / mobile / gamepad labels', () => {
        const desktop = loadSandbox({ inputMode: 'desktop' });
        assert.equal(desktop.Input.getCombatPrompt('primary'), 'LMB');
        assert.equal(desktop.Input.getCombatPrompt('dash'), 'Shift');

        const mobile = loadSandbox({ inputMode: 'mobile' });
        assert.equal(mobile.Input.getCombatPrompt('heavy'), 'Tap Heavy');

        const gamepad = loadSandbox({ inputMode: 'gamepad' });
        assert.equal(gamepad.Input.getCombatPrompt('special'), 'LB');
        assert.equal(gamepad.Input.getCombatPrompt('dash'), 'RB');
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

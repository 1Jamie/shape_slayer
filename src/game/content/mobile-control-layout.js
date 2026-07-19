// Mobile control layout schema v2:
// - Global absolute logical positions/sizes
// - Per-class control type overrides (typesByClass)
// Coordinates are in Game.config logical space.

const MobileControlLayout = {
    VERSION: 2,
    CONTROL_IDS: ['movement', 'basicAttack', 'heavyAttack', 'specialAbility', 'dodge'],
    TYPEABLE_IDS: ['heavyAttack', 'specialAbility', 'dodge'],
    CLASS_IDS: ['square', 'triangle', 'pentagon', 'hexagon'],

    SHORT_LABELS: {
        movement: 'MOVE',
        basicAttack: 'ATK',
        heavyAttack: 'HVY',
        specialAbility: 'SPC',
        dodge: 'DSH'
    },

    // Player-facing control types. Runtime modes (press-release vs continuous hold)
    // are derived from the ability family — they are not separate player choices.
    TYPE_META: {
        button: {
            id: 'button',
            label: 'Tap',
            blurb: 'Fires when you press (or along your current facing).'
        },
        aim: {
            id: 'aim',
            label: 'Aim',
            blurb: 'Drag to aim. Release to fire — or hold for abilities that stay active (shield).'
        }
    },

    // Legacy ids still seen in old saves / classInputConfig defaults
    LEGACY_AIM_TYPES: {
        'joystick-press-release': true,
        'joystick-continuous': true,
        aim: true
    },

    CLASS_LABELS: {
        square: 'Warrior',
        triangle: 'Rogue',
        pentagon: 'Tank',
        hexagon: 'Mage'
    },

    // Semantic family per class+ability (drives adapters + help text)
    ABILITY_FAMILY: {
        square: {
            heavyAttack: 'aimThenFire',
            specialAbility: 'instant',
            dodge: 'instant'
        },
        triangle: {
            heavyAttack: 'aimThenFire',
            specialAbility: 'instant',
            dodge: 'aimThenFire'
        },
        pentagon: {
            heavyAttack: 'instant',
            specialAbility: 'continuous',
            dodge: 'instant'
        },
        hexagon: {
            heavyAttack: 'aimThenFire',
            specialAbility: 'aimThenFire',
            dodge: 'instant'
        }
    },

    /** Collapse legacy / runtime ids to player-facing Tap | Aim. */
    toUserType(type) {
        if (!type || type === 'button') return 'button';
        if (type === 'joystick') return 'joystick'; // move / basic attack only
        if (this.LEGACY_AIM_TYPES[type]) return 'aim';
        return 'button';
    },

    generateDefaultLayout(width, height, options = {}) {
        const safeInsets = options.safeInsets || { top: 0, right: 0, bottom: 0, left: 0 };
        const isMobile = options.isMobile !== false;
        const displayScaleX = options.displayScaleX > 0 ? options.displayScaleX : 1;
        const displayScaleY = options.displayScaleY > 0 ? options.displayScaleY : 1;

        const widthScale = Math.max(0.7, Math.min(1.3, width / 1280));
        const movementRadius = Math.floor(60 * widthScale);
        const basicAttackRadius = Math.floor(55 * widthScale);
        const buttonSize = Math.floor(54 * widthScale);
        const abilityJoystickRadius = Math.floor(buttonSize * 0.52);

        const safeAreaOffsetY = (safeInsets.bottom || 0) * displayScaleY;
        const safeAreaOffsetLeft = (safeInsets.left || 0) * displayScaleX;
        const safeAreaOffsetRight = (safeInsets.right || 0) * displayScaleX;

        const rightX = width - Math.max(130, width * 0.10) - safeAreaOffsetRight;
        const radialRadius = basicAttackRadius + Math.floor(58 * widthScale);
        const mobileBottomOffset = Math.max(height * 0.20, 100);
        const rightY = (isMobile
            ? height - mobileBottomOffset
            : height - Math.max(140, height * 0.18)) - safeAreaOffsetY;

        const leftX = Math.max(100, width * 0.08) + safeAreaOffsetLeft;
        const leftY = isMobile ? rightY : height - Math.max(120, height * 0.16);

        const angles = {
            heavyAttack: Math.PI * 0.7,
            specialAbility: Math.PI * 0.3,
            dodge: Math.PI * 1.5
        };

        const abilityCenter = (id) => ({
            x: rightX + Math.cos(angles[id]) * radialRadius,
            y: rightY + Math.sin(angles[id]) * radialRadius
        });

        const heavy = abilityCenter('heavyAttack');
        const special = abilityCenter('specialAbility');
        const dodge = abilityCenter('dodge');

        const mk = (id, x, y, w, h, radius, deadZone) => ({
            id,
            x,
            y,
            w,
            h,
            radius,
            deadZone,
            visible: true,
            opacity: 1,
            label: this.SHORT_LABELS[id] || id
        });

        return {
            version: this.VERSION,
            customized: false,
            logicalWidth: width,
            logicalHeight: height,
            controls: {
                movement: mk('movement', leftX, leftY, movementRadius * 2, movementRadius * 2, movementRadius, 20),
                basicAttack: mk('basicAttack', rightX, rightY, basicAttackRadius * 2, basicAttackRadius * 2, basicAttackRadius, 20),
                heavyAttack: mk('heavyAttack', heavy.x, heavy.y, buttonSize, buttonSize, abilityJoystickRadius, 14),
                specialAbility: mk('specialAbility', special.x, special.y, buttonSize, buttonSize, abilityJoystickRadius, 14),
                dodge: mk('dodge', dodge.x, dodge.y, buttonSize, buttonSize, abilityJoystickRadius, 14)
            },
            typesByClass: {}
        };
    },

    cloneLayout(layout) {
        if (!layout) return null;
        return JSON.parse(JSON.stringify(layout));
    },

    getClassDefaultType(playerClass, controlId) {
        // Returns legacy/runtime default from classInputConfig (button | joystick-*)
        if (controlId === 'movement' || controlId === 'basicAttack') return 'joystick';
        if ((typeof Engine !== 'undefined' && Engine.Input) && GameInput.classInputConfig && GameInput.classInputConfig[playerClass]) {
            return GameInput.classInputConfig[playerClass][controlId] || 'button';
        }
        const fallback = {
            square: { heavyAttack: 'joystick-press-release', specialAbility: 'button', dodge: 'button' },
            triangle: { heavyAttack: 'joystick-press-release', specialAbility: 'button', dodge: 'joystick-press-release' },
            pentagon: { heavyAttack: 'button', specialAbility: 'joystick-continuous', dodge: 'button' },
            hexagon: { heavyAttack: 'joystick-press-release', specialAbility: 'joystick-press-release', dodge: 'button' }
        };
        return (fallback[playerClass] && fallback[playerClass][controlId]) || 'button';
    },

    /** Player-facing default: Tap or Aim. */
    getClassDefaultUserType(playerClass, controlId) {
        return this.toUserType(this.getClassDefaultType(playerClass, controlId));
    },

    getAbilityFamily(playerClass, controlId) {
        const row = this.ABILITY_FAMILY[playerClass];
        return (row && row[controlId]) || 'instant';
    },

    /**
     * Map a chosen player type (Tap / Aim) onto a runtime input mode for the ability family.
     * Returns one of: button | joystick-press-release | joystick-continuous | joystick
     *
     * Aim is one player choice — whether release-fires or hold-stays-active is the ability's job.
     */
    adaptAbilityInput(playerClass, controlId, chosenType) {
        if (controlId === 'movement' || controlId === 'basicAttack') return 'joystick';
        const family = this.getAbilityFamily(playerClass, controlId);
        const user = this.toUserType(chosenType || this.getClassDefaultType(playerClass, controlId));

        if (user === 'button') return 'button';

        // Aim: continuous abilities stay held; everything else aims then fires on release
        if (family === 'continuous') return 'joystick-continuous';
        return 'joystick-press-release';
    },

    getTypeHelp(playerClass, controlId, chosenType) {
        const user = this.toUserType(chosenType);
        const meta = this.TYPE_META[user] || this.TYPE_META.button;
        const family = this.getAbilityFamily(playerClass, controlId);

        if (user === 'button') {
            if (playerClass === 'pentagon' && controlId === 'specialAbility') {
                return 'Tap to raise or lower your shield.';
            }
            if (family === 'aimThenFire') {
                return 'Fires immediately along your current facing (no drag aim).';
            }
            return meta.blurb;
        }

        // Aim
        if (playerClass === 'hexagon' && controlId === 'specialAbility') {
            return 'Blink distance grows while you hold; releases or auto-fires at max.';
        }
        if (playerClass === 'hexagon' && controlId === 'heavyAttack') {
            return 'Shows a beam telegraph while you aim; fires on release.';
        }
        if (playerClass === 'pentagon' && controlId === 'specialAbility') {
            return 'Hold to keep the shield up; release to drop it.';
        }
        if (family === 'continuous') {
            return 'Hold to keep the ability active; release to end it.';
        }
        if (family === 'instant') {
            return 'Drag to face a direction, then release to fire.';
        }
        return 'Drag to aim, then release to fire.';
    },

    migrateV1ToV2(saved, currentClass) {
        if (!saved || typeof saved !== 'object') return null;
        // Still normalize typesByClass to Tap|Aim even on already-v2 saves
        if (saved.version >= 2 && saved.typesByClass) {
            const migrated = this.cloneLayout(saved);
            migrated.version = 2;
            for (const cid of this.CLASS_IDS) {
                if (!migrated.typesByClass[cid]) continue;
                for (const id of this.TYPEABLE_IDS) {
                    if (migrated.typesByClass[cid][id]) {
                        migrated.typesByClass[cid][id] = this.toUserType(migrated.typesByClass[cid][id]);
                    }
                }
            }
            return migrated;
        }

        const migrated = this.cloneLayout(saved) || { controls: {}, customized: !!saved.customized };
        migrated.version = 2;
        migrated.typesByClass = migrated.typesByClass || {};

        const classId = currentClass && this.CLASS_IDS.includes(currentClass) ? currentClass : null;
        const targetClasses = classId ? [classId] : this.CLASS_IDS.slice();

        for (const cid of targetClasses) {
            migrated.typesByClass[cid] = migrated.typesByClass[cid] || {};
            for (const id of this.TYPEABLE_IDS) {
                const ctrl = saved.controls && saved.controls[id];
                if (ctrl && ctrl.customType && ctrl.type) {
                    migrated.typesByClass[cid][id] = this.toUserType(ctrl.type);
                }
            }
        }

        for (const cid of this.CLASS_IDS) {
            if (!migrated.typesByClass[cid]) continue;
            for (const id of this.TYPEABLE_IDS) {
                if (migrated.typesByClass[cid][id]) {
                    migrated.typesByClass[cid][id] = this.toUserType(migrated.typesByClass[cid][id]);
                }
            }
        }

        // Strip per-control type fields from geometry
        if (migrated.controls) {
            for (const id of this.CONTROL_IDS) {
                if (!migrated.controls[id]) continue;
                delete migrated.controls[id].type;
                delete migrated.controls[id].customType;
                migrated.controls[id].label = this.SHORT_LABELS[id] || migrated.controls[id].label;
            }
        }
        return migrated;
    },

    normalizeSavedLayout(saved, width, height, options = {}) {
        if (!saved || typeof saved !== 'object' || !saved.controls) return null;
        const currentClass = options.playerClass ||
            (typeof Game !== 'undefined' && Game.player && Game.player.playerClass) ||
            (typeof SaveSystem !== 'undefined' && SaveSystem.load && SaveSystem.load().selectedClass) ||
            null;

        const migrated = this.migrateV1ToV2(saved, currentClass);
        const safeInsets = options.safeInsets || { top: 0, right: 0, bottom: 0, left: 0 };
        const scaleX = options.displayScaleX > 0 ? options.displayScaleX : 1;
        const scaleY = options.displayScaleY > 0 ? options.displayScaleY : 1;
        const safeLeft = (safeInsets.left || 0) * scaleX;
        const safeRight = width - (safeInsets.right || 0) * scaleX;
        const safeTop = (safeInsets.top || 0) * scaleY;
        const safeBottom = height - (safeInsets.bottom || 0) * scaleY;
        const base = this.generateDefaultLayout(width, height, { isMobile: true });
        const out = {
            version: this.VERSION,
            customized: true,
            logicalWidth: width,
            logicalHeight: height,
            controls: {},
            typesByClass: {}
        };

        for (const id of this.CONTROL_IDS) {
            const def = base.controls[id];
            const src = migrated.controls[id] || {};
            const w = Number.isFinite(src.w) ? src.w : def.w;
            const h = Number.isFinite(src.h) ? src.h : def.h;
            const halfW = w / 2;
            const halfH = h / 2;
            let x = Number.isFinite(src.x) ? src.x : def.x;
            let y = Number.isFinite(src.y) ? src.y : def.y;
            x = Math.max(safeLeft + halfW, Math.min(safeRight - halfW, x));
            y = Math.max(safeTop + halfH, Math.min(safeBottom - halfH, y));
            out.controls[id] = {
                id,
                x,
                y,
                w,
                h,
                radius: Number.isFinite(src.radius) ? src.radius : def.radius,
                deadZone: Number.isFinite(src.deadZone) ? src.deadZone : def.deadZone,
                visible: src.visible !== false,
                opacity: Number.isFinite(src.opacity) ? Math.max(0.15, Math.min(1, src.opacity)) : def.opacity,
                label: this.SHORT_LABELS[id] || def.label
            };
        }

        for (const cid of this.CLASS_IDS) {
            const srcTypes = (migrated.typesByClass && migrated.typesByClass[cid]) || {};
            out.typesByClass[cid] = {};
            for (const id of this.TYPEABLE_IDS) {
                if (!srcTypes[id]) continue;
                const user = this.toUserType(srcTypes[id]);
                if (this.TYPE_META[user]) {
                    out.typesByClass[cid][id] = user;
                }
            }
        }

        return out;
    },

    getEffectiveLayout(width, height, options = {}) {
        const defaults = this.generateDefaultLayout(width, height, options);
        let saved = null;
        if (typeof SaveSystem !== 'undefined' && SaveSystem.getMobileControlLayout) {
            saved = SaveSystem.getMobileControlLayout();
        } else if (options.savedLayout) {
            saved = options.savedLayout;
        }
        if (saved && saved.customized) {
            return this.normalizeSavedLayout(saved, width, height, options) || defaults;
        }
        return defaults;
    },

    /** Player-facing chosen type: button | aim (or joystick for move/atk). */
    getChosenType(layout, playerClass, controlId) {
        if (controlId === 'movement' || controlId === 'basicAttack') return 'joystick';
        const override = layout && layout.typesByClass && layout.typesByClass[playerClass] &&
            layout.typesByClass[playerClass][controlId];
        if (override) {
            const user = this.toUserType(override);
            if (this.TYPE_META[user]) return user;
        }
        return this.getClassDefaultUserType(playerClass, controlId);
    },

    /** Resolve runtime control type for Input / DOM bridge. */
    resolveControlType(controlId, playerClass, layoutControl, layoutRoot) {
        const chosen = this.getChosenType(layoutRoot, playerClass, controlId);
        return this.adaptAbilityInput(playerClass, controlId, chosen);
    }
};

if (typeof window !== 'undefined') {
    window.MobileControlLayout = MobileControlLayout;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MobileControlLayout };
}

// Mobile control layout editor — global positions, per-class types, education UI.
(function () {
    'use strict';

    const EDITABLE_IDS = ['movement', 'basicAttack', 'heavyAttack', 'specialAbility', 'dodge'];
    const TYPEABLE_IDS = ['heavyAttack', 'specialAbility', 'dodge'];

    const CLASS_CHIPS = [
        { id: 'square', label: 'Warrior' },
        { id: 'triangle', label: 'Rogue' },
        { id: 'pentagon', label: 'Tank' },
        { id: 'hexagon', label: 'Mage' }
    ];

    const CONTROL_NAMES = {
        movement: 'Move',
        basicAttack: 'Attack',
        heavyAttack: 'Heavy',
        specialAbility: 'Special',
        dodge: 'Dodge'
    };

    const MobileControlEditor = {
        layer: null,
        backdrop: null,
        bar: null,
        badgeEl: null,
        chipsEl: null,
        helpEl: null,
        infoModal: null,
        popover: null,
        draft: null,
        editClass: 'hexagon',
        _drag: null,
        _open: false,
        _escapeHandler: null,
        _pausedByEditor: false,
        _helpControl: null,

        isOpen() { return this._open; },

        open() {
            if (this._open) return;
            if (typeof MobileControlsDOM === 'undefined') return;

            this._open = true;
            this._ensureLayer();

            this.editClass = this._detectClass();
            const opts = this._layoutOpts();
            opts.playerClass = this.editClass;

            const current = (typeof MobileControlLayout !== 'undefined')
                ? MobileControlLayout.getEffectiveLayout(opts.width, opts.height, opts)
                : null;
            this.draft = current ? MobileControlLayout.cloneLayout(current) : null;
            if (this.draft) {
                this.draft.version = MobileControlLayout.VERSION;
                this.draft.typesByClass = this.draft.typesByClass || {};
                // Don't force customized until user actually edits
                if (!this.draft.customized) this.draft.customized = false;
            }

            this._helpControl = null;
            this._showLayer(true);
            this._updateBadge();
            this._renderClassChips();
            this._updateHelp();

            MobileControlsDOM.setEditorMode(true);
            this._applyDraftToDom();
            this._bindControlDragging(true);
            this._renderTypeTriggers();

            this._escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.infoModal && !this.infoModal.hidden) {
                        this._hideInfo();
                        return;
                    }
                    if (this.popover && !this.popover.hidden) {
                        this._hidePopover();
                        return;
                    }
                    this.close(false);
                }
            };
            // Capture so Escape closes the editor instead of reaching pause/game handlers
            document.addEventListener('keydown', this._escapeHandler, true);

            this._pausedByEditor = false;
            if (typeof Game !== 'undefined' && Game.state === 'PLAYING' && typeof Game.togglePause === 'function') {
                Game.togglePause();
                this._pausedByEditor = true;
            }
        },

        close(apply) {
            if (!this._open) return;

            this._hidePopover();
            this._hideInfo();
            this._bindControlDragging(false);
            this._clearTypeTriggers();

            if (this._escapeHandler) {
                document.removeEventListener('keydown', this._escapeHandler, true);
                this._escapeHandler = null;
            }

            if (apply && this.draft && typeof SaveSystem !== 'undefined') {
                this.draft.customized = true;
                this.draft.version = (typeof MobileControlLayout !== 'undefined')
                    ? MobileControlLayout.VERSION
                    : 2;
                // Geometry-only + typesByClass; strip any leftover per-control types
                if (this.draft.controls) {
                    for (const id of EDITABLE_IDS) {
                        if (!this.draft.controls[id]) continue;
                        delete this.draft.controls[id].type;
                        delete this.draft.controls[id].customType;
                    }
                }
                SaveSystem.setMobileControlLayout(this.draft);
            }

            this._showLayer(false);
            this._open = false;
            this.draft = null;
            this._drag = null;

            if (typeof MobileControlsDOM !== 'undefined') {
                MobileControlsDOM.setEditorMode(false);
                if ((typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.initTouchControls && Game && Game.canvas) {
                    Engine.Input.initTouchControls(Game.canvas);
                } else {
                    MobileControlsDOM.refresh();
                }
            }
        },

        resetToDefault() {
            if (typeof SaveSystem !== 'undefined') {
                SaveSystem.resetMobileControlLayout();
            }
            const opts = this._layoutOpts();
            this.draft = (typeof MobileControlLayout !== 'undefined')
                ? MobileControlLayout.generateDefaultLayout(opts.width, opts.height, opts)
                : null;
            if (this.draft) {
                this.draft.customized = false;
                this.draft.typesByClass = {};
            }
            this._applyDraftToDom();
            this._renderTypeTriggers();
            this._updateHelp();
        },

        _detectClass() {
            if (typeof Game !== 'undefined' && Game.player && Game.player.playerClass) {
                return Game.player.playerClass;
            }
            if (typeof SaveSystem !== 'undefined' && SaveSystem.load) {
                const c = SaveSystem.load().selectedClass;
                if (c && CLASS_CHIPS.some((x) => x.id === c)) return c;
            }
            return 'hexagon';
        },

        _layoutOpts() {
            if (MobileControlsDOM._buildLayoutOptions) {
                return MobileControlsDOM._buildLayoutOptions();
            }
            return { width: 1280, height: 720, isMobile: true };
        },

        _showLayer(show) {
            if (!this.layer) return;
            this.layer.hidden = !show;
            this.layer.style.display = show ? 'block' : 'none';
            this.layer.setAttribute('aria-hidden', show ? 'false' : 'true');
            if (show) {
                this.layer.classList.add('mobile-control-editor-layer--open');
            } else {
                this.layer.classList.remove('mobile-control-editor-layer--open');
            }
            if (this.backdrop) {
                this.backdrop.hidden = !show;
                this.backdrop.style.display = show ? 'block' : 'none';
            }
        },

        _ensureLayer() {
            if (this.layer) return;
            const root = (window.UIRoot && UIRoot.ensure) ? UIRoot.ensure() : document.getElementById('ui-root');
            if (!root) return;

            // Backdrop lives in its own layer BELOW the lifted controls (z 10040 < 10045),
            // while the editor chrome layer sits ABOVE them (z 10050) so popovers aren't
            // trapped under controls by the parent stacking context.
            this.backdrop = document.createElement('div');
            this.backdrop.className = 'mobile-control-editor-backdrop';
            this.backdrop.hidden = true;
            this.backdrop.style.display = 'none';
            this.backdrop.addEventListener('click', () => {
                this._hidePopover();
            });
            root.appendChild(this.backdrop);

            this.layer = document.createElement('div');
            this.layer.className = 'mobile-control-editor-layer';
            this.layer.hidden = true;
            this.layer.style.display = 'none';

            this.bar = document.createElement('div');
            this.bar.className = 'mobile-control-editor-bar';

            this.badgeEl = document.createElement('div');
            this.badgeEl.className = 'mobile-control-editor-badge';
            this.bar.appendChild(this.badgeEl);

            this.chipsEl = document.createElement('div');
            this.chipsEl.className = 'mobile-control-editor-chips';
            this.bar.appendChild(this.chipsEl);

            const hint = document.createElement('div');
            hint.className = 'mobile-control-editor-hint';
            hint.textContent = 'Positions are shared for all classes. Types are per class.';
            this.bar.appendChild(hint);

            this.helpEl = document.createElement('div');
            this.helpEl.className = 'mobile-control-editor-help';
            this.bar.appendChild(this.helpEl);

            const actions = document.createElement('div');
            actions.className = 'mobile-control-editor-actions';

            const infoBtn = document.createElement('button');
            infoBtn.type = 'button';
            infoBtn.className = 'btn';
            infoBtn.textContent = 'How types work';
            infoBtn.addEventListener('click', () => this._showInfo());

            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'btn';
            saveBtn.textContent = 'Save';
            saveBtn.addEventListener('click', () => this.close(true));

            const resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.className = 'btn';
            resetBtn.textContent = 'Reset';
            resetBtn.addEventListener('click', () => this.resetToDefault());

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => this.close(false));

            actions.appendChild(infoBtn);
            actions.appendChild(saveBtn);
            actions.appendChild(resetBtn);
            actions.appendChild(cancelBtn);
            this.bar.appendChild(actions);

            this.layer.appendChild(this.bar);

            // Type popover (single, repositioned)
            this.popover = document.createElement('div');
            this.popover.className = 'mc-type-popover';
            this.popover.hidden = true;
            this.layer.appendChild(this.popover);

            // Info modal
            this.infoModal = document.createElement('div');
            this.infoModal.className = 'mc-type-info-modal';
            this.infoModal.hidden = true;
            this.infoModal.innerHTML =
                '<div class="mc-type-info-card">' +
                '<h3>How control types work</h3>' +
                '<p><strong>Positions are shared</strong> across every class — move a stick once and it stays there when you swap.</p>' +
                '<p><strong>Types are per class</strong> — Warrior Special can differ from Mage Special.</p>' +
                '<ul>' +
                '<li><strong>Tap</strong> — fires when you press (or along current facing). Shield toggles on/off.</li>' +
                '<li><strong>Aim</strong> — drag to aim. Release fires most abilities; hold-active ones (shield) stay up while pressed.</li>' +
                '</ul>' +
                '<p>Whether an Aimed ability fires on release or stays held is the move itself — not a separate control type.</p>' +
                '<button type="button" class="btn mc-type-info-close">Got it</button>' +
                '</div>';
            this.infoModal.querySelector('.mc-type-info-close').addEventListener('click', () => this._hideInfo());
            this.infoModal.addEventListener('click', (e) => {
                if (e.target === this.infoModal) this._hideInfo();
            });
            this.layer.appendChild(this.infoModal);

            root.appendChild(this.layer);
        },

        _updateBadge() {
            const name = (typeof MobileControlLayout !== 'undefined' && MobileControlLayout.CLASS_LABELS[this.editClass])
                || this.editClass;
            if (this.badgeEl) {
                this.badgeEl.textContent = `Editing types for: ${name}`;
            }
        },

        _renderClassChips() {
            if (!this.chipsEl) return;
            this.chipsEl.innerHTML = '';
            for (const chip of CLASS_CHIPS) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'mc-class-chip' + (chip.id === this.editClass ? ' is-active' : '');
                btn.textContent = chip.label;
                btn.addEventListener('click', () => {
                    this.editClass = chip.id;
                    this._updateBadge();
                    this._renderClassChips();
                    this._renderTypeTriggers();
                    this._updateHelp();
                    this._hidePopover();
                });
                this.chipsEl.appendChild(btn);
            }
        },

        _updateHelp(controlId) {
            if (!this.helpEl || typeof MobileControlLayout === 'undefined') return;
            if (controlId) this._helpControl = controlId;
            const id = this._helpControl;
            if (!id) {
                // Nothing selected yet: show an instruction instead of arbitrary ability text
                this.helpEl.textContent = 'Drag a control to move it. Tap the chip under a button to change how it fires.';
                return;
            }
            const chosen = MobileControlLayout.getChosenType(this.draft, this.editClass, id);
            const meta = MobileControlLayout.TYPE_META[chosen] || MobileControlLayout.TYPE_META.button;
            const name = CONTROL_NAMES[id] || id;
            this.helpEl.textContent =
                `${name} — ${meta.label}: ${MobileControlLayout.getTypeHelp(this.editClass, id, chosen)}`;
        },

        _showInfo() {
            if (!this.infoModal) return;
            this.infoModal.hidden = false;
            this.infoModal.style.display = 'flex';
        },

        _hideInfo() {
            if (!this.infoModal) return;
            this.infoModal.hidden = true;
            this.infoModal.style.display = 'none';
        },

        _applyDraftToDom() {
            if (!this.draft || typeof MobileControlsDOM === 'undefined') return;
            MobileControlsDOM.layout = this.draft;
            const sx = MobileControlsDOM._scaleX || 1;
            const sy = MobileControlsDOM._scaleY || 1;
            for (const id of EDITABLE_IDS) {
                const cfg = this.draft.controls[id];
                const node = MobileControlsDOM.nodes[id];
                if (!cfg || !node) continue;
                const size = Math.max(cfg.w, cfg.h) * ((sx + sy) * 0.5);
                node.el.style.left = `${cfg.x * sx}px`;
                node.el.style.top = `${cfg.y * sy}px`;
                node.el.style.width = `${size}px`;
                node.el.style.height = `${size}px`;
                node.el.style.opacity = cfg.opacity != null ? cfg.opacity : 1;
                node.el.hidden = cfg.visible === false;
                if (node.label) {
                    node.label.textContent = (MobileControlLayout && MobileControlLayout.SHORT_LABELS[id]) || cfg.label || '';
                }
            }
        },

        _bindControlDragging(on) {
            if (typeof MobileControlsDOM === 'undefined') return;
            for (const id of EDITABLE_IDS) {
                const node = MobileControlsDOM.nodes[id];
                if (!node) continue;
                if (on) {
                    if (!node._editorDown) {
                        node._editorDown = (e) => this._onDown(e, id);
                    }
                    node.el.addEventListener('pointerdown', node._editorDown);
                } else if (node._editorDown) {
                    node.el.removeEventListener('pointerdown', node._editorDown);
                }
            }
            if (!on) {
                if (this._onMoveBound) window.removeEventListener('pointermove', this._onMoveBound);
                if (this._onUpBound) {
                    window.removeEventListener('pointerup', this._onUpBound);
                    window.removeEventListener('pointercancel', this._onUpBound);
                }
            }
        },

        _onDown(e, id) {
            if (!this._open) return;
            // Type trigger buttons handle their own events
            if (e.target && e.target.closest && e.target.closest('.mc-type-trigger')) return;
            e.preventDefault();
            e.stopPropagation();
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            const node = MobileControlsDOM.nodes[id];
            if (node) node.el.classList.add('mc-dragging');
            this._drag = { id, pointerId: e.pointerId };
            this._onMoveBound = (ev) => this._onMove(ev);
            this._onUpBound = (ev) => this._onUp(ev);
            window.addEventListener('pointermove', this._onMoveBound);
            window.addEventListener('pointerup', this._onUpBound);
            window.addEventListener('pointercancel', this._onUpBound);
            this._hidePopover();
        },

        _onMove(e) {
            if (!this._drag || !this.draft) return;
            if (e.pointerId !== this._drag.pointerId) return;
            e.preventDefault();
            const logical = MobileControlsDOM.clientToLogical(e.clientX, e.clientY);
            const cfg = this.draft.controls[this._drag.id];
            if (!cfg) return;
            const opts = this._layoutOpts();
            const halfW = cfg.w / 2;
            const halfH = cfg.h / 2;
            const insets = opts.safeInsets || { top: 0, right: 0, bottom: 0, left: 0 };
            const scaleX = opts.displayScaleX > 0 ? opts.displayScaleX : 1;
            const scaleY = opts.displayScaleY > 0 ? opts.displayScaleY : 1;
            const minX = (insets.left || 0) * scaleX + halfW;
            const maxX = opts.width - (insets.right || 0) * scaleX - halfW;
            const minY = (insets.top || 0) * scaleY + halfH;
            const maxY = opts.height - (insets.bottom || 0) * scaleY - halfH;
            cfg.x = Math.max(minX, Math.min(maxX, logical.x));
            cfg.y = Math.max(minY, Math.min(maxY, logical.y));
            this.draft.customized = true;
            this._applyDraftToDom();
            this._renderTypeTriggers();
        },

        _onUp(e) {
            if (!this._drag) return;
            if (e && e.pointerId != null && e.pointerId !== this._drag.pointerId) return;
            const node = MobileControlsDOM.nodes[this._drag.id];
            if (node) node.el.classList.remove('mc-dragging');
            this._drag = null;
            if (this._onMoveBound) window.removeEventListener('pointermove', this._onMoveBound);
            if (this._onUpBound) {
                window.removeEventListener('pointerup', this._onUpBound);
                window.removeEventListener('pointercancel', this._onUpBound);
            }
        },

        _clearTypeTriggers() {
            if (typeof MobileControlsDOM === 'undefined') return;
            for (const id of TYPEABLE_IDS) {
                const node = MobileControlsDOM.nodes[id];
                if (!node) continue;
                const trig = node.el.querySelector('.mc-type-trigger');
                if (trig) trig.remove();
            }
        },

        _renderTypeTriggers() {
            this._clearTypeTriggers();
            if (!this.draft || typeof MobileControlsDOM === 'undefined' || typeof MobileControlLayout === 'undefined') return;

            for (const id of TYPEABLE_IDS) {
                const node = MobileControlsDOM.nodes[id];
                if (!node || node.el.hidden) continue;

                const chosen = MobileControlLayout.getChosenType(this.draft, this.editClass, id);
                const meta = MobileControlLayout.TYPE_META[chosen] || MobileControlLayout.TYPE_META.button;

                const trig = document.createElement('button');
                trig.type = 'button';
                trig.className = 'mc-type-trigger';
                trig.textContent = meta.label;
                trig.setAttribute('aria-label', `${id} control type`);
                trig.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
                trig.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._openPopover(id, trig);
                    this._updateHelp(id);
                });
                node.el.appendChild(trig);
            }

            // After layout, flip chips above controls near the bottom edge and
            // clamp them horizontally so they never hang off screen
            requestAnimationFrame(() => this._positionTypeTriggers());
        },

        _positionTypeTriggers() {
            if (typeof MobileControlsDOM === 'undefined') return;
            const margin = 6;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            for (const id of TYPEABLE_IDS) {
                const node = MobileControlsDOM.nodes[id];
                if (!node) continue;
                const trig = node.el.querySelector('.mc-type-trigger');
                if (!trig) continue;

                // Reset to default placement before measuring
                trig.classList.remove('mc-type-trigger--above');
                trig.style.transform = '';

                let rect = trig.getBoundingClientRect();
                if (rect.bottom > vh - margin) {
                    trig.classList.add('mc-type-trigger--above');
                    rect = trig.getBoundingClientRect();
                }

                let shiftX = 0;
                if (rect.left < margin) {
                    shiftX = margin - rect.left;
                } else if (rect.right > vw - margin) {
                    shiftX = (vw - margin) - rect.right;
                }
                if (shiftX !== 0) {
                    trig.style.transform = `translateX(calc(-50% + ${shiftX}px))`;
                }
            }
        },

        _hidePopover() {
            if (!this.popover) return;
            this.popover.hidden = true;
            this.popover.style.display = 'none';
            this.popover.innerHTML = '';
            if (typeof MobileControlsDOM !== 'undefined') {
                for (const id of TYPEABLE_IDS) {
                    const node = MobileControlsDOM.nodes[id];
                    if (node) node.el.classList.remove('mc-type-open');
                }
            }
        },

        _openPopover(controlId, anchorEl) {
            if (!this.popover || !this.draft) return;
            const MCL = MobileControlLayout;
            const chosen = MCL.getChosenType(this.draft, this.editClass, controlId);

            // Lift this control above its siblings so its chip stays visible
            for (const id of TYPEABLE_IDS) {
                const node = MobileControlsDOM.nodes[id];
                if (node) node.el.classList.toggle('mc-type-open', id === controlId);
            }

            this.popover.innerHTML = '';
            this.popover.hidden = false;
            this.popover.style.display = 'flex';

            const title = document.createElement('div');
            title.className = 'mc-type-popover-title';
            const className = MCL.CLASS_LABELS[this.editClass] || this.editClass;
            title.textContent = `${className} ${CONTROL_NAMES[controlId] || controlId} type`;
            this.popover.appendChild(title);

            for (const key of Object.keys(MCL.TYPE_META)) {
                const meta = MCL.TYPE_META[key];
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'mc-type-option' + (key === chosen ? ' is-active' : '');
                btn.innerHTML = `<strong>${meta.label}</strong><span>${MCL.getTypeHelp(this.editClass, controlId, key)}</span>`;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.draft.typesByClass = this.draft.typesByClass || {};
                    this.draft.typesByClass[this.editClass] = this.draft.typesByClass[this.editClass] || {};
                    const def = MCL.getClassDefaultUserType(this.editClass, controlId);
                    if (key === def) {
                        delete this.draft.typesByClass[this.editClass][controlId];
                    } else {
                        this.draft.typesByClass[this.editClass][controlId] = key;
                    }
                    this.draft.customized = true;
                    this._hidePopover();
                    this._renderTypeTriggers();
                    this._updateHelp(controlId);
                });
                this.popover.appendChild(btn);
            }

            // Position: clamp inside viewport, flip up near bottom, side near edges
            requestAnimationFrame(() => {
                const a = anchorEl.getBoundingClientRect();
                const pw = this.popover.offsetWidth || 220;
                const ph = this.popover.offsetHeight || 180;
                const margin = 8;
                const vw = window.innerWidth;
                const vh = window.innerHeight;

                let left = a.left + a.width / 2 - pw / 2;
                let top = a.bottom + 6;

                if (a.top > vh * 0.62) {
                    top = a.top - ph - 6;
                }
                if (left < margin) left = margin;
                if (left + pw > vw - margin) left = vw - margin - pw;
                if (top < margin) top = margin;
                if (top + ph > vh - margin) top = Math.max(margin, vh - margin - ph);

                this.popover.style.left = `${left}px`;
                this.popover.style.top = `${top}px`;
            });
        }
    };

    window.MobileControlEditor = MobileControlEditor;
})();

/**
 * GameModeCatalog — Nexus-facing registry of playable modes.
 * Mode packages (src/modes) register here on load. Nexus/UI read this API
 * so game code never imports mode modules directly.
 */
(function (root) {
    'use strict';

    const entries = new Map();

    function normalizeId(id) {
        if (!id) return 'roguelike';
        if (id === 'gear' || id === 'cards') return 'roguelike';
        return id;
    }

    const GameModeCatalog = {
        register(entry) {
            if (!entry || !entry.id || typeof entry.id !== 'string') {
                throw new Error('GameModeCatalog.register requires entry.id');
            }
            const normalized = {
                id: entry.id,
                title: entry.title || entry.id,
                shortLabel: entry.shortLabel || (entry.title || entry.id).toUpperCase().slice(0, 8),
                portalLabel: entry.portalLabel || (entry.title || entry.id).toUpperCase(),
                nexusSelectable: entry.nexusSelectable !== false,
                multiplayerOk: entry.multiplayerOk !== false,
                requiresClass: entry.requiresClass !== false,
                supportsResume: !!entry.supportsResume,
                contentGameMode: entry.contentGameMode || 'gear',
                theme: entry.theme || {
                    glow: 'rgba(255, 150, 100, ',
                    core: 'rgba(255, 180, 120, 0.8)',
                    border: '#ff8844',
                    light: '#ff8844'
                },
                enterFromPortal: typeof entry.enterFromPortal === 'function'
                    ? entry.enterFromPortal
                    : null,
                packages: entry.packages || null
            };
            entries.set(normalized.id, Object.freeze(normalized));
            return normalized;
        },

        get(id) {
            return entries.get(normalizeId(id)) || null;
        },

        list() {
            return Array.from(entries.values());
        },

        listNexusSelectable(options) {
            const inMultiplayer = !!(options && options.inMultiplayer);
            return this.list().filter((entry) => {
                if (!entry.nexusSelectable) return false;
                if (inMultiplayer && !entry.multiplayerOk) return false;
                return true;
            });
        },

        getSelectedId(nexusRoom) {
            const game = root.Game;
            const saved = (typeof SaveSystem !== 'undefined' && SaveSystem.getSelectedModeId)
                ? SaveSystem.getSelectedModeId()
                : null;
            const raw = (nexusRoom && nexusRoom.portalMode)
                || (game && game.selectedModeId)
                || saved
                || 'roguelike';
            const id = normalizeId(raw);
            return this.get(id) ? id : 'roguelike';
        },

        getSelected(nexusRoom) {
            return this.get(this.getSelectedId(nexusRoom));
        },

        applySelection(nexusRoom, modeId) {
            const entry = this.get(modeId) || this.get('roguelike');
            if (!entry) return null;
            if (nexusRoom) {
                nexusRoom.portalMode = entry.id;
            }
            const game = root.Game;
            if (game) {
                game.selectedModeId = entry.id;
                if (entry.contentGameMode) {
                    game.gameMode = entry.contentGameMode;
                }
            }
            if (typeof SaveSystem !== 'undefined' && SaveSystem.setSelectedModeId) {
                SaveSystem.setSelectedModeId(entry.id);
            }
            return entry;
        },

        cycleNext(nexusRoom, options) {
            const list = this.listNexusSelectable(options);
            if (!list.length) return null;
            const currentId = this.getSelectedId(nexusRoom);
            let idx = list.findIndex((entry) => entry.id === currentId);
            if (idx < 0) idx = 0;
            const next = list[(idx + 1) % list.length];
            return this.applySelection(nexusRoom, next.id);
        },

        /**
         * Enter the portal for the currently selected mode.
         * @param {{ nexusRoom?: object, hasResumeCheckpoint?: boolean }} ctx
         * @returns {boolean} true if handled
         */
        enterFromPortal(ctx) {
            const nexusRoom = ctx && ctx.nexusRoom;
            const entry = this.getSelected(nexusRoom);
            if (!entry) return false;

            this.applySelection(nexusRoom, entry.id);

            if (typeof entry.enterFromPortal === 'function') {
                entry.enterFromPortal({
                    nexusRoom,
                    entry,
                    hasResumeCheckpoint: !!(ctx && ctx.hasResumeCheckpoint),
                    catalog: this
                });
                return true;
            }
            return false;
        }
    };

    root.GameModeCatalog = GameModeCatalog;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = GameModeCatalog;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

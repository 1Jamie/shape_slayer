/**
 * GameBarriers — reusable conditional door / barrier stamping on room layouts.
 * Packages own HOW (walkability + visuals); modes/triggers decide WHEN to open/close.
 *
 * Barriers are solid collision (layout grid BLOCKED cells), not soft doorOpen flags.
 * Opening also strips barrier obstacles and refreshes baked wall visuals.
 */
(function (root) {
    'use strict';

    const BLOCKED = 1;
    const WALKABLE = 0;

    function getLayout(room) {
        return room && room.layout ? room.layout : null;
    }

    function ensureRegistry(room) {
        if (!room._barriers) room._barriers = Object.create(null);
        return room._barriers;
    }

    function stampBlocked(layout, x, y, w, h, barrierId) {
        if (!layout) return;
        const opts = { preset: 'solid', motif: 'barrier', barrierId: barrierId || null };
        if (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator && RoomLayoutGenerator.stampRect) {
            RoomLayoutGenerator.stampRect(layout, x, y, w, h, opts);
            return;
        }
        const cs = layout.cellSize || 40;
        const cols = layout.cols || (layout.grid && layout.grid[0] ? layout.grid[0].length : 0);
        const rows = layout.rows || (layout.grid ? layout.grid.length : 0);
        const flat = layout.grid && typeof layout.grid.length === 'number' && cols > 0
            && layout.grid.length === cols * rows;
        const x0 = Math.floor(x / cs);
        const y0 = Math.floor(y / cs);
        const x1 = Math.ceil((x + w) / cs);
        const y1 = Math.ceil((y + h) / cs);
        if (!layout.grid) return;
        for (let gy = y0; gy < y1; gy++) {
            for (let gx = x0; gx < x1; gx++) {
                if (flat) {
                    if (gy >= 0 && gy < rows && gx >= 0 && gx < cols) {
                        layout.grid[gy * cols + gx] = BLOCKED;
                    }
                } else if (gy >= 0 && gy < layout.grid.length && gx >= 0 && gx < (layout.grid[gy] || []).length) {
                    layout.grid[gy][gx] = BLOCKED;
                }
            }
        }
        if (!Array.isArray(layout.obstacles)) layout.obstacles = [];
        layout.obstacles.push(Object.assign({ shape: 'rect', x, y, width: w, height: h }, opts));
    }

    function clearBlocked(layout, x, y, w, h, barrierId) {
        if (!layout) return;
        if (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator && RoomLayoutGenerator.clearRect) {
            RoomLayoutGenerator.clearRect(layout, x, y, w, h);
        } else {
            clearGridRegion(layout, x, y, w, h);
        }
        if (Array.isArray(layout.obstacles)) {
            layout.obstacles = layout.obstacles.filter((o) => {
                if (!o) return false;
                if (barrierId && o.barrierId === barrierId) return false;
                if (o.motif === 'barrier' && o.x === x && o.y === y && o.width === w && o.height === h) {
                    return false;
                }
                return true;
            });
        }
    }

    /**
     * Grid-only solid (no obstacle motif). Use for volumes that must be
     * unspawnable / unpathable without drawing a full wall slab.
     */
    function stampGridRegion(layout, x, y, w, h) {
        if (!layout || !layout.grid) return;
        const cs = layout.cellSize || 40;
        const cols = layout.cols || 0;
        const rows = layout.rows || 0;
        const flat = cols > 0 && rows > 0 && layout.grid.length === cols * rows;
        const x0 = Math.floor(x / cs);
        const y0 = Math.floor(y / cs);
        const x1 = Math.ceil((x + w) / cs);
        const y1 = Math.ceil((y + h) / cs);
        for (let gy = y0; gy < y1; gy++) {
            for (let gx = x0; gx < x1; gx++) {
                if (flat) {
                    if (gy >= 0 && gy < rows && gx >= 0 && gx < cols) {
                        layout.grid[gy * cols + gx] = BLOCKED;
                    }
                } else if (gy >= 0 && gy < layout.grid.length && gx >= 0 && gx < (layout.grid[gy] || []).length) {
                    layout.grid[gy][gx] = BLOCKED;
                }
            }
        }
    }

    function clearGridRegion(layout, x, y, w, h) {
        if (!layout || !layout.grid) return;
        const cs = layout.cellSize || 40;
        const cols = layout.cols || 0;
        const rows = layout.rows || 0;
        const flat = cols > 0 && rows > 0 && layout.grid.length === cols * rows;
        const x0 = Math.floor(x / cs);
        const y0 = Math.floor(y / cs);
        const x1 = Math.ceil((x + w) / cs);
        const y1 = Math.ceil((y + h) / cs);
        for (let gy = y0; gy < y1; gy++) {
            for (let gx = x0; gx < x1; gx++) {
                if (flat) {
                    if (gy >= 0 && gy < rows && gx >= 0 && gx < cols) {
                        layout.grid[gy * cols + gx] = WALKABLE;
                    }
                } else if (gy >= 0 && gy < layout.grid.length && gx >= 0 && gx < (layout.grid[gy] || []).length) {
                    layout.grid[gy][gx] = WALKABLE;
                }
            }
        }
    }

    function refreshVisuals(room) {
        const layout = getLayout(room);
        if (!layout) return;
        layout.barrierRevision = (layout.barrierRevision || 0) + 1;
        // Bust prepareRoomRenderData early-out keyed on hash:biomeId
        layout.renderDataKey = null;
        layout.hash = `${layout.hash || 'arena'}:b${layout.barrierRevision}`;
        if (typeof releaseRoomRenderCaches === 'function') {
            try { releaseRoomRenderCaches(room); } catch (_) { /* ignore */ }
        }
        const wave = (typeof Game !== 'undefined' && Game && Game.waveNumber) || room.number || 1;
        if (typeof prepareRoomRenderCaches === 'function') {
            try { prepareRoomRenderCaches(room, wave); } catch (_) { /* ignore */ }
        } else if (typeof prepareRoomRenderData === 'function') {
            try { prepareRoomRenderData(room, wave); } catch (_) { /* ignore */ }
        }
    }

    /**
     * Register and stamp a barrier. Closed by default.
     */
    function create(room, spec) {
        if (!room || !spec || !spec.id) {
            throw new TypeError('GameBarriers.create requires room and spec.id');
        }
        const layout = getLayout(room);
        const entry = {
            id: spec.id,
            x: spec.x,
            y: spec.y,
            w: spec.w,
            h: spec.h,
            label: spec.label || spec.id,
            closed: spec.closed !== false
        };
        ensureRegistry(room)[spec.id] = entry;
        if (entry.closed) {
            stampBlocked(layout, entry.x, entry.y, entry.w, entry.h, entry.id);
        } else {
            clearBlocked(layout, entry.x, entry.y, entry.w, entry.h, entry.id);
        }
        refreshVisuals(room);
        return entry;
    }

    function get(room, id) {
        return room && room._barriers ? room._barriers[id] || null : null;
    }

    function isOpen(room, id) {
        const b = get(room, id);
        return !!(b && !b.closed);
    }

    function setOpen(room, id, open) {
        const b = get(room, id);
        if (!b) return false;
        const wantClosed = !open;
        if (b.closed === wantClosed) return true;
        const layout = getLayout(room);
        if (wantClosed) {
            stampBlocked(layout, b.x, b.y, b.w, b.h, b.id);
        } else {
            clearBlocked(layout, b.x, b.y, b.w, b.h, b.id);
        }
        b.closed = wantClosed;
        refreshVisuals(room);
        return true;
    }

    function setOpenMany(room, ids, open) {
        (ids || []).forEach((id) => setOpen(room, id, open));
    }

    function list(room) {
        const reg = room && room._barriers;
        return reg ? Object.keys(reg).map((k) => reg[k]) : [];
    }

    root.GameBarriers = {
        create,
        get,
        isOpen,
        setOpen,
        setOpenMany,
        list,
        stampBlocked,
        clearBlocked,
        stampGridRegion,
        clearGridRegion,
        refreshVisuals
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.GameBarriers;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

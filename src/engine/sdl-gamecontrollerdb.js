/**
 * SDL_GameControllerDB Parser & Gamepad Remapping Layer
 * 
 * Game Controller Database sourced from:
 * https://github.com/Gabomazo/SDL_GameControllerDB
 * https://github.com/mdqinc/SDL_GameControllerDB
 * 
 * Copyright (C) 2012-2026 Sam Lantinga <slouken@libsdl.org>
 * 
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 * 
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 * 
 * 1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 * 2. Altered source versions must be plainly marked as such, and must not be
 *    misrepresented as being the original software.
 * 3. This notice may not be removed or altered from any source distribution.
 */

(function () {
    const root = typeof window !== 'undefined' ? window : globalThis;
    root.Engine = root.Engine || {};

    /** Standard W3C Gamepad Button indices mapped from SDL names. */
    const BUTTON_TARGETS = Object.freeze({
        a: 0,
        b: 1,
        x: 2,
        y: 3,
        leftshoulder: 4,
        rightshoulder: 5,
        lefttrigger: 6,
        righttrigger: 7,
        back: 8,
        start: 9,
        leftstick: 10,
        rightstick: 11,
        dpup: 12,
        dpdown: 13,
        dpleft: 14,
        dpright: 15,
        guide: 16
    });

    /** Standard W3C Gamepad Axis indices mapped from SDL names. */
    const AXIS_TARGETS = Object.freeze({
        leftx: 0,
        lefty: 1,
        rightx: 2,
        righty: 3
    });

    class SDLGameControllerDB {
        constructor() {
            /** Map of lowercase 32-char hex GUID -> Parsed mapping entry */
            this.mappingsByGuid = new Map();
            /** Map of lowercase "vid:pid" -> Array of Parsed mapping entries */
            this.mappingsByVidPid = new Map();
            /** Cache of per-gamepad trigger resting state history. */
            this._triggerRestingHistory = new Map();
            this.isLoaded = false;
        }

        /**
         * Extract 4-digit hex VID and PID from a 32-character SDL GUID.
         * SDL GUID format: 03000000 <VID_LE> 0000 <PID_LE> 0000 ...
         */
        extractVidPidFromGuid(guid) {
            if (!guid || typeof guid !== 'string' || guid.length < 16) return null;
            const clean = guid.trim().toLowerCase();
            if (clean.length !== 32) return null;

            // LE byte pairs:
            // Standard SDL2 32-char GUID:
            // 0..3 (bus), 4..7 (crc/pad), 8..11 (vendor LE), 12..15 (pad), 16..19 (product LE)
            let vidByte1 = clean.substring(8, 10);
            let vidByte2 = clean.substring(10, 12);
            let pidByte1 = clean.substring(16, 18);
            let pidByte2 = clean.substring(18, 20);

            let vid = (vidByte2 + vidByte1).toLowerCase();
            let pid = (pidByte2 + pidByte1).toLowerCase();

            if (vid === '0000' && pid === '0000') {
                vidByte1 = clean.substring(4, 6);
                vidByte2 = clean.substring(6, 8);
                pidByte1 = clean.substring(12, 14);
                pidByte2 = clean.substring(14, 16);
                vid = (vidByte2 + vidByte1).toLowerCase();
                pid = (pidByte2 + pidByte1).toLowerCase();
            }

            if (/^[0-9a-f]{4}$/.test(vid) && /^[0-9a-f]{4}$/.test(pid) && vid !== '0000' && pid !== '0000') {
                return `${vid}:${pid}`;
            }
            return null;
        }

        /**
         * Extract 4-digit hex VID and PID from browser gamepad.id string via regex.
         * Handles Linux/Chromium udev/evdev variations:
         * e.g., "045e:028e", "Vendor: 045e Product: 028e", "045e-028e-Xbox Controller"
         */
        extractVidPid(idString) {
            if (!idString || typeof idString !== 'string') return null;
            const str = idString.trim();

            // Match "Vendor: XXXX Product: YYYY" or "vendor:XXXX product:YYYY"
            const labeledMatch = str.match(/vendor[:\s]+([0-9a-f]{4}).*?product[:\s]+([0-9a-f]{4})/i);
            if (labeledMatch) {
                return `${labeledMatch[1].toLowerCase()}:${labeledMatch[2].toLowerCase()}`;
            }

            // Match "XXXX:YYYY" or "XXXX-YYYY"
            const hexPairMatch = str.match(/(?:^|[^0-9a-f])([0-9a-f]{4})[\:\-]([0-9a-f]{4})(?:$|[^0-9a-f])/i);
            if (hexPairMatch) {
                return `${hexPairMatch[1].toLowerCase()}:${hexPairMatch[2].toLowerCase()}`;
            }

            // If 32-character GUID string was provided in gamepad.id
            if (str.length === 32 && /^[0-9a-f]{32}$/i.test(str)) {
                return this.extractVidPidFromGuid(str);
            }

            return null;
        }

        /**
         * Parse a single SDL mapping token (e.g., "b0", "a2", "+a2", "-a1", "h0.1").
         */
        parseBindingToken(token) {
            if (!token || typeof token !== 'string') return null;
            const t = token.trim();

            if (t.startsWith('b')) {
                const index = parseInt(t.substring(1), 10);
                if (!isNaN(index)) return { type: 'button', index };
            }

            if (t.startsWith('h')) {
                const parts = t.substring(1).split('.');
                if (parts.length === 2) {
                    const hatIndex = parseInt(parts[0], 10);
                    const mask = parseInt(parts[1], 10);
                    if (!isNaN(hatIndex) && !isNaN(mask)) {
                        return { type: 'hat', hatIndex, mask };
                    }
                }
            }

            let invert = false;
            let positiveOnly = false;
            let negativeOnly = false;
            let axisStr = t;

            if (axisStr.startsWith('+')) {
                positiveOnly = true;
                axisStr = axisStr.substring(1);
            } else if (axisStr.startsWith('-')) {
                negativeOnly = true;
                axisStr = axisStr.substring(1);
            }

            if (axisStr.startsWith('a')) {
                const index = parseInt(axisStr.substring(1), 10);
                if (!isNaN(index)) {
                    if (negativeOnly) invert = true;
                    return { type: 'axis', index, invert, positiveOnly, negativeOnly };
                }
            }

            return null;
        }

        /**
         * Parse a single line from gamecontrollerdb.txt.
         */
        parseMappingLine(line) {
            if (!line || typeof line !== 'string') return null;
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return null;

            const parts = trimmed.split(',');
            if (parts.length < 3) return null;

            const guid = parts[0].trim().toLowerCase();
            const name = parts[1].trim();
            const bindings = {};
            let platform = null;

            for (let i = 2; i < parts.length; i++) {
                const kv = parts[i].trim();
                if (!kv) continue;
                const colonIdx = kv.indexOf(':');
                if (colonIdx === -1) continue;

                const key = kv.substring(0, colonIdx).trim().toLowerCase();
                const val = kv.substring(colonIdx + 1).trim();

                if (key === 'platform') {
                    platform = val;
                    continue;
                }

                const parsed = this.parseBindingToken(val);
                if (parsed) {
                    bindings[key] = parsed;
                }
            }

            const vidPid = this.extractVidPidFromGuid(guid);

            return {
                guid,
                name,
                platform,
                vidPid,
                bindings,
                rawLine: trimmed
            };
        }

        /**
         * Add a single SDL mapping string line to the local database.
         */
        addMapping(line) {
            const entry = this.parseMappingLine(line);
            if (!entry) return false;

            this.mappingsByGuid.set(entry.guid, entry);

            if (entry.vidPid) {
                if (!this.mappingsByVidPid.has(entry.vidPid)) {
                    this.mappingsByVidPid.set(entry.vidPid, []);
                }
                this.mappingsByVidPid.get(entry.vidPid).push(entry);
            }
            return true;
        }

        /**
         * Load mapping text (content of gamecontrollerdb.txt).
         */
        loadText(text) {
            if (!text || typeof text !== 'string') return 0;
            const lines = text.split('\n');
            let count = 0;
            for (let i = 0; i < lines.length; i++) {
                if (this.addMapping(lines[i])) count++;
            }
            this.isLoaded = true;
            return count;
        }

        /**
         * Fetch and load gamecontrollerdb.txt asynchronously.
         */
        async loadFromUrl(url = 'assets/gamecontrollerdb.txt') {
            try {
                if (typeof fetch === 'undefined') return 0;
                const resp = await fetch(url);
                if (!resp.ok) return 0;
                const text = await resp.text();
                return this.loadText(text);
            } catch (err) {
                console.warn('[SDLGameControllerDB] Could not load database:', err);
                return 0;
            }
        }

        /**
         * Find a matching mapping entry for a browser Gamepad object.
         * Tries:
         * 1. Exact 32-char GUID match
         * 2. Linux VID:PID fallback regex match from gamepad.id
         */
        findMapping(gamepad) {
            if (!gamepad || !gamepad.id) return null;
            const id = gamepad.id.trim();

            // 1. Try 32-char GUID directly if present in gamepad.id
            const guidMatch = id.match(/([0-9a-f]{32})/i);
            if (guidMatch && guidMatch[1]) {
                const guid = guidMatch[1].toLowerCase();
                if (this.mappingsByGuid.has(guid)) {
                    return this.mappingsByGuid.get(guid);
                }
            }

            // 2. Fallback: Linux VID:PID regex extraction
            const vidPid = this.extractVidPid(id);
            if (vidPid && this.mappingsByVidPid.has(vidPid)) {
                const matches = this.mappingsByVidPid.get(vidPid);
                if (matches && matches.length > 0) {
                    const platformMatch = matches.find(m => m.platform === 'Linux' || m.platform === 'Windows');
                    return platformMatch || matches[0];
                }
            }

            return null;
        }

        /**
         * Evaluate a target binding against raw gamepad hardware state.
         */
        _readBindingValue(binding, gp, padKey) {
            if (!binding || !gp) return 0;

            if (binding.type === 'button') {
                const btn = gp.buttons ? gp.buttons[binding.index] : null;
                if (!btn) return 0;
                return typeof btn.value === 'number' ? btn.value : (btn.pressed ? 1 : 0);
            }

            if (binding.type === 'axis') {
                const rawAxis = (gp.axes && gp.axes.length > binding.index) ? (gp.axes[binding.index] || 0) : 0;

                // Handle analog triggers
                if (padKey === 'lefttrigger' || padKey === 'righttrigger') {
                    // Edge Case 2: Trigger Resting-State Clamping
                    // Detect if trigger axis rests at -1.0
                    let history = this._triggerRestingHistory.get(gp.index);
                    if (!history) {
                        history = {};
                        this._triggerRestingHistory.set(gp.index, history);
                    }
                    const axisKey = `${padKey}_${binding.index}`;
                    if (rawAxis <= -0.45) {
                        history[axisKey] = true;
                    }

                    if (history[axisKey]) {
                        // Transform range: converts -1.0..1.0 -> 0.0..1.0
                        const normalized = (rawAxis + 1) / 2;
                        return Math.max(0, Math.min(1, normalized));
                    }

                    return Math.max(0, Math.min(1, rawAxis));
                }

                // Standard axis / directional button evaluation
                let v = rawAxis;
                if (binding.invert) v = -v;

                if (binding.positiveOnly) {
                    return v > 0.4 ? v : 0;
                }
                if (binding.negativeOnly) {
                    return v < -0.4 ? Math.abs(v) : 0;
                }
                return v;
            }

            if (binding.type === 'hat') {
                const mask = binding.mask;
                // Standard Web Gamepad API exposes D-Pad at button indices 12 (Up), 13 (Down), 14 (Left), 15 (Right)
                if (gp.buttons && gp.buttons.length >= 16) {
                    if (mask === 1 && gp.buttons[12]?.pressed) return 1;
                    if (mask === 4 && gp.buttons[13]?.pressed) return 1;
                    if (mask === 8 && gp.buttons[14]?.pressed) return 1;
                    if (mask === 2 && gp.buttons[15]?.pressed) return 1;
                    return 0;
                }

                // For legacy non-standard pads with < 16 buttons, check dedicated hat axes
                const hatAxisIdx = 4 + (binding.hatIndex * 2);
                if (gp.axes && gp.axes.length > hatAxisIdx + 1) {
                    const hatX = gp.axes[hatAxisIdx] || 0;
                    const hatY = gp.axes[hatAxisIdx + 1] || 0;
                    if (mask === 8 && hatX < -0.5) return 1;
                    if (mask === 2 && hatX > 0.5) return 1;
                    if (mask === 1 && hatY < -0.5) return 1;
                    if (mask === 4 && hatY > 0.5) return 1;
                }
            }

            return 0;
        }

        /**
         * Remap a raw non-standard Gamepad into a W3C Standard Gamepad structure.
         */
        remapGamepad(gp) {
            if (!gp) return null;
            if (gp.mapping === 'standard') return gp;

            const mapping = this.findMapping(gp);
            if (!mapping) return null;

            const buttons = [];
            for (let i = 0; i < 16; i++) {
                buttons.push({ pressed: false, value: 0 });
            }

            for (const [sdlKey, targetIdx] of Object.entries(BUTTON_TARGETS)) {
                if (targetIdx >= 16) continue;
                const binding = mapping.bindings[sdlKey];
                if (binding) {
                    const val = this._readBindingValue(binding, gp, sdlKey);
                    const pressed = val > 0.15;
                    buttons[targetIdx] = { pressed, value: val };
                }
            }

            const AXIS_DEADZONE = 0.10;
            const axes = [0, 0, 0, 0];

            for (const [sdlKey, targetIdx] of Object.entries(AXIS_TARGETS)) {
                const binding = mapping.bindings[sdlKey];
                if (binding) {
                    let val = this._readBindingValue(binding, gp, sdlKey);
                    if (Math.abs(val) < AXIS_DEADZONE) {
                        val = 0;
                    }
                    axes[targetIdx] = Math.max(-1, Math.min(1, val));
                }
            }

            return {
                id: gp.id,
                index: gp.index,
                connected: gp.connected,
                mapping: 'standard',
                buttons,
                axes,
                _remappedFrom: mapping.name || 'sdl-db'
            };
        }
    }

    const instance = new SDLGameControllerDB();
    Engine.SDLGameControllerDB = instance;
})();

/**
 * Companion Sync Engine
 * Handles cross-tab / cross-window BroadcastChannel synchronization
 * of character stats, equipped gear, affixes, and inventory items.
 */
(function () {
    const CHANNEL_NAME = 'shape_slayer_companion_channel';
    const LOCAL_STORAGE_KEY = 'shape_slayer_companion_state';
    const THROTTLE_INTERVAL_MS = 200; // 5Hz max broadcast rate

    let channel = null;
    let lastBroadcastTime = 0;
    let listeners = [];

    // Initialize BroadcastChannel
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            channel = new BroadcastChannel(CHANNEL_NAME);
            channel.onmessage = (event) => {
                handleIncomingMessage(event.data);
            };
        }
    } catch (err) {
        console.warn('[CompanionSync] BroadcastChannel init failed, falling back to storage listener:', err);
    }

    // Fallback: listen for localStorage events for cross-tab sync
    if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
            if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
                try {
                    const data = JSON.parse(e.newValue);
                    handleIncomingMessage(data);
                } catch (err) {
                    // Ignore parsing error
                }
            }
        });
    }

    function handleIncomingMessage(msg) {
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'REQUEST_SYNC') {
            // Main game received sync request from companion tab
            broadcastNow();
        } else if (msg.type === 'CHARACTER_STATE') {
            // Companion tab received state update
            listeners.forEach(fn => fn(msg.payload));
        }
    }

    function serializeGearSlot(gear) {
        if (!gear) return null;
        return {
            name: gear.name || null,
            tier: gear.tier || 'gray',
            color: gear.color || null,
            slot: gear.slot || null,
            stats: gear.stats ? { ...gear.stats } : null,
            affixes: Array.isArray(gear.affixes) ? gear.affixes.map(a => ({ ...a })) : [],
            classModifier: gear.classModifier ? { ...gear.classModifier } : null,
            legendaryEffect: gear.legendaryEffect ? { ...gear.legendaryEffect } : null
        };
    }

    function serializeItem(item) {
        if (!item) return null;
        const def = item.definition || {};
        return {
            name: def.name || item.name || 'Item',
            stacks: item.stacks || 1,
            tooltip: item.tooltip || def.description || item.description || '',
            definition: {
                name: def.name || 'Item',
                rarity: def.rarity || 'common',
                description: def.description || ''
            }
        };
    }

    function serializePlayerData(player, seatId = 'p1') {
        if (!player) return null;

        let equippedGear = {};
        if (typeof player.getEquippedGear === 'function') {
            equippedGear = {
                weapon: serializeGearSlot(player.getEquippedGear('weapon')),
                armor: serializeGearSlot(player.getEquippedGear('armor')),
                accessory: serializeGearSlot(player.getEquippedGear('accessory'))
            };
        }

        let items = [];
        if (player.itemManager && typeof player.itemManager.getItemsArray === 'function') {
            items = player.itemManager.getItemsArray().map(serializeItem).filter(Boolean);
        }

        let classBonusText = '';
        if (typeof getClassDescription !== 'undefined' && player.playerClass) {
            const classDesc = getClassDescription(player.playerClass);
            classBonusText = classDesc.baseStats || '';
        }

        return {
            isSnapshot: true,
            seatId: seatId,
            playerClass: player.playerClass || 'square',
            level: player.level || 1,
            hp: player.hp != null ? player.hp : 0,
            maxHp: player.maxHp != null ? player.maxHp : 100,
            damage: player.damage != null ? player.damage : 0,
            defense: player.defense != null ? player.defense : 0,
            moveSpeed: player.moveSpeed != null ? player.moveSpeed : 0,
            critChance: player.critChance || 0,
            critDamageMultiplier: player.critDamageMultiplier || 1,
            lifesteal: player.lifesteal || 0,
            maxDodgeCharges: player.maxDodgeCharges || 1,
            pierceCount: player.pierceCount || 0,
            fortifyPercent: player.fortifyPercent || 0,
            fortifyShield: player.fortifyShield || 0,
            heavyAttackCooldown: player.heavyAttackCooldown || 0,
            heavyAttackCooldownTime: player.heavyAttackCooldownTime || 1.5,
            specialCooldown: player.specialCooldown || 0,
            specialCooldownTime: player.specialCooldownTime || 5.0,
            beamCharges: player.beamCharges,
            maxBeamCharges: player.maxBeamCharges,
            effectiveBeamDuration: player.effectiveBeamDuration,
            effectiveBeamTickRate: player.effectiveBeamTickRate,
            effectiveBeamMaxPenetration: player.effectiveBeamMaxPenetration,
            classBonusText: classBonusText,
            equippedGear: equippedGear,
            items: items,
            timestamp: Date.now()
        };
    }

    function getActivePlayer(seatId) {
        if (typeof Game === 'undefined' || !Game) return null;
        if (seatId === 'p2' && Game.localSplitEnabled && Game.remotePlayerInstances) {
            return Game.remotePlayerInstances.get(Game.localSplitPlayerId) || null;
        }
        return Game.player || null;
    }

    function broadcastNow() {
        if (typeof Game === 'undefined' || !Game) return;

        const p1Data = serializePlayerData(getActivePlayer('p1'), 'p1');
        const p2Data = Game.localSplitEnabled ? serializePlayerData(getActivePlayer('p2'), 'p2') : null;

        const payload = {
            p1: p1Data,
            p2: p2Data,
            timestamp: Date.now()
        };

        const msg = {
            type: 'CHARACTER_STATE',
            payload: payload
        };

        if (channel) {
            try {
                channel.postMessage(msg);
            } catch (err) {
                // Ignore channel send errors
            }
        }

        // Storage fallback
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(msg));
            }
        } catch (err) {
            // Ignore storage errors
        }

        lastBroadcastTime = Date.now();
    }

    /**
     * Throttled tick function called from main game loop.
     * Enforces a 5Hz maximum rate so no expensive serialization happens 60x/sec.
     */
    function tick(force = false) {
        const now = Date.now();
        if (!force && (now - lastBroadcastTime < THROTTLE_INTERVAL_MS)) {
            return;
        }
        broadcastNow();
    }

    function requestSync() {
        const msg = { type: 'REQUEST_SYNC', timestamp: Date.now() };
        if (channel) {
            try {
                channel.postMessage(msg);
            } catch (err) {
                // Ignore
            }
        }
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('shape_slayer_companion_req', JSON.stringify(msg));
            }
        } catch (err) {
            // Ignore
        }
    }

    function subscribe(callback) {
        if (typeof callback === 'function') {
            listeners.push(callback);
        }
        return function unsubscribe() {
            listeners = listeners.filter(fn => fn !== callback);
        };
    }

    function openCompanionWindow() {
        if (typeof window === 'undefined') return null;
        return window.open(
            'companion.html',
            'ShapeSlayerCompanion',
            'width=1260,height=840,resizable=yes,scrollbars=yes,status=no'
        );
    }

    // Expose global interface
    window.CompanionSync = {
        serializePlayerData: serializePlayerData,
        tick: tick,
        broadcastNow: broadcastNow,
        requestSync: requestSync,
        subscribe: subscribe,
        openCompanionWindow: openCompanionWindow
    };
})();

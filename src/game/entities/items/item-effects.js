// Item Effects System - Handles active item effects like auras

// Update item effects (auras, etc.) for all players
function updateItemEffects(deltaTime) {
    if (typeof Game === 'undefined') return;

    // Update local player
    if (Game.player && Game.player.alive) {
        updatePlayerItemEffects(Game.player, deltaTime);
    }

    // Update remote players (multiplayer)
    if (Game.remotePlayerInstances) {
        Game.remotePlayerInstances.forEach((remotePlayer, playerId) => {
            if (remotePlayer && remotePlayer.alive) {
                updatePlayerItemEffects(remotePlayer, deltaTime);
            }
        });
    }
}

// Update item effects for a single player
function updatePlayerItemEffects(player, deltaTime) {
    if (!player || !player.alive) return;

    // Only update on host/solo (not clients)
    const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
    if (isClient) return;

    // Damage Aura - enemies within radius take damage per second
    if (player.itemDamageAuraRadius > 0 && player.itemDamageAuraPercent > 0) {
        updateDamageAura(player, deltaTime);
    }

    // Slow Aura - enemies within radius are slowed
    if (player.itemSlowAuraRadius > 0 && player.itemSlowAuraPercent > 0) {
        updateSlowAura(player, deltaTime);
    }
}

// Update damage aura effect
function updateDamageAura(player, deltaTime) {
    if (!Game.enemies || !Array.isArray(Game.enemies)) return;

    const radius = player.itemDamageAuraRadius;
    const damagePercent = player.itemDamageAuraPercent;

    // Damage tick rate (apply damage every 0.5 seconds for performance)
    if (!player.damageAuraTickTimer) {
        player.damageAuraTickTimer = 0;
    }
    player.damageAuraTickTimer += deltaTime;

    const tickRate = 0.5; // Damage every 0.5 seconds
    if (player.damageAuraTickTimer >= tickRate) {
        player.damageAuraTickTimer = 0;

        // Find enemies within radius
        Game.enemies.forEach(enemy => {
            if (!enemy || !enemy.alive) return;

            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                // Calculate damage based on player damage
                if (player.damage > 0) {
                    let damage = player.damage * (damagePercent / 100) * tickRate; // Damage per tick
                    damage = Math.max(1, damage); // Always deal at least 1 damage

                    // Apply damage
                    if (enemy.takeDamage) {
                        const attackerId = player.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);
                        const oldHp = enemy.hp;
                        enemy.takeDamage(damage, attackerId);

                        // Create damage number for visual feedback
                        if (typeof createDamageNumber !== 'undefined') {
                            createDamageNumber(enemy.x, enemy.y, Math.floor(damage), false, false);
                        }

                        // Track stats for the attacker
                        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
                        if (!isClient && typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                            const stats = Game.getPlayerStats(attackerId);
                            if (stats) {
                                const actualDamage = Math.min(damage, oldHp);
                                stats.addStat('damageDealt', actualDamage);
                            }
                        }
                    }
                }
            }
        });
    }
}

// Update slow aura effect
function updateSlowAura(player, deltaTime) {
    if (!Game.enemies || !Array.isArray(Game.enemies)) return;

    const radius = player.itemSlowAuraRadius;
    const slowPercent = player.itemSlowAuraPercent;

    // Slow refresh rate (apply slow every 0.2 seconds for performance)
    if (!player.slowAuraTickTimer) {
        player.slowAuraTickTimer = 0;
    }
    player.slowAuraTickTimer += deltaTime;

    const tickRate = 0.2; // Refresh slow every 0.2 seconds
    if (player.slowAuraTickTimer >= tickRate) {
        player.slowAuraTickTimer = 0;

        // Find enemies within radius and apply slow
        Game.enemies.forEach(enemy => {
            if (!enemy || !enemy.alive) return;

            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                // Apply slow effect (refreshes while in range)
                if (enemy.applySlow) {
                    // Apply slow with duration slightly longer than tick rate to ensure continuous effect
                    // Add 1.0s decay so enemies stay slowed briefly after leaving aura
                    enemy.applySlow(slowPercent / 100, tickRate * 1.5, 1.0); // 0.3s duration + 1.0s decay
                }
            }
        });
    }
}


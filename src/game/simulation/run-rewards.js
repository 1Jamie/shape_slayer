/**
 * Run Rewards & Credit Economy Manager for Shape Slayer.
 * Handles mid-run credit banking, shard calculations, and reward scaling.
 */

const GameRunRewards = {
    ELITE_CREDIT_REWARD: 15,
    BOSS_CREDIT_REWARD: 50,

    calculateShards(game) {
        if (!game || !game.player) return 0;

        const roomsCleared = Math.max(0, game.roomNumber - 1);
        const enemiesKilled = game.enemiesKilled || 0;
        const levelReached = game.player.level || 1;

        const roomScale = game.gameMode === 'gear' ? 12 : 9;
        const killScale = game.gameMode === 'gear' ? 2.4 : 1.8;
        const lvlScale = game.gameMode === 'gear' ? 1.2 : 0.9;

        const base = roomScale * roomsCleared;
        const bonus = killScale * enemiesKilled;
        const levelBonus = lvlScale * levelReached;

        let total = base + bonus + levelBonus;

        if (game.nextRoomModifiers && typeof game.nextRoomModifiers.currencyBoost === 'number' && game.nextRoomModifiers.currencyBoost > 0) {
            total *= (1 + game.nextRoomModifiers.currencyBoost);
            console.log(`[Shards] Applied ${(game.nextRoomModifiers.currencyBoost * 100).toFixed(0)}% boost from Prism Tax`);
        }

        return Math.floor(total);
    },

    calculateCurrency(game) {
        if (!game) return 0;
        if ((game.currencyEarned || 0) > 0 || (game.currencyBankedThisRun || 0) > 0) {
            return Math.floor(game.currencyEarned || game.currencyBankedThisRun || 0);
        }

        if (!game.player) return 0;

        const elitesKilled = game.elitesKilled || 0;
        const bossesKilled = game.bossesKilled || 0;
        const eliteBase = (typeof CombatEconomy !== 'undefined' && CombatEconomy.CREDIT_BASE)
            ? CombatEconomy.CREDIT_BASE.OctagonEnemy
            : (this.ELITE_CREDIT_REWARD || 15);
        const bossBase = (typeof CombatEconomy !== 'undefined' && CombatEconomy.BOSS_CREDIT_BASE)
            ? CombatEconomy.BOSS_CREDIT_BASE
            : (this.BOSS_CREDIT_REWARD || 50);

        let total = eliteBase * elitesKilled + bossBase * bossesKilled;

        if (game.nextRoomModifiers && typeof game.nextRoomModifiers.currencyBoost === 'number' && game.nextRoomModifiers.currencyBoost > 0) {
            total *= (1 + game.nextRoomModifiers.currencyBoost);
            console.log(`[Currency] Applied ${(game.nextRoomModifiers.currencyBoost * 100).toFixed(0)}% boost from Prism Tax`);
        }

        return Math.floor(total);
    },

    awardRunCredits(game, baseAmount, reason = 'combat') {
        if (!game) return 0;
        const isClient = game.isMultiplayerClient && game.isMultiplayerClient();
        if (isClient) return 0;

        let amount = Math.floor(Number(baseAmount) || 0);
        if (amount <= 0) return 0;

        if (game.nextRoomModifiers && typeof game.nextRoomModifiers.currencyBoost === 'number' && game.nextRoomModifiers.currencyBoost > 0) {
            amount = Math.floor(amount * (1 + game.nextRoomModifiers.currencyBoost));
        }
        if (amount <= 0) return 0;

        game.currencyEarned = (game.currencyEarned || 0) + amount;
        game.currencyBankedThisRun = (game.currencyBankedThisRun || 0) + amount;

        if (game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost) {
            const players = multiplayerManager.players || [];
            const localPlayerId = typeof game.getLocalPlayerId === 'function' ? game.getLocalPlayerId() : null;

            players.forEach(player => {
                if (!player || !player.id) return;
                if (game.deadPlayers && game.deadPlayers.has(player.id)) return;

                const currentCurrency = (game.playerCurrencies && game.playerCurrencies.get(player.id))
                    || (player.id === localPlayerId && typeof SaveSystem !== 'undefined' ? SaveSystem.getCurrency() : (player.currency || 0));
                const newCurrency = Math.floor(currentCurrency + amount);
                if (game.playerCurrencies) {
                    game.playerCurrencies.set(player.id, newCurrency);
                }
                player.currency = newCurrency;

                if (player.id === localPlayerId) {
                    game.currentCurrency = newCurrency;
                    if (typeof SaveSystem !== 'undefined' && SaveSystem.setCurrency) {
                        SaveSystem.setCurrency(newCurrency);
                    }
                }

                if (multiplayerManager.send) {
                    multiplayerManager.send({
                        type: 'currency_update',
                        data: {
                            targetPlayerId: player.id,
                            newCurrency,
                            reason: reason || 'run_credit'
                        }
                    });
                }
            });
        } else if (typeof SaveSystem !== 'undefined' && SaveSystem.addCurrency) {
            const newBal = SaveSystem.addCurrency(amount);
            game.currentCurrency = Math.floor(newBal);
        } else {
            game.currentCurrency = Math.floor((game.currentCurrency || 0) + amount);
        }

        console.log(`[Credits] +${amount} (${reason}) → banked this run ${game.currencyBankedThisRun}`);
        return amount;
    },

    calculateShardsForPlayer(game, playerId) {
        if (!game) return 0;
        const roomsCleared = Math.max(0, game.roomNumber - 1);
        const enemiesKilled = game.enemiesKilled || 0;

        let levelReached = 1;
        const localId = typeof game.getLocalPlayerId === 'function' ? game.getLocalPlayerId() : null;
        if (playerId === localId) {
            levelReached = game.player ? game.player.level || 1 : 1;
        } else if (game.remotePlayerInstances && game.remotePlayerInstances.has(playerId)) {
            const remotePlayer = game.remotePlayerInstances.get(playerId);
            levelReached = remotePlayer.level || 1;
        }

        const roomScale = game.gameMode === 'gear' ? 12 : 9;
        const killScale = game.gameMode === 'gear' ? 2.4 : 1.8;
        const lvlScale = game.gameMode === 'gear' ? 1.2 : 0.9;

        const base = roomScale * roomsCleared;
        const bonus = killScale * enemiesKilled;
        const levelBonus = lvlScale * levelReached;

        let total = base + bonus + levelBonus;

        if (game.nextRoomModifiers && typeof game.nextRoomModifiers.currencyBoost === 'number' && game.nextRoomModifiers.currencyBoost > 0) {
            total *= (1 + game.nextRoomModifiers.currencyBoost);
        }

        return Math.floor(total);
    },

    calculateCurrencyForPlayer(game, playerId) {
        if (!game) return 0;
        if ((game.currencyEarned || 0) > 0 || (game.currencyBankedThisRun || 0) > 0) {
            return Math.floor(game.currencyEarned || game.currencyBankedThisRun || 0);
        }

        const elitesKilled = game.elitesKilled || 0;
        const bossesKilled = game.bossesKilled || 0;
        const eliteBase = (typeof CombatEconomy !== 'undefined' && CombatEconomy.CREDIT_BASE)
            ? CombatEconomy.CREDIT_BASE.OctagonEnemy
            : (this.ELITE_CREDIT_REWARD || 15);
        const bossBase = (typeof CombatEconomy !== 'undefined' && CombatEconomy.BOSS_CREDIT_BASE)
            ? CombatEconomy.BOSS_CREDIT_BASE
            : (this.BOSS_CREDIT_REWARD || 50);

        let total = eliteBase * elitesKilled + bossBase * bossesKilled;

        if (game.nextRoomModifiers && typeof game.nextRoomModifiers.currencyBoost === 'number' && game.nextRoomModifiers.currencyBoost > 0) {
            total *= (1 + game.nextRoomModifiers.currencyBoost);
        }

        return Math.floor(total);
    }
};

if (typeof window !== 'undefined') {
    window.GameRunRewards = GameRunRewards;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameRunRewards = GameRunRewards;
}

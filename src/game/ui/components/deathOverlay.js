(function () {
	let layer, panel, header, titleEl, statsContainer, shardsEl, creditsEl, instructionsEl, btn, restartBtn;

	function isArenaMode() {
		if (typeof GameRunRewards !== 'undefined' && typeof GameRunRewards.isArenaMode === 'function') {
			return GameRunRewards.isArenaMode(typeof Game !== 'undefined' ? Game : null);
		}
		if (typeof Game === 'undefined' || !Game) return false;
		return Game.gameMode === 'arena'
			|| Game.activeSessionId === 'surge-arena'
			|| (Game.modeProfile && Game.modeProfile.id === 'surge-arena')
			|| (Game.currentRoom && Game.currentRoom.archetype === 'surgeArena');
	}

	function create() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer ui-layer--modal';
		layer.style.display = 'none';
		layer.style.pointerEvents = 'auto';
		layer.style.position = 'fixed'; // Override absolute from CSS class
		layer.style.inset = '0'; // Full screen coverage
		layer.style.zIndex = '10000'; // Same band as other .ui-layer--modal overlays
		layer.style.background = 'rgba(0, 0, 0, 0.85)'; // Dark overlay background
		layer.setAttribute('role', 'dialog');
		layer.setAttribute('aria-modal', 'true');
		layer.setAttribute('aria-label', 'Game Over');
		console.log('[DeathOverlay] Layer created');

		panel = document.createElement('div');
		panel.className = 'modal death-overlay';
		panel.style.pointerEvents = 'auto';

		header = document.createElement('div');
		header.className = 'modal__header';
		titleEl = document.createElement('div');
		titleEl.style.color = '#ff0000';
		titleEl.style.fontSize = '48px';
		titleEl.style.fontWeight = '700';
		titleEl.style.textAlign = 'center';
		titleEl.style.marginBottom = '20px';
		titleEl.textContent = 'GAME OVER';
		header.appendChild(titleEl);

		const body = document.createElement('div');
		body.className = 'modal__body nexus-scrollbar';
		body.style.textAlign = 'center';
		body.style.overflow = 'auto';
		body.style.maxHeight = '70vh';

		// Stats container
		statsContainer = document.createElement('div');
		statsContainer.style.display = 'grid';
		statsContainer.style.gridTemplateColumns = '1fr';
		statsContainer.style.gap = '12px';
		statsContainer.style.marginBottom = '24px';
		body.appendChild(statsContainer);

		// Shards earned
		shardsEl = document.createElement('div');
		shardsEl.style.marginTop = '16px';
		body.appendChild(shardsEl);

		// Credits earned
		creditsEl = document.createElement('div');
		creditsEl.style.marginTop = '12px';
		body.appendChild(creditsEl);

		// Instructions
		instructionsEl = document.createElement('div');
		instructionsEl.style.marginTop = '32px';
		instructionsEl.style.fontSize = '18px';
		instructionsEl.style.fontWeight = '600';
		body.appendChild(instructionsEl);

		const footer = document.createElement('div');
		footer.className = 'modal__footer';
		footer.style.justifyContent = 'center';
		footer.style.gap = '12px';
		footer.style.pointerEvents = 'auto';
		btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'btn';
		btn.textContent = 'Return to Nexus';
		btn.style.pointerEvents = 'auto';
		btn.style.cursor = 'pointer';
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log('[DeathOverlay] Return to Nexus button clicked');
			if (typeof Game === 'undefined') {
				console.log('[DeathOverlay] Game not available');
				return;
			}
			const timeSinceDeath = (Date.now() - (Game.deathScreenStartTime || Date.now())) / 1000;
			console.log('[DeathOverlay] Time since death:', timeSinceDeath);
			if (timeSinceDeath < 3.0) {
				console.log('[DeathOverlay] Still on delay, ignoring click');
				return;
			}
			if (Game.returnToNexus) {
				console.log('[DeathOverlay] Calling Game.returnToNexus()');
				Game.returnToNexus();
			} else {
				console.log('[DeathOverlay] Game.returnToNexus is not available');
			}
		});
		footer.appendChild(btn);

		// Restart button
		restartBtn = document.createElement('button');
		restartBtn.type = 'button';
		restartBtn.className = 'btn btn--primary';
		restartBtn.textContent = 'Restart';
		restartBtn.style.pointerEvents = 'auto';
		restartBtn.style.cursor = 'pointer';
		restartBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log('[DeathOverlay] Restart button clicked');
			if (typeof Game === 'undefined') {
				console.log('[DeathOverlay] Game not available');
				return;
			}
			const timeSinceDeath = (Date.now() - (Game.deathScreenStartTime || Date.now())) / 1000;
			console.log('[DeathOverlay] Time since death:', timeSinceDeath);
			if (timeSinceDeath < 3.0) {
				console.log('[DeathOverlay] Still on delay, ignoring click');
				return;
			}
			if (Game.restart) {
				console.log('[DeathOverlay] Calling Game.restart()');
				Game.restart();
			} else {
				console.log('[DeathOverlay] Game.restart is not available');
			}
		});
		footer.appendChild(restartBtn);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);
		layer.appendChild(panel);
		root.appendChild(layer);

		// Keyboard shortcuts
		document.addEventListener('keydown', (e) => {
			if (!isDeathVisible()) return;
			if (typeof Game === 'undefined') return;
			
			const timeSinceDeath = (Date.now() - (Game.deathScreenStartTime || Date.now())) / 1000;
			if (timeSinceDeath < 3.0) return;

			if (e.key === 'r' || e.key === 'R') {
				e.preventDefault();
				if (Game.restart) {
					Game.restart();
				}
			} else if (e.key === 'm' || e.key === 'M') {
				e.preventDefault();
				if (Game.returnToNexus) {
					Game.returnToNexus();
				}
			}
		}, { capture: true });
	}

	function isDeathVisible() {
		if (typeof Game === 'undefined') return false;
		
		const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
		
		if (inMultiplayer || Game.localSplitEnabled) {
			// Multiplayer or local split screen: show when all players are dead
			const shouldShow = Game.state === 'PLAYING' && Game.allPlayersDead === true;
			
			// Debug logging (only log when state changes to avoid spam)
			if (shouldShow && window._lastDeathVisible !== shouldShow) {
				console.log('[DeathOverlay] Multiplayer/Co-op death screen should be visible:', {
					allPlayersDead: Game.allPlayersDead,
					state: Game.state,
					shouldShow: shouldShow
				});
			}
			window._lastDeathVisible = shouldShow;
			
			return shouldShow;
		}
		
		// Singleplayer: Check if player is dead (either through dead flag or HP <= 0)
		const player = Game.player;
		if (!player) return false;
		
		const isDead = player.dead || (player.hp !== undefined && player.hp <= 0);
		if (!isDead) return false;
		
		// Show when in PLAYING state and player is dead
		// State should remain 'PLAYING' until returnToNexus is called
		const shouldShow = Game.state === 'PLAYING';
		
		// Debug logging (only log when state changes to avoid spam)
		if (shouldShow && window._lastDeathVisible !== shouldShow) {
			console.log('[DeathOverlay] Death screen should be visible:', {
				dead: player.dead,
				hp: player.hp,
				state: Game.state,
				shouldShow: shouldShow
			});
		}
		window._lastDeathVisible = shouldShow;
		
		return shouldShow;
	}

	function refresh() {
		if (!layer) return;
		
		const shouldShow = isDeathVisible();
		const wasVisible = layer.style.display === 'flex';
		layer.style.display = shouldShow ? 'flex' : 'none';
		
		// Log when visibility changes
		if (shouldShow && !wasVisible) {
			console.log('[DeathOverlay] Showing death screen - display set to flex');
		} else if (!shouldShow && wasVisible) {
			console.log('[DeathOverlay] Hiding death screen - display set to none');
		}
		
		if (!shouldShow) {
			return;
		}

		const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
		const showCoopStats = inMultiplayer || Game.localSplitEnabled;
		
		// Initialize death screen start time if not set
		if (!Game.deathScreenStartTime) {
			Game.deathScreenStartTime = Date.now();
			// Also set endTime if not already set
			if (!Game.endTime) {
				Game.endTime = Date.now();
			}
		}

		const timeSinceDeath = (Date.now() - (Game.deathScreenStartTime || Date.now())) / 1000;
		const canAcceptInput = timeSinceDeath >= 3.0;
		const timeRemaining = Math.ceil(3.0 - timeSinceDeath);

		// Update title for multiplayer/co-op
		if (showCoopStats && Game.allPlayersDead) {
			titleEl.textContent = 'GAME OVER - Final Scores';
		} else {
			titleEl.textContent = 'GAME OVER';
		}

		// Clear containers
		statsContainer.innerHTML = '';
		shardsEl.innerHTML = '';
		creditsEl.innerHTML = '';
		instructionsEl.innerHTML = '';

		if (showCoopStats && Game.allPlayersDead) {
			// MULTIPLAYER/CO-OP MODE: Show all players' stats
			refreshMultiplayerStats();
		} else {
			// SINGLEPLAYER MODE: Show single player stats
			refreshSingleplayerStats();
		}

		// Update instructions and button states
		if (!canAcceptInput) {
			const waitText = document.createElement('div');
			waitText.style.color = '#ff8888';
			waitText.style.fontSize = '24px';
			waitText.style.fontWeight = '700';
			waitText.textContent = `Wait ${timeRemaining}...`;
			instructionsEl.appendChild(waitText);
			if (btn) {
				btn.disabled = true;
				btn.style.pointerEvents = 'none';
				btn.style.opacity = '0.5';
			}
			if (restartBtn) {
				restartBtn.disabled = true;
				restartBtn.style.pointerEvents = 'none';
				restartBtn.style.opacity = '0.5';
			}
		} else {
			const isHost = inMultiplayer && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost;
			
			if (inMultiplayer && !isHost) {
				// Client: wait for host
				const waitText = document.createElement('div');
				waitText.style.color = '#ffaa00';
				waitText.style.fontSize = '20px';
				waitText.style.fontWeight = '600';
				waitText.textContent = 'Waiting for host...';
				instructionsEl.appendChild(waitText);
				if (btn) {
					btn.disabled = true;
					btn.style.pointerEvents = 'none';
					btn.style.opacity = '0.5';
				}
				if (restartBtn) {
					restartBtn.style.display = 'none'; // Hide restart button for clients
				}
			} else {
				// Host or singleplayer: show controls
				const usingGamepad = (typeof Engine !== 'undefined' && Engine.Input)
					&& ((Engine.Input.isGamepadMode && Engine.Input.isGamepadMode())
						|| Engine.Input._activeInputSource === 'gamepad');

				const restartText = document.createElement('div');
				restartText.style.color = '#ffff00';
				restartText.style.marginBottom = '8px';
				restartText.textContent = usingGamepad
					? 'Select Restart with the controller, or press R'
					: 'Press R to Restart';
				instructionsEl.appendChild(restartText);

				const continueText = document.createElement('div');
				continueText.style.color = '#00ffff';
				continueText.style.fontSize = '16px';
				continueText.textContent = usingGamepad
					? 'Select Return to Nexus, or press M'
					: 'Press M or Click to Continue to Nexus';
				instructionsEl.appendChild(continueText);
				if (btn) {
					btn.disabled = false;
					btn.style.pointerEvents = 'auto';
					btn.style.opacity = '1';
				}
				if (restartBtn) {
					restartBtn.style.display = 'block'; // Show restart button for host/singleplayer
					restartBtn.disabled = false;
					restartBtn.style.pointerEvents = 'auto';
					restartBtn.style.opacity = '1';
				}
			}
		}
	}

	function refreshSingleplayerStats() {
		const player = Game.player;
		const isArena = isArenaMode();
		const waveReached = Math.max(1, Game.waveNumber || Game.roomNumber || 1);
		const wavesCleared = Math.max(0, waveReached - 1);
		const roomsCleared = Math.max(0, Game.roomNumber - 1);
		const enemiesKilled = Game.enemiesKilled || 0;
		const elitesKilled = Game.elitesKilled || 0;
		const bossesKilled = Game.bossesKilled || 0;
		const levelReached = player ? (player.level || 1) : 1;
		const highestCombo = Game.highestCombo || 0;
		
		// Gated run timing (pause + safe-room excluded from active time)
		let timing = Game.lastRunTimingResult || null;
		if (!timing && typeof LedgerManager !== 'undefined' && LedgerManager.computeRunTiming) {
			timing = LedgerManager.computeRunTiming(Game.runTiming, Game.endTime || Date.now());
		}
		const fmt = (ms) => {
			if (typeof LedgerManager !== 'undefined' && LedgerManager.formatDurationMs) {
				return LedgerManager.formatDurationMs(ms);
			}
			const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
			const m = Math.floor(totalSec / 60);
			const s = totalSec % 60;
			return `${m}:${String(s).padStart(2, '0')}`;
		};
		const activeStr = timing ? fmt(timing.activeMs) : '0:00';
		const pausedStr = timing ? fmt(timing.pausedMs) : '0:00';
		const safeStr = timing ? fmt(timing.safeRoomMs) : '0:00';
		const wallStr = timing ? fmt(timing.grossMs) : '0:00';

		// Always show all stats
		const stats = isArena ? [
			{ label: 'Level Reached', value: levelReached },
			{ label: 'Waves Survived', value: wavesCleared },
			{ label: 'Highest Combo', value: highestCombo },
			{ label: 'Enemies Killed', value: enemiesKilled },
			{ label: 'Elites Killed', value: elitesKilled },
			{ label: 'Bosses Killed', value: bossesKilled },
			{ label: 'Active Time', value: activeStr },
			{ label: 'Paused', value: pausedStr },
			{ label: 'Wall Clock', value: wallStr }
		] : [
			{ label: 'Level Reached', value: levelReached },
			{ label: 'Rooms Cleared', value: roomsCleared },
			{ label: 'Enemies Killed', value: enemiesKilled },
			{ label: 'Elites Killed', value: elitesKilled },
			{ label: 'Bosses Killed', value: bossesKilled },
			{ label: 'Active Time', value: activeStr },
			{ label: 'Paused', value: pausedStr },
			{ label: 'Safe Rooms', value: safeStr },
			{ label: 'Wall Clock', value: wallStr }
		];

		stats.forEach(stat => {
			const statEl = document.createElement('div');
			statEl.style.fontSize = '20px';
			statEl.style.fontWeight = '600';
			statEl.style.color = '#ffffff';
			statEl.textContent = `${stat.label}: ${stat.value}`;
			statsContainer.appendChild(statEl);
		});

		// Shards = end-of-run meta; credits = mid-run combat banking
		let shardsEarned = Game.shardsEarned || 0;
		if (shardsEarned <= 0 && typeof Game.calculateShards === 'function') {
			shardsEarned = Game.calculateShards() || 0;
			Game.shardsEarned = shardsEarned;
		}
		const creditsEarned = Game.currencyEarned || 0;

		// Match Game.calculateShards / CombatEconomy / GameRunRewards
		const roomScale = isArena ? 15 : 12;
		const killScale = isArena ? 0.35 : 2.4;
		const lvlScale = isArena ? 1.0 : 1.2;
		const progressCount = isArena ? wavesCleared : roomsCleared;
		const progressLabel = isArena ? 'Waves' : 'Rooms';
		const shardBase = Math.floor(roomScale * progressCount);
		const shardBonus = Math.floor(killScale * enemiesKilled);
		const shardLevelBonus = Math.floor(lvlScale * levelReached);

		if (shardsEarned > 0 || creditsEarned > 0) {
			const breakdownEl = document.createElement('div');
			breakdownEl.style.marginTop = '16px';
			breakdownEl.style.padding = '12px';
			breakdownEl.style.background = 'rgba(0, 0, 0, 0.3)';
			breakdownEl.style.borderRadius = '6px';
			breakdownEl.style.fontSize = '14px';

			if (shardsEarned > 0) {
				const shardBreakdown = document.createElement('div');
				shardBreakdown.style.color = '#ffd700';
				shardBreakdown.style.marginBottom = creditsEarned > 0 ? '8px' : '0';
				shardBreakdown.innerHTML = `<strong>Shards Breakdown:</strong><br>` +
					`&nbsp;&nbsp;${progressLabel} (${progressCount} × ${roomScale}): ${shardBase}<br>` +
					`&nbsp;&nbsp;Enemies (${enemiesKilled} × ${killScale}): ${shardBonus}<br>` +
					`&nbsp;&nbsp;Level (${levelReached} × ${lvlScale}): ${shardLevelBonus}<br>` +
					`<strong>Total: ${shardsEarned}</strong>`;
				breakdownEl.appendChild(shardBreakdown);
			}

			if (creditsEarned > 0) {
				const creditBreakdown = document.createElement('div');
				creditBreakdown.style.color = '#00ffff';
				creditBreakdown.innerHTML = `<strong>Credits from combat:</strong> ${creditsEarned.toLocaleString()}` +
					`<br><span style="opacity:0.75;font-size:12px;">Banked on kills during the run</span>`;
				breakdownEl.appendChild(creditBreakdown);
			}

			statsContainer.appendChild(breakdownEl);
		}

		if (shardsEarned > 0) {
			const shardsLabel = document.createElement('div');
			shardsLabel.style.fontSize = '18px';
			shardsLabel.style.fontWeight = '600';
			shardsLabel.style.color = '#ffd700';
			shardsLabel.textContent = 'Shards Earned:';
			shardsEl.appendChild(shardsLabel);

			const shardsValue = document.createElement('div');
			shardsValue.style.fontSize = '24px';
			shardsValue.style.fontWeight = '700';
			shardsValue.style.color = '#ffd700';
			shardsValue.style.marginTop = '4px';
			shardsValue.textContent = shardsEarned.toLocaleString();
			shardsEl.appendChild(shardsValue);
		}

		if (creditsEarned > 0) {
			const creditsLabel = document.createElement('div');
			creditsLabel.style.fontSize = '18px';
			creditsLabel.style.fontWeight = '600';
			creditsLabel.style.color = '#00ffff';
			creditsLabel.textContent = 'Credits Earned:';
			creditsEl.appendChild(creditsLabel);

			const creditsValue = document.createElement('div');
			creditsValue.style.fontSize = '24px';
			creditsValue.style.fontWeight = '700';
			creditsValue.style.color = '#00ffff';
			creditsValue.style.marginTop = '4px';
			creditsValue.textContent = creditsEarned.toLocaleString();
			creditsEl.appendChild(creditsValue);
		}
	}

	function refreshMultiplayerStats() {
		// Get all player stats in lobby join order
		const allStats = [];
		const isClient = typeof multiplayerManager !== 'undefined' && multiplayerManager && !multiplayerManager.isHost;
		const localPlayerId = (Game.getLocalPlayerId ? Game.getLocalPlayerId() : null) || 'local';

		if (Game.localSplitEnabled) {
			// Local Split-Screen Co-Op: construct Player 1 and Player 2 entries
			const p1Id = Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
			const p2Id = Game.localSplitPlayerId || 'local-seat-1';
			
			const p1Stats = Game.playerStats ? Game.playerStats.get(p1Id) : null;
			const p2Stats = Game.playerStats ? Game.playerStats.get(p2Id) : null;
			
			if (p1Stats) {
				allStats.push({
					playerId: p1Id,
					playerName: 'Player 1',
					stats: {
						damageDealt: p1Stats.damageDealt,
						kills: p1Stats.kills,
						damageTaken: p1Stats.damageTaken,
						timeAlive: p1Stats.getTimeAlive ? p1Stats.getTimeAlive() : 0,
						roomsCleared: Math.max(0, Game.roomNumber - 1),
						wavesCleared: Math.max(0, (Game.waveNumber || Game.roomNumber || 1) - 1),
						highestCombo: p1Stats.highestCombo || Game.highestCombo || 0
					}
				});
			}
			if (p2Stats) {
				allStats.push({
					playerId: p2Id,
					playerName: 'Player 2',
					stats: {
						damageDealt: p2Stats.damageDealt,
						kills: p2Stats.kills,
						damageTaken: p2Stats.damageTaken,
						timeAlive: p2Stats.getTimeAlive ? p2Stats.getTimeAlive() : 0,
						roomsCleared: Math.max(0, Game.roomNumber - 1),
						wavesCleared: Math.max(0, (Game.waveNumber || Game.roomNumber || 1) - 1),
						highestCombo: p2Stats.highestCombo || Game.highestCombo || 0
					}
				});
			}
		} else if (isClient && Game.finalStats) {
			// Client: Use final stats from host (authoritative)
			if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.players) {
				multiplayerManager.players.forEach(player => {
					const statsData = Game.finalStats[player.id];
					if (statsData) {
						allStats.push({
							playerId: player.id,
							playerName: player.name || `Player ${player.id}`,
							stats: {
								damageDealt: statsData.damageDealt,
								kills: statsData.kills,
								damageTaken: statsData.damageTaken,
								timeAlive: statsData.timeAlive,
								roomsCleared: statsData.roomsCleared,
								wavesCleared: statsData.wavesCleared,
								highestCombo: statsData.highestCombo
							}
						});
					}
				});
			}
		} else if (Game.playerStats) {
			// Host: Use local playerStats
			if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.players) {
				multiplayerManager.players.forEach(player => {
					const stats = Game.playerStats.get(player.id);
					if (stats) {
						allStats.push({
							playerId: player.id,
							playerName: player.name || `Player ${player.id}`,
							stats: {
								damageDealt: stats.damageDealt,
								kills: stats.kills,
								damageTaken: stats.damageTaken,
								timeAlive: stats.getTimeAlive ? stats.getTimeAlive() : 0,
								roomsCleared: Math.max(0, Game.roomNumber - 1),
								wavesCleared: Math.max(0, (Game.waveNumber || Game.roomNumber || 1) - 1),
								highestCombo: stats.highestCombo || Game.highestCombo || 0
							}
						});
					}
				});
			}
		}

		if (allStats.length === 0) {
			const noStatsEl = document.createElement('div');
			noStatsEl.style.color = '#ffffff';
			noStatsEl.style.fontSize = '18px';
			noStatsEl.textContent = 'No player stats available';
			statsContainer.appendChild(noStatsEl);
			return;
		}

		// Create a table-like display for all players
		const tableWrapper = document.createElement('div');
		tableWrapper.style.width = '100%';
		tableWrapper.style.overflowX = 'auto';
		tableWrapper.style.marginBottom = '24px';

		const table = document.createElement('table');
		table.style.width = '100%';
		table.style.borderCollapse = 'collapse';
		table.style.fontSize = '16px';

		// Table header
		const thead = document.createElement('thead');
		const headerRow = document.createElement('tr');
		headerRow.style.background = 'rgba(68, 68, 68, 0.8)';
		const isArena = isArenaMode();
		const headers = isArena
			? ['Player', 'Damage', 'Kills', 'Dmg Taken', 'Waves', 'Highest Combo', 'Time']
			: ['Player', 'Damage', 'Kills', 'Dmg Taken', 'Rooms', 'Time'];
		headers.forEach(headerText => {
			const th = document.createElement('th');
			th.style.padding = '8px';
			th.style.textAlign = 'left';
			th.style.border = '1px solid rgba(255, 255, 255, 0.2)';
			th.style.fontWeight = '600';
			th.textContent = headerText;
			headerRow.appendChild(th);
		});
		thead.appendChild(headerRow);
		table.appendChild(thead);

		// Table body
		const tbody = document.createElement('tbody');
		allStats.forEach((entry, index) => {
			const row = document.createElement('tr');
			row.style.background = index % 2 === 0 ? 'rgba(34, 34, 34, 0.6)' : 'rgba(51, 51, 51, 0.6)';
			const isLocalPlayer = entry.playerId === localPlayerId;

			// Format time
			const timeAlive = entry.stats.timeAlive || 0;
			const minutes = Math.floor(timeAlive / 60);
			const seconds = (timeAlive % 60).toFixed(1);
			const timeStr = `${minutes}:${seconds.padStart(4, '0')}`;

			const cells = isArena ? [
				`${entry.playerName}${isLocalPlayer ? ' (You)' : ''}`,
				Math.floor(entry.stats.damageDealt || 0).toLocaleString(),
				(entry.stats.kills || 0).toString(),
				Math.floor(entry.stats.damageTaken || 0).toLocaleString(),
				(entry.stats.wavesCleared || Math.max(0, (Game.waveNumber || 1) - 1)).toString(),
				(entry.stats.highestCombo || Game.highestCombo || 0).toString(),
				timeStr
			] : [
				`${entry.playerName}${isLocalPlayer ? ' (You)' : ''}`,
				Math.floor(entry.stats.damageDealt || 0).toLocaleString(),
				(entry.stats.kills || 0).toString(),
				Math.floor(entry.stats.damageTaken || 0).toLocaleString(),
				(entry.stats.roomsCleared || 0).toString(),
				timeStr
			];

			cells.forEach(cellText => {
				const td = document.createElement('td');
				td.style.padding = '8px';
				td.style.border = '1px solid rgba(255, 255, 255, 0.1)';
				td.style.color = isLocalPlayer ? '#ffff00' : '#ffffff';
				td.style.fontWeight = isLocalPlayer ? '700' : '400';
				td.textContent = cellText;
				row.appendChild(td);
			});

			tbody.appendChild(row);
		});
		table.appendChild(tbody);
		tableWrapper.appendChild(table);
		statsContainer.appendChild(tableWrapper);

		// Show rewards for each player (shards = meta end-of-run; credits = mid-run combat)
		allStats.forEach(entry => {
			const playerRewardSection = document.createElement('div');
			playerRewardSection.style.marginTop = '16px';
			playerRewardSection.style.padding = '12px';
			playerRewardSection.style.background = 'rgba(0, 0, 0, 0.3)';
			playerRewardSection.style.borderRadius = '6px';
			playerRewardSection.style.border = entry.playerId === localPlayerId ? '2px solid #ffff00' : '1px solid rgba(255, 255, 255, 0.2)';

			const playerName = document.createElement('div');
			playerName.style.fontSize = '18px';
			playerName.style.fontWeight = '700';
			playerName.style.color = entry.playerId === localPlayerId ? '#ffff00' : '#ffffff';
			playerName.style.marginBottom = '8px';
			playerName.textContent = `${entry.playerName}${entry.playerId === localPlayerId ? ' (You)' : ''} - Rewards:`;
			playerRewardSection.appendChild(playerName);

			const shardsEarned = Game.calculateShardsForPlayer ? Game.calculateShardsForPlayer(entry.playerId) : 0;
			const creditsEarned = Game.calculateCurrencyForPlayer ? Game.calculateCurrencyForPlayer(entry.playerId) : 0;

			if (shardsEarned > 0) {
				const shardsDiv = document.createElement('div');
				shardsDiv.style.color = '#ffd700';
				shardsDiv.style.marginTop = '4px';
				shardsDiv.innerHTML = `<strong>Shards:</strong> ${shardsEarned.toLocaleString()}`;
				playerRewardSection.appendChild(shardsDiv);
			}

			if (creditsEarned > 0) {
				const creditsDiv = document.createElement('div');
				creditsDiv.style.color = '#00ffff';
				creditsDiv.style.marginTop = '4px';
				creditsDiv.innerHTML = `<strong>Credits:</strong> ${creditsEarned.toLocaleString()}`;
				playerRewardSection.appendChild(creditsDiv);
			}

			if (shardsEarned > 0 || creditsEarned > 0) {
				statsContainer.appendChild(playerRewardSection);
			}
		});
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		// Ensure UIRoot is available before creating
		if (!window.UIRoot || !window.UIRoot.ensure) {
			setTimeout(init, 10);
			return;
		}
		console.log('[DeathOverlay] Initializing...');
		create();
		console.log('[DeathOverlay] Created, starting tick');
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();








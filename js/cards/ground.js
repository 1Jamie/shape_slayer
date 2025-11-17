// Ground card drops and pickup handling

window.groundCards = window.groundCards || [];

function qualityColor(band) {
	switch (band) {
		case 'green': return '#4caf50';
		case 'blue': return '#2196f3';
		case 'purple': return '#9c27b0';
		case 'orange': return '#ff9800';
		default: return '#bbbbbb';
	}
}

window.CardGround = {
	selection: { index: 0, list: [] },
	dropAt(x, y, card) {
		if (!card) return;
		const item = {
			id: 'card_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
			x, y,
			size: 20,
			card
		};
		window.groundCards.push(item);
	},
	dropNearPlayer(card) {
		if (typeof Game === 'undefined' || !Game.player) return this.dropAt(200, 200, card);
		const px = Game.player.x + 40;
		const py = Game.player.y;
		this.dropAt(px, py, card);
	},
	pickAt(x, y) {
		// Prefer selected item if within range
		let targetIndex = -1;
		if (this.selection && Array.isArray(this.selection.list) && this.selection.list.length > 0) {
			const sel = this.selection.list[this.selection.index] || null;
			if (sel) {
				const dxs = x - sel.x;
				const dys = y - sel.y;
				const rs = sel.size + 20;
				if (dxs * dxs + dys * dys <= rs * rs) {
					targetIndex = window.groundCards.findIndex(g => g.id === sel.id);
				}
			}
		}
		// Otherwise find nearest under cursor
		if (targetIndex === -1) {
			for (let i = 0; i < window.groundCards.length; i++) {
				const it = window.groundCards[i];
				const dx = x - it.x;
				const dy = y - it.y;
				const r = it.size + 20;
				if (dx * dx + dy * dy <= r * r) {
					targetIndex = i;
					break;
				}
			}
		}
		if (targetIndex === -1) return false;
		const it = window.groundCards[targetIndex];
		const ok = (typeof addToHand === 'function') ? addToHand(it.card) : false;
		if (ok) {
			window.groundCards.splice(targetIndex, 1);
			return true;
		}
		// If hand is full, addToHand returns false and sets Game.awaitingHandSwap; remember source
		if (typeof Game !== 'undefined' && Game.awaitingHandSwap) {
			Game.pendingSwapSourceId = it.id;
			// Highlight this as selected
			this.selection = { index: 0, list: [it] };
			return true;
		}
		return false;
	},
	updateSelection(player) {
		if (!player || !Array.isArray(window.groundCards)) {
			this.selection = { index: 0, list: [] };
			return;
		}
		const px = player.x, py = player.y;
		const near = [];
		const radius = 180;
		const r2 = radius * radius;
		for (let i = 0; i < window.groundCards.length; i++) {
			const it = window.groundCards[i];
			const dx = it.x - px;
			const dy = it.y - py;
			if (dx * dx + dy * dy <= r2) near.push(it);
		}
		// Preserve current selected id if still near
		const prev = (this.selection.list && this.selection.list[this.selection.index]) ? this.selection.list[this.selection.index].id : null;
		this.selection = { index: 0, list: near };
		if (prev) {
			const keepIdx = near.findIndex(i => i.id === prev);
			if (keepIdx >= 0) this.selection.index = keepIdx;
		}
	},
	cycleSelection(dir) {
		if (!this.selection || !Array.isArray(this.selection.list) || this.selection.list.length === 0) return;
		const n = this.selection.list.length;
		this.selection.index = (this.selection.index + (dir > 0 ? 1 : -1) + n) % n;
	},
	getSelected() {
		if (!this.selection || !Array.isArray(this.selection.list) || this.selection.list.length === 0) return null;
		return this.selection.list[this.selection.index] || null;
	}
};

window.renderGroundCards = function renderGroundCards(ctx) {
	if (!Array.isArray(window.groundCards)) return;
	// Update selection based on player proximity
	if (typeof Game !== 'undefined' && Game.player) {
		window.CardGround.updateSelection(Game.player);
	}
	const selected = window.CardGround.getSelected();
	window.groundCards.forEach(it => {
		const band = it.card && it.card._resolvedQuality || 'white';
		const col = qualityColor(band);
		// glow
		ctx.save();
		ctx.shadowBlur = 10;
		ctx.shadowColor = col;
		ctx.fillStyle = col;
		ctx.beginPath();
		ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2);
		ctx.fill();
		ctx.shadowBlur = 0;
		// label
		const name = (it.card && (it.card.name || it.card.family)) || 'Card';
		ctx.textAlign = 'center';
		ctx.font = 'bold 13px Arial';
		// Outline for readability
		ctx.strokeStyle = 'rgba(0,0,0,0.9)';
		ctx.lineWidth = 3;
		ctx.strokeText(`${name} (${band})`, it.x, it.y - it.size - 10);
		ctx.fillStyle = '#ffffff';
		ctx.fillText(`${name} (${band})`, it.x, it.y - it.size - 10);
		
		// Detailed tooltip for selected only
		if (selected && selected.id === it.id) {
			const desc = it.card && it.card.qualityBands && it.card.qualityBands[band] && it.card.qualityBands[band].description;
			const tip = desc || '';
			if (tip) {
				const boxW = Math.min(320, Math.max(140, tip.length * 6));
				const boxH = 42;
				const bx = it.x - boxW / 2;
				const by = it.y - it.size - 10 - boxH - 6;
				ctx.fillStyle = 'rgba(0,0,0,0.75)';
				ctx.fillRect(bx, by, boxW, boxH);
				ctx.strokeStyle = '#66ccff';
				ctx.lineWidth = 2;
				ctx.strokeRect(bx, by, boxW, boxH);
				ctx.fillStyle = '#dddddd';
				ctx.font = '12px Arial';
				ctx.textAlign = 'left';
				ctx.fillText(tip, bx + 8, by + 24);
			}
		}
		
		// Proximity hint
		if (typeof Game !== 'undefined' && Game.player) {
			const dx = it.x - Game.player.x;
			const dy = it.y - Game.player.y;
			const d2 = dx * dx + dy * dy;
			const pickR = 100;
			if (d2 <= pickR * pickR) {
				const hint = (typeof Input !== 'undefined' && !Input.isTouchMode()) ? 'Press G to pick up' : 'Tap Interact to pick up';
				ctx.font = '12px Arial';
				ctx.strokeText(hint, it.x, it.y + it.size + 18);
				ctx.fillStyle = '#ffdd55';
				ctx.fillText(hint, it.x, it.y + it.size + 18);
			}
		}
		ctx.restore();
	});
};



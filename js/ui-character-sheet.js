// Character Sheet - isolated implementation with zoned grid layout
// Depends on: Input, SaveSystem, DeckState, CardCatalog, Game

// Helpers
function cs_getQualityColor(quality) {
	const map = { white: '#cccccc', green: '#4caf50', blue: '#2196f3', purple: '#9c27b0', orange: '#ff9800' };
	return map[quality] || '#cccccc';
}
function cs_getCategoryAccent(category) {
	const c = (category || '').toLowerCase();
	if (c.includes('offense')) return '#ff6b6b';
	if (c.includes('defense')) return '#6bc1ff';
	if (c.includes('mobility')) return '#5cffb5';
	if (c.includes('ability')) return '#ffd166';
	if (c.includes('economy')) return '#b4ff66';
	if (c.includes('enemy') || c.includes('room')) return '#ff9ff3';
	if (c.includes('team')) return '#feca57';
	if (c.includes('curse')) return '#ff4757';
	return '#bdbdbd';
}
function cs_wrapText(ctx, text, x, y, maxWidth, lh) {
	if (!text) return y;
	const words = String(text).split(' ');
	let line = '';
	let cy = y;
	for (let i = 0; i < words.length; i++) {
		const t = line.length ? (line + ' ' + words[i]) : words[i];
		if (ctx.measureText(t).width > maxWidth && i > 0) {
			ctx.fillText(line, x, cy);
			line = words[i];
			cy += lh;
		} else {
			line = t;
		}
	}
	if (line) {
		ctx.fillText(line, x, cy);
		cy += lh;
	}
	return cy;
}
function cs_drawCard(ctx, x, y, w, h, card) {
	const name = card.name || card.family || 'Card';
	const q = card._resolvedQuality || 'white';
	const border = cs_getQualityColor(q);
	const accent = cs_getCategoryAccent(card.category || card.family || '');
	// helper: truncate with ellipsis
	function fitText(text, maxWidth) {
		if (!text) return '';
		if (ctx.measureText(text).width <= maxWidth) return text;
		const ellipsis = '…';
		let out = '';
		for (let i = 0; i < text.length; i++) {
			const test = out + text[i];
			if (ctx.measureText(test + ellipsis).width > maxWidth) break;
			out = test;
		}
		return out + ellipsis;
	}
	// rounded rect
	const r = 10;
	const g = ctx.createLinearGradient(x, y, x, y + h);
	g.addColorStop(0, 'rgba(16,16,28,0.95)');
	g.addColorStop(1, 'rgba(10,10,20,0.95)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
	ctx.fill();
	ctx.shadowBlur = 10;
	ctx.shadowColor = border;
	ctx.strokeStyle = border;
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.shadowBlur = 0;
	// header
	ctx.fillStyle = 'rgba(255,255,255,0.06)';
	ctx.fillRect(x + 1, y + 1, w - 2, 24);
	// name (left) + quality tag (right), origin badge at far right
	ctx.font = 'bold 12px Arial';
	ctx.textAlign = 'left';
	ctx.fillStyle = '#ffffff';
	const maxNameWidth = w - 70; // leave room for tag + origin
	const displayName = fitText(name, maxNameWidth);
	ctx.fillText(displayName, x + 10, y + 18);
	// quality tag right-aligned with padding for origin badge
	ctx.font = 'bold 10px Arial';
	ctx.textAlign = 'right';
	ctx.fillStyle = border;
	const tag = `[${q.toUpperCase()}]`;
	ctx.fillText(tag, x + w - 18, y + 18);
	// origin badge at far right
	ctx.font = 'bold 11px Arial';
	ctx.fillStyle = card.origin === 'deck' ? '#00ffaa' : '#ffaa00';
	ctx.fillText(card.origin === 'deck' ? 'D' : 'F', x + w - 6, y + 16);
	// emblem
	const cx = x + Math.floor(w / 2);
	const cy = y + 70;
	ctx.fillStyle = accent;
	ctx.strokeStyle = 'rgba(255,255,255,0.25)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(cx, cy - 24);
	ctx.lineTo(cx + 16, cy + 10);
	ctx.lineTo(cx - 16, cy + 10);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// divider
	ctx.strokeStyle = 'rgba(200,200,255,0.15)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x + 8, y + 100);
	ctx.lineTo(x + w - 8, y + 100);
	ctx.stroke();
	// description
	const qb = card.qualityBands && card.qualityBands[q];
	const desc = qb && qb.description ? qb.description : '';
	ctx.textAlign = 'left';
	ctx.font = '10px Arial';
	ctx.fillStyle = '#cfd8ff';
	cs_wrapText(ctx, desc, x + 10, y + 114, w - 20, 12);
}
function cs_drawEmptyCard(ctx, x, y, w, h, label) {
	const r = 10;
	ctx.fillStyle = 'rgba(12,12,18,0.7)';
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
	ctx.fill();
	ctx.setLineDash([6, 6]);
	ctx.strokeStyle = 'rgba(200,200,200,0.35)';
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.textAlign = 'center';
	ctx.font = 'bold 12px Arial';
	ctx.fillStyle = 'rgba(200,200,220,0.7)';
	ctx.fillText(label || 'Empty Slot', x + Math.floor(w / 2), y + h - 12);
}

// State + input
function updateCharacterSheet(input) {
	if (!input) return;
	const wasOpen = CharacterSheet.isOpen;
	const iKeyPressed = input.getKeyState && input.getKeyState('i');
	const tabKeyPressed = input.getKeyState && input.getKeyState('Tab');
	if (iKeyPressed && !CharacterSheet.lastIKey) CharacterSheet.isOpen = !CharacterSheet.isOpen;
	CharacterSheet.lastIKey = iKeyPressed;
	if (tabKeyPressed) CharacterSheet.isOpen = true;
	else if (CharacterSheet.lastTabKey && !tabKeyPressed) CharacterSheet.isOpen = false;
	CharacterSheet.lastTabKey = tabKeyPressed;
	if (CharacterSheet.isOpen && !wasOpen) {
		CharacterSheet.scrollOffset = 0;
		CharacterSheet.lastTouchY = null;
	}
}

// Render
function renderCharacterSheet(ctx, player) {
	if (!CharacterSheet.isOpen || !player) return;
	if (player.dead || player.hp <= 0) {
		CharacterSheet.isOpen = false;
		return;
	}
	const canvas = ctx.canvas;
	const screenWidth = canvas.width;
	const screenHeight = canvas.height;
	const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
	const modalWidth = isMobile ? Math.min(screenWidth * 0.96, 640) : Math.min(screenWidth * 0.96, 1280);
	const modalHeight = isMobile ? Math.min(screenHeight * 0.92, screenHeight - 40) : Math.min(screenHeight * 0.92, 820);
	const modalX = (screenWidth - modalWidth) / 2;
	const modalY = (screenHeight - modalHeight) / 2;
	// overlay
	ctx.fillStyle = 'rgba(0,0,0,0.3)';
	ctx.fillRect(0, 0, screenWidth, screenHeight);
	// modal
	ctx.fillStyle = 'rgba(20,20,40,0.75)';
	ctx.fillRect(modalX, modalY, modalWidth, modalHeight);
	ctx.strokeStyle = '#4a90e2';
	ctx.lineWidth = 3;
	ctx.strokeRect(modalX, modalY, modalWidth, modalHeight);
	// zones: header, grid
	const headerH = 110;
	const footerH = 35;
	const contentTop = modalY + headerH;
	const contentH = modalHeight - headerH - footerH;
	// title
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 24px Arial';
	ctx.textAlign = 'center';
	ctx.fillText('CHARACTER', modalX + modalWidth / 2, modalY + 30);
	// class + bonuses
	ctx.fillStyle = '#ff66aa';
	ctx.font = 'bold 16px Arial';
	ctx.fillText(`${player.playerClass ? player.playerClass : 'class'} - Level ${player.level || 1}`, modalX + modalWidth / 2, modalY + 54);
	ctx.fillStyle = '#ffaa55';
	ctx.font = '12px Arial';
	ctx.fillText('CLASS BONUSES:', modalX + modalWidth / 2, modalY + 74);
	ctx.fillStyle = '#ffcc88';
	ctx.font = '12px Arial';
	ctx.fillText('15% Base Crit Chance, High Speed', modalX + modalWidth / 2, modalY + 90);
	// Grid: asymmetric columns with larger center and a shorter bottom row for aux panels
	const pad = 24;
	const gap = pad; // internal gutter between columns
	const contentX = modalX + pad;
	const contentW = modalWidth - pad * 2;
	const centerWeight = 0.68; // Center gets lion's share (wider); side panels thinner
	const sideWeight = (1 - centerWeight) / 2; // split remaining between sides
	// Column widths must account for two internal gaps (between 3 columns)
	const usableW = contentW - gap * 2;
	const leftW = Math.floor(usableW * sideWeight);
	const centerW = Math.floor(usableW * centerWeight);
	const rightW = Math.max(0, usableW - leftW - centerW);
	const leftX = contentX;
	const centerX = leftX + leftW + gap;
	const rightX = centerX + centerW + gap;
	// Rows: main hand row tall; bottom row compact
	const mainRowH = Math.floor(contentH * 0.68);
	const bottomRowH = contentH - mainRowH - pad * 3;
	const row1Y = contentTop + pad;
	const row2Y = row1Y + mainRowH + pad;

	// Draw zone panels (defined borders)
	function drawPanel(x, y, w, h) {
		ctx.fillStyle = 'rgba(10, 12, 22, 0.55)';
		ctx.fillRect(x, y, w, h);
		ctx.strokeStyle = 'rgba(120, 160, 255, 0.35)';
		ctx.lineWidth = 2;
		ctx.strokeRect(x, y, w, h);
	}
	// Panels: left stats, center hand, right piles (top); bottom three equal panels
	drawPanel(leftX, row1Y, leftW, mainRowH);
	drawPanel(centerX, row1Y, centerW, mainRowH);
	drawPanel(rightX, row1Y, rightW, mainRowH);
	const bUsableW = contentW - gap * 2;
	const bColW = Math.floor(bUsableW / 3);
	const bLeftX = contentX;
	const bCenterX = bLeftX + bColW + gap;
	const bRightX = bCenterX + bColW + gap;
	drawPanel(bLeftX, row2Y, bColW, bottomRowH);
	drawPanel(bCenterX, row2Y, bColW, bottomRowH);
	drawPanel(bRightX, row2Y, bColW, bottomRowH);
	// Upper-left: core stats chips
	(function () {
		ctx.textAlign = 'left';
		const stats = [];
		stats.push({ label: 'HP', value: `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}` });
		stats.push({ label: 'DMG', value: `${player.damage.toFixed(1)}` });
		stats.push({ label: 'DEF', value: `${(player.defense * 100).toFixed(0)}%` });
		stats.push({ label: 'SPD', value: `${player.moveSpeed.toFixed(0)}` });
		if (player.maxDodgeCharges) stats.push({ label: 'DODGE', value: `${player.maxDodgeCharges}` });
		let x = leftX + 12, y = row1Y + 12, chipH = 24, gap = 8, lineGap = 8, lineW = 0;
		ctx.font = 'bold 12px Arial';
		stats.forEach(s => {
			const w = Math.min(leftW - 24, ctx.measureText(`${s.label}: ${s.value}`).width + 16);
			if (x + w > leftX + leftW - 12) { x = leftX + 12; y += chipH + lineGap; }
			ctx.fillStyle = 'rgba(255,255,255,0.08)';
			ctx.fillRect(x, y, w, chipH);
			ctx.strokeStyle = 'rgba(150,150,255,0.3)';
			ctx.lineWidth = 1;
			ctx.strokeRect(x, y, w, chipH);
			ctx.fillStyle = '#ffffff';
			ctx.textAlign = 'center';
			ctx.fillText(`${s.label}: ${s.value}`, x + Math.floor(w / 2), y + 16);
			x += w + gap;
			lineW = Math.max(lineW, x - leftX);
		});
	})();
	// Upper-center: HAND row (dominant)
	(function () {
		ctx.font = 'bold 16px Arial';
		ctx.fillStyle = '#ffaa88';
		ctx.textAlign = 'center';
		ctx.fillText('HAND', centerX + Math.floor(centerW / 2), row1Y + 18);
		const hand = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.hand)) ? DeckState.hand : [];
		const maxHand = (typeof SaveSystem !== 'undefined' && SaveSystem.getDeckUpgrades) ? (SaveSystem.getDeckUpgrades().handSize || 4) : 4;
		const areaX = centerX + 12;
		const areaW = centerW - 24;
		// Baseline sizing (slightly smaller than before for better fit), dynamic rows
		const desiredW = Math.floor(220 * 1.1);
		const desiredH = Math.floor(310 * 1.1);
		const aspect = desiredH / desiredW; // maintain strict aspect ratio
		const minW = 130, maxW = 300;
		const slots = Math.max(1, maxHand);
		const gutter = 22;
		// Decide layout rows/columns: 1 row up to 4, otherwise 2 rows
		const rows = slots <= 4 ? 1 : 2;
		const cols = rows === 1 ? slots : Math.ceil(slots / 2);
		// Width-driven size
		let cardW = Math.floor((areaW - gutter * (cols - 1)) / cols);
		cardW = Math.max(minW, Math.min(maxW, cardW));
		let cardH = Math.round(cardW * aspect);
		// If two rows, ensure height fits within main panel area; shrink proportionally if needed
		const rowGap = 18;
		const availableH = mainRowH - (34 + 20); // subtract header and bottom padding within panel
		if (rows === 2) {
			const maxHByRows = Math.floor((availableH - rowGap) / 2);
			if (cardH > maxHByRows) {
				cardH = maxHByRows;
				cardW = Math.round(cardH / aspect);
			}
		}
		ctx.font = '11px Arial';
		ctx.fillStyle = '#dddddd';
		ctx.textAlign = 'right';
		ctx.fillText(`(${hand.length}/${maxHand})`, areaX + areaW, row1Y + 18);
		ctx.textAlign = 'left';
		const totalW = cols * cardW + (cols - 1) * gutter;
		const startX = areaX + Math.floor((areaW - totalW) / 2);
		const startY = row1Y + 34;
		for (let i = 0; i < slots; i++) {
			const r = rows === 1 ? 0 : Math.floor(i / cols);
			const cidx = rows === 1 ? i : i % cols;
			const x = startX + cidx * (cardW + gutter);
			const y = startY + r * (cardH + rowGap);
			const card = hand[i];
			if (card) cs_drawCard(ctx, x, y, cardW, cardH, card);
			else cs_drawEmptyCard(ctx, x, y, cardW, cardH, 'Empty Slot');
		}
	})();
	// Upper-right: Piles chips
	(function () {
		const draw = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.drawPile)) ? DeckState.drawPile.length : 0;
		const discard = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.discard)) ? DeckState.discard.length : 0;
		const spent = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.spent)) ? DeckState.spent.length : 0;
		const items = [{ label: 'DRAW', value: draw }, { label: 'DISCARD', value: discard }, { label: 'SPENT', value: spent }];
		let x = rightX + 12, y = row1Y + 12, chipH = 26, gap = 10;
		ctx.font = 'bold 12px Arial';
		items.forEach(it => {
			const w = Math.min(rightW - 24, ctx.measureText(`${it.label}: ${it.value}`).width + 20);
			ctx.fillStyle = 'rgba(255,255,255,0.08)';
			ctx.fillRect(x, y, w, chipH);
			ctx.strokeStyle = 'rgba(150,150,255,0.3)';
			ctx.lineWidth = 1;
			ctx.strokeRect(x, y, w, chipH);
			ctx.textAlign = 'center';
			ctx.fillStyle = '#ffffff';
			ctx.fillText(`${it.label}: ${it.value}`, x + Math.floor(w / 2), y + 17);
			y += chipH + gap;
		});
	})();
	// Lower-left: RESERVE cards preview
	(function () {
		ctx.font = 'bold 14px Arial';
		ctx.fillStyle = '#ffaa88';
		ctx.textAlign = 'left';
		ctx.fillText('RESERVE', bLeftX + 10, row2Y + 20);
		const reserve = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.reserve)) ? DeckState.reserve : [];
		const reserveSlots = (typeof SaveSystem !== 'undefined' && SaveSystem.getDeckUpgrades) ? (SaveSystem.getDeckUpgrades().reserveSlots || 0) : 0;
		ctx.font = '11px Arial';
		ctx.fillStyle = '#dddddd';
		ctx.fillText(`(${reserve.length}/${reserveSlots})`, bLeftX + 88, row2Y + 20);
		const preview = reserve.slice(0, 2);
		const w = Math.floor((bColW - 22) / 2);
		const h = bottomRowH - 54;
		let x = bLeftX + 10, y = row2Y + 36;
		preview.forEach(c => {
			// lightweight tile
			ctx.fillStyle = 'rgba(255,255,255,0.05)';
			ctx.fillRect(x, y, w, h);
			ctx.strokeStyle = 'rgba(150,150,255,0.2)';
			ctx.lineWidth = 1;
			ctx.strokeRect(x, y, w, h);
			ctx.font = '12px Arial';
			ctx.fillStyle = '#ffffff';
			ctx.fillText(c.name || c.family || 'Card', x + 8, y + 18);
			x += w + 12;
		});
		if (reserve.length === 0) {
			ctx.font = '12px Arial';
			ctx.fillStyle = '#888888';
			ctx.fillText('Empty', bLeftX + 10, row2Y + 48);
		}
	})();
	// Lower-center: TEAM CARDS
	(function () {
		ctx.textAlign = 'center';
		ctx.font = 'bold 14px Arial';
		ctx.fillStyle = '#ffaa88';
		ctx.fillText('TEAM CARDS', bCenterX + Math.floor(bColW / 2), row2Y + 20);
		const team = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.activeTeamCards)) ? DeckState.activeTeamCards : [];
		ctx.font = '12px Arial';
		ctx.fillStyle = team.length > 0 ? '#dddddd' : '#888888';
		const msg = team.length > 0 ? team.map(t => t.name || t.family).join(', ') : 'None';
		ctx.fillText(msg, bCenterX + Math.floor(bColW / 2), row2Y + Math.floor(bottomRowH / 2));
	})();
	// Lower-right: ROOM MODIFIERS
	(function () {
		ctx.textAlign = 'left';
		ctx.font = 'bold 14px Arial';
		ctx.fillStyle = '#ffaa88';
		ctx.fillText('ROOM MODIFIERS', bRightX + 10, row2Y + 20);
		const mods = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.roomModifierInventory)) ? DeckState.roomModifierInventory : [];
		const carrySlots = (typeof SaveSystem !== 'undefined' && SaveSystem.getDeckUpgrades) ? (SaveSystem.getDeckUpgrades().roomModifierCarrySlots || 3) : 3;
		ctx.font = '11px Arial';
		ctx.fillStyle = '#dddddd';
		ctx.fillText(`(${mods.length}/${carrySlots})`, bRightX + 150, row2Y + 20);
		if (mods.length === 0) {
			ctx.font = '12px Arial';
			ctx.fillStyle = '#888888';
			ctx.fillText('None', bRightX + 10, row2Y + 48);
		} else {
			const list = mods.slice(0, 3);
			let y = row2Y + 36;
			list.forEach(m => {
				ctx.font = '12px Arial';
				ctx.fillStyle = '#cccccc';
				ctx.fillText('• ' + (m.name || m.family || 'Modifier'), bRightX + 10, y);
				y += 18;
			});
			if (mods.length > 3) {
				ctx.font = '12px Arial';
				ctx.fillStyle = '#aaaaaa';
				ctx.fillText(`+${mods.length - 3} more...`, bRightX + 10, y);
			}
		}
	})();
	// footer hint
	ctx.textAlign = 'center';
	ctx.font = '12px Arial';
	ctx.fillStyle = '#ffff88';
	const hintY = modalY + modalHeight - 15;
	if (isMobile) ctx.fillText('Tap X to close  •  Swipe to scroll', modalX + modalWidth / 2, hintY);
	else ctx.fillText('Press I or release Tab to close', modalX + modalWidth / 2, hintY);
}



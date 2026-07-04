// Ground card drops (visuals + pickup)

window.groundCards = window.groundCards || [];

window.dropCardOnGround = function dropCardOnGround(card, x, y) {
	if (!card) return;
	const c = { ...card };
	c.x = x || 0;
	c.y = y || 0;
	c.size = 16;
	c.pulse = 0;
	window.groundCards.push(c);
};

function bandColor(band) {
	switch (band) {
		case 'green': return '#4caf50';
		case 'blue': return '#2196f3';
		case 'purple': return '#9c27b0';
		case 'orange': return '#ff9800';
		default: return '#cccccc';
	}
}

// Card Glow Cache System
const cardGlowCache = new Map();

// Helper to get or create a cached card glow
function getCachedCardGlow(color, size) {
	// Round size to reduce fragmentation
	const keySize = Math.ceil(size);
	const key = `${color}_${keySize}`;

	if (cardGlowCache.has(key)) {
		return cardGlowCache.get(key);
	}

	// Create new cached glow
	const canvas = document.createElement('canvas');
	// Size includes core + glow + padding
	const padding = 20;
	const diameter = keySize * 2;
	canvas.width = diameter + padding * 2;
	canvas.height = diameter + padding * 2;
	const ctx = canvas.getContext('2d');
	const center = keySize + padding;

	// Draw Glow Ring
	ctx.shadowBlur = 18;
	ctx.shadowColor = color;
	ctx.fillStyle = color;
	ctx.globalAlpha = 0.25;
	ctx.beginPath();
	ctx.arc(center, center, keySize + 10, 0, Math.PI * 2);
	ctx.fill();

	// Draw Core
	ctx.globalAlpha = 1.0;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(center, center, keySize, 0, Math.PI * 2);
	ctx.fill();

	// Draw Outline
	ctx.lineWidth = 2;
	ctx.strokeStyle = '#ffffff';
	ctx.stroke();

	cardGlowCache.set(key, canvas);
	return canvas;
}

window.renderGroundCards = function renderGroundCards(ctx, visibleCards) {
	const cards = visibleCards || window.groundCards;
	if (!Array.isArray(cards)) return;
	cards.forEach(card => {
		card.pulse = (card.pulse || 0) + 0.06;
		const pulseSize = 2 + Math.sin(card.pulse) * 2;
		const glowColor = bandColor(card._resolvedQuality || 'white');

		// Check debug flag
		if (typeof DebugFlags !== 'undefined' && DebugFlags.USE_CACHING === false) {
			// Fallback to original rendering
			// Glow ring
			ctx.save();
			ctx.shadowBlur = 18;
			ctx.shadowColor = glowColor;

			ctx.fillStyle = glowColor;
			ctx.globalAlpha = 0.25;
			ctx.beginPath();
			ctx.arc(card.x, card.y, card.size + pulseSize + 10, 0, Math.PI * 2);
			ctx.fill();

			// Core
			ctx.globalAlpha = 1.0;
			ctx.fillStyle = glowColor;
			ctx.beginPath();
			ctx.arc(card.x, card.y, card.size + pulseSize, 0, Math.PI * 2);
			ctx.fill();

			// Outline
			ctx.lineWidth = 2;
			ctx.strokeStyle = '#ffffff';
			ctx.stroke();
			ctx.restore();
		} else {
			// Use cached glow
			// Base size is 16, we add pulseSize at draw time via scaling
			const baseSize = 16;
			const cachedCanvas = getCachedCardGlow(glowColor, baseSize);

			ctx.save();
			ctx.translate(card.x, card.y);

			// Apply pulse scale
			// The cache is built for baseSize. We want effective size = baseSize + pulseSize
			// Scale factor = (baseSize + pulseSize) / baseSize
			const scale = (baseSize + pulseSize) / baseSize;
			ctx.scale(scale, scale);

			const offset = cachedCanvas.width / 2;
			ctx.drawImage(cachedCanvas, -offset, -offset);

			ctx.restore();
		}

		// Label
		ctx.save();
		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 11px Orbitron';
		ctx.textAlign = 'center';
		const name = card.name || card.family || 'Card';
		ctx.fillText(name, card.x, card.y - (card.size + 14));
		ctx.restore();
	});
};

window.pickupNearestGroundCard = function pickupNearestGroundCard(player, maxDist = 50) {
	if (!player || !Array.isArray(window.groundCards) || typeof addToHand !== 'function') return false;
	let bestIdx = -1;
	let bestDist = maxDist;
	for (let i = 0; i < window.groundCards.length; i++) {
		const c = window.groundCards[i];
		const dx = c.x - player.x;
		const dy = c.y - player.y;
		const d = Math.sqrt(dx * dx + dy * dy);
		if (d < bestDist) {
			bestDist = d;
			bestIdx = i;
		}
	}
	if (bestIdx >= 0) {
		const card = window.groundCards[bestIdx];
		const ok = addToHand(card);
		if (ok) {
			window.groundCards.splice(bestIdx, 1);
			return true;
		}
	}
	return false;
};



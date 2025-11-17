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

window.renderGroundCards = function renderGroundCards(ctx) {
	if (!Array.isArray(window.groundCards)) return;
	window.groundCards.forEach(card => {
		card.pulse = (card.pulse || 0) + 0.06;
		const pulseSize = 2 + Math.sin(card.pulse) * 2;
		const glow = bandColor(card._resolvedQuality || 'white');
		
		// Glow ring
		ctx.save();
		ctx.shadowBlur = 18;
		ctx.shadowColor = glow;
		
		ctx.fillStyle = glow;
		ctx.globalAlpha = 0.25;
		ctx.beginPath();
		ctx.arc(card.x, card.y, card.size + pulseSize + 10, 0, Math.PI * 2);
		ctx.fill();
		
		// Core
		ctx.globalAlpha = 1.0;
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(card.x, card.y, card.size + pulseSize, 0, Math.PI * 2);
		ctx.fill();
		
		// Outline
		ctx.lineWidth = 2;
		ctx.strokeStyle = '#ffffff';
		ctx.stroke();
		ctx.restore();
		
		// Label
		ctx.save();
		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 11px Arial';
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



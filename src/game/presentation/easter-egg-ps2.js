/**
 * Vector fat PS2 easter egg (solo Save Run booth).
 * Ode to Lost: leave it on for days, keep the run, chase room 200.
 * Front-on fat PS2 - grooved face, MC/controller ports, tray, reset/eject, blue USB bay.
 */
function drawLostPs2EasterEgg(ctx, x, y, options = {}) {
    function roundRectPath(px, py, w, h, r) {
        const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
        ctx.beginPath();
        ctx.moveTo(px + radius, py);
        ctx.lineTo(px + w - radius, py);
        ctx.quadraticCurveTo(px + w, py, px + w, py + radius);
        ctx.lineTo(px + w, py + h - radius);
        ctx.quadraticCurveTo(px + w, py + h, px + w - radius, py + h);
        ctx.lineTo(px + radius, py + h);
        ctx.quadraticCurveTo(px, py + h, px, py + h - radius);
        ctx.lineTo(px, py + radius);
        ctx.quadraticCurveTo(px, py, px + radius, py);
        ctx.closePath();
    }

    const lit = options.lit !== false;
    const near = !!options.near;
    const scale = Number.isFinite(options.scale) ? options.scale : 1;
    const groundShadow = options.groundShadow !== false;
    const t = Date.now() * 0.0015;
    const pulse = lit ? (0.6 + Math.sin(t) * 0.3) : 0.2;

    // Front-view proportions (fat PS2 is a wide black slab)
    const W = 108;
    const H = 46;
    const bx = -W / 2;
    const by = -H / 2;
    const grooveH = H * 0.58;
    const flatH = H - grooveH;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Floor shadow (skip when nested as a machine icon)
    if (groundShadow) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, by + H + 6, W * 0.48, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Outer shell
    const shell = ctx.createLinearGradient(0, by, 0, by + H);
    shell.addColorStop(0, '#2a2a2e');
    shell.addColorStop(0.55, '#1a1a1e');
    shell.addColorStop(1, '#101014');
    ctx.fillStyle = shell;
    roundRectPath(bx, by, W, H, 3);
    ctx.fill();

    // === UPPER GROOVED FACE ===
    ctx.fillStyle = '#16161a';
    ctx.fillRect(bx + 2, by + 2, W - 4, grooveH - 2);

    // Horizontal ribbing across the whole upper band
    for (let i = 0; i < 7; i++) {
        const gy = by + 4 + i * ((grooveH - 6) / 6);
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 3, gy);
        ctx.lineTo(bx + W - 3, gy);
        ctx.stroke();
    }

    // Left bay: memory card flaps (top) + controller ports (bottom)
    const portBayX = bx + 5;
    const portBayY = by + 5;
    const portBayW = 28;
    const portBayH = grooveH - 8;
    ctx.fillStyle = '#0c0c10';
    roundRectPath(portBayX, portBayY, portBayW, portBayH, 1.5);
    ctx.fill();

    // MEMORY CARD slots
    for (let i = 0; i < 2; i++) {
        const sx = portBayX + 3 + i * 12;
        const sy = portBayY + 3;
        ctx.fillStyle = '#222228';
        roundRectPath(sx, sy, 10, 7, 1);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 0.8;
        roundRectPath(sx, sy, 10, 7, 1);
        ctx.stroke();
        // flap hinge line
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.moveTo(sx + 1, sy + 3.5);
        ctx.lineTo(sx + 9, sy + 3.5);
        ctx.stroke();
        ctx.fillStyle = 'rgba(170,175,190,0.55)';
        ctx.font = 'bold 4px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(i + 1), sx + 5, sy - 0.5);
    }

    // Controller ports (circle + pin ring look)
    for (let i = 0; i < 2; i++) {
        const cx = portBayX + 8 + i * 12;
        const cy = portBayY + portBayH - 8;
        ctx.fillStyle = '#1c1c22';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = '#0a0a0e';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
        ctx.fill();
        // pin dots
        ctx.fillStyle = 'rgba(200,200,210,0.35)';
        for (let p = 0; p < 6; p++) {
            const a = (p / 6) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * 1.5, cy + Math.sin(a) * 1.5, 0.45, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Disc tray (center of upper face)
    const trayX = bx + 36;
    const trayY = by + 6;
    const trayW = 48;
    const trayH = grooveH - 10;
    ctx.fillStyle = '#1e1e24';
    roundRectPath(trayX, trayY, trayW, trayH, 1.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    roundRectPath(trayX, trayY, trayW, trayH, 1.5);
    ctx.stroke();
    // tray face detail lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(trayX + 4, trayY + trayH * 0.35);
    ctx.lineTo(trayX + trayW - 4, trayY + trayH * 0.35);
    ctx.moveTo(trayX + 4, trayY + trayH * 0.65);
    ctx.lineTo(trayX + trayW - 4, trayY + trayH * 0.65);
    ctx.stroke();

    // Right: RESET + EJECT buttons
    const btnX = bx + W - 18;
    // Reset (top) - green power glyph
    ctx.fillStyle = '#2a2a30';
    roundRectPath(btnX, by + 5, 12, 11, 1.5);
    ctx.fill();
    const resetGlow = lit ? `rgba(40, 220, 160, ${0.55 + pulse * 0.35})` : 'rgba(40, 120, 90, 0.45)';
    if (lit) {
        const preferSprites = typeof Game !== 'undefined' && Game.preferSpriteShadows && Game.preferSpriteShadows();
        if (preferSprites) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = near ? 0.45 : 0.28;
            ctx.strokeStyle = resetGlow;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(btnX + 6, by + 9.5, 2.6, Math.PI * 0.2, Math.PI * 1.8);
            ctx.stroke();
            ctx.restore();
        } else {
            ctx.shadowColor = resetGlow;
            ctx.shadowBlur = near ? 6 : 3;
        }
    }
    ctx.strokeStyle = resetGlow;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(btnX + 6, by + 9.5, 2.6, Math.PI * 0.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(btnX + 6, by + 7.2);
    ctx.lineTo(btnX + 6, by + 10.2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = lit ? 'rgba(80, 230, 180, 0.7)' : 'rgba(100, 140, 120, 0.45)';
    ctx.font = 'bold 3.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('RESET', btnX + 6, by + 13.5);

    // Eject (bottom) - blue triangle
    ctx.fillStyle = '#2a2a30';
    roundRectPath(btnX, by + 18, 12, 9, 1.5);
    ctx.fill();
    const ejectGlow = lit
        ? `rgba(60, 140, 255, ${0.65 + pulse * 0.3})`
        : 'rgba(40, 70, 120, 0.5)';
    if (lit) {
        const preferSprites = typeof Game !== 'undefined' && Game.preferSpriteShadows && Game.preferSpriteShadows();
        if (preferSprites) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = near ? 0.5 : 0.3;
            ctx.fillStyle = ejectGlow;
            ctx.beginPath();
            ctx.moveTo(btnX + 4, by + 20.5);
            ctx.lineTo(btnX + 8.5, by + 22.5);
            ctx.lineTo(btnX + 4, by + 24.5);
            ctx.closePath();
            ctx.fill();
            ctx.fillRect(btnX + 8.2, by + 20.5, 1.6, 4);
            ctx.restore();
        } else {
            ctx.shadowColor = ejectGlow;
            ctx.shadowBlur = near ? 7 : 4;
        }
    }
    ctx.fillStyle = ejectGlow;
    ctx.beginPath();
    ctx.moveTo(btnX + 4, by + 20.5);
    ctx.lineTo(btnX + 8.5, by + 22.5);
    ctx.lineTo(btnX + 4, by + 24.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(btnX + 8.2, by + 20.5, 1.6, 4);
    ctx.shadowBlur = 0;

    // === LOWER FLAT FACE ===
    const flatY = by + grooveH;
    ctx.fillStyle = '#141418';
    ctx.fillRect(bx + 2, flatY, W - 4, flatH - 2);

    // Blue USB / i.LINK bay (the famous tell)
    const usbX = bx + 5;
    const usbY = flatY + 3;
    const usbW = 22;
    const usbH = flatH - 7;
    ctx.fillStyle = lit ? '#1a4fd0' : '#163a8a';
    roundRectPath(usbX, usbY, usbW, usbH, 1.5);
    ctx.fill();
    // highlight on blue bay
    ctx.fillStyle = 'rgba(120, 170, 255, 0.25)';
    ctx.fillRect(usbX + 1, usbY + 1, usbW - 2, 2);

    // Two stacked USB ports
    for (let i = 0; i < 2; i++) {
        const uy = usbY + 3 + i * 5;
        ctx.fillStyle = '#0a0a12';
        roundRectPath(usbX + 3, uy, 8, 3.5, 0.5);
        ctx.fill();
        ctx.fillStyle = 'rgba(200, 210, 230, 0.35)';
        ctx.fillRect(usbX + 4, uy + 1, 6, 1.5);
    }
    // i.LINK (small square + icon mark)
    ctx.fillStyle = '#0a0a12';
    roundRectPath(usbX + 13, usbY + 5, 6, 6, 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 230, 255, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(usbX + 14.5, usbY + 8);
    ctx.lineTo(usbX + 17.5, usbY + 8);
    ctx.moveTo(usbX + 16, usbY + 6.5);
    ctx.lineTo(usbX + 16, usbY + 9.5);
    ctx.stroke();

    // Ventilation grille (rest of lower face)
    const ventX = usbX + usbW + 3;
    const ventY = flatY + 4;
    const ventW = bx + W - 5 - ventX;
    const ventH = flatH - 9;
    ctx.fillStyle = '#0c0c10';
    roundRectPath(ventX, ventY, ventW, ventH, 1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 0.6;
    const slits = 16;
    for (let i = 0; i < slits; i++) {
        const sy = ventY + 1.5 + (i / (slits - 1)) * (ventH - 3);
        ctx.beginPath();
        ctx.moveTo(ventX + 2, sy);
        ctx.lineTo(ventX + ventW - 2, sy);
        ctx.stroke();
    }

    // Feet
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.ellipse(bx + 10, by + H - 1, 4, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + W - 10, by + H - 1, 4, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer rim
    ctx.strokeStyle = near ? 'rgba(200, 210, 230, 0.28)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    roundRectPath(bx, by, W, H, 3);
    ctx.stroke();

    ctx.restore();
}

if (typeof window !== 'undefined') {
    window.drawLostPs2EasterEgg = drawLostPs2EasterEgg;
}
if (typeof globalThis !== 'undefined') {
    globalThis.drawLostPs2EasterEgg = drawLostPs2EasterEgg;
}

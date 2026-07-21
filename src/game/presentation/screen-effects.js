/**
 * Screen Effects & Camera Trauma Manager for Shape Slayer.
 * Encapsulates screen shake, hit-pause, chromatic trauma, and post-FX screen passes.
 */

const GameScreenEffects = {
    triggerScreenShake(game, intensity, duration, direction = null) {
        const bias = direction === 'player'
            ? Engine.FX.ShakeBias.VERTICAL
            : (direction === 'boss' ? Engine.FX.ShakeBias.HORIZONTAL : Engine.FX.ShakeBias.NONE);
        if (typeof Engine !== 'undefined' && Engine.Renderer && typeof Engine.Renderer.triggerScreenShake === 'function') {
            Engine.Renderer.triggerScreenShake(intensity, duration, bias);
        } else if (game) {
            const shouldReplace = (game.screenShakeDuration || 0) <= 0 || intensity >= (game.screenShakeIntensity || 0);
            if (shouldReplace) {
                game.screenShakeIntensity = intensity;
                game.screenShakeDuration = duration;
                game.screenShakeDirection = bias;
            } else {
                game.screenShakeDuration = Math.max(game.screenShakeDuration || 0, duration * 0.45);
            }
        }
    },

    updateScreenShake(game, deltaTime) {
        if (typeof Engine !== 'undefined' && Engine.Renderer && typeof Engine.Renderer.updateScreenShake === 'function') {
            Engine.Renderer.updateScreenShake(deltaTime);
        } else if (game && game.screenShakeDuration > 0) {
            game.screenShakeDuration -= deltaTime;
            const baseShake = (game.screenShakeIntensity || 0) * 10;
            let xOffset = 0;
            let yOffset = 0;

            if (game.screenShakeDirection === 'player') {
                xOffset = (Math.random() - 0.5) * baseShake * 0.15;
                yOffset = (Math.random() - 0.5) * baseShake * 1.2;
            } else if (game.screenShakeDirection === 'boss') {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * baseShake;
                xOffset = Math.cos(angle) * radius * 1.1;
                yOffset = Math.sin(angle) * radius * 0.9;
            } else {
                xOffset = (Math.random() - 0.5) * baseShake;
                yOffset = (Math.random() - 0.5) * baseShake;
            }

            if (!game.screenShakeOffset) {
                game.screenShakeOffset = { x: 0, y: 0 };
            }
            game.screenShakeOffset.x = xOffset;
            game.screenShakeOffset.y = yOffset;

            if (game.screenShakeDuration <= 0) {
                game.screenShakeDuration = 0;
                game.screenShakeOffset.x = 0;
                game.screenShakeOffset.y = 0;
                game.screenShakeDirection = null;
            }
        }
    },

    triggerHitPause(game, duration = 0.016) {
        if (game && game.state === 'TITLE') return;
        const capped = (typeof Engine !== 'undefined' && Engine.Utils && typeof Engine.Utils.clamp === 'function')
            ? Engine.Utils.clamp(duration, 0, 0.02)
            : Math.min(Math.max(0, duration), 0.02);
        if (game && (game.hitPauseTime || 0) <= 0) {
            game.hitPauseTime = capped;
        }
    },

    triggerChromaticTrauma(game, frames = 5, intensity = 0.75) {
        if (!game) return;
        const now = performance.now();
        const duration = Math.max(1, frames) * (1000 / 60);
        game.chromaticTraumaStart = now;
        game.chromaticTraumaDuration = duration;
        game.chromaticTraumaUntil = now + duration;
        game.chromaticTraumaIntensity = Math.max(0, Math.min(1, intensity));
    },

    getDamageTraumaParams(game, playerToCheck, nowSec, traumaNowMs, damageTraumaDuration) {
        const params = { intensity: 0, offset: 0, damagePercentage: 0, active: false };
        const minHitRatioForCa = 0.03;

        if (playerToCheck && playerToCheck.lastDamageTime) {
            const elapsed = nowSec - playerToCheck.lastDamageTime;
            if (elapsed >= 0 && elapsed < damageTraumaDuration) {
                const hitRatio = playerToCheck.maxHp > 0 && playerToCheck.lastDamageAmount > 0
                    ? playerToCheck.lastDamageAmount / playerToCheck.maxHp
                    : 0;
                if (hitRatio >= minHitRatioForCa) {
                    const progress = Math.min(elapsed / damageTraumaDuration, 1.0);
                    params.intensity = Math.max(params.intensity, 1.0 - progress);
                    const normalizedDamage = Math.min(hitRatio / 0.45, 1.0);
                    params.damagePercentage = Math.max(params.damagePercentage, 0.1 + 0.9 * normalizedDamage);
                    params.active = true;
                }
            }
        }

        if (game && game.chromaticTraumaUntil && traumaNowMs < game.chromaticTraumaUntil) {
            const traumaElapsed = traumaNowMs - (game.chromaticTraumaStart || traumaNowMs);
            const traumaDuration = Math.max(1, game.chromaticTraumaDuration || (5 * 1000 / 60));
            const traumaProgress = Math.min(traumaElapsed / traumaDuration, 1.0);
            const traumaIntensity = (1.0 - traumaProgress) * (game.chromaticTraumaIntensity || 0.75);
            params.intensity = Math.max(params.intensity, traumaIntensity);
            params.damagePercentage = Math.max(params.damagePercentage, 0.45 * (game.chromaticTraumaIntensity || 0.75));
            params.active = true;
        }

        if (!params.active || params.intensity <= 0) {
            return params;
        }

        const baseMaxOffset = 2;
        const maxMaxOffset = 16;
        const maxOffset = baseMaxOffset + (maxMaxOffset - baseMaxOffset) * params.damagePercentage;
        const easeIntensity = params.intensity * (2 - params.intensity);
        params.offset = maxOffset * easeIntensity;
        return params;
    },

    applyChromaticAberrationFromOffscreen(game, traumaParams, viewport = null) {
        if (!game || !game.ctx || !game.offscreenCanvas) return;
        const logicalWidth = viewport ? viewport.w : (game.config ? game.config.width : 1280);
        const logicalHeight = viewport ? viewport.h : (game.config ? game.config.height : 720);
        const targetX = viewport ? viewport.x : 0;
        const targetY = viewport ? viewport.y : 0;
        const adaptiveEnabled = typeof DebugFlags === 'undefined' || DebugFlags.ADAPTIVE_RENDER_QUALITY !== false;
        const processScale = adaptiveEnabled && game.renderQuality && game.renderQuality.damageFxScale
            ? game.renderQuality.damageFxScale
            : 1;
        const intensity = traumaParams.intensity;
        const offset = traumaParams.offset * processScale;

        game.ctx.clearRect(targetX, targetY, logicalWidth, logicalHeight);
        if (intensity < 0.18) {
            game.ctx.drawImage(game.offscreenCanvas, targetX, targetY, logicalWidth, logicalHeight);
            return;
        }

        if (typeof Engine !== 'undefined' && Engine.FX && Engine.FX.Post && Engine.FX.Post.chromaticAberration) {
            Engine.FX.Post.chromaticAberration(game.ctx, {
                source: game.offscreenCanvas,
                x: targetX,
                y: targetY,
                width: logicalWidth,
                height: logicalHeight,
                offset,
                intensity,
                replace: true
            });
        }
    },

    renderPreBossHealerPunchThrough(game, ctx, viewPlayer = null, viewport = null, camera = null) {
        if (!game) return;
        const player = viewPlayer || game._activeViewPlayer || game.player;
        if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.doorOpen || !currentRoom.preBossHealer || !player) {
            return;
        }
        const healer = currentRoom.preBossHealer;
        if (!healer.usedBy) healer.usedBy = new Set();
        const localId = player === game.player
            ? (typeof game.getLocalPlayerId === 'function' ? game.getLocalPlayerId() : 'local')
            : (game.localSplitPlayerId || 'local-seat-1');
        if (healer.usedBy.has(localId)) return;

        const activeCamera = camera || game._activeRenderCamera || game.camera;
        const activeViewport = viewport || game._activeRenderViewport;
        const viewW = activeViewport ? activeViewport.w : (game.config ? game.config.width : 1280);
        const viewH = activeViewport ? activeViewport.h : (game.config ? game.config.height : 720);
        const originX = activeViewport ? activeViewport.x : 0;
        const originY = activeViewport ? activeViewport.y : 0;
        const zoom = typeof game.getViewZoom === 'function' ? game.getViewZoom() : 1;
        const shakeX = game.screenShakeOffset ? game.screenShakeOffset.x : 0;
        const shakeY = game.screenShakeOffset ? game.screenShakeOffset.y : 0;
        const cX = originX + (viewW / 2) + shakeX;
        const cY = originY + (viewH / 2) + shakeY;
        const sx = (healer.x - activeCamera.x) * zoom + cX;
        const sy = (healer.y - activeCamera.y) * zoom + cY;
        const t = Date.now() * 0.002;
        const pulse = 0.5 + Math.sin(t) * 0.5;
        const glowR = (70 + pulse * 20) * zoom;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (game.preferSpriteShadows && game.preferSpriteShadows()) {
            const sprite = typeof game.getCachedGlowSprite === 'function' ? game.getCachedGlowSprite('#00ff64') : null;
            if (sprite) {
                ctx.globalAlpha = 0.22 + pulse * 0.14;
                ctx.drawImage(sprite, sx - glowR, sy - glowR, glowR * 2, glowR * 2);
                ctx.globalAlpha = 1;
            }
        } else {
            const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
            grad.addColorStop(0, `rgba(0, 255, 100, ${0.18 + pulse * 0.12})`);
            grad.addColorStop(0.4, `rgba(0, 200, 80, ${0.08 + pulse * 0.06})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
};

if (typeof window !== 'undefined') {
    window.GameScreenEffects = GameScreenEffects;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameScreenEffects = GameScreenEffects;
}

// Elite single-affix enemies (0.8.2) - meaningful combat verbs, biome-gated
(function (global) {
    const ELITE_AFFIX_BY_BIOME = {
        swarm: ['fortify', 'chainLightning', 'rampage'],
        prism: ['phasing', 'multishot'],
        fortress: ['fortify', 'explosiveAttacks', 'rampage'],
        fractal: ['phasing', 'explosiveAttacks'],
        vortex: ['multishot', 'chainLightning', 'execute'],
        endless: ['execute', 'rampage', 'fortify', 'phasing']
    };

    const ELITE_AFFIX_VALUES = {
        fortify: { drWhileTelegraph: 0.45 },
        phasing: { duration: 0.45 },
        multishot: { extraProjectiles: 1 },
        explosiveAttacks: { radius: 55, damageMult: 0.55 },
        chainLightning: { range: 160, damageMult: 0.5 },
        execute: { threshold: 0.35, bonus: 0.4 },
        rampage: { duration: 2.5, speedMult: 1.25, damageMult: 1.2 }
    };

    // Player-facing Index copy (one meaningful affix per elite)
    const ELITE_AFFIX_INDEX = {
        fortify: {
            name: 'Fortify',
            blurb: 'Harder to punish during windup',
            description: 'Takes much less damage while telegraphing / charging. Wait for the commit or find another angle.',
            tell: 'Jagged threat ring. Tankier only during the windup - not permanently armored.'
        },
        phasing: {
            name: 'Phasing',
            blurb: 'Briefly unhittable after committing an attack',
            description: 'On attack commit, slips into a short phase window where hits do not land. Body goes translucent / wireframe while active.',
            tell: 'Threat ring + sudden ghosted body. Do not empty a heavy into the phase window.'
        },
        multishot: {
            name: 'Multishot',
            blurb: 'Extra projectiles on ranged attacks',
            description: 'Ranged patterns fire an extra projectile. Especially nasty on stars and other shooters; biome pools gate where it appears.',
            tell: 'Threat ring on a shooter. Expect wider / denser volleys than the base pattern.'
        },
        explosiveAttacks: {
            name: 'Volatile',
            blurb: 'Explodes on death in a small radius',
            description: 'Death blast around the corpse. Finish at range or dodge the pop - do not stand on the kill.',
            tell: 'Threat ring. After the kill, give the body space for a beat.'
        },
        chainLightning: {
            name: 'Arc',
            blurb: 'Hits can chain lightning toward you',
            description: 'Combat hits may arc extra damage toward nearby players. Packs with Arc punish clustering.',
            tell: 'Threat ring. Spread out when several elites or dense packs are up.'
        },
        execute: {
            name: 'Execute',
            blurb: 'Hurts more when you are already low',
            description: 'Deals bonus damage when your HP is under a threshold. Heal before trading; do not linger in execute range.',
            tell: 'Threat ring. Respect it hardest when you are already bleeding.'
        },
        rampage: {
            name: 'Rampage',
            blurb: 'Speeds up and hits harder after landing a hit',
            description: 'On a successful hit, briefly buffs move speed and damage. Break contact or kite until the ramp fades.',
            tell: 'Threat ring. After it tags you, expect a short aggressive chase.'
        }
    };

    const ELITE_AFFIX_ORDER = [
        'fortify', 'phasing', 'multishot', 'explosiveAttacks',
        'chainLightning', 'execute', 'rampage'
    ];

    function getBiomesForEliteAffix(affixType) {
        const out = [];
        Object.keys(ELITE_AFFIX_BY_BIOME).forEach(biomeId => {
            if ((ELITE_AFFIX_BY_BIOME[biomeId] || []).indexOf(affixType) !== -1) {
                out.push(biomeId);
            }
        });
        return out;
    }

    // Mid/late room spawn chance (non-boss)
    function getEliteChance(roomNumber) {
        if (roomNumber < 6) return 0;
        if (roomNumber < 12) return 0.08;
        if (roomNumber < 25) return 0.14;
        return 0.18;
    }

    function pickEliteAffix(biomeId) {
        const pool = ELITE_AFFIX_BY_BIOME[biomeId] || ELITE_AFFIX_BY_BIOME.endless;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function applyEliteAffix(enemy, biomeId, roomNumber) {
        if (!enemy || enemy.isBoss) return null;
        const chance = getEliteChance(roomNumber || 1);
        if (Math.random() > chance) return null;

        const type = pickEliteAffix(biomeId || 'endless');
        const values = Object.assign({}, ELITE_AFFIX_VALUES[type] || {});
        enemy.eliteAffix = { type, value: values };
        enemy.isElite = true;

        // Mild elite HP bump so affix isn't free power without durability
        if (enemy.maxHp) {
            enemy.maxHp = Math.round(enemy.maxHp * 1.2);
            enemy.hp = enemy.maxHp;
        }
        return enemy.eliteAffix;
    }

    function onEliteAttackCommit(enemy) {
        if (!enemy || !enemy.eliteAffix) return;
        if (enemy.eliteAffix.type === 'phasing') {
            enemy.phasingActive = true;
            enemy.phasingRemaining = enemy.eliteAffix.value.duration || 0.45;
        }
        if (enemy.eliteAffix.type === 'rampage') {
            // rampage triggers on landing a hit - handled in combat
        }
    }

    function updateEliteAffix(enemy, deltaTime) {
        if (!enemy) return;
        if (enemy.phasingActive) {
            enemy.phasingRemaining = (enemy.phasingRemaining || 0) - deltaTime;
            if (enemy.phasingRemaining <= 0) {
                enemy.phasingActive = false;
                enemy.phasingRemaining = 0;
            }
        }
        if (enemy.eliteRampageRemaining > 0) {
            enemy.eliteRampageRemaining -= deltaTime;
            if (enemy.eliteRampageRemaining <= 0) {
                enemy.eliteRampageRemaining = 0;
                if (enemy._eliteRampageSpeedBonus && enemy.moveSpeed) {
                    enemy.moveSpeed /= enemy._eliteRampageSpeedBonus;
                    if (enemy.baseMoveSpeed) enemy.baseMoveSpeed /= enemy._eliteRampageSpeedBonus;
                }
                if (enemy._eliteRampageDamageBonus && enemy.damage) {
                    enemy.damage /= enemy._eliteRampageDamageBonus;
                }
                enemy._eliteRampageSpeedBonus = 1;
                enemy._eliteRampageDamageBonus = 1;
            }
        }
    }

    function getEliteDamageTakenMultiplier(enemy) {
        if (!enemy || !enemy.eliteAffix || enemy.eliteAffix.type !== 'fortify') return 1;
        const telegraphing = !!(enemy.activeTelegraph || enemy.state === 'telegraph'
            || (enemy.chargeTelegraphRemaining != null && enemy.chargeTelegraphRemaining > 0));
        if (!telegraphing) return 1;
        return 1 - (enemy.eliteAffix.value.drWhileTelegraph || 0.4);
    }

    function triggerEliteRampage(enemy) {
        if (!enemy || !enemy.eliteAffix || enemy.eliteAffix.type !== 'rampage') return;
        if (enemy.eliteRampageRemaining > 0) return;
        const v = enemy.eliteAffix.value;
        enemy.eliteRampageRemaining = v.duration || 2.5;
        enemy._eliteRampageSpeedBonus = v.speedMult || 1.25;
        enemy._eliteRampageDamageBonus = v.damageMult || 1.2;
        enemy.moveSpeed *= enemy._eliteRampageSpeedBonus;
        if (enemy.baseMoveSpeed) enemy.baseMoveSpeed *= enemy._eliteRampageSpeedBonus;
        enemy.damage *= enemy._eliteRampageDamageBonus;
    }

    function triggerEliteExplosion(enemy, players) {
        if (!enemy || !enemy.eliteAffix || enemy.eliteAffix.type !== 'explosiveAttacks') return;
        const radius = enemy.eliteAffix.value.radius || 55;
        const dmg = (enemy.damage || 10) * (enemy.eliteAffix.value.damageMult || 0.55);
        const list = players instanceof Map ? Array.from(players.values()) : (Array.isArray(players) ? players : [players]);
        list.forEach(p => {
            if (!p || p.dead) return;
            const dx = p.x - enemy.x;
            const dy = p.y - enemy.y;
            if (dx * dx + dy * dy <= radius * radius) {
                const hpBefore = p.hp;
                if (typeof p.takeDamage === 'function') p.takeDamage(dmg, enemy);
                // Survived explosion under 10% HP
                if (!p.dead && p.hp > 0 && p.maxHp > 0) {
                    const hpPct = p.hp / p.maxHp;
                    if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                        LedgerManager.recordEvent('eliteExplosionSurvived', {
                            player: p,
                            hpPct,
                            hpBefore
                        });
                    }
                }
            }
        });
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(enemy.x, enemy.y, '#ffcc00', 14);
        }
        if (typeof hostBroadcastCombatFx === 'function') {
            hostBroadcastCombatFx({
                kind: 'particle_burst',
                x: enemy.x,
                y: enemy.y,
                color: '#ffcc00',
                count: 14
            });
        }
    }

    function maybeEliteExecuteDamage(enemy, player, baseDamage) {
        if (!enemy || !enemy.eliteAffix || enemy.eliteAffix.type !== 'execute' || !player) return baseDamage;
        const threshold = enemy.eliteAffix.value.threshold || 0.35;
        const bonus = enemy.eliteAffix.value.bonus || 0.4;
        const hpPct = player.maxHp > 0 ? player.hp / player.maxHp : 1;
        if (hpPct <= threshold) return baseDamage * (1 + bonus);
        return baseDamage;
    }

    function drawEliteThreatRing(ctx, enemy, timeSec) {
        if (!ctx || !enemy || !enemy.eliteAffix) return;
        const affixType = enemy.eliteAffix.type;
        let color = { r: 255, g: 180, b: 60 };
        if (typeof AFFIX_VISUAL_MAP !== 'undefined' && AFFIX_VISUAL_MAP[affixType]) {
            color = AFFIX_VISUAL_MAP[affixType].color;
        }
        const pulse = 0.55 + 0.45 * Math.sin((timeSec || 0) * 6);
        const radius = (enemy.size || 20) + 10;
        const jagged = 10;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = `rgb(${color.r},${color.g},${color.b})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= jagged; i++) {
            const t = (i / jagged) * Math.PI * 2;
            const jag = (i % 2 === 0) ? 1.0 : 0.78;
            const x = enemy.x + Math.cos(t) * radius * jag;
            const y = enemy.y + Math.sin(t) * radius * jag;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    function getEliteAffixColor(affixType) {
        if (typeof AFFIX_VISUAL_MAP !== 'undefined' && AFFIX_VISUAL_MAP[affixType]) {
            return AFFIX_VISUAL_MAP[affixType].color;
        }
        return { r: 255, g: 180, b: 60 };
    }

    /**
     * Index / UI preview: sample enemy + jagged threat ring + affix-specific tell.
     */
    function paintEliteAffixPreview(canvas, affixType, timeSec) {
        if (!canvas || !affixType) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const size = Math.min(w, h) * 0.18;
        const t = timeSec != null ? timeSec : (Date.now() / 1000);
        const color = getEliteAffixColor(affixType);
        const rgb = `rgb(${color.r},${color.g},${color.b})`;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#141418';
        ctx.fillRect(0, 0, w, h);

        const fakeEnemy = {
            x: cx,
            y: cy,
            size,
            eliteAffix: { type: affixType, value: {} },
            phasingActive: affixType === 'phasing'
        };

        // Body - phasing reads translucent
        const bodyAlpha = affixType === 'phasing' ? 0.3 : 1;
        if (typeof EnemyIndexCatalog !== 'undefined' && EnemyIndexCatalog.drawEnemyShape) {
            EnemyIndexCatalog.drawEnemyShape(ctx, 'circle', cx, cy, size, {
                color: '#e07070',
                alpha: bodyAlpha,
                showFacing: true
            });
        } else {
            ctx.save();
            ctx.globalAlpha = bodyAlpha;
            ctx.fillStyle = '#e07070';
            ctx.beginPath();
            ctx.arc(cx, cy, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Shared jagged threat ring (same as in combat)
        drawEliteThreatRing(ctx, fakeEnemy, t);

        // Affix-specific overlay tells
        ctx.save();
        if (affixType === 'phasing') {
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = '#c8c8ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(cx, cy, size + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (affixType === 'fortify') {
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = rgb;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, size + 5, 0, Math.PI * 2);
            ctx.stroke();
        } else if (affixType === 'multishot') {
            for (let i = -1; i <= 1; i++) {
                const ang = -0.35 + i * 0.35;
                const x1 = cx + Math.cos(ang) * (size + 8);
                const y1 = cy + Math.sin(ang) * (size + 8);
                const x2 = cx + Math.cos(ang) * (size + 28);
                const y2 = cy + Math.sin(ang) * (size + 28);
                ctx.strokeStyle = rgb;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                ctx.fillStyle = rgb;
                ctx.beginPath();
                ctx.arc(x2, y2, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (affixType === 'explosiveAttacks') {
            const pulse = 0.5 + 0.5 * Math.sin(t * 5);
            ctx.globalAlpha = 0.35 + 0.35 * pulse;
            ctx.strokeStyle = rgb;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, size + 18 + pulse * 6, 0, Math.PI * 2);
            ctx.stroke();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI * 2 * i) / 6 + t;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a) * (size + 10), cy + Math.sin(a) * (size + 10));
                ctx.lineTo(cx + Math.cos(a) * (size + 22), cy + Math.sin(a) * (size + 22));
                ctx.stroke();
            }
        } else if (affixType === 'chainLightning') {
            ctx.strokeStyle = rgb;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx + size + 4, cy);
            ctx.lineTo(cx + size + 14, cy - 8);
            ctx.lineTo(cx + size + 18, cy + 4);
            ctx.lineTo(cx + size + 30, cy - 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx + size + 14, cy - 8);
            ctx.lineTo(cx + size + 22, cy - 16);
            ctx.stroke();
        } else if (affixType === 'execute') {
            ctx.strokeStyle = rgb;
            ctx.fillStyle = 'rgba(255,50,50,0.25)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy - size - 10, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 4, cy - size - 8);
            ctx.lineTo(cx + 4, cy - size - 8);
            ctx.stroke();
        } else if (affixType === 'rampage') {
            ctx.strokeStyle = rgb;
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                const ox = -size - 8 - i * 5;
                const oy = -6 + i * 6;
                ctx.beginPath();
                ctx.moveTo(cx + ox, cy + oy);
                ctx.lineTo(cx + ox + 10, cy + oy);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    function createEliteAffixPreviewCanvas(affixType, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width || 72;
        canvas.height = height || 72;
        canvas.style.display = 'block';
        canvas.style.borderRadius = '8px';
        canvas.style.background = '#141418';
        paintEliteAffixPreview(canvas, affixType, 0);
        return canvas;
    }

    global.EliteEnemyAffixes = {
        byBiome: ELITE_AFFIX_BY_BIOME,
        index: ELITE_AFFIX_INDEX,
        indexOrder: ELITE_AFFIX_ORDER,
        getBiomesForEliteAffix,
        applyEliteAffix,
        onEliteAttackCommit,
        updateEliteAffix,
        getEliteDamageTakenMultiplier,
        triggerEliteRampage,
        triggerEliteExplosion,
        maybeEliteExecuteDamage,
        drawEliteThreatRing,
        paintEliteAffixPreview,
        createEliteAffixPreviewCanvas,
        getEliteAffixColor,
        getEliteChance
    };
})(typeof window !== 'undefined' ? window : globalThis);

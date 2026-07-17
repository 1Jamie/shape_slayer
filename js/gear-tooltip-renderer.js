// Gear tooltip renderer - extracted for use in gear mode even when DOM UI is enabled
// This provides tooltips for ground gear using the renderer-based UI which has direct access to positions

// Render gear tooltip when near gear (only in gear mode)
function renderGearTooltips(ctx, player) {
    // Only show in gear mode
    // if (typeof Game === 'undefined' || Game.gameMode !== 'gear') {
    //     // console.log('Not in gear mode:', Game ? Game.gameMode : 'Game undefined');
    //     if (Math.random() < 0.01) console.log('Tooltip skipped: Game mode is', Game ? Game.gameMode : 'undefined');
    //     return;
    // }

    if (!player || !player.alive) {
        return;
    }

    // Check for groundLoot - try multiple ways to access it
    let loot = null;
    if (typeof window !== 'undefined' && window.groundLoot && Array.isArray(window.groundLoot)) {
        loot = window.groundLoot;
    } else if (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot)) {
        loot = groundLoot;
    }

    if (!loot || loot.length === 0) {
        // console.log('No loot found');
        return;
    }

    // Update nearby items list
    if (typeof LootSelection === 'undefined' || !LootSelection.updateNearbyItems) {
        console.error('LootSelection not defined or missing updateNearbyItems');
        return;
    }

    LootSelection.updateNearbyItems(player);
    const selectedGear = LootSelection.getSelectedGear();
    const nearbyCount = LootSelection.getCount();

    // Only show tooltip for selected gear (or if only one nearby)
    if (!selectedGear) {
        // console.log('No gear selected. Nearby count:', nearbyCount);
        return;
    }

    console.log('Rendering tooltip for:', selectedGear.name);

    const gear = selectedGear;
    const dx = gear.x - player.x;
    const dy = gear.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Show tooltip for the selected gear
    // LootSelection already handles range checks (approx 60px)

    // Check if any enemy is within 150px of the gear
    // If so, don't show tooltip to avoid obstructing combat

    // Get enemy list based on multiplayer vs solo mode
    let enemies = [];
    if (typeof Game !== 'undefined') {
        const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;

        if (inMultiplayer && Game.enemies) {
            enemies = Game.enemies.filter(e => e && e.alive);
        } else if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.enemies) {
            enemies = currentRoom.enemies.filter(e => e && e.alive);
        }
    }

    // Check if any enemy is too close to the gear
    const enemyTooClose = enemies.some(enemy => {
        if (!enemy || typeof enemy.x !== 'number' || typeof enemy.y !== 'number') return false;
        const edx = enemy.x - gear.x;
        const edy = enemy.y - gear.y;
        const enemyDistance = Math.sqrt(edx * edx + edy * edy);
        return enemyDistance < 150;
    });

    if (enemyTooClose) {
        return; // Don't show tooltip when enemies are nearby
    }

    // Build tooltip content - TWO COLUMNS (current vs new)
    const leftLines = [];  // Current gear
    const rightLines = []; // New gear

    // Get currently equipped gear in same slot
    const currentGear = player.getEquippedGear ? player.getEquippedGear(gear.slot) : null;

    // === LEFT COLUMN: CURRENT GEAR ===
    if (currentGear) {
        let currentTitle = `CURRENT ${gear.slot.toUpperCase()}`;
        if (currentGear.weaponType && typeof WEAPON_TYPES !== 'undefined' && WEAPON_TYPES[currentGear.weaponType]) {
            currentTitle = `${WEAPON_TYPES[currentGear.weaponType].name}`;
        }
        if (currentGear.armorType && typeof ARMOR_TYPES !== 'undefined' && ARMOR_TYPES[currentGear.armorType]) {
            currentTitle = `${ARMOR_TYPES[currentGear.armorType].name}`;
        }
        leftLines.push({ text: currentTitle, color: currentGear.color || '#ffffff', font: 'bold 14px Arial' });

        if (currentGear.weaponType && typeof getWeaponTypePickupInfo === 'function') {
            const info = getWeaponTypePickupInfo(currentGear.weaponType);
            if (info && info.blurb) {
                leftLines.push({ text: info.blurb, color: info.color || '#aaaaaa', font: '10px Arial' });
            }
        }

        if (currentGear.stats && currentGear.stats.damage) {
            leftLines.push({ text: `+${currentGear.stats.damage.toFixed(1)} Dmg`, color: '#ff8888', font: '12px Arial' });
        }
        if (currentGear.stats && currentGear.stats.defense) {
            leftLines.push({ text: `+${(currentGear.stats.defense * 100).toFixed(1)}% Def`, color: '#88aaff', font: '12px Arial' });
        }
        if (currentGear.stats && currentGear.stats.speed) {
            leftLines.push({ text: `+${(currentGear.stats.speed * 100).toFixed(0)}% Spd`, color: '#88ff88', font: '12px Arial' });
        }

        const affixCount = (currentGear.affixes && currentGear.affixes.length) || 0;
        if (affixCount > 0) {
            leftLines.push({ text: `${affixCount} affixes`, color: '#aaddff', font: '11px Arial' });
            // Show first 3 affixes for current gear too
            for (let i = 0; i < Math.min(3, currentGear.affixes.length); i++) {
                const affix = currentGear.affixes[i];
                let displayValue, displayName;

                const isIntegerAffix = ['dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot'].includes(affix.type);
                if (isIntegerAffix) {
                    displayValue = `+${affix.value.toFixed(0)}`;
                    const nameMap = {
                        pierce: 'Pierce',
                        chainLightning: 'Chain',
                        multishot: 'Multishot'
                    };
                    displayName = nameMap[affix.type] || affix.type.replace(/([A-Z])/g, ' $1').trim();
                } else if (affix.type === 'critDamage') {
                    displayValue = `+${(affix.value * 100).toFixed(0)}%`;
                    displayName = 'Crit Dmg Bonus';
                } else {
                    displayValue = `+${(affix.value * 100).toFixed(0)}%`;
                    displayName = affix.type.replace(/([A-Z])/g, ' $1').trim();
                }

                leftLines.push({ text: `  ${displayName}: ${displayValue}`, color: '#aaddff', font: '11px Arial' });
            }
        }
    } else {
        leftLines.push({ text: 'NONE EQUIPPED', color: '#888888', font: 'bold 14px Arial' });
    }

    // === RIGHT COLUMN: NEW GEAR ===
    let newTitle = `${(gear.tier || 'gray').toUpperCase()} ${gear.slot.toUpperCase()}`;
    if (gear.weaponType && typeof WEAPON_TYPES !== 'undefined' && WEAPON_TYPES[gear.weaponType]) {
        newTitle = `${WEAPON_TYPES[gear.weaponType].name}`;
    }
    if (gear.armorType && typeof ARMOR_TYPES !== 'undefined' && ARMOR_TYPES[gear.armorType]) {
        newTitle = `${ARMOR_TYPES[gear.armorType].name}`;
    }
    rightLines.push({ text: newTitle, color: gear.color || '#ffffff', font: 'bold 14px Arial' });

    if (gear.weaponType && typeof getWeaponTypePickupInfo === 'function') {
        const info = getWeaponTypePickupInfo(gear.weaponType);
        if (info && info.blurb) {
            rightLines.push({ text: info.blurb, color: info.color || '#aaaaaa', font: '10px Arial' });
        }
    }

    if (gear.name) {
        rightLines.push({ text: gear.name, color: '#ffffff', font: '12px Arial' });
    }

    if (gear.stats && gear.stats.damage) {
        rightLines.push({ text: `+${gear.stats.damage.toFixed(1)} Dmg`, color: '#ff8888', font: '12px Arial' });
    }
    if (gear.stats && gear.stats.defense) {
        rightLines.push({ text: `+${(gear.stats.defense * 100).toFixed(1)}% Def`, color: '#88aaff', font: '12px Arial' });
    }
    if (gear.stats && gear.stats.speed) {
        rightLines.push({ text: `+${(gear.stats.speed * 100).toFixed(0)}% Spd`, color: '#88ff88', font: '12px Arial' });
    }

    const newAffixCount = (gear.affixes && gear.affixes.length) || 0;
    if (newAffixCount > 0) {
        rightLines.push({ text: `${newAffixCount} affixes`, color: '#aaddff', font: '11px Arial' });
        // Show first 3 affixes
        for (let i = 0; i < Math.min(3, gear.affixes.length); i++) {
            const affix = gear.affixes[i];
            let displayValue, displayName;

            const isIntegerAffix = ['dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot'].includes(affix.type);
            if (isIntegerAffix) {
                displayValue = `+${affix.value.toFixed(0)}`;
                const nameMap = {
                    pierce: 'Pierce',
                    chainLightning: 'Chain',
                    multishot: 'Multishot'
                };
                displayName = nameMap[affix.type] || affix.type.replace(/([A-Z])/g, ' $1').trim();
            } else if (affix.type === 'critDamage') {
                displayValue = `+${(affix.value * 100).toFixed(0)}%`;
                displayName = 'Crit Dmg Bonus';
            } else {
                displayValue = `+${(affix.value * 100).toFixed(0)}%`;
                displayName = affix.type.replace(/([A-Z])/g, ' $1').trim();
            }

            rightLines.push({ text: `  ${displayName}: ${displayValue}`, color: '#aaddff', font: '11px Arial' });
        }
    }

    if (gear.classModifier) {
        const classIcon = gear.classModifier.class === 'universal' ? '[All]' : `[${gear.classModifier.class}]`;
        rightLines.push({ text: `${classIcon} ${gear.classModifier.description || 'Class Modifier'}`, color: '#ffaa00', font: 'bold 11px Arial' });
    }

    if (gear.legendaryEffect) {
        rightLines.push({ text: '[LEGENDARY]', color: '#ff9800', font: 'bold 12px Arial' });
        rightLines.push({ text: gear.legendaryEffect.description || 'Legendary Effect', color: '#ff9800', font: '11px Arial' });
    }

    // Calculate tooltip size
    const lineHeight = 16;
    const columnWidth = 150;
    const tooltipWidth = columnWidth * 2 + 20; // Two columns + padding
    const maxLines = Math.max(leftLines.length, rightLines.length) + 1; // +1 for column label row
    const tooltipHeight = Math.max(120, maxLines * lineHeight + 50);

    // Position tooltip at fixed screen position below the room label (DOM UI)
    // Room label is centered, top: 15px, minHeight: 70px, so it ends around 85-90px
    // We want the TOP of the tooltip to be at 100px
    const centerX = Game ? Game.config.width / 2 : 640;
    const tooltipX = centerX; // Centered like room label
    let tooltipY = 100 + (tooltipHeight / 2); // Center Y = Top Margin + Half Height

    // Draw tooltip background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(tooltipX - tooltipWidth / 2, tooltipY - tooltipHeight / 2, tooltipWidth, tooltipHeight);

    // Draw border (color based on tier)
    ctx.strokeStyle = gear.color || '#999999';
    ctx.lineWidth = 3;
    ctx.strokeRect(tooltipX - tooltipWidth / 2, tooltipY - tooltipHeight / 2, tooltipWidth, tooltipHeight);

    // Draw divider line
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tooltipX, tooltipY - tooltipHeight / 2 + 5);
    ctx.lineTo(tooltipX, tooltipY + tooltipHeight / 2 - 30);
    ctx.stroke();

    // Draw column labels
    const headerY = tooltipY - tooltipHeight / 2 + 16;
    ctx.fillStyle = '#ffffaa';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Equipped', tooltipX - columnWidth / 2, headerY);
    ctx.fillText('On Ground', tooltipX + columnWidth / 2, headerY);

    // Draw left column (current gear)
    ctx.textAlign = 'center';
    let currentY = headerY + lineHeight;
    leftLines.forEach(line => {
        ctx.fillStyle = line.color;
        ctx.font = line.font;
        ctx.fillText(line.text, tooltipX - columnWidth / 2, currentY);
        currentY += lineHeight;
    });

    // Draw right column (new gear)
    currentY = headerY + lineHeight;
    rightLines.forEach(line => {
        ctx.fillStyle = line.color;
        ctx.font = line.font;
        ctx.fillText(line.text, tooltipX + columnWidth / 2, currentY);
        currentY += lineHeight;
    });

    // Draw comparison arrow
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('→', tooltipX, tooltipY);

    // Draw pickup prompt when keyboard/mouse or gamepad world hints are active.
    if (typeof Input !== 'undefined' && (!Input.shouldShowWorldInteractionHints || Input.shouldShowWorldInteractionHints())) {
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';

        let promptY = tooltipY + tooltipHeight / 2 - 8;
        if (Input.drawInteractionPrompt) {
            Input.drawInteractionPrompt(ctx, 'pick up', tooltipX, promptY);
        } else {
            const prompt = Input.getInteractionPrompt ? Input.getInteractionPrompt('pick up') : 'Press G to pickup';
            ctx.fillText(prompt, tooltipX, promptY);
        }

        // Show cycling instructions if multiple items nearby
        if (nearbyCount > 1 && LootSelection.selectedIndex !== undefined) {
            promptY += 18;
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '11px Arial';
            ctx.fillText(`← → to cycle (${LootSelection.selectedIndex + 1}/${nearbyCount})`, tooltipX, promptY);
        }
    }

    // No range indicator needed - tooltip is at fixed screen position
}


// Manual Debug Script for Multiplayer Damage Numbers
// Copy and paste this into your browser console (F12) on BOTH host and client
// Run this AFTER joining a lobby and starting combat

(function() {
    console.log('='.repeat(60));
    console.log('DAMAGE NUMBER DEBUG CHECKER');
    console.log('='.repeat(60));
    
    // Check 1: Is multiplayer enabled?
    const mpEnabled = typeof Game !== 'undefined' ? Game.multiplayerEnabled : false;
    console.log(`✓ 1. Game.multiplayerEnabled: ${mpEnabled}`, mpEnabled ? '✓' : '✗ FAIL');
    
    // Check 2: Is multiplayerManager loaded?
    const mmLoaded = typeof multiplayerManager !== 'undefined' && multiplayerManager !== null;
    console.log(`✓ 2. multiplayerManager loaded: ${mmLoaded}`, mmLoaded ? '✓' : '✗ FAIL');
    
    if (mmLoaded) {
        console.log(`   - Connected: ${multiplayerManager.connected}`);
        console.log(`   - Lobby Code: ${multiplayerManager.lobbyCode}`);
        console.log(`   - Is Host: ${multiplayerManager.isHost}`);
    }
    
    // Check 3: Are we in PLAYING state?
    const gameState = typeof Game !== 'undefined' ? Game.state : 'unknown';
    console.log(`✓ 3. Game state: ${gameState}`, gameState === 'PLAYING' ? '✓' : '⚠️');
    
    // Check 4: Are there enemies?
    const enemyCount = typeof Game !== 'undefined' && Game.enemies ? Game.enemies.length : 0;
    console.log(`✓ 4. Enemy count: ${enemyCount}`, enemyCount > 0 ? '✓' : '✗ FAIL');
    
    // Check 5: Is isMultiplayerClient() working?
    const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient ? Game.isMultiplayerClient() : null;
    console.log(`✓ 5. isMultiplayerClient(): ${isClient}`, isClient !== null ? '✓' : '✗ FAIL');
    
    // Check 6: Are damage numbers in array?
    const damageNumCount = typeof Game !== 'undefined' && Game.damageNumbers ? Game.damageNumbers.length : 0;
    console.log(`✓ 6. Current damage numbers: ${damageNumCount}`);
    
    if (damageNumCount > 0 && Game.damageNumbers) {
        Game.damageNumbers.forEach((dn, i) => {
            console.log(`   DN${i}: pos=(${dn.x.toFixed(0)}, ${dn.y.toFixed(0)}), damage=${dn.damage}, life=${dn.life.toFixed(2)}`);
        });
    }
    
    // Check 7: Camera position
    if (typeof Game !== 'undefined' && Game.camera) {
        console.log(`✓ 7. Camera: (${Game.camera.x.toFixed(0)}, ${Game.camera.y.toFixed(0)})`);
    }
    
    // Check 8: createDamageNumber function exists?
    const cdnExists = typeof createDamageNumber !== 'undefined';
    console.log(`✓ 8. createDamageNumber exists: ${cdnExists}`, cdnExists ? '✓' : '✗ FAIL');
    
    // Check 9: Is ui.js loaded?
    const uiLoaded = typeof renderDamageNumbers !== 'undefined';
    console.log(`✓ 9. renderDamageNumbers exists: ${uiLoaded}`, uiLoaded ? '✓' : '✗ FAIL');
    
    console.log('\n' + '='.repeat(60));
    console.log('ENABLING DEBUG MODE');
    console.log('='.repeat(60));
    
    if (typeof DebugFlags !== 'undefined') {
        DebugFlags.DAMAGE_NUMBERS = true;
        console.log('✓ DebugFlags.DAMAGE_NUMBERS = true');
        console.log('\nNow attack an enemy and watch the console logs!');
        console.log('You should see:');
        console.log('  [Host/Melee] Sending damage_number... (on host)');
        console.log('  [Client] Received damage_number... (on client)');
        console.log('  [Client] Creating damage number... (on client)');
        console.log('  [UI] Damage number created... (on both)');
        console.log('  [UI] Rendering N damage numbers (on both)');
    } else {
        console.log('✗ DebugFlags not available - debug.js not loaded?');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('TEST: Creating a test damage number at player position');
    console.log('='.repeat(60));
    
    if (typeof Game !== 'undefined' && Game.player && typeof createDamageNumber !== 'undefined') {
        const testX = Game.player.x + 50;
        const testY = Game.player.y - 50;
        console.log(`Creating test damage number at (${testX.toFixed(0)}, ${testY.toFixed(0)})`);
        createDamageNumber(testX, testY, 999, true, false);
        console.log('✓ Test damage number created!');
        console.log('You should see "CRIT! 999" floating above your player for 1.5 seconds.');
        console.log(`Current array size: ${Game.damageNumbers.length}`);
    } else {
        console.log('✗ Cannot create test damage number');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    const checks = {
        'multiplayerEnabled': mpEnabled,
        'multiplayerManager loaded': mmLoaded,
        'in PLAYING state': gameState === 'PLAYING',
        'has enemies': enemyCount > 0,
        'createDamageNumber exists': cdnExists,
        'renderDamageNumbers exists': uiLoaded
    };
    
    const failedChecks = Object.entries(checks).filter(([k, v]) => !v);
    
    if (failedChecks.length === 0) {
        console.log('✅ ALL CHECKS PASSED');
        console.log('\nDamage numbers should be working!');
        console.log('If you still don\'t see them:');
        console.log('1. Make sure you\'re attacking enemies (hit detection)');
        console.log('2. Check if damage numbers are off-screen (camera far from action)');
        console.log('3. Watch console for debug logs when attacking');
    } else {
        console.log('❌ FAILED CHECKS:');
        failedChecks.forEach(([check, value]) => {
            console.log(`   ✗ ${check}: ${value}`);
        });
    }
    
    console.log('='.repeat(60));
})();


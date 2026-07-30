#!/usr/bin/env node

/**
 * Script to promote dev branch changes to main (production release) across
 * both shape_engine and shape_slayer repositories.
 *
 * Ensures that:
 * 1. Engine changes on 'dev' are merged into shape_engine 'main'.
 * 2. Dev branch README notice banners are stripped out on 'main'.
 * 3. shape_slayer 'main' merges 'dev' and updates .gitmodules to track shape_engine 'main'.
 * 4. Full test suite passes before pushing 'main' to origin.
 * 5. Local working directories are restored to 'dev' when complete.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const gameDir = path.resolve(__dirname, '..');
const engineDir = path.resolve(gameDir, '../shape_engine');

function run(cmd, cwd = gameDir) {
    console.log(`\n> [${path.basename(cwd)}] ${cmd}`);
    return execSync(cmd, { cwd, stdio: 'inherit', encoding: 'utf8' });
}

function cleanDevBanner(readmePath) {
    if (!fs.existsSync(readmePath)) return false;
    let content = fs.readFileSync(readmePath, 'utf8');
    const regex = /> \[\!IMPORTANT\]\r?\n> ### 🧪 Development Branch \(`dev`\)\r?\n> You are viewing the \*\*development branch\*\* \(`dev`\)\.[^\n]*\r?\n\r?\n?/g;
    if (regex.test(content)) {
        content = content.replace(regex, '');
        fs.writeFileSync(readmePath, content, 'utf8');
        console.log(`  Cleaned dev banner from ${path.basename(readmePath)}`);
        return true;
    }
    return false;
}

try {
    console.log('=== Starting Release Promotion: dev -> main ===');

    // ----------------------------------------------------
    // 1. Process shape_engine repository
    // ----------------------------------------------------
    if (fs.existsSync(engineDir)) {
        console.log('\n--- Promoting shape_engine repository ---');
        run('git checkout main', engineDir);
        run('git pull origin main', engineDir);
        run('git merge dev --no-ff -m "release: merge dev branch into main"', engineDir);
        
        const engineReadme = path.join(engineDir, 'README.md');
        if (cleanDevBanner(engineReadme)) {
            run('git add README.md', engineDir);
            run('git commit --amend --no-edit', engineDir);
        }
        
        run('git push origin main', engineDir);
        run('git checkout dev', engineDir);
    } else {
        console.warn(`[Warning] Standalone engine directory at ${engineDir} not found. Skipping standalone push.`);
    }

    // ----------------------------------------------------
    // 2. Process shape_slayer repository
    // ----------------------------------------------------
    console.log('\n--- Promoting shape_slayer repository ---');
    run('git checkout main', gameDir);
    run('git pull origin main', gameDir);
    run('git merge dev --no-ff -m "release: merge dev branch into main"', gameDir);

    // Clean README on main
    const gameReadme = path.join(gameDir, 'README.md');
    cleanDevBanner(gameReadme);

    // Point submodule to main branch
    run('git config -f .gitmodules submodule.src/engine.branch main', gameDir);
    
    // Checkout engine submodule to main HEAD
    const submoduleDir = path.join(gameDir, 'src/engine');
    run('git fetch origin', submoduleDir);
    run('git checkout main', submoduleDir);
    run('git pull origin main', submoduleDir);

    // Stage and commit release adjustments
    run('git add .gitmodules README.md src/engine', gameDir);
    try {
        run('git commit -m "release: update main README, submodule configuration, and engine main HEAD"', gameDir);
    } catch (e) {
        console.log('No additional changes to commit on main.');
    }

    // Run tests on main before pushing
    console.log('\n--- Running test suite on main ---');
    run('npm test', gameDir);

    // Push main to origin
    console.log('\n--- Pushing shape_slayer main to origin ---');
    run('git push origin main', gameDir);

    // ----------------------------------------------------
    // 3. Restore working environment back to dev branch
    // ----------------------------------------------------
    console.log('\n--- Restoring working tree to dev branch ---');
    run('git checkout dev', gameDir);
    run('git config -f .gitmodules submodule.src/engine.branch dev', gameDir);
    run('git checkout dev', submoduleDir);
    run('git pull origin dev', submoduleDir);

    console.log('\n=== Release promotion completed successfully! ===\n');
} catch (err) {
    console.error('\n❌ Release promotion failed:', err.message);
    process.exit(1);
}

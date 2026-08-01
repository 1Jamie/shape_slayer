#!/usr/bin/env node

/**
 * Script to promote dev branch changes to main (production release) across
 * both shape_engine and shape_slayer repositories.
 *
 * Ensures that:
 * 1. Prompts for custom release notes via Vim and appends 'dev' commit log.
 * 2. Engine changes on 'dev' are merged into shape_engine 'main'.
 * 3. Dev branch README notice banners are stripped out on 'main'.
 * 4. shape_slayer 'main' merges 'dev' and updates .gitmodules to track shape_engine 'main'.
 * 5. Full test suite passes before pushing 'main' to origin.
 * 6. (Optional) Tags the releases if --version-engine or --version-game are provided.
 * 7. Local working directories are restored to 'dev' when complete.
 * 
 * Usage:
 *   node promote-dev-to-main.js
 *   node promote-dev-to-main.js --dry-run
 *   node promote-dev-to-main.js -ve 1.2.0 -vg 0.9.1
 *   node promote-dev-to-main.js --version-engine 1.2.0 --version-game 0.9.1
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const gameDir = path.resolve(__dirname, '..');
const engineDir = path.resolve(gameDir, '../shape_engine');

const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

// Parse independent version flags
let engineVersion = null;
let gameVersion = null;

const engineIdx = process.argv.findIndex(arg => arg === '--version-engine' || arg === '-ve');
if (engineIdx !== -1 && engineIdx + 1 < process.argv.length) {
    engineVersion = process.argv[engineIdx + 1];
    if (!engineVersion.startsWith('v')) engineVersion = 'v' + engineVersion;
}

const gameIdx = process.argv.findIndex(arg => arg === '--version-game' || arg === '-vg');
if (gameIdx !== -1 && gameIdx + 1 < process.argv.length) {
    gameVersion = process.argv[gameIdx + 1];
    if (!gameVersion.startsWith('v')) gameVersion = 'v' + gameVersion;
}

/**
 * Executes a shell command. 
 * If isDryRun is true and the command is NOT marked read-only, it skips execution and logs it.
 */
function run(cmd, cwd = gameDir, captureOutput = false, isReadOnly = false) {
    if (isDryRun && !isReadOnly) {
        console.log(`\n> [DRY RUN - ${path.basename(cwd)}] ${cmd}`);
        return '';
    }

    if (!captureOutput) {
        console.log(`\n> [${path.basename(cwd)}] ${cmd}`);
    }
    
    return execSync(cmd, { 
        cwd, 
        stdio: captureOutput ? 'pipe' : 'inherit', 
        encoding: 'utf8' 
    });
}

function cleanDevBanner(readmePath) {
    if (!fs.existsSync(readmePath)) return false;
    let content = fs.readFileSync(readmePath, 'utf8');
    
    // Matches > [!IMPORTANT] and all subsequent blockquote lines (> ...) including newlines
    const regex = /> \[\!IMPORTANT\]\r?\n(?:>.*\r?\n?)+\r?\n?/g;
    
    if (regex.test(content)) {
        if (isDryRun) {
            console.log(`  [DRY RUN] Would clean dev banner from ${path.basename(readmePath)}`);
            return true;
        }

        content = content.replace(regex, '');
        fs.writeFileSync(readmePath, content, 'utf8');
        console.log(`  Cleaned dev banner from ${path.basename(readmePath)}`);
        return true;
    }
    return false;
}

function getReleaseNotes(cwd, repoName) {
    // We pass `isReadOnly = true` so git log actually runs during a dry-run to show accurate data
    const commitLog = run('git log main..dev --oneline --no-merges', cwd, true, true).trim();
    
    if (isDryRun) {
        console.log(`\n  [DRY RUN] Would open Vim for ${repoName} release notes. Commits to append:`);
        console.log(commitLog ? commitLog.split('\n').map(line => `    - ${line}`).join('\n') : '    (No new commits)');
        return path.join(os.tmpdir(), `DRY_RUN_MSG_${repoName}.txt`);
    }

    const tmpFile = path.join(os.tmpdir(), `RELEASE_MSG_${repoName}_${Date.now()}.txt`);
    const initialContent = [
        `# Enter release notes for ${repoName} above.`,
        `# Lines starting with '#' will be ignored.`,
        `# Save and exit Vim to proceed, or exit without saving to cancel.`,
        ``,
        `# Included Commits:`,
        commitLog ? commitLog.split('\n').map(line => `# - ${line}`).join('\n') : '# (No new commits)'
    ].join('\n');

    fs.writeFileSync(tmpFile, initialContent, 'utf8');

    // Launch Vim in foreground
    const editor = process.env.EDITOR || 'vim';
    const result = spawnSync(editor, [tmpFile], { stdio: 'inherit' });

    if (result.status !== 0) {
        throw new Error(`Editor ${editor} exited with non-zero code (${result.status}). Promotion aborted.`);
    }

    const userMessage = fs.readFileSync(tmpFile, 'utf8')
        .split('\n')
        .filter(line => !line.trim().startsWith('#'))
        .join('\n')
        .trim();

    fs.unlinkSync(tmpFile);

    if (!userMessage) {
        console.warn(`[Warning] No custom release message supplied for ${repoName}. Using default commit log.`);
    }

    const formattedCommitList = commitLog 
        ? commitLog.split('\n').map(line => `- ${line}`).join('\n')
        : '- Maintenance release / dependencies update';

    const finalNotes = userMessage 
        ? `${userMessage}\n\nCommits included in this release:\n${formattedCommitList}`
        : `release: merge dev branch into main\n\nCommits included in this release:\n${formattedCommitList}`;

    // Write final commit message file for git merge -F
    const msgFile = path.join(os.tmpdir(), `FINAL_MSG_${repoName}_${Date.now()}.txt`);
    fs.writeFileSync(msgFile, finalNotes, 'utf8');
    return msgFile;
}

try {
    if (isDryRun) {
        console.log('\n=============================================');
        console.log('== 🚨 DRY RUN MODE ACTIVE - NO CHANGES 🚨 ==');
        console.log('=============================================');
    }
    
    console.log('\n=== Starting Release Promotion: dev -> main ===');
    if (engineVersion) console.log(`📦 Target Engine Version: ${engineVersion}`);
    if (gameVersion) console.log(`📦 Target Game Version: ${gameVersion}`);

    // ----------------------------------------------------
    // 1. Process shape_engine repository
    // ----------------------------------------------------
    if (fs.existsSync(engineDir)) {
        console.log('\n--- Promoting shape_engine repository ---');
        run('git checkout main', engineDir);
        run('git pull origin main', engineDir);

        const engineMsgFile = getReleaseNotes(engineDir, 'shape_engine');
        run(`git merge dev --no-ff -F "${engineMsgFile}"`, engineDir);
        
        if (!isDryRun) fs.unlinkSync(engineMsgFile);
        
        const engineReadme = path.join(engineDir, 'README.md');
        if (cleanDevBanner(engineReadme)) {
            run('git add README.md', engineDir);
            run('git commit --amend --no-edit', engineDir);
        }
        
        run('git push origin main', engineDir);

        if (engineVersion) {
            console.log('\n--- Tagging shape_engine release ---');
            run(`git tag -a ${engineVersion} -m "Release ${engineVersion}"`, engineDir);
            run(`git push origin ${engineVersion}`, engineDir);
        }

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

    const gameMsgFile = getReleaseNotes(gameDir, 'shape_slayer');
    run(`git merge dev --no-ff -F "${gameMsgFile}"`, gameDir);
    
    if (!isDryRun) fs.unlinkSync(gameMsgFile);

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
        if (!isDryRun) console.log('No additional changes to commit on main.');
    }

    // Run tests on main before pushing
    console.log('\n--- Running test suite on main ---');
    run('npm test', gameDir);

    // Push main to origin
    console.log('\n--- Pushing shape_slayer main to origin ---');
    run('git push origin main', gameDir);

    if (gameVersion) {
        console.log('\n--- Tagging shape_slayer release ---');
        run(`git tag -a ${gameVersion} -m "Release ${gameVersion}"`, gameDir);
        run(`git push origin ${gameVersion}`, gameDir);
    }

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
// Version and update messages
// Update this file when releasing new versions

const GameVersion = {
    VERSION: '0.5.1',
    
    UPDATE_MESSAGES: {
        '0.2.1': 'Initial early access release! Please report any bugs you find at https://github.com/1jamie/shape_slayer/issues',
        '0.2.2': 'Refactored the code to be more modular and easier to maintain with classes. Now uses a base class for all players and subclasses for each class in their own files. This will make it easier to add new classes in the future and one class cant break the whole game.',
        '0.3.0': 'Added multiplayer support. Now you can play with up to 3 friends online. Please report any bugs you find at https://github.com/1jamie/shape_slayer/issues',
        '0.3.1': '- Fixed a bug where after starting a run solo you could no longer access the multiplayer menu. \n - Added seperate tracking for currency per player and currency earned in multiplayer is properly tracked and shared back to the client so when you play solo it is still there! \n - Same was done for upgrades so each class will have its upgrades and you can use them in mutliplayer and solo.',
        '0.4.1': '- Fixed bug that prevented single player instances from purchasing upgrades in the Nexus. (my bad, i really should have caught this before release of the multiplayer system < thanks you know who for the catch >)',
        '0.5.1': `**Class Balance Update: Tank Rebuild & Warrior Enhancement**

**Tank Class Overhaul:**
• **New Passive - Retaliatory Knockback:** Tank now pushes back nearby enemies when hit (3s cooldown, small knockback radius)
• **Basic Attack Enhancement:** Hammer attacks now heal for 5% of damage dealt, giving the tank much-needed sustain
• **Ground Smash → Shout (Heavy Attack Rework):**
  - Renamed and redesigned from knockback to crowd control focus
  - Now applies 1.5s stun followed by 50% slow for 2s
  - Generates 3x aggro threat to help maintain enemy attention
  - Reduced damage to 0.975x (down from 1.3x) to balance the powerful CC
  - Increased radius from 120 to 140 pixels
  - Improved hitbox coverage for more reliable hits
  - New sound wave visual effects
• **Aggro System:** Extended enemy aggro window from 5s to 8s for better threat retention
• **Playstyle Shift:** Tank is now a true crowd control and aggro management class with self-sustain, rather than just a damage sponge

**Warrior Enhancement:**
• **Thrust Invincibility:** Forward thrust heavy attack now grants invincibility frames during the entire dash (0.12s), making it a viable defensive repositioning tool
• **Whirlwind Duration:** Increased from 2s to 2.1s
• **Thrust Damage:** Decreased from 2x to 1.6x
• **Base Damage:** Reduced from 14 to 12


**Enemy AI Enhancement:**
• Added slow effect system to all enemy types (separate from stun)
• Enemies can now be slowed independently of stun status
• Ranged enemies now star shaped instead of just a circle
• Elites now are purple
• Elites now spawn minons when you first enguage and can now spawn them at range as well to try to discourage running from them to prevent them from spawning minions
• Rectangle enemies (brutes) are now tankier: HP increased from 75 to 100
• Rectangle enemies attack range increased by 25% (from 80 to 100 pixels for both charge and slam radius)

**Affix & Legendary Effect Fixes:**
• Fixed beam charges affix properly granting extra charges when equipped
• Fixed lifesteal working on all damage sources (projectiles, abilities, DoT effects)
• Fixed thrust distance bonus affecting travel range, damage range, and i-frame duration
• Implemented legendary effects: Chain Lightning (visual arcs), Incendiary (burn DoT), Freezing (slow on hit)
• Added visual effects: lightning arcs, burn glow with fire particles, freeze glow with ice crystals
• Reduced affix max values for balance (movement speed, attack speed, projectile speed, cooldown reduction)
• Reduced spawn rate of overpowered affixes

**Experimental Sound System:**
• Added procedural sound effects using Web Audio API (experimental - no audio files required)
• Unique sounds for each class's attacks, abilities, and movement
• Impact sounds for hits, crits, and special interactions
• Enemy attack sounds and projectile hit feedback
• Volume control in pause menu (cycles through 100%, 75%, 50%, 25%, muted)
• Sound design is experimental and subject to change
`,
        '0.5.0': `**MAJOR UPDATE: Architecture & Quality of Life Improvements (ADDITION OF GEAR AFFIXES AND CLASS MODIFIERS!)**

**Gear Affixes and Class Modifiers:**
• **Gear Affix System:** Introducing a brand new loot and affix system! Gear drops (weapons, armor, trinkets) can now roll randomized affixes that grant unique stat bonuses or modifiers. Some examples include +Attack, +Defense, %Move Speed, Dodge Chance, Crit, class-specific effects, and more. Each piece of gear displays its affixes and stat rolls in detailed in-game tooltips.
• **Affix Display & UI:** Gear affix stats are now shown clearly on tooltips and in the character sheet. Stats appear in a dynamic affix list with colored icons and plain-English descriptions for easy comparison. Tooltips position intelligently on screen and resize on mobile.
• **Affix Rarities:** Items can have multiple affixes (up to 4 on high rarity gear), including rare and even class-specific legendary modifiers that can dramatically alter playstyle.
• **Real-Time Stat Updates:** Equipping, unequipping, or swapping gear instantly recalculates and displays your total stats (including all bonuses from affixes and class modifiers) in the stat breakdown.
• **Design Goal:** The new system enables true buildcrafting and replayability: experiment with different stat combinations, hunt for rare rolls, and customize your character with meaningful choices each run!


**Damage Numbers Multiplayer Sync Fix:**
• Fixed damage numbers not appearing on clients in multiplayer
• Corrected coordinate handling for accurate positioning
• Added validation to prevent crashes
• Host now sees damage numbers for remote player attacks
• Debug flag system for troubleshooting (DebugFlags.DAMAGE_NUMBERS)
• Comprehensive automated test suite using Puppeteer

**Mobile UI & Responsive Design:**
• Health bar, XP bar, and room number display scale responsively
• Character sheet redesigned for mobile:
  - Scrollable content (touch and mouse wheel support)
  - Responsive sizing (92% height on mobile)
  - Scrollbar visualization
  - Auto-closes on death
• Death screen improvements:
  - Responsive font scaling (up to 1.5x)
  - 3-second input delay to prevent accidental restarts
  - Better stat display and layout
  - Improved multiplayer death screen with proper player ordering
• Gear tooltips use world-to-screen coordinate conversion
• Touch controls refined with better cluster visualization

**Class Improvements/Changes:**
• Tank: Increased base damage from 8 to 12
• Mage: Decreased base damage from 20 to 12
• Mage: Decreased bolt speed from 300 to 400
• Tank: Decreased smash knockback from 350 to 250
• Tank: Decreased shield wave knockback from 500 to 300
• Tank: Decreased shield knockback distance from 30 to 15
• Mage: Swapped heavy attack from area of effect blast to energy beam with 2 charges and pierce

**Ability Improvements:**
• Shadow Clones (Rogue): Health bars, can be damaged, health decay, visual fade
• Blink Decoy (Mage): Health system with bar, can be damaged, decay over time

**Enemy AI Improvements:**
• Agro system compeltely reworked. Enemies now have a threat table that tracks players and their damage over time. They will then target the player with the highest threat. If an enemy is spawned by a boss or elite, they will inherit the target of the boss or elite but still have their own threat table. Enemies should not enguage until you are within a reasonable distance.

**Character Sheet Enhancements:**
• Scrollable content for mobile
• Better stat breakdown (dodge charge sources, crit damage multipliers)
• Class bonuses section with dynamic descriptions
• More detailed gear display with affixes and class modifiers

**Other Improvements:**
• Better error handling and validation throughout
• Improved code organization and maintainability
• Performance optimizations for mobile devices
• Better separation of concerns (config vs implementation)

**Server Architecture Refactor:**
• Complete server rewrite supporting three deployment modes:
  - Single-threaded (default, 100-1,000 players)
  - Multi-worker (clustering with Redis, 1,000-5,000 players)
  - Slave mode (multi-server cluster, 5,000+ players)
• Automatic Redis management via Docker for multi/slave modes
• Worker health monitoring and dynamic load balancing
• New configuration system via environment variables
• New files: mp-server-master.js, mp-server-worker.js, config.js
• Fully backward compatible with existing deployments
`
    },
    
    // Update type labels - can be: 'major', 'feature', 'minor', 'hotfix', 'bugfix'
    // Multiple tags can be assigned to show mixed updates
    UPDATE_TYPES: {
        '0.2.1': ['major', 'feature'],
        '0.2.2': ['minor', 'refactor'],
        '0.3.0': ['major', 'feature'],
        '0.3.1': ['minor', 'bugfix'],
        '0.4.1': ['hotfix'],
        '0.5.0': ['major', 'feature'],
        '0.5.1': ['minor', 'feature']
    }
};


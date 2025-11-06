// Version and update messages
// Update this file when releasing new versions

const GameVersion = {
    VERSION: '0.5.2',
    
    UPDATE_MESSAGES: {
        '0.2.1': 'Initial early access release! Please report any bugs you find at https://github.com/1jamie/shape_slayer/issues',
        '0.2.2': 'Refactored the code to be more modular and easier to maintain with classes. Now uses a base class for all players and subclasses for each class in their own files. This will make it easier to add new classes in the future and one class cant break the whole game.',
        '0.3.0': 'Added multiplayer support. Now you can play with up to 3 friends online. Please report any bugs you find at https://github.com/1jamie/shape_slayer/issues',
        '0.3.1': '- Fixed a bug where after starting a run solo you could no longer access the multiplayer menu. \n - Added seperate tracking for currency per player and currency earned in multiplayer is properly tracked and shared back to the client so when you play solo it is still there! \n - Same was done for upgrades so each class will have its upgrades and you can use them in mutliplayer and solo.',
        '0.4.1': '- Fixed bug that prevented single player instances from purchasing upgrades in the Nexus. (my bad, i really should have caught this before release of the multiplayer system < thanks you know who for the catch >)',
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
`,
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

**UI Changes:**
• Character sheet now has more transparency so the enemies are visible behind it. (a few less jump scares for the stat obsessed!)
`,
        '0.5.2': `**🔨 THE GREAT NERF-ENING 🔨**
*"Your damage? Gone. Your speed? Capped. Enemy HP? BEEFED. Welcome to Dark Souls: Geometry Edition"*

**🏃 Speed Scaling Rework (Because Sonic the Shapegon Was Getting Out of Hand):**
*"NASA called. They want their escape velocity back."*

• ** Added arrows to help guide players to the last few enemies since everyone seems to dislike having to search the whole room for the last few enemies... lazy bums!!!**

• ** Adjusted tool tips so they dont show when enemies are nearby... apparently people cant work around some ui clutter, boy would you hate my developtment environment. o_O **

• **Level-Up Speed Gains:** Reduced to a modest +5% per level for first 5 levels (all classes)
    *"I heard you like going fast, but not THAT fast"*
  - Old system: +10% per level (compounding, because I apparently love exponential nightmares)
  - New system: Fixed +5% per level for levels 2-5
    *"Also got tired of noise complaints from the FAA because you kept breaking the sound barrier in Room 3. Apparently that's 'illegal' and 'violates airspace regulations'? Whatever."*
  
• **Rogue Speed Boosts:** Still gets extra speed on levels 6, 8, 10 (because rogues deserve nice things)
  - Levels 6/8/10: Additional +8% each (only rogue, sorry warriors)
    *"Yes, I'm playing favorites. The rogue asked nicely. The warrior just grunted. Be more like rogue."*
  - Tank players: Stop emailing me, you're literally wearing a fortress
  
• **Speed Cap Implemented:** Maximum 450 px/s or 1.5× base speed (whichever is higher)
    *"Yes, I KNOW you reached 2000 speed. No, that's not a feature, that's a bug with a god complex and delusions of grandeur"*
  - Your previous max speed: Probably approaching light speed by room 15
  - Your new max speed: Still fast, just... mortal
    *"I apologize for ruining your speedrun strats. Actually, no I don't. That was stupid and you know it."*
  
• **Class Speed Hierarchy Maintained:** Rogue > Warrior > Mage > Tank
  - Final speeds at level 10: Rogue (414), Warrior (252), Mage (248), Tank (207)
    *"The tank is still slow. This is by design. Stop asking. You're carrying a door."*
    *"If you want to go fast, play rogue. If you want to tank, play tank. Revolutionary concept: classes have tradeoffs now."*

**⚔️ Damage Scaling Adjustments (I Did Math, You Won't Like It):**
• **Player Level Damage:** Reduced from +10% to **+7% per level**
    *"Exponential growth is great... if you're a bacteria. You're not bacteria."*
  - Level 10: Was 28.3, now 20.8 base damage
  - Level 20: Was 73.6, now 32.7 base damage (yeah, I went there)
• **Gear Room Scaling:** Reduced from +5% to **+4% per room**
    *"Your orange gear is still good. Just... 20% less good."*

**🛡️ Enemy HP Rebalancing (They Lift Now, Deal With It):**
• **Enemy HP Scaling:** Increased from +30% to **+35% per room**
    *"Turns out enemies should get tankier as you progress. Revolutionary concept, I know."*
  - Room 10 basic enemy: Was 160 HP, now 194 HP
  - Room 20 basic enemy: Was 280 HP, now 360 HP
• **Boss HP Scaling:** Increased from +28% to **+33% per room**
    *"Bosses were dying too fast. Now they die... eventually."*

**⚔️ Weapon Rebalancing (The Obtuse Nerf Hammer Strikes):**
• **Weapon Damage Ranges:** Reduced ~30% across ALL tiers
  - Gray: 3-6 → 2-4 (it's gray, what did you expect?)
  - Green: 8-12 → 6-9 (still better than gray!)
  - Blue: 15-22 → 11-16 (rare, but not THAT rare)
  - Purple: 25-35 → 18-26 (epic reduction is epic)
  - Orange: 35-50 → 26-38 (legendary... nerf)
• **Weapon Type Multipliers:**
  - Fast (Acute): 1.0 → 0.95 (speed tax applied)
  - Heavy (Obtuse): 1.4 → 1.25 (*"This one hurt me more than it hurt you. Just kidding, it definitely hurt you more."*)
  - Reach (Vector): 1.0 (unchanged, perfectly balanced as all things should be)
  - Dual (Parallel): 0.75 → 0.80 (pity buff, you're welcome)

**🛡️ Armor Rebalancing (Your Defense Is Showing. It's Smaller Now.):**
• **Armor Defense Ranges:** Reduced ~20% across ALL tiers
  - Gray: 0.02-0.05 → 0.02-0.04 (paper is paper)
  - Green: 0.06-0.10 → 0.05-0.08 (slightly sturdier paper)
  - Blue: 0.12-0.18 → 0.10-0.15 (cardboard)
  - Purple: 0.20-0.28 → 0.16-0.23 (metal... ish)
  - Orange: 0.30-0.45 → 0.24-0.36 (still the best, just less best)
• **Armor Type Multipliers:**
  - Light (Fractal): 0.7 → 0.75 (consolation prize)
  - Medium (Polygon): 1.0 (the baseline of mediocrity)
  - Heavy (Tessellated): 1.4 → 1.30 (*"Even the chonky armor lost weight"*)
  - Cloth (Membrane): 0.5 → 0.60 (it's called fashion, look it up)

**🎲 Affix Rebalancing (Your Build Just Got Build Different):**
• **Crit Damage:** 20-60% → 15-45% (*"One-shot builds are so last patch"*)
• **Area of Effect:** 15-35% → 12-28% (*"Stop clearing the entire screen in one hit"*)
• **Execute:** 30-60% → 25-50% (*"Finish him! ...but not THAT hard"*)
• **Explosive Attacks:** 15-30% → 12-25% (*"Michael Bay is disappointed"*)
• **Rampage:** 5-15% → 4-12% (*"Snowballing is for winter, not for DPS"*)

**✨ Legendary Effect Rebalancing (Even Legends Must Fall):**
• **Berserker Rage:** +30% dmg/-15% def → **+25% dmg/-20% def**
    *"More risk, less reward. That's the berserker way now."*
• **Glass Cannon:** +60% dmg/-50% HP → **+45% dmg/-40% HP**
    *"Still made of glass, just thicker glass. You're welcome."*
• **Chain Lightning:** 70% chain damage → **60% chain damage**
    *"The chain lightning now... chains... less-ingly?"*

**🎭 Class Modifier Adjustments (Everyone Takes the L):**
• All percentage damage modifiers reduced by ~20%:
  - Warrior: Whirlwind/Thrust damage 50% → 40%
  - Rogue: Dodge/Backstab damage 50% → 40%
  - Mage: Blink damage 100% → 80% (*"Still a 2x multiplier, calm down"*)
  - Tank: Shield wave damage 100% → 80%
  - Universal: Basic damage 25% → 20%
    *"I nerfed everyone equally. That's true equality."*

**👹 Boss HP Adjustments (They're Not Mad, Just Disappointed):**
• **BossBase Multiplier:** 15× → **12×**
    *"I reduced the multiplier but increased room scaling. Math is fun!"*
• **Individual Boss Base HP Reductions:**
  - Swarm King: 1510 → 1250 (fewer bees, same anger)
  - Twin Prism: 1842 → 1500 (prism solidarity)
  - Fortress: 1473 → 1200 (downsizing the fortress)
  - Fractal Core: 917 → 750 (less fractal, same core)
  - Vortex: 1842 → 1500 (the vortex is now... less vortex-y?)

**📊 Expected Difficulty Curve (It Goes Up, I Promise):**
• Room 1: 3.3 hits to kill (baseline, unchanged)
• Room 5: 3.0 hits to kill (early power fantasy, enjoy it while it lasts)
• Room 10: 2.6 hits to kill (you're doing great sweetie)
• Room 15: 2.7 hits to kill (uh oh, numbers going up)
• Room 20: 2.9 hits to kill (remember when you were powerful?)
• Room 30+: 3.4+ hits to kill (welcome back to Room 1, but everything hurts more)

**🎯 Design Philosophy:**
*"The game was getting easier as you progressed. That's backwards. Now it gets harder. You know, like a video game should. Wild concept, I know."*

**TL;DR:** Everything got nerfed. Yes, your favorite build too. No, I'm not sorry. The difficulty curve now actually curves. Math was involved. Lots of math. Send help.

*P.S. - If you're reading this in-game, you survived the nerf-ening. Congrats! Now go touch those pointy green shapes out in your yard known as grass!*
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
        '0.5.1': ['minor', 'feature'],
        '0.5.2': ['major', 'balance']
    }
};


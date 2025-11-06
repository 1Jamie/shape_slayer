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
        '0.5.1': `**🔨 THE GREAT REBALANCING 🔨**
*"48 hours. 3 patches melted down into 1. 1 developer who clearly needs sleep. Your game? Completely different now."*


## **🎮 PART 1: THE GREAT NERF-ENING**
*"Your damage? Gone. Your speed? Capped. Enemy HP? BEEFED. Welcome to Dark Souls: Geometry Edition"*

**🏃 Speed Scaling Rework (Because Sonic the Shapegon Was Getting Out of Hand):**
*"NASA called. They want their escape velocity back."*

• **Added arrows to help guide players to the last few enemies**
  *"Everyone seems to dislike searching the whole room for stragglers. Fine. Have your GPS."*

• **Adjusted tooltips so they don't show when enemies are nearby**
  *"Apparently people can't work around some UI clutter. Boy would you hate my development environment. o_O"*

• **Level-Up Speed Gains:** Reduced to +5% per level for first 5 levels (all classes)
  *"I heard you like going fast, but not THAT fast"*
  - Old: +10% per level (exponential nightmares)
  - New: Fixed +5% per level for levels 2-5
  *"Also got tired of noise complaints from the FAA because you kept breaking the sound barrier in Room 3. Apparently that's 'illegal'?"*

• **Rogue Speed Boosts:** Still gets extra speed on levels 6, 8, 10
  - Levels 6/8/10: Additional +8% each (only rogue, sorry warriors)
  *"Yes, I'm playing favorites. The rogue asked nicely. The warrior just grunted."*

• **Speed Cap Implemented:** Maximum 450 px/s or 1.5× base speed
  *"Yes, I KNOW you reached 2000 speed. No, that's not a feature, that's a bug with delusions of grandeur"*
  - Class hierarchy: Rogue (414) > Warrior (252) > Mage (248) > Tank (207)
  *"The tank is still slow. Stop asking. You're carrying a door."*

**⚔️ Damage Scaling Adjustments (I Did Math, You Won't Like It):**
• **Player Level Damage:** +10% → **+7% per level**
  *"Exponential growth is great... if you're a bacteria. You're not bacteria."*
• **Gear Room Scaling:** +5% → **+4% per room**
  *"Your orange gear is still good. Just... 20% less good."*

**🛡️ Enemy HP Rebalancing (They Lift Now):**
• **Enemy HP Scaling:** +30% → **+35% per room**
  *"Turns out enemies should get tankier as you progress. Revolutionary concept."*
• **Boss HP Scaling:** +28% → **+33% per room**

**⚔️ Weapon Rebalancing (The Obtuse Nerf Hammer Strikes):**
• **Damage Ranges:** Reduced ~30% across ALL tiers
  - Orange: 35-50 → 26-38 (legendary... nerf)
• **Type Multipliers:**
  - Heavy (Obtuse): 1.4 → 1.25 (*"This hurt me more than you. Just kidding, definitely hurt you more."*)

**🛡️ Armor Rebalancing (Your Defense Is Showing. It's Smaller Now.):**
• **Defense Ranges:** Reduced ~20% across ALL tiers
• **Type Multipliers:** Heavy armor nerfed, light armor buffed slightly

**🎲 Affix & Legendary Rebalancing:**
• Crit Damage: 20-60% → 15-45%
• AoE: 15-35% → 12-28% (*"Stop clearing the entire screen"*)
• Execute: 30-60% → 25-50%
• Berserker Rage: +30%/-15% → +25%/-20%
• Glass Cannon: +60%/-50% → +45%/-40%

**📊 Expected Difficulty Curve:**
*"The game was getting easier as you progressed. That's backwards. Now it actually gets harder."*
- Room 1: 3.3 hits to kill (baseline)
- Room 10: 2.6 hits (you're doing great sweetie)
- Room 20: 2.9 hits (remember when you were powerful?)
- Room 30+: 3.4+ hits (welcome back to Room 1, but everything hurts)

---

## **💪 PART 2: CLASS OVERHAULS & BALANCE**
*"Because after nerfing everything, we figured we'd throw you a bone. Or a hammer. Or a shout. Whatever."*

**🛡️ Tank Class Overhaul (From Damage Sponge to Actual Tank):**
*"Tanks kept dying. Weird. Almost like standing still and getting hit isn't a good strategy."*

• **New Passive - Retaliatory Knockback:** Get hit, push back nearby enemies
  *"They hit you, you hit them back. It's called manners."*
• **Basic Attack Enhancement:** Hammer attacks heal for 5% of damage dealt
  *"Turns out healing is good. Who knew?"*
• **Ground Smash → Shout (Heavy Attack Rework):**
  - Now applies 1.5s stun + 50% slow for 2s
  - Generates 3× aggro threat
  - Reduced damage to 0.975× (down from 1.3×)
  - Increased radius: 120 → 140 pixels
  *"You're not a DPS. Stop trying to be a DPS. You're crowd control now. Deal with it."*
• **Aggro System:** Extended window from 5s to 8s
• **Playstyle Shift:** True tank with CC, aggro management, and self-sustain
  *"Revolutionary concept: tanks that actually tank."*

**⚔️ Warrior Enhancement (Because We Felt Bad):**
*"After nerfing warrior damage, we gave them i-frames. Perfectly balanced."*

• **Thrust Invincibility:** Full i-frames during entire dash (0.12s)
  *"It's not much, but it's honest work."*
• **Whirlwind Duration:** 2s → 2.1s
• **Thrust Damage:** 2× → 1.6× (to compensate for the i-frames)
• **Base Damage:** 14 → 12 (because we're cruel)

---

## **🎯 PART 3: ENEMY SCALING IMPROVEMENTS**
*"Remember when Room 50 had 170 enemies in 4-player and your computer caught fire? Yeah, we fixed that."*

**Enemy Count Capping System:**
*"We stopped throwing more enemies at you and started making the existing ones CHONKY."*

• **Enemy count now caps at Room 18** (30 base, 75 in 4-player)
  - Rooms 1-18: Normal scaling (as before)
  - Rooms 19+: Count stays at 30, stats scale aggressively
  *"Quality over quantity. Your CPU thanks us."*

• **Aggressive Stat Scaling (Post-Cap):**
  - After Room 18: +50% HP/Damage per room (up from +35%)
  - Room 20: 8.3× stats (was 8.0×)
  - Room 30: 13.3× stats (was 11.5×)
  - Room 50: 23.3× stats (was 18.5×)
  *"Individual enemies become CHONKY boys instead of summoning the entire army."*

**What This Means:**
- Room 50 solo: 30 enemies instead of 68 (but they hit MUCH harder)
- Room 50 4-player: 75 enemies instead of 170
  *"Your computer says 'thank you'. Your tank says 'why are they so tanky?!'"*

**Why This Change:**
• Performance: No more lag/crashes in late game
• Visual Clarity: You can actually see what's happening
• Better Design: Skill > AoE spam
  *"Also our server was crying. Literally crying."*

---

## **👾 PART 4: ENEMY AI & BEHAVIOR**
*"Enemies got smarter. You probably won't like this."*

**Enemy AI Enhancement:**
• Added slow effect system (separate from stun)
  *"Enemies can now be stunned AND slowed. Stack those debuffs, baby."*
• Ranged enemies now triangle-shaped (no more circle imposters)
• Elites are purple now
  *"Because purple = fancy. It's science."*
• Elites spawn minions when engaged (even at range)
  *"Stop running from elites to cheese them. We're onto you."*
• Rectangle enemies (brutes):
  - HP: 75 → 100
    *"They hit the gym"*
  - Attack range: +25%
    *"And learned to reach"*

---

## **🔧 PART 5: BUG FIXES & TECHNICAL**
*"The boring stuff that makes the game actually work."*

**Affix & Legendary Effect Fixes:**
• Fixed beam charges actually working
• Fixed lifesteal working on ALL damage sources
• Fixed thrust distance affecting range, damage, and i-frames
• Implemented legendary effects with visuals:
  - Chain Lightning: Visual arcs
  - Incendiary: Burn DoT with fire particles
  - Freezing: Slow on hit with ice crystals
  *"They actually look cool now. You're welcome."*

**Experimental Sound System:**
*"We added sounds! They're procedural! No audio files! It's either genius or insane!"*
• Procedural sound effects using Web Audio API
• Unique sounds for each class's abilities
• Impact sounds for hits, crits, backstabs
• Volume control in pause menu
  *"Sound design is experimental. Translation: if it sounds weird, that's... intentional? Maybe?"*

**UI Changes:**
• Character sheet is more transparent
  *"Fewer jump scares for the stat-obsessed nerds. You know who you are."*

---

## **🎯 FINAL WORDS**

**Design Philosophy:**
*"The game was getting easier as you progressed. That's backwards. It's fixed now."*

**What We Did:**
- Nerfed player power (damage, speed, gear)
- Buffed enemy stats (HP, scaling)
- Capped enemy count (performance, clarity)
- Reworked tank (from doormat to actual tank)
- Made enemies smarter (sorry)
- Fixed a bunch of bugs (you didn't notice them but they were there)

**TL;DR:** 
Everything got nerfed. Tank got buffed. Enemies cap at 30 (but hit like trucks). Your computer no longer explodes. The game is harder now. Math was involved. SO MUCH MATH.

*P.S. - If you're reading this in-game, you survived the nerf-ening. Congrats! Now go touch those pointy green shapes in your yard known as grass. I know I should.*

*P.P.S. - This patch happened in way too few hours because I don't sleep. Send coffee. Or therapy. Preferably both.*
`
    },
    
    // Update type labels - can be: 'major', 'feature', 'minor', 'hotfix', 'bugfix', 'refactor', 'rebalance'
    // Multiple tags can be assigned to show mixed updates
    UPDATE_TYPES: {
        '0.2.1': ['major', 'feature'],
        '0.2.2': ['minor', 'refactor'],
        '0.3.0': ['major', 'feature'],
        '0.3.1': ['minor', 'bugfix'],
        '0.4.1': ['hotfix'],
        '0.5.0': ['major', 'feature'],
        '0.5.1': ['major', 'rebalance']
    }
};


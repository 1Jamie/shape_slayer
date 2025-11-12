// Version and update messages
// Update this file when releasing new versions

const GameVersion = {
    VERSION: '0.5.3.1',
    
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
        '0.5.1': `**🔨 THE GREAT REBALANCING 🔨** (11/05/2025)
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
`,
        '0.5.2': `**🩹 HOTFIX: DAMAGE CONTROL (LITERALLY) QOL** (11/09/2025)
*"Remember how you hit for 5,500 damage in Room 23? Yeah, that wasn't 'build craft'. That was a math crime."*

**👑 Swarm King: Beam Therapy & Minion Management**
• Apparently letting the Swarm King instantly summon a toddler daycare worth of minions while firing a laser that ignores physics wasn't great for mortal networking stacks. So we gave the monarch *structure*:
  - Beam now stares you down for a dramatic 2.1 seconds, paints a neon "you're doomed" line, and only turns at sensible speeds (~28°/s during telegraph).
  - The actual laser rotates even slower (~22°/s), grows out at a humane pace, and shares the same angle as the telegraph, so no blink-to-face melt cheese.
  - Minions are capped per phase (3 → 5 → 8) and spawn in bite-sized packs of three with a global cooldown (5s → 4s → 3s as the fight escalates).
  - Phase 3 beam is now a proper set-piece instead of a networking denial-of-service attack. Host CPU exhales; client FPS stands a chance. The world is safe once again.

**🎯 Player Damage Rehab**
• Legendary effects (hi Glass Cannon 👋) now boost damage WITHOUT secretly rewriting your DNA every time stats recalc.
  *"One-time buff, not a pyramid scheme."*
• Level-up scaling stops compounding like a crypto chart. Damage still grows, just not into the stratosphere.

**🔁 Stat Anchor Therapy**
• Every class now locks in its true base stats before math happens. No more gear swaps turning you into a demigod.
• Multiplayer host syncs the same anchors, so remote players don't accidentally cos-play as raid bosses.

**🤝 Glass Cannon Detente**
• Still juicy: +45% damage.
• Still spicy: -40% HP.
• No longer quietly multiplying itself into oblivion every time you blink.

**🛡️ Tank Personal Space Clause**
• Remember last patch when we rebuilt the tank from the ground up? Apparently enemies took that as an invitation to get personal with you. 
• Melee creeps now get punted back to a respectful distance instead of fusing with your hitbox like an overzealous group hug.
  *"Consent matters. Even in geometry."*

**🚪 Exit Strategy Intervention**
• Door now screams for attention with the same neon arrow that snitches on the last enemy.
• HUD swaps "Enemies" for "Door is open!" so solo players stop wandering like lost puppies.
• Multiplayer still nags you when your buddy’s on the panel. We just made the door say hi first.

**🎭 Legendary Identity Crisis Hotline**
• Legendary gear now has to pick a personality: either roll a class modifier OR a legendary affix. No more "have your cake, eat theirs, and delete the baker" builds.
  *"If you're orange and special, pick a lane."*

**💅 Legendary Dress Code**
• Orange items sporting class modifiers get a fresh teal glow so you can humblebrag about your build without squinting.
  *"When your drip screams 'I'm unique' but, like, responsibly."*

**🏃 Dash Physio Session**
• Dashing now stretches your shape like an overcaffeinated rubber band instead of the boring gray shadow that was there before.
  *"Snap, snap, hooray."*

**📈 Expected Result**
• Room 23 damage numbers now look like "strong wizard" instead of "orbital laser".
• TTK curve from 0.5.1 stays intact—just without players melting the universe.
• Can always easily find the door now.
• Legendary gear now stays in its own lane and does have a double identity crisis.
• Dashes feel elastic and dramatic without needing a goth teen sponsorship from hot topic.
• Swarm King's final phase is now a dramatic duel instead of a networking stress test disguised as a boss fight; your router can keep its dignity. 

*TL;DR:* Damage numbers are back on a leash. You can still break the game—just not by accident. You're welcome.*
`,
        '0.5.3': `**TELEM UPDATE** (11/11/2025)
*"Well you see... I found 'The boss feels spicy' doesnt really help me with balancing"*

**I CAN SEE YOU:**
• not really, i just put a telemetry system in the game to help me with balancing, it only logs numbers and sends them back, no personal data is collected, i only use the data to help me balance the game, nothing else.

**Updated Pause Menu:**
• this thing needed some updates to stlying and i added a new button to the pause menu to opt in or out of telemetry and a modal to explain what it is and why i added it.

*TL;DR:* Telemetry now exist in opt in and the pause menu looks much nicer*
`,
        '0.5.3.1': `**🔴 CIRCLE OF TRUST ISSUES** (11/12/2025)
*"Remember those red circles you bullied for being free XP? They called a meeting. You're the agenda and only thing they want is revenge!"*

• **Honor Society Enrollment (All Enemies):** Intelligence scaling got reprinted and stapled to everyone's forehead. Feints, combo detection, surround formations, lateral spread, wall awareness, pattern reads—all unlocked earlier and smarter. Room 4's PTA meeting is now a tactical seminar and you're the powerpoint.
• **Predictive Brainstem (All Melee):** They now track your speed, dodge cadence, and "oops I always roll left" habits. They lead your future position, pick approach angles that aren't your face, and only retreat when combo'd, cornered, or 5 HP from death. Translation: They actually use some strat.
• **Threat Board & Timing Tutors (Roster-Wide):** Every enemy now keeps a super petty threat ledger. Low HP? Dodging on cooldown? Swinging a lot? Congrats, you're on the menu. They wait out your iframes, dogpile when you're vulnerable, and stagger attacks like they're covering the lunch rush.
• **Simultaneous Swarming (Circle Squad):** Up to five red buddies can lunge at once, wave attacks trigger off any ready goons, and "positioners" rotate into attacker the second there's a gap. Your orderly duel queue? Replaced with synchronized homicide featuring orbital drift, feints, and combo lunges from room 1 onward.
• **Orbital Offense (Circles):** Predictive positioning, approach-angle variance, lateral spread, flanking bias, and environmental reads finally share a group chat. They'll slide to your blind spot, fake you out, orbit for surround coverage, and respect optimal spacing like they discovered geometry yesterday.
• **Sharpshooter Shapes (Triangle & Octagon):** Predictive aiming is mandatory with smoothed velocity history, iterative intercept math, and accuracy scaling from "hey nice try" to "95% of your future coordinates belong to us." Keep circle-strafing; they'll be over here solving for t.
• **Diamond Dash Etiquette (Diamond):** Telegraphs lock aim vectors on start, combo follow-ups wait a dramatic 250ms, and charge paths stay perfectly linear. If you still get full-body autographed, maybe stop dodging into the arrow labeled "danger zone."
• **Visual Aid, Now With Shade (All Enemies):** Telegraphs pulse harder, lunge trails linger, recovery backs off before re-engaging, and state colors scream what happens next. You begged for readability; they weaponized it and hit you right when the UI says "incoming."

**Other Changes:**
• **Multiplayer tweaks:** added player id to lobby tracking so if you reconnect you resume the same character instead of making a new one.
• **Menu overhaul:** Completely redid all the styling as lets be fair... the old was bubkis. Oh and now you can join lobbies from mobile without having to fight with the ui, it now actually kinda works.
• **Telemtry Fix:** Damage numbers were not being properly recorded and affixes were not being recorded either.... kinda makes the balancing a lot hard to do without those numbers.
• **Blue Diamond fix:** The blue diamond was having issues with ending up inside players.... hoepfully this patch they will feel a little less like sexual harassment.

*TL;DR:* Circles graduated from cannon fodder to coordinated nuisance, the ranged kids min-maxed physics homework, and every enemy now knows what "flank" means. Bring AoE, bring timing, bring therapy.`,
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
        '0.5.1': ['major', 'rebalance'],
        '0.5.2': ['minor', 'hotfix'],
        '0.5.3': ['minor'],
        '0.5.3.1': ['minor', 'feature', 'rebalance'] 
    }
};


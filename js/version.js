// Version and update messages
// Update this file when releasing new versions

const GameVersion = {
  // Keep sw.js CACHE_VERSION in sync when bumping this.
  VERSION: '0.8.2',

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
• TTK curve from 0.5.1 stays intact-just without players melting the universe.
• Can always easily find the door now.
• Legendary gear now stays in its own lane and does have a double identity crisis.
• Dashes feel elastic and dramatic without needing a goth teen sponsorship from hot topic.
• Swarm King's final phase is now a dramatic duel instead of a networking stress test disguised as a boss fight; your router can keep its dignity. 

*TL;DR:* Damage numbers are back on a leash. You can still break the game-just not by accident. You're welcome.*
`,
    '0.5.3': `**TELEM UPDATE** (11/11/2025)
*"Well you see... I found 'The boss feels spicy' doesnt really help me with balancing"*

**I CAN SEE YOU:**
• not really, i just put a telemetry system in the game to help me with balancing, it only logs numbers and sends them back, no personal data is collected, i only use the data to help me balance the game, nothing else.

**Updated Pause Menu:**
• this thing needed some updates to stlying and i added a new button to the pause menu to opt in or out of telemetry and a modal to explain what it is and why i added it.

*TL;DR:* Telemetry now exist in opt in and the pause menu looks much nicer*
`,
    '0.5.3.1': `**🔴 CIRCLE OF TRUST ISSUES - AND SOME MUSIC!** (11/12/2025)
*"Remember those red circles you mercy-farmed in Room 1? They compared notes, formed a study group, and now you're the pop quiz."*

• **Honor Society Enrollment (All Enemies):** IQ got scaled harder than exponential growth. Feints, combo detection, surround formations, wall checks, pattern recognition-all unlocked earlier. Room 4 stopped being recess and turned into Euclid’s nightmare.
• **Predictive Brainstem (All Melee):** Every triangle and circle tracks your dodge cadence like it’s a metronome, solves for your future vector, and only retreats when the inequality says “certain death.” Translation: fewer whiffs, more proofs, basically Spock with a spreadsheet.
• **Threat Board & Timing Tutors (Roster-Wide):** Each enemy now keeps a threat ledger pettier than your algebra teacher. Low HP, cooldowns burning, button mashing? Congratulations, you just became priority variable x.
• **Simultaneous Swarming (Circle Squad):** Up to five circles now lunge in phase, wave attacks externalize across whoever’s ready, and idle units rotate in like we’re running polar coordinates on your face. Your single-file duels were deprecated.
• **Orbital Offense (Circles):** Predictive positioning, lateral spread, flanking bias, wall awareness-the red bois stole your playbook, highlighted the margins, and drew diagrams.
• **Sharpshooter Shapes (Triangle & Octagon):** Ranged enemies try to predict your velocity, iterates through the intercept math to do said predcitive aiming, and upgrade accuracy from 30° cones to sniper-grade radians, this way they can hit you more consistently and actually require awareness. Keep circle-strafing; they already integrated the curve.
• **Diamond Dash Etiquette (Diamond):** Telegraph vectors lock on immediately, follow-ups take a dramatic quarter-second pause, dash paths stay linear. If you still catch a rhombus to the face, consider reading the signage.
• **Visual Aid, Now With Shade (All Enemies):** Telegraphs pulse harder, lunge trails linger longer, recovery states glow neon. You demanded readability; they added captions that say “incoming pain.”

**🔥 Geometry With Feelings (AI Overhaul):**
• **Telegraph Overlord:** The entire warning system got ripped out, given its own command center, and wired back in with synced lights, timers, audio hooks, and “please stop looping that alarm” safeguards. Every shape now speaks the same telegraph language, and the queue keeps backup warnings ready like a Stage Manager from Broadway.
• **Recovery PTA:** Every swing now schedules a recovery window with vulnerability tags, so you know exactly when to go full anime protagonist. These windows replicate to clients, because lag is already scary without surprise invulnerability.
• **Motion Blur Without the Blur:** Movement is lerped, eased, and smoothed so enemies glide like smug Roombas instead of jittering like dial-up modems. We juiced the smoothing factors so the shapes still sprint like they stole your lunch money-just prettier.
• **Retreat Thermostat:** Backsteps run on a personal heat meter plus a short cooldown. Spam it and the odds nosedive, so you get tactical give-and-take instead of panic moonwalks. Yes, the Rectangle finally caught the memo.
• **Squad Cohesion, Not Stampedes:** Retreat decisions are moderated by a global coordinator that notices when three shapes try to nope out simultaneously. Small skirmish? Expect bravery. Eight-enemy dogpile? Expect staggered “nope nope nope” choreography worthy of a synchronized swimming medal.
• **Local Crowd Control:** Retreat distance, hesitation, and probability all scale with how many friends are within yelling distance. You can isolate stragglers again; you just can’t expect the whole team to face-tank you in a conga line.
• **LAN Party Gossip:** Telegraphs, recovery windows, and retreat states are serialized and broadcast across multiplayer so remote clients see every flinch, fake-out, and panic step in real time. Your co-op buddy can finally call out “it’s a feint” without lying.
• **Sidestep Probability Theory:** Projectile-dodge chance now scales with intelligence, so the gifted shapes roll higher on their “nope” checks. No, you can’t sue us for intellectual discrimination.
• **Status Spice:** Bleed and guard break now stick to players properly, feeding right into that smug threat table so the AI knows exactly which spicy garnish to sprinkle on your next mistake.
• **Spawn Dietician:** Early rooms cut the enemy carb count so you fight smarter shapes instead of bigger piles. Later rooms still bring the buffet-just with added protein in the form of better brains.

*"What about that existential silence whenever you weren't actively vaporizing something? I duct-taped a boombox to the engine. Is the playlist amazing? Absolutely not. Got better royalty-free bangers? Slide them my way before I start humming MIDI elevator loops."*
**🎧 Audio Mood Swings (Now with Actual Noise):**
• **Nexus Lounge Act:** The home base finally hums instead of sitting in existential silence. If you’ve got better royalty-free vibez, you know where to send them.
• **Room Rotation & Boss Bangers:** Each biome and boss now spins up its own tracks, phase shifts included. Smooth fades, zero needle scratches, router survives.
• **Pause Menu Mixer:** Sliders for master/music/SFX now adjust in real time, so you can mute the explosions while keeping the elevator chiptunes that I definitely didn’t steal from a dentist’s lobby that thought it had personality.

**Other Changes (Because Apparently AI Overhauls and Audio Mood Swings Weren’t Enough):**
• **Multiplayer Tweaks:** Lobby slots now remember your player ID, so reconnecting you get to still be you! No more you with zero gear and negative vibes. They’re loyal to you, so no accidental Order 66 mid-fight. That and you can actually get into the next room since there is a bump on a log with you now.
• **Menu Overhaul:** Old UI got yeeted into a black hole. New UI actually works on mobile without requiring a ritual sacrifice to join a lobby-looking at you, Diablo II lobby circa 2000.
• **Telemetry Fix:** Damage numbers and affixes now report in. Balancing graphs look less like missing-data art installations and more like something your spreadsheet professor would grade.
• **Sequential Cooldowns:** Multi-charge abilities (dodge, heavy attacks, specials) now refill one at a time instead of sprinting back together, so timing matters and UI bars stay honest.
• **Blue Diamond Boundaries:** Those azure stabbers finally learned Euclidean personal space. Less accidental spooning, more intentional skewering with protractor-level precision.
• **Flinch Etiquette:** Melee creeps roll a d20 before panic jogging. Sometimes they stand their ground, sometimes they scurry. Either way, the comedy is now RNG-driven like your favorite Critical Role fail.
• **Bosses Finally Read the Threat Table:** Big bads stopped orbiting the host like it’s homecoming. Tanks tank, glass cannons sweat, everyone’s doing wind sprints like the gym class you tried to skip.
• **Clone & Decoy Witness Protection:** Rogue shadow clones and Mage blink decoys now count as legit disposable interns: health bars, damage reactions, everything except dental insurance. 
• **Illusion Damage Control:** Enemy hits and projectiles run through the same math on illusions as real players. No more immortal cardboard cutouts or threat-table singularities-just geometry earning minimum wage.
• **Client Level-Ups Actually Level:** Remote players finally receive actual stat bumps instead of placebo sparkles. Yes, Karen, your HP now scales even when you’re not the host. Try not to sprain your newfound survivability.

*TL;DR:* Circles evolved from cannon fodder to coordinated chaos, ranged kids min-maxed trigonometry, retreat spam got sent to detention, the telegraph PTA installed synchronized warning lights, and spawn counts went keto. Bring AoE, bring timing, bring snacks for the wipe-fest`,
    '0.6.0': `**🃏 UPDATE 0.6.0: THE "DECK YOURSELF" UPDATE** (11/25/2025)
*"We heard you liked complexity, so we put a card game inside your bullet hell. Also we rewrote the renderer. And the UI. And added biomes. This was supposed to be a small patch. It wasn't."*

**🃏 Card System (New Game Mode):**
*"Gear Mode still exists. Your orange weapons are safe. Card Mode is single-player only because multiplayer is hard and we gave up. Soon™."*
• **Deck Building:** 10-20 cards, hand size 4, draw 4 per room, standard MTG rules apply
• **30+ Cards:** Precision (crit chance), Bulwark (defense), Velocity (speed), Fury (crit damage), Momentum (snowball damage), Execute (instant kill below threshold), Fractal Conduit (chain lightning), Phoenix Down (one-time revive), plus class-specific ability mutators
  *"Yes, infinite blink is possible. No, we won't nerf it. (Maybe.)"*
• **Mastery System:** Cards level 0-5 with shards (new currency). M5 unlocks special bonuses. Grind for it. We know you will.
• **Packs:** Standard, Elite, Treasure, Challenge, Boss. Ethical loot boxes-free and you can't pay real money. Revolutionary.
• **Shards:** Earn by killing things, spend on unlocks and upgrades. Achievement milestones also unlock cards if you're into that whole "earning things" philosophy.

**😈 Room Modifiers (Risk/Reward Chaos):**
*"We felt the game was too fair. So we added cards that make rooms harder for better loot. You're welcome."*
• **Enemy Buffs:** Elite Armor (+HP), Swift Assault (+speed), Volatile Spawn (explosions on death), Shielded Brood (shields), Double Trouble (2× enemies). All reward bonus cards/shards/quality shifts.
• **Economy Boosters:** Prism Tax (currency), Scholar Sigil (XP), Loot Surge (extra card offers), Mastery Boost (quality shift), Shard Mine (shards)
• **Easy Mode Cards:** Truncation (breather room), Safe Passage (no enemies), Treasure Cache (guaranteed treasure), Elite Challenge (guaranteed elite pack), Boss Rush (skip to boss)
  *"For speedrunners and masochists. Often the same people."*

**💎 Item System (Run-Specific Power-Ups):**
*"Items drop from enemies (4-20% chance). They stack infinitely. Some scale logarithmically because infinite linear scaling breaks games faster than you can say 'balanced.'"*
• **Defensive:** Shield Generator (HP shields), Reactive Armor (damage reduction), Regenerative Matrix (HP regen), Thornmail Fragment (reflect damage), Slow Aura (enemy slow)
• **Offensive:** Fractal Shard (damage), Critical Lens (crit chance/damage), Fury Catalyst (attack speed + damage), Damage Aura (AoE DoT), Chain Reaction (kill AoE), Bleeding Edge (bleed), Executioner's Mark (execute damage), Volatile Core (explosive hits), Piercing Strike (pierce)
• **Utility:** Speed Boost Module (movement), Cooldown Reducer (ability cooldowns)
  *"Stack shields forever. Stack damage forever. Stack until the game breaks. We dare you. (Please don't. The code is fragile.)"*
• **Scaling:** Linear for shield/regen/speed/pierce, logarithmic for most damage items. Formula: \`baseValue * (1 + log2(stacks))\` for the nerds. Stack 1 = base, Stack 4 = 2x, Stack 16 = 4x. Math is a cruel mistress.

**🎨 Visual Overhaul (The "My Eyes!" Update):**
*"We discovered shaders. And CSS. And the concept of 'visual design.' It's been a journey."*
• **Rendering Rewrite:** Pattern caching (stopped redrawing floor 60 times per second), door sprites, viewport culling, particle system overhaul. Performance stonks ↑
• **Atmosphere:** Vignette system (spooky edges), glow effects (everything glows now, it's a rave), biome-specific lighting (Swarm green, Prism blue, Fortress brown, Fractal pink, Vortex purple, Endless darker purple)
• **DOM UI:** Killed canvas-based UI. HTML/CSS now. You can actually READ the text. Revolutionary.
• **Typography:** 'Orbitron' font. Sounds like a Transformer, looks like sci-fi. Perfect.
• **Index Machine:** Pokedex for geometry. Tracks affixes, cards, items, utility cards. Progressive reveal (undiscovered = ???), quality band tracking, preview panels. Completionists rejoice.

**⬆️ New Upgrades:**
• **Cooldown Reduction:** Abilities recharge faster
• **Max Health:** More HP = die slower
• **Attack Speed:** Shoot faster = kill faster
  *"Simple. Effective. Boring? Maybe. But you'll pick them anyway because math."*

*TL;DR:* Card system (single-player only), 30+ cards with mastery levels, room modifiers for risk/reward, item system with infinite stacking and logarithmic scaling, rendering rewrite with caching and culling, visual overhaul with biomes and glow effects, DOM-based UI, Index Machine for discovery tracking. Scope creep is a hell of a drug.`,
  '0.6.1': `**📱 UPDATE 0.6.1: THE "THUMBS & NUMBERS" UPDATE** (12/01/2025)
*"We broke mobile. Then we fixed it. Then we broke the math. Then we fixed that too. Development is easy."*

**📱 Mobile UI Returns (The "Do You Guys Not Have Phones?" Edition):**
*"We realized that playing a PC game on a touch screen without buttons was... suboptimal. Who knew?"*
• **Mobile Support Restored:** Full touch controls, UI scaling, and layout adjustments are back.
• **Performance Roulette:** Will it run at 60fps? Will it melt your battery? Only one way to find out.
  *"Optimized the renderer to stop cache trashing. Your phone might still get warm, but at least it's efficient warmth."*

**⚖️ Balancing (The "Fun Police" Arrive):**
• **Enemy Scaling:** +2% scaling speed.
  *"You were looking too comfortable."*
• **The Horde Leaks:** Room 18 cap now leaks +1 enemy count per room thereafter.
  *"The 'Cap' is now more of a 'Guideline'. Good luck."*

**🔮 Item & Aura Tweaks (Math Corrections):**
• **Regenerative Matrix Fix:** Fixed a "small" typo where scaling was 1.0 instead of 0.01.
  *"Turns out 100x healing makes you immortal. We fixed the decimal point. You are now mortal again. Oops. (I'm not sorry)"*
• **Damage Aura Rework:** Now scales off **Player Damage** instead of Enemy Max HP.
  *"% HP damage was cheese. We removed the cheese. Eat your vegetables."*
• **Damage Aura Range:** Increased 100px → 120px.
  *"A consolation prize for the changes."*
• **Slow Aura:** Massively increased decay time.
  *"Enemies now stay slowed after leaving the circle. It's called 'thermal conductivity'. Look it up."*

**⏱️ Fixed Timestep Game Loop (The "Time Is Now Real"):**
• **Frame-Rate Independent Timing:** Game logic now runs at a fixed 60 Hz timestep, completely separate from frame rate.
  *"Remember when your game slowed down because your FPS dropped? Yeah, that was embarrassing. Time is now time, not 'time but only if your GPU cooperates.'"*
• **Consistent Game Speed:** 1 second of game time = 1 second of real time, regardless of whether you're running at 30 FPS or 144 FPS.
  *"Your potato laptop and your NASA supercomputer now experience the same game speed. Revolutionary concept, I know."*
• **Catch-Up System:** If the game falls behind, it catches up intelligently without causing stuttering.
  *"I added a catch-up system that's smarter than a GPS recalculating your route. It knows when to catch up and when to just... not... I hope..."*

**☠️ Boss Rotation (Gear Mode):**
• **Endless Cycle:** Bosses now cycle every 5 rooms starting at Room 10.
  *"There is no escape. Only more geometry."*

*TL;DR:* Mobile works again, Regen Matrix no longer makes you God, Damage Aura is fair now and doesnt feel useless, enemies multiply faster, bosses are infinite, and time is now actually time. Touch grass? No, touch screen.*
`,
    '0.7.0': `**🗺️ UPDATE 0.7.0: THE "TOUCH GRASS PROCEDURALLY" UPDATE** 
*"Rooms used to be rectangles. Enemies walked through walls like Force ghosts. Scaling math lived in twelve files with twelve conflicting opinions. Vortex's entire personality was 'spinny, hurts.' None of that is true anymore. I did not sleep. Ask me how I know."*

---

## **🗺️ PART 1: ROADS, NOT ROOMS**
*"Turns out an empty rectangle with a boss in it is called 'a placeholder,' not 'level design.' Whoops. Guess I owe you actual level design now."*

• **Archetypes:** Rooms now roll road, gauntlet, maze, arena, crossroads, or "wilds," which is a real archetype and not just me running out of names by Tuesday.
• **Actual Roads:** Enemies spawn in pockets along a real main road with offshoots and detours now, instead of getting airdropped into the room like confetti at a party nobody invited them to.
• **Entrance Variants:** Rooms open left-right, top-bottom, or diagonal. A hallway that's wider than it is long was always weird. I noticed. Eventually.
• **Biome Dressing:** Hive trails, crystal causeways, stone roads, recursive traces, spiral wakes. Every biome got its own IKEA catalog and its own assembly instructions nobody reads.
• **Boss Arenas:** Bosses get custom-built arenas now instead of squatting in whatever biome leftovers were lying around.
  *"They have landlords now. I take arena upkeep very seriously." (though they are all WIP and will be getting improved and built out over time)*

---

## **🧭 PART 2: ENEMIES LEARN TO WALK**
*"They used to phase through walls like polite ghosts. Now they navigate like people who pay rent, occasionally very badly."*

• Enemies steer around obstacles locally before falling back to real pathfinding when things get concave and ugly.
  *"No more triangles teleport-cheesing through gaps built for something half their size. I checked. I'm unreasonably proud of this."*
• Get stuck enough times and an enemy will actually retreat to its last safe spot instead of vibrating against a wall forever like a Roomba having a breakdown.
• Bosses got wider clearance math so they stop hugging scenery mid-attack like it owes them rent money.

---

## **⚖️ PART 3: THE GREAT MATH CONSOLIDATION**
*"I found the same HP growth constant defined in three different files with three different values. I don't remember which one was 'correct.' I am not okay. The code, however, is now fine."*

• One universal scaling system now runs every enemy, boss, and room number instead of a dozen copy-pasted formulas hiding wherever they felt like living.
• **Sign Error, Avenged:** Enemy attack cooldowns were secretly getting SLOWER the deeper you went. For months. Enemies were, technically, getting lazier as the run went on. That bug has been fired without severance.
• Gear mode and Card mode now get their own separate multiplayer scaling tables, because your suffering deserves to be bespoke.

---

## **👹 PART 4: BOSSES GOT PERSONALITY TRANSPLANTS**
*"I meant to touch up the bosses a little. Vortex walked out with 14 attack types and a state machine longer than some entire enemy files. Scope creep says hello."*

• **Vortex, Completely Rewritten:** Inhale, Burst, Blades, Spiral, Lance, Needles, Pulsar, Cage, Net, Scenery, Wells, and a Finale that ends in a rotating corridor of angular regret.
  *"It used to be a spinny thing that hurt you. Now it's a spinny thing that hurts you with narrative structure. Progress."*
• **Swarm King:** New phase 3 pheromone dash-and-web sequence. I wrote actual polyline arc-length math for a bug's dating trail. This is where the CS degree went.
• **Twin Prism:** Real windup telegraphs before the laser grid now, instead of vibes-based murder.
  *"You'll still get hit. It's just your fault now, which is somehow worse."*
• **Fortress & Fractal Core:** Finally use the arena I built them, instead of standing in the middle of it like it's a waiting room.
• **Multi-Part Hit Detection:** Damage numbers land where you actually hit the boss now, not its spiritual center of mass.

---

## **🩸 PART 5: LIFESTEAL GETS A BUDGET**
*"Unlimited free healing off every overlapping hitbox of a cleave attack was, according to math, 'too strong.' I capped it. Reluctantly. Very reluctantly."*

• Lifesteal now caps around 1% of your max HP per second, flat. Stack it all you want - you're a vampire with a spending limit now, not a god.
• Past 5% lifesteal, the extra starts losing efficiency. 11% gear lifesteal now behaves like about 7.1%. Diminishing returns: not a bug, fiscal responsibility.
• Whirlwinding a boss to full HP in one spin was extremely fun for you and extremely bad for game balance. Boss healing is dialed way down now.
• Cleaves, whirlwinds, and shout hitboxes proc lifesteal ONCE per enemy per swing now, not once per overlapping hitbox like I was secretly running a healing pyramid scheme.
• **NEW - Fortify:** Some sustain now builds a temporary shield instead of straight HP. It decays, it's capped, it's basically sustain with training wheels on.

---

## **🚀 PART 6: YOUR COMPUTER CAN RELAX**
*"I built a system that watches your frame rate and quietly panics on your behalf, like a very attentive nurse who's seen this before."*

• **Adaptive Quality:** Three tiers (Normal / Medium / Heavy) dial back vignette, scenery lights, and gear ring detail before your FPS faceplants into the carpet.
• **Gear Sprite Caching:** I was redrawing the same legendary sword sprite 60 times a second like it might change its mind about being legendary. It never did. I stopped.
• **Culling:** Loot, cards, and items now only render when you can actually see them. Groundbreaking. Truly. I know.
• **NEW - Run Profiler:** Full run-length performance receipts - worst rooms, worst phases, exportable JSON. When Room 27 chugs, I'll know exactly why instead of shrugging at the ceiling.
• **Accumulator Truncation:** Alt-tabbing back into the game no longer triggers five seconds of fast-forwarded chaos trying to "catch up." It just resumes. Like a normal, well-adjusted application.

---

## **🎮 PART 7: I REMEMBERED PHONES AND CONTROLLERS EXIST**
*"Turns out real device detection beats 'always return false, force desktop mode.' Groundbreaking research from my own past self."*

• Full gamepad support: PlayStation/Xbox/Nintendo/Steam glyphs, deadzones, and menus you can actually navigate without reaching for a mouse mid-couch-co-op.
  *"Press Start. I mean it this time. It does something."*
• iPads pretending to be Macs fooled exactly nobody this time.

---

## **🌐 PART 8: EVERYTHING ELSE**
*"The stuff that didn't earn its own dramatic section header but still matters."*

• **Multiplayer Room Sync:** The host generates the layout, clients get the exact same walls and hazards. Your walls and their walls used to be suggestions. Now they're facts.
• **Server Hardening:** Closed a path-traversal door I didn't realize was wide open this whole time. Oops. You're welcome. Mostly the second one.

---

## **🎯 FINAL WORDS**

*TL;DR:* Rooms have roads now. Enemies can walk around furniture without having an episode. The scaling math finally agrees with itself. Vortex is a nightmare with a flowchart. Lifesteal has a budget and a new shield-shaped friend. Your framerate has a safety net and a profiler taking notes. Controllers and phones both work like it's a real feature, not an apology. Multiplayer rooms actually match now. The server stopped handing out random files to strangers. There's an ending now planned and will be added over time.

*P.S. - If a boss clips through a wall or an enemy just stares lovingly at a corner forever, that's not a bug, that's Tuesday. Report it anyway.*

*P.P.S. - Yes, Vortex might be a bit much now. No, I'm not nerfing it before you've all had a proper chance to suffer.*
`,
    '0.8.0': `**🗑️ UPDATE 0.8.0: THE "UNDECK YOURSELF" UPDATE** 
*"Remember Update 0.6.0 when we put a card game inside the bullet hell? Yeah. About that. We looked at the dual-mode spaghetti, made eye contact with our own commit history, and hit delete. Gear Mode is the game now. Card Mode went to live on a farm upstate where the decks are green and the mulligans never end."*

---

## **💜 PART 1: FOR LOST — THE LONG ROAD PAST 50**
*"Before the cards, the voxels, and the chaos: this one is for LOST specifically."*

Lost: you stress-tested this game like it owed you money, really drug runs into the triple digits, blew through Room 150, and then you sent me back stat sheets that looked less like "telemetry" and more like a crime scene autopsy of my math. I will mention it made me look pretty bad at it too XD. You had damage tallies that could fund a small country right along side HP bars that needed scientific notation, like you legit sent me a screenshot that made the combat scaler look like it was heading for orbit and used scientific notation.

You also, casually, decided Room **200** was a realistic goal instead of a bug report? like who does that? lol. I realized the systems were disrespecting your time a bit, could be a lot more reasonable, and I wanted you to be able to come back and go any lenght of run you want without having to feel like leaving the ps2 constantly running back on Jacksonville road so we wouldnt loose our progress in RAD.

So I built two things because of you:

**💾 Solo Safe Room Save & Resume:**
• There's a **Save Run** machine in solo Safe Rooms now. Hit it and it stores the real run - room number, class, XP, HP/shields, your actual gear and affixes, items, the whole mess —-then dumps you back in the Nexus without ending the run.
• When you take the portal again it pops you right back into that Safe Room with the same build. Your HP stays whatever you saved (no free full heal cheese). Checkpoint gets used up on resume so you can't duplicate runs.
• Catch: save **before** you use the other machines that visit. Once you start spending credits or healing, Save locks until next Safe Room. Solo only - multiplayer is stuck babysitting itself.
• While you've got a saved run sitting there, Nexus basically just lets you hit the portal. No sneaking off to buy a pile of upgrades and then diving back into a mid-run demon build. Love you.... but also I know you :P
  *"The Jacksonville road PS2 ritual is officially no longer needed. You can turn the machine off. Progress survives now <3."*

**📈 Post-Room 50 Scaling (the Room 200 chase):**
• Campaign still technically finishes at 50. After that it doesn't just multiply itself into scientific-notation nonsense that you cant actually play like the screenshot you sent me. you can still get those numbers, but they will be actually playable now.
• HP and damage keep going up past 50 so the late game still hits, just on a slower curve. Like it's still big but its the kind of climb you can actually live in for a while instead of watching numbers leave the atmosphere and the enemy attacking faster than you can actually react to.
• Enemy speed and attack timing soft-cap instead of turning every diamond into a missile. Room density soft-caps too, so deep runs stay mean without melting your fps into soup, i know you have a good pc, but this is all on cpu.... so i still have to be reasonable.
• Bosses still get harder each cycle, but I'm not stacking three kinds of "infinite" on top of each other anymore. That's how we got the Room 150 "Why is everything moving a relativistic speeds?" situation.

Room 200 is still gonna suck in the fun way i hope, but I'm not handing it to you. I just don't want the game to spit on the hours you already put in because I really appreciate you <3. now you can pause your run, go to work, go to sleep, but you can stop leaving the console cooking all night, i promise you wont lose any progress.

*Thank you for every busted run, every cursed screenshot, and treating this weird little geometry hobby like it was worth breaking. This one really is for you, I went through and made a list of things I thought you would appreciate the most and these were the two big things. You're the best sister a girl could ask for, I hope you enjoy this update!

---

## **🃏 PART 2: WE BURNED THE DECK**
*"I said 'soon™' for multiplayer cards. That 'soon' is now 'never, and also I deleted the files.' Growth... I think that is what we will call this XD"*

• **Card Mode: Gone.** Decks, hands, mulligans, mastery, ground cards, pack doors, room mod stations, curses, team cards, class cards - all of it. Deleted. Not "deprecated." Gone.
  *"If you still have \`precision_001\` in your save, that number is decorative now. Rest in pieces."*
• **Nexus is Gear only.** Portal doesn't mode-switch anymore, it just starts a run. Wild concept: a door that is a door.
• Character sheet / Index Machine / Nexus stations don't pretend cards exist either. Affixes and items kept their little encyclopedia tabs. Cards did not.
  *"Fewer half-finished systems hanging around making me feel guilty every time I open the project. Huge."*

---

## **🛠️ PART 3: SAFE ROOMS**
*"Every 5 combat rooms you get a little cyan upgrade lounge. Spend credits, mess with gear, don't die for a minute. I call it progression."*

• Safe Rooms are open hubs (1600x900) with Gear Level Up, Affix Reroll, Healer, and the solo **Save Run** machine from Part 1.
• **Gear Level Up:** credits in, +4% on that piece. Caps start at 3, Nexus upgrades can raise it if you want to be greedy about it.
• **Affix Reroll:** pick a slot, reroll it, cry if it gets worse. Rarity bumps only show up after you unlock Rarity Forge in the Nexus.
• **Healer:** free once per visit, grows max HP a bit then tops you off.
• Rooms 9 / 19 / 29… also get a small pre-boss heal booth (+25% max HP) so you aren't walking into geometry finals on 12 HP.

---

## **💎 PART 4: NEXUS GEAR UPGRADES**
*"Shards used to feed card mastery. Now they feed permanent loot luck and Saferoom power. Same addiction loop, slightly less weird."*

• Machines unlock as you progress on purpose:
  - **Rarity Chance** after Room 5
  - **Affix Capacity** after Swarm King
  - **Safe Room Systems** after Twin Prism
  - **Safe Room Efficiency** after Fortress
• Each track has its own ladder / locks so you can't day-one dump everything into orange luck and break the economy before breakfast.
  *"I left the candy aisle locked. You can have orange later. Earn it."*

---

## **💰 PART 5: CREDITS ACTUALLY MATTER NOW**
*"Used to be elites and bosses paid you and trash was basically unpaid internships. Fixed that. Wrote a whole file for it. There were spreadsheets. Regrettably."*

• Normal enemies drop credits now. Stars/diamonds/rectangles pay a little more. Octagons are the elite ATM. Bosses are the jackpot.
• Every 10 rooms the payout bumps a bit so late trash stops feeling like pocket lint.
• Credits bank to your save **on kill**, so closing the game after a boss doesn't also steal your wallet. End of run only pays whatever didn't already bank.
• Shards still wait until the run ends. Credits are the impatient one.
• There's a balance sim now that checks dumb stuff like "can rooms 1-5 even afford a class upgrade + gear level." If the economy is broken, a robot yells at me first. Nice.

---

## **📚 PART 6: ONBOARDING (YES, ACTUAL ONBOARDING)**
*"Dropping people in a Nexus full of glowing mystery boxes with zero explanation was not the vibe. It was just rude."*

• First-run coach walks you through privacy → controls → pick a class → launch → come back to class upgrades. Spotlights and all. You can't open half the Nexus until it says so.
• **Room 0:** empty tutorial arena. Dash, hit the dummy, heavy, special, dramatic warning, then kill it for real and leave. No loot, no xp, no farming the dummy for credits - I checked.
  *"Room 0 is not a Safe Room even though 0 % 5 === 0. Yes I had to write a special case for that. No I am not proud of needing to."*
• As you unlock gear machines later, little coaches show up so you know which glowing box just stopped being furniture.
• Patch notes wait until the coaches shut up. Brand new saves don't get hit with the update essay before they've even picked a class.

---

## **💥 PART 7: VOXEL FRACTURE**
*"I got tired of enemies just going poof. Now they look like somebody took bites out of them."*

• Hits punch holes in a little grid on the enemy. Chips fly off, goop splatters, debris sticks around on the floor for a bit.
• Different weapons chew differently (pierce / magic / slash / blast). Death shatters what's left.
• Hitpause freezes the fight but the particles still move so it doesn't look like PowerPoint getting stabbed.
• Low quality settings turn the particle count down so phones don't summon a second Swarm King made of lag.
  *"Bosses still mostly refuse to keep permanent holes. They shed junk, they just don't stay swiss-cheesed yet. Baby steps."*

---

## **👹 PART 8: SWARM KING + BOSS TIMING**
*"Phase 3 used to teleport dash like it forgot walls were real. That was funny once. Then it was a bug report."*

• Nest dashes actually collide with rooms now, leave a real web trail of where the king ran, and stop snap-teleporting when confused.
• Dash pushes the player out of the way instead of getting wedged in your hitbox like a bad hug.
• Bosses are every **10** rooms now (10/20/30/40/50), not every 5. Music and scaling finally agree on that, which is wild because they used to argue like roommates.
• Growth is tuned for the longer run. Early trash got more HP so Room 1 isn't wet tissue paper.
• Swarm King himself got a bit less brick-wall on HP/damage. Still mean. Less "why is the tutorial boss a raid boss."

---

## **🎮 PART 9: CONTROLLERS + CLEANUP**
• Gamepads hot-swap now - mash buttons on another pad and it becomes the active one.
• Weird controller mappings get padded into something closer to "buttons that do the thing."
• Level ups heal half max HP instead of a full spa day. You've got Safe Rooms and pre-boss healers now, chill.
• MP syncs Safe Room meta per player. Fracture juice stays local because networking hundreds of debris chips sounded like a terrible idea.
• Deleted a pile of leftover card/door UI that was still hanging out in \`index.html\` like it paid rent. It did not.

---

## **🎯 FINAL WORDS**

*TL;DR:* Cards are gone, Gear is the game. Safe Rooms every 5. Credits drop from everything and bank on kill. Shards buy gear meta. There's a real tutorial now. Enemies chip apart. Bosses every 10 through 50. Post-50 is playable instead of orbital. Solo save/resume exists so long runs don't demand a permanently-on console. I deleted a mountain of code and the game somehow got bigger anyway.*

*P.S. - \`cardShards\` still buys Gear Upgrades. The name is leftover. We are living with it.*

*P.P.S. - If your favorite Card Mode cheese is gone: yes. That was intentional. Touch grass. Or touch gear. Same vibe.*

*P.P.P.S. - Lost: if you're reading this in the update modal after punching something at Room 187, hydrate, save, Then go again. You got this!*

*P.P.P.P.S. - These notes are too long. I think most README.md are shorter, I know. I'm tired. Send coffee or a Room 200 screenshot.*
`,
    '0.8.1': `**🌐 UPDATE 0.8.1: THE "STOP TELEPORTING, PLEASE" UPDATE** 
*" After the huges gameplay changes in 0.8.0, I was like "we need to fix the multiplayer" so I did. This is the result."*
*"Clients used to wait politely for the host before they moved. Honest. Also rubber-band city. I fixed the honesty problem without handing clients the combat keys."*

---

## **⚔️ PART 1: MULTIPLAYER STOPPED LYING TO YOUR EYES**
*"If the host saw fireworks and you saw polite silence, that was several bugs sharing an apartment. Evicted them."*

• Damage numbers, combat FX, projectiles, beams, DoTs, and friends actually show up on clients now
• Resync actually forces a full state instead of vibes
• First enemy/boss after spawn stops being a ghost until something else ticks
  *"Clients still don't own combat. They just get to watch the same movie."*

---

## **🕹️ PART 2: YOU PRESS W AND YOU MOVE**
*"Wild concept for a host-authoritative game. Took a minute."*

• Clients predict movement (and dodge when it won't explode the timeline) while the host stays boss
• When the host correction arrives: soft blend for medium oopsies, hard snap only if you desynced into another zip code
• Replay won't re-fire dodges or compound ability state into more rubber bands
• Host dips? Someone else gets promoted without the lobby staring into the void
• Bonus: if the game keeps drifting the same direction, a tiny self-correct layer notices and gently stops being wrong that way
  *"Ctrl+D → MP Prediction if you want the receipts. Or \`DebugFlags.PREDICTION_DIVERGENCE = true\` if you like reading pain."*

---

## **🎯 FINAL WORDS**

*TL;DR:* Multiplayer combat looks the same on every screen. Clients predict movement with rollback. Host migration is less of a cliff. Rubber bands got manners.*

*P.S. - If your rubber band survives this patch, send me the MP Prediction numbers. I collect them now. you can find them in the debug pannel by hitting ctrl+d during a mp run.*
`,
    '0.8.2': `**⚖️ UPDATE 0.8.2: WEIGHT, TIMING & BIOME GEOMETRY** 
*"Weapons should feel different. Dodges should reward reads. Biomes should remix the same shapes without inventing twelve new classes. And now the Index keeps score."*

---

## **🗡️ WEAPON TYPES**
• **Acute** — fast & light (snappy hitpause, quick recovery, leans speed/crit)
• **Obtuse** — slow & heavy (chunky hits, more knockback, leans execute/explosions)
• **Vector** — long reach (melee arcs, projectiles, beams/thrusts/shouts stretch farther)
• **Parallel** — twin staggered contacts at ~half damage each (same total DPS, denser status/procs) — basics *and* heavies
• Affixes: basics stay universal but weighted by type; purple/orange get type accent pools
• Pickup tooltips show a one-liner; full Feel / Pitch / Leans Toward lives in the Nexus **Index → Weapons** tab

## **⏱️ RECOVERY & PERFECT TIMING**
• Soft turn-rate recovery after swings (dodge-cancelable; short dodge buffer so you aren't stuck)
• Perfect dodge on a real attack → half dodge cooldown (VFX only, no shards)
• Perfect interrupt during telegraph → forced crit + stagger (bosses/elites: interrupt lockout + hyper-armor flash)

## **🌍 BIOMES & ELITES**
• Same five enemy bases, remixed per biome (swarm pressure, prism volleys, fortress braces, fractal echoes, vortex pull)
• Some mid/late enemies roll one elite affix + jagged threat ring; phasing goes translucent
• Nexus **Index** now has **Enemies** (bases + biome chips) and **Elite Affixes** (separate from your gear affixes)

## **📜 COMBAT LEDGER & FEATS**
• New Index tab: **Combat Ledger & Feats** — GLOBAL + WARRIOR / ROGUE / TANK / MAGE subtabs
• **Global records:** deepest room/biome, longest *active* run, max single-hit, fastest room-50 clear, lifetime voxel shatter count (deepest vs longest are separate)
• **Class analytics:** weapon archetype weight, dodge precision rate, perfect-interrupt count, kit-specific counters
• **Feats:** Universal Flaw feats pay **Credits** mid-run; Class Mastery feats pay **Shards** — first completion full payout, later completions **25%** (min 1) with a completion counter
• Toast on unlock / repeat; everything lives in your normal local save (no second storage blob, no netcode)
• **Run timing:** wall-clock stamps for start/end, pause, and Safe Rooms; pause is not stamped in Safe Rooms or MP; death screen shows Active / Paused / Safe Rooms / Wall Clock
• **Warrior:** Whirlwind kill-extension (+0.75s per kill, capped) so Cyclone Engine is a real chase
• **Rogue:** Phantom Execution — boss hits a Shadow Clone within 400ms of your killing blow (clones stay decoys)

*TL;DR: weapons have weight you can read, timing has payoff, biomes remix geometry, elites telegraph their cheat codes, and the Index finally tracks mastery. Check Ledger & Feats if you want receipts.*
`,
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
    '0.5.3.1': ['minor', 'feature', 'rebalance'],
    '0.6.0': ['major', 'feature', 'visuals'],
    '0.6.1': ['minor', 'feature', 'hotfix'],
    '0.7.0': ['major', 'feature', 'rebalance'],
    '0.8.0': ['major', 'feature', 'rebalance', 'visuals'],
    '0.8.1': ['minor', 'feature', 'hotfix'],
    '0.8.2': ['minor', 'feature', 'rebalance', 'visuals']
  }
};


# Shape Slayer

**Rogue-like geometry warfare you can launch in a browser. Dodge, dash, and demolish waves of hostile shapes solo or with friends.**

Shape Slayer is a fast, skill-first top-down action roguelike. Pick a sentient shape, dive into procedurally generated arenas, stack gear affixes until the build gets weird, and see how far you can push a run. Gear Mode is the game now - Card Mode got deleted on purpose.

Current version: **0.8.2** (see in-game patch notes / `js/version.js`).

## Why You’ll Love It

- **Arcade-speed combat:** Tight movement, weapon-weighted feel, invincible dodges, and a constant flow of angry polygons.
- **Timing that pays off:** Soft recovery after swings, perfect dodges that cut cooldown, perfect interrupts that crit and stagger telegraphs.
- **Boss fights with personality:** Cinematic intros, multi-phase kits, breakable weak points, and arenas that fight back.
- **Buildcraft that actually sticks:** Weapon archetypes with real identity, loot tiers, legendaries, class mods, stackable items, and a Nexus hub that permanently upgrades how greedy your drops get.
- **Biomes that remix the roster:** Same five enemy bases, remixed per biome - plus mid/late elite affixes with readable threat rings.
- **Safe Rooms mid-run:** Every 5 combat rooms you get a cyan upgrade lounge - level gear, reroll affixes, heal, or (solo) save and come back later.
- **Drop-in multiplayer:** Up to four players, six-character lobby codes, host migration, reconnection, and client prediction so people stop teleporting across the room.
- **Runs anywhere:** Open the page. That’s the install process.

## Jump In

| How you want to play | What to do |
| --- | --- |
| **Solo or hot-seat** | Open `index.html` via a local server (`npm start` / `node server.js`) or just open the hosted page. Prefer HTTP over raw `file://` so nothing weird breaks. |
| **Squad up online** | Pause menu → create/join a lobby → share the six-character code. Host hits the Nexus portal when everyone’s ready. |

Production multiplayer already points at `wss://shape-slayer.gpe.pet` if you don’t feel like self-hosting.

## The Loop (Gear Mode)

1. **Nexus** - pick a class, buy permanent upgrades with credits/shards, step through the portal.
2. **Rooms 1–50** - procedural combat arenas that shift biomes as you climb (Swarm → Prism → Fortress → Fractal → Vortex). Same enemy bases, remixed rules per biome; elites start showing up mid/late.
3. **Safe Rooms** - after every 5 combat rooms: craft gear, heal, optionally save the run (solo).
4. **Bosses at 10 / 20 / 30 / 40 / 50** - Swarm King, Twin Prism, Fortress, Fractal Core, Vortex.
5. **Past 50** - keep going if you’re unhinged; scaling soft-caps so deep runs stay mean without needing scientific notation for HP bars.
6. **Die (or finish)** - bank leftover credits, collect shards, brag on the scoreboard.

First time here? There’s an actual onboarding coach now, plus **Room 0** - a combat drill dummy arena so you aren’t dropped into glowing mystery boxes with zero explanation.

## Pick Your Shape

| Class | Fantasy | Signature Kit |
| --- | --- | --- |
| **Warrior** (Square) | Balanced frontline bruiser | Wide sword cleaves, forward thrust heavy with i-frames, whirlwind special, block stance while standing still |
| **Rogue** (Triangle) | Crit-hunting assassin | Knife throws, fan-of-knives heavy, shadow clones, double dodge charges, backstab bonus |
| **Tank** (Pentagon) | Crowd-control bulwark | Life-stealing hammer, Shout stun/slow, shield wall that pulses, retaliatory knockback |
| **Mage** (Hexagon) | Mobile artillery | Spell bolts, multi-charge piercing beam, blink + nova with decoy |

Stats, cooldowns, and tooltip copy live in the class configs - rotate through them when the escalating chaos starts disrespecting your main.

## What’s Waiting in the Arenas

### Combat That Rewards Movement
- Procedural layouts (roads, gauntlets, mazes, arenas, crossroads, wilds) with obstacles, landmarks, and biome scenery - not one fixed rectangle forever.
- Soft turn-rate recovery after swings (dodge-cancelable, short dodge buffer) so commits feel weighted without soft-locking you.
- **Perfect dodge** on a real attack → half dodge cooldown. **Perfect interrupt** during telegraph → forced crit + stagger (bosses/elites get interrupt lockout + hyper-armor flash).
- Screen shake, hit pause scaled by weapon type, crit/backstab markers, damage/heal numbers, and **voxel fracture** so enemies chip apart instead of politely vanishing.
- Off-screen enemy arrows keep pacing alive when something’s hiding in a corner.

### Boss Fights Worth Showing Off
- Five bosses on a 10-room cadence through the canonical 50-room climb.
- Phase shifts, unique hazards (shockwaves, pull fields, collapsing debris…), and weak points that eat bonus damage when you crack them.
- Skip intros with a tap if you’re speedrunning / impatient / both.

### Buildcrafter’s Playground
- Weapons that rewrite your kit: dual-hit **Parallel**, long-reach **Vector**, chunky **Obtuse**, snappy **Acute** - basics *and* heavies respect the type.
- Armor archetypes for niches: **Fractal** speed junkies, **Tessellated** immovable objects, **Membrane** cooldown goblins, **Polygon** “just make me tankier.”
- Orange legendaries for run-defining chaos (Phoenix Down, Glass Cannon, Chain Lightning, etc.).
- Stackable **items** drop from combat too - shields, auras, execute toys, the usual “one more and this build is illegal” pile.
- Nexus **Index** still has the loot/enemy encyclopedia, plus a **Combat Ledger & Feats** tab if you want receipts on how weird your runs got.
- Credits fund class upgrades + Safe Room crafting. Shards fund Nexus gear meta (drop luck, affix capacity, Safe Room power). Yes the save key is still named `cardShards`. We’re living with it.

## Safe Rooms & Nexus Meta

### Safe Rooms (credits)
| Machine | What it does |
| --- | --- |
| **Gear Level Up** | Spend credits → +4% stats on that piece (caps climb via Nexus) |
| **Affix Reroll** | Pick a slot, reroll it, accept fate |
| **Raise Rarity** | Bump tier once you’ve unlocked Rarity Forge power |
| **Healer** | Free once per visit - grows max HP a bit, then tops you off |
| **Save Run** (solo) | Checkpoint the whole run and bounce back to Nexus without ending it |

Rooms **9 / 19 / 29…** also get a pre-boss heal booth (+25% max HP) after the room clears, because walking into geometry finals on 12 HP is rude.

### Nexus Gear Upgrades (shards)
Machines unlock as you actually progress:

| Station | Unlocks after |
| --- | --- |
| **Rarity Chance** | Clear Room 5 |
| **Affix Capacity** | Defeat Swarm King |
| **Safe Room Systems** | Defeat Twin Prism |
| **Safe Room Efficiency** | Defeat Fortress |

Candy aisle stays locked on purpose. Earn your orange luck.

## Loot & Affixes

### Weapon Archetypes

| Archetype | Feel | Highlights |
| --- | --- | --- |
| **Acute** (fast) | Light hitpause, quick recovery | ~30% quicker swings, slight damage tradeoff, move speed; leans speed / crit / rampage |
| **Obtuse** (heavy) | Chunky hitpause, longer commit | Harder hits, bonus knockback, 15% stun; leans execute / explosions |
| **Vector** (reach) | Extended geometry | Melee arcs, projectiles, beams / thrusts / shouts stretch farther; leans pierce / chain / volleys |
| **Parallel** (dual) | Twin staggered contacts (~55ms) | ~Half damage each contact (parity DPS), denser status/procs on basics *and* heavies |

Pickup tooltips show a one-liner. Expand **[Index Machine](#index-machine)** below for the full Feel / Pitch / Leans Toward writeups (same catalog as the Nexus Index - everything unlocked here). Purple/orange weapons also roll type accent affix pools; basics stay universal but weighted by type.

### Armor Archetypes

| Archetype | Highlights |
| --- | --- |
| Fractal (light) | Speed + extra dodge charge + dodge DR (less defense) |
| Polygon (medium) | Baseline defense + flat HP |
| Tessellated (heavy) | Huge defense, interrupt/knockback immunity, slight speed tax |
| Membrane (cloth) | Cooldown reduction + faster projectiles |

### Legendary Effects (Orange Tier)

| Effect | What it does |
| --- | --- |
| Vampiric | 6% lifesteal |
| Incendiary | Burn DoT based on damage dealt |
| Freezing | 20% chance to slow hard for 2s |
| Thorns | Reflects 25% damage |
| Berserker Rage | +25% damage / −20% defense |
| Glass Cannon | +45% damage / −40% max HP |
| Phoenix Down | Auto-revive once per room at 30% HP |
| Time Dilation | Slows time on hit |
| Chain Lightning | Forks to two extra enemies at 60% damage |

### Affix Pools

**Basic:** movementSpeed, attackSpeed, projectileSpeed, maxHealth, knockbackPower

**Advanced:** critChance, critDamage, lifesteal, cooldownReduction, areaOfEffect, plus class toys (whirlwind/thrust, clone/dash, shield width, beam tick/duration…)

**Rare:** dodgeCharges, pierce, chainLightning, execute, rampage, multishot, phasing, explosiveAttacks, fortify, overcharge, beamCharges/penetration, and more class-specific nonsense

Purple/orange gear can also roll class modifiers that shove builds into absurd territory. Affix slot caps grow with Nexus upgrades - early greens are humble on purpose.

## Index Machine

Stuff the Nexus Index shows you, written out so you don't have to boot the game. Enemies / elite affixes unlock in-game as you meet them. Ledger numbers come from your save.

**Jump:** [Weapons](#index-weapons) | [Armor](#index-armor) | [Enemies](#index-enemies) | [Biomes](#index-biomes) | [Elite Affixes](#index-elite-affixes) | [Timing](#index-timing) | [Combat Ledger & Feats](#index-combat-ledger)

<a id="index-combat-ledger"></a>
<details>
<summary><strong>Combat Ledger &amp; Feats</strong></summary>

There's a new Index tab for this. Solo/host only - we are not syncing your brag sheet over the wire.

GLOBAL keeps deepest room (and biome), longest active run, biggest single hit, best room-50 clear time, and how many voxels you've shattered forever. Deepest and longest are separate on purpose: camping room 3 for an hour is not the same flex as dying at 42 in eight minutes.

Each class tab has weapon-type affinity (how much you lived on Acute vs Obtuse vs etc.), dodge precision, interrupt count, a few kit-specific counters, and that class's mastery feats. The "survive on 4% HP" style feats (Close Call, Volcano Surfer, Underdog, Perfectionist) hang out under GLOBAL.

Run time is just clocks. We stamp when a run starts/ends, when you pause, when you enter/leave a Safe Room. Pause time in a Safe Room or in MP doesn't get recorded (MP pause is a menu, not a freeze). Death screen shows active / paused / safe-room / wall-clock so you can argue about it.

Feats pay once for real, then cheap repeats:
- Universal flaws -> **Credits** on the spot
- Class masteries -> **Shards**
- First clear: full reward. Every clear after that: 25% (at least 1). Index shows the count.
- Toasts when it happens. We try not to pay you every frame for holding a beam.

Two kit notes that matter:
- Whirlwind now extends on kills (+0.75s, capped) so **Cyclone Engine** is actually chaseable
- **Phantom Execution** (Rogue): boss smacks a Shadow Clone, you finish the boss within 400ms. Clones still don't deal damage; they just soak and look shady.

`npm run test:combat-ledger` if you're poking at it.

</details>

<a id="index-weapons"></a>
<details>
<summary><strong>Weapons</strong> - Acute · Obtuse · Vector · Parallel</summary>

<details>
<summary><strong>Acute</strong> - fast &amp; light</summary>

- **Feel:** Light hitpause, quick recovery, shorter commitment after each swing.
- **Pitch:** Built for tempo. Basics and heavies come out sooner; you stay mobile between hits.
- **Leans toward:** Attack speed, crit chance, rampage, and other density tools.
- **Numbers:** ~0.95× damage, ~0.7× cooldown, +15% move speed.

</details>

<details>
<summary><strong>Obtuse</strong> - slow &amp; heavy</summary>

- **Feel:** Chunky hitpause and longer recovery - each connect feels like a commit.
- **Pitch:** Trades speed for punch. Stronger per-hit damage and shove; heavies hit like a statement.
- **Leans toward:** Knockback, crit damage, execute, and explosive finishers.
- **Numbers:** ~1.25× damage, ~1.15× cooldown, +50% knockback, 15% stun chance.

</details>

<details>
<summary><strong>Vector</strong> - long reach</summary>

- **Feel:** Extended melee arcs, longer projectile travel, and farther beams / shouts / thrusts.
- **Pitch:** Keep distance or cover more ground per swing. Identity is geometry, not raw DPS.
- **Leans toward:** Range, pierce, chain lightning, multishot, and volley tools.
- **Numbers:** ~1.5× melee reach, extra projectile travel.

</details>

<details>
<summary><strong>Parallel</strong> - twin staggered contacts</summary>

- **Feel:** Two staggered contacts (~55ms apart). Total damage matches a normal weapon; status and procs can roll twice.
- **Pitch:** Not double DPS - double tick density. Basics, heavies, beams, fans, and thrusts all twin in their own way.
- **Leans toward:** Attack speed, status/proc density, and tools that love hitting more often.
- **Numbers:** Two contacts at ~half damage each (parity DPS), small crit bonus.

</details>

</details>

<a id="index-armor"></a>
<details>
<summary><strong>Armor</strong> - Fractal · Polygon · Tessellated · Membrane</summary>

<details>
<summary><strong>Fractal</strong> (light)</summary>

Speed junkie shell: lower defense, +move speed, extra dodge charge, dodge damage reduction.

</details>

<details>
<summary><strong>Polygon</strong> (medium)</summary>

Baseline defense with a flat HP bump - the “just make me tankier” default.

</details>

<details>
<summary><strong>Tessellated</strong> (heavy)</summary>

Huge defense, interrupt + knockback immunity, slight move-speed tax. Stand still and be rude.

</details>

<details>
<summary><strong>Membrane</strong> (cloth)</summary>

Cooldown reduction and faster projectiles - glassier body, snappier kit.

</details>

</details>

<a id="index-enemies"></a>
<details>
<summary><strong>Enemies</strong> - five bases remixed by biome</summary>

<details>
<summary><strong>Circle</strong> - Swarmer</summary>

- **Blurb:** Melee pack pressure - lunges after a short telegraph.
- **Description:** The basic melee shape. Closes in, winds up a lunge, and commits. Later rooms add feints, combo lunges, surround pressure, and smarter group behavior.
- **Tells:** Telegraph flash before the lunge. Watch pack spacing - they push together.

</details>

<details>
<summary><strong>Diamond</strong> - Assassin</summary>

- **Blurb:** Orbits, then snaps in with a fast dash.
- **Description:** Keeps mid-range, circles you, and dashes through after a very short telegraph. Later rooms unlock feints, combo dashes, and nastier positioning.
- **Tells:** Cyan diamond weaving at orbit distance - dash is fast; the windup is short.

</details>

<details>
<summary><strong>Triangle</strong> - Ranger</summary>

- **Blurb:** Keeps distance and shoots - panics when you close.
- **Description:** Ranged triangle that tries to stay outside your comfort zone. Burst fire, predictive aim, and volleys unlock as rooms climb. Get close and it backpedals with messy panic shots.
- **Tells:** Orange triangle at long range. Projectile windups before shots; wider fans when cornered.

</details>

<details>
<summary><strong>Rectangle</strong> - Brute</summary>

- **Blurb:** Slow windup into a slam AoE.
- **Description:** Tanky and deliberate. Charges a slam, then hits a wide ground AoE. Later rooms add fake-out timing, combos, and defensive tricks when low.
- **Tells:** Big red charge ring while winding up. Leave the circle or interrupt the commit.

</details>

<details>
<summary><strong>Octagon</strong> - Commander</summary>

- **Blurb:** Hybrid elite base - spin, charge, shots, and minions.
- **Description:** Heavier hybrid that mixes melee spin/charge with projectile volleys and minion summons. Treat it like a mini-commander, not a normal trash mob.
- **Tells:** Purple outline. Watch for spin telegraphs, shot volleys, and circle spawns around it.

</details>

</details>

<a id="index-biomes"></a>
<details>
<summary><strong>Biomes</strong> - how the roster gets remixed</summary>

<details>
<summary><strong>Swarm</strong></summary>

Pack pressure - denser, slightly faster packs.

</details>

<details>
<summary><strong>Prism</strong></summary>

Wider ranged volleys and messier projectile spreads.

</details>

<details>
<summary><strong>Fortress</strong></summary>

Braced - tankier, longer telegraphs, harder hits.

</details>

<details>
<summary><strong>Fractal</strong></summary>

Echo afterimages on hit/death (pooled hitboxes, not new enemies).

</details>

<details>
<summary><strong>Vortex</strong></summary>

Pull during telegraphs - get dragged into commits.

</details>

<details>
<summary><strong>Endless</strong> (past room 50)</summary>

Late mix - light echoes + pull pressure.

</details>

</details>

<a id="index-elite-affixes"></a>
<details>
<summary><strong>Elite Affixes</strong> - one cheat code + jagged threat ring</summary>

Mid/late rooms can roll a single elite affix. Pools change by biome.

<details>
<summary><strong>Fortify</strong></summary>

- **Blurb:** Harder to punish during windup.
- **What it does:** Takes much less damage while telegraphing / charging. Wait for the commit or find another angle.
- **Tell:** Jagged threat ring. Tankier only during the windup - not permanently armored.
- **Pools:** Swarm, Fortress, Endless.

</details>

<details>
<summary><strong>Phasing</strong></summary>

- **Blurb:** Briefly unhittable after committing an attack.
- **What it does:** On attack commit, slips into a short phase window where hits do not land. Body goes translucent / wireframe while active.
- **Tell:** Threat ring + sudden ghosted body. Do not empty a heavy into the phase window.
- **Pools:** Prism, Fractal, Endless.

</details>

<details>
<summary><strong>Multishot</strong></summary>

- **Blurb:** Extra projectiles on ranged attacks.
- **What it does:** Ranged patterns fire an extra projectile. Especially nasty on stars and other shooters.
- **Tell:** Threat ring on a shooter. Expect wider / denser volleys than the base pattern.
- **Pools:** Prism, Vortex.

</details>

<details>
<summary><strong>Volatile</strong> (explosive attacks)</summary>

- **Blurb:** Explodes on death in a small radius.
- **What it does:** Death blast around the corpse. Finish at range or dodge the pop - do not stand on the kill.
- **Tell:** Threat ring. After the kill, give the body space for a beat.
- **Pools:** Fortress, Fractal.

</details>

<details>
<summary><strong>Arc</strong> (chain lightning)</summary>

- **Blurb:** Hits can chain lightning toward you.
- **What it does:** Combat hits may arc extra damage toward nearby players. Packs with Arc punish clustering.
- **Tell:** Threat ring. Spread out when several elites or dense packs are up.
- **Pools:** Swarm, Vortex.

</details>

<details>
<summary><strong>Execute</strong></summary>

- **Blurb:** Hurts more when you are already low.
- **What it does:** Deals bonus damage when your HP is under a threshold. Heal before trading; do not linger in execute range.
- **Tell:** Threat ring. Respect it hardest when you are already bleeding.
- **Pools:** Vortex, Endless.

</details>

<details>
<summary><strong>Rampage</strong></summary>

- **Blurb:** Speeds up and hits harder after landing a hit.
- **What it does:** On a successful hit, briefly buffs move speed and damage. Break contact or kite until the ramp fades.
- **Tell:** Threat ring. After it tags you, expect a short aggressive chase.
- **Pools:** Swarm, Fortress, Endless.

</details>

</details>

<a id="index-timing"></a>
<details>
<summary><strong>Timing</strong> - recovery, perfect dodge, perfect interrupt</summary>

- **Recovery:** Soft turn-rate lock after swings. Dodge-cancelable; short dodge buffer so you aren’t stuck waiting for the animation to finish.
- **Perfect dodge:** Dodge through a real attack → half dodge cooldown (VFX only, no currency).
- **Perfect interrupt:** Hit during telegraph spool → forced crit + stagger. Bosses/elites get an interrupt lockout and a brief hyper-armor flash when denied.

</details>

## Party Up

- Pause menu → lobby code → friends appear from any browser/device.
- Host is authoritative for combat/loot/rooms; clients get prediction + interpolation so movement feels less like a rubber band.
- 0.8.2 combat toys sync for clients too: Parallel twin projectiles (dormant stagger), biome echo rings, perfect interrupt/dodge FX, elite explode bursts, hyper-armor flash / rampage timers.
- Disconnects retry a few times; host drop migrates instead of instantly ending civilization.
- End-of-run scoreboards flex damage, kills, rooms, time alive.
- Dead in multiplayer? `Space` spectates living teammates.

## Controls

### Keyboard & Mouse
- Move: `WASD` · Aim: mouse
- Basic: `Left Click` · Heavy: `Right Click`
- Dodge: `Shift` · Special: `Space`
- Restart / Menu: `R` / `M`
- Pause / Multiplayer: `ESC`
- Debug Panel: `Ctrl+D`
- Host at Nexus portal: `G` to launch a run
- Interact (machines, pylons, pads): prompted on-screen (`E` / face button depending on input)

### Gamepad
- Hot-swap supported - mash another pad and it becomes active.
- Glyphs adapt for Xbox / PlayStation / Nintendo-ish mappings where we can sniff them.

### Touch
- Twin virtual joysticks + ability buttons with cooldown/charge feedback.
- UI reshuffles on rotate/resize so you’re not fighting the chrome.

## Want to Host Your Own Server?

```bash
cd server
npm install
npm start               # SERVER_MODE=single by default
# Advanced:
SERVER_MODE=multi WORKER_COUNT=4 npm start   # clustered (needs Docker/Redis)
SERVER_MODE=slave MASTER_SERVER_IP=10.0.0.100 WORKER_COUNT=4 npm start   # scale-out
```

- Default WebSocket port: **4000**
- Lobby / interpolation / reconnect knobs: `js/mp-config.js`
- Don’t want to self-host? Production URL (`wss://shape-slayer.gpe.pet`) ships ready.

Local static game shell from repo root:

```bash
npm start    # or: node server.js
```

Full harness (MP + metrics ingest + dashboard):

```bash
npm run server
```

## Credits & Community

Passion project. Readability, responsiveness, relentless fun. Break the build systems. Tell me what ridiculous combo you found.

- **Bugs or ideas?** Open a GitHub issue.
- **Want to contribute?** Fork it and go wild - vanilla JS + Canvas 2D for the game, DOM components under `ui/`, plain CSS under `css/ui/`. No framework, no render engine.
- **Need help?** In-game debug panel (`Ctrl+D`), browser console, or server logs.

Music so far is sourced from Pixabay (copyright-free audio): [https://pixabay.com](https://pixabay.com)

## Enemies & Bosses

- Trash mix: circles (swarmers), stars (ranged), diamonds (assassins), rectangles (brutes), octagons - same five bases, remixed by biome:
  - **Swarm** - pack pressure / tighter spacing
  - **Prism** - wider volleys
  - **Fortress** - braced HP / telegraphs / damage
  - **Fractal** - delayed echo hitboxes on hit/death
  - **Vortex** - pull during telegraph + aggressive tracking
  - **Endless** (past 50) - mild mix of the above
- Mid/late rooms can roll one **elite affix** (rampage, phasing, execute, explosive attacks, etc.) with a jagged threat ring; phasing enemies go translucent.
- Bosses every 10 rooms from 10 onward through the 50-room climb; each has escalating phases, hazards, and juicy loot.
- Multiplayer scaling adjusts count / HP / damage per player without instantly melting low-end machines.
- Kill payouts: trash pays now (not just elites/bosses). Credits bank **on kill**. Decade bumps keep late trash from feeling like pocket lint.
- Discover enemies and elite affixes in the Nexus **Index**. Ledger & Feats are in there too. Or just read **[Index Machine](#index-machine)** above.

## Progression & Saves

- `SaveSystem` parks currency, shards, upgrades, gear meta, settings, onboarding, Index discoveries, ledger/feat progress, etc. in `localStorage`.
- Update / launch / privacy modals surface from `js/version.js` when the version bumps.
- Solo Safe Room **Save Run** stores the real mid-run state (room, gear, items, HP, etc.) and resumes from that Safe Room - checkpoint consumes on load so you can’t duplicate infinite money. Multiplayer babysits itself instead.
- While a saved run exists, Nexus mostly just wants you to hit the portal again (no sneaking a pile of meta upgrades into a mid-run demon build).

## Debugging & Testing

- `Ctrl+D` / `DebugPanel.toggle()` - warp rooms, poke flags, stare at FPS.
- Verbose flags under `DebugFlags` (e.g. damage-number sync investigations).
- Balance / regression scripts from repo root (`package.json`):

```bash
npm run balance:gear
npm run balance:full-run
npm run balance:economy
npm run test:combat-scaling
npm run test:combat-economy
npm run test:feature-tutorials
npm run test:combat-ledger
# …plus more under npm run test:*
```

Puppeteer-style MP checks still live under `tests/` - see `tests/README.md`.

## Project Structure

```
shape_slayer/
├── index.html                 # Game shell + script load order
├── server.js                  # Optional static / PWA-friendly local server
├── sw.js / manifest.json      # Service worker + PWA bits
├── css/ui/                    # Hand-edited UI CSS (edit base.css directly; no Sass)
├── js/
│   ├── main.js                # Game loop, camera, state machine, run orchestration
│   ├── combat.js              # Damage, weapon-type feel, perfect dodge/interrupt, legendaries
│   ├── combat-scaling.js      # Room/boss/MP scaling (50-room gear cadence)
│   ├── combat-economy.js      # Kill credits + affordability helpers
│   ├── level.js               # Room generation hooks, bosses, Safe Rooms
│   ├── biomes.js              # Biome defs + gear progression map
│   ├── room-layout-generator.js
│   ├── gear.js                # Loot rolls, weapon/armor types, affixes, legendaries, crafting
│   ├── items/                 # Stackable passive items + pylons
│   ├── players/               # Base + Warrior/Rogue/Tank/Mage (recovery, Parallel heavies)
│   ├── enemies/ · bosses/     # Trash + boss kits; biome mods + elite affixes
│   ├── multiplayer.js         # Client lobby / sync / prediction / combat FX
│   ├── mp-config.js           # Multiplayer tuning
│   ├── nexus.js               # Hub, class pads, gear upgrade stations
│   ├── onboarding.js · room0-tutorial.js · feature-tutorials.js · coach-transition.js
│   ├── voxel-fracture.js      # Hit punch-out / death shatter VFX
│   ├── render.js · input.js · touch-controls.js · device-detection.js
│   ├── audio.js · music-manager.js
│   ├── save.js · run-checkpoint.js · feats-registry.js · ledger-manager.js
│   ├── telemetry.js · debug.js · version.js
│   └── …
├── ui/                        # DOM UI (menus, HUD, Safe Room, Index + Combat Ledger, gear shops)
├── server/                    # WebSocket host (single / clustered / slave)
├── harness/                   # One-command MP + metrics + dashboard
├── metrics/                   # Ingest service + analytics GUI
├── tests/                     # Node tests, balance sims, Puppeteer checks
└── docs/                      # Design notes / living changelogs (not always player-facing)
```

Card Mode used to live under `js/cards/` and a pile of door/hand UIs. Those files are gone. If a doc still talks about decks, it’s historical.

## Telemetry & Analytics

- **Harness** (`npm run server`) can spin MP + metrics ingest + dashboard together; logs under `harness/logs/`.
- **Client** (`js/telemetry.js`) ships per-run metrics from solo / host sessions when a run ends.
- **Ingest** (`metrics/server`, port `4001`) validates payloads into SQLite.
- **GUI** (`metrics/gui`, port `5000`) for summaries / run deep-dives.

Env knobs include `METRICS_PORT`, `METRICS_DB_PATH`, `METRICS_INGEST_TOKEN`. Details in `metrics/server/README.md`.

## Troubleshooting

- **Can’t connect** - MP server running? URL in `mp-config.js` / same-origin host correct? Port `4000` reachable?
- **Lobby missing / full** - codes are case-sensitive, expire ~1 hour, max 4 players. Restart server to clear ghosts.
- **Performance** - debug FPS, shrink lobby, close tab farms; deep rooms soft-cap density instead of spawning a second city.
- **Sound muted** - pause menu mute persists via `SaveSystem`.
- **`file://` weirdness** - use `npm start` / any HTTP server.
- **Looking for Card Mode** - it was removed in 0.8.0 (“Undeck Yourself”). Gear is the whole product now. Touch grass. Or touch gear. Same vibe.

For more help: browser console (`F12`) and multiplayer server logs. Issues welcome on GitHub.

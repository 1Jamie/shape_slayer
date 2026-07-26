# Shape Slayer MMO - Architecture & Design Specification

## Overview

This document defines the complete architectural specification and game design pillars for **Shape Slayer MMO**: an authoritative, open-world 2D ARPG mode built on top of Shape Slayer's fast, responsive top-down combat engine.

Following the recent **Engine Divorce** (`Engine` core → `Game` simulation → `Modes`), Shape Slayer MMO is implemented not as a new game engine, but as a **Modular Mode Package** (`modes/mmo/`). It runs its simulation loop server-side inside headless Node.js worker processes and uses the existing Redis Directory and WebSocket relay infrastructure for multiplayer distribution.

By combining a **zero-payload seeded procedural overworld**, **asymmetric client-prediction netcode**, **curated beat-modular boss assembly**, a **5-slot + bag equipment layout**, a **deterministic crafting/transmutation engine**, and **unified elemental reactions**, Shape Slayer MMO delivers a deep, persistent 2D ARPG experience with zero tilemap file downloads, zero pay-to-win mechanics, and zero frustrating RNG upgrade destruction.

---

## The 7 Pillars of Shape Slayer MMO

```text
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                                   SHAPE SLAYER MMO                                     │
 └──────┬────────────┬─────────────┬─────────────┬─────────────┬────────────┬─────────────┘
        │            │             │             │             │            │
        ▼            ▼             ▼             ▼             ▼            ▼
  ┌──────────┐ ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Pillar 1 │ │ Pillar 2 │  │ Pillar 3 │  │ Pillar 4 │  │ Pillar 5 │  │ Pillar 6 │  │ Pillar 7 │
  │ Seeded   │ │ Asym Net │  │ 5 Slots  │  │ Crafting │  │ Active   │  │ Curated  │  │ Guilds & │
  │ Procedural│ │ Auth &   │  │ + Bag    │  │ First &  │  │ Life     │  │ Modular  │  │ Social   │
  │ World    │ │ Clustering│ │ System   │  │ Modulated│  │ Skilling │  │ Bosses & │  │ System   │
  └──────────┘ └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ Dialogue │  └──────────┘
                                                                        └──────────┘
```

1. **Pillar 1: Zero-Payload Seeded Relational World & Tectonic Recipe Baking**  
   Infinite, persistent overworld generated entirely from a shared World Seed (`WORLD_SEED_HASH`). Utilizes a 3-tiered relational world generator (Continental Geometric Tectonics $\rightarrow$ Regional Settlement/Infrastructure Graph $\rightarrow$ Micro Zone Chunks) with **Baked Region Recipes (1-2 KB JSON)** so the world feels "lived in", causally believable, and naturally connected without heavy tilemap network downloads or client CPU strain.
2. **Pillar 2: Server-Authoritative Asymmetric Netcode & Clustering**  
   Game tick simulation runs headlessly inside Node.js worker processes. The server steps simulation strictly forward at 30 Hz (0% server rollback CPU cost), while clients use local prediction + reconciliation against server delta snapshots.
3. **Pillar 3: Streamlined 5-Slot Equipment + Bag System**  
   Equipment is clean and intuitive: **Weapon**, **Helmet**, **Upper Armor**, **Lower Armor**, and **Accessory/Relic**, plus a **Bag Slot** that dictates inventory grid capacity and gathering reach.
4. **Pillar 4: Crafting-First Deterministic Modulation & Transmutation**  
   Eliminates RNG upgrade roulette and item destruction. Players craft base Gear Frames, insert targeted **Affix Essences** into Modulation Sockets, refine stat ranks deterministically with 0% fail rate, and transmute gear affinities freely.
5. **Pillar 5: Skill-Based Active Life-Skilling**  
   Mining, Woodcutting, Harvesting, and Fishing are active, skill-based interactions integrated into the combat engine (precision swings, timing rings, Resource Elemental encounters) that directly feed the crafting economy.
6. **Pillar 6: Curated Beat-Modular Bosses, Unified Reactions & Dialogue**  
   Combines curated move primitives built from **Typed Beat Types** with **socketable beat-level essence modulation**, a **unified elemental reaction matrix** (e.g. Fire + Frost → Thermal Shock) shared across gear and combat, and an async/offline narrative layer.
7. **Pillar 7: Social Coordination, Guild Enclaves & Safe Onboarding**  
   Dynamic 4-player party zones, player-formed Guild Enclaves that claim regional Outposts, an explicit **Safe Haven Onboarding Floor** around starting hubs, and transactional anti-exploit trade security.

---

## Core System Loop: Combat-Primary with Social Amplifiers

Shape Slayer MMO is fundamentally a **Combat-Primary Game Mode**. Responsive top-down combat mechanics and buildcrafting are the primary stage, while social, guild, and trade systems act as **amplifiers/multipliers**.

```text
               [Combat Encounters (Overworld & Boss Shrines)]
                                     │
                                     ▼ Drops High-Tier
                                       Essences & Ores
                                     │
                       [Deterministic Crafting & Anvil]
                                     │
                                     ▼ Enables Control
                                       Of Regional Outposts
                                     │
                        [Guild Enclaves & Trade Hubs]
                                     │
                                     ▼ Unlocks Master Forges
                                       & Regional Catalysts
                                     │
                [Mythic World Boss Mastery & Solo Endgames]
```

---

## Content Budget: Initial Playable Slice (Phase 1 Baseline)

To guarantee a focused, achievable development scope, the initial release targets a strict, hand-balanced **First Playable Slice**:

| System | Initial Content Scope | Details |
| :--- | :--- | :--- |
| **Beat Types** | **6 Types** | `TelegraphBeat`, `ImpactBeat`, `ZoneBeat`, `ProjectileBeat`, `SelfBuffBeat`, `RecoveryBeat`. |
| **Boss Move Recipes** | **8 Move Primitives** | Slam, Sweep, Nova, Charge, Beam, Whirlwind, Mortar, Teleport. |
| **Affix Essences** | **12 Essences** | 4 Basic (Swiftness, Health, Speed, Power), 4 Elemental (Fire, Frost, Lightning, Earth), 4 Utility (Lifesteal, CDR, AoE, Pierce). |
| **Elemental Reactions** | **6 Exact Pairs ($\binom{4}{2}$)** | Fire+Frost (Thermal Shock), Fire+Lightning (Plasma Flare), Fire+Earth (Magma Pool), Frost+Lightning (Superconductive Burst), Frost+Earth (Glacier Wall), Lightning+Earth (Overload Surge). |
| **Gear Frame Families** | **3 Families** | Heavy Plate, Stalker Leather, Weaver Cloth (across 5 slots + 3 Bag tiers). |
| **NPC / Dialogue JSONs** | **4 Archetypes** | Master Smith (Crafting), Alchemist (Transmutation), Wayfinder (World Info/Quests), Banker (Vault). |

---

## Pillar 1: Zero-Payload Seeded Relational World & Tectonic Recipe Baking

### Philosophy: Solving "Minecraft Randomness" via Causal Geometric Tectonics
Pure memoryless per-zone hashing produces locally plausible terrain but fails at global relational believability. In traditional random generation, settlements, roads, mountain ranges, and rivers drop at arbitrary coordinates with no causal connection—creating an empty, disconnected world.

Shape Slayer MMO solves this by adapting **Continental Tectonics into Shape Slayer's Geometric Identity**. Mountain ranges are not coincidental noise peaks—they are **Fracture Ridges** born from colliding tectonic plates. Rivers originate from **Rift Veins** where plates pull apart. Settlements sit where real settlers would found them (near water, farmland, and defensible choke points), trade roads follow least-cost geographic paths, and zones beyond the current boundary feel as though they were **"always there, waiting to be discovered."**

```text
                  [World Seed: "SHAPE_SLAYER_CONTINENT_ALPHA"]
                                        │
         ┌──────────────────────────────┴──────────────────────────────┐
         ▼                                                             ▼
[Tier 1: Continental Tectonic Graph (~30-60 Plates)]  [Continuous Global Fields]
- Convergent Boundaries ──► Fracture Ridge (Chaos Spike) - Distance / Difficulty Field
- Divergent Boundaries  ──► Rift Veins (River Origin)    - Elevation Field h(x, y)
- Transform Boundaries  ──► Shear Zone (Lattice Shift)
         │                                                             │
         └──────────────────────────────┬──────────────────────────────┘
                                        ▼
   [Tier 2: Regional Settlement & Infrastructure Graph] (Cached per 16x16 Region)
   - Suitability Scoring (Water Access, Farmland, Defensibility, Resource Density)
   - Road Network Generation (Least-Cost Path MST / Steiner Tree over Terrain)
   - Settlement Hierarchy (Major Hubs, Single-Purpose Outposts, Ruined Keeps)
   - Age & Fate Layer (Thriving, Declining, Overrun by Monsters)
                                        │
                                        ▼
                      [Server Bakes Region Recipe (1-2 KB JSON)]
                      (Region Seed, Biome Anchors, Boundary Vectors, Road/River Nodes)
                                        │
                                        ▼
                   [Tier 3: Micro Zone Chunk Generator (Client PWA)]
                   - Procedural cliffs, waterways, roads, and obstacle geometry
                   - Deterministic resource node & monster camp placement
```

### Technical Specification

#### 1. Tier 1: Continental Tectonic Graph & Geometric Biomes
Generated once per world seed as a coarse graph of 30–60 plate sites across the entire continent:
* **Tectonic Boundaries Mapped to Geometric Shape Language**:
  * **Convergent Boundary (Plates Colliding) $\rightarrow$ Fracture Ridge**: Spikes the *Order $\leftrightarrow$ Chaos* axis toward Chaos. Jagged, fractured, crystalline-shatter terrain (causally a mountain ridge, born from collision).
  * **Divergent Boundary (Plates Pulling Apart) $\rightarrow$ Rift Vein**: Canyons and tears where river-seed logic and flow accumulation originate naturally.
  * **Transform Boundary (Plates Shearing) $\rightarrow$ Shear Zone**: The lattice orientation shifts discontinuously across the seam (e.g. Hex grid rotates $15^\circ$, scale/density jumps abruptly without smooth gradient).
* **Native Geometric Biomes**: Biomes are defined along continuous shape axes rather than Earth climate:
  * **Order $\leftrightarrow$ Chaos**: Regular tessellated lattices (aligned hexes) vs. fractured, jagged scatter.
  * **Density / Scale**: Sparse monumental primitives (huge monoliths) vs. dense small shape clusters.
  * **Hard $\leftrightarrow$ Soft**: Angular/spiky silhouettes (Fire/Earth) vs. round/flowing contours (Water/Energy).
* **Mechanic Unification**: Tectonic collision axes drive terrain visuals, enemy chassis selection, AND elemental essence drop tables (unifying Pillar 1 and Pillar 6).

#### 2. Tier 2: Regional Settlement & Infrastructure Graph
Evaluated lazily upon first access for a $16 \times 16$ zone region and cached in Redis (keyed by region coordinates):
* **Suitability Scoring**: Candidate sites are scored across a coarse grid using flow accumulation (water access), elevation slope (flat ground), defensibility (choke points), and resource density. Local maxima become settlement anchor candidates.
* **Road Networks as Least-Cost Paths**: Connected via Minimum Spanning Trees (MST) / Steiner-tree passes over a terrain cost field. Roads run cheaply through valleys and plains, cross rivers at natural ford points, and traverse mountain ridges via low-gradient passes.
* **Settlement Hierarchy (Power Law)**: Sites scored by `(Suitability × Road Connectivity)` dictate settlement scale (Major Trade Hubs vs. Single-Purpose Mining/Fishing Outposts).
* **Age & Fate Layer**: A regional pressure field determines settlement history (**Thriving**, **Declining**, **Abandoned Ruins**, or **Monster-Occupied Strongholds**), directly feeding the async/offline LLM narrative layer.

#### 3. Recipe Baking & Predictive Pre-Warming
To prevent client CPU strain or heavy tilemap network downloads:
1. **Server Macro Baking (Paid Once)**: The server computes the continental tectonic graph and regional settlement graph, caching results in Redis/PostgreSQL.
2. **Predictive Bake Radius**: The server pre-warms and bakes regions in a 2-region radius around active players based on movement vectors, ensuring 0ms cold-start latency when entering new regions. Region graph cache uses an LRU eviction policy.
3. **Region Recipe Hand-off (1-2 KB JSON)**: When a player enters a zone, the server distills macro data into a tiny parameters JSON:
   `{ zoneX: 5000, zoneY: 3000, regionSeed: "0x4F8...", biomeAnchors: {...}, tectonicVectors: [...], roadNodes: [...] }`
4. **Client Micro Execution**: The client PWA receives only this 1-2 KB Recipe on zone load and feeds it into `room-layout-generator.js`. The client *never* computes continental tectonics or downloads tilemaps—it only executes fast, local deterministic math for the active zone.
5. **Offline / Single-Player Fallback**: Because plate generation is 100% seed-deterministic, the same recipe baking algorithm can run locally on client in offline/single-player mode if needed.

#### 4. Discrete 2D Elevation Tier Plateaus (2 to 4 Depths)
Top-down 2D sells elevation through **Discrete Tier Plateaus**:
* **Visual Depth Cues**: Contrast/clutter density shifts, palette banding, and a thin rendered lip with a shadow band + jagged triangle/shard rubble along contour seams.
* **Tactical Elevation Mechanics**: High ground provides tactical asymmetry—shooting downhill across cliff edges, line-of-sight advantages, dampened sound/aggro across tier boundaries, and strategic choke points along roads.

#### 5. Onboarding, Safety Floor & World Difficulty Signaling
While difficulty scales continuously via distance fields (`Distance-from-Origin`), Haven Town's immediate surroundings enforce an explicit **Safe Onboarding Floor**:
* **1000px Radius Haven Safety Zone**: Overrides distance difficulty math in the starting zone, capping enemy level to Tier 1, removing aggressive elite affixes, and placing gentle gathering nodes so a brand-new player's first 10 minutes are hand-tuned, readable, and safe.
* **Environmental Difficulty Signaling**: In the open world, risk levels are telegraphed through biome palette darkening, danger warning banners, and enemy level nameplate badges (Gray, Green, Blue, Purple, Skull).

---

## Pillar 2: Server-Authoritative Asymmetric Netcode & Clustering

### Architecture Overview

```text
                      ┌────────────────────────┐
                      │   PWA Client (Browser) │
                      │ - Local Render Engine  │
                      │ - Local Prediction     │
                      │ - Server Reconciliation│
                      └───────────┬────────────┘
                                  │ WebSocket (Input Vectors / Delta Snapshots)
                                  ▼
                  ┌────────────────────────────────┐
                  │ Master Server / Edge Router    │
                  │ (Redis Directory & Hand-offs)  │
                  └───────┬────────────────┬───────┘
                          │                │
        ┌─────────────────┴─┐            ┌─┴─────────────────┐
        │ Zone Worker 1     │            │ Zone Worker 2     │
        │ (Haven Town)      │            │ (Wilds Zone 1,0)  │
        │ - Headless 30Hz   │            │ - Headless 30Hz   │
        │ - Strictly Forward│            │ - Strictly Forward│
        └─────────┬─────────┘            └─────────┬─────────┘
                  │                                │
                  └───────────────┬────────────────┘
                                  ▼
                  ┌────────────────────────────────┐
                  │ Persistence Layer              │
                  │ (PostgreSQL / Redis Ledger)    │
                  └────────────────────────────────┘
```

### Asymmetric Netcode Design
* **Rollback vs. Predict-and-Reconcile**:
  * Shape Slayer's original co-op/arena netcode uses client-host peer rollback for low-latency fighting.
  * In persistent MMO zones with players joining and leaving asynchronously, **the server loop runs strictly forward** (`fixedUpdate(0.0333)` at 30 Hz). The server never rolls back world state, incurring **zero server-side rollback CPU penalty**.
  * **Client-Side Asymmetry**: The client predicts local movement and actions immediately, storing a local input buffer. When server snapshots arrive, the client reconciles state if mispredicted.
  * The input and movement layer abstracts over both netcode styles, sharing the exact same underlying `physics.js` and `combat.js` simulation math.

### Zone Transfers & Clustering
* **Seamless Hand-offs**:
  When a player steps onto a zone portal or boundary:
  1. Current Zone Worker sends a `redirect` frame with the target worker's URL and handoff token:
     `{ type: "redirect", data: { url: "ws://relay-zone2:4002", handoffToken: "xyz..." } }`
  2. Target Zone Worker validates the token in Redis and resumes the player's entity state seamlessly.

---

## Pillar 3: Streamlined 5-Slot Equipment + Bag System

### The Equipment Slots

| Slot | Primary Stat Focus | Utility & Build Influence |
| :--- | :--- | :--- |
| **1. Weapon** | Base Attack Power, Weapon Range, Attack Speed | Class ability mechanics (Warrior Greatsword, Rogue Daggers, Tank Hammer/Shield, Mage Staff/Focus). |
| **2. Helmet** | Energy/Mana Regen, Cooldown Reduction | Perception, status effect resistance, crit multipliers. |
| **3. Upper Armor (Chest)** | Max Health, Flat Armor / Mitigation | Crowd control threshold, fortify, health regen. |
| **4. Lower Armor (Greaves)** | Movement Speed, Dodge Cooldown | Movement trails (Flame/Frost), dash distance, phasing. |
| **5. Accessory / Relic** | Special Affix Amplifiers, Life-steal | Class skill modifiers (e.g. Whirlwind radius, Beam penetration, Multi-strike). |
| **6. Bag Slot** | Carrying Capacity, Pickup Radius | Inventory grid dimensions (e.g. Small Pouch = 16 slots, Adventurer Rucksack = 36 slots, Master Vault Bag = 60 slots). |

### Gear Families & Stat Biases
* **Heavy Plate Family**: High Armor/Defense, High Max HP, -2% Movement Speed penalty.
* **Stalker Leather Family**: Balanced Armor, +Crit Chance, +Movement Speed bonus.
* **Weaver Cloth Family**: Low Armor, High Cooldown Reduction, +Energy/Skill Damage.

### Quality Tiers

```text
Gray (Tier 1: Common) ──► Green (Tier 2: Sturdy) ──► Blue (Tier 3: Polished) ──► Purple (Tier 4: Masterwork) ──► Orange (Tier 5: Relic)
```

---

## Pillar 4: Crafting-First Deterministic Modulation & Anti-Exploit Security

### Philosophy & Anti-Exploit Security
Shape Slayer MMO rejects RNG upgrade roulette and item destruction. **Crafting is the Primary, 100% Deterministic Pathway to Best-in-Slot Gear**.

To protect the live economy from exploit vectors (dupe bugs, trade race conditions, bot markets):
* **Two-Phase Commit Trade Transactions**: Item/currency transfers use atomic PostgreSQL / Redis transactions with state locking.
* **Server-Authoritative State Locks**: A player's inventory is locked server-side during trade or crafting operations to eliminate race-condition dupes.
* **Ledger Anomaly Detection**: Automated audits flag unusual gold/essence delta spikes or frame generation without matching material deductions.

```text
┌──────────────────┐    ┌─────────────────────┐    ┌─────────────────────────┐    ┌──────────────────────┐
│  1. Base Frame   │    │ 2. Essence Sockets  │    │ 3. Refinement Upgrades  │    │ 4. Transmutation     │
│  Craft Chassis   ├───►│ Insert Targeted     ├───►│ Upgrade Stat Ranks      ├───►│ Pivot Affinities or  │
│  from Gathering  │    │ Affix Essences      │    │ (0% Failure / No Bricking)│   │ Swap Essences Freely │
└──────────────────┘    └─────────────────────┘    └─────────────────────────┘    └──────────────────────┘
```

---

## Pillar 5: Active, Skill-Based Life-Skilling

Life-skilling is integrated directly into Shape Slayer's fast-paced top-down movement and physics.

### Gathering Professions & Mechanics
1. **Mining (Geometric Ores)**: Strike vein nodes in rocky biomes. Yields metals and gems for Weapon and Armor frames.
2. **Woodcutting (Poly Trees)**: Chop ancient timber nodes. Yields hardwoods for Staffs, Bows, Shields, and Handles.
3. **Harvesting (Essence Flora)**: Gather magical flora. Yields catalysts, potions, and Affix Essences.
4. **Fishing (Aether Pools)**: Interactive timing-based fishing in liquid pools. Yields rare reagents and ancient Relics.
5. **Precision Swings & Resource Elementals**: Hitting gathering nodes triggers precision timing rings that double yields. High-tier nodes may awaken a **Resource Elemental** (e.g., *Granite Golem*) that drops rare crafting recipes when defeated.

---

## Pillar 6: Curated Beat-Modular Bosses, Unified Reactions & Dialogue

### 1. Modular Enemy Assembly (Chassis + Components)
Rather than procedurally generating random sprites or uncoordinated mob behaviors, enemies use the exact same **"Chassis + Modular Components"** pattern as Pillar 4 gear:

$$\text{Enemy Template} = \text{Geometry Chassis (Triangle/Hex/Blob)} \times \text{Movement AI} \times \text{Attack Module} \times \text{Elemental Essence}$$

### 2. Typed Beat System & Curated Boss Assembly
To prevent a combinatorial explosion (hand-tuning 500+ move combinations), boss moves are assembled from a catalog of **Typed Beat Types** that define explicit **Essence Contracts**:

```text
                  [Boss Core: "Fractal Overlord"]
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
  [Curated Move 1]        [Curated Move 2]        [Curated Move 3]
  "Spiral Nova"           "Seismic Slam"          "Orbital Beam"
        │                        │                        │
  ┌─────┴───────────────┐  ┌─────┴───────────────┐  ┌─────┴───────────────┐
  │ Beat 1:             │  │ Beat 1:               │  │ Beat 1:             │
  │ TelegraphBeat       │  │ TelegraphBeat         │  │ TelegraphBeat       │
  ├─────────────────────┤  ├───────────────────────┤  ├─────────────────────┤
  │ Beat 2:             │  │ Beat 2:               │  │ Beat 2:             │
  │ ZoneBeat [Socket]   │  │ ImpactBeat [2 Sockets]│  │ ProjectileBeat      │
  │ (Fire)              │  │ (Lightning + Earth)   │  │ [Socket] (Frost)    │
  ├─────────────────────┤  ├───────────────────────┤  ├─────────────────────┤
  │ Beat 3:             │  │ Beat 3:               │  │ Beat 3:             │
  │ RecoveryBeat        │  │ RecoveryBeat          │  │ RecoveryBeat        │
  └─────────────────────┘  └───────────────────────┘  └─────────────────────┘
```

#### Beat Type Taxonomy & Essence Contracts
Each beat type declares an explicit essence contract—defining which essences it accepts and how they mutate that beat's behavior:

| Beat Type | Accepted Essences | Contract Behavior Summary | Single vs. Dual Essence Resolution |
| :--- | :--- | :--- | :--- |
| **`TelegraphBeat`** | Lightning, Earth, Frost | Modifies windup timing & indicators. Lightning splits telegraph into 2 pulses; Earth adds shockwave indicator. | **Single Essence**: Applies single-essence beat mutation.<br>**Dual Elemental**: Triggers Reaction Override (e.g. Frost + Lightning = Superconductive Pulse).<br>**Elemental + Utility**: Additive stack (e.g. Frost + CDR). |
| **`ImpactBeat`** | Fire, Lightning, Earth, Frost | Modifies damage payload. Lightning chains to nearby targets; Earth adds armor shatter. | **Single Essence**: Applies single-essence damage payload.<br>**Dual Elemental**: Triggers Reaction Override (e.g. Fire + Earth = Magma Impact).<br>**Elemental + Utility**: Additive stack. |
| **`ZoneBeat`** | Fire, Frost, Earth, Lightning | Modifies zone duration/shape. Fire creates lava pool; Frost creates ice patch. | **Single Essence**: Applies single-essence ground hazard.<br>**Dual Elemental**: Triggers Reaction Override (e.g. Fire + Earth = Magma Pool).<br>**Elemental + Utility**: Additive stack. |
| **`ProjectileBeat`** | Fire, Frost, Lightning, Earth | Modifies projectile count, speed, and behavior (Lightning forks; Frost freezes). | **Single Essence**: Applies single-essence projectile property.<br>**Dual Elemental**: Triggers Reaction Override (e.g. Frost + Lightning = Superconductive Wave).<br>**Elemental + Utility**: Additive stack. |
| **`SelfBuffBeat`** | Swiftness, Power, Health | Modifies self-stat buffs during attack execution. | **Single / Dual**: Stacks additive stat boosts (Utility essences do not form reactions). |
| **`RecoveryBeat`** | Health, Swiftness | Modifies recovery window; Health grants lifesteal during recovery frames. | **Single / Dual**: Stacks additive recovery utility. |

**Contract Resolution Rules**:
1. **Single Essence**: Applies a single-essence beat mutation as defined in the contract.
2. **Dual Elemental Essences**: When two elemental essences (Fire, Frost, Lightning, Earth) are placed on the exact same beat instance, they trigger the **Reaction Override** from the $C(4,2) = 6$ elemental matrix, overriding individual single-essence mutations.
3. **Elemental + Utility Essence**: Non-elemental essences (Swiftness, Health, Speed, Power, Lifesteal, CDR, AoE, Pierce) do not form reactions; when paired with an elemental or basic essence, they stack additively.

### 3. Unified Elemental Reaction Matrix & Environmental Zones

#### The Exact 6-Pair Elemental Reaction Matrix ($\binom{4}{2} = 6$)
The 4 elemental essences (Fire, Frost, Lightning, Earth) produce exactly 6 unique pairwise combinations:

```text
                                [4 Elemental Essences]
                              (Fire, Frost, Lightning, Earth)
                                             │
      ┌──────────────────────────────┬───────┴──────────────┬──────────────────────────────┐
      ▼                              ▼                      ▼                              ▼
(Fire + Frost)               (Fire + Lightning)     (Fire + Earth)                 (Frost + Lightning)
  Thermal Shock                Plasma Flare           Magma Pool                     Superconductive Burst
  Burst Shatter + Shred        AoE Explosion + Blind  Lava Hazard + Armor Burn       Chain Stun + Slow
                                             │                                             │
                                             ├──────────────────────────────┐              │
                                             ▼                              ▼              ▼
                                     (Frost + Earth)                (Lightning + Earth)
                                       Glacier Wall                   Overload Surge
                                       Frozen Spikes + Root           Conductive EMP Shock
```

#### Reaction Resolution Domains & Environmental Zone Model
1. **Intra-Beat**: Two elemental essences placed on the **exact same beat instance** trigger the reaction override for that beat. Essences on *different* beats of the same move do NOT trigger intra-beat reactions.
2. **Inter-Entity**: Elemental damage/hit from a player/enemy infused with element A hitting a target infused with element B triggers the reaction on hit.
3. **Environmental Zone Ownership & Reaction Model**:
   * **Definition**: Environmental zones (static lava/ice pools, rivers, active `ZoneBeat` hazards) possess an `ownerId`, `elementTag`, and `hitboxRadius`.
   * **Resolution**: When a target inside a zone receives damage of an opposing element, the reaction triggers at the target's coordinates. Same-element overlaps (e.g. Fire damage inside a Fire zone) produce no reaction.

### 4. Solo Combat Endgame Loop: World Boss Mastery & Build Permutations

For solo players seeking pure combat mastery, the MMO mode provides a long-term retention loop driven by **World Boss Mastery Tiers** and **Targeted Build Permutations**:

```text
       [Normal World Boss] ──► [Heroic World Boss] ──► [Mythic World Boss]
       - Base Beat Sockets     - Faster Beat Timing   - Elemental Phase Shields
       - 1 Essence per Beat    - Added Enrage Phase   - Dual Socket Reaction Beats
                                                      - Requires Specific Counter-Build
```

1. **Beat-Modular World Boss Mastery (Normal $\rightarrow$ Heroic $\rightarrow$ Mythic)**:
   * Difficulty scales structurally rather than purely inflating HP sponges. Mythic bosses execute faster beat timings, gain additional move beats, and feature **Dual-Socketed Reaction Beats**.
2. **Elemental Phase Shields & Counter-Build Requirements**:
   * Mythic bosses feature phase shields permeable only by specific **Elemental Reactions** (e.g. a Mythic *Glacial Overseer* projects a Glacier Shield that requires a *Plasma Flare* [Fire + Lightning] reaction to shatter).
3. **Pillar 4 Transmutation Permutation Loop**:
   * Solo players use Pillar 4 Transmutation & Essence Socketing to re-align their 5-slot gear builds for specific Mythic World Boss encounters, creating an engaging "Theorycraft $\rightarrow$ Harvest Reagents $\rightarrow$ Transmute Build $\rightarrow$ Defeat Mythic Boss" loop.

### 5. Beat Sandbox Dev Tool Specification
To maintain rapid content production without slow compile/play loops, the **Beat Sandbox** is specified as a standalone debug mode:
* **Access**: Accessible via `?sandbox=beats` URL query or in-game debug panel (`Ctrl+D`).
* **Runtime**: Loads engine core and combat simulation locally in-browser without WebSocket netcode.
* **Capabilities**: Designers can select any Beat Type, socket Essences, preview animations/hitboxes/VFX in real time, toggle reaction overrides, and export validated contract JSONs directly into game data directories.

### 6. Async/Offline Narrative & Delivery Contract
* **Zero Live LLM Latency**: No LLM calls exist on the hot combat loop or live game tick.
* **Offline World Pass**: An async background pipeline reads regional settlement state/history and generates regional narrative events, writing directly into clean node-based JSON dialogue files (`dialogue.json`).
* **Player-Facing Delivery (Wayfinder & Notice Boards)**:
  * Wayfinder NPCs and Town Notice Boards present 1–3 **Regional Rumors** drawn from the narrative pass.
  * **Refresh Triggers**: Rumors update on a scheduled **24-hour cycle OR immediately upon significant regional state transitions** (e.g., Settlement overrun by monsters, World Boss spawn, or rare resource vein discovery).

---

## Pillar 7: Social Coordination, Guild Enclaves & Regional Trade Economy

### 1. Dynamic Parties & Guild Enclaves
* **Dynamic 4-Player Parties**: Shared zone instances for dungeon crawling and world boss raids.
* **Guild Enclaves**: Player-formed guilds can claim regional Outposts (Tier 2 Settlements).

### 2. Territory Contests & Tunable Social Cadence
* **Weekly Outpost Contests**: Guilds compete for Outpost ownership via weekly influence contests (aligned with weekend play patterns).
* **14-Day Claim Decay**: Inactive guild claims decay over 14 days (tolerating a 2-week vacation window for casual guilds while preventing dead "zombie claims"), opening the Outpost for re-contestation.
* *Note*: Decay windows and contest intervals are tunable telemetry-backed parameters.

### 3. Regional Trade Scarcity & Fast-Travel Logistics

#### Fast-Travel Rules & Directionality
* **Waypoint-to-Waypoint Only**: Teleportation can *only* be initiated when standing at an unlocked Waypoint or claimed Guild Outpost, and can *only* target a previously unlocked Waypoint destination. Players cannot teleport from the open wilderness.
* **Unexplored Regions Require Physical Travel**: Unexplored regions must be traversed physically on foot/mount to discover and activate the local Waypoint anchor.
* **Predictive Baking Independence**: Predictive pre-warming is a server simulation quality optimization, completely separate from player travel permissions.

#### Teleport Tariffs & The Hauling Economy Formula
Because crafting is 100% deterministic (0% fail rate), trade scarcity is driven by **Regional Resource Exclusivity**: specific high-tier materials (e.g., Cobalt Ore) only spawn in specific tectonic biomes.

Fast-travel costs are governed by an explicit weight tariff formula:

$$\text{TeleportTariff} = \text{BaseFee} + (\text{DistanceInZones} \times \text{WeightFactor} \times \text{CargoUnits})$$

* **Economic Reference Transaction**:
  * Teleporting 50 Cobalt Ores ($10\text{ kg}$) over 20 regions costs $500\text{ gold}$.
  * Renting a Trade Cart ($200\text{ kg}$ capacity) costs $50\text{ gold}$ and takes 10 minutes on foot/road.
  * Transporting by cart yields a $450\text{ gold}$ profit margin per run, creating a viable player hauling economy where player trade routes and caravans thrive.

---

## Implementation Roadmap

```text
Phase 1: Headless Server Core & 3-Tier Seeded Relational World
├── Extract rendering dependencies from physics/combat simulation
├── Implement Continental Tectonics graph generator & Regional Settlement Graph caching
└── Build Server Region Recipe Baker with Predictive Pre-Warming (1-2 KB JSON hand-off)

Phase 2: Asymmetric Netcode & Zone Router
├── Adapt client prediction + server reconciliation for 30Hz forward-only server tick
└── Configure mp-server-master to map world zones to Node worker processes with Redis hand-offs

Phase 3a: Typed Beat Engine & Reaction Matrix
├── Implement 6 Beat Types with explicit Essence Contracts and per-beat slot caps
└── Create 6-reaction elemental lookup matrix (Fire, Frost, Lightning, Earth) with domain rules (intra-beat vs inter-entity vs environmental)

Phase 3b: Beat Sandbox Tool & Content Tuning Milestone (Content Track)
├── Build Standalone Dev Beat Sandbox Tool (`?sandbox=beats` for visual testing & JSON export)
└── Author & playtest 24 single-essence contracts and 8 move recipes against Tier 3 gear

Phase 4: 5-Slot Gear, Crafting & Anti-Exploit Trade Engine
├── 5-Slot + Bag inventory management & 3 Gear Families
├── Crafting Anvil, Essence Modulation Socketing, and Refinement UI
└── Atomic Two-Phase Commit trade transactions & ledger anomaly detection

Phase 5: Active Life-Skilling, Solo Endgames & Guild Logistics
├── Mining, Woodcutting, Harvesting, and Fishing nodes with precision hitboxes
├── Fast-travel weight tariffs, waypoint unlocking, and hauling mechanics
└── Mythic World Boss Mastery tiers, Guild Outpost territory contests, and Wayfinder Rumor feeds
```

---

*Shape Slayer MMO Design Specification — Version 2.5*

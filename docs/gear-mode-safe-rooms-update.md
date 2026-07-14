# Gear Mode Pivot - Safe Rooms, Economy, Onboarding & Voxel Fracture

> **Updated:** 2026-07-14 (dead-code scrub pass)  
> **Branch / state:** working tree on `main` (uncommitted)  
> **Game version file:** `js/version.js` still reports `0.7.0` (not bumped for this WIP)  
> **Diff scale (tracked vs `HEAD`):** **72** paths · **+3,779 / −13,694** (**net −9,915**)  
> **Whole-file deletes alone:** **25** files · **−9,726** lines  
> **Untracked new:** **16** files · **~7.2k** game/UI/test LOC (+ this doc)

---

## Headline

This update **removes Card Mode** and locks the product to **Gear Mode**, with:

1. **Nexus Gear Upgrades** - shard-bought meta for drop luck and Safe Room power (machines gated by progress)  
2. **Mid-run Safe Rooms** - credit-spent crafting hubs every 5 combat rooms  
3. **Combat economy** - trash/elite/boss credits banked **on kill**, decade-scaled through a **50-room** gear run  
4. **First-run onboarding** - forced Nexus coach → Room 0 combat drill → feature-machine tutorials  
5. **Pre-boss healers** + retuned combat scaling (bosses every **10** rooms)  
6. **Voxel fracture VFX** - punch-out damage juice and death shatter  

Card runtime, door-pack UIs, and leftover call sites are gone. Portal is Gear-only. Boss cadence is **reconciled** across level, combat-scaling, biomes, music, and balance sims.

---

## Git Status at a Glance

| Layer | Contents |
|-------|----------|
| **Deleted** | Entire `js/cards/` (13), door pack UIs + `selection-doors.js`, canvas `ui-character-sheet.js`, deck/hand/mastery/mulligan/swap/room-modifier UI |
| **New modules** | `combat-economy`, `voxel-fracture`, `onboarding`, `room0-tutorial`, `feature-tutorials`, `coach-transition`, gear/safe-room menus |
| **New tests** | economy, run-credits, safe-room-meta, onboarding, room0, feature-tutorials |
| **Heavily modified** | `main.js`, `save.js`, `gear.js`, `nexus.js`, enemies/bosses, `combat-scaling.js`, layout, music config, launch/privacy modals |
| **Script wiring** | `index.html` drops cards + door UIs; loads economy, fracture, coach stack, gear/safe menus |

Older foundation (procedural rooms, fortify, profiler): [`local-changes-summary.md`](./local-changes-summary.md). Card design history: [`card-system-design-spec.md`](./card-system-design-spec.md) (retired path).

---

## Table of Contents

1. [Design Intent](#1-design-intent)
2. [Card System Removal](#2-card-system-removal)
3. [Gear Progression Overhaul](#3-gear-progression-overhaul)
4. [Safe Rooms](#4-safe-rooms)
5. [Nexus Gear Upgrade Stations](#5-nexus-gear-upgrade-stations)
6. [Combat Economy](#6-combat-economy)
7. [Save Schema & Meta APIs](#7-save-schema--meta-apis)
8. [Onboarding & Tutorials](#8-onboarding--tutorials)
9. [Biome, Layout & Music](#9-biome-layout--music)
10. [Boss Cadence & Balance](#10-boss-cadence--balance)
11. [Voxel Fracture VFX](#11-voxel-fracture-vfx)
12. [Enemy AI & Navigation](#12-enemy-ai--navigation)
13. [Swarm King Reliability Pass](#13-swarm-king-reliability-pass)
14. [Combat / Rewards / Player Loop](#14-combat--rewards--player-loop)
15. [Multiplayer](#15-multiplayer)
16. [Input & UX Polish](#16-input--ux-polish)
17. [Tests & npm Scripts](#17-tests--npm-scripts)
18. [File Inventory](#18-file-inventory)
19. [Known Incomplete Migrations](#19-known-incomplete-migrations)
20. [Player-Facing Changelog Draft](#20-player-facing-changelog-draft)
21. [For Lost - Post-50 Infini & Solo Save](#21-for-lost--post-50-infini--solo-save)

---

## 1. Design Intent

| Pillar | Before | After |
|--------|--------|-------|
| Primary power fantasy | Build a deck, draw a hand, pick pack doors | Equip gear, craft it in Safe Rooms, invest shards into gear meta |
| Mid-run upgrade tempo | Door packs / card swaps / room modifiers | Safe Room every 5 cleared combat rooms |
| Credit flow | Sparse elite/boss end-of-run payouts | Every kill pays; banked immediately; decade-scaled |
| Permanent progression | Deck upgrades, mastery, room-mod collection | Affix-slot caps, rarity luck, Safe Room Systems / Efficiency |
| First session | Cold drop into Nexus | Forced coach → Room 0 drill → gated feature coaches |
| Mode select | Nexus portal Card ↔ Gear | Nexus **locked to Gear** |
| Visual feedback | Simple particle bursts | Voxel punch-out, chips/fluid, settling debris, death shatter |

| Currency | When awarded | Spent on |
|----------|--------------|----------|
| **Credits** | On kill (banked to save mid-run) | Nexus class upgrades + Safe Room machines |
| **Shards** | End of run (`addCardShards`) | Nexus Gear Upgrade machines |

Shard helpers still use “card” naming; end-run UI may still say “Card Shards.”

---

## 2. Card System Removal

### 2.1 Deleted runtime (`js/cards/`)

| File | Former role |
|------|-------------|
| `card-data.js` | `CardCatalog` aggregation |
| `card-effects.js` | Hand → combat modifiers |
| `card-unlocks.js` | Lifetime-stat achievement unlocks |
| `class-card.js` | Quality-banded class damage card |
| `curse-cards.js` | Non-discardable curses |
| `deck-manager.js` | Run deck: draw / hand / discard / mulligan |
| `ground-cards.js` / `ground.js` | World ground-card drops & pickup |
| `migration.js` | One-time gear→cards save migration |
| `packs.js` | Pack/door reward generation (`CardPacks`) |
| `player-cards.js` | Player power card families |
| `room-modifier-cards.js` | Next-room modifiers |
| `team-cards.js` | Multiplayer team boons |

### 2.2 Deleted UI

`deckBuilder`, `deckUpgradeMenu`, `handHUD`, `masterySystem`, `mulligan`, `roomModifierSelection`, `swapPreview`, `doorOptions`, `upgradeSelection`, `doorModifierSelection`, plus `js/doors/selection-doors.js` and unused canvas `js/ui-character-sheet.js`.

### 2.3 Scaffolding scrub (done 2026-07-14)

Removed leftover call sites and schema:

- No runtime refs to `CardCatalog` / `DeckState` / `CardPacks` / `CardEffects` / `CardGround`  
- Stripped card branches from `main.js`, `combat.js`, players, `input.js`, `ui.js`, `level.js`, character sheet, Index Machine  
- Portal / mode switcher locked to Gear (`ui.js` + `nexus.js`)  
- Save: dropped deck/unlock/mastery/discovery-card fields + APIs  
- **Kept (rename later):** `cardShards` / `getCardShards` / `addCardShards` (live Nexus shard currency)  
- **Kept (harmless):** `nextRoomModifiers.currencyBoost` Prism Tax hooks (tests only; never set in-game)

Track-wide impact of the pivot (incl. this scrub): **−13,694** deleted lines on tracked files (**−9,726** from whole-file deletes). Relative to the prior afternoon-pass doc snapshot (**−8,679**), the scrub added about **−5,000** more deletions.

---

## 3. Gear Progression Overhaul

Primary file: `js/gear.js`.

### 3.1 Meta-driven affix capacity

`getTieredAffixSlots(gearTier, upgrades)` reads `SaveSystem.getGearUpgrades()`:

| Upgrade key | Cap progression |
|-------------|-----------------|
| `affixSlotsBasic` | 1 → 2 (lvl ≥3) → 3 (lvl ≥5) |
| `affixSlotsAdvanced` | 0 → 1 (≥2) → 2 (≥4); shop-gated behind Basic ≥3 |
| `affixSlotsRare` | 0 → 1 (≥3) → 2 (≥5); shop-gated behind Advanced ≥3 |

### 3.2 Meta-driven drop rarity luck

`calculateTierProbabilities` applies relative multipliers from `rarityChanceGreen|Blue|Purple|Orange` (~**+10% / +8% / +6% / +4%** per level), then renormalizes. Bosses still suppress gray.

### 3.3 Per-piece craft progress fields

```text
level, upgradesApplied, originalTier, rarityStepsApplied,
rarityUpgradedThisVisit, rerollIndex, rerollCount
```

Normalized by `normalizeGearProgressFields`; synced in MP gear serialize/hydrate.

### 3.4 Crafting APIs

| API | Behavior |
|-----|----------|
| `rerollGearAffix(gear, index)` | Same-tier/slot reroll; class smart-loot; ×`(1 + upgradesApplied * 0.04)` |
| `GEAR_TIER_ORDER` | `gray → green → blue → purple → orange` |
| `RARITY_UPGRADE_BASE_COSTS` | gray→green **150** … purple→orange **2000** |
| `adaptPrimaryStatsToTier` | Remap primaries into new tier ranges |
| `raiseGearRarity(gear)` | In-place bump; `{ok, from, to}` |
| `clearAllGearRarityVisitFlags()` | Clears visit lock when leaving Safe Room |

Costs mirrored in `CombatEconomy.gearLevelUpCost` / `affixRerollCost` for sims.

---

## 4. Safe Rooms

### 4.1 Cadence (gear mode)

In `Game.advanceToNextRoom()`:

1. After a **non-safe** room where `roomNumber % 5 === 0` (5, 10, 15…) → `enteringSafeRoom = true` **without** incrementing.  
2. `generateRoom` forces `roomType = 'safe'` (overrides boss when both share a number).  
3. Leaving safe → `setInSafeRoom(false)`, clear flag, then `roomNumber++`.  

Room **0** tutorial exit is explicitly guarded so `0 % 5 === 0` does **not** open a Safe Room.

### 4.2 Visit state

`Game.inSafeRoom`, `enteringSafeRoom`, `setInSafeRoom` / `syncInSafeRoomFromCurrentRoom`, `Game.playerSafeRoomMeta` (MP map).

### 4.3 Room content (`js/level.js`)

- No enemies; starts cleared  
- Hub **1600×900**, cyan `safe` biome  
- Machines via `getSafeRoomMachines`: `gearUpgrade`, `affixReroll`, `healMaxHp`  
- Nexus music while inside  

### 4.4 Machines (`ui/components/safeRoomMenu.js`) - **Credits**

| Machine | Effect |
|---------|--------|
| **Gear Level Up** | Cost `floor(50 * 1.15^level) * levelUpCostMul`; +4% all stats; caps from meta |
| **Raise Rarity** | If `rarityMaxSteps > 0`; sets `rarityUpgradedThisVisit` (locks rerolls until next visit) |
| **Affix Reroll** | Cost `100 * rerollCostMul`; locks to first chosen index; up to `maxRerolls` |
| **Healer** | Free once/player; `baseMaxHp *= (1 + healBonusPct)` then full heal (base **30%**, meta up to **60%**) |

### 4.5 Pre-boss healer

Gear rooms **9, 19, 29…** get `room.preBossHealer` near the exit → appears and is usable only after the room is cleared (`doorOpen`) → interact once for **+25% max HP**.

---

## 5. Nexus Gear Upgrade Stations

### 5.1 Stations (`js/nexus.js` + `gearUpgradeMenu.js`)

| Station id | Purpose | Unlock gate (`getNexusMachineLock`) |
|------------|---------|--------------------------------------|
| `rarityChance` | Drop luck | Clear **Room 5** |
| `affixSlots` | Affix capacity | Defeat **Swarm King** |
| `safeRoomSystems` | Safe Room power | Defeat **Twin Prism** |
| `safeRoomEfficiency` | Credit discounts | Defeat **Fortress** |

Portal mode switcher refuses Card Mode. Progress recorded via `recordRoomCleared` / `recordBossDefeated`.

### 5.2 Shop catalog (shards)

#### Affix Capacity

| Id | Max | Effect / shop gates |
|----|-----|---------------------|
| `affixSlotsBasic` | 5 | Cap 1→2→3 |
| `affixSlotsAdvanced` | 5 | Cap 0→1→2; needs Basic ≥3 |
| `affixSlotsRare` | 5 | Cap 0→1→2; needs Advanced ≥3 |

#### Rarity Luck

| Id | Max | Multiplier / gates |
|----|-----|--------------------|
| `rarityChanceGreen` | 5 | ×(1 + 0.10·lvl) |
| `rarityChanceBlue` | 5 | ×(1 + 0.08·lvl); needs Green ≥3 |
| `rarityChancePurple` | 5 | ×(1 + 0.06·lvl); needs Blue ≥3 |
| `rarityChanceOrange` | 5 | ×(1 + 0.04·lvl); needs Purple ≥3 |

#### Safe Room Systems / Efficiency

Same as earlier pass: heal bonus, level-up/reroll caps, rarity forge +1/+2, and matching discounts (`−8%` level/rarity, `−10%` reroll).

---

## 6. Combat Economy

New module: `js/combat-economy.js` (`window.CombatEconomy`).

### 6.1 Kill payouts

| Source | Base | Decade bonus (`floor((room−1)/10)`) |
|--------|------|--------------------------------------|
| Enemy | 1 | +1 / decade |
| Star / Diamond | 2 | +1 / decade |
| Rectangle | 3 | +1 / decade |
| Octagon (elite) | 15 | +5 / decade |
| Boss | 50 | +15 / decade |

Examples: Elite @R1 = **15**, @R11 = **20**; Boss @R1 = **50**, @R11 = **65**.

### 6.2 Banking pipeline (`Game.awardRunCredits`)

1. Skip on MP clients / tutorial / room 0  
2. Apply Prism Tax `currencyBoost` at award time  
3. Increment `currencyEarned` + `currencyBankedThisRun`  
4. Solo: `SaveSystem.addCurrency` immediately  
5. MP host: bump living players’ `playerCurrencies` + `currency_update`  

`EnemyBase.awardDeathCredits()` / `BossBase.die()` call into this. Boss kills also `recordBossDefeated`.

### 6.3 End-of-run

`creditRewards()` is idempotent (`rewardsCredited`):

- **Shards** awarded here (gear: `floor(12·rooms + 2.4·kills + 1.2·lvl)`)  
- **Credits:** only remainder `currencyEarned − currencyBankedThisRun` (no double-pay)

### 6.4 Sim helpers

`estimateRoomCredits`, `expectedSpawnMix`, `classUpgradeCost`, `gearLevelUpCost`, `affixRerollCost`, `shardUpgradeCost`, `estimateShardsGear` - used by `economy-balance-sim.js` for affordability gates through room **50**.

---

## 7. Save Schema & Meta APIs

### 7.1 New / expanded fields

| Field | Purpose |
|-------|---------|
| `gearUpgrades: {}` | Affix caps, rarity luck, Safe Room Systems/Efficiency |
| `bossesDefeated: {}` | Unique boss names → nexus machine gates |
| `highestRoomCleared` | Room milestones (e.g. rarity machine @5) |
| `onboarding: {…}` | Coach steps, `tutorialVersion`, `room0TutorialDone`, `suspendedForMp` |
| `featureTutorials: { initialized, completed, toasted, queue }` | FIFO machine coaches |

`ONBOARDING_TUTORIAL_VERSION: 1` - stale `complete: true` with older/missing version **resets** onboarding once. Veterans finished on v1 without `room0TutorialDone` key are grandfathered past Room 0.

### 7.2 Key APIs

| Method | Role |
|--------|------|
| `get/setGearUpgrade`, `getSafeRoomMeta`, `getSafeRoomUpgradeBlob` | Gear meta |
| `recordBossDefeated`, `recordRoomCleared` | Progress gates |
| `hasDefeatedBossRequirement`, `hasClearedRoomRequirement` | Gate queries |
| `getNexusMachineLock(machineKey)` | Locked + hint |
| `getOnboarding` / `setOnboarding` | Coach persistence |
| `shouldShowUpdateModal` / `stampCurrentVersionIfNew` | Patch notes; skip modal on brand-new saves |

### 7.3 Compatibility

Card save fields retained but unused for power. No reverse card→gear migration.

---

## 8. Onboarding & Tutorials

Four new modules (load order in `index.html`):  
`coach-transition.js` → `onboarding.js` → `feature-tutorials.js` → `room0-tutorial.js`

### 8.1 Nexus coach - `Onboarding`

Forced once per save (version-gated). Steps:

```text
privacy → controls → selectClass → launchRun → (run / Room 0) → classUpgrades → complete
```

| Capability | Detail |
|------------|--------|
| `allowsInteraction(type)` | Hard-gates class / portal / upgrade / gearUpgrade / index / modeSwitcher |
| Spotlight + coach card | Canvas render; camera override |
| `suspendForMultiplayer` / `resumeFromMultiplayer` | Clears gates; persists `suspendedForMp` |
| `deferUpdateModal` | Patch notes wait until coaches idle |
| Forced privacy / controls | Close/Esc blocked; “Got it” on launch modal |

After class upgrades, handoff → `FeatureTutorials.continueFrom`.

### 8.2 Room 0 combat drill - `Room0Tutorial`

Solo, once-per-save (`shouldEnter` when `!room0TutorialDone`).

| Step | Behavior |
|------|----------|
| `dash` | Only dodge; cross dash line while dodging |
| `primary` / `heavy` / `special` | Hit frozen dummy (`isTutorialDummy`, `tutorialFrozen`) |
| `warning` | ~1.6s lockout |
| `kill` | Dummy unfrozen; defeat opens exit coach |
| `exit` | Spotlight on door; leaving calls `markDone()`, sets `roomNumber = 1` |

Arena: hand-built `type: 'tutorial'`, **1280×720**, no credits/shards/XP/loot. Combat gated via `getAllowedAction()` in `player-base.js`. Mobile HUD glow via `getHighlightControl()`.

### 8.3 Feature machine coaches - `FeatureTutorials`

Post-onboarding FIFO as machines unlock:

1. `rarityChance` (intro) - Room 5  
2. `affixSlots` (intro) - Swarm King  
3. `safeRoomSystems` (highlight) - Twin Prism  
4. `safeRoomEfficiency` (highlight) - Fortress  

Unlock mid-run → toast → queue. Nexus enter presents queue head. Only the spotlighted machine is interactable (`allowsInteraction('gearUpgrade', machineId)`).

### 8.4 Shared tween - `CoachTransition`

`TRANSITION_MS` 1100 + `ARM_PADDING_MS` 500; smoothstep spotlight AABB + camera nudge. Used by Onboarding and FeatureTutorials (not Room 0).

### 8.5 End-to-end first solo save

Privacy → Controls **Got it** → class pedestals spotlight → portal → **Room 0** → Nexus class upgrades → onboarding complete → feature coaches as unlocks happen → deferred update modal when idle.

---

## 9. Biome, Layout & Music

### 9.1 Biomes

- New `safe` biome (cyan neon tech)  
- `GEAR_PROGRESSIONS` bands end at **10 / 20 / 30 / 40 / 50** (swarm → prism → fortress → fractal → vortex)

### 9.2 Layout generator

Safe: fixed **1600×900**, open hub early-return. Also: pathfinding queue (`queuePathfinding` / `processPathfindingQueue` / `clearPathfindingQueue`), collision symmetry fixes, spawn scatter tweaks.

### 9.3 Music (`audio/music-config.json`, `music-manager.js`)

Retargeted for `/10` boss cadence through room 50:

- Cycle playlists repeat ~every 20 rooms (ranges extended through 31–49)  
- Boss keys at **10 / 20 / 30 / 40 / 50** (was 10/15/20/25/30)  
- Fallback cycle divisor **5 → 10**  

Room 0 has no dedicated track; falls through opening fallback.

---

## 10. Boss Cadence & Balance

### 10.1 Cadence - **reconciled**

| Layer | Value |
|-------|-------|
| `CombatScaling.GEAR_BOSS_INTERVAL` | **10** |
| `canonicalEndRoom` (gear) | **50** |
| `level.js` / `main.isBossRoom` | ≥10 && `% 10 === 0` |
| Biomes / music | Align to 10/20/30/40/50 |
| Pre-boss healer | 9, 19, 29… |
| Post-50 endless elites | Guaranteed mid-cycle at `r % 10 === 5` (55, 65…) |

Safe Rooms remain denser (every **5**). The earlier interval-5 vs level-/10 mismatch is fixed.

### 10.2 Scaling stretch (50-room run)

| Knob | Direction |
|------|-----------|
| Enemy HP/dmg growth | Softened (~0.058 / 0.085) |
| Boss HP/dmg growth | Softened (~0.052 / 0.080) |
| Tempo / mobility | Softened |
| Count cap room | Later (24); post-cap density +0.4/room |
| `EARLY_RUN_HP_BONUS` | Raised to **2.2** |
| Intelligence ramp | Full cog ~R30 (was ~R20) |
| Swarm King weights | **0.75 / 0.85** (was 0.88 / 0.90) |

---

## 11. Voxel Fracture VFX

`js/voxel-fracture.js` (~1827 lines).

### Design

- Per-entity `_voxelGrid` (12×12 normal / 16×16 boss); destroy caps ~45% / ~58%  
- Particle pool (chip / fluid / sprite chunk), max 512 (quality-scaled)  
- Settled debris on room-sized static canvas  
- Weapon archetypes: `pierce` / `magic` / `slash` / `blast`  
- Hit-pause freezes gameplay; particles keep updating  
- **Local cosmetic** in MP - clients reconstruct from damage/death events  

### Gaps (WIP)

- Boss punched-body rendering not fully wired (`renderVoxelDamage` unused on Swarm King / Fractal Core)  
- Phase peel does not permanently destroy boss cells  
- Corpse linger (`deathJuiceVisibleUntil`) effectively unused  

---

## 12. Enemy AI & Navigation

- Prefer pathfinding with no LOS; async path queue; look-ahead  
- `getInterceptTarget`, `getFlankSlot`  
- Basic surround / intercept; diamond orbit fallback fix; rectangle projectile dodge  
- Regular shapes render through `renderVoxelDamage` + damage flash  

---

## 13. Swarm King Reliability Pass

`boss-swarmking.js` phase-3 nest dash overhaul:

- Collision-resolved dashes; wall hit aborts with slam FX (no snap-teleport)  
- Web trails as **visited-point polylines**  
- Nest targeting rewritten with walkable samples + route retries  
- Combat: dash **pushes player only**, then walkable clamp  

---

## 14. Combat / Rewards / Player Loop

| Change | Detail |
|--------|--------|
| Default mode | `'gear'` |
| Hit pause | ~45ms cap; VFX continues |
| Level-up heal | **+50% max HP** (was full) |
| Credits | Mid-run bank via CombatEconomy (§6) |
| Shards | End-of-run; gear-boosted formula |
| Tutorial clear | No rewards |

Heal stack: pre-boss +25% · Safe healer maxHP amplify · level-up +50%.

---

## 15. Multiplayer

- Join/start paths force gear mode  
- `safeRoomMeta` sync (client Map + server pass-through)  
- Gear payload includes craft progress fields  
- Fracture not networked  
- Host awards credits; clients skip `awardRunCredits`  
- Onboarding suspend/resume around MP sessions  

---

## 16. Input & UX Polish

- `_getMappedGamepad` for non-standard layouts; Steam family matches `hori`  
- Dynamic gamepad hot-swap to pad with active input  
- Combat prompts / mobile glow for Room 0  
- Launch modal: forced onboarding controls step (“Got it”)  
- Privacy modal: forced during onboarding privacy step  
- Update modal deferred until coaches idle; brand-new saves skip patch notes (`stampCurrentVersionIfNew`)  

---

## 17. Tests & npm Scripts

| File | Coverage |
|------|----------|
| `tests/combat-economy.test.js` | Tier table, decade bumps, first-safe affordability |
| `tests/economy-balance-sim.js` | Full run to R50 gate checks (`npm run balance:economy`) |
| `tests/run-credits.test.js` | Mid-run banking / Prism Tax / no double-pay |
| `tests/safe-room-meta.test.js` | Meta clamps, rarity raise, visit locks |
| `tests/onboarding.test.js` | Coach steps / gates (no npm script yet) |
| `tests/room0-tutorial.test.js` | Drill steps (no npm script yet) |
| `tests/feature-tutorials.test.js` | Queue / unlock handoff (`npm run test:feature-tutorials`) |
| `tests/room-layout-generator.test.js` | Safe 1600×900; biomes at 20/40/50; bosses 10/30/40/50 |
| `tests/navigation.test.js` | Collision + path queue |
| `tests/full-run-balance-sim.js` / `balance-runtime.js` | Interval 10, end 50 |

**Added scripts:** `balance:economy`, `test:run-credits`, `test:combat-economy`, `test:feature-tutorials`.

---

## 18. File Inventory

### Diff summary (vs `HEAD`, 2026-07-14 evening)

| Bucket | Count |
|--------|------:|
| Tracked paths changed | 72 |
| Lines inserted (tracked) | **+3,779** |
| Lines deleted (tracked) | **−13,694** |
| Net (tracked) | **−9,915** |
| Whole files deleted | 25 · **−9,726** |
| Untracked new LOC (excl. this doc) | **~7,200** |

### Added (untracked)

| Path | ~Lines | Role |
|------|--------|------|
| `js/voxel-fracture.js` | 1827 | Fracture VFX |
| `js/combat-economy.js` | 171 | Credit formulas + sim helpers |
| `js/onboarding.js` | 607 | Nexus first-run coach |
| `js/room0-tutorial.js` | 676 | Combat tutorial room |
| `js/feature-tutorials.js` | 516 | Machine unlock coaches |
| `js/coach-transition.js` | 116 | Spotlight tween |
| `ui/components/gearUpgradeMenu.js` | 654 | Nexus shard shop |
| `ui/components/safeRoomMenu.js` | 812 | In-run machines |
| `tests/*` (7 new) | ~1800 | Economy / tutorial coverage |
| `docs/gear-mode-safe-rooms-update.md` | ~600 | This document |

### Deleted (whole files, −9,726)

`js/cards/*` (13), `js/doors/selection-doors.js`, `js/ui-character-sheet.js`, `deckBuilder`, `deckUpgradeMenu`, `handHUD`, `masterySystem`, `mulligan`, `roomModifierSelection`, `swapPreview`, `doorOptions`, `upgradeSelection`, `doorModifierSelection`.

### Modified hotspots

`index.html`, `package.json`, `main.js`, `save.js`, `gear.js`, `nexus.js`, `level.js`, `biomes.js`, `combat-scaling.js`, `combat.js`, enemies/bosses, `render.js`, `room-layout-generator.js`, `multiplayer.js`, `mp-server-worker.js`, `input.js`, `ui.js`, `music-manager.js`, `audio/music-config.json`, `launchModal.js`, `privacyModal.js`, `controllerNavigation.js`, `characterSheet.js`, `indexMachine.js`, balance tests.

---

## 19. Known Incomplete Migrations

1. ~~Dead card runtime still referenced (`DeckState`, `CardPacks`, door UIs, etc.).~~ **Done (2026-07-14)** - door UIs / `selection-doors` deleted; combat/players/main stripped; Index card tabs removed.  
2. ~~Mode switcher / `gameMode || 'cards'` fallbacks.~~ **Done** - portal locked to Gear; defaults now `'gear'`.  
3. Save shard field still named `cardShards` / `getCardShards` (currency live; rename TBD). Card deck/unlock/mastery fields removed.  
4. Boss voxel punched bodies unfinished; corpse linger unused.  
5. No npm scripts for `onboarding` / `room0-tutorial` tests.  
6. `feature-tutorials.test.js` duplicates one describe block.  
7. Opening music ranges start at room 1 - room 0 relies on fallback.  
8. Label debt: some station interaction labels still generic. UI shard labels mostly say “Shards”.  
9. `depth: intro|highlight` only changes copy, not presentation.  
10. Harmless leftover: `nextRoomModifiers.currencyBoost` “Prism Tax” hooks (never set without cards; kept for tests).  

---

## 20. Player-Facing Changelog Draft

### Removed
- Card Mode, decks, hands, mulligans, mastery, ground cards, team/curse cards, room-mod collection station  

### Added
- Safe Rooms every 5 rooms (heal, level-up, reroll, rarity forge with unlocks)  
- Nexus Gear Upgrades with progress-gated machines  
- Mid-run credit drops from every enemy (scales every 10 rooms)  
- First-run Nexus coach + Room 0 combat tutorial + unlock coaches for new machines  
- Pre-boss healers · Voxel fracture hit/death VFX  

### Changed
- Always Gear Mode · Bosses every **10** rooms through **50** · Softer long-run growth · Swarm King nerfed · Level-ups restore half max HP · Safer Swarm King dash · Gamepad hot-swap  

### Meta tip
Clear Room 5 to unlock Rarity Luck; beat bosses to open Affix / Safe Room stations. Banked credits fund class upgrades and Safe Room crafting; shards buy permanent drop luck and Safe Room power.

---

## Appendix A - Example run tempo (gear)

```text
Room 0     (first save only) combat tutorial → Nexus
Room 1–4   combat
Room 5     combat → Safe Room → unlock Rarity Chance machine → 6
Room 6–8   combat
Room 9     combat + Pre-Boss Healer
Room 10    Swarm King → Safe Room → unlock Affix Capacity → 11
…
Room 20    Twin Prism → Safe Room → unlock Safe Room Systems → 21
Room 30    Fortress → Safe Room → unlock Safe Room Efficiency → 31
Room 40 / 50  remaining cycle bosses
```

## Appendix B - Relationship to prior docs

- [`local-changes-summary.md`](./local-changes-summary.md) - Jul 3 foundation (arenas, fortify, profiler, early boss nav).  
- **This document** - Jul 14 gear pivot + economy + onboarding + fracture (living WIP summary).

# Local Changes Summary

> **Superseded for the Jul 14 WIP:** see [`gear-mode-safe-rooms-update.md`](./gear-mode-safe-rooms-update.md) for the current living summary (gear pivot, Safe Rooms, combat economy, onboarding/Room 0, voxel fracture, reconciled 50-room boss cadence).  
> This file remains as the **2026-07-03 foundation** snapshot (procedural arenas, fortify, profiler, early boss nav).

> Updated: 2026-07-03 (evening pass); banner refreshed 2026-07-14  
> Branch: `main` (working tree uncommitted as of Jul 14 afternoon)  
> Current tracked diff scale (Jul 14): ~58 paths · **+3,736 / −8,679** + 16 untracked modules/tests/docs

---

## Git Status at a Glance (Jul 3 snapshot - historical)

| Layer | Status |
|-------|--------|
| **Staged** | Nothing |
| **Committed (unpushed)** | `246e96d` - *hold for changes* (47 files, +4440 / −1219) |
| **Unstaged** | 47 modified files (+16,196 / −4,153 lines) |
| **Untracked** | 19 files |
| **Deleted (unstaged)** | `docs/lore-specification.md` |

**Jul 3 headline:** A major overhaul - procedural route-based combat arenas, unified combat scaling, full enemy/boss navigation, five reworked bosses, **sustain/lifesteal rebalance**, **fortify shields**, **run-length performance profiler**, **gear render optimization**, adaptive render quality, and expanded narrative docs.

**Jul 14 add-on headline:** Card Mode excised; Gear Mode + Safe Rooms + mid-run credit economy + first-run onboarding/Room 0 + feature tutors + voxel fracture. Details in [`gear-mode-safe-rooms-update.md`](./gear-mode-safe-rooms-update.md).
---

## 1. Committed but Unpushed (`246e96d`)

Landed before the room/boss work. Focus: **input, UI, telemetry**.

- Full gamepad support + `src/ui/core/controllerNavigation.js` (DOM focus nav, platform button glyphs)
- Touch controls refactor, CSS/SCSS overhaul, mobile UI component updates
- Nexus flow, telemetry schema, metrics GUI, multiplayer baseline serialization

---

## 2. Procedural Room & Biome System

Rooms are **generated combat arenas** with obstacles, semantic roads, landmarks, and biome-specific scenery.

### New Files

| File | Lines | Role |
|------|-------|------|
| `src/js/biomes.js` | ~190 | Biome defs, gear vs cards progression |
| `src/js/room-layout-generator.js` | **~3078** | Full layout pipeline |
| `src/js/device-detection.js` | ~260 | Layered mobile/desktop detection |

### Layout Pipeline Highlights

**Biome strategies:** cellular (swarm), prefab (prism), BSP (fortress), recursive (fractal), radial (vortex), hybrid (endless).

**Room archetypes:** `road`, `gauntlet`, `maze`, `arena`, `crossroads`, `wilds`, `boss`.

**Entrance variants:** `leftRight`, `topBottom`, `diagonalTopLeft` - scales travel axis per variant.

**Semantic road system:**
- Main road polyline with room-number-scaled travel length
- Offshoot pockets, detours, crossroads splits, gauntlet chokes
- Playability validation, spawn protection, trail markers
- Per-boss arena generators + boss safety carving

**Route-based enemy spawning** (`buildRouteSpawnGroups` in `level.js`):
- Enemy pockets along main road and offshoots
- Respects spawn protection distance
- Falls back to walkable-aware group scatter

**Collision & pathfinding:**
- `canTraverseBetweenCells`, `findPath`, `findUnstuckPosition`
- Inset obstacle corners (visual radius vs full cell)
- Serialize/hydrate + hash for multiplayer sync
- Decorations/fixtures regenerate deterministically from compact layout data (no serialization bloat)

**Tests:** `room-layout-generator.test.js` - **24/24 pass** (doubled since earlier pass).

### Biome Progression

| Mode | Boss-room cadence | Biome transitions |
|------|-------------------|-------------------|
| Gear | Every 5 rooms from 10 | Swarm → Prism → Fortress → Fractal → Vortex |
| Cards | Rooms 12, 22, 32 | Swarm → Fortress → Vortex |

---

## 3. Enemy & Boss Navigation

### Enemy Base (`enemy-base.js`, ~4090 lines)

- Obstacle-aware movement: `tryMoveBy`, circle collision resolution
- Grid pathfinding fallback with repath timers and unstuck retreat
- `isNavigationPathPractical` - rejects bad paths
- `getObstacleAwareHeading` - local steering + wall-follow

### Boss Base (`boss-base.js`, ~1123 lines)

- `getNavigationRadius()` / `getPathfindingRadius()` - wider clearance than trash
- `findSafeBossPosition()`, `moveTowardPoint()`
- Arena anchor cache for scenery-based attack positioning

**Tests:** `navigation.test.js` - **5/5 pass** (added blocked-cell radius test).

---

## 4. Universal Combat Scaling

Centralized in `src/js/combat-scaling.js` (~1077 lines).

- Two-phase: `computeScalingFactors(ctx)` → `resolveEntityStats(profileId, config, factors)`
- Stat groups: durability, offense, mobility, tempo (inverse divisor), cognition, density, XP
- Pre-boss buildup, difficulty presets, gear vs cards multiplayer tables
- Boss scaling profiles; `boss-scaling.js` is a shim

**Tests:** `combat-scaling.test.js` - **8/8 pass**.

---

## 5. Sustain & Lifesteal Rework - **IMPLEMENTED**

Previously blocked; now fully wired in `src/js/combat.js` (+380 lines in diff).

### Lifesteal (`LIFESTEAL_CONFIG`)
- Per-second heal cap: ~1.0–1.2% max HP/sec (flat, not scaling with lifesteal %)
- Soft cap at 5% lifesteal stat - excess at 35% efficiency (11% gear → ~7.1% effective)
- Boss heal multiplier: 30%
- Source multipliers: melee 1.0, hammer 1.0, shout 0.5, whirlwind 0.15, beam 0.30, projectile 0.85, etc.
- Per-swing proc dedup via `beginLifestealAttackSwing()` + `registerSustainProc()`
- Projectile batch dedup for multishot

### Fortify (`FORTIFY_CONFIG`) - **NEW**
- Damage dealt converts to temporary shield (fortify percent stat)
- Max pool: 10% max HP; max gain: 1.2% max HP/sec
- Boss gain multiplier: 40%
- Shield decays over time; absorbs damage before HP

### Gear tuning
- Affix lifesteal range: 2–7% (was 3–10%)
- Legendary vampiric: 6% (was 8%)

**Tests:** `lifesteal.test.js` - **9/9 pass** (added soft-cap and whirlwind reduction tests).

---

## 6. Boss Reworks

| Boss | Diff | Highlights |
|------|------|------------|
| **Vortex** | +4895 | 14 attack types, state machine, phase 3 finale, full audio suite |
| **Twin Prism** | +1623 | Phase 3 dash/merge, projectile windups, refraction rendering |
| **Swarm King** | +1323 | Phase 2 swarm rhythm, phase 3 pheromone dash/web trails |
| **Fractal Core** | +317 | Layout anchors, phase tuning |
| **Fortress** | +276 | Lane waves, crossover rotation |

### Combat Integration
- Multi-part collision bodies, weak point hits, beam hit testing
- `applyLifesteal`, `applyFortifyGain`, `applyHammerHeal`, `applyLifeOnCritHeal`

**Tests:** `fortress-boss.test.js` - **2/2 pass**, `pheromone-arc.test.js` - **4/4 pass**.

---

## 7. Rendering & Performance

### Adaptive Render Quality (`main.js`)

Three-tier frame budget governor (2-second rolling window):

| Tier | Trigger | Degradations |
|------|---------|--------------|
| **Heavy** | frame >34ms or render >28ms | vignette 0.25×, 36 scenery lights, 24 gear ring points, no animated loot rings, simplified remote players, 4 beam lights, 0.5× damage FX |
| **Medium** | frame >30ms or render >22ms | vignette 0.33×, 64 lights, 32 ring points, no animated rings, 4 beam lights, 0.75× damage FX |
| **Normal** | frame <24ms and render <17ms | Full quality restored |

### Gear Render Optimization (`gear.js`, +529 lines)

- **Sprite baking cache** (128 entries): pre-rendered gear drops by tier/slot/affix key
- **Camera culling**: `isGroundGearVisible()` - only draw in-view loot
- `renderGroundLoot(ctx, visibleLoot)` - accepts pre-culled list
- Deterministic `phaseOffset` from gear ID for desynced pulse animation
- Affix ring point count scales with quality tier

### Ground Loot/Cards/Items Culling
- `renderGroundCards(ctx, visibleCards)` - optional visible subset
- `renderGroundItems(ctx, visibleItems)` - same pattern
- `buildFrameRenderLists()` in main.js builds per-frame visible lists

### Room Render Caches (`render.js`, +2289 lines)
- Static scene + light canvases, blocked runs, swarm hive clusters
- Scenery fixtures with light emitters (budget-capped)
- Biome patterns: triangle, rings; faint grid motifs

### Engine Hardening
- Accumulator truncation on >100ms spikes (spiral-of-death prevention)
- Projectile object pool
- Chromatic trauma screen effect
- Render sub-timings: groundLoot, gearRings, remotePlayers, worldGlow, worldBodies

**Tests:** `gear-render-opt.test.js` - **2/2 pass** (cache key order-independence, legendary/class flags).

---

## 8. Run Performance Profiler - **NEW**

`src/js/run-profiler.js` (~549 lines) - samples across a full run for export and analysis.

### Features
- Reservoir sampling for frame/process/update/render phase timings
- Per-room stats: type, biome, duration, spike counts
- Quality tier tracking (normal/medium/heavy)
- Scene counts: enemies, projectiles, ground loot/cards/items visible vs total
- Sub-timings: groundLoot, gearRings, remotePlayers
- Room transition timing
- Phase ranking (identifies worst render phases)
- Worst-room report (top 8 by render p95)
- JSON export via debug panel

### Integration
- Auto-start on run (toggle in debug panel)
- Records every frame when active; marks room enter/transition
- Captures profile on return to Nexus
- Loaded in `index.html` before `debug.js`

**Tests:** `run-profiler.test.js` - **2/2 pass**.

### Debug Panel Additions (`debug.js`, +361 lines)
- Run profiler start/stop/export buttons + status readout
- Render timing checkbox (`DebugFlags.RENDER_TIMING`)
- Phase breakdown UI (update, static, world, vignette, postFx, UI, groundLoot, gearRings)
- Frame budget averages
- Combat scaling live readout
- `ROOM_LAYOUT` overlay toggle
- Gear flood cheat for render perf testing

---

## 9. Multiplayer

- Host serializes `roomLayout` on room transition; clients hydrate + spawn from host zone
- Loot drops repositioned to walkable points
- Extended projectile serialization (trail, wave params)
- Layout hash mismatch warning

---

## 10. Server Hardening (`static-server.js`)

Dev server now has path traversal protection:
- Allowlist: root files (`index.html`, `privacy.html`) + directories (`css`, `js`, `ui`, `audio`)
- Rejects `..`, dotfiles, null bytes
- Resolved path must stay within project root
- Added MIME types for audio, images, source maps

---

## 11. Documentation

| File | Change |
|------|--------|
| `docs/lore.md` | Full **Ending Design Document v1.0** (~1628 lines) |
| `docs/lore-specification.md` | **Deleted** |
| `docs/card-system-design-spec.md` | Memory fragments, legendary flavor, story-only cards |
| `README.md`, `src/js/version.js`, `privacy.html`, `metrics/gui/public/app.js` | Typography cleanup (em-dash → hyphen) |

---

## 12. Tests & Balance Tooling

### npm Scripts
```
balance:gear          → gear-mode balance sim
balance:full-run      → full-run balance sim
test:combat-scaling   → 8 tests
test:device-detection → 8 tests
```

### Test Results (current)

| Suite | Pass | Fail |
|-------|------|------|
| `combat-scaling.test.js` | 8 | 0 |
| `device-detection.test.js` | 8 | 0 |
| `room-layout-generator.test.js` | 24 | 0 |
| `navigation.test.js` | 5 | 0 |
| `lifesteal.test.js` | 9 | 0 |
| `pheromone-arc.test.js` | 4 | 0 |
| `fortress-boss.test.js` | 2 | 0 |
| `run-profiler.test.js` | 2 | 0 |
| `gear-render-opt.test.js` | 2 | 0 |
| `telemetry-client.test.js` | 2 | 0 |
| `damage-numbers.test.js` | 0 | **1** (missing `puppeteer`) |
| **Total** | **66** | **1** |

### Balance Simulations
- `tests/lib/balance-runtime.js` - VM loader for live game scripts
- `gear-mode-balance-sim.js`, `full-run-balance-sim.js`

---

## 13. Overall Game Status

### Playable / Integrated
- Procedural biomes with route-based combat arenas and archetype variety
- Route spawn groups, full enemy/boss navigation
- All five bosses with expanded kits (Vortex rewritten)
- Unified combat scaling
- **Lifesteal sustain + fortify shields** - implemented and tested
- Adaptive render quality under load
- Gear sprite cache + loot culling
- Run-length performance profiler
- Multiplayer layout sync
- Hardened dev server
- Gamepad + mobile UI (unpushed commit)

### Known Gaps
1. **Nothing committed** for room/boss/scaling/sustain/perf work - all in working tree
2. **Manual QA needed** - boss encounters, biome transitions, render perf under heavy loot, multiplayer sync
3. **Narrative design ahead of code** - ending doc and card memory fragments are design-only
4. **Puppeteer not installed** - damage-numbers browser test can't run locally

### Suggested Manual QA
- [ ] Cards run: biomes at 12/22/32; route spawn pockets
- [ ] Gear run: biomes at 10/15/20/25/30
- [ ] Archetype variety: gauntlet, maze, crossroads, wilds
- [ ] Entrance variants: left/right, top/bottom, diagonal
- [ ] Lifesteal: verify cap feel, boss reduction, whirlwind reduction in combat
- [ ] Fortify: shield buildup and decay under sustained damage
- [ ] Performance: flood room with gear (debug cheat), confirm adaptive quality kicks in
- [ ] Run profiler: full run → export JSON → inspect worst rooms/phases
- [ ] Each boss in biome arena - especially Vortex phase 3
- [ ] Multiplayer: 2+ clients, room transition, identical layouts

---

## 14. File Inventory

### Modified (47)
`README.md`, `docs/card-system-design-spec.md`, `docs/lore.md`, `index.html`, `src/js/audio.js`, `src/js/bosses/*` (6), `src/js/cards/ground-cards.js`, `src/js/cards/ground.js`, `src/js/cards/player-cards.js`, `src/js/combat.js`, `src/js/debug.js`, `src/js/doors/selection-doors.js`, `src/js/enemies/*` (5), `src/js/gear.js`, `src/js/input.js`, `src/js/items/item-ground.js`, `src/js/items/item-pylon.js`, `src/js/level.js`, `src/js/main.js`, `src/js/multiplayer.js`, `src/js/players/*` (5), `src/js/render.js`, `src/js/touch-controls.js`, `src/js/ui.js`, `src/js/version.js`, `metrics/gui/public/app.js`, `package.json`, `privacy.html`, `server.js`, `src/ui/components/characterSheet.js`, `src/ui/components/hud.js`, `src/ui/components/roomAndLevel.js`

### Deleted (1)
`docs/lore-specification.md`

### New / Untracked (19)
`docs/local-changes-summary.md`, `src/js/biomes.js`, `src/js/bosses/boss-scaling.js`, `src/js/bosses/pheromone-polyline.js`, `src/js/combat-scaling.js`, `src/js/device-detection.js`, `src/js/room-layout-generator.js`, `src/js/run-profiler.js`, `tests/combat-scaling.test.js`, `tests/device-detection.test.js`, `tests/fortress-boss.test.js`, `tests/full-run-balance-sim.js`, `tests/gear-mode-balance-sim.js`, `tests/gear-render-opt.test.js`, `tests/lib/balance-runtime.js`, `tests/lifesteal.test.js`, `tests/navigation.test.js`, `tests/pheromone-arc.test.js`, `tests/room-layout-generator.test.js`, `tests/run-profiler.test.js`

### Already Committed, Unpushed (47 files - see §1)
Gamepad, touch controls, CSS, nexus, telemetry, metrics GUI, controller navigation.

---

## Changes Since Previous Summary (same day, earlier pass)

| Area | Before | Now |
|------|--------|-----|
| Modified files | 44 (+14,339 lines) | **47 (+16,196 lines)** |
| **Lifesteal sustain** | Not implemented, 7 tests failing | **Fully implemented, 9/9 pass** |
| **Fortify shields** | Not mentioned | New damage-to-shield system |
| **Run profiler** | Did not exist | `run-profiler.js` + debug panel + 2 tests |
| **Gear rendering** | Per-frame draw everything | Sprite cache, culling, quality-tier ring points |
| **Render quality** | Basic vignette/light cap | 3-tier governor (normal/medium/heavy) with 7+ degradation knobs |
| **Ground loot/cards/items** | Draw all | Per-frame visible-list culling |
| **Server** | Basic static file serve | Path traversal protection + MIME expansion |
| **Layout tests** | 12 pass | **24 pass** (serialization, regeneration, route spawns, playability) |
| **Navigation tests** | 4 pass | **5 pass** (inset collision radius) |
| **Total tests** | 52 pass / 8 fail | **66 pass / 1 fail** (puppeteer only) |
| `room-layout-generator.js` | ~3007 lines | **~3078 lines** |
| `main.js` diff | +923 lines | **+1739 lines** |
| `gear.js` diff | +4 lines | **+529 lines** |
| `combat.js` diff | +99 lines | **+380 lines** |
| `debug.js` diff | +81 lines | **+361 lines** |

---

## Summary in One Paragraph

Local work transforms Shape Slayer from flat arenas into **biome-themed procedural combat routes** with archetypes, entrance variants, obstacle collision, route-based enemy pockets, and full navigation for enemies and bosses. A **unified combat scaling system** drives difficulty; all five bosses have massively expanded kits (Vortex essentially rewritten). **Lifesteal sustain is rebalanced and implemented** - per-second caps, soft-cap diminishing returns, source multipliers, per-swing dedup - alongside a new **fortify shield** mechanic. **Performance work** adds adaptive three-tier render quality, gear sprite caching with camera culling, and a **run-length profiler** for identifying worst rooms and render phases. Multiplayer syncs room layouts host-to-client; the dev server is hardened against path traversal. An unpushed commit adds gamepad and mobile UI polish. **66 of 67 tests pass**; the sole failure is a Puppeteer dependency for browser integration tests. The game is feature-rich and dev-playable but entirely uncommitted - needs hands-on QA before release.

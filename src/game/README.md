# Shape Slayer game packages

Reusable Shape Slayer pieces built on [`src/engine/`](../engine/). Modes under [`src/modes/`](../modes/) are **Creative Islands**: they assemble packages, attach Rules to `GameBus`, and own win/loss/progression.

```text
browser APIs  <-  src/engine  <-  src/game packages (HOW)  <-  src/modes/* (WHY)
```

## Island contract

| Piece | Role |
| --- | --- |
| Packages | HOW — damage, projectiles, rooms, FX (no XP/score/advance policy) |
| [`GameBus`](game-bus.js) | Discrete state transitions only (`combat:enemyKilled`, `rooms:cleared`, `combat:playerDied`, `run:exitRequested`). **Synchronous** emit. No per-tick damage events. |
| [`ModeProfile`](mode-profile.js) | Parameters packages may read (`hud`, `room.doors`, …) |
| [`PlayingHost`](playing-host.js) | Binds profile + Rules; **always tears down** previous Island listeners |
| Mode Rules | WHY — listen on GameBus, call package verbs (`GameKillRewards`, `GameRoomClear`) |

## Registry

[`packages.js`](packages.js) publishes `GamePackages`:

| API | Role |
| --- | --- |
| `GamePackages.Packages` | Frozen package map (`combat`, `entities`, `rooms`, …) |
| `GamePackages.list()` / `get(id)` | Enumerate / lookup |
| `GamePackages.resolveScripts(ids)` | Deduped script paths |
| `GamePackages.attach(world)` | Facades: `Combat`, `Rooms`, `Bus`, … |

[`world-context.js`](world-context.js) publishes `GameWorld.resolveWorld(explicit)`.

## Nexus / takeover

Modes register into [`GameModeCatalog`](mode-catalog.js). [`mode-takeover.js`](mode-takeover.js) parks Nexus state for embedded Islands. HUD visibility follows `modeProfile.hud === 'gear'` during playing Islands (not a blanket `SESSION` hide).

## Packages

| Id | Owns |
| --- | --- |
| `combat` | Hit resolution, scaling, kill-reward **verbs** |
| `entities` | Players, enemies, bosses, items |
| `rooms` | Layouts, doors, clear **emit** + clear-effect verbs |
| `telegraph` | Attack telegraphs |
| `content` | Biomes, gear, loot, feats, save helpers |
| `presentation` | Shared draw/FX helpers |
| `audio` | GameAudio / GameMusic facades |
| `net` | MP client (optional) |
| `world` | World helpers, GameBus, PlayingHost, takeover |

Game packages must **not** import `src/modes/`. Modes own scene/state machines and product shell wiring.

## Architectural & Performance Guidelines

When modifying game packages, follow these guidelines to keep combat smooth, state deterministic, and rendering lightweight:

1. **Keep Packages Agnostic of Modes:** Game packages define *capabilities* (how to apply damage, how to generate a room layout, how to draw a player), never *policies* (when a run succeeds, whether sandbox spawns are infinite). Policies belong in `src/modes/` rules.
2. **Synchronous Discrete GameBus:** Use `GameBus` strictly for discrete milestone events (`rooms:cleared`, `combat:playerDied`, `combat:enemyKilled`). Never emit tick-level data or per-frame metrics on the bus to avoid performance degradation.
3. **Optimized Save & Load System:** `SaveSystem` handles serialization to `localStorage`. Use granular updates (e.g., when meta machines consume credits/shards) rather than dump-saving every frame.
4. **Voxel Fracture & Presentation Performance:** FX layers (like voxel disintegrations and fluid particles) are built using pre-warmed pools. Prefer reuse of existing particle vertices over instantiating fresh objects in render loops.
5. **Responsive and Focus-Aware UI:** DOM UI mounts (like the HUD, character sheet, and Safe Room machines) must track PWA sizing adjustments dynamically. Never read DOM dimensions per frame; hook into resize events and update rendering cameras/viewports accordingly.

# Shape Engine

Canvas 2D backed procedural game engine. Classic scripts, no bundler, no WASM.

Covers seeded generation and sim (`Engine.Proc`, `Engine.Physics`, fixed-step `Engine.Core`) and the Canvas 2D / DOM stack that draws and takes input (`Engine.Render`, Graphics, FX, Input, UI). Both halves are the engine.

Version **0.2a** (`Engine.VERSION`). Shape Slayer game packages live in `src/game/`; modes in `src/modes/` consume those packages.

```text
browser APIs  <-  src/engine  <-  src/game  <-  src/modes
```

Engine code cannot import `src/game/` or `src/modes/`, name Shape Slayer stuff (bosses, gear, biomes, Nexus, class kits), or own game save schemas. `tests/directory-boundaries.test.js` watches for that.

Game/mode docs: [repo README](../../README.md), [`src/game/README.md`](../game/README.md), [`src/modes/README.md`](../modes/README.md). This file is just the engine.

## Modules

| Namespace | Files | What it does |
| --- | --- | --- |
| `Engine.Proc` | `proc.js`, `proc-worker.js` | Seeded RNG, noise, grids, pathfinding, collision, marching squares, polylines; optional worker grid synth (`dispatchWorkerTask`) |
| `Engine.Physics` | `physics.js` | Impulse accumulator, geometry helpers, `SpatialHash` for nearby queries |
| `Engine.Core` | `loop.js` | Fixed timestep + frame budget / quality governor (`onQualityChange`, rings into Audio) |
| `Engine.Net` | `net.js` | Clone / diff / interpolate (for syncing state, not the MP relay) |
| `Engine.Boot` | `boot.js`, `ui/boot-screen.js`, `ui/boot-cinematic.js` | Probe, init canvas/UI/save, cover, handoff |
| `Engine.System` | `system.js` | Device / form-factor detection |
| `Engine.Input` | `input.js`, `touch.js` | Keyboard, mouse, pads, touch seats, raw hardware |
| `Engine.Split` | `split.js` | Local split viewports (2 seats for now) |
| `Engine.Graphics` | `graphics.js` | `createCanvas`, Canvas pool, `Text` (setFont / measureText), neon helpers, patterns, DPR |
| `Engine.Render` | `render-host.js`, `render-pipeline.js` | Canvas host, named targets, stage pipe (+ stageMeta for Debug) |
| `Engine.Renderer` / `Engine.FX` | `renderer.js`, `fx.js`, `camera.js` | Shake, particles, light masks, post FX, camera |
| `Engine.Audio` / `Engine.Music` | `audio.js`, `music.js` | Procedural SFX bits + playlist transport; `Audio.setQualityTier` |
| `Engine.Save` | `save.js` | Versioned stores, migrations, storage |
| `Engine.UI` | `ui/*` | Root, bus, modal stack, toasts |
| `Engine.Director` | `director.js` | Spawn-point queries for playable regions (walkability, avoidance, ring preference, cluster spacing) |
| `Engine.SDLGameControllerDB` | `sdl-gamecontrollerdb.js` | SDL gamepad database parser and remapping layer to standard W3C Gamepad layout |
| `Engine.Shell` | `shell.js` | Feature flags, back-nav guard |
| `Engine.Profiler` | `profiler.js` | Frame / phase timing |
| `Engine.Debug` | `debug.js` | Optional debug shell; sections, metrics, pipeline profile / snapshots / bag explorer |

Boot **requires**: `System`, `Save`, `Physics`, `Proc`, `Graphics`, `FX`, `Render`, `Core`, `Audio`, `Input`, `Net`, `Shell`, `UI`.

Optional for verify: `Music`, `Split`, `Profiler`, `Debug`, `Camera` (`Engine.Camera`), touch helpers next to Input.

## Core Subsystems

### 🌲 Procedural Generation & Breakup (`Engine.Proc`)
Handles seeded generation, mathematical helpers, and voxel-fracture decomposition without external libraries:
* **Seeded RNG & Noise (`Proc.Rng`, `Proc.Noise`):** A custom Linear Congruential Generator / Xorshift seeding mechanism paired with Perlin and 2D Simplex noise functions for deterministic biomes, layouts, and properties.
* **Contours & Marching Squares (`Proc.MarchingSquares`):** Extracts exact vector outlines and polylines from raw grid cells to construct solid wall boundaries.
* **Connected Component BFS (`Proc.VoxelIslands`):** Performs connected-component analysis on 2D boolean masks. To eliminate Garbage Collection spikes during execution, it runs BFS sweeps using static, pre-allocated typed arrays (`_bfsQueue` and `_visited`). It includes boundary tracing (`traceIslandBoundary`) to compute vertices of detached voxel islands.
* **Voxel Disintegration (`Proc.VoxelDisintegration`):** A multi-variable stress engine that decomposes destroyed voxel bodies into physics-enabled shards:
  * *Stress Score:* Calculated via `computeStressScore` using the attack's damage ratio, strike location relative to entity center, attack archetype (e.g., slash, crush, beam, bleed), and material multipliers.
  * *Mass Partitioning:* `partitionVoxelMass` clusters the voxel grid into shards across five tiers: `slab` (size $\ge$ 12), `large` (7–11), `medium` (4–6), `small` (2–3), and `voxel` crumbs. 
  * *Complexity Caps:* Island polylines are automatically simplified to a maximum of 16 vertices (32 floats) to match `ShardPool` buffer constraints and keep rendering lightweight.

### 🧮 Physics & Spatial Queries (`Engine.Physics`)
An impulse-based simulation engine equipped with accelerated neighborhood lookups:
* **Fixed-Step Integrator (`ImpulsePhysics`):** Manages basic linear and angular equations of motion, drag coefficients, and elastic circle/wall collisions.
* **Spatial Hash Grid (`Physics.SpatialHash`):** Accelerates target detection and collision checks.
  * *Fast Keys:* Custom integer hashing (`(cx & 0xFFFF) | ((cy & 0xFFFF) << 16)`) avoids string concatenation in table lookups.
  * *Double-Query Gate:* Increments a global query ID on each search to bypass items already queried, preventing duplicates.
  * *Zero Allocation:* Supports passing a pre-allocated `outResults` array to `queryRadius` to bypass memory allocation during hot loops.
* **Lever-Arm & Peel Physics (`RigidDebris`):** Computes complex shard behavior after structural breaks:
  * *Impact Torque:* `computeImpactTorque` calculates the rotational force applied by strikes based on contact point lever arms relative to the shard center of mass.
  * *Centroid Peeling:* `computeIslandPhysics` resolves velocities by mixing linear impact vectors, radial center-outward peeling thrusts, and tangential torque, ensuring pieces fly apart realistically depending on where the strike landed.

### Workers

Workers are fine for heavy jobs (optical flow, edge detect, big typed-array passes, fat diffs) so the main loop keeps its budget. They are not required.

If something can run on a Worker, the **same engine file** needs a sync main-thread fallback that does the same work. Probe picks Worker when it can, otherwise falls back (`file://`, no Workers, no SharedArrayBuffer, etc.). Do not assume a second thread exists.

Concrete today:
- `Proc.dispatchWorkerTask('GENERATE_GRID', …)` spins `src/engine/proc-worker.js` when Workers exist, otherwise runs the same grid fill/smooth on the main thread and invokes the callback.
- `particle-worker.js` handles off-thread particle simulation and rendering using `OffscreenCanvas` and `SharedArrayBuffer` typed array buffers for high-density particle FX.

New Worker script (or module that owns Worker + fallback)? Put every URL it needs in:

1. host HTML / `new Worker('...')` path
2. `sw.js` `PRECACHE_URLS` (worker entry + imports)
3. `tests/directory-boundaries.test.js` required-file list

PWA/offline only gets what the SW cached. Miss a worker URL and offline testing blows up even if online looked fine.

## Boot

Engine scripts load first. `boot.js` shows the boot cover at parse time so you do not flash a naked page.

| Call | When |
| --- | --- |
| `Engine.Boot.start(options)` | Full branded boot (what Shape Slayer uses). Promise of `runtime`. App starts under the cover, then `handoff`. |
| `Engine.Boot.initialize(options)` | Sync init only (smokes / custom hosts). Still sets `Engine.Boot.runtime`. You call `handoff` when ready. |

```text
parse: BootScreen.show
  -> start() or initialize()
  -> app wires up under cover
  -> Engine.Boot.handoff()
  -> cover gone
```

1. `probe` / `verify`: Canvas2D, rAF, `performance.now`, required namespaces. Missing storage or AudioContext is degraded, not fatal.
2. `initialize`: `Engine.Render.configureCanvas`, warm `CanvasPool`, UI root + shell flags, freeze `Engine.Boot.runtime`.
3. Your app: settings, input map, render recipe, Core, etc. still under the cover.
4. `handoff`: wait a couple rAFs (timeout fallback), fade cover, cleanup. Safe to call twice.

### `Engine.Boot.runtime`

Frozen after a good init:

| Field | What |
| --- | --- |
| `ok`, `status`, `fatal`, `warnings` | `ready` / `degraded` / `fatal` |
| `canvas`, `ctx` | Use these, not another `getElementById` |
| `dpr`, `logicalW`, `logicalH` | Size + DPR from configure time |
| `pixelWidth`, `pixelHeight` | Backing store (`logical * dpr`) |
| `uiRoot`, `poolWarmed`, `reducedMotion` | Shell / pool / reduced motion |
| `createCore(hooks)` | Same as `new Engine.Core(hooks)` |

Do not read `canvas.clientWidth` / `clientHeight` in `onRender` (or any per-frame path). That triggers layout.

`runtime.logicalW` / `logicalH` / `dpr` are a snapshot from boot. They do not update later. Resize is **your** job:

1. Listen to `resize` / `visualViewport` / orientation (rAF-coalesce; Safari toolbar spam is real).
2. Pick the new logical size however you want.
3. Call `Engine.Render.configureCanvas(canvas, { logicalW, logicalH, dprCap })` once per settled resize.
4. Stash `{ ctx, dpr, logicalW, logicalH }` on your own locals (Shape Slayer: `game.config.width/height`, `game.dpr`, `game.ctx`).
5. Cameras and draw paths use those locals. Not live DOM reads.

Engine gives you `configureCanvas`. It does not listen for resize or rewrite frozen `runtime`.

Shape Slayer: `Boot.start` -> `Engine.Core` -> `Boot.handoff` (`src/game/main.js`). Later resizes go through `setupResponsiveCanvas()` -> `configureCanvas`.

## Performance Strategy & Perf Rules

Act like GC will ruin your day. If the frame rate drops below budget, the engine should dynamically adapt to keep the gameplay smooth.

### Performance Strategy
1. **Zero-Allocation Hot Paths (GC Avoidance):** No fresh allocations inside tick loops. Reuse structures, pass pre-allocated scratch objects, and cache resources.
2. **Fixed Timestep Accumulator:** The physics and simulation loops run at a deterministic 60 Hz independent of frame rate. If frames drop, a catch-up accumulator keeps game time running linearly without causing temporal jitter or stutters.
3. **Adaptive Quality Tiering:** When active frame budgets degrade, the core loop signals an adaptive tier shift (`Normal`, `Medium`, `Heavy`). This automatically shuts down expensive aesthetic features (like scenery lighting, vignette overlays, and ring particle count) to maintain frame budget.
4. **Viewport Culling:** Only items and entities visible in the active viewport cameras are dispatched to draw buffers.
5. **Pattern & Sprite Caching:** Draw floor grids and complex sprite geometries (such as high-rarity gear models) to offline cached canvases once, then blit them instead of performing raw pathing calls per frame.

### Concrete Rules
- **Prefer CanvasPool:** Use `Engine.Graphics.createCanvas(w, h)` and `CanvasPool` acquire/release over `document.createElement('canvas')` for offscreen draws.
- **Typed Arrays:** Hot paths use fixed-capacity typed arrays. Grow them rarely and never in tick hooks.
- **Scratch & Out References:** No fresh `{}` / `[]` / throwaway closures in `onUpdate`, `onRender`, stage `draw()`, or physics loops. Use scratch variables or pass optional `out` arguments so callers can reuse references.
- **No DOM Queries While Drawing:** Do not perform reads on DOM layouts or viewport bounds while rendering. Cache sizes in resize handlers or use boot-time `runtime` values.
- **Avoid Array Copying:** Prefer mutation over functional methods like `map`, `filter`, or `concat` in the hot frame loop.

Allocate on boot, resize, and rare mode changes. That is it.

## Coding & Typing Requirements

Keep the client runtime dependency-free, robust, and readable.

1. **Vanilla JS & Classic Scripts:** No bundler, no transpilation, no client build steps. Everything must run directly in standard browser execution contexts.
2. **Strict Boundary Enforcements:** Engine code lives in `src/engine/` and must remain completely agnostic of game concepts (no mentioning bosses, gear, Nexus, or lobbies). Game packages consume engine APIs; modes consume game packages. Enforced via `tests/directory-boundaries.test.js`.
3. **JSDoc Type Safety:** We do not write TypeScript, so IDE autocomplete and code contract safety are backed by rich JSDoc typing. All public APIs, parameters, return values, and configuration shapes must be fully documented using `@typedef`, `@property`, `@param`, and `@returns`.
4. **Worker Parallelism with Sync Fallbacks:** Heavy asynchronous workflows (like procedural generation) can utilize Web Workers, but they must implement a synchronous main-thread fallback for environments running on restrictive protocols (like local `file://` shells).
5. **Autoplay & Audio Lifecycle:** Device audio context hooks must respect browser permissions and resume automatically on user interaction triggers. Autoplay restrictions are handled by the engine initialization layer; game code should not replicate this logic.

## Boundaries

### Input / touch / pointer

| Piece | Job |
| --- | --- |
| `Engine.Input` | Hardware: keyboard, mouse, Pointer (desktop aim/click), TouchEvents for on-canvas sticks/buttons, gamepads, split seats. Switches source (`keyboardMouse` / `touch` / `gamepad`). |
| `Engine.Touch` (`touch.js`) | Widgets only: `VirtualJoystick`, `TouchButton`, theme/hooks/haptics. `Input.initTouchControls` builds these. |
| Game (`GameInput`, mobile layout, DOM overlays) | Action names, class control types, extra DOM chrome. |

`isMobileUiMode()` means "show mobile chrome" (sticks / HUD), from `controlMode` + `Engine.System`. It is not a seat. Local split clears touch; touch is never a co-op seat. Multitouch uses `activeTouches` + per-control `touchId`. Pointer is desktop (and audio unlock), not the stick path.

Do not put game ability names in `input.js`.

### Audio / music

Engine owns oscillators, buses, playlist load/fade/duck, and autoplay unlock. On load it tries `AudioContext`; one-shot `pointerdown` / `touchstart` / `mousedown` / `click` / `keydown` call `init` / `resume`. Play helpers call `resume` too. Game does not need its own unlock code. Core quality governor can call `Audio.setQualityTier(tier)` when adaptive quality is on.

Game binds settings and owns cues / playlists (`src/game/audio/` in Shape Slayer). Optional: listen for `audiocontextresume` if you want to start music the instant unlock lands.

### Render pipeline

Engine: named targets (`main`, pooled `world`, ...) and the ordered stage runner. Stages clean up their own Canvas2D state; the runner does not wrap every draw in `save`/`restore`. When Debug profile/snapshot is on, the runner records `stageMeta` (target id/size, ctx snapshot) with each stage.

Game: stage order and draw bodies. Shape Slayer keeps all state recipes in `src/game/presentation/render-pipeline.js` (TITLE, NEXUS, ENTERING_ROOM, PLAYING, PAUSED). `main.js` runs them via pipeline runners; call `cleanupAllStateTargets(game)` on teardown/resize so pooled offscreens release.

### Saves

`Engine.Save` is envelope + migration runner, not your schema:

- storage (`localStorage` or memory fallback)
- `{ schemaVersion, data }`
- migrations run `fromVersion -> schemaVersion` one step at a time (missing step throws)
- defaults merge on load; flat legacy JSON comes in via `legacyVersion` (usually 0)

Game owns key name, `SCHEMA_VERSION`, defaults, and what each migration does to fields. Shape Slayer `SaveSystem` uses store `shapeSlayerSave`, schema 1, migration 1 = wrap old flat JSON. Engine has no idea what a shard is.

## Script order

Copy the engine block from `index.html`:

1. `utils` -> System -> Save -> Physics -> Proc (`proc.js`; worker `proc-worker.js` is loaded on demand, not as a classic script tag)
2. Graphics -> FX -> render host -> render pipeline -> camera -> Core (`loop.js`) -> renderer -> profiler -> **debug** (optional)
3. Audio -> Music -> touch -> Input -> Split -> Net -> Shell
4. Engine UI (bus, root, modal stack, toast, boot cinematic/screen) -> `Engine.Boot`
5. Your game scripts (skip for a bare smoke)

Load `debug.js` after `profiler.js` and the render pipeline when you want the shell. Omit it for shipping; Core, Render, and game bridges no-op when `Engine.Debug` is missing. Optional for boot verify (same as Profiler).

New engine file or Worker asset: update HTML (if classic-script), `sw.js` precache, and boundary tests.

## `Engine.Core` hooks

```js
new Engine.Core({
  onInit,                 // once at start()
  onUpdate(dt),           // fixed 1/60 step, seconds
  onRender(ctx, alpha),   // alpha = interp; Core passes ctx as null today, use runtime.ctx
  onHitPauseTick(dt),     // while hit-pause freezes sim
  onFrameEnd(metrics),
  onVisibilityChange(hidden),
  onQualityChange(tier, frameBudget),
  preferBackgroundTimeout(), // true => setTimeout loop when tab hidden (e.g. MP lobby)
  adaptiveRenderQuality      // default true
});
```

Prefer `runtime.createCore(hooks)` after boot. `core.start()` / `core.stop()`.

## Smoke test (no Shape Slayer)

You do not need `src/game/`. Paste the engine scripts from `index.html` through `boot.js`, then:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Engine smoke</title>
  <style>
    html, body { margin: 0; height: 100%; background: #111; overflow: hidden; }
    #gameCanvas { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <canvas id="gameCanvas"></canvas>
  <div id="ui-root"></div>

  <!-- full engine script list from index.html (utils.js through boot.js) -->

  <script>
    (function () {
      const runtime = Engine.Boot.initialize({
        canvasId: 'gameCanvas',
        logicalW: 1280,
        logicalH: 720
      });
      if (!runtime.ok) {
        console.error('Engine boot failed', runtime.fatal);
        return;
      }

      // use runtime sizes; not canvas.clientWidth in onRender
      const { ctx, dpr, logicalW, logicalH } = runtime;
      let t = 0;

      const core = runtime.createCore({
        onUpdate(dt) { t += dt; },
        onRender(_ctx, _alpha) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(0, 0, logicalW, logicalH);
          ctx.fillStyle = '#7fdbff';
          ctx.beginPath();
          ctx.arc(
            logicalW * 0.5 + Math.cos(t) * 80,
            logicalH * 0.5 + Math.sin(t) * 50,
            24, 0, Math.PI * 2
          );
          ctx.fill();
        }
      });

      core.start();
      Engine.Boot.handoff();
    })();
  </script>
</body>
</html>
```

- `initialize` + `handoff` skips the branded `start()` timeline. Fine for hacking. Full cover: `await Engine.Boot.start({...})`, start Core, then `handoff` (Shape Slayer path).
- Serve over HTTP (`npm start` or any static server at repo root) so audio / workers / SW behave.
- Pass `logicalW` / `logicalH` if you care; otherwise boot reads client size once at init.

Next steps for a real game: Render pipeline stages, Input -> your action map, Audio/Music + settings, Save stores with your schema. `src/game/main.js` is the reference consumer, not engine code.

## Game boot sketch

```js
const runtime = await Engine.Boot.start({
  canvasId: 'gameCanvas',
  logicalW: 1280,
  logicalH: 720
});
if (!runtime.ok) {
  // Boot.start may already have shown the error UI
  return;
}

const core = runtime.createCore({
  onInit() { /* setup */ },
  onUpdate(dt) { /* sim */ },
  onRender(_ctx, alpha) {
    // runtime.ctx, logicalW, logicalH, dpr
  }
});
core.start();
Engine.Boot.handoff();
```

## Tests

```bash
npm test
# or:
node --test tests/engine-boot.test.js
node --test tests/engine-core-kit.test.js
node --test tests/engine-render-pipeline.test.js
node --test tests/engine-debug.test.js
node --test tests/engine-split.test.js
node --test tests/engine-music.test.js
node --test tests/engine-fx-save-ui.test.js
node --test tests/engine-physics-geometry.test.js
node --test tests/engine-net-serialize.test.js
node --test tests/engine-proc.test.js
node --test tests/engine-loop-timing.test.js
node --test tests/directory-boundaries.test.js
node --test tests/game-engine-wiring.test.js
```

## Debug (`Engine.Debug`)

Optional. Not required by boot. File: `debug.js`. Load after `profiler.js` / render pipeline in `index.html` when you want it. Omit for shipping; Core, Render, and game bridges check `Engine.Debug` before use and no-op when it is missing. Optional for boot verify (same as Profiler).

Shape Slayer `simulation/debug.js` soft-skips panel registration when the shell is absent. Console helpers like `dropGear` still work.

Core does not call Debug. The game bridges it:

```js
// onFrameEnd (game):
// breakdown = { update, render, static, world, ... ms } - same coarse shape Engine.Profiler samples
if (Engine.Debug) Engine.Debug.update(deltaTime, processTime, breakdown);

// onUpdate (game):
if (Engine.Debug && Engine.Debug.frozen) return;
```

### UI

- Ctrl+D / `toggle()` / `show()` / `hide()`
- Home lists sections (built-in Performance, Pipeline, plus game `registerSection`s)
- Drill in with back/home; Performance uses nested folders
- Mount once on navigate; patch bound text on a ~200ms tick. Never rebuild the whole panel every frame
- Section hooks take `dbg` (metrics / flags / pipeline / history frame), never Canvas2D `ctx`

### Flags (`Engine.Debug.flags`)

Engine seeds: `USE_CACHING`, `ADAPTIVE_RENDER_QUALITY`, `RENDER_TIMING`, `PIPE_SNAPSHOT`.

Games call `flags.register(name, default)`. Property access plus `enable` / `disable`. Shape Slayer aliases this as `DebugFlags`.

### Collection gates

| API | When true |
| --- | --- |
| `shouldCollect()` | Panel visible, or `RENDER_TIMING`, or any `addCollector(fn)` |
| `wantsProfile(id)` | That pipeline has profile attached |
| `wantsSnapshot(id)` / `shouldSnapshot(id)` | Global `PIPE_SNAPSHOT`, or that pipeline has snapshot attached |

### Pipelines

Register once, toggle attach later:

```js
// After boot / when the recipe exists:
Engine.Debug.registerPipeline('playing', pipeline, { label: 'PLAYING' });
Engine.Debug.refresh(); // remount registry UI if the panel is already open

// Frame host (every playing frame):
profileStages: Engine.Debug.wantsProfile('playing'),
debugPipelineId: 'playing',

// Panel -> Pipeline checkboxes, or console:
Engine.Debug.attach('playing', { profile: true, snapshot: true });
Engine.Debug.detach('playing');           // both off
Engine.Debug.detach('playing', 'profile'); // one side
Engine.Debug.viewPipeline('playing');
Engine.Debug.listPipelines();
```

`viewPipeline(id)` auto-attaches profile + snapshot if both were off (so opening a pipe from the panel actually records). Prefer `registerPipeline` over ad-hoc `bindPipeline`.

The runner sets `Engine.Debug.setActivePipelineId(frame.debugPipelineId)` and only records bag summaries / stage hooks when profile or snapshot is on. Stage hooks receive optional `stageMeta` from the runner.

### Game injection

- `registerSection({ id, title, order, mount(root), update(dbg), visible?(dbg), hint? })`
- `registerMetricGroup({ id, label, order, rows })` - optional breakdown labels
- `registerRunProfile({ getAutoStart, setAutoStart, onStart, onStop, onExport, getStatus })`

### Pipe diagnosis

- `trace(key, value)` / `captureSnapshot(stageId, label, data)` - values go through `sanitizeDebugValue` (no live entity refs in history)
- History ring (default 60): `setHistorySize(n)` / `getHistory()`
- Scrubbing: history pin keeps a stable frame while the ring shifts; eviction pauses while the cursor is scrubbing so the frame under inspection does not disappear
- Pipeline panel: scrubber, nested stage list by target, stage detail (incl. `stageMeta`), bag explorer (filter keys / copy JSON / log), frame diff
- `breakWhen(fn | { stageId, test })` sets `frozen = true` and pins the frame (`setBreakMode('break'|'log')`, `unfreeze()`, `clearBreaks()`)

### Shell / update

- `init()` creates the DOM (games usually call via `DebugPanel.init()` on load)
- `update(deltaTime, processTime, breakdown)` samples metrics; DOM patch only when visible (throttled)

## Not doing (yet)

- Bundler / TypeScript emit / publishing the engine as its own npm package
- Requiring WASM or Workers (optional Workers ok if the same file has a sync fallback)
- Shape Slayer content (lobbies, gear, rooms)

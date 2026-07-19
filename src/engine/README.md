# Shape Engine

Canvas 2D backed procedural game engine. Classic scripts, no bundler, no WASM.

Covers seeded generation and sim (`Engine.Proc`, `Engine.Physics`, fixed-step `Engine.Core`) and the Canvas 2D / DOM stack that draws and takes input (`Engine.Render`, Graphics, FX, Input, UI). Both halves are the engine.

Version **0.1a** (`Engine.VERSION`). Shape Slayer is the first game on it.

```text
browser APIs  <-  src/engine  <-  src/game
```

Engine code cannot import `src/game/`, name Shape Slayer stuff (bosses, gear, biomes, Nexus, class kits), or own game save schemas. `tests/directory-boundaries.test.js` watches for that.

Game docs: [repo README](../../README.md). This file is just the engine.

## Modules

| Namespace | Files | What it does |
| --- | --- | --- |
| `Engine.Proc` | `proc.js` | Seeded RNG, noise, grids, pathfinding, collision, marching squares, polylines |
| `Engine.Physics` | `physics.js` | Impulse accumulator + geometry helpers |
| `Engine.Core` | `loop.js` | Fixed timestep + frame budget / quality governor |
| `Engine.Net` | `net.js` | Clone / diff / interpolate (for syncing state, not the MP relay) |
| `Engine.Boot` | `boot.js`, `ui/boot-screen.js`, `ui/boot-cinematic.js` | Probe, init canvas/UI/save, cover, handoff |
| `Engine.System` | `system.js` | Device / form-factor detection |
| `Engine.Input` | `input.js`, `touch.js` | Keyboard, mouse, pads, touch seats, raw hardware |
| `Engine.Split` | `split.js` | Local split viewports (2 seats for now) |
| `Engine.Graphics` | `graphics.js` | Canvas pool, neon helpers, patterns, DPR |
| `Engine.Render` | `render-host.js`, `render-pipeline.js` | Canvas host, named targets, stage pipe |
| `Engine.Renderer` / `Engine.FX` | `renderer.js`, `fx.js`, `camera.js` | Shake, particles, light masks, post FX, camera |
| `Engine.Audio` / `Engine.Music` | `audio.js`, `music.js` | Procedural SFX bits + playlist transport |
| `Engine.Save` | `save.js` | Versioned stores, migrations, storage |
| `Engine.UI` | `ui/*` | Root, bus, modal stack, toasts |
| `Engine.Shell` | `shell.js` | Feature flags, back-nav guard |
| `Engine.Profiler` | `profiler.js` | Frame / phase timing |

Boot **requires**: `System`, `Save`, `Physics`, `Proc`, `Graphics`, `FX`, `Render`, `Core`, `Audio`, `Input`, `Net`, `Shell`, `UI`.

Optional for verify: `Music`, `Split`, `Profiler`, `Camera` (`Engine.Camera`), touch helpers next to Input.

### Workers

Workers are fine for heavy jobs (optical flow, edge detect, big typed-array passes, fat diffs) so the main loop keeps its budget. They are not required.

If something can run on a Worker, the **same engine file** needs a sync main-thread fallback that does the same work. Probe picks Worker when it can, otherwise falls back (`file://`, no Workers, no SharedArrayBuffer, etc.). Do not assume a second thread exists.

New Worker script (or module that owns Worker + fallback)? Put every URL it needs in:

1. host HTML / `new Worker('...')` path
2. `sw.js` `PRECACHE_URLS` (worker entry + imports)
3. `tests/directory-boundaries.test.js`

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

## Perf rules

Act like GC will ruin your day.

- `Engine.Graphics.CanvasPool`: acquire/release. Do not `createElement('canvas')` every frame.
- Hot paths: fixed-capacity typed arrays. Grow rarely, not per tick.
- No fresh `{}` / `[]` / throwaway closures in `onUpdate`, `onRender`, stage `draw()`, input poll, physics integrate. Scratch objects, pooled slots.
- No DOM size reads while rendering. Resize handler only. Use your cached viewport (or boot `runtime.*` if you never resize).
- Prefer mutate over `map` / `filter` / `concat` in the frame loop.

Allocate on boot, resize, and rare mode changes. That is it.

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

Engine owns oscillators, buses, playlist load/fade/duck, and autoplay unlock. On load it tries `AudioContext`; one-shot `pointerdown` / `touchstart` / `mousedown` / `click` / `keydown` call `init` / `resume`. Play helpers call `resume` too. Game does not need its own unlock code.

Game binds settings and owns cues / playlists (`src/game/audio/` in Shape Slayer). Optional: listen for `audiocontextresume` if you want to start music the instant unlock lands.

### Render pipeline

Engine: named targets (`main`, pooled `world`, ...) and the ordered stage runner. Stages clean up their own Canvas2D state; the runner does not wrap every draw in `save`/`restore`.

Game: stage order and draw bodies. Shape Slayer PLAYING recipe: `src/game/presentation/render-pipeline.js`.

### Saves

`Engine.Save` is envelope + migration runner, not your schema:

- storage (`localStorage` or memory fallback)
- `{ schemaVersion, data }`
- migrations run `fromVersion -> schemaVersion` one step at a time (missing step throws)
- defaults merge on load; flat legacy JSON comes in via `legacyVersion` (usually 0)

Game owns key name, `SCHEMA_VERSION`, defaults, and what each migration does to fields. Shape Slayer `SaveSystem` uses store `shapeSlayerSave`, schema 1, migration 1 = wrap old flat JSON. Engine has no idea what a shard is.

## Script order

Copy the engine block from `index.html`:

1. `utils` -> System -> Save -> Physics -> Proc
2. Graphics -> FX -> render host -> render pipeline -> camera -> Core (`loop.js`) -> renderer -> profiler
3. Audio -> Music -> touch -> Input -> Split -> Net -> Shell
4. Engine UI (bus, root, modal stack, toast, boot cinematic/screen) -> `Engine.Boot`
5. Your game scripts (skip for a bare smoke)

New engine file or Worker asset: update HTML, `sw.js` precache, and boundary tests.

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

## Not doing (yet)

- Bundler / TypeScript emit / publishing the engine as its own npm package
- Requiring WASM or Workers (optional Workers ok if the same file has a sync fallback)
- Shape Slayer content (lobbies, gear, rooms)
`)
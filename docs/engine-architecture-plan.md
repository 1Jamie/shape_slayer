# Shape Slayer Engine Architecture Plan

(to clarify these are just rough design ideas, may never actually happen, might just be pipe dream)


> **Status:** Proposed architecture and migration contract  
> **Scope:** Browser client runtime, engine/game separation, shared-memory execution, adaptive scaling  
> **Companion specification:** [`virtual-pipeline-isa.md`](./virtual-pipeline-isa.md)

## 1. Purpose

Shape Slayer will evolve from a single-threaded, globally coupled Canvas 2D game into a reusable engine plus a game package. The target resembles an asymmetric processor:

- the main thread acts as the orchestration core;
- VU0 and VU1 act as independently scheduled numeric execution units;
- a shared memory hub carries fixed-layout state, commands, results, and metrics;
- the renderer consumes snapshots without owning simulation;
- a performance governor selects the execution and quality policy for the device.

This is an incremental migration. Existing gameplay, multiplayer, and the fixed-step loop must remain usable throughout the work.

## 2. Non-negotiable constraints

1. **Native web platform only.** Runtime code remains ordinary JavaScript using browser APIs.
2. **No WASM, Emscripten, bundler, transpiler, or generated binary.**
3. **No required dependency installation or build command.**
4. **Classic-script boot remains supported.** Loading `index.html` remains the application entry point.
5. **Single-thread fallback is mandatory.** The same job and pipeline contracts must execute without `SharedArrayBuffer`.
6. **Multiplayer remains operational during migration.**
7. **Game content must not become an engine dependency.**
8. **Performance claims require measurements on representative devices.**

### 2.1 Direct-file and served modes

“Open `index.html` and run” describes the packaging contract: source files are directly executable and require no compilation. It does not mean every browser exposes every capability to a `file://` page.

- **Direct-file mode:** inline execution is the guaranteed fallback. Worker and service-worker behavior varies by browser.
- **Served compatibility mode:** ordinary Workers may be used when supported.
- **Served shared-memory mode:** `SharedArrayBuffer` requires a cross-origin-isolated page, normally delivered with COOP and COEP headers.

The engine must detect the mode at runtime and select a valid executor without failing startup.

## 3. Current baseline

The current client is approximately 98,000 lines of JavaScript across `src/js` and `src/ui`. Its core characteristics are:

- a fixed 60 Hz simulation loop in `src/js/main.js`;
- Canvas 2D rendering on the main thread;
- classic scripts loaded in dependency order;
- mutable class instances and normal JavaScript arrays as canonical world state;
- global coordination through `Game`, `currentRoom`, `Input`, and other shared names;
- host-authoritative multiplayer that serializes and clones object graphs;
- adaptive rendering based on a rolling frame budget;
- no gameplay Worker, `SharedArrayBuffer`, `Atomics`, or true `OffscreenCanvas` path.

Useful foundations already exist:

- fixed-timestep simulation and catch-up control;
- render quality tiers and Gecko-specific policy;
- run profiling and frame-phase measurements;
- typed-array particle storage in `src/js/voxel-fracture.js`;
- isolated helpers such as impulse physics, interpolation, and combat scaling.

## 4. Target boundaries

```text
src/
  engine/
    boot/              capability probe and runtime selection
    loop/              fixed timestep and frame scheduling
    memory/            hub, arenas, views, allocators, snapshots
    jobs/              queues, executors, scheduler, worker protocol
    pipeline/          Virtual Pipeline declarations and assembler
    performance/       metrics, budgets, quality policy
    presentation/      canvas host and render-facing snapshots
    input/             device sampling, not game action semantics
  game/
    simulation/        world update and game rules
    combat/            damage, effects, authority rules
    entities/          players, enemies, bosses, projectiles
    content/           rooms, biomes, items, progression
    presentation/      Shape Slayer-specific draw adapters and UI models
    networking/        game snapshot/event schema
```

The physical move can happen gradually. The dependency direction is the important rule:

```text
browser APIs <- engine <- game
                       <- Shape Slayer presentation
                       <- Shape Slayer networking
```

The engine may define generic lane schemas, job APIs, timing, memory, and rendering hosts. It must not know boss classes, gear affixes, room progression, or Shape Slayer reward rules.

## 5. Runtime roles

### 5.1 Main thread: orchestration core

The main thread owns:

- browser event and input sampling;
- DOM UI and accessibility;
- audio policy;
- frame scheduling and presentation;
- pipeline registration and startup assembly;
- worker lifecycle and job dispatch;
- performance policy;
- game state transitions that are not numeric batch work.

It should not remain the automatic owner of every simulation calculation.

### 5.2 VU0: streaming simulation unit

VU0 is optimized for dense, regular, high-volume work:

- voxel particle integration;
- particle lifetime, damping, and masks;
- simple broadphase or transform batches;
- other homogeneous VFX kernels.

Voxel particles are the first migration target because their numeric state already uses typed-array structure-of-arrays storage.

### 5.3 VU1: irregular batch unit

VU1 is optimized for bounded batch jobs that are less regular but separable from frame orchestration:

- pathfinding batches;
- navigation-field work;
- room-layout numeric passes;
- visibility or spatial-query batches.

VU1 does not initially own boss decisions, combat ordering, rewards, or multiplayer authority.

### 5.4 Presentation unit

Canvas 2D stays on the main thread initially. Rendering consumes stable snapshots or read-only views and must not mutate simulation state. `OffscreenCanvas` is a later native-web option, not a prerequisite.

## 6. Data and control planes

### 6.1 Shared memory hub

When available, one `SharedArrayBuffer` is partitioned into explicit regions:

1. hub header and version information;
2. atomic control words;
3. command ring;
4. result ring;
5. metrics counters;
6. lane arenas;
7. scratch arenas;
8. active-index lists and render snapshots.

The exact word-level ABI is defined in [`virtual-pipeline-isa.md`](./virtual-pipeline-isa.md).

### 6.2 Ownership instead of broad locking

Atomic operations coordinate ownership, sequence numbers, and publication. They are not used for every floating-point field.

- One execution unit owns writes to a lane range during a job.
- Readers consume a published generation or snapshot.
- Command and result records use atomic state transitions.
- Worker timeouts cause the scheduler to discard an unpublished generation.
- Stable entity handles prevent stale references from silently addressing reused slots.

This avoids turning the shared buffer into a lock-heavy global object.

### 6.3 Fallback memory

The same region schema can be backed by:

- `SharedArrayBuffer` in isolated shared-memory mode;
- `ArrayBuffer` plus transferable messages in Worker compatibility mode;
- `ArrayBuffer` with inline execution in direct-file or constrained mode.

Game code consumes typed views and job APIs, not the backing-buffer type.

## 7. Virtual Pipeline model

Game authors compose VU0 and VU1 pipelines from a small RISC-like stage vocabulary. Declarations are registered as plain JavaScript during script loading and assembled once at game start.

```text
register declarations
  -> validate opcodes, operands, memory bindings, and unit compatibility
  -> encode immutable pipeline metadata
  -> assemble a specialized JavaScript runner in each execution context
  -> execute lane batches through that runner every tick
```

Pipelines are not rebuilt per frame or per entity. The performance governor may select among pre-assembled variants.

Compiled JavaScript functions are not transferable through `postMessage`. The main thread sends the validated declaration or encoded pipeline image to each Worker; each Worker assembles its own equivalent runner during initialization.

The ISA, binary format, assembler modes, author API, and hot-path emission rules (`Math.fround`, signed-32 index shaping, cache-line alignment, dense flag planes, branchless compact, monomorphic kernel arguments) are defined in [`virtual-pipeline-isa.md`](./virtual-pipeline-isa.md) §10.4.

## 8. Capability and execution tiers

The capability probe records signals but does not trust hardware labels alone:

- `navigator.hardwareConcurrency`;
- `navigator.deviceMemory` where exposed;
- `crossOriginIsolated`;
- `SharedArrayBuffer`, Worker, and Atomics availability;
- browser engine and form factor;
- startup benchmark;
- rolling frame, update, render, queue, and worker timings;
- missed deadlines and accumulator truncation.

The initial execution tiers are:

| Tier | Executor | Intended use |
|------|----------|--------------|
| Inline | Main-thread typed-array runner | Direct-file, old browsers, low-core devices, fallback |
| Worker-copy | Worker with transferable `ArrayBuffer` jobs | Worker-capable but not cross-origin isolated |
| Shared VU | VU0/VU1 Workers over SAB regions | Isolated modern browsers with measured headroom |

Hardware concurrency is a ceiling, not a worker-count instruction. Start conservatively and increase only after measurements show a benefit.

## 9. Adaptive scheduling and degradation

The performance governor expands beyond render quality. It controls:

- active executor tier;
- number of Workers;
- lane batch size;
- per-frame job budget;
- VU0 and VU1 deadlines;
- pre-assembled pipeline variant;
- particle and effect caps;
- AI or navigation update cadence;
- render detail and DPR.

Policy must use hysteresis to avoid oscillating:

1. sustained pressure demotes optional work first;
2. missed Worker deadlines reduce batch size or switch a pipeline variant;
3. continued pressure reduces worker count or falls back inline;
4. recovery requires a longer stable window than degradation;
5. authoritative simulation correctness is never traded for visual quality.

Old devices should perform less optional work, not repeatedly attempt high-end work and stall.

## 10. Simulation and multiplayer contract

The engine split must preserve deterministic ordering where game rules depend on it.

- Input is sampled and converted into a fixed-tick command.
- The game owns authoritative rule order.
- VU jobs receive bounded numeric work and publish results before a defined barrier.
- Late optional jobs may be dropped; late authoritative jobs must use the fallback path.
- Multiplayer snapshots gradually move from deep object serialization to stable lane views plus an event stream.
- Networking never reads a partially published generation.

Combat remains on the game orchestration path until ordering, event emission, and authority semantics have explicit tests.

## 11. Migration phases

### Phase 1: structural engine seam

- Introduce `src/engine` and `src/game` boundaries.
- Extract the fixed-timestep loop and frame-budget governor.
- Add a capability probe and inline `JobSystem`.
- Add `registerPipeline` and `assembleVuPipelines` declaration validation.
- Add boundary tests.
- Add feature-flagged COOP/COEP headers to the static server.

No gameplay behavior, Worker execution, or canonical state changes in this phase.

### Phase 2: performance control plane

- Measure startup capability and sustained runtime pressure.
- Add execution-tier policy and worker-count policy.
- Extend quality policy to simulation and VFX budgets.
- Record queue depth, deadline misses, and worker utilization.

### Phase 3: typed memory bridge

- Introduce stable entity handles and lane allocation.
- Mirror selected hot fields into typed lane storage.
- Establish explicit ownership and snapshot publication.
- Keep object instances as compatibility facades while migration proceeds.

### Phase 4: VU0

- Bind the voxel particle numeric core to a lane arena.
- Assemble the first author-declared VU0 pipeline.
- Run it inline and in a Worker using the same ABI.
- Add shared-memory mode after isolation and fallback tests pass.

### Phase 5: VU1 and scheduler

- Add pathfinding/navigation pipeline families.
- Introduce VU0/VU1 job priorities and deadlines.
- Scale Workers dynamically based on measured throughput.
- Keep a synchronous path for authoritative jobs.

### Phase 6: deeper extraction

- Move broadphase and other proven batch systems.
- Replace multiplayer object-graph cloning incrementally.
- Consider `OffscreenCanvas` only after simulation and data ownership are stable.
- Move combat only if profiling and correctness tests justify it.

## 12. Verification strategy

### 12.1 Correctness

- Inline and Worker executors must produce equivalent results for the same pipeline image.
- Pipeline assembly rejects unknown opcodes, invalid offsets, incompatible units, and out-of-range lanes.
- Stable handles reject stale generations.
- Publication tests prove readers cannot observe half-written snapshots.
- Fixed-tick and multiplayer tests remain green throughout migration.

### 12.2 Performance

Each migrated kernel requires comparison against its existing implementation:

- median and p95 execution time;
- main-thread time saved;
- end-to-end frame p95 and p99;
- transfer or synchronization overhead;
- queue latency and missed deadlines;
- memory use and allocation count;
- low-tier phone, ordinary laptop, and high-end desktop behavior.

A Worker migration is accepted only when end-to-end results improve. Moving cost off the main thread without reducing latency or power use is not sufficient.

### 12.3 Compatibility

Test:

- direct-file inline mode;
- local static server without isolation;
- isolated local static server;
- Chromium, Gecko, and WebKit families;
- touch-first and desktop controls;
- single-player, host, and multiplayer client roles;
- tab visibility changes and Worker failure.

## 13. Risks and responses

| Risk | Response |
|------|----------|
| Shared mutable state creates races | Single-writer lane ownership, generation publication, atomic control only |
| Worker overhead exceeds job cost | Minimum batch sizes, inline threshold, measured tier policy |
| Start-time source generation is blocked by CSP | CSP-safe registered kernel factories; assembler capability detection |
| Pipeline API becomes a general-purpose VM | Keep the ISA numeric, bounded, and unit-specific |
| Fixed stride is mistaken for pure SoA | Define the lane ABI accurately; use columnar side planes for proven hot streams |
| Hot-path micro-optimizations regress on some engines | Keep catalog kernels measurable; allow engine-local omission of `Math.fround` / `| 0` forms within tolerance |
| Bit shifts overflow JS signed 32-bit rules | Validate capacities and permit equivalent constant multiplication |
| Multiplayer reads unstable state | Snapshot generations and publication barriers |
| Feature work keeps growing the monolith | Enforce engine/game dependency tests and route new systems through interfaces |

## 14. Completion criteria

The architecture is credible when:

- engine code has no Shape Slayer content dependencies;
- the game boots with no build step in all supported modes;
- VU0 and VU1 declarations are authorable and assembled at startup;
- inline and Worker paths share one pipeline ABI;
- unsupported shared-memory environments fall back cleanly;
- adaptive policy measurably improves low-end stability;
- modern hardware gains parallel throughput without multiplayer regressions;
- performance reports demonstrate improvement rather than relying on architectural assumptions.

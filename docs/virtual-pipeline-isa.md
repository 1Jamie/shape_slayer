# Shape Slayer Virtual Pipeline ISA

(to clarify these are just rough design ideas, may never actually happen, might just be pipe dream)
> **Status:** Version 1 design specification  
> **Runtime:** Plain JavaScript and native browser APIs  
> **Companion architecture:** [`engine-architecture-plan.md`](./engine-architecture-plan.md)

## 1. Purpose

The Virtual Pipeline ISA is the authoring and execution contract for Shape Slayer's VU0 and VU1 units.

Game developers compose named pipelines from a small RISC-like stage vocabulary. The engine validates and encodes those declarations at game start. Every execution context then assembles an equivalent specialized JavaScript runner over typed memory.

The ISA is not a general-purpose virtual machine and is not interpreted once per lane. Its purpose is to make high-throughput numeric pipelines:

- authorable without editing Worker internals;
- deterministic and structurally validated;
- usable inline or in a Worker;
- backed by `ArrayBuffer` or `SharedArrayBuffer`;
- directly executable without a build step.

## 2. Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.

- **Hub:** The root shared or local buffer containing control and data regions.
- **Word:** One 32-bit unit. Word offsets are not byte offsets.
- **Lane:** One logical work item, such as a particle or path node.
- **Lane matrix:** Fixed-stride records used by the baseline ABI.
- **Plane:** A contiguous typed column used by a structure-of-arrays binding.
- **Pipeline declaration:** Author-written JavaScript data registered during boot.
- **Pipeline image:** Validated immutable `Uint32Array` metadata and instructions.
- **Assembler:** Start-time code that turns a pipeline image into an execution runner.
- **Runner:** A callable JavaScript kernel used at runtime.
- **Stage:** One ISA operation in a pipeline declaration.
- **VU0:** Streaming, regular numeric work.
- **VU1:** Bounded irregular batch work.

## 3. Important memory-layout correction

A record containing all fields for lane 0 followed by all fields for lane 1 is **array-of-structures (AoS)**, even when accessed through typed views. Pure structure-of-arrays (SoA) stores all positions together, all velocities together, and so on.

Version 1 deliberately supports both:

1. a **64-byte fixed-stride lane matrix** as the stable, simple ABI;
2. optional **SoA planes** for kernels proven to benefit from contiguous field streams.

This is a hybrid AoS/SoA model. The fixed record makes generic authoring and stable slot addressing easy. Hot VU0 data such as voxel particles can bind directly to existing SoA planes without being copied into records.

Power-of-two stride permits `lane << STRIDE_SHIFT` word addressing. Emitted runners SHOULD use `| 0` and shift forms to keep index math in the signed-32-bit integer domain so JITs can strip type checks. Constant multiplication (`lane * 16`) remains semantically valid; the assembler MAY emit either form after capacity validation.

The 64-byte lane record also matches a common hardware L1 cache-line size. Arena bases MUST be cache-aligned so a single lane record does not straddle two lines. Hot streaming units SHOULD still prefer dense SoA flag planes for active/dead sweeps; see §10.4.

## 4. Scalar and bit conventions

- One word is 4 bytes.
- Integer metadata uses `Uint32Array` or `Int32Array` views.
- Numeric simulation fields use `Float32Array` unless a declaration specifies an integer type.
- Floating-point literals inside pipeline images are stored as their IEEE-754 binary32 bit pattern.
- The hub is interpreted in the platform's native endianness while executing locally.
- Serialized pipeline images MUST declare the VPI1 magic and ABI version.
- Atomic operations MUST target `Int32Array` or `BigInt64Array` views allowed by the platform; V1 uses `Int32Array`.
- Floating-point data MUST NOT be treated as atomically writable. Ownership and publication provide consistency.

Helper functions used by the assembler:

```js
function f32ToBits(value) {
    const f32 = new Float32Array(1);
    const u32 = new Uint32Array(f32.buffer);
    f32[0] = value;
    return u32[0];
}

function bitsToF32(value) {
    const u32 = new Uint32Array(1);
    const f32 = new Float32Array(u32.buffer);
    u32[0] = value;
    return f32[0];
}
```

These helpers run during assembly, not per lane.

## 5. Hub memory map

All region addresses are absolute word offsets from the beginning of the hub.

| Region | Purpose |
|--------|---------|
| Hub header | Magic, ABI version, size, feature flags, region directory |
| Atomic control | Epochs, queue cursors, executor states, publication generations |
| Command ring | Fixed-width jobs sent to VU0/VU1 |
| Result ring | Completion, errors, output ranges, timing |
| Metrics | Queue depth, work time, misses, lane counts |
| Pipeline images | Immutable assembled metadata and instruction words |
| Lane arenas | Fixed-stride lane matrices |
| SoA planes | Optional contiguous typed columns |
| Scratch arenas | Unit-owned temporary work |
| Snapshot regions | Published renderer/network views |

### 5.1 Hub header

The V1 hub header occupies 32 words.

| Word | Name | Meaning |
|------|------|---------|
| 0 | `HUB_MAGIC` | `0x53534831` (`SSH1`) |
| 1 | `ABI_VERSION` | `0x00010000` for 1.0 |
| 2 | `TOTAL_WORDS` | Total hub length in words |
| 3 | `FEATURE_FLAGS` | Backing mode and supported facilities |
| 4 | `CONTROL_START` | Atomic control region start |
| 5 | `CONTROL_WORDS` | Atomic control length |
| 6 | `COMMAND_START` | Command ring start |
| 7 | `COMMAND_WORDS` | Command ring length |
| 8 | `RESULT_START` | Result ring start |
| 9 | `RESULT_WORDS` | Result ring length |
| 10 | `METRICS_START` | Metrics region start |
| 11 | `METRICS_WORDS` | Metrics region length |
| 12 | `PIPELINE_START` | Pipeline image region start |
| 13 | `PIPELINE_WORDS` | Pipeline image region length |
| 14 | `LANE_START` | Lane arena directory start; MUST be a multiple of 16 words (64-byte cache-line aligned) |
| 15 | `LANE_WORDS` | Total lane region length |
| 16 | `SOA_START` | SoA plane directory start |
| 17 | `SOA_WORDS` | Total SoA region length |
| 18 | `SCRATCH_START` | Scratch region start |
| 19 | `SCRATCH_WORDS` | Scratch region length |
| 20 | `SNAPSHOT_START` | Snapshot region start |
| 21 | `SNAPSHOT_WORDS` | Snapshot region length |
| 22 | `BOOT_GENERATION` | Increments after complete initialization |
| 23 | `WORLD_GENERATION` | Latest published world generation |
| 24–31 | Reserved | MUST be zero in V1 |

Feature flags:

| Bit | Name | Meaning |
|-----|------|---------|
| 0 | `SHARED` | Backing buffer is a `SharedArrayBuffer` |
| 1 | `WORKERS` | Worker executors are active |
| 2 | `CROSS_ORIGIN_ISOLATED` | Page reported `crossOriginIsolated` |
| 3 | `SOURCE_JIT` | Start-time source assembler is available |
| 4 | `CATALOG_ASSEMBLER` | CSP-safe registered kernel catalog is available |
| 5 | `TRANSFERABLE` | Transferable `ArrayBuffer` executor is available |
| 6–31 | Reserved | MUST be zero in V1 |

## 6. Lane matrix ABI

### 6.1 Standard lane size

The standard lane record is:

- 16 words;
- 64 bytes;
- `STRIDE_SHIFT = 4` when addresses are expressed in words.

For lane `n`:

```js
const baseWord = dataStartWord + (n << 4);
```

The assembler MUST reject configurations where the largest possible word index exceeds `0x7fffffff` when shift addressing is selected. A runner MAY use `n * 16` instead; the result is semantically identical.

### 6.2 Standard record

| Word | View | Name | Meaning |
|------|------|------|---------|
| 0 | `Uint32` | `FLAGS` | Activity, state, owner, type, generation |
| 1 | `Uint32` | `ENTITY_ID` | Stable game-visible ID |
| 2 | `Float32` | `POS_X` | Position X |
| 3 | `Float32` | `POS_Y` | Position Y |
| 4 | `Float32` | `VEL_X` | Velocity X |
| 5 | `Float32` | `VEL_Y` | Velocity Y |
| 6 | `Float32` | `HP` | Current hit points |
| 7 | `Float32` | `MAX_HP` | Maximum hit points |
| 8 | `Float32` | `RADIUS` | Collision or visual radius |
| 9 | `Float32` | `ROTATION` | Rotation in radians |
| 10 | `Float32` | `LIFE` | Lifetime, age, or unit-specific timer |
| 11 | `Float32` | `AUX_0` | Schema-defined numeric field |
| 12 | `Float32` | `AUX_1` | Schema-defined numeric field |
| 13 | `Uint32/Float32` | `USER_0` | Unit-specific payload |
| 14 | `Uint32/Float32` | `USER_1` | Unit-specific payload |
| 15 | `Uint32` | `REVISION` | Writer-owned revision or reserved control |

The interpretation of words 8–15 is declared by the lane schema. A pipeline MUST NOT access an offset not listed in its schema bindings.

### 6.3 Flags word

| Bits | Name | Meaning |
|------|------|---------|
| 0 | `ACTIVE` | Lane contains live work |
| 1 | `PENDING_DELETE` | Owner will retire lane at publication |
| 2 | `DIRTY` | Lane changed since prior publication |
| 3 | `SLEEPING` | Lane may be skipped by eligible stages |
| 4 | `VISIBLE` | Presentation eligibility |
| 5 | `COLLIDABLE` | Collision eligibility |
| 6 | `NETWORKED` | Included in network snapshot policy |
| 7 | Reserved | MUST be zero in V1 |
| 8–15 | `OWNER_ID` | Main, VU0, VU1, renderer snapshot, or allocator |
| 16–23 | `ENTITY_TYPE` | Engine/game registered type |
| 24–31 | `GENERATION` | Slot generation for stale-handle rejection |

Flags used by a pipeline are declared as required and forbidden masks. The standard lane predicate is:

```js
const flags = u32[baseWord + FLAGS_OFFSET];
const eligible =
    (flags & requiredFlags) === requiredFlags &&
    (flags & forbiddenFlags) === 0;
```

### 6.4 SoA plane bindings

A pipeline MAY bind an operand to a contiguous plane instead of a lane-record offset.

```text
address(lane) = planeStartWord + lane
```

The binding descriptor tells the assembler whether an operand uses:

- `LANE_F32`;
- `LANE_U32`;
- `PLANE_F32`;
- `PLANE_U32`;
- `LITERAL_F32`;
- `LITERAL_U32`;
- `RUNTIME_DT`.

This allows the same ISA stages to operate on the voxel system's current typed-array layout and on fixed lane records.

## 7. Pipeline image format

### 7.1 Header

Every pipeline image starts with a fixed 16-word metadata block.

| Word | Name | Meaning |
|------|------|---------|
| 0 | `PIPELINE_MAGIC` | `0x56504931` (`VPI1`) |
| 1 | `ABI_VERSION` | `0x00010000` |
| 2 | `TOTAL_WORDS` | Header plus instruction words |
| 3 | `STAGE_COUNT` | Number of four-word instructions |
| 4 | `PIPELINE_ID` | Stable registry ID |
| 5 | `UNIT_VARIANT` | Unit, quality variant, assembler flags |
| 6 | `STRIDE_SHIFT` | Standard lane stride shift; `0xffffffff` for pure planes |
| 7 | `DATA_START_WORD` | Default lane arena base |
| 8 | `LANE_CAPACITY` | Maximum addressable lanes |
| 9 | `REQUIRED_FLAGS` | Required lane flags |
| 10 | `FORBIDDEN_FLAGS` | Forbidden lane flags |
| 11 | `SCRATCH_START_WORD` | Unit-owned scratch base |
| 12 | `SCRATCH_WORDS` | Available scratch length |
| 13 | `BINDING_TABLE_WORD` | Optional binding table offset in image |
| 14 | `IMAGE_HASH` | Deterministic declaration hash |
| 15 | `RESERVED` | MUST be zero in V1 |

`UNIT_VARIANT` bit layout:

| Bits | Meaning |
|------|---------|
| 0–3 | Unit: 0 inline/general, 1 VU0, 2 VU1 |
| 4–7 | Quality variant |
| 8 | Authoritative job allowed |
| 9 | Optional/drop-if-late job |
| 10 | Requires scratch |
| 11 | Produces active-index output |
| 12–31 | Reserved |

### 7.2 Fixed-width instructions

Every V1 instruction occupies exactly four words:

| Word | Name | Meaning |
|------|------|---------|
| 0 | `OPWORD` | Opcode and operand-mode metadata |
| 1 | `ARG_0` | First offset, binding index, or literal bits |
| 2 | `ARG_1` | Second offset, binding index, or literal bits |
| 3 | `ARG_2` | Third offset, binding index, or literal bits |

Fixed-width instructions make validation and startup parsing simple. Runtime runners do not repeatedly parse these words.

`OPWORD` layout:

| Bits | Name | Meaning |
|------|------|---------|
| 0–7 | `OPCODE` | Operation code |
| 8–11 | `ARG0_MODE` | Address/literal mode |
| 12–15 | `ARG1_MODE` | Address/literal mode |
| 16–19 | `ARG2_MODE` | Address/literal mode |
| 20–23 | `VALUE_TYPE` | F32, U32, or I32 |
| 24–27 | `STAGE_FLAGS` | Saturate, optional, writes-mask, reserved |
| 28–31 | Reserved | MUST be zero in V1 |

Operand modes:

| Code | Name |
|------|------|
| `0x0` | Unused |
| `0x1` | Lane-record word offset |
| `0x2` | SoA binding-table index |
| `0x3` | Float32 literal bits |
| `0x4` | Uint32 literal |
| `0x5` | Runtime `dt` |
| `0x6` | Scratch word offset |
| `0x7` | Output binding index |
| `0x8–0xf` | Reserved |

## 8. Core opcode map

The V1 core opcode range is `0x00–0x1f`.

| Hex | Name | Operation | Arguments |
|-----|------|-----------|-----------|
| `0x00` | `OP_NOP` | No operation | None |
| `0x01` | `OP_INTEGRATE` | `dst += velocity * dt` | dst, velocity, runtime dt |
| `0x02` | `OP_DAMP` | `dst *= factor` | dst, factor |
| `0x03` | `OP_CLAMP` | `dst = min(max(dst, min), max)` | dst, min, max |
| `0x04` | `OP_COMPACT` | Build dense active-index output | status/flags, output, capacity |
| `0x05` | `OP_ADD` | `dst += source` | dst, source |
| `0x06` | `OP_MUL` | `dst *= source` | dst, source |
| `0x07` | `OP_MAD` | `dst += source * factor` | dst, source, factor |
| `0x08` | `OP_COPY` | `dst = source` | dst, source |
| `0x09` | `OP_DECAY` | `dst -= rate * dt` | dst, rate, runtime dt |
| `0x0a` | `OP_KILL_LE_ZERO` | Clear `ACTIVE` when value ≤ 0 | value, flags |
| `0x0b` | `OP_MIN` | `dst = min(dst, source)` | dst, source |
| `0x0c` | `OP_MAX` | `dst = max(dst, source)` | dst, source |
| `0x0d` | `OP_MASK_SET` | OR a literal mask into U32 destination | dst, mask |
| `0x0e` | `OP_MASK_CLEAR` | AND inverse literal mask into destination | dst, mask |
| `0x0f` | `OP_EMIT_INDEX` | Append eligible lane index to output | output, capacity |
| `0x10–0x1f` | Reserved | Future core operations | — |

Unit-specific opcode ranges:

| Range | Owner |
|-------|-------|
| `0x20–0x3f` | VU0 streaming/VFX extensions |
| `0x40–0x5f` | VU1 path/navigation extensions |
| `0x60–0x7f` | Engine spatial extensions |
| `0x80–0xbf` | Registered game extensions |
| `0xc0–0xff` | Reserved; pipeline image MUST be rejected |

Game extensions require both:

1. a declaration-time opcode schema;
2. a registered runner emitter or CSP-safe kernel factory in every execution context.

An unknown extension MUST fail pipeline assembly. It MUST NOT degrade into dynamic dispatch.

### 8.1 `OP_COMPACT` semantics

`OP_COMPACT` does not move canonical entity records. Moving them would invalidate stable handles and create races.

For canonical game entities, it writes eligible lane indices into a dense output list. Later kernels iterate that list.

Emitted compact kernels SHOULD use branchless cursor advancement when only the `ACTIVE` bit is required:

```js
let outCursor = outputStartWord | 0;
for (let lane = start; lane < end; lane = (lane + 1) | 0) {
    const flags = u32[(dataStart + (lane << 4)) | 0] | 0;
    const isActive = flags & 1;
    u32[outCursor] = lane;
    outCursor = (outCursor + isActive) | 0;
}
const written = (outCursor - outputStartWord) | 0;
```

Writing the index unconditionally and advancing by `isActive` avoids a data-dependent branch when live/dead lanes are irregular. Catalog and source-JIT emitters MUST produce the same written count and the same dense prefix of live indices. Inactive slots beyond `written` are undefined and MUST NOT be read.

When eligibility needs more than bit 0 (`requiredFlags` / `forbiddenFlags`), emitters MAY use a predicated write or a local `if`; they SHOULD still keep the dense-output contract identical.

Transient VU0 arenas MAY physically compact data only when:

- the arena schema declares lanes movable;
- no stable external handle addresses a physical slot;
- VU0 exclusively owns the arena;
- compaction publishes a new generation after completion.

## 9. Author declaration API

The public authoring API is plain classic-script JavaScript. It is attached to the engine namespace rather than requiring ES modules.

```js
Engine.pipeline.register({
    name: 'vu0.voxel.full',
    unit: 'vu0',
    variant: 0,
    laneSchema: 'voxel-v1',
    requiredFlags: Engine.pipeline.flags.ACTIVE,
    forbiddenFlags: Engine.pipeline.flags.PENDING_DELETE,
    bindings: {
        posX: { kind: 'plane-f32', plane: 'voxel.posX' },
        posY: { kind: 'plane-f32', plane: 'voxel.posY' },
        velX: { kind: 'plane-f32', plane: 'voxel.velX' },
        velY: { kind: 'plane-f32', plane: 'voxel.velY' },
        life: { kind: 'plane-f32', plane: 'voxel.life' },
        flags: { kind: 'plane-u32', plane: 'voxel.flags' }
    },
    stages: [
        { op: 'integrate', dst: 'posX', velocity: 'velX', dt: 'runtime' },
        { op: 'integrate', dst: 'posY', velocity: 'velY', dt: 'runtime' },
        { op: 'damp', dst: 'velX', factor: 0.96 },
        { op: 'damp', dst: 'velY', factor: 0.96 },
        { op: 'decay', dst: 'life', rate: 1, dt: 'runtime' },
        { op: 'kill-le-zero', value: 'life', flags: 'flags' },
        { op: 'compact', flags: 'flags', output: 'voxel.activeIndices' }
    ]
});
```

At boot:

```js
Engine.pipeline.assembleVuPipelines();
```

Registration closes when assembly begins. Late declarations require an explicit content-load barrier and cause the affected unit to assemble again while idle; they MUST NOT trigger assembly during a simulation tick.

## 10. Assembly process

### 10.1 Required phases

For each declaration, the assembler:

1. validates names, unit, variant, and lane schema;
2. resolves bindings to legal typed regions;
3. validates stage opcode and operand modes;
4. checks read/write overlap and unit ownership;
5. validates literal ranges and lane capacity;
6. normalizes stages into fixed-width instructions;
7. computes a deterministic image hash;
8. writes the pipeline image;
9. selects an assembly backend;
10. installs the runner under `PIPELINE_ID`.

The main thread sends pipeline images or normalized declarations to Workers during Worker initialization. Functions MUST NOT be sent through `postMessage`; they are not structured-cloneable.

Each Worker verifies the image hash and assembles its own runner. A unit reports ready only after all assigned pipeline IDs are installed.

### 10.2 Assembly backends

#### Source JIT backend

When permitted by runtime policy, the engine MAY generate a JavaScript function body at game start and construct it with `Function`.

Requirements:

- only validated engine-owned opcode emitters may produce source;
- author strings are never interpolated as executable source;
- property names and offsets are normalized before emission;
- the generated lane loop contains no stage decoder;
- small fixed stage sequences are fully unrolled into straight-line stores;
- Float32 stages emit `Math.fround` coercion (§10.4);
- index arithmetic uses `| 0` / shifts (§10.4);
- generated source is retained in debug mode for diagnostics;
- failure immediately falls back to the catalog backend.

Conceptual generated runner (arguments are monomorphic typed views, not a views bag):

```js
function executeKernel(f32, u32, startLane, endLane, dt, dataStart, requiredFlags, forbiddenFlags) {
    const start = startLane | 0;
    const end = endLane | 0;
    const base0 = dataStart | 0;
    const rf = requiredFlags | 0;
    const ff = forbiddenFlags | 0;
    const dtf = Math.fround(dt);

    for (let lane = start; lane < end; lane = (lane + 1) | 0) {
        const base = (base0 + (lane << 4)) | 0;
        const flags = u32[base] | 0;
        if ((flags & rf) !== rf) continue;
        if ((flags & ff) !== 0) continue;

        f32[base + 2] = Math.fround(f32[base + 2] + Math.fround(f32[base + 4] * dtf));
        f32[base + 3] = Math.fround(f32[base + 3] + Math.fround(f32[base + 5] * dtf));
        f32[base + 4] = Math.fround(f32[base + 4] * 0.96);
        f32[base + 5] = Math.fround(f32[base + 5] * 0.96);
    }
}
```

There is no `stages.forEach`, no opcode branch inside the lane loop, and no object-property access to typed arrays in the hot path.

#### Catalog backend

The CSP-safe backend maps normalized pipeline signatures to registered kernel factories.

```js
Engine.pipeline.registerKernel(
    'integrate2|damp2|decay|kill|compact',
    createVoxelFullKernel
);
```

This backend is mandatory for built-in pipelines. It ensures the engine still runs where dynamic source construction is blocked.

Custom author pipelines unsupported by the catalog require either:

- a registered kernel factory; or
- an available source JIT backend.

Assembly fails explicitly if neither exists.

### 10.3 No per-lane interpreter

The following is forbidden in a production runner:

```js
for (let lane = startLane; lane < endLane; lane++) {
    for (let stage = 0; stage < stageCount; stage++) {
        switch (opcodes[stage]) {
            // ...
        }
    }
}
```

An interpreter MAY exist only as a test oracle or development validator.

### 10.4 Hot-path emission and memory optimizations

These rules apply to both the source-JIT backend and hand-written catalog kernels. They are normative for V1 production runners. Gains MUST be confirmed with microbenchmarks and end-to-end frame metrics; syntax alone is not acceptance.

#### Float32 coercion with `Math.fround`

JavaScript values are IEEE-754 binary64 by default. Writing into a `Float32Array` truncates the final store, but intermediate arithmetic can still run in binary64.

Source emitters and catalog kernels MUST wrap Float32 stage expressions so intermediates and results are coerced to binary32:

```js
f32[dst] = Math.fround(f32[dst] + Math.fround(f32[src] * dtf));
```

Rules:

- runtime `dt` is coerced once before the lane loop (`const dtf = Math.fround(dt)`);
- Float32 literals from the pipeline image are emitted as ordinary JS number literals after bit decoding, then coerced at use sites when needed;
- compound expressions coerce every binary32-visible intermediate that the ISA stage defines;
- U32 / flag / index math MUST NOT use `Math.fround`.

Purpose: keep the JIT on Float32 specialization paths and keep store rounding consistent across inline and Worker executors. Do not claim automatic hardware SIMD vectorization from this alone; validate with engine-specific profiles.

#### Signed-32 index shaping

Lane loops MUST shape bounds and strides into the signed-32-bit integer domain:

```js
const start = startLane | 0;
const end = endLane | 0;
for (let lane = start; lane < end; lane = (lane + 1) | 0) {
    const base = (dataStart + (lane << STRIDE_SHIFT)) | 0;
    // ...
}
```

Rules:

- `| 0` after loads used as indices or flag masks;
- `(lane + 1) | 0` for the induction variable;
- stride addressing prefers `<< STRIDE_SHIFT` when the shift is legal for the capacity;
- assemblers MUST reject capacities where `maxLane << STRIDE_SHIFT` overflows signed 32-bit addressing.

#### Cache-line alignment of lane arenas

The standard 16-word / 64-byte lane record matches a common L1 cache-line size on modern x86_64 and ARM.

Rules:

- `LANE_START` and every fixed-stride arena base MUST be a multiple of 16 words from the hub origin;
- arena allocators MUST NOT place a lane record such that it straddles two 64-byte boundaries;
- SoA plane starts SHOULD be 16-word aligned;
- scratch and snapshot regions SHOULD follow the same alignment when they hold lane-sized records.

Alignment prevents one lane load from spanning two hardware lines. It does not replace SoA packing for streaming flag scans.

#### Dense SoA flags for streaming units

Record-local `FLAGS` remains valid for general ownership and publication ergonomics. VU0 streaming kernels SHOULD also maintain a contiguous `Uint32` flag plane (for example `voxel.flags`).

Benefits:

- one 64-byte cache line carries sixteen contiguous flag words;
- kernels can sweep flags before touching position/velocity planes;
- large inactive spans skip payload fetches and reduce cache pollution.

Recommended VU0 pattern:

1. optional word-wise or block-wise flag prefilter;
2. branchless or predicated compact into an active-index list;
3. subsequent stages iterate the dense index list and touch payload planes only for live lanes.

When both a record `FLAGS` word and a flag plane exist, the lane schema MUST declare which is authoritative for `ACTIVE`. V1 voxel pipelines treat the SoA flag plane as authoritative for VU0.

#### Branchless compact cursor

See §8.1. Catalog and JIT emitters for simple active-bit compaction SHOULD emit the double-pointer / cursor-advance form. More complex eligibility predicates MAY use branches if measurements show no regression.

#### Argument monomorphism

Runners MUST receive raw typed-array views and scalars as distinct parameters:

```js
executeKernel(f32, u32, startLane, endLane, dt, dataStart, requiredFlags, forbiddenFlags);
```

Forbidden in hot signatures:

- a mutable `views` object whose shape can change across calls;
- reading `views.f32` / `views.u32` inside the lane loop;
- optional arguments that change arity between calls to the same installed runner.

The dispatcher MAY unpack a views bag once at the call boundary. The installed runner itself stays monomorphic.

#### Full unrolling of small fixed stage blocks

Built-in pipelines with a small static stage count (voxel full/reduced/minimal) MUST emit fully unrolled straight-line stores inside the lane body. No inner stage loop, no `forEach`, no helper per stage.

Larger author pipelines MAY:

- emit unrolled blocks while stage count stays under an assembler threshold (V1 default: 12 stages);
- fall back to a catalog kernel or fail assembly if the source JIT would need a stage loop.

#### Measurement gates for these techniques

Each technique is retained only when it improves, or at least does not regress:

- lanes per millisecond for the kernel;
- main-thread and Worker p95 for the owning system;
- allocation count (must remain zero in the hot loop);
- correctness against the interpreter oracle with Float32 rounding.

If `Math.fround` or `| 0` regresses on a target engine, the catalog kernel for that engine MAY omit the form while preserving Float32 store semantics and identical outputs within tolerance.

## 11. Runtime command ABI

Commands use fixed eight-word records.

| Word | Name | Meaning |
|------|------|---------|
| 0 | `STATE_SEQUENCE` | Atomic state plus sequence |
| 1 | `PIPELINE_ID` | Installed runner |
| 2 | `START_LANE` | Inclusive lane index |
| 3 | `END_LANE` | Exclusive lane index |
| 4 | `DT_BITS` | Runtime delta as Float32 bits |
| 5 | `WORLD_GENERATION` | Input generation |
| 6 | `OUTPUT_START_WORD` | Result/index output region |
| 7 | `JOB_FLAGS` | Priority, deadline class, authoritative/optional |

Command states:

| Value | State |
|-------|-------|
| 0 | Free |
| 1 | Writing |
| 2 | Ready |
| 3 | Claimed |
| 4 | Complete |
| 5 | Failed |
| 6 | Cancelled |

The producer writes words 1–7 and then publishes `Ready` with `Atomics.store`. A Worker claims with `Atomics.compareExchange`. The completion record is published only after all data writes finish.

## 12. Result ABI

Results use fixed eight-word records.

| Word | Name | Meaning |
|------|------|---------|
| 0 | `STATE_SEQUENCE` | Atomic state plus matching sequence |
| 1 | `PIPELINE_ID` | Completed pipeline |
| 2 | `STATUS_CODE` | Success, validation, timeout, execution failure |
| 3 | `LANES_PROCESSED` | Number of input lanes visited |
| 4 | `OUTPUT_COUNT` | Dense outputs or active indices emitted |
| 5 | `OUTPUT_GENERATION` | Published generation |
| 6 | `DURATION_US` | Rounded execution time in microseconds |
| 7 | `DETAIL` | Unit-specific diagnostic code |

Result publication does not make partially written output valid. The consumer accepts output only when the result state is `Complete` and the output generation matches.

## 13. VU0 design

VU0 prioritizes throughput and predictable memory access.

### Initial pipeline families

- `vu0.voxel.full`;
- `vu0.voxel.reduced`;
- `vu0.voxel.minimal`;
- later transform, broadphase, or ambient-particle families.

### Rules

- Batches SHOULD be dense or use an active-index list.
- Pipelines SHOULD bind hot properties to SoA planes.
- Streaming pipelines SHOULD bind flags to a dense SoA plane and compact before payload stages.
- Lane arenas MUST be 64-byte / 16-word aligned.
- Kernels MUST follow §10.4 emission rules (`Math.fround`, `| 0`, monomorphic arguments, unrolled stages).
- VU0 owns its output range until publication.
- Visual-only jobs MAY be cancelled or dropped when late.
- Quality changes select a pre-assembled variant.
- The scheduler SHOULD avoid dispatching batches whose measured Worker overhead exceeds inline execution.

## 14. VU1 design

VU1 handles bounded, less regular workloads.

### Initial pipeline families

- `vu1.path.relax`;
- `vu1.path.heuristic`;
- `vu1.path.reconstruct`;
- later flow-field, visibility, or layout passes.

### Rules

- Scratch ownership is explicit per command.
- Jobs have expansion/node limits.
- Authoritative path requests define a deadline and inline fallback.
- Optional navigation updates MAY use the last valid result when late.
- VU1 MUST NOT mutate game rewards, combat state, or entity lifecycle directly.
- Results are numeric outputs or events consumed by game orchestration.

Pathfinding may need unit-specific opcodes in `0x40–0x5f`; forcing it entirely into scalar core opcodes is not required.

## 15. Synchronization and safety

1. Pipeline image regions are immutable after publication.
2. One unit writes a lane/output range at a time.
3. Atomics coordinate queue state and generations, not every numeric property.
4. A runner validates command ranges before entering the hot loop.
5. Author declarations cannot provide executable source.
6. Source JIT emitters are engine-owned and emit only normalized operands.
7. Unknown opcodes, reserved bits, invalid offsets, and unsupported combinations fail assembly.
8. A failed Worker job cannot publish its target generation.
9. Timeouts route authoritative work to a known fallback.
10. Debug builds MAY place guard words around arenas and verify them after jobs.

## 16. Determinism

Inline and Worker runners for the same pipeline image MUST:

- use the same operation order;
- use Float32 storage and the same `Math.fround` coercion points when the stage is Float32;
- avoid dependence on object enumeration order;
- avoid clock, random, DOM, and network access;
- receive `dt`, seeds, and generation explicitly;
- produce equivalent results within the pipeline's declared tolerance.

If exact cross-engine determinism is required for a field, its operation and quantization rules must be specified separately. Float32 alone does not guarantee bit-identical behavior for every transcendental operation, so V1 core avoids transcendental opcodes.

## 17. Tests

### Image and assembler tests

- header and instruction bit packing;
- Float32 literal round trips;
- deterministic image hashing;
- invalid offset and reserved-bit rejection;
- unit/opcode compatibility;
- source JIT and catalog runner equivalence;
- Worker-local reassembly from one image;
- CSP/source-JIT failure fallback.

### Runner tests

- inactive and forbidden lanes are skipped;
- integration, damping, clamp, decay, and kill semantics;
- Float32 stages match oracle results when emitters use `Math.fround`;
- `OP_COMPACT` emits indices without moving stable records;
- branchless compact produces the same dense prefix as branched compact;
- lane matrix and SoA bindings produce equivalent results;
- SoA flag-plane sweeps skip inactive payload lanes;
- start/end bounds cannot escape an arena;
- arena bases are 16-word aligned;
- inline and Worker output generations match;
- stale entity generations are rejected;
- installed runners keep monomorphic typed-array argument shapes.

### Performance gates

- compare against the current voxel update;
- report lanes per millisecond and end-to-end dispatch latency;
- test small batches to determine the inline threshold;
- test normal, reduced, and minimal variants;
- measure p95 main-thread time before and after migration;
- reject changes that only move overhead without improving frame stability.

## 18. Versioning

- V1 readers reject unknown major ABI versions.
- Minor versions may add reserved-field meanings while preserving existing layouts.
- Opcode numeric values never change after release.
- Removed opcodes remain reserved.
- Pipeline image hashes include ABI version, normalized declaration, bindings, and variants.
- Save files and network packets MUST NOT embed raw lane addresses; they use stable game IDs and schema versions.

## 19. Version 1 implementation sequence

1. Add constants, declaration registry, validation, and image encoder.
2. Add an interpreter only as a test oracle.
3. Add built-in catalog kernels for voxel full/reduced/minimal.
4. Add optional source JIT emission for validated built-in core stages.
5. Add inline executor and benchmark it against current voxel code.
6. Add Worker initialization and local pipeline assembly.
7. Add transferable-buffer mode.
8. Add cross-origin-isolated SAB hub and command/result rings.
9. Add adaptive inline-versus-VU0 scheduling.
10. Add VU1 pathfinding declarations and unit extensions.

The first production milestone is complete when a game developer can declare a voxel pipeline in ordinary JavaScript, boot the unbuilt project, and receive equivalent results from the inline and VU0 executors.

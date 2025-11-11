## Telemetry Schema

### Overview

Telemetry is recorded per run and organized into nested aggregates:

- **Run**: metadata about the session, participating players, difficulty, and completion outcome.
- **Rooms**: ordered sequence capturing per-room timings, damage throughput, and events.
- **Events**: granular interactions such as hits, damage dealt/taken, affix triggers, boss mechanics.

All telemetry is structured JSON and validated before ingestion.

### Run Payload (`run`)

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `runId` | `string` | yes | UUID v4 generated at run start. |
| `gameVersion` | `string` | yes | Client build identifier. |
| `mode` | `string` | yes | `"singleplayer"` or `"multiplayer"`. |
| `hostPlayerId` | `string` | yes | Player ID responsible for reporting (self in singleplayer). |
| `startedAt` | `string (ISO-8601)` | yes | Run start timestamp (UTC). |
| `endedAt` | `string (ISO-8601)` | yes | Run end timestamp (UTC). |
| `durationMs` | `number` | yes | Run duration in milliseconds. |
| `result` | `string` | yes | `"success"`, `"failure"`, or `"abandoned"`. |
| `seed` | `string` | no | Procedural seed if applicable. |
| `difficulty` | `string` | no | Difficulty or tier label. |
| `players` | `PlayerSummary[]` | yes | Array of participating players (see below). |
| `affixPool` | `AffixSummary[]` | yes | Affixes active during the run. |
| `rooms` | `Room[]` | yes | Chronological list of rooms traversed. |
| `bossEncounters` | `BossEncounter[]` | yes | Boss fights that occurred during the run. |
| `metadata` | `Record<string, string>` | no | Arbitrary string metadata (e.g., experiment flags). |

#### `PlayerSummary`

| Field | Type | Description |
| --- | --- | --- |
| `playerId` | `string` | Stable player identifier across sessions. |
| `class` | `string` | Player archetype (`"warrior"`, `"mage"`, etc.). |
| `deck` | `string[]` | Selected abilities/gear identifiers at run start. |
| `affixes` | `AffixSummary[]` | Active affixes on the player. |
| `totalDamageDealt` | `number` | Total damage dealt by the player. |
| `totalDamageTaken` | `number` | Total damage taken. |
| `hitsTaken` | `number` | Count of damaging hits received. |
| `roomsCleared` | `number` | Rooms this player survived through. |
| `deaths` | `number` | Number of deaths (multiplayer only). |

#### `AffixSummary`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Affix identifier. |
| `source` | `string` | `"player"`, `"room"`, `"boss"`, etc. |
| `stacks` | `number` | Current stacks (if applicable). |
| `effects` | `string[]` | Human-readable effect keys. |

### Rooms (`Room`)

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `roomId` | `string` | yes | Unique identifier within the run (e.g., `"room-3"`). |
| `type` | `string` | yes | `"combat"`, `"shop"`, `"event"`, etc. |
| `enteredAt` | `string (ISO-8601)` | yes | Entry timestamp. |
| `clearedAt` | `string (ISO-8601)` | yes | Clearance timestamp. |
| `durationMs` | `number` | yes | Time spent in the room. |
| `damageDealtByPlayer` | `Record<string, number>` | yes | Damage dealt keyed by `playerId`. |
| `damageTakenByPlayer` | `Record<string, number>` | yes | Damage taken keyed by `playerId`. |
| `hitsTakenByPlayer` | `Record<string, number>` | yes | Hits taken keyed by `playerId`. |
| `playerStatsStart` | `PlayerStatSnapshot[]` | no | Player stat + gear snapshot captured when the room is entered. |
| `playerStatsEnd` | `PlayerStatSnapshot[]` | no | Snapshot captured when the room is cleared / exited. |
| `events` | `Event[]` | yes | Ordered room events. |

#### `PlayerStatSnapshot`

| Field | Type | Description |
| --- | --- | --- |
| `playerId` | `string` | Identifier of the player described by the snapshot. |
| `class` | `string` | Player class at capture time. |
| `level` | `number` | Player level. |
| `stats` | `Record<string, number>` | Core combat stats (damage, defense, moveSpeed, critChance, critDamage, attackSpeed, hp, maxHp, etc.). |
| `gear` | `GearSnapshot` | Equipped gear overview. |

#### `GearSnapshot`

| Field | Type | Description |
| --- | --- | --- |
| `weapon` | `GearPiece` | Weapon info including tier/name and affixes. |
| `armor` | `GearPiece` | Armor info. |
| `accessory` | `GearPiece` | Accessory info. |

#### `GearPiece`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Identifier or slug for the item (if available). |
| `name` | `string` | Display name. |
| `tier` | `string` | Rarity tier (e.g., gray, green, blue). |
| `classModifier` | `string` | Applied class modifier description (if any). |
| `affixes` | `AffixSummary[]` | Affixes rolled on the item. |

### Events (`Event`)

| Field | Type | Description |
| --- | --- | --- |
| `timestamp` | `string (ISO-8601)` | Event time relative to room entry. |
| `type` | `string` | `"hit"`, `"damage"`, `"affixTriggered"`, `"abilityCast"`, `"bossPhase"` etc. |
| `playerId` | `string` | Player involved (if applicable). |
| `targetId` | `string` | Enemy/boss identifier, if relevant. |
| `value` | `number` | Numeric magnitude (damage, healing, stacks). |
| `metadata` | `Record<string, string | number>` | Additional structured details per event type. |

- `roomStats` events capture per-player stat snapshots at room entry/exit:
  ```json
  {
    "timestamp": "2025-11-10T12:01:00.000Z",
    "type": "roomStats",
    "metadata": {
      "phase": "start",
      "roomNumber": 3,
      "players": [ /* PlayerStatSnapshot[] */ ]
    }
  }
  ```

### Boss Encounters (`BossEncounter`)

| Field | Type | Description |
| --- | --- | --- |
| `bossId` | `string` | Boss identifier. |
| `startedAt` | `string (ISO-8601)` | Encounter start. |
| `endedAt` | `string (ISO-8601)` | Encounter end. |
| `durationMs` | `number` | Encounter length. |
| `phases` | `BossPhase[]` | Ordered phases with metrics. |
| `damageByPlayer` | `Record<string, number>` | Damage dealt by each player. |
| `damageToPlayers` | `Record<string, number>` | Damage the boss dealt to each player. |
| `hitsTakenByPlayers` | `Record<string, number>` | Hits per player during the encounter. |

#### `BossPhase`

| Field | Type | Description |
| --- | --- | --- |
| `phaseId` | `string` | Phase identifier. |
| `durationMs` | `number` | Time spent in phase. |
| `events` | `Event[]` | Phase-specific events. |

### Multiplayer Host Behavior

- Only the host collects and submits telemetry; non-host clients noop after run.
- Client events include `sourcePlayerId` to disambiguate in co-op play.
- Host aggregates per-player metrics before submission.

### Submission Contract

```json
{
  "run": { /* Run payload */ },
  "submittedAt": "2025-11-10T12:00:00.000Z",
  "clientVersion": "1.2.3",
  "authToken": "string"
}
```

`submittedAt`, `clientVersion`, and `authToken` support ingestion auditing.



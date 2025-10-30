# Enemy AI Overhaul - Implementation Summary

## What Has Been Implemented

### ✅ Core Squad System (`js/enemies/enemy-squad.js`)

1. **EnemySquad Class**: Manages groups of 2-5 enemies that coordinate behavior
   - Attack queue system (limits simultaneous attackers)
   - Squad leader selection (priority: Elite > Brute > Assassin > Ranged > Swarmer)
   - Formation management
   - Morale system (affects behavior when squad members die)

2. **SquadManager Class**: Manages all squads in a room
   - Organizes enemies into balanced squads
   - Handles squad creation and updates
   - Calculates squad sizes based on room progression

### ✅ Progressive Difficulty System

- **Rooms 1-2**: No coordination - Individual enemy AI (learning curve, only melee enemies)
- **Rooms 3-9**: Light coordination - 2 enemies per squad, 1 attacker at a time (mixed enemy types start)
- **Rooms 10-14**: Medium coordination - 3 enemies per squad, 1-2 attackers
- **Rooms 15+**: Full coordination - 4 enemies per squad, 2 attackers

### ✅ Dynamic Squad Consolidation

- **Automatic Merging**: When squads drop to 1 member, they merge into the nearest larger squad
- **Consolidation Check**: Runs every second to avoid performance issues
- **Smart Merging**: Small squads merge into nearby squads (preserves positions, avoids visual confusion)
- **Orphan Assignment**: Enemies without squads are assigned to the nearest squad
- **Death Handling**: Dead enemies are automatically removed from squads

### ✅ Attack Queue System

- Enemies must request attack permission before attacking
- Only limited number of enemies per squad can attack simultaneously
- Prevents overwhelming simultaneous attacks
- Attack slots are released when attacks complete

### ✅ Enhanced Enemy Base Class

- Added squad references (`squad`, `squadId`)
- Added attack permission methods (`requestAttackPermission()`, `canAttack()`, `releaseAttackPermission()`)
- Formation position tracking (`desiredFormationPos`)
- Attack state tracking (`isAttacking`)

### ✅ Updated Enemy Types

**Basic Enemy (Circle/Swarmer)**:
- Integrated squad attack permissions
- Formation movement when in squad
- Backs off when can't attack (if not in squad)

**Rectangle Enemy (Brute)**:
- Integrated squad attack permissions
- Formation positioning
- Releases attack slot after slam

### ✅ Integration Points

1. **Level Generation** (`js/level.js`):
   - Enemies are organized into squads after room generation
   - Squad organization only happens for rooms 5+

2. **Main Game Loop** (`js/main.js`):
   - Squad manager updates each frame
   - Squad formations are recalculated periodically

3. **HTML Integration** (`index.html`):
   - Added `enemy-squad.js` script reference

## How It Works

### Squad Organization Flow

1. **Room Generation**: `generateRoom()` creates enemies
2. **Squad Assignment**: `SquadManager.organizeEnemiesIntoSquads()` groups enemies
3. **Formation Setup**: Each squad calculates formation positions
4. **Combat**: Enemies request attack permissions before attacking
5. **Update Loop**: Squads update formations and manage attack queues

### Attack Permission Flow

```
Enemy wants to attack
    ↓
Check if in range and cooldown ready
    ↓
Request attack permission from squad
    ↓
Squad checks if queue has space
    ↓
If yes: Add to queue, allow attack
If no: Deny, enemy backs off or maintains formation
    ↓
Attack completes
    ↓
Release attack permission
```

### Formation System

- Enemies maintain relative positions within their squad
- Formation radius varies by enemy type:
  - Ranged (Star): 150px (back line)
  - Elite (Octagon): 120px
  - Brute (Rectangle): 100px (front line)
  - Assassin (Diamond): 90px (flankers)
  - Swarmer (Circle): 80px (pressure)

## Remaining Work

### Enemy Types Needing Integration

**Star Enemy (Ranged)**:
- Add attack permission checks before shooting
- Formation positioning (should stay back)
- Coordinate with melee teammates

**Diamond Enemy (Assassin)**:
- Add attack permission checks before dash
- Flanking behavior when in squad
- Wait for openings when teammates are attacking

**Octagon Enemy (Elite)**:
- Enhanced squad leader behavior
- Coordinate special abilities (summoning, projectiles)
- Command other squad members

### Enhanced AI Behaviors

1. **Flanking Behavior**: Assassins and Swarmers should try to attack from sides
2. **Tactical Retreat**: Squads should back off when morale is low
3. **Wave Attacks**: Squads attack in waves (front row, then back row)
4. **Covering Fire**: Ranged enemies provide support while melee advances
5. **Pincer Moves**: Coordinated flanking attacks

### Visual Indicators (Optional)

- Squad indicators (colored outlines)
- Attack queue visualization (who's attacking)
- Formation lines (debug visualization)

## Testing Recommendations

1. **Early Rooms (1-4)**: Verify enemies attack independently (no coordination)
2. **Room 5**: Test squad formation activates correctly
3. **Room 5-9**: Verify only 1 enemy per squad attacks at a time
4. **Room 10+**: Verify 2 enemies can attack simultaneously
5. **Combat Feel**: Ensure attacks feel manageable and fair
6. **Formation**: Verify enemies maintain formation positions
7. **Squad Death**: Test morale system when squad members die

## Design Decisions

### Why Balanced Squads?

- Creates interesting tactical encounters
- Mix of enemy types provides variety
- Prevents single-enemy-type spam
- More engaging than same-type groups

### Why Progressive Difficulty?

- Allows players to learn mechanics gradually
- Prevents overwhelming early-game experience
- Scales difficulty smoothly with player progression
- Matches souls-like design philosophy

### Why Attack Queues?

- Prevents overwhelming simultaneous attacks
- Creates readable combat patterns
- Allows players to predict and counter
- Makes combat feel fair and skill-based

## Configuration Values

Key values that can be tuned:

- `maxAttackers`: Maximum simultaneous attackers per squad (currently 1-2)
- `squadSize`: Enemies per squad (currently 2-4)
- `formationRadius`: Distance from player for formation (varies by type)
- `coordinationLevel`: When coordination activates (currently room 5)

## Future Enhancements

1. **Squad Tactics**: Implement wave attacks, pincer moves, covering fire
2. **Squad Types**: Specialized squad compositions (all ranged, all melee, etc.)
3. **Leader Commands**: Elite enemies give tactical commands
4. **Squad Morale**: Affects behavior (aggressive when winning, defensive when losing)
5. **Cross-Squad Coordination**: Multiple squads coordinate attacks
6. **Environmental Awareness**: Squads use terrain and hazards strategically

## Notes

- Boss minions spawned dynamically are NOT added to squads (intentional - keeps them simple)
- Squad system is completely disabled for rooms 1-4
- Attack permissions are bypassed for early rooms (no squad = always allowed)
- Formation system blends with direct chase (30% toward player, 70% toward formation)


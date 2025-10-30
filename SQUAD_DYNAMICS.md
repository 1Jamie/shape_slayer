# Squad Dynamics and Reorganization System

## Overview

The squad system now includes dynamic reorganization to handle squad member deaths and maintain viable squad sizes throughout combat.

## Key Features

### 1. Progressive Coordination Start (Room 3)

**Why Room 3?**
- Rooms 1-2 only have melee enemies (basic circles)
- Room 3 introduces the second enemy type (Star/Ranged)
- This allows for mixed-type squads from the start of coordination
- Gives players 2 rooms to learn basic combat before coordination kicks in

**Coordination Levels:**
- **Rooms 1-2**: No coordination (individual AI)
- **Rooms 3-9**: Light coordination (2 enemies per squad, 1 attacker)
- **Rooms 10-14**: Medium coordination (3 enemies per squad, 1-2 attackers)
- **Rooms 15+**: Full coordination (4 enemies per squad, 2 attackers)

### 2. Dynamic Squad Reorganization

#### When Does Reorganization Happen?

Squads are checked every **1 second** for reorganization needs. A squad triggers reorganization if:
- It has only **1 alive member** remaining (too small to coordinate effectively)
- There are multiple small squads that can be merged

#### Consolidation Process (Merging, Not Rebuilding)

1. **Find Small Squads**: Identify squads with ≤1 alive member
2. **Find Nearest Squad**: For each small squad, find the nearest larger squad with available space
3. **Merge Members**: Move enemies from small squad into the nearest larger squad
4. **Remove Empty Squads**: Clean up empty squads after merging
5. **Assign Orphans**: Any enemies without squads are assigned to the nearest squad

**Key Difference**: Instead of destroying and rebuilding all squads, we merge small squads into nearby larger ones. This prevents enemies from having to move across the map and maintains their relative positions.

#### Prevention of Constant Reorganization

- Reorganization checks run only **once per second** (not every frame)
- Only reorganizes if we can form at least one viable squad
- Prevents reorganization if only one squad remains (even if small)

### 3. Death Handling

#### When an Enemy Dies

1. **Immediate Removal**: Enemy is marked as `alive = false`
2. **Squad Cleanup**: 
   - Removed from attack queue
   - Removed from squad members list
   - Attack slot is released
3. **Leader Selection**: If leader died, new leader is selected
4. **Morale Update**: Squad morale is recalculated
5. **Alive Count Update**: Squad's alive count is updated

#### Periodic Cleanup

- Every frame: Dead enemies are filtered from member lists
- Every second: Squad reorganization check runs
- Every update: Formation positions are recalculated

### 4. Squad Size Thresholds

**Minimum Viable Squad Size:**
- Rooms 1-2: 1 enemy (no coordination)
- Rooms 3+: 2 enemies (coordination requires at least 2)

**Reorganization Threshold:**
- Squad with 1 member triggers reorganization check
- Only reorganizes if multiple squads can be merged OR if it's the last squad

### 5. Implementation Details

#### Squad Manager Update Flow

```javascript
update(deltaTime, player, roomNumber) {
    1. Update each squad (formation, morale, etc.)
    2. Remove dead enemies from all squads
    3. Remove completely empty squads
    4. Check for reorganization (every 1 second)
    5. If reorganization needed, merge small squads
}
```

#### Consolidation Algorithm

```javascript
checkAndReorganize(roomNumber) {
    1. Assign orphaned enemies (not in any squad) to nearest squad
    2. Find all squads with <= 1 alive member
    3. For each small squad:
       - Find nearest larger squad with available space
       - Merge small squad members into nearest squad
    4. Remove empty squads after merging
    5. If no squads exist but multiple orphaned enemies:
       - Create new squad with orphaned enemies
}
```

## Benefits

1. **Maintains Combat Flow**: Squads stay viable even as members die
2. **Prevents Orphaned Enemies**: Single enemies automatically join other squads
3. **Balanced Encounters**: Mixed enemy types are maintained even after deaths
4. **Performance Optimized**: Checks run infrequently (1/second) to avoid overhead
5. **Natural Feel**: Players don't notice consolidation happening
6. **Visual Consistency**: Enemies merge into nearby squads, avoiding long-distance movement
7. **Position Preservation**: Enemies maintain their relative positions instead of teleporting across the map

## Edge Cases Handled

1. **Last Enemy Standing**: If only 1 enemy remains total, it becomes solo (no squad)
2. **All Enemies Die**: Empty squads are cleaned up automatically
3. **Room Transition**: Squads are completely reorganized on new room generation
4. **Boss Minions**: Dynamically spawned minions (from bosses) are NOT added to squads (intentional)

## Testing Recommendations

1. **Room 1-2**: Verify no squads are created
2. **Room 3**: Verify squads start forming with mixed types
3. **Squad Death**: Kill members one by one, verify reorganization happens
4. **Performance**: Ensure reorganization doesn't cause frame drops
5. **Edge Cases**: Test with 1 enemy left, all enemies dead, etc.

## Configuration

Key values that can be tuned:

- **Reorganization Check Interval**: Currently 1.0 second
- **Minimum Squad Size**: Currently 2 (for rooms 3+)
- **Reorganization Threshold**: Currently 1 alive member triggers check

## Future Enhancements

1. **Smarter Merging**: Prioritize merging squads with complementary enemy types
2. **Retreat Behavior**: Squads with low morale could retreat before reorganizing
3. **Formation Preservation**: Try to maintain relative positions during reorganization
4. **Visual Feedback**: Optional visual indicator when reorganization happens


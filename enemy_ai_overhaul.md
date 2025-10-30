# Enemy AI Overhaul - Design Document

## Current Problems Identified

1. **No Attack Coordination**: All enemies attack independently when in range, causing overwhelming simultaneous attacks
2. **No Group Behavior**: Enemies don't work together or coordinate movements
3. **Simple Patterns**: Basic chase → attack loops with no tactical depth
4. **Difficulty Spikes**: All enemies can attack at once, making combat unpredictable and frustrating
5. **No Progressive Difficulty**:- AI complexity doesn't scale with room progression

## Solution: Squad-Based Coordination System

### Core Concept
Enemies are organized into **Squads** (platoons/units) that coordinate their behavior. Only a limited number of enemies per squad can attack simultaneously, creating manageable combat encounters with tactical depth.

### Key Features

#### 1. Squad System
- **Squad**: A group of 2-5 enemies that coordinate together
- **Squad Leader**: One enemy per squad that makes tactical decisions
- **Attack Queue**: Only 1-2 enemies per squad can attack at once (depending on squad size)
- **Formation**: Enemies maintain relative positions within their squad

#### 2. Progressive Difficulty
- **Rooms 1-2**: Individual enemy AI (no squads) - Learning curve phase (only melee enemies)
- **Rooms 3-9**: Light coordination (2 enemies per squad, 1 attacker at a time) - Mixed enemy types start here
- **Rooms 10-14**: Medium coordination (3 enemies per squad, 1-2 attackers)
- **Rooms 15+**: Full coordination (4 enemies per squad, 2 attackers, advanced tactics)

#### 3. Grouping Strategy

**Balanced Squads** (Recommended):
- Mix of enemy types for tactical diversity
- Composition example: 1 Brute (tank), 1 Ranged (support), 1-2 Swarmers (pressure)
- Ensures variety and interesting combat encounters

**Same-Type Squads** (Secondary):
- Groups of identical enemies for specific challenges
- Example: "Swarmer Pack" (3-4 swarmers) or "Sniper Nest" (2-3 ranged)
- Can be used for specialized encounters

**Implementation**: Use balanced squads as default, but allow same-type squads for variety

#### 4. Enhanced AI Behaviors

**Individual Enemy Improvements**:
- **Swarmer (Circle)**: 
  - Flanking behavior (tries to attack from sides)
  - Backs off when teammate is attacking
  - Packs together in small groups

- **Ranged (Star)**:
  - Maintains formation distance
  - Supports melee teammates with covering fire
  - Repositions when threatened

- **Assassin (Diamond)**:
  - Waits for openings (when player is distracted)
  - Coordinates dash attacks with other assassins
  - Flanks while others engage

- **Brute (Rectangle)**:
  - Frontline tank that draws attention
  - Creates openings for teammates
  - Slow but methodical approach

- **Elite (Octagon)**:
  - Acts as squad leader when present
  - Coordinates special abilities
  - Commands other enemies

#### 5. Squad Tactics

**Basic Formation**:
- **Vanguard**: Brutes/Elites lead the charge
- **Center**: Swarmers/Ranged in middle
- **Flankers**: Assassins/Swarmers on sides

**Attack Patterns**:
- **Waves**: Squad attacks in waves (front row, then back row)
- **Pincer**: Flankers attack while front engages
- **Suppression**: Ranged covers while melee advances
- **Tactical Retreat**: Squad backs off when losing members

#### 6. Attack Queue System

**Rules**:
- Each squad has an attack queue (max attackers based on squad size)
- Enemies request attack permission from squad leader
- Leader grants permission based on:
  - Current queue status
  - Enemy type priority (tanks first, then damage dealers)
  - Distance to player
  - Cooldown status

**Queue Priorities**:
1. Brutes/Elites (tanks create openings)
2. Swarmers (melee pressure)
3. Assassins (burst damage opportunities)
4. Ranged (covering fire when melee engaged)

## Implementation Plan

### Phase 1: Squad Infrastructure
1. Create `EnemySquad` class
2. Add squad assignment on enemy spawn
3. Implement squad leader selection
4. Add squad member tracking

### Phase 2: Attack Queue System
1. Create attack request system
2. Implement queue management
3. Add priority-based attack selection
4. Add visual indicators for queued attacks

### Phase 3: Grouping Algorithm
1. Implement balanced squad generation
2. Add same-type squad option
3. Create squad size calculator (based on room number)
4. Handle squad formation on spawn

### Phase 4: Enhanced Individual AI
1. Add flanking behavior
2. Implement formation maintenance
3. Add tactical positioning
4. Enhance move sets with combo potential

### Phase 5: Progressive Difficulty
1. Add room-based coordination level
2. Implement early game simple AI (rooms 1-2: no coordination)
3. Scale coordination with room progression (starts at room 3)
4. Add cohesion levels (light → medium → full)
5. Dynamic squad reorganization when squads get too small

### Phase 6: Squad Tactics
1. Implement basic formations
2. Add attack patterns (waves, pincer, etc.)
3. Create tactical retreat behavior
4. Add squad morale system (performance affects behavior)

## Technical Details

### Squad Class Structure
```javascript
class EnemySquad {
    constructor(id, roomNumber) {
        this.id = id;
        this.members = [];
        this.leader = null;
        this.attackQueue = [];
        this.maxAttackers = 1; // Scales with room number
        this.coordinationLevel = 'none'; // 'none', 'light', 'medium', 'full'
        this.formation = 'balanced'; // 'balanced', 'same-type', 'vanguard', etc.
    }
    
    requestAttack(enemy) { /* ... */ }
    canAttack(enemy) { /* ... */ }
    updateFormation() { /* ... */ }
    selectLeader() { /* ... */ }
}
```

### Integration Points
- Modify `generateRoom()` in `level.js` to create squads
- Update enemy constructors to accept squad reference
- Modify enemy `update()` methods to check squad permissions
- Add squad update loop in main game loop

## Expected Outcomes

1. **Manageable Combat**: Attacks are staggered, preventing overwhelming simultaneous damage
2. **Tactical Depth**: Enemies work together, creating interesting combat scenarios
3. **Progressive Challenge**: Difficulty scales smoothly with player progression
4. **Predictable Patterns**: Players can learn and counter enemy tactics
5. **Souls-like Feel**: Grounded combat with readable attack patterns and fair difficulty

## Testing Strategy

1. Test early rooms (1-4) ensure simple AI works
2. Test transition at room 5 (coordination activates)
3. Test squad formation and attack queuing
4. Test various enemy type combinations
5. Test scaling through multiple rooms
6. Balance attack queue limits and timing
7. Verify difficulty feels fair but challenging


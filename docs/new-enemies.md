# Implementation Plan: Add 5 New Enemies with Progressive Introduction

## Overview

Add 5 new enemy types from ENEMY_IDEAS.md with progressive introduction and age-based intelligence scaling. New enemies will be introduced at specific room numbers and their intelligence will scale based on "enemy age" (rooms since introduction) rather than absolute room number.

## New Enemies to Implement

1. **Hexagon** (Basic tier) - Splitter type - Introduced at Room 2
2. **Trapezoid** (Mid tier) - Teleporter type - Introduced at Room 11
3. **Cross** (Mid tier) - Exploder type - Introduced at Room 13
4. **Gear** (High tier) - Turret type - Introduced at Room 15
5. **Arrow** (High tier) - Sniper type - Introduced at Room 17

## Implementation Steps

### 1. Modify Intelligence Scaling System

**File**: `js/enemies/enemy-base.js`

- Update `getIntelligenceLevel()` method to accept optional `introductionRoom` parameter
- Calculate intelligence based on enemy age: `enemyAge = currentRoom - introductionRoom`
- If `introductionRoom` is provided, use age-based scaling (0.5 base + age progression)
- If not provided, use existing absolute room-based scaling (backward compatibility)
- Each enemy constructor will pass its `introductionRoom` when calling `getIntelligenceLevel()`

**Key Changes**:

```javascript
getIntelligenceLevel(roomNumber, introductionRoom = null) {
    if (introductionRoom !== null) {
        // Age-based scaling: intelligence based on rooms since introduction
        const enemyAge = Math.max(0, roomNumber - introductionRoom);
        // Scale from 0.5 to 1.0 over ~15 rooms
        if (enemyAge <= 3) {
            return 0.5 + (enemyAge / 3) * 0.15;
        } else if (enemyAge <= 10) {
            return 0.65 + ((enemyAge - 3) / 7) * 0.2;
        } else {
            return 0.85 + Math.min((enemyAge - 10) / 10, 0.15);
        }
    }
    // Existing absolute room-based scaling (for backward compatibility)
    // ... existing code ...
}
```

### 2. Create New Enemy Files

#### 2.1 Hexagon Enemy (Splitter)

**File**: `js/enemies/enemy-hexagon.js`

- **Introduction Room**: 2
- **Tier**: Basic (1.0x difficulty)
- **Mechanic**: Splits on death into 2 smaller hexagons (can split once more)
- **Stats**: HP: 30, Damage: 5, Speed: 120, Size: 18
- **Color**: Green (#4ade80)
- **Intelligence Thresholds**: Basic features from room 2, advanced patterns unlock progressively
- Reference `enemy-basic.js` for structure, add split mechanic in `die()` method

#### 2.2 Trapezoid Enemy (Teleporter)

**File**: `js/enemies/enemy-trapezoid.js`

- **Introduction Room**: 11
- **Tier**: Mid (1.4x difficulty)
- **Mechanic**: Short-range teleport with brief telegraph, then melee strike
- **Stats**: HP: 45, Damage: 7, Speed: 100 (base), 500 (teleport dash)
- **Color**: Magenta (#ec4899)
- **Intelligence Thresholds**: Teleport unlocks at room 11, chain teleports at room 13+
- Reference `enemy-diamond.js` for dash/teleport mechanics

#### 2.3 Cross Enemy (Exploder)

**File**: `js/enemies/enemy-cross.js`

- **Introduction Room**: 13
- **Tier**: Mid (1.4x difficulty)
- **Mechanic**: Explodes on death in cross pattern (4 directions), can self-destruct at low HP
- **Stats**: HP: 35, Damage: 8 (contact), 12 (explosion), Speed: 80, Size: 24
- **Color**: Dark Red (#dc2626)
- **Intelligence Thresholds**: Explosion unlocks at room 13, tactical detonation at room 15+
- Reference existing explosion mechanics in `enemy-base.js` and room modifiers

#### 2.4 Gear Enemy (Turret)

**File**: `js/enemies/enemy-gear.js`

- **Introduction Room**: 15
- **Tier**: High (2.2x difficulty)
- **Mechanic**: Can anchor in place (stationary turret mode) with 2x attack speed, 360° rotation, rapid projectiles
- **Stats**: HP: 100, Damage: 9 (melee), 6 (projectile), Speed: 0 (stationary), 50 (moving), Size: 30
- **Color**: Dark Gray (#4b5563)
- **Intelligence Thresholds**: Turret mode unlocks at room 15, anchor teleport at room 20+
- Reference `enemy-star.js` for projectile mechanics, `enemy-octagon.js` for elite structure

#### 2.5 Arrow Enemy (Sniper)

**File**: `js/enemies/enemy-arrow.js`

- **Introduction Room**: 17
- **Tier**: High (2.2x difficulty)
- **Mechanic**: Charged snipe with long telegraph (red laser line), very fast piercing projectile
- **Stats**: HP: 85, Damage: 15, Speed: 120, Size: 20
- **Color**: Yellow-Gold (#eab308)
- **Intelligence Thresholds**: Snipe unlocks at room 17, ricochet at room 22+
- Reference `enemy-star.js` for ranged mechanics, add charge/telegraph system

### 3. Update Enemy Spawning Logic

**File**: `js/level.js`

- Define introduction rooms for all enemy types:
  ```javascript
  const ENEMY_INTRODUCTION_ROOMS = {
      'basic': 1,      // Enemy (Circle)
      'star': 3,       // StarEnemy
      'diamond': 5,    // DiamondEnemy
      'rectangle': 7,  // RectangleEnemy
      'hexagon': 2,    // HexagonEnemy (NEW)
      'octagon': 9,    // OctagonEnemy
      'trapezoid': 11, // TrapezoidEnemy (NEW)
      'cross': 13,     // CrossEnemy (NEW)
      'gear': 15,      // GearEnemy (NEW)
      'arrow': 17      // ArrowEnemy (NEW)
  };
  ```

- Update enemy selection logic (lines 426-479) to include new enemies:
  - Room 2: Add Hexagon (mix with Basic)
  - Room 11: Add Trapezoid (mix with existing types)
  - Room 13: Add Cross (mix with existing types)
  - Room 15: Add Gear (mix with existing types, adjust octagon chance)
  - Room 17: Add Arrow (mix with existing types, adjust octagon chance)

- Pass `introductionRoom` to enemy constructors or set it after construction

### 4. Update Enemy Difficulty Multipliers

**File**: `js/gear.js`

- Add new enemy types to `ENEMY_DIFFICULTY` object:
  ```javascript
  const ENEMY_DIFFICULTY = {
      basic: { multiplier: 1.0, name: 'basic' },
      hexagon: { multiplier: 1.0, name: 'basic' },      // NEW
      diamond: { multiplier: 1.4, name: 'diamond' },
      star: { multiplier: 1.4, name: 'star' },
      trapezoid: { multiplier: 1.4, name: 'mid' },        // NEW
      cross: { multiplier: 1.4, name: 'mid' },            // NEW
      rectangle: { multiplier: 1.4, name: 'mid' },
      octagon: { multiplier: 2.2, name: 'elite' },
      gear: { multiplier: 2.2, name: 'elite' },          // NEW
      arrow: { multiplier: 2.2, name: 'elite' },         // NEW
      boss: { multiplier: 3.5, name: 'boss' }
  };
  ```


### 5. Update Multiplayer Sync

**File**: `js/enemies/enemy-base.js`

- Update `deserializeEnemy()` method (around line 3638) to handle new enemy types:
  - Add cases for `HexagonEnemy`, `TrapezoidEnemy`, `CrossEnemy`, `GearEnemy`, `ArrowEnemy`
  - Ensure proper class instantiation for each type

### 6. Update HTML Includes

**File**: `index.html`

- Add script tags for new enemy files after existing enemy includes (after line 85):
  ```html
  <script src="js/enemies/enemy-hexagon.js"></script>
  <script src="js/enemies/enemy-trapezoid.js"></script>
  <script src="js/enemies/enemy-cross.js"></script>
  <script src="js/enemies/enemy-gear.js"></script>
  <script src="js/enemies/enemy-arrow.js"></script>
  ```


### 7. Update Enemy Base Constructor

**File**: `js/enemies/enemy-base.js`

- Modify constructor to accept and store `introductionRoom`:
  ```javascript
  constructor(x, y, inheritedTarget = null, introductionRoom = null) {
      // ... existing code ...
      this.introductionRoom = introductionRoom;
      this.intelligenceLevel = this.getIntelligenceLevel(this.roomNumber, introductionRoom);
      // ... rest of constructor ...
  }
  ```

- Update all existing enemy constructors to pass their introduction room when calling `super()`

## Testing Considerations

1. Verify new enemies spawn at correct room numbers
2. Verify intelligence scaling starts low for new enemies and increases over time
3. Verify split mechanic works for Hexagon (including nested splits)
4. Verify teleport telegraph and mechanics for Trapezoid
5. Verify explosion patterns for Cross (cross-shaped, 4 directions)
6. Verify turret anchoring/unanchoring for Gear
7. Verify charge/telegraph system for Arrow sniper shots
8. Test multiplayer sync for all new enemy types
9. Verify loot drops scale correctly with new enemy difficulty multipliers

## Files to Create

- `js/enemies/enemy-hexagon.js`
- `js/enemies/enemy-trapezoid.js`
- `js/enemies/enemy-cross.js`
- `js/enemies/enemy-gear.js`
- `js/enemies/enemy-arrow.js`

## Files to Modify

- `js/enemies/enemy-base.js` (intelligence scaling, constructor, multiplayer sync)
- `js/level.js` (enemy spawning logic)
- `js/gear.js` (difficulty multipliers)
- `index.html` (script includes)
- All existing enemy files (pass introductionRoom to super constructor)
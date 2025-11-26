# Balancing Analysis: Room 1-20

## Current Balancing Numbers

### Player Base Stats
- **Warrior/Rogue/Tank Base Damage:** 12
- **Mage Base Damage:** 10
- **Base HP:** 100 (Warrior/Tank: 100, Tank: 150)
- **Base Defense:** 0-15% (class-dependent)

### Enemy Base Stats
- **Basic (Circle):** 40 HP, 7 damage
- **Diamond:** 35 HP, 6 damage (with 0.65x damage scaling multiplier)
- **Rectangle:** 100 HP, 8 damage
- **Star:** (not shown, but similar to basic)
- **Octagon:** (elite, higher HP)

### Enemy Scaling (Per Room)
- **HP Growth:** 11% per room (compounded)
- **Damage Growth:** 13% per room (compounded)
- **Formula:** `Math.pow(1.11, roomIndex)` for HP, `Math.pow(1.13, roomIndex)` for damage

### Room-by-Room Enemy HP Multipliers
| Room | HP Multiplier | Example: Rectangle (100 base) | Example: Basic (40 base) |
|------|---------------|-------------------------------|--------------------------|
| 1    | 1.00x         | 100 HP                        | 40 HP                    |
| 5    | 1.68x         | 168 HP                        | 67 HP                    |
| 10   | 2.84x         | 284 HP                        | 114 HP                   |
| 15   | 4.78x         | 478 HP                        | 191 HP                   |
| 20   | 8.06x         | 806 HP                        | 322 HP                   |

### Room Type Modifiers
- **Elite:** +15% HP/damage
- **Challenge:** +30% HP/damage
- **Rest:** -20% HP/damage
- **Purification:** +25% HP/damage
- **Bonus Slot:** +50% HP/damage

### Room Modifier Cards (Enemy Buffs)
- **Elite Armor:** +10% to +50% enemy HP (white to orange)
- **Swift Assault:** +10% to +50% enemy speed
- **Volatile Spawn:** 20% to 60% chance enemies explode on death
- **Shielded Brood:** 10% to 50% of enemies have shields
- **Double Trouble:** Double enemy count

### Player Damage Scaling (Cards Only)
**Offense Cards:**
- **Precision:** +5% to +25% crit chance (stackable, max 4 copies)
  - Max potential: +100% crit chance (4x orange)
- **Fury:** +15% to +75% crit damage (stackable, max 4 copies)
  - Max potential: +300% crit damage (4x orange)
  - Base crit damage: 1.5x (50% bonus)
- **Momentum:** +2% to +10% damage per kill (stackable, max 3 copies)
  - Max potential: +30% damage per kill (3x orange)
  - Caps at 30% (orange), 25% (purple), 20% (blue), 15% (green), 10% (white)
- **Overcharge:** +15% to +35% burst damage every 2-5s (non-stacking, max 2 copies)
- **Volley:** +1 to +3 projectiles, but -40% to -37.5% damage per projectile
- **Velocity (Purple/Orange):** +5% to +10% damage from movement speed

**Effective Damage Calculation:**
- Base damage: 12 (or 10 for mage)
- Crit chance: 0% base + card bonuses
- Crit damage: 1.5x base + card bonuses
- Average damage per hit = base × (1 + critChance × (critDamage - 1))
- With 4x orange Precision (+100% crit) and 4x orange Fury (+300% crit damage):
  - Crit chance: 100%
  - Crit damage: 1.5 + 3.0 = 4.5x
  - Average damage: 12 × 4.5 = 54 damage per hit

### Time-to-Kill Analysis

**Room 1 (Rectangle, 100 HP):**
- Player damage: 12 base
- Hits needed: 9 hits
- With max cards (4x orange Precision + 4x orange Fury): 2 hits

**Room 10 (Rectangle, 284 HP):**
- Player damage: 12 base
- Hits needed: 24 hits
- With max cards: 6 hits

**Room 20 (Rectangle, 806 HP):**
- Player damage: 12 base
- Hits needed: 68 hits
- With max cards: 15 hits

**Problem:** Players are unlikely to have max cards by room 20, and even with max cards, TTK increases dramatically.

## The Core Problem

1. **Enemy HP scales exponentially** (11% per room = 8.06x by room 20)
2. **Player damage does NOT scale** (stays at 12 base, only cards provide scaling)
3. **Card acquisition is RNG-dependent** - players may not get good damage cards
4. **Room modifier cards can make enemies even tankier** (+50% HP from Elite Armor)
5. **No weapon swapping** means no guaranteed damage progression

## Recommended Solutions

### Solution 1: Add Base Damage Scaling Per Room (Recommended)
**Add a small base damage increase per room to match enemy HP scaling:**

```javascript
// In player-base.js or level.js
const PLAYER_DAMAGE_GROWTH_PER_ROOM = 0.05; // 5% per room (half of enemy HP growth)

// Apply when entering a room
player.baseDamage = player.initialBaseDamage * Math.pow(1.05, roomNumber - 1);
```

**Room-by-Room Player Damage:**
| Room | Damage Multiplier | Warrior Damage | Mage Damage |
|------|-------------------|----------------|-------------|
| 1    | 1.00x             | 12             | 10          |
| 5    | 1.22x             | 14.6           | 12.2        |
| 10   | 1.55x             | 18.6           | 15.5        |
| 15   | 1.98x             | 23.8           | 19.8        |
| 20   | 2.52x             | 30.2           | 25.2        |

**Benefits:**
- Guaranteed damage progression regardless of card RNG
- Maintains power fantasy (player gets stronger)
- Keeps TTK reasonable even without optimal cards
- Still rewards good card builds (they stack multiplicatively)

### Solution 2: Reduce Enemy HP Scaling
**Reduce enemy HP growth from 11% to 7-8% per room:**

```javascript
const ENEMY_HP_GROWTH_PER_ROOM = 0.07; // 7% per room (down from 11%)
```

**New Room-by-Room Enemy HP Multipliers:**
| Room | HP Multiplier (7%) | Rectangle HP |
|------|-------------------|--------------|
| 1    | 1.00x             | 100          |
| 5    | 1.40x             | 140          |
| 10   | 1.97x             | 197          |
| 15   | 2.76x             | 276          |
| 20   | 3.87x             | 387          |

**Benefits:**
- Easier to balance (less extreme scaling)
- More forgiving for players with bad card RNG
- Still maintains difficulty curve

**Drawbacks:**
- May make game too easy with good cards
- Doesn't solve the "no power progression" feeling

### Solution 3: Hybrid Approach (BEST)
**Combine both solutions:**
1. Add 4-5% base damage scaling per room
2. Reduce enemy HP scaling from 11% to 8-9% per room
3. Adjust room modifier cards to be less punishing

**Recommended Values:**
```javascript
const PLAYER_DAMAGE_GROWTH_PER_ROOM = 0.04; // 4% per room
const ENEMY_HP_GROWTH_PER_ROOM = 0.08;      // 8% per room (down from 11%)
```

**Resulting Balance:**
| Room | Player Damage | Enemy HP (Rectangle) | TTK (hits) | TTK with Max Cards |
|------|---------------|---------------------|------------|-------------------|
| 1    | 12            | 100                 | 9          | 2                 |
| 5    | 14.0          | 147                 | 11         | 3                 |
| 10   | 16.6          | 216                 | 13         | 4                 |
| 15   | 19.7          | 317                 | 16         | 6                 |
| 20   | 23.4          | 466                 | 20         | 9                 |

**Benefits:**
- Maintains challenge while ensuring progression
- Cards still matter significantly
- Power fantasy preserved
- More balanced overall

### Solution 4: Adjust Room Modifier Cards
**Reduce Elite Armor bonuses:**
- White: +5% HP (down from +10%)
- Green: +10% HP (down from +20%)
- Blue: +15% HP (down from +30%)
- Purple: +20% HP (down from +40%)
- Orange: +30% HP (down from +50%)

**Reasoning:**
- Room modifiers should add challenge, not make enemies unkillable
- Current values stack multiplicatively with room scaling, making enemies too tanky

### Solution 5: Add Damage Scaling to Level-Ups
**Currently, level-ups only give small stat bonuses. Add damage scaling:**

```javascript
// In player-base.js levelUp() function
const DAMAGE_PER_LEVEL = 0.3; // +0.3 damage per level
this.baseDamage += DAMAGE_PER_LEVEL;
```

**Benefits:**
- Rewards XP gain and leveling
- Provides steady progression
- Complements card system

## Recommended Implementation Priority

1. **Immediate:** Implement Solution 3 (Hybrid Approach)
   - Add 4% base damage scaling per room
   - Reduce enemy HP scaling to 8% per room
   - This fixes the core issue quickly

2. **Short-term:** Adjust room modifier cards (Solution 4)
   - Reduce Elite Armor bonuses
   - Makes modifier cards more balanced

3. **Medium-term:** Add level-up damage scaling (Solution 5)
   - Provides additional progression path
   - Rewards XP farming

4. **Long-term:** Consider card rebalancing
   - Ensure damage cards are competitive with utility cards
   - May need to buff weaker offense cards

## Testing Recommendations

After implementing changes, test:
1. **Room 1-5:** Should feel similar to current (early game)
2. **Room 6-10:** Should feel slightly easier (better scaling)
3. **Room 11-15:** Should feel balanced (not too hard, not too easy)
4. **Room 16-20:** Should feel challenging but fair (not frustrating)

**Key Metrics:**
- Time-to-kill for basic enemies (should stay under 3-5 seconds)
- Time-to-kill for elite enemies (should stay under 8-12 seconds)
- Player death rate (should decrease slightly)
- Card effectiveness (damage cards should feel impactful)

## Additional Considerations

### Card Balance
- **Momentum** is currently the only reliable damage scaling card
- **Precision + Fury** combo is powerful but requires 8 card slots
- Consider adding more damage-scaling cards or buffing existing ones

### Room Modifier Balance
- **Elite Armor** is too punishing when combined with room scaling
- **Double Trouble** doubles enemy count AND rewards - may need adjustment
- Consider making modifier cards less extreme

### Boss Scaling
- Bosses scale at 12% HP per room (slightly higher than normal enemies)
- May need adjustment if normal enemy scaling changes
- Current: Boss HP = base × 12 × room scaling

## Conclusion

The core issue is that **enemy HP scales exponentially while player damage stays flat**. The recommended solution is to:

1. **Add 4% base damage scaling per room** (guaranteed progression)
2. **Reduce enemy HP scaling to 8% per room** (less extreme scaling)
3. **Adjust room modifier cards** (less punishing)

This maintains the challenge while ensuring players feel powerful progression, which is essential for the roguelike power fantasy.




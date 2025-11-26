# Item System - Quick Reference

## Item Reward Integration

### Drop Rates (when Item reward selected)
- **Common**: 60% (6 items: 1, 2, 3, 10, 11, 17)
- **Uncommon**: 25% (10 items: 4, 5, 6, 7, 12, 13, 14, 18, 19, 20)
- **Rare**: 12% (7 items: 8, 9, 15, 16, 21, 23, 24)
- **Epic**: 3% (4 items: 25, 26, 27, 28)

### Reward Type Probabilities (Updated)
| Pack Type | Card | Upgrade | Shard | **Item** |
|-----------|------|---------|-------|----------|
| Standard  | 15%  | 50%     | 25%   | **10%**  |
| Elite     | 25%  | 40%     | 25%   | **10%**  |
| Treasure  | 35%  | 35%     | 20%   | **10%**  |
| Challenge | 45%  | 30%     | 15%   | **10%**  |
| Boss      | 100% | 0%      | 0%    | **0%**   |

**Result**: ~0.25 item opportunities per room, ~5 items per 32-room run

**Item Selection**: When "Item" reward is selected, player gets **3 different item options** to choose from (ensures build agency despite rarity)

---

## 27 Item Ideas

### Offensive Items (9)

#### Common
1. **Fractal Shard** - +10% damage per stack
2. **Critical Lens** - +5% crit chance, +10% crit damage per stack
3. **Fury Catalyst** - +5% attack speed, +2% damage per stack

#### Uncommon
4. **Chain Reaction** - On kill: 15% max HP as AoE damage (50px radius)
5. **Bleeding Edge** - Attacks apply 2% max HP/sec bleed for 3s (stacks 5x)
6. **Executioner's Mark** - +25% damage to enemies below 30% HP (up to 50% threshold)
7. **Damage Aura** - Enemies within 60px take 2% max HP/sec damage

#### Rare
8. **Volatile Core** - 10% chance on hit to explode (50% damage, 40px radius)
9. **Piercing Strike** - Attacks pierce 1 enemy (80% damage to second target)

### Defensive Items (7)

#### Common
10. **Reactive Armor** - When hit: +5% damage reduction for 2s (stacks to 25%)
11. **Regenerative Matrix** - Regenerate 1% max HP per second

#### Uncommon
12. **Shield Generator** - Shield = 10% max HP, regenerates after 5s no damage
13. **Thornmail Fragment** - Reflect 10% damage taken
14. **Slow Aura** - Enemies within 80px slowed by 15% movement speed

#### Rare
15. **Second Wind** - Below 25% HP: +20% damage, +15% reduction for 5s (once/room)
16. **Absorption Field** - 15% chance to absorb projectiles → +5% max HP (up to 150%)

### Utility Items (5)

#### Common
17. **Speed Boost Module** - +8% movement speed per stack

#### Uncommon
18. **Cooldown Reducer** - -5% cooldown reduction per stack (multiplicative)
19. **XP Amplifier** - +15% XP gain per stack

#### Rare
21. **Dodge Enhancer** - +0.5s invulnerability after dodge, +10% dodge distance

### Synergy Items (6)

#### Rare
23. **Card Synergy Core** - +2% damage per card in hand, +1% reduction per card
24. **Level Synergy Core** - +2% damage per level, +1% reduction per level

#### Epic
25. **Kill Streak Amplifier** - Each kill in 2s: +3% damage (stacks to +30%, resets after 3s)
26. **Combo Master** - Consecutive hits: +5% damage per hit (stacks to +50%)
27. **Adaptive Evolution** - After damage: +5% reduction, +3% damage for 4s (stacks 3x)
28. **Lucky Charm** - +5% item drop chance, +10% rare item chance

---

## Power Budget

### Item vs Card Comparison
- **1 Common Item** ≈ 0.3-0.5 blue cards
- **1 Uncommon Item** ≈ 0.5-0.7 blue cards
- **1 Rare Item** ≈ 0.7-1.0 blue cards
- **1 Epic Item** ≈ 1.0-1.5 blue cards

### Expected Power Per Run
- **Early (Rooms 1-10)**: 0-2 items = +5-15% power
- **Mid (Rooms 11-20)**: 2-4 items = +15-30% power
- **Late (Rooms 21-32)**: 4-7 items = +30-60% power

### Total Power Distribution
- **Cards**: ~60-70% of power (primary)
- **Items**: ~20-30% of power (secondary)
- **Leveling**: ~10-15% of power

---

## Stacking Rules

### Additive Stacking
- Simple stat boosts: +10% per stack
- Examples: Fractal Shard, Speed Boost Module, XP Amplifier, Damage Aura, Slow Aura

### Multiplicative Stacking
- Cooldown reduction: 0.95^n (each stack multiplies)
- Examples: Cooldown Reducer

### Diminishing Returns
- Powerful effects: First +10%, second +8%, third +6%
- Examples: (Optional - for balance if needed)

### Caps
- Maximum limits: +50% damage from one item type
- Examples: (Optional - for balance if needed)

---

## Implementation Checklist

- [ ] Create item data structure (similar to cards)
- [ ] Implement item inventory (Game.runItems = [])
- [ ] Hook items into player stat calculation
- [ ] Add items to door option generation (10% chance)
- [ ] Create item UI (HUD display)
- [ ] Implement stacking logic
- [ ] Add visual feedback (particles, effects)
- [ ] Balance item power levels
- [ ] Playtest across all room ranges
- [ ] Adjust based on feedback

---

## Key Metrics to Monitor

1. **Item Acquisition Rate**: ~5 items per run (target)
2. **Power Contribution**: Items = 20-30% of total power
3. **Win Rate Impact**: Should improve consistency, not make game trivial
4. **Build Diversity**: More viable builds with items
5. **Player Satisfaction**: Items feel impactful but not overpowered


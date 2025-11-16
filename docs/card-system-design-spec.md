# Card Deck System - Design Specification

## Overview

This document outlines the complete design for replacing the gear/loot system with a card-based progression system. Cards serve as the primary means of character progression, run customization, and meta-progression. The system is designed to work seamlessly in both single-player and multiplayer (1-4 players) scenarios.

## Core Concepts

### Card System Philosophy
- **Cards replace gear**: All stat bonuses, ability modifications, and special effects come from cards
- **Progressive power**: Players start with weak cards and build power throughout the run
- **Strategic choices**: Room selection determines card pack rewards, creating meaningful decisions
- **Meta-progression**: Cards unlock and upgrade permanently, creating long-term progression
- **Balanced scaling**: All cards have trade-offs to prevent overpowered combinations

### Key Design Principles
1. **No broken starts**: Players begin with low-quality cards, preventing steamroll runs
2. **Meaningful progression**: Each room offers card choices that meaningfully impact gameplay
3. **Strategic depth**: Card selection and room choice create interesting trade-offs
4. **Multiplayer synergy**: Team cards and shared card pools encourage cooperation
5. **Balanced power**: All powerful effects have corresponding drawbacks or limitations

### Key Terms & Definitions

**Quality Band**: The tier system for card power levels. Five tiers exist:
- **White** (Common): Basic quality, lowest power
- **Green** (Uncommon): Improved quality, moderate power
- **Blue** (Rare): High quality, significant power
- **Purple** (Epic): Very high quality, powerful effects
- **Orange** (Legendary): Maximum quality, game-changing effects

**Quality Shift**: A percentage modifier that shifts the probability distribution toward higher quality bands. For example, "+10% quality shift" means the probability of rolling higher quality bands (green/blue/purple/orange) increases by 10%, with corresponding decreases in lower quality bands. Quality shifts only affect distribution within unlocked quality bands (see Mastery Cap).

**Mastery Cap**: The maximum quality band a card can appear at based on its mastery level. Cards can only appear in packs at quality bands you've unlocked through mastery:
- Mastery 0: White only
- Mastery 1: White or Green
- Mastery 2: White, Green, or Blue
- Mastery 3: White, Green, Blue, or Purple
- Mastery 4: White, Green, Blue, Purple, or Orange
- Mastery 5: All quality bands unlocked (maximum)

**Bonus Cards**: Additional card offers added to packs. When a room modifier or pack type grants "+1 bonus card", it means one additional card is added to the pack's card selection (e.g., a pack that normally offers 1 card now offers 2 cards).

**Hand Size**: The maximum number of card slots available in the player's hand during a run. Default is 4, upgradeable via meta-progression. Cards beyond hand size cannot be held.

**Starting Cards**: The number of cards drawn from the deck at the start of a run. Default is 3, upgradeable to 4 (cannot exceed hand size). These cards are drawn using a mastery-adjusted starting distribution that respects player investment (see Quality Distribution Curves section for mastery floor system).

**Reserve Slots**: Storage slots for cards outside the hand. Cards in reserve are not active but can be swapped into the hand later. Unlocked via meta-progression (Room 30 milestone or purchase).

**Draw Pile**: Cards remaining to be drawn from the deck during the run. When empty, the discard pile is shuffled into the draw pile (except for spent cards).

**Discard Pile**: Cards that have been discarded from the hand. These cards can be reshuffled back into the draw pile when the draw pile is empty. Cards originally from the deck reshuffle; picked-up cards do not.

**Spent Pile**: Cards permanently removed from the run (one-time use cards like Phoenix Down, consumed room modifiers). These cards never return to the draw pile.

**Reroll Token**: A consumable item that allows rerolling a card's quality band once per run. When used, the card's quality is re-rolled using the current room's quality distribution (still capped by mastery level). Granted at mastery levels 2, 4, and 5.

**Non-Stacking**: A card property indicating only one copy of that card can be in the hand at a time. If a non-stacking card is already in hand, attempts to draw or pick up another copy will either be rejected or swap with the existing copy.

**Guaranteed**: A modifier indicating a card or quality band is certain to appear, bypassing normal probability distribution. For example, "guaranteed rare card" means at least one blue/purple/orange card will appear in the pack.

**Upgrade Reward**: A reward type from packs that allows upgrading a card in hand by one quality band (white→green, green→blue, etc.) **for this run only** OR grants shards as an alternative. Players choose which card to upgrade. **Important**: This does NOT grant a permanent mastery unlock - it's a temporary in-run buff. To permanently unlock quality bands, use shard purchases at Nexus or boss drops.

**Purification**: A special mechanic for removing curse cards. Curses cannot be voluntarily discarded and must be removed through:
- **Purification Room**: A special room type that removes all curses
- **Purification Scroll**: A consumable item that removes one curse
- **Boss Clear Reward**: Some bosses offer curse removal as a reward option

**Successful Run**: A run that counts toward progression unlocks. A run is successful if it ends by:
- **Beating the final boss** (Room 32 boss) - Run completed successfully
- **Dying** - Player death at any point in the run (including before reaching final boss) ends the run and counts toward progression
- **Does NOT count**: Quitting a run manually, restarting a run, or abandoning a run

**Cumulative Achievement**: An achievement tracked across all runs (lifetime). Progress accumulates over multiple runs and persists between runs. Examples: "Clear 30 rooms total (cumulative)", "Deal 10,000 damage (lifetime)", "After 3 successful runs".

**Single-Run Achievement**: An achievement that must be completed in one run. Progress resets at the start of each new run. Examples: "Achieve 100 kills in one run", "Complete flawless room", "Reach room 20 without taking damage".

**Boss Tier**: The difficulty category of boss encounters, aligned with room progression:
- **First Boss (Room 12)**: Entry-level boss, drops Green minimum (no White drops), unlocks Mastery 1
- **Second Boss (Room 22)**: Mid-level boss, drops Blue minimum, unlocks Mastery 2
- **Final Boss (Room 32)**: End-level boss, drops Purple/Orange minimum, unlocks Mastery 3-4

**Card Pack / Pack Type**: A reward container that offers cards or upgrades after clearing a room. Different pack types have different reward distributions:
- **Standard Pack**: Basic card/upgrade rewards
- **Elite Pack**: Improved quality distribution, better rewards
- **Boss Pack**: Guaranteed card unlock, high quality distribution
- **Upgrade Pack**: Focuses on upgrades rather than new cards
- **Shard Pack**: Grants shards for meta-progression

**Door Option**: A choice presented to players after clearing a room. Each door represents a different card pack reward. Players select which door/pack they want, determining their reward. Doors show preview information (pack type, card previews, bonus rewards).

**Room Modifier**: A special card type that modifies the next room when used. Room modifiers are single-use, persistent cards that can be carried on runs (max 3) and stored in Nexus (max 30-40). They modify room difficulty, rewards, or enemy composition. Used before entering a room, consumed after use.

**Team Card**: A special card type for multiplayer (1-4 players) that provides run-wide boons for the entire team. Equipped before starting a run in the Nexus. Only one team card can be active per run. Team cards affect all players and can modify quality distributions, drop rates, or provide team-wide buffs.

**Combined Card**: A special card created during a run by combining two cards from the hand into one slot. Combined cards have both effects active simultaneously. They are single-run only (lost at run end), cannot be combined further (depth limit 1), and have 1.75x upgrade costs. Quality band is the average of both source cards (rounded down).

**Permanent Unlock vs. Temporary Power** (The "Unlock vs. Power" Model):
- **Permanent Unlocks**: Mastery levels unlocked via Boss drops or Shard purchases at Nexus. These persist across all future runs and allow cards to appear at higher quality bands in packs.
- **Temporary Power**: Cards dropped above mastery cap from Elite/Challenge packs, or cards upgraded via Upgrade Rewards. These provide powerful effects for the current run only and do NOT grant permanent mastery unlocks.
- **Why This Matters**: Creates clear distinction between meta-progression (permanent) and in-run power spikes (temporary), making each system feel valuable and non-conflicting.

---

## Phase 1: Data Structures & Save System

### 1.1 Card Data Schema

**File**: `js/cards/card-data.js`

```javascript
{
  id: string,                    // Unique identifier (e.g., "precision_001")
  family: string,                // Card family (e.g., "Precision", "Volley")
  name: string,                  // Display name
  category: string,              // Offense, Defense, Mobility, Ability, Economy, Enemy, Room, Team
  qualityBands: {
    white: { value: number, description: string, flavorText: string },
    green: { value: number, description: string, flavorText: string },
    blue: { value: number, description: string, flavorText: string, bonus?: object },
    purple: { value: number, description: string, flavorText: string, bonus?: object },
    orange: { value: number, description: string, flavorText: string, legendaryFlavor: string }
  },
  effectType: string,            // stat_modifier, ability_modifier, enemy_modifier, etc.
  effectTarget: string,          // What the effect modifies
  application: string,           // passive, active, conditional, trigger
  duration: string,              // persistent, room, encounter, one_time
  unlockCondition: object,       // How to unlock this card
  tradeOffs: object,             // Negative effects or limitations
  isCombined: boolean,           // true if this is a combined card (runtime-only, not saved)
  combinedFrom: [string, string], // If combined, array of two source card IDs (runtime-only, not saved)
  nonStacking: boolean,          // true if only one of this card can be in hand at a time
  isCurse: boolean               // true if this is a curse card (cannot be voluntarily discarded)
  // Note: Combined cards are single-run only and do not persist to save data or deck
  // Note: Curse cards cannot be voluntarily discarded and must be removed through special mechanics
}
```

### 1.2 Save System Extensions

**File**: `js/save.js` - Extend `SaveSystem.getDefaultSave()`

```javascript
{
  // ... existing save data ...
  
  // Card system
  cardsUnlocked: [],              // Array of card IDs player owns
  cardMastery: {},                // Map: cardId -> mastery level (0-5)
  deckConfig: {
    cards: [],                    // Array of card IDs in deck
    size: 20                      // Max deck size (upgradeable)
  },
  teamCardsUnlocked: [],          // Array of team card IDs
  activeTeamCard: null,           // Currently equipped team card
  cardShards: 0,                  // Currency for card upgrades
  deckUpgrades: {
    handSize: 4,                  // Max hand size (slots available)
    startingCards: 3,             // Number of cards drawn at run start (default 3, upgradeable to 4, max handSize)
    mulligans: 0,                 // Mulligan count (default 0, unlockable via meta-progression)
    reserveSlots: 0,              // Reserve card slots
    roomModifierCarrySlots: 3,    // Max room modifier cards carried on run
    cardCombinationUnlocked: false // Unlock ability to combine cards (late meta-progression)
  },
  roomModifierCollection: [],     // Room modifier cards stored in Nexus (max 20)
  
  // Migration data
  migratedFromGear: true          // Flag to prevent re-migration
}
```

### 1.3 Migration Strategy

- Convert existing gear saves to starter card unlocks
- Map highest tier gear owned → equivalent starter cards
- Provide fallback deck for new players (all white quality basics)
- One-time migration on first load after update

---

## Phase 2: Complete Card Catalog

### Card Application Types

All cards specify how they are applied and when they take effect:

- **Passive**: Always active once in hand. Modifies stats, abilities, or provides constant effects. Most cards are passive (e.g., Precision, Bulwark, Velocity).
- **Conditional Trigger**: Activates when specific conditions are met (e.g., on kill, on hit, on death, below HP threshold). Effect applies when condition is satisfied (e.g., Momentum, Execute, Fractal Conduit, Phoenix Down).
- **Active**: Player must manually activate/use the card (rare, typically for consumables or special abilities).
- **One-Time Use**: Card is consumed/destroyed after use (e.g., Reroll Token, Card Upgrade Voucher, room modifier cards, Phoenix Down). Cards can be both Conditional Trigger and One-Time Use (e.g., Phoenix Down triggers on death and is then destroyed).

**Duration Types**:
- **Persistent**: Effect lasts for entire run (most passive cards)
- **Room**: Effect lasts for one room only
- **Encounter**: Effect lasts for one combat encounter
- **Temporary**: Effect has a time duration (e.g., 3s, 5s)

### Non-Stacking Cards

Some cards are marked as **non-stacking**, meaning you can only have one copy of that card in your hand at a time. This prevents:
- Overpowered combinations (e.g., multiple Phoenix Down revives)
- Confusing mechanics (e.g., multiple multishot effects, multiple chain lightning effects)
- Ability modifier conflicts (e.g., multiple modifiers for the same ability)

**Non-stacking cards include**:
- **Volley** (multishot) - Can't have multiple projectile count modifiers
- **Execute** - Multiple execute thresholds would be confusing
- **Fractal Conduit** (chain lightning) - Multiple chain effects would conflict
- **Detonating Vertex** (explosive attacks) - Multiple explosion chances would stack confusingly
- **Overcharge** - Multiple timers would be confusing
- **Phoenix Down** - Multiple revives would be overpowered
- **Fortify Aura** - Multiple auras would conflict
- **Phasing** - Multiple phase chances would stack confusingly
- **All Ability Mutator cards** - Can't have multiple modifiers for the same ability

**Stacking cards** (can have multiple in hand):
- Stat modifiers (Precision, Fury, Bulwark, Lifeline, Velocity, etc.)
- Momentum (damage per kill stacks)
- Phase Step (dodge charges stack)
- Prism Shield (damage reflect stacks)
- Vector Laminar (projectile speed stacks)
- Arcane Flow (cooldown reduction stacks)
- Parallelogram Slip (dodge cooldown reduction stacks)

### 2.1 Offense Family Cards

#### Precision (from `critChance` affix)
- **Unlock**: ✅ Unlocked by default (Starter card)
- **Mastery Upgrade Costs**: M0→M1: 10 shards, M1→M2: 25 shards, M2→M3: 50 shards, M3→M4: 100 shards, M4→M5: 200 shards
- **Application**: Passive - Always active, modifies crit chance stat
- **White**: +5% crit chance - "Basic geometric precision" (No drawback - baseline card)
- **Green**: +10% crit chance - "Refined calculation" (No drawback - baseline card)
- **Blue**: +15% crit chance, -3% defense - "Advanced theorem" (Trade-off introduced at significant power level)
- **Purple**: +20% crit chance, -3% defense + "Crits restore 2% HP" - "Masterful application"
- **Orange**: +25% crit chance, -3% defense + "Crits restore 5% HP and apply 'Vulnerability', increasing all damage taken by 10% for 3s" - "Bend probability itself. Critical hits restore health and find the target's absolute weakness."
- **Trade-off**: -3% defense (introduced at Blue tier and above). Focus on precision offense comes at the cost of base protection. White/Green tiers are pure buffs to provide a consistent baseline.

#### Fury (from `critDamage` affix)
- **Unlock**: Room 10 milestone OR Purchase 30 shards
- **Mastery Upgrade Costs**: M0→M1: 10 shards, M1→M2: 25 shards, M2→M3: 50 shards, M3→M4: 100 shards, M4→M5: 200 shards
- **Application**: Passive - Always active, modifies crit damage multiplier
- **White**: +15% crit damage - "Sharpened edge" (No drawback - baseline card)
- **Green**: +30% crit damage - "Razor focus" (No drawback - baseline card)
- **Blue**: +45% crit damage, +3% damage taken - "Devastating strike" (Trade-off introduced at significant power level)
- **Purple**: +60% crit damage, +3% damage taken + "Crits have 10% chance to stun" - "Unstoppable force"
- **Orange**: +75% crit damage, +3% damage taken + "Critical hits explode, dealing 50% of the crit's damage in a small radius" - "Fury incarnate. Critical hits are so devastating they explode outward."
- **Trade-off**: +3% damage taken (introduced at Blue tier and above). Overwhelming offensive power makes you more vulnerable. White/Green tiers are pure buffs to provide a consistent baseline.

#### Momentum (from `rampage` affix)
- **Unlock**: Room 5 milestone OR Purchase 40 shards
- **Mastery Upgrade Costs**: M0→M1: 10 shards, M1→M2: 25 shards, M2→M3: 50 shards, M3→M4: 100 shards, M4→M5: 200 shards
- **Application**: Conditional trigger - Activates on kill, stacks damage bonus
- **White**: +2% damage per kill (cap 10%, duration 5s) - "Building rhythm"
- **Green**: +4% damage per kill (cap 15%, duration 6s) - "Gathering speed"
- **Blue**: +6% damage per kill (cap 20%, duration 7s) - "Unstoppable momentum"
- **Purple**: +8% damage per kill (cap 25%, duration 8s) + "Kills extend duration by 1s" - "Cascading power"
- **Orange**: +10% damage per kill (cap 30%, duration 10s) + "Kills extend duration and grant movement speed" - "Infinite acceleration. Each kill extends momentum and grants 5% movement speed."
- **Trade-off**: Stacks decay if no kills within duration window. Requires consistent kills to maintain stacks.

#### Volley (from `multishot` affix) - **BALANCED VERSION**
- **Unlock**: Room 25 milestone OR Purchase 150 shards OR Boss drop (Rooms 22+)
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Volley card can be in hand at a time
- **Application**: Passive - Always active, modifies projectile count and damage
- **White**: +1 projectile, -40% damage per projectile (2 total, 60% each = 120% total, +20% gain) - "Split shot"
- **Green**: +1 projectile, -35% damage per projectile (2 total, 65% each = 130% total, +30% gain) - "Twin volley"
- **Blue**: +2 projectiles total, -45% damage per projectile (3 total, 55% each = 165% total, +65% gain) - "Triple threat"
- **Purple**: +2 projectiles total, -40% damage per projectile (3 total, 60% each = 180% total, +80% gain) + "Projectiles have 25% pierce chance" - "Scattered barrage"
- **Orange**: +3 projectiles total, -37.5% damage per projectile (4 total, 62.5% each = 250% total, +150% gain) + "Projectiles pierce and chain" - "Fractal volley. Projectiles pierce all enemies and chain to nearby targets."

**Design Rationale**:
- More gradual progression: Each tier provides consistent incremental gains
- When adding projectiles (Blue, Orange), use higher damage reduction (-45%, -37.5%) to prevent power spikes
- When improving existing projectiles (Green, Purple), use lower reduction (-35%, -40%) for smoother scaling
- Blue tier uses -45% reduction to keep the 2→3 projectile jump reasonable (+35% gain vs +10% from White→Green)
- Orange tier's 250% total is balanced by requiring 4 enemies to maximize effectiveness and the high initial unlock cost

**Trade-off**: Reduced damage per projectile, increased spread angle, reduced range for multishot projectiles. Requires multiple enemies to maximize effectiveness.

#### Execute (from `execute` affix)
- **Unlock**: Achievement "Deal 10,000 damage (lifetime)" OR Purchase 125 shards
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Execute card can be in hand at a time
- **Application**: Conditional trigger - Activates when enemy HP falls below threshold
- **White**: Execute at 25% HP (bosses: 10% HP) - "Finishing blow"
- **Green**: Execute at 30% HP (bosses: 12% HP) - "Swift end"
- **Blue**: Execute at 35% HP (bosses: 15% HP) - "Merciless strike"
- **Purple**: Execute at 40% HP (bosses: 18% HP) + "Execute grants 10% movement speed for 3s" - "Absolute termination"
- **Orange**: Execute at 40% HP (bosses: 18% HP) + "Execute grants 15% movement speed for 5s" - "Geometric execution. Finishing blows grant speed and power."
- **Boss Scaling**: Execute thresholds are significantly lower for bosses to prevent trivializing boss fights. Bosses have approximately 37.5% of the normal threshold (e.g., 25% normal → 10% boss, 40% normal → 15% boss). Orange tier reduced from 50% to 40% to prevent skipping half of boss fights.
- **Trade-off**: Only triggers below threshold, requires precision timing. Lower thresholds on bosses maintain challenge while still providing value.

#### Fractal Conduit (from `chainLightning` affix)
- **Unlock**: Achievement "Clear 50 rooms total (cumulative)" OR Purchase 175 shards
- **Mastery Upgrade Costs**: M0→M1: 20 shards, M1→M2: 50 shards, M2→M3: 100 shards, M3→M4: 200 shards, M4→M5: 400 shards
- **Non-Stacking**: Yes - Only one Fractal Conduit card can be in hand at a time
- **Application**: Conditional trigger - Activates on hit, chains to nearby enemies
- **White**: Chains to 1 enemy (50% damage per chain) - "Single link" - Total: 150% damage potential
- **Green**: Chains to 2 enemies (55% damage per chain) - "Double chain" - Total: 210% damage potential
- **Blue**: Chains to 3 enemies (60% damage per chain) - "Triple link" - Total: 280% damage potential
- **Purple**: Chains to 4 enemies (65% damage per chain) + "Chains restore 2% HP" - "Cascading energy" - Total: 360% damage potential
- **Orange**: Chains to 5 enemies (70% damage per chain) + "Chains restore 5% HP and extend range" - "Infinite recursion. Lightning chains restore health and seek distant targets." - Total: 450% damage potential

**Balance Analysis**:
- Each chain link deals reduced damage from the initial hit (50-70% depending on quality)
- Total damage potential scales from 150% (white) to 450% (orange) when hitting maximum chain targets
- The decreasing reduction percentage (-50% to -30%) ensures later chains remain useful rather than becoming negligible
- Orange tier's 450% potential is powerful but balanced by: requiring 6+ enemies, sequential chaining (not simultaneous), and the rarity of having that many enemies clustered

**Trade-off**: Reduced damage per chain, requires multiple enemies. Chain is 1 → 1 → 1 (sequential, not simultaneous). Cannot hit the same enemy twice until legendary, and even then only once more after bouncing to another enemy first. Requires enemy clustering to maximize effectiveness.

#### Detonating Vertex (from `explosiveAttacks` affix)
- **Unlock**: Achievement "Achieve 100 kills in one run" OR Purchase 100 shards
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Detonating Vertex card can be in hand at a time
- **Application**: Conditional trigger - Random chance on hit to trigger explosion
- **White**: 12% chance to explode (50% AoE damage) - "Unstable geometry"
- **Green**: 18% chance to explode (60% AoE damage) - "Volatile strike"
- **Blue**: 25% chance to explode (70% AoE damage) - "Explosive impact"
- **Purple**: 32% chance to explode (80% AoE damage) + "Explosions have 20% chance to chain" - "Cascading detonation"
- **Orange**: 40% chance to explode (90% AoE damage) + "Explosions now fracture, releasing 3 smaller 'cluster' bombs that detonate for 30% AoE damage each" - "Fractal explosion. Every detonation shatters, creating a cluster of secondary blasts."
- **Trade-off**: Random chance, can damage player if too close. Unreliable damage source.

#### Overcharge (from `overcharge` affix)
- **Unlock**: Achievement "Clear 30 rooms total" OR Purchase 75 shards
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Overcharge card can be in hand at a time
- **Application**: Conditional trigger - Time-gated burst damage on timer
- **White**: +15% burst damage every 5s - "Power surge"
- **Green**: +20% burst damage every 4s - "Energy spike"
- **Blue**: +25% burst damage every 3s - "Voltage surge"
- **Purple**: +30% burst damage every 3s + "Overcharge grants brief invulnerability" - "Overwhelming power"
- **Orange**: +35% burst damage every 2s + "Overcharge grants invulnerability and movement speed" - "Infinite potential. Power surges grant brief invincibility and haste."
- **Trade-off**: Time-gated, requires timing for maximum effect. Damage boost is temporary, not constant.

### 2.2 Defense Family Cards

#### Bulwark (from `defense` stat)
- **Unlock**: ✅ Unlocked by default (Starter card)
- **Mastery Upgrade Costs**: M0→M1: 10 shards, M1→M2: 25 shards, M2→M3: 50 shards, M3→M4: 100 shards, M4→M5: 200 shards
- **Application**: Passive - Always active, modifies defense stat
- **White**: +5% defense - "Basic protection" (No drawback - baseline card)
- **Green**: +8% defense - "Reinforced guard" (No drawback - baseline card)
- **Blue**: +12% defense, -5% movement speed - "Fortified defense" (Trade-off introduced at significant power level)
- **Purple**: +16% defense, -5% movement speed + "Blocking reflects 10% damage" - "Impenetrable wall"
- **Orange**: +20% defense, -5% movement speed + "Blocking reflects 25% damage and grants brief invulnerability" - "Absolute barrier. Defense becomes offense."
- **Trade-off**: -5% movement speed per stack (introduced at Blue tier and above). Heavy armor slows movement, creating a meaningful trade-off between defense and mobility. White/Green tiers are pure buffs to provide consistent baseline for new players.

#### Lifeline (from `lifesteal` affix)
- **Unlock**: Room 10 milestone OR Purchase 50 shards
- **Mastery Upgrade Costs**: M0→M1: 10 shards, M1→M2: 25 shards, M2→M3: 50 shards, M3→M4: 100 shards, M4→M5: 200 shards
- **Application**: Passive - Always active, heals on damage dealt
- **White**: 3% lifesteal - "Sustaining flow"
- **Green**: 5% lifesteal - "Vital drain"
- **Blue**: 7% lifesteal - "Life force"
- **Purple**: 9% lifesteal + "Heal burst at 100% HP (10% max HP)" - "Overflowing vitality"
- **Orange**: 12% lifesteal + "Heal burst at 100% HP (20% max HP) and grants damage boost" - "Immortal geometry. Life force overflows into power."
- **Trade-off**: Requires dealing damage, less effective at full HP. No healing if not attacking.

#### Fortify Aura (from `fortify` affix)
- **Unlock**: Room 10 milestone OR Purchase 75 shards OR Boss drop (Rooms 11-15)
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Fortify Aura card can be in hand at a time
- **Application**: Passive - Always active, provides aura effect in radius
- **White**: +5% defense aura (100px radius) - "Protective field"
- **Green**: +8% defense aura (125px radius) - "Warding presence"
- **Blue**: +12% defense aura (150px radius) - "Bastion field"
- **Purple**: +16% defense aura (175px radius) + "Aura reflects 15% melee damage" - "Reflective barrier"
- **Orange**: +20% defense aura (200px radius) + "Aura reflects 25% melee damage and grants allies lifesteal" - "Geometric fortress. Defense radiates to allies."
- **Trade-off**: Requires staying near allies, reduced personal benefit. Aura range limits positioning options.

#### Phase Step (from `dodgeCharges` affix)
- **Unlock**: Room 10 milestone OR Purchase 60 shards
- **Mastery Upgrade Costs**: M0→M1: 10 shards, M1→M2: 25 shards, M2→M3: 50 shards, M3→M4: 100 shards, M4→M5: 200 shards
- **Application**: Passive - Always active, increases dodge charge capacity
- **White**: +1 dodge charge - "Extra mobility"
- **Green**: +1 dodge charge - "Enhanced evasion"
- **Blue**: +2 dodge charges - "Masterful dodging"
- **Purple**: +2 dodge charges + "Dodge has 20% chance to reset on kill" - "Flowing movement"
- **Orange**: +3 dodge charges + "Dodge resets on kill and grants brief invulnerability" - "Infinite slip. Every kill resets your escape."
- **Trade-off**: None (pure utility buff, but opportunity cost of not taking damage/defense cards)

#### Phasing (from `phasing` affix)
- **Unlock**: Achievement "Dodge 500 attacks total" OR Purchase 100 shards
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Phasing card can be in hand at a time
- **Application**: Conditional trigger - Random chance to phase through incoming attacks
- **White**: 10% chance to phase through attacks - "Partial intangibility"
- **Green**: 15% chance to phase - "Ethereal form"
- **Blue**: 20% chance to phase - "Phase shifting"
- **Purple**: 25% chance to phase + "Phasing grants brief invulnerability" - "Quantum state"
- **Orange**: 30% chance to phase + "Phasing grants invulnerability and movement speed" - "Transcendent geometry. Become untouchable."
- **Trade-off**: Random chance, unreliable. Cannot be relied upon for consistent defense.

#### Prism Shield (from `thorns` legendary effect)
- **Unlock**: Achievement "Reflect 1,000 damage total" OR Purchase 150 shards
- **Mastery Upgrade Costs**: M0→M1: 20 shards, M1→M2: 50 shards, M2→M3: 100 shards, M3→M4: 200 shards, M4→M5: 400 shards
- **Application**: Passive - Always active, reflects damage when hit
- **White**: 15% damage reflect - "Reactive defense"
- **Green**: 20% damage reflect - "Mirror shield"
- **Blue**: 25% damage reflect - "Prismatic barrier"
- **Purple**: 30% damage reflect + "Reflected damage heals 50%" - "Vampiric reflection"
- **Orange**: 35% damage reflect + "Reflected damage heals 100% and chains to nearby enemies" - "Infinite mirror. Damage becomes life and spreads."
- **Trade-off**: Requires taking damage to activate, less effective against ranged attacks. Still take full damage, only reflect portion.

#### Phoenix Down (from `phoenix_down` legendary effect)
- **Unlock**: Achievement "Revive 10 times total" OR Purchase 750 shards (available after first full run clear)
- **Mastery Upgrade Costs**: M0→M1: 30 shards, M1→M2: 75 shards, M2→M3: 150 shards, M3→M4: 300 shards, M4→M5: 600 shards
- **Non-Stacking**: Yes - Only one Phoenix Down card can be in hand at a time
- **Application**: Conditional trigger - One-Time Use - Activates on death, revives player, then card is destroyed from hand
- **Special Rules**:
  - **Drops only at Orange quality** - No white/green/blue/purple versions exist
  - **Base effect**: Revive at 30% HP, card destroyed from hand after use - "Rise from geometric ash"
  - **Mastery 0-4**: Do not unlock quality bands (card only exists at Orange). These mastery levels provide visible progression toward the ultimate upgrade, giving players a long-term goal to work toward.
  - **Mastery 5 upgrade**: If player has Mastery 5 for Phoenix Down, revive at 50% HP + 20% damage boost for 10s - "Transcendent rebirth. Return stronger than before."
  - **Mastery applies during run**: Mastery upgrades apply even to cards found during the run (if you have Mastery 5, any Phoenix Down you find will have the upgraded effect)
  - **Design Rationale**: Phoenix Down is already extremely powerful (revive mechanic), so mastery 0-4 serve as progression milestones rather than unlocking quality bands. The M5 upgrade provides a massive boon (20% HP increase + damage boost) on top of an already broken card, making the 1,155 total shard investment (M0→M5) feel rewarding. This breaks the normal mastery pattern intentionally - the card is so powerful that it needs a different progression structure.
- **Trade-off**: Single-use card - destroyed from hand when triggered. Only activates on death, cannot be used proactively. Extremely powerful but permanent loss of the card slot. Must choose carefully when to risk death.

### 2.3 Mobility Family Cards

#### Velocity (from `movementSpeed` affix)
- **Unlock**: ✅ Unlocked by default (Starter card)
- **Mastery Upgrade Costs**: M0→M1: 10 shards, M1→M2: 25 shards, M2→M3: 50 shards, M3→M4: 100 shards, M4→M5: 200 shards
- **Application**: Passive - Always active, modifies movement speed stat
- **White**: +10% movement speed - "Quick step" (No drawback - baseline card)
- **Green**: +15% movement speed, -2% projectile damage - "Swift movement" (Trade-off introduced at moderate power level)
- **Blue**: +20% movement speed, -2% projectile damage - "Rapid transit"
- **Purple**: +25% movement speed, -2% projectile damage + "Movement speed increases damage by 5%" - "Momentum power"
- **Orange**: +30% movement speed, -2% projectile damage + "Movement speed increases damage by 10% and grants dodge chance" - "Infinite velocity. Speed becomes strength."
- **Trade-off**: -2% projectile damage per stack (introduced at Green tier and above). Speed comes at the cost of precision and power, creating a meaningful trade-off between mobility and damage output. White tier is a pure buff to provide consistent baseline for new players.

#### Vector Laminar (from `projectileSpeed` affix)
- **Unlock**: Room 10 milestone OR Purchase 40 shards
- **Mastery Upgrade Costs**: M0→M1: 10 shards, M1→M2: 25 shards, M2→M3: 50 shards, M3→M4: 100 shards, M4→M5: 200 shards
- **Application**: Passive - Always active, modifies projectile speed stat
- **White**: +15% projectile speed - "Faster bolts"
- **Green**: +25% projectile speed - "Swift projectiles"
- **Blue**: +35% projectile speed - "Lightning fast"
- **Purple**: +45% projectile speed + "Projectiles have 25% pierce chance" - "Penetrating speed"
- **Orange**: +55% projectile speed + "Projectiles pierce all enemies and gain range" - "Infinite range. Projectiles never stop."
- **Trade-off**: None (pure utility buff, but opportunity cost of not taking damage/defense cards)

#### Arcane Flow (from `cooldownReduction` affix)
- **Unlock**: Achievement "Use abilities 200 times total" OR Purchase 125 shards
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Application**: Passive - Always active, reduces all ability cooldowns
- **White**: 8% cooldown reduction - "Faster recovery"
- **Green**: 12% cooldown reduction - "Quick recharge"
- **Blue**: 16% cooldown reduction - "Rapid cycling"
- **Purple**: 20% cooldown reduction + "Kills reduce cooldowns by 1s" - "Flowing energy"
- **Orange**: 25% cooldown reduction + "Kills reset cooldowns and grant brief invulnerability" - "Infinite cycle. Every kill resets your abilities."
- **Trade-off**: None (pure utility buff, but opportunity cost of not taking damage/defense cards)

#### Parallelogram Slip (dodge cooldown reduction)
- **Unlock**: Achievement "Dodge 300 times total" OR Purchase 75 shards
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Application**: Passive - Always active, reduces dodge cooldown
- **White**: -0.3s dodge cooldown - "Quicker dodge"
- **Green**: -0.5s dodge cooldown - "Faster evasion"
- **Blue**: -0.7s dodge cooldown - "Rapid dodge"
- **Purple**: -1.0s dodge cooldown + "Dodge grants 10% movement speed for 2s" - "Flowing dodge"
- **Orange**: -1.5s dodge cooldown + "Dodge grants 20% movement speed and brief invulnerability" - "Infinite slip. Dodging becomes a weapon."
- **Trade-off**: None (pure utility buff, but opportunity cost of not taking damage/defense cards)

### 2.4 Ability Mutator Cards

#### Whirlwind Core (from `square` class modifiers)
- **Unlock**: Room 15 milestone OR Purchase 100 shards (Square class only)
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Whirlwind Core card can be in hand at a time
- **Application**: Passive - Always active, modifies whirlwind ability properties
- **White**: +1s whirlwind duration - "Extended spin"
- **Green**: +40% whirlwind damage - "Powerful rotation"
- **Blue**: +Pull effect (enemies pulled toward player) - "Vortex force"
- **Purple**: +Damage aura (enemies near whirlwind take damage) - "Blade storm"
- **Orange**: "Resets cooldown on kill" - "Infinite rotation. Every kill extends the storm."
- **Trade-off**: Requires melee range, can be interrupted. Whirlwind locks player in place during use.

#### Thrust Focus (from `square` class modifiers)
- **Unlock**: Room 15 milestone OR Purchase 100 shards (Square class only)
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Thrust Focus card can be in hand at a time
- **Application**: Passive - Always active, modifies thrust ability properties
- **White**: +100 thrust range - "Extended reach"
- **Green**: +40% thrust damage - "Powerful thrust"
- **Blue**: +Knockback effect - "Forceful strike"
- **Purple**: +Pierce (thrust hits multiple enemies) - "Penetrating thrust"
- **Orange**: "'Thrust' now has infinite range, pierces all enemies, and leaves a burning damage trail for 2s." - "Fractal thrust. The strike projects a line of force to infinity, searing the ground it passes over."
- **Trade-off**: Linear attack, requires positioning. Thrust commits player to forward movement.

#### Block Stance (from `square` class modifiers)
- **Unlock**: Achievement "Block 200 attacks total" OR Purchase 125 shards (Square class only)
- **Mastery Upgrade Costs**: M0→M1: 20 shards, M1→M2: 50 shards, M2→M3: 100 shards, M3→M4: 200 shards, M4→M5: 400 shards
- **Non-Stacking**: Yes - Only one Block Stance card can be in hand at a time
- **Application**: Passive - Always active, modifies block ability properties
- **White**: +20% block reduction - "Stronger block"
- **Green**: +30% block reduction - "Reinforced block"
- **Blue**: +40% block reduction - "Perfect block"
- **Purple**: +50% block reduction + "Blocking grants 10% damage boost" - "Counter stance"
- **Orange**: "Blocking grants 20% damage boost and reflects damage" - "Absolute defense. Blocking becomes attacking."
- **Trade-off**: Requires standing still. Blocking prevents movement and attacks.

#### Fan of Knives+ (from `triangle` class modifiers)
- **Unlock**: Room 15 milestone OR Purchase 100 shards (Triangle class only)
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Fan of Knives+ card can be in hand at a time
- **Application**: Passive - Always active, modifies fan of knives ability properties
- **White**: +2 knives - "More blades"
- **Green**: +4 knives - "Blade fan"
- **Blue**: +5 knives - "Knife storm"
- **Purple**: +7 knives + "Knives have 25% pierce chance" - "Penetrating fan"
- **Orange**: "Knives return to player, dealing damage again" - "Boomerang geometry. Blades always return."
- **Trade-off**: Spread reduces accuracy, requires close range. More knives = wider spread = less precision.

#### Shadow Clone (from `triangle` class modifiers)
- **Unlock**: Room 15 milestone OR Purchase 100 shards (Triangle class only)
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Shadow Clone card can be in hand at a time
- **Application**: Passive - Always active, modifies shadow clone ability properties
- **White**: +1 clone - "Single decoy"
- **Green**: +2 clones - "Twin shadows"
- **Blue**: +3 clones - "Multiple decoys"
- **Purple**: +4 clones + "Clones deal 25% damage" - "Combat clones"
- **Orange**: "Clones explode on death, dealing damage" - "Volatile shadows. Decoys become weapons."
- **Trade-off**: Clones have limited duration, can be destroyed. Clones are temporary and vulnerable.

#### Backstab Edge (from `triangle` class modifiers)
- **Unlock**: Achievement "Deal 5,000 backstab damage total" OR Purchase 125 shards (Triangle class only)
- **Mastery Upgrade Costs**: M0→M1: 20 shards, M1→M2: 50 shards, M2→M3: 100 shards, M3→M4: 200 shards, M4→M5: 400 shards
- **Non-Stacking**: Yes - Only one Backstab Edge card can be in hand at a time
- **Application**: Passive - Always active, modifies backstab damage multiplier
- **White**: +25% backstab damage - "Sharpened edge"
- **Green**: +35% backstab damage - "Deadly strike"
- **Blue**: +45% backstab damage - "Lethal backstab"
- **Purple**: +55% backstab damage + "Backstab has 25% chance to chain" - "Cascading strike"
- **Orange**: +60% backstab damage + "A killing blow with 'Backstab' grants 3s of stealth and resets the 'Backstab' cooldown" - "Fractal assassination. One kill grants the shadow, the next kill becomes the echo. The cycle repeats."
- **Trade-off**: Requires positioning behind enemy. Only benefits from rear attacks, requires flanking.

#### Blink Flux (from `hexagon` class modifiers)
- **Unlock**: Room 15 milestone OR Purchase 100 shards (Hexagon class only)
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Blink Flux card can be in hand at a time
- **Application**: Passive - Always active, modifies blink ability properties
- **White**: +150 blink range - "Extended teleport"
- **Green**: +80% blink damage - "Powerful blink"
- **Blue**: +Chain blink (can blink twice) - "Double blink"
- **Purple**: +Damage aura (blink leaves damaging trail) - "Blazing trail"
- **Orange**: "Blink leaves damaging trail and resets on kill" - "Infinite teleport. Every kill resets your escape."
- **Trade-off**: Requires positioning, can be disorienting. Blink commits to destination, can teleport into danger.

#### Beam Mastery (from `hexagon` class modifiers)
- **Unlock**: Achievement "Deal 10,000 beam damage total" OR Purchase 125 shards (Hexagon class only)
- **Mastery Upgrade Costs**: M0→M1: 20 shards, M1→M2: 50 shards, M2→M3: 100 shards, M3→M4: 200 shards, M4→M5: 400 shards
- **Non-Stacking**: Yes - Only one Beam Mastery card can be in hand at a time
- **Application**: Passive - Always active, modifies beam ability properties
- **White**: +1 beam charge - "Extra beam"
- **Green**: -25% beam tick rate - "Faster ticks"
- **Blue**: +50% beam duration - "Longer beam"
- **Purple**: +1 beam penetration - "Piercing beam"
- **Orange**: "Beam splits on hit, creating secondary beams" - "Fractal beam. One beam becomes many."
- **Trade-off**: Beam requires channeling, can be interrupted. Player must remain stationary while beaming.

#### Shield Bulwark (from `pentagon` class modifiers)
- **Unlock**: Room 15 milestone OR Purchase 100 shards (Pentagon class only)
- **Mastery Upgrade Costs**: M0→M1: 15 shards, M1→M2: 35 shards, M2→M3: 70 shards, M3→M4: 140 shards, M4→M5: 280 shards
- **Non-Stacking**: Yes - Only one Shield Bulwark card can be in hand at a time
- **Application**: Passive - Always active, modifies shield ability properties
- **White**: +1s shield duration - "Longer shield"
- **Green**: +80% shield wave damage - "Powerful wave"
- **Blue**: +Larger wave radius - "Expansive wave"
- **Purple**: +Damage reduction while shielding - "Fortified shield"
- **Orange**: "Shield explodes on break, dealing massive damage" - "Volatile defense. Breaking the shield triggers destruction."

**Trade-off**: Shield requires timing, can be broken early

#### Hammer Smash (from `pentagon` class modifiers)
- **Unlock**: Achievement "Stun 100 enemies total" OR Purchase 125 shards (Pentagon class only)
- **Mastery Upgrade Costs**: M0→M1: 20 shards, M1→M2: 50 shards, M2→M3: 100 shards, M3→M4: 200 shards, M4→M5: 400 shards
- **Non-Stacking**: Yes - Only one Hammer Smash card can be in hand at a time
- **Application**: Passive - Always active, modifies hammer smash ability properties
- **White**: +40 radius - "Larger smash"
- **Green**: +50% knockback - "Forceful smash"
- **Blue**: +Stun effect - "Stunning smash"
- **Purple**: +Damage zone (lingering damage) - "Cratering smash"
- **Orange**: "Hammer creates shockwave that travels outward" - "Seismic geometry. Impact ripples through reality."
- **Trade-off**: Requires close range, long windup. Hammer attack has significant startup time, vulnerable during windup.

### 2.5 Room Modifier Cards

**Unified System**: Room modifier cards are a separate inventory system that modifies the next room when used. These cards combine enemy modifiers, economy boosts, and utility effects into a single category.

#### Room Modifier Card Properties
- **Single use**: Consumed when used (one per room maximum)
- **Persistent**: Can be saved between rooms
- **Inventory**: Max 3 cards carried on a run, up to 20 stored in Nexus
- **Activation**: Used when selecting a door/entering a room (before room generation)
- **Rarity**: Drop from elite rooms, bosses, or special events

#### Design Philosophy
- **Harder = Better Rewards**: Cards that make rooms harder grant bonus rewards (extra cards, quality shifts, shards, etc.)
- **Easier = No Extra Rewards**: Cards that make rooms easier provide the ease as the reward itself (no bonus cards/rewards)
- **One Per Room**: Only one room modifier can be used per room to prevent stacking abuse

#### Enemy Modifier Cards (Harder Rooms = Better Rewards)

**Elite Armor**
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **White**: +10% enemy HP → Next room: +1 bonus card, +10% quality shift
- **Green**: +20% enemy HP → Next room: +1 bonus card, +15% quality shift
- **Blue**: +30% enemy HP → Next room: +2 bonus cards, +20% quality shift
- **Purple**: +40% enemy HP → Next room: +2 bonus cards, +25% quality shift, +10 shards
- **Orange**: +50% enemy HP → Next room: +3 bonus cards, +30% quality shift, +25 shards
- **Flavor**: "Tougher enemies, greater rewards. Hardened foes drop better loot."

**Swift Assault**
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **White**: +10% enemy speed → Next room: +1 bonus card, +10% quality shift
- **Green**: +20% enemy speed → Next room: +1 bonus card, +15% quality shift
- **Blue**: +30% enemy speed → Next room: +2 bonus cards, +20% quality shift
- **Purple**: +40% enemy speed → Next room: +2 bonus cards, +25% quality shift, +10 shards
- **Orange**: +50% enemy speed → Next room: +3 bonus cards, +30% quality shift, +25 shards
- **Flavor**: "Faster enemies, swifter rewards. Lightning-fast foes drop better loot."

**Volatile Spawn**
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **White**: 20% chance enemies explode on death → Next room: +1 bonus card, +10% quality shift
- **Green**: 30% chance → Next room: +1 bonus card, +15% quality shift
- **Blue**: 40% chance → Next room: +2 bonus cards, +20% quality shift
- **Purple**: 50% chance + explosions chain → Next room: +2 bonus cards, +25% quality shift, +10 shards
- **Orange**: 60% chance + explosions always chain → Next room: +3 bonus cards, +30% quality shift, +25 shards
- **Flavor**: "Unstable geometry rewards the brave. Explosive deaths drop better loot."

**Shielded Brood**
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **White**: 10% of enemies have shields → Next room: +1 bonus card, +10% quality shift
- **Green**: 20% of enemies have shields → Next room: +1 bonus card, +15% quality shift
- **Blue**: 30% of enemies have shields → Next room: +2 bonus cards, +20% quality shift
- **Purple**: 40% of enemies have shields + reflect projectiles → Next room: +2 bonus cards, +25% quality shift, +10 shards
- **Orange**: 50% of enemies have shields + reflect projectiles → Next room: +3 bonus cards, +30% quality shift, +25 shards
- **Flavor**: "Fortified enemies, fortified rewards. Shielded foes drop better loot."

**Double Trouble**
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **Epic**: Next room spawns double enemies → Next room: All cards guaranteed rare+, +50 shards, +3 bonus cards
- **Flavor**: "Double the challenge, double the reward. Face twice the enemies for legendary loot."

#### Economy & Utility Modifier Cards

**Prism Tax** (Currency Boost)
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **White**: Next room: +20% currency gain, +1 bonus card
- **Green**: Next room: +30% currency gain, +1 bonus card, +10% quality shift
- **Blue**: Next room: +40% currency gain, +2 bonus cards, +15% quality shift
- **Purple**: Next room: +50% currency gain, +2 bonus cards, +20% quality shift, currency drops as health orbs
- **Orange**: Next room: +60% currency gain, +3 bonus cards, +25% quality shift, currency drops as health orbs and grants stat boost
- **Flavor**: "Wealth multiplies. Currency flows like geometric patterns."

**Scholar Sigil** (XP Boost)
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **White**: Next room: +25% XP gain, +1 bonus card
- **Green**: Next room: +35% XP gain, +1 bonus card, +10% quality shift
- **Blue**: Next room: +45% XP gain, +2 bonus cards, +15% quality shift
- **Purple**: Next room: +55% XP gain, +2 bonus cards, +20% quality shift, XP grants temporary stat boost
- **Orange**: Next room: +70% XP gain, +3 bonus cards, +25% quality shift, XP grants stat boost and reduces cooldowns
- **Flavor**: "Knowledge accelerates. Experience becomes power."

**Loot Surge** (Card Rewards)
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **White**: Next room: +1 card offer in pack
- **Green**: Next room: +2 card offers in pack, +10% quality shift
- **Blue**: Next room: +3 card offers in pack, +15% quality shift
- **Purple**: Next room: +4 card offers in pack, +20% quality shift, +1 guaranteed rare card
- **Orange**: Next room: +5 card offers in pack, +25% quality shift, +1 guaranteed rare card, +25 shards
- **Flavor**: "Abundance awaits. Every choice multiplies."

**Mastery Boost** (Quality Upgrade)
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **Rare**: Next room: All cards in pack gain +1 quality band (white→green, green→blue, etc.)
- **Flavor**: "Elevate your geometric understanding. All rewards improve."

**Shard Mine** (Shard Rewards)
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **Uncommon**: Next room: +15 shards on clear, +1 bonus card
- **Rare**: Next room: +25 shards on clear, +2 bonus cards, +10% quality shift
- **Epic**: Next room: +50 shards on clear, +3 bonus cards, +20% quality shift
- **Flavor**: "Extract the essence of geometry. Shards flow freely."

#### Room Type Modifier Cards (Easier Rooms = No Extra Rewards)

**Rest Stop**
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **Common**: Next room: Easier enemies (-20% HP/damage), full health restore, card swap option
- **No bonus rewards** (easier is the reward)
- **Flavor**: "A moment of respite in the geometric chaos. Rest and recover."

**Safe Passage**
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **Rare**: Next room: No enemies, only card pack rewards (normal quality distribution)
- **No bonus rewards** (safe passage is the reward)
- **Flavor**: "A peaceful moment to gather strength. No enemies, only rewards."

**Treasure Cache**
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **Rare**: Next room: Guaranteed treasure pack (high quality cards, health restore), normal difficulty
- **Flavor**: "A hidden cache of geometric treasures awaits. Guaranteed quality rewards."

**Elite Challenge**
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **Uncommon**: Next room: Guaranteed elite pack with +50% quality shift, harder enemies (+15% HP/damage)
- **Flavor**: "Face the elite guardians for greater rewards. Challenge accepted."

**Boss Rush**
- **Application**: Active - One-Time Use - Manually activated when selecting door, consumed after use
- **Legendary**: Skip to next boss room (if available), guaranteed boss pack rewards
- **Flavor**: "Face the ultimate geometric challenge. Skip ahead to greatness."

#### Consumable Room Modifier Cards

**Reroll Token**
- **Application**: Active - One-Time Use - Manually activated at safe/upgrade rooms, consumed after use
- Consumable: Reroll a card's quality band in your hand
- Can be used on any card in hand
- **Rarity**: Rare drop from elite rooms and bosses
- **Flavor**: "Second chance. Reroll your fate."

**Card Upgrade Voucher**
- **Application**: Active - One-Time Use - Manually activated at safe/upgrade rooms, consumed after use
- Consumable: Upgrade a card's quality band by one tier (white → green → blue → purple → orange)
- Can be used on any card in hand
- **Rarity**: Very rare drop from boss rooms
- **Flavor**: "Ascend. Elevate your power."

### 2.6 Room Reward Pack Cards (Door Selection)

**Reward System Philosophy**: Cards become less valuable once hand is full. The reward system prioritizes **upgrading existing cards** over adding new cards, with cards being a rarer but more meaningful reward.

**Reward Distribution System**:
- **Per-Pack Roll**: Each pack type has its own percentage chance for reward type (e.g., Standard Pack: 30% card, 70% upgrade)
- **RNG Protection**: To prevent unlucky streaks, the system tracks consecutive non-card packs:
  - After 3 consecutive upgrade/utility packs, next pack is guaranteed to offer at least one card option
  - After 5 consecutive non-card packs, next pack is guaranteed card pack
- **Overall Distribution** (approximate across full run):
  - **Cards**: ~30% of packs - Cards are now a meaningful choice, not guaranteed
  - **Upgrades**: ~50% of packs - Upgrade existing cards in hand (quality band upgrades, shard grants)
  - **Utility**: ~20% of packs - Health, hand slots, shards, room modifiers

These represent the card packs shown on doors. Players select which pack they want by choosing a door.

#### Standard Pack
- **Reward Type**: Card (30% chance) OR Upgrade (70% chance)
- **If Card**: 1 card per player from their deck, normal quality distribution
- **If Upgrade**: Upgrade one card in hand by 1 quality band **for this run only** (white→green, etc.) OR 15 shards (does NOT grant permanent mastery unlock)
- No bonuses
- **Difficulty**: Normal

#### Elite Pack
- **Reward Type**: Card (40% chance) OR Upgrade (60% chance)
- **If Card**: 1 card per player from their deck, +10% quality shift, +1 bonus card
  - **Special**: Elite packs can ignore mastery cap by +1 or +2 levels (temporary jackpot - card is powerful for this run only, does NOT grant permanent mastery unlock)
  - Example: Precision at mastery 0 can drop as Blue from Elite pack (temporary), but picking it up does NOT unlock mastery 2 permanently
- **If Upgrade**: Upgrade one card in hand by 1 quality band **for this run only** OR 25 shards (does NOT grant permanent mastery unlock)
- **Difficulty**: Harder enemies (+15% HP/damage)

#### Treasure Pack
- **Reward Type**: Card (50% chance) OR Upgrade (50% chance)
- **If Card**: 1 card per player from their deck, +20% quality shift, +1 bonus card
- **If Upgrade**: Upgrade one card in hand by 1 quality band **for this run only** OR 35 shards (does NOT grant permanent mastery unlock)
- +Health restore (25% max HP)
- **Difficulty**: Normal

#### Challenge Pack
- **Reward Type**: Card (60% chance) OR Upgrade (40% chance)
- **If Card**: 1 card per player from their deck, +30% quality shift, +2 bonus cards
  - **Special**: Challenge packs can ignore mastery cap by +1 or +2 levels (temporary jackpot - card is powerful for this run only, does NOT grant permanent mastery unlock)
- **If Upgrade**: Upgrade one card in hand by 1 quality band **for this run only** OR 50 shards (does NOT grant permanent mastery unlock)
- +XP boost (+50% XP for room)
- **Difficulty**: Much harder enemies (+30% HP/damage)

#### Rest Pack
- **Reward Type**: Utility (100%)
- +Health restore (50% max HP)
- +Card swap option (can swap one card from hand)
- +10 shards
- **Difficulty**: Easier enemies (-20% HP/damage)

#### Upgrade Pack (New - Common)
- **Reward Type**: Upgrade (100%)
- Upgrade one card in hand by 1 quality band **for this run only** (player chooses which card, does NOT grant permanent mastery unlock)
- OR: 20 shards (player choice)
- **Difficulty**: Normal

#### Shard Pack (New - Common)
- **Reward Type**: Utility (100%)
- Grants card shards (30 + room number × 2)
- Can be used to upgrade cards at safe/upgrade rooms
- **Difficulty**: Moderate challenge (+20% HP/damage)

#### Bonus Slot Pack (Rare)
- **Reward Type**: Utility (100%)
- Grants +1 hand slot for the rest of the run
- +15 shards
- **Difficulty**: Very challenging (+50% HP/damage, elite enemies)

#### Mastery Pack (Rare)
- **Reward Type**: Upgrade (100%)
- Upgrade one card in hand by 1 quality band **for this run only** (guaranteed, does NOT grant permanent mastery unlock)
- +25 shards
- **Difficulty**: Moderate challenge (+20% HP/damage)

#### Curse Pack (Rare - High Risk, Always Voluntary)
- **Reward Type**: Curse (100%)
- **Door Option**: Appears as a door choice (rare, every 10-15 rooms)
- **Preview**: "⚠️ CURSED REWARDS - Choose one curse for power"
- Player **CHOOSES** to enter (not forced)
- Offers 2-3 curse cards, player must select one
- +Bonus reward: +50 shards OR upgrade one card in hand **for this run only** OR +2 bonus cards next room
- **Difficulty**: Very challenging (+40% HP/damage, elite enemies)
- **Note**: Curses cannot be voluntarily discarded once taken, but player always has the choice to avoid the door entirely

**Reward System Benefits**:
- **Cards remain meaningful**: When you get a card, it's a significant choice
- **Upgrades are common**: Players can improve their existing hand throughout the run
- **No wasted rewards**: Even with full hand, upgrades and shards are valuable
- **Strategic choices**: Players must decide between new cards vs upgrading existing ones

### 2.7 Team Cards (Multiplayer Only)

Run-wide modifiers equipped pre-run. Each player equips one team card from their unlocked pool.

**Application**: All team cards are **Passive - Persistent** - Activated at run start, last for entire run. Equipped in Nexus before run begins.

#### Coordinated Strike
- **Application**: Passive - Persistent - Always active, proximity-based damage boost
- All players +10% damage when within 200px of ally
- **Unlock**: Complete 10 rooms together in multiplayer
- **Flavor**: "Unity multiplies strength."
- **Trade-off**: Requires staying near allies, limits positioning options

#### Shared Resilience
- **Application**: Passive - Persistent - Always active, proximity-based damage sharing
- Damage split 30% between nearby players (max 2 splits, 150px range)
- **Unlock**: Revive teammates 5 times in multiplayer
- **Flavor**: "Shared burden, shared strength."
- **Trade-off**: Requires staying near allies, can spread damage to healthy players

#### Synergy Boost
- **Application**: Passive - Persistent - Always active, modifies economy formulas
- XP/currency shared +20%, rounded up
- **Unlock**: Complete 25 rooms together in multiplayer
- **Flavor**: "Together we grow stronger."
- **Trade-off**: None (pure economy buff, but requires multiplayer)

#### Revival Protocol
- **Application**: Passive - Persistent - Always active, modifies revive mechanics
- Revive cooldown -30%, revive at 60% HP (instead of 50%)
- **Unlock**: Revive teammates 15 times in multiplayer
- **Flavor**: "No one fights alone."
- **Trade-off**: None (pure utility buff, but requires multiplayer)

#### Elite Bounty
- **Application**: Passive - Persistent - Always active, modifies room generation
- Elite rooms guaranteed every 3rd room, +50% card quality in elite rooms
- **Unlock**: Clear 3 boss rooms in multiplayer
- **Flavor**: "Seek the greatest challenges."
- **Trade-off**: Forces harder rooms more frequently, less control over difficulty curve

#### Challenge Mode
- **Application**: Passive - Persistent - Always active, modifies enemy scaling and rewards
- Enemies +25% HP/damage, +100% card quality, +50% shards
- **Unlock**: Reach room 20 with full 4-player party
- **Flavor**: "Embrace the ultimate test."
- **Trade-off**: Significantly harder enemies, requires skilled team coordination

#### Fortune's Favor
- **Application**: Passive - Persistent - Always active, modifies card quality distributions
- All card draws +1 quality band minimum (white becomes green, etc.)
- **Unlock**: Complete 50 rooms together in multiplayer
- **Flavor**: "Luck favors the prepared."
- **Trade-off**: None (pure quality buff, but requires multiplayer)

#### Nexus Link
- **Application**: Passive - Persistent - Always active, modifies hand size
- Team shares largest hand size upgrade (all players get max hand size)
- **Unlock**: Achieve 10 flawless room clears (no deaths) in multiplayer
- **Flavor**: "Connected minds, shared potential."
- **Trade-off**: None (pure utility buff, but requires multiplayer and coordination)

#### Combo Chain
- **Application**: Conditional trigger - Activates on multi-kills within 2s, stacks damage
- Kills within 2s grant +2% stacking damage per player (max 20%)
- **Unlock**: Achieve 25 combo chains (multi-kills within 2s) in multiplayer
- **Flavor**: "Momentum builds together."
- **Trade-off**: Requires coordinated multi-kills, stacks decay if no combos within window

#### Guardian Aura
- **Application**: Passive - Persistent - Always active, proximity-based defense aura
- Tank class grants nearby players +5% defense (+10% if tank has Fortify card)
- **Unlock**: Tank class completes 30 rooms in multiplayer
- **Flavor**: "The shield protects all."
- **Trade-off**: Requires tank class in party, requires staying near tank, tank must have Fortify for full benefit

#### Resource Pool
- **Application**: Passive - Persistent - Always active, modifies economy distribution
- Currency/XP pooled and split evenly among all players
- **Unlock**: Complete 40 rooms together in multiplayer
- **Flavor**: "Shared resources, shared success."
- **Trade-off**: Resources split evenly, high performers get less, low performers get more

#### Adaptive Tactics
- **Application**: Passive - Persistent - Always active, rotates enemy resistances
- Enemy damage type resistance rotates every 5 rooms
- **Unlock**: Reach room 30 with full 4-player party
- **Flavor**: "Adapt or perish."
- **Trade-off**: Forces adaptation, can make some builds less effective in certain rooms

#### Last Stand
- **Application**: Conditional trigger - Activates when teammate dies, grants damage boost
- When one player dies, others gain +15% damage until revive
- **Unlock**: Revive teammates 30 times in multiplayer
- **Flavor**: "Fallen comrades inspire greatness."
- **Trade-off**: Only activates when teammate dies, requires death to benefit

#### Shared Burden
- **Application**: Passive - Persistent - Always active, spreads debuffs to allies
- Debuffs spread to nearest ally at 50% effectiveness
- **Unlock**: Complete 60 rooms together in multiplayer
- **Flavor**: "Together we endure."
- **Trade-off**: Can spread negative effects to healthy players, requires staying near allies

### 2.8 Curse Cards

**Curse System Philosophy**: Curses are negative cards that add risk/reward to card selection. They provide powerful benefits but with significant drawbacks, creating dramatic moments and risk management decisions.

**Curse Card Properties**:
- **Cannot be voluntarily discarded** - Once in hand, curses stay until removed by special mechanics
- **Take up hand slots** - Curses count toward hand size limit
- **Non-stacking** - Only one of each curse type can be in hand
- **Removable** - Can be removed through special mechanics (see Curse Removal below)
- **Always Voluntary** - Curses are NEVER forced. All curse acquisition is opt-in with clear tradeoffs.

**Curse Acquisition (Always Voluntary - Opt-In Risk/Reward)**:

**1. Curse Pack Door Option** (Rare, appears every 10-15 rooms):
- Door preview shows: "⚠️ CURSED REWARDS"
- Hover text: "Choose one curse, gain powerful rewards (+50 shards OR upgrade one card OR +2 bonus cards next room)"
- Player **CHOOSES** to enter (not forced)
- Must select one curse from 2-3 options
- Immediate bonus reward granted
- Door clearly labeled with warning icon

**2. Boss Curse Offer** (Optional, 25% chance after boss defeat):
- Popup after boss: "Accept [Curse Name] for bonus loot?"
- Shows curse effects + bonus (guaranteed Purple/Orange card + 50 shards)
- "Accept" or "Decline" buttons
- **No penalty for declining** - Player gets normal boss loot if declined
- Clear choice: "Take curse for power boost, or skip for safety"

**3. Elite/Challenge Curse Offer** (Optional, 15% chance):
- Similar to boss offer structure
- Smaller rewards (+30 shards OR upgrade one card)
- Always optional - player can decline

**Curse Removal (Deterministic + Multiple Paths)**:

**1. Purification Room Door Option** (Guaranteed Cycle):
- Appears every 8-10 rooms as a door choice (deterministic cadence)
- **After taking a curse, GUARANTEED to appear within next 8 rooms** - Ensures players aren't stuck with a curse for 15+ rooms
- Door shows: "🔮 PURIFICATION CHAMBER - Remove one curse OR +40 shards (if no curses)"
- Moderate difficulty (+25% HP/damage)
- Player chooses which curse to remove (if multiple)
- Creates a "curse window" - players know they can remove it soon if needed

**2. Purification Scroll** (Uncommon Drop - Emergency Safety Valve):
- Elite rooms: 20% drop chance (up from "rare")
- Boss rooms: 30% drop chance (50% if player has 2+ curses)
- Can be used immediately at any safe/upgrade room
- Stored in inventory (max 3)
- Removes ONE curse of player's choice
- Provides emergency removal if RNG is bad

**3. Boss Clear Reward** (Always Available if Cursed):
- If player has ANY curses, boss clear reward options **ALWAYS include**:
  - Option 1: Take card/upgrade/shards (normal rewards)
  - Option 2: Remove one curse (no shard cost, just a reward option)
- Player chooses one
- If player has no curses, this option doesn't appear
- Ensures bosses can always be a "reset point" for curse management

**4. Safe/Upgrade Room Purification** (Shard Purchase):
- At safe/upgrade rooms, can spend 75 shards to remove one curse
- Provides emergency removal if RNG is bad
- Expensive enough to discourage relying on it, cheap enough to be viable

**Design Philosophy**:
- **Eliminates Trap State**: All curses are voluntary, removal is guaranteed within 8 rooms, multiple removal paths
- **Preserves Risk/Reward**: Curses still offer powerful bonuses, taking curses is still a meaningful decision
- **Creates Strategic Depth**: "Can I handle this curse for 8 rooms?" "Do I remove it now or push for one more elite room?"
- **Respects Player Agency**: Never forced into unwinnable situations, always a path forward
- **Fits Progression Philosophy**: Death = progress (curses don't persist beyond death), skilled players can leverage curses for power, new players can avoid curses entirely

**Note**: Curses do not have mastery levels - they must be removed through purification mechanics

#### Unstable Precision
- **Category**: Curse - Offense
- **Non-Stacking**: Yes
- **Application**: Passive - Always active, modifies crit chance with risk
- **Effect**: +40% crit chance
- **Curse**: Non-crits deal -25% damage.
- **Flavor**: "Power at a price. Crits are more often but when you whiff it's reduction."

#### Fragile Bulwark
- **Category**: Curse - Defense
- **Non-Stacking**: Yes
- **Application**: Passive - Always active, modifies defense with vulnerability
- **Effect**: +35% defense
- **Curse**: Taking damage has 15% chance to break armor, reducing defense to 0% for 3s
- **Flavor**: "Reinforced but brittle. Protection comes with fragility."

#### Volatile Momentum
- **Category**: Curse - Offense
- **Non-Stacking**: Yes
- **Application**: Conditional trigger - Activates on kill, stacks with risk
- **Effect**: +8% damage per kill (cap 40%, duration 8s)
- **Curse**: If no kill within 3s, all stacks explode, dealing 5% max HP damage per stack (if room has been cleared it clears the stacks without damage. This way when rooms are cleared you arent required to take damage)
- **Flavor**: "Unstoppable force, unstable energy. Momentum must be maintained."

#### Cursed Volley
- **Category**: Curse - Offense
- **Non-Stacking**: Yes
- **Application**: Passive - Always active, modifies projectile count with chaos
- **Effect**: +2 projectiles total (3 total projectiles)
- **Curse**: Projectiles have 30% chance to fire in random direction. -50% damage per projectile.
- **Flavor**: "Chaotic geometry. More projectiles, less control."

#### Blood Pact
- **Category**: Curse - Defense
- **Non-Stacking**: Yes
- **Application**: Passive - Always active, modifies lifesteal with cost
- **Effect**: +15% lifesteal
- **Curse**: Lifesteal costs 2% max HP per second. If HP drops below 20%, lifesteal stops working.  (stops when room is clear of enemies)
- **Flavor**: "Life for life. Sustenance requires sacrifice."

#### Berserker's Rage
- **Category**: Curse - Offense
- **Non-Stacking**: Yes
- **Application**: Conditional trigger - Activates when HP drops below 50%
- **Effect**: +50% damage, +25% movement speed when below 50% HP
- **Curse**: Cannot heal above 50% HP. Taking damage below 25% HP has 10% chance to stun self for 1s.
- **Flavor**: "Rage consumes all. Power through pain, but pain is constant."

#### Fragmented Shield
- **Category**: Curse - Defense
- **Non-Stacking**: Yes
- **Application**: Passive - Always active, modifies damage reflect with instability
- **Effect**: +40% damage reflect
- **Curse**: Reflected damage has 25% chance to also damage self for 50% of reflected amount
- **Flavor**: "Broken mirror. Reflection cuts both ways."

#### Overloaded Circuit
- **Category**: Curse - Mobility
- **Non-Stacking**: Yes
- **Application**: Passive - Always active, modifies cooldown reduction with risk
- **Effect**: +30% cooldown reduction
- **Curse**: Using abilities has 15% chance to trigger "overload", doubling all cooldowns for 5s
- **Flavor**: "Too much power, too fast. The circuit cannot handle it."

#### Cursed Speed
- **Category**: Curse - Mobility
- **Non-Stacking**: Yes
- **Application**: Passive - Always active, modifies movement speed with loss of control
- **Effect**: +40% movement speed
- **Curse**: Movement direction has 20% chance to reverse for 1s. Cannot stop moving (always moving at minimum speed).
- **Flavor**: "Too fast to control. Speed becomes a curse."

#### Phantom Pain
- **Category**: Curse - Defense
- **Non-Stacking**: Yes
- **Application**: Conditional trigger - Activates on taking damage
- **Effect**: Taking damage grants +20% damage for 5s (stacks up to 3x)
- **Curse**: Taking damage also deals 3% max HP damage over 3s (damage over time). Stacks with multiple hits.
- **Flavor**: "Pain becomes power, but pain is real. Every wound lingers."

#### Unstable Geometry
- **Category**: Curse - Universal
- **Non-Stacking**: Yes
- **Application**: Passive - Always active, random stat fluctuations
- **Effect**: Random stat (damage, defense, speed) gains +50% bonus, rotates every 10s
- **Curse**: Other stats are reduced by 25% while one is boosted. Stat rotation is random and unpredictable.
- **Flavor**: "Reality fractures. Power flows unpredictably."

#### Cursed Execution
- **Category**: Curse - Offense
- **Non-Stacking**: Yes
- **Application**: Conditional trigger - Activates when enemy HP falls below threshold
- **Effect**: Execute at 35% HP (bosses: 15% HP)
- **Curse**: Execute has 30% chance to fail, dealing no damage and stunning self for 2s
- **Flavor**: "Unreliable finisher. Sometimes the executioner becomes the executed."

#### Doomed Pact
- **Category**: Curse - Universal
- **Non-Stacking**: Yes
- **Application**: Passive - Always active, power with gradual decay
- **Effect**: +30% all damage, +20% all defense, +15% movement speed
- **Curse**: Stats decay by 5% per room after room 10 (damage: 30% → 25% → 20% → 15% → 10% → 5% → 0%, defense: 20% → 15% → 10% → 5% → 0%, speed: 15% → 10% → 5% → 0%). After 6 rooms of decay (room 16), all bonuses are gone and card becomes pure liability. Decay counter visible in UI.
- **Flavor**: "Ultimate power, ultimate price. Time is borrowed, not earned. Power fades with each room."
- **Removal**: Cannot be removed. Must be purified before decay completes or card becomes worthless. Creates interesting gameplay: "How long can I push this before it becomes a liability?"

**UI Visualization Requirements**:
- **Prominent decay counter**: Display "X rooms until next decay" (e.g., "3 rooms until next decay")
- **Current stats display**: Show current stat values with decay indicator (e.g., "Damage: +25% (down from +30%)")
- **Visual degradation**: Card becomes more "cracked" or "faded" each room as decay progresses
- **Warning at room 15**: "Doomed Pact nearly depleted! Last room of benefits."
- **Final warning at room 16**: "Doomed Pact provides no benefits - purify to remove"
- **Countdown timer**: Visual indicator showing rooms remaining before next decay (if applicable)

**Post-Decay Behavior** (After Room 16 - Full Decay):
- **Option A (Simpler)**: Card remains in hand (takes up slot), provides 0 benefits, counts as dead weight (strategic penalty), can still be purified, serves as reminder: "Should have purified this!"
- **Option B (More Dramatic)**: Card automatically transforms into "Broken Pact" (curse), Broken Pact: -10% all stats, must be purified to remove, teaches lesson: "Don't let curses decay"
- **Recommendation**: Either option works - Option A is simpler to implement, Option B adds dramatic consequence and teaches players to manage curses proactively

**Curse System Balance**:
- **High risk, high reward** - Curses provide significant benefits but with meaningful drawbacks
- **Strategic depth** - Players must manage curse effects and plan for removal
- **Dramatic moments** - Curses create memorable risk/reward scenarios
- **Removal options** - Multiple ways to remove curses prevent them from feeling oppressive (Purification Room, Purification Scroll, boss rewards)
- **No mastery system** - Curses must be removed through purification - they cannot be upgraded or tamed

---

## Phase 3: Distribution & Progression Systems

### 3.1 Quality Distribution Curves

**Important**: Quality distribution is **capped by mastery level**. Cards can only appear at quality bands you've unlocked through mastery. If a card is mastery 0, it will ONLY appear as white, regardless of room distribution.

Weighted probability tables by room range (white/green/blue/purple/orange percentages):

**Starting Draw** (before run begins):
- **Base Distribution**: White: 80%, Green: 15%, Blue: 5%, Purple: 0%, Orange: 0%
- **Mastery Floor System**: Starting draw respects mastery investment by applying a minimum quality floor based on average mastery level:
  - **Average Mastery 0-1**: Base distribution (80/15/5/0/0)
  - **Average Mastery 2**: Minimum floor (60/25/10/5/0) - Ensures at least 60% white, but green/blue more common
  - **Average Mastery 3**: Minimum floor (40/30/20/8/2) - Purple becomes possible
  - **Average Mastery 4+**: Minimum floor (20/25/25/20/10) - Orange becomes viable
- **Mastery cap still applies**: Cards at mastery 0 will be white only, even if floor distribution allows green/blue
- **Rationale**: Players who invest in mastery should see that investment reflected in starting draws. A player with M4 Precision shouldn't start with 80% white cards - their mastery investment should provide a better baseline.

**Rooms 1-5**:
- White: 70%, Green: 20%, Blue: 8%, Purple: 2%, Orange: 0%
- **Example**: Precision at mastery 0 → Always white. Precision at mastery 1 → 70% white, 30% green (blue/purple not possible)

**Rooms 6-10**:
- White: 50%, Green: 25%, Blue: 15%, Purple: 8%, Orange: 2%
- **Example**: Precision at mastery 2 → Can be white/green/blue (purple/orange not possible even though distribution allows them)

**Rooms 11-15**:
- White: 35%, Green: 25%, Blue: 20%, Purple: 12%, Orange: 8%

**Rooms 16+**:
- White: 20%, Green: 25%, Blue: 25%, Purple: 18%, Orange: 12%

**Elite Rooms**:
- Base distribution +10% shift toward top two bands
- Example (Room 10): 40/25/20/10/5 → 30/25/25/15/5
- **Elite packs can ignore mastery cap**: Elite packs can drop cards above your mastery level (e.g., Blue card even if mastery 0) - this is a temporary jackpot for this run only, does NOT grant permanent mastery unlock
- **Standard packs in elite rooms still respect mastery cap**: If card is mastery 1, it can only be white/green in standard packs (blue/purple/orange not possible)

**Boss Rooms**:
- **Boss drops ignore mastery cap by +1 level minimum** - Bosses can drop cards at quality 1 level above your current mastery
- **Scaling by Boss Tier** (aligned with Room 12, 22, 32 structure):
  - **First Boss (Room 12)**: Drops minimum Green (no White drops, minimum Green quality enforced, unlocks Mastery 1 if picked up)
    - Distribution: Green 60%, Blue 30%, Purple 8%, Orange 2%
  - **Second Boss (Room 22)**: Drops minimum Blue (unlocks Mastery 2 if picked up and Mastery 1 owned)
    - Distribution: Green 10%, Blue 50%, Purple 30%, Orange 10%
  - **Final Boss (Room 32)**: Drops minimum Purple (unlocks Mastery 3-4 if picked up and prerequisites owned)
    - Distribution: Blue 5%, Purple 45%, Orange 50%
- **Mastery unlock on pickup**: Picking up boss card unlocks that mastery level permanently (if not already unlocked, see Boss Mastery Unlock System below)

**Mastery Bonuses**:
- Each mastery level adds +5% shift toward higher bands
- Example: Level 3 mastery on Precision card → +15% shift (white becomes less likely, orange more likely)
- **Note**: Mastery bonuses only affect distribution within unlocked quality bands

### 3.2 Mastery System

**Mastery Levels** (0-5 per card):
- **Level 0**: Starter quality (white only) - All cards start at mastery 0
- **Level 1**: Unlocks green band (cost: 10 shards) - Cards can now appear as green in packs
- **Level 2**: Unlocks blue band, +5% quality shift (cost: 25 shards) - Cards can now appear as blue in packs
- **Level 3**: Unlocks purple band, +10% quality shift (cost: 50 shards) - Cards can now appear as purple in packs
- **Level 4**: Unlocks orange band, +15% quality shift (cost: 100 shards) - Cards can now appear as orange in packs
- **Level 5**: Legendary upgrade, +20% quality shift, grants reroll tokens (cost: 200 shards) - Maximum quality unlocked

**The "Unlock vs. Power" Model**:

This system creates clear distinction between **permanent unlocks** (meta-progression) and **temporary power** (in-run bonuses):

**1. Bosses: The Permanent Unlockers**
- **Mechanic**: Bosses are the **only source of free, permanent mastery unlocks**
- **What they do**: When you pick up a Boss's card, it **permanently unlocks** that mastery level for you (up to +1 from your current)
- **Why it feels good**: This is the only way to get a "free" permanent unlock. Makes bosses feel special, rewarding, and like true gatekeepers of progression

**2. Elites: The Temporary Jackpots**
- **Mechanic**: Elite Packs (and Challenge Packs) can **ignore the mastery cap** (e.g., by +1 or +2)
- **What they do**: An Elite room can drop a "Blue" (Mastery 2) card, even if your mastery for it is 0. You get to use this powerful card **for this run only**
- **What they DON'T do**: Picking up this card does **NOT permanently unlock** Mastery 2. It's a "taste of power," a temporary in-run jackpot that rewards you for clearing a hard room
- **Why it works**: Solves frustration (players can experience powerful cards) without stealing the Boss's thunder (permanent unlocks remain special)

**3. In-Run Upgrades: The In-Run Polishers**
- **Mechanic**: Upgrade Rewards from packs upgrade cards in-hand **for this run only**
- **What they do**: An Upgrade Reward lets you upgrade a card in your hand (e.g., White → Green) **for this run only**
- **What they DON'T do**: This does **NOT grant a permanent mastery unlock**. It's a simple, in-run buff. If you want to permanently unlock the Green mastery, you must spend shards at the Nexus or get a Boss drop
- **Why it works**: Provides steady in-run improvement without conflicting with permanent progression systems

**4. Shard Purchases: The Permanent Investment**
- **Mechanic**: Spending shards at Nexus permanently unlocks mastery levels
- **What they do**: Provides reliable, permanent progression path (faster/more reliable than waiting for boss drops)
- **Why it works**: Gives players agency - they can choose to invest shards now or wait for boss drops

**Quality Band Unlocking Rules**:
- **Standard packs respect mastery cap**: Cards can only appear at quality bands you've unlocked through mastery. If a card is mastery 0, it will ONLY appear as white quality in standard packs, even if the pack has high quality distribution
- **Elite/Challenge packs can ignore mastery cap**: Elite and Challenge packs can drop cards above your mastery level (temporary jackpot, no permanent unlock)
- **Ways to unlock mastery levels PERMANENTLY**:
  1. **Shard purchase**: Spend shards at Nexus to upgrade cards (e.g., 10 shards for mastery 0→1) - **Permanent unlock**
  2. **Boss drops**: Picking up boss cards unlocks mastery levels FREE (see Boss Mastery Unlock System section 3.2.5) - **Permanent unlock**
- **Ways to get temporary power (in-run only)**:
  1. **Elite/Challenge packs**: Can drop cards above mastery cap - **Temporary, no permanent unlock**
  2. **Upgrade rewards**: Upgrade cards in-hand for this run only - **Temporary, no permanent unlock**
- **Pack distribution respects mastery** (for standard packs): When a card is rolled in a standard pack, it can only be the highest quality band you've unlocked (e.g., if mastery 2, card can be white/green/blue, but not purple/orange)
- **Boss drops ignore mastery cap**: Bosses can drop cards at quality +1 level above your current mastery, and picking them up **permanently unlocks** that mastery level (see section 3.2.5)

**Example Progression** (Demonstrating "Unlock vs. Power" Model):
1. **New player**: All cards at mastery 0 → All cards appear as white only in standard packs
2. **Elite room (Room 5)**: Drops Precision (Blue) - Player picks it up, gets powerful Blue Precision **for this run only**. Nexus mastery is still 0 (no permanent unlock)
3. **Upgrade reward (Room 6)**: Player uses upgrade on Blue Precision → Becomes Purple Precision **for this run only**. Nexus mastery is still 0
4. **Boss drop (Room 12)**: Player beats first boss, gets Bulwark (Green) → Picking it up **permanently unlocks** Bulwark mastery 1 (FREE, saves 10 shards). Future runs: Bulwark can now appear as Green in packs
5. **Shard purchase (Nexus)**: Player spends 10 shards to upgrade Precision mastery 0→1 → **Permanently unlocks** Green quality. Future runs: Precision can now appear as Green in packs
6. **Elite room (Room 15)**: Drops Precision (Blue) - Player picks it up, gets Blue Precision **for this run only**. Nexus mastery is still 1 (no permanent unlock from elite)
7. **Boss drop (Room 22)**: Player beats second boss, gets Precision (Blue) → Picking it up **permanently unlocks** Precision mastery 2 (FREE, saves 25 shards). Future runs: Precision can now appear as Blue in packs

**Reroll Tokens**:
- Granted at mastery levels 2, 4, and 5
- Can reroll a card's quality band once per run
- Stored in save system, consumed on use

**Combined Card Costs**:
- Combined cards have increased upgrade costs (1.75x normal)
- Example: White → Green normally 10 shards, for combined card costs 17.5 shards (rounded to 18)
- This provides a slight benefit (paying 1.75x for two cards worth of upgrades = 12.5% discount)
- Mastery upgrades also cost 1.75x normal for combined cards

### 3.2.5 Boss Mastery Unlock System

**Core Rules**:
1. **Boss drops always ignore mastery cap by +1 level minimum** - Bosses can drop cards at quality 1 level above your current mastery
2. **Picking up boss card unlocks that mastery level permanently** (if not already unlocked)
3. **Only unlocks +1 mastery level above current** - Cannot skip mastery levels (must have Mastery 1 to unlock Mastery 2, etc.)

**Scaling by Boss Tier** (aligned with Room 12, 22, 32 structure):
- **First Boss (Room 12)**: Drops minimum Green (no White drops, minimum Green quality enforced, unlocks Mastery 1 if picked up)
  - Distribution: Green 60%, Blue 30%, Purple 8%, Orange 2%
- **Second Boss (Room 22)**: Drops minimum Blue (unlocks Mastery 2 if picked up and Mastery 1 owned)
  - Distribution: Green 10%, Blue 50%, Purple 30%, Orange 10%
- **Final Boss (Room 32)**: Drops minimum Purple (unlocks Mastery 3-4 if picked up and prerequisites owned)
  - Distribution: Blue 5%, Purple 45%, Orange 50%

**Mastery Unlock on Pickup**:
- **If card mastery < drop quality mastery**: Unlock mastery level to match drop quality (FREE, no shard cost)
- **If card mastery ≥ drop quality mastery**: No unlock (already have it or higher)
- **Unlocking via boss drop is FREE** - No shard cost, saves shards compared to purchasing
- **Unlock applies immediately** and persists to save file
- **Future runs benefit**: Unlocked mastery levels apply to all future runs (card can now appear at that quality in packs)

**Examples**:

1. **Precision (Mastery 0) + Beat Room 12 Boss (First Boss) → Drops Precision (Green)**
   - Pickup unlocks Mastery 1 for Precision (saves 10 shards)
   - Future runs: Precision can now appear as Green in packs
   - Current run: Player gets Green Precision card

2. **Bulwark (Mastery 1) + Beat Room 22 Boss (Second Boss) → Drops Bulwark (Blue)**
   - Pickup unlocks Mastery 2 for Bulwark (saves 25 shards)
   - Future runs: Bulwark can now appear as Blue in packs
   - Current run: Player gets Blue Bulwark card

3. **Velocity (Mastery 3) + Beat Room 32 Boss (Final Boss) → Drops Velocity (Purple)**
   - No unlock (already have Mastery 3)
   - Still get Purple Velocity for current run
   - No mastery progression benefit

4. **Fury (Mastery 0) + Beat Room 22 Boss (Second Boss) → Drops Fury (Blue)**
   - **Cannot unlock Mastery 2 directly** - Must have Mastery 1 first
   - Pickup unlocks Mastery 1 for Fury (only +1 level above current)
   - Future runs: Fury can now appear as Green in packs
   - Current run: Player gets Blue Fury card (boss ignores cap, but unlock is limited)

**Balance Notes**:
- **Orange (Mastery 4) unlocks are rare** - Requires late-game bosses + luck with distribution
- **Players can still purchase mastery with shards** - Faster/more reliable than waiting for boss drops
- **Boss unlocks reward skilled play** - Beat boss = meta-progression boost
- **Cannot skip mastery levels** - Room 22 boss won't unlock Mastery 2 if you don't have Mastery 1
- **Multiple runs required** - One run can't unlock excessive amounts of mastery (prevents power creep)
- **Strategic choice**: Players must decide whether to invest shards now or wait for boss drops

**Boss Mastery Unlock with Team Cards**:
- **Team cards like Fortune's Favor may shift boss drop quality upward** - Quality distribution modifiers can affect boss drops
- **Mastery unlock is still limited to +1 level above current** - Team card quality shifts do NOT allow skipping mastery levels
- **Example**: Precision (Mastery 0) + Fortune's Favor → Boss drops Blue (shifted from Green minimum)
  - Still only unlocks Mastery 1 (not Mastery 2) - unlock is based on current mastery, not drop quality
  - Player gets Blue Precision card for current run (boss ignores cap, team card shifted quality)
  - Future runs: Precision can appear as Green in packs (Mastery 1 unlocked), but not Blue until Mastery 2 is unlocked
- **Visual indicator behavior**: "Boss Unlock Available!" indicator shows if mastery unlock is available, even if card quality is higher than unlock level (e.g., Blue card but only unlocks M1)

**UI Indicator**:
- When boss drops a card at +1 mastery level above current, show prominent "Boss Unlock Available!" indicator
- Visual highlight (golden/glowing border, pulsing animation) to draw attention
- Tooltip shows: "Picking up this card will unlock [Mastery Level] ([Quality] quality) for [Card Name] permanently (FREE)"
  - Example: "Picking up this card will unlock Mastery 1 (Green quality) for Precision permanently (FREE)"
  - Note: Tooltip shows the mastery level that will be unlocked, not necessarily the card's current quality (team cards may shift quality higher)
- Indicator disappears after pickup or if player already has that mastery level
- Indicator shows even if card quality is higher than unlock level (e.g., Blue card but only unlocks M1)
- See Card Display section (5.3) for visual design details

### 3.3 Feature Unlock Progression & UX Flow

**Progression Philosophy**: Features and card types are introduced gradually to prevent overwhelming new players. Each system builds on previous knowledge, creating a natural learning curve. The pacing is intentionally slower in early game to allow mastery of fundamentals before introducing complexity.

**Boss Pacing Structure**:
- **First Boss**: Room 12 (gives ~20-25 minutes of build time)
- **Second Boss**: Room 22 (10 rooms later)
- **Third Boss (Final)**: Room 32 (10 rooms later)
- **Run ends after 3rd boss**
- **Boss Pool Rotation**: 2 bosses per tier for variety

**Unlock Order & Feature Introduction**:

## Phase 1: Tutorial (Runs 1-5)

**Goal:** Master the absolute basics

### Unlocked by Default:
- 3 starter cards (Precision, Bulwark, Velocity) - Mastery 0
- Hand size 4, starting cards 3 (players get all 3 starter cards every run for consistency)
- Basic pack rewards (Standard, Elite)
- Card quality system (white only initially)

### What's NOT Unlocked Yet:
- No upgrade system (intentional - learn cards first)
- No mulligans (learn to play with what you get)
- No new cards yet (master the 3 starters)

**Player Focus:** Learn combat, understand how cards affect gameplay, get comfortable with room types

---

## Phase 2: First Expansion (Runs 6-12)

**Goal:** Introduce progression depth

### Room 10 Milestone:
- Unlock 2 new cards: **Fury** + **Momentum** (offense variety)
- Tutorial: "New cards available! Experiment with offense synergies"

### After 3 Successful Runs:
- Unlock **Mulligan System** (1 mulligan)
- Tutorial: "Reroll your starting hand for better synergies"
- **Why Early?** New players benefit most from mulligans (helps them learn viable combos)

### Room 12 - First Boss:
- Unlock **Upgrade System** (shard spending, quality bands)
- Unlock **Boss Mastery System**
- First boss card drop (guaranteed new card unlock)
- Tutorial: "Bosses drop powerful cards. Spend shards to unlock higher quality tiers"
- **Why Now?** Players have played 6-8 runs, understand card value, ready to invest

---

## Phase 3: Build Variety (Runs 13-25)

**Goal:** Enable specialized builds

### Room 15 Milestone:
- Unlock 2 defense cards: **Lifeline** + **Phase Step**
- Unlock 1 mobility card: **Vector Laminar**

### Room 22 - Second Boss:
- Unlock **Safe/Upgrade Rooms** (first one appears)
- Unlock 1 ability mutator: **Whirlwind Core** (for Square class)
- Tutorial: "Modify your abilities with specialized cards"

### Achievement: "Clear 30 Rooms Total (cumulative)":
- Unlock **Room Modifier System** (tutorial + first modifier card)
- Tutorial: "Make rooms harder for better rewards, or easier for breathing room"

### After 10 Successful Runs:
- Unlock 2nd mulligan (now have 2 total)

---

## Phase 4: Advanced Mechanics (Runs 26-40)

**Goal:** Master risk/reward systems

### Room 25 Milestone:
- Unlock 2 more ability mutators (class-specific)
- Unlock **Volley** card (powerful multishot)

### Achievement: "Clear 50 Rooms Total (cumulative)":
- Unlock **Curse System**
- Unlock **Fractal Conduit** (chain lightning)
- Tutorial: "Curses offer great power at a price"

### Room 30 Milestone:
- Unlock 2 economy cards: **Prism Tax** + **Scholar Sigil**
- Unlock **Reserve Slots** (purchasable)

### Room 32 - Third Boss (Run Ends):
- Unlock **Phoenix Down** (available for purchase after first clear)
- Unlock advanced room modifiers

---

## Phase 5: Mastery (Runs 41+)

**Goal:** Complete collection, optimize builds

### Achievement: "Clear 75 Rooms Total (cumulative)":
- Unlock **Card Combination System** (500 shard purchase)
- Tutorial: "Combine two cards into one for ultimate builds"

### Achievement: "Complete 3 Full Runs":
- Unlock remaining ability mutators
- Unlock all remaining cards via achievements/purchases

### Achievement: "Reach Room 40":
- Unlock **Legendary Room Modifiers**
- Unlock final team cards (multiplayer)

---

## Key Design Principles:

1. **Slower Initial Pace**: 
   - First new cards at Room 10 (not Room 5)
   - Boss system introduced at Room 12 (not Room 5)
   - Upgrades introduced after players understand cards

2. **Spaced Introductions**:
   - Each major system gets 5-10 runs to breathe
   - No more than 2 new concepts per milestone
   - Tutorial prompts for each new system

3. **Achievement-Gated Advanced Content**:
   - Curses, combinations, and advanced modifiers require significant playtime
   - Prevents overwhelming new players
   - Rewards dedicated players

4. **Boss Alignment**:
   - First boss at Room 12 (not 5)
   - Bosses every 10 rooms (not 5)
   - Run ends at Room 32 (3 bosses total)

**Estimated Playtime to Full Unlock**:
- **Basic Proficiency:** 5-8 runs (~3-5 hours)
- **All Core Systems:** 15-20 runs (~8-12 hours)
- **Full Collection:** 40-50 runs (~20-30 hours)
- **Complete Mastery:** 75+ runs (40+ hours)

**UX Flow Principles**:
1. **One new system per milestone** - Don't introduce multiple complex systems simultaneously
2. **Tutorial prompts** - When new features unlock, show brief tutorial/explanation
3. **Visual indicators** - New features should be clearly marked (e.g., "NEW" badge)
4. **Progressive complexity** - Start simple, add complexity gradually
5. **Opt-in complexity** - Advanced features (curses, combination) are optional unlocks

### 3.4 Card Unlock System

**Starter Cards** (unlocked by default - LIMITED SET):
- Players start with a **small subset** of basic cards unlocked at mastery 0:
  - **Offense**: Precision (only)
  - **Defense**: Bulwark (only)
  - **Mobility**: Velocity (only)
- **All starter cards start at mastery 0**, meaning they will ONLY appear as white quality in packs until upgraded
- Provides functional but weak starting deck (3 cards total)
- **Players must unlock additional cards through gameplay** - Not all cards are available from the start
- Players must upgrade cards to unlock higher quality bands (green/blue/purple/orange) for cards they own

**Card Unlock Methods**:
- **Room Milestone Unlocks** - Reach specific room milestones (2-3 cards per milestone)
- **Boss Drops** - Each boss guarantees one new card unlock (random from available pool)
- **Achievement Unlocks** - Complete specific telemetry-based achievements
- **Shard Purchase** - Purchase cards from Nexus shop (prices reflect power/usefulness)
- **Time-Based Unlocks** - Some cards unlock after completing runs within time limits

**Achievement Definition Clarity**:
- **"After X successful runs"** = Completed runs - A run counts as "successful" if it ends by:
  - **Beating the final boss** (Room 32 boss) - Run completed successfully
  - **Dying** - Player death at any point in the run (including before reaching final boss) ends the run and counts toward progression
  - **Does NOT count**: Quitting a run manually, restarting a run, or abandoning a run
  - Cumulative across all runs (e.g., "After 3 successful runs" means 3 runs that ended in boss victory or death, regardless of when death occurred)
- **"Clear X rooms total"** = Cumulative across all runs (e.g., "Clear 30 rooms total" means 30 rooms cleared across any number of runs)
- **"Deal X damage total"** = Cumulative across all runs (lifetime damage dealt)
- **"Achieve X in one run"** = Must be done in a single run (e.g., "Achieve 100 kills in one run")
- **Examples**:
  - "After 3 successful runs" ✅ Clear - means 3 runs that ended in boss victory or death (quitting/restarting doesn't count)
  - "Clear 30 rooms total (cumulative)" ✅ Explicitly cumulative
  - "Deal 10,000 damage (lifetime)" ✅ Explicitly cumulative
  - "Achieve 100 kills in one run" ✅ Clear single-run requirement

**Pricing Philosophy**:
- **Basic cards**: 25-50 shards (simple stat modifiers)
- **Intermediate cards**: 75-125 shards (conditional effects, moderate power)
- **Advanced cards**: 150-200 shards (powerful effects, complex mechanics)
- **Legendary cards**: 400-750 shards (extremely powerful, game-changing effects)
- **Achievement unlocks**: FREE but require specific accomplishments
- **Boss drops**: FREE but random, requires beating bosses
- **Meta unlocks**: 75-500 shards (system unlocks, mulligans, combination)

**Detailed Card Unlock List**:

#### Offense Family Cards

**Precision** - ✅ **Unlocked by default** (Starter card)

**Fury** - **Unlock**: Room 10 milestone OR Purchase 30 shards
- **Power level**: Basic (simple crit damage boost)
- **Unlock priority**: Early (complements Precision)

**Momentum** - **Unlock**: Room 10 milestone OR Purchase 40 shards
- **Power level**: Intermediate (conditional stacking effect)
- **Unlock priority**: Early (teaches conditional mechanics)

**Volley** - **Unlock**: Room 25 milestone OR Purchase 150 shards OR Boss drop (Rooms 22+)
- **Power level**: Advanced (powerful but balanced with trade-offs)
- **Unlock priority**: Mid-Late (high impact card, build-defining)

**Execute** - **Unlock**: Achievement "Deal 10,000 damage (lifetime)" OR Purchase 125 shards
- **Power level**: Advanced (powerful conditional effect)
- **Unlock priority**: Mid (requires understanding of combat)

**Fractal Conduit** - **Unlock**: Achievement "Clear 50 rooms total (cumulative)" OR Purchase 175 shards
- **Power level**: Advanced (complex chaining mechanics)
- **Unlock priority**: Mid (requires understanding of positioning)

**Detonating Vertex** - **Unlock**: Achievement "Achieve 100 kills in one run" OR Purchase 100 shards
- **Power level**: Intermediate (random chance effect)
- **Unlock priority**: Mid (teaches RNG mechanics)

**Overcharge** - **Unlock**: Achievement "Clear 30 rooms total (cumulative)" OR Purchase 75 shards
- **Power level**: Intermediate (time-gated effect)
- **Unlock priority**: Mid (teaches timing mechanics)

#### Defense Family Cards

**Bulwark** - ✅ **Unlocked by default** (Starter card)

**Lifeline** - **Unlock**: Room 15 milestone OR Purchase 50 shards
- **Power level**: Basic (simple lifesteal)
- **Unlock priority**: Early-Mid (essential sustain)

**Fortify Aura** - **Unlock**: Room 15 milestone OR Purchase 75 shards OR Boss drop (Rooms 22+)
- **Power level**: Intermediate (aura effect, multiplayer benefit)
- **Unlock priority**: Mid (teaches aura mechanics)

**Phase Step** - **Unlock**: Room 15 milestone OR Purchase 60 shards
- **Power level**: Basic (utility buff)
- **Unlock priority**: Early-Mid (mobility utility)

**Phasing** - **Unlock**: Achievement "Dodge 500 attacks (lifetime)" OR Purchase 100 shards
- **Power level**: Intermediate (random defensive effect)
- **Unlock priority**: Mid (RNG defense)

**Prism Shield** - **Unlock**: Achievement "Reflect 1,000 damage (lifetime)" OR Purchase 150 shards
- **Power level**: Advanced (powerful reflect mechanic)
- **Unlock priority**: Mid-Late (requires understanding of damage types)

**Phoenix Down** - **Unlock**: Achievement "Revive 10 times (lifetime)" OR Purchase 750 shards (available after first full run clear)
- **Power level**: Legendary (game-changing revive)
- **Unlock priority**: Late (extremely powerful, should be rare)

#### Mobility Family Cards

**Velocity** - ✅ **Unlocked by default** (Starter card)

**Vector Laminar** - **Unlock**: Room 15 milestone OR Purchase 40 shards
- **Power level**: Basic (simple projectile speed)
- **Unlock priority**: Early-Mid (utility)

**Arcane Flow** - **Unlock**: Achievement "Use abilities 200 times (lifetime)" OR Purchase 125 shards
- **Power level**: Advanced (powerful cooldown reduction)
- **Unlock priority**: Mid (high impact for ability-focused builds)

**Parallelogram Slip** - **Unlock**: Achievement "Dodge 300 times (lifetime)" OR Purchase 75 shards
- **Power level**: Intermediate (dodge utility)
- **Unlock priority**: Mid (mobility enhancement)

#### Ability Mutator Family Cards

**Whirlwind Core** - **Unlock**: Room 15 milestone OR Purchase 100 shards (Square class only)
- **Power level**: Advanced (class-specific)
- **Unlock priority**: Mid (requires class understanding)

**Thrust Focus** - **Unlock**: Room 15 milestone OR Purchase 100 shards (Square class only)
- **Power level**: Advanced (class-specific)
- **Unlock priority**: Mid

**Block Stance** - **Unlock**: Achievement "Block 200 attacks (lifetime)" OR Purchase 125 shards (Square class only)
- **Power level**: Advanced (class-specific)
- **Unlock priority**: Mid-Late

**Fan of Knives+** - **Unlock**: Room 15 milestone OR Purchase 100 shards (Triangle class only)
- **Power level**: Advanced (class-specific)
- **Unlock priority**: Mid

**Shadow Clone** - **Unlock**: Room 15 milestone OR Purchase 100 shards (Triangle class only)
- **Power level**: Advanced (class-specific)
- **Unlock priority**: Mid

**Backstab Edge** - **Unlock**: Achievement "Deal 5,000 backstab damage (lifetime)" OR Purchase 125 shards (Triangle class only)
- **Power level**: Advanced (class-specific)
- **Unlock priority**: Mid-Late

**Blink Flux** - **Unlock**: Room 15 milestone OR Purchase 100 shards (Hexagon class only)
- **Power level**: Advanced (class-specific)
- **Unlock priority**: Mid

**Beam Mastery** - **Unlock**: Achievement "Deal 10,000 beam damage (lifetime)" OR Purchase 125 shards (Hexagon class only)
- **Power level**: Advanced (class-specific)
- **Unlock priority**: Mid-Late

**Shield Bulwark** - **Unlock**: Room 15 milestone OR Purchase 100 shards (Pentagon class only)
- **Power level**: Advanced (class-specific)
- **Unlock priority**: Mid

**Hammer Smash** - **Unlock**: Achievement "Stun 100 enemies (lifetime)" OR Purchase 125 shards (Pentagon class only)
- **Power level**: Advanced (class-specific)
- **Unlock priority**: Mid-Late

#### Room Modifier Cards

**Room Modifier System Unlock**: **Unlock**: Achievement "Clear 30 rooms total (cumulative)" OR Purchase 100 shards (unlocks entire system)
- **Note**: Once system is unlocked, individual room modifier cards drop from elite/boss rooms
- **Individual cards**: Drop from elite rooms (25% chance), boss rooms (40% chance)
- **Storage**: Max 3 cards carried on run, up to 30-40 stored in Nexus
  - **Storage Cap Rationale**: Prevents players from accumulating hundreds of room modifiers over long play sessions, which would make browsing and selecting modifiers tedious and overwhelming. The cap encourages active use and conversion, keeping the system manageable.
- **Conversion**: Can convert room modifiers to 25 shards at Nexus (discard permanently)
- **No individual purchase** - Room modifiers are acquired through gameplay only
- **No guaranteed drops** - Removed "guaranteed every 7 rooms" to prevent redundancy with boss drops and reduce clutter

#### Curse Cards

**Curse System Unlock**: **Unlock**: Achievement "Clear 50 rooms total (cumulative)" OR Purchase 200 shards (unlocks entire system)
- **Note**: Once system is unlocked, curse cards can appear in curse packs (voluntary door option), boss offers (25% chance, optional), or elite rooms (15% chance, optional)
- **All curse acquisition is voluntary** - Players can always decline curse offers
- **No individual purchase** - Curses are acquired through gameplay only

**Boss Drops**:
- Each boss guarantees one new card unlock (random from available pool for current progression)
- **Boss drops ignore mastery cap by +1 level minimum** (see Boss Mastery Unlock System section 3.2.5)
- Quality is based on boss room distribution and boss tier (First/Second/Final - Rooms 12/22/32)
- **Picking up boss card unlocks mastery level** - FREE mastery unlock if card mastery is below drop quality (see section 3.2.5 for details)

**Team Card Unlocks** (multiplayer only):
- Complete 10 rooms together: Coordinated Strike
- Revive teammates 5 times: Shared Resilience
- Complete 25 rooms together: Synergy Boost
- Revive teammates 15 times: Revival Protocol
- Clear 3 boss rooms: Elite Bounty
- Reach room 20 with 4 players: Challenge Mode
- Complete 50 rooms together: Fortune's Favor
- 10 flawless clears: Nexus Link
- 25 combo chains: Combo Chain
- Tank completes 30 rooms: Guardian Aura
- Complete 40 rooms together: Resource Pool
- Reach room 30 with 4 players: Adaptive Tactics
- Revive teammates 30 times: Last Stand
- Complete 60 rooms together: Shared Burden

**Meta-Progression Unlocks** (purchasable with shards):

**Mulligan System**:
- **1st Mulligan**: Unlocks after 3 successful runs OR Purchase 50 shards
- **2nd Mulligan**: Unlocks after 10 successful runs OR Purchase 150 shards
- **Maximum**: 2 mulligans per run
- **Rationale**: New players benefit most from mulligans (helps them learn viable combos), while experienced players can purchase immediately if desired
- **"Successful Run" Definition**: A run counts as successful if it ends by:
  - **Beating the final boss** (Room 32 boss) - Run completed successfully
  - **Dying** - Player death at any point in the run (including before reaching final boss) ends the run and counts toward progression
  - **Does NOT count**: Quitting a run manually, restarting a run, or abandoning a run

**Card Combination System**:
- **Unlock**: Achievement "Clear 75 rooms total (cumulative)" OR Purchase 500 shards
- **Late-game power spike** - Allows combining two cards into one slot
- **Upgrade costs**: Combined cards have 1.75x mastery upgrade costs

**Reserve Slots**:
- **Unlock**: Room 30 milestone OR Purchase (price TBD)
- **Function**: Store cards outside hand for later use

**Room Modifier System**:
- **Unlock**: Achievement "Clear 30 rooms total (cumulative)" OR Purchase 100 shards
- **Storage**: Max 3 cards carried on run, up to 30-40 stored in Nexus
- **Rationale**: Core system should be accessible earlier, especially for struggling players

**Curse System**:
- **Unlock**: Achievement "Clear 50 rooms total (cumulative)" OR Purchase 200 shards
- **Function**: Enables curse cards to appear in packs and offers

### 3.5 Card Shard System

**Shard Sources**:
- Room completion: Base 5 shards + (room number × 2)
- Elite rooms: +10 shards
- Boss rooms: +50 shards
- Mastery Pack rooms: +25 shards
- Card shard cards: Variable based on quality

**Shard Uses**:
- Upgrade card mastery levels
- Purchase deck upgrades (hand size, mulligans, etc.)
- Convert to currency (10 shards = 1 currency) - not recommended

---

## Phase 4: Deck & Run Flow

### 4.1 Deck Manager

**File**: `js/cards/deck-manager.js`

**State Variables** (stored in `Game` object):
```javascript
Game.runDeck = [];              // Shuffled deck for current run
Game.drawPile = [];             // Remaining cards to draw
Game.hand = [];                 // Current hand (max size from upgrades)
Game.discard = [];              // Discarded cards
Game.spent = [];                // One-time use cards (consumed)
Game.reserve = [];              // Reserved cards (meta upgrade)
Game.roomModifierInventory = []; // Room modifier cards carried on run (max 3 default, from collection of 20)
Game.activeTeamCards = [];      // Active team cards (multiplayer)
```

**Card Instance Properties** (Runtime):
- All card instances in `Game.hand`, `Game.drawPile`, `Game.discard` must include:
  - `origin: 'deck' | 'found'` - Tracks whether card came from deck (reshuffles) or was found during run (temporary)
  - Cards drawn from deck: `origin = 'deck'`
  - Cards picked up during run: `origin = 'found'`

**Core Functions**:
- `shuffleDeck(deck)`: Shuffle deck using seeded RNG (for multiplayer sync)
- `drawCards(count, qualityDistribution)`: Draw cards with quality based on room. Non-stacking cards cannot be drawn if already in hand. **All cards drawn from drawPile must be tagged with `origin: 'deck'`**.
- `mulligan(cardIndices)`: Shuffle selected cards back into draw pile, then draw new cards using starting distribution (80/15/5/0/0). Non-stacking cards cannot be drawn if already in hand. **New cards drawn must be tagged with `origin: 'deck'`**.
- `playCard(cardId)`: Activate card effect, move to appropriate pile (discard for persistent, spent for one-time use/destroyed cards like Phoenix Down)
- `discardCard(cardId)`: Move card to discard pile. **Preserves `origin` property**.
- `addToHand(card)`: Add card to hand (or swap if full). If card is non-stacking and already in hand, reject or swap with existing copy. **When adding picked-up cards, must tag with `origin: 'found'`**.
- `useRoomModifier(cardId, targetRoom)`: Consume room modifier card

### 4.1.5 Card Deck vs Hand Circulation

**Deck Composition**:
- Deck contains card **TYPES/FAMILIES** (e.g., "3x Precision", "2x Bulwark")
- **Quality bands are NOT pre-determined in deck** - Quality is rolled when card is drawn from deck
- Same card type can appear multiple times in deck with different qualities when drawn

**Drawing from Deck**:
- When drawing from `drawPile`, quality is rolled based on current room distribution **AND mastery level**
- Quality is capped by mastery level - cards can only appear at quality bands you've unlocked
- Same card type can be drawn multiple times with different qualities (within mastery limits)
- **All cards drawn from deck must be tagged with `origin: 'deck'`** - This marks them as permanent deck cards that will reshuffle
- **Example**: 
  - Precision at mastery 0: Draw 1 → Precision (White only, mastery 0 caps it) with `origin: 'deck'`
  - Precision at mastery 1: Draw 2 → Precision (White or Green, rolled using room 1 distribution, but blue/purple/orange not possible) with `origin: 'deck'`
  - Precision at mastery 2: Room 5 clear → Precision (White/Green/Blue possible, rolled using room 5 distribution, but purple/orange not possible) with `origin: 'deck'`

**Picked-Up Cards (During Run)**:
- Cards picked up during run (from room clears) **ADD to hand** (if space available)
- **All picked-up cards must be tagged with `origin: 'found'`** - This marks them as temporary cards that will NOT reshuffle
- **Picked-up cards do NOT enter the draw pile** - They exist only in hand until discarded
- When discarded, picked-up cards enter `discard` pile (with `origin: 'found'` preserved)
- **When discard pile reshuffles into draw pile**: 
  - Cards with `origin: 'deck'` **DO reshuffle back** into draw pile (permanent deck cards)
  - Cards with `origin: 'found'` **DO NOT reshuffle back** - They are permanently removed from circulation after being discarded

**Card Lifecycle Example**:
1. Deck has "3x Precision" (card type, not specific instances), Precision is mastery 2 (white/green/blue unlocked)
2. Draw Precision (White) → enters hand with `origin: 'deck'` (rolled white from room 1 distribution, within mastery 2 limits)
3. Draw Precision (Green) → enters hand with `origin: 'deck'` (rolled green from room 1 distribution, within mastery 2 limits)
4. Room 5: Precision (Blue) drops on ground → picked up → enters hand with `origin: 'found'` (rolled blue from room 5 distribution, within mastery 2 limits - purple/orange not possible)
5. Hand now has: Precision (White, origin: 'deck'), Precision (Green, origin: 'deck'), Precision (Blue, origin: 'found')
6. If Precision (Blue) is discarded → enters discard pile with `origin: 'found'` preserved
7. When discard reshuffles → Precision (White) and Precision (Green) reshuffle (they have `origin: 'deck'`), but Precision (Blue) does NOT (it has `origin: 'found'` and is permanently removed)

**Why This Matters**:
- Picked-up cards are temporary bonuses - they don't persist through deck cycles
- Deck cards can be drawn multiple times with different qualities
- Prevents picked-up cards from cluttering the deck permanently
- Creates distinction between "core deck" and "run bonuses"

### 4.2 Run Start Flow

1. **Deck Selection** (Nexus):
   - Player selects cards for deck (max 20, upgradeable)
   - Deck validated (must have at least 10 cards)
   - Deck saved to `Game.runDeck`

2. **Deck Shuffle**:
   - Deck shuffled using seeded RNG (for multiplayer sync)
   - `Game.drawPile` initialized with shuffled deck
   - `Game.hand` initialized as empty

3. **Starting Draw**:
   - Calculate average mastery level across all cards in deck
   - Apply mastery floor distribution (see Quality Distribution Curves section)
   - Draw `startingCards` cards (default 3, upgradeable to 4, max `handSize`) using mastery-adjusted starting distribution
   - Cards added to `Game.hand` with `origin: 'deck'`
   - If mulligans unlocked (`mulligans > 0`), UI shows mulligan screen
   - If no mulligans unlocked, proceed directly to run start

4. **Mulligan Phase** (if unlocked):
   - Player selects up to `mulligans` cards from starting hand to mulligan (default 0, unlockable via meta-progression)
   - Selected cards are shuffled back into `Game.drawPile` (cards are not removed from the run)
   - New cards drawn using mastery-adjusted starting distribution (same as initial starting draw, respects mastery floor)
   - Mulligan complete, run begins with new starting hand

5. **Run Start**:
   - `Game.startGame()` called
   - Team cards activated (multiplayer)
   - First room generated
   - Hand displayed in HUD

### 4.2.5 Card Discard Rules

**Discard Mechanics**:
- **Players cannot voluntarily discard cards from hand** - Cards must be discarded through specific game mechanics
- **Cards are discarded only when**:
  a) Hand is full and player picks up new card (must choose to swap with existing card or discard new card)
  b) Card effect requires discard as cost (if any such cards exist)
  c) Card is destroyed (one-time use effects like Phoenix Down go to spent pile, not discard)
- **Exception: Curse cards** - Curses cannot be discarded through normal means (hand full + pickup). They can only be removed through special mechanics (Purification Room, Purification Scroll, boss reward)
- **Discarded cards enter `Game.discard` pile** (with `origin` property preserved)
- **When draw pile is empty**: Discard pile is filtered and shuffled into draw pile:
  - Cards with `origin: 'deck'` are shuffled back into draw pile (creates a cycle)
  - Cards with `origin: 'found'` are permanently removed from circulation (do NOT reshuffle)
- **Exception**: Spent/destroyed cards (in `Game.spent`) never return to draw pile - they are permanently removed from the run

**Discard vs Spent vs Cursed**:
- **Discard pile**: Cards that can be reshuffled back into draw pile (normal discards)
- **Spent pile**: Cards permanently removed from run (one-time use cards like Phoenix Down, consumed room modifiers)
- **Cursed cards**: Cannot be voluntarily discarded, must be removed through special purification mechanics

### 4.3 Room Clear & Door Selection

**When room clears** (`checkRoomCleared` in `level.js`):

1. **Generate Door Options**:
   - Generate 2-3 door options based on room number and available pack types
   - Each door represents a card pack reward
   - Doors show: pack type, preview of cards (one per player from their deck), bonus rewards

2. **Door Selection**:
   - All players see same door options
   - In multiplayer, players vote/select door (majority wins, or host decides on tie)
   - Selected door's pack queued for next room

3. **Room Transition**:
   - `Game.advanceToNextRoom()` called
   - Next room generated with selected pack type
   - Room difficulty adjusted based on pack type

4. **Reward Drop**:
   - On room clear, rewards from pack dropped/displayed based on pack type:
     - **Card rewards**: Cards dropped on ground, visible to all players, each shows which player's deck it came from
     - **Upgrade rewards**: UI prompt appears - player selects which card in hand to upgrade (or takes shards)
     - **Utility rewards**: Health restored, shards granted, hand slot added, etc. (immediate effect)
   - Rewards synced in multiplayer (host authoritative)

5. **Card Pickup** (if card reward):
   - Any player can pick up any card (not just their own)
   - If hand has space: card added to hand
   - **All picked-up cards must be tagged with `origin: 'found'`** when added to hand (marks them as temporary, will not reshuffle)
   - If hand full: player chooses to swap with existing card or discard new card
   - Card pickup synced in multiplayer (host authoritative)

6. **Upgrade Selection** (if upgrade reward):
   - UI shows all cards in hand
   - Player selects which card to upgrade by 1 quality band
   - OR: Player can choose to take shards instead (if option available)
   - Upgrade applied immediately

7. **Next Room Selection**:
   - After card pickup (or skip), players can select next room door
   - Process repeats

### 4.4 Card Effect Application

**File**: `js/cards/card-effects.js`

**Effect Resolver**:
- Stat modifiers: Apply to `player.damage`, `player.defense`, `player.moveSpeed`, etc.
- Ability modifiers: Modify `player.whirlwindDuration`, `player.dodgeCharges`, etc.
- Enemy modifiers: Adjust `enemy.maxHp`, `enemy.damage` in `generateRoom`
- Room modifiers: Affect door options, hazards
- Economy: Modify `calculateCurrency`, XP gain formulas

**Integration Points**:
- Replace all `generateGear` stat application with card effect resolver
- Hook into `PlayerInstance.updateEffectiveStats()` to apply card effects
- Hook into `generateRoom()` to apply enemy modifier cards
- Hook into `calculateCurrency()` to apply economy cards

### 4.5 Room Modifier Card System

**Inventory Management**:
- **Nexus Storage**: Up to 20 room modifier cards stored in `SaveSystem.roomModifierCollection`
- **Run Inventory**: Max 3 cards carried on run (default), upgradeable via meta-progression
- Cards selected from Nexus collection before run starts, loaded into `Game.roomModifierInventory`
- UI shows available room modifier cards when selecting doors

**Activation**:
- Player selects room modifier card before entering room (when choosing door)
- Only one room modifier can be used per room (prevents stacking)
- Card consumed (removed from run inventory, but remains in Nexus collection)
- Effect applied to next room generation

**Acquisition**:
- Drop from elite rooms (20% chance) - Increased from 10% to ensure reasonable acquisition
- Drop from boss rooms (50% chance) - Increased from 25% to make boss rewards more meaningful
- Special event rooms (guaranteed)
- **Room modifier card packs** - Available as door options (rare, appears every 5-7 rooms)
- **Shard purchase** - 50 shards for random room modifier (available in safe/upgrade rooms)
- Cards added to Nexus collection (max 30-40 stored), can be selected for future runs (max 3 carried per run)

**Acquisition Rate Analysis** (32-room run):
- Typical run: ~4 elite rooms, 3 boss rooms
- Elite drops: 4 × 25% = 1.0 expected (increased from 15% to make elites more rewarding)
- Boss drops: 3 × 40% = 1.2 expected
- **Total expected per run: ~2.2 room modifiers** (balanced for 3 carry limit)
- **Note**: With max carry of 3 and storage of 30-40, players will need to use or convert modifiers regularly to avoid hitting storage cap. The storage cap exists to prevent overwhelming inventory management for long-term players.

### 4.6 Bonus Room Types

**Extra Slot Room** (Bonus Slot Pack):
- Rare challenge room
- Grants +1 hand slot for rest of run
- Very difficult (+50% HP/damage, elite enemies)
- Can only appear once per run

**Health Restore Room** (Rest Pack):
- Full heal for all players
- Easier enemies (-20% HP/damage)
- Card swap option available

**XP Boost Room** (Challenge Pack variant):
- +50% XP for room
- Moderate difficulty (+30% HP/damage)
- High quality card rewards

**Shard Room** (Mastery Pack):
- Grants card shards (amount based on room number)
- Moderate difficulty (+20% HP/damage)
- Useful for meta-progression

**Purification Room** (Deterministic - Curse Removal):
- **Door Option**: Appears as a door choice every 8-10 rooms (deterministic cadence)
- **Guaranteed After Curse**: After taking a curse, Purification Room door is GUARANTEED to appear within next 8 rooms
- Removes one curse card from hand (player chooses which curse to remove)
- Moderate difficulty (+25% HP/damage)
- Alternative reward: 40 shards if player has no curses
- Door clearly labeled: "🔮 PURIFICATION CHAMBER"
- Creates a "curse window" - players know they can remove it soon if needed

### 4.7 Card Combination System

**Unlock Requirement**: Late meta-progression upgrade (500 shards) - `cardCombinationUnlocked` flag

**Purpose**: Allows players to combine two cards from their hand into one during a run, effectively putting two cards into one slot. This provides deeper progression after all hand slots are unlocked.

**Important**: Card combination is **single-run only** and **hand-only**. It does not modify your deck permanently. The combined card exists only for the current run.

**Mechanics**:
- Available at safe/upgrade rooms (same location as card quality band upgrades)
- Player selects two cards from hand to combine
- **The two source cards are destroyed from the hand** (removed permanently from the run)
- **The combined card is added to the hand** (takes up one slot)
- Combined card inherits effects from both cards
- Combined card takes up one slot but provides effects of two cards
- Combined cards can be upgraded (quality bands) during the run, but costs are 1.75x normal (provides slight benefit over upgrading two separate cards)
- **Combined cards are lost at the end of the run** - they do not persist to your deck or collection

**Combination Rules**:
- Both cards must be from hand (cannot combine from discard or deck)
- Cards must be different families (cannot combine two Precision cards)
- **Combination depth limit: 1** - Combined cards cannot be combined again. You cannot combine a combined card with another card to get three or more affixes on one card.
- Combined card quality band = average of both cards (rounded down)
  - Example: White + Green = White, Green + Blue = Green, Blue + Purple = Blue
- Combined card effects stack additively (both effects apply)
- Combined card name = "[Family1] + [Family2]" (e.g., "Precision + Bulwark")
- **Source cards are destroyed** - they cannot be recovered or split back

**Upgrade Costs** (for combined cards, during the run):
- Quality band upgrades cost 1.75x normal (provides 12.5% discount vs upgrading two separate cards)
- Example: White → Green normally costs 10 shards, for combined card costs 17.5 shards (rounded to 18)
- Mastery upgrades also cost 1.75x normal (if applicable during run)

**Balance Considerations**:
- High initial cost (500 shards) offsets the benefit of 2 cards in 1 slot
- 1.75x upgrade costs provide slight benefit (12.5% discount) while preventing easy power scaling
- Requires strategic planning (which cards to combine, when to combine them)
- **Combination depth limit: 1** - Prevents exponential power scaling by limiting to 2 affixes per card maximum
- **Single-run only** - combined cards are lost at run end, preventing permanent power accumulation
- **Hand-only** - does not affect deck composition, only current run hand
- Source cards are permanently destroyed from the run, creating meaningful opportunity cost

**UI Requirements**:
- Combination interface at safe/upgrade rooms
- Show preview of combined card effects before confirming
- Display 1.75x upgrade costs clearly (show both normal cost and combined card cost)
- Visual indicator for combined cards (special border/icon)
- **Combined cards are disabled/grayed out in the combination interface** - they cannot be selected for further combination (depth limit: 1)

---

## Phase 5: UI Implementation

### 5.1 Nexus UI

**Deck Builder Panel** (`js/nexus.js`, `js/ui.js`):
- Card library browser (filter by category, search)
- Deck slots (drag and drop cards)
- Card preview (quality bands, effects, flavor text)
- Deck validation (min 10 cards, max 20)
- Save/load deck presets

**Card Mastery Panel**:
- View all unlocked cards
- Show mastery levels and upgrade costs
- Upgrade interface (spend shards)
- Unlock requirements display

**Team Card Selector** (multiplayer only):
- Browse unlocked team cards
- Select one team card for run
- Show team card effects and unlock requirements
- Host validates no duplicates (if restriction exists)

**Room Modifier Collection Manager**:
- View all room modifier cards in collection (up to 20 stored)
- Select up to 3 cards to carry on next run (based on `roomModifierCarrySlots`)
- Cards can be organized, favorited, or discarded
- Collection persists between runs (cards not consumed from collection when used)

**Upgrade Shop**:
- Purchase hand size upgrades (cost: 50 shards per slot, unlocks more slots)
- Purchase starting cards upgrade:
  - **Default**: 3 cards (all starters)
  - **Purchase 1**: 4 cards (75 shards)
  - **Maximum**: Equal to current `handSize`
  - **Upgrade Path**: If hand size increases, starting cards can be purchased up to new hand size limit (e.g., hand size 5 → can purchase starting cards to 5)
  - **Cost Scaling**: 75 shards × current starting cards count (3→4 = 75 shards, 4→5 = 150 shards, 5→6 = 225 shards, etc.)
  - **Cannot exceed hand size**: Starting cards cannot exceed `handSize` (e.g., if hand size is 4, starting cards max is 4)
- Unlock mulligans (1st: 50 shards, 2nd: 150 shards, can purchase up to 2 total)
- Purchase reserve slots (cost: 100 shards per slot)
- Purchase room modifier carry slots (cost: 150 shards per slot, max 3 → 5)
- Unlock card combination (cost: 500 shards, late meta-progression, allows combining two cards into one)

### 5.2 Run HUD

**Hand Display** (`js/ui.js`):
- Show current cards in hand
- Quality indicators (border glow, tier colors)
- **Card Origin Icons**: Each card must display a small, non-intrusive icon in one corner (e.g., top-right) based on `card.origin`:
  - **`origin: 'deck'`**: Display "Deck" icon (suggestion: stacked cards icon or circular arrow/cycle icon) - indicates card will reshuffle when discarded
  - **`origin: 'found'`**: Display "Temporary" icon (suggestion: spark icon, one-time icon like '1x', or download arrow icon) - indicates card will be removed when discarded
- Card tooltips (effects, flavor text, origin information)
- Play/discard buttons

**Active Effects Panel**:
- Show persistent card effects
- Duration timers (if applicable)
- Stack counts (for stacking effects)

**Door Selection UI**:
- Show pack previews (cards, bonuses, difficulty)
- Room modifier card selection (if available)
- Vote/selection interface (multiplayer)
- Difficulty indicators

**Card Pickup Interface**:
- Show dropped cards from pack
- Swap options (if hand full)
- Card preview on hover
- Pickup confirmation
- **Boss Mastery Unlock Indicator**: When boss drops a card at +1 mastery level above current:
  - **Pre-pickup**: Visual indicator (glow/border) on ground card - "Boss Unlock Available!" glows on card
  - **Post-pickup**: Banner notification + sound effect - "Mastery 1 Unlocked for Precision!" (creates memorable "moment")
  - Visual highlight (glow, border, or icon) to draw attention
  - Tooltip/description: "Picking up this card will unlock [Mastery Level] ([Quality] quality) for [Card Name] permanently (FREE)"
    - Example: "Picking up this card will unlock Mastery 1 (Green quality) for Precision permanently (FREE)"
    - Note: Shows the mastery level that will be unlocked, not necessarily the card's current quality (team cards may shift quality higher)
  - Indicator disappears after pickup or if player already has that mastery level
  - Indicator shows even if card quality is higher than unlock level (e.g., Blue card but only unlocks M1)

**Team Card Indicators**:
- Show active team cards with player attribution
- Team card effects display
- Duration/cooldown indicators

**Run End / Death UI** (Optional Polish):
- **After player dies (any room)**: Show banner "Run Complete - Progress Made!"
- **Show unlock progress**: Display progress toward next unlock
  - Example: "Mulligan unlocked! (3/3 successful runs)"
  - Example: "Progress toward 2nd Mulligan: 7/10 successful runs"
- **Rationale**: Makes the "death = progression" mechanic visible to players, reducing frustration and reinforcing that deaths contribute to meta-progression

**Safe/Upgrade Room UI**:
- **Shard Purchase Interface** (Permanent Unlocks): Spend shards to permanently upgrade card mastery levels at Nexus. These are permanent unlocks that persist across all future runs.
- **In-Run Upgrade Interface** (Temporary): Upgrade cards in-hand for this run only using upgrade rewards from packs. These do NOT grant permanent mastery unlocks.
- Card combination interface (if unlocked):
  - Select two cards from hand to combine
  - **Combined cards are disabled/grayed out** - cannot be selected for further combination (depth limit: 1)
  - Preview combined card effects before confirming
  - Show 1.75x upgrade costs clearly (display both normal and combined card costs)
  - **Warning**: Confirmation dialog clearly states that source cards will be destroyed and combined card is single-run only (lost at run end)
  - Show clear indication that this is a run-only combination, not permanent
- Visual indicator for combined cards (special border/icon in hand display)

### 5.3 Card Display

**Visual Design**:
- Use tier colors from `GEAR_TIERS` (gray, green, blue, purple, orange)
- Pulse animation similar to current loot rendering
- Quality band indicators (border glow intensity)
- Flavor text tooltips on hover
- Card art/icons (geometric shapes matching game theme)
- **Boss Mastery Unlock Indicator**: Special visual treatment for boss cards that unlock mastery:
  - Prominent "Boss Unlock Available!" text/banner on card
  - Golden/glowing border or icon overlay
  - Pulsing or animated effect to draw attention
  - Distinct from normal card glow (more prominent)

**Card Tooltip**:
- Card name and family
- Quality band and value
- Effect description
- Flavor text
- Trade-offs (if any)
- Mastery level and upgrade info
- **Card Origin Information** (new line below trade-offs):
  - **If `card.origin === 'deck'`**: "Source: From Deck (Reshuffles when discarded)"
  - **If `card.origin === 'found'`**: "Source: Found in Run (Removed from run when discarded)"
- **Boss unlock info** (if applicable): "Picking up this card will unlock [Mastery Level] ([Quality] quality) for [Card Name] permanently (FREE mastery unlock)"
  - Example: "Picking up this card will unlock Mastery 1 (Green quality) for Precision permanently (FREE mastery unlock)"
  - Note: Shows the mastery level that will be unlocked, not necessarily the card's current quality (team cards may shift quality higher)

---

## Phase 6: Multiplayer Integration

### 6.1 Multiplayer Protocol

**File**: `js/multiplayer.js` - Extend `multiplayerManager`

**New Message Types**:
- `deck_sync`: Host sends deck seed + card IDs to clients
- `mulligan_choice`: Client sends mulligan selections to host
- `card_play`: Client sends card play to host, host validates and broadcasts
- `door_selection`: All players vote/select door, host resolves
- `card_pickup`: Client sends pickup to host, host validates and broadcasts
- `team_card_select`: Pre-run team card selection in lobby
- `team_card_activate`: Host activates team cards on run start
- `room_modifier_use`: Client sends room modifier use to host

**Host Authority**:
- Host generates all RNG (card draws, quality bands, door options)
- Host validates all card plays and pickups
- Host broadcasts state changes to clients
- Clients interpolate card effects for smooth gameplay

### 6.2 Team Card System

**Pre-Run Selection**:
- Each player equips one team card in Nexus lobby
- Host validates no duplicates (if restriction exists)
- Team card selections synced to all clients
- UI shows all team cards before run start

**Activation**:
- Team cards activate on `Game.startGame()`
- Effects apply to all players for entire run
- Team card effects stored in `Game.activeTeamCards`
- UI shows active team cards in HUD with player attribution

**Effect Application**:
- Team card effects modify global run state
- Enemy scaling (`getMultiplayerScaling` adjustments)
- Card quality curves (shift distributions)
- Economy formulas (`calculateCurrency` multipliers)
- Revive mechanics (`reviveDeadPlayers` parameters)
- Proximity-based buffs (distance checks in player update loops)

### 6.3 Card Pack Generation

**Host Generation**:
- Host generates door options based on room number
- Each door pack contains: 1 card per player from their deck
- Card quality based on room distribution + mastery bonuses
- Pack type determines bonuses (health, XP, slot, shards)

**Synchronization**:
- All players see same door options
- Door selection synced (voting or host decision)
- Card pack contents determined by host
- Cards dropped on ground, visible to all players

**Card Pickup**:
- Any player can pick up any card
- Host validates pickup (hand space, swap logic)
- Host broadcasts pickup to all clients
- Card removed from ground for all players

---

## Phase 7: Migration & Testing

### 7.1 Migration Script

**File**: `js/cards/migration.js`

**Migration Logic**:
1. Check if migration already completed (`migratedFromGear` flag)
2. Load existing gear save data
3. Map highest tier gear owned → equivalent starter cards
4. Grant starter deck (all white quality basics)
5. Set `migratedFromGear` flag
6. Save updated save data

**Gear to Card Mapping**:
- Highest tier weapon → Precision (white) + Fury (white)
- Highest tier armor → Bulwark (white) + Fortify Aura (white)
- Highest tier accessory → Velocity (white) + Arcane Flow (white)
- Purple+ gear → Unlock corresponding card families
- Orange gear → Unlock legendary cards

**Fallback Deck**:
- New players get: Precision, Bulwark, Velocity, Arcane Flow (all white)
- Provides functional starting deck
- Players can immediately start playing

### 7.2 Balance Testing

**Metrics to Monitor** (via telemetry):
- Card pick rates (which cards are chosen most)
- Win rates by card combinations
- Room clear times by card loadouts
- Damage output by card quality
- Player retention by progression stage

**Balance Adjustments**:
- Adjust quality distributions if progression feels too slow/fast
- Tune card effect values if too strong/weak
- Modify unlock requirements if too easy/hard
- Adjust shard costs if economy feels off

### 7.3 QA Plan

**Unit Tests**:
- Card draw odds (verify distribution curves)
- Deck persistence (save/load)
- Effect application (stat modifications)
- Quality band calculations

**Integration Tests**:
- Multiplayer sync (card draws, plays, pickups)
- UI flows (deck builder, card selection, pickup)
- Room modifier system
- Team card activation

**Regression Tests**:
- Ensure old gear system disabled cleanly
- Verify no gear drops occur
- Check save migration works correctly
- Confirm multiplayer compatibility

**Performance Tests**:
- Card effect calculations (should be fast)
- UI rendering with many cards
- Multiplayer sync overhead
- Save/load performance

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create `js/cards/` directory structure
- [ ] Define card data schema
- [ ] Extend save system with card data
- [ ] Create migration script
- [ ] Test save/load functionality

### Phase 2: Card Catalog
- [ ] Create complete card catalog (all families)
- [ ] Implement quality band system
- [ ] Write flavor text for all cards
- [ ] Balance card effects (especially multishot)
- [ ] Create team card catalog
- [ ] Create room modifier card catalog

### Phase 3: Deck System
- [ ] Implement deck manager
- [ ] Create run start flow (shuffle, draw, mulligan)
- [ ] Implement card effect resolver
- [ ] Hook into player stat system
- [ ] Hook into enemy spawn system
- [ ] Hook into economy system

### Phase 4: Room Flow
- [ ] Implement door selection system
- [ ] Create card pack generation
- [ ] Implement card pickup system
- [ ] Create room modifier inventory
- [ ] Implement bonus room types

### Phase 5: UI
- [ ] Create deck builder UI
- [ ] Create card mastery UI
- [ ] Create team card selector
- [ ] Create run HUD (hand, effects, doors)
- [ ] Create card pickup interface
- [ ] Implement card tooltips

### Phase 6: Multiplayer
- [ ] Extend multiplayer protocol
- [ ] Implement deck sync
- [ ] Implement card play sync
- [ ] Implement door selection sync
- [ ] Implement card pickup sync
- [ ] Implement team card system

### Phase 7: Polish
- [ ] Run migration script
- [ ] Balance testing
- [ ] QA testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Release

---

## Conclusion

This design specification provides a comprehensive blueprint for replacing the gear system with a card-based progression system. The system is designed to be balanced, engaging, and work seamlessly in both single-player and multiplayer scenarios. Key innovations include:

1. **Progressive power**: Players start weak and build power throughout runs
2. **Strategic choices**: Room selection determines rewards, creating meaningful decisions
3. **Balanced scaling**: All powerful effects have trade-offs or limitations
4. **Meta-progression**: Cards unlock and upgrade permanently
5. **Multiplayer synergy**: Team cards and shared card pools encourage cooperation
6. **Room modifiers**: Separate inventory system for rare, powerful room modifications

The system maintains the geometric theme of the game while providing deep customization and progression options for players.

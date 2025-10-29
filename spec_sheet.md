# Shape Slayer - Game Design Specification

## Project Overview
A skill-based 2D top-down ARPG using HTML5 Canvas 2D and vanilla JavaScript. Players control geometric shapes, fight through rooms of enemies, collect gear, and level up in a fast-paced combat system.

**Genre:** Action Roguelike  
**Platform:** Web Browser (HTML5 Canvas)  
**Tech Stack:** Vanilla JavaScript (ES6+), Canvas 2D API  
**Target Session Length:** 10-15 minutes  

---

## Core Concept: "Shape Slayer"

### Visual Design Philosophy
Simple geometric shapes with clear visual hierarchy. Every element should be easily recognizable at a glance.

---

## Player Classes

### Triangle (Rogue)
- **HP:** Low
- **Speed:** Fast
- **Playstyle:** High mobility, critical hits
- **Base Stats:**
  - HP: 75
  - Damage: 12
  - Speed: 250
  - Crit Chance: 25%

### Square (Warrior)
- **HP:** Medium
- **Speed:** Medium
- **Playstyle:** Balanced, defensive options
- **Base Stats:**
  - HP: 100
  - Damage: 14
  - Speed: 200
  - Defense: 10%

### Pentagon (Tank)
- **HP:** High
- **Speed:** Slow
- **Playstyle:** Area damage, damage soaking
- **Base Stats:**
  - HP: 150
  - Damage: 8
  - Speed: 150
  - Defense: 20%

### Hexagon (Mage)
- **HP:** Low
- **Speed:** Medium
- **Playstyle:** Ranged attacks, high damage
- **Base Stats:**
  - HP: 80
  - Damage: 20
  - Speed: 180
  - Projectile Range: 300

---

## Enemy Types

### Small Circles (Swarmer)
- **Behavior:** Chase player, lunge attacks
- **HP:** Low
- **Speed:** Medium
- **Attack:** Flash red before lunging forward
- **XP Value:** 10
- **Loot Chance:** 30%

### Diamonds (Assassin)
- **Behavior:** Circle around player, dash attacks
- **HP:** Low
- **Speed:** Fast
- **Attack:** Zigzag movement, telegraphs dash
- **XP Value:** 15
- **Loot Chance:** 35%

### Rectangles (Brute)
- **Behavior:** Slow movement, charging slams
- **HP:** Very High
- **Speed:** Slow
- **Attack:** Wind up (grow bigger) before slam with shockwave
- **XP Value:** 25
- **Loot Chance:** 40%

### Stars (Shooter)
- **Behavior:** Keep distance, ranged attacks
- **HP:** Medium
- **Speed:** Medium
- **Attack:** Spin before firing projectile
- **XP Value:** 20
- **Loot Chance:** 35%

### Octagons (Elite)
- **Behavior:** Combination attacks, summoning
- **HP:** High
- **Speed:** Medium
- **Attack:** Spin attacks, pulse to summon minions
- **XP Value:** 50
- **Loot Chance:** 60%

---

## Combat System

### Control Scheme
- **WASD:** Move in 8 directions
- **Mouse:** Player rotates to face cursor
- **Left Click:** Basic attack (~0.3s cooldown)
- **Right Click:** Heavy attack (~1.5s cooldown)
- **Spacebar:** Class special ability (~5s cooldown)
- **Shift:** Dodge roll with i-frames (~2s cooldown)

### Combat Philosophy
"Dark Souls meets Geometry" - Every action has commitment and can be punished.

### Attack System
- **Basic Attack:** Quick damage, short cooldown
- **Heavy Attack:** Higher damage, knockback, longer windup
  - **Charge Indicator:** Pulsing circle shows during 0.3s windup
  - **Class-Specific Effects:** 
    - Rogue: Pink/purple pulsing circle
    - Tank: Red circular indicator for ground smash area
    - Mage: Purple magical buildup circles
    - Warrior: Yellow pulsing circle
  - **Post-Attack Effects:**
    - Tank: Orange shockwave ring at 120px radius
    - Mage: Expanding purple circles showing AoE range
- **Windup Animation:** Shape scales up slightly before attack
- **Positioning Matters:** Enemy positioning affects effectiveness
- **Visual Feedback:** Hitboxes turn green when they successfully hit enemies

### Class Abilities

#### Triangle (Rogue)
- **Basic:** Quick stab (small triangle projectile)
- **Heavy:** Fan of Knives (throw 7 knives in a 60° spread pattern, 2x damage per knife, 2s cooldown)
- **Special:** Shadow clones (2 decoys for 3s)
- **Passive:** Backstab bonus (2x damage from behind)
- **Dodge System:** 3 dodge charges with individual cooldowns, deals 50% damage on collision. **Dashes in facing direction** (not movement direction) for offensive positioning

#### Square (Warrior)
- **Basic:** Sword swing (4 hitboxes in a line, spread out for wide coverage)
- **Heavy:** Forward Thrust (animated rush 300px forward over 0.12s, dealing 2x damage to enemies along the path and knocking them sideways, 2.5s cooldown)
- **Special:** Whirlwind (spinning blades rotate around player, 2s duration)
- **Passive:** Block stance (50% damage reduction when standing still)

#### Pentagon (Tank)
- **Basic:** Cone slam (wide cone attack in front, multiple hitboxes)
- **Heavy:** Ground Smash (AoE ring around player, 1.1x damage + persistent knockback for crowd control, 2.5s cooldown)
- **Special:** Shield Defense (1.5s thin wide shield blocks enemies, then creates advancing wave pulse that damages and knocks back)
- **Passive:** Slow but high HP

#### Hexagon (Mage)
- **Basic:** Magic bolt (fast projectile)
- **Heavy:** AoE Blast (expanding circle, 125px radius, 2.7x damage, applies persistent knockback, 2.3s cooldown)
- **Special:** Blink + Nova (teleport up to 400px, 1.2s i-frames, leaves decoy at origin that enemies target for 2s, creates visual explosion at destination with damage and knockback)
- **Passive:** Range bonus damage

### Dodge Roll System
- **Input:** Shift key
- **Direction:** 
  - Movement direction or toward mouse if standing (all classes except Triangle)
  - **Facing direction only** (Triangle/Rogue class for offensive positioning)
- **Duration:** 0.3s active dodge + 0.3s post-dodge i-frames (total 0.6s invulnerability)
- **i-frames:** Invulnerable during roll and briefly after
- **Cooldown:** 2 seconds (standard), 3 charges with 1s cooldown each (Triangle class)
- **Visual:** Trail effect

### Enemy Attack Patterns
All attacks are telegraphed:
- **Flash red** before attacks
- **Windup animations** before big attacks
- **Color changes** indicate attack type
- **Audio cues** (optional)

### Knockback System
- Enemies have a knockback system that persists across frames
- Knockback velocity decays over time (50% per second for quick recovery)
- Applied by heavy attacks (Ground Smash, AoE Blast) and special abilities
- Prevents enemies from immediately recovering from powerful attacks

### Strategic Combat Elements
- Positioning matters (tight corridors vs open rooms)
- Enemy combinations create dynamic encounters
- Telegraphed attacks allow skill-based dodging
- Perfect dodge rewards (optional slow-mo + damage buff)

---

## Gear System

### Color Tiers
- **Gray (Common):** 0% bonus
- **Green (Uncommon):** +20% to stat
- **Blue (Rare):** +40% to stat
- **Purple (Epic):** +70% to stat
- **Orange (Legendary):** +100% to stat

### Gear Slots
- **Weapon:** Small orbiting shape - affects damage
- **Armor:** Outline thickness/glow - affects defense
- **Accessory:** Small dot following player - affects speed or crit

### Gear Types

#### Weapon Types
- **Blade (Triangle):** Faster attack speed
- **Hammer (Square):** More knockback
- **Staff (Star):** Longer range
- **Gauntlets (Pentagon):** More AoE, shorter range

#### Armor Types
- **Light:** Faster dodge roll, more i-frames
- **Medium:** Balanced
- **Heavy:** Slower dodge, more damage reduction

#### Accessories
- **Speed:** Trailing dots - move faster
- **Cooldown:** Orbiting dots - abilities recharge faster
- **Lifesteal:** Pulsing dot - heal on hit

### Loot Generation
- **Drop Chance:** Per enemy (varies by type)
- **Tier Distribution (base):**
  - Gray: 50%
  - Green: 30%
  - Blue: 15%
  - Purple: 4%
  - Orange: 1%
- **Scaling:** Higher room numbers = better loot chances
- **Boss Drops:** Guaranteed rare+ drop

---

## Progression System

### Experience & Leveling
- Enemies drop XP on death
- XP fills the level bar
- **Level Up:** +10% to all base stats (HP, damage, speed, defense)
- Level up triggers full heal + visual effect
- **XP Formula:** `xpToNext = 100 * (level ^ 1.5)`

### Stat System
**Base Player Stats:**
- Level
- HP / Max HP
- Base Damage
- Move Speed
- Defense (damage reduction %)

### Scaling
- **Enemy HP:** `baseHP * (1 + roomNumber * 0.15)`
- **Enemy Damage:** `baseDamage * (1 + roomNumber * 0.1)`
- **Enemy Count:** `baseCount + (roomNumber * 0.5)`

---

## Room System

### Room Structure
- Grid-based rooms
- Each room is a self-contained canvas
- **Clear Condition:** All enemies must be defeated
- Door appears when room is cleared
- Walk through door to progress

### Room Types

#### Normal Room
- Mixed enemy types
- Standard layout

#### Arena Room
- Large open space
- Many enemies at once

#### Boss Room (Every 5 rooms)
- Single elite enemy
- Giant version of regular enemy
- Multiple attack phases
- Guaranteed high-tier loot
- Boss intro screen

### Room Progression
- Room number displays on screen
- Each room increases difficulty
- Enemies scale in HP, damage, and count
- Loot quality improves with room number

### Room Generation
```javascript
enemyCount = baseCount + Math.floor(roomNumber * 0.5)
enemyHP = baseHP * (1 + roomNumber * 0.15)
enemyDamage = baseDamage * (1 + roomNumber * 0.1)
```

---

## UI Elements

### HUD (Heads-Up Display)
- **Health Bar:** Top left, shows current/max HP
- **XP Bar:** Bottom of screen, shows progress to next level
- **Level Display:** Current level number
- **Room Counter:** Current room number
- **Cooldown Indicators:** Small bars showing ability cooldowns (Dodge, Heavy Attack, Special Ability)
  - Green = Ready, Red = On cooldown, Orange = Heavy attack cooldown

### Menus
- **Main Menu:** Class selection screen
- **Pause Menu:** ESC to pause (settings, restart)
- **Death Screen:** Stats recap (enemies killed, rooms cleared, damage taken)
- **Inventory:** Show equipped gear (I or Tab)
- **Stats Screen:** Detailed stat breakdown

### Visual Feedback
- Screen shake on heavy hits
- Hit pause (brief freeze frame)
- Particle effects on hit/death
- Damage numbers float up
- Color flash on taking damage
- Combo counter (optional)
- Perfect dodge slow-mo (optional)

---

## Data Structures

### Player Object
```javascript
{
  class: 'square',
  x, y: 400, 300,
  vx, vy: 0,
  rotation: 0,
  size: 25,
  
  // Stats
  level: 1,
  xp: 0,
  xpToNext: 100,
  
  hp: 100,
  maxHp: 100,
  baseDamage: 10,
  defense: 0,
  moveSpeed: 200,
  
  // Gear
  weapon: {slot: 'weapon', tier: 'gray', bonus: 0},
  armor: null,
  accessory: null,
  
  // Cooldowns
  attackCooldown: 0,
  heavyCooldown: 0,
  dodgeCooldown: 0,
  specialCooldown: 0,
  
  // State
  isDodging: false,
  isAttacking: false,
  invulnerable: false
}
```

### Enemy Object
```javascript
{
  type: 'circle',
  x, y: 600, 200,
  vx, vy: 0,
  size: 20,
  
  hp: 30,
  maxHp: 30,
  damage: 5,
  moveSpeed: 100,
  
  xpValue: 10,
  lootChance: 0.3,
  
  // AI state
  state: 'chase', // chase, attack, retreat
  attackCooldown: 0,
  attackWindup: 0,
  
  // Visual
  color: '#ff6b6b',
  telegraphColor: '#ff0000'
}
```

### Gear Object
```javascript
{
  id: 'gear_123',
  slot: 'weapon', // weapon, armor, accessory
  tier: 'blue',   // gray, green, blue, purple, orange
  bonus: 0.4,     // 0, 0.2, 0.4, 0.7, 1.0
  
  // Display
  x: 500,
  y: 400,
  color: '#4dabf7'
}
```

### Room Object
```javascript
{
  number: 1,
  type: 'normal', // normal, arena, boss
  width: 800,
  height: 600,
  
  enemies: [],
  loot: [],
  
  cleared: false,
  doorOpen: false,
  doorPosition: {x: 750, y: 300}
}
```

---

## Key Formulas

### Scaling
```javascript
// Enemy HP scaling
enemyHP = baseHP * (1 + roomNumber * 0.15)

// Enemy damage scaling
enemyDamage = baseDamage * (1 + roomNumber * 0.1)

// XP to next level
xpToNext = 100 * (level ^ 1.5)
```

### Damage Calculation
```javascript
finalDamage = (baseDamage * gearMultiplier) * (1 - targetDefense) * critMultiplier
```

### Loot Tier Chances
- Gray: 50%
- Green: 30%
- Blue: 15%
- Purple: 4%
- Orange: 1%

### Gear Stat Bonuses
- Gray: 0%
- Green: +20%
- Blue: +40%
- Purple: +70%
- Orange: +100%

---

## Performance Requirements

- Target: 60 FPS
- Smooth frame-independent movement (delta time)
- Limit particles on screen (pool & reuse)
- Clear dead enemies from array
- Object pooling for projectiles
- Spatial partitioning if 50+ entities
- Optimize render calls (batch similar shapes)

---

## Design Goals

### Must Have (MVP)
- Player movement & rotation
- Basic & heavy attacks
- Dodge roll with i-frames
- 2-3 enemy types
- Health & death
- XP & leveling
- Gear drops & equipping
- Room progression (5+ rooms)
- 2 playable classes

### Should Have
- 4 playable classes
- 5 enemy types
- Special abilities per class
- Boss encounters
- Visual effects & polish
- Death stats screen

### Nice to Have
- Sound effects
- Meta progression
- Achievements
- Multiple room layouts
- Advanced AI behaviors
- Combo system

---

## Engagement Hooks

1. **Satisfying Feedback:** Screen shake, particles, hit effects
2. **Clear Goals:** "Reach room 20" or "Defeat the Octagon King"
3. **Risk/Reward:** Harder rooms = better loot chances
4. **Build Variety:** Different classes encourage replays
5. **Quick Sessions:** 10-15 minute runs
6. **Skill Expression:** Perfect dodges, combos, positioning

---

## Technical Architecture

### Core Technologies
- HTML5 Canvas 2D for rendering
- Vanilla JavaScript (ES6+)
- No external dependencies

### File Structure
```
/game
  index.html
  /js
    main.js           // Game loop
    player.js         // Player class
    enemy-base.js     // Base enemy class with shared functionality
    enemy-basic.js    // Basic circle enemy (Swarmer)
    enemy-star.js     // Star enemy (Ranged)
    enemy-diamond.js  // Diamond enemy (Assassin)
    enemy-rectangle.js // Rectangle enemy (Brute)
    enemy-octagon.js  // Octagon enemy (Elite)
    combat.js         // Combat system
    gear.js           // Loot & equipment
    level.js          // Room generation
    ui.js             // HUD & menus
    input.js          // Input handling
    render.js         // Drawing functions
    utils.js          // Helper functions
  /css
    style.css
```

### Enemy Architecture
The enemy system uses a modular inheritance pattern:
- `EnemyBase`: Common functionality (knockback, health bars, targeting, death logic)
- Individual enemy files: Each enemy type extends the base class with unique AI and visuals
- Benefits: Easy to add new enemies, reduce code duplication, maintainable structure

---

## Art Style

### Visual Design
- Simple geometric shapes
- Clear shape recognition
- Color-coded systems (gear tiers, enemy types)
- Particle effects for feedback
- Minimal but polished aesthetic

### Color Schemes
- **Player Classes:** Distinct shapes + colors
- **Enemies:** Red-based danger palette
- **Loot Drops:** Tier-based colors
- **UI:** Clean, minimalist
- **Room Backgrounds:** Different colors per zone

---

## Testing Criteria

After each implementation phase:
- ✓ No console errors
- ✓ Smooth 60 FPS
- ✓ Accurate collision detection
- ✓ Readable UI elements
- ✓ Responsive controls
- ✓ Fair balance
- ✓ Clear visual feedback
- ✓ Clean state management



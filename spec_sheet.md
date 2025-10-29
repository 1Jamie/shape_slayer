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

## Boss System

### Boss Architecture
Bosses extend `BossBase`, which extends `EnemyBase`. This inheritance pattern provides:
- Common boss functionality (phase system, weak points, environmental hazards)
- Base enemy systems (knockback, health bars, targeting, death logic)
- Unique boss implementations with specialized attacks and mechanics

### Boss Stat Scaling
All bosses are scaled relative to normal enemies:
- **HP:** 5x base HP × 1.3 (30% bonus) = 6.5x base HP (before room scaling)
- **Size:** 2x base size (visual and collision)
- **Damage:** 1.5x base damage
- **XP Value:** 3x normal enemy of same type

**Boss Base HP Values:**
- Swarm King: 195 base HP (final: 975 HP)
- Twin Prism: 156 base HP (final: 780 HP)
- Fortress: 234 base HP (final: 1,170 HP)
- Fractal Core: 195 base HP (final: 975 HP)
- Vortex: 260 base HP (final: 1,300 HP)

### 3-Phase Combat System
Each boss has three phases that change at HP thresholds:
- **Phase 1:** 100% - 50% HP - Opening moves, basic patterns
- **Phase 2:** 50% - 25% HP - Increased aggression, new attacks
- **Phase 3:** 25% - 0% HP - Maximum intensity, ultimate attacks

Phase transitions trigger visual/audio feedback and unlock new attack patterns.

### Weak Point System
- **Purpose:** Strategic targeting reward (not required to defeat boss)
- **Damage Multiplier:** 3x damage when hitting weak points
- **Visibility:** Weak points glow with cyan/white indicators
- **Accessibility:** Positioned in hard-to-reach locations (behind rotating body, at spike bases, center core behind pull field, etc.)
- **Collision Detection:** Weak points checked before normal body collision in damage calculations

### Environmental Hazards
Bosses create persistent environmental hazards during combat:
- **Shockwave:** Expanding rings from ground slams, persist 0.5-1s
- **Damage Zone:** Persistent area dealing damage (dash trails, spike zones)
- **Pull Field:** Constant force toward boss, reduces player movement speed
- **Debris:** Temporary collision zones from boss destruction/attacks

Hazards update each frame, check player collision, and auto-remove when expired.

### Boss Intro System
- **Trigger:** When boss room is entered and boss spawns
- **Duration:** 3 seconds total
- **Sequence:**
  - Dark overlay (80% opacity black)
  - Boss slides in from spawn position
  - Boss name displays with fade-in/scale-up text effect
  - "Press any key to continue" appears after 2 seconds
- **Skip:** Any key press after 2 seconds skips remaining intro time
- **State:** Boss frozen during intro, normal updates begin after intro completes

### Individual Boss Descriptions

#### Swarm King (Room 10)
- **Shape:** Large star (~60px radius) with concave inward-bending spikes
- **Weak Points:** 3 small glowing points at base of spikes (hard to hit during rotation)
- **Phase 1:** Spike barrage, chase lunge, minion spawn (2-3), spike slam with shockwave
- **Phase 2:** Faster attacks, spinning spike wheel, multi-barrage (3 waves), more minions (4-5)
- **Phase 3:** Constant rotation with extended spikes, explosive finale when HP < 10%
- **Environmental Hazards:** Shockwaves from spike slams, explosive spike particles

#### Twin Prism (Room 15)
- **Shape:** Two overlapping diamonds forming concave hourglass (~50px each)
- **Weak Points:** Single weak point at center connection (requires precise timing)
- **Phase 1:** Dual dash pattern, rotation attack, color swap position swap, synchronized strike
- **Phase 2:** Faster rotation, split attack (separate to edges), more frequent swaps
- **Phase 3:** Frenzy mode (constant spinning + dashing), merged form slam, orbital frenzy
- **Environmental Hazards:** Dash trails (damage zones), rotation barrier damage zone

#### Fortress (Room 20)
- **Shape:** Large rectangle (~100px × 80px) with concave crenellations
- **Weak Points:** 2 weak points at top corners (protected by spike attacks)
- **Phase 1:** Charging slam (1.5s windup), corner spikes (cardinal directions), wall push, summon guards
- **Phase 2:** Multiple slams (2-3 chain), full spike burst (all corners), room division
- **Phase 3:** Rampage mode (constant charging), fortress storm (projectiles while moving), collapse attack (splits into 4), earthquake (repeated slams)
- **Environmental Hazards:** Persistent shockwaves from slams (grow then fade 1s), spike damage zones, crumbling debris

#### Fractal Core (Room 25)
- **Shape:** Octagon (~70px) with inward-bending concave sides
- **Weak Points:** 4 weak points at concave indentations (only visible when fragments separate)
- **Phase 1:** Fragment spawn (4 orbiting octagons), phase dash teleport, rotation blast, summon elite
- **Phase 2:** Multi-fragment (6 fragments), phase chain (3 teleports), expanding pulse ring, fragment barrage
- **Phase 3:** Chaos mode (constant splitting/reforming), super fragment storm (8 fragments), core explosion, final blast (screen-wide)
- **Environmental Hazards:** Phase dash damage trails, expanding pulse rings, fragment collision zones

#### Vortex (Room 30)
- **Shape:** Circle (~80px) with concave indentations (gear-like)
- **Weak Points:** 1 weak point at center core (requires getting past pull effect)
- **Phase 1:** Vortex pull (suction reduces movement), rotating teeth (contact damage), spin projectiles (spiral pattern), swarm summon (orbiting enemies)
- **Phase 2:** Stronger pull effect, tooth barrage (rapid extend/retract), double spin (opposite spirals), more orbiting minions
- **Phase 3:** Maximum pull (very strong suction), teeth expansion (all teeth extend max), final vortex (contracts then explosive burst), death spiral (rapid contraction then explosion)
- **Environmental Hazards:** Pull force field (constant velocity toward boss), tooth damage zones, explosion debris

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

#### Boss Room (Every 5 rooms, starting at room 10)
- Boss rooms spawn when: `roomNumber % 5 === 0 AND roomNumber >= 10`
- Single unique boss enemy with 3-phase combat system
- **5 Unique Bosses:**
  - Room 10: Swarm King (Large star, spike attacks, minion spawning)
  - Room 15: Twin Prism (Two overlapping diamonds, alternating dash patterns)
  - Room 20: Fortress (Large rectangle, slam attacks, shockwaves)
  - Room 25: Fractal Core (Octagon, fragment splitting, teleportation)
  - Room 30: Vortex (Circle with indentations, pull mechanics, rotating teeth)
- Boss scaling: 5x HP, 2x size, 1.5x damage vs normal enemies
- Multiple attack phases (Phase 1: 100-50% HP, Phase 2: 50-25% HP, Phase 3: 25-0% HP)
- Weak point system (3x damage multiplier for strategic targeting)
- Environmental hazards (shockwaves, damage zones, pull fields, debris)
- Guaranteed rare+ loot drop (2-3 items per boss)
- Boss XP = 3x normal enemy of same type
- Boss intro screen (3 second sequence, skippable after 2s)

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
    combat.js         // Combat system
    gear.js           // Loot & equipment
    level.js          // Room generation
    ui.js             // HUD & menus
    input.js          // Input handling
    render.js         // Drawing functions
    utils.js          // Helper functions
    /enemies          // Enemy classes
      enemy-base.js     // Base enemy class with shared functionality
      enemy-basic.js    // Basic circle enemy (Swarmer)
      enemy-star.js     // Star enemy (Ranged)
      enemy-diamond.js  // Diamond enemy (Assassin)
      enemy-rectangle.js // Rectangle enemy (Brute)
      enemy-octagon.js  // Octagon enemy (Elite)
    /bosses            // Boss classes and systems
      hazards.js        // Environmental hazard system
      boss-base.js      // Base boss class extending EnemyBase
      boss-swarmking.js // Swarm King boss (Room 10)
      boss-twinprism.js // Twin Prism boss (Room 15)
      boss-fortress.js  // Fortress boss (Room 20)
      boss-fractalcore.js // Fractal Core boss (Room 25)
      boss-vortex.js    // Vortex boss (Room 30)
    debug.js            // Debug panel for testing (warp to rooms)
  /css
    style.css
```

### Enemy Architecture
The enemy system uses a modular inheritance pattern:
- `EnemyBase`: Common functionality (knockback, health bars, targeting, death logic)
- Individual enemy files: Each enemy type extends the base class with unique AI and visuals
- `BossBase`: Extends `EnemyBase` with boss-specific systems (phases, weak points, environmental hazards)
- Individual boss files: Each boss extends `BossBase` with unique attacks and mechanics
- Benefits: Easy to add new enemies/bosses, reduce code duplication, maintainable structure

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

## Debug Tools

### Debug Panel
A developer tool accessible from the browser console for testing and debugging:
- **Toggle:** `DebugPanel.toggle()` in console or `Ctrl+D` keyboard shortcut
- **Features:**
  - Current room number display
  - Quick warp buttons for rooms 1, 5, 10, 15, 20, 25, 30 (boss rooms highlighted in orange)
  - Custom room input field (1-100)
  - Warp button to jump to any room number
- **Usage:** Opens a panel in the top-right corner with green terminal-style UI
- **Purpose:** Quickly test boss encounters and room progression without playing through earlier rooms

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



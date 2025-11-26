# New Enemy Ideas for Shape Slayer

## Current Enemy Roster
1. **Basic (Circle)** - Red, swarmer, simple melee lunge
2. **Diamond** - Cyan, assassin, fast dash attacks
3. **Star** - Orange-yellow, ranged, projectile shooter
4. **Rectangle** - Bronze, brute, slow charge/slam
5. **Octagon** - Purple, elite, minion summoner

## Difficulty Tiers
- **Basic Tier** (1.0x): Simple enemies for early rooms
- **Mid Tier** (1.4x): Moderate difficulty, unique mechanics
- **High Tier** (2.2x): Elite enemies, complex behaviors
- **Boss Tier** (3.5x): Boss-level enemies

---

## Proposed New Enemies

### TIER 1: BASIC ENEMIES (Early Game)

#### 1. **Hexagon - Splitter Type**
- **Color**: Green (#4ade80)
- **Shape**: Hexagon
- **Difficulty**: Basic (1.0x)
- **Stats**: 
  - HP: 30 (lower than basic circle)
  - Damage: 5
  - Speed: 120
  - Size: 18
- **Unique Mechanic**: **Splits on Death**
  - When killed, splits into 2 smaller hexagons (50% size, 40% HP, 50% damage)
  - Smaller hexagons can split once more (into 2 tiny hexagons, 30% size, 30% HP, 30% damage)
  - Max 2 splits per original enemy
  - Visual: Smaller hexagons have slightly different shade of green
- **Behavior**: 
  - Simple melee approach (slower than basic circle)
  - No special attacks, just basic movement
  - Slightly more HP than basic but compensates with split mechanic
- **XP Value**: 8 (base) + 4 per split = 12 total if both splits killed
- **Loot Chance**: 0.08 (slightly lower, but splits can drop loot too)

#### 2. **Pentagon - Shielder Type**
- **Color**: Light Blue (#60a5fa)
- **Shape**: Pentagon
- **Difficulty**: Basic (1.0x)
- **Stats**:
  - HP: 50 (higher than basic)
  - Damage: 6
  - Speed: 90 (slower)
  - Size: 22
- **Unique Mechanic**: **Shield Generator**
  - Periodically generates a rotating shield (3-4 small orbs orbiting around it)
  - Shield orbs block projectiles and reduce melee damage by 30%
  - Shield regenerates after 3 seconds if destroyed
  - Can have 1-2 shield layers (scales with room number)
- **Behavior**:
  - Slow, tanky approach
  - Tries to position between player and other enemies
  - Shield orbs rotate at constant speed
- **XP Value**: 12
- **Loot Chance**: 0.10

---

### TIER 2: MID-TIER ENEMIES (Mid Game)

#### 3. **Trapezoid - Teleporter Type**
- **Color**: Magenta (#ec4899)
- **Shape**: Trapezoid (wider at top)
- **Difficulty**: Mid (1.4x)
- **Stats**:
  - HP: 45
  - Damage: 7
  - Speed: 100 (base), 500 (teleport dash)
  - Size: 20
- **Unique Mechanic**: **Short-Range Teleport**
  - Every 2-3 seconds, teleports short distance (100-150 pixels)
  - Teleport has brief telegraph (0.2s purple flash at destination)
  - Can teleport through player for backstab attempt
  - After teleport, performs quick melee strike
  - Teleport cooldown scales with room number (faster in later rooms)
- **Behavior**:
  - Erratic movement pattern
  - Teleports to flank player
  - Uses teleport to escape when low HP
  - Advanced: Can chain 2-3 teleports in sequence (room 10+)
- **XP Value**: 18
- **Loot Chance**: 0.15

#### 4. **Crescent - Boomerang Type**
- **Color**: Teal (#14b8a6)
- **Shape**: Crescent moon shape
- **Difficulty**: Mid (1.4x)
- **Stats**:
  - HP: 40
  - Damage: 6 (melee), 4 (boomerang)
  - Speed: 110
  - Size: 20
- **Unique Mechanic**: **Boomerang Projectile**
  - Throws crescent-shaped boomerang that returns
  - Boomerang travels in arc, returns to enemy
  - Can hit player on both outbound and return trip
  - Enemy moves while boomerang is out (can't attack during flight)
  - Boomerang speed: 250 pixels/second
  - Range: 200 pixels max distance
- **Behavior**:
  - Maintains medium distance (150-200 pixels)
  - Throws boomerang, then moves to reposition
  - Advanced: Can throw 2 boomerangs simultaneously (room 12+)
- **XP Value**: 16
- **Loot Chance**: 0.14

#### 5. **Cross - Exploder Type**
- **Color**: Dark Red (#dc2626)
- **Shape**: Plus/Cross shape
- **Difficulty**: Mid (1.4x)
- **Stats**:
  - HP: 35
  - Damage: 8 (contact), 12 (explosion)
  - Speed: 80 (slow)
  - Size: 24
- **Unique Mechanic**: **Death Explosion**
  - Explodes on death in 4 directions (cross pattern)
  - Explosion radius: 80 pixels
  - Explosion damage: 12 (scales with room)
  - Can also explode when HP < 20% (self-destruct)
  - Explosion has 0.5s telegraph (red pulsing)
  - Advanced: Can detonate early for tactical explosion (room 15+)
- **Behavior**:
  - Slow approach, tries to get close
  - When low HP, rushes player for kamikaze
  - Explosion creates cross-shaped damage pattern
- **XP Value**: 14
- **Loot Chance**: 0.12

#### 6. **Heart - Healer Type**
- **Color**: Pink (#f472b6)
- **Shape**: Heart shape
- **Difficulty**: Mid (1.4x)
- **Stats**:
  - HP: 60 (high for mid-tier)
  - Damage: 5 (low)
  - Speed: 95
  - Size: 22
- **Unique Mechanic**: **Area Heal**
  - Periodically heals nearby enemies (radius: 120 pixels)
  - Heal amount: 15-20 HP per heal
  - Heal cooldown: 4 seconds
  - Can heal self
  - Heal has visual effect (pink particles)
  - Advanced: Can create healing zone that persists (room 14+)
- **Behavior**:
  - Stays near other enemies
  - Prioritizes healing low-HP allies
  - Retreats when isolated
  - Low threat individually, high priority target
- **XP Value**: 20
- **Loot Chance**: 0.16

---

### TIER 3: HIGH-TIER ENEMIES (Late Game)

#### 7. **Spiral - Vortex Type**
- **Color**: Dark Purple (#7c3aed)
- **Shape**: Spiral/whirlpool shape
- **Difficulty**: High (2.2x) - Elite
- **Stats**:
  - HP: 130
  - Damage: 10
  - Speed: 100
  - Size: 28
- **Unique Mechanic**: **Vortex Pull**
  - Creates vortex that pulls player and projectiles toward it
  - Pull strength increases over 2 seconds (telegraph)
  - Pull radius: 150 pixels
  - Pull force: 200 pixels/second (increases to 400)
  - After pull, performs spin attack (damage in 360°)
  - Can pull enemies toward it too (for protection)
  - Advanced: Can create multiple smaller vortices (room 18+)
- **Behavior**:
  - Positions centrally
  - Uses vortex to disrupt player positioning
  - Pulls projectiles to protect self
  - Spin attack after successful pull
- **XP Value**: 60
- **Loot Chance**: 0.22

#### 8. **Gear/Cog - Turret Type**
- **Color**: Dark Gray (#4b5563)
- **Shape**: Gear/cog with teeth
- **Difficulty**: High (2.2x) - Elite
- **Stats**:
  - HP: 100
  - Damage: 9 (melee), 6 (projectile)
  - Speed: 0 (stationary), 50 (when moving)
  - Size: 30
- **Unique Mechanic**: **Stationary Turret Mode**
  - Can anchor in place (becomes stationary)
  - While anchored: 2x attack speed, 1.5x range, 360° rotation
  - Fires rapid projectiles in all directions (spread pattern)
  - Can unanchor and move (slower than normal)
  - Anchoring/unanchoring takes 1 second
  - Advanced: Can create 2-3 anchor points and teleport between them (room 20+)
- **Behavior**:
  - Anchors in strategic positions
  - Covers wide area with projectiles
  - Unanchors when player gets too close
  - Creates "no-go zones" in room
- **XP Value**: 55
- **Loot Chance**: 0.20

#### 9. **Arrow - Sniper Type**
- **Color**: Yellow-Gold (#eab308)
- **Shape**: Arrow pointing forward
- **Difficulty**: High (2.2x) - Elite
- **Stats**:
  - HP: 85
  - Damage: 15 (high damage, single shot)
  - Speed: 120
  - Size: 20
- **Unique Mechanic**: **Charged Snipe**
  - Charges up powerful single projectile (1.5-2 second charge)
  - Long telegraph (red laser line to target)
  - Projectile: Very fast (600 pixels/second), high damage (15)
  - Pierces through enemies (can hit player behind cover)
  - Charge time decreases with room number
  - Advanced: Can ricochet off walls once (room 22+)
- **Behavior**:
  - Maintains long distance (250-300 pixels)
  - Constantly repositioning
  - Charges shot, fires, repositions
  - High priority target (high damage threat)
- **XP Value**: 50
- **Loot Chance**: 0.18

---

### TIER 4: BOSS-LEVEL ENEMIES (Very Late Game)

#### 10. **Double-Hexagon - Duplicator Type**
- **Color**: White with Gold trim (#fbbf24)
- **Shape**: Two overlapping hexagons
- **Difficulty**: Boss-level (3.0x)
- **Stats**:
  - HP: 200
  - Damage: 12
  - Speed: 110
  - Size: 32
- **Unique Mechanic**: **Clone Creation**
  - Creates temporary clone of self (50% HP, 70% damage)
  - Clone lasts 8 seconds or until killed
  - Can have 2 clones active at once
  - Clone cooldown: 6 seconds
  - Clones can also create clones (but weaker, 30% HP)
  - Advanced: Clones inherit some abilities (room 25+)
- **Behavior**:
  - Creates clones to overwhelm player
  - Clones coordinate attacks
  - Main body retreats when low HP, sends clones
  - High threat due to numbers
- **XP Value**: 100
- **Loot Chance**: 0.30

#### 11. **Crystal - Barrier Type**
- **Color**: Iridescent (shifts between blue/purple/pink)
- **Shape**: Multi-faceted crystal
- **Difficulty**: Boss-level (3.0x)
- **Stats**:
  - HP: 180
  - Damage: 10
  - Speed: 85
  - Size: 30
- **Unique Mechanic**: **Crystal Barriers**
  - Creates crystal walls/barriers (4-6 segments)
  - Barriers block movement and projectiles
  - Barriers last 5 seconds
  - Can create barriers in patterns (cage, maze, etc.)
  - Barrier cooldown: 8 seconds
  - Advanced: Barriers can reflect projectiles (room 28+)
- **Behavior**:
  - Uses barriers to control space
  - Traps player in areas
  - Creates cover for self
  - Strategic positioning enemy
- **XP Value**: 90
- **Loot Chance**: 0.28

---

## Summary by Difficulty Spread

### Early Game (Rooms 1-5)
- **Hexagon** (Splitter) - Basic
- **Pentagon** (Shielder) - Basic

### Mid Game (Rooms 6-12)
- **Trapezoid** (Teleporter) - Mid
- **Crescent** (Boomerang) - Mid
- **Cross** (Exploder) - Mid
- **Heart** (Healer) - Mid

### Late Game (Rooms 13-20)
- **Spiral** (Vortex) - Elite
- **Gear** (Turret) - Elite
- **Arrow** (Sniper) - Elite

### Very Late Game (Rooms 21+)
- **Double-Hexagon** (Duplicator) - Boss-level
- **Crystal** (Barrier) - Boss-level

---

## Unique Mechanics Summary

1. **Split on Death** (Hexagon) - Not used
2. **Shield Generation** (Pentagon) - Similar to existing shields but rotating
3. **Teleport** (Trapezoid) - Not used
4. **Returning Projectile** (Crescent) - Not used
5. **Death Explosion** (Cross) - Not used
6. **Healing Allies** (Heart) - Not used
7. **Vortex Pull** (Spiral) - Not used
8. **Stationary Turret** (Gear) - Not used
9. **Charged Snipe** (Arrow) - Not used (different from star's rapid fire)
10. **Clone Creation** (Double-Hexagon) - Not used (different from minion summoning)
11. **Barrier Creation** (Crystal) - Not used

---

## Visual Design Notes

- Each enemy should have distinct color and shape
- Telegraphs should match enemy theme (e.g., spiral for vortex, laser for sniper)
- Death effects should be unique (splitting, explosion, etc.)
- Size variations help with visual hierarchy
- Elite enemies should have visual distinction (glow, outline, etc.)

---

## Implementation Priority

### Phase 1 (Core Expansion)
1. Hexagon (Splitter) - Simple mechanic, fills early game
2. Trapezoid (Teleporter) - Unique mechanic, mid-game
3. Spiral (Vortex) - Elite, interesting mechanic

### Phase 2 (Mechanic Variety)
4. Crescent (Boomerang) - Different ranged option
5. Heart (Healer) - Support role, changes combat dynamics
6. Arrow (Sniper) - High-damage elite

### Phase 3 (Advanced)
7. Pentagon (Shielder) - Defensive option
8. Cross (Exploder) - Risk/reward mechanic
9. Gear (Turret) - Area control
10. Double-Hexagon (Duplicator) - Boss-level
11. Crystal (Barrier) - Boss-level, complex mechanic






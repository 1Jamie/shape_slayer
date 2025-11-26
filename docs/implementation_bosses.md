<!-- e29cbd5f-13f7-4a67-90d2-623feee7e547 d58b9a69-af38-4af4-80c8-09a484edcb69 -->
# Boss System Implementation Plan

## Overview

Create 5 unique boss encounters starting at room 10, each with intro sequences, weak points in hard-to-reach places, environmental hazards, and 3-phase combat progression.

## Architecture

- Create `js/boss-base.js` - Base boss class extending EnemyBase
- Create individual boss files for each encounter
- Add boss intro system to `main.js`
- Modify `level.js` to detect and spawn bosses
- Add environmental hazard system
- Add weak point damage multiplier system

---

## Phase 1: Boss Base System & Infrastructure

### 1.1 Create Boss Base Class

**File:** `js/boss-base.js`

**Tasks:**

1. Create `BossBase` class extending `EnemyBase`
2. Add boss-specific properties:

   - `isBoss: true`
   - `phase: 1` (1, 2, or 3)
   - `weakPoints: []` (array of weak point objects)
   - `environmentalHazards: []` (array of hazard objects)
   - `introComplete: false`
   - `introTime: 0`
   - `bossName: ''`

3. Add phase transition logic:

   - Phase 1: 100% - 50% HP
   - Phase 2: 50% - 25% HP
   - Phase 3: 25% - 0% HP

4. Add `checkPhaseTransition()` method
5. Add weak point collision detection
6. Override `takeDamage()` to check for weak point hits (3x damage multiplier)
7. Add environmental hazard update/rendering methods
8. Scale boss stats (5x HP, 2x size, 1.5x damage as per spec)

**Key Methods:**

```javascript
checkPhaseTransition()
checkWeakPointHit(x, y, radius)
addWeakPoint(x, y, radius, angle)
addEnvironmentalHazard(hazard)
updateHazards(deltaTime)
renderWeakPoints(ctx)
```

### 1.2 Boss Intro System

**File:** `main.js`

**Tasks:**

1. Add `bossIntroActive: false` to Game state
2. Add `bossIntroData: null` (stores current intro info)
3. Create `startBossIntro(boss)` function:

   - Sets `bossIntroActive = true`
   - Stores boss reference and name
   - Pauses game updates (boss frozen)
   - Sets intro duration (3 seconds)

4. Create `updateBossIntro(deltaTime)` function:

   - Animates boss entering from edge of screen
   - Displays boss name text
   - Handles intro sequence timing

5. Create `renderBossIntro(ctx)` function:

   - Dark overlay (80% opacity)
   - Boss appears, sliding in from spawn position
   - Boss name displays with text effect
   - "Press any key to continue" after 2 seconds

6. Add intro to game loop (before normal updates)
7. Allow player to skip intro with any key after 2s

### 1.3 Modify Room System for Bosses

**File:** `level.js`

**Tasks:**

1. Modify `generateRoom(roomNumber)`:

   - Check if `roomNumber % 5 === 0` AND `roomNumber >= 10`
   - If boss room, set `room.type = 'boss'`
   - Don't spawn normal enemies for boss rooms
   - Call `generateBoss(roomNumber)` instead

2. Create `generateBoss(roomNumber)` function:

   - Returns appropriate boss based on room:
     - Room 10: Swarm King
     - Room 15: Twin Prism
     - Room 20: Fortress
     - Room 25: Fractal Core
     - Room 30: Vortex

3. Boss spawns at center (400, 300)
4. Return boss in `room.enemies` array (single boss)

---

## Phase 2: Boss Implementations

### 2.1 Swarm King (Room 10)

**File:** `js/boss-swarmking.js`

**Boss Details:**

- Shape: Large star with concave inward-bending spikes (~60px radius)
- Weak Points: 3 small glowing points at base of spikes (hard to hit during rotation)
- Phases: Rotation speed increases, more minions, explosive finale

**Tasks:**

1. Create `BossSwarmKing` class extending `BossBase`
2. **Phase 1 Attacks:**

   - `spikeBarrage()` - Rotates while firing 8 projectiles in star pattern
   - `chaseLunge()` - Charges at player periodically
   - `spawnMinions()` - Creates 2-3 orbiting circle minions
   - `spikeSlam()` - Telegraphs, then slams creating shockwave hazard

3. **Phase 2 Attacks:**

   - Faster versions of Phase 1
   - `spinningSpikeWheel()` - Rapid rotation with contact damage
   - `multiBarrage()` - 3 waves of 8 projectiles
   - More minions (4-5)

4. **Phase 3 Attacks:**

   - Constant rotation with extended spikes
   - `explosiveFinale()` - When HP < 10%, all spikes explode outward
   - Faster, more aggressive minions

5. **Weak Points:**

   - Position 3 weak points at spike bases
   - Visible as small cyan/white glowing circles
   - Only accessible when boss isn't spinning rapidly

6. **Environmental Hazards:**

   - Shockwaves from spike slam (persistent for 0.5s, deal damage)
   - Spike explosion particles (Phase 3)

### 2.2 Twin Prism (Room 15)

**File:** `js/boss-twinprism.js`

**Boss Details:**

- Shape: Two overlapping diamonds forming concave hourglass (~50px each)
- Weak Points: Center connection point (requires precise timing)
- Phases: Separation distance, rotation speed increases

**Tasks:**

1. Create `BossTwinPrism` class extending `BossBase`
2. Track two separate diamond positions and shared center
3. **Phase 1 Attacks:**

   - `dualDashPattern()` - Alternating dashes from opposite angles
   - `rotationAttack()` - Both diamonds spin around center
   - `colorSwap()` - Swap positions (telegraph with pause)
   - `synchronizedStrike()` - Both dash simultaneously, converging

4. **Phase 2 Attacks:**

   - Faster rotation
   - `splitAttack()` - Diamonds separate to edges, dash toward each other
   - More frequent color swaps

5. **Phase 3 Attacks:**

   - `frenzyMode()` - Constant spinning + dashing
   - `mergedForm()` - Brief merge into large shape for slam
   - `orbitalFrenzy()` - High-speed orbital pattern

6. **Weak Points:**

   - Single weak point at center connection (visible when separated)
   - Glows brighter during color swap

7. **Environmental Hazards:**

   - Dash trails (damage zones where diamonds passed)
   - Rotation barrier damage zone

### 2.3 Fortress (Room 20)

**File:** `js/boss-fortress.js`

**Boss Details:**

- Shape: Large rectangle with concave crenellations (~100px × 80px)
- Weak Points: 2 weak points at corners (protected by spike attacks)
- Phases: More slams, longer hazards, room division

**Tasks:**

1. Create `BossFortress` class extending `BossBase`
2. **Phase 1 Attacks:**

   - `chargingSlam()` - Long windup (1.5s), charges creating shockwave
   - `cornerSpikes()` - Four corners extend spikes (damage in cardinal directions)
   - `wallPush()` - Moves to edge, pushes across screen
   - `summonGuards()` - Spawns 2 rectangle minions

3. **Phase 2 Attacks:**

   - `multipleSlams()` - Chain 2-3 slams
   - `fullSpikeBurst()` - All corners extend simultaneously, spin outward
   - `roomDivision()` - Positions strategically to limit movement

4. **Phase 3 Attacks:**

   - `rampageMode()` - Constant charging with reduced telegraph
   - `fortressStorm()` - Crenellations shoot projectiles while moving
   - `collapseAttack()` - Splits into 4 smaller rectangles that charge
   - `earthquake()` - Repeated slams with expanding shockwaves

5. **Weak Points:**

   - 2 weak points at top corners
   - Exposed briefly after corner spike attacks
   - Protected when spikes are extended

6. **Environmental Hazards:**

   - Persistent shockwaves from slams (grow, then fade over 1s)
   - Spike damage zones where spikes extended
   - Crumbling crenellation debris (Phase 3)

### 2.4 Fractal Core (Room 25)

**File:** `js/boss-fractalcore.js`

**Boss Details:**

- Shape: Octagon with inward-bending concave sides (~70px)
- Weak Points: 4 weak points at concave indentations (only visible when fragments separate)
- Phases: More fragments, teleport chains, chaos mode

**Tasks:**

1. Create `BossFractalCore` class extending `BossBase`
2. **Phase 1 Attacks:**

   - `fragmentSpawn()` - Splits into 4 orbiting octagons, then converge
   - `phaseDash()` - Teleports short distances, spawns projectiles at origin
   - `rotationBlast()` - Spins firing 8 projectiles
   - `summonElite()` - Spawns 1 normal octagon minion

3. **Phase 2 Attacks:**

   - `multiFragment()` - 6 fragments instead of 4
   - `phaseChain()` - 3 teleports in sequence with damage trails
   - `expandingPulse()` - Ring of energy every 5 seconds
   - `fragmentBarrage()` - All fragments shoot before reforming

4. **Phase 3 Attacks:**

   - `chaosMode()` - Constant splitting/reforming
   - `superFragmentStorm()` - 8 fragments aggressively chase
   - `coreExplosion()` - Inner core detaches, independent attacks
   - `finalBlast()` - Screen-wide danger zone explosion

5. **Weak Points:**

   - 4 weak points at concave indentations
   - Only exposed when fragments separate
   - Core weak point visible when fragments reformed

6. **Environmental Hazards:**

   - Phase dash damage trails (lingering zones)
   - Expanding pulse rings (damage on contact)
   - Fragment collision zones

### 2.5 Vortex (Room 30)

**File:** `js/boss-vortex.js`

**Boss Details:**

- Shape: Circle with concave indentations (gear-like, ~80px)
- Weak Points: 1 weak point at center core (requires getting past pull effect)
- Phases: Stronger pull, more teeth, final explosion

**Tasks:**

1. Create `BossVortex` class extending `BossBase`
2. **Phase 1 Attacks:**

   - `vortexPull()` - Creates suction, reduces player movement speed
   - `rotatingTeeth()` - Teeth extend during rotation (contact damage)
   - `spinProjectiles()` - Fires projectiles in spiral pattern
   - `swarmSummon()` - Spawns circle enemies that orbit boss

3. **Phase 2 Attacks:**

   - Stronger pull effect
   - `toothBarrage()` - Rapid extend/retract during rotation
   - `doubleSpin()` - Two projectile waves in opposite spirals
   - More orbiting minions

4. **Phase 3 Attacks:**

   - `maximumPull()` - Very strong suction
   - `teethExpansion()` - All teeth extend to maximum (large danger zone)
   - `finalVortex()` - Contracts, then explosive burst
   - `deathSpiral()` - Rapid contraction then explosion

5. **Weak Points:**

   - Single core weak point at center
   - Hard to reach due to pull effect
   - Visible when boss isn't rotating rapidly

6. **Environmental Hazards:**

   - Pull force field (applies constant velocity toward boss)
   - Tooth damage zones (where teeth extended)
   - Explosion debris (final phase)

---

## Phase 3: Integration & Polish

### 3.1 Boss Rendering System

**File:** `js/render.js` or individual boss files

**Tasks:**

1. Add boss-specific rendering methods
2. Render weak points as glowing circles/indicators
3. Render environmental hazards with appropriate visuals
4. Add boss health bar (larger, more prominent)
5. Add phase indicator (visual transition when phase changes)

### 3.2 Boss Collision Updates

**File:** `js/combat.js`

**Tasks:**

1. Update `checkAttacksVsEnemies()` to handle boss weak points
2. Check weak point collision first (gives 3x damage if hit)
3. Normal body hits deal regular damage
4. Boss contact damage (separate from weak points)

### 3.3 Environmental Hazard System

**File:** `js/hazards.js` (new file)

**Tasks:**

1. Create `EnvironmentalHazard` base class
2. Types: `Shockwave`, `DamageZone`, `PullField`, `Debris`
3. Each hazard has:

   - Position and size
   - Lifetime/duration
   - Damage value
   - Visual appearance

4. Update hazards each frame
5. Check player collision with hazards
6. Render hazards with appropriate effects

### 3.4 Boss Loot & Rewards

**File:** `js/level.js` and `js/gear.js`

**Tasks:**

1. Bosses guarantee rare+ loot drop (blue or higher)
2. Bosses drop multiple items (2-3 pieces)
3. Scale boss XP: 3x normal enemy of same type
4. Boss death triggers special particle effect

### 3.5 Testing & Balance

**Tasks:**

1. Test boss intro sequences skip properly
2. Verify weak point hit detection
3. Test environmental hazards don't stack unfairly
4. Verify phase transitions trigger correctly
5. Balance boss HP/damage for difficulty
6. Test all 5 bosses spawn at correct rooms
7. Verify boss room detection works (room % 5 === 0 && >= 10)

---

## File Structure Changes

**New Files:**

- `js/boss-base.js` - Base boss class
- `js/boss-swarmking.js` - Swarm King boss
- `js/boss-twinprism.js` - Twin Prism boss
- `js/boss-fortress.js` - Fortress boss
- `js/boss-fractalcore.js` - Fractal Core boss
- `js/boss-vortex.js` - Vortex boss
- `js/hazards.js` - Environmental hazard system

**Modified Files:**

- `js/main.js` - Add boss intro system
- `js/level.js` - Boss detection and spawning
- `js/combat.js` - Weak point damage handling
- `index.html` - Add new boss script tags

---

## Implementation Order

1. Boss base class and infrastructure
2. Boss intro system
3. Room system modifications
4. Individual boss implementations (one at a time)
5. Environmental hazard system
6. Integration and testing
7. Balance tuning

---

## Key Design Decisions

- Weak points deal 3x damage but aren't required (boss can be defeated normally)
- Environmental hazards persist for 0.5-2 seconds depending on type
- Boss intro can be skipped after 2 seconds
- Phase transitions trigger visual/audio feedback
- Bosses use existing particle and screen shake systems

### To-dos

- [ ] Create BossBase class extending EnemyBase with phase system, weak points, and environmental hazards
- [ ] Implement boss intro sequence system in main.js with animation and skip functionality
- [ ] Modify level.js to detect boss rooms (room % 5 === 0 && >= 10) and generate appropriate bosses
- [ ] Create environmental hazard system (js/hazards.js) with Shockwave, DamageZone, PullField, Debris types
- [ ] Implement Swarm King boss (room 10) with star shape, spike attacks, weak points, and minion spawning
- [ ] Implement Twin Prism boss (room 15) with dual diamond mechanics, dash patterns, and center weak point
- [ ] Implement Fortress boss (room 20) with rectangle shape, slam attacks, shockwaves, and corner weak points
- [ ] Implement Fractal Core boss (room 25) with fragment splitting, teleportation, and concave weak points
- [ ] Implement Vortex boss (room 30) with pull mechanics, rotating teeth, and center core weak point
- [ ] Update combat.js to check weak point hits and apply 3x damage multiplier
- [ ] Add boss-specific rendering for weak points, environmental hazards, and phase indicators
- [ ] Integrate all bosses into HTML script tags, test spawning, verify room progression, and balance boss difficulty
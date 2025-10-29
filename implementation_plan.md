# Shape Slayer - Implementation Plan

## Overview
This document provides a detailed step-by-step guide for building Shape Slayer. Each phase is broken down into specific, actionable tasks that can be checked off as you complete them.

**Duration:** ~20 days  
**Target:** Complete, playable game with core features  
**Approach:** Build incrementally, testing after each phase

---

## File Structure Setup
Create the following file structure before starting:

```
shape_slayer/
  index.html
  js/
    main.js           # Game loop and initialization
    player.js         # Player mechanics
    enemy.js          # Enemy AI and behavior
    combat.js         # Combat calculations
    gear.js           # Loot and equipment
    level.js          # Room management
    ui.js             # User interface
    input.js          # Input handling
    render.js         # Drawing functions
    utils.js          # Helper functions
  css/
    style.css
```

**Setup Steps:**
1. Create the folder structure
2. Create blank HTML file with canvas element (800x600)
3. Create all JavaScript files with empty file structure
4. Link all JS files in HTML in the correct order
5. Test that the page loads without errors

---

## Phase 1: Core Foundation (Days 1-2)
**Goal:** Get something moving on screen

### 1.1 Canvas Setup & Game Loop
**File:** `main.js`

**Tasks to Complete:**
1. Get canvas element and context from HTML
2. Set canvas dimensions to 800x600
3. Create game configuration object (width, height, FPS target)
4. Initialize game state variables:
   - lastTime for frame timing
   - paused flag
   - gameStarted flag
5. Create main game loop using requestAnimationFrame
6. Calculate delta time (time since last frame)
7. Cap delta time to prevent huge jumps (max 16ms)
8. Create empty update() function
9. Create empty render() function
10. Call update() and render() in game loop
11. Add basic background color (dark blue: #1a1a2e)
12. Test that game loop runs at ~60 FPS
13. Add pause toggle with ESC key
14. Add resume from pause

**What to Test:**
- Canvas renders with dark background
- Console shows no errors
- Game loop runs continuously
- ESC pauses/resumes the game
- Check browser console for FPS (should be ~60)

### 1.2 Input System
**File:** `input.js`

**Tasks to Complete:**
1. Create input handler object to store key states
2. Add event listener for keydown events
3. Set keys to true when pressed
4. Add event listener for keyup events
5. Set keys to false when released
6. Store mouse position (x, y)
7. Add mousemove event listener
8. Get mouse position relative to canvas
9. Add event listeners for mouse button clicks
10. Store left click state
11. Store right click state
12. Test that WASD keys register
13. Test that mouse position tracks correctly

**Key Variables Needed:**
- keys object: { 'w': false, 'a': false, etc. }
- mouse: { x: 0, y: 0 }
- mouseLeft: false
- mouseRight: false

### 1.3 Player Basic Setup
**File:** `player.js`

**Tasks to Complete:**
1. Create Player class/object
2. Initialize player position (center of canvas: 400, 300)
3. Set player size (radius: 25)
4. Set player color (#4a90e2 - blue)
5. Create player movement variables (vx, vy)
6. Set move speed (200 pixels/second)
7. Create rotation variable (facing direction)
8. Draw player as circle at initial position
9. Hard code position values to center of canvas
10. Test that player appears on screen

**Initial Player Properties:**
- x: 400
- y: 300
- vx: 0
- vy: 0
- rotation: 0
- size: 25
- moveSpeed: 200

### 1.4 Player Movement
**File:** `player.js`

**Tasks to Complete:**
1. Read WASD keys from input handler
2. Set vx and vy based on keys pressed
3. Handle 8-directional movement (W, WA, A, AS, S, SD, D, DW)
4. Normalize diagonal movement (multiply by 0.707 to maintain speed)
5. Apply move speed to vx and vy
6. Update player position: x += vx * deltaTime
7. Update player position: y += vy * deltaTime
8. Keep player within canvas bounds
9. Test movement in all 8 directions
10. Verify speed feels smooth
11. Ensure diagonal movement is the same speed as cardinal

**Boundary Checking:**
- Player.x must stay between: player.size and (canvas.width - player.size)
- Player.y must stay between: player.size and (canvas.height - player.size)

### 1.5 Player Rotation
**File:** `player.js`

**Tasks to Complete:**
1. Get mouse position from input handler
2. Calculate angle from player to mouse
3. Use Math.atan2(dy, dx) to get rotation angle
4. Store rotation in player object
5. Draw player facing rotation direction
6. Use ctx.save() before rotating
7. Use ctx.rotate(rotation) before drawing
8. Use ctx.translate(x, y) to move to player position
9. Use ctx.restore() after drawing
10. Test that player rotates to face mouse

**Testing:**
- Move mouse in circle around player
- Player should smoothly rotate to face mouse
- Player should move independently of rotation

### Phase 1 Deliverables Checklist:
- [ ] Canvas displays with dark background
- [ ] Game loop runs at 60 FPS
- [ ] ESC key pauses/unpauses
- [ ] WASD moves player in 8 directions
- [ ] Player stays within screen bounds
- [ ] Player rotates to face mouse cursor
- [ ] Movement feels smooth and responsive
- [ ] No console errors

---

## Phase 2: Combat Foundation (Days 3-4)
**Goal:** Attacking and getting hit works

### 2.1 Basic Attack System
**File:** `player.js`

**Tasks to Complete:**
1. Add attack cooldown variable (starts at 0)
2. Add attack duration variable (0.1 seconds)
3. Add isAttacking state flag
4. Add player damage stat (start at 10)
5. Add attack cooldown time (0.3 seconds)
6. Create array to store active attack hitboxes
7. Check if left mouse button clicked
8. Check if attack cooldown is ready (cooldown <= 0)
9. When ready, create attack hitbox:
   - Position it in front of player (use rotation)
   - Offset by player.size + 10 pixels
   - Set hitbox radius (30 pixels)
   - Store damage amount
10. Reduce attack cooldown by deltaTime each frame
11. Mark player as "isAttacking" during attack
12. After attack duration ends, set isAttacking to false
13. Draw attack hitbox as semi-transparent circle
14. Remove attack hitbox after it expires

**Attack Hitbox Creation:**
- Calculate position: player.x + cos(rotation) * (size + 10)
- Calculate position: player.y + sin(rotation) * (size + 10)
- Hitbox should appear as circle in front of player
- Should disappear after attackDuration (0.1s)

### 2.2 Collision Detection System
**File:** `combat.js`

**Tasks to Complete:**
1. Create collision detection function
2. Calculate distance between two circles
3. Compare distance to sum of radii
4. Return true if circles overlap
5. Create function to check attack vs enemies
6. Loop through active attacks
7. For each attack, loop through enemies
8. Check collision between attack and enemy
9. If collision, call enemy.takeDamage(damage)
10. Remove attack hitbox after hitting enemy
11. Create function to check enemies vs player
12. Loop through all enemies
13. Check collision between enemy and player
14. If collision and player not invulnerable, damage player
15. Add knockback to enemies when hit

**Collision Function Logic:**
- distance = sqrt((x1-x2)² + (y1-y2)²)
- collision = distance < (radius1 + radius2)
- This is used for all collision checks

### 2.3 Enemy Basic Setup
**File:** `enemy.js`

**Tasks to Complete:**
1. Create Enemy class/object
2. Set enemy position (random spawn point)
3. Set enemy size (20 pixels radius)
4. Set enemy max HP (30)
5. Set enemy current HP (starts at maxHP)
6. Set enemy damage (5)
7. Set enemy move speed (100 pixels/second)
8. Set alive flag (true)
9. Add color (#ff6b6b - red)
10. Draw enemy as circle
11. Spawn 3-5 enemies when game starts
12. Store all enemies in enemies array
13. Test that enemies appear on screen

**Initial Enemy Properties:**
- x: random spawn position
- y: random spawn position
- size: 20
- maxHp: 30
- hp: 30
- damage: 5
- moveSpeed: 100
- alive: true

### 2.4 Enemy AI (Basic Chase)
**File:** `enemy.js`

**Tasks to Complete:**
1. Pass player object to enemy update function
2. Calculate direction from enemy to player
3. Calculate distance to player
4. Normalize direction vector
5. Multiply by move speed to get velocity
6. Update enemy position using velocity * deltaTime
7. Enemy should move toward player at constant speed
8. Make multiple enemies work simultaneously
9. Ensure enemies don't overlap when spawning
10. Keep enemies on screen (don't let them go off screen)

**Enemy Movement Logic:**
- dx = player.x - enemy.x
- dy = player.y - enemy.y
- distance = sqrt(dx² + dy²)
- enemy.vx = (dx / distance) * moveSpeed
- enemy.vy = (dy / distance) * moveSpeed

### 2.5 Enemy Health System
**File:** `enemy.js`

**Tasks to Complete:**
1. Create takeDamage function on enemy
2. Subtract damage from HP
3. Check if HP <= 0
4. If HP <= 0, call die() function
5. Create die() function
6. Set alive flag to false
7. Remove enemy from rendering
8. Remove enemy from collision checks
9. Create health bar drawing function
10. Draw health bar above enemy
11. Draw background (red) bar
12. Draw foreground (green) bar scaled by HP/maxHP
13. Make health bars update in real-time
14. Test that enemies die when HP reaches 0

**Health Bar Drawing:**
- Position: above enemy (y - size - 10)
- Width: size * 2
- Height: 3 pixels
- Red background for total HP
- Green foreground for current HP

### 2.6 Enemies Spawn and Update
**File:** `main.js`

**Tasks to Complete:**
1. Create enemies array
2. Spawn 3-5 enemies at game start
3. Randomize spawn positions
4. Call enemy.update() for each enemy each frame
5. Pass deltaTime to enemy.update()
6. Pass player object to enemy.update()
7. Call enemy.render() for each enemy each frame
8. Filter out dead enemies from array
9. Test that all enemies move toward player
10. Test that enemies can be killed

**Spawn Logic:**
- Pick random x, y within bounds
- Minimum 50 pixels from edges
- Store in enemies array
- Loop through array each frame

### Phase 2 Deliverables Checklist:
- [ ] Player can attack with left click
- [ ] Attack hitbox appears in front of player
- [ ] Attack has cooldown (0.3s)
- [ ] Enemies spawn and chase player
- [ ] Enemies show health bars
- [ ] Attacks damage enemies
- [ ] Enemies can be killed
- [ ] Enemies disappear when HP reaches 0
- [ ] Multiple enemies work simultaneously
- [ ] No console errors

---

## Phase 3: Combat Depth (Days 5-6)
**Goal:** Combat feels good and strategic

### 3.1 Dodge Roll
**File:** `player.js`

**Tasks to Complete:**
1. Add dodge cooldown variable (starts at 0)
2. Add dodge duration variable (0.2 seconds)
3. Add isDodging state flag
4. Add invulnerable flag for collision
5. Add dodge cooldown time (2.0 seconds)
6. Check if Shift key is pressed
7. Check if dodge cooldown is ready
8. When ready, start dodge:
   - Set isDodging to true
   - Set invulnerable to true
   - Boost player velocity in current direction (speed: 500)
9. During dodge duration, keep invulnerable true
10. Reduce dodge duration by deltaTime each frame
11. After 0.2s, end dodge:
    - Set isDodging to false
    - Set invulnerable to false
    - Reset dodge duration
12. Reduce dodge cooldown by deltaTime
13. Visual: Make player semi-transparent during dodge
14. Test that dodge gives invincibility

**Dodge Logic:**
- Dodge in movement direction or toward mouse if standing still
- Speed boost: 500 pixels/second
- Duration: 0.2 seconds
- Cooldown: 2.0 seconds
- Invulnerable means no collision damage

### 3.2 Heavy Attack
**File:** `player.js`

**Tasks to Complete:**
1. Add heavy attack cooldown variable
2. Add heavy cooldown time (1.5 seconds)
3. Check if right mouse button clicked
4. Check if heavy cooldown is ready
5. When ready, create heavy attack:
   - Position in front of player (same as basic)
   - Damage = player.damage * 2
   - Radius = 50 pixels (larger than basic)
   - Add knockback flag
6. Add windup delay (0.3 seconds before hitbox)
7. Show charge animation (player grows slightly)
8. Reduce heavy cooldown by deltaTime
9. Draw heavy attack hitbox slightly differently
10. Test that heavy attack does more damage
11. Test that heavy attack has longer cooldown

**Heavy Attack Stats:**
- Damage: 2x basic attack
- Hitbox: 50 radius (vs 30 for basic)
- Cooldown: 1.5s (vs 0.3s for basic)
- Windup: 0.3s

### 3.3 Enemy Attack Patterns
**File:** `enemy.js`

**Tasks to Complete:**
1. Add attack cooldown to enemy
2. Add telegraph state to enemy
3. When enemy is close to player (< 50 pixels):
   - Enter telegraph state
   - Flash red color
   - Set charge duration (0.5 seconds)
4. After telegraph, lunge at player:
   - Calculate direction to player
   - Boost velocity toward player (300 speed)
   - Set lunge duration
   - Reset attack cooldown (2.0s)
5. After lunge completes, resume normal chase
6. When enemy is far (> 50 pixels), just chase
7. Test that enemies telegraph before attacking
8. Test that telegraphs are visible to player
9. Add telegraph visual effect

**Circle Enemy Attack Pattern:**
- Normal: Chase player at base speed (100)
- Attack range: Within 50 pixels
- Telegraph: Flash red for 0.5s
- Lunge: Speed boost to 300 for 0.2s
- Cooldown: 2.0s between attacks

### 3.4 Second Enemy Type: Star (Shooter)
**File:** `enemy.js`

**Tasks to Complete:**
1. Create Star enemy type
2. Set star stats:
   - HP: 40
   - Damage: 8
   - Speed: 80 (slower than circle)
   - Size: 22
3. Star AI: Keep distance from player
   - If too close (< 100 pixels), move away
   - If right distance (150-200 pixels), stop and shoot
   - If too far (> 200 pixels), move closer
4. Create projectile system:
   - Array to store active projectiles
   - Each projectile has: x, y, vx, vy, damage, size
5. Star shoots projectiles at player
6. Star has attack cooldown (2.0 seconds)
7. Before shooting, star spins (telegraph)
8. Projectile spawns at star position
9. Projectile moves toward player at time of spawn
10. Projectile travels in straight line
11. Projectile damages player on hit
12. Remove projectile after hit or timeout
13. Test that star keeps distance
14. Test that star shoots at player
15. Test that projectiles can be dodged

**Star Enemy Behavior:**
- Position: 150-200 pixels from player
- Telegraph: Spin before shooting
- Projectile: Travels toward player position when shot
- Cooldown: 2.0 seconds
- Can be destroyed on hit (optional)

### Phase 3 Deliverables Checklist:
- [ ] Shift key activates dodge roll
- [ ] Dodge gives invincibility
- [ ] Dodge has cooldown (2s)
- [ ] Right click performs heavy attack
- [ ] Heavy attack does 2x damage
- [ ] Heavy attack has cooldown (1.5s)
- [ ] Enemies telegraph before attacking
- [ ] Star enemies keep distance
- [ ] Star enemies shoot projectiles
- [ ] Projectiles can hit player
- [ ] Projectiles can be dodged
- [ ] Visual feedback works

---

## Phase 4: Player Progression (Days 7-8)
**Goal:** Player gets stronger over time

### 4.1 Player Health & UI
**File:** `ui.js`

**Tasks to Complete:**
1. Create health bar drawing function
2. Draw health bar background (gray/dark red)
3. Draw health bar foreground (green) scaled by HP/maxHP
4. Position bar at top left (20, 20)
5. Bar size: 200 width, 20 height
6. Draw border around health bar
7. Display HP/maxHP as text
8. Update health bar each frame
9. Add player HP stat if not already present
10. Add maxHP stat if not already present
11. Create player takeDamage function
12. Subtract damage from HP
13. Check if HP <= 0
14. If HP <= 0, trigger death
15. Test that health bar displays correctly
16. Test that health bar updates when damaged

### 4.2 Death System
**File:** `main.js`

**Tasks to Complete:**
1. Add death state flag to player
2. Add death screen flag to game state
3. When player HP <= 0:
   - Set player.dead = true
   - Show death screen overlay
   - Stop game updates
4. Create death screen UI
5. Display "GAME OVER" message
6. Display stats:
   - Level reached
   - Enemies killed
   - Time played
7. Add restart option (press R)
8. Add return to menu option (press M)
9. Test death screen appears
10. Test restart works

### 4.3 Experience System
**File:** `player.js`

**Tasks to Complete:**
1. Add XP variable (starts at 0)
2. Add XP required to level (starts at 100)
3. Add XP value to enemy object (10 for circle, 20 for star)
4. When enemy dies, give player XP
5. Check if XP >= XP required
6. If so, call levelUp function
7. Create levelUp function
8. Increment level by 1
9. Increase all stats by 10%:
   - maxHP *= 1.1
   - damage *= 1.1
   - moveSpeed *= 1.1
10. Heal player to full HP
11. Reset XP to 0
12. Calculate new XP requirement: 100 * (level ^ 1.5)
13. Show level up visual effect
14. Play level up sound (placeholder)
15. Test that killing enemies gives XP
16. Test that gaining enough XP levels up player
17. Test that stats increase on level up

### 4.4 XP Bar UI
**File:** `ui.js`

**Tasks to Complete:**
1. Create XP bar drawing function
2. Draw XP bar at bottom of screen
3. Bar should span most of width (700 pixels)
4. Draw background (dark)
5. Draw foreground (cyan) scaled by XP/requiredXP
6. Center bar at bottom (y: 570)
7. Display current XP and required XP as text
8. Update each frame
9. Test XP bar appears and updates

### Phase 4 Deliverables Checklist:
- [ ] Health bar displays at top left
- [ ] Health bar updates in real-time
- [ ] Player loses HP when hit
- [ ] Player dies when HP reaches 0
- [ ] Death screen appears
- [ ] Can restart after death (R key)
- [ ] Enemies give XP when killed
- [ ] XP bar displays at bottom
- [ ] XP bar fills up as XP is gained
- [ ] Level up occurs when XP reaches required
- [ ] Stats increase by 10% on level up
- [ ] Player fully heals on level up
- [ ] Visual level up effect plays

---

## Phase 5: Gear System (Days 9-10)
**Goal:** Loot feels rewarding

### 5.1 Gear Data Structure
**File:** `gear.js`

**Tasks to Complete:**
1. Create Gear class/object
2. Define gear slots: weapon, armor, accessory
3. Define gear tiers: gray, green, blue, purple, orange
4. Define tier bonuses:
   - gray: 0% (no bonus)
   - green: +20%
   - blue: +40%
   - purple: +70%
   - orange: +100%
5. Each gear has: slot, tier, bonus value
6. Each gear has: id, x, y (when dropped)
7. Define tier colors for display
8. Create gear generation function
9. Function picks random slot and tier
10. Weighted tier selection:
    - gray: 50%
    - green: 30%
    - blue: 15%
    - purple: 4%
    - orange: 1%
11. Return new gear object
12. Test gear generation works

### 5.2 Loot Drops
**File:** `enemy.js`

**Tasks to Complete:**
1. Add lootChance to enemy (0.3 = 30%)
2. When enemy dies, check lootChance
3. If random < lootChance, drop gear
4. Call gear generation function
5. Set gear position to enemy death position
6. Add gear to ground loot array
7. Keep gear on screen
8. Test that enemies drop loot sometimes
9. Vary loot chances by enemy type
10. Higher tier enemies = better loot chances

### 5.3 Gear Pickup
**File:** `player.js` or `main.js`

**Tasks to Complete:**
1. Create ground loot array to store dropped gear
2. On each frame, check distance from player to each gear
3. If distance < player.size + gear.size:
   - Player picks up gear
   - Check which slot gear belongs to
   - Compare to currently equipped gear in that slot
   - If new gear is better, auto-equip it
   - Remove gear from ground loot array
4. Display pickup notification
5. Play pickup sound (placeholder)
6. Show gear stats when hovering
7. Test that walking over gear picks it up
8. Test that gear appears on ground

### 5.4 Equipment System
**File:** `player.js`

**Tasks to Complete:**
1. Add gear slots to player: weapon, armor, accessory
2. Add functions to apply gear bonuses
3. When gear is equipped:
   - Store in appropriate slot
   - Calculate stat bonuses
   - Apply bonuses to effective stats
4. Weapon bonus applies to damage
5. Armor bonus applies to defense
6. Accessory bonus applies to speed or crit
7. Create updateStats function
8. Recalculate stats whenever gear changes
9. Base stats + gear multipliers
10. Visual: Show gear on player
    - Weapon: small orbiting shape
    - Armor: thicker outline/glow
    - Accessory: trailing dot
11. Test that equipped gear increases stats
12. Test that better gear replaces worse

### 5.5 Inventory UI
**File:** `ui.js`

**Tasks to Complete:**
1. Add inventory display toggle key (I or Tab)
2. Create inventory screen
3. Show three gear slots
4. Display currently equipped gear in each slot
5. Show gear tier color
6. Show stat bonuses
7. Allow clicking to inspect gear
8. Display ground loot (items on floor)
9. Add inventory open/close logic
10. Test inventory UI works

### Phase 5 Deliverables Checklist:
- [ ] Gear generation works (random tier, slot)
- [ ] Enemies can drop gear on death
- [ ] Gear appears on ground as colored shapes
- [ ] Walking over gear picks it up
- [ ] Gear auto-equips if better than current
- [ ] Equipped gear increases stats
- [ ] Visual gear appears on player
- [ ] Inventory shows equipped gear
- [ ] Can view gear stats
- [ ] Loot feels rewarding

---

## Phase 6: Room System (Days 11-12)
**Goal:** Progression through multiple rooms

### 6.1 Room Structure
**File:** `level.js`

**Tasks to Complete:**
1. Create Room class/object
2. Room properties:
   - number (room 1, 2, 3, etc.)
   - type (normal, arena, boss)
   - enemies array
   - loot array (dropped items)
   - cleared flag (false)
   - doorOpen flag (false)
3. Room dimensions: 800x600 (same as canvas)
4. Create current room variable
5. Set current room number to 1
6. Test room object creation

### 6.2 Room Generation
**File:** `level.js`

**Tasks to Complete:**
1. Create generateRoom function
2. Takes room number as parameter
3. Calculate enemy count: 3 + floor(roomNumber * 0.5)
4. Calculate enemy scaling: 1 + (roomNumber * 0.15)
5. For each enemy to spawn:
   - Pick random spawn position
   - Choose enemy type (weighted by room number)
   - Scale enemy HP/damage
   - Create enemy object
6. Store all enemies in room.enemies array
7. More enemies spawn in higher rooms
8. Harder enemies in higher rooms
9. Test room generation works

**Enemy Scaling:**
- Room 1: 3 enemies, no scaling
- Room 2: 3-4 enemies, 15% stronger
- Room 3: 4 enemies, 30% stronger
- Room 5: 5 enemies, 75% stronger

### 6.3 Room Clearing
**File:** `level.js`

**Tasks to Complete:**
1. Create checkRoomCleared function
2. Count alive enemies: filter enemies where alive === true
3. If alive count === 0:
   - Set room.cleared = true
   - Set room.doorOpen = true
4. Call this check every frame
5. Display door when cleared
6. Door appears on right side of screen
7. Door is 50 pixels wide, 100 tall
8. Door at position: (750, 250)
9. Visual: draw rectangle as door
10. Test door appears when all enemies dead

### 6.4 Room Transitions
**File:** `main.js`

**Tasks to Complete:**
1. Check if door is open
2. Check if player.x > 750 (touching door)
3. If both true, advance to next room:
   - Increment room number
   - Generate new room
   - Reset player position to left side (50, 300)
   - Clear enemy array
   - Load new enemies
4. Show room transition fade
5. Display "Room N" on screen
6. Keep current level and stats
7. Test room progression works
8. Test multiple rooms can be cleared

### 6.5 Room UI
**File:** `ui.js`

**Tasks to Complete:**
1. Display current room number
2. Show at top center of screen
3. Example: "Room 3"
4. Add room counter display
5. Test room number displays correctly

### Phase 6 Deliverables Checklist:
- [ ] Rooms generate with enemies
- [ ] Room difficulty scales with room number
- [ ] Door appears when room cleared
- [ ] Walking into door advances to next room
- [ ] Room number displays on screen
- [ ] Multiple rooms can be cleared in sequence
- [ ] Player progresses through 5+ rooms
- [ ] Enemies get tougher each room

---

## Phase 7: Class System (Days 13-14)
**Goal:** Different playstyles available

### 7.1 Class Selection Screen
**File:** `main.js` and `ui.js`

**Tasks to Complete:**
1. Create game state: MENU, PLAYING
2. Show menu at game start
3. Create class selection screen
4. Display 4 class options:
   - Square (Warrior) - Blue
   - Triangle (Rogue) - Pink
   - Pentagon (Tank) - Dark Red
   - Hexagon (Mage) - Purple
5. Draw each class shape with name
6. Position classes vertically on left side
7. On click, select that class
8. Switch to PLAYING state
9. Initialize player with selected class
10. Test class selection works

### 7.2 Class Definitions
**File:** `player.js`

**Tasks to Complete:**
1. Define class stats object:
   - Square: HP 100, damage 10, speed 200, defense 0.1
   - Triangle: HP 75, damage 12, speed 250, defense 0, crit 0.25
   - Pentagon: HP 150, damage 8, speed 150, defense 0.2
   - Hexagon: HP 80, damage 15, speed 180, defense 0
2. Create setClass function in player
3. Takes class type as parameter
4. Load stats from class definitions
5. Set player stats based on class
6. Set player visual based on class
7. Test all 4 classes load correctly

### 7.3 Special Abilities
**File:** `player.js`

**Tasks to Complete:**
1. Add special ability cooldown variable
2. Add special cooldown time (5 seconds)
3. Check if Spacebar is pressed
4. Check if cooldown is ready
5. When ready, trigger class ability:
   
**Square (Warrior) - Spin Attack:**
6. Damage all enemies within 150 pixels
7. Deal 2x damage in AoE
8. Reset special cooldown

**Triangle (Rogue) - Dash:**
9. Teleport/dash forward 100 pixels
10. Damage enemies along dash path
11. Brief invincibility during dash
12. Reset special cooldown

**Pentagon (Tank) - Ground Slam:**
13. Create AoE around player (100 pixel radius)
14. Deal 3x damage in AoE
15. Stun enemies for 1 second
16. Reset special cooldown

**Hexagon (Mage) - Blink Nova:**
17. Teleport to mouse position
18. Create explosion at destination (AoE)
19. Deal damage in explosion
20. Reset special cooldown

21. Test each ability works
22. Add ability cooldown UI
23. Show cooldown remaining

### Phase 7 Deliverables Checklist:
- [ ] Class selection screen appears at start
- [ ] Can choose from 4 classes
- [ ] Each class has different stats
- [ ] Each class looks different
- [ ] Spacebar triggers special ability
- [ ] Each class has unique ability
- [ ] Abilities have cooldown (5s)
- [ ] Can play through game with different classes

---

## Phase 8: Enemy Variety (Days 15-16)
**Goal:** Diverse combat encounters

### 8.1 Diamond Enemy (Assassin)
**File:** `enemy.js`

**Tasks to Complete:**
1. Create Diamond enemy type
2. Stats: HP 25, damage 6, speed 120
3. AI: Circle around player when far
4. Dash attack when close (< 100 pixels)
5. Dash telegraph: flash red for 0.3s
6. Dash: speed boost to 400 for 0.2s
7. After dash, returns to circling
8. Lower HP than circle but faster
9. Test diamond enemy behavior
10. Test dash attack is dodgeable

### 8.2 Rectangle Enemy (Brute)
**File:** `enemy.js`

**Tasks to Complete:**
1. Create Rectangle enemy type
2. Stats: HP 60, damage 8, speed 60 (slow)
3. AI: Slow movement toward player
4. Charge attack when close (< 80 pixels)
5. Telegraph: grow larger for 1 second
6. Slam attack: AoE around enemy
7. Slam creates small knockback
8. High HP but easy to kite
9. Test brute enemy works
10. Test slam attack and dodge

### 8.3 Octagon Enemy (Elite)
**File:** `enemy.js`

**Tasks to Complete:**
1. Create Octagon enemy type
2. Stats: HP 80, damage 12, speed 110
3. Rare spawn (low chance)
4. AI: Combination of attacks
5. Attack 1: Spin before charging
6. Attack 2: Summon small minions
7. Attack 3: Ranged projectile
8. Mix of aggressive and defensive
9. Higher XP value
10. Better loot on death
11. Test octagon enemy works
12. Test all attack patterns

### 8.4 Enemy Spawn Logic
**File:** `level.js`

**Tasks to Complete:**
1. Update room enemy selection
2. Room 1-2: Only circles
3. Room 3-4: Circles and stars
4. Room 5-6: Add diamonds
5. Room 7-8: Add rectangles
6. Room 9+: All types including octagons
7. Weighted selection by room
8. Boss rooms get specific types
9. Test enemy variety works
10. Test difficulty progression

### Phase 8 Deliverables Checklist:
- [ ] 5 distinct enemy types work
- [ ] Each enemy has unique behavior
- [ ] Enemies spawn based on room number
- [ ] All enemy attacks are telegraphed
- [ ] All attacks can be dodged
- [ ] Enemy variety keeps combat fresh

---

## Phase 9: Polish & Juice (Days 17-18)
**Goal:** Make it feel good to play

### 9.1 Visual Effects
**File:** `render.js`

**Tasks to Complete:**
1. Create particle system
2. On enemy death, spawn particles:
   - 8-12 particles
   - Different colors per enemy type
   - Radial burst pattern
   - Fade out over 0.5s
3. On player hit, spawn blood particles
4. On level up, spawn celebratory particles
5. Add screen shake on heavy hits
6. Screen shake intensity based on damage
7. Duration: 0.1 seconds
8. Add hit pause (brief freeze) on big hits
9. Test all effects work

### 9.2 UI Polish
**File:** `ui.js`

**Tasks to Complete:**
1. Make main menu more presentable
3. Stylize all UI elements
6. Add damage numbers floating up
7. On hit, show damage number above enemy
8. Number floats up and fades
9. Add combo counter (optional)
10. Display hit streaks
11. Test UI looks good

### 9.3 Death Screen
**File:** `ui.js`

**Tasks to Complete:**
1. Create death screen overlay
2. Display "GAME OVER"
3. Show stats:
   - Final Level
   - Rooms Cleared
   - Enemies Killed
   - Time Played
4. Add restart button (R key)
5. Add menu button (M key)
6. Style death screen nicely
7. Test death screen appears correctly
8. fix issue with restarting after a death and the player not being able to use their special abilities and always forces the player back to warrier after a restart without refreshing the page.

### Phase 9 Deliverables Checklist:
- [ ] Particle effects on death
- [ ] Screen shake on hits
- [ ] Hit pause on big hits
- [ ] UI is stylized and readable
- [ ] Cooldown indicators visible
- [ ] Damage numbers float up
- [ ] Death screen shows stats
- [ ] Game feels polished
- [ ] Fix restart mechancis to make sure everything properly resets and the class stays the same

---

## Phase 10: Balancing & Content (Days 19-20)
**Goal:** Fine-tune the experience

### 10.1 Balance Pass
**Tasks:**
1. Test each class thoroughly
2. Adjust class stats if one is too weak/strong
3. Test enemy HP/damage curves
4. Make sure player can progress smoothly
5. Adjust XP requirements if leveling too fast/slow
6. Tune loot drop rates
7. Ensure gear feels impactful
8. Test all enemy types
9. Verify all attacks can be dodged
10. Check dodge roll timing
11. Adjust cooldowns if needed
12. Play full run and document issues

### 10.2 Boss Encounters
**File:** `level.js`

**Tasks to Complete:**
1. Every 5 rooms is a boss room
2. Boss = giant version of regular enemy
3. Boss size: 2x normal
4. Boss HP: 5x normal
5. Boss damage: 1.5x normal
6. Boss XP: 3x normal
7. Boss guaranteed rare+ loot drop
8. Boss has multiple phases:
   - Phase 1: Normal attacks
   - Phase 2 (50% HP): More aggressive
   - Phase 3 (25% HP): Desperate attacks
9. Add boss intro screen
10. Test boss fights work
11. Make sure they're challenging but fair

### 10.3 Quality of Life
**File:** `main.js`

**Tasks to Complete:**
1. Add enemy counter in room:
   - Display "Enemies: X" on screen
   - Update in real-time
2. Add quick restart (R key during game)
3. Add settings menu (ESC):
   - SFX volume
   - Music volume
   - Show FPS toggle
4. Add FPS counter (if enabled)
5. Add minimap (optional)
6. Test all QoL features work

### 10.4 Final Polish
**Tasks:**
1. Fix any remaining bugs
2. Test full game flow from menu to death
3. Ensure no performance issues
4. Check all features work together
5. Test all classes feel different
6. Verify progression feels good
7. Add any missing visual feedback
8. Final balance pass
9. Playtest extensively
10. Document any issues to fix later

### Phase 10 Deliverables Checklist:
- [ ] Game is fully playable from start to death
- [ ] All 4 classes are balanced and viable
- [ ] Boss fights appear every 5 rooms
- [ ] Boss fights are challenging
- [ ] Progression feels smooth
- [ ] No major bugs
- [ ] Game runs at 60 FPS
- [ ] All features work together
- [ ] Ready to play and enjoy!

---

## Development Timeline Summary

| Phase | Days | Key Features |
|-------|------|-------------|
| 1 | 1-2 | Movement, rotation, basic game loop |
| 2 | 3-4 | Combat, enemies, attacks |
| 3 | 5-6 | Dodge, heavy attacks, enemy patterns |
| 4 | 7-8 | Health, leveling, progression |
| 5 | 9-10 | Gear system, loot drops |
| 6 | 11-12 | Room system, progression |
| 7 | 13-14 | 4 playable classes, special abilities |
| 8 | 15-16 | 5 enemy types, variety |
| 9 | 17-18 | Polish, effects, UI |
| 10 | 19-20 | Balance, bosses, QoL |

**Total:** ~20 days for complete game

## Quick Reference: Development Tips

1. **Test frequently** - After each phase, play the game
2. **Fix bugs immediately** - Don't accumulate bugs
3. **Keep it simple** - Don't overcomplicate systems
4. **Use console.log** - For debugging
5. **One feature at a time** - Focus on one thing until it works
6. **Refactor as needed** - Clean up code if it becomes messy
7. **Have fun!** - If you're stuck, take a break and come back fresh


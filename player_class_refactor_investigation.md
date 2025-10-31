# Player Class Refactoring Investigation

## Current Structure Analysis

### File: `js/player.js` (2,914 lines)
- **Single Player class** with all character class functionality
- **CLASS_DEFINITIONS** constant (lines 4-48) defining stats for each class
- **48 conditional checks** using `this.playerClass === 'square/triangle/pentagon/hexagon'`
- **Class-specific methods** scattered throughout the Player class

### Character Classes

1. **Warrior (Square)**
   - Basic Attack: `meleeAttack()` - sword cleave with 4 hitboxes
   - Heavy Attack: `createForwardThrust()` - rush forward with damage
   - Special Ability: `activateWhirlwind()` - AoE damage around player
   - Passive: Block stance (50% damage reduction when standing still)
   - Preview: `updateThrustPreview()` for mobile

2. **Rogue (Triangle)**
   - Basic Attack: `throwKnife()` - projectile attack
   - Heavy Attack: `createFanOfKnives()` - 7 knives in spread pattern
   - Special Ability: `activateShadowClones()` - creates clones
   - Enhanced Dodge: 3 charges, collision damage
   - Previews: `updateDashPreview()`, `updateHeavyAttackPreview()` for mobile

3. **Tank (Pentagon)**
   - Basic Attack: `hammerSwingAttack()` - sweeping arc attack
   - Heavy Attack: `createGroundSmash()` - AoE knockback
   - Special Ability: `activateShield()` - directional shield with wave
   - Visual: Hammer trail rendering

4. **Mage (Hexagon)**
   - Basic Attack: `shootProjectile()` - magic bolt projectile
   - Heavy Attack: `createAoEBlast()` - expanding circle AoE
   - Special Ability: `activateBlink()` - teleport with decoy and explosion
   - Preview: `updateBlinkPreview()` for mobile

## Proposed File Structure

Following the pattern used by enemies (`enemy-base.js` → `enemy-basic.js`, etc.):

```
js/
  player.js                    → Rename to player-base.js (base class)
  players/
    player-warrior.js         → Warrior (Square) class
    player-rogue.js           → Rogue (Triangle) class
    player-tank.js            → Tank (Pentagon) class
    player-mage.js            → Mage (Hexagon) class
```

## Proposed Class Hierarchy

```javascript
// player-base.js
class PlayerBase {
    // Shared functionality:
    // - Core stats (hp, xp, level, position, movement)
    // - Dodge system (base implementation)
    // - Attack cooldowns
    // - Gear/equipment system
    // - XP/leveling system
    // - Base update loop
    // - Base render (shape drawing)
}

// players/player-warrior.js
class PlayerWarrior extends PlayerBase {
    // Warrior-specific:
    // - meleeAttack()
    // - createForwardThrust()
    // - activateWhirlwind()
    // - Block stance logic
    // - updateThrustPreview()
    // - Warrior-specific render additions
}

// players/player-rogue.js
class PlayerRogue extends PlayerBase {
    // Rogue-specific:
    // - throwKnife()
    // - createFanOfKnives()
    // - activateShadowClones()
    // - Enhanced dodge (3 charges, collision damage)
    // - updateDashPreview()
    // - updateHeavyAttackPreview()
    // - Rogue-specific render additions
}

// players/player-tank.js
class PlayerTank extends PlayerBase {
    // Tank-specific:
    // - hammerSwingAttack()
    // - createGroundSmash()
    // - activateShield()
    // - Shield wave logic
    // - Hammer trail rendering
    // - Tank-specific render additions
}

// players/player-mage.js
class PlayerMage extends PlayerBase {
    // Mage-specific:
    // - shootProjectile()
    // - createAoEBlast()
    // - activateBlink()
    // - Blink decoy/explosion logic
    // - updateBlinkPreview()
    // - Mage-specific render additions
}
```

## Method Distribution Plan

### Base Class (PlayerBase) - Shared Methods

**Core Systems:**
- `constructor()` - Initialize shared properties
- `setClass()` - Set base stats from CLASS_DEFINITIONS
- `update()` - Main update loop (delegates to class-specific handlers)
- `updateEffectiveStats()` - Calculate stats with gear bonuses
- `equipGear()` - Equipment management
- `addXP()` - XP system
- `levelUp()` - Level progression
- `takeDamage()` - Damage handling (with class-specific modifiers)
- `getCurrentStats()` - Stats getter
- `getEquippedGear()` - Gear getter

**Movement & Position:**
- Movement logic (shared between all classes)
- `processPullForces()` - Environmental pull forces
- `applyPullForce()` - Apply pull from hazards

**Attack System (Base):**
- `handleAttack()` - Input handling (delegates to class-specific attacks)
- `updateAttackHitboxes()` - Hitbox management (shared logic)
- Attack cooldown management

**Dodge System (Base):**
- `handleDodge()` - Base dodge input handling
- `startDodge()` - Base dodge implementation
- Dodge cooldown management

**Heavy Attack System (Base):**
- `handleHeavyAttack()` - Input handling (delegates to class-specific)
- `startHeavyAttack()` - Start charge phase
- Heavy attack cooldown management

**Special Ability System (Base):**
- `handleSpecialAbility()` - Input handling (delegates to class-specific)
- Special cooldown management

**Render (Base):**
- `render()` - Base shape rendering
- Shared visual effects (invulnerability, dodge transparency, etc.)

### Warrior-Specific Methods (PlayerWarrior)

**Attacks:**
- `meleeAttack()` - Sword cleave with 4 hitboxes
- `createForwardThrust()` - Heavy attack rush

**Abilities:**
- `activateWhirlwind()` - Special ability
- `updateThrustPreview()` - Mobile preview

**Update Logic:**
- Block stance timer updates
- Whirlwind duration updates
- Forward thrust animation updates

**Render:**
- Block stance visual effect
- Whirlwind visual effect
- Thrust preview rendering

### Rogue-Specific Methods (PlayerRogue)

**Attacks:**
- `throwKnife()` - Basic projectile attack
- `createFanOfKnives()` - Heavy attack

**Abilities:**
- `activateShadowClones()` - Special ability
- `updateDashPreview()` - Mobile preview
- `updateHeavyAttackPreview()` - Mobile preview

**Update Logic:**
- Enhanced dodge (3 charges, collision damage)
- Shadow clones duration updates
- Dash preview updates
- Heavy attack preview updates

**Render:**
- Shadow clones rendering
- Dash preview rendering
- Heavy attack preview rendering

### Tank-Specific Methods (PlayerTank)

**Attacks:**
- `hammerSwingAttack()` - Sweeping arc attack
- `createGroundSmash()` - Heavy attack AoE

**Abilities:**
- `activateShield()` - Special ability
- Shield wave logic

**Update Logic:**
- Shield duration updates
- Shield wave animation updates
- Hammer swing hitbox updates

**Render:**
- Hammer trail rendering
- Shield rendering
- Shield wave rendering

### Mage-Specific Methods (PlayerMage)

**Attacks:**
- `shootProjectile()` - Basic projectile attack
- `createAoEBlast()` - Heavy attack expanding AoE

**Abilities:**
- `activateBlink()` - Special ability
- `updateBlinkPreview()` - Mobile preview

**Update Logic:**
- Blink decoy animation updates
- Blink explosion animation updates
- Blink preview updates

**Render:**
- Blink preview rendering
- Blink decoy rendering
- Blink explosion rendering

## Class-Specific Properties

### Warrior Properties
```javascript
// Block stance
blockStanceActive
blockStanceTimer
blockStanceActivationTime

// Whirlwind
whirlwindActive
whirlwindElapsed
whirlwindDuration
whirlwindHitTimer

// Forward thrust
thrustActive
thrustElapsed
thrustDuration
thrustStartX/Y
thrustTargetX/Y
thrustPreviewActive
thrustPreviewX/Y
thrustPreviewDistance
```

### Rogue Properties
```javascript
// Enhanced dodge
dodgeCharges
maxDodgeCharges
dodgeChargeCooldowns
dodgeHitEnemies

// Shadow clones
shadowClonesActive
shadowClonesElapsed
shadowClonesDuration
shadowClones

// Previews
dashPreviewActive
dashPreviewX/Y
dashPreviewDistance
heavyAttackPreviewActive
heavyAttackPreviewAngle
heavyAttackPreviewSpread
```

### Tank Properties
```javascript
// Hammer swing
hammerSwingDirection

// Shield
shieldActive
shieldElapsed
shieldDuration
shieldWaveActive
shieldWaveElapsed
shieldWaveDuration
shieldDirection
shieldWaveHitEnemies
```

### Mage Properties
```javascript
// Blink
blinkCooldown
blinkDecoyActive
blinkDecoyElapsed
blinkDecoyDuration
blinkDecoyX/Y
blinkExplosionActive
blinkExplosionElapsed
blinkExplosionDuration
blinkExplosionX/Y
blinkKnockbackVx/Vy
blinkPreviewActive
blinkPreviewX/Y
blinkPreviewDistance
```

## Dependencies & Integration Points

### Shared Dependencies
- `utils.js` - `clamp()` function
- `render.js` - Rendering utilities
- `input.js` - Input handling
- `gear.js` - Equipment system
- `save.js` - Save system for upgrades
- Global `Game` object - Enemy arrays, projectiles, canvas

### Class-Specific Dependencies
- All classes use `Game.projectiles` for projectile attacks
- All classes use `Game.enemies` for collision detection
- Mage uses particle system (`createParticleBurst`)
- All classes use damage number system (`createDamageNumber`)

## Refactoring Strategy

### Phase 1: Extract Base Class
1. Create `player-base.js` with shared functionality
2. Move all non-class-specific methods to base
3. Keep conditional class checks temporarily

### Phase 2: Create Subclasses
1. Create `players/player-warrior.js`
2. Move Warrior-specific methods
3. Override base methods where needed
4. Repeat for Rogue, Tank, Mage

### Phase 3: Factory Pattern
1. Create factory function to instantiate correct class
2. Update `setClass()` to return appropriate instance
3. Or use factory pattern: `Player.create('square')`

### Phase 4: Clean Up
1. Remove all `this.playerClass === '...'` conditionals
2. Remove unused properties from base class
3. Update HTML script tags

## Challenges & Considerations

### 1. Dynamic Class Switching
- Current: `setClass()` changes properties
- Challenge: Can't change instance type at runtime
- Solution: Create new instance or use composition pattern

### 2. Shared State
- Properties initialized in constructor
- Challenge: Subclasses need different initial values
- Solution: Protected/private initialization methods

### 3. Method Overrides
- Some methods have class-specific logic mixed with shared logic
- Challenge: Determining what to override vs extend
- Solution: Template method pattern or composition

### 4. Render Complexity
- Render method has class-specific visuals mixed together
- Challenge: Maintaining rendering order
- Solution: Split into base render + class-specific render hooks

### 5. Update Loop Complexity
- Update method has many class-specific checks
- Challenge: Keeping update efficient
- Solution: Strategy pattern or virtual method calls

## Benefits of Refactoring

1. **Maintainability**: Each class in its own file, easier to find/modify
2. **Readability**: No more 48 conditional checks scattered throughout
3. **Extensibility**: Easy to add new character classes
4. **Testing**: Can test each class independently
5. **Code Size**: Base class ~1500 lines, each subclass ~400-600 lines
6. **Performance**: No runtime class checks (slight improvement)

## Script Loading Order

```html
<!-- Base classes first -->
<script src="js/utils.js"></script>
<script src="js/render.js"></script>
<script src="js/input.js"></script>
<script src="js/gear.js"></script>

<!-- Player base -->
<script src="js/player-base.js"></script>

<!-- Player classes -->
<script src="js/players/player-warrior.js"></script>
<script src="js/players/player-rogue.js"></script>
<script src="js/players/player-tank.js"></script>
<script src="js/players/player-mage.js"></script>

<!-- ... rest of game files ... -->
```

## Next Steps

1. **Review this investigation** with team/stakeholders
2. **Create prototype** - Extract one class (e.g., Warrior) as proof of concept
3. **Test thoroughly** - Ensure gameplay remains identical
4. **Iterate** - Extract remaining classes one by one
5. **Final testing** - Full game test suite

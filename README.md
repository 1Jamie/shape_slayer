# Shape Slayer

A skill-based 2D top-down Action Roguelike (ARPG) built with HTML5 Canvas and vanilla JavaScript. Control geometric shapes, fight through rooms of enemies, collect gear, and level up in fast-paced combat.

## 🎮 Game Overview

**Genre:** Action Roguelike  
**Platform:** Web Browser (HTML5 Canvas)  
**Tech Stack:** Vanilla JavaScript (ES6+), Canvas 2D API  
**Target Session Length:** 10-15 minutes

## ✨ Features

- **4 Player Classes** - Each with unique abilities and playstyles:
  - **Warrior** (Square) - Balanced melee with cleaving attacks
  - **Rogue** (Triangle) - High mobility with dash attacks and critical hits
  - **Tank** (Pentagon) - High HP with shield defense and crowd control
  - **Mage** (Hexagon) - Ranged attacks with AoE abilities

- **Dynamic Combat System** - Fast-paced action with:
  - Basic and heavy attacks
  - Dodge roll with invincibility frames
  - Class-specific special abilities
  - Screen shake and hit pause effects
  - Damage numbers and particle effects

- **Progression System** - Level up and collect gear:
  - XP-based leveling with stat increases
  - Gear drops with tier-based bonuses
  - Room-based progression with scaling difficulty

- **Enemy Variety** - Fight through multiple enemy types:
  - Swarmers (Circles)
  - Assassins (Diamonds)
  - Brutes (Rectangles)
  - Shooters (Stars)
  - Elites (Octagons)

- **Epic Boss Battles** - Challenging boss encounters every 5 rooms:
  - **Swarm King** (Room 10) - Star-shaped boss with spike attacks and minion summons
  - **Twin Prism** (Room 15) - Dual diamond boss with synchronized attacks
  - **Fortress** (Room 20) - Massive rectangular boss with defensive spikes and shockwaves
  - **Fractal Core** (Room 25) - Octagonal boss that fragments into multiple parts
  - **Vortex** (Room 30) - Final boss with powerful pull effects and rotating teeth
  - Each boss features 3 combat phases that change at 50% and 25% HP
  - Weak points offer 3x damage multiplier for skilled players
  - Boss intro sequences with epic presentations
  - Guaranteed rare+ loot drops (2-3 items)

- **Advanced Combat Mechanics**:
  - **Weak Point System** - Hit specific glowing areas on bosses for 3x damage
  - **Environmental Hazards** - Dynamic battlefield elements:
    - Shockwaves (expanding damage rings)
    - Damage zones (persistent area threats)
    - Pull fields (suction effects affecting movement)
    - Debris hazards (temporary collision zones)
  - **Pull Force System** - Bosses can apply physics-based pull effects
  - **Phase Transitions** - Bosses become more dangerous as HP drops

## 🚀 Getting Started

### Prerequisites

- Node.js (for local server)
- Modern web browser with JavaScript enabled

### Installation

1. Clone the repository:
```bash
git clone https://github.com/1jamie/shape_slayer.git
cd shape_slayer

```
2. simply open `index.html` directly in your browser.

(there is a node server but thats just for my ease of testing)

## 🎯 Controls

- **WASD** - Move in 8 directions
- **Mouse** - Player rotates to face cursor
- **Left Click** - Basic attack (~0.3s cooldown)
- **Right Click** - Heavy attack (~1.5-2.5s cooldown)
- **Shift** - Dodge roll with i-frames (~2s cooldown)
- **Spacebar** - Class special ability (~5s cooldown)
- **ESC** - Pause menu
- **R** - Restart game
- **M** - Return to main menu
- **Skip/Click** - Skip boss intro sequences during presentation
- **Ctrl+D** - Toggle debug panel (for testing)

## 🏗️ Project Structure

```
shape_slayer/
├── index.html          # Main HTML file
├── server.js           # Local development server
├── css/
│   └── style.css       # Game styling
├── js/
│   ├── main.js         # Game loop and core logic
│   ├── player.js       # Player class and mechanics
│   ├── combat.js       # Combat system
│   ├── level.js        # Room generation
│   ├── gear.js         # Loot and equipment
│   ├── ui.js           # HUD and menus
│   ├── input.js        # Input handling
│   ├── render.js       # Rendering and effects
│   ├── utils.js        # Helper functions
│   ├── debug.js        # Debug panel for testing
│   ├── enemies/        # Enemy classes
│   │   ├── enemy-base.js      # Base enemy class
│   │   ├── enemy-basic.js     # Circle enemy (Swarmer)
│   │   ├── enemy-star.js      # Star enemy (Ranged)
│   │   ├── enemy-diamond.js   # Diamond enemy (Assassin)
│   │   ├── enemy-rectangle.js # Rectangle enemy (Brute)
│   │   └── enemy-octagon.js   # Octagon enemy (Elite)
│   └── bosses/         # Boss classes and systems
│       ├── boss-base.js        # Base boss class
│       ├── hazards.js          # Environmental hazard system
│       ├── boss-swarmking.js   # Swarm King (Room 10)
│       ├── boss-twinprism.js   # Twin Prism (Room 15)
│       ├── boss-fortress.js    # Fortress (Room 20)
│       ├── boss-fractalcore.js # Fractal Core (Room 25)
│       └── boss-vortex.js      # Vortex (Room 30)
├── spec_sheet.md       # Game design specification
└── implementation_plan.md # Development roadmap
```

## 🛠️ Technologies Used

- **HTML5 Canvas 2D** - Rendering
- **Vanilla JavaScript (ES6+)** - Game logic
- **Node.js** - Development server
- No external dependencies or frameworks

## 🎮 Boss System Details

### Boss Encounters
Bosses spawn every 5 rooms starting at Room 10. Each boss features:

- **Massive Health Pools** - 5x normal enemy HP (scaled by room)
- **3-Phase Combat** - Bosses change behavior at 50% and 25% HP
- **Weak Points** - Glowing areas that take 3x damage when hit
- **Environmental Hazards** - Dynamic battlefield threats
- **Guaranteed Rare+ Loot** - Bosses always drop 2-3 high-quality items
- **Epic Intro Sequences** - Dramatic boss introductions (skippable)

### Individual Bosses

#### 🟡 Swarm King (Room 10)
- **Shape:** Star with inward-bending spikes
- **Weak Points:** 3 at spike bases
- **Phase 1:** Spike barrages, chase lunge attacks
- **Phase 2:** Spawns minions, spinning spike wheel
- **Phase 3:** Multi-barrage attacks, explosive finale

#### 🟠 Twin Prism (Room 15)
- **Shape:** Two overlapping diamonds
- **Weak Point:** 1 at center connection
- **Phase 1:** Dual dash patterns, rotation attacks
- **Phase 2:** Synchronized strikes, split attacks
- **Phase 3:** Frenzy mode, merged form slams

#### 🟤 Fortress (Room 20)
- **Shape:** Large rectangle with crenellations
- **Weak Points:** 2 at top corners
- **Phase 1:** Charging slams, corner spikes, wall pushes
- **Phase 2:** Multiple slams, full spike bursts
- **Phase 3:** Rampage mode, fortress storm, collapse attacks

#### 🔵 Fractal Core (Room 25)
- **Shape:** Octagon with concave sides, fragments
- **Weak Points:** 4 at indentations
- **Phase 1:** Fragment spawning, phase dashes, rotation blasts
- **Phase 2:** Multi-fragment attacks, phase chains, expanding pulses
- **Phase 3:** Chaos mode, super fragment storms, core explosion

#### 🔴 Vortex (Room 30) - Final Boss
- **Shape:** Gear-like circle with rotating teeth
- **Weak Point:** 1 at center core
- **Phase 1:** Vortex pull, rotating teeth, spin projectiles
- **Phase 2:** Stronger pull effects, tooth barrages, double spins
- **Phase 3:** Maximum pull, teeth expansion, final vortex explosion

### Environmental Hazards
Bosses create dynamic battlefield hazards:

- **Shockwaves** - Expanding rings that deal one-time damage
- **Damage Zones** - Persistent areas dealing damage over time
- **Pull Fields** - Areas that apply physics-based pull forces
- **Debris** - Temporary collision zones from explosions

### Weak Point System
- Weak points appear as glowing, pulsing areas on bosses
- Hitting weak points deals **3x damage** instead of normal damage
- Weak points may be hidden or protected during certain boss attacks
- Optional mechanic - skilled players are rewarded with faster boss kills

## 🐛 Debug Tools

### Debug Panel
Accessible via `DebugPanel.toggle()` in the browser console or `Ctrl+D`:
- Warp to specific rooms instantly (rooms 10, 15, 20, 25, 30 highlighted for bosses)
- Custom room input (1-100)
- Current room display
- Perfect for testing boss encounters without playing through earlier rooms

For questions or feedback, please open an issue on GitHub.

---

**Note:** This game is currently in development. Features and mechanics may change.


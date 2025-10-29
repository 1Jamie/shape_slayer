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
│   ├── enemy-base.js   # Base enemy class
│   ├── enemy-*.js      # Specific enemy types
│   ├── combat.js       # Combat system
│   ├── level.js        # Room generation
│   ├── gear.js         # Loot and equipment
│   ├── ui.js           # HUD and menus
│   ├── input.js        # Input handling
│   ├── render.js       # Rendering and effects
│   └── utils.js        # Helper functions
├── spec_sheet.md       # Game design specification
└── implementation_plan.md # Development roadmap
```

## 🛠️ Technologies Used

- **HTML5 Canvas 2D** - Rendering
- **Vanilla JavaScript (ES6+)** - Game logic
- **Node.js** - Development server
- No external dependencies or frameworks


For questions or feedback, please open an issue on GitHub.

---

**Note:** This game is currently in development. Features and mechanics may change.


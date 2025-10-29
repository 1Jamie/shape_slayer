// Debug Panel System
// Accessible from dev console for testing (e.g., DebugPanel.toggle())

const DebugPanel = {
    visible: false,
    panelElement: null,
    
    // Initialize debug panel
    init() {
        // Create panel element
        this.panelElement = document.createElement('div');
        this.panelElement.id = 'debugPanel';
        this.panelElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 250px;
            background: rgba(20, 20, 30, 0.95);
            border: 2px solid #00ff00;
            border-radius: 8px;
            padding: 15px;
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            z-index: 10000;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 255, 0, 0.3);
        `;
        
        // Panel content
        this.panelElement.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; font-size: 16px; text-align: center; border-bottom: 1px solid #00ff00; padding-bottom: 8px;">
                DEBUG PANEL
            </div>
            <div style="margin-bottom: 15px;">
                <div style="margin-bottom: 8px; font-weight: bold;">Current Room: <span id="debugCurrentRoom">1</span></div>
                <div style="margin-bottom: 12px; font-size: 12px; color: #88ff88;">Warp to Room:</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
                    <button class="debug-room-btn" data-room="1" style="flex: 1; min-width: 50px; padding: 6px; background: #1a1a2e; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; border-radius: 4px; transition: all 0.2s;" onmouseover="this.style.background='#2a2a3e'; this.style.borderColor='#88ff88';" onmouseout="this.style.background='#1a1a2e'; this.style.borderColor='#00ff00';">1</button>
                    <button class="debug-room-btn" data-room="5" style="flex: 1; min-width: 50px; padding: 6px; background: #1a1a2e; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; border-radius: 4px; transition: all 0.2s;" onmouseover="this.style.background='#2a2a3e'; this.style.borderColor='#88ff88';" onmouseout="this.style.background='#1a1a2e'; this.style.borderColor='#00ff00';">5</button>
                    <button class="debug-room-btn" data-room="10" style="flex: 1; min-width: 50px; padding: 6px; background: #ffaa00; border: 1px solid #ffaa00; color: #fff; cursor: pointer; border-radius: 4px; font-weight: bold; transition: all 0.2s;" onmouseover="this.style.background='#ffbb33'; this.style.transform='scale(1.05)';" onmouseout="this.style.background='#ffaa00'; this.style.transform='scale(1)';">10</button>
                    <button class="debug-room-btn" data-room="15" style="flex: 1; min-width: 50px; padding: 6px; background: #ffaa00; border: 1px solid #ffaa00; color: #fff; cursor: pointer; border-radius: 4px; font-weight: bold; transition: all 0.2s;" onmouseover="this.style.background='#ffbb33'; this.style.transform='scale(1.05)';" onmouseout="this.style.background='#ffaa00'; this.style.transform='scale(1)';">15</button>
                    <button class="debug-room-btn" data-room="20" style="flex: 1; min-width: 50px; padding: 6px; background: #ffaa00; border: 1px solid #ffaa00; color: #fff; cursor: pointer; border-radius: 4px; font-weight: bold; transition: all 0.2s;" onmouseover="this.style.background='#ffbb33'; this.style.transform='scale(1.05)';" onmouseout="this.style.background='#ffaa00'; this.style.transform='scale(1)';">20</button>
                    <button class="debug-room-btn" data-room="25" style="flex: 1; min-width: 50px; padding: 6px; background: #ffaa00; border: 1px solid #ffaa00; color: #fff; cursor: pointer; border-radius: 4px; font-weight: bold; transition: all 0.2s;" onmouseover="this.style.background='#ffbb33'; this.style.transform='scale(1.05)';" onmouseout="this.style.background='#ffaa00'; this.style.transform='scale(1)';">25</button>
                    <button class="debug-room-btn" data-room="30" style="flex: 1; min-width: 50px; padding: 6px; background: #ffaa00; border: 1px solid #ffaa00; color: #fff; cursor: pointer; border-radius: 4px; font-weight: bold; transition: all 0.2s;" onmouseover="this.style.background='#ffbb33'; this.style.transform='scale(1.05)';" onmouseout="this.style.background='#ffaa00'; this.style.transform='scale(1)';">30</button>
                </div>
                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                    <input type="number" id="debugRoomInput" placeholder="Room #" min="1" max="100" style="flex: 1; padding: 6px; background: #1a1a2e; border: 1px solid #00ff00; color: #00ff00; border-radius: 4px; font-family: 'Courier New', monospace;">
                    <button id="debugWarpBtn" style="padding: 6px 12px; background: #1a1a2e; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; border-radius: 4px; transition: all 0.2s;" onmouseover="this.style.background='#2a2a3e'; this.style.borderColor='#88ff88';" onmouseout="this.style.background='#1a1a2e'; this.style.borderColor='#00ff00';">Warp</button>
                </div>
            </div>
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #00ff00; font-size: 11px; color: #88ff88;">
                <div>Ctrl+D to toggle</div>
                <div>DebugPanel.toggle() in console</div>
            </div>
        `;
        
        document.body.appendChild(this.panelElement);
        
        // Wire up buttons
        this.setupEventListeners();
        
        // Keyboard shortcut (Ctrl+D)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.toggle();
            }
        });
    },
    
    setupEventListeners() {
        // Room number buttons
        const roomButtons = this.panelElement.querySelectorAll('.debug-room-btn');
        roomButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const roomNum = parseInt(btn.getAttribute('data-room'));
                this.warpToRoom(roomNum);
            });
        });
        
        // Custom room input
        const warpBtn = this.panelElement.querySelector('#debugWarpBtn');
        const roomInput = this.panelElement.querySelector('#debugRoomInput');
        
        warpBtn.addEventListener('click', () => {
            const roomNum = parseInt(roomInput.value);
            if (roomNum > 0) {
                this.warpToRoom(roomNum);
            }
        });
        
        roomInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const roomNum = parseInt(roomInput.value);
                if (roomNum > 0) {
                    this.warpToRoom(roomNum);
                }
            }
        });
    },
    
    // Toggle panel visibility
    toggle() {
        this.visible = !this.visible;
        if (this.panelElement) {
            this.panelElement.style.display = this.visible ? 'block' : 'none';
        }
        console.log(`Debug panel ${this.visible ? 'opened' : 'closed'}`);
    },
    
    // Show panel
    show() {
        this.visible = true;
        if (this.panelElement) {
            this.panelElement.style.display = 'block';
        }
    },
    
    // Hide panel
    hide() {
        this.visible = false;
        if (this.panelElement) {
            this.panelElement.style.display = 'none';
        }
    },
    
    // Warp to specific room number
    warpToRoom(roomNumber) {
        if (!roomNumber || roomNumber < 1) {
            console.error('Invalid room number:', roomNumber);
            return;
        }
        
        if (typeof Game === 'undefined' || !Game.player) {
            console.error('Game or player not initialized');
            return;
        }
        
        if (typeof generateRoom === 'undefined') {
            console.error('generateRoom function not available');
            return;
        }
        
        console.log(`[DEBUG] Warping to Room ${roomNumber}`);
        
        // Update room number
        Game.roomNumber = roomNumber;
        
        // Generate new room
        const newRoom = generateRoom(roomNumber);
        
        // Update currentRoom
        if (typeof currentRoom !== 'undefined') {
            currentRoom = newRoom;
        }
        
        // Update enemies array
        Game.enemies = newRoom.enemies;
        
        // Check if this is a boss room and start intro
        if (newRoom.type === 'boss' && Game.enemies.length > 0 && Game.enemies[0].isBoss) {
            const boss = Game.enemies[0];
            Game.startBossIntro(boss);
        }
        
        // Clear ground loot
        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }
        
        // Reset player position to left side
        Game.player.x = 50;
        Game.player.y = 300;
        
        // Update debug panel display
        this.updateDisplay();
        
        // Clear any boss intro if warping
        if (Game.bossIntroActive) {
            Game.endBossIntro();
        }
        
        console.log(`[DEBUG] Warped to Room ${roomNumber}${newRoom.type === 'boss' ? ' (BOSS ROOM)' : ''}`);
    },
    
    // Update panel display with current room info
    updateDisplay() {
        if (!this.panelElement) return;
        
        const roomDisplay = this.panelElement.querySelector('#debugCurrentRoom');
        if (roomDisplay && typeof Game !== 'undefined') {
            roomDisplay.textContent = Game.roomNumber || 1;
        }
    },
    
    // Update display periodically (called from game loop)
    update() {
        if (this.visible) {
            this.updateDisplay();
        }
    }
};

// Auto-initialize when page loads
window.addEventListener('load', () => {
    DebugPanel.init();
    
    // Expose to global scope for console access
    window.DebugPanel = DebugPanel;
    console.log('Debug Panel initialized. Use DebugPanel.toggle() or Ctrl+D to open/close.');
});


// Debug Panel System
// Accessible from dev console for testing (e.g., DebugPanel.toggle())

// Debug flags for verbose logging (toggle these to debug specific systems)
const DebugFlags = {
    DAMAGE_NUMBERS: false, // Verbose damage number sync logging (host, server, client, rendering)
    INVINCIBILITY: false, // Player takes no damage
    USE_CACHING: true, // Enable/disable rendering caches
    ADAPTIVE_RENDER_QUALITY: true, // Reduce optional render resolution/frequency under sustained pressure
    RENDER_TIMING: false, // Track ground loot / player gear / remote player render sub-timings
    ROOM_LAYOUT: false, // Draw generated room collision grid, spawn, and exit zones

    // Toggle a debug flag from console: DebugFlags.DAMAGE_NUMBERS = true
    enable(flagName) {
        if (this.hasOwnProperty(flagName)) {
            this[flagName] = true;
            console.log(`[Debug] Enabled: ${flagName}`);
        } else {
            console.warn(`[Debug] Unknown flag: ${flagName}`);
        }
    },

    disable(flagName) {
        if (this.hasOwnProperty(flagName)) {
            this[flagName] = false;
            console.log(`[Debug] Disabled: ${flagName}`);
        } else {
            console.warn(`[Debug] Unknown flag: ${flagName}`);
        }
    }
};

const DebugPanel = {
    visible: false,
    panelElement: null,

    // Frame time tracking
    frameTimes: [],
    cpuTimes: [],
    phaseSamples: {},
    lastFrameTime: 0,
    lastMetricsDomUpdate: 0,

    // Initialize debug panel
    init() {
        // Create panel element
        this.panelElement = document.createElement('div');
        this.panelElement.id = 'debugPanel';
        this.panelElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 280px;
            max-height: calc(100vh - 40px);
            max-height: calc(100dvh - 40px);
            overflow-x: hidden;
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
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
            box-sizing: border-box;
        `;

        // Panel content
        this.panelElement.innerHTML = `
            <div style="position: sticky; top: -15px; z-index: 2; margin: -15px -15px 10px -15px; padding: 15px 15px 8px 15px; background: rgba(20, 20, 30, 0.98); border-bottom: 1px solid #00ff00; font-weight: bold; font-size: 16px; text-align: center;">
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
            <div style="margin-bottom: 15px; padding-top: 10px; border-top: 1px solid #00ff00;">
                <div style="margin-bottom: 8px; font-weight: bold;">Performance</div>
                <label style="display: flex; align-items: center; cursor: pointer; user-select: none; margin-bottom: 6px;">
                    <input type="checkbox" id="debugUseCaching" style="margin-right: 8px; cursor: pointer;">
                    <span style="color: #00ffff;">Use Caching</span>
                </label>
                <label style="display: flex; align-items: center; cursor: pointer; user-select: none; margin-bottom: 8px;">
                    <input type="checkbox" id="debugRenderTiming" style="margin-right: 8px; cursor: pointer;">
                    <span style="color: #00ffff;">Metrics When Hidden</span>
                </label>
                <div style="font-size: 12px; color: #88ff88; margin-top: 5px;">
                    <div>FPS: <span id="debugFps" style="color: #fff;">-</span> &nbsp;|&nbsp; Quality: <span id="debugQualityTier" style="color: #fff;">-</span></div>
                </div>
                <div style="font-size: 12px; color: #88ff88; margin-top: 5px;">
                    <div>Frame Time (Avg):</div>
                    <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                        <span>1s: <span id="debugFt1s" style="color: #fff;">-</span>ms</span>
                        <span>5s: <span id="debugFt5s" style="color: #fff;">-</span>ms</span>
                    </div>
                    <div style="margin-top: 2px;">
                        <span>10s: <span id="debugFt10s" style="color: #fff;">-</span>ms</span>
                    </div>
                </div>
                <div style="font-size: 12px; color: #88ff88; margin-top: 5px; border-top: 1px dashed #00ff00; padding-top: 5px;">
                    <div>CPU Time (Avg):</div>
                    <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                        <span>1s: <span id="debugCpu1s" style="color: #fff;">-</span>ms</span>
                        <span>5s: <span id="debugCpu5s" style="color: #fff;">-</span>ms</span>
                    </div>
                    <div style="margin-top: 2px;">
                        <span>10s: <span id="debugCpu10s" style="color: #fff;">-</span>ms</span>
                    </div>
                </div>
                <div style="font-size: 12px; color: #88ff88; margin-top: 5px; border-top: 1px dashed #00ff00; padding-top: 5px;">
                    <div>Frame Breakdown (1s avg):</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; margin-top: 2px;">
                        <span>Upd: <span id="debugPhaseUpdate" style="color: #fff;">-</span></span>
                        <span>Rnd: <span id="debugPhaseRender" style="color: #fff;">-</span></span>
                        <span>Static: <span id="debugPhaseStatic" style="color: #fff;">-</span></span>
                        <span>World: <span id="debugPhaseWorld" style="color: #fff;">-</span></span>
                        <span>Glow: <span id="debugPhaseWorldGlow" style="color: #fff;">-</span></span>
                        <span>Bodies: <span id="debugPhaseWorldBodies" style="color: #fff;">-</span></span>
                        <span>Vig: <span id="debugPhaseVignette" style="color: #fff;">-</span></span>
                        <span>Post: <span id="debugPhasePostFx" style="color: #fff;">-</span></span>
                        <span>UI: <span id="debugPhaseUi" style="color: #fff;">-</span></span>
                        <span>Other: <span id="debugPhaseOther" style="color: #fff;">-</span></span>
                        <span>Catch: <span id="debugCatchupUpdates" style="color: #fff;">-</span></span>
                        <span>Drop: <span id="debugAccumulatorDrop" style="color: #fff;">-</span></span>
                    </div>
                </div>
                <div id="debugRenderTimingSection" style="font-size: 12px; color: #88ff88; margin-top: 5px; border-top: 1px dashed #00ff00; padding-top: 5px;">
                    <div>Render Sub-Timings (1s avg):</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; margin-top: 2px;">
                        <span>Loot: <span id="debugRenderGroundLoot" style="color: #fff;">-</span></span>
                        <span>Rings: <span id="debugRenderGearRings" style="color: #fff;">-</span></span>
                        <span>Remote: <span id="debugRenderRemote" style="color: #fff;">-</span></span>
                        <span>W Glow: <span id="debugRenderWorldGlow" style="color: #fff;">-</span></span>
                        <span>W Body: <span id="debugRenderWorldBodies" style="color: #fff;">-</span></span>
                    </div>
                </div>
                <div style="font-size: 12px; color: #88ff88; margin-top: 5px; border-top: 1px dashed #00ff00; padding-top: 5px;">
                    <div>Budget (2s avg): <span id="debugBudgetFrame" style="color: #fff;">-</span> / <span id="debugBudgetRender" style="color: #fff;">-</span>ms</div>
                </div>
                <div style="font-size: 12px; color: #88ff88; margin-top: 5px; border-top: 1px dashed #00ff00; padding-top: 5px;">
                    <div>Scene (visible / total):</div>
                    <div id="debugSceneCounts" style="font-size: 11px; color: #ccc; line-height: 1.4; margin-top: 2px;">-</div>
                </div>
                <div style="font-size: 12px; color: #88ff88; margin-top: 8px; border-top: 1px dashed #00ff00; padding-top: 5px;">
                    <div style="margin-bottom: 6px; font-weight: bold; color: #ffcc66;">Run Profile</div>
                    <label style="display: flex; align-items: center; cursor: pointer; user-select: none; margin-bottom: 6px;">
                        <input type="checkbox" id="debugProfileAutoStart" style="margin-right: 8px; cursor: pointer;">
                        <span style="color: #ffcc66;">Auto-start on run</span>
                    </label>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px;">
                        <button id="debugProfileStartBtn" style="flex: 1; min-width: 70px; padding: 5px; background: #1a1a2e; border: 1px solid #ffcc66; color: #ffcc66; cursor: pointer; border-radius: 4px;">Start</button>
                        <button id="debugProfileStopBtn" style="flex: 1; min-width: 70px; padding: 5px; background: #1a1a2e; border: 1px solid #ff8888; color: #ff8888; cursor: pointer; border-radius: 4px;">Stop</button>
                        <button id="debugProfileExportBtn" style="flex: 1; min-width: 70px; padding: 5px; background: #1a1a2e; border: 1px solid #88ff88; color: #88ff88; cursor: pointer; border-radius: 4px;">Export</button>
                    </div>
                    <div id="debugProfileStatus" style="font-size: 11px; color: #ccc; line-height: 1.35; white-space: pre-wrap;">Inactive</div>
                </div>
            </div>
            <div style="margin-bottom: 15px; padding-top: 10px; border-top: 1px solid #00ff00;">
                <div style="margin-bottom: 8px; font-weight: bold;">Combat Scaling</div>
                <div id="debugScalingFactors" style="font-size: 11px; color: #88ff88; line-height: 1.4;">-</div>
            </div>
            <div style="margin-bottom: 15px; padding-top: 10px; border-top: 1px solid #00ff00;">
                <div style="margin-bottom: 8px; font-weight: bold;">Cheats</div>
                <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                    <input type="checkbox" id="debugInvincibility" style="margin-right: 8px; cursor: pointer;">
                    <span style="color: #ffaa00;">Invincibility</span>
                </label>
            </div>
            <div id="debugBossSection" style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #ffaa00; display: none;">
                <div style="margin-bottom: 6px; font-weight: bold; color: #ffaa00;">Boss Phase Controls</div>
                <div style="margin-bottom: 10px; font-size: 12px; color: #ffdd88;">Current Phase: <span id="debugBossPhase">-</span></div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <button class="debug-boss-phase-btn" data-phase="1" style="flex: 1; min-width: 65px; padding: 6px; background: #1a1a2e; border: 1px solid #77ff77; color: #77ff77; cursor: pointer; border-radius: 4px; transition: all 0.2s;" onmouseover="this.style.background='#2b2b3f'; this.style.borderColor='#aaffaa';" onmouseout="this.style.background='#1a1a2e'; this.style.borderColor='#77ff77';">Phase 1</button>
                    <button class="debug-boss-phase-btn" data-phase="2" style="flex: 1; min-width: 65px; padding: 6px; background: #332200; border: 1px solid #ffaa00; color: #ffaa00; cursor: pointer; border-radius: 4px; transition: all 0.2s;" onmouseover="this.style.background='#443100'; this.style.borderColor='#ffcc33';" onmouseout="this.style.background='#332200'; this.style.borderColor='#ffaa00';">Phase 2</button>
                    <button class="debug-boss-phase-btn" data-phase="3" style="flex: 1; min-width: 65px; padding: 6px; background: #3a0000; border: 1px solid #ff4444; color: #ff4444; cursor: pointer; border-radius: 4px; transition: all 0.2s;" onmouseover="this.style.background='#550000'; this.style.borderColor='#ff7777';" onmouseout="this.style.background='#3a0000'; this.style.borderColor='#ff4444';">Phase 3</button>
                </div>
            </div>
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #00ff00; font-size: 11px; color: #88ff88;">
                <div>Ctrl+D to toggle</div>
                <div>DebugPanel.toggle() in console</div>
            </div>
        `;

        document.body.appendChild(this.panelElement);

        this.panelElement.addEventListener('wheel', (e) => {
            e.stopPropagation();
        }, { passive: true });

        this.panelElement.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        }, { passive: true });

        // Wire up buttons
        this.setupEventListeners();

        // Keyboard shortcut (Ctrl+D)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd' || e.ctrlKey && e.key === 'D') {
                e.preventDefault();
                e.stopPropagation();
                this.toggle();
            }
        }, { capture: true });
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

        // Boss phase buttons
        const bossPhaseButtons = this.panelElement.querySelectorAll('.debug-boss-phase-btn');
        bossPhaseButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPhase = parseInt(btn.getAttribute('data-phase'));
                this.setBossPhase(targetPhase);
            });
        });


        // Invincibility toggle
        const invincibilityCheckbox = this.panelElement.querySelector('#debugInvincibility');
        if (invincibilityCheckbox) {
            invincibilityCheckbox.checked = DebugFlags.INVINCIBILITY;
            invincibilityCheckbox.addEventListener('change', (e) => {
                DebugFlags.INVINCIBILITY = e.target.checked;
                console.log(`[Debug] Invincibility: ${DebugFlags.INVINCIBILITY ? 'ENABLED' : 'DISABLED'}`);
            });
        }

        // Caching toggle
        const cachingCheckbox = this.panelElement.querySelector('#debugUseCaching');
        if (cachingCheckbox) {
            cachingCheckbox.checked = DebugFlags.USE_CACHING;
            cachingCheckbox.addEventListener('change', (e) => {
                DebugFlags.USE_CACHING = e.target.checked;
                console.log(`[Debug] Caching: ${DebugFlags.USE_CACHING ? 'ENABLED' : 'DISABLED'}`);
            });
        }

        const renderTimingCheckbox = this.panelElement.querySelector('#debugRenderTiming');
        if (renderTimingCheckbox) {
            renderTimingCheckbox.checked = DebugFlags.RENDER_TIMING;
            renderTimingCheckbox.addEventListener('change', (e) => {
                DebugFlags.RENDER_TIMING = e.target.checked;
                console.log(`[Debug] Metrics when hidden: ${DebugFlags.RENDER_TIMING ? 'ENABLED' : 'DISABLED'}`);
            });
        }

        const profileAutoStart = this.panelElement.querySelector('#debugProfileAutoStart');
        const profileStartBtn = this.panelElement.querySelector('#debugProfileStartBtn');
        const profileStopBtn = this.panelElement.querySelector('#debugProfileStopBtn');
        const profileExportBtn = this.panelElement.querySelector('#debugProfileExportBtn');
        if (profileAutoStart && typeof RunProfiler !== 'undefined') {
            profileAutoStart.checked = !!RunProfiler.autoStartOnRun;
            profileAutoStart.addEventListener('change', (e) => {
                RunProfiler.autoStartOnRun = e.target.checked;
                this.updateProfileStatusUI();
            });
        }
        if (profileStartBtn && typeof RunProfiler !== 'undefined') {
            profileStartBtn.addEventListener('click', () => {
                if (RunProfiler.isActive()) {
                    console.log('[RunProfiler] Already recording');
                    return;
                }
                RunProfiler.start(this.buildProfilerMeta());
                DebugFlags.RENDER_TIMING = true;
                const renderTimingEl = this.panelElement.querySelector('#debugRenderTiming');
                if (renderTimingEl) renderTimingEl.checked = true;
                if (typeof Game !== 'undefined' && Game.state === 'PLAYING' && typeof currentRoom !== 'undefined' && currentRoom) {
                    RunProfiler.markRoomEnter(
                        Game.roomNumber || currentRoom.number || 1,
                        currentRoom.type || 'normal',
                        currentRoom.biomeId || null
                    );
                }
                this.updateProfileStatusUI();
            });
        }
        if (profileStopBtn && typeof RunProfiler !== 'undefined') {
            profileStopBtn.addEventListener('click', () => {
                if (!RunProfiler.isActive()) {
                    return;
                }
                RunProfiler.stop();
                this.updateProfileStatusUI();
                console.log(RunProfiler.getSummaryText());
            });
        }
        if (profileExportBtn && typeof RunProfiler !== 'undefined') {
            profileExportBtn.addEventListener('click', () => {
                RunProfiler.exportJson();
            });
        }
    },

    buildProfilerMeta() {
        if (typeof Game === 'undefined' || !Game) {
            return {};
        }
        return {
            gameMode: Game.gameMode || null,
            selectedClass: Game.selectedClass || null,
            multiplayer: !!Game.multiplayerEnabled,
            roomNumber: Game.roomNumber || 1
        };
    },

    updateProfileStatusUI() {
        const statusEl = this.panelElement && this.panelElement.querySelector('#debugProfileStatus');
        if (!statusEl || typeof RunProfiler === 'undefined') {
            return;
        }
        if (!RunProfiler.isActive()) {
            const sampleCount = RunProfiler.global ? RunProfiler.global.sampleCount : 0;
            statusEl.textContent = sampleCount > 0
                ? `Inactive (${sampleCount} samples retained - Export to save)`
                : 'Inactive';
            return;
        }
        const elapsed = Math.max(0, performance.now() - RunProfiler.startedAt);
        const rooms = RunProfiler.rooms ? RunProfiler.rooms.length : 0;
        const samples = RunProfiler.global ? RunProfiler.global.sampleCount : 0;
        statusEl.textContent = `Recording ${(elapsed / 1000).toFixed(0)}s\nRooms: ${rooms}  Samples: ${samples}`;
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

        // Clear any existing boss intro FIRST
        if (Game.bossIntroActive) {
            Game.endBossIntro();
        }

        // Update room number
        Game.roomNumber = roomNumber;

        // Generate new room
        const newRoom = generateRoom(roomNumber);

        // Update currentRoom
        if (typeof currentRoom !== 'undefined') {
            if (typeof releaseRoomRenderCaches === 'function') {
                releaseRoomRenderCaches(currentRoom);
            }
            currentRoom = newRoom;
            if (typeof resetVoxelStaticCanvas === 'function') {
                resetVoxelStaticCanvas(newRoom.width || 2400, newRoom.height || 1350);
            }
            if (typeof prepareRoomRenderCaches === 'function') {
                prepareRoomRenderCaches(currentRoom, roomNumber);
            }
        }

        // Update enemies array
        Game.enemies = newRoom.enemies;

        // Clear ground loot
        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }

        // Reset player position to spawn point (adjusted for larger rooms)
        if (newRoom.spawnPos) {
            Game.player.x = newRoom.spawnPos.x;
            Game.player.y = newRoom.spawnPos.y;
        } else {
            Game.player.x = 200;
            Game.player.y = currentRoom ? currentRoom.height / 2 : 675;
        }

        // Check if this is a boss room and start intro
        const isBossRoom = newRoom.type === 'boss' && Game.enemies.length > 0 && Game.enemies[0].isBoss;

        if (isBossRoom) {
            const boss = Game.enemies[0];
            // Don't initialize camera here - let the boss intro handle it
            // The boss intro will center camera on boss, then pan to player
            Game.startBossIntro(boss);
        } else {
            // For non-boss rooms, initialize camera on player
            if (Game.camera) {
                Game.camera.x = Game.player.x;
                Game.camera.y = Game.player.y;
            }
        }

        // Update debug panel display
        this.updateDisplay();

        console.log(`[DEBUG] Warped to Room ${roomNumber}${newRoom.type === 'boss' ? ' (BOSS ROOM)' : ''}`);
    },

    // Update panel display with current room info
    updateDisplay() {
        if (!this.panelElement) return;

        const roomDisplay = this.panelElement.querySelector('#debugCurrentRoom');
        if (roomDisplay && typeof Game !== 'undefined') {
            roomDisplay.textContent = Game.roomNumber || 1;
        }

        const scalingEl = this.panelElement.querySelector('#debugScalingFactors');
        if (scalingEl && typeof CombatScaling !== 'undefined' && typeof Game !== 'undefined') {
            const roomType = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.type : 'normal';
            const ctx = CombatScaling.createContext({
                roomNumber: Game.roomNumber || 1,
                roomType,
                gameMode: Game.gameMode || 'gear',
                difficulty: Game.difficulty || 'normal'
            });
            const f = CombatScaling.computeScalingFactors(ctx);
            scalingEl.textContent =
                `HP×${f.roomHp.toFixed(2)} DMG×${f.roomDamage.toFixed(2)} ` +
                `mob×${f.roomMobility.toFixed(2)} tempo×${f.roomTempo.toFixed(3)} ` +
                `intel=${f.intelligence.toFixed(2)} count=${f.enemyCount}`;
        }

        this.updateBossSection();
    },

    getCurrentBoss() {
        if (typeof Game === 'undefined' || !Game.enemies || !Array.isArray(Game.enemies)) {
            return null;
        }

        for (let i = 0; i < Game.enemies.length; i++) {
            const enemy = Game.enemies[i];
            if (enemy && enemy.isBoss) {
                return enemy;
            }
        }

        return null;
    },

    updateBossSection() {
        if (!this.panelElement) return;

        const section = this.panelElement.querySelector('#debugBossSection');
        if (!section) return;

        const boss = this.getCurrentBoss();
        const phaseDisplay = this.panelElement.querySelector('#debugBossPhase');
        const inBossRoom = (
            (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'boss') ||
            (boss && boss.isBoss)
        );

        section.style.display = inBossRoom ? 'block' : 'none';

        const phaseButtons = section.querySelectorAll('.debug-boss-phase-btn');
        phaseButtons.forEach(btn => {
            if (boss) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        });

        if (phaseDisplay) {
            phaseDisplay.textContent = boss && boss.phase ? boss.phase : '-';
        }
    },

    setBossPhase(targetPhase) {
        const boss = this.getCurrentBoss();
        if (!boss) {
            console.warn('[Debug] No boss available for phase control');
            this.updateBossSection();
            return;
        }

        if (![1, 2, 3].includes(targetPhase)) {
            console.warn(`[Debug] Unsupported phase target: ${targetPhase}`);
            return;
        }

        const previousPhase = boss.phase;
        const maxHp = boss.maxHp || 1;
        let newHp = maxHp;

        if (targetPhase === 1) {
            newHp = maxHp;
        } else if (targetPhase === 2) {
            newHp = Math.max(1, Math.floor(maxHp * 0.49));
        } else if (targetPhase === 3) {
            newHp = Math.max(1, Math.floor(maxHp * 0.24));
        }

        boss.hp = Math.min(maxHp, newHp);
        boss.phase = targetPhase;
        boss.lastPhase = targetPhase;

        if (typeof boss.stateTimer !== 'undefined') {
            boss.stateTimer = 0;
        }

        if (typeof boss.onPhaseTransition === 'function' && previousPhase !== targetPhase) {
            boss.onPhaseTransition(previousPhase, targetPhase);
        }

        if (typeof boss.checkPhaseTransition === 'function') {
            boss.checkPhaseTransition();
        }

        if (typeof boss.updateBossUI === 'function') {
            boss.updateBossUI();
        }

        this.updateBossSection();

        const bossName = boss.bossName || 'Boss';
        console.log(`[DEBUG] Forced ${bossName} to Phase ${boss.phase}`);
    },

    // Update display periodically (called from game loop)
    update(deltaTime, processTime, breakdown) {
        if (!this.visible) return;

        const now = Date.now();
        const shouldUpdateDom = now - (this.lastMetricsDomUpdate || 0) >= 200;
        if (!shouldUpdateDom) return;
        this.lastMetricsDomUpdate = now;

        this.updateDisplay();

        if (!this.frameTimes) this.frameTimes = [];
        if (!this.cpuTimes) this.cpuTimes = [];
        if (!this.phaseSamples) this.phaseSamples = {};

        if (typeof deltaTime === 'number' && !isNaN(deltaTime)) {
            const frameTime = deltaTime * 1000;
            if (isFinite(frameTime)) {
                this.frameTimes.push({ time: now, value: frameTime });
                const cutoff = now - 10000;
                while (this.frameTimes.length > 0 && this.frameTimes[0].time < cutoff) {
                    this.frameTimes.shift();
                }
                this.updateMetricUI('debugFt1s', this.calculateAverage(this.frameTimes, now - 1000));
                this.updateMetricUI('debugFt5s', this.calculateAverage(this.frameTimes, now - 5000));
                this.updateMetricUI('debugFt10s', this.calculateAverage(this.frameTimes, now - 10000));
            }
        }

        if (typeof processTime === 'number' && !isNaN(processTime) && isFinite(processTime)) {
            this.cpuTimes.push({ time: now, value: processTime });
            const cutoff = now - 10000;
            while (this.cpuTimes.length > 0 && this.cpuTimes[0].time < cutoff) {
                this.cpuTimes.shift();
            }
            this.updateMetricUI('debugCpu1s', this.calculateAverage(this.cpuTimes, now - 1000));
            this.updateMetricUI('debugCpu5s', this.calculateAverage(this.cpuTimes, now - 5000));
            this.updateMetricUI('debugCpu10s', this.calculateAverage(this.cpuTimes, now - 10000));
        }

        if (breakdown && typeof breakdown === 'object') {
            this.pushPhaseSample('update', breakdown.update, now);
            this.pushPhaseSample('render', breakdown.render, now);
            this.pushPhaseSample('static', breakdown.static, now);
            this.pushPhaseSample('world', breakdown.world, now);
            this.pushPhaseSample('worldGlow', breakdown.worldGlow, now);
            this.pushPhaseSample('worldBodies', breakdown.worldBodies, now);
            this.pushPhaseSample('vignette', breakdown.vignette, now);
            this.pushPhaseSample('postFx', breakdown.postFx, now);
            this.pushPhaseSample('ui', breakdown.ui, now);

            const phaseSum = (breakdown.static || 0) + (breakdown.world || 0) +
                (breakdown.vignette || 0) + (breakdown.postFx || 0) + (breakdown.ui || 0);
            const otherRender = typeof breakdown.render === 'number'
                ? Math.max(0, breakdown.render - phaseSum)
                : 0;
            this.pushPhaseSample('other', otherRender, now);

            this.updatePhaseMetricUI('debugPhaseUpdate', this.getPhaseAverage('update', now));
            this.updatePhaseMetricUI('debugPhaseRender', this.getPhaseAverage('render', now));
            this.updatePhaseMetricUI('debugPhaseStatic', this.getPhaseAverage('static', now));
            this.updatePhaseMetricUI('debugPhaseWorld', this.getPhaseAverage('world', now));
            this.updatePhaseMetricUI('debugPhaseWorldGlow', this.getPhaseAverage('worldGlow', now));
            this.updatePhaseMetricUI('debugPhaseWorldBodies', this.getPhaseAverage('worldBodies', now));
            this.updatePhaseMetricUI('debugPhaseVignette', this.getPhaseAverage('vignette', now));
            this.updatePhaseMetricUI('debugPhasePostFx', this.getPhaseAverage('postFx', now));
            this.updatePhaseMetricUI('debugPhaseUi', this.getPhaseAverage('ui', now));
            this.updatePhaseMetricUI('debugPhaseOther', this.getPhaseAverage('other', now));
            this.updatePhaseTextUI('debugCatchupUpdates', Number.isFinite(breakdown.catchupUpdates) ? breakdown.catchupUpdates.toString() : '-');
            this.updatePhaseTextUI('debugAccumulatorDrop', breakdown.accumulatorTruncated ? 'yes' : 'no');

            const snapshot = breakdown.snapshot;
            if (snapshot) {
                this.updatePhaseTextUI('debugFps', snapshot.fps ? snapshot.fps.toString() : '-');
                this.updatePhaseTextUI('debugQualityTier', snapshot.qualityTier || '-');

                if (snapshot.frameBudget) {
                    this.updatePhaseMetricUI('debugBudgetFrame', snapshot.frameBudget.frameAvg);
                    this.updatePhaseMetricUI('debugBudgetRender', snapshot.frameBudget.renderAvg);
                }

                if (snapshot.counts) {
                    const c = snapshot.counts;
                    const countsEl = this.panelElement.querySelector('#debugSceneCounts');
                    if (countsEl) {
                        countsEl.textContent =
                            `Enemies ${c.enemiesVisible}/${c.enemiesTotal}  ` +
                            `Proj ${c.projectilesVisible}/${c.projectilesTotal}\n` +
                            `Loot ${c.groundLootVisible}/${c.groundLootTotal}  ` +
                            `Items ${c.groundItemsVisible}/${c.groundItemsTotal}`;
                    }
                }

                const sub = snapshot.subTimings || {};
                this.updatePhaseMetricUI('debugRenderGroundLoot', sub.groundLoot);
                this.updatePhaseMetricUI('debugRenderGearRings', sub.gearRings);
                this.updatePhaseMetricUI('debugRenderRemote', sub.remotePlayers);
                this.updatePhaseMetricUI('debugRenderWorldGlow', sub.worldGlow);
                this.updatePhaseMetricUI('debugRenderWorldBodies', sub.worldBodies);
            }
        }

        if (typeof RunProfiler !== 'undefined') {
            this.updateProfileStatusUI();
        }
    },

    pushPhaseSample(key, value, now) {
        if (typeof value !== 'number' || !isFinite(value)) return;
        if (!this.phaseSamples[key]) this.phaseSamples[key] = [];
        this.phaseSamples[key].push({ time: now, value });
        const cutoff = now - 1000;
        const samples = this.phaseSamples[key];
        while (samples.length > 0 && samples[0].time < cutoff) {
            samples.shift();
        }
    },

    getPhaseAverage(key, now) {
        const samples = this.phaseSamples[key];
        if (!samples || samples.length === 0) return 0;
        return this.calculateAverage(samples, now - 1000);
    },

    calculateAverage(data, startTime) {
        let sum = 0;
        let count = 0;
        for (let i = data.length - 1; i >= 0; i--) {
            const entry = data[i];
            if (entry.time < startTime) break;
            sum += entry.value;
            count++;
        }
        return count > 0 ? sum / count : 0;
    },

    updateMetricUI(id, value) {
        const el = this.panelElement.querySelector('#' + id);
        if (el) {
            el.textContent = value.toFixed(1);
            this.colorCodeFrameTime(el, value);
        }
    },

    updatePhaseMetricUI(id, value) {
        const el = this.panelElement.querySelector('#' + id);
        if (!el) return;
        if (typeof value === 'number' && isFinite(value)) {
            el.textContent = `${value.toFixed(1)}ms`;
            this.colorCodeFrameTime(el, value);
        } else {
            el.textContent = '-';
        }
    },

    updatePhaseTextUI(id, value) {
        const el = this.panelElement.querySelector('#' + id);
        if (!el) return;
        el.textContent = value;
        if (id === 'debugAccumulatorDrop') {
            el.style.color = value === 'yes' ? '#ff5555' : '#ffffff';
        } else if (id === 'debugQualityTier') {
            el.style.color = value === 'heavy' ? '#ff5555' : (value === 'medium' ? '#ffaa00' : '#00ff00');
        } else {
            el.style.color = '#ffffff';
        }
    },

    colorCodeFrameTime(element, ms) {
        if (ms < 17) { // > 60 FPS
            element.style.color = '#00ff00';
        } else if (ms < 34) { // > 30 FPS
            element.style.color = '#ffff00';
        } else { // < 30 FPS
            element.style.color = '#ff0000';
        }
    }
};

// Dev console command to drop gear
// Usage: dropGear() - drops a random piece of gear
//        dropGear('weapon', 'purple') - drops a purple weapon
//        dropGear(null, 'orange') - drops a random slot with orange rarity
//        dropGear('accessory') - drops a random rarity accessory
window.dropGear = function (slot = null, tier = null) {
    if (typeof Game === 'undefined' || !Game.player) {
        console.error('[Dev] Game or player not available');
        return null;
    }

    if (typeof generateGear === 'undefined') {
        console.error('[Dev] generateGear function not available');
        return null;
    }

    if (typeof groundLoot === 'undefined') {
        console.error('[Dev] groundLoot array not available');
        return null;
    }

    // Validate slot parameter
    const validSlots = ['weapon', 'armor', 'accessory'];
    if (slot !== null && !validSlots.includes(slot)) {
        console.error(`[Dev] Invalid slot: ${slot}. Valid slots: ${validSlots.join(', ')}`);
        return null;
    }

    // Validate tier parameter
    const validTiers = ['gray', 'green', 'blue', 'purple', 'orange'];
    if (tier !== null && !validTiers.includes(tier)) {
        console.error(`[Dev] Invalid tier: ${tier}. Valid tiers: ${validTiers.join(', ')}`);
        return null;
    }

    // Determine drop position (at player with small offset)
    const offsetX = (Math.random() - 0.5) * 30;
    const offsetY = (Math.random() - 0.5) * 30;
    const dropX = Game.player.x + offsetX;
    const dropY = Game.player.y + offsetY;

    // Clamp to room bounds
    const margin = 50;
    const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
    const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
    const clampedX = Math.max(margin, Math.min(roomWidth - margin, dropX));
    const clampedY = Math.max(margin, Math.min(roomHeight - margin, dropY));

    // Generate gear - keep trying until we get the right slot if specified
    const roomNumber = typeof Game !== 'undefined' ? (Game.roomNumber || 1) : 1;
    let gear;
    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loops

    do {
        if (tier !== null) {
            // Force specific tier
            gear = generateGear(clampedX, clampedY, tier, 'basic');
        } else {
            // Use progressive tier based on room
            gear = generateGear(clampedX, clampedY, roomNumber, 'basic');
        }

        if (!gear) {
            console.error('[Dev] Failed to generate gear');
            return null;
        }

        // If slot specified and doesn't match, try again
        if (slot !== null && gear.slot !== slot) {
            attempts++;
            if (attempts < maxAttempts) {
                gear = null; // Reset to try again
                continue;
            } else {
                // Max attempts reached, manually override slot
                console.warn(`[Dev] Could not generate ${slot} after ${maxAttempts} attempts, overriding slot`);
                // Store original values
                const originalSlot = gear.slot;
                gear.slot = slot;

                // Regenerate affixes for new slot
                if (typeof generateAffixes === 'function') {
                    gear.affixes = generateAffixes(gear.tier, slot);
                }

                // Handle weapon/armor type and stats regeneration
                if (slot === 'weapon') {
                    gear.armorType = null;
                    if (typeof WEAPON_TYPES !== 'undefined') {
                        const types = Object.keys(WEAPON_TYPES);
                        gear.weaponType = types[Math.floor(Math.random() * types.length)];

                        // Regenerate weapon stats
                        const scaling = (typeof getGearScaling === 'function') ? getGearScaling(roomNumber) : 1;
                        const range = (typeof FLAT_STAT_RANGES !== 'undefined' &&
                            FLAT_STAT_RANGES.weapon &&
                            FLAT_STAT_RANGES.weapon.damage &&
                            FLAT_STAT_RANGES.weapon.damage[gear.tier])
                            ? FLAT_STAT_RANGES.weapon.damage[gear.tier]
                            : { min: 2, max: 4 };
                        const baseDamage = range.min + Math.random() * (range.max - range.min);
                        const typeMultiplier = WEAPON_TYPES[gear.weaponType].damageMultiplier || 1.0;
                        gear.stats = { damage: baseDamage * scaling * typeMultiplier };
                    }
                } else if (slot === 'armor') {
                    gear.weaponType = null;
                    if (typeof ARMOR_TYPES !== 'undefined') {
                        const types = Object.keys(ARMOR_TYPES);
                        gear.armorType = types[Math.floor(Math.random() * types.length)];

                        // Regenerate armor stats
                        const scaling = (typeof getGearScaling === 'function') ? getGearScaling(roomNumber) : 1;
                        const range = (typeof FLAT_STAT_RANGES !== 'undefined' &&
                            FLAT_STAT_RANGES.armor &&
                            FLAT_STAT_RANGES.armor.defense &&
                            FLAT_STAT_RANGES.armor.defense[gear.tier])
                            ? FLAT_STAT_RANGES.armor.defense[gear.tier]
                            : { min: 0.02, max: 0.04 };
                        const baseDefense = range.min + Math.random() * (range.max - range.min);
                        const typeMultiplier = ARMOR_TYPES[gear.armorType].defenseMultiplier || 1.0;
                        gear.stats = { defense: baseDefense * scaling * typeMultiplier };
                    }
                } else if (slot === 'accessory') {
                    gear.weaponType = null;
                    gear.armorType = null;
                    const tierBonus = (typeof TIER_BONUSES !== 'undefined') ? (TIER_BONUSES[gear.tier] || 0) : 0;
                    const minBonus = 0.05;
                    const effectiveBonus = tierBonus > 0 ? tierBonus : minBonus;
                    gear.stats = { speed: effectiveBonus * 0.5 };
                }

                // Regenerate name with new slot
                if (typeof generateGearName === 'function') {
                    gear.name = generateGearName(gear.tier, gear.slot, gear.affixes || []);
                }
                break; // Exit the do-while loop
            }
        } else {
            // Slot matches or wasn't specified, use gear as-is
            break;
        }
    } while (!gear || (slot !== null && gear.slot !== slot));

    if (!gear) {
        console.error('[Dev] Failed to generate gear after all attempts');
        return null;
    }

    // Add to ground loot
    if (typeof ensureGearDropMetadata === 'function') {
        ensureGearDropMetadata(gear);
    }
    groundLoot.push(gear);

    // Sync to window if available
    if (typeof window !== 'undefined' && window.groundLoot) {
        window.groundLoot = groundLoot;
    }

    // Log result
    const slotName = gear.slot ? gear.slot.charAt(0).toUpperCase() + gear.slot.slice(1) : 'Unknown';
    const tierName = gear.tier ? gear.tier.toUpperCase() : 'Unknown';
    let typeInfo = '';
    if (gear.weaponType && typeof WEAPON_TYPES !== 'undefined' && WEAPON_TYPES[gear.weaponType]) {
        typeInfo = ` (${WEAPON_TYPES[gear.weaponType].name})`;
    } else if (gear.armorType && typeof ARMOR_TYPES !== 'undefined' && ARMOR_TYPES[gear.armorType]) {
        typeInfo = ` (${ARMOR_TYPES[gear.armorType].name})`;
    }
    console.log(`[Dev] Dropped ${tierName} ${slotName}${typeInfo} at (${clampedX.toFixed(1)}, ${clampedY.toFixed(1)})`);

    return gear;
};

// Flood room with mixed-tier gear for render perf testing
// Usage: floodGroundLoot() or floodGroundLoot(30)
window.floodGroundLoot = function (count = 24) {
    if (typeof Game === 'undefined' || !Game.player) {
        console.error('[Dev] Game or player not available');
        return;
    }
    if (typeof generateGear !== 'function' || typeof groundLoot === 'undefined') {
        console.error('[Dev] generateGear or groundLoot not available');
        return;
    }
    const tiers = ['gray', 'green', 'blue', 'purple', 'orange'];
    const roomNum = Game.roomNumber || 1;
    let spawned = 0;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const radius = 80 + (i % 5) * 35;
        const x = Game.player.x + Math.cos(angle) * radius;
        const y = Game.player.y + Math.sin(angle) * radius;
        const tier = tiers[i % tiers.length];
        const gear = generateGear(x, y, tier);
        if (gear) {
            if (typeof ensureGearDropMetadata === 'function') {
                ensureGearDropMetadata(gear);
            }
            groundLoot.push(gear);
            spawned++;
        }
    }
    console.log(`[Dev] Flooded ${spawned} ground gear items around player (render perf test)`);
    return spawned;
};

// Auto-initialize when page loads
window.addEventListener('load', () => {
    DebugPanel.init();

    // Expose to global scope for console access
    window.DebugPanel = DebugPanel;
    window.DebugFlags = DebugFlags;
    console.log('Debug Panel initialized. Use DebugPanel.toggle() or Ctrl+D to open/close.');
    console.log('Debug Flags available: Use DebugFlags.enable("DAMAGE_NUMBERS") to toggle verbose logging.');
    console.log('Drop gear commands: dropGear(), dropGear("weapon", "purple"), dropGear(null, "orange")');
    console.log('Render perf test: floodGroundLoot() or floodGroundLoot(30)');
    console.log('Open debug panel (Ctrl+D) for live metrics; enable "Metrics When Hidden" to sample with panel closed');
    console.log('Run profiler: RunProfiler.start(), RunProfiler.exportJson(), RunProfiler.getSummaryText()');
    console.log('Enable "Auto-start on run" in debug panel to profile full runs automatically');
});


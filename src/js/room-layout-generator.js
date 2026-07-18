// Deterministic room-scale layout generation and grid collision helpers.
(function () {
    const BASE_CROSS_WIDTH = 2400;
    const BASE_CROSS_HEIGHT = 1350;
    const ROUTE_PAD_LEFT_RIGHT = 280;
    const ROUTE_PAD_TOP_BOTTOM = 320;
    const ROUTE_PAD_DIAGONAL = 400;
    const BASELINE_DIAGONAL_TRAVEL = Math.sqrt(
        Math.pow(BASE_CROSS_WIDTH - ROUTE_PAD_DIAGONAL, 2) +
        Math.pow(BASE_CROSS_HEIGHT - ROUTE_PAD_DIAGONAL, 2)
    );
    const LAYOUT_VERSION = 5;
    const ARCHETYPE_SIZE = {
        road: { widthMul: 1.0, heightMul: 1.0 },
        wilds: { widthMul: 1.0, heightMul: 1.0 },
        gauntlet: { widthMul: 1.25, heightMul: 1200 / 1350 },
        arena: { widthMul: 2800 / 2400, heightMul: 1575 / 1350 },
        maze: { widthMul: 1.0, heightMul: 1.0 },
        crossroads: { widthMul: 1.2, heightMul: 1.2 },
        boss: { widthMul: 2600 / 2400, heightMul: 1462 / 1350 }
    };
    const DETOUR_MERGE_T_ORDER = [0.58, 0.56, 0.60, 0.54, 0.62, 0.55, 0.64, 0.65];
    const DEFAULT_CELL_SIZE = 60;
    const PLAYER_SPAWN_PROTECTION_PAD = 420;
    const CELL_COLLISION_INSET = 4;
    const CELL_COLLISION_RADIUS_SCALE = {
        swarm: 0.53,
        prism: 0.48,
        fractal: 0.48,
        vortex: 0.48,
        endless: 0.48
    };
    const WALKABLE = 0;
    const BLOCKED = 1;

    function hashString(value) {
        let hash = 2166136261;
        const text = String(value);
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function createRng(seed) {
        let state = hashString(seed) || 1;
        return function rng() {
            state ^= state << 13;
            state ^= state >>> 17;
            state ^= state << 5;
            return (state >>> 0) / 4294967296;
        };
    }

    function randomInt(rng, min, max) {
        return Math.floor(rng() * (max - min + 1)) + min;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function roundPoint(point) {
        return {
            x: Math.round(point.x),
            y: Math.round(point.y)
        };
    }

    function getSceneryKit(plan) {
        const biome = plan && plan.biome ? plan.biome : null;
        return (biome && biome.scenery) || {
            roadType: 'wornPath',
            roadColor: 'rgba(255, 255, 255, 0.14)',
            landmarkTypes: ['relic'],
            decorationProfile: 'defaultDust',
            decorationTypes: ['scrap'],
            structureDensity: 0.65
        };
    }

    function pickArchetype(plan, rng) {
        if (!plan) return 'road';
        if (plan.roomType === 'boss') return 'arena';
        if (plan.roomType !== 'normal') return 'road';
        if (plan.roomNumber === 1) return 'road';
        if (plan.roomNumber > 20 && plan.roomNumber % 2 === 1) return 'wilds';

        const roll = rng();
        const roomNumber = plan.roomNumber;
        if (roomNumber <= 5) {
            return roll < 0.85 ? 'road' : 'gauntlet';
        }
        if (roomNumber <= 10) {
            if (roll < 0.5) return 'road';
            if (roll < 0.75) return 'gauntlet';
            return 'maze';
        }
        if (roomNumber <= 20) {
            if (roll < 0.35) return 'road';
            if (roll < 0.55) return 'gauntlet';
            if (roll < 0.75) return 'maze';
            if (roll < 0.9) return 'arena';
            return 'crossroads';
        }
        if (roll < 0.2) return 'wilds';
        if (roll < 0.35) return 'road';
        if (roll < 0.5) return 'gauntlet';
        if (roll < 0.65) return 'maze';
        if (roll < 0.8) return 'arena';
        return 'crossroads';
    }

    function getLateGameScale(roomNumber) {
        // Late-game size growth starts after Twin Prism (room 20), i.e. fortress biome onward
        if (!roomNumber || roomNumber <= 20) return 1;
        return 1 + Math.min(0.1, (roomNumber - 20) / 200);
    }

    function applyArchetypeSize(width, height, archetype, roomNumber, roomType) {
        const effectiveArch = roomType === 'boss' ? 'boss' : (archetype || 'road');
        const mul = ARCHETYPE_SIZE[effectiveArch] || ARCHETYPE_SIZE.road;
        const late = getLateGameScale(roomNumber);
        const scaleW = (mul.widthMul * late * BASE_CROSS_WIDTH) / BASE_CROSS_WIDTH;
        const scaleH = (mul.heightMul * late * BASE_CROSS_HEIGHT) / BASE_CROSS_HEIGHT;
        return {
            width: Math.round(width * scaleW),
            height: Math.round(height * scaleH)
        };
    }

    function getContentLimits(width, height, archetype) {
        const baseArea = BASE_CROSS_WIDTH * BASE_CROSS_HEIGHT;
        const scale = Math.sqrt((width * height) / baseArea);
        const base = { decorations: 90, fixtures: 36, landmarks: 3, offshoots: 2 };
        const densityMul = {
            road: 1.0,
            wilds: 1.15,
            gauntlet: 1.3,
            arena: 0.8,
            maze: 1.4,
            crossroads: 1.1,
            boss: 0.7
        };
        const mul = densityMul[archetype] || 1.0;
        return {
            decorations: Math.min(Math.round(base.decorations * scale * mul), 180),
            fixtures: Math.min(Math.round(base.fixtures * scale * mul), 72),
            landmarks: Math.round(base.landmarks * Math.min(scale, 1.5)),
            offshoots: Math.round(base.offshoots * Math.min(scale, 1.5))
        };
    }

    function buildRoomPlan(roomNumber, gameMode, roomType, modifiers) {
        const mode = gameMode || 'gear';
        const type = roomType || 'normal';
        const biomeConfig = typeof BiomeConfig !== 'undefined' ? BiomeConfig : null;
        const biomeId = type === 'safe' ? 'safe' : (biomeConfig ? biomeConfig.getBiomeIdForRoom(roomNumber, mode) : 'swarm');
        const biome = biomeConfig ? biomeConfig.getBiomeDefinition(biomeId) : { id: biomeId, bossTheme: biomeId, layoutStrategy: 'cellular', generation: {} };
        const archetypeRng = createRng(`${mode}:${roomNumber}:${type}:${biomeId}:archetype`);
        const archetype = pickArchetype({ roomNumber, gameMode: mode, roomType: type }, archetypeRng);
        const dimensions = getRoomDimensions(roomNumber, mode, type, archetype);
        return {
            roomNumber,
            gameMode: mode,
            roomType: type,
            biomeId,
            bossTheme: biome.bossTheme || biomeId,
            layoutStrategy: biome.layoutStrategy || 'cellular',
            biome,
            modifiers: modifiers || null,
            archetype,
            routeTravelLength: dimensions.routeTravelLength,
            width: dimensions.width,
            height: dimensions.height,
            cellSize: DEFAULT_CELL_SIZE,
            layoutVersion: LAYOUT_VERSION
        };
    }

    function getPreBossLastRoom(gameMode) {
        return 9;
    }

    function getRouteTravelLength(roomNumber, gameMode, roomType) {
        const type = roomType || 'normal';
        if (type === 'boss' || type === 'safe' || type === 'treasure' || type === 'rest') {
            return BASE_CROSS_WIDTH - ROUTE_PAD_LEFT_RIGHT;
        }
        const preBossLast = getPreBossLastRoom(gameMode || 'gear');
        if (roomNumber <= preBossLast) {
            if (roomNumber <= 3) return 2080;
            if (roomNumber <= 6) return 2520;
            return 2920;
        }
        const within = ((roomNumber - 1) % 10) + 1;
        if (within <= 3) return BASE_CROSS_WIDTH - ROUTE_PAD_LEFT_RIGHT;
        if (within <= 6) return 2580;
        return 2920;
    }

    function getRoomDimensions(roomNumber, gameMode, roomType, archetype) {
        if (roomType === 'safe') {
            // Compact 16:9 hub - sized to fit typical landscape viewports at desktop zoom
            return {
                width: 1600,
                height: 900,
                routeTravelLength: 1320
            };
        }
        const effectiveArch = roomType === 'boss' ? 'boss' : (archetype || 'road');
        const mul = ARCHETYPE_SIZE[effectiveArch] || ARCHETYPE_SIZE.road;
        const late = getLateGameScale(roomNumber);
        return {
            width: Math.round(BASE_CROSS_WIDTH * mul.widthMul * late),
            height: Math.round(BASE_CROSS_HEIGHT * mul.heightMul * late),
            routeTravelLength: getRouteTravelLength(roomNumber, gameMode, roomType)
        };
    }

    function pickEntranceVariantId(plan, seed) {
        if (!plan || plan.roomType !== 'normal') {
            return 'leftRight';
        }
        const variants = ['leftRight', 'topBottom', 'diagonalTopLeft'];
        return variants[hashString(`${seed}:entrance`) % variants.length];
    }

    function resolveRoomDimensionsForVariant(entranceVariantId, travelLength) {
        const routeLength = Math.max(1600, travelLength);
        if (entranceVariantId === 'leftRight') {
            return {
                width: Math.round(routeLength + ROUTE_PAD_LEFT_RIGHT),
                height: BASE_CROSS_HEIGHT
            };
        }
        if (entranceVariantId === 'topBottom') {
            return {
                width: BASE_CROSS_WIDTH,
                height: Math.round(routeLength + ROUTE_PAD_TOP_BOTTOM)
            };
        }
        const scale = routeLength / BASELINE_DIAGONAL_TRAVEL;
        return {
            width: Math.round(BASE_CROSS_WIDTH * scale),
            height: Math.round(BASE_CROSS_HEIGHT * scale)
        };
    }

    function buildEntranceVariant(id, width, height) {
        const variants = {
            leftRight: {
                id: 'leftRight',
                spawnZone: { x: 140, y: height / 2, radius: 260 },
                exitZone: { x: width - 120, y: height / 2, radius: 260 }
            },
            topBottom: {
                id: 'topBottom',
                spawnZone: { x: width / 2, y: 150, radius: 250 },
                exitZone: { x: width / 2, y: height - 170, radius: 260 }
            },
            diagonalTopLeft: {
                id: 'diagonalTopLeft',
                spawnZone: { x: 220, y: 220, radius: 260 },
                exitZone: { x: width - 180, y: height - 180, radius: 260 }
            }
        };
        return variants[id] || variants.leftRight;
    }

    function createEmptyGrid(cols, rows, value) {
        return new Array(cols * rows).fill(value);
    }

    function index(layout, col, row) {
        return row * layout.cols + col;
    }

    function inGrid(layout, col, row) {
        return col >= 0 && row >= 0 && col < layout.cols && row < layout.rows;
    }

    function setCell(layout, col, row, value) {
        if (inGrid(layout, col, row)) {
            layout.grid[index(layout, col, row)] = value;
        }
    }

    function getCell(layout, col, row) {
        if (!inGrid(layout, col, row)) return BLOCKED;
        return layout.grid[index(layout, col, row)];
    }

    function worldToCell(layout, x, y) {
        return {
            col: Math.max(0, Math.min(layout.cols - 1, Math.floor(x / layout.cellSize))),
            row: Math.max(0, Math.min(layout.rows - 1, Math.floor(y / layout.cellSize)))
        };
    }

    function cellCenter(layout, col, row) {
        return {
            x: col * layout.cellSize + layout.cellSize / 2,
            y: row * layout.cellSize + layout.cellSize / 2
        };
    }

    function reserveZones(layout) {
        const zones = [
            layout.spawnZone,
            layout.exitZone,
            { x: layout.width / 2, y: layout.height / 2, radius: layout.roomType === 'boss' ? 360 : 180 }
        ];

        zones.forEach(zone => {
            const min = worldToCell(layout, zone.x - zone.radius, zone.y - zone.radius);
            const max = worldToCell(layout, zone.x + zone.radius, zone.y + zone.radius);
            for (let row = min.row; row <= max.row; row++) {
                for (let col = min.col; col <= max.col; col++) {
                    const center = cellCenter(layout, col, row);
                    const dx = center.x - zone.x;
                    const dy = center.y - zone.y;
                    if (Math.sqrt(dx * dx + dy * dy) <= zone.radius) {
                        setCell(layout, col, row, WALKABLE);
                    }
                }
            }
        });
    }

    function makeBaseLayout(plan, seed) {
        const cellSize = plan.cellSize || DEFAULT_CELL_SIZE;
        const archetype = plan.archetype || pickArchetype(plan, createRng(`${seed}:archetype`));
        let width;
        let height;
        let entranceVariantId;
        // Safe rooms use fixed plan dimensions - do not rebuild via route/archetype sizing
        // (that path forced ~1880x1350 and looked tall/narrow on landscape displays)
        if (plan.roomType === 'safe' && plan.width && plan.height) {
            width = plan.width;
            height = plan.height;
            entranceVariantId = 'leftRight';
        } else {
            const travelLength = plan.routeTravelLength != null
                ? plan.routeTravelLength
                : getRouteTravelLength(plan.roomNumber, plan.gameMode, plan.roomType);
            entranceVariantId = pickEntranceVariantId(plan, seed);
            const resolved = resolveRoomDimensionsForVariant(entranceVariantId, travelLength);
            const sized = applyArchetypeSize(resolved.width, resolved.height, archetype, plan.roomNumber, plan.roomType);
            width = sized.width;
            height = sized.height;
        }
        const entranceVariant = buildEntranceVariant(entranceVariantId, width, height);
        const cols = Math.ceil(width / cellSize);
        const rows = Math.ceil(height / cellSize);
        return {
            layoutVersion: LAYOUT_VERSION,
            seed,
            biomeId: plan.biomeId,
            bossTheme: plan.bossTheme,
            roomType: plan.roomType,
            roomNumber: plan.roomNumber,
            strategy: plan.layoutStrategy,
            archetype,
            wilds: archetype === 'wilds',
            entranceVariant: entranceVariant.id,
            width,
            height,
            cellSize,
            cols,
            rows,
            grid: createEmptyGrid(cols, rows, WALKABLE),
            obstacles: [],
            visualMotifs: [],
            paths: [],
            landmarks: [],
            encounterZones: [],
            decorationSeed: `${seed}:decorations`,
            decorationProfile: getSceneryKit(plan).decorationProfile || 'defaultDust',
            spawnZone: entranceVariant.spawnZone,
            exitZone: entranceVariant.exitZone,
            generatedByFallback: false,
            validation: null,
            hash: null
        };
    }

    function chooseEntranceVariant(plan, seed, width, height) {
        const id = pickEntranceVariantId(plan, seed);
        return buildEntranceVariant(id, width, height);
    }

    function getCellCollisionInset(layout) {
        const cellSize = layout.cellSize || DEFAULT_CELL_SIZE;
        return Math.max(CELL_COLLISION_INSET, cellSize * 0.067);
    }

    function getCellCollisionShape(layout, col, row) {
        const cellSize = layout.cellSize || DEFAULT_CELL_SIZE;
        const center = cellCenter(layout, col, row);
        const radiusScale = CELL_COLLISION_RADIUS_SCALE[layout.biomeId];
        if (radiusScale) {
            return {
                type: 'circle',
                x: center.x,
                y: center.y,
                radius: cellSize * radiusScale
            };
        }

        const inset = getCellCollisionInset(layout);
        return {
            type: 'rect',
            x: col * cellSize + inset,
            y: row * cellSize + inset,
            width: Math.max(1, cellSize - inset * 2),
            height: Math.max(1, cellSize - inset * 2)
        };
    }

    function circleIntersectsCollisionShape(x, y, radius, shape) {
        if (!shape) return false;
        const r = radius || 0;
        if (shape.type === 'circle') {
            const dx = x - shape.x;
            const dy = y - shape.y;
            const limit = r + shape.radius;
            return (dx * dx + dy * dy) <= limit * limit;
        }

        const closestX = clamp(x, shape.x, shape.x + shape.width);
        const closestY = clamp(y, shape.y, shape.y + shape.height);
        const dx = x - closestX;
        const dy = y - closestY;
        return (dx * dx + dy * dy) <= r * r;
    }

    function isCircleBlockedAt(layout, x, y, radius) {
        if (!layout || !layout.grid) return false;
        const r = radius || 0;
        if (x - r < 0 || y - r < 0 || x + r > layout.width || y + r > layout.height) return true;
        const min = worldToCell(layout, x - r, y - r);
        const max = worldToCell(layout, x + r, y + r);
        for (let row = min.row; row <= max.row; row++) {
            for (let col = min.col; col <= max.col; col++) {
                if (getCell(layout, col, row) !== BLOCKED) continue;
                if (circleIntersectsCollisionShape(x, y, r, getCellCollisionShape(layout, col, row))) {
                    return true;
                }
            }
        }
        return false;
    }

    function addObstacle(layout, obstacle) {
        const withDefaults = Object.assign({
            preset: 'solid',
            blocksMovement: true,
            blocksProjectiles: true,
            destructible: false,
            pierceable: false,
            exceptionReason: null
        }, obstacle);
        layout.obstacles.push(withDefaults);
    }

    function stampRect(layout, x, y, w, h, options) {
        const shrink = layout.cellSize * 0.05;
        const sx = x + shrink;
        const sy = y + shrink;
        const sw = Math.max(0, w - shrink * 2);
        const sh = Math.max(0, h - shrink * 2);
        const min = worldToCell(layout, sx, sy);
        const max = worldToCell(layout, sx + sw, sy + sh);
        for (let row = min.row; row <= max.row; row++) {
            for (let col = min.col; col <= max.col; col++) {
                const center = cellCenter(layout, col, row);
                if (center.x >= sx && center.x <= sx + sw && center.y >= sy && center.y <= sy + sh) {
                    setCell(layout, col, row, BLOCKED);
                }
            }
        }
        addObstacle(layout, Object.assign({ shape: 'rect', x, y, width: w, height: h }, options || {}));
    }

    function stampCircle(layout, x, y, radius, options) {
        const collisionRadius = radius * 0.94;
        const min = worldToCell(layout, x - collisionRadius, y - collisionRadius);
        const max = worldToCell(layout, x + collisionRadius, y + collisionRadius);
        for (let row = min.row; row <= max.row; row++) {
            for (let col = min.col; col <= max.col; col++) {
                const center = cellCenter(layout, col, row);
                const dx = center.x - x;
                const dy = center.y - y;
                if (Math.sqrt(dx * dx + dy * dy) <= collisionRadius) {
                    setCell(layout, col, row, BLOCKED);
                }
            }
        }
        addObstacle(layout, Object.assign({ shape: 'circle', x, y, radius }, options || {}));
    }

    function stampDiamond(layout, x, y, radius, options) {
        const collisionRadius = radius * 0.94;
        const min = worldToCell(layout, x - collisionRadius, y - collisionRadius);
        const max = worldToCell(layout, x + collisionRadius, y + collisionRadius);
        for (let row = min.row; row <= max.row; row++) {
            for (let col = min.col; col <= max.col; col++) {
                const center = cellCenter(layout, col, row);
                if (Math.abs(center.x - x) + Math.abs(center.y - y) <= collisionRadius) {
                    setCell(layout, col, row, BLOCKED);
                }
            }
        }
        addObstacle(layout, Object.assign({ shape: 'diamond', x, y, radius }, options || {}));
    }

    function stampHiveStructure(layout, x, y, scale, options) {
        const radius = layout.cellSize * scale;
        stampCircle(layout, x, y, radius * 1.02, Object.assign({ preset: 'solid', motif: 'hiveCore', structure: 'hive' }, options || {}));
        const lobes = 6;
        for (let i = 0; i < lobes; i++) {
            const angle = (Math.PI * 2 * i) / lobes;
            stampCircle(
                layout,
                x + Math.cos(angle) * radius * 1.05,
                y + Math.sin(angle) * radius * 0.8,
                radius * 0.58,
                Object.assign({ preset: 'solid', motif: 'hiveCell', structure: 'hive' }, options || {})
            );
        }
    }

    function stampCrystalStructure(layout, x, y, scale, options) {
        const radius = layout.cellSize * scale;
        stampDiamond(layout, x, y, radius * 1.28, Object.assign({ preset: 'solid', motif: 'crystalCore', structure: 'crystal' }, options || {}));
        stampDiamond(layout, x - radius * 1.1, y + radius * 0.35, radius * 0.68, Object.assign({ preset: 'solid', motif: 'crystalShard', structure: 'crystal' }, options || {}));
        stampDiamond(layout, x + radius * 1.1, y - radius * 0.35, radius * 0.68, Object.assign({ preset: 'solid', motif: 'crystalShard', structure: 'crystal' }, options || {}));
        stampRect(layout, x - radius * 1.45, y - layout.cellSize * 0.32, radius * 2.9, layout.cellSize * 0.64, Object.assign({ preset: 'solid', motif: 'crystalBase', structure: 'crystal' }, options || {}));
    }

    function stampFortressStructure(layout, x, y, widthCells, heightCells, options) {
        const w = widthCells * layout.cellSize;
        const h = heightCells * layout.cellSize;
        const tower = layout.cellSize * 1.25;
        stampRect(layout, x - w / 2, y - h / 2, w, h, Object.assign({ preset: 'solid', motif: 'fortressBlock', structure: 'fortress' }, options || {}));
        stampRect(layout, x - w / 2 - tower * 0.4, y - h / 2 - tower * 0.4, tower, tower, Object.assign({ preset: 'solid', motif: 'fortressTower', structure: 'fortress' }, options || {}));
        stampRect(layout, x + w / 2 - tower * 0.6, y - h / 2 - tower * 0.4, tower, tower, Object.assign({ preset: 'solid', motif: 'fortressTower', structure: 'fortress' }, options || {}));
        stampRect(layout, x - w / 2 - tower * 0.4, y + h / 2 - tower * 0.6, tower, tower, Object.assign({ preset: 'solid', motif: 'fortressTower', structure: 'fortress' }, options || {}));
        stampRect(layout, x + w / 2 - tower * 0.6, y + h / 2 - tower * 0.6, tower, tower, Object.assign({ preset: 'solid', motif: 'fortressTower', structure: 'fortress' }, options || {}));
    }

    function stampFractalStructure(layout, x, y, scale, options) {
        const radius = layout.cellSize * scale;
        stampDiamond(layout, x, y, radius * 1.32, Object.assign({ preset: 'solid', motif: 'fractalCore', structure: 'fractal' }, options || {}));
        const children = [
            { x: -1, y: -0.65, s: 0.75 },
            { x: 1, y: -0.65, s: 0.75 },
            { x: -1, y: 0.65, s: 0.6 },
            { x: 1, y: 0.65, s: 0.6 }
        ];
        children.forEach(child => {
            stampDiamond(layout, x + child.x * radius * 1.25, y + child.y * radius, radius * child.s, Object.assign({ preset: 'solid', motif: 'fractalChild', structure: 'fractal' }, options || {}));
        });
    }

    function stampVortexStructure(layout, x, y, scale, options) {
        const radius = layout.cellSize * scale;
        stampCircle(layout, x, y, radius * 0.9, Object.assign({ preset: 'solid', motif: 'vortexCore', structure: 'vortex' }, options || {}));
        for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 * i) / 3;
            stampCircle(
                layout,
                x + Math.cos(angle) * radius * 1.15,
                y + Math.sin(angle) * radius * 0.9,
                radius * 0.45,
                Object.assign({ preset: 'solid', motif: 'vortexSatellite', structure: 'vortex' }, options || {})
            );
        }
    }

    function clearCircle(layout, x, y, radius) {
        const min = worldToCell(layout, x - radius, y - radius);
        const max = worldToCell(layout, x + radius, y + radius);
        for (let row = min.row; row <= max.row; row++) {
            for (let col = min.col; col <= max.col; col++) {
                const center = cellCenter(layout, col, row);
                const dx = center.x - x;
                const dy = center.y - y;
                if (Math.sqrt(dx * dx + dy * dy) <= radius) {
                    setCell(layout, col, row, WALKABLE);
                }
            }
        }
    }

    function clearRect(layout, x, y, w, h) {
        const min = worldToCell(layout, x, y);
        const max = worldToCell(layout, x + w, y + h);
        for (let row = min.row; row <= max.row; row++) {
            for (let col = min.col; col <= max.col; col++) {
                setCell(layout, col, row, WALKABLE);
            }
        }
    }

    function addPath(layout, path) {
        const withDefaults = Object.assign({
            id: `path-${layout.paths.length + 1}`,
            type: 'road',
            width: layout.cellSize * 2.4,
            points: []
        }, path || {});
        withDefaults.points = withDefaults.points.map(roundPoint);
        layout.paths.push(withDefaults);
        return withDefaults;
    }

    function addLandmark(layout, landmark) {
        const withDefaults = Object.assign({
            id: `landmark-${layout.landmarks.length + 1}`,
            type: 'relic',
            x: layout.width / 2,
            y: layout.height / 2,
            radius: layout.cellSize * 1.8,
            blocksMovement: true,
            footprint: null,
            accessPathId: null
        }, landmark || {});
        withDefaults.x = Math.round(withDefaults.x);
        withDefaults.y = Math.round(withDefaults.y);
        withDefaults.radius = Math.round(withDefaults.radius);
        if (withDefaults.footprint) {
            withDefaults.footprint = Object.assign({}, withDefaults.footprint, {
                x: Math.round(withDefaults.footprint.x || withDefaults.x),
                y: Math.round(withDefaults.footprint.y || withDefaults.y),
                width: Math.round(withDefaults.footprint.width || withDefaults.radius * 2),
                height: Math.round(withDefaults.footprint.height || withDefaults.radius * 1.4),
                rotation: withDefaults.footprint.rotation || 0
            });
        }
        layout.landmarks.push(withDefaults);
        return withDefaults;
    }

    function addEncounterZone(layout, zone) {
        const withDefaults = Object.assign({
            id: `encounter-${layout.encounterZones.length + 1}`,
            type: 'roadside',
            x: layout.width / 2,
            y: layout.height / 2,
            radius: layout.cellSize * 3
        }, zone || {});
        withDefaults.x = Math.round(withDefaults.x);
        withDefaults.y = Math.round(withDefaults.y);
        withDefaults.radius = Math.round(withDefaults.radius);
        layout.encounterZones.push(withDefaults);
        return withDefaults;
    }

    function carvePathSegment(layout, from, to, width) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.ceil(distance / Math.max(18, layout.cellSize / 2)));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            clearCircle(layout, from.x + dx * t, from.y + dy * t, width / 2);
        }
    }

    function carvePath(layout, path) {
        for (let i = 0; i < path.points.length - 1; i++) {
            carvePathSegment(layout, path.points[i], path.points[i + 1], path.width);
        }
    }

    function pointOnPolyline(points, t) {
        const segments = [];
        let total = 0;
        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            segments.push({ from, to, dx, dy, length });
            total += length;
        }

        let remaining = total * clamp(t, 0, 1);
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (remaining <= segment.length || i === segments.length - 1) {
                const localT = segment.length > 0 ? remaining / segment.length : 0;
                const length = segment.length || 1;
                return {
                    x: segment.from.x + segment.dx * localT,
                    y: segment.from.y + segment.dy * localT,
                    normalX: -segment.dy / length,
                    normalY: segment.dx / length
                };
            }
            remaining -= segment.length;
        }

        return {
            x: points[0].x,
            y: points[0].y,
            normalX: 0,
            normalY: 1
        };
    }

    function polylineLength(points) {
        if (!points || points.length < 2) return 0;
        let total = 0;
        for (let i = 0; i < points.length - 1; i++) {
            const dx = points[i + 1].x - points[i].x;
            const dy = points[i + 1].y - points[i].y;
            total += Math.sqrt(dx * dx + dy * dy);
        }
        return total;
    }

    function distanceToPolyline(points, x, y) {
        if (!points || points.length < 2) return Infinity;
        let best = Infinity;
        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const lengthSq = dx * dx + dy * dy;
            const localT = lengthSq > 0
                ? clamp(((x - from.x) * dx + (y - from.y) * dy) / lengthSq, 0, 1)
                : 0;
            const px = from.x + dx * localT;
            const py = from.y + dy * localT;
            const distSq = (x - px) * (x - px) + (y - py) * (y - py);
            if (distSq < best) best = distSq;
        }
        return Math.sqrt(best);
    }

    function isPathSeparatedFromPolyline(pathPoints, mainPoints, minClearance) {
        if (!pathPoints || !mainPoints || pathPoints.length < 2) return true;
        const clearance = minClearance || 0;
        for (let i = 0; i < pathPoints.length; i++) {
            if (distanceToPolyline(mainPoints, pathPoints[i].x, pathPoints[i].y) < clearance) {
                return false;
            }
        }
        return true;
    }

    function getMainRoadClearance(layout, mainRoad) {
        const roadWidth = (mainRoad && mainRoad.width) || layout.cellSize * 2;
        return roadWidth * 0.85 + layout.cellSize;
    }

    function isValidDetourMergePoint(layout, point) {
        const walkable = isPointWalkable(layout, point.x, point.y, 60);
        const notSpawn = !isInsidePlayerSpawnProtection(layout, point.x, point.y, 0);
        const landmarks = Array.isArray(layout.landmarks) ? layout.landmarks : [];
        const notLandmark = !landmarks.some(lm => {
            const dx = point.x - lm.x;
            const dy = point.y - lm.y;
            return Math.sqrt(dx * dx + dy * dy) < (lm.radius || layout.cellSize * 2) + 60;
        });
        return walkable && notSpawn && notLandmark;
    }

    function findDetourMergeT(mainRoad, layout) {
        if (!mainRoad || !mainRoad.points) return null;
        for (let i = 0; i < DETOUR_MERGE_T_ORDER.length; i++) {
            const t = DETOUR_MERGE_T_ORDER[i];
            const mergePoint = pointOnPolyline(mainRoad.points, t);
            if (isValidDetourMergePoint(layout, mergePoint)) {
                return { t, mergePoint };
            }
        }
        return null;
    }

    function getPlayerSpawnProtectionDistance(layout, extraPad) {
        const spawn = layout && layout.spawnZone ? layout.spawnZone : null;
        const pad = extraPad != null ? extraPad : PLAYER_SPAWN_PROTECTION_PAD;
        return (spawn && spawn.radius ? spawn.radius : 260) + pad;
    }

    function isInsidePlayerSpawnProtection(layout, x, y, extraMargin) {
        if (!layout || !layout.spawnZone) return false;
        const spawn = layout.spawnZone;
        const dx = x - spawn.x;
        const dy = y - spawn.y;
        const margin = extraMargin || 0;
        return Math.sqrt(dx * dx + dy * dy) < getPlayerSpawnProtectionDistance(layout, margin);
    }

    function getMainRoadPath(layout) {
        if (!layout || !Array.isArray(layout.paths)) return null;
        return layout.paths.find(path => path.id === 'main-road') || null;
    }

    function estimatePolylineT(points, x, y) {
        if (!points || points.length < 2) return 0.5;
        let total = 0;
        const segments = [];
        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            segments.push({ from, to, dx, dy, length, start: total });
            total += length;
        }
        if (total <= 0) return 0.5;

        let bestT = 0.5;
        let bestDistSq = Infinity;
        segments.forEach(segment => {
            const length = segment.length || 1;
            const localT = clamp(((x - segment.from.x) * segment.dx + (y - segment.from.y) * segment.dy) / (length * length), 0, 1);
            const px = segment.from.x + segment.dx * localT;
            const py = segment.from.y + segment.dy * localT;
            const distSq = (x - px) * (x - px) + (y - py) * (y - py);
            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestT = (segment.start + length * localT) / total;
            }
        });
        return clamp(bestT, 0, 1);
    }

    function buildRouteSpawnGroups(layout, enemyCount, options) {
        if (!layout || enemyCount <= 0) return null;
        const opts = options || {};
        const rng = opts.rng || Math.random;
        const mainRoad = getMainRoadPath(layout);
        if (!mainRoad || !mainRoad.points || mainRoad.points.length < 2) return null;

        const spawnZone = layout.spawnZone || { x: 140, y: layout.height / 2, radius: 260 };
        const minDistFromSpawn = opts.minDistFromSpawn != null
            ? opts.minDistFromSpawn
            : getPlayerSpawnProtectionDistance(layout);
        const minGroupSeparation = opts.minGroupSeparation || 220;
        const minT = 0.16;
        const maxT = 0.90;
        const anchors = [];

        const archetype = layout.archetype || 'road';
        const pathStationCount = archetype === 'maze'
            ? Math.max(4, Math.min(10, Math.ceil(enemyCount / 2.8)))
            : archetype === 'gauntlet'
                ? Math.max(4, Math.min(9, Math.ceil(enemyCount / 2.5)))
                : Math.max(3, Math.min(8, Math.ceil(enemyCount / 3.5)));
        for (let i = 0; i < pathStationCount; i++) {
            const t = minT + (maxT - minT) * ((i + 0.5) / pathStationCount);
            const pt = pointOnPolyline(mainRoad.points, t);
            const lateral = (i % 2 === 0 ? 1 : -1) * (65 + rng() * 95);
            anchors.push({
                t,
                x: pt.x + pt.normalX * lateral,
                y: pt.y + pt.normalY * lateral,
                kind: 'path',
                priority: 1
            });
        }

        if (Array.isArray(layout.encounterZones)) {
            layout.encounterZones.forEach(zone => {
                const kind = zone.type === 'offshoot'
                    ? 'offshoot'
                    : (zone.type === 'ambush' ? 'ambush' : 'encounter');
                const priority = zone.type === 'offshoot' ? 3 : (zone.type === 'ambush' ? 2 : 1.5);
                anchors.push({
                    t: estimatePolylineT(mainRoad.points, zone.x, zone.y),
                    x: zone.x,
                    y: zone.y,
                    kind,
                    priority,
                    radius: zone.radius,
                    pathId: zone.pathId || null
                });
            });
        }

        anchors.sort((a, b) => a.t - b.t);

        const avgPerGroup = opts.avgPerGroup || 3.5;
        const numGroups = Math.max(1, Math.ceil(enemyCount / avgPerGroup));
        const groupSizes = [];
        const baseSize = Math.floor(enemyCount / numGroups);
        const remainder = enemyCount % numGroups;
        for (let g = 0; g < numGroups; g++) {
            groupSizes.push(g < remainder ? baseSize + 1 : baseSize);
        }

        const offshootAnchors = anchors.filter(anchor => anchor.kind === 'offshoot');
        const routeAnchors = anchors.filter(anchor => anchor.kind !== 'offshoot');
        const groups = [];
        const usedAnchorIndexes = new Set();

        function pickAnchor(pool, targetT, preferHighPriority) {
            let bestIndex = -1;
            let bestScore = Infinity;
            pool.forEach((anchor, index) => {
                const globalIndex = anchors.indexOf(anchor);
                if (usedAnchorIndexes.has(globalIndex)) return;
                const priorityBonus = preferHighPriority ? (anchor.priority || 1) * 0.08 : (anchor.priority || 1) * 0.05;
                const score = Math.abs(anchor.t - targetT) - priorityBonus;
                if (score < bestScore) {
                    bestScore = score;
                    bestIndex = globalIndex;
                }
            });
            if (bestIndex >= 0) {
                usedAnchorIndexes.add(bestIndex);
                return anchors[bestIndex];
            }
            return null;
        }

        const offshootSlots = Math.min(offshootAnchors.length, Math.max(1, Math.floor(numGroups * 0.4)));
        for (let i = 0; i < offshootSlots && groups.length < numGroups; i++) {
            const anchor = offshootAnchors[i];
            const globalIndex = anchors.indexOf(anchor);
            if (globalIndex >= 0) usedAnchorIndexes.add(globalIndex);
            groups.push({
                x: anchor.x,
                y: anchor.y,
                kind: anchor.kind,
                t: anchor.t,
                spreadAlongPath: false,
                isOffshoot: true,
                pathId: anchor.pathId || null
            });
        }

        for (let g = groups.length; g < numGroups; g++) {
            const targetT = minT + (maxT - minT) * (g + 0.5) / numGroups;
            const anchor = pickAnchor(routeAnchors, targetT, false);
            if (anchor) {
                groups.push({
                    x: anchor.x,
                    y: anchor.y,
                    kind: anchor.kind,
                    t: anchor.t,
                    spreadAlongPath: anchor.kind === 'path' || anchor.kind === 'encounter' || anchor.kind === 'ambush'
                });
            } else {
                const pt = pointOnPolyline(mainRoad.points, targetT);
                groups.push({ x: pt.x, y: pt.y, kind: 'path', t: targetT, spreadAlongPath: true });
            }
        }

        const validated = [];
        groups.forEach(group => {
            const minDistanceFrom = [
                { x: spawnZone.x, y: spawnZone.y, distance: minDistFromSpawn },
                ...validated.map(other => ({ x: other.x, y: other.y, distance: minGroupSeparation }))
            ];
            let point = findSafeSpawnPoint(layout, {
                radius: group.isOffshoot ? 80 : 70,
                margin: 60,
                minDistanceFrom,
                maxAttempts: 120,
                rng
            });
            if (!point || isInsidePlayerSpawnProtection(layout, point.x, point.y, 0)) {
                const searchT = Math.max(minT, group.t != null ? group.t : 0.5);
                const pt = pointOnPolyline(mainRoad.points, searchT);
                point = findSafeSpawnPoint(layout, {
                    radius: 70,
                    margin: 60,
                    minDistanceFrom: [
                        { x: spawnZone.x, y: spawnZone.y, distance: minDistFromSpawn },
                        { x: pt.x, y: pt.y, distance: 0 }
                    ],
                    maxAttempts: 80,
                    rng
                });
            }
            if (point && !isInsidePlayerSpawnProtection(layout, point.x, point.y, 0)) {
                validated.push(Object.assign({}, group, { x: point.x, y: point.y }));
            } else {
                const pt = pointOnPolyline(mainRoad.points, Math.max(minT, group.t != null ? group.t : 0.5));
                validated.push(Object.assign({}, group, { x: pt.x, y: pt.y }));
            }
        });

        const mapped = validated.map((group, index) => ({
            x: group.x,
            y: group.y,
            size: groupSizes[index],
            kind: group.kind,
            t: group.t,
            spreadAlongPath: group.spreadAlongPath === true,
            isOffshoot: group.isOffshoot === true || group.kind === 'offshoot',
            pathId: group.pathId || null
        }));
        mapped.sort((a, b) => (a.t || 0) - (b.t || 0));
        return mapped;
    }

    function scatterEnemyInGroup(layout, group, enemyIndex, groupSize, mainRoad, options) {
        const opts = options || {};
        const rng = opts.rng || Math.random;
        const margin = opts.margin || 50;
        const spawnZone = layout.spawnZone || { x: 140, y: layout.height / 2, radius: 260 };

        if (group.spreadAlongPath && mainRoad && mainRoad.points && mainRoad.points.length >= 2) {
            const centerT = group.t != null ? group.t : 0.5;
            const tOffset = (enemyIndex - (groupSize - 1) / 2) * 0.018;
            const pt = pointOnPolyline(mainRoad.points, clamp(centerT + tOffset, 0.05, 0.95));
            
            const roomNum = layout.roomNumber || 1;
            const isScout = rng() < (roomNum <= 8 ? 0.35 : 0.2);
            const maxLateral = isScout ? 260 : (group.kind === 'ambush' ? 140 : 95);
            const lateral = (rng() - 0.5) * maxLateral;

            let x = pt.x + pt.normalX * lateral;
            let y = pt.y + pt.normalY * lateral;
            x = clamp(x, margin, layout.width - margin);
            y = clamp(y, margin, layout.height - margin);
            if (isPointWalkable(layout, x, y, 28) && !isInsidePlayerSpawnProtection(layout, x, y, 0)) {
                return { x, y };
            }
        }

        if (group.isOffshoot || group.kind === 'offshoot') {
            const offshootPath = Array.isArray(layout.paths)
                ? layout.paths.find(path => (group.pathId && path.id === group.pathId) || path.type === 'offshoot')
                : null;
            if (offshootPath) {
                const localT = clamp(0.55 + (enemyIndex - (groupSize - 1) / 2) * 0.12, 0.35, 0.95);
                const pt = pointOnPolyline(offshootPath.points, localT);
                const lateral = (rng() - 0.5) * 90;
                let x = pt.x + pt.normalX * lateral;
                let y = pt.y + pt.normalY * lateral;
                x = clamp(x, margin, layout.width - margin);
                y = clamp(y, margin, layout.height - margin);
                if (isPointWalkable(layout, x, y, 28) && !isInsidePlayerSpawnProtection(layout, x, y, 0)) {
                    return { x, y };
                }
            }
        }

        for (let attempt = 0; attempt < 40; attempt++) {
            const angle = rng() * Math.PI * 2;
            const roomNum = layout.roomNumber || 1;
            const isScout = rng() < (roomNum <= 8 ? 0.35 : 0.2);
            const maxDist = isScout ? 240 : (group.kind === 'ambush' || group.kind === 'offshoot' ? 130 : 100);
            const dist = rng() * maxDist;

            let x = group.x + Math.cos(angle) * dist;
            let y = group.y + Math.sin(angle) * dist;
            x = clamp(x, margin, layout.width - margin);
            y = clamp(y, margin, layout.height - margin);
            if (isPointWalkable(layout, x, y, 28) && !isInsidePlayerSpawnProtection(layout, x, y, 0)) {
                return { x, y };
            }
        }

        const fallback = findSafeSpawnPoint(layout, {
            radius: 30,
            margin,
            minDistanceFrom: [{ x: spawnZone.x, y: spawnZone.y, distance: getPlayerSpawnProtectionDistance(layout) }],
            maxAttempts: 80,
            rng
        });
        if (fallback) return fallback;
        return { x: group.x, y: group.y };
    }

    function stampBiomeLandmark(layout, biomeId, x, y, scale, type) {
        const options = { motif: type, structure: type };
        switch (biomeId) {
            case 'swarm':
                stampHiveStructure(layout, x, y, scale, options);
                break;
            case 'prism':
                stampCrystalStructure(layout, x, y, scale, options);
                break;
            case 'fortress':
                stampFortressStructure(layout, x, y, Math.max(2, Math.round(scale * 1.8)), Math.max(2, Math.round(scale * 1.3)), options);
                break;
            case 'fractal':
                stampFractalStructure(layout, x, y, scale, options);
                break;
            case 'vortex':
                stampVortexStructure(layout, x, y, scale, options);
                break;
            default:
                stampCrystalStructure(layout, x, y, scale * 0.85, options);
                break;
        }
    }

    function getBiomeFootprintType(biomeId, landmarkType) {
        if (biomeId === 'swarm') return 'nestBed';
        if (biomeId === 'prism') return landmarkType === 'lightSpire' || landmarkType === 'lensArray' ? 'spireCourt' : 'mirrorCourt';
        if (biomeId === 'fortress') return landmarkType === 'watchTower' ? 'watchYard' : landmarkType === 'gatehouse' ? 'gateCourt' : 'supplyYard';
        if (biomeId === 'fractal') return landmarkType === 'glitchMonolith' || landmarkType === 'logicGate' ? 'glitchPad' : 'recursivePad';
        if (biomeId === 'vortex') return landmarkType === 'gravitySpire' || landmarkType === 'eventHorizon' ? 'gravityWell' : 'orbitPad';
        if (biomeId === 'endless') return landmarkType === 'brokenGate' || landmarkType === 'riftMarket' ? 'brokenGateYard' : 'riftYard';
        return 'plinth';
    }

    function getBiomeDistrictPathType(biomeId, kit) {
        const base = kit.roadType || 'road';
        if (biomeId === 'swarm') return `${base}Access`;
        if (biomeId === 'prism') return 'mirrorLane';
        if (biomeId === 'fortress') return 'serviceRoad';
        if (biomeId === 'fractal') return 'recursiveTraceAccess';
        if (biomeId === 'vortex') return 'orbitArc';
        if (biomeId === 'endless') return 'riftAlley';
        return `${base}Access`;
    }

    function buildRoadPoints(layout, rng) {
        const start = layout.spawnZone;
        const end = layout.exitZone;
        const centerJitterX = (rng() - 0.5) * layout.cellSize * 5;
        const centerJitterY = (rng() - 0.5) * layout.cellSize * 4;
        const midpoint = {
            x: clamp((start.x + end.x) / 2 + centerJitterX, 360, layout.width - 360),
            y: clamp((start.y + end.y) / 2 + centerJitterY, 260, layout.height - 260)
        };

        if (layout.entranceVariant === 'leftRight') {
            const yBase = start.y;
            const weave = 200 + rng() * 185;
            return [
                { x: start.x, y: start.y },
                { x: clamp(layout.width * 0.18 + centerJitterX * 0.25, 320, layout.width - 320), y: clamp(yBase - weave * 0.55, 240, layout.height - 240) },
                { x: clamp(layout.width * 0.34, 320, layout.width - 320), y: clamp(yBase + weave * 0.45, 240, layout.height - 240) },
                { x: clamp(layout.width * 0.50 + centerJitterX * 0.15, 320, layout.width - 320), y: clamp(yBase - weave * 0.35, 240, layout.height - 240) },
                { x: clamp(layout.width * 0.66, 320, layout.width - 320), y: clamp(yBase + weave * 0.5, 240, layout.height - 240) },
                { x: clamp(layout.width * 0.80 - centerJitterX * 0.2, 320, layout.width - 320), y: clamp(yBase - weave * 0.25 + (rng() - 0.5) * 100, 240, layout.height - 240) },
                { x: end.x, y: end.y }
            ];
        }

        if (layout.entranceVariant === 'topBottom') {
            const xBase = start.x;
            const weave = 210 + rng() * 175;
            return [
                { x: start.x, y: start.y },
                { x: clamp(xBase - weave * 0.5, 280, layout.width - 280), y: clamp(layout.height * 0.22, 240, layout.height - 240) },
                { x: clamp(xBase + weave * 0.42, 280, layout.width - 280), y: clamp(layout.height * 0.36, 240, layout.height - 240) },
                { x: clamp(xBase - weave * 0.38, 280, layout.width - 280), y: clamp(layout.height * 0.52, 240, layout.height - 240) },
                { x: clamp(xBase + weave * 0.48, 280, layout.width - 280), y: clamp(layout.height * 0.68, 240, layout.height - 240) },
                { x: clamp(xBase - weave * 0.22 + (rng() - 0.5) * 90, 280, layout.width - 280), y: clamp(layout.height * 0.82, 240, layout.height - 240) },
                { x: end.x, y: end.y }
            ];
        }

        const diagWeave = layout.cellSize * (2.2 + rng() * 1.4);
        const bendA = {
            x: clamp(start.x + (midpoint.x - start.x) * 0.34 + diagWeave * 0.35, 300, layout.width - 300),
            y: clamp(start.y + (midpoint.y - start.y) * 0.34 - diagWeave * 0.45, 240, layout.height - 240)
        };
        const bendB = {
            x: clamp(midpoint.x - diagWeave * 0.25, 300, layout.width - 300),
            y: clamp(midpoint.y + diagWeave * 0.35, 240, layout.height - 240)
        };
        const bendC = {
            x: clamp(midpoint.x + (end.x - midpoint.x) * 0.42 + diagWeave * 0.2, 300, layout.width - 300),
            y: clamp(midpoint.y + (end.y - midpoint.y) * 0.42 - diagWeave * 0.3, 240, layout.height - 240)
        };
        return [
            { x: start.x, y: start.y },
            bendA,
            midpoint,
            bendB,
            bendC,
            { x: end.x, y: end.y }
        ];
    }

    function addRouteOffshoots(layout, rng, plan, mainRoad, options) {
        if (!layout || !mainRoad || !Array.isArray(mainRoad.points) || mainRoad.points.length < 2) return;

        const opts = options || {};
        const kit = getSceneryKit(plan);
        const routeScale = getRouteClearanceScale(plan.biomeId);
        const branchWidth = layout.cellSize * (1.05 + (kit.structureDensity || 0.7) * 0.22) * routeScale;
        const limits = layout.contentLimits || getContentLimits(layout.width, layout.height, layout.archetype || 'road');
        const maxOffshoots = opts.maxOffshoots != null ? opts.maxOffshoots : Math.min(limits.offshoots, 3);
        const junctionTs = [0.24, 0.5, 0.74];
        const spawnProtection = getPlayerSpawnProtectionDistance(layout, 40);
        const minClearance = getMainRoadClearance(layout, mainRoad) * (opts.minClearanceMul != null ? opts.minClearanceMul : 1);
        let added = 0;

        for (let i = 0; i < junctionTs.length && added < maxOffshoots; i++) {
            const t = junctionTs[i];
            if (t < 0.18) continue;

            const junction = pointOnPolyline(mainRoad.points, t);
            if (isInsidePlayerSpawnProtection(layout, junction.x, junction.y, 120)) continue;

            const side = i % 2 === 0 ? 1 : -1;
            const perpDistance = layout.cellSize * (3.8 + rng() * 2.4);
            const tangentDistance = layout.cellSize * (4.5 + rng() * 3.5);

            const perpPoint = {
                x: clamp(junction.x + junction.normalX * side * perpDistance, layout.cellSize * 4, layout.width - layout.cellSize * 4),
                y: clamp(junction.y + junction.normalY * side * perpDistance, layout.cellSize * 3, layout.height - layout.cellSize * 3)
            };
            const pocket = {
                x: clamp(perpPoint.x + junction.normalY * side * tangentDistance, layout.cellSize * 4, layout.width - layout.cellSize * 4),
                y: clamp(perpPoint.y - junction.normalX * side * tangentDistance, layout.cellSize * 3, layout.height - layout.cellSize * 3)
            };

            const spurPoints = [
                { x: junction.x, y: junction.y },
                perpPoint,
                pocket
            ];
            if (!isPathSeparatedFromPolyline(spurPoints.slice(1), mainRoad.points, minClearance)) continue;

            if (!isPointWalkable(layout, pocket.x, pocket.y, layout.cellSize * 1.5)) {
                pocket.x = perpPoint.x + junction.normalX * side * layout.cellSize * 2.4;
                pocket.y = perpPoint.y + junction.normalY * side * layout.cellSize * 2.4;
            }

            const distFromSpawn = Math.sqrt(
                (pocket.x - layout.spawnZone.x) ** 2 + (pocket.y - layout.spawnZone.y) ** 2
            );
            if (distFromSpawn < spawnProtection) continue;

            const offshootPath = addPath(layout, {
                id: `offshoot-${added + 1}`,
                type: 'offshoot',
                branchType: 'spur',
                junctionT: t,
                width: branchWidth,
                color: kit.roadColor || null,
                points: spurPoints
            });
            carvePath(layout, offshootPath);
            clearCircle(layout, pocket.x, pocket.y, layout.cellSize * 2.4);

            addEncounterZone(layout, {
                id: `offshoot-${added + 1}`,
                type: 'offshoot',
                x: pocket.x,
                y: pocket.y,
                radius: layout.cellSize * 2.8,
                pathId: offshootPath.id,
                junctionT: t
            });
            added++;
        }
    }

    function shortenAccessPathsNearMainRoad(layout, mainRoad) {
        if (!layout || !mainRoad || !Array.isArray(layout.paths)) return;
        const clearance = getMainRoadClearance(layout, mainRoad);
        layout.paths.forEach(path => {
            if (!path.id || !path.id.startsWith('access-') || !Array.isArray(path.points) || path.points.length < 2) return;
            const end = path.points[path.points.length - 1];
            if (distanceToPolyline(mainRoad.points, end.x, end.y) < clearance) {
                const junction = path.points[0];
                const dx = end.x - junction.x;
                const dy = end.y - junction.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const shorten = clearance * 0.55;
                path.points[path.points.length - 1] = {
                    x: Math.round(end.x - (dx / dist) * shorten),
                    y: Math.round(end.y - (dy / dist) * shorten)
                };
            }
        });
    }

    function addRouteDetour(layout, rng, plan, mainRoad) {
        if (!layout || !mainRoad || !Array.isArray(mainRoad.points) || mainRoad.points.length < 2) return null;

        const junction = pointOnPolyline(mainRoad.points, 0.5);
        if (!isValidDetourMergePoint(layout, junction) && isInsidePlayerSpawnProtection(layout, junction.x, junction.y, 80)) {
            return null;
        }

        const merge = findDetourMergeT(mainRoad, layout);
        if (!merge) return null;

        const kit = getSceneryKit(plan);
        const routeScale = getRouteClearanceScale(plan.biomeId);
        const branchWidth = layout.cellSize * (1.0 + (kit.structureDensity || 0.7) * 0.2) * routeScale;
        const side = rng() < 0.5 ? 1 : -1;
        const perpDistance = layout.cellSize * (3.5 + rng() * 2);
        const parallelLength = (plan.routeTravelLength || layout.width) * 0.12;

        const perpPoint = {
            x: clamp(junction.x + junction.normalX * side * perpDistance, layout.cellSize * 4, layout.width - layout.cellSize * 4),
            y: clamp(junction.y + junction.normalY * side * perpDistance, layout.cellSize * 3, layout.height - layout.cellSize * 3)
        };
        const parallelEnd = {
            x: clamp(perpPoint.x + junction.normalY * side * parallelLength, layout.cellSize * 4, layout.width - layout.cellSize * 4),
            y: clamp(perpPoint.y - junction.normalX * side * parallelLength, layout.cellSize * 3, layout.height - layout.cellSize * 3)
        };
        const mergePoint = merge.mergePoint;
        const detourPoints = [
            { x: junction.x, y: junction.y },
            perpPoint,
            parallelEnd,
            { x: mergePoint.x, y: mergePoint.y }
        ];

        if (!isPathSeparatedFromPolyline(detourPoints, mainRoad.points, getMainRoadClearance(layout, mainRoad) * 0.75)) {
            return null;
        }

        const detourPath = addPath(layout, {
            id: 'detour-loop',
            type: 'offshoot',
            branchType: 'detour',
            junctionT: 0.5,
            mergeT: merge.t,
            width: branchWidth,
            color: kit.roadColor || null,
            points: detourPoints
        });
        carvePath(layout, detourPath);
        clearCircle(layout, mergePoint.x, mergePoint.y, layout.cellSize * 2.2);
        return detourPath;
    }

    function getLandmarkPlacements(biomeId) {
        if (biomeId === 'vortex') return [0.18, 0.42, 0.66, 0.84];
        if (biomeId === 'endless') return [0.20, 0.46, 0.72, 0.88];
        if (biomeId === 'fortress') return [0.26, 0.54, 0.78];
        return [0.24, 0.48, 0.72];
    }

    function getRouteClearanceScale(biomeId) {
        if (biomeId === 'fractal') return 1.22;
        if (biomeId === 'fortress') return 1.26;
        if (biomeId === 'vortex') return 1.34;
        if (biomeId === 'endless') return 1.30;
        return 1;
    }

    function placeRoadLandmarks(layout, rng, plan, path) {
        const kit = getSceneryKit(plan);
        const landmarkTypes = kit.landmarkTypes || ['relic'];
        const density = kit.structureDensity || 0.7;
        const placements = getLandmarkPlacements(plan.biomeId);
        placements.forEach((t, index) => {
            const base = pointOnPolyline(path.points, t);
            const side = index % 2 === 0 ? 1 : -1;
            const offsetScale = plan.biomeId === 'fortress' ? 4.15 : plan.biomeId === 'vortex' || plan.biomeId === 'endless' ? 3.7 : 3.0;
            const offsetJitter = plan.biomeId === 'fortress' ? 1.0 : 1.6;
            const offset = layout.cellSize * (offsetScale + rng() * offsetJitter);
            const x = clamp(base.x + base.normalX * offset * side, layout.cellSize * 4, layout.width - layout.cellSize * 4);
            const y = clamp(base.y + base.normalY * offset * side, layout.cellSize * 3, layout.height - layout.cellSize * 3);
            const type = landmarkTypes[index % landmarkTypes.length];
            const scale = 0.75 + density * 0.35 + rng() * 0.3;
            const footprintWidthScale = plan.biomeId === 'vortex' ? 1.02 + rng() * 0.18 : 0.84 + rng() * 0.28;
            const footprintHeightScale = plan.biomeId === 'vortex' ? 1.02 + rng() * 0.18 : 0.86 + rng() * 0.24;
            const footprintRotationJitter = (rng() - 0.5) * 0.36;
            const baseFootprintRotation = Math.atan2(base.normalY * side, base.normalX * side);
            const footprintRotation = plan.biomeId === 'swarm'
                ? Math.round(baseFootprintRotation / (Math.PI / 3)) * (Math.PI / 3)
                : baseFootprintRotation + footprintRotationJitter;
            const approachDistance = layout.cellSize * (1.65 + scale * 0.45);
            const approach = {
                x: clamp(x - base.normalX * approachDistance * side, layout.cellSize * 3, layout.width - layout.cellSize * 3),
                y: clamp(y - base.normalY * approachDistance * side, layout.cellSize * 3, layout.height - layout.cellSize * 3)
            };
            const accessPath = addPath(layout, {
                id: `access-${index + 1}`,
                type: `${kit.roadType || 'road'}Access`,
                width: layout.cellSize * (0.78 + density * 0.24) * getRouteClearanceScale(plan.biomeId),
                color: kit.roadColor || null,
                points: [
                    { x: base.x, y: base.y },
                    approach
                ]
            });
            carvePath(layout, accessPath);
            stampBiomeLandmark(layout, plan.biomeId, x, y, scale, type);
            addLandmark(layout, {
                id: `${type}-${index + 1}`,
                type,
                x,
                y,
                radius: layout.cellSize * (1.7 + scale),
                blocksMovement: true,
                pathId: path.id,
                accessPathId: accessPath.id,
                districtType: getDistrictTypeForLandmark(plan, index, t),
                footprint: {
                    type: getBiomeFootprintType(plan.biomeId, type),
                    x,
                    y,
                    width: layout.cellSize * (4.05 + density * 0.7 + scale * 0.8) * footprintWidthScale,
                    height: layout.cellSize * (2.75 + density * 0.62 + scale * 0.42) * footprintHeightScale,
                    rotation: footprintRotation,
                    detailScale: 0.82 + rng() * 0.34,
                    districtType: kit.districtType || null,
                    plazaType: kit.plazaType || null
                },
                compound: {
                    style: plan.biomeId,
                    anchorPathId: accessPath.id,
                    detailCount: 3 + Math.round(density * 3) + (rng() < 0.45 ? 1 : 0)
                }
            });
            addEncounterZone(layout, {
                id: `roadside-${index + 1}`,
                type: index === 1 ? 'ambush' : 'roadside',
                x: base.x - base.normalX * offset * side * 0.45,
                y: base.y - base.normalY * offset * side * 0.45,
                radius: layout.cellSize * (2.4 + density)
            });
        });
    }

    function addBiomeDistrictPaths(layout, rng, kit) {
        if (!layout || !Array.isArray(layout.landmarks) || layout.landmarks.length < 2) return;

        const districtPathWidthByBiome = {
            swarm: 0.86,
            prism: 0.74,
            fortress: 1.05,
            fractal: 0.78,
            vortex: 0.80,
            endless: 0.74
        };
        const maxDistanceByBiome = {
            swarm: 9,
            prism: 10,
            fortress: 8,
            fractal: 9,
            vortex: 8,
            endless: 8
        };
        const pathWidth = layout.cellSize * (districtPathWidthByBiome[layout.biomeId] || 0.82);
        const maxDistance = layout.cellSize * (maxDistanceByBiome[layout.biomeId] || 9);
        const pathType = getBiomeDistrictPathType(layout.biomeId, kit);

        const maxDistrictPaths = layout.biomeId === 'vortex' || layout.biomeId === 'endless' || layout.biomeId === 'fortress' ? 2 : 3;
        let addedDistrictPaths = 0;
        for (let i = 0; i < layout.landmarks.length - 1 && addedDistrictPaths < maxDistrictPaths; i++) {
            const from = layout.landmarks[i];
            const to = layout.landmarks[i + 1];
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length < layout.cellSize * 3 || length > maxDistance) continue;

            const normalX = length > 0 ? -dy / length : 0;
            const normalY = length > 0 ? dx / length : 1;
            const bendScale = layout.biomeId === 'vortex' ? 1.05 : layout.biomeId === 'endless' ? 0.75 : layout.biomeId === 'fractal' ? 0.95 : 0.9;
            const bend = (rng() < 0.5 ? -1 : 1) * layout.cellSize * (0.7 + rng() * 0.8) * bendScale;
            const midpoint = {
                x: clamp((from.x + to.x) / 2 + normalX * bend, layout.cellSize * 3, layout.width - layout.cellSize * 3),
                y: clamp((from.y + to.y) / 2 + normalY * bend, layout.cellSize * 3, layout.height - layout.cellSize * 3)
            };
            const inset = layout.cellSize * 1.35;
            const start = {
                x: clamp(from.x + dx / length * inset, layout.cellSize * 3, layout.width - layout.cellSize * 3),
                y: clamp(from.y + dy / length * inset, layout.cellSize * 3, layout.height - layout.cellSize * 3)
            };
            const end = {
                x: clamp(to.x - dx / length * inset, layout.cellSize * 3, layout.width - layout.cellSize * 3),
                y: clamp(to.y - dy / length * inset, layout.cellSize * 3, layout.height - layout.cellSize * 3)
            };

            const fieldPath = addPath(layout, {
                id: `${kit.districtType || 'district'}-${i + 1}`,
                type: pathType,
                width: pathWidth,
                color: kit.roadColor || null,
                points: [start, midpoint, end]
            });
            carvePath(layout, fieldPath);
            addedDistrictPaths++;
        }

        if (!Array.isArray(layout.plazas)) layout.plazas = [];
        layout.landmarks.forEach((landmark, index) => {
            if (index % 2 !== 0) return;
            const radius = layout.cellSize * (layout.biomeId === 'fortress' ? 1.75 : layout.biomeId === 'vortex' ? 2.6 : 1.9);
            clearCircle(layout, landmark.x, landmark.y, radius * 0.82);
            layout.plazas.push({
                id: `${kit.plazaType || 'district-plaza'}-${index + 1}`,
                type: kit.plazaType || 'districtPlaza',
                x: landmark.x,
                y: landmark.y,
                radius,
                biomeId: layout.biomeId,
                landmarkId: landmark.id
            });
        });
    }

    function reinforceRouteTraversability(layout) {
        if (!layout || !Array.isArray(layout.paths)) return;
        const scale = getRouteClearanceScale(layout.biomeId);
        layout.paths.forEach(path => {
            const isMainRoad = path.id === 'main-road';
            const extraWidth = isMainRoad ? layout.cellSize * 0.55 * scale : layout.cellSize * 0.28 * scale;
            carvePath(layout, Object.assign({}, path, {
                width: (path.width || layout.cellSize * 2) + extraWidth
            }));
            if (Array.isArray(path.points)) {
                path.points.forEach(point => {
                    clearCircle(layout, point.x, point.y, ((path.width || layout.cellSize * 2) + extraWidth) * 0.58);
                });
            }
        });

        const mainRoad = layout.paths.find(path => path.id === 'main-road');
        if (mainRoad && Array.isArray(mainRoad.points) && mainRoad.points.length >= 2) {
            const start = mainRoad.points[0];
            const end = mainRoad.points[mainRoad.points.length - 1];
            const spawnAnchor = pointOnPolyline(mainRoad.points, 0.08);
            const exitAnchor = pointOnPolyline(mainRoad.points, 0.92);
            layout.spawnZone = Object.assign({}, layout.spawnZone, {
                x: Math.round(spawnAnchor.x),
                y: Math.round(spawnAnchor.y)
            });
            layout.exitZone = Object.assign({}, layout.exitZone, {
                x: Math.round(exitAnchor.x),
                y: Math.round(exitAnchor.y)
            });
            clearCircle(layout, start.x, start.y, layout.spawnZone.radius + layout.cellSize * 1.35);
            clearCircle(layout, end.x, end.y, layout.exitZone.radius + layout.cellSize * 1.2);
            clearCircle(layout, spawnAnchor.x, spawnAnchor.y, layout.spawnZone.radius + layout.cellSize * 1.35);
            clearCircle(layout, exitAnchor.x, exitAnchor.y, layout.exitZone.radius + layout.cellSize * 1.2);
            clearCircle(layout, spawnAnchor.x, spawnAnchor.y, getPlayerSpawnProtectionDistance(layout, 0));
        }
        layout.spawnProtectionRadius = getPlayerSpawnProtectionDistance(layout);
    }

    function getDistrictTypeForLandmark(plan, index, pathT) {
        const biomeDistricts = {
            swarm: ['nursery', 'hiveWall', 'sporeGarden'],
            prism: ['facetHall', 'mirrorCourt', 'shardVault'],
            fortress: ['barracks', 'armory', 'gatehouse'],
            fractal: ['echoChamber', 'glitchNode', 'recursiveWing'],
            vortex: ['orbitRing', 'voidNave', 'riftSpire'],
            endless: ['ruinRow', 'ashField', 'lostArchive']
        };
        const pool = biomeDistricts[plan.biomeId] || biomeDistricts.endless;
        if (pathT < 0.35) return pool[0];
        if (pathT > 0.65) return pool[pool.length - 1];
        return pool[index % pool.length];
    }

    function applyForcedRoadBend(mainRoad, layout, rng) {
        if (!mainRoad || !Array.isArray(mainRoad.points) || mainRoad.points.length < 3) return false;
        const midIndex = Math.floor(mainRoad.points.length / 2);
        const mid = mainRoad.points[midIndex];
        mainRoad.points.splice(midIndex, 0, {
            x: Math.round(mid.x + (rng() - 0.5) * layout.cellSize * 4),
            y: Math.round(mid.y + (rng() - 0.5) * layout.cellSize * 4)
        });
        return true;
    }

    function computeRoadAngleQuality(points) {
        if (!points || points.length < 3) return 0;
        const angles = [];
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            const v1x = curr.x - prev.x;
            const v1y = curr.y - prev.y;
            const v2x = next.x - curr.x;
            const v2y = next.y - curr.y;
            const len1 = Math.sqrt(v1x * v1x + v1y * v1y) || 1;
            const len2 = Math.sqrt(v2x * v2x + v2y * v2y) || 1;
            const dot = (v1x / len1) * (v2x / len2) + (v1y / len1) * (v2y / len2);
            const angle = Math.acos(clamp(dot, -1, 1));
            angles.push(angle);
        }
        if (angles.length === 0) return 0;
        return angles.reduce((sum, value) => sum + value, 0) / angles.length;
    }

    function computePlayabilityMetrics(layout, plan) {
        const mainRoad = getMainRoadPath(layout);
        const straightDist = mainRoad && mainRoad.points && mainRoad.points.length >= 2
            ? Math.sqrt(
                (mainRoad.points[mainRoad.points.length - 1].x - mainRoad.points[0].x) ** 2 +
                (mainRoad.points[mainRoad.points.length - 1].y - mainRoad.points[0].y) ** 2
            )
            : 1;
        const pathLength = mainRoad ? polylineLength(mainRoad.points) : straightDist;
        const windingRatio = pathLength / Math.max(1, straightDist);

        const landmarks = Array.isArray(layout.landmarks) ? layout.landmarks : [];
        let visibleLandmarks = 0;
        landmarks.forEach(lm => {
            if (hasPathBetween(layout, layout.spawnZone, { x: lm.x, y: lm.y })) visibleLandmarks++;
        });
        const visibleLandmarkRatio = landmarks.length > 0 ? visibleLandmarks / landmarks.length : 1;

        const offshootPaths = (layout.paths || []).filter(path => path.type === 'offshoot' && path.branchType !== 'detour');
        const clearance = mainRoad ? getMainRoadClearance(layout, mainRoad) : layout.cellSize * 3;
        let offshootSeparation = clearance;
        offshootPaths.forEach(path => {
            const sep = isPathSeparatedFromPolyline(path.points, mainRoad.points, clearance * 0.85)
                ? clearance
                : distanceToPolyline(mainRoad.points, path.points[path.points.length - 1].x, path.points[path.points.length - 1].y);
            offshootSeparation = Math.min(offshootSeparation, sep);
        });
        if (offshootPaths.length === 0) offshootSeparation = clearance;

        const angleQuality = mainRoad ? computeRoadAngleQuality(mainRoad.points) : 0.4;
        const offshootCount = offshootPaths.length;

        return {
            windingRatio,
            visibleLandmarkRatio,
            offshootSeparation,
            offshootCount,
            angleQuality,
            clearance
        };
    }

    function validatePlayability(layout, plan) {
        if (!layout || plan.roomType !== 'normal') {
            return { valid: true, metrics: null };
        }
        const metrics = computePlayabilityMetrics(layout, plan);
        const roomNumber = plan.roomNumber || 1;
        const needsOffshoot = roomNumber >= 3;
        const valid =
            metrics.windingRatio >= 1.08 &&
            metrics.visibleLandmarkRatio >= 0.5 &&
            metrics.offshootSeparation >= metrics.clearance * 0.85 &&
            (!needsOffshoot || metrics.offshootCount >= 1) &&
            metrics.angleQuality >= 0.1 &&
            metrics.angleQuality <= 1.05;

        layout.playability = Object.assign({ valid }, metrics);
        return layout.playability;
    }

    function buildTrailMarkers(layout, mainRoad) {
        if (!layout || !mainRoad || !Array.isArray(mainRoad.points)) return [];
        const spacing = 250;
        const total = polylineLength(mainRoad.points);
        if (total <= spacing) return [];
        const markers = [];
        const markerCount = Math.floor(total / spacing);
        const roadWidth = mainRoad.width || layout.cellSize * 2;
        for (let i = 1; i <= markerCount; i++) {
            const t = (i * spacing) / total;
            const pt = pointOnPolyline(mainRoad.points, clamp(t, 0.05, 0.95));
            markers.push({
                x: Math.round(pt.x + pt.normalX * roadWidth * 0.55),
                y: Math.round(pt.y + pt.normalY * roadWidth * 0.55),
                t
            });
        }
        return markers;
    }

    function applyTrailMarkers(layout, mainRoad) {
        layout.trailMarkers = buildTrailMarkers(layout, mainRoad);
    }

    function applyBeaconLandmark(layout, mainRoad) {
        if (!layout || !mainRoad || !Array.isArray(layout.landmarks)) return;
        let best = null;
        let bestDist = Infinity;
        layout.landmarks.forEach(lm => {
            const t = estimatePolylineT(mainRoad.points, lm.x, lm.y);
            const dist = Math.abs(t - 0.5);
            if (dist < bestDist) {
                bestDist = dist;
                best = lm;
            }
        });
        if (best) {
            best.beacon = true;
            best.glow = true;
            best.scale = (best.scale || 1) * 1.4;
            if (best.footprint) best.footprint.detailScale = (best.footprint.detailScale || 1) * 1.15;
        }
    }

    function applyEdgeDensityTunnel(layout, rng) {
        if (!layout || !layout.grid) return;
        const marginX = layout.width * 0.2;
        const marginY = layout.height * 0.2;
        const mainRoad = getMainRoadPath(layout);
        for (let row = 0; row < layout.rows; row++) {
            for (let col = 0; col < layout.cols; col++) {
                const center = cellCenter(layout, col, row);
                const nearEdge =
                    center.x < marginX || center.x > layout.width - marginX ||
                    center.y < marginY || center.y > layout.height - marginY;
                if (!nearEdge) continue;
                if (mainRoad && distanceToPolyline(mainRoad.points, center.x, center.y) < (mainRoad.width || 150) * 1.2) {
                    continue;
                }
                if (rng() < 0.08) {
                    setCell(layout, col, row, BLOCKED);
                }
            }
        }
    }

    function stampGauntletChokes(layout, mainRoad, rng) {
        if (!mainRoad || !mainRoad.points) return;
        [0.35, 0.55, 0.72].forEach(t => {
            const pt = pointOnPolyline(mainRoad.points, t);
            const chokeW = layout.cellSize * (2.2 + rng() * 0.8);
            const chokeH = layout.cellSize * (5 + rng() * 2);
            const angle = Math.atan2(pt.normalY, pt.normalX);
            const cx = pt.x + pt.normalX * layout.cellSize * 4.5;
            const cy = pt.y + pt.normalY * layout.cellSize * 4.5;
            stampRect(layout, cx - chokeW / 2, cy - chokeH / 2, chokeW, chokeH, { preset: 'solid' });
            clearCircle(layout, pt.x, pt.y, layout.cellSize * 2.5);
        });
    }

    function stampArenaDonut(layout) {
        const cx = layout.width / 2;
        const cy = layout.height / 2;
        const outer = Math.min(layout.width, layout.height) * 0.38;
        const inner = outer * 0.55;
        clearCircle(layout, cx, cy, inner);
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 5) {
            const ox = cx + Math.cos(angle) * outer;
            const oy = cy + Math.sin(angle) * outer;
            stampCircle(layout, ox, oy, layout.cellSize * 1.8, { preset: 'solid' });
        }
    }

    function addCrossroadsSplit(layout, rng, plan, mainRoad, kit, routeScale) {
        const split = pointOnPolyline(mainRoad.points, 0.5);
        const armLength = layout.cellSize * (5 + rng() * 3);
        [-1, 1].forEach((dir, index) => {
            const end = {
                x: clamp(split.x + split.normalX * dir * armLength, layout.cellSize * 4, layout.width - layout.cellSize * 4),
                y: clamp(split.y + split.normalY * dir * armLength, layout.cellSize * 3, layout.height - layout.cellSize * 3)
            };
            const armPath = addPath(layout, {
                id: `cross-arm-${index + 1}`,
                type: 'offshoot',
                branchType: 'crossroads',
                width: layout.cellSize * (1.1 + (kit.structureDensity || 0.7) * 0.2) * routeScale,
                color: kit.roadColor || null,
                points: [{ x: split.x, y: split.y }, end]
            });
            carvePath(layout, armPath);
            clearCircle(layout, end.x, end.y, layout.cellSize * 2.2);
            addEncounterZone(layout, {
                id: `cross-arm-${index + 1}`,
                type: 'roadside',
                x: end.x,
                y: end.y,
                radius: layout.cellSize * 2.6,
                pathId: armPath.id
            });
        });
    }

    function finalizeSemanticRoadLayout(layout, rng, plan, path) {
        const kit = getSceneryKit(plan);
        const archetype = layout.archetype || plan.archetype || 'road';
        layout.contentLimits = getContentLimits(layout.width, layout.height, archetype);
        layout.decorationProfile = kit.decorationProfile || layout.decorationProfile;
        layout.decorationSeed = `${layout.seed}:${layout.biomeId}:${layout.entranceVariant}:${archetype}:decorations`;

        placeRoadLandmarks(layout, rng, plan, path);
        shortenAccessPathsNearMainRoad(layout, path);

        const offshootCap = layout.wilds ? layout.contentLimits.offshoots + 1 : layout.contentLimits.offshoots;
        addRouteOffshoots(layout, rng, plan, path, { maxOffshoots: offshootCap });
        if ((plan.roomNumber || 1) >= 3) {
            const spurCount = layout.paths.filter(p => p.type === 'offshoot' && p.branchType !== 'detour').length;
            if (spurCount === 0) {
                addRouteOffshoots(layout, rng, plan, path, { maxOffshoots: 1, minClearanceMul: 0.45 });
            }
        }

        if ((archetype === 'road' || archetype === 'wilds') && rng() < 0.3) {
            addRouteDetour(layout, rng, plan, path);
        }

        if (archetype === 'crossroads') {
            addCrossroadsSplit(layout, rng, plan, path, kit, getRouteClearanceScale(plan.biomeId));
        }

        addBiomeDistrictPaths(layout, rng, kit);
        carvePath(layout, path);
        clearCircle(layout, layout.spawnZone.x, layout.spawnZone.y, layout.spawnZone.radius + 80);
        clearCircle(layout, layout.exitZone.x, layout.exitZone.y, layout.exitZone.radius + 80);

        if (archetype === 'gauntlet') stampGauntletChokes(layout, path, rng);
        if (archetype === 'arena') stampArenaDonut(layout);

        applyTrailMarkers(layout, path);
        applyBeaconLandmark(layout, path);
        reinforceRouteTraversability(layout);

        layout.visualMotifs.push({
            type: 'semanticRoad',
            pathId: path.id,
            roadType: path.type,
            decorationProfile: layout.decorationProfile,
            archetype
        });
    }

    function generateArchetypeLayout(layout, rng, plan) {
        if (!plan || plan.roomType !== 'normal') return;
        const archetype = plan.archetype || layout.archetype || pickArchetype(plan, rng);
        layout.archetype = archetype;
        layout.wilds = archetype === 'wilds';

        const kit = getSceneryKit(plan);
        const routeScale = getRouteClearanceScale(plan.biomeId);
        const path = addPath(layout, {
            id: 'main-road',
            type: kit.roadType || 'road',
            width: layout.cellSize * (1.82 + (kit.structureDensity || 0.7) * 0.26) * routeScale,
            color: kit.roadColor || null,
            points: buildRoadPoints(layout, rng)
        });

        finalizeSemanticRoadLayout(layout, rng, plan, path);

        const createPlaza = (centerX, centerY, radius, type) => {
            clearCircle(layout, centerX, centerY, radius);
            if (!Array.isArray(layout.plazas)) layout.plazas = [];
            layout.plazas.push({
                x: centerX,
                y: centerY,
                radius: radius,
                type: type || 'clearing',
                id: `plaza-${layout.plazas.length}`
            });
        };

        const centerX = layout.width * 0.5;
        const centerY = layout.height * 0.5;
        const centralClear = layout.cellSize * (archetype === 'arena' ? 4.5 : 3.5);
        let centerObstacles = 0;
        const checkRadius = centralClear * 1.5;
        for (let testAngle = 0; testAngle < Math.PI * 2; testAngle += 0.8) {
            const testX = centerX + Math.cos(testAngle) * checkRadius;
            const testY = centerY + Math.sin(testAngle) * checkRadius;
            if (!isPointWalkable(layout, testX, testY, layout.cellSize)) centerObstacles++;
        }

        if (centerObstacles < 3 && Array.isArray(layout.landmarks) && archetype !== 'gauntlet') {
            let tooClose = false;
            layout.landmarks.forEach(landmark => {
                const dist = Math.sqrt((centerX - landmark.x) ** 2 + (centerY - landmark.y) ** 2);
                if (dist < (landmark.radius || layout.cellSize * 2) + centralClear + layout.cellSize) tooClose = true;
            });
            if (!tooClose) createPlaza(centerX, centerY, centralClear, archetype === 'arena' ? 'arenaCore' : 'centralPlaza');
        }

        if (Array.isArray(layout.landmarks) && archetype !== 'arena') {
            layout.landmarks.forEach((landmark, index) => {
                if (index % 2 !== 0) return;
                const clearingRadius = layout.cellSize * (2 + rng() * 0.8);
                const clearingAngle = rng() * Math.PI * 2;
                const clearingDistance = (landmark.radius || layout.cellSize * 2) + clearingRadius + layout.cellSize * 1.2;
                const clearingX = landmark.x + Math.cos(clearingAngle) * clearingDistance;
                const clearingY = landmark.y + Math.sin(clearingAngle) * clearingDistance;
                if (clearingX > clearingRadius + 60 && clearingX < layout.width - clearingRadius - 60 &&
                    clearingY > clearingRadius + 60 && clearingY < layout.height - clearingRadius - 60) {
                    const spawnDist = Math.sqrt((clearingX - layout.spawnZone.x) ** 2 + (clearingY - layout.spawnZone.y) ** 2);
                    const exitDist = Math.sqrt((clearingX - layout.exitZone.x) ** 2 + (clearingY - layout.exitZone.y) ** 2);
                    if (spawnDist > layout.spawnZone.radius + clearingRadius + layout.cellSize &&
                        exitDist > layout.exitZone.radius + clearingRadius + layout.cellSize) {
                        createPlaza(clearingX, clearingY, clearingRadius, 'courtyard');
                    }
                }
            });
        }
    }

    function generateRoadArchetype(layout, rng, plan) {
        generateArchetypeLayout(layout, rng, plan);
    }

    function generateDecorations(layout, limit) {
        if (!layout || !Array.isArray(layout.paths) || layout.paths.length === 0) return [];
        const rng = createRng(layout.decorationSeed || `${layout.seed}:decorations`);
        const maxDecorations = limit || 90;
        const profile = layout.decorationProfile || 'defaultDust';
        const decorations = [];
        const paths = layout.paths;
        const decorationTypesByProfile = {
            swarmGrowth: ['spore', 'amberVein', 'hexCell'],
            prismShards: ['smallShard', 'lightFacet', 'triGlyph'],
            fortressDebris: ['floorPlate', 'bannerMark', 'rubble'],
            fractalGlyphs: ['miniDiamond', 'glitchCrack', 'echoShard'],
            vortexDust: ['dustArc', 'voidCrack', 'orbitPebble'],
            endlessRemnants: ['lostShard', 'brokenPlate', 'riftScratch'],
            defaultDust: ['scrap', 'scratch', 'mote']
        };
        const types = decorationTypesByProfile[profile] || decorationTypesByProfile.defaultDust;

        paths.forEach(path => {
            const isMainRoad = path.id === 'main-road';
            const count = Math.max(8, Math.min(maxDecorations, Math.round((path.points.length - 1) * (isMainRoad ? 14 : 18))));
            for (let i = 0; i < count && decorations.length < maxDecorations; i++) {
                const pathT = rng();
                if (isMainRoad) {
                    const densityFactor = 0.3 + pathT * 0.7;
                    if (rng() > densityFactor) continue;
                }
                const base = pointOnPolyline(path.points, pathT);
                const side = rng() < 0.5 ? -1 : 1;
                const offset = path.width * (0.35 + rng() * 1.5);
                const jitter = (rng() - 0.5) * layout.cellSize;
                const x = clamp(base.x + base.normalX * offset * side + base.normalY * jitter, 30, layout.width - 30);
                const y = clamp(base.y + base.normalY * offset * side - base.normalX * jitter, 30, layout.height - 30);
                const decorAlpha = isMainRoad ? 0.25 + pathT * 0.45 : 0.35 + rng() * 0.35;
                decorations.push({
                    type: types[Math.floor(rng() * types.length)],
                    x: Math.round(x),
                    y: Math.round(y),
                    size: Math.round(5 + rng() * 16),
                    rotation: rng() * Math.PI * 2,
                    alpha: decorAlpha,
                    pathT: isMainRoad ? pathT : null
                });
            }
        });

        return decorations;
    }

    function generateSceneryFixtures(layout, limit) {
        if (!layout) return [];
        const rng = createRng(`${layout.decorationSeed || layout.seed}:fixtures`);
        const maxFixtures = limit || (layout.contentLimits && layout.contentLimits.fixtures) || 36;
        const fixtures = [];

        const trailMarkers = Array.isArray(layout.trailMarkers)
            ? layout.trailMarkers
            : buildTrailMarkers(layout, getMainRoadPath(layout));
        trailMarkers.forEach(marker => {
            if (fixtures.length >= maxFixtures) return;
            fixtures.push({
                type: 'trailMarker',
                x: marker.x,
                y: marker.y,
                rotation: 0,
                size: Math.round(layout.cellSize * 0.55),
                glow: true,
                purpose: 'wayfinding',
                t: marker.t
            });
        });

        if (!Array.isArray(layout.landmarks) || layout.landmarks.length === 0) {
            return fixtures;
        }
        const fixtureTypesByBiome = {
            swarm: { 
                light: 'bioLantern', 
                corner: 'sporePost', 
                entrance: 'hiveGate',
                yard: 'growthPod',
                infrastructure: 'nutrientNode'
            },
            prism: { 
                light: 'prismLamp', 
                corner: 'facetMarker', 
                entrance: 'crystalArch',
                yard: 'reflectionPool', 
                infrastructure: 'energyConduit'
            },
            fortress: { 
                light: 'streetLamp', 
                corner: 'guardPost', 
                entrance: 'gatePost',
                yard: 'statueBase',
                infrastructure: 'supplyCrate'
            },
            fractal: { 
                light: 'runeLamp', 
                corner: 'glyphTotem', 
                entrance: 'portalFrame',
                yard: 'ritualCircle',
                infrastructure: 'dataNode'
            },
            vortex: { 
                light: 'voidLamp', 
                corner: 'gravityAnchor', 
                entrance: 'vortexGate',
                yard: 'orbitRing',
                infrastructure: 'fieldGenerator'
            },
            endless: { 
                light: 'riftLamp', 
                corner: 'memoryStone', 
                entrance: 'voidGate',
                yard: 'echoWell',
                infrastructure: 'stabilizer'
            }
        };
        const types = fixtureTypesByBiome[layout.biomeId] || fixtureTypesByBiome.endless;

        // Process each landmark as a building structure (but reduce density)
        const landmarksToProcess = Math.min(layout.landmarks.length, Math.floor(maxFixtures / 8)); // Limit landmark processing
        layout.landmarks.slice(0, landmarksToProcess).forEach((landmark, landmarkIndex) => {
            if (!landmark || fixtures.length >= maxFixtures) return;
            
            const footprint = landmark.footprint || {};
            const buildingRotation = footprint.rotation || 0;
            const buildingWidth = footprint.width || landmark.radius * 2.4;
            const buildingHeight = footprint.height || landmark.radius * 1.55;
            
            // Define building corners for structural elements
            const corners = [
                { x: -buildingWidth/2, y: -buildingHeight/2, corner: 'topLeft' },
                { x: buildingWidth/2, y: -buildingHeight/2, corner: 'topRight' },
                { x: buildingWidth/2, y: buildingHeight/2, corner: 'bottomRight' },
                { x: -buildingWidth/2, y: buildingHeight/2, corner: 'bottomLeft' }
            ];

            // Transform and place corner fixtures (only on some corners to reduce clutter)
            corners.forEach((cornerDef, i) => {
                if (fixtures.length >= maxFixtures || i % 2 !== 0) return; // Only place on alternating corners
                const cos = Math.cos(buildingRotation);
                const sin = Math.sin(buildingRotation);
                const worldX = landmark.x + cornerDef.x * cos - cornerDef.y * sin;
                const worldY = landmark.y + cornerDef.x * sin + cornerDef.y * cos;
                
                fixtures.push({
                    type: types.corner,
                    x: Math.round(clamp(worldX, 40, layout.width - 40)),
                    y: Math.round(clamp(worldY, 40, layout.height - 40)),
                    rotation: buildingRotation + Math.PI * i / 2,
                    size: Math.round(layout.cellSize * (0.35 + rng() * 0.15)),
                    glow: false,
                    buildingId: landmark.id,
                    purpose: 'corner',
                    corner: cornerDef.corner
                });
            });

            // Find access path connection for entrance placement
            let entranceSide = 'front'; // default
            if (landmark.accessPathId && Array.isArray(layout.paths)) {
                const accessPath = layout.paths.find(p => p.id === landmark.accessPathId);
                if (accessPath && Array.isArray(accessPath.points) && accessPath.points.length >= 2) {
                    const lastPathPoint = accessPath.points[accessPath.points.length - 1];
                    const dx = lastPathPoint.x - landmark.x;
                    const dy = lastPathPoint.y - landmark.y;
                    const approachAngle = Math.atan2(dy, dx);
                    const normalizedAngle = ((approachAngle - buildingRotation) + Math.PI * 2) % (Math.PI * 2);
                    
                    if (normalizedAngle < Math.PI / 4 || normalizedAngle >= 7 * Math.PI / 4) {
                        entranceSide = 'right';
                    } else if (normalizedAngle >= Math.PI / 4 && normalizedAngle < 3 * Math.PI / 4) {
                        entranceSide = 'bottom';
                    } else if (normalizedAngle >= 3 * Math.PI / 4 && normalizedAngle < 5 * Math.PI / 4) {
                        entranceSide = 'left';
                    } else {
                        entranceSide = 'top';
                    }
                }
            }

            // Place entrance markers
            let entranceX, entranceY;
            if (entranceSide === 'right') {
                entranceX = buildingWidth / 2;
                entranceY = 0;
            } else if (entranceSide === 'left') {
                entranceX = -buildingWidth / 2;
                entranceY = 0;
            } else if (entranceSide === 'top') {
                entranceX = 0;
                entranceY = -buildingHeight / 2;
            } else { // bottom/front
                entranceX = 0;
                entranceY = buildingHeight / 2;
            }

            const cos = Math.cos(buildingRotation);
            const sin = Math.sin(buildingRotation);
            const worldEntranceX = landmark.x + entranceX * cos - entranceY * sin;
            const worldEntranceY = landmark.y + entranceX * sin + entranceY * cos;

            if (fixtures.length < maxFixtures) {
                fixtures.push({
                    type: types.entrance,
                    x: Math.round(clamp(worldEntranceX, 40, layout.width - 40)),
                    y: Math.round(clamp(worldEntranceY, 40, layout.height - 40)),
                    rotation: buildingRotation + (entranceSide === 'right' ? 0 : entranceSide === 'bottom' ? Math.PI/2 : entranceSide === 'left' ? Math.PI : 3*Math.PI/2),
                    size: Math.round(layout.cellSize * (0.45 + rng() * 0.15)),
                    glow: true,
                    buildingId: landmark.id,
                    purpose: 'entrance',
                    side: entranceSide
                });
            }

            // Create functional yard space around building (reduced count)
            const yardRadius = Math.max(buildingWidth, buildingHeight) * 0.75;
            const yardItemCount = landmarkIndex % 3 === 0 ? 1 : 0; // Only some landmarks get yard items
            
            for (let i = 0; i < yardItemCount && fixtures.length < maxFixtures; i++) {
                const yardAngle = buildingRotation + (landmarkIndex * 1.2); // Single item placement
                const yardDistance = yardRadius + rng() * layout.cellSize * 0.6;
                const yardX = landmark.x + Math.cos(yardAngle) * yardDistance;
                const yardY = landmark.y + Math.sin(yardAngle) * yardDistance;
                
                fixtures.push({
                    type: types.yard,
                    x: Math.round(clamp(yardX, 40, layout.width - 40)),
                    y: Math.round(clamp(yardY, 40, layout.height - 40)),
                    rotation: yardAngle,
                    size: Math.round(layout.cellSize * (0.28 + rng() * 0.12)),
                    glow: types.yard.includes('Pool'),
                    buildingId: landmark.id,
                    purpose: 'yard'
                });
            }
        });

        // Add minimal street lighting along main roads
        const mainPaths = Array.isArray(layout.paths) ? layout.paths.filter(path => path && path.id === 'main-road') : [];
        mainPaths.forEach(path => {
            if (!Array.isArray(path.points) || path.points.length < 2) return;
            
            const lightingPositions = [0.5]; // Just one central light per road
            lightingPositions.forEach(t => {
                if (fixtures.length >= maxFixtures) return;
                const base = pointOnPolyline(path.points, t);
                const side = 1; // Consistent side placement
                const streetOffset = path.width * 0.9;
                
                fixtures.push({
                    type: types.light,
                    x: Math.round(clamp(base.x + base.normalX * streetOffset * side, 40, layout.width - 40)),
                    y: Math.round(clamp(base.y + base.normalY * streetOffset * side, 40, layout.height - 40)),
                    rotation: Math.atan2(base.normalY * side, base.normalX * side),
                    size: Math.round(layout.cellSize * (0.5 + rng() * 0.1)),
                    glow: true,
                    pathId: path.id,
                    purpose: 'streetLight'
                });
            });
        });

        // Add sparse scatter fixtures to fill empty outer zones
        const outerZoneFixtures = Math.max(8, Math.min(15, Math.floor(maxFixtures * 0.4))); // Reserve space for outer zone coverage
        for (let attempt = 0; attempt < outerZoneFixtures * 3 && fixtures.length < maxFixtures; attempt++) {
            const x = 60 + rng() * (layout.width - 120);
            const y = 60 + rng() * (layout.height - 120);
            
            // Check if this position is in an empty outer zone (away from roads and landmarks)
            let inOuterZone = true;
            let tooClose = false;
            
            // Check distance from landmarks
            if (Array.isArray(layout.landmarks)) {
                layout.landmarks.forEach(landmark => {
                    const dist = Math.sqrt((x - landmark.x) ** 2 + (y - landmark.y) ** 2);
                    if (dist < (landmark.radius || layout.cellSize * 2) + layout.cellSize * 3) {
                        inOuterZone = false;
                    }
                });
            }
            
            // Check distance from paths
            if (Array.isArray(layout.paths)) {
                layout.paths.forEach(path => {
                    if (!Array.isArray(path.points)) return;
                    path.points.forEach(point => {
                        const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
                        if (dist < (path.width || 150) + layout.cellSize * 2) {
                            inOuterZone = false;
                        }
                    });
                });
            }
            
            // Check distance from existing fixtures to avoid clustering
            fixtures.forEach(fixture => {
                const dist = Math.sqrt((x - fixture.x) ** 2 + (y - fixture.y) ** 2);
                if (dist < layout.cellSize * 4) {
                    tooClose = true;
                }
            });
            
            // Check spawn/exit zones
            const spawnDist = Math.sqrt((x - layout.spawnZone.x) ** 2 + (y - layout.spawnZone.y) ** 2);
            const exitDist = Math.sqrt((x - layout.exitZone.x) ** 2 + (y - layout.exitZone.y) ** 2);
            if (spawnDist < layout.spawnZone.radius + layout.cellSize * 2 || 
                exitDist < layout.exitZone.radius + layout.cellSize * 2) {
                inOuterZone = false;
            }
            
            if (inOuterZone && !tooClose && isPointWalkable(layout, x, y, layout.cellSize)) {
                fixtures.push({
                    type: rng() > 0.7 ? types.infrastructure : types.corner,
                    x: Math.round(x),
                    y: Math.round(y),
                    rotation: rng() * Math.PI * 2,
                    size: Math.round(layout.cellSize * (0.25 + rng() * 0.15)),
                    glow: false,
                    purpose: 'scatter'
                });
            }
        }

        const narrativeTypes = {
            swarm: 'sporeScript',
            prism: 'facetEtching',
            fortress: 'chalkMark',
            fractal: 'glitchSigil',
            vortex: 'voidScrawl',
            endless: 'lostNote'
        };
        const narrativeCap = 2;
        let narrativeAdded = 0;
        if (rng() < 0.15) {
            const mainRoad = getMainRoadPath(layout);
            for (let attempt = 0; attempt < 12 && narrativeAdded < narrativeCap && fixtures.length < maxFixtures; attempt++) {
                const t = 0.2 + rng() * 0.65;
                const base = mainRoad ? pointOnPolyline(mainRoad.points, t) : { x: layout.width / 2, y: layout.height / 2, normalX: 0, normalY: 1 };
                const x = clamp(base.x + base.normalX * layout.cellSize * (0.8 + rng()), 40, layout.width - 40);
                const y = clamp(base.y + base.normalY * layout.cellSize * (0.8 + rng()), 40, layout.height - 40);
                if (!isPointWalkable(layout, x, y, layout.cellSize * 0.5)) continue;
                fixtures.push({
                    type: narrativeTypes[layout.biomeId] || 'lostNote',
                    x: Math.round(x),
                    y: Math.round(y),
                    rotation: rng() * 0.4 - 0.2,
                    size: Math.round(layout.cellSize * (0.22 + rng() * 0.1)),
                    glow: false,
                    purpose: 'narrative',
                    districtType: layout.landmarks[0] && layout.landmarks[0].districtType
                });
                narrativeAdded++;
            }
        }

        return fixtures;
    }

    function carveBossSafety(layout) {
        clearCircle(layout, layout.width / 2, layout.height / 2, 430);
        clearCircle(layout, layout.spawnZone.x, layout.spawnZone.y, layout.spawnZone.radius + 100);
        clearCircle(layout, layout.exitZone.x, layout.exitZone.y, layout.exitZone.radius + 100);
        clearRect(layout, 0, layout.height / 2 - 120, layout.width, 240);
        clearRect(layout, layout.width / 2 - 140, 0, 280, layout.height);
    }

    function generateCellular(layout, rng, plan) {
        const fillChance = (plan.biome.generation && plan.biome.generation.fillChance) || 0.18;
        for (let row = 1; row < layout.rows - 1; row++) {
            for (let col = 1; col < layout.cols - 1; col++) {
                if (rng() < fillChance) {
                    setCell(layout, col, row, BLOCKED);
                }
            }
        }

        const passes = (plan.biome.generation && plan.biome.generation.smoothingPasses) || 2;
        for (let pass = 0; pass < passes; pass++) {
            const next = layout.grid.slice();
            for (let row = 1; row < layout.rows - 1; row++) {
                for (let col = 1; col < layout.cols - 1; col++) {
                    let blockedNeighbors = 0;
                    for (let oy = -1; oy <= 1; oy++) {
                        for (let ox = -1; ox <= 1; ox++) {
                            if (ox === 0 && oy === 0) continue;
                            if (getCell(layout, col + ox, row + oy) === BLOCKED) blockedNeighbors++;
                        }
                    }
                    next[index(layout, col, row)] = blockedNeighbors >= 5 ? BLOCKED : WALKABLE;
                }
            }
            layout.grid = next;
            reserveZones(layout);
        }

        // Record larger CA blockers as coarse visual cells instead of extracted physics primitives.
        layout.visualMotifs.push({ type: 'cellularClusters', density: fillChance });

        let blockedCount = 0;
        for (let i = 0; i < layout.grid.length; i++) {
            if (layout.grid[i] === BLOCKED) blockedCount++;
        }

        // Low-density CA can smooth itself into a blank room. Keep Swarm rooms visibly shaped.
        let clusterAttempts = 0;
        const targetBlockedCells = Math.max(48, Math.floor(layout.grid.length * 0.055));
        while (blockedCount < targetBlockedCells && clusterAttempts < 36) {
            const x = randomInt(rng, 6, layout.cols - 7) * layout.cellSize + layout.cellSize / 2;
            const y = randomInt(rng, 3, layout.rows - 4) * layout.cellSize + layout.cellSize / 2;
            const reserved = [layout.spawnZone, layout.exitZone, { x: layout.width / 2, y: layout.height / 2, radius: 220 }];
            let overlapsReserved = false;
            for (let i = 0; i < reserved.length; i++) {
                const zone = reserved[i];
                const dx = x - zone.x;
                const dy = y - zone.y;
                if (Math.sqrt(dx * dx + dy * dy) < zone.radius + layout.cellSize * 1.5) {
                    overlapsReserved = true;
                    break;
                }
            }
            if (!overlapsReserved) {
                stampHiveStructure(layout, x, y, rng() < 0.5 ? 0.95 : 1.25);
                blockedCount = 0;
                for (let i = 0; i < layout.grid.length; i++) {
                    if (layout.grid[i] === BLOCKED) blockedCount++;
                }
            }
            clusterAttempts++;
        }

        reserveZones(layout);
    }

    function generateFortress(layout, rng, plan) {
        // Fortress rooms are composed by the semantic road/ward pass below.
        // The old BSP wall field produced maze-like rooms that fought the main route.
        // Keep this strategy as a clean staging layer so landmarks, yards, and service
        // roads become the only solid structures in normal Fortress rooms.
        reserveZones(layout);
        layout.visualMotifs.push({
            type: 'fortressWardPlan',
            density: (plan.biome.generation && plan.biome.generation.wallCount) || 3
        });
    }

    function generatePrefab(layout, rng, plan) {
        const count = Math.max(5, Math.floor(((plan.biome.generation && plan.biome.generation.stampCount) || 8) * 0.75));
        for (let i = 0; i < count; i++) {
            const x = randomInt(rng, 7, layout.cols - 8) * layout.cellSize + layout.cellSize / 2;
            const y = randomInt(rng, 3, layout.rows - 4) * layout.cellSize + layout.cellSize / 2;
            stampCrystalStructure(layout, x, y, 0.9 + rng() * 0.55);
        }

        for (let i = 0; i < 4; i++) {
            const x = randomInt(rng, 8, layout.cols - 9) * layout.cellSize + layout.cellSize / 2;
            const y = randomInt(rng, 4, layout.rows - 5) * layout.cellSize + layout.cellSize / 2;
            stampCrystalStructure(layout, x, y, 0.75);
        }
    }

    function generateRecursive(layout, rng) {
        const centerX = layout.width / 2;
        const centerY = layout.height / 2;
        const radii = [260, 170, 110];
        for (let i = 0; i < radii.length; i++) {
            const offset = i % 2 === 0 ? -1 : 1;
            stampFractalStructure(layout, centerX + offset * (360 + i * 80), centerY - 220 + i * 220, radii[i] / layout.cellSize * 0.55);
            stampFractalStructure(layout, centerX - offset * (360 + i * 80), centerY + 220 - i * 180, radii[i] / layout.cellSize * 0.42);
        }
        for (let i = 0; i < 4; i++) {
            stampCircle(layout, randomInt(rng, 8, layout.cols - 9) * layout.cellSize, randomInt(rng, 4, layout.rows - 5) * layout.cellSize, layout.cellSize, { preset: 'destructibleCover', destructible: true });
        }
        for (let i = 0; i < 6; i++) {
            const scale = 1 + (i % 3) * 0.45;
            const x = randomInt(rng, 7, layout.cols - 8) * layout.cellSize;
            const y = randomInt(rng, 3, layout.rows - 4) * layout.cellSize;
            stampFractalStructure(layout, x, y, scale * 0.65, { motif: 'recursiveRelic' });
        }
    }

    function generateRadial(layout) {
        const centerX = layout.width / 2;
        const centerY = layout.height / 2;
        const arms = 6;
        for (let i = 0; i < arms; i++) {
            const angle = (Math.PI * 2 * i) / arms;
            for (let step = 4; step <= 11; step++) {
                if (step === 6 || step === 9) continue;
                const x = centerX + Math.cos(angle) * step * layout.cellSize;
                const y = centerY + Math.sin(angle) * step * layout.cellSize;
                stampVortexStructure(layout, x, y, 0.75);
            }
        }
        layout.visualMotifs.push({ type: 'radialRings', centerX, centerY });
    }

    function generateSwarmBossArena(layout, rng) {
        const centerX = layout.width / 2;
        const centerY = layout.height / 2;
        const clusters = 14;
        for (let i = 0; i < clusters; i++) {
            const angle = (Math.PI * 2 * i) / clusters + rng() * 0.25;
            const radius = 520 + rng() * 360;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius * 0.65;
            stampHiveStructure(layout, x, y, 0.9 + rng() * 0.5, { motif: 'swarmNest' });
        }
        carveBossSafety(layout);
        layout.visualMotifs.push({ type: 'swarmBossArena', centerX, centerY });
    }

    function generatePrismBossArena(layout, rng) {
        const centerX = layout.width / 2;
        const centerY = layout.height / 2;
        const lanes = [
            { x: centerX - 560, y: centerY - 300 },
            { x: centerX + 560, y: centerY + 300 },
            { x: centerX + 560, y: centerY - 300 },
            { x: centerX - 560, y: centerY + 300 }
        ];
        lanes.forEach(point => {
            stampCrystalStructure(layout, point.x, point.y, 1.15, { motif: 'prismAnchor' });
        });
        for (let i = 0; i < 8; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const x = centerX + side * (360 + rng() * 420);
            const y = centerY + (rng() - 0.5) * 760;
            stampCrystalStructure(layout, x, y, 0.75 + rng() * 0.35, { motif: 'prismShard' });
        }
        clearRect(layout, centerX - 760, centerY - 150, 1520, 300);
        clearRect(layout, centerX - 150, centerY - 520, 300, 1040);
        carveBossSafety(layout);
        layout.visualMotifs.push({ type: 'prismDashLanes', centerX, centerY });
    }

    function generateFortressBossArena(layout, rng) {
        const centerX = layout.width / 2;
        const centerY = layout.height / 2;
        const wallThickness = layout.cellSize;
        const laneGap = layout.cellSize * 5;
        const walls = [
            { x: centerX - 520, y: 160, width: wallThickness, height: centerY - laneGap / 2 - 160 },
            { x: centerX - 520, y: centerY + laneGap / 2, width: wallThickness, height: centerY - laneGap / 2 - 160 },
            { x: centerX + 520, y: 160, width: wallThickness, height: centerY - laneGap / 2 - 160 },
            { x: centerX + 520, y: centerY + laneGap / 2, width: wallThickness, height: centerY - laneGap / 2 - 160 },
            { x: 420, y: centerY - 320, width: 360, height: wallThickness },
            { x: layout.width - 780, y: centerY + 320, width: 360, height: wallThickness }
        ];
        walls.forEach(wall => stampRect(layout, wall.x, wall.y, wall.width, wall.height, { preset: 'solid', motif: 'fortressWall', structure: 'fortress' }));
        for (let i = 0; i < 4; i++) {
            const x = centerX + (i < 2 ? -1 : 1) * (260 + rng() * 180);
            const y = centerY + (i % 2 === 0 ? -1 : 1) * (230 + rng() * 120);
            stampFortressStructure(layout, x, y, 2, 2, { preset: 'destructibleCover', destructible: true, motif: 'fortressCover' });
        }
        carveBossSafety(layout);
        layout.visualMotifs.push({ type: 'fortressBossLanes', centerX, centerY });
    }

    function generateFractalBossArena(layout, rng) {
        const centerX = layout.width / 2;
        const centerY = layout.height / 2;
        const rings = [520, 700, 860];
        rings.forEach((ring, ringIndex) => {
            const count = 4 + ringIndex * 2;
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 * i) / count + ringIndex * 0.35;
                const x = centerX + Math.cos(angle) * ring;
                const y = centerY + Math.sin(angle) * ring * 0.58;
                stampFractalStructure(layout, x, y, 0.85 + ringIndex * 0.2, { motif: 'fractalIsland' });
            }
        });
        for (let i = 0; i < 6; i++) {
            const x = centerX + (rng() - 0.5) * 1300;
            const y = centerY + (rng() - 0.5) * 720;
            stampFractalStructure(layout, x, y, 0.55, { preset: 'destructibleCover', destructible: true, motif: 'fractalFragment' });
        }
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8 + 0.2;
            const x = centerX + Math.cos(angle) * 940;
            const y = centerY + Math.sin(angle) * 470;
            stampFractalStructure(layout, x, y, 0.75, { motif: 'outerFractalIsland' });
        }
        carveBossSafety(layout);
        layout.visualMotifs.push({ type: 'fractalBossIslands', centerX, centerY });
    }

    function generateVortexBossArena(layout) {
        const centerX = layout.width / 2;
        const centerY = layout.height / 2;
        const arms = 10;
        for (let i = 0; i < arms; i++) {
            const angle = (Math.PI * 2 * i) / arms;
            for (let step = 10; step <= 16; step += 2) {
                const x = centerX + Math.cos(angle + step * 0.13) * step * layout.cellSize;
                const y = centerY + Math.sin(angle + step * 0.13) * step * layout.cellSize * 0.78;
                stampVortexStructure(layout, x, y, 0.72, { motif: 'vortexAnchor' });
            }
        }
        clearCircle(layout, centerX, centerY, 520);
        carveBossSafety(layout);
        layout.visualMotifs.push({ type: 'vortexOrbitLanes', centerX, centerY });
    }

    function generateBossArena(layout, rng, plan) {
        switch (plan.biomeId) {
            case 'swarm':
                generateSwarmBossArena(layout, rng);
                break;
            case 'prism':
                generatePrismBossArena(layout, rng);
                break;
            case 'fortress':
                generateFortressBossArena(layout, rng);
                break;
            case 'fractal':
                generateFractalBossArena(layout, rng);
                break;
            case 'vortex':
                generateVortexBossArena(layout);
                break;
            default:
                generateRadial(layout);
                carveBossSafety(layout);
                break;
        }
    }

    function generateFallback(layout, fallbackId) {
        layout.generatedByFallback = true;
        layout.fallbackId = fallbackId;
        if (fallbackId === 'twoLane') {
            stampRect(layout, layout.width / 2 - layout.cellSize / 2, layout.cellSize * 2, layout.cellSize, layout.height / 2 - layout.cellSize * 3, { preset: 'solid' });
            stampRect(layout, layout.width / 2 - layout.cellSize / 2, layout.height / 2 + layout.cellSize, layout.cellSize, layout.height / 2 - layout.cellSize * 3, { preset: 'solid' });
        } else if (fallbackId === 'centralIsland') {
            stampCircle(layout, layout.width / 2, layout.height / 2, 180, { preset: 'solid' });
        }
    }

    function runStrategy(layout, rng, plan) {
        if (plan.roomType === 'safe' || plan.roomType === 'treasure' || plan.roomType === 'rest') {
            return;
        }
        if (plan.roomType === 'boss') {
            generateBossArena(layout, rng, plan);
            return;
        }
        switch (plan.layoutStrategy) {
            case 'bsp':
                generateFortress(layout, rng, plan);
                break;
            case 'prefab':
                generatePrefab(layout, rng, plan);
                break;
            case 'recursive':
                generateRecursive(layout, rng, plan);
                break;
            case 'radial':
                generateRadial(layout, rng, plan);
                break;
            case 'hybrid':
                generateCellular(layout, rng, plan);
                generatePrefab(layout, rng, plan);
                break;
            case 'cellular':
            default:
                generateCellular(layout, rng, plan);
                break;
        }
        generateRoadArchetype(layout, rng, plan);
    }

    function floodFill(layout, start) {
        const startCell = worldToCell(layout, start.x, start.y);
        if (getCell(layout, startCell.col, startCell.row) === BLOCKED) return new Set();
        const seen = new Set();
        const queue = [startCell];
        seen.add(`${startCell.col},${startCell.row}`);
        while (queue.length > 0) {
            const cell = queue.shift();
            const neighbors = [
                { col: cell.col + 1, row: cell.row },
                { col: cell.col - 1, row: cell.row },
                { col: cell.col, row: cell.row + 1 },
                { col: cell.col, row: cell.row - 1 }
            ];
            neighbors.forEach(next => {
                const key = `${next.col},${next.row}`;
                if (!seen.has(key) && inGrid(layout, next.col, next.row) && getCell(layout, next.col, next.row) === WALKABLE) {
                    seen.add(key);
                    queue.push(next);
                }
            });
        }
        return seen;
    }

    function validateRoomLayout(layout, plan) {
        reserveZones(layout);
        const seen = floodFill(layout, layout.spawnZone);
        const exitCell = worldToCell(layout, layout.exitZone.x, layout.exitZone.y);
        const exitReachable = seen.has(`${exitCell.col},${exitCell.row}`);
        let walkable = 0;
        for (let i = 0; i < layout.grid.length; i++) {
            if (layout.grid[i] === WALKABLE) walkable++;
        }
        const openRatio = walkable / layout.grid.length;
        const minOpenRatio = (plan.biome.generation && plan.biome.generation.minOpenRatio) || 0.68;
        const mainAreaRatio = seen.size / Math.max(1, walkable);
        const valid = exitReachable && openRatio >= minOpenRatio && mainAreaRatio >= 0.85;
        layout.validation = { valid, exitReachable, openRatio, mainAreaRatio, minOpenRatio };
        return layout.validation;
    }

    function packedGridChecksum(grid) {
        let hash = 2166136261;
        for (let i = 0; i < grid.length; i++) {
            hash ^= grid[i] + i;
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function canonicalLayout(layout) {
        return {
            layoutVersion: layout.layoutVersion,
            seed: layout.seed,
            biomeId: layout.biomeId,
            roomType: layout.roomType,
            width: layout.width,
            height: layout.height,
            cols: layout.cols,
            rows: layout.rows,
            cellSize: layout.cellSize,
            gridChecksum: packedGridChecksum(layout.grid),
            obstacles: layout.obstacles.map(o => ({
                shape: o.shape,
                x: Math.round(o.x || 0),
                y: Math.round(o.y || 0),
                width: Math.round(o.width || 0),
                height: Math.round(o.height || 0),
                radius: Math.round(o.radius || 0),
                preset: o.preset,
                blocksMovement: !!o.blocksMovement,
                blocksProjectiles: !!o.blocksProjectiles,
                destructible: !!o.destructible,
                pierceable: !!o.pierceable,
                exceptionReason: o.exceptionReason || null
            })),
            spawnZone: layout.spawnZone,
            exitZone: layout.exitZone,
            visualMotifs: layout.visualMotifs,
            archetype: layout.archetype,
            entranceVariant: layout.entranceVariant,
            paths: layout.paths,
            landmarks: layout.landmarks,
            encounterZones: layout.encounterZones,
            plazas: layout.plazas,
            trailMarkers: layout.trailMarkers,
            contentLimits: layout.contentLimits,
            decorationSeed: layout.decorationSeed,
            decorationProfile: layout.decorationProfile
        };
    }

    function computeLayoutHash(layout) {
        return hashString(JSON.stringify(canonicalLayout(layout))).toString(16);
    }

    function ensureSpawnExitWalkable(layout) {
        if (!layout || !layout.spawnZone || !layout.exitZone) return;
        clearCircle(layout, layout.spawnZone.x, layout.spawnZone.y, layout.spawnZone.radius + layout.cellSize * 1.4);
        clearCircle(layout, layout.exitZone.x, layout.exitZone.y, layout.exitZone.radius + layout.cellSize * 1.6);
    }

    function generateRoomLayout(plan, seed) {
        const baseSeed = seed || `${plan.gameMode}:${plan.roomNumber}:${plan.roomType}:${plan.biomeId}:v${LAYOUT_VERSION}`;
        const maxAttempts = 8;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const attemptSeed = `${baseSeed}:attempt:${attempt}`;
            const rng = createRng(attemptSeed);
            const layout = makeBaseLayout(plan, baseSeed);
            if (!plan.archetype) {
                plan.archetype = pickArchetype(plan, createRng(`${baseSeed}:archetype`));
            }
            layout.archetype = plan.archetype;
            runStrategy(layout, rng, plan);
            reserveZones(layout);
            const validation = validateRoomLayout(layout, plan);
            if (!validation.valid) continue;

            let playability = validatePlayability(layout, plan);
            if (!playability.valid && attempt >= 3) {
                const mainRoad = getMainRoadPath(layout);
                if (mainRoad && (playability.angleQuality < 0.1 || playability.angleQuality > 1.05)) {
                    if (applyForcedRoadBend(mainRoad, layout, rng)) {
                        carvePath(layout, mainRoad);
                        reinforceRouteTraversability(layout);
                        playability = validatePlayability(layout, plan);
                    }
                }
            }

            if (playability.valid) {
                applyEdgeDensityTunnel(layout, rng);
                ensureSpawnExitWalkable(layout);
                layout.hash = computeLayoutHash(layout);
                return layout;
            }
        }

        const fallbackIds = ['open', 'twoLane', 'centralIsland'];
        const fallbackId = fallbackIds[hashString(baseSeed) % fallbackIds.length];
        const fallback = makeBaseLayout(plan, baseSeed);
        const fallbackRng = createRng(`${baseSeed}:fallback`);
        generateFallback(fallback, fallbackId);
        generateRoadArchetype(fallback, fallbackRng, plan);
        reserveZones(fallback);
        validateRoomLayout(fallback, plan);
        if (!fallback.validation.valid) {
            fallback.grid = createEmptyGrid(fallback.cols, fallback.rows, WALKABLE);
            fallback.obstacles = [];
            fallback.generatedByFallback = true;
            fallback.fallbackId = 'minimalOpen';
            validateRoomLayout(fallback, plan);
            if (typeof console !== 'undefined') {
                console.warn(`[RoomGen] Minimal fallback used for room ${plan.roomNumber} (${plan.biomeId})`);
            }
        }
        ensureSpawnExitWalkable(fallback);
        fallback.hash = computeLayoutHash(fallback);
        return fallback;
    }

    function isPointWalkable(layout, x, y, radius) {
        if (!layout || !layout.grid) return true;
        return !isCircleBlockedAt(layout, x, y, radius);
    }

    function hasPathBetween(layout, from, to) {
        if (!layout) return true;
        const seen = floodFill(layout, from);
        const target = worldToCell(layout, to.x, to.y);
        return seen.has(`${target.col},${target.row}`);
    }

    function canTraverseBetweenCells(layout, fromCol, fromRow, toCol, toRow, radius) {
        if (!layout || !inGrid(layout, toCol, toRow)) return false;
        const toCenter = cellCenter(layout, toCol, toRow);
        if (!isPointWalkable(layout, toCenter.x, toCenter.y, radius)) return false;
        if (fromCol === toCol && fromRow === toRow) return true;
        const fromCenter = cellCenter(layout, fromCol, fromRow);
        return isProjectilePathClear(layout, fromCenter, toCenter, radius);
    }

    function findNearestWalkablePoint(layout, x, y, radius) {
        const cell = findNearestPathableCell(layout, { x, y }, radius);
        if (!cell) return null;
        const center = cellCenter(layout, cell.col, cell.row);
        if (!isPointWalkable(layout, center.x, center.y, radius)) return null;
        return { x: center.x, y: center.y };
    }

    function findUnstuckPosition(layout, x, y, radius, previousX, previousY) {
        if (!layout) return null;
        if (Number.isFinite(previousX) && Number.isFinite(previousY) &&
            isPointWalkable(layout, previousX, previousY, radius)) {
            return { x: previousX, y: previousY };
        }

        const cellSize = layout.cellSize || 40;
        const maxRing = 10;
        for (let ring = 1; ring <= maxRing; ring++) {
            const angleSteps = Math.max(10, ring * 5);
            const dist = ring * cellSize * 0.55;
            for (let i = 0; i < angleSteps; i++) {
                const angle = (i / angleSteps) * Math.PI * 2;
                const nx = x + Math.cos(angle) * dist;
                const ny = y + Math.sin(angle) * dist;
                if (!isPointWalkable(layout, nx, ny, radius)) continue;
                if (Number.isFinite(previousX) && Number.isFinite(previousY)) {
                    const retreat = Math.hypot(nx - previousX, ny - previousY);
                    if (retreat < radius * 0.2) continue;
                }
                return { x: nx, y: ny };
            }
        }

        return findNearestWalkablePoint(layout, x, y, radius);
    }

    function findNearestPathableCell(layout, point, radius) {
        if (!layout || !point) return null;
        const start = worldToCell(layout, point.x, point.y);
        const canStandAtCell = (col, row) => {
            if (!inGrid(layout, col, row)) return false;
            const center = cellCenter(layout, col, row);
            return isPointWalkable(layout, center.x, center.y, radius);
        };
        if (canStandAtCell(start.col, start.row)) return start;

        const maxRing = Math.max(layout.cols, layout.rows);
        for (let ring = 1; ring <= maxRing; ring++) {
            for (let row = start.row - ring; row <= start.row + ring; row++) {
                for (let col = start.col - ring; col <= start.col + ring; col++) {
                    if (Math.abs(col - start.col) !== ring && Math.abs(row - start.row) !== ring) continue;
                    if (canStandAtCell(col, row)) return { col, row };
                }
            }
        }
        return null;
    }

    function findPath(layout, from, to, radius, options) {
        if (!layout || !layout.grid || !from || !to) return null;
        const opts = options || {};
        const radiusPadding = opts.radiusPadding != null
            ? opts.radiusPadding
            : Math.max(2, (layout.cellSize || 40) * 0.04);
        const entityRadius = (radius || 0) + radiusPadding;
        const start = findNearestPathableCell(layout, from, entityRadius);
        const goal = findNearestPathableCell(layout, to, entityRadius);
        if (!start || !goal) return null;
        if (start.col === goal.col && start.row === goal.row) {
            const center = cellCenter(layout, goal.col, goal.row);
            return [{ x: center.x, y: center.y, col: goal.col, row: goal.row }];
        }

        const cacheKey = `${start.col},${start.row}:${goal.col},${goal.row}:${Math.ceil(entityRadius / Math.max(1, layout.cellSize / 4))}`;
        layout._pathCache = layout._pathCache || new Map();
        if (layout._pathCache.has(cacheKey)) {
            return layout._pathCache.get(cacheKey).map(point => Object.assign({}, point));
        }

        const maxVisited = opts.maxVisited || Math.max(240, Math.min(1200, layout.cols * layout.rows));
        const maxPathLength = opts.maxPathLength || Math.max(80, Math.ceil(Math.max(layout.cols, layout.rows) * 0.35));
        const canStandAtCell = (col, row) => {
            if (!inGrid(layout, col, row)) return false;
            const center = cellCenter(layout, col, row);
            return isPointWalkable(layout, center.x, center.y, entityRadius);
        };
        const nodeKey = (col, row) => `${col},${row}`;
        const heuristic = (col, row) => {
            const dx = goal.col - col;
            const dy = goal.row - row;
            return Math.sqrt(dx * dx + dy * dy);
        };
        const open = [];
        const heapPush = (node) => {
            open.push(node);
            let idx = open.length - 1;
            while (idx > 0) {
                const parentIdx = (idx - 1) >> 1;
                if (open[parentIdx].f <= open[idx].f) break;
                const tmp = open[parentIdx];
                open[parentIdx] = open[idx];
                open[idx] = tmp;
                idx = parentIdx;
            }
        };
        const heapPop = () => {
            if (open.length === 0) return null;
            const top = open[0];
            const bottom = open.pop();
            if (open.length > 0) {
                open[0] = bottom;
                let idx = 0;
                const len = open.length;
                while (true) {
                    let leftIdx = (idx << 1) + 1;
                    let rightIdx = leftIdx + 1;
                    let swapIdx = idx;
                    if (leftIdx < len && open[leftIdx].f < open[swapIdx].f) {
                        swapIdx = leftIdx;
                    }
                    if (rightIdx < len && open[rightIdx].f < open[swapIdx].f) {
                        swapIdx = rightIdx;
                    }
                    if (swapIdx === idx) break;
                    const tmp = open[idx];
                    open[idx] = open[swapIdx];
                    open[swapIdx] = tmp;
                    idx = swapIdx;
                }
            }
            return top;
        };

        const startNode = {
            col: start.col,
            row: start.row,
            g: 0,
            f: heuristic(start.col, start.row),
            parent: null
        };
        heapPush(startNode);
        const best = new Map([[nodeKey(start.col, start.row), startNode]]);
        const closed = new Set();
        const neighbors = [
            { dc: 1, dr: 0, cost: 1 },
            { dc: -1, dr: 0, cost: 1 },
            { dc: 0, dr: 1, cost: 1 },
            { dc: 0, dr: -1, cost: 1 },
            { dc: 1, dr: 1, cost: Math.SQRT2 },
            { dc: -1, dr: 1, cost: Math.SQRT2 },
            { dc: 1, dr: -1, cost: Math.SQRT2 },
            { dc: -1, dr: -1, cost: Math.SQRT2 }
        ];

        let visited = 0;
        let goalNode = null;
        while (open.length > 0 && visited < maxVisited) {
            const current = heapPop();
            const currentKey = nodeKey(current.col, current.row);
            if (closed.has(currentKey)) continue;
            closed.add(currentKey);
            visited++;

            if (current.col === goal.col && current.row === goal.row) {
                goalNode = current;
                break;
            }

            for (let i = 0; i < neighbors.length; i++) {
                const neighbor = neighbors[i];
                const col = current.col + neighbor.dc;
                const row = current.row + neighbor.dr;
                const key = nodeKey(col, row);
                if (closed.has(key)) continue;
                if (!canTraverseBetweenCells(layout, current.col, current.row, col, row, entityRadius)) continue;
                if (neighbor.dc !== 0 && neighbor.dr !== 0) {
                    if (!canStandAtCell(current.col + neighbor.dc, current.row) || !canStandAtCell(current.col, current.row + neighbor.dr)) {
                        continue;
                    }
                }
                const g = current.g + neighbor.cost;
                const existing = best.get(key);
                if (existing && g >= existing.g) continue;
                const node = {
                    col,
                    row,
                    g,
                    f: g + heuristic(col, row),
                    parent: current
                };
                best.set(key, node);
                heapPush(node);
            }
        }

        if (!goalNode) return null;
        const cells = [];
        for (let node = goalNode; node && cells.length < maxPathLength; node = node.parent) {
            const center = cellCenter(layout, node.col, node.row);
            cells.push({ x: center.x, y: center.y, col: node.col, row: node.row });
        }
        const path = cells.reverse();
        if (path.length >= maxPathLength && (path[path.length - 1].col !== goal.col || path[path.length - 1].row !== goal.row)) {
            return null;
        }
        if (layout._pathCache.size > 220) layout._pathCache.clear();
        layout._pathCache.set(cacheKey, path.map(point => Object.assign({}, point)));
        return path;
    }

    function findSafeSpawnPoint(layout, rules) {
        if (!layout) return null;
        const opts = rules || {};
        const rng = opts.rng || Math.random;
        const radius = opts.radius || 25;
        const minDistanceFrom = opts.minDistanceFrom || [];
        const maxAttempts = opts.maxAttempts || 120;
        const margin = opts.margin || Math.max(50, radius);
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const x = margin + rng() * (layout.width - margin * 2);
            const y = margin + rng() * (layout.height - margin * 2);
            if (!isPointWalkable(layout, x, y, radius)) continue;
            let farEnough = true;
            for (let i = 0; i < minDistanceFrom.length; i++) {
                const point = minDistanceFrom[i];
                const dx = x - point.x;
                const dy = y - point.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < point.distance) {
                    farEnough = false;
                    break;
                }
            }
            if (!farEnough) continue;
            if (!hasPathBetween(layout, layout.spawnZone, { x, y })) continue;
            return { x, y };
        }
        return null;
    }

    function resolveCircleCollision(layout, x, y, radius, previousX, previousY) {
        if (!layout || isPointWalkable(layout, x, y, radius)) {
            return { x, y, collided: false };
        }
        const tryX = isPointWalkable(layout, x, previousY, radius);
        const tryY = isPointWalkable(layout, previousX, y, radius);
        if (tryX && !tryY) return { x, y: previousY, collided: true };
        if (!tryX && tryY) return { x: previousX, y, collided: true };
        if (tryX && tryY) {
            if (Math.abs(x - previousX) >= Math.abs(y - previousY)) {
                return { x, y: previousY, collided: true };
            } else {
                return { x: previousX, y, collided: true };
            }
        }
        if (isPointWalkable(layout, previousX, previousY, radius)) {
            return { x: previousX, y: previousY, collided: true };
        }

        const origins = [{ x, y }, { x: previousX, y: previousY }, layout.spawnZone];
        for (let originIndex = 0; originIndex < origins.length; originIndex++) {
            const origin = origins[originIndex];
            if (!origin) continue;
            for (let ring = 1; ring <= 8; ring++) {
                const searchRadius = ring * layout.cellSize;
                const samples = 12 + ring * 4;
                for (let i = 0; i < samples; i++) {
                    const angle = (Math.PI * 2 * i) / samples;
                    const candidateX = origin.x + Math.cos(angle) * searchRadius;
                    const candidateY = origin.y + Math.sin(angle) * searchRadius;
                    if (isPointWalkable(layout, candidateX, candidateY, radius)) {
                        return { x: candidateX, y: candidateY, collided: true };
                    }
                }
            }
        }

        return { x: previousX, y: previousY, collided: true };
    }

    function isProjectilePathClear(layout, from, to, radius) {
        if (!layout) return true;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.ceil(distance / Math.max(8, layout.cellSize / 3)));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = from.x + dx * t;
            const y = from.y + dy * t;
            if (!isPointWalkable(layout, x, y, radius || 0)) return false;
        }
        return true;
    }

    function serializeLayout(layout) {
        if (!layout) return null;
        return {
            layoutVersion: layout.layoutVersion,
            seed: layout.seed,
            biomeId: layout.biomeId,
            bossTheme: layout.bossTheme,
            roomType: layout.roomType,
            strategy: layout.strategy,
            width: layout.width,
            height: layout.height,
            cellSize: layout.cellSize,
            cols: layout.cols,
            rows: layout.rows,
            grid: layout.grid.slice(),
            obstacles: layout.obstacles,
            visualMotifs: layout.visualMotifs,
            archetype: layout.archetype,
            entranceVariant: layout.entranceVariant,
            paths: layout.paths,
            landmarks: layout.landmarks,
            encounterZones: layout.encounterZones,
            plazas: layout.plazas,
            trailMarkers: layout.trailMarkers,
            contentLimits: layout.contentLimits,
            decorationSeed: layout.decorationSeed,
            decorationProfile: layout.decorationProfile,
            spawnZone: layout.spawnZone,
            exitZone: layout.exitZone,
            generatedByFallback: layout.generatedByFallback,
            fallbackId: layout.fallbackId || null,
            validation: layout.validation,
            hash: layout.hash
        };
    }

    function hydrateLayout(data) {
        if (!data) return null;
        return Object.assign({}, data, {
            grid: Array.isArray(data.grid) ? data.grid.slice() : [],
            obstacles: Array.isArray(data.obstacles) ? data.obstacles.slice() : [],
            visualMotifs: Array.isArray(data.visualMotifs) ? data.visualMotifs.slice() : [],
            paths: Array.isArray(data.paths) ? data.paths.slice() : [],
            landmarks: Array.isArray(data.landmarks) ? data.landmarks.slice() : [],
            encounterZones: Array.isArray(data.encounterZones) ? data.encounterZones.slice() : [],
            trailMarkers: Array.isArray(data.trailMarkers) ? data.trailMarkers.slice() : [],
            contentLimits: data.contentLimits || null,
            decorationSeed: data.decorationSeed || (data.seed ? `${data.seed}:decorations` : 'decorations'),
            decorationProfile: data.decorationProfile || 'defaultDust'
        });
    }

    const _pathfindingQueue = [];
    function queuePathfinding(layout, from, to, radius, options, callback) {
        _pathfindingQueue.push({ layout, from, to, radius, options, callback });
    }
    function processPathfindingQueue(maxPerFrame = 2) {
        const count = Math.min(maxPerFrame, _pathfindingQueue.length);
        for (let i = 0; i < count; i++) {
            const request = _pathfindingQueue.shift();
            if (request) {
                const path = findPath(request.layout, request.from, request.to, request.radius, request.options);
                request.callback(path);
            }
        }
    }
    function clearPathfindingQueue() {
        _pathfindingQueue.length = 0;
    }

    const api = {
        LAYOUT_VERSION,
        WALKABLE,
        BLOCKED,
        buildRoomPlan,
        pickArchetype,
        getRoomDimensions,
        getContentLimits,
        getRouteTravelLength,
        pickEntranceVariantId,
        resolveRoomDimensionsForVariant,
        generateRoomLayout,
        validateRoomLayout,
        validatePlayability,
        findDetourMergeT,
        isValidDetourMergePoint,
        distanceToPolyline,
        polylineLength,
        isPathSeparatedFromPolyline,
        findSafeSpawnPoint,
        findNearestWalkablePoint,
        findUnstuckPosition,
        canTraverseBetweenCells,
        isPointWalkable,
        hasPathBetween,
        findPath,
        resolveCircleCollision,
        isProjectilePathClear,
        computeLayoutHash,
        serializeLayout,
        hydrateLayout,
        generateDecorations,
        generateSceneryFixtures,
        createRng,
        clearRect,
        getPlayerSpawnProtectionDistance,
        isInsidePlayerSpawnProtection,
        pointOnPolyline,
        getMainRoadPath,
        buildRouteSpawnGroups,
        scatterEnemyInGroup,
        queuePathfinding,
        processPathfindingQueue,
        clearPathfindingQueue
    };

    if (typeof window !== 'undefined') {
        window.RoomLayoutGenerator = api;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();

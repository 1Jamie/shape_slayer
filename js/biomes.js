// Shared biome/progression definitions for room generation and rendering.
(function () {
    const BIOME_DEFINITIONS = {
        swarm: {
            id: 'swarm',
            bossTheme: 'Swarm King',
            layoutStrategy: 'cellular',
            baseColor: '#1a2518',
            gridColor: 'rgba(150, 200, 100, 0.12)',
            gridSize: 50,
            accentColor: '#8fcc66',
            pattern: 'grid',
            generation: { fillChance: 0.18, smoothingPasses: 2, minOpenRatio: 0.72 },
            obstaclePreset: 'solid',
            scenery: {
                roadType: 'hiveTrail',
                roadColor: 'rgba(143, 204, 102, 0.18)',
                landmarkTypes: ['hiveNest', 'broodCluster', 'amberGrowth', 'queenCell', 'sporeNursery'],
                decorationProfile: 'swarmGrowth',
                decorationTypes: ['spore', 'amberVein', 'hexCell'],
                structureDensity: 0.75,
                districtType: 'hiveField',
                plazaType: 'broodYard'
            }
        },
        prism: {
            id: 'prism',
            bossTheme: 'Twin Prism',
            layoutStrategy: 'prefab',
            baseColor: '#1a1525',
            gridColor: 'rgba(150, 200, 255, 0.15)',
            gridSize: 60,
            accentColor: '#6699ff',
            pattern: 'triangle',
            generation: { stampCount: 8, minOpenRatio: 0.70 },
            obstaclePreset: 'solid',
            scenery: {
                roadType: 'crystalCauseway',
                roadColor: 'rgba(102, 153, 255, 0.20)',
                landmarkTypes: ['crystalGrove', 'prismArch', 'lightSpire', 'lensArray', 'mirrorWell'],
                decorationProfile: 'prismShards',
                decorationTypes: ['smallShard', 'lightFacet', 'triGlyph'],
                structureDensity: 0.68,
                districtType: 'refractionCourt',
                plazaType: 'mirrorPlaza'
            }
        },
        fortress: {
            id: 'fortress',
            bossTheme: 'Fortress',
            layoutStrategy: 'bsp',
            baseColor: '#25201a',
            gridColor: 'rgba(180, 160, 140, 0.1)',
            gridSize: 40,
            accentColor: '#cc9966',
            pattern: 'grid',
            generation: { wallCount: 3, gapSize: 5, minOpenRatio: 0.72 },
            obstaclePreset: 'solid',
            scenery: {
                roadType: 'stoneRoad',
                roadColor: 'rgba(204, 153, 102, 0.17)',
                landmarkTypes: ['gatehouse', 'watchTower', 'courtyardBlock', 'barracks', 'supplyDepot'],
                decorationProfile: 'fortressDebris',
                decorationTypes: ['floorPlate', 'bannerMark', 'rubble'],
                structureDensity: 0.82,
                districtType: 'fortressWard',
                plazaType: 'supplyYard'
            }
        },
        fractal: {
            id: 'fractal',
            bossTheme: 'Fractal Core',
            layoutStrategy: 'recursive',
            baseColor: '#151a25',
            gridColor: 'rgba(255, 150, 255, 0.18)',
            gridSize: 55,
            accentColor: '#ff66ff',
            pattern: 'diagonal',
            generation: { stampCount: 10, minOpenRatio: 0.68 },
            obstaclePreset: 'solid',
            scenery: {
                roadType: 'recursiveTrace',
                roadColor: 'rgba(255, 102, 255, 0.17)',
                landmarkTypes: ['fractalRelic', 'nestedShard', 'glitchMonolith', 'logicGate', 'echoFork'],
                decorationProfile: 'fractalGlyphs',
                decorationTypes: ['miniDiamond', 'glitchCrack', 'echoShard'],
                structureDensity: 0.72,
                districtType: 'recursiveCircuit',
                plazaType: 'logicCourt'
            }
        },
        vortex: {
            id: 'vortex',
            bossTheme: 'Vortex',
            layoutStrategy: 'radial',
            baseColor: '#0f0a15',
            gridColor: 'rgba(150, 100, 200, 0.1)',
            gridSize: 45,
            accentColor: '#9966cc',
            pattern: 'rings',
            generation: { ringCount: 2, minOpenRatio: 0.74 },
            obstaclePreset: 'solid',
            scenery: {
                roadType: 'spiralWake',
                roadColor: 'rgba(153, 102, 204, 0.19)',
                landmarkTypes: ['voidAnchor', 'orbitWell', 'gravitySpire', 'eventHorizon', 'tetherArray'],
                decorationProfile: 'vortexDust',
                decorationTypes: ['dustArc', 'voidCrack', 'orbitPebble'],
                structureDensity: 0.62,
                districtType: 'orbitField',
                plazaType: 'gravityWell'
            }
        },
        endless: {
            id: 'endless',
            bossTheme: 'Endless',
            layoutStrategy: 'hybrid',
            baseColor: '#0a0a15',
            gridColor: 'rgba(200, 150, 255, 0.12)',
            gridSize: 50,
            accentColor: '#cc99ff',
            pattern: 'grid',
            generation: { minOpenRatio: 0.70 },
            obstaclePreset: 'solid',
            scenery: {
                roadType: 'corruptedRoad',
                roadColor: 'rgba(204, 153, 255, 0.18)',
                landmarkTypes: ['mixedRelic', 'brokenGate', 'voidCrystal', 'lostMonument', 'riftMarket'],
                decorationProfile: 'endlessRemnants',
                decorationTypes: ['lostShard', 'brokenPlate', 'riftScratch'],
                structureDensity: 0.78,
                districtType: 'riftDistrict',
                plazaType: 'echoYard'
            }
        }
    };

    const GEAR_PROGRESSIONS = [
        { maxRoom: 10, biomeId: 'swarm' },
        { maxRoom: 15, biomeId: 'prism' },
        { maxRoom: 20, biomeId: 'fortress' },
        { maxRoom: 25, biomeId: 'fractal' },
        { maxRoom: 30, biomeId: 'vortex' }
    ];

    const CARD_PROGRESSIONS = [
        { maxRoom: 12, biomeId: 'swarm' },
        { maxRoom: 22, biomeId: 'fortress' },
        { maxRoom: 32, biomeId: 'vortex' }
    ];

    function getBiomeIdForRoom(roomNumber, gameMode) {
        const progressions = gameMode === 'gear' ? GEAR_PROGRESSIONS : CARD_PROGRESSIONS;
        for (let i = 0; i < progressions.length; i++) {
            if (roomNumber <= progressions[i].maxRoom) {
                return progressions[i].biomeId;
            }
        }
        return 'endless';
    }

    function getBiomeDefinition(biomeId) {
        return BIOME_DEFINITIONS[biomeId] || BIOME_DEFINITIONS.endless;
    }

    function getBiomeForRoomNumber(roomNumber, gameMode) {
        return getBiomeDefinition(getBiomeIdForRoom(roomNumber, gameMode));
    }

    function getBossThemeForRoom(roomNumber, gameMode) {
        return getBiomeForRoomNumber(roomNumber, gameMode).bossTheme;
    }

    const api = {
        definitions: BIOME_DEFINITIONS,
        getBiomeIdForRoom,
        getBiomeDefinition,
        getBiomeForRoomNumber,
        getBossThemeForRoom
    };

    if (typeof window !== 'undefined') {
        window.BiomeConfig = api;
        window.BIOMES = BIOME_DEFINITIONS;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();

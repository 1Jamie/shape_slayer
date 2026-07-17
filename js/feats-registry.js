// Combat Ledger feat definitions (data-only)

const FeatsRegistry = (function () {
    const FEATS = [
        // Universal Flaw Feats (Credits)
        {
            id: 'close_call',
            name: 'Close Call',
            description: 'Complete a combat room or boss fight with less than 5% of maximum health remaining.',
            classKey: 'universal',
            reward: { credits: 150 },
            progressKey: 'closeCall',
            target: 1
        },
        {
            id: 'volcano_surfer',
            name: 'Volcano Surfer',
            description: 'Take damage from and survive an Elite\'s Volatile death explosion while under 10% maximum health.',
            classKey: 'universal',
            reward: { credits: 100 },
            progressKey: 'volcanoSurfer',
            target: 1
        },
        {
            id: 'underdog',
            name: 'Underdog',
            description: 'Defeat a biome boss after entering the arena room with less than 15% of your maximum health.',
            classKey: 'universal',
            reward: { credits: 300 },
            progressKey: 'underdog',
            target: 1
        },
        {
            id: 'perfectionist',
            name: 'Perfectionist',
            description: 'Reroll the same slot or piece of gear 5 times in a single Safe Room visit.',
            classKey: 'universal',
            reward: { credits: 100 },
            progressKey: 'sameSlotRerolls',
            target: 5
        },

        // Warrior
        {
            id: 'immovable_object',
            name: 'Immovable Object',
            description: 'Block 15 individual enemy attacks using the passive standing-still block stance in a single run.',
            classKey: 'warrior',
            reward: { shards: 15 },
            progressKey: 'blocksThisRun',
            target: 15
        },
        {
            id: 'cyclone_engine',
            name: 'Cyclone Engine',
            description: 'Extend and maintain a single Whirlwind for greater than 6 consecutive seconds via kill extensions.',
            classKey: 'warrior',
            reward: { shards: 20 },
            progressKey: 'maxWhirlwindSession',
            target: 6
        },
        {
            id: 'vanguard_thrust',
            name: 'Vanguard Thrust',
            description: 'Use the forward thrust heavy\'s invincibility frames to phase completely through a boss slam AoE.',
            classKey: 'warrior',
            reward: { shards: 25 },
            progressKey: 'vanguardThrust',
            target: 1
        },

        // Rogue
        {
            id: 'shadow_step',
            name: 'Shadow Step',
            description: 'Execute 3 perfect dodges back-to-back within a tight 5-second window.',
            classKey: 'rogue',
            reward: { shards: 20 },
            progressKey: 'shadowStep',
            target: 3
        },
        {
            id: 'surgical_strike',
            name: 'Surgical Strike',
            description: 'Land 8 consecutive critical hits strictly from a backstab spatial position without breaking weapon combo sequence.',
            classKey: 'rogue',
            reward: { shards: 15 },
            progressKey: 'consecutiveBackstabCrits',
            target: 8
        },
        {
            id: 'phantom_execution',
            name: 'Phantom Execution',
            description: 'Have a boss strike a Shadow Clone decoy less than 400ms before you land the definitive final blow on that boss.',
            classKey: 'rogue',
            reward: { shards: 30 },
            progressKey: 'phantomExecution',
            target: 1
        },

        // Tank
        {
            id: 'sonic_boom',
            name: 'Sonic Boom',
            description: 'Stun or slow 8 or more hostile shapes simultaneously with a single Shout special placement.',
            classKey: 'tank',
            reward: { shards: 15 },
            progressKey: 'shoutMultiPeak',
            target: 8
        },
        {
            id: 'vampiric_bulwark',
            name: 'Vampiric Bulwark',
            description: 'Claw back 30% of your total maximum health within a single combat room strictly through Life-Stealing Hammer strikes.',
            classKey: 'tank',
            reward: { shards: 20 },
            progressKey: 'hammerHealRoomPct',
            target: 0.3
        },
        {
            id: 'return_to_sender',
            name: 'Return to Sender',
            description: 'Shatter a fully charging elite shape entirely using the retaliatory pulse damage emitted from your Shield Wall.',
            classKey: 'tank',
            reward: { shards: 25 },
            progressKey: 'returnToSender',
            target: 1
        },

        // Mage
        {
            id: 'hyper_beam_lineup',
            name: 'Hyper-Beam Lineup',
            description: 'Pierce cleanly through 6 individual enemy bounding boxes simultaneously with a single multi-charge beam tick.',
            classKey: 'mage',
            reward: { shards: 20 },
            progressKey: 'beamPiercePeak',
            target: 6
        },
        {
            id: 'perfect_displace',
            name: 'Perfect Displace',
            description: 'Leave a stationary Decoy that successfully absorbs a lethal projectile cluster while your Blink completely clears the danger zone.',
            classKey: 'mage',
            reward: { shards: 15 },
            progressKey: 'perfectDisplace',
            target: 1
        },
        {
            id: 'artillery_barrage',
            name: 'Artillery Barrage',
            description: 'Clear an entire mid-game combat wave without a single enemy bounding box approaching within 150 pixels of your position.',
            classKey: 'mage',
            reward: { shards: 30 },
            progressKey: 'artilleryBarrage',
            target: 1
        }
    ];

    function getAll() {
        return FEATS.slice();
    }

    function getById(id) {
        return FEATS.find(f => f.id === id) || null;
    }

    function getByClass(classKey) {
        if (classKey === 'global' || classKey === 'universal') {
            return FEATS.filter(f => f.classKey === 'universal');
        }
        return FEATS.filter(f => f.classKey === classKey);
    }

    function getForTab(tabKey) {
        if (tabKey === 'global') {
            return FEATS.filter(f => f.classKey === 'universal');
        }
        return FEATS.filter(f => f.classKey === tabKey);
    }

    return {
        FEATS,
        getAll,
        getById,
        getByClass,
        getForTab
    };
})();

if (typeof window !== 'undefined') {
    window.FeatsRegistry = FeatsRegistry;
}

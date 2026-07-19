// Shape Slayer compatibility adapter for the generic engine interpolation API.
(function(root) {
    let interpolationManager = null;

    function buildConfig() {
        if (typeof MultiplayerConfig === 'undefined') return {};
        return {
            interpolationDelay: MultiplayerConfig.INTERPOLATION_DELAY,
            maxInterpolationDelay: MultiplayerConfig.MAX_INTERPOLATION_DELAY,
            extrapolationLimit: MultiplayerConfig.EXTRAPOLATION_LIMIT,
            stateBufferSize: MultiplayerConfig.STATE_BUFFER_SIZE,
            snapDistance: MultiplayerConfig.SNAP_DISTANCE,
            extrapolationWeight: MultiplayerConfig.EXTRAPOLATION_WEIGHT,
            smoothingFactor: MultiplayerConfig.SMOOTHING_FACTOR,
            maxExtrapolationDistance: MultiplayerConfig.MAX_EXTRAPOLATION_DISTANCE
        };
    }

    function initInterpolation() {
        if (!interpolationManager) {
            interpolationManager = new Engine.Net.Interpolator({
                config: buildConfig(),
                getStats() {
                    if (typeof multiplayerManager !== 'undefined' &&
                        multiplayerManager &&
                        typeof multiplayerManager.getPacketMetrics === 'function') {
                        return multiplayerManager.getPacketMetrics();
                    }
                    return { jitter: 0, packetLossRate: 0 };
                }
            });
            root.interpolationManager = interpolationManager;
        }
        return interpolationManager;
    }

    root.InterpolationManager = Engine.Net.Interpolator;
    root.StateBuffer = Engine.Net.StateBuffer;
    root.interpolationManager = null;
    root.initInterpolation = initInterpolation;
})(window);

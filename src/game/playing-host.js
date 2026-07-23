/**
 * PlayingHost — binds an Island (profile + rules) onto the shared Game playing pipeline.
 * Enforces GameBus rules teardown so Island hops cannot leave zombie listeners.
 */
(function (root) {
    'use strict';

    let _teardown = null;
    let _activeProfile = null;
    let _activeRules = null;

    function getBus() {
        return root.GameBus || null;
    }

    function detachRules() {
        if (typeof _teardown === 'function') {
            try { _teardown(); } catch (err) {
                if (root.console && root.console.warn) {
                    root.console.warn('[PlayingHost] rules teardown failed:', err);
                }
            }
        }
        _teardown = null;
        _activeRules = null;
    }

    /**
     * Attach Island rules to GameBus. Always detaches any previous Island first.
     * @param {object} rules - { attach(bus): teardownFn } or handler map
     * @returns {function(): void} teardown
     */
    function attachRules(rules) {
        detachRules();
        const bus = getBus();
        if (!bus) {
            throw new Error('[PlayingHost] GameBus missing');
        }
        _activeRules = rules || null;
        if (!rules) {
            _teardown = null;
            return function noop() {};
        }
        if (typeof rules.attach === 'function') {
            _teardown = rules.attach(bus) || null;
        } else if (typeof bus.subscribe === 'function') {
            _teardown = bus.subscribe(rules);
        } else {
            _teardown = null;
        }
        return detachRules;
    }

    function applyProfile(world, profile) {
        if (!world || !profile) return;
        world.modeProfile = profile;
        world.modeId = profile.id;
        if (profile.contentGameMode) {
            world.gameMode = profile.contentGameMode;
        }
        if (typeof GamePackages !== 'undefined' && GamePackages.attach) {
            GamePackages.attach(world);
        }
        if (world.Bus == null && getBus()) {
            world.Bus = getBus();
        }
    }

    /**
     * Begin an Island on the shared playing world.
     * @param {object} world
     * @param {object} options
     * @param {object} options.profile
     * @param {object} [options.rules]
     * @param {boolean} [options.startRun=false] - call world._beginRoguelikeRun
     */
    function begin(world, options) {
        const opts = options || {};
        const profile = opts.profile;
        if (!world || !profile) {
            throw new Error('[PlayingHost.begin] world and profile required');
        }

        detachRules();
        applyProfile(world, profile);
        _activeProfile = profile;

        if (opts.rules) {
            attachRules(opts.rules);
        }

        if (typeof GameModeTakeover !== 'undefined' && GameModeTakeover.flushInputEdges) {
            GameModeTakeover.flushInputEdges();
        }
        if (typeof GameModeTakeover !== 'undefined' && GameModeTakeover.closeBlockingMenus) {
            GameModeTakeover.closeBlockingMenus();
        }

        if (opts.startRun && typeof world._beginRoguelikeRun === 'function') {
            world._beginRoguelikeRun();
        }

        return {
            profile,
            detach: detachRules
        };
    }

    function end(world) {
        detachRules();
        _activeProfile = null;
        if (world) {
            world.modeProfile = null;
        }
    }

    function getActiveProfile() {
        return _activeProfile;
    }

    function getActiveRules() {
        return _activeRules;
    }

    function usesPlayingPipeline(sessionOrProfile) {
        if (!sessionOrProfile) return false;
        if (sessionOrProfile.usesPlayingPipeline === true) return true;
        if (sessionOrProfile.profile && sessionOrProfile.profile.usesPlayingPipeline) return true;
        const p = _activeProfile;
        return !!(p && p.usesPlayingPipeline);
    }

    root.PlayingHost = {
        begin,
        end,
        attachRules,
        detachRules,
        applyProfile,
        getActiveProfile,
        getActiveRules,
        usesPlayingPipeline
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.PlayingHost;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

/**
 * Mode registry root. Each mode package assigns Modes.<id> = { id, packages, create }.
 * Host (src/app/host.js) selects one mode and calls create()/start().
 */
(function (root) {
    'use strict';

    root.Modes = root.Modes || {};

    root.Modes.list = function listModes() {
        return Object.keys(root.Modes)
            .filter((key) => {
                const value = root.Modes[key];
                return value && typeof value === 'object' && typeof value.create === 'function' && value.id;
            })
            .map((key) => root.Modes[key]);
    };

    root.Modes.get = function getMode(id) {
        const value = root.Modes[id];
        if (value && typeof value.create === 'function') {
            return value;
        }
        return null;
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);

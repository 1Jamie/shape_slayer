(function(root) {
    const Engine = root.Engine = root.Engine || {};

    const Shell = {
        flags: Object.create(null),
        _guardInstalled: false,

        ensureFlag(name, defaultValue) {
            if (typeof root[name] === 'undefined') root[name] = defaultValue;
            this.flags[name] = root[name];
            return root[name];
        },

        getFlag(name) {
            return Object.prototype.hasOwnProperty.call(this.flags, name)
                ? this.flags[name]
                : root[name];
        },

        setFlag(name, value) {
            this.flags[name] = value;
            root[name] = value;
            return value;
        },

        installBackNavigationGuard(options = {}) {
            if (this._guardInstalled || !root.addEventListener || !root.document || !root.history) {
                return false;
            }
            this._guardInstalled = true;
            const log = typeof options.log === 'function' ? options.log : null;
            const push = () => {
                try {
                    root.history.pushState(null, '', root.location.href);
                    return true;
                } catch (_) {
                    return false;
                }
            };
            const blockSideButton = (event, pushState) => {
                if (event.button !== 3 && event.button !== 4) return;
                event.preventDefault();
                event.stopPropagation();
                if (pushState) push();
            };

            push();
            root.addEventListener('popstate', () => {
                push();
                if (log) log('back-navigation');
            }, false);
            root.document.addEventListener('mousedown', event => blockSideButton(event, true), true);
            root.document.addEventListener('mouseup', event => blockSideButton(event, false), true);
            root.document.addEventListener('contextmenu', event => blockSideButton(event, false), true);
            return true;
        }
    };

    Engine.Shell = Shell;
    Shell.ensureFlag('USE_DOM_UI', true);
    Shell.installBackNavigationGuard();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Shell;
    }
})(typeof window !== 'undefined' ? window : globalThis);

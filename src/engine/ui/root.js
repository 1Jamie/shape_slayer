(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const UI = Engine.UI = Engine.UI || {};

    const focusableSelector = [
        'a[href]',
        'area[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'button:not([disabled])',
        'iframe',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
    ].join(',');

    function documentRef() {
        if (!root.document) throw new Error('Engine.UI.Root requires a DOM document.');
        return root.document;
    }

    function isEditable(target) {
        if (!target) return false;
        return target.isContentEditable
            || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    }

    const Root = {
        id: 'ui-root',
        element: null,

        configure(options = {}) {
            if (options.id) this.id = String(options.id);
            if (options.element) this.element = options.element;
            return this;
        },

        ensure() {
            const document = documentRef();
            let element = this.element || document.getElementById(this.id);
            if (!element) {
                element = document.createElement('div');
                element.id = this.id;
                document.body.appendChild(element);
            }
            Object.assign(element.style, {
                position: 'fixed',
                inset: '0',
                pointerEvents: 'none',
                display: 'block',
                zIndex: '1000',
                userSelect: 'none'
            });
            if (!element.dataset.engineUiRoot) {
                element.dataset.engineUiRoot = 'true';
                element.addEventListener('contextmenu', event => {
                    if (isEditable(event.target) || event.target?.tagName === 'BUTTON') return;
                    event.preventDefault();
                    event.stopPropagation();
                }, true);
                element.addEventListener('selectstart', event => {
                    if (isEditable(event.target)) return;
                    event.preventDefault();
                }, true);
            }
            this.element = element;
            return element;
        },

        createLayer(className = 'ui-layer', options = {}) {
            const document = documentRef();
            const layer = document.createElement(options.tagName || 'div');
            layer.className = className;
            layer.style.pointerEvents = options.pointerEvents || 'auto';
            if (options.zIndex !== undefined) layer.style.zIndex = String(options.zIndex);
            (options.parent || this.ensure()).appendChild(layer);
            return layer;
        },

        trapFocus(container) {
            const document = documentRef();
            const handleKeydown = event => {
                if (event.key !== 'Tab') return;
                const focusable = Array.from(container.querySelectorAll(focusableSelector))
                    .filter(element => element.offsetParent !== null && !element.hidden);
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
                    last.focus();
                    event.preventDefault();
                } else if (!event.shiftKey
                    && (document.activeElement === last || !container.contains(document.activeElement))) {
                    first.focus();
                    event.preventDefault();
                }
            };
            container.addEventListener('keydown', handleKeydown);
            return () => container.removeEventListener('keydown', handleKeydown);
        }
    };

    UI.Root = Root;
    root.UIRoot = Root;

    if (root.document) {
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', () => Root.ensure(), { once: true });
        } else {
            Root.ensure();
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Root;
    }
})(typeof window !== 'undefined' ? window : globalThis);

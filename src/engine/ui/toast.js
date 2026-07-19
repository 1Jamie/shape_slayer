(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const UI = Engine.UI = Engine.UI || {};

    class ToastManager {
        constructor(options = {}) {
            this.root = options.root || UI.Root;
            this.container = null;
            this.defaults = {
                duration: 2000,
                transitionMs: 300,
                maxVisible: 5,
                className: 'engine-toast',
                containerClassName: 'ui-layer engine-toast-stack',
                position: null,
                ...options
            };
        }

        configure(options = {}) {
            Object.assign(this.defaults, options);
            if (this.container) this._position();
            return this;
        }

        ensure() {
            if (this.container) return this.container;
            if (!root.document) throw new Error('Engine.UI.Toast requires a DOM document.');
            const container = this.root.createLayer(this.defaults.containerClassName, {
                pointerEvents: 'none',
                zIndex: 10000
            });
            Object.assign(container.style, {
                position: 'fixed',
                left: '50%',
                top: '20px',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
            });
            this.container = container;
            this._position();
            return container;
        }

        _position() {
            if (!this.container || typeof this.defaults.position !== 'function') return;
            const position = this.defaults.position();
            if (position) Object.assign(this.container.style, position);
        }

        show(message, options = {}) {
            if (typeof options === 'number') options = { duration: options };
            const container = this.ensure();
            this._position();
            const toast = root.document.createElement('div');
            toast.className = options.className || this.defaults.className;
            toast.textContent = String(message);
            Object.assign(toast.style, {
                background: 'rgba(20, 20, 40, 0.95)',
                border: '2px solid rgba(120, 160, 255, 0.8)',
                borderRadius: '8px',
                padding: '12px 24px',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                opacity: '0',
                transform: 'translateY(-10px)',
                transition: `opacity ${this.defaults.transitionMs}ms ease, transform ${this.defaults.transitionMs}ms ease`,
                pointerEvents: 'auto',
                whiteSpace: 'nowrap',
                ...(this.defaults.style || {}),
                ...(options.style || {})
            });
            container.appendChild(toast);
            while (container.children.length > (options.maxVisible || this.defaults.maxVisible)) {
                container.firstElementChild.remove();
            }
            const animate = root.requestAnimationFrame || (callback => setTimeout(callback, 0));
            animate(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0)';
            });
            const duration = Number.isFinite(options.duration) ? options.duration : this.defaults.duration;
            const transitionMs = Number.isFinite(options.transitionMs)
                ? options.transitionMs
                : this.defaults.transitionMs;
            const dismiss = () => {
                if (!toast.parentNode) return;
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-10px)';
                setTimeout(() => toast.remove(), transitionMs);
            };
            if (duration >= 0) setTimeout(dismiss, duration);
            return { element: toast, dismiss };
        }

        clear() {
            if (this.container) this.container.replaceChildren();
        }
    }

    UI.ToastManager = ToastManager;
    UI.Toast = UI.Toast || new ToastManager();
    root.showToast = (message, durationOrOptions) => UI.Toast.show(message, durationOrOptions);

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { ToastManager, Toast: UI.Toast };
    }
})(typeof window !== 'undefined' ? window : globalThis);

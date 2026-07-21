(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const UI = Engine.UI = Engine.UI || {};

    /**
     * @typedef {Object} ModalEntry
     * @property {HTMLElement} element Dialog element
     * @property {boolean} closeOnEscape
     * @property {boolean} restoreFocus
     * @property {Element|null} previousFocus
     * @property {function(any): void} [onClose]
     * @property {function(): void} [releaseFocus]
     *
     * @typedef {Object} ModalPushOptions
     * @property {boolean} [closeOnEscape=true] Close dialog on Escape key press
     * @property {boolean} [restoreFocus=true] Restore focus to active element on close
     * @property {function(any): void} [onClose] Close callback
     * @property {HTMLElement} [focus] Explicit focus target element
     * @property {string} [role='dialog'] ARIA role tag
     */

    /**
     * Accessible Modal Stack manager with focus trapping and ESC closing.
     */
    class ModalStack {
        /**
         * @param {{root?: Object, baseZIndex?: number}} [options]
         */
        constructor(options = {}) {
            this.root = options.root || UI.Root;
            this.baseZIndex = Number(options.baseZIndex) || 10020;
            /** @type {Array<ModalEntry>} */
            this.entries = [];
            this._handleEscape = this._handleEscape.bind(this);
        }

        /**
         * @private
         * @param {KeyboardEvent} event
         */
        _handleEscape(event) {
            if (event.key !== 'Escape') return;
            const entry = this.top();
            if (!entry || entry.closeOnEscape === false) return;
            event.preventDefault();
            event.stopPropagation();
            this.pop(entry, false);
        }

        /**
         * Push a new modal container onto stack.
         * @param {HTMLElement} element
         * @param {ModalPushOptions} [options]
         * @returns {ModalEntry}
         */
        push(element, options = {}) {
            if (!element) throw new TypeError('ModalStack.push requires an element.');
            const document = root.document;
            if (!document) throw new Error('ModalStack requires a DOM document.');
            const entry = {
                element,
                closeOnEscape: options.closeOnEscape !== false,
                restoreFocus: options.restoreFocus !== false,
                previousFocus: document.activeElement,
                onClose: options.onClose,
                releaseFocus: null
            };
            element.setAttribute('role', options.role || 'dialog');
            element.setAttribute('aria-modal', 'true');
            element.style.pointerEvents = 'auto';
            element.style.zIndex = String(this.baseZIndex + this.entries.length);
            if (!element.parentNode) this.root.ensure().appendChild(element);
            entry.releaseFocus = this.root.trapFocus(element);
            this.entries.push(entry);
            if (this.entries.length === 1) document.addEventListener('keydown', this._handleEscape, true);
            const focusTarget = options.focus
                || element.querySelector('[autofocus], button, [href], input, select, textarea, [tabindex]');
            if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
            return entry;
        }

        /**
         * Pop modal entry off the stack.
         * @param {ModalEntry} [entry=this.top()]
         * @param {any} [result]
         * @returns {boolean} True if popped
         */
        pop(entry = this.top(), result) {
            if (!entry) return false;
            const index = this.entries.indexOf(entry);
            if (index < 0) return false;
            this.entries.splice(index, 1);
            if (entry.releaseFocus) entry.releaseFocus();
            if (entry.element.parentNode) entry.element.remove();
            if (typeof entry.onClose === 'function') entry.onClose(result);
            if (entry.restoreFocus && entry.previousFocus && typeof entry.previousFocus.focus === 'function') {
                entry.previousFocus.focus();
            }
            if (!this.entries.length && root.document) {
                root.document.removeEventListener('keydown', this._handleEscape, true);
            }
            return true;
        }

        /**
         * @returns {ModalEntry|null} Top active modal entry
         */
        top() {
            return this.entries[this.entries.length - 1] || null;
        }

        clear(result) {
            while (this.entries.length) this.pop(this.top(), result);
        }

        confirm(message, options = {}) {
            if (!root.document) return Promise.resolve(false);
            return new Promise(resolve => {
                const overlay = this.root.createLayer(
                    options.className || 'ui-layer ui-layer--modal confirm-dialog',
                    { zIndex: this.baseZIndex }
                );
                const panel = root.document.createElement('div');
                panel.className = options.panelClassName || 'modal confirm-dialog__panel';
                const text = root.document.createElement('p');
                text.textContent = String(message);
                const actions = root.document.createElement('div');
                const cancel = root.document.createElement('button');
                const accept = root.document.createElement('button');
                cancel.type = 'button';
                accept.type = 'button';
                cancel.className = options.cancelClassName || 'btn';
                accept.className = options.acceptClassName || 'btn btn--primary';
                cancel.textContent = options.cancelText || 'Cancel';
                accept.textContent = options.acceptText || 'Confirm';
                actions.append(cancel, accept);
                panel.append(text, actions);
                overlay.appendChild(panel);
                let entry;
                const settle = value => this.pop(entry, value);
                entry = this.push(overlay, {
                    focus: accept,
                    onClose: resolve,
                    closeOnEscape: options.closeOnEscape
                });
                cancel.addEventListener('click', () => settle(false));
                accept.addEventListener('click', () => settle(true));
            });
        }
    }

    UI.ModalStack = ModalStack;
    UI.Modals = UI.Modals || new ModalStack();
    root.showConfirm = (message, options) => UI.Modals.confirm(message, options);

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { ModalStack, Modals: UI.Modals };
    }
})(typeof window !== 'undefined' ? window : globalThis);

// Thin game adapter over Engine.UI.Modals for keep-mounted Shape Slayer menus.
(function (root) {
    const entriesByElement = new WeakMap();

    function resolveRoot() {
        if (root.UIRoot && typeof root.UIRoot.ensure === 'function') {
            return root.UIRoot.ensure();
        }
        if (root.document && root.document.body) return root.document.body;
        throw new Error('GameUI modal adapter requires a DOM root.');
    }

    function resolveStack() {
        if (root.Engine && root.Engine.UI && root.Engine.UI.Modals) {
            return root.Engine.UI.Modals;
        }
        return null;
    }

    function openModal(element, options = {}) {
        if (!element) throw new TypeError('GameUI.openModal requires an element.');
        const existing = entriesByElement.get(element);
        if (existing) return existing;

        const rootNode = resolveRoot();
        if (!element.parentNode) rootNode.appendChild(element);
        element.style.display = options.display || 'flex';
        element.style.pointerEvents = options.pointerEvents || 'auto';

        const stack = resolveStack();
        if (!stack) {
            const fallback = { element, fallback: true };
            entriesByElement.set(element, fallback);
            return fallback;
        }

        const entry = stack.push(element, {
            role: options.role,
            focus: options.focus,
            closeOnEscape: options.closeOnEscape !== false,
            restoreFocus: options.restoreFocus !== false,
            onClose: (result) => {
                entriesByElement.delete(element);
                element.style.display = 'none';
                if (!element.parentNode) rootNode.appendChild(element);
                if (typeof options.onClose === 'function') options.onClose(result);
            }
        });
        entriesByElement.set(element, entry);
        return entry;
    }

    function closeModal(entryOrElement, result) {
        if (!entryOrElement) return false;
        const stack = resolveStack();
        const entry = entryOrElement.element
            ? entryOrElement
            : entriesByElement.get(entryOrElement);
        if (!entry) {
            if (entryOrElement.style) entryOrElement.style.display = 'none';
            return false;
        }
        if (entry.fallback) {
            entriesByElement.delete(entry.element);
            entry.element.style.display = 'none';
            return true;
        }
        if (!stack) return false;
        return stack.pop(entry, result);
    }

    function isOpen(element) {
        return !!(element && entriesByElement.get(element));
    }

    const GameUI = root.GameUI = root.GameUI || {};
    GameUI.openModal = openModal;
    GameUI.closeModal = closeModal;
    GameUI.isModalOpen = isOpen;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = GameUI;
    }
})(typeof window !== 'undefined' ? window : globalThis);

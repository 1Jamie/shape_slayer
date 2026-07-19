(function () {
    function getInputSurface() {
        const input = Engine.Input || null;
        return {
            isTouchUi: !!(input && input.isMobileUiMode && input.isMobileUiMode()),
            isGamepad: !!(input && input.isGamepadMode && input.isGamepadMode())
        };
    }

    function isCharacterSheetOpen() {
        return !!(window.CharacterSheet
            && typeof window.CharacterSheet.isOpen === 'function'
            && window.CharacterSheet.isOpen());
    }

    // Any modal overlay except the character sheet itself should bury HUD chrome.
    function hasForeignModalOpen() {
        const layers = document.querySelectorAll('.ui-layer--modal');
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            const display = layer.style.display || window.getComputedStyle(layer).display;
            if (!display || display === 'none') continue;
            // Own sheet stays allowed so the button can toggle-close above it
            if (layer.querySelector && layer.querySelector('.character-sheet')) continue;
            return true;
        }
        return false;
    }

    function createCharacterSheetButton() {
        const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
        let btn = document.getElementById('ui-charsheet-button');
        if (btn) {
            refreshCharacterSheetButton();
            return btn;
        }

        btn = document.createElement('button');
        btn.id = 'ui-charsheet-button';
        btn.className = 'charsheet-button btn btn--primary';
        btn.textContent = 'Char';
        btn.type = 'button';
        btn.style.pointerEvents = 'auto';
        btn.style.userSelect = 'none';
        btn.style.minWidth = '60px';
        btn.style.display = 'none';

        // Prevent right-click context menu
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });

        root.appendChild(btn);

        // Simple click handler - works for both mouse and touch
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (hasForeignModalOpen()) return;

            if (window.CharacterSheet && typeof window.CharacterSheet.toggle === 'function') {
                window.CharacterSheet.toggle();
            } else {
                console.error('[CHAR SHEET BUTTON] window.CharacterSheet.toggle not available!');
            }
        });

        refreshCharacterSheetButton();
        return btn;
    }

    function refreshCharacterSheetButton() {
        const btn = document.getElementById('ui-charsheet-button');
        if (!btn || (typeof Engine === 'undefined' || !Engine.Input) || !Engine.Input.isMobileUiMode) return;

        const surface = getInputSurface();
        const touchChrome = surface.isTouchUi && !surface.isGamepad;
        const sheetOpen = isCharacterSheetOpen();
        const blocked = hasForeignModalOpen();
        // Hide under pause / index / audio / etc. Stay visible to close our own sheet.
        const shouldShow = touchChrome && !blocked;

        btn.style.display = shouldShow ? 'block' : 'none';
        btn.classList.toggle('charsheet-button--above-sheet', shouldShow && sheetOpen);
        btn.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    }

    window.refreshCharacterSheetButton = refreshCharacterSheetButton;

    function tick() {
        refreshCharacterSheetButton();
        requestAnimationFrame(tick);
    }

    // Wait for Input to be available before creating button
    function tryCreateButton() {
        if ((typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.isMobileUiMode) {
            createCharacterSheetButton();
            window.addEventListener('controlmodechange', refreshCharacterSheetButton);
            window.addEventListener('inputsourcechange', refreshCharacterSheetButton);
            tick();
        } else {
            // Input not ready yet, try again in 100ms
            setTimeout(tryCreateButton, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryCreateButton, { once: true });
    } else {
        tryCreateButton();
    }
})();

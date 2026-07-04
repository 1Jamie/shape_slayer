(function () {
    function getInputSurface() {
        const input = window.Input || null;
        return {
            isTouchUi: !!(input && input.isMobileUiMode && input.isMobileUiMode()),
            isGamepad: !!(input && input.isGamepadMode && input.isGamepadMode())
        };
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
        // Use an icon or short text
        btn.textContent = 'Char';
        btn.type = 'button';
        btn.style.position = 'fixed';
        btn.style.top = '12px';
        btn.style.right = '100px'; // Further left from the pause button (which is at right: 12px)
        btn.style.pointerEvents = 'auto';
        btn.style.userSelect = 'none';
        btn.style.zIndex = '1001';
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
            // Prevent event from reaching canvas
            e.preventDefault();
            e.stopPropagation();

            // Toggle character sheet using the CharacterSheet global
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
        if (!btn || typeof Input === 'undefined' || !Input.isMobileUiMode) return;
        const surface = getInputSurface();
        btn.style.display = surface.isTouchUi && !surface.isGamepad ? 'block' : 'none';
    }

    // Wait for Input to be available before creating button
    function tryCreateButton() {
        if (typeof Input !== 'undefined' && Input.isMobileUiMode) {
            createCharacterSheetButton();
            window.addEventListener('controlmodechange', refreshCharacterSheetButton);
            window.addEventListener('inputsourcechange', refreshCharacterSheetButton);
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

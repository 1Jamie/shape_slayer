(function () {
    console.log('[CHAR SHEET BUTTON] Script loaded');

    function createCharacterSheetButton() {
        console.log('[CHAR SHEET BUTTON] createCharacterSheetButton called');
        const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
        console.log('[CHAR SHEET BUTTON] Root element:', root);
        let btn = document.getElementById('ui-charsheet-button');
        if (btn) {
            console.log('[CHAR SHEET BUTTON] Button already exists');
            return btn;
        }

        // Only show on mobile/touch devices - MUST check Input.isTouchMode() as primary source
        // Input may not be loaded yet, so we need to wait for it
        if (typeof Input === 'undefined' || !Input.isTouchMode || !Input.isTouchMode()) {
            // Not in touch mode, don't create button
            console.log('[CHAR SHEET BUTTON] Not in touch mode, skipping button creation');
            return null;
        }

        console.log('[CHAR SHEET BUTTON] Creating button...');
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
        btn.style.webkitUserSelect = 'none';
        btn.style.mozUserSelect = 'none';
        btn.style.msUserSelect = 'none';
        btn.style.zIndex = '1001';
        btn.style.minWidth = '60px';

        // Prevent right-click context menu
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });

        root.appendChild(btn);
        console.log('[CHAR SHEET BUTTON] Button appended to root');

        // Simple click handler - works for both mouse and touch
        btn.addEventListener('click', (e) => {
            // Prevent event from reaching canvas
            e.preventDefault();
            e.stopPropagation();

            console.log('[CHAR SHEET BUTTON] Click event fired');
            console.log('[CHAR SHEET BUTTON] Event:', e);
            console.log('[CHAR SHEET BUTTON] window.CharacterSheet:', window.CharacterSheet);

            // Toggle character sheet using the CharacterSheet global
            if (window.CharacterSheet && typeof window.CharacterSheet.toggle === 'function') {
                console.log('[CHAR SHEET BUTTON] Calling window.CharacterSheet.toggle()');
                window.CharacterSheet.toggle();
            } else {
                console.error('[CHAR SHEET BUTTON] window.CharacterSheet.toggle not available!');
                console.error('[CHAR SHEET BUTTON] window.CharacterSheet:', window.CharacterSheet);
            }
        });

        console.log('[CHAR SHEET BUTTON] Button created successfully');
        return btn;
    }

    // Wait for Input to be available before creating button
    function tryCreateButton() {
        console.log('[CHAR SHEET BUTTON] tryCreateButton called, Input available:', typeof Input !== 'undefined');
        if (typeof Input !== 'undefined' && Input.isTouchMode) {
            console.log('[CHAR SHEET BUTTON] Input available, creating button');
            createCharacterSheetButton();
        } else {
            // Input not ready yet, try again in 100ms
            console.log('[CHAR SHEET BUTTON] Input not ready, retrying in 100ms');
            setTimeout(tryCreateButton, 100);
        }
    }

    if (document.readyState === 'loading') {
        console.log('[CHAR SHEET BUTTON] Document still loading, waiting for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', tryCreateButton, { once: true });
    } else {
        console.log('[CHAR SHEET BUTTON] Document already loaded, calling tryCreateButton');
        tryCreateButton();
    }
})();

// Prevent browser back navigation (including side mouse button back button)
// This prevents players from accidentally leaving the game by hitting back button

(function() {
    'use strict';
    
    // Push initial state to history stack
    history.pushState(null, '', location.href);
    
    // Prevent back navigation by intercepting popstate events
    window.addEventListener('popstate', function(event) {
        // Immediately push a new state to prevent navigation
        history.pushState(null, '', location.href);
        // Optionally log for debugging (can be removed in production)
        console.log('[Navigation] Back button blocked - preventing navigation away from game');
    }, false);
    
    // Prevent mouse side buttons from triggering browser back/forward
    // Mouse button 3 = back, button 4 = forward (per DOM MouseEvent.button spec)
    document.addEventListener('mousedown', function(event) {
        // Check if it's mouse button 3 (back button) or button 4 (forward button)
        if (event.button === 3 || event.button === 4) {
            event.preventDefault();
            event.stopPropagation();
            // Push state to ensure we stay on current page
            history.pushState(null, '', location.href);
            console.log('[Navigation] Mouse side button blocked - preventing navigation');
            return false;
        }
    }, true); // Use capture phase to intercept early
    
    // Also prevent mouseup events for side buttons (belt and suspenders)
    document.addEventListener('mouseup', function(event) {
        if (event.button === 3 || event.button === 4) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    }, true);
    
    // Prevent contextmenu on side buttons (some browsers may handle them differently)
    document.addEventListener('contextmenu', function(event) {
        // Note: contextmenu typically doesn't fire for side buttons, but just in case
        if (event.button === 3 || event.button === 4) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    }, true);
    
    // Prevent any attempt to navigate away (belt and suspenders approach)
    window.addEventListener('beforeunload', function(event) {
        // Note: Modern browsers only show custom messages if user interaction occurred
        // This is a fallback, but the primary defense is popstate interception above
        // We'll let the default browser dialog show if somehow navigation is triggered
    }, false);
    
    console.log('[Navigation] Back navigation prevention initialized');
})();


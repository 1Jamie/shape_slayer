/**
 * Thin app host: always boots the roguelike shell (one Engine.Boot / Core).
 * Other modes launch as embedded Islands inside that shell — same playing
 * pipeline, not a second engine boot. sandbox.html redirects to ?mode=sandbox.
 */
(function (root) {
    'use strict';

    function getQueryModeId() {
        try {
            const params = new URLSearchParams(root.location.search);
            const queryMode = params.get('mode');
            if (queryMode && root.Modes && root.Modes.get && root.Modes.get(queryMode)) {
                return queryMode;
            }
            if (queryMode && root.Modes && root.Modes[queryMode] && typeof root.Modes[queryMode].create === 'function') {
                return queryMode;
            }
        } catch (_) {
            // ignore
        }
        return null;
    }

    function getActiveModeId() {
        if (root.__activeSessionId) return root.__activeSessionId;
        return root.__shellModeId || 'roguelike';
    }

    function getShell() {
        return root.__activeMode || null;
    }

    /**
     * Boot the roguelike shell once. Optional ?mode=<id> auto-launches that
     * mode as an embedded session after the shell is up.
     */
    function startActiveMode() {
        if (!root.Modes || !root.Modes.roguelike || typeof root.Modes.roguelike.create !== 'function') {
            console.error('[AppHost] Roguelike shell mode missing');
            return null;
        }

        const runtime = (typeof Engine !== 'undefined' && Engine.Boot && Engine.Boot.runtime)
            ? Engine.Boot.runtime
            : null;

        const shell = root.Modes.roguelike.create(runtime, {
            packages: root.Modes.roguelike.packages || [],
            world: typeof Game !== 'undefined' ? Game : null
        });
        root.__activeMode = shell;
        root.__shellModeId = 'roguelike';
        root.__activeSessionId = null;

        if (typeof GameModeCatalog !== 'undefined' && GameModeCatalog.applySelection) {
            GameModeCatalog.applySelection(
                (typeof nexusRoom !== 'undefined' ? nexusRoom : null),
                'roguelike'
            );
        }

        if (shell && typeof shell.start === 'function') {
            shell.start();
        }

        const autoSession = getQueryModeId();
        if (autoSession && autoSession !== 'roguelike') {
            // Defer until after Boot/Core init so the canvas exists.
            root.setTimeout(() => {
                launchSession(autoSession);
            }, 0);
        }

        return shell;
    }

    /**
     * Start a mode session inside the running shell engine (no Boot / no reload).
     */
    function launchSession(modeId) {
        const id = modeId || '';
        const def = (root.Modes && root.Modes.get && root.Modes.get(id)) || (root.Modes && root.Modes[id]);
        if (!def) {
            console.error('[AppHost] Unknown mode for session:', id);
            return null;
        }
        if (typeof def.createSession !== 'function') {
            console.error('[AppHost] Mode has no createSession (cannot embed):', id);
            return null;
        }

        const shell = getShell();
        if (!shell || typeof shell.launchSession !== 'function') {
            console.error('[AppHost] Shell cannot host sessions');
            return null;
        }

        if (typeof GameModeCatalog !== 'undefined' && GameModeCatalog.applySelection) {
            GameModeCatalog.applySelection(
                (typeof nexusRoom !== 'undefined' ? nexusRoom : null),
                id
            );
        }

        const session = def.createSession({
            hostWorld: shell.world,
            runtime: (typeof Engine !== 'undefined' && Engine.Boot) ? Engine.Boot.runtime : null
        });
        shell.launchSession(session);
        root.__activeSessionId = id;
        console.log('[AppHost] Embedded session:', id);
        return session;
    }

    function endSession() {
        const shell = getShell();
        if (shell && typeof shell.endSession === 'function') {
            shell.endSession();
        }
        root.__activeSessionId = null;
        console.log('[AppHost] Session ended; back to shell');
    }

    /** @deprecated Prefer launchSession — kept for older call sites. */
    function navigateToMode(modeId) {
        if (modeId === 'roguelike') {
            endSession();
            return true;
        }
        return !!launchSession(modeId);
    }

    root.AppHost = {
        getActiveModeId,
        getQueryModeId,
        startActiveMode,
        launchSession,
        endSession,
        navigateToMode
    };

    if (root.addEventListener) {
        root.addEventListener('load', () => {
            startActiveMode();
        });
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

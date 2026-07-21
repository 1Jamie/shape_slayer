(function () {
    let layer, banner, dot, text;

    function create() {
        const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
        layer = document.createElement('div');
        layer.className = 'ui-layer host-paused-indicator-layer';
        layer.style.pointerEvents = 'none';
        layer.style.position = 'absolute';
        layer.style.top = '16px';
        layer.style.left = '0';
        layer.style.right = '0';
        layer.style.display = 'flex';
        layer.style.justifyContent = 'center';
        layer.style.zIndex = '9999';

        banner = document.createElement('div');
        banner.className = 'host-paused-banner';
        banner.style.background = 'rgba(20, 16, 32, 0.88)';
        banner.style.border = '1px solid rgba(255, 180, 50, 0.6)';
        banner.style.borderRadius = '20px';
        banner.style.padding = '8px 18px';
        banner.style.display = 'flex';
        banner.style.alignItems = 'center';
        banner.style.gap = '10px';
        banner.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4)';
        banner.style.backdropFilter = 'blur(6px)';

        dot = document.createElement('div');
        dot.style.width = '10px';
        dot.style.height = '10px';
        dot.style.borderRadius = '50%';
        dot.style.background = '#ffb432';
        dot.style.boxShadow = '0 0 8px #ffb432';

        text = document.createElement('span');
        text.style.color = '#fff2d6';
        text.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        text.style.fontSize = '14px';
        text.style.fontWeight = '600';
        text.style.letterSpacing = '0.3px';
        text.textContent = 'Host is paused or on a different screen';

        banner.appendChild(dot);
        banner.appendChild(text);
        layer.appendChild(banner);
        root.appendChild(layer);

        if (!document.getElementById('host-paused-indicator-style')) {
            const style = document.createElement('style');
            style.id = 'host-paused-indicator-style';
            style.textContent = `
                @keyframes hostPausedPulse {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.3); opacity: 1; }
                }
                .host-paused-banner div {
                    animation: hostPausedPulse 1.4s infinite ease-in-out;
                }
            `;
            document.head.appendChild(style);
        }
    }

    function tick() {
        if (layer) {
            const mp = window.multiplayerManager;
            const inMp = window.Game && window.Game.multiplayerEnabled && mp && mp.lobbyCode;
            const shouldShow = !!(inMp && !mp.isHost && typeof mp.isHostStalledOrPaused === 'function' && mp.isHostStalledOrPaused());
            layer.style.display = shouldShow ? 'flex' : 'none';
        }
        requestAnimationFrame(tick);
    }

    function init() {
        create();
        tick();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

// Device and input-capability detection.
// Uses layered signals (Client Hints, UA, media queries, touch points) instead of UA alone.

const DeviceDetection = {
    _cachedProfile: null,

    // Minimum width/height that counts as playable without the rotate gate.
    // Uses the *current* CSS viewport (often a chrome-shrunk subset of the
    // panel before fullscreen) — not a fixed 1920x1080 assumption.
    // 1.0 = landscape-or-square by pixels.
    LANDSCAPE_USABLE_MIN_ASPECT: 1.0,

    _readNavigator() {
        if (typeof navigator === 'undefined') {
            return { ua: '', platform: '', maxTouchPoints: 0, userAgentData: null };
        }
        return {
            ua: navigator.userAgent || '',
            platform: navigator.platform || '',
            maxTouchPoints: navigator.maxTouchPoints || 0,
            userAgentData: navigator.userAgentData || null
        };
    },

    _matchMedia(query) {
        if (typeof window === 'undefined' || !window.matchMedia) return null;
        try {
            return window.matchMedia(query).matches;
        } catch (_) {
            return null;
        }
    },

    _readViewport() {
        if (typeof window === 'undefined') {
            return { width: 0, height: 0 };
        }
        const vv = window.visualViewport;
        const width = (vv && vv.width) || window.innerWidth || 0;
        const height = (vv && vv.height) || window.innerHeight || 0;
        return { width, height };
    },

    _readScreen() {
        if (typeof screen === 'undefined' || !screen) {
            return { width: 0, height: 0 };
        }
        const width = screen.availWidth || screen.width || 0;
        const height = screen.availHeight || screen.height || 0;
        return { width, height };
    },

    _aspectRatio(size) {
        if (!size || size.width <= 0 || size.height <= 0) return 0;
        return size.width / size.height;
    },

    _isTelevisionUserAgent(ua) {
        if (!ua) return false;
        // Android / Fire / Google TV boxes, smart TVs, Chromecast-with-Google-TV, etc.
        // Check before generic Android tablet classification (many TVs omit "Mobile").
        return /android tv|googletv|google.?tv|\baft[a-z0-9]*\b|fire.?tv|smart-?tv|smarttv|bravia|hbbtv|netcast|viera|webos.?tv|tizen|crkey|apple.?tv|cubotv|shield.?android.?tv/i.test(ua);
    },

    _parseUserAgent(ua, platform, maxTouchPoints) {
        const lowerUa = ua.toLowerCase();

        if (/iphone|ipod/i.test(ua)) {
            return { formFactor: 'phone', os: 'ios', confidence: 'high', reason: 'ua-ios-phone' };
        }

        if (/ipad/i.test(ua)) {
            return { formFactor: 'tablet', os: 'ios', confidence: 'high', reason: 'ua-ipad' };
        }

        // iPadOS 13+ desktop UA: Macintosh + multi-touch (MacBooks report 0 touch points).
        if (/macintosh/i.test(ua) && maxTouchPoints > 1) {
            return { formFactor: 'tablet', os: 'ios', confidence: 'high', reason: 'ua-ipados-desktop-mode' };
        }

        if (this._isTelevisionUserAgent(ua)) {
            const os = /android/i.test(ua) || /\baft[a-z0-9]*\b/i.test(ua) || /fire.?tv/i.test(ua)
                ? 'android'
                : (/webos/i.test(ua) ? 'webos' : (/tizen/i.test(ua) ? 'tizen' : 'unknown'));
            return { formFactor: 'tv', os, confidence: 'high', reason: 'ua-television' };
        }

        if (/android/i.test(ua)) {
            const isPhone = /mobile/i.test(ua);
            return {
                formFactor: isPhone ? 'phone' : 'tablet',
                os: 'android',
                confidence: 'high',
                reason: isPhone ? 'ua-android-phone' : 'ua-android-tablet'
            };
        }

        if (/windows phone/i.test(ua)) {
            return { formFactor: 'phone', os: 'windows', confidence: 'high', reason: 'ua-windows-phone' };
        }

        if (/cros/i.test(ua)) {
            return { formFactor: 'desktop', os: 'chromeos', confidence: 'high', reason: 'ua-chromeos' };
        }

        if (/playbook|silk|kindle|kf[a-z]+|tablet/i.test(ua)) {
            return { formFactor: 'tablet', os: 'android', confidence: 'medium', reason: 'ua-tablet-keyword' };
        }

        if (/blackberry|bb10/i.test(ua)) {
            return { formFactor: 'phone', os: 'unknown', confidence: 'medium', reason: 'ua-blackberry' };
        }

        if (/windows nt/i.test(ua)) {
            return { formFactor: 'desktop', os: 'windows', confidence: 'high', reason: 'ua-windows' };
        }

        if (/macintosh|mac os x/i.test(ua)) {
            return { formFactor: 'desktop', os: 'macos', confidence: 'high', reason: 'ua-macos' };
        }

        if (/linux/i.test(ua) || /linux/i.test(platform)) {
            return { formFactor: 'desktop', os: 'linux', confidence: 'medium', reason: 'ua-linux' };
        }

        return null;
    },

    _parseUserAgentData(userAgentData) {
        if (!userAgentData) return null;

        const platform = (userAgentData.platform || '').toLowerCase();
        const mobile = userAgentData.mobile === true;

        if (mobile) {
            let os = 'unknown';
            if (platform === 'android') os = 'android';
            else if (platform === 'ios') os = 'ios';
            else if (platform === 'windows') os = 'windows';
            return { formFactor: 'phone', os, confidence: 'high', reason: 'client-hints-mobile' };
        }

        if (platform === 'android') {
            return { formFactor: 'tablet', os: 'android', confidence: 'high', reason: 'client-hints-android-tablet' };
        }

        if (platform === 'ios') {
            // iPad can report iOS with mobile=false in Client Hints.
            return { formFactor: 'tablet', os: 'ios', confidence: 'medium', reason: 'client-hints-ios-non-mobile' };
        }

        if (platform === 'chrome os') {
            return { formFactor: 'desktop', os: 'chromeos', confidence: 'high', reason: 'client-hints-chromeos' };
        }

        if (platform === 'macos' || platform === 'windows' || platform === 'linux') {
            const os = platform === 'macos' ? 'macos' : platform;
            return { formFactor: 'desktop', os, confidence: 'high', reason: 'client-hints-desktop-platform' };
        }

        return null;
    },

    _readPointerCapabilities() {
        const coarsePointer = this._matchMedia('(pointer: coarse)');
        const finePointer = this._matchMedia('(pointer: fine)');
        const anyCoarsePointer = this._matchMedia('(any-pointer: coarse)');
        const anyFinePointer = this._matchMedia('(any-pointer: fine)');
        const canHover = this._matchMedia('(hover: hover)');
        const anyHover = this._matchMedia('(any-hover: hover)');

        // Touch-primary: coarse main pointer and no hover on the primary input.
        const touchPrimary = coarsePointer === true && canHover === false;
        const hasFinePointer = finePointer === true || anyFinePointer === true;
        const hasHover = canHover === true || anyHover === true;

        return {
            coarsePointer,
            finePointer,
            anyCoarsePointer,
            anyFinePointer,
            canHover,
            anyHover,
            touchPrimary,
            hasFinePointer,
            hasHover
        };
    },

    _inferFromCapabilities(nav, pointers) {
        const hasTouch = ('ontouchstart' in (typeof window !== 'undefined' ? window : {})) || nav.maxTouchPoints > 0;

        if (pointers.touchPrimary) {
            return {
                formFactor: 'phone',
                os: 'unknown',
                confidence: 'medium',
                reason: 'pointer-coarse-no-hover'
            };
        }

        // Avoid classifying desktop touch laptops as mobile when a fine pointer + hover exist.
        if (hasTouch && pointers.hasFinePointer && pointers.hasHover) {
            return { formFactor: 'desktop', os: 'unknown', confidence: 'medium', reason: 'touch-with-mouse' };
        }

        if (pointers.hasFinePointer || pointers.hasHover) {
            return { formFactor: 'desktop', os: 'unknown', confidence: 'low', reason: 'fine-pointer-or-hover' };
        }

        if (hasTouch && nav.maxTouchPoints > 0) {
            return {
                formFactor: nav.maxTouchPoints > 2 ? 'tablet' : 'phone',
                os: 'unknown',
                confidence: 'low',
                reason: 'touch-points-fallback'
            };
        }

        return { formFactor: 'desktop', os: 'unknown', confidence: 'low', reason: 'default-desktop' };
    },

    // Engine sniff for Canvas2D policy. Chrome/Edge ship "like Gecko" - exclude those.
    // Servo inherits Gecko-family opts: weak/missing shadowBlur, expensive composite layers (Vello).
    _parseEngine(ua) {
        const raw = typeof ua === 'string' ? ua : '';
        if (/Servo\//i.test(raw)) {
            return { engine: 'servo', confidence: 'high', reason: 'ua-servo' };
        }
        if (/Firefox\//i.test(raw) || (/Gecko\//i.test(raw) && !/like Gecko/i.test(raw))) {
            return { engine: 'gecko', confidence: 'high', reason: 'ua-firefox-gecko' };
        }
        if (/Edg\/|OPR\/|Chrome\/|Chromium\//i.test(raw)) {
            return { engine: 'blink', confidence: 'high', reason: 'ua-chromium' };
        }
        if (/AppleWebKit\//i.test(raw) && /Safari\//i.test(raw) && !/Chrome\//i.test(raw)) {
            return { engine: 'webkit', confidence: 'high', reason: 'ua-safari' };
        }
        return { engine: 'unknown', confidence: 'low', reason: 'ua-unknown-engine' };
    },

    getProfile(forceRefresh = false) {
        if (!forceRefresh && this._cachedProfile) {
            return this._cachedProfile;
        }

        const nav = this._readNavigator();
        const pointers = this._readPointerCapabilities();
        const hasTouch = ('ontouchstart' in (typeof window !== 'undefined' ? window : {})) || nav.maxTouchPoints > 0;

        let parsed = this._parseUserAgentData(nav.userAgentData);
        if (!parsed) {
            parsed = this._parseUserAgent(nav.ua, nav.platform, nav.maxTouchPoints);
        }
        if (!parsed) {
            parsed = this._inferFromCapabilities(nav, pointers);
        }

        const formFactor = parsed.formFactor || 'unknown';
        const isMobile = formFactor === 'phone' || formFactor === 'tablet';
        const engineInfo = this._parseEngine(nav.ua);
        const engine = engineInfo.engine || 'unknown';

        this._cachedProfile = {
            formFactor,
            os: parsed.os || 'unknown',
            engine,
            isGeckoFamily: engine === 'gecko' || engine === 'servo',
            isMobile,
            isPhone: formFactor === 'phone',
            isTablet: formFactor === 'tablet',
            isTv: formFactor === 'tv',
            isDesktop: formFactor === 'desktop',
            confidence: parsed.confidence || 'low',
            reason: parsed.reason || 'unknown',
            engineReason: engineInfo.reason || 'unknown',
            capabilities: {
                touch: hasTouch,
                maxTouchPoints: nav.maxTouchPoints,
                touchPrimary: pointers.touchPrimary,
                coarsePointer: pointers.coarsePointer,
                finePointer: pointers.finePointer,
                anyCoarsePointer: pointers.anyCoarsePointer,
                anyFinePointer: pointers.anyFinePointer,
                canHover: pointers.canHover,
                anyHover: pointers.anyHover
            },
            userAgentDataAvailable: !!nav.userAgentData
        };

        return this._cachedProfile;
    },

    isMobileDevice() {
        return this.getProfile().isMobile;
    },

    isPhone() {
        return this.getProfile().isPhone;
    },

    isTablet() {
        return this.getProfile().isTablet;
    },

    isTv() {
        return !!this.getProfile().isTv;
    },

    isDesktop() {
        return this.getProfile().isDesktop;
    },

    isTouchPrimary() {
        const profile = this.getProfile();
        return profile.capabilities.touchPrimary || profile.isMobile;
    },

    hasTouchCapability() {
        return this.getProfile().capabilities.touch;
    },

    invalidateCache() {
        this._cachedProfile = null;
    },

    isIos() {
        return this.getProfile().os === 'ios';
    },

    getEngine() {
        return this.getProfile().engine || 'unknown';
    },

    // Firefox + Servo share Canvas2D pain: expensive composites, weak/missing shadowBlur.
    isGeckoFamily() {
        return !!this.getProfile().isGeckoFamily;
    },

    isServo() {
        return this.getEngine() === 'servo';
    },

    // Canvas/document fullscreen is not available on iOS Safari (non-video elements).
    supportsElementFullscreen() {
        if (typeof document === 'undefined') return false;
        if (this.isIos()) return false;
        const el = document.documentElement;
        return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen);
    },

    // Installed PWA / home-screen app (fullscreen or standalone display mode).
    isInstalledDisplayMode() {
        if (typeof window === 'undefined') return false;
        try {
            if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
            if (window.matchMedia('(display-mode: standalone)').matches) return true;
            if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
        } catch (e) {
            // ignore
        }
        // iOS Safari legacy home-screen flag
        if (typeof navigator !== 'undefined' && navigator.standalone === true) return true;
        return false;
    },

    isPortraitViewport() {
        const { width, height } = this._readViewport();
        if (width > 0 && height > 0) {
            // Prefer CSS pixels over window.orientation. Android TV / Fire TV
            // WebViews often report orientation 0 while the window is landscape.
            return height > width;
        }
        if (typeof window !== 'undefined' && typeof window.orientation === 'number') {
            return window.orientation === 0 || window.orientation === 180;
        }
        return false;
    },

    getViewportAspectRatio() {
        return this._aspectRatio(this._readViewport()) || 1;
    },

    getScreenAspectRatio() {
        return this._aspectRatio(this._readScreen()) || 0;
    },

    // True when the playable surface is wide enough without a rotate gate.
    // Checks the *current* CSS viewport first (any size — often a browser-chrome
    // subset of the panel before fullscreen), then falls back to screen metrics
    // for non-phone devices so pre-fullscreen TV/tablet windows still unlock.
    isLandscapeUsableViewport(minAspect) {
        const floor = typeof minAspect === 'number' && Number.isFinite(minAspect)
            ? minAspect
            : this.LANDSCAPE_USABLE_MIN_ASPECT;

        if (this.getViewportAspectRatio() >= floor) {
            return true;
        }

        // Phones must use the live CSS viewport so true portrait stays gated.
        if (this.isPhone && this.isPhone()) {
            return false;
        }

        const screenAspect = this.getScreenAspectRatio();
        return screenAspect > 0 && screenAspect >= floor;
    },

    // Best-effort landscape lock. Works reliably in installed Android PWAs / fullscreen;
    // may require a user gesture elsewhere and is limited on iOS.
    lockLandscapeOrientation() {
        if (typeof screen === 'undefined' || !screen.orientation || typeof screen.orientation.lock !== 'function') {
            return Promise.resolve(false);
        }
        return screen.orientation.lock('landscape').then(() => true).catch(() => false);
    }
};

if (typeof window !== 'undefined') {
    window.Engine = window.Engine || {};
    window.Engine.System = DeviceDetection;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { System: DeviceDetection };
}

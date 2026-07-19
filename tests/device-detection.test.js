const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { System: DeviceDetection } = require(path.join(__dirname, '..', 'src', 'engine', 'system.js'));

function mockEnv({ ua, platform, maxTouchPoints = 0, userAgentData = null, media = {} }) {
    const queries = {
        '(pointer: coarse)': false,
        '(pointer: fine)': true,
        '(any-pointer: coarse)': false,
        '(any-pointer: fine)': true,
        '(hover: hover)': true,
        '(any-hover: hover)': true,
        ...media
    };

    const win = {
        ontouchstart: maxTouchPoints > 0 ? null : undefined,
        matchMedia(query) {
            return { matches: queries[query] === true };
        }
    };

    DeviceDetection.invalidateCache();
    DeviceDetection._readNavigator = () => ({
        ua,
        platform,
        maxTouchPoints,
        userAgentData
    });
    DeviceDetection._matchMedia = (query) => {
        if (!(query in queries)) return null;
        return queries[query] === true;
    };
    DeviceDetection._readPointerCapabilities = () => {
        const coarsePointer = queries['(pointer: coarse)'] === true;
        const finePointer = queries['(pointer: fine)'] === true;
        const anyCoarsePointer = queries['(any-pointer: coarse)'] === true;
        const anyFinePointer = queries['(any-pointer: fine)'] === true;
        const canHover = queries['(hover: hover)'] === true;
        const anyHover = queries['(any-hover: hover)'] === true;
        return {
            coarsePointer,
            finePointer,
            anyCoarsePointer,
            anyFinePointer,
            canHover,
            anyHover,
            touchPrimary: coarsePointer && !canHover,
            hasFinePointer: finePointer || anyFinePointer,
            hasHover: canHover || anyHover
        };
    };
}

test('detects Android phone from UA', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36',
        platform: 'Linux armv81',
        maxTouchPoints: 5
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.formFactor, 'phone');
    assert.equal(profile.os, 'android');
    assert.equal(profile.isMobile, true);
});

test('detects Android tablet without Mobile token', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (Linux; Android 13; SM-X900) AppleWebKit/537.36 Safari/537.36',
        platform: 'Linux armv81',
        maxTouchPoints: 10
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.formFactor, 'tablet');
    assert.equal(profile.os, 'android');
    assert.equal(profile.isMobile, true);
});

test('detects iPadOS desktop-mode UA', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/604.1',
        platform: 'MacIntel',
        maxTouchPoints: 5
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.formFactor, 'tablet');
    assert.equal(profile.os, 'ios');
    assert.equal(profile.isMobile, true);
});

test('does not classify MacBook as mobile', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        platform: 'MacIntel',
        maxTouchPoints: 0
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.formFactor, 'desktop');
    assert.equal(profile.isMobile, false);
});

test('does not classify Windows touch laptop as mobile when mouse is present', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        platform: 'Win32',
        maxTouchPoints: 10,
        media: {
            '(pointer: fine)': true,
            '(any-pointer: fine)': true,
            '(hover: hover)': true,
            '(any-hover: hover)': true
        }
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.formFactor, 'desktop');
    assert.equal(profile.isMobile, false);
});

test('uses Client Hints mobile flag when available', () => {
    mockEnv({
        ua: 'Mozilla/5.0',
        platform: 'Linux armv81',
        maxTouchPoints: 5,
        userAgentData: { mobile: true, platform: 'Android' }
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.formFactor, 'phone');
    assert.equal(profile.confidence, 'high');
    assert.equal(profile.reason, 'client-hints-mobile');
});

test('uses touch-primary media query as medium-confidence mobile signal', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (compatible; Unknown)',
        platform: 'Unknown',
        maxTouchPoints: 5,
        media: {
            '(pointer: coarse)': true,
            '(pointer: fine)': false,
            '(hover: hover)': false,
            '(any-hover: hover)': false
        }
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.formFactor, 'phone');
    assert.equal(profile.capabilities.touchPrimary, true);
});

test('detects ChromeOS as desktop', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        platform: 'Linux x86_64',
        maxTouchPoints: 0
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.formFactor, 'desktop');
    assert.equal(profile.os, 'chromeos');
});

test('isIos detects iPhone UA', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        platform: 'iPhone',
        maxTouchPoints: 5
    });
    assert.equal(DeviceDetection.isIos(), true);
});

test('supportsElementFullscreen returns false on iOS', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        platform: 'iPhone',
        maxTouchPoints: 5
    });
    assert.equal(DeviceDetection.supportsElementFullscreen(), false);
});

test('detects Firefox as gecko family', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
        platform: 'Linux x86_64',
        maxTouchPoints: 0
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.engine, 'gecko');
    assert.equal(profile.isGeckoFamily, true);
    assert.equal(DeviceDetection.isGeckoFamily(), true);
});

test('does not treat Chrome like-Gecko as gecko', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        platform: 'Linux x86_64',
        maxTouchPoints: 0
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.engine, 'blink');
    assert.equal(profile.isGeckoFamily, false);
});

test('detects Servo as gecko family', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (X11; Linux x86_64) Servo/0.0.1',
        platform: 'Linux x86_64',
        maxTouchPoints: 0
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.engine, 'servo');
    assert.equal(profile.isGeckoFamily, true);
    assert.equal(DeviceDetection.isServo(), true);
});

test('detects Safari as webkit', () => {
    mockEnv({
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 0
    });
    const profile = DeviceDetection.getProfile(true);
    assert.equal(profile.engine, 'webkit');
    assert.equal(profile.isGeckoFamily, false);
});

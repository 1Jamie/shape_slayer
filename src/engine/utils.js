// Utility functions

// True when focus is on a form control that should receive keyboard input.
function isFormFieldTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

// Calculate distance between two points
function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// Normalize a vector
function normalize(x, y) {
    const len = Math.sqrt(x * x + y * y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
}

// Clamp a value between min and max
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Linear interpolation
function lerp(start, end, t) {
    return start + (end - start) * t;
}

// Random number between min and max (inclusive)
function random(min, max) {
    return Math.random() * (max - min) + min;
}

// Random integer between min and max (inclusive)
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const Utils = {
    isFormFieldTarget,
    distance,
    normalize,
    clamp,
    lerp,
    random,
    randomInt
};

if (typeof window !== 'undefined') {
    window.Engine = window.Engine || {};
    window.Engine.Utils = Utils;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Utils };
}


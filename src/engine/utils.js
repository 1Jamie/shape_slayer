/**
 * Check if an event target is an interactive form control that receives text/keyboard input.
 * @param {EventTarget|HTMLElement|null} target
 * @returns {boolean}
 */
function isFormFieldTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Calculate Euclidean distance between two 2D points.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalize a 2D vector, optionally writing into an out target object.
 * @param {number} x
 * @param {number} y
 * @param {{x: number, y: number}} [out] Optional zero-allocation target object.
 * @returns {{x: number, y: number}}
 */
function normalize(x, y, out) {
    const len = Math.sqrt(x * x + y * y);
    if (out) {
        out.x = len === 0 ? 0 : x / len;
        out.y = len === 0 ? 0 : y / len;
        return out;
    }
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
}

/**
 * Clamp a numeric value between min and max bounds.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between start and end by factor t.
 * @param {number} start
 * @param {number} end
 * @param {number} t Factor usually in range [0, 1]
 * @returns {number}
 */
function lerp(start, end, t) {
    return start + (end - start) * t;
}

/**
 * Random floating point number in range [min, max).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function random(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Random integer in range [min, max] inclusive.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @typedef {Object} EngineUtils
 * @property {typeof isFormFieldTarget} isFormFieldTarget
 * @property {typeof distance} distance
 * @property {typeof normalize} normalize
 * @property {typeof clamp} clamp
 * @property {typeof lerp} lerp
 * @property {typeof random} random
 * @property {typeof randomInt} randomInt
 */

/** @type {EngineUtils} */
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


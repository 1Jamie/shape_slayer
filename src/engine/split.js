/**
 * @typedef {Object} ViewportRect
 * @property {number} x Left offset
 * @property {number} y Top offset
 * @property {number} w Width in pixels
 * @property {number} h Height in pixels
 *
 * @typedef {Object} SplitSession
 * @property {number} seatCount Number of active seats (2)
 * @property {'vertical'|'horizontal'} layout Split orientation layout
 * @property {Array<any>} seats Configured seat input instances
 * @property {{seat0: ViewportRect, seat1: ViewportRect}} viewports Viewport bounds per seat
 */

(function(root) {
    const Engine = root.Engine = root.Engine || {};

    function positiveSize(value, name) {
        const size = Math.floor(Number(value));
        if (!Number.isFinite(size) || size < 1) {
            throw new TypeError(`${name} must be a positive number.`);
        }
        return size;
    }

    /**
     * Compute split-screen half viewports for 2 players.
     * @param {number} logicalW Logical render width
     * @param {number} logicalH Logical render height
     * @param {'vertical'|'horizontal'} [layout='vertical'] Split orientation
     * @returns {{seat0: ViewportRect, seat1: ViewportRect}}
     */
    function layoutHalves(logicalW, logicalH, layout = 'vertical') {
        const width = positiveSize(logicalW, 'logicalW');
        const height = positiveSize(logicalH, 'logicalH');
        if (layout === 'horizontal') {
            const firstH = Math.floor(height / 2);
            return {
                seat0: { x: 0, y: 0, w: width, h: firstH },
                seat1: { x: 0, y: firstH, w: width, h: height - firstH }
            };
        }
        if (layout !== 'vertical') {
            throw new TypeError('Split layout must be "vertical" or "horizontal".');
        }
        const firstW = Math.floor(width / 2);
        return {
            seat0: { x: 0, y: 0, w: firstW, h: height },
            seat1: { x: firstW, y: 0, w: width - firstW, h: height }
        };
    }

    /**
     * Engine Split-screen couch-coop facade.
     */
    const Split = {
        /** @type {SplitSession|null} */
        _session: null,

        layoutHalves,

        /**
         * Create and activate a 2-seat split-screen session.
         * @param {Object} options
         * @param {number} options.logicalW Render width
         * @param {number} options.logicalH Render height
         * @param {'vertical'|'horizontal'} [options.layout='vertical']
         * @param {number} [options.seatCount=2]
         * @param {number} [options.seat0GamepadIndex]
         * @param {number} [options.seat1GamepadIndex]
         * @returns {SplitSession}
         */
        createSession(options = {}) {
            if (this._session) this.endSession();
            const seatCount = Number(options.seatCount) || 2;
            if (seatCount !== 2) throw new TypeError('Engine.Split currently supports exactly two seats.');
            const logicalW = options.logicalW;
            const logicalH = options.logicalH;
            const layout = options.layout || 'vertical';
            const viewports = layoutHalves(logicalW, logicalH, layout);
            const seats = [];
            const hasSeat0Pad = Object.prototype.hasOwnProperty.call(options, 'seat0GamepadIndex');
            const hasSeat1Pad = Object.prototype.hasOwnProperty.call(options, 'seat1GamepadIndex');

            if (Engine.Input && typeof Engine.Input.createSeat === 'function') {
                Engine.Input.clearSeats();
                seats.push(Engine.Input.createSeat({
                    id: 'seat0',
                    gamepadIndex: hasSeat0Pad ? options.seat0GamepadIndex : 0,
                    allowKeyboardMouse: true
                }));
                seats.push(Engine.Input.createSeat({
                    id: 'seat1',
                    gamepadIndex: hasSeat1Pad ? options.seat1GamepadIndex : 1,
                    allowKeyboardMouse: false
                }));
                Engine.Input.setCouchSplitActive(true);
            }

            this._session = { seatCount, layout, seats, viewports };
            return this._session;
        },

        /**
         * Get active split session.
         * @returns {SplitSession|null}
         */
        getSession() {
            return this._session;
        },

        /**
         * @returns {boolean} True if split session is active.
         */
        isActive() {
            return !!this._session;
        },

        /**
         * Terminate active split session and reset input seats.
         */
        endSession() {
            if (Engine.Input) {
                if (typeof Engine.Input.setCouchSplitActive === 'function') {
                    Engine.Input.setCouchSplitActive(false);
                }
                if (typeof Engine.Input.clearSeats === 'function') Engine.Input.clearSeats();
            }
            this._session = null;
        }
    };

    Engine.Split = Split;
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalThis.Engine.Split;
}

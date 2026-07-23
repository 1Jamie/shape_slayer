/**
 * Engine.Director — spawn-point queries for playable regions.
 * Unaware of enemies/modes; callers supply walkability + avoidance.
 */
(function (root) {
    'use strict';

    const Engine = root.Engine = root.Engine || {};

    function randRange(min, max) {
        return min + Math.random() * (max - min);
    }

    /**
     * @param {object} opts
     * @param {number} opts.width
     * @param {number} opts.height
     * @param {number} [opts.margin]
     * @param {number} [opts.radius] entity radius for walkability
     * @param {function(number,number,number):boolean} [opts.isWalkable]
     * @param {Array<{x:number,y:number,distance:number}>} [opts.avoid]
     * @param {number} [opts.maxAttempts]
     * @param {{x:number,y:number,radius:number}} [opts.preferRing] bias toward a ring (arena rim)
     * @returns {{x:number,y:number}|null}
     */
    function findSpawnPoint(opts) {
        const o = opts || {};
        const width = o.width || 1280;
        const height = o.height || 720;
        const margin = o.margin != null ? o.margin : 80;
        const radius = o.radius != null ? o.radius : 28;
        const maxAttempts = o.maxAttempts != null ? o.maxAttempts : 48;
        const avoid = o.avoid || [];
        const isWalkable = typeof o.isWalkable === 'function'
            ? o.isWalkable
            : function () { return true; };
        const ring = o.preferRing || null;

        for (let i = 0; i < maxAttempts; i++) {
            let x;
            let y;
            if (ring && ring.radius > 0 && Math.random() < 0.7) {
                const ang = Math.random() * Math.PI * 2;
                const r = ring.radius * (0.75 + Math.random() * 0.35);
                x = ring.x + Math.cos(ang) * r;
                y = ring.y + Math.sin(ang) * r;
            } else {
                x = randRange(margin, width - margin);
                y = randRange(margin, height - margin);
            }
            x = Math.max(margin, Math.min(width - margin, x));
            y = Math.max(margin, Math.min(height - margin, y));

            if (!isWalkable(x, y, radius)) continue;

            let ok = true;
            for (let a = 0; a < avoid.length; a++) {
                const av = avoid[a];
                if (!av) continue;
                const dx = x - av.x;
                const dy = y - av.y;
                const need = av.distance != null ? av.distance : 120;
                if (dx * dx + dy * dy < need * need) {
                    ok = false;
                    break;
                }
            }
            if (!ok) continue;
            return { x, y };
        }
        return null;
    }

    /**
     * Find several spawn points for a cluster.
     * @param {number} count Number of spawn points to generate
     * @param {Parameters<typeof findSpawnPoint>[0] & {clusterSpacing?: number}} [opts] Options for spawn search and spacing
     * @returns {Array<{x:number, y:number}>} List of found spawn points
     */
    function findSpawnCluster(count, opts) {
        const n = Math.max(1, count || 1);
        const points = [];
        const avoid = (opts && opts.avoid) ? opts.avoid.slice() : [];
        for (let i = 0; i < n; i++) {
            const pt = findSpawnPoint(Object.assign({}, opts, { avoid }));
            if (!pt) break;
            points.push(pt);
            avoid.push({ x: pt.x, y: pt.y, distance: (opts && opts.clusterSpacing) || 70 });
        }
        return points;
    }

    Engine.Director = {
        findSpawnPoint,
        findSpawnCluster
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Engine.Director;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);

// Pure polyline arc-length helpers for Swarm King pheromone trails.
(function () {
    function normalizePoints(points) {
        if (!Array.isArray(points) || points.length < 2) return [];
        return points.map(point => ({ x: point.x, y: point.y }));
    }

    function getPheromoneSegmentBounds(points) {
        const pts = normalizePoints(points);
        if (pts.length < 2) return [0];
        const bounds = [0];
        let cumulative = 0;
        for (let i = 1; i < pts.length; i++) {
            cumulative += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            bounds.push(cumulative);
        }
        return bounds;
    }

    function getPheromoneRouteLength(points) {
        const bounds = getPheromoneSegmentBounds(points);
        return bounds.length > 0 ? bounds[bounds.length - 1] : 0;
    }

    function getPheromonePointAtArc(points, arc) {
        const pts = normalizePoints(points);
        const bounds = getPheromoneSegmentBounds(pts);
        const routeLength = bounds[bounds.length - 1] || 0;
        if (pts.length < 2 || routeLength <= 0) {
            const first = pts[0] || { x: 0, y: 0 };
            return { x: first.x, y: first.y, segmentIndex: 0, tangent: 0 };
        }

        const clampedArc = Math.max(0, Math.min(routeLength, arc));
        if (clampedArc <= 0) {
            const dx = pts[1].x - pts[0].x;
            const dy = pts[1].y - pts[0].y;
            return { x: pts[0].x, y: pts[0].y, segmentIndex: 0, tangent: Math.atan2(dy, dx) };
        }
        if (clampedArc >= routeLength) {
            const last = pts.length - 1;
            const dx = pts[last].x - pts[last - 1].x;
            const dy = pts[last].y - pts[last - 1].y;
            return {
                x: pts[last].x,
                y: pts[last].y,
                segmentIndex: last - 1,
                tangent: Math.atan2(dy, dx)
            };
        }

        for (let i = 1; i < bounds.length; i++) {
            if (clampedArc <= bounds[i]) {
                const segStart = bounds[i - 1];
                const segLen = bounds[i] - segStart;
                const t = segLen > 0 ? (clampedArc - segStart) / segLen : 0;
                const from = pts[i - 1];
                const to = pts[i];
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                return {
                    x: from.x + dx * t,
                    y: from.y + dy * t,
                    segmentIndex: i - 1,
                    tangent: Math.atan2(dy, dx)
                };
            }
        }

        const fallback = pts[pts.length - 1];
        return { x: fallback.x, y: fallback.y, segmentIndex: Math.max(0, pts.length - 2), tangent: 0 };
    }

    function projectPointOnSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq <= 0) {
            const dist = Math.hypot(px - ax, py - ay);
            return { x: ax, y: ay, t: 0, distSq: dist * dist };
        }
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
        const projX = ax + dx * t;
        const projY = ay + dy * t;
        const distX = px - projX;
        const distY = py - projY;
        return { x: projX, y: projY, t, distSq: distX * distX + distY * distY };
    }

    function getPheromoneArcAtPoint(points, x, y) {
        const pts = normalizePoints(points);
        const bounds = getPheromoneSegmentBounds(pts);
        const routeLength = bounds[bounds.length - 1] || 0;
        if (pts.length < 2 || routeLength <= 0) return 0;

        let bestArc = 0;
        let bestDistSq = Infinity;
        for (let i = 1; i < pts.length; i++) {
            const from = pts[i - 1];
            const to = pts[i];
            const proj = projectPointOnSegment(x, y, from.x, from.y, to.x, to.y);
            if (proj.distSq < bestDistSq) {
                bestDistSq = proj.distSq;
                const segStart = bounds[i - 1];
                const segLen = bounds[i] - segStart;
                bestArc = segStart + proj.t * segLen;
            }
        }
        return Math.max(0, Math.min(routeLength, bestArc));
    }

    function validatePheromoneCoverage(assignments, routeLength, gapTolerance = 0) {
        if (!Array.isArray(assignments) || assignments.length === 0) return false;
        if (routeLength <= 0) return true;

        const spans = assignments
            .map(assignment => ({
                start: Math.max(0, assignment.startArc),
                end: Math.min(routeLength, assignment.endArc)
            }))
            .filter(span => span.end > span.start)
            .sort((a, b) => a.start - b.start);

        if (spans.length === 0) return false;
        if (spans[0].start > gapTolerance) return false;

        let covered = spans[0].end;
        for (let i = 1; i < spans.length; i++) {
            if (spans[i].start > covered + gapTolerance) return false;
            covered = Math.max(covered, spans[i].end);
        }
        return covered >= routeLength - gapTolerance;
    }

    const api = {
        getPheromoneSegmentBounds,
        getPheromoneRouteLength,
        getPheromonePointAtArc,
        getPheromoneArcAtPoint,
        validatePheromoneCoverage
    };

    if (typeof window !== 'undefined') {
        window.PheromonePolyline = api;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();

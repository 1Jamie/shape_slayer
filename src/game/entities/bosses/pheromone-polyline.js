// Compatibility facade over Engine.Proc.Polyline for Swarm King pheromone trails.
(function () {
    function getPolyline() {
        if (typeof Engine !== 'undefined' && Engine.Proc && Engine.Proc.Polyline) {
            return Engine.Proc.Polyline;
        }
        return null;
    }

    function getPheromoneSegmentBounds(points) {
        return getPolyline().segmentBounds(points);
    }

    function getPheromoneRouteLength(points) {
        return getPolyline().routeLength(points);
    }

    function getPheromonePointAtArc(points, arc) {
        return getPolyline().pointAtArc(points, arc);
    }

    function getPheromoneArcAtPoint(points, x, y) {
        return getPolyline().arcAtPoint(points, x, y);
    }

    function validatePheromoneCoverage(assignments, routeLength, gapTolerance = 0) {
        return getPolyline().validateCoverage(assignments, routeLength, gapTolerance);
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

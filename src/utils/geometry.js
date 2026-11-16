import { ShapeUtils, Vector2 } from "three";

export const execute = async (app) => {
    app.toCartesian = function (lat, lng, distance) {
        const phi = ((90 - lat) * Math.PI) / 180;
        const theta = ((90 - lng) * Math.PI) / 180;
        return [distance * Math.sin(phi) * Math.cos(theta), distance * Math.cos(phi), distance * Math.sin(phi) * Math.sin(theta)];
    };

    // Long straight edges (e.g. the 49th parallel) would otherwise render as chords cutting below the globe surface
    app.densifyRing = function (ring, maxStep) {
        const result = [ring[0]];

        for (let i = 1; i < ring.length; i++) {
            const [lng0, lat0] = ring[i - 1];
            const [lng1, lat1] = ring[i];
            const wraps = Math.abs(lng1 - lng0) > 180;
            const steps = wraps ? 1 : Math.ceil(Math.max(Math.abs(lng1 - lng0), Math.abs(lat1 - lat0)) / maxStep);

            for (let step = 1; step <= steps; step++) {
                result.push([lng0 + ((lng1 - lng0) * step) / steps, lat0 + ((lat1 - lat0) * step) / steps]);
            }
        }

        return result;
    };

    // Planar triangulation needs rings that never jump across the antimeridian: points stored as ±180 take
    // the side of their neighbours, and a ring that wraps around a pole (Antarctica) gets a detour through it
    app.unwrapRing = function (ring) {
        const points = ring.slice(0, -1).map(([lng, lat]) => [lng, lat]);
        const sides = points.map(([lng]) => (Math.abs(lng) === 180 ? 0 : Math.sign(lng)));
        const count = points.length;
        if (count < 3) return [];

        for (let i = 0; i < count; i++) {
            if (sides[i]) continue;

            let side = 0;
            for (let step = 1; step < count && !side; step++) side = sides[(i - step + count) % count] || sides[(i + step) % count];
            points[i][0] = 180 * (side || 1);
        }

        const last = points[count - 1];
        if (last[0] === points[0][0] && last[1] === points[0][1]) points.pop();

        const jumps = points.map((point, i) => i).filter((i) => Math.abs(points[(i + 1) % points.length][0] - points[i][0]) > 180);
        if (jumps.length !== 1) return points;

        const index = jumps[0];
        const [from, to] = [points[index], points[(index + 1) % points.length]];
        const side = Math.sign(from[0]);
        const pole = points.reduce((sum, [, lat]) => sum + lat, 0) < 0 ? -90 : 90;

        points.splice(index + 1, 0, [side * 180, from[1]], [side * 180, pole], [-side * 180, pole], [-side * 180, to[1]]);
        return points;
    };

    // Earcut on lng/lat is linear, then long edges are split so the cap follows the sphere's curvature;
    // splitting decisions depend only on the edge itself, so neighbouring triangles never leave cracks
    app.triangulatePolygon = function (rings, maxEdge) {
        const unwrapped = rings.map((ring) => app.unwrapRing(ring)).filter((ring, i) => i === 0 || ring.length >= 3);
        if (unwrapped[0].length < 3) return { vertices: [], indices: [] };

        const vertices = unwrapped.flat();
        const faces = ShapeUtils.triangulateShape(
            unwrapped[0].map(([lng, lat]) => new Vector2(lng, lat)),
            unwrapped.slice(1).map((hole) => hole.map(([lng, lat]) => new Vector2(lng, lat))),
        );

        const indices = [];
        const midpoints = new Map();
        const isLong = (a, b) => Math.max(Math.abs(vertices[a][0] - vertices[b][0]), Math.abs(vertices[a][1] - vertices[b][1])) > maxEdge;

        const midpoint = (a, b) => {
            const key = a < b ? `${a}_${b}` : `${b}_${a}`;
            if (!midpoints.has(key)) {
                midpoints.set(key, vertices.length);
                vertices.push([(vertices[a][0] + vertices[b][0]) / 2, (vertices[a][1] + vertices[b][1]) / 2]);
            }
            return midpoints.get(key);
        };

        const split = (a, b, c) => {
            const long = [isLong(a, b), isLong(b, c), isLong(c, a)];
            const total = long.filter(Boolean).length;

            if (!total) return indices.push(a, b, c);

            if (total === 3) {
                const [ab, bc, ca] = [midpoint(a, b), midpoint(b, c), midpoint(c, a)];
                split(a, ab, ca);
                split(ab, b, bc);
                split(ca, bc, c);
                return split(ab, bc, ca);
            }

            if (total === 1) {
                if (long[1]) return split(b, c, a);
                if (long[2]) return split(c, a, b);
                const ab = midpoint(a, b);
                split(a, ab, c);
                return split(ab, b, c);
            }

            if (!long[0]) return split(b, c, a);
            if (!long[1]) return split(c, a, b);
            const [ab, bc] = [midpoint(a, b), midpoint(b, c)];
            split(ab, b, bc);
            split(a, ab, bc);
            return split(a, bc, c);
        };

        for (const [a, b, c] of faces) split(a, b, c);

        return { vertices, indices };
    };
};

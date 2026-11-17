const { writeFileSync, mkdirSync } = require("node:fs");
const { presimplify, simplify } = require("topojson-simplify");
const { quantize, feature } = require("topojson-client");
const { geoArea } = require("d3-geo");
const source = require("world-atlas/countries-10m.json");
const countryNames = require("../src/libs/countryNames.json");
const territories = require("./territories.json");

const minWeight = Number(process.argv[2] ?? 0.0015);
const output = "./public/data/countries.json";

// Simplification always keeps arc endpoints only, so a small island (one closed arc) shrinks to a single point
// and a microstate bordered by neighbours (Monaco, Vatican City) to a line; pinning the three most significant
// points of every arc in a small ring keeps a recognisable shape of each of them
const presimplified = presimplify(source);
const smallRing = 1;

const pinArc = (arc) => {
    arc.slice(1, -1)
        .map((point, index) => ({ weight: point[2], index: index + 1 }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .forEach(({ index }) => (arc[index][2] = Infinity));
};

for (const geometry of presimplified.objects.countries.geometries) {
    const polygons = geometry.type === "Polygon" ? [geometry.arcs] : geometry.type === "MultiPolygon" ? geometry.arcs : [];

    for (const ring of polygons.flat()) {
        const arcs = ring.map((index) => presimplified.arcs[index < 0 ? ~index : index]);
        const points = arcs.flat();
        const lngs = points.map((point) => point[0]);
        const lats = points.map((point) => point[1]);
        const span = Math.max(Math.max(...lngs) - Math.min(...lngs), Math.max(...lats) - Math.min(...lats));

        if (span < smallRing) arcs.forEach(pinArc);
    }
}

// Simplifying 10m keeps tiny islands (Tuvalu, Gibraltar) that 50m drops entirely
const topology = quantize(simplify(presimplified, minWeight), 1e5);

topology.objects = { countries: topology.objects.countries };

for (const geometry of topology.objects.countries.geometries) {
    geometry.properties = { name: countryNames[geometry.properties.name] ?? geometry.properties.name };
    delete geometry.id;
}

// Natural Earth keeps overseas regions inside their parent country; polygons falling into a territory's box
// move to a geometry of their own, still built from the same arcs so shared borders stay intact
const geometries = topology.objects.countries.geometries;
const found = Object.fromEntries(territories.map((territory) => [territory.name, 0]));

for (const geometry of [...geometries]) {
    const candidates = territories.filter((territory) => territory.parent === geometry.properties.name);
    if (!candidates.length || geometry.type !== "MultiPolygon") continue;

    const split = new Map();

    geometry.arcs = geometry.arcs.filter((polygon) => {
        const [ring] = feature(topology, { type: "Polygon", arcs: polygon }).geometry.coordinates;
        const lng = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
        const lat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
        const territory = candidates.find(({ boxes }) =>
            boxes.some(([west, south, east, north]) => lng >= west && lng <= east && lat >= south && lat <= north),
        );

        if (!territory) return true;
        split.set(territory.name, [...(split.get(territory.name) || []), polygon]);
        found[territory.name]++;
        return false;
    });

    for (const [name, polygons] of split) {
        geometries.push(
            polygons.length === 1
                ? { type: "Polygon", arcs: polygons[0], properties: { name } }
                : { type: "MultiPolygon", arcs: polygons, properties: { name } },
        );
    }
}

const missing = Object.entries(found)
    .filter(([, count]) => !count)
    .map(([name]) => name);
if (missing.length) throw new Error(`No polygons found for: ${missing.join(", ")}`);
// A parent split completely into territories (e.g. Australian Indian Ocean Territories) is left without polygons
topology.objects.countries.geometries = geometries.filter((geometry) => geometry.arcs.length);

// A ring reduced to a few pinned points can end up wound the wrong way, which d3 reads as "the whole sphere
// except this island"; reversing its arcs (and each arc's direction, ~index) restores the tiny outline
let reversed = 0;

for (const geometry of topology.objects.countries.geometries) {
    const polygons = geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs;

    for (const polygon of polygons) {
        const outline = feature(topology, { type: "Polygon", arcs: [polygon[0]] }).geometry;
        if (geoArea(outline) <= 2 * Math.PI) continue;

        polygon[0] = polygon[0]
            .slice()
            .reverse()
            .map((index) => ~index);
        reversed++;
    }
}

const collapsed = feature(topology, topology.objects.countries)
    .features.filter(({ geometry }) => {
        const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
        return !polygons.some(([ring]) => new Set(ring.map((point) => point.join())).size >= 3);
    })
    .map(({ properties }) => properties.name);

// Vatican City is already a line in the source data, such places are shown as a pont with a marker
if (collapsed.length) console.warn(`Shown as a point, no drawable shape in the source data: ${collapsed.join(", ")}`);

const points = topology.arcs.reduce((sum, arc) => sum + arc.length, 0);
const countries = feature(topology, topology.objects.countries).features;
const json = JSON.stringify(topology);

mkdirSync("./public/data", { recursive: true });
writeFileSync(output, json);

console.log(
    `Split ${Object.entries(found)
        .map(([name, count]) => `${name} (${count})`)
        .join(", ")}`,
);
console.log(`Saved ${countries.length} countries, ${points} points to ${output} (${(json.length / 1024).toFixed(0)} KB)`);
console.log(`Fixed ${reversed} inverted rings`);

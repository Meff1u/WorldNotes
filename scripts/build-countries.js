const { writeFileSync, mkdirSync } = require("node:fs");
const { presimplify, simplify } = require("topojson-simplify");
const { quantize, feature } = require("topojson-client");
const source = require("world-atlas/countries-10m.json");
const countryNames = require("../src/libs/countryNames.json");
const territories = require("./territories.json");

const minWeight = Number(process.argv[2] ?? 0.0015);
const output = "./public/data/countries.json";

// Simplifying 10m keeps tiny islands (Tuvalu, Gibraltar) that 50m drops entirely
const topology = quantize(simplify(presimplify(source), minWeight), 1e5);

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
        const territory = candidates.find(({ boxes }) => boxes.some(([west, south, east, north]) => lng >= west && lng <= east && lat >= south && lat <= north));

        if (!territory) return true;
        split.set(territory.name, [...(split.get(territory.name) || []), polygon]);
        found[territory.name]++;
        return false;
    });

    for (const [name, polygons] of split) {
        geometries.push(polygons.length === 1
            ? { type: "Polygon", arcs: polygons[0], properties: { name } }
            : { type: "MultiPolygon", arcs: polygons, properties: { name } });
    }
}

const missing = Object.entries(found).filter(([, count]) => !count).map(([name]) => name);
if (missing.length) throw new Error(`No polygons found for: ${missing.join(", ")}`);

const points = topology.arcs.reduce((sum, arc) => sum + arc.length, 0);
const countries = feature(topology, topology.objects.countries).features;
const json = JSON.stringify(topology);

mkdirSync("./public/data", { recursive: true });
writeFileSync(output, json);

console.log(`Split ${Object.entries(found).map(([name, count]) => `${name} (${count})`).join(", ")}`);
console.log(`Saved ${countries.length} countries, ${points} points to ${output} (${(json.length / 1024).toFixed(0)} KB)`);

const { writeFileSync, mkdirSync } = require("node:fs");
const { presimplify, simplify } = require("topojson-simplify");
const { quantize, feature } = require("topojson-client");
const source = require("world-atlas/countries-10m.json");

const minWeight = Number(process.argv[2] ?? 0.0015);
const output = "./public/data/countries.json";

// Simplifying 10m keeps tiny islands (Tuvalu, Gibraltar) that 50m drops entirely
const topology = quantize(simplify(presimplify(source), minWeight), 1e5);

topology.objects = { countries: topology.objects.countries };

for (const geometry of topology.objects.countries.geometries) {
    geometry.properties = { name: geometry.properties.name };
    delete geometry.id;
}

const points = topology.arcs.reduce((sum, arc) => sum + arc.length, 0);
const countries = feature(topology, topology.objects.countries).features;
const json = JSON.stringify(topology);

mkdirSync("./public/data", { recursive: true });
writeFileSync(output, json);

console.log(`Saved ${countries.length} countries, ${points} points to ${output} (${(json.length / 1024).toFixed(0)} KB)`);

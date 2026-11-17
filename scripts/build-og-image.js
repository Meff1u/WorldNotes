const { writeFileSync } = require("node:fs");
const { Resvg } = require("@resvg/resvg-js");
const { feature } = require("topojson-client");
const { geoOrthographic, geoPath, geoGraticule10 } = require("d3-geo");
const topology = require("../public/data/countries.json");

const width = 1200;
const height = 630;
const output = "./public/og-image.png";

const countries = feature(topology, topology.objects.countries).features;
const center = [890, 330];
const radius = 300;

// Orthographic projection draws the sphere as seen from space, the same look as the globe in the app
const projection = geoOrthographic().rotate([-18, -28]).translate(center).scale(radius).clipAngle(90).precision(0.3);
const path = geoPath(projection);

const colors = {
    Poland: "#22c55e",
    Spain: "#f59e0b",
    Egypt: "#ef4444",
    Kenya: "#a855f7",
    Norway: "#06b6d4",
    Turkey: "#ec4899",
};
const selected = "Italy";

const land = countries
    .filter((country) => country.properties.name !== selected)
    .map((country) => {
        const d = path(country);
        if (!d) return "";
        return `<path d="${d}" fill="${colors[country.properties.name] || "#2b3547"}" stroke="#aabee1" stroke-opacity="0.28" stroke-width="0.8"/>`;
    })
    .join("");

// The selected country is drawn last and slightly lifted, like a selection in the app
const highlight = `<path d="${path(countries.find((country) => country.properties.name === selected))}" transform="translate(-2 -4)" fill="#6a9cf7" stroke="#6aa6ff" stroke-width="3" stroke-linejoin="round"/>`;

let chipX = 80;
const chips = [`${countries.length} countries`, "Groups", "Profiles", "No account"]
    .map((label) => {
        const chipWidth = label.length * 10.6 + 34;
        const svg = `<rect x="${chipX}" y="430" width="${chipWidth}" height="40" rx="20" fill="#111a2b" stroke="#2a3a55"/><text x="${chipX + chipWidth / 2}" y="456" text-anchor="middle" font-size="18" font-weight="600" fill="#b8c4d8">${label}</text>`;
        chipX += chipWidth + 12;
        return svg;
    })
    .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Segoe UI, Inter, Arial, sans-serif">
<defs>
<radialGradient id="glow" cx="${center[0]}" cy="${center[1]}" r="380" gradientUnits="userSpaceOnUse"><stop offset="0.76" stop-color="#3f74c4" stop-opacity="0.38"/><stop offset="1" stop-color="#3f74c4" stop-opacity="0"/></radialGradient>
<radialGradient id="shade" cx="820" cy="250" r="380" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></radialGradient>
<linearGradient id="fade" x1="0" x2="1"><stop offset="0.45" stop-color="#080c14"/><stop offset="0.62" stop-color="#080c14" stop-opacity="0"/></linearGradient>
</defs>
<rect width="${width}" height="${height}" fill="#080c14"/>
<circle cx="${center[0]}" cy="${center[1]}" r="380" fill="url(#glow)"/>
<path d="${path({ type: "Sphere" })}" fill="#0f1a2c"/>
<path d="${path(geoGraticule10())}" fill="none" stroke="#aabee1" stroke-opacity="0.07"/>
${land}
${highlight}
<path d="${path({ type: "Sphere" })}" fill="url(#shade)"/>
<rect width="${width}" height="${height}" fill="url(#fade)"/>
<g transform="translate(80 150)" fill="none" stroke="#6aa6ff" stroke-width="3.2" stroke-linecap="round"><circle cx="28" cy="28" r="25"/><path d="M3 28h50M28 3a38 38 0 0 1 0 50M28 3a38 38 0 0 0 0 50"/></g>
<text x="80" y="290" font-size="92" font-weight="700" fill="#e6ebf4" letter-spacing="-2">WorldNotes</text>
<text x="82" y="350" font-size="30" fill="#8c97ab">Notes, colors and groups for every</text>
<text x="82" y="390" font-size="30" fill="#8c97ab">country on an interactive 3D globe</text>
${chips}
<text x="82" y="560" font-size="20" font-weight="600" fill="#6aa6ff">meff1u.github.io/WorldNotes</text>
</svg>`;

const png = new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" } }).render().asPng();
writeFileSync(output, png);

console.log(`Saved ${output} with ${countries.length} countries (${(png.length / 1024).toFixed(0)} KB)`);

import Globe from "globe.gl";
import { BufferAttribute, BufferGeometry, Color, DoubleSide, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial } from "three";
import { feature } from "topojson-client";
import { geoArea, geoBounds, geoCentroid, geoContains } from "d3-geo";
import countryLabels from "../libs/countryLabels.json";

export const execute = async (app) => {
    const radius = 100;
    const color = new Color();
    let fullColorUpload = false;

    app.hovered = null;
    app.selected = null;

    app.loadCountries = async function () {
        const response = await fetch(app.constants.countriesUrl);
        if (!response.ok) throw new Error(`Countries request failed with status ${response.status}`);

        const topology = await response.json();

        return feature(topology, topology.objects.countries)
            .features.map((country) => {
                const source = country.geometry.type === "Polygon" ? [country.geometry.coordinates] : country.geometry.coordinates;
                const polygons = source.map((polygon) => polygon.map((ring) => app.densifyRing(ring, 1)));
                const geometry = { type: "MultiPolygon", coordinates: polygons };
                const parts = polygons.map((coordinates) => {
                    const polygon = { type: "Polygon", coordinates };
                    return { coordinates, polygon, bounds: geoBounds(polygon) };
                });

                const name = country.properties.name;
                const view = app.getCountryView(geometry, parts, source.flat(2));
                return { name, label: countryLabels[name] ?? "Country", searchName: app.normalizeText(name), geometry, parts, view };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    // Large countries center on their main landmass so overseas territories don't drag the camera away,
    // tiny archipelagos center on the whole group and get a marker since their islands are barely visible
    app.getCountryView = function (geometry, parts, points) {
        const small = geoArea(geometry) < app.constants.view.smallArea;
        const target = small ? geometry : parts.reduce((best, part) => (geoArea(part.polygon) > geoArea(best.polygon) ? part : best)).polygon;

        let [lng, lat] = geoCentroid(target);
        const [[west, south], [east, north]] = geoBounds(target);
        const span = Math.max(north - south, (east - west + 360) % 360) || 0;

        // A shape with no area (Vatican City is a line in the source data) has no centroid, so its raw points are used
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) [lng, lat] = geoCentroid({ type: "MultiPoint", coordinates: points });

        return { lat, lng, span, small, altitude: Math.min(2.2, Math.max(0.15, 0.12 + span * 0.04)) };
    };

    app.fitAltitude = function (altitude) {
        return altitude * Math.max(1, (window.innerHeight / window.innerWidth) * 0.8);
    };

    app.getCapColor = function (country) {
        const colors = app.getThemeColors();
        const custom = app.getCountryColor(country.name);
        const base = custom || colors.land;

        if (country === app.selected) return custom ? app.mixColors(custom, "#ffffff", 0.18) : app.mixColors(base, colors.accent, 0.5);
        if (country === app.hovered) return custom ? app.mixColors(custom, "#ffffff", 0.1) : app.mixColors(base, colors.accent, 0.22);

        // While a group is shown its members take on the group color and everything else fades towards the ocean
        if (app.highlightedGroup) {
            return app.isHighlightMember(country.name)
                ? app.mixColors(base, app.state.groups[app.highlightedGroup].color, custom ? 0.35 : 0.6)
                : app.mixColors(base, colors.ocean, 0.55);
        }

        return base;
    };

    app.getSideColor = function (country) {
        const colors = app.getThemeColors();
        return app.mixColors(app.getCountryColor(country.name) || colors.land, "#000000", colors.sideShade);
    };

    app.getCountryLabel = function (country) {
        const note = app.getEntry(country.name)?.note.trim();
        const preview = note && note.length > 90 ? `${note.slice(0, 90)}…` : note;
        const groups = app
            .getCountryGroups(country.name)
            .map((group) => group.name)
            .join(", ");
        return `<strong>${app.escapeHtml(country.name)}</strong>${groups ? `<em>${app.escapeHtml(groups)}</em>` : ""}${preview ? `<span>${app.escapeHtml(preview)}</span>` : ""}`;
    };

    // All countries share one mesh and one line object, so the whole map costs two draw calls
    app.buildLand = function () {
        const { altitude } = app.constants;
        const positions = [];
        const indices = [];
        const borders = [];
        let offset = 0;

        for (const country of app.countries) {
            const start = offset;
            const indexStart = indices.length;

            for (const part of country.parts) {
                const { vertices, indices: triangles } = app.triangulatePolygon(part.coordinates, 3);

                for (const [lng, lat] of vertices) positions.push(...app.toCartesian(lat, lng, radius * (1 + altitude.base)));
                for (const index of triangles) indices.push(index + offset);
                offset += vertices.length;

                app.forEachSegment(part.coordinates, (from, to) =>
                    borders.push(
                        ...app.toCartesian(from[1], from[0], radius * (1 + altitude.border)),
                        ...app.toCartesian(to[1], to[0], radius * (1 + altitude.border)),
                    ),
                );
            }

            country.range = { start, count: offset - start, indexStart, indexCount: indices.length - indexStart };
        }

        const landGeometry = new BufferGeometry();
        landGeometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
        landGeometry.setAttribute("color", new BufferAttribute(new Float32Array(offset * 3), 3));
        landGeometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));

        const borderGeometry = new BufferGeometry();
        borderGeometry.setAttribute("position", new BufferAttribute(new Float32Array(borders), 3));

        // The raised cap reuses the land buffers through a draw range, so selecting even Russia builds no new triangles
        const capGeometry = new BufferGeometry();
        capGeometry.setAttribute("position", landGeometry.getAttribute("position"));
        capGeometry.setIndex(landGeometry.index);

        app.land = new Mesh(landGeometry, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
        app.land.onAfterRender = () => {
            fullColorUpload = false;
        };
        app.borders = new LineSegments(borderGeometry, new LineBasicMaterial({ transparent: true, depthWrite: false }));
        app.selectionCap = new Mesh(capGeometry, new MeshBasicMaterial({ side: DoubleSide }));
        app.selectionWalls = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ side: DoubleSide }));

        app.selectionCap.scale.setScalar((1 + altitude.selected) / (1 + altitude.base));
        app.selectionCap.visible = app.selectionWalls.visible = false;
        app.selectionCap.frustumCulled = app.selectionWalls.frustumCulled = false;

        app.globe.scene().add(app.land, app.borders, app.selectionCap, app.selectionWalls);
    };

    app.forEachSegment = function (rings, callback) {
        for (const ring of rings) {
            for (let i = 1; i < ring.length; i++) {
                if (Math.abs(ring[i][0] - ring[i - 1][0]) <= 180) callback(ring[i - 1], ring[i]);
            }
        }
    };

    app.buildWalls = function (country) {
        const { altitude } = app.constants;
        const positions = [];

        for (const part of country.parts) {
            app.forEachSegment(part.coordinates, (from, to) => {
                const [a, b] = [from, to].map(([lng, lat]) => app.toCartesian(lat, lng, radius * (1 + altitude.base)));
                const [c, d] = [from, to].map(([lng, lat]) => app.toCartesian(lat, lng, radius * (1 + altitude.selected)));
                positions.push(...a, ...b, ...c, ...b, ...d, ...c);
            });
        }

        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
        return geometry;
    };

    app.paintCountry = function (country) {
        const attribute = app.land.geometry.getAttribute("color");
        const { start, count } = country.range;

        color.set(app.getCapColor(country));
        for (let i = start; i < start + count; i++) attribute.setXYZ(i, color.r, color.g, color.b);

        // A pending full repaint must not be narrowed down to this country's range before it reaches the GPU
        if (!fullColorUpload) attribute.addUpdateRange(start * 3, count * 3);
        attribute.needsUpdate = true;

        if (country === app.selected) {
            app.selectionCap.material.color.set(app.getCapColor(country));
            app.selectionWalls.material.color.set(app.getSideColor(country));
        }
    };

    app.refreshCountry = function (country) {
        if (country) app.paintCountry(country);
    };

    app.refreshPolygons = function () {
        const attribute = app.land.geometry.getAttribute("color");

        for (const country of app.countries) {
            color.set(app.getCapColor(country));
            const { start, count } = country.range;
            for (let i = start; i < start + count; i++) attribute.setXYZ(i, color.r, color.g, color.b);
        }

        attribute.clearUpdateRanges();
        fullColorUpload = true;
        attribute.needsUpdate = true;
        if (app.selected) app.paintCountry(app.selected);
    };

    app.buildSelection = function () {
        const accent = app.getThemeColors().accent;
        const country = app.selected;
        const marker = country?.view.small ? [{ ...country.view, maxRadius: Math.max(0.5, country.view.span * 0.7) }] : [];

        app.selectionWalls.geometry.dispose();
        app.selectionWalls.geometry = country ? app.buildWalls(country) : new BufferGeometry();
        app.selectionCap.visible = app.selectionWalls.visible = Boolean(country);

        if (country) {
            app.selectionCap.geometry.setDrawRange(country.range.indexStart, country.range.indexCount);
            app.paintCountry(country);
        }

        app.globe
            .pathsData(country ? country.parts.flatMap((part) => part.coordinates.map((ring) => ({ points: ring.map(([lng, lat]) => [lat, lng]) }))) : [])
            .pathColor(() => accent)
            .ringsData(marker)
            .ringColor(
                () => (t) =>
                    `${accent}${Math.round((1 - t) * 255)
                        .toString(16)
                        .padStart(2, "0")}`,
            );
    };

    app.refreshGlobeTheme = function () {
        if (!app.globe) return;

        const colors = app.getThemeColors();

        app.globe.backgroundColor(colors.background).atmosphereColor(colors.atmosphere);

        app.globe.globeMaterial().color.set(colors.ocean);
        app.borders.material.color.set(colors.stroke);
        app.borders.material.opacity = colors.strokeOpacity;
        app.refreshPolygons();
        app.buildSelection();
    };

    app.createGlobe = async function (element) {
        const { view, altitude } = app.constants;

        app.countries = await app.loadCountries();

        app.globe = new Globe(element, { rendererConfig: { antialias: true, alpha: false } })
            .width(window.innerWidth)
            .height(window.innerHeight)
            .enablePointerInteraction(false)
            .showAtmosphere(true)
            .atmosphereAltitude(0.16)
            .pathPoints("points")
            .pathPointLat((point) => point[0])
            .pathPointLng((point) => point[1])
            .pathPointAlt(altitude.selected + 0.0005)
            .pathStroke(2.5)
            .pathResolution(2)
            .pathTransitionDuration(0)
            .ringMaxRadius("maxRadius")
            .ringAltitude(altitude.selected)
            .ringPropagationSpeed((ring) => ring.maxRadius * 0.8)
            .ringRepeatPeriod(1100);

        app.globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2));
        app.startDepthRange();

        const controls = app.globe.controls();
        controls.minDistance = view.minDistance;
        controls.maxDistance = view.maxDistance;
        controls.zoomSpeed = 0.8;
        controls.rotateSpeed = 0.6;

        app.globe.globeMaterial().shininess = 4;
        app.globe.pointOfView({ ...view.initial, altitude: app.fitAltitude(view.initial.altitude) });

        app.buildLand();
        app.refreshGlobeTheme();
        app.bindGlobePointer(element);

        window.addEventListener("resize", () => {
            app.globe.width(window.innerWidth).height(window.innerHeight);
            app.setViewShift(app.viewShift.open, true);
        });
    };

    // Depth precision depends on the near plane: keeping it just in front of the globe instead of at 0.05
    // stops land and ocean from flickering into each other when zoomed out, especially on mobile GPUs
    app.startDepthRange = function () {
        const camera = app.globe.camera();
        let last = 0;

        const update = () => {
            const distance = camera.position.length();
            if (Math.abs(distance - last) > 0.01) {
                last = distance;
                camera.near = Math.max(0.1, (distance - radius) * 0.5);
                camera.far = distance + radius * 1.5;
                camera.updateProjectionMatrix();
            }
            requestAnimationFrame(update);
        };

        update();
    };

    // Hit testing on lat/lng instead of raycasting thousands of triangles keeps pointer moves cheap
    app.findCountryAt = function (x, y) {
        const coords = app.globe.toGlobeCoords(x, y);
        if (!coords) return null;

        const { lat, lng } = coords;

        return (
            app.countries.find((country) =>
                country.parts.some(
                    ({ polygon, bounds: [[west, south], [east, north]] }) =>
                        lat >= south &&
                        lat <= north &&
                        (west <= east ? lng >= west && lng <= east : lng >= west || lng <= east) &&
                        geoContains(polygon, [lng, lat]),
                ),
            ) || null
        );
    };

    app.setHovered = function (country) {
        if (country === app.hovered) return;

        const previous = app.hovered;
        app.hovered = country;
        app.refreshCountry(previous);
        app.refreshCountry(country);
    };

    app.bindGlobePointer = function (element) {
        const tooltip = document.getElementById("tooltip");
        let pointer = null;
        let press = null;
        let frame = null;

        const update = () => {
            frame = null;

            const country = pointer && !press?.dragging ? app.findCountryAt(pointer.x, pointer.y) : null;
            app.setHovered(country);
            element.style.cursor = country ? "pointer" : "";

            if (country && pointer.type === "mouse") {
                tooltip.innerHTML = app.getCountryLabel(country);
                tooltip.style.transform = `translate(${pointer.x + 14}px, ${pointer.y + 18}px)`;
                tooltip.hidden = false;
            } else {
                tooltip.hidden = true;
            }
        };

        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };

        element.addEventListener("pointermove", (event) => {
            pointer = { x: event.clientX, y: event.clientY, type: event.pointerType };
            if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4) press.dragging = true;
            schedule();
        });

        element.addEventListener("pointerdown", (event) => {
            if (event.button === 0) press = { x: event.clientX, y: event.clientY, dragging: false };
        });

        element.addEventListener("pointerup", (event) => {
            if (press && !press.dragging) {
                const country = app.findCountryAt(event.clientX, event.clientY);
                if (country) app.selectCountry(country);
                else app.clearSelection();
            }

            press = null;
            if (event.pointerType !== "mouse") pointer = null;
            schedule();
        });

        element.addEventListener("pointerleave", () => {
            pointer = null;
            schedule();
        });

        element.addEventListener("wheel", schedule, { passive: true });
    };

    app.viewShift = { open: false, x: 0, y: 0, frame: null };

    // Shifts the projection instead of the canvas so the country isn't hidden under the panel and pointer picking stays accurate
    app.setViewShift = function (open, instant = false) {
        const shift = app.viewShift;
        const panel = document.getElementById("panel");
        const mobile = matchMedia("(max-width: 720px)").matches;
        const target = {
            x: open && !mobile ? (panel.offsetWidth + 16) / 2 : 0,
            y: open && mobile ? (panel.offsetHeight + 12) / 2 : 0,
        };
        const start = { x: shift.x, y: shift.y };
        const startTime = performance.now();
        const duration = instant ? 0 : 450;

        shift.open = open;
        cancelAnimationFrame(shift.frame);

        const step = (now) => {
            const progress = duration ? Math.min(1, (now - startTime) / duration) : 1;
            const eased = 1 - Math.pow(1 - progress, 3);
            const camera = app.globe.camera();
            const { innerWidth: width, innerHeight: height } = window;

            shift.x = start.x + (target.x - start.x) * eased;
            shift.y = start.y + (target.y - start.y) * eased;

            if (shift.x || shift.y) camera.setViewOffset(width, height, shift.x, shift.y, width, height);
            else camera.clearViewOffset();

            if (progress < 1) shift.frame = requestAnimationFrame(step);
        };

        step(startTime);
    };

    app.findCountry = function (name) {
        return app.countries?.find((country) => country.name === name) || null;
    };

    app.selectCountry = function (country, focus = false) {
        if (!country) return app.clearSelection();

        const previous = app.selected;
        app.selected = country;
        app.refreshCountry(previous);
        app.buildSelection();
        app.openPanel(country);
        if (focus) app.focusCountry(country);
    };

    app.clearSelection = function () {
        if (!app.selected) return;

        const previous = app.selected;
        app.selected = null;
        app.refreshCountry(previous);
        app.buildSelection();
        app.closePanel();
    };

    app.focusCountry = function (country) {
        const { lat, lng, altitude } = country.view;
        app.globe.pointOfView({ lat, lng, altitude: app.fitAltitude(altitude) }, app.constants.view.transition);
    };

    app.zoomBy = function (factor) {
        const { altitude, ...position } = app.globe.pointOfView();
        const { minDistance, maxDistance } = app.constants.view;
        const next = Math.min(maxDistance / radius - 1, Math.max(minDistance / radius - 1, altitude * factor));

        app.globe.pointOfView({ ...position, altitude: next }, 400);
    };

    app.resetView = function () {
        const { initial, transition } = app.constants.view;
        app.globe.pointOfView({ ...initial, altitude: app.fitAltitude(initial.altitude) }, transition);
    };
};

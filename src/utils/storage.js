import countryNames from "../libs/countryNames.json";

export const execute = async (app) => {
    const timestamp = (value) => (Number.isNaN(Date.parse(value)) ? new Date().toISOString() : value);

    app.createEmptyState = function () {
        return {
            version: app.constants.dataVersion,
            settings: { theme: document.documentElement.dataset.theme || "dark" },
            countries: {},
            groups: {},
        };
    };

    app.loadState = function () {
        try {
            const raw = localStorage.getItem(app.constants.storageKey);
            app.state = raw ? app.normalizeState(JSON.parse(raw)) : app.createEmptyState();
            if (raw && JSON.stringify(app.state) !== raw) app.saveState();
        } catch (error) {
            console.error("Failed to read saved state:", error);
            app.state = app.createEmptyState();
        }
    };

    app.saveState = function () {
        try {
            localStorage.setItem(app.constants.storageKey, JSON.stringify(app.state));
            return true;
        } catch (error) {
            console.error("Failed to save state:", error);
            app.toast("Could not save to browser storage", "error");
            return false;
        }
    };

    // Throws on malformed data so import can report it, drops unknown fields silently
    app.normalizeState = function (data) {
        const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

        if (!isObject(data)) throw new Error("Data is not an object");
        if (data.countries && !isObject(data.countries)) throw new Error("\"countries\" must be an object");
        if (data.groups && !isObject(data.groups)) throw new Error("\"groups\" must be an object");

        const state = app.createEmptyState();

        if (["light", "dark"].includes(data.settings?.theme)) state.settings.theme = data.settings.theme;

        for (const [id, group] of Object.entries(data.groups || {})) {
            const name = typeof group?.name === "string" ? group.name.trim().slice(0, app.constants.groupNameLength) : "";
            if (!name) continue;

            const members = (Array.isArray(group.members) ? group.members : [])
                .filter((member) => typeof member === "string")
                .map((member) => countryNames[member] ?? member);

            state.groups[id] = {
                name,
                color: app.isHexColor(group.color) ? group.color.toLowerCase() : app.constants.palette[0],
                note: typeof group.note === "string" ? group.note : "",
                members: [...new Set(members)],
                createdAt: timestamp(group.createdAt),
                updatedAt: timestamp(group.updatedAt),
            };
        }

        // Notes saved before names were expanded (e.g. "eSwatini") move to the current name
        for (const [savedName, entry] of Object.entries(data.countries || {})) {
            if (!isObject(entry)) continue;

            const name = countryNames[savedName] ?? savedName;
            if (name !== savedName && data.countries[name]) continue;

            const note = typeof entry.note === "string" ? entry.note : "";
            const color = app.isHexColor(entry.color) ? entry.color.toLowerCase() : null;
            const colorSource = state.groups[entry.colorSource]?.members.includes(name) ? entry.colorSource : null;
            if (!note.trim() && !color && !colorSource) continue;

            state.countries[name] = { note, color, colorSource, updatedAt: timestamp(entry.updatedAt) };
        }

        return state;
    };

    app.getEntry = function (name) {
        return app.state.countries[name] || null;
    };

    // Group color wins only when the country explicitly switched to it
    app.getCountryColor = function (name) {
        const entry = app.getEntry(name);
        const group = entry?.colorSource && app.state.groups[entry.colorSource];
        return group ? group.color : entry?.color || null;
    };

    app.updateEntry = function (name, changes) {
        const entry = { note: "", color: null, colorSource: null, ...app.getEntry(name), ...changes, updatedAt: new Date().toISOString() };

        if (!entry.note.trim() && !entry.color && !entry.colorSource) delete app.state.countries[name];
        else app.state.countries[name] = entry;

        const saved = app.saveState();
        app.updateStats();
        return saved;
    };

    app.removeEntry = function (name) {
        delete app.state.countries[name];
        app.saveState();
        app.updateStats();
    };

    app.getStateSummary = function () {
        const entries = Object.values(app.state.countries);
        return {
            entries: entries.length,
            notes: entries.filter((entry) => entry.note.trim()).length,
            colored: Object.keys(app.state.countries).filter((name) => app.getCountryColor(name)).length,
            groups: Object.keys(app.state.groups).length,
        };
    };

    app.plural = function (count, word) {
        return `${count} ${count === 1 ? word : word.replace(/y$/, "ie") + "s"}`;
    };

    app.updateStats = function () {
        const { entries, notes, colored, groups } = app.getStateSummary();
        const parts = [app.plural(notes, "note"), `${colored} colored`];
        if (groups) parts.push(app.plural(groups, "group"));

        document.getElementById("stats").textContent = entries || groups ? parts.join(" · ") : "Click a country to add a note";
    };
};

import countryNames from "../libs/countryNames.json";

export const execute = async (app) => {
    app.createEmptyState = function () {
        return {
            version: app.constants.dataVersion,
            settings: { theme: document.documentElement.dataset.theme || "dark" },
            countries: {},
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
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Data is not an object");
        if (data.countries && (typeof data.countries !== "object" || Array.isArray(data.countries))) throw new Error("\"countries\" must be an object");

        const state = app.createEmptyState();

        if (["light", "dark"].includes(data.settings?.theme)) state.settings.theme = data.settings.theme;

        // Notes saved before names were expanded (e.g. "eSwatini") move to the current name
        for (const [savedName, entry] of Object.entries(data.countries || {})) {
            if (!entry || typeof entry !== "object") continue;

            const name = countryNames[savedName] ?? savedName;
            if (name !== savedName && data.countries[name]) continue;

            const note = typeof entry.note === "string" ? entry.note : "";
            const color = app.isHexColor(entry.color) ? entry.color.toLowerCase() : null;
            if (!note.trim() && !color) continue;

            state.countries[name] = {
                note,
                color,
                updatedAt: Number.isNaN(Date.parse(entry.updatedAt)) ? new Date().toISOString() : entry.updatedAt,
            };
        }

        return state;
    };

    app.getEntry = function (name) {
        return app.state.countries[name] || null;
    };

    app.updateEntry = function (name, changes) {
        const entry = { note: "", color: null, ...app.getEntry(name), ...changes, updatedAt: new Date().toISOString() };

        if (!entry.note.trim() && !entry.color) delete app.state.countries[name];
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

    app.updateStats = function () {
        const entries = Object.values(app.state.countries);
        const notes = entries.filter((entry) => entry.note.trim()).length;
        const colored = entries.filter((entry) => entry.color).length;
        document.getElementById("stats").textContent = entries.length
            ? `${notes} ${notes === 1 ? "note" : "notes"} · ${colored} colored`
            : "Click a country to add a note";
    };
};

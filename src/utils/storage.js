import countryNames from "../libs/countryNames.json";

export const execute = async (app) => {
    const timestamp = (value) => (Number.isNaN(Date.parse(value)) ? new Date().toISOString() : value);
    const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

    app.createId = function (prefix) {
        return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    };

    app.createEmptyProfile = function (name = app.constants.defaultProfileName) {
        const now = new Date().toISOString();
        return { name, createdAt: now, updatedAt: now, countries: {}, groups: {} };
    };

    app.createEmptyStore = function () {
        const id = app.createId("p");
        return {
            version: app.constants.dataVersion,
            settings: { theme: document.documentElement.dataset.theme || "dark" },
            activeProfile: id,
            profiles: { [id]: app.createEmptyProfile() },
        };
    };

    // app.store holds everything that is saved, app.state is the active profile inside it
    app.useStore = function (store) {
        app.store = store;
        app.state = store.profiles[store.activeProfile];
    };

    app.loadState = function () {
        try {
            const raw = localStorage.getItem(app.constants.storageKey);
            app.useStore(raw ? app.normalizeStore(JSON.parse(raw)) : app.createEmptyStore());
            if (raw && JSON.stringify(app.store) !== raw) app.saveState();
        } catch (error) {
            console.error("Failed to read saved state:", error);
            app.useStore(app.createEmptyStore());
        }
    };

    app.saveState = function () {
        try {
            app.state.updatedAt = new Date().toISOString();
            localStorage.setItem(app.constants.storageKey, JSON.stringify(app.store));
            app.updateStorageUsage?.();
            return true;
        } catch (error) {
            console.error("Failed to save state:", error);
            app.toast("Browser storage is full or blocked, the last change was not saved", "error");
            return false;
        }
    };

    // Accepts the current multi-profile format and older single-profile saves or exports (version 1 and 2)
    app.normalizeStore = function (data) {
        if (!isObject(data)) throw new Error("Data is not an object");
        if (data.profiles && !isObject(data.profiles)) throw new Error("\"profiles\" must be an object");

        const store = app.createEmptyStore();
        store.profiles = {};

        if (["light", "dark"].includes(data.settings?.theme)) store.settings.theme = data.settings.theme;

        if (data.profiles) {
            for (const [id, profile] of Object.entries(data.profiles)) {
                if (isObject(profile)) store.profiles[id] = app.normalizeProfile(profile);
            }
        } else {
            const id = app.createId("p");
            store.profiles[id] = app.normalizeProfile(data);
        }

        const ids = Object.keys(store.profiles);
        if (!ids.length) throw new Error("No profiles found");

        store.activeProfile = store.profiles[data.activeProfile] ? data.activeProfile : ids[0];
        return store;
    };

    app.normalizeProfile = function (data) {
        if (data.countries && !isObject(data.countries)) throw new Error("\"countries\" must be an object");
        if (data.groups && !isObject(data.groups)) throw new Error("\"groups\" must be an object");

        const name = typeof data.name === "string" ? data.name.trim().slice(0, app.constants.profileNameLength) : "";
        const profile = app.createEmptyProfile(name || app.constants.defaultProfileName);
        profile.createdAt = timestamp(data.createdAt);
        profile.updatedAt = timestamp(data.updatedAt);

        for (const [id, group] of Object.entries(data.groups || {})) {
            const groupName = typeof group?.name === "string" ? group.name.trim().slice(0, app.constants.groupNameLength) : "";
            if (!groupName) continue;

            const members = (Array.isArray(group.members) ? group.members : [])
                .filter((member) => typeof member === "string")
                .map((member) => countryNames[member] ?? member);

            profile.groups[id] = {
                name: groupName,
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

            const countryName = countryNames[savedName] ?? savedName;
            if (countryName !== savedName && data.countries[countryName]) continue;

            const note = typeof entry.note === "string" ? entry.note : "";
            const color = app.isHexColor(entry.color) ? entry.color.toLowerCase() : null;
            const colorSource = profile.groups[entry.colorSource]?.members.includes(countryName) ? entry.colorSource : null;
            if (!note.trim() && !color && !colorSource) continue;

            profile.countries[countryName] = { note, color, colorSource, updatedAt: timestamp(entry.updatedAt) };
        }

        return profile;
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

    app.getProfileSummary = function (profile = app.state) {
        const entries = Object.entries(profile.countries);
        const colorOf = ([, entry]) => (entry.colorSource && profile.groups[entry.colorSource] ? profile.groups[entry.colorSource].color : entry.color);

        return {
            entries: entries.length,
            notes: entries.filter(([, entry]) => entry.note.trim()).length,
            colored: entries.filter(colorOf).length,
            groups: Object.keys(profile.groups).length,
        };
    };

    app.plural = function (count, word) {
        return `${count} ${count === 1 ? word : word.replace(/y$/, "ie") + "s"}`;
    };

    app.updateStats = function () {
        const { entries, notes, colored, groups } = app.getProfileSummary();
        const parts = [app.plural(notes, "note"), `${colored} colored`];
        if (groups) parts.push(app.plural(groups, "group"));

        const text = entries || groups ? parts.join(" · ") : "Click a country to add a note";
        document.getElementById("stats").textContent = Object.keys(app.store.profiles).length > 1 ? `${app.state.name} · ${text}` : text;
    };
};

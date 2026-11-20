import countryNames from "../libs/countryNames.json";

export const execute = async (app) => {
    const timestamp = (value) => (Number.isNaN(Date.parse(value)) ? new Date().toISOString() : value);
    const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

    app.createId = function (prefix) {
        return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    };

    app.createEmptyProfile = function (name = app.constants.defaultProfileName) {
        const now = new Date().toISOString();
        return { name, createdAt: now, updatedAt: now, countries: {}, groups: {}, deleted: { countries: {}, groups: {} } };
    };

    // Deletions are remembered with their time, so syncing with an older copy can't bring the data back
    app.markDeleted = function (map, key) {
        map[key] = new Date().toISOString();
    };

    app.normalizeTombstones = function (data) {
        return Object.fromEntries(Object.entries(isObject(data) ? data : {}).filter(([, value]) => !Number.isNaN(Date.parse(value))));
    };

    app.createEmptyStore = function () {
        const id = app.createId("p");
        return {
            version: app.constants.dataVersion,
            settings: { theme: document.documentElement.dataset.theme || "dark" },
            activeProfile: id,
            profiles: { [id]: app.createEmptyProfile() },
            deletedProfiles: {},
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
            app.scheduleCloudPush?.();
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
        if (data.profiles && !isObject(data.profiles)) throw new Error('"profiles" must be an object');

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
        store.deletedProfiles = app.normalizeTombstones(data.deletedProfiles);
        return store;
    };

    app.normalizeProfile = function (data) {
        if (data.countries && !isObject(data.countries)) throw new Error('"countries" must be an object');
        if (data.groups && !isObject(data.groups)) throw new Error('"groups" must be an object');

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
            // Files from before multiple group colors keep a single "colorSource" id
            const sources = Array.isArray(entry.colorSources) ? entry.colorSources : [entry.colorSources];
            const colorSources = [...new Set(sources)]
                .filter((id) => profile.groups[id]?.members.includes(countryName))
                .slice(0, app.constants.maxGroupColors);
            if (!note.trim() && !color && !colorSource.length) continue;

            profile.countries[countryName] = { note, color, colorSource, updatedAt: timestamp(entry.updatedAt) };
        }

        profile.deleted = {
            countries: app.normalizeTombstones(data.deleted?.countries),
            groups: app.normalizeTombstones(data.deleted?.groups),
        };

        return profile;
    };

    app.getEntry = function (name) {
        return app.state.countries[name] || null;
    };

    // Group color wins only when the country explicitly switched to them; with several they are show as stripes
    app.getCountryColors = function (name, profile = app.state) {
        const entry = profile.countries[name];
        const groupColors = (entry?.colorSources || []).map((id) => profile.groups[id]?.color).filter(Boolean);
        if (groupColors.length) return groupColors;
        return entry?.color ? [entry.color] : [];
    };

    app.getCountryColor = function (name) {
        return app.getCountryColors(name)[0] || null;
    };

    app.updateEntry = function (name, changes) {
        const entry = { note: "", color: null, colorSources: [], ...app.getEntry(name), ...changes, updatedAt: new Date().toISOString() };

        if (!entry.note.trim() && !entry.color && !entry.colorSources.length) {
            delete app.state.countries[name];
            app.markDeleted(app.state.deleted.countries, name);
        } else {
            app.state.countries[name] = entry;
            delete app.state.deleted.countries[name];
        }

        const saved = app.saveState();
        app.updateStats();
        return saved;
    };

    app.removeEntry = function (name) {
        delete app.state.countries[name];
        app.markDeleted(app.state.deleted.countries, name);
        app.saveState();
        app.updateStats();
    };

    app.getProfileSummary = function (profile = app.state) {
        const entries = Object.entries(profile.countries);
        const colorOf = ([name]) => app.getCountryColors(name, profile).length;

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

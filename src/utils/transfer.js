export const execute = async (app) => {
    const describe = (store) => {
        const profiles = Object.values(store.profiles);
        const countries = profiles.reduce((sum, profile) => sum + Object.keys(profile.countries).length, 0);
        const groups = profiles.reduce((sum, profile) => sum + Object.keys(profile.groups).length, 0);
        const parts = [app.plural(profiles.length, "profile"), app.plural(countries, "country")];
        if (groups) parts.push(app.plural(groups, "group"));
        return parts.join(", ").replace(/, ([^,]*)$/, " and $1");
    };

    app.exportData = function () {
        app.flushNote();
        app.flushGroupNote();

        const data = { app: "WorldNotes", exportedAt: new Date().toISOString(), ...app.store };

        app.downloadFile(`worldnotes-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 4));
        app.toast(`Exported ${describe(app.store)}`, "success");
    };

    app.exportProfile = function (id) {
        app.flushNote();
        app.flushGroupNote();

        const profile = app.store.profiles[id];
        if (!profile) return;

        const data = { app: "WorldNotes", kind: "profile", exportedAt: new Date().toISOString(), version: app.constants.dataVersion, id, profile };
        const slug =
            app
                .normalizeText(profile.name)
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") || "profile";

        app.downloadFile(`worldnotes-${slug}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 4));
        app.toast(`Exported profile "${profile.name}"`, "success");
    };

    app.importProfile = async function (file) {
        try {
            const data = JSON.parse(await file.text());
            if (data?.kind !== "profile")
                throw new Error(data?.profiles ? "this is a full backup, use Import notes in the settings menu" : "not a profile file");
            app.addImportedProfile(data);
        } catch (error) {
            console.error("Profile import failed:", error);
            app.toast(`Import failed: ${error instanceof SyntaxError ? "invalid JSON" : error.message}`, "error");
        }
    };

    app.addImportedProfile = function (data) {
        if (!data.profile || typeof data.profile !== "object" || Array.isArray(data.profile)) throw new Error('"profile" must be an object');

        const imported = app.normalizeProfile(data.profile);
        const id = typeof data.id === "string" && /^[\w-]{1,40}$/.test(data.id) ? data.id : app.createId("p");
        const existing = app.store.profiles[id];

        app.flushNote();
        app.flushGroupNote();

        const profile = existing ? app.normalizeProfile(app.mergeProfiles(existing, imported)) : imported;

        // A fresh timestamp keeps an earlier deletion of this profile (here or on another device) from winning over the import
        profile.updatedAt = new Date().toISOString();
        app.store.profiles[id] = profile;
        delete app.store.deletedProfiles[id];

        if (id === app.store.activeProfile) {
            app.clearSelection();
            app.clearGroupHighlight();
            app.useStore(app.store);
            app.refreshPolygons();
        }

        app.saveState();
        app.updateStats();
        app.renderProfileLabel();

        const unknown = Object.keys(imported.countries).filter((name) => !app.findCountry(name)).length;
        const summary = app.getProfileSummary(profile);
        app.toast(
            `${existing ? "Updated" : "Added"} profile "${profile.name}" (${app.plural(summary.notes, "note")}, ${app.plural(summary.groups, "group")})${unknown ? `, ${unknown} not on the map` : ""}`,
            "success",
        );
    };

    app.importData = async function (file) {
        try {
            const data = JSON.parse(await file.text());
            if (data?.kind === "profile") return app.addImportedProfile(data);

            const imported = app.normalizeStore(data);
            const current = app.store.profiles;
            const hasData =
                Object.keys(current).length > 1 ||
                Object.values(current).some((profile) => Object.keys(profile.countries).length || Object.keys(profile.groups).length);

            if (hasData && !confirm(`Replace all your data (${describe(app.store)}) with ${describe(imported)} from "${file.name}"?`)) return;

            app.flushNote();
            app.clearSelection();
            app.clearGroupHighlight();
            app.useStore(imported);
            app.saveState();
            app.replaceCloudOnNextSync?.();
            app.applyTheme(imported.settings.theme);
            app.updateStats();
            app.renderProfileLabel();

            const unknown = Object.values(imported.profiles)
                .flatMap((profile) => Object.keys(profile.countries))
                .filter((name) => !app.findCountry(name)).length;
            app.toast(`Imported ${describe(imported)}${unknown ? ` (${unknown} not on the map)` : ""}`, "success");
        } catch (error) {
            console.error("Import failed:", error);
            app.toast(`Import failed: ${error instanceof SyntaxError ? "invalid JSON" : error.message}`, "error");
        }
    };
};

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

    app.importData = async function (file) {
        try {
            const imported = app.normalizeStore(JSON.parse(await file.text()));
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

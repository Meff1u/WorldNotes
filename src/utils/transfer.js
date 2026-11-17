export const execute = async (app) => {
    const describe = (state) => {
        const countries = Object.keys(state.countries).length;
        const groups = Object.keys(state.groups).length;
        return [app.plural(countries, "country"), groups && app.plural(groups, "group")].filter(Boolean).join(" and ");
    };

    app.exportData = function () {
        app.flushNote();
        app.flushGroupNote();

        const data = {
            app: "WorldNotes",
            version: app.constants.dataVersion,
            exportedAt: new Date().toISOString(),
            settings: app.state.settings,
            countries: app.state.countries,
            groups: app.state.groups,
        };

        app.downloadFile(`worldnotes-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 4));
        app.toast(`Exported ${describe(data)}`, "success");
    };

    app.importData = async function (file) {
        try {
            const imported = app.normalizeState(JSON.parse(await file.text()));
            const hasData = Object.keys(app.state.countries).length || Object.keys(app.state.groups).length;

            if (hasData && !confirm(`Replace your ${describe(app.state)} with ${describe(imported)} from "${file.name}"?`)) return;

            app.flushNote();
            app.clearSelection();
            app.clearGroupHighlight();
            app.state = imported;
            app.saveState();
            app.applyTheme(imported.settings.theme);
            app.updateStats();

            const unknown = Object.keys(imported.countries).filter((name) => !app.findCountry(name)).length;
            app.toast(`Imported ${describe(imported)}${unknown ? ` (${unknown} not on the map)` : ""}`, "success");
        } catch (error) {
            console.error("Import failed:", error);
            app.toast(`Import failed: ${error instanceof SyntaxError ? "invalid JSON" : error.message}`, "error");
        }
    };
};

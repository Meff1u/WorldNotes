export const execute = async (app) => {
    app.exportData = function () {
        app.flushNote();

        const data = {
            app: "WorldNotes",
            version: app.constants.dataVersion,
            exportedAt: new Date().toISOString(),
            settings: app.state.settings,
            countries: app.state.countries,
        };

        app.downloadFile(`worldnotes-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 4));
        app.toast(`Exported ${Object.keys(data.countries).length} countries`, "success");
    };

    app.importData = async function (file) {
        try {
            const imported = app.normalizeState(JSON.parse(await file.text()));
            const count = Object.keys(imported.countries).length;
            const current = Object.keys(app.state.countries).length;

            if (current && !confirm(`Replace your ${current} saved ${current === 1 ? "country" : "countries"} with ${count} from "${file.name}"?`)) return;

            app.flushNote();
            app.clearSelection();
            app.state = imported;
            app.saveState();
            app.applyTheme(imported.settings.theme);
            app.updateStats();

            const unknown = Object.keys(imported.countries).filter((name) => !app.findCountry(name)).length;
            app.toast(`Imported ${count} countries${unknown ? ` (${unknown} not on the map)` : ""}`, "success");
        } catch (error) {
            console.error("Import failed:", error);
            app.toast(`Import failed: ${error instanceof SyntaxError ? "invalid JSON" : error.message}`, "error");
        }
    };
};

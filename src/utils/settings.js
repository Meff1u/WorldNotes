export const execute = async (app) => {
    const elements = {};

    app.bindSettings = function () {
        for (const id of ["settings", "settings-toggle", "settings-menu", "theme", "theme-value", "import", "export", "import-file", "factory-reset", "reset-dialog", "reset-summary", "reset-export", "reset-cancel", "reset-confirm"]) {
            elements[id] = document.getElementById(id);
        }

        elements["settings-toggle"].addEventListener("click", () => (app.isSettingsOpen() ? app.closeSettings() : app.openSettings()));

        elements.theme.addEventListener("click", () => {
            app.toggleTheme();
            app.updateThemeLabel();
        });

        elements.import.addEventListener("click", () => {
            app.closeSettings();
            elements["import-file"].click();
        });

        elements.export.addEventListener("click", () => {
            app.closeSettings();
            app.exportData();
        });

        elements["import-file"].addEventListener("change", async () => {
            const [file] = elements["import-file"].files;
            if (file) await app.importData(file);
            elements["import-file"].value = "";
            app.updateThemeLabel();
        });

        elements["factory-reset"].addEventListener("click", () => {
            app.closeSettings();
            app.openResetDialog();
        });

        elements["reset-export"].addEventListener("click", () => app.exportData());
        elements["reset-cancel"].addEventListener("click", () => elements["reset-dialog"].close());
        elements["reset-confirm"].addEventListener("click", () => {
            elements["reset-dialog"].close();
            app.factoryReset();
        });

        elements["reset-dialog"].addEventListener("click", (event) => {
            if (event.target === elements["reset-dialog"]) elements["reset-dialog"].close();
        });

        document.addEventListener("pointerdown", (event) => {
            if (app.isSettingsOpen() && !elements.settings.contains(event.target)) app.closeSettings();
        });

        elements["settings-menu"].addEventListener("keydown", (event) => {
            if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;

            event.preventDefault();
            const items = [...elements["settings-menu"].querySelectorAll(".menu-item")];
            const index = items.indexOf(document.activeElement);
            items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
        });

        app.updateThemeLabel();
    };

    app.isSettingsOpen = function () {
        return !elements["settings-menu"].hidden;
    };

    app.openSettings = function () {
        elements["settings-menu"].hidden = false;
        elements["settings-toggle"].setAttribute("aria-expanded", "true");
        elements["settings-menu"].querySelector(".menu-item").focus({ preventScroll: true });
    };

    app.closeSettings = function (restoreFocus = false) {
        elements["settings-menu"].hidden = true;
        elements["settings-toggle"].setAttribute("aria-expanded", "false");
        if (restoreFocus) elements["settings-toggle"].focus();
    };

    app.updateThemeLabel = function () {
        elements["theme-value"].textContent = app.state.settings.theme === "dark" ? "Dark" : "Light";
    };

    app.openResetDialog = function () {
        app.flushNote();

        const entries = Object.values(app.state.countries);
        const notes = entries.filter((entry) => entry.note.trim()).length;
        const colored = entries.filter((entry) => entry.color).length;

        elements["reset-summary"].textContent = entries.length
            ? `${notes} ${notes === 1 ? "note" : "notes"} and ${colored} ${colored === 1 ? "color" : "colors"}`
            : "all saved data";
        elements["reset-export"].disabled = !entries.length;
        elements["reset-dialog"].showModal();
    };

    app.factoryReset = function () {
        app.clearSelection();

        try {
            localStorage.removeItem(app.constants.storageKey);
        } catch (error) {
            console.error("Failed to clear storage:", error);
        }

        app.state = app.createEmptyState();
        app.applyTheme(matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
        app.updateThemeLabel();
        app.updateStats();
        app.toast("All notes and settings were reset", "success");
    };
};

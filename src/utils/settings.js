export const execute = async (app) => {
    const elements = {};

    app.bindSettings = function () {
        for (const id of ["settings", "settings-toggle", "settings-menu", "random", "random-dialog", "random-cancel", "random-groups", "random-group-options", "theme", "theme-value", "import", "export", "import-file", "factory-reset", "reset-dialog", "reset-summary", "reset-export", "reset-cancel", "reset-confirm"]) {
            elements[id] = document.getElementById(id);
        }

        elements.random.addEventListener("click", () => {
            app.closeSettings();
            app.openRandomDialog();
        });

        elements["random-dialog"].addEventListener("click", (event) => {
            const option = event.target.closest(".option[data-pool]");
            if (!option || option.disabled) return;

            elements["random-dialog"].close();
            app.pickRandomCountry(option.dataset.pool);
        });

        elements["random-cancel"].addEventListener("click", () => elements["random-dialog"].close());

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

        app.closeOnBackdrop(elements["reset-dialog"]);
        app.closeOnBackdrop(elements["random-dialog"]);

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
        elements["theme-value"].textContent = app.store.settings.theme === "dark" ? "Dark" : "Light";
    };

    app.getRandomPools = function () {
        const hasNote = (country) => Boolean(app.getEntry(country.name)?.note.trim());
        const pools = {
            all: app.countries,
            unnoted: app.countries.filter((country) => !hasNote(country)),
            noted: app.countries.filter(hasNote),
        };

        for (const group of app.getGroups()) {
            pools[`group:${group.id}`] = group.members.map((name) => app.findCountry(name)).filter(Boolean);
        }

        return pools;
    };

    app.openRandomDialog = function () {
        app.flushNote();

        const pools = app.getRandomPools();
        const groups = app.getGroups();

        elements["random-group-options"].replaceChildren(...groups.map((group) => {
            const option = Object.assign(document.createElement("button"), { className: "option" });
            const title = Object.assign(document.createElement("span"), { className: "option-title" });
            const dot = Object.assign(document.createElement("i"), { className: "list-swatch" });

            dot.style.setProperty("--swatch", group.color);
            title.append(dot, document.createTextNode(group.name));
            option.dataset.pool = `group:${group.id}`;
            option.append(title, Object.assign(document.createElement("span"), { className: "option-count" }));
            return option;
        }));
        elements["random-groups"].hidden = !groups.length;

        for (const option of elements["random-dialog"].querySelectorAll(".option")) {
            const count = pools[option.dataset.pool].length;
            option.disabled = !count;
            option.querySelector(".option-count").textContent = app.plural(count, "country");
        }

        elements["random-dialog"].showModal();
        elements["random-dialog"].querySelector(".option:not(:disabled)")?.focus();
    };

    app.pickRandomCountry = function (pool) {
        const candidates = app.getRandomPools()[pool];
        const fresh = candidates.length > 1 ? candidates.filter((country) => country !== app.selected) : candidates;
        const country = fresh[Math.floor(Math.random() * fresh.length)];

        if (country) app.selectCountry(country, true);
    };

    app.openResetDialog = function () {
        app.flushNote();
        app.flushGroupNote();

        const profiles = Object.values(app.store.profiles);
        const totals = profiles.map((profile) => app.getProfileSummary(profile)).reduce(
            (sum, summary) => ({ notes: sum.notes + summary.notes, colored: sum.colored + summary.colored, groups: sum.groups + summary.groups, entries: sum.entries + summary.entries }),
            { notes: 0, colored: 0, groups: 0, entries: 0 },
        );
        const parts = [app.plural(profiles.length, "profile"), app.plural(totals.notes, "note"), app.plural(totals.colored, "color")];
        if (totals.groups) parts.push(app.plural(totals.groups, "group"));

        const hasData = totals.entries || totals.groups || profiles.length > 1;
        elements["reset-summary"].textContent = hasData ? parts.join(", ").replace(/, ([^,]*)$/, " and $1") : "all saved data";
        elements["reset-export"].disabled = !hasData;
        elements["reset-dialog"].showModal();
    };

    app.factoryReset = function () {
        app.clearSelection();
        app.clearGroupHighlight();

        try {
            localStorage.removeItem(app.constants.storageKey);
        } catch (error) {
            console.error("Failed to clear storage:", error);
        }

        app.useStore(app.createEmptyStore());
        app.applyTheme(matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
        app.updateThemeLabel();
        app.updateStats();
        app.renderProfileLabel();
        app.updateStorageUsage();
        app.toast("All profiles, notes and settings were reset", "success");
    };
};

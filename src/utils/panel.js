export const execute = async (app) => {
    const elements = {};
    let pendingNote = null;

    app.bindPanel = function () {
        for (const id of ["panel", "panel-title", "panel-close", "swatches", "color-reset", "note", "save-status", "updated", "entry-clear"]) {
            elements[id] = document.getElementById(id);
        }

        const saveNoteLater = app.debounce(() => app.flushNote(), 450);

        elements.note.addEventListener("input", () => {
            pendingNote = { name: app.selected.name, note: elements.note.value };
            elements["save-status"].textContent = "Saving…";
            saveNoteLater();
        });

        elements.note.addEventListener("blur", () => app.flushNote());
        elements["panel-close"].addEventListener("click", () => app.clearSelection());
        elements["color-reset"].addEventListener("click", () => app.setCountryColor(null));

        elements["entry-clear"].addEventListener("click", () => {
            const name = app.selected?.name;
            if (!name || !app.getEntry(name)) return;
            if (!confirm(`Remove the note and color for ${name}?`)) return;

            pendingNote = null;
            app.removeEntry(name);
            app.refreshCountry(app.selected);
            app.openPanel(app.selected);
        });

        app.renderSwatches();
    };

    app.renderSwatches = function () {
        const buttons = app.constants.palette.map((color) => {
            const button = Object.assign(document.createElement("button"), { className: "swatch", title: color });
            button.style.setProperty("--swatch", color);
            button.dataset.color = color;
            button.setAttribute("aria-label", `Color ${color}`);
            button.addEventListener("click", () => app.setCountryColor(color));
            return button;
        });

        const custom = Object.assign(document.createElement("label"), { className: "swatch swatch-custom", title: "Custom color" });
        const picker = Object.assign(document.createElement("input"), { type: "color", id: "color-picker" });
        picker.setAttribute("aria-label", "Custom color");
        picker.addEventListener("input", () => app.setCountryColor(picker.value, false));
        picker.addEventListener("change", () => app.setCountryColor(picker.value));
        custom.append(picker);

        elements.swatches.replaceChildren(...buttons, custom);
    };

    app.setCountryColor = function (color, persist = true) {
        if (!app.selected) return;

        const name = app.selected.name;
        app.flushNote();

        if (persist) app.updateEntry(name, { color });
        else app.state.countries[name] = { note: "", updatedAt: new Date().toISOString(), ...app.getEntry(name), color };

        app.refreshCountry(app.selected);
        app.renderPanelState(name);
    };

    app.flushNote = function () {
        if (!pendingNote) return;

        const { name, note } = pendingNote;
        pendingNote = null;

        const saved = app.updateEntry(name, { note });
        if (app.selected?.name === name) {
            elements["save-status"].textContent = saved ? "Saved" : "Not saved";
            app.renderPanelState(name, false);
        }
    };

    app.renderPanelState = function (name, syncNote = true) {
        const entry = app.getEntry(name);
        const color = entry?.color || null;
        const isPreset = app.constants.palette.includes(color);

        for (const swatch of elements.swatches.querySelectorAll(".swatch[data-color]")) {
            swatch.classList.toggle("active", swatch.dataset.color === color);
        }

        const custom = elements.swatches.querySelector(".swatch-custom");
        custom.classList.toggle("active", Boolean(color) && !isPreset);
        custom.style.setProperty("--swatch", color && !isPreset ? color : "transparent");
        custom.querySelector("input").value = color || app.getThemeColors().accent;

        elements["color-reset"].disabled = !color;
        elements["entry-clear"].disabled = !entry;
        elements.updated.textContent = entry ? `Edited ${app.formatDate(entry.updatedAt)}` : "No changes yet";

        if (syncNote) elements.note.value = entry?.note || "";
    };

    app.openPanel = function (country) {
        app.flushNote();

        elements["panel-title"].textContent = country.name;
        elements["save-status"].textContent = "";
        app.renderPanelState(country.name);

        elements.panel.classList.add("open");
        app.setViewShift(true);
        elements.panel.setAttribute("aria-hidden", "false");
    };

    app.closePanel = function () {
        app.flushNote();
        elements.panel.classList.remove("open");
        app.setViewShift(false);
        elements.panel.setAttribute("aria-hidden", "true");
        elements.note.blur();
    };
};

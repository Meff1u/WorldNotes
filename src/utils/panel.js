export const execute = async (app) => {
    const elements = {};
    let pendingNote = null;
    let picker = null;

    app.bindPanel = function () {
        for (const id of [
            "panel",
            "panel-label",
            "panel-title",
            "panel-close",
            "swatches",
            "color-reset",
            "color-mode",
            "group-colors",
            "note",
            "save-status",
            "updated",
            "entry-clear",
            "country-groups",
            "group-add",
            "group-create",
            "group-create-name",
            "group-create-cancel",
        ]) {
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

        for (const button of elements["color-mode"].querySelectorAll("button")) {
            button.addEventListener("click", () => app.setColorMode(button.dataset.mode));
        }

        elements["entry-clear"].addEventListener("click", () => {
            const name = app.selected?.name;
            if (!name || !app.getEntry(name)) return;
            if (!confirm(`Remove the note and color for ${name}? Group memberships stay.`)) return;

            pendingNote = null;
            app.removeEntry(name);
            app.refreshCountry(app.selected);
            app.openPanel(app.selected);
        });

        elements["group-add"].addEventListener("change", () => {
            const value = elements["group-add"].value;
            elements["group-add"].value = "";

            if (value === "new") {
                elements["group-create"].hidden = false;
                elements["group-create-name"].value = "";
                elements["group-create-name"].focus();
            } else if (value) {
                app.addToGroup(value, app.selected.name);
            }
        });

        elements["group-create"].addEventListener("submit", (event) => {
            event.preventDefault();
            const name = elements["group-create-name"].value.trim();
            if (!name) return elements["group-create-name"].focus();

            app.createGroup(name, [app.selected.name]);
            elements["group-create"].hidden = true;
            app.renderPanelState(app.selected.name, false);
            app.toast(`Created group "${name}"`, "success");
        });

        elements["group-create-cancel"].addEventListener("click", () => {
            elements["group-create"].hidden = true;
        });

        picker = app.createSwatchPicker((color, persist) => app.setCountryColor(color, persist));
        elements.swatches.replaceChildren(picker.element);
    };

    // Shared by the country panel and the group editor: preset palette plus a custom color input
    app.createSwatchPicker = function (onPick) {
        const element = document.createDocumentFragment();
        const buttons = app.constants.palette.map((color) => {
            const button = Object.assign(document.createElement("button"), { className: "swatch", title: color, type: "button" });
            button.style.setProperty("--swatch", color);
            button.dataset.color = color;
            button.setAttribute("aria-label", `Color ${color}`);
            button.addEventListener("click", () => onPick(color, true));
            return button;
        });

        const custom = Object.assign(document.createElement("label"), { className: "swatch swatch-custom", title: "Custom color" });
        const input = Object.assign(document.createElement("input"), { type: "color" });
        input.setAttribute("aria-label", "Custom color");
        input.addEventListener("input", () => onPick(input.value, false));
        input.addEventListener("change", () => onPick(input.value, true));
        custom.append(input);
        element.append(...buttons, custom);

        const setValue = (color) => {
            const isPreset = app.constants.palette.includes(color);
            for (const button of buttons) button.classList.toggle("active", button.dataset.color === color);
            custom.classList.toggle("active", Boolean(color) && !isPreset);
            custom.style.setProperty("--swatch", color && !isPreset ? color : "transparent");
            input.value = color || app.getThemeColors().accent;
        };

        return { element, setValue };
    };

    app.setCountryColor = function (color, persist = true) {
        if (!app.selected) return;

        const name = app.selected.name;
        app.flushNote();

        if (persist) app.updateEntry(name, { color, colorSource: null });
        else app.state.countries[name] = { note: "", updatedAt: new Date().toISOString(), ...app.getEntry(name), color, colorSource: null };

        app.refreshCountry(app.selected);
        app.renderPanelState(name, false);
    };

    app.setColorMode = function (mode, groupId = null) {
        if (!app.selected) return;

        const name = app.selected.name;
        const groups = app.getCountryGroups(name);
        const current = app.getEntry(name)?.colorSource;
        const colorSource = mode === "group" ? groupId || (groups.some((group) => group.id === current) ? current : groups[0]?.id) || null : null;

        app.flushNote();
        app.updateEntry(name, { colorSource });
        app.refreshCountry(app.selected);
        app.renderPanelState(name, false);
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
        const groups = app.getCountryGroups(name);
        const groupMode = Boolean(entry?.colorSource);

        for (const button of elements["color-mode"].querySelectorAll("button")) {
            const active = (button.dataset.mode === "group") === groupMode;
            button.setAttribute("aria-checked", String(active));
        }

        const groupButton = elements["color-mode"].querySelector('[data-mode="group"]');
        groupButton.disabled = !groups.length;
        groupButton.title = groups.length ? "Use the color of one of this country's groups" : "Add this country to a group first";

        picker.setValue(entry?.color || null);
        elements.swatches.hidden = groupMode;
        elements["group-colors"].hidden = !groupMode;
        elements["color-reset"].hidden = groupMode;
        elements["color-reset"].disabled = !entry?.color;

        elements["group-colors"].replaceChildren(
            ...groups.map((group) => {
                const option = Object.assign(document.createElement("button"), { className: "group-color-option", type: "button" });
                const dot = Object.assign(document.createElement("i"), { className: "list-swatch" });
                dot.style.setProperty("--swatch", group.color);
                option.setAttribute("role", "radio");
                option.setAttribute("aria-checked", String(entry?.colorSource === group.id));
                option.append(dot, Object.assign(document.createElement("span"), { textContent: group.name }));
                option.addEventListener("click", () => app.setColorMode("group", group.id));
                return option;
            }),
        );

        app.renderCountryGroups(name, groups);

        elements["entry-clear"].disabled = !entry;
        elements.updated.textContent = entry ? `Edited ${app.formatDate(entry.updatedAt)}` : "No changes yet";

        if (syncNote) elements.note.value = entry?.note || "";
    };

    app.renderCountryGroups = function (name, groups) {
        elements["country-groups"].replaceChildren(
            ...groups.map((group) => {
                const chip = Object.assign(document.createElement("span"), { className: "group-chip" });
                const open = Object.assign(document.createElement("button"), { className: "group-chip-name", type: "button", title: `Open "${group.name}"` });
                const remove = Object.assign(document.createElement("button"), {
                    className: "group-chip-remove",
                    type: "button",
                    title: `Remove from "${group.name}"`,
                });
                const dot = Object.assign(document.createElement("i"), { className: "list-swatch" });

                dot.style.setProperty("--swatch", group.color);
                open.append(dot, Object.assign(document.createElement("span"), { textContent: group.name }));
                open.addEventListener("click", () => app.openGroups(group.id));

                remove.setAttribute("aria-label", remove.title);
                remove.innerHTML =
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>';
                remove.addEventListener("click", () => app.removeFromGroup(group.id, name));

                chip.append(open, remove);
                return chip;
            }),
        );

        const available = app.getGroups().filter((group) => !group.members.includes(name));
        const options = [new Option(groups.length ? "Add to another group…" : "Add to a group…", "", true, true)];
        options[0].disabled = true;
        for (const group of available) options.push(new Option(group.name, group.id));
        options.push(new Option("+ New group…", "new"));

        elements["group-add"].replaceChildren(...options);
    };

    app.openPanel = function (country) {
        app.flushNote();

        elements["panel-label"].textContent = country.label;
        elements["panel-title"].textContent = country.name;
        app.showFlag(country);
        elements["save-status"].textContent = "";
        elements["group-create"].hidden = true;
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

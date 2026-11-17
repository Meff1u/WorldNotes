export const execute = async (app) => {
    const elements = {};
    let filter = "all";
    let groupFilter = "";

    const filters = {
        all: () => true,
        noted: (name) => Boolean(app.getEntry(name)?.note.trim()),
        unnoted: (name) => !app.getEntry(name)?.note.trim(),
        colored: (name) => Boolean(app.getCountryColor(name)),
    };

    app.bindCountryList = function () {
        for (const id of ["country-list", "list-dialog", "list-close", "list-search", "list-filters", "list-group", "list-items", "list-empty"]) {
            elements[id] = document.getElementById(id);
        }

        elements["country-list"].addEventListener("click", () => {
            app.closeSettings();
            app.openCountryList();
        });

        elements["list-close"].addEventListener("click", () => elements["list-dialog"].close());
        elements["list-search"].addEventListener("input", () => app.renderCountryList());

        elements["list-search"].addEventListener("keydown", (event) => {
            if (event.key !== "ArrowDown") return;
            event.preventDefault();
            elements["list-items"].querySelector("button")?.focus();
        });

        for (const chip of elements["list-filters"].querySelectorAll(".chip")) {
            chip.addEventListener("click", () => {
                filter = chip.dataset.filter;
                app.renderCountryList();
            });
        }

        elements["list-group"].addEventListener("change", () => {
            groupFilter = elements["list-group"].value;
            app.renderCountryList();
        });

        elements["list-items"].addEventListener("keydown", (event) => {
            if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;

            event.preventDefault();
            const rows = [...elements["list-items"].querySelectorAll("button")];
            const index = rows.indexOf(document.activeElement);
            const next = index + (event.key === "ArrowDown" ? 1 : -1);

            if (next < 0) elements["list-search"].focus();
            else rows[Math.min(next, rows.length - 1)].focus();
        });

        app.closeOnBackdrop(elements["list-dialog"]);
    };

    app.openCountryList = function () {
        app.flushNote();
        elements["list-search"].value = "";
        app.renderGroupFilter();
        app.renderCountryList();
        elements["list-items"].scrollTop = 0;
        elements["list-dialog"].showModal();
        elements["list-search"].focus();
    };

    app.renderGroupFilter = function () {
        const groups = app.getGroups();
        if (!app.state.groups[groupFilter]) groupFilter = "";

        elements["list-group"].replaceChildren(
            new Option("All groups", "", false, !groupFilter),
            ...groups.map((group) => new Option(`${group.name} (${group.members.length})`, group.id, false, group.id === groupFilter)),
        );
        elements["list-group"].hidden = !groups.length;
    };

    app.renderCountryList = function () {
        const query = app.normalizeText(elements["list-search"].value.trim());
        const members = groupFilter && app.state.groups[groupFilter]?.members;
        const matching = app.countries.filter((country) => {
            if (members && !members.includes(country.name)) return false;

            const note = app.getEntry(country.name)?.note;
            return !query || country.searchName.includes(query) || (note && app.normalizeText(note).includes(query));
        });

        for (const chip of elements["list-filters"].querySelectorAll(".chip")) {
            const count = matching.filter((country) => filters[chip.dataset.filter](country.name)).length;
            chip.querySelector("span").textContent = count;
            chip.setAttribute("aria-checked", String(chip.dataset.filter === filter));
        }

        const visible = matching.filter((country) => filters[filter](country.name));

        elements["list-items"].replaceChildren(...visible.map((country) => app.createCountryRow(country)));
        elements["list-empty"].hidden = Boolean(visible.length);
        elements["list-empty"].textContent = query ? "No countries match your search" : "No countries in this filter yet";
    };

    app.createCountryRow = function (country) {
        const note = app.getEntry(country.name)?.note.trim();
        const color = app.getCountryColor(country.name);
        const item = document.createElement("li");
        const button = Object.assign(document.createElement("button"), { className: "list-row" });
        const swatch = Object.assign(document.createElement("i"), { className: `list-swatch${color ? "" : " empty"}` });
        const text = Object.assign(document.createElement("span"), { className: "list-text" });

        if (color) swatch.style.setProperty("--swatch", color);
        if (country === app.selected) button.classList.add("current");

        text.append(Object.assign(document.createElement("span"), { className: "list-name", textContent: country.name }));
        if (note) text.append(Object.assign(document.createElement("span"), { className: "list-note", textContent: note.replace(/\s+/g, " ") }));

        button.append(swatch, text);
        button.addEventListener("click", () => {
            elements["list-dialog"].close();
            app.selectCountry(country, true);
        });

        item.append(button);
        return item;
    };
};

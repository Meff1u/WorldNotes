export const execute = async (app) => {
    const elements = {};
    let filter = "all";

    const filters = {
        all: () => true,
        noted: (entry) => Boolean(entry?.note.trim()),
        unnoted: (entry) => !entry?.note.trim(),
        colored: (entry) => Boolean(entry?.color),
    };

    app.bindCountryList = function () {
        for (const id of ["country-list", "list-dialog", "list-close", "list-search", "list-filters", "list-items", "list-empty"]) {
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
        app.renderCountryList();
        elements["list-items"].scrollTop = 0;
        elements["list-dialog"].showModal();
        elements["list-search"].focus();
    };

    app.renderCountryList = function () {
        const query = app.normalizeText(elements["list-search"].value.trim());
        const matching = app.countries.filter((country) => {
            const note = app.getEntry(country.name)?.note;
            return !query || country.searchName.includes(query) || (note && app.normalizeText(note).includes(query));
        });

        for (const chip of elements["list-filters"].querySelectorAll(".chip")) {
            const count = matching.filter((country) => filters[chip.dataset.filter](app.getEntry(country.name))).length;
            chip.querySelector("span").textContent = count;
            chip.setAttribute("aria-checked", String(chip.dataset.filter === filter));
        }

        const visible = matching.filter((country) => filters[filter](app.getEntry(country.name)));

        elements["list-items"].replaceChildren(...visible.map((country) => app.createCountryRow(country)));
        elements["list-empty"].hidden = Boolean(visible.length);
        elements["list-empty"].textContent = query ? "No countries match your search" : "No countries in this filter yet";
    };

    app.createCountryRow = function (country) {
        const entry = app.getEntry(country.name);
        const note = entry?.note.trim();
        const item = document.createElement("li");
        const button = Object.assign(document.createElement("button"), { className: "list-row" });
        const swatch = Object.assign(document.createElement("i"), { className: `list-swatch${entry?.color ? "" : " empty"}` });
        const text = Object.assign(document.createElement("span"), { className: "list-text" });

        if (entry?.color) swatch.style.setProperty("--swatch", entry.color);
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

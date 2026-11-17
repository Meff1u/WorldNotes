export const execute = async (app) => {
    app.bindControls = function () {
        const { zoomStep } = app.constants.view;

        document.getElementById("zoom-in").addEventListener("click", () => app.zoomBy(zoomStep));
        document.getElementById("zoom-out").addEventListener("click", () => app.zoomBy(1 / zoomStep));
        document.getElementById("zoom-reset").addEventListener("click", () => app.resetView());

        document.addEventListener("keydown", (event) => {
            const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);

            if (document.querySelector("dialog[open]")) return;
            if (event.key === "Escape" && app.isSettingsOpen()) return app.closeSettings(true);
            if (event.key === "Escape" && !typing) {
                if (app.selected) app.clearSelection();
                else app.clearGroupHighlight();
            }
            if (event.key === "/" && !typing) {
                event.preventDefault();
                document.getElementById("search").focus();
            }
        });

        window.addEventListener("beforeunload", () => {
            app.flushNote();
            app.flushGroupNote();
        });

        app.bindSearch();
        app.bindSettings();
        app.bindCountryList();
        app.bindGroups();
    };

    app.bindSearch = function () {
        const input = document.getElementById("search");
        const list = document.getElementById("search-results");
        let results = [];
        let active = 0;

        const render = () => {
            list.replaceChildren(...results.map((country, index) => {
                const item = Object.assign(document.createElement("li"), { className: index === active ? "active" : "" });
                const entry = app.getEntry(country.name);

                item.append(Object.assign(document.createElement("span"), { textContent: country.name }));
                if (entry) {
                    const dot = Object.assign(document.createElement("i"), { className: "search-dot" });
                    dot.style.setProperty("--dot", app.getCountryColor(country.name) || app.getThemeColors().accent);
                    item.append(dot);
                }

                item.addEventListener("mousedown", (event) => {
                    event.preventDefault();
                    choose(country);
                });
                return item;
            }));
            list.hidden = !results.length;
        };

        const choose = (country) => {
            input.value = "";
            results = [];
            render();
            input.blur();
            app.selectCountry(country, true);
        };

        input.addEventListener("input", () => {
            const query = app.normalizeText(input.value.trim());
            active = 0;
            results = query && app.countries
                ? app.countries
                    .filter((country) => country.searchName.includes(query))
                    .sort((a, b) => a.searchName.indexOf(query) - b.searchName.indexOf(query))
                    .slice(0, 8)
                : [];
            render();
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (!results.length) return;
                active = (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
                render();
            } else if (event.key === "Enter" && results[active]) {
                choose(results[active]);
            } else if (event.key === "Escape") {
                input.value = "";
                results = [];
                render();
                input.blur();
            }
        });

        input.addEventListener("blur", () => {
            results = [];
            render();
        });
    };
};

export const execute = async (app) => {
    app.bindControls = function () {
        const { zoomStep } = app.constants.view;
        const fileInput = document.getElementById("import-file");

        document.getElementById("theme").addEventListener("click", () => app.toggleTheme());
        document.getElementById("export").addEventListener("click", () => app.exportData());
        document.getElementById("import").addEventListener("click", () => fileInput.click());
        document.getElementById("zoom-in").addEventListener("click", () => app.zoomBy(zoomStep));
        document.getElementById("zoom-out").addEventListener("click", () => app.zoomBy(1 / zoomStep));
        document.getElementById("zoom-reset").addEventListener("click", () => app.resetView());

        fileInput.addEventListener("change", async () => {
            const [file] = fileInput.files;
            if (file) await app.importData(file);
            fileInput.value = "";
        });

        document.addEventListener("keydown", (event) => {
            const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);

            if (event.key === "Escape" && !typing) app.clearSelection();
            if (event.key === "/" && !typing) {
                event.preventDefault();
                document.getElementById("search").focus();
            }
        });

        window.addEventListener("beforeunload", () => app.flushNote());

        app.bindSearch();
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
                    dot.style.setProperty("--dot", entry.color || app.getThemeColors().accent);
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
            const query = input.value.trim().toLowerCase();
            active = 0;
            results = query && app.countries
                ? app.countries
                    .filter((country) => country.name.toLowerCase().includes(query))
                    .sort((a, b) => a.name.toLowerCase().indexOf(query) - b.name.toLowerCase().indexOf(query))
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

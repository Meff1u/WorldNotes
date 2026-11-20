export const execute = async (app) => {
    const elements = {};
    let editing = null;
    let pendingNote = null;
    let picker = null;

    app.highlightedGroup = null;

    app.getGroups = function () {
        return Object.entries(app.state.groups)
            .map(([id, group]) => ({ id, ...group }))
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    app.getCountryGroups = function (name) {
        return app.getGroups().filter((group) => group.members.includes(name));
    };

    app.saveGroups = function (affected = []) {
        app.saveState();
        app.updateStats();
        for (const name of affected) app.refreshCountry(app.findCountry(name));
        if (app.highlightedGroup) app.refreshPolygons();
        if (app.selected) app.renderPanelState(app.selected.name, false);
    };

    app.createGroup = function (name, members = []) {
        const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const { palette } = app.constants;
        const now = new Date().toISOString();

        app.state.groups[id] = {
            name: name.trim().slice(0, app.constants.groupNameLength) || "New group",
            color: palette[Object.keys(app.state.groups).length % palette.length],
            note: "",
            members: [...members],
            createdAt: now,
            updatedAt: now,
        };

        app.saveGroups();
        return id;
    };

    app.updateGroup = function (id, changes) {
        const group = app.state.groups[id];
        if (!group) return;

        Object.assign(group, changes, { updatedAt: new Date().toISOString() });
        app.saveGroups("color" in changes ? group.members : []);
    };

    // The group's color is dropped from these countries; one left with no group colors falls back to its own color
    app.releaseGroupColor = function (id, names) {
        for (const name of names) {
            const sources = app.getEntry(name)?.colorSources || [];
            if (sources.includes(id)) app.updateEntry(name, { colorSoures: sources.filter((source) => source !== id) });
        }
    };

    app.deleteGroup = function (id) {
        const group = app.state.groups[id];
        if (!group) return;

        app.releaseGroupColor(id, group.members);
        delete app.state.groups[id];
        app.markDeleted(app.state.deleted.groups, id);
        if (app.highlightedGroup === id) app.clearGroupHighlight();
        app.saveGroups(group.members);
    };

    app.addToGroup = function (id, name) {
        const group = app.state.groups[id];
        if (!group || group.members.includes(name)) return;

        group.members.push(name);
        group.updatedAt = new Date().toISOString();
        app.saveGroups([name]);
    };

    app.removeFromGroup = function (id, name) {
        const group = app.state.groups[id];
        if (!group) return;

        app.releaseGroupColor(id, [name]);
        group.members = group.members.filter((member) => member !== name);
        group.updatedAt = new Date().toISOString();
        app.saveGroups([name]);
    };

    app.bindGroups = function () {
        for (const id of [
            "groups",
            "groups-dialog",
            "groups-list-view",
            "groups-close",
            "group-new",
            "groups-items",
            "groups-empty",
            "group-detail-view",
            "group-back",
            "group-name",
            "group-detail-close",
            "group-swatches",
            "group-note",
            "group-save-status",
            "group-members-title",
            "group-members",
            "group-members-empty",
            "group-show",
            "group-delete",
            "group-banner",
            "group-banner-dot",
            "group-banner-text",
            "group-banner-close",
        ]) {
            elements[id] = document.getElementById(id);
        }

        const saveNoteLater = app.debounce(() => app.flushGroupNote(), 450);
        const saveNameLater = app.debounce(() => app.saveGroupName(), 450);

        elements.groups.addEventListener("click", () => {
            app.closeSettings();
            app.openGroups();
        });

        elements["groups-close"].addEventListener("click", () => app.closeDialog(elements["groups-dialog"]));
        elements["group-detail-close"].addEventListener("click", () => app.closeDialog(elements["groups-dialog"]));
        elements["group-back"].addEventListener("click", () => app.showGroupList());
        elements["groups-dialog"].addEventListener("close", () => {
            app.flushGroupNote();
            app.saveGroupName(true);
        });

        elements["group-new"].addEventListener("click", () => {
            app.openGroupDetail(app.createGroup("New group"));
            elements["group-name"].select();
        });

        elements["group-name"].addEventListener("input", saveNameLater);
        elements["group-name"].addEventListener("blur", () => app.saveGroupName(true));
        elements["group-name"].addEventListener("keydown", (event) => {
            if (event.key === "Enter") elements["group-name"].blur();
        });

        elements["group-note"].addEventListener("input", () => {
            pendingNote = { id: editing, note: elements["group-note"].value };
            elements["group-save-status"].textContent = "Saving…";
            saveNoteLater();
        });

        elements["group-show"].addEventListener("click", () => {
            const id = editing;
            app.closeDialog(elements["groups-dialog"]);
            app.showGroupOnGlobe(id);
        });

        elements["group-delete"].addEventListener("click", () => {
            const group = app.state.groups[editing];
            if (!group || !confirm(`Delete the group "${group.name}"? Countries keep their own notes and colors.`)) return;

            pendingNote = null;
            app.deleteGroup(editing);
            app.showGroupList();
            app.toast(`Deleted group "${group.name}"`, "success");
        });

        elements["group-banner-close"].addEventListener("click", () => app.clearGroupHighlight());

        picker = app.createSwatchPicker((color, persist) => {
            if (!editing) return;
            if (persist) app.updateGroup(editing, { color });
            else {
                app.state.groups[editing].color = color;
                for (const name of app.state.groups[editing].members) app.refreshCountry(app.findCountry(name));
            }
            picker.setValue(color);
            app.renderGroupMembers();
        });
        elements["group-swatches"].replaceChildren(picker.element);

        app.closeOnBackdrop(elements["groups-dialog"]);
    };

    app.openGroups = function (id = null) {
        app.flushNote();
        if (id && app.state.groups[id]) app.openGroupDetail(id);
        else app.showGroupList();
        app.openDialog(elements["groups-dialog"]);
    };

    app.showGroupList = function () {
        app.flushGroupNote();
        app.saveGroupName(true);
        editing = null;

        const groups = app.getGroups();

        elements["groups-items"].replaceChildren(
            ...groups.map((group) => {
                const item = document.createElement("li");
                const button = Object.assign(document.createElement("button"), { className: "list-row" });
                const swatch = Object.assign(document.createElement("i"), { className: "list-swatch" });
                const text = Object.assign(document.createElement("span"), { className: "list-text" });
                const note = group.note.trim().replace(/\s+/g, " ");

                swatch.style.setProperty("--swatch", group.color);
                text.append(Object.assign(document.createElement("span"), { className: "list-name", textContent: group.name }));
                text.append(
                    Object.assign(document.createElement("span"), { className: "list-note", textContent: note || app.plural(group.members.length, "country") }),
                );
                button.append(swatch, text, Object.assign(document.createElement("span"), { className: "list-meta", textContent: group.members.length }));
                button.addEventListener("click", () => app.openGroupDetail(group.id));

                item.append(button);
                return item;
            }),
        );

        elements["groups-empty"].hidden = Boolean(groups.length);
        elements["group-detail-view"].hidden = true;
        elements["groups-list-view"].hidden = false;
        elements["group-new"].focus();
    };

    app.openGroupDetail = function (id) {
        const group = app.state.groups[id];
        if (!group) return app.showGroupList();

        editing = id;
        elements["group-name"].value = group.name;
        elements["group-note"].value = group.note;
        elements["group-save-status"].textContent = "";
        picker.setValue(group.color);
        app.renderGroupMembers();

        elements["groups-list-view"].hidden = true;
        elements["group-detail-view"].hidden = false;
        app.openDialog(elements["groups-dialog"]);
        elements["group-name"].focus();
    };

    app.renderGroupMembers = function () {
        const group = app.state.groups[editing];
        const members = group.members
            .map((name) => app.findCountry(name))
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name));

        elements["group-members-title"].textContent = `Countries (${members.length})`;
        elements["group-members-empty"].hidden = Boolean(members.length);
        elements["group-show"].disabled = !members.length;

        elements["group-members"].replaceChildren(
            ...members.map((country) => {
                const item = Object.assign(document.createElement("li"), { className: "member-row" });
                const button = Object.assign(document.createElement("button"), { className: "list-row" });
                const swatch = Object.assign(document.createElement("i"), { className: "list-swatch" });
                const color = app.getCountryColor(country.name);
                const remove = Object.assign(document.createElement("button"), {
                    className: "icon-button member-remove",
                    title: `Remove ${country.name} from the group`,
                });

                if (color) swatch.style.setProperty("--swatch", color);
                else swatch.classList.add("empty");

                button.append(swatch, Object.assign(document.createElement("span"), { className: "list-name", textContent: country.name }));
                button.addEventListener("click", () => {
                    app.closeDialog(elements["groups-dialog"]);
                    app.selectCountry(country, true);
                });

                remove.setAttribute("aria-label", remove.title);
                remove.innerHTML =
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>';
                remove.addEventListener("click", () => {
                    app.removeFromGroup(editing, country.name);
                    app.renderGroupMembers();
                });

                item.append(button, remove);
                return item;
            }),
        );
    };

    app.flushGroupNote = function () {
        if (!pendingNote) return;

        const { id, note } = pendingNote;
        pendingNote = null;
        app.updateGroup(id, { note });
        if (editing === id) elements["group-save-status"].textContent = "Saved";
    };

    app.saveGroupName = function (final = false) {
        const group = app.state.groups[editing];
        if (!group) return;

        const name = elements["group-name"].value.trim().slice(0, app.constants.groupNameLength);
        if (!name) {
            if (final) elements["group-name"].value = group.name;
            return;
        }

        if (name !== group.name) {
            app.updateGroup(editing, { name });
            if (app.highlightedGroup === editing) app.renderGroupBanner();
        }
    };

    app.isHighlightMember = function (name) {
        return Boolean(app.highlightedGroup && app.state.groups[app.highlightedGroup]?.members.includes(name));
    };

    // Fits the camera around every member: average direction for the center, widest member for the zoom
    app.showGroupOnGlobe = function (id) {
        const group = app.state.groups[id];
        const members = group?.members.map((name) => app.findCountry(name)).filter(Boolean);
        if (!members?.length) return;

        app.highlightedGroup = id;
        app.refreshPolygons();
        app.renderGroupBanner();

        const vectors = members.map(({ view }) => app.toCartesian(view.lat, view.lng, 1));
        const sum = vectors.reduce((total, vector) => total.map((value, i) => value + vector[i]), [0, 0, 0]);
        const length = Math.hypot(...sum);
        const center = length > 0.01 ? sum.map((value) => value / length) : vectors[0];
        const lat = (Math.asin(center[1]) * 180) / Math.PI;
        const lng = (Math.atan2(center[0], center[2]) * 180) / Math.PI;
        const reach = Math.max(
            ...members.map(({ view }, i) => {
                const dot = vectors[i].reduce((total, value, axis) => total + value * center[axis], 0);
                return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI + view.span / 2;
            }),
        );

        app.globe.pointOfView({ lat, lng, altitude: app.fitAltitude(Math.min(2.6, Math.max(0.3, 0.2 + reach * 0.045))) }, app.constants.view.transition);
    };

    app.renderGroupBanner = function () {
        const group = app.state.groups[app.highlightedGroup];
        elements["group-banner"].hidden = !group;
        if (!group) return;

        elements["group-banner-dot"].style.setProperty("--swatch", group.color);
        elements["group-banner-text"].textContent = `${group.name} · ${app.plural(group.members.length, "country")}`;
    };

    app.clearGroupHighlight = function () {
        if (!app.highlightedGroup) return;

        app.highlightedGroup = null;
        app.refreshPolygons();
        app.renderGroupBanner();
    };
};

export const execute = async (app) => {
    const elements = {};
    let renaming = null;

    app.getProfiles = function () {
        return Object.entries(app.store.profiles)
            .map(([id, profile]) => ({ id, ...profile }))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    };

    app.storageQuota = { chars: app.constants.storageQuotaChars, measured: false };

    // Browsers don't expose the localStorage limit, so it is probed once by writing ever larger strings
    // until the write fails; the result is cached per browser so later visits load instantly
    app.measureStorageQuota = function () {
        const cacheKey = `${app.constants.storageKey}-quota`;
        const probeKey = `${app.constants.storageKey}-probe`;
        const { maxChars, precisionChars } = app.constants.storageProbe;

        try {
            const cached = JSON.parse(localStorage.getItem(cacheKey));
            if (cached?.agent === navigator.userAgent && cached.chars > 0) {
                app.storageQuota = { chars: cached.chars, measured: true, capped: Boolean(cached.capped) };
                return;
            }

            const fits = (size) => {
                try {
                    localStorage.setItem(probeKey, "x".repeat(size));
                    return true;
                } catch {
                    return false;
                }
            };

            localStorage.removeItem(probeKey);
            const used = Object.keys(localStorage).reduce((sum, key) => sum + key.length + (localStorage.getItem(key)?.length || 0), 0);
            let low = 0;
            let high = 1024 * 1024;

            while (high <= maxChars && fits(high)) {
                low = high;
                high *= 2;
            }
            high = Math.min(high, maxChars);

            while (high - low > precisionChars) {
                const middle = Math.floor((low + high) / 2);
                if (fits(middle)) low = middle;
                else high = middle;
            }

            localStorage.removeItem(probeKey);

            // Hitting the probe ceiling means the real limit is even higher, so it is shown as a lower bound
            const chars = used + probeKey.length + low;
            const capped = low >= maxChars;
            localStorage.setItem(cacheKey, JSON.stringify({ chars, capped, agent: navigator.userAgent, measuredAt: new Date().toISOString() }));
            app.storageQuota = { chars, measured: true, capped };
        } catch (error) {
            console.warn("Could not measure storage quota, using an estimate:", error);
            try {
                localStorage.removeItem(probeKey);
            } catch {}
        }
    };

    // localStorage keeps strings as UTF-16, so every character costs two bytes
    app.getStorageUsage = function () {
        const { chars: quotaChars, measured, capped } = app.storageQuota;
        const profiles = Object.fromEntries(Object.entries(app.store.profiles).map(([id, profile]) => [id, JSON.stringify(profile).length * 2]));
        const chars = app.constants.storageKey.length + JSON.stringify(app.store).length;
        const quota = quotaChars * 2;

        return { used: chars * 2, profiles, quota, quotaLabel: `${measured ? "" : "about "}${app.formatBytes(quota)}${capped ? "+" : ""}`, percent: (chars / quotaChars) * 100 };
    };

    app.formatBytes = function (bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
        return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`;
    };

    app.formatPercent = function (percent) {
        if (percent > 0 && percent < 1) return "<1%";
        return `${Math.round(percent)}%`;
    };

    app.getStorageLevel = function (percent) {
        if (percent >= 90) return "danger";
        if (percent >= 70) return "warning";
        return "ok";
    };

    app.updateStorageUsage = function () {
        if (!elements["storage-meter"]) return;

        const { used, quotaLabel, percent } = app.getStorageUsage();
        const level = app.getStorageLevel(percent);

        elements["storage-value"].textContent = `${app.formatPercent(percent)} used`;
        elements["storage-meter"].dataset.level = level;
        elements["storage-meter"].title = `WorldNotes uses ${app.formatBytes(used)} of ${quotaLabel} browser storage`;
        elements["storage-fill"].style.width = `${Math.min(100, Math.max(percent, used ? 1 : 0))}%`;

        if (elements["profiles-dialog"].open) app.renderProfiles();
    };

    app.renderProfileLabel = function () {
        elements["profile-value"].textContent = app.state.name;
    };

    app.bindProfiles = function () {
        for (const id of [
            "profile", "profile-value", "profiles-dialog", "profiles-close", "profile-new", "profiles-items",
            "profiles-storage-bar", "profiles-storage-text", "storage-meter", "storage-value", "storage-fill",
        ]) {
            elements[id] = document.getElementById(id);
        }

        elements.profile.addEventListener("click", () => {
            app.closeSettings();
            app.openProfiles();
        });

        elements["profiles-close"].addEventListener("click", () => elements["profiles-dialog"].close());

        elements["profile-new"].addEventListener("click", () => {
            const id = app.createProfile();
            app.switchProfile(id, false);
            renaming = id;
            app.renderProfiles();
        });

        app.closeOnBackdrop(elements["profiles-dialog"]);
        app.renderProfileLabel();
        app.updateStorageUsage();
    };

    app.openProfiles = function () {
        app.flushNote();
        app.flushGroupNote();
        renaming = null;
        app.renderProfiles();
        elements["profiles-dialog"].showModal();
        elements["profile-new"].focus();
    };

    app.renderProfiles = function () {
        const profiles = app.getProfiles();
        const usage = app.getStorageUsage();
        const single = profiles.length === 1;

        elements["profiles-items"].replaceChildren(...profiles.map((profile) => {
            const active = profile.id === app.store.activeProfile;
            const { notes, groups } = app.getProfileSummary(profile);
            const item = Object.assign(document.createElement("li"), { className: `profile-row${active ? " active" : ""}` });
            const meta = [active ? "Active" : null, app.plural(notes, "note"), groups ? app.plural(groups, "group") : null, app.formatBytes(usage.profiles[profile.id])]
                .filter(Boolean)
                .join(" · ");

            if (renaming === profile.id) {
                const input = Object.assign(document.createElement("input"), { className: "input profile-name-input", value: profile.name, maxLength: app.constants.profileNameLength });
                input.setAttribute("aria-label", "Profile name");

                const finish = (save) => {
                    if (renaming !== profile.id) return;
                    renaming = null;
                    if (save) app.renameProfile(profile.id, input.value);
                    app.renderProfiles();
                };

                input.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") finish(true);
                    if (event.key === "Escape") {
                        event.preventDefault();
                        finish(false);
                    }
                });
                input.addEventListener("blur", () => finish(true));

                item.append(input);
                requestAnimationFrame(() => {
                    input.focus();
                    input.select();
                });
                return item;
            }

            const main = Object.assign(document.createElement("button"), { className: "list-row profile-main", title: active ? "Active profile" : `Switch to ${profile.name}` });
            const radio = Object.assign(document.createElement("i"), { className: "profile-radio" });
            const text = Object.assign(document.createElement("span"), { className: "list-text" });

            text.append(
                Object.assign(document.createElement("span"), { className: "list-name", textContent: profile.name }),
                Object.assign(document.createElement("span"), { className: "list-note", textContent: meta }),
            );
            main.append(radio, text);
            main.setAttribute("aria-current", String(active));
            main.addEventListener("click", () => {
                if (active) return;
                app.switchProfile(profile.id);
                elements["profiles-dialog"].close();
            });

            const rename = app.createIconButton("Rename profile", '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="m13.5 7.5 3 3" />');
            rename.addEventListener("click", () => {
                renaming = profile.id;
                app.renderProfiles();
            });

            const remove = app.createIconButton(single ? "The only profile can't be deleted" : "Delete profile", '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />');
            remove.classList.add("danger");
            remove.disabled = single;
            remove.addEventListener("click", () => {
                const summary = app.getProfileSummary(profile);
                const contents = [app.plural(summary.notes, "note"), app.plural(summary.groups, "group")].join(" and ");
                if (!confirm(`Delete the profile "${profile.name}" with ${contents}? This cannot be undone.`)) return;

                app.deleteProfile(profile.id);
                app.toast(`Deleted profile "${profile.name}"`, "success");
            });

            item.append(main, rename, remove);
            return item;
        }));

        elements["profiles-storage-bar"].replaceChildren(...profiles.map((profile) => {
            const segment = Object.assign(document.createElement("i"), { className: profile.id === app.store.activeProfile ? "active" : "" });
            segment.style.width = `${(usage.profiles[profile.id] / usage.quota) * 100}%`;
            segment.title = `${profile.name}: ${app.formatBytes(usage.profiles[profile.id])}`;
            return segment;
        }));
        elements["profiles-storage-bar"].dataset.level = app.getStorageLevel(usage.percent);
        elements["profiles-storage-text"].textContent = `${app.formatBytes(usage.used)} of ${usage.quotaLabel} · ${app.formatPercent(usage.percent)}`;
    };

    app.createIconButton = function (label, paths) {
        const button = Object.assign(document.createElement("button"), { className: "icon-button", title: label, type: "button" });
        button.setAttribute("aria-label", label);
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
        return button;
    };

    app.createProfile = function () {
        const names = new Set(Object.values(app.store.profiles).map((profile) => profile.name));
        let index = Object.keys(app.store.profiles).length + 1;
        while (names.has(`Profile ${index}`)) index++;

        const id = app.createId("p");
        app.store.profiles[id] = app.createEmptyProfile(`Profile ${index}`);
        app.saveState();
        return id;
    };

    app.renameProfile = function (id, name) {
        const profile = app.store.profiles[id];
        const trimmed = name.trim().slice(0, app.constants.profileNameLength);
        if (!profile || !trimmed || trimmed === profile.name) return;

        profile.name = trimmed;
        app.saveState();
        app.renderProfileLabel();
        app.updateStats();
    };

    // Everything that shows profile data is reset before the new profile is painted
    app.switchProfile = function (id, announce = true) {
        if (!app.store.profiles[id] || id === app.store.activeProfile) return;

        app.flushNote();
        app.flushGroupNote();
        app.clearSelection();
        app.clearGroupHighlight();

        app.store.activeProfile = id;
        app.useStore(app.store);
        app.saveState();

        app.refreshPolygons();
        app.updateStats();
        app.renderProfileLabel();
        if (announce) app.toast(`Switched to "${app.state.name}"`, "success");
    };

    app.deleteProfile = function (id) {
        const ids = Object.keys(app.store.profiles);
        if (ids.length < 2 || !app.store.profiles[id]) return;

        if (id === app.store.activeProfile) app.switchProfile(ids.find((other) => other !== id), false);

        delete app.store.profiles[id];
        app.saveState();
        app.updateStats();
        app.renderProfiles();
    };
};

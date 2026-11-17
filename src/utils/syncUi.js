export const execute = async (app) => {
    const elements = {};
    const labels = { off: "Off", syncing: "Syncing…", synced: "Synced", offline: "Offline", error: "Error" };

    app.bindSyncUi = function () {
        for (const id of [
            "sync",
            "sync-value",
            "sync-dialog",
            "sync-signed-out",
            "sync-signed-in",
            "sync-google",
            "sync-email-form",
            "sync-email",
            "sync-message",
            "sync-account-email",
            "sync-dot",
            "sync-status-text",
            "sync-now",
            "sync-sign-out",
            "sync-delete",
            "sync-close",
            "first-sync-dialog",
            "first-sync-local",
            "first-sync-remote",
        ]) {
            elements[id] = document.getElementById(id);
        }

        // Without Supabase keys the whole feature stays invisible
        elements.sync.hidden = !app.isCloudConfigured();
        if (elements.sync.hidden) return;

        elements.sync.addEventListener("click", () => {
            app.closeSettings();
            app.openSyncDialog();
        });

        elements["sync-close"].addEventListener("click", () => app.closeDialog(elements["sync-dialog"]));
        app.closeOnBackdrop(elements["sync-dialog"]);

        elements["sync-google"].addEventListener("click", () => app.runSyncAction(() => app.signInWithGoogle()));

        elements["sync-email-form"].addEventListener("submit", (event) => {
            event.preventDefault();
            const email = elements["sync-email"].value.trim();
            app.runSyncAction(async () => {
                await app.signInWithEmail(email);
                elements["sync-message"].textContent = `Check ${email} for a sign-in link.`;
            });
        });

        elements["sync-now"].addEventListener("click", () => app.runSyncAction(() => app.syncNow()));

        elements["sync-sign-out"].addEventListener("click", () =>
            app.runSyncAction(async () => {
                await app.signOut();
                app.toast("Signed out, your data stays on this device", "success");
            }),
        );

        elements["sync-delete"].addEventListener("click", () => {
            if (!confirm("Delete your WorldNotes account and everything stored in the cloud? Data in this browser stays. This cannot be undone.")) return;

            app.runSyncAction(async () => {
                await app.deleteCloudAccount();
                app.toast("Account and cloud data deleted", "success");
            });
        });

        // Statuses and sign-ins come from sync.js and cloud.js; the dialog and the menu just reflect them
        const onUserChange = app.onCloudUserChange;
        app.onCloudUserChange = function (user, event) {
            onUserChange?.(user, event);
            app.renderSync();
        };
        app.onSyncStatus = () => app.renderSync();

        app.renderSync();
    };

    // Buttons are disabled while a request runs, and errors end up in the dialog instead of the console only
    app.runSyncAction = async function (action) {
        const buttons = elements["sync-dialog"].querySelectorAll("button");
        buttons.forEach((button) => (button.disabled = true));
        elements["sync-message"].textContent = "";

        try {
            await action();
        } catch (error) {
            console.error("Cloud action failed:", error);
            elements["sync-message"].textContent = error.message || "Something went wrong, try again.";
            app.toast("Cloud sync: something went wrong", "error");
        } finally {
            buttons.forEach((button) => (button.disabled = false));
            app.renderSync();
        }
    };

    app.openSyncDialog = function () {
        elements["sync-message"].textContent = "";
        app.renderSync();
        app.openDialog(elements["sync-dialog"]);
    };

    app.renderSync = function () {
        if (!elements.sync || elements.sync.hidden) return;

        const user = app.cloud.user;
        const status = user ? app.cloud.status : "off";
        const synced = app.cloud.lastSyncedAt ? ` · ${app.formatDate(app.cloud.lastSyncedAt)}` : "";

        elements["sync-value"].textContent = user ? labels[status] : "Off";
        elements["sync-signed-out"].hidden = Boolean(user);
        elements["sync-signed-in"].hidden = !user;
        elements["sync-account-email"].textContent = user?.email || "";
        elements["sync-dot"].dataset.status = status;
        elements["sync-status-text"].textContent = status === "synced" ? `Synced${synced}` : labels[status];
    };

    // Resolves with "merge", "cloud" or "local"; closing the window without a choice merges, which loses nothing
    app.chooseFirstSync = function (local, remote) {
        const describe = (store) => {
            const totals = Object.values(store.profiles).map((profile) => app.getProfileSummary(profile));
            const notes = totals.reduce((sum, summary) => sum + summary.notes, 0);
            const groups = totals.reduce((sum, summary) => sum + summary.groups, 0);
            return [app.plural(totals.length, "profile"), app.plural(notes, "note"), app.plural(groups, "group")].join(", ");
        };

        elements["first-sync-local"].textContent = describe(local);
        elements["first-sync-remote"].textContent = describe(remote);

        return new Promise((resolve) => {
            const dialog = elements["first-sync-dialog"];
            let choice = "merge";

            const pick = (event) => {
                const option = event.target.closest("[data-choice]");
                if (!option) return;
                choice = option.dataset.choice;
                app.closeDialog(dialog);
            };

            dialog.addEventListener("click", pick);
            dialog.addEventListener(
                "close",
                () => {
                    dialog.removeEventListener("click", pick);
                    resolve(choice);
                },
                { once: true },
            );

            app.openDialog(dialog);
        });
    };
};

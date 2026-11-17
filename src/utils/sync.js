// Keeps app.store in step with the user's row in Supabase: pull and merge on sign-in, focus and remote changes,
// push a few seconds after local changes; localStorage stays the source the app works with
export const execute = async (app) => {
    const sync = {
        running: false,
        remoteUpdatedAt: null,
        pending: false,
        replace: false,
        timer: null,
        channel: null,
        busy: Promise.resolve(),
    };

    app.cloud = app.cloud || { user: null };
    app.cloud.status = "off";

    app.setSyncStatus = function (status) {
        app.cloud.status = status;

        // Remembers that this device already synced with this account, so the first-sync question isn't asked again
        if (status === "synced") {
            app.cloud.lastSyncedAt = new Date().toISOString();
            localStorage.setItem(syncedUserKey, app.cloud.user.id);
        }

        app.onSyncStatus?.(status);
    };

    const syncedUserKey = `${app.constants.storageKey}-synced-user`;

    app.isFirstSync = function () {
        return localStorage.getItem(syncedUserKey) !== app.cloud.user.id;
    };

    app.forgetSyncedUser = function () {
        localStorage.removeItem(syncedUserKey);
    };

    app.hasData = function (store) {
        const profiles = Object.values(store.profiles);
        return profiles.length > 1 || profiles.some((profile) => Object.keys(profile.countries).length || Object.keys(profile.groups).length);
    };

    app.syncNow = function () {
        return queue(() => (sync.pending ? app.pushCloud() : app.pullCloud()));
    };

    // Every network step runs one after another, so a push never overlaps a pull and reads stale data
    const queue = (task) => {
        sync.busy = sync.busy.then(task, task).catch((error) => {
            console.error("Cloud sync failed:", error);
            app.setSyncStatus(navigator.onLine ? "error" : "offline");
        });
        return sync.busy;
    };

    app.onCloudUserChange = function (user, event) {
        if (user && !sync.running) app.startSync();
        if (!user && event === "SIGNED_OUT") app.stopSync();
    };

    app.startSync = async function () {
        sync.running = true;
        sync.remoteUpdatedAt = null;
        await queue(() => app.pullCloud());

        const client = await app.getCloudClient();
        sync.channel = client
            .channel(`stores:${app.cloud.user.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "stores", filter: `user_id=eq.${app.cloud.user.id}` }, (payload) => {
                if (payload.new?.updated_at !== sync.remoteUpdatedAt) queue(() => app.pullCloud());
            })
            .subscribe();
    };

    app.stopSync = async function () {
        sync.running = false;
        clearTimeout(sync.timer);
        if (sync.channel) (await app.getCloudClient()).removeChannel(sync.channel);
        sync.channel = null;
        app.setSyncStatus("off");
    };

    // Downloads the cloud copy and merges it into this device's data; pushes back if this device had something new
    app.pullCloud = async function () {
        if (!sync.running) return;
        app.setSyncStatus("syncing");

        const client = await app.getCloudClient();
        const { data: row, error } = await client.from("stores").select("data, updated_at").eq("user_id", app.cloud.user.id).maybeSingle();
        if (error) throw error;

        if (!row) {
            sync.pending = true;
            return app.pushCloud();
        }

        sync.remoteUpdatedAt = row.updated_at;
        const remote = app.normalizeStore(row.data);

        // The first time this device meets this account and both sides hold data, the user decides what happens
        const choice =
            app.isFirstSync() && !sync.replace && app.hasData(app.store) && app.hasData(remote) ? await app.chooseFirstSync(app.store, remote) : "merge";
        if (choice === "local") sync.replace = true;

        const merged =
            choice === "cloud"
                ? app.normalizeStore({ ...remote, settings: app.store.settings })
                : sync.replace
                  ? app.store
                  : app.mergeStores(app.store, remote);

        if (JSON.stringify(merged) !== JSON.stringify(app.store)) app.applyMergedStore(merged);
        if (sync.replace || JSON.stringify(merged.profiles) !== JSON.stringify(remote.profiles)) sync.pending = true;

        if (sync.pending) return app.pushCloud();
        app.setSyncStatus("synced");
    };

    // Uploads only if the cloud still holds the version this device last saw; otherwise another device wrote first,
    // so its changes are pulled and merged before trying again
    app.pushCloud = async function () {
        if (!sync.running || !sync.pending) return;
        if (!navigator.onLine) return app.setSyncStatus("offline");
        app.setSyncStatus("syncing");

        const client = await app.getCloudClient();
        const row = { user_id: app.cloud.user.id, data: app.store };
        const request = sync.remoteUpdatedAt
            ? client.from("stores").update({ data: app.store }).eq("user_id", row.user_id).eq("updated_at", sync.remoteUpdatedAt)
            : client.from("stores").insert(row);

        const { data, error } = await request.select("updated_at");

        // A failed insert means a row appeared meanwhile and an empty update means it changed: pull, merge, retry
        if ((error && error.code === "23505") || (!error && !data.length)) {
            sync.remoteUpdatedAt = null;
            return app.pullCloud();
        }
        if (error) throw error;

        sync.remoteUpdatedAt = data[0].updated_at;
        sync.pending = false;
        sync.replace = false;
        app.setSyncStatus("synced");
    };

    // Called by saveState: waits for a pause in typing so a note isn't updated letter by letter
    app.scheduleCloudPush = function () {
        if (!sync.running) return;

        sync.pending = true;
        clearTimeout(sync.timer);
        sync.timer = setTimeout(() => queue(() => app.pushCloud()), app.constants.syncDelay);
    };

    // Import and factory reset replace everything on purpose, so the next sync overwrites the cloud instead of merging
    app.replaceCloudOnNextSync = function () {
        if (!sync.running) return;
        sync.replace = true;
        app.scheduleCloudPush();
    };

    app.applyMergedStore = function (merged) {
        app.flushNote();
        app.flushGroupNote();

        const selected = app.selected?.name;
        merged.activeProfile = merged.profiles[app.store.activeProfile] ? app.store.activeProfile : merged.activeProfile;
        app.useStore(merged);

        // Written directly, not through saveState, which would mark the data as changed and push it straight back
        localStorage.setItem(app.constants.storageKey, JSON.stringify(app.store));

        if (app.highlightedGroup && !app.state.groups[app.highlightedGroup]) app.clearGroupHighlight();
        app.refreshPolygons();
        app.updateStats();
        app.renderProfileLabel();
        app.updateStorageUsage();

        // The open note is only refreshed while it isn't being typed in, so remote changes never overwrite typing
        if (selected) app.renderPanelState(selected, document.activeElement?.id !== "note");
    };

    window.addEventListener("online", () => sync.running && queue(() => (sync.pending ? app.pushCloud() : app.pullCloud())));
    window.addEventListener("offline", () => sync.running && app.setSyncStatus("offline"));
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && sync.running && navigator.onLine) queue(() => app.pullCloud());
    });
};

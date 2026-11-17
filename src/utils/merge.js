export const execute = async (app) => {
    const time = (value) => (value ? Date.parse(value) : 0);
    const newest = (...values) => values.filter(Boolean).sort((a, b) => time(b) - time(a))[0];

    // Merges one kind of record (countries or groups) item by item: the newer change wins, and a deletion wins
    // over an edit only if it happened later; returns the merged records and the deletions still worth remembering
    app.mergeRecords = function (local, remote, localDeleted, remoteDeleted) {
        const records = {};
        const deleted = {};
        const keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(localDeleted), ...Object.keys(remoteDeleted)]);

        for (const key of keys) {
            const record = [local[key], remote[key]].filter(Boolean).sort((a, b) => time(b.updatedAt) - time(a.updatedAt))[0];
            const deletedAt = newest(localDeleted[key], remoteDeleted[key]);

            if (deletedAt && (!record || time(deletedAt) >= time(record.updatedAt))) deleted[key] = deletedAt;
            else if (record) records[key] = structuredClone(record);
        }

        return { records, deleted };
    };

    app.mergeProfiles = function (local, remote) {
        if (!local || !remote) return structuredClone(local || remote);

        const newer = time(remote.updatedAt) > time(local.updatedAt) ? remote : local;
        const countries = app.mergeRecords(local.countries, remote.countries, local.deleted.countries, remote.deleted.countries);
        const groups = app.mergeRecords(local.groups, remote.groups, local.deleted.groups, remote.deleted.groups);

        return {
            name: newer.name,
            createdAt: time(local.createdAt) <= time(remote.createdAt) ? local.createdAt : remote.createdAt,
            updatedAt: newer.updatedAt,
            countries: countries.records,
            groups: groups.records,
            deleted: { countries: countries.deleted, groups: groups.deleted },
        };
    };

    // Combines this device's data with a copy from elsewhere (later: the cloud); settings like the theme stay local
    app.mergeStores = function (local, remote) {
        const ids = new Set([...Object.keys(local.profiles), ...Object.keys(remote.profiles)]);
        const deletedIds = new Set([...Object.keys(local.deletedProfiles), ...Object.keys(remote.deletedProfiles)]);
        const merged = { ...structuredClone(local), profiles: {}, deletedProfiles: {} };

        for (const id of new Set([...ids, ...deletedIds])) {
            const profile = app.mergeProfiles(local.profiles[id], remote.profiles[id]);
            const deletedAt = newest(local.deletedProfiles[id], remote.deletedProfiles[id]);

            if (deletedAt && (!profile || time(deletedAt) >= time(profile.updatedAt))) merged.deletedProfiles[id] = deletedAt;
            else if (profile) merged.profiles[id] = profile;
        }

        // Every profile deleted on both sides would leave nothing to show, so an empty one takes its place
        if (!Object.keys(merged.profiles).length) {
            const id = app.createId("p");
            merged.profiles[id] = app.createEmptyProfile();
        }

        if (!merged.profiles[merged.activeProfile]) merged.activeProfile = Object.keys(merged.profiles)[0];

        // Normalizing drops group colors that point to a group deleted on the other device
        return app.normalizeStore(merged);
    };
};
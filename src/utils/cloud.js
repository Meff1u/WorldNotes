// Optional cloud sync backed by Supabase; nothing here runs, and the library isn't even downloaded,
// until someone signs in or already has a session from an earlier visit
export const execute = async (app) => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const redirectTo = `${location.origin}${import.meta.env.BASE_URL}`;
    let client = null;

    app.cloud = { user: null };

    app.isCloudConfigured = function () {
        return Boolean(url && key);
    };

    app.getCloudClient = async function () {
        if (!app.isCloudConfigured()) throw new Error("Cloud sync is not configured");
        if (client) return client;

        const { createClient } = await import("@supabase/supabase-js");
        client = createClient(url, key, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
        });

        client.auth.onAuthStateChange((event, session) => {
            app.cloud.user = session?.user ?? null;
            app.onCloudUserChange?.(app.cloud.user, event);
        });

        return client;
    };

    // Supabase keeps the session under a key like "sb-<project>-auth-token"; a returning OAuth or email link
    // brings "?code=" in the address, so only those visits load the library
    app.hasCloudSession = function () {
        const returning = new URLSearchParams(location.search).has("code");
        return returning || Object.keys(localStorage).some((name) => name.startsWith("sb-") && name.endsWith("-auth-token"));
    };

    app.restoreCloudSession = async function () {
        if (!app.isCloudConfigured() || !app.hasCloudSession()) return null;

        try {
            const { data } = await (await app.getCloudClient()).auth.getSession();
            app.cloud.user = data.session?.user ?? null;

            // The login code in the address has been exchanged for a session, so it can go
            if (new URLSearchParams(location.search).has("code")) history.replaceState(null, "", redirectTo);
        } catch (error) {
            console.error("Could not restore the cloud session:", error);
        }

        return app.cloud.user;
    };

    // Google and Discord use the same OAuth flow, only the provider name differs
    app.signInWithProvider = async function (provider) {
        const { error } = await (await app.getCloudClient()).auth.signInWithOAuth({ provider, options: { redirectTo } });
        if (error) throw error;
    };

    app.signInWithEmail = async function (email) {
        const { error } = await (await app.getCloudClient()).auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
    };

    app.signOut = async function () {
        if (!client) return;
        const { error } = await client.auth.signOut();
        if (error) throw error;
        app.cloud.user = null;
    };

    // Runs delete_account() in the database, which removes the user and through the foreign key, their stored data;
    // the local session is cleared afterwards because the server one no longer exists
    app.deleteCloudAccount = async function () {
        const { error } = await (await app.getCloudClient()).rpc("delete_account");
        if (error) throw error;

        await (await app.getCloudClient()).auth.signOut({ scope: "local" });
        app.forgetSyncedUser?.();
        app.cloud.user = null;
    };
};

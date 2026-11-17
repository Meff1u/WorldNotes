export const execute = async (app) => {
    app.getThemeColors = function () {
        return app.constants.themes[app.store.settings.theme];
    };

    app.applyTheme = function (theme) {
        app.store.settings.theme = theme;
        document.documentElement.dataset.theme = theme;
        app.refreshGlobeTheme?.();
    };

    app.toggleTheme = function () {
        app.applyTheme(app.store.settings.theme === "dark" ? "light" : "dark");
        app.saveState();
    };
};

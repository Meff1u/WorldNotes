export const execute = async (app) => {
    app.getThemeColors = function () {
        return app.constants.themes[app.state.settings.theme];
    };

    app.applyTheme = function (theme) {
        app.state.settings.theme = theme;
        document.documentElement.dataset.theme = theme;
        app.refreshGlobeTheme?.();
    };

    app.toggleTheme = function () {
        app.applyTheme(app.state.settings.theme === "dark" ? "light" : "dark");
        app.saveState();
    };
};

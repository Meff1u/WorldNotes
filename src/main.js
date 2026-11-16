import constants from "./libs/constants.js";
import packagejson from "../package.json";
import "./styles/main.css";

const app = {};

app.constants = constants;
app.package = packagejson;

async function loadUtils() {
    const utilFiles = import.meta.glob("./utils/*.js", { eager: true });
    const utilPromises = Object.values(utilFiles).map((file) => file.execute(app));
    return Promise.all(utilPromises);
}

async function init() {
    try {
        await loadUtils();
        app.loadState();
        app.applyTheme(app.state.settings.theme);
        app.bindControls();
        app.bindPanel();
        await app.createGlobe(document.getElementById("globe"));
        app.updateStats();
        app.log(`WorldNotes v${app.package.version} ready`);
    } catch (error) {
        console.error("Error during initialization:", error);
        app.toast?.("Failed to load the globe", "error");
    } finally {
        const loader = document.getElementById("loader");
        loader.classList.add("hidden");
        setTimeout(() => loader.remove(), 600);
    }
}

init();

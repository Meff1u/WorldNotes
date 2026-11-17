import countryCodes from "../libs/countryCodes.json";
import somaliland from "../assets/flags/somaliland.svg?url";
import northernCyprus from "../assets/flags/northern-cyprus.svg?url";
import disputed from "../assets/flags/disputed.svg?url";

// Vite turns every flag into a separate asset loaded only when requested
const flagFiles = import.meta.glob("/node_modules/flag-icons/flags/4x3/*.svg", { query: "?url", import: "default" });
const customFlags = {
    Somaliland: somaliland,
    "Northern Cyprus": northernCyprus,
};

export const execute = async (app) => {
    app.getFlagUrl = async function (name) {
        if (customFlags[name]) return customFlags[name];
        const code = countryCodes[name];
        const load = code && flagFiles[`/node_modules/flag-icons/flags/4x3/${code}.svg`];
        return load ? load() : null;
    };

    app.showFlag = async function (country) {
        const image = document.getElementById("panel-flag");
        image.hidden = true;
        image.removeAttribute("title");

        const url = await app.getFlagUrl(country.name);

        // Another country may have been opened while this flag was loading
        if (app.selected !== country) return;

        // Disputed areas without a flag of their own get a neutral icon, so the empty spot doesn't look odd
        if (!url && country.label === "Disputed area") {
            image.src = disputed;
            image.alt = "Disputed area, no flag shown";
            image.title = "Disputed area, no flag shown";
            image.hidden = false;
            return;
        }

        if (!url) return;

        image.src = url;
        image.alt = `Flag of ${country.name}`;
        image.hidden = false;
    };
};
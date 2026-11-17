export const execute = async (app) => {
    app.log = function (message) {
        console.log(`[${new Date().toLocaleString("en-GB")}] ${message}`);
    };

    app.debounce = function (fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    };

    app.escapeHtml = function (text) {
        return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    };

    // Strips diacritics so "aland" finds "Åland"; letters like "ł" or "ø" don't decompose in Unicode and need a map
    app.normalizeText = function (text) {
        const letters = { ł: "l", ø: "o", đ: "d", ħ: "h", ı: "i", æ: "ae", œ: "oe", ß: "ss", þ: "th" };
        return String(text)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[łøđħıæœßþ]/g, (char) => letters[char]);
    };

    app.isHexColor = function (value) {
        return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
    };

    app.mixColors = function (from, to, amount) {
        const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        const a = parse(from);
        const b = parse(to);
        return `#${a
            .map((value, i) =>
                Math.round(value + (b[i] - value) * amount)
                    .toString(16)
                    .padStart(2, "0"),
            )
            .join("")}`;
    };

    app.formatDate = function (iso) {
        return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    app.downloadFile = function (name, content, type = "application/json") {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const link = Object.assign(document.createElement("a"), { href: url, download: name });
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    // Runs a closing animation (class "closing") before actually hiding the element; the timeout is a safety net
    // for when no animation runs at all, e.g. with reduced motion or in a background tab
    app.playClosing = function (element, done) {
        if (element.classList.contains("closing")) return;

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            element.removeEventListener("animationed", onEnd);

            // Reopening during the animation removes the class, which cancels the hiding
            if (!element.classList.contains("closing")) return;
            element.classList.remove("closing");
            done();
        };
        const onEnd = (event) => {
            if (event.target === element) finish();
        };

        element.classList.add("closing");
        element.addEventListener("animationed", onEnd);
        setTimeout(finish, 300);
    };

    // The dialog stays open, and so above everything else, until its fade-out ends, which works in every browser
    app.closeDialog = function (dialog) {
        if (dialog.open) app.playClosing(dialog, () => dialog.close());
    };

    app.openDialog = function (dialog) {
        dialog.classList.remove("closing");
        if (!dialog.open) dialog.showModal();
    };

    app.bindDialogs = function () {
        for (const dialog of document.querySelectorAll("dialog")) {
            dialog.addEventListener("cancel", (event) => {
                event.preventDefault();
                app.closeDialog(dialog);
            });
        }
    };

    // Dialog padding belongs to the dialog element too, so only clicks outside its box count as the backdrop
    app.closeOnBackdrop = function (dialog) {
        dialog.addEventListener("click", (event) => {
            if (event.target !== dialog) return;

            const box = dialog.getBoundingClientRect();
            const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
            if (!inside) app.closeDialog(dialog);
        });
    };

    app.toast = function (message, type = "info") {
        const toast = Object.assign(document.createElement("div"), { className: `toast ${type}`, textContent: message });
        document.getElementById("toasts").append(toast);
        setTimeout(() => toast.classList.add("leaving"), 2800);
        setTimeout(() => toast.remove(), 3200);
    };
};

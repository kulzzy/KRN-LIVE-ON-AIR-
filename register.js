/* KULZZY RADIO APP REGISTRATION */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", async () => {

        try {

            await navigator.serviceWorker.register("./sw.js");

            console.log("Kulzzy Radio installed successfully.");

        } catch (error) {

            console.error("Registration failed:", error);

        }

    });

}

/* LOAD CENTRAL CONFIGURATION */

if (!window.KULZZY_CONFIG) {
    console.warn("Kulzzy Radio configuration not loaded.");
}

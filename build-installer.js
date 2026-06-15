const builder = require("electron-builder");
const Platform = builder.Platform;

console.log("Начинаем сборку Установщика Dropushko для Windows (NSIS)... Пожалуйста, подождите.");

builder
    .build({
        targets: Platform.WINDOWS.createTarget(["nsis"]),
        config: {
            appId: "com.dropushko.app",
            productName: "Dropushko",
            artifactName: "dropushko-setup-${version}.${ext}",
            copyright: "Copyright © 2026 Erridian",
            files: ["src", "node_modules", "LICENSE"],
            icon: "./src/resources/images/icon.ico",
            win: {
                target: ["nsis"],
            },
            nsis: {
                oneClick: false,
                perMachine: false,
                allowElevation: true,
                allowToChangeInstallationDirectory: true,
                createDesktopShortcut: true,
                createStartMenuShortcut: true,
            },
            compression: "normal",
            extraResources: ["libraries"],
            asar: true,
        },
    })
    .then(() => {
        console.log("✅ Ура! Установщик Dropushko успешно собран в папке 'dist'!");
    })
    .catch(err => {
        console.error("❌ Ошибка при сборке установщика:", err);
    });

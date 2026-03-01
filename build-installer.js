const builder = require("electron-builder");
const Platform = builder.Platform;

console.log("Начинаем сборку Установщика для Windows (NSIS)... Пожалуйста, подождите.");

builder
    .build({
        targets: Platform.WINDOWS.createTarget(["nsis"]),
        config: {
            appId: "com.giftseeker.app",
            productName: "GiftSeeker",
            artifactName: "giftseeker-setup-${version}.${ext}",
            copyright: "Copyright © 2016-2026 Codesprut / Erridian",
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
        console.log("✅ Ура! Установщик успешно собран в папке 'dist'!");
    })
    .catch(err => {
        console.error("❌ Ошибка при сборке установщика:", err);
    });

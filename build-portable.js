const builder = require("electron-builder");
const Platform = builder.Platform;

console.log("Начинаем сборку Portable-версии для Windows (один файл)... Пожалуйста, подождите.");

builder
    .build({
        targets: Platform.WINDOWS.createTarget(["portable"]),
        config: {
            appId: "com.giftseeker.app",
            productName: "GiftSeeker",
            artifactName: "giftseeker-portable-${version}.${ext}",
            copyright: "Copyright © 2016-2026 Codesprut / Erridian",
            files: ["src", "node_modules", "LICENSE"],
            icon: "./src/resources/images/icon.ico",
            win: {
                target: ["portable"],
            },
            portable: {
                requestExecutionLevel: "user", // To avoid admin prompt on every launch
            },
            compression: "normal",
            extraResources: ["libraries"],
            asar: true,
        },
    })
    .then(() => {
        console.log("✅ Ура! Portable-сборка успешно завершена в папке 'dist'!");
    })
    .catch(err => {
        console.error("❌ Ошибка при сборке Portable:", err);
    });

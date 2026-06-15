const builder = require("electron-builder");
const Platform = builder.Platform;

console.log("Начинаем сборку Portable-версии Dropushko для Windows (один файл)... Пожалуйста, подождите.");

builder
    .build({
        targets: Platform.WINDOWS.createTarget(["portable"]),
        config: {
            appId: "com.dropushko.app",
            productName: "Dropushko",
            artifactName: "dropushko-portable-${version}.${ext}",
            copyright: "Copyright © 2026 Erridian",
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
        console.log("✅ Ура! Portable-сборка Dropushko успешно завершена в папке 'dist'!");
    })
    .catch(err => {
        console.error("❌ Ошибка при сборке Portable:", err);
    });

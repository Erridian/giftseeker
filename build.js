const builder = require("electron-builder");
const Platform = builder.Platform;

function getCurrentPlatform() {
  switch (process.platform) {
    case "win32":
      return Platform.WINDOWS;
    case "darwin":
      return Platform.MAC;
    case "linux":
      return Platform.LINUX;
    default:
      console.error("Cannot resolve current platform!");
      return undefined;
  }
}

builder
  .build({
    targets: (process.argv[2] != null && Platform[process.argv[2]] != null
      ? Platform[process.argv[2]]
      : getCurrentPlatform()
    ).createTarget(
      (process.argv[2] === 'WINDOWS' || getCurrentPlatform() === Platform.WINDOWS) ? ["nsis", "portable"] : undefined
    ),
    config: {
      appId: "com.dropushko.app",
      productName: "Dropushko",
      artifactName: "dropushko.${ext}",
      copyright: "Copyright © 2016-2026 Erridian",
      files: ["src", "node_modules", "LICENSE"],
      icon: "./src/resources/images/icon.ico",
      win: {
        target: [
          {
            target: "nsis",
            arch: "x64",
          },
          "portable",
        ],
      },
      nsis: {
        artifactName: "dropushko-setup.${ext}",
        oneClick: false,
        perMachine: false,
        allowElevation: true,
        allowToChangeInstallationDirectory: true,
      },
      mac: {
        target: "dmg",
        category: "public.app-category.games",
      },
      linux: {
        target: ["AppImage", "deb"],
        icon: "./src/resources/images/icon.256x256.png",
        maintainer: "Erridian",
        vendor: "Erridian",
        synopsis: "Public giveaways helper",
        description: "Automatically join giveaways",
        category: "Game",
      },
      compression: "normal",
      extraResources: ["libraries"],
      asar: true,
      publish: {
        provider: "generic",
        url: "https://giftseeker.ru/files",
      },
    },
  })
  .then(() => {
    console.log("Build complete!");
  })
  .catch(err => {
    console.error("Error during build!", err);
  });

const env = require("./environment");
const path = require("path");

const appName = "GiftSeeker";

const installationStorage = path.resolve(env.homedir, appName);
const portableStorage = path.resolve(env.execPath, "data");

const storageDataPath = env.isPortable ? portableStorage : installationStorage;

module.exports = {
  appName,
  steamUrl: "https://steamcommunity.com/",
  storageDataPath,
  defaultSettings: {
    translation: "en_US",
    user_agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    start_minimized: false,
    start_with_os: false,
    steam_local: false,
    dlc_local: false,
    skipdlc_local: false,
    card_local: false,
    trial_local: false,
    autoswitch: false,
    autoscroll: false,
  },
};

const env = require("./environment");
const path = require("path");

const appName = "GiftSeeker";

const installationStorage = path.resolve(env.homedir, appName);
const portableStorage = path.resolve(env.execPath, "data");

const storageDataPath = env.isPortable ? portableStorage : installationStorage;

module.exports = {
  appName,
  websiteUrl: "https://giftseeker.ru/",
  storageDataPath,
  defaultSettings: {
    translation: "en_US",
    user_agent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/133.0.6943.84 Mobile/15E148 Safari/604.1",
    start_minimized: false,
    steam_local: false,
    dlc_local: false,
    skipdlc_local: false,
    card_local: false,
    trial_local: false,
    autoswitch: false,
    autoscroll: false,
  },
};

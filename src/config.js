const env = require("./environment");
const path = require("path");
const fs = require("fs");

const appName = "Dropushko";

const giftSeekerPath = path.resolve(env.homedir, "GiftSeeker");
const dropushkoPath = path.resolve(env.homedir, appName);

const installationStorage = fs.existsSync(giftSeekerPath)
  ? giftSeekerPath
  : dropushkoPath;
const portableStorage = path.resolve(env.execPath, "data");

const storageDataPath = env.isPortable ? portableStorage : installationStorage;

const getPlatformToken = () => {
  if (process.platform === "darwin") {
    return "Macintosh; Intel Mac OS X 10_15_7";
  }
  if (process.platform === "linux") {
    return "X11; Linux x86_64";
  }
  return "Windows NT 10.0; Win64; x64";
};

const getNativeChromeUserAgent = () => {
  const chromeVersion =
    (process.versions && process.versions.chrome) || "146.0.7680.166";
  return `Mozilla/5.0 (${getPlatformToken()}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
};

module.exports = {
  appName,
  steamUrl: "https://steamcommunity.com/",
  storageDataPath,
  getNativeChromeUserAgent,
  defaultSettings: {
    translation: "en_US",
    user_agent: getNativeChromeUserAgent(),
    start_minimized: false,
    start_with_os: false,
    light_theme: false,
    system_theme: true,
    steam_local: false,
    dlc_local: false,
    skipdlc_local: false,
    card_local: false,
    trial_local: false,
    autoswitch: false,
    autoscroll: false,
  },
};

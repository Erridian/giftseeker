const { BrowserWindow, shell } = require("electron");
const { appIcon } = require("../config");

const create = (session, parentWindow, onClose) => {
  const window = new BrowserWindow({
    parent: parentWindow,
    icon: appIcon,
    title: "Dropushko Browser",
    width: 1024,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    modal: true,
    show: false,
    center: true,
    webPreferences: {
      session: session.getSessionInstance(),
      nodeIntegration: false,
      contextIsolation: false,
      devTools: false,
      webviewTag: true,
    },
  });

  window.loadFile("./src/electron/web/blank.html");

  window.setMenu(null);

  window.on("close", e => {
    e.preventDefault();
    window.loadFile("./src/electron/web/blank.html");
    window.hide();

    onClose();
  });

  const openUrl = (url, useExternalBrowser) => {
    if (useExternalBrowser) {
      shell.openExternal(url);
      return;
    }

    window.loadURL(url);
    window.setTitle("Dropushko Browser");

    window.show();
  };

  const authorizationWindow = async (websiteUrl, authPageUrl, authContent) => {
    const checkLogin = setInterval(() => {
      if (window.getURL().indexOf(websiteUrl) >= 0) {
        window.webContents
          .executeJavaScript('document.querySelector("body").innerHTML')
          .then(html => {
            if (html.toLowerCase().includes(authContent.toLowerCase()) || 
                html.includes("180P") || // SteamGifts points
                html.includes("Level ")) { // SteamGifts level
              clearInterval(checkLogin);
              window.close();
            }
          })
          .catch(() => {});
      }
    }, 1000);

    window.webContents.on("did-finish-load", () => {
      // Keep for immediate check on load
    });

    openUrl(authPageUrl);

    return new Promise(resolve => {
      window.once("close", () => {
        clearInterval(checkLogin);
        window.webContents.removeAllListeners("did-finish-load");

        const cookies = session.extractCookiesStringByUrl(websiteUrl);

        resolve(cookies);
      });
    });
  };

  return {
    openUrl,
    authorizationWindow,
  };
};

module.exports = {
  create,
};

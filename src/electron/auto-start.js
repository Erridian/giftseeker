const ENV = require("../environment");
const { app } = require("electron");

const isEnabled = () => {
  return Promise.resolve(app.getLoginItemSettings().openAtLogin);
};

const set = enabled => {
  const executablePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;

  if (enabled && !ENV.devMode) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
      path: executablePath,
    });
    return Promise.resolve(true);
  }

  app.setLoginItemSettings({
    openAtLogin: false,
    path: executablePath,
  });
  return Promise.resolve(false);
};

module.exports = { set, isEnabled };

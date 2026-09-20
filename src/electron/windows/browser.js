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
      contextIsolation: true,
      devTools: false,
    },
  });

  window.loadFile("./src/electron/web/blank.html");

  window.setMenu(null);

  const syncBrowserUserAgent = () => {
    try {
      const currentUA = session.getSessionInstance().getUserAgent();
      if (currentUA && window && !window.isDestroyed()) {
        window.webContents.setUserAgent(currentUA);
      }
    } catch (e) {
      // Ignore
    }
  };

  syncBrowserUserAgent();

  const isTokenExpired = token => {
    if (!token || typeof token !== "string" || token === "null") {
      return true;
    }
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return true;
      }
      const payload = JSON.parse(
        Buffer.from(
          parts[1].replace(/-/g, "+").replace(/_/g, "/"),
          "base64",
        ).toString("utf8"),
      );
      if (payload.exp && typeof payload.exp === "number") {
        if (payload.exp * 1000 <= Date.now()) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return true;
    }
  };

  const isValidAuthCookie = val => {
    if (!val || typeof val !== "string") {
      return false;
    }
    let token = null;
    if (val.startsWith("eyJ")) {
      token = val.trim();
    } else {
      try {
        const decoded = decodeURIComponent(val);
        if (decoded.startsWith("eyJ")) {
          token = decoded.trim();
        } else {
          let parsed = JSON.parse(decoded);
          while (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
          }
          if (parsed && typeof parsed.token === "string") {
            token = parsed.token.trim();
          }
        }
      } catch (e) {
        try {
          let parsed = JSON.parse(val);
          while (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
          }
          if (parsed && typeof parsed.token === "string") {
            token = parsed.token.trim();
          }
        } catch (e2) {
          // Ignore
        }
      }
    }
    return Boolean(
      token &&
        token !== "null" &&
        token.startsWith("ey") &&
        token.length > 20 &&
        !isTokenExpired(token),
    );
  };

  const sanitizeManncoAuthCookie = async () => {
    try {
      const ses = session.getSessionInstance
        ? session.getSessionInstance()
        : session;
      if (!ses || !ses.cookies) {
        return;
      }
      const allCookies = await ses.cookies.get({ domain: "mannco.store" });
      const authCookies = allCookies.filter(c => c && c.name === "auth");

      let validAuthObj = null;
      for (const authCookie of authCookies) {
        if (!authCookie || !authCookie.value) {
          continue;
        }
        const raw = authCookie.value;
        if (!isValidAuthCookie(raw)) {
          continue;
        }
        const decoded = decodeURIComponent(raw);
        try {
          let parsed = JSON.parse(decoded);
          while (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
          }
          if (
            parsed &&
            parsed.token &&
            typeof parsed.token === "string" &&
            parsed.token.startsWith("ey") &&
            parsed.token !== "null" &&
            !isTokenExpired(parsed.token)
          ) {
            validAuthObj = parsed;
            break;
          }
        } catch (e) {
          const rawToken = (raw.startsWith("ey") ? raw : decoded).trim();
          if (rawToken.startsWith("ey") && !isTokenExpired(rawToken)) {
            validAuthObj = {
              token: rawToken,
              user: null,
            };
            break;
          }
        }
      }

      // Purge all old/conflicting auth cookies (both host and domain)
      for (const c of authCookies) {
        try {
          const cookieDomain = c.domain?.startsWith(".")
            ? c.domain.substring(1)
            : c.domain || "mannco.store";
          await ses.cookies.remove(`https://${cookieDomain}`, "auth");
          await ses.cookies.remove("https://mannco.store", "auth");
        } catch (e) {
          // Ignore
        }
      }

      // If a valid token exists, write exactly one clean single-encoded host cookie
      if (validAuthObj) {
        const cleanValue = encodeURIComponent(JSON.stringify(validAuthObj));
        await ses.cookies.set({
          url: "https://mannco.store",
          name: "auth",
          value: cleanValue,
          path: "/",
          secure: true,
          sameSite: "lax",
          expirationDate: Math.floor(Date.now() / 1000) + 604800,
        });
      }
    } catch (e) {
      // Ignore
    }
  };

  window.on("close", async e => {
    e.preventDefault();

    try {
      const currentUrl = window.getURL() || "";
      if (currentUrl.includes("mannco.store")) {
        await sanitizeManncoAuthCookie();
      }
    } catch (err) {
      // Ignore
    }

    window.loadFile("./src/electron/web/blank.html");
    window.hide();

    onClose();
  });

  const openUrl = async (url, useExternalBrowser) => {
    if (useExternalBrowser) {
      shell.openExternal(url);
      return;
    }

    syncBrowserUserAgent();
    if (url.includes("mannco.store")) {
      await sanitizeManncoAuthCookie();
    }
    window.loadURL(url);
    window.setTitle("Dropushko Browser");

    window.show();
  };

  const authorizationWindow = async (websiteUrl, authPageUrl, authContent) => {
    syncBrowserUserAgent();
    const isCloudflareActive = () => {
      try {
        const title = window.getTitle() || "";
        const currentUrl = window.getURL() || "";
        return (
          title.includes("Just a moment") ||
          title.includes("Один момент") ||
          title.includes("Cloudflare") ||
          title.includes("Attention Required") ||
          currentUrl.includes("challenges.cloudflare.com")
        );
      } catch (e) {
        return false;
      }
    };

    const checkPageAuth = async () => {
      try {
        // mannco.store authentication is purely token/cookie based; do not check DOM
        if (websiteUrl.includes("mannco.store") || !authContent) {
          return false;
        }

        const currentUrl = window.getURL() || "";
        if (!currentUrl.includes(websiteUrl)) {
          return false;
        }

        // Do not touch DOM or evaluate scripts while Cloudflare Turnstile challenge is active
        if (isCloudflareActive()) {
          return false;
        }

        const isAuth = await window.webContents.executeJavaScript(`
          (() => {
            try {
              if (document.querySelector('.${authContent}') ||
                  document.querySelector('#${authContent}') ||
                  document.querySelector('[class*="${authContent}"]')) {
                return true;
              }
              const html = (document.body && document.body.innerHTML) || "";
              return html.toLowerCase().includes("${authContent.toLowerCase()}");
            } catch (e) {
              return false;
            }
          })()
        `);

        return Boolean(isAuth);
      } catch (e) {
        return false;
      }
    };

    const extractManncoAuthFromPage = async () => {
      if (!window || window.isDestroyed()) {
        return null;
      }
      try {
        const pageAuth = await window.webContents
          .executeJavaScript(
            `(() => {
              try {
                if (window.useNuxtApp) {
                  const app = window.useNuxtApp();
                  if (app && app.$pinia && app.$pinia._s && app.$pinia._s.has('auth')) {
                    const auth = app.$pinia._s.get('auth');
                    if (auth && auth.token && typeof auth.token === 'string' && auth.token.length > 20 && auth.token !== 'null') {
                      return { token: auth.token, user: auth.user || null };
                    }
                  }
                }
              } catch (e) {}

              try {
                const match = document.cookie.match(/(?:^|;\\s*)auth=([^;]+)/);
                if (match) {
                  const decoded = decodeURIComponent(match[1]);
                  let parsed = JSON.parse(decoded);
                  if (typeof parsed === "string") {
                    parsed = JSON.parse(parsed);
                  }
                  if (parsed && parsed.token && typeof parsed.token === "string" && parsed.token.length > 20 && parsed.token !== "null") {
                    return parsed;
                  }
                }
              } catch (e) {}

              try {
                const raw = localStorage.getItem("auth");
                if (raw) {
                  let parsed = JSON.parse(raw);
                  if (typeof parsed === "string") {
                    parsed = JSON.parse(parsed);
                  }
                  if (parsed && parsed.token && typeof parsed.token === "string" && parsed.token.length > 20 && parsed.token !== "null") {
                    return parsed;
                  }
                }
              } catch (e) {}

              return null;
            })()`,
          )
          .catch(() => null);

        if (pageAuth && pageAuth.token && !isTokenExpired(pageAuth.token)) {
          return pageAuth;
        }
      } catch (e) {
        // Ignore
      }
      return null;
    };

    const checkCookiesAuth = async () => {
      try {
        if (websiteUrl.includes("mannco.store")) {
          // 1. Check live Nuxt 3 Pinia auth store, localStorage, or document.cookie
          const pageAuth = await extractManncoAuthFromPage();
          if (pageAuth) {
            try {
              const ses = session.getSessionInstance
                ? session.getSessionInstance()
                : session;
              if (ses && ses.cookies) {
                const cleanVal = encodeURIComponent(JSON.stringify(pageAuth));
                await ses.cookies.set({
                  url: "https://mannco.store",
                  name: "auth",
                  value: cleanVal,
                  path: "/",
                  secure: true,
                  sameSite: "lax",
                  expirationDate: Math.floor(Date.now() / 1000) + 604800,
                });
                if (typeof ses.cookies.flushStore === "function") {
                  await ses.cookies.flushStore();
                }
              }
            } catch (e) {
              // Ignore
            }
            return true;
          }

          // 2. Check session cookies
          const cookies = await session.extractCookiesByUrl(websiteUrl);
          let authCookie = cookies.find(c => c.name === "auth");
          if (!authCookie && session.getSessionInstance) {
            try {
              const allMannco = await session
                .getSessionInstance()
                .cookies.get({ domain: "mannco.store" });
              authCookie = allMannco.find(c => c.name === "auth");
            } catch (e) {
              // Ignore
            }
          }

          if (authCookie && authCookie.value) {
            let parsed = null;
            const raw = authCookie.value;
            try {
              if (raw.startsWith("eyJ")) {
                parsed = { token: raw.trim(), user: null };
              } else {
                const decoded = decodeURIComponent(raw);
                if (decoded.startsWith("eyJ")) {
                  parsed = { token: decoded.trim(), user: null };
                } else {
                  parsed = JSON.parse(decoded);
                  while (typeof parsed === "string") {
                    parsed = JSON.parse(parsed);
                  }
                }
              }
            } catch (e) {
              try {
                parsed = JSON.parse(raw);
                while (typeof parsed === "string") {
                  parsed = JSON.parse(parsed);
                }
              } catch (e2) {
                // Ignore parse error
              }
            }
            if (
              parsed &&
              parsed.token &&
              typeof parsed.token === "string" &&
              parsed.token.length > 20 &&
              parsed.token !== "null" &&
              !isTokenExpired(parsed.token)
            ) {
              return true;
            }
          }
          return false;
        }
      } catch (e) {
        // Ignore cookie check errors
      }
      return false;
    };

    let loginGraceTimer = null;

    const performCheck = async () => {
      // Auto-click Steam Community OpenID "Sign In" if user is already authenticated in Steam
      const currentUrl = window.getURL() || "";
      try {
        if (
          currentUrl.includes("steamcommunity.com/openid") &&
          window.webContents &&
          !window.isDestroyed()
        ) {
          await window.webContents
            .executeJavaScript(
              `(() => {
                try {
                  const loginBtn = document.querySelector('#imageLogin') || document.querySelector('input[type="submit"]');
                  if (loginBtn && (loginBtn.value === 'Sign In' || loginBtn.id === 'imageLogin')) {
                    loginBtn.click();
                  }
                } catch (e) {}
              })()`,
            )
            .catch(() => {});
        }
      } catch (e) {
        // Ignore
      }

      if (websiteUrl.includes("mannco.store")) {
        // Do not close while user is in redirect flow, on Steam, or solving Cloudflare
        if (
          currentUrl.includes("/user/redirect") ||
          currentUrl.includes("steamcommunity.com") ||
          isCloudflareActive()
        ) {
          return;
        }

        // When on /user/login, Nuxt is mounting, fetching user info, and will redirect to /
        if (currentUrl.includes("/user/login")) {
          const pageAuth = await extractManncoAuthFromPage();
          if (pageAuth && pageAuth.token && !loginGraceTimer) {
            loginGraceTimer = setTimeout(async () => {
              if (!window.isDestroyed()) {
                cleanup();
                window.close();
              }
            }, 3000);
          }
          return;
        }

        // User navigated to main site (e.g. '/' or another page)
        const cookiesAuthorized = await checkCookiesAuth();
        if (cookiesAuthorized) {
          cleanup();
          window.close();
          return;
        }
        return;
      }

      const cookiesAuthorized = await checkCookiesAuth();
      if (cookiesAuthorized) {
        cleanup();
        window.close();
        return;
      }

      const authorized = await checkPageAuth();
      if (authorized) {
        cleanup();
        window.close();
      }
    };

    const checkLogin = setInterval(performCheck, 2000);

    const onFinishLoad = () => {
      performCheck();
    };

    const onDidNavigate = () => {
      performCheck();
    };

    window.webContents.on("did-finish-load", onFinishLoad);
    window.webContents.on("did-navigate", onDidNavigate);

    const cleanup = () => {
      clearInterval(checkLogin);
      if (loginGraceTimer) {
        clearTimeout(loginGraceTimer);
        loginGraceTimer = null;
      }
      window.webContents.removeListener("did-finish-load", onFinishLoad);
      window.webContents.removeListener("did-navigate", onDidNavigate);
    };

    openUrl(authPageUrl);

    return new Promise(resolve => {
      window.once("close", async () => {
        cleanup();

        let cookies = await session.extractCookiesStringByUrl(websiteUrl);

        if (websiteUrl.includes("mannco.store")) {
          try {
            await sanitizeManncoAuthCookie();
            const ses = session.getSessionInstance
              ? session.getSessionInstance()
              : session;
            if (
              ses &&
              ses.cookies &&
              typeof ses.cookies.flushStore === "function"
            ) {
              await ses.cookies.flushStore();
            }
          } catch (e) {
            // Ignore
          }

          // If auth= is missing from cookies, try to retrieve it from session cookies
          if (!cookies.includes("auth=")) {
            try {
              const ses = session.getSessionInstance
                ? session.getSessionInstance()
                : session;
              if (ses && ses.cookies) {
                const domainCookies = await ses.cookies.get({
                  domain: "mannco.store",
                });
                const authCookie = domainCookies.find(c => c.name === "auth");
                if (authCookie && authCookie.value) {
                  cookies = cookies
                    ? `${cookies}; auth=${authCookie.value}`
                    : `auth=${authCookie.value}`;
                }
              }
            } catch (e) {
              // Ignore
            }
          }

          // Ensure auth cookie in the returned string is clean single-encoded JSON, and strip any null tokens
          if (cookies && cookies.includes("auth=")) {
            const normalized = cookies.replace(/([^\s;])auth=/g, "$1; auth=");
            const parts = normalized
              .split(";")
              .map(s => s.trim())
              .filter(Boolean);

            const otherCookies = [];
            let validAuthVal = null;

            for (const part of parts) {
              if (part.startsWith("auth=")) {
                const raw = part.substring(5);
                if (isValidAuthCookie(raw)) {
                  try {
                    let parsed = JSON.parse(decodeURIComponent(raw));
                    while (typeof parsed === "string") {
                      parsed = JSON.parse(parsed);
                    }
                    if (
                      parsed &&
                      parsed.token &&
                      typeof parsed.token === "string" &&
                      parsed.token.startsWith("ey") &&
                      parsed.token !== "null"
                    ) {
                      validAuthVal = encodeURIComponent(JSON.stringify(parsed));
                    }
                  } catch (e) {
                    if (raw.startsWith("ey")) {
                      validAuthVal = raw;
                    }
                  }
                }
              } else {
                otherCookies.push(part);
              }
            }

            if (validAuthVal) {
              otherCookies.push(`auth=${validAuthVal}`);
            }

            cookies = otherCookies.join("; ");
          }
        }

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

const authState = require("../auth-state.enum");
const BaseService = require("./base-service");
const translation = require("../../modules/translation");

class ManncoStore extends BaseService {
  constructor(settingsStorage, params, session) {
    super(
      settingsStorage,
      Object.assign(
        {
          websiteUrl: "https://mannco.store",
          authPageUrl: "https://mannco.store/user/redirect",
          authContent: "",
        },
        params,
      ),
      session,
    );

    delete this.settings.pages;
    delete this.settings.points_reserve;
    this.csrfToken = null;
    this.csrfExpiresAt = null;
    this.authData = null;
  }

  isValidAuthCookie(val) {
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
        !this.isTokenExpired(token),
    );
  }

  setCookieValue(cookieString, cookieName, cookieValue) {
    if (!cookieString || typeof cookieString !== "string") {
      return cookieValue ? `${cookieName}=${cookieValue}` : "";
    }
    const normalized = cookieString.replace(/([^\s;])auth=/g, "$1; auth=");
    const items = normalized
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith(`${cookieName}=`));

    if (cookieValue) {
      items.push(`${cookieName}=${cookieValue}`);
    }
    return items.join("; ");
  }

  async getCsrfToken(forceRefresh = false) {
    if (
      !forceRefresh &&
      this.csrfToken &&
      this.csrfExpiresAt &&
      Date.now() < this.csrfExpiresAt
    ) {
      return this.csrfToken;
    }

    try {
      const res = await this.apiRequest("https://api.mannco.store/csrf/token", {
        method: "GET",
      });

      if (
        res.status === 200 &&
        res.data &&
        res.data.success &&
        res.data.content?.csrf_token
      ) {
        this.csrfToken = res.data.content.csrf_token;
        const expiresIn = res.data.content.expires_in || 3600;
        this.csrfExpiresAt = Date.now() + expiresIn * 1000 - 3000;
        return this.csrfToken;
      }
    } catch (e) {
      // Ignore CSRF fetch error
    }

    return this.csrfToken || null;
  }

  async apiRequest(url, options = {}) {
    const { method = "GET", headers = {}, data = null } = options;

    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()) &&
      !headers["X-CSRF-Token"] &&
      !headers["x-csrf-token"]
    ) {
      const csrf = await this.getCsrfToken();
      if (csrf) {
        headers["X-CSRF-Token"] = csrf;
      }
    }

    let sessionInstance = null;
    if (this.session) {
      sessionInstance = this.session.getSessionInstance
        ? this.session.getSessionInstance()
        : this.session;
    }

    let electronNet = null;
    try {
      const electron = require("electron");
      if (
        electron &&
        electron.net &&
        typeof electron.net.request === "function"
      ) {
        electronNet = electron.net;
      }
    } catch (e) {
      // Not in Electron environment (e.g. CLI or Jest)
    }

    if (
      electronNet &&
      sessionInstance &&
      typeof sessionInstance.clearStorageData === "function"
    ) {
      return new Promise((resolve, reject) => {
        const req = electronNet.request({
          method,
          url,
          session: sessionInstance,
        });

        const defaultHeaders = {
          "User-Agent":
            this.settingsStorage?.get?.("user_agent") ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
          Origin: "https://mannco.store",
          Referer: "https://mannco.store/",
          Accept: "application/json, text/plain, */*",
          ...headers,
        };

        for (const [key, val] of Object.entries(defaultHeaders)) {
          if (val !== undefined && val !== null) {
            req.setHeader(key, val);
          }
        }

        req.on("response", res => {
          let body = "";
          res.on("data", chunk => {
            body += chunk;
          });
          res.on("end", () => {
            let parsed = null;
            try {
              parsed = JSON.parse(body);
            } catch (e) {
              parsed = body;
            }
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: parsed,
            });
          });
        });

        req.on("error", err => {
          reject(err);
        });

        if (data) {
          const bodyStr =
            typeof data === "string" ? data : JSON.stringify(data);
          req.setHeader("Content-Type", "application/json");
          req.write(bodyStr);
        }

        req.end();
      });
    }

    // Fallback to this.http (for CLI or unit tests)
    const httpMethod = method.toLowerCase();
    if (typeof this.http[httpMethod] === "function") {
      if (
        httpMethod === "get" ||
        httpMethod === "delete" ||
        httpMethod === "head"
      ) {
        return this.http[httpMethod](url, {
          headers: {
            Origin: "https://mannco.store",
            Referer: "https://mannco.store/",
            Accept: "application/json, text/plain, */*",
            ...headers,
          },
          validateStatus: () => true,
        });
      }
      return this.http[httpMethod](url, data, {
        headers: {
          Origin: "https://mannco.store",
          Referer: "https://mannco.store/",
          Accept: "application/json, text/plain, */*",
          ...headers,
        },
        validateStatus: () => true,
      });
    }

    return this.http.request({
      method,
      url,
      headers: {
        Origin: "https://mannco.store",
        Referer: "https://mannco.store/",
        Accept: "application/json, text/plain, */*",
        ...headers,
      },
      data,
      validateStatus: () => true,
    });
  }

  getAuthData() {
    let cookieStr = this.getConfig("cookie", "");
    let authVal = null;
    if (cookieStr) {
      const normalized = cookieStr.replace(/([^\s;])auth=/g, "$1; auth=");
      const match = normalized.match(/(?:^|;\s*)auth=([^;]+)/);
      if (match) {
        authVal = match[1];
      }
    }

    if (authVal && this.isValidAuthCookie(authVal)) {
      if (typeof authVal === "string" && authVal.startsWith("eyJ")) {
        this.authData = { token: authVal.trim(), user: null };
        return this.authData;
      }

      try {
        const decoded = decodeURIComponent(authVal);
        if (decoded.startsWith("eyJ")) {
          this.authData = { token: decoded.trim(), user: null };
          return this.authData;
        }
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
          !this.isTokenExpired(parsed.token)
        ) {
          this.authData = parsed;
          return this.authData;
        }
      } catch (e) {
        try {
          let parsed = JSON.parse(authVal);
          while (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
          }
          if (
            parsed &&
            parsed.token &&
            typeof parsed.token === "string" &&
            parsed.token.startsWith("ey") &&
            parsed.token !== "null" &&
            !this.isTokenExpired(parsed.token)
          ) {
            this.authData = parsed;
            return this.authData;
          }
        } catch (e2) {
          // Ignore JSON parse errors
        }
      }
    }

    if (
      this.authData &&
      this.authData.token &&
      !this.isTokenExpired(this.authData.token)
    ) {
      return this.authData;
    }

    return null;
  }

  isTokenExpired(token) {
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
  }

  async authCheck() {
    let authData = this.getAuthData();

    // If not in saved config, check native session cookies
    if (!authData || !authData.token || this.isTokenExpired(authData.token)) {
      if (this.session) {
        try {
          const sessionInstance = this.session.getSessionInstance
            ? this.session.getSessionInstance()
            : this.session;
          if (sessionInstance && sessionInstance.cookies) {
            let cookies = await sessionInstance.cookies.get({
              url: this.websiteUrl,
            });
            let authCookie = cookies.find(c => c.name === "auth");

            if (!authCookie) {
              const allMannco = await sessionInstance.cookies.get({
                domain: "mannco.store",
              });
              authCookie = allMannco.find(c => c.name === "auth");
            }

            if (authCookie && authCookie.value) {
              const raw = authCookie.value;
              let parsed = null;
              if (raw.startsWith("eyJ")) {
                parsed = { token: raw.trim(), user: null };
              } else {
                try {
                  const decoded = decodeURIComponent(raw);
                  if (decoded.startsWith("eyJ")) {
                    parsed = { token: decoded.trim(), user: null };
                  } else {
                    parsed = JSON.parse(decoded);
                  }
                } catch (e) {
                  try {
                    parsed = JSON.parse(raw);
                  } catch (e2) {
                    // Ignore JSON parse error
                  }
                }
              }
              if (typeof parsed === "string") {
                try {
                  parsed = JSON.parse(parsed);
                } catch (e) {
                  // Ignore parse error
                }
              }
              if (
                parsed &&
                parsed.token &&
                typeof parsed.token === "string" &&
                parsed.token !== "null" &&
                !this.isTokenExpired(parsed.token)
              ) {
                this.authData = parsed;
                const cleanCookieVal = encodeURIComponent(
                  JSON.stringify(parsed),
                );
                const currentCookie = this.getConfig("cookie", "");
                const updatedCookie = this.setCookieValue(
                  currentCookie,
                  "auth",
                  cleanCookieVal,
                );
                this.setCookie(updatedCookie);
                authData = parsed;
              }
            }
          }
        } catch (e) {
          // Ignore session cookie errors
        }
      }
    }

    if (
      !authData ||
      !authData.token ||
      typeof authData.token !== "string" ||
      authData.token === "null" ||
      this.isTokenExpired(authData.token)
    ) {
      console.log(
        `[ManncoStore] Auth check failed: no valid JWT token found (authData=${Boolean(authData)})`,
      );
      return authState.NOT_AUTHORIZED;
    }

    try {
      const res = await this.apiRequest(
        "https://api.mannco.store/user/isConnected",
        {
          headers: {
            Authorization: `Bearer ${authData.token}`,
          },
        },
      );

      if (
        res.status === 200 &&
        res.data &&
        res.data.success &&
        res.data.content?.connected
      ) {
        this.authData = authData;
        console.log(
          `[ManncoStore] Auth check succeeded (user: ${authData.user?.name || "Connected"})`,
        );
        return authState.AUTHORIZED;
      }

      console.log(
        `[ManncoStore] isConnected returned status ${res.status}, data:`,
        res.data,
      );
      return authState.NOT_AUTHORIZED;
    } catch (err) {
      console.log(`[ManncoStore] Auth check connection error: ${err.message}`);
      return authState.CONNECTION_REFUSED;
    }
  }

  async getUserInfo() {
    let authData = this.getAuthData();
    if (!authData || !authData.token) {
      authData = this.authData;
    }

    if (authData && authData.token) {
      try {
        const res = await this.apiRequest(
          "https://api.mannco.store/user/infos",
          {
            headers: {
              Authorization: `Bearer ${authData.token}`,
            },
          },
        );

        if (res.status === 200 && res.data && res.data.content?.informations) {
          const info = res.data.content.informations;
          authData.user = {
            name: info.name || "Mannco User",
            avatar: info.image || "",
            balance: info.balance !== undefined ? info.balance : 0,
          };
          this.authData = authData;

          const cleanCookieVal = encodeURIComponent(JSON.stringify(authData));
          const currentCookie = this.getConfig("cookie", "");
          const updatedCookie = this.setCookieValue(
            currentCookie,
            "auth",
            cleanCookieVal,
          );
          this.setCookie(updatedCookie);

          if (this.session) {
            try {
              const sessionInstance = this.session.getSessionInstance
                ? this.session.getSessionInstance()
                : this.session;
              if (sessionInstance && sessionInstance.cookies) {
                await sessionInstance.cookies.set({
                  url: this.websiteUrl,
                  name: "auth",
                  value: cleanCookieVal,
                  path: "/",
                  secure: true,
                  sameSite: "lax",
                  expirationDate: Math.floor(Date.now() / 1000) + 604800,
                });
              }
            } catch (e) {
              // Ignore session cookie set error
            }
          }

          return {
            avatar: info.image || "",
            username: info.name || "Mannco User",
            value: info.balance !== undefined ? String(info.balance) : "0",
          };
        }
      } catch (e) {
        // Ignore user info fetch error, fall back to cached user info
      }
    }

    if (authData && authData.user) {
      return {
        avatar: authData.user.avatar || "",
        username: authData.user.name || "Mannco User",
        value:
          authData.user.balance !== undefined
            ? String(authData.user.balance)
            : "0",
      };
    }

    return {
      avatar: "",
      username: "Mannco User",
      value: "0",
    };
  }

  async seekService() {
    const authData = this.getAuthData();
    const token = authData ? authData.token : null;

    let giveaways = [];
    try {
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await this.apiRequest("https://api.mannco.store/giveaways", {
        headers,
      });

      if (
        res.status === 200 &&
        res.data &&
        res.data.success &&
        res.data.content?.list
      ) {
        const rawList = res.data.content.list;
        const list = Array.isArray(rawList) ? rawList : Object.values(rawList);
        giveaways = list
          .filter(ga => !ga.isJoined && !ga.joined && ga.url)
          .map(ga => ({
            id: ga.id,
            url: ga.url,
            name: (ga.name || "Unknown Giveaway").trim(),
          }));
      } else {
        this.log(`Mannco giveaways API returned status ${res.status}`, 3);
        return;
      }
    } catch (err) {
      this.log(`Mannco seekService error: ${err.message}`, 3);
      return;
    }

    for (const giveaway of giveaways) {
      if (!this.isStarted()) {
        break;
      }

      await this.entryInterval();

      const entered = await this.enterGiveaway(giveaway, token);

      if (entered) {
        this.log({
          text: `${translation.get("service.entered_in")} #link#`,
          anchor: giveaway.name,
          url: `${this.websiteUrl}/giveaways/${giveaway.url}`,
        });
      }
    }
  }

  async enterGiveaway(giveaway, token) {
    if (!giveaway || !giveaway.url) {
      return false;
    }

    let currentToken = token;
    if (!currentToken) {
      const authData = this.getAuthData();
      currentToken = authData ? authData.token : null;
    }

    if (!currentToken) {
      this.log("Mannco: Token not found, cannot join giveaway", 3);
      return false;
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const headers = {
          Authorization: `Bearer ${currentToken}`,
        };
        const csrfToken = await this.getCsrfToken();
        if (csrfToken) {
          headers["X-CSRF-Token"] = csrfToken;
        }

        const res = await this.apiRequest(
          `https://api.mannco.store/giveaways/join/${giveaway.url}`,
          {
            method: "POST",
            data: {},
            headers,
          },
        );

        if (res.status === 200 && res.data) {
          if (res.data.success && !res.data.err) {
            return true;
          }
          const msg =
            res.data.content?.message ||
            res.data.message ||
            (typeof res.data.err === "string" ? res.data.err : null);
          if (msg) {
            if (msg.toLowerCase().includes("already")) {
              return false;
            }
            this.log(`Mannco Join [${giveaway.name}]: ${msg}`, 2);
            return false;
          }
        }

        if (
          attempt === 0 &&
          res.status === 403 &&
          (res.data?.error === "CSRF" || !res.data)
        ) {
          await this.getCsrfToken(true);
          continue;
        }

        this.log(
          `Mannco Join failed [${giveaway.name}]: HTTP ${res.status}`,
          3,
        );
        return false;
      } catch (err) {
        this.log(`Mannco Join Error [${giveaway.name}]: ${err.message}`, 3);
        return false;
      }
    }

    return false;
  }

  setCookie(cookie) {
    if (!cookie) {
      this.authData = null;
      super.setCookie(cookie);
      return;
    }

    if (typeof cookie === "string") {
      const normalized = cookie.replace(/([^\s;])auth=/g, "$1; auth=");
      const parts = normalized
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const otherCookies = [];
      let validAuthVal = null;

      for (const part of parts) {
        if (part.startsWith("auth=")) {
          const val = part.substring(5);
          if (this.isValidAuthCookie(val)) {
            validAuthVal = val;
          }
        } else {
          otherCookies.push(part);
        }
      }

      if (
        !validAuthVal &&
        this.authData &&
        this.authData.token &&
        !this.isTokenExpired(this.authData.token)
      ) {
        validAuthVal = encodeURIComponent(JSON.stringify(this.authData));
      }

      if (validAuthVal) {
        otherCookies.push(`auth=${validAuthVal}`);
      }

      cookie = otherCookies.join("; ");
    }

    super.setCookie(cookie);
    if (cookie && cookie.includes("auth=")) {
      this.getAuthData();
    }
  }
}

module.exports = ManncoStore;

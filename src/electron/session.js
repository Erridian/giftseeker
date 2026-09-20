const { app, session, net } = require("electron");
const { steamUrl, getNativeChromeUserAgent } = require("../config");

const create = (settings, sessionName) => {
  let accountInfo = { loggedIn: false };
  const _session = session.fromPartition(`persist:${sessionName}`);

  // Automatically migrate legacy or obsolete User-Agent strings (e.g. Chrome/133, iPhone)
  const savedUA = settings.get("user_agent");
  const nativeUA = getNativeChromeUserAgent();
  if (
    !savedUA ||
    savedUA.includes("Chrome/133.0.0.0") ||
    savedUA.includes("iPhone") ||
    savedUA.includes("CriOS")
  ) {
    settings.set("user_agent", nativeUA);
  }

  const applyUserAgentEverywhere = targetUA => {
    if (!targetUA) {
      return;
    }

    if (app && app.userAgentFallback !== undefined) {
      app.userAgentFallback = targetUA;
    }

    try {
      if (session && session.defaultSession) {
        session.defaultSession.setUserAgent(targetUA);
      }
    } catch (e) {
      // Ignore
    }

    _session.setUserAgent(targetUA);
  };

  const initialUA = settings.get("user_agent") || nativeUA;
  applyUserAgentEverywhere(initialUA);

  settings.on("change", "user_agent", newUserAgent => {
    applyUserAgentEverywhere(newUserAgent);
  });

  // Intercept all outgoing HTTP/HTTPS requests to guarantee 100% User-Agent consistency
  // across all domains and internal worker/verification endpoints (including challenges.cloudflare.com, brunhild, etc.)
  const filter = { urls: ["*://*/*"] };
  const onBeforeSendHeadersCallback = (details, callback) => {
    const currentUA = settings.get("user_agent") || initialUA;
    if (currentUA) {
      details.requestHeaders["User-Agent"] = currentUA;
    }
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  };

  try {
    _session.webRequest.onBeforeSendHeaders(
      filter,
      onBeforeSendHeadersCallback,
    );
  } catch (e) {
    // Ignore in unsupported environments
  }

  try {
    if (
      session &&
      session.defaultSession &&
      session.defaultSession !== _session
    ) {
      session.defaultSession.webRequest.onBeforeSendHeaders(
        filter,
        onBeforeSendHeadersCallback,
      );
    }
  } catch (e) {
    // Ignore
  }

  const extractCookiesByUrl = async url => {
    let cookies = [];
    try {
      cookies = await _session.cookies.get({ url });
    } catch (e) {
      // Ignore
    }

    try {
      const parsedUrl = new URL(url);
      const hostParts = parsedUrl.hostname.split(".");
      if (hostParts.length >= 2) {
        const baseDomain = hostParts.slice(-2).join(".");
        const domainCookies = await _session.cookies.get({
          domain: baseDomain,
        });
        const existingNames = new Set(cookies.map(c => c.name));
        for (const dc of domainCookies) {
          if (!existingNames.has(dc.name)) {
            cookies.push(dc);
            existingNames.add(dc.name);
          } else if (url.includes("mannco.store") && dc.name === "auth") {
            const existingAuth = cookies.find(c => c.name === "auth");
            if (
              existingAuth &&
              (existingAuth.value.includes("null") ||
                !existingAuth.value.includes("ey")) &&
              dc.value &&
              dc.value.includes("ey")
            ) {
              const idx = cookies.indexOf(existingAuth);
              if (idx !== -1) {
                cookies[idx] = dc;
              }
            }
          }
        }
      }
    } catch (e) {
      // Ignore domain cookie extraction error
    }

    if (url.includes("mannco.store")) {
      cookies = cookies.filter(
        c =>
          c.name !== "auth" ||
          (!c.value.includes("null") && c.value.includes("ey")),
      );
    }

    return cookies;
  };

  const extractCookiesStringByUrl = url => {
    return extractCookiesByUrl(url)
      .then(cookies =>
        cookies.map(cookie => cookie.name + "=" + cookie.value).join("; "),
      )
      .catch(() => "");
  };

  const checkUserIsLoggedIn = async () => {
    // Ensure sessionid exists in the session to prevent guest redirects/glitches
    const allCookies = await _session.cookies.get({
      domain: "steamcommunity.com",
    });
    if (!allCookies.find(c => c.name === "sessionid")) {
      const sessionId =
        Math.random().toString(36).substring(2, 14) +
        Math.random().toString(36).substring(2, 14);
      await _session.cookies.set({
        url: "https://steamcommunity.com",
        name: "sessionid",
        value: sessionId,
        domain: "steamcommunity.com",
        path: "/",
        secure: true,
        sameSite: "no_restriction",
      });
    }

    const cookies = await _session.cookies.get({ url: steamUrl });
    console.log(`[Session] Steam cookies count: ${cookies.length}`);
    cookies.forEach(c => {
      const val =
        c.value.length > 20 ? `${c.value.substring(0, 15)}...` : c.value;
      console.log(
        `[Session] Cookie: ${c.name}=${val} Domain: ${c.domain}, Path: ${c.path}, Secure: ${c.secure}, HttpOnly: ${c.httpOnly}`,
      );
    });

    const loginCookie = cookies.find(
      c => c.name === "steamLoginSecure" && c.value.length > 10,
    );
    const hasLoginCookie = !!loginCookie;

    const checkRequest = () => {
      return new Promise(resolve => {
        const checkUrl = steamUrl + "?l=russian";
        const request = net.request({
          method: "GET",
          url: checkUrl,
          session: _session,
        });

        request.setHeader("User-Agent", settings.get("user_agent") || nativeUA);
        request.setHeader("Referer", "https://steamcommunity.com/");

        request.on("response", response => {
          let data = "";
          response.on("data", chunk => {
            data += chunk;
          });
          response.on("end", () => {
            const isDetectedLoggedIn = checkSteamLoggedIn(data, hasLoginCookie);

            if (!isDetectedLoggedIn) {
              console.log(
                "[Session] Steam check: User is NOT logged in (detection failed).",
              );
              console.log(`[Session] HTML Snippet: ${data.substring(0, 500)}`);
              console.log(
                `[Session] Headers: ${JSON.stringify(response.headers)}`,
              );
              resolve({ loggedIn: false });
            } else {
              console.log("[Session] Steam check: User IS logged in.");
              resolve({
                loggedIn: true,
                userData: extractSteamData(
                  data,
                  loginCookie ? loginCookie.value : null,
                ),
              });
            }
          });
        });

        request.on("error", err => {
          console.log(`[Session] Steam check: Network ERROR: ${err.message}`);
          resolve({
            loggedIn: false,
            error: true,
          });
        });

        request.end();
      });
    };

    accountInfo = await checkRequest();
    return accountInfo;
  };

  const checkSteamLoggedIn = (html, hasLoginCookie) => {
    // Robust check: g_steamID should be a string of numbers
    const steamIdMatch = html.match(/g_steamID\s*=\s*"(\d+)"/);
    let isLoggedIn = steamIdMatch && steamIdMatch[1] !== "0";

    // Explicit logout marker
    if (html.includes("g_steamID = false;")) {
      isLoggedIn = false;
    }

    // Fallback: check for persona name or account_name or other logged-in elements
    const hasAccountMarkers =
      html.includes("account_name") ||
      html.includes("persona_name") ||
      html.includes("header_wallet_balance") ||
      html.includes("account_pulldown");

    if (!isLoggedIn && !hasAccountMarkers) {
      // If we have the secure login cookie, we assume the user is logged in even if the page structure is weird
      if (hasLoginCookie) {
        console.log(
          "[Session] UI markers missing but steamLoginSecure cookie is present. Treating as LOGGED IN.",
        );
        return true;
      }

      // Definitive failure indicators
      if (html.includes("login/home") || html.includes('id="login_btn"')) {
        return false;
      }
    }

    return isLoggedIn || hasAccountMarkers;
  };

  const extractSteamData = (html, loginCookieValue) => {
    const usernameMatch =
      html.match(
        /<span class="user_name"[^>]*>\s*<a[^>]*>\s*([^<]+)\s*<\/a>/,
      ) ||
      html.match(/<a class="user_name"[^>]*>\s*([^<]+)\s*<\/a>/) ||
      html.match(/<span class="persona_name">([^<]+)<\/span>/) ||
      html.match(/"persona_name":"([^"]+)"/);
    const avatarMatch =
      html.match(/<span class="user_avatar"[^>]*>\s*<img src="([^"]+)"/) ||
      html.match(/<div class="playerAvatar [^"]+">\s*<img src="([^"]+)">/) ||
      html.match(/"avatar_full":"([^"]+)"/);
    const steamidMatch = html.match(/g_steamID\s*=\s*"(\d+)"/);

    let steamid = steamidMatch ? steamidMatch[1] : null;

    // If steamid is missing from HTML but we have high-confidence cookie, extract it from there
    if (!steamid && loginCookieValue) {
      const cookieSteamId = loginCookieValue.split("%")[0];
      if (/^\d+$/.test(cookieSteamId)) {
        steamid = cookieSteamId;
      }
    }

    return {
      avatar: avatarMatch ? avatarMatch[1] : null,
      username: usernameMatch ? usernameMatch[1] : null,
      steamid: steamid,
    };
  };

  const flush = async () => {
    await _session.clearStorageData();
  };

  return {
    flush,
    getSessionInstance: () => _session,
    checkUserIsLoggedIn,
    extractCookiesByUrl,
    extractCookiesStringByUrl,
    setCookiesFromString: async (url, cookieString) => {
      if (!cookieString) {
        return;
      }

      const domain = new URL(url).hostname;
      const cookies = cookieString
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const cookie of cookies) {
        const sep = cookie.indexOf("=");
        if (sep === -1) {
          continue;
        }

        const name = cookie.substring(0, sep);
        const value = cookie.substring(sep + 1);

        if (url.includes("mannco.store") && name === "auth") {
          // Never inject null or invalid auth cookie for mannco.store
          if (value.includes("null") || !value.includes("ey")) {
            continue;
          }
          try {
            await _session.cookies.set({
              url,
              name,
              value,
              path: "/",
              secure: true,
              sameSite: "lax",
            });
          } catch (e) {
            // Ignore
          }
          continue;
        }

        try {
          await _session.cookies.set({
            url,
            name,
            value,
            domain,
            path: "/",
            secure: url.startsWith("https"),
            sameSite: "no_restriction",
          });
        } catch (e) {
          // If the cookie already exists as HttpOnly, it's fresher than the one we are setting from settings.
          // We can safely ignore "overwritten an HttpOnly cookie" errors.
          if (!e.message.includes("overwritten an HttpOnly cookie")) {
            console.error(
              `[Session] Failed to set cookie ${name}: ${e.message}`,
            );
          }
        }
      }
    },
    getAccountInfo: () => accountInfo,
  };
};

module.exports = { create };

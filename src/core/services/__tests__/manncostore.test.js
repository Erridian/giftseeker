jest.mock("../../../modules/translation", () => ({
  get: jest.fn(key => key),
  init: jest.fn().mockResolvedValue(true),
  current: jest.fn().mockReturnValue("en_US"),
  currentPhrases: jest.fn().mockReturnValue({}),
  listAvailable: jest.fn().mockReturnValue([]),
}));

const ManncoStore = require("../manncostore");
const authState = require("../../auth-state.enum");

const makeJwt = (expSecondsFromNow = 3600) => {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64");
  const payload = Buffer.from(
    JSON.stringify({
      steamId: "76561198000000000",
      exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    }),
  ).toString("base64");
  return `${header}.${payload}.signature`;
};

const createMockSettings = () => {
  const store = {};
  return {
    get: jest.fn((key, def) => (store[key] !== undefined ? store[key] : def)),
    set: jest.fn((key, val) => {
      store[key] = val;
    }),
    getAll: jest.fn(() => ({ ...store })),
    on: jest.fn(),
  };
};

describe("ManncoStore Service", () => {
  let settings;
  let manncostore;

  beforeEach(() => {
    settings = createMockSettings();
    manncostore = new ManncoStore(settings);
  });

  test("isTokenExpired should return true for invalid or expired tokens", () => {
    expect(manncostore.isTokenExpired(null)).toBe(true);
    expect(manncostore.isTokenExpired("invalid.token")).toBe(true);

    const expiredToken = makeJwt(-3600);
    expect(manncostore.isTokenExpired(expiredToken)).toBe(true);

    const validToken = makeJwt(3600);
    expect(manncostore.isTokenExpired(validToken)).toBe(false);
  });

  test("getAuthData should correctly parse auth cookie", () => {
    const validToken = makeJwt(3600);
    const authObj = {
      token: validToken,
      user: {
        name: "TestUser",
        avatar: "https://example.com/avatar.jpg",
        balance: 10.5,
      },
    };

    // No cookie
    expect(manncostore.getAuthData()).toBeNull();

    // Encoded JSON in cookie
    manncostore.setCookie(
      `auth=${encodeURIComponent(JSON.stringify(authObj))}`,
    );
    const data = manncostore.getAuthData();
    expect(data).not.toBeNull();
    expect(data.token).toBe(validToken);
    expect(data.user.name).toBe("TestUser");

    // Raw JWT in cookie
    manncostore.setCookie(`auth=${validToken}`);
    const rawJwtData = manncostore.getAuthData();
    expect(rawJwtData).not.toBeNull();
    expect(rawJwtData.token).toBe(validToken);

    // Double-encoded JSON in cookie (Nuxt migration / legacy edge case)
    manncostore.setCookie(
      `auth=${encodeURIComponent(JSON.stringify(JSON.stringify(authObj)))}`,
    );
    const doubleEncodedData = manncostore.getAuthData();
    expect(doubleEncodedData).not.toBeNull();
    expect(doubleEncodedData.token).toBe(validToken);
    expect(doubleEncodedData.user.name).toBe("TestUser");
  });

  test("getUserInfo should extract info from auth data", async () => {
    const validToken = makeJwt(3600);
    const authObj = {
      token: validToken,
      user: {
        name: "Gamer123",
        avatar: "https://example.com/avatar.jpg",
        balance: 25.5,
      },
    };
    manncostore.setCookie(
      `auth=${encodeURIComponent(JSON.stringify(authObj))}`,
    );

    const info = await manncostore.getUserInfo();
    expect(info.username).toBe("Gamer123");
    expect(info.avatar).toBe("https://example.com/avatar.jpg");
    expect(info.value).toBe("25.5");
  });

  test("should preserve auth cookie when user is null (Nuxt initial login) and fetch user info via API", async () => {
    const validToken = makeJwt(3600);
    // Nuxt initial login cookie: { token: "eyJ...", user: null }
    const nuxtAuthObj = { token: validToken, user: null };
    const rawCookie = `auth=${encodeURIComponent(JSON.stringify(nuxtAuthObj))}`;

    manncostore.setCookie(rawCookie);
    expect(manncostore.getConfig("cookie")).toContain("auth=");

    const authData = manncostore.getAuthData();
    expect(authData).not.toBeNull();
    expect(authData.token).toBe(validToken);
    expect(authData.user).toBeNull();

    // Mock /user/infos API
    manncostore.http = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          content: {
            informations: {
              name: "FreshLoggedInUser",
              image: "https://mannco.store/avatar.png",
              balance: 15.2,
            },
          },
        },
      }),
    };

    const userInfo = await manncostore.getUserInfo();
    expect(userInfo.username).toBe("FreshLoggedInUser");
    expect(userInfo.avatar).toBe("https://mannco.store/avatar.png");
    expect(userInfo.value).toBe("15.2");

    // Check that cookie was updated to include user profile
    const updatedCookie = manncostore.getConfig("cookie");
    expect(updatedCookie).toContain("FreshLoggedInUser");
  });

  test("should strip invalid or null auth tokens in setCookie", () => {
    // auth={"token":null}
    manncostore.setCookie(
      `auth=${encodeURIComponent(JSON.stringify({ token: null }))}`,
    );
    expect(manncostore.getConfig("cookie")).not.toContain("auth=");

    // auth=null
    manncostore.setCookie("auth=null; other=123");
    expect(manncostore.getConfig("cookie")).toBe("other=123");
  });

  test("authCheck should return NOT_AUTHORIZED if no cookie or expired", async () => {
    // No cookie
    const res1 = await manncostore.authCheck();
    expect(res1).toBe(authState.NOT_AUTHORIZED);

    // Expired token
    const expiredAuthObj = { token: makeJwt(-100) };
    manncostore.setCookie(`auth=${JSON.stringify(expiredAuthObj)}`);
    const res2 = await manncostore.authCheck();
    expect(res2).toBe(authState.NOT_AUTHORIZED);
  });

  test("authCheck should return AUTHORIZED when API confirms connection", async () => {
    const validToken = makeJwt(3600);
    const authObj = { token: validToken };
    manncostore.setCookie(
      `auth=${encodeURIComponent(JSON.stringify(authObj))}`,
    );

    manncostore.http = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          success: true,
          content: { connected: true },
        },
      }),
    };

    const res = await manncostore.authCheck();
    expect(res).toBe(authState.AUTHORIZED);
    expect(manncostore.http.get).toHaveBeenCalledWith(
      "https://api.mannco.store/user/isConnected",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${validToken}`,
        }),
      }),
    );
  });

  test("authCheck should recover and authorize when cookie is in session even if double-encoded", async () => {
    const validToken = makeJwt(3600);
    const authObj = { token: validToken, user: { name: "SessionUser" } };
    const doubleEncoded = encodeURIComponent(
      JSON.stringify(JSON.stringify(authObj)),
    );

    manncostore.setCookie("cf_clearance=test1234");
    manncostore.session = {
      getSessionInstance: () => ({
        cookies: {
          get: jest
            .fn()
            .mockResolvedValue([{ name: "auth", value: doubleEncoded }]),
        },
      }),
    };

    manncostore.http = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          success: true,
          content: { connected: true },
        },
      }),
    };

    const res = await manncostore.authCheck();
    expect(res).toBe(authState.AUTHORIZED);
    expect(manncostore.getConfig("cookie")).toContain("cf_clearance=test1234");
    expect(manncostore.getConfig("cookie")).toContain("auth=");
  });

  test("seekService should fetch giveaways and join unjoined ones", async () => {
    const validToken = makeJwt(3600);
    manncostore.setCookie(
      `auth=${encodeURIComponent(JSON.stringify({ token: validToken }))}`,
    );

    manncostore.http = {
      get: jest.fn().mockImplementation(url => {
        if (url.includes("csrf/token")) {
          return Promise.resolve({
            status: 200,
            data: {
              success: true,
              content: { csrf_token: "mock-csrf-token", expires_in: 3600 },
            },
          });
        }
        return Promise.resolve({
          status: 200,
          data: {
            success: true,
            content: {
              list: {
                ga1: {
                  id: 1,
                  url: "giveaway-1",
                  name: "AK-47",
                  isJoined: false,
                },
                ga2: { id: 2, url: "giveaway-2", name: "AWP", isJoined: true },
              },
            },
          },
        });
      }),
      post: jest.fn().mockResolvedValue({
        status: 200,
        data: { success: true },
      }),
    };

    manncostore.isStarted = () => true;
    manncostore.entryInterval = () => Promise.resolve();
    manncostore.log = jest.fn();

    await manncostore.seekService();

    expect(manncostore.http.post).toHaveBeenCalledTimes(1);
    expect(manncostore.http.post).toHaveBeenCalledWith(
      "https://api.mannco.store/giveaways/join/giveaway-1",
      {},
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${validToken}`,
          "X-CSRF-Token": "mock-csrf-token",
        }),
      }),
    );
    expect(manncostore.log).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: "AK-47",
        url: "https://mannco.store/giveaways/giveaway-1",
      }),
    );
  });

  test("getCsrfToken should fetch, cache and refresh token", async () => {
    manncostore.http = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          success: true,
          content: { csrf_token: "csrf-token-1", expires_in: 3600 },
        },
      }),
    };

    const token1 = await manncostore.getCsrfToken();
    expect(token1).toBe("csrf-token-1");
    expect(manncostore.http.get).toHaveBeenCalledTimes(1);

    // Cached call should not make another HTTP request
    const token2 = await manncostore.getCsrfToken();
    expect(token2).toBe("csrf-token-1");
    expect(manncostore.http.get).toHaveBeenCalledTimes(1);

    // Force refresh should make a new HTTP request
    manncostore.http.get.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        content: { csrf_token: "csrf-token-2", expires_in: 3600 },
      },
    });
    const token3 = await manncostore.getCsrfToken(true);
    expect(token3).toBe("csrf-token-2");
    expect(manncostore.http.get).toHaveBeenCalledTimes(2);
  });

  test("enterGiveaway should retry once on 403 CSRF error and succeed", async () => {
    const validToken = makeJwt(3600);
    manncostore.setCookie(
      `auth=${encodeURIComponent(JSON.stringify({ token: validToken }))}`,
    );

    let getCount = 0;
    manncostore.http = {
      get: jest.fn().mockImplementation(() => {
        getCount++;
        return Promise.resolve({
          status: 200,
          data: {
            success: true,
            content: {
              csrf_token: `csrf-token-${getCount}`,
              expires_in: 3600,
            },
          },
        });
      }),
      post: jest
        .fn()
        .mockResolvedValueOnce({
          status: 403,
          data: { error: "CSRF" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true },
        }),
    };

    const result = await manncostore.enterGiveaway(
      { url: "m4a4-howl", name: "M4A4 | Howl" },
      validToken,
    );

    expect(result).toBe(true);
    expect(manncostore.http.post).toHaveBeenCalledTimes(2);
    expect(manncostore.http.get).toHaveBeenCalledTimes(2);
  });

  test("should repair corrupted glued auth cookies and maintain proper semicolons", () => {
    const validToken = makeJwt(3600);
    const authObj = { token: validToken, user: { name: "RepairedUser" } };
    const authVal = encodeURIComponent(JSON.stringify(authObj));

    // Corrupted string where auth= was glued directly onto cf_clearance without a semicolon, and duplicated
    const corrupted = `cf_clearance=abc123xyzauth=${authVal}auth=${authVal}`;
    manncostore.setCookie(corrupted);

    const savedCookie = manncostore.getConfig("cookie");
    expect(savedCookie).toContain("cf_clearance=abc123xyz");
    expect(savedCookie).toContain("; auth=");

    const authData = manncostore.getAuthData();
    expect(authData).not.toBeNull();
    expect(authData.token).toBe(validToken);
    expect(authData.user.name).toBe("RepairedUser");
  });

  test("setCookieValue should cleanly replace cookie without stripping semicolons", () => {
    const initial = "cf_clearance=123; session=abc";
    const updated = manncostore.setCookieValue(initial, "auth", "token123");
    expect(updated).toBe("cf_clearance=123; session=abc; auth=token123");

    const replaced = manncostore.setCookieValue(updated, "auth", "token456");
    expect(replaced).toBe("cf_clearance=123; session=abc; auth=token456");
  });
});

const Settings = require("../../../modules/settings");
const SteamGifts = require("../steamgifts");

const createGiveaway = (number, fields = {}) => {
  return Object.assign(
    {
      url: "https://sg.com",
      cost: 0,
      copies: 100,
      entries: 100,
      timeLeft: 300,
      levelRequired: 0,
      levelPass: true,
      name: "giveaway " + number,
      code: "giveaway" + number,
      entered: false,
      winChance: 100,
    },
    fields,
  );
};

const defaultValue = 300;
const settings = new Settings("settings", {});
const steamgifts = new SteamGifts(settings);

const commonGiveaways = [
  createGiveaway(1),
  createGiveaway(2, { entered: true }),
  createGiveaway(3, { levelPass: false }),
];

describe("Entry logic", () => {
  const cases = [
    {
      toString: () => "Default settings",
      expectTruthy: ["giveaway1"],
    },
    {
      toString: () => "Check required level",
      giveaways: [
        createGiveaway(1, {
          levelRequired: 3,
        }),
        createGiveaway(2, {
          levelRequired: 4,
        }),
        createGiveaway(3, {
          levelRequired: 5,
        }),
      ],
      settings: {
        steamgifts_min_level: 4,
      },
      expectTruthy: ["giveaway2", "giveaway3"],
    },
    {
      toString: () => "Pass by winning chance",
      settings: {
        steamgifts_min_chance: 2.3,
      },
      giveaways: [
        createGiveaway(1, {
          winChance: 0,
        }),
        createGiveaway(2, {
          winChance: 1.2,
        }),
        createGiveaway(3, {
          winChance: 2.3,
        }),
        createGiveaway(4, {
          winChance: 2.4,
        }),
        createGiveaway(5, {
          winChance: 100,
        }),
      ],
      expectTruthy: ["giveaway3", "giveaway4", "giveaway5"],
    },
    {
      toString: () => "Pass by ending time",
      settings: {
        steamgifts_ending: 2,
      },
      giveaways: [
        createGiveaway(1, {
          timeLeft: 50,
        }),
        createGiveaway(2, {
          timeLeft: 120,
        }),
        createGiveaway(3, {
          timeLeft: 121,
        }),
        createGiveaway(4, {
          timeLeft: 180,
        }),
      ],
      expectTruthy: ["giveaway1", "giveaway2"],
    },
  ];
  test.each(cases)("%s", async caseData => {
    settings.settings = caseData.settings || {};

    for (const giveaway of caseData.giveaways || commonGiveaways) {
      const truthyCodes = caseData.expectTruthy || [];
      steamgifts.setValue(caseData.currentValue || defaultValue);
      const canEnter = steamgifts.canEnterGiveaway(
        giveaway,
        caseData.wishlistPage || false,
      );
      expect(canEnter).toEqual(truthyCodes.includes(giveaway.code));
    }
  });
});

describe("Winning chance calculation", () => {
  const cases = [
    {
      toString: () => "One copy and one entry",
      copies: 1,
      entries: 1,
      expectChance: 50,
    },
    {
      toString: () => "One copy without entries",
      copies: 1,
      entries: 0,
      expectChance: 100,
    },
    {
      toString: () => "Copies increase chance",
      copies: 2,
      entries: 1,
      expectChance: 100,
    },
    {
      toString: () => "Chance cannot be more than 100",
      copies: 50,
      entries: 0,
      expectChance: 100,
    },
  ];
  test.each(cases)("%s", async caseData => {
    const calculatedChance = steamgifts.calculateWinChance(
      caseData.copies,
      caseData.entries,
    );
    expect(calculatedChance).toEqual(caseData.expectChance);
  });
});

describe("Points Saver logic", () => {
  let settingsInstance;
  let serviceInstance;

  beforeEach(() => {
    settingsInstance = new Settings("settings", {});
    serviceInstance = new SteamGifts(settingsInstance);
    serviceInstance.http = jest.fn();
    serviceInstance.entryInterval = jest.fn().mockResolvedValue(true);
    serviceInstance.isStarted = jest.fn().mockReturnValue(true);
  });

  test("canEnterGiveaway with ignorePoints parameter", () => {
    settingsInstance.settings = {
      steamgifts_points_reserve: 50,
    };
    serviceInstance.setValue(40);

    const giveaway = createGiveaway(1, { cost: 10 });

    // Normal check should fail because points reserve (50) is violated
    expect(serviceInstance.canEnterGiveaway(giveaway, false)).toBe(false);

    // ignorePoints = true should pass
    expect(serviceInstance.canEnterGiveaway(giveaway, true)).toBe(true);
  });

  test("freePoints refunds points by leaving banked giveaways", async () => {
    settingsInstance.settings = {
      steamgifts_banked_giveaways: [
        {
          code: "banked1",
          name: "Banked Game 1",
          cost: 50,
          endTimestamp: 9999999999,
        },
        {
          code: "banked2",
          name: "Banked Game 2",
          cost: 60,
          endTimestamp: 9999999999,
        },
      ],
    };
    serviceInstance.setValue(40);

    // Mock leaveGiveaway HTTP calls returning points
    serviceInstance.http.mockResolvedValueOnce({
      data: { type: "success", points: 90 },
    });

    const success = await serviceInstance.freePoints(80);
    expect(success).toBe(true);
    expect(serviceInstance.currentValue).toBe(90);
    expect(settingsInstance.get("steamgifts_banked_giveaways")).toEqual([
      {
        code: "banked2",
        name: "Banked Game 2",
        cost: 60,
        endTimestamp: 9999999999,
      },
    ]);
  });

  test("bankPoints enters expensive giveaways to save points", async () => {
    settingsInstance.settings = {
      steamgifts_points_saver: true,
      steamgifts_points_saver_min_cost: 50,
      steamgifts_banked_giveaways: [],
    };
    serviceInstance.setValue(390);

    const candidate = createGiveaway(1, {
      cost: 60,
      timeLeft: 100000,
      entered: false,
      levelPass: true,
    });

    serviceInstance.http.mockResolvedValueOnce({
      data: { type: "success", points: 330 },
    });

    await serviceInstance.bankPoints([candidate]);
    expect(serviceInstance.currentValue).toBe(330);
    expect(settingsInstance.get("steamgifts_banked_giveaways")).toHaveLength(1);
    expect(settingsInstance.get("steamgifts_banked_giveaways")[0].code).toBe(
      candidate.code,
    );
  });

  test("canEnterGiveaway respects featured_giveaways checkbox when wishlist_only is true", () => {
    serviceInstance.setValue(300);

    const pinnedGa = createGiveaway(1, {
      cost: 10,
      pinned: true,
      pageType: "featured",
    });
    const wishlistGa = createGiveaway(2, {
      cost: 10,
      pinned: false,
      pageType: "wishlist",
    });
    const regularGa = createGiveaway(3, {
      cost: 10,
      pinned: false,
      pageType: "public",
    });

    // Case 1: featured_giveaways is FALSE -> pinned giveaways are skipped
    settingsInstance.settings = {
      steamgifts_wishlist_only: true,
      steamgifts_featured_giveaways: false,
    };
    expect(serviceInstance.canEnterGiveaway(pinnedGa)).toBe(false);
    expect(serviceInstance.canEnterGiveaway(wishlistGa)).toBe(true);
    expect(serviceInstance.canEnterGiveaway(regularGa)).toBe(false);

    // Case 2: featured_giveaways is TRUE -> pinned giveaways are entered alongside wishlist
    settingsInstance.settings = {
      steamgifts_wishlist_only: true,
      steamgifts_featured_giveaways: true,
    };
    expect(serviceInstance.canEnterGiveaway(pinnedGa)).toBe(true);
    expect(serviceInstance.canEnterGiveaway(wishlistGa)).toBe(true);
    expect(serviceInstance.canEnterGiveaway(regularGa)).toBe(false);
  });

  test("canEnterGiveaway respects featured_giveaways checkbox when wishlist_only is false", () => {
    serviceInstance.setValue(300);

    const pinnedGa = createGiveaway(1, {
      cost: 10,
      pinned: true,
      pageType: "featured",
    });
    const regularGa = createGiveaway(2, {
      cost: 10,
      pinned: false,
      pageType: "public",
    });

    // When featured_giveaways is FALSE -> pinned is skipped, regular is entered
    settingsInstance.settings = {
      steamgifts_wishlist_only: false,
      steamgifts_featured_giveaways: false,
    };
    expect(serviceInstance.canEnterGiveaway(pinnedGa)).toBe(false);
    expect(serviceInstance.canEnterGiveaway(regularGa)).toBe(true);

    // When featured_giveaways is TRUE -> both pinned and regular are entered
    settingsInstance.settings = {
      steamgifts_wishlist_only: false,
      steamgifts_featured_giveaways: true,
    };
    expect(serviceInstance.canEnterGiveaway(pinnedGa)).toBe(true);
    expect(serviceInstance.canEnterGiveaway(regularGa)).toBe(true);
  });
});

const query = require("querystring");
const { parse } = require("node-html-parser");

const authState = require("../auth-state.enum");
const BaseService = require("./base-service");
const translation = require("../../modules/translation");
const settingType = require("./settings/setting-type.enum");

class SteamGifts extends BaseService {
  constructor(settingsStorage) {
    super(settingsStorage, {
      websiteUrl: "https://www.steamgifts.com",
      authPageUrl: "https://www.steamgifts.com/?login",
      winsPageUrl: "https://www.steamgifts.com/giveaways/won",
      authContent: "Account",
    });

    this.settings.points_reserve = {
      type: settingType.INTEGER,
      trans: this.translationKey("points_reserve"),
      min: 0,
      max: 500,
      default: this.getConfig("points_reserve", 0),
    };
    this.settings.ending = {
      type: settingType.INTEGER,
      trans: this.translationKey("ending"),
      min: 0,
      max: 500,
      default: this.getConfig("ending", 0),
    };
    this.settings.min_chance = {
      type: settingType.FLOAT,
      trans: this.translationKey("min_chance"),
      min: 0,
      max: 100,
      default: this.getConfig("min_chance", 0),
    };
    this.settings.min_level = {
      type: settingType.INTEGER,
      trans: this.translationKey("min_level"),
      min: 0,
      max: this.getConfig("max_level", 10),
      default: this.getConfig("min_level", 0),
    };
    this.settings.max_level = {
      type: settingType.INTEGER,
      trans: this.translationKey("max_level"),
      min: this.getConfig("min_level", 0),
      max: 10,
      default: this.getConfig("max_level", 0),
    };
    this.settings.min_cost = {
      type: settingType.INTEGER,
      range: true,
      rangeType: "min",
      rangePart: "max_cost",
      trans: this.translationKey("min_cost"),
      min: 0,
      max: 300,
      default: this.getConfig("min_cost", 0),
    };
    this.settings.max_cost = {
      type: settingType.INTEGER,
      range: true,
      rangeType: "max",
      rangePart: "min_cost",
      trans: this.translationKey("max_cost"),
      min: 0,
      max: 300,
      default: this.getConfig("max_cost", 0),
    };
    this.settings.min_entries = {
      type: settingType.INTEGER,
      trans: this.translationKey("min_entries"),
      min: 0,
      max: 100000,
      default: this.getConfig("min_entries", 0),
    };

    this.settings.sort_by_chance = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("sort_by_chance"),
      default: this.getConfig("sort_by_chance", false),
    };
    this.settings.sort_by_level = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("sort_by_level"),
      default: this.getConfig("sort_by_level", false),
    };
    this.settings.sort_by_copies = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("sort_by_copies"),
      default: this.getConfig("sort_by_copies", false),
    };

    this.settings.whitelist_only = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("whitelist_only"),
      default: this.getConfig("whitelist_only", false),
    };
    this.settings.wishlist_only = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("wishlist_only"),
      default: this.getConfig("wishlist_only", false),
    };
    this.settings.group_only = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("group_only"),
      default: this.getConfig("group_only", false),
    };

    this.settings.whitelist_first = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("whitelist_first"),
      default: this.getConfig("whitelist_first", false),
    };
    this.settings.wishlist_first = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("wishlist_first"),
      default: this.getConfig("wishlist_first", false),
    };
    this.settings.group_first = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("group_first"),
      default: this.getConfig("group_first", false),
    };
    this.settings.multiple_first = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("multiple_first"),
      default: this.getConfig("multiple_first", false),
    };

    this.settings.reserve_on_wish = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("reserve_on_wish"),
      default: this.getConfig("reserve_on_wish", false),
    };
    this.settings.reserve_on_group = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("reserve_on_group"),
      default: this.getConfig("reserve_on_group", false),
    };

    this.settings.ignore_on_wish = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("ignore_on_wish"),
      default: this.getConfig("ignore_on_wish", false),
    };
    this.settings.ignore_on_group = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("ignore_on_group"),
      default: this.getConfig("ignore_on_group", false),
    };

    this.settings.skip_ost = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("skip_ost"),
      default: this.getConfig("skip_ost", false),
    };
    this.settings.skip_dlc = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("skip_dlc"),
      default: this.getConfig("skip_dlc", false),
    };

    this.settings.play_sound = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("play_sound"),
      default: this.getConfig("play_sound", true),
    };
    this.settings.free_ga = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("free_ga"),
      default: this.getConfig("free_ga", false),
    };
  }

  async authCheck() {
    return this.http
      .get(this.websiteUrl, { validateStatus: () => true })
      .then(response => {
        // Check if there is a Cloudflare title or body
        const titleContent = response.data.match(/<title>(.*?)<\/title>/);
        if (titleContent && titleContent[1].includes("Just a moment...")) {
          this.log(
            "Cloudflare Challenge encountered. Please click the Settings gear icon to login/solve CAPTCHA.",
            3,
          );
          return authState.NOT_AUTHORIZED; // Force user to open BrowserWindow to solve JS challenge
        }

        if (response.status === 403) {
          this.log(
            "SteamGifts returned 403 Forbidden. You may need to solve a CAPTCHA by logging in again.",
            3,
          );
          return authState.NOT_AUTHORIZED;
        }

        const document = parse(response.data);
        const userPointNode = document.querySelector(".nav__points");

        return userPointNode ? authState.AUTHORIZED : authState.NOT_AUTHORIZED;
      })
      .catch(ex => {
        this.log(
          `authCheck connection error: ${ex.message || ex.code || "Unknown"}`,
          3,
        );
        if (ex.code === "HPE_INVALID_HEADER_TOKEN") {
          return authState.NOT_AUTHORIZED;
        }

        return ex.status === 200 || (ex.response && ex.response.status === 200)
          ? authState.NOT_AUTHORIZED
          : authState.CONNECTION_REFUSED;
      });
  }

  async getUserInfo() {
    return this.http
      .get("https://www.steamgifts.com/account/settings/profile")
      .then(response => {
        const document = parse(response.data);

        const avatarNode = document.querySelector(".nav__avatar-inner-wrap");
        const usernameNode = document.querySelector(".form__input-small");
        const valueNode = document.querySelector(".nav__points");

        const wonNode = document.querySelector(
          "a[href='/giveaways/won'] .nav__notification",
        );
        const wonCount = wonNode
          ? parseInt(wonNode.structuredText.trim()) || 0
          : 0;

        const savedWonCount = this.getConfig("won_count", 0);
        if (wonCount > savedWonCount) {
          this.setConfig("won_count", wonCount);
          if (savedWonCount > 0) {
            this.events.emit("win", this.name);
            this.log(`${translation.get("service.win")} (${wonCount})`, 1);
          }
        } else if (wonCount < savedWonCount) {
          this.setConfig("won_count", wonCount);
        }

        return {
          avatar: avatarNode
            ? avatarNode.getAttribute("style")?.match(/http.*jpg/)?.[0] || ""
            : "",
          username: usernameNode ? usernameNode.getAttribute("value") : "",
          value: valueNode ? valueNode.structuredText : "0",
        };
      });
  }

  async seekService() {
    await this.enterOnPage(
      "https://www.steamgifts.com/giveaways/search?type=wishlist",
      "wishlist",
    );

    if (this.getConfig("wishlist_only")) {
      return;
    }
    
    await this.entryInterval();

    await this.enterOnPage(
      "https://www.steamgifts.com/giveaways/search?type=group",
      "group",
    );

    if (this.getConfig("group_only")) {
      return;
    }

    let currentPage = 1;
    const processPages = this.getConfig("pages", 1);

    if (processPages > 0) {
      await this.entryInterval();
    }

    while (currentPage <= processPages) {
      await this.enterOnPage(
        `https://www.steamgifts.com/giveaways/search?page=${currentPage}`,
        "public",
      );
      
      if (currentPage < processPages) {
         await this.entryInterval();
      }
      currentPage++;
    }
  }

  async enterOnPage(pageUrl, pageType) {
    const document = await this.http.get(pageUrl).then(res => parse(res.data));

    const xsrfNode = document
      .querySelectorAll("input")
      .filter(node => node.getAttribute("name") === "xsrf_token")[0];
    const xsrfToken = xsrfNode ? xsrfNode.getAttribute("value") : null;

    if (!xsrfToken) {
      this.log("Could not find xsrf_token on the page.", 3); // logSeverity.ERROR is 3
      return;
    }

    let giveaways = this.extractGiveaways(document).map(ga => ({
      ...ga,
      pageType,
    }));

    if (this.getConfig("sort_by_chance", false)) {
      giveaways.sort((a, b) => b.winChance - a.winChance);
    }
    if (this.getConfig("sort_by_level", false)) {
      giveaways.sort((a, b) => b.levelRequired - a.levelRequired);
    }
    if (this.getConfig("sort_by_copies", false)) {
      giveaways.sort((a, b) => b.copies - a.copies);
    }

    if (this.getConfig("multiple_first", false)) {
      const mult = giveaways.filter(it => it.copies > 1);
      const single = giveaways.filter(it => it.copies === 1);
      giveaways = [...mult, ...single];
    }
    if (this.getConfig("whitelist_first", false)) {
      const white = giveaways.filter(it => it.whitelist);
      const other = giveaways.filter(it => !it.whitelist);
      giveaways = [...white, ...other];
    }
    if (this.getConfig("group_first", false)) {
      const groups = giveaways.filter(it => it.pageType === "group");
      const other = giveaways.filter(it => it.pageType !== "group");
      giveaways = [...groups, ...other];
    }
    if (this.getConfig("wishlist_first", false)) {
      const wish = giveaways.filter(it => it.pageType === "wishlist");
      const other = giveaways.filter(it => it.pageType !== "wishlist");
      giveaways = [...wish, ...other];
    }

    for (const giveaway of giveaways) {
      if (!this.isStarted()) {
        return;
      }
      if (!this.canEnterGiveaway(giveaway)) {
        continue;
      }

      const entry = await this.enterGiveaway(giveaway, xsrfToken);

      if (entry.success) {
        this.setValue(entry.points);
        this.log({
          text: `${translation.get(
            "service.entered_in",
          )} #link#. ${this.translate("cost")} ${giveaway.cost
            } ${this.translate("chance")} ${giveaway.winChance}%`,
          anchor: giveaway.name,
          url: `${this.websiteUrl}${giveaway.url}`,
        });
      }
      await this.entryInterval();
    }
  }

  canEnterGiveaway(giveaway, wishlistPage) {
    const minEntryChance = this.getConfig("min_chance", 0);
    const minTimeLeft = this.getConfig("ending", 0) * 60;
    const minEntryLevel = this.getConfig("min_level", 0);
    const maxEntryLevel = this.getConfig("max_level", 0);
    const minCost = this.getConfig("min_cost", 0);
    const maxCost = this.getConfig("max_cost", 0);
    const minEntries = this.getConfig("min_entries", 0);
    const pointsReserve = this.getConfig("points_reserve", 0);
    const reserveExceeded = this.currentValue - giveaway.cost < pointsReserve;

    const isWish = giveaway.pageType === "wishlist";
    const isGroup = giveaway.pageType === "group";
    const isWhite = giveaway.whitelist;

    const ignoreSomeSetting =
      (isWish && this.getConfig("ignore_on_wish")) ||
      (isGroup && this.getConfig("ignore_on_group"));

    if (this.getConfig("whitelist_only") && !isWhite) {
      return false;
    }
    if (this.getConfig("wishlist_only") && !isWish) {
      return false;
    }
    if (this.getConfig("group_only") && !isGroup && !isWhite) {
      return false;
    }

    if (
      this.getConfig("skip_ost") &&
      (giveaway.name.toLowerCase().includes("soundtrack") ||
        giveaway.name.toLowerCase().includes(" - ost"))
    ) {
      return false;
    }
    if (this.getConfig("skip_dlc") && giveaway.isDLC) {
      return false;
    }

    if (
      (minEntryChance !== 0 && minEntryChance > giveaway.winChance) ||
      (minTimeLeft !== 0 && minTimeLeft < giveaway.timeLeft) ||
      giveaway.entered ||
      !giveaway.levelPass ||
      this.currentValue < giveaway.cost ||
      (isWish && giveaway.pinned)
    ) {
      return false;
    }

    if (giveaway.cost === 0 && this.getConfig("free_ga")) {
      return true;
    }

    if (
      !ignoreSomeSetting &&
      ((minCost !== 0 && giveaway.cost < minCost) ||
        (maxCost !== 0 && giveaway.cost > maxCost) ||
        (minEntryLevel !== 0 && minEntryLevel > giveaway.levelRequired) ||
        (maxEntryLevel !== 0 && maxEntryLevel < giveaway.levelRequired) ||
        (minEntries !== 0 && giveaway.entries < minEntries))
    ) {
      return false;
    }

    if (
      reserveExceeded &&
      (!isWish || !this.getConfig("reserve_on_wish")) &&
      (!isGroup || !this.getConfig("reserve_on_group"))
    ) {
      return false;
    }

    return true;
  }

  extractGiveaways(document) {
    const pinnedCodes = document
      .querySelectorAll(
        ".pinned-giveaways__outer-wrap .giveaway__row-outer-wrap",
      )
      .map(htmlNode => this.parseGiveaway(htmlNode).code);

    return document
      .querySelectorAll(".giveaway__row-outer-wrap")
      .map(htmlNode => this.parseGiveaway(htmlNode))
      .map(giveaway => ({
        ...giveaway,
        pinned: pinnedCodes.includes(giveaway.code),
      }));
  }

  parseGiveaway(htmlNode) {
    const currentTime = Math.floor(Date.now() / 1000);
    const infoNodes = htmlNode.querySelectorAll(".giveaway__heading__thin");
    const linkNode = htmlNode.querySelector("a.giveaway__heading__name");
    const levelNode = htmlNode.querySelector(
      ".giveaway__column--contributor-level",
    );

    let copies = 1;
    const url = linkNode.getAttribute("href");
    const entries = Number(
      htmlNode
        .querySelector(".giveaway__links span")
        .structuredText.replace(/[^0-9]/g, ""),
    );
    const timeLeft =
      htmlNode
        .querySelector(".giveaway__columns span")
        .getAttribute("data-timestamp") - currentTime;

    if (infoNodes.length === 2) {
      copies = Number(infoNodes[0].structuredText.replace(/[^0-9]/g, ""));
    }

    const cost = Number(
      infoNodes[infoNodes.length - 1].structuredText.replace(/[^0-9]/g, ""),
    );

    const steamUrl =
      htmlNode.querySelector("a.giveaway__icon")?.getAttribute("href") || "";

    return {
      url,
      cost,
      copies,
      entries,
      timeLeft,
      levelRequired: levelNode
        ? Number(levelNode.structuredText.replace(/[^0-9]/g, ""))
        : 0,
      levelPass: !htmlNode.querySelector(
        ".giveaway__column--contributor-level--negative",
      ),
      name: linkNode.structuredText,
      code: url.split("/")[2],
      entered: !!htmlNode.querySelector(".giveaway__row-inner-wrap.is-faded"),
      winChance: this.calculateWinChance(copies, entries),
      whitelist: !!htmlNode.querySelector(".fa-star"),
      isDLC: steamUrl.includes("app/") && (
        linkNode.structuredText.toLowerCase().includes("dlc") ||
        linkNode.structuredText.toLowerCase().includes("expansion") ||
        linkNode.structuredText.toLowerCase().includes("addon")
      ),
    };
  }

  calculateWinChance(copies, entries) {
    const entriesWillBe = entries + 1;
    const winChance = Number(((copies / entriesWillBe) * 100).toFixed(2));

    return winChance > 100 ? 100 : winChance;
  }

  async enterGiveaway(giveaway, xsrfToken) {
    return this.http({
      url: `${this.websiteUrl}/ajax.php`,
      responseType: "json",
      method: "post",
      data: query.stringify({
        xsrf_token: xsrfToken,
        do: "entry_insert",
        code: giveaway.code,
      }),
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${this.websiteUrl}${giveaway.url}`,
      },
    })
      .then(res => ({
        success: res.data.type === "success",
        points: res.data.points,
      }))
      .catch(() => ({ success: false }));
  }
}

module.exports = SteamGifts;

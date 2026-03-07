const { parse } = require("node-html-parser");

const authState = require("../auth-state.enum");
const BaseService = require("./base-service");
const translation = require("../../modules/translation");
const clearHtmlTags = require("../utils/clear-html-tags");
const settingType = require("./settings/setting-type.enum");

class IndieGala extends BaseService {
  constructor(settingsStorage) {
    super(settingsStorage, {
      websiteUrl: "https://www.indiegala.com",
      authPageUrl: "https://www.indiegala.com/login",
      winsPageUrl: "https://www.indiegala.com/profile",
      requestTimeout: 15000,
    });

    this.settings.sort_by_price = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("sort_by_price"),
      default: this.getConfig("sort_by_price", false),
    };
    this.settings.sort_by_entries = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("sort_by_entries"),
      default: this.getConfig("sort_by_entries", false),
    };
    this.settings.min_entries = {
      type: settingType.INTEGER,
      trans: this.translationKey("min_entries"),
      min: 0,
      max: 10000,
      default: this.getConfig("min_entries", 0),
    };
    this.settings.min_level = {
      type: settingType.INTEGER,
      trans: this.translationKey("min_level"),
      min: 0,
      max: this.getConfig("max_level", 0) || 8,
      default: this.getConfig("min_level", 0),
    };
    this.settings.max_level = {
      type: settingType.INTEGER,
      trans: this.translationKey("max_level"),
      min: Math.max(0, this.getConfig("min_level", 0)),
      max: 8,
      default: this.getConfig("max_level", 0),
    };
    this.settings.min_cost = {
      type: settingType.INTEGER,
      trans: this.translationKey("min_cost"),
      min: 0,
      max: this.getConfig("max_cost", 0) || 240,
      default: this.getConfig("min_cost", 0),
    };
    this.settings.max_cost = {
      type: settingType.INTEGER,
      trans: this.translationKey("max_cost"),
      min: Math.max(0, this.getConfig("min_cost", 0)),
      max: 240,
      default: this.getConfig("max_cost", 0),
    };
    this.settings.points_reserve = {
      type: settingType.INTEGER,
      trans: this.translationKey("points_reserve"),
      min: 0,
      max: 500,
      default: this.getConfig("points_reserve", 0),
    };
    this.settings.play_sound = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("play_sound"),
      default: this.getConfig("play_sound", true),
    };

    // Missing settings from the old fork
    this.settings.sort_by_level = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("sort_by_level"),
      default: this.getConfig("sort_by_level", false),
    };
    this.settings.multi_join = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("multi_join"),
      default: this.getConfig("multi_join", false),
    };
    this.settings.ending_first = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("ending_first"),
      default: this.getConfig("ending_first", false),
    };
    this.settings.reserve_no_multi = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("reserve_no_multi"),
      default: this.getConfig("reserve_no_multi", false),
    };
    this.settings.sbl_ending_ig = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("sbl_ending_ig"),
      default: this.getConfig("sbl_ending_ig", false),
    };
    this.settings.skip_ost = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("skip_ost"),
      default: this.getConfig("skip_ost", false),
    };
    this.settings.reserve_on_sbl = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("reserve_on_sbl"),
      default: this.getConfig("reserve_on_sbl", false),
    };
    this.settings.card_only = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("card_only"),
      default: this.getConfig("card_only", false),
    };
    this.settings.skip_dlc = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("skip_dlc"),
      default: this.getConfig("skip_dlc", false),
    };
    this.settings.reserve_for_smpl = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("reserve_for_smpl"),
      default: this.getConfig("reserve_for_smpl", false),
    };
    this.settings.whitelist_only = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("whitelist_only"),
      default: this.getConfig("whitelist_only", false),
    };
    this.settings.skip_skipdlc = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("skip_skipdlc"),
      default: this.getConfig("skip_skipdlc", false),
    };
    this.settings.skip_trial = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("skip_trial"),
      default: this.getConfig("skip_trial", false),
    };
    this.settings.whitelist_nocards = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("whitelist_nocards"),
      default: this.getConfig("whitelist_nocards", false),
    };
    this.settings.steam_only = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("steam_only"),
      default: this.getConfig("steam_only", false),
    };
    this.settings.view_ga_info = {
      type: settingType.CHECKBOX,
      trans: this.translationKey("view_ga_info"),
      default: this.getConfig("view_ga_info", false),
    };
  }

  async authCheck() {
    return this.http(`${this.websiteUrl}/giveaways`)
      .then(res => {
        const document = parse(res.data);
        const usernameNode = document.querySelector(".username-text");

        return usernameNode ? authState.AUTHORIZED : authState.NOT_AUTHORIZED;
      })
      .catch(ex => {
        if (ex.code === "HPE_INVALID_HEADER_TOKEN") {
          return authState.NOT_AUTHORIZED;
        }

        return ex.status === 200
          ? authState.NOT_AUTHORIZED
          : authState.CONNECTION_REFUSED;
      });
  }

  async getUserInfo() {
    return this.http.get(`${this.websiteUrl}/giveaways`).then(response => {
      const document = parse(response.data);

      return {
        avatar: document.querySelector("figure.avatar img").getAttribute("src"),
        username: document.querySelector(".username-text").structuredText,
        value: document.querySelector("#galasilver-amount").structuredText,
      };
    });
  }

  async seekService() {
    let currentPage = 1;
    const processPages = this.getConfig("pages", 1);
    const userLevel = await this.getUserLevel();

    await this.checkWins();

    do {
      await this.enterOnPage(currentPage, userLevel);
      currentPage++;
    } while (currentPage <= processPages);
  }

  async checkWins() {
    try {
      const response = await this.http.get(
        `${this.websiteUrl}/library/giveaways/giveaways-completed/tocheck`,
      );

      if (response.data && response.data.includes("Check all")) {
        const checkAllResponse = await this.http.post(
          `${this.websiteUrl}/library/giveaways/check-if-winner-all`,
          {},
          {
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              Referer: `${this.websiteUrl}/library`,
            },
          },
        );

        const winData = checkAllResponse.data;
        if (winData && winData.won > 0) {
          if (this.getConfig("play_sound", true)) {
            this.events.emit("win", this.name);
          }
          this.log(`${translation.get("service.win")} (${winData.won})`, "win");
        }
      }
    } catch (ex) {
      // ignore
    }
  }

  async getUserLevel() {
    return this.http
      .get(`${this.websiteUrl}/library/giveaways/user-level-and-coins`, {
        transformResponse: this.jsonResponseTransformer,
      })
      .then(res => {
        return Number(res.data.current_level);
      })
      .catch(() => 0);
  }

  async getCsrfToken() {
    return this.http.get(`${this.websiteUrl}/giveaways`).then(({ data }) => {
      const document = parse(data);
      const tokenInput = document.querySelector(
        "input[name=csrfmiddlewaretoken]",
      );

      return tokenInput.getAttribute("value");
    });
  }

  async enterOnPage(page, userLevel) {
    const csrfToken = await this.getCsrfToken();
    const enteredGiveawayIds = await this.getEnteredGiveawayIds();

    let sortOption = "expiry/asc";
    if (this.getConfig("sort_by_price", false)) {
      sortOption = "price/asc";
    } else if (this.getConfig("sort_by_entries", false)) {
      sortOption = "participants/asc";
    }

    const document = await this.http
      .get(
        `${this.websiteUrl}/giveaways/ajax/${page}/${sortOption}/level/all`,
        {
          transformResponse: this.clearResponse,
        },
      )
      .then(res => parse(res.data.html));

    const minEntries = this.getConfig("min_entries", 0);
    const minCost = this.getConfig("min_cost", 0);
    const maxCost = this.getConfig("max_cost", 0);
    const reserve = this.getConfig("points_reserve", 0);

    const multiJoin = this.getConfig("multi_join", false);
    const skipOst = this.getConfig("skip_ost", false);
    const skipDlc = this.getConfig("skip_dlc", false);
    const reserveNoMulti = this.getConfig("reserve_no_multi", false);

    const giveaways = document
      .querySelectorAll(".items-list-item")
      .map(it => this.parseGiveaway(it, enteredGiveawayIds))
      .filter(it => {
        if (!it.token || it.requiredLevel > userLevel || it.entered) {
          return false;
        }

        if (!it.single && !multiJoin) {
          return false;
        }

        if (minEntries > 0 && it.entries < minEntries) {
          return false;
        }

        if (minCost > 0 && it.price < minCost) {
          return false;
        }

        if (maxCost > 0 && it.price > maxCost) {
          return false;
        }

        let isOst =
          it.name.toLowerCase().includes("soundtrack") ||
          it.name.toLowerCase().includes(" - ost");
        if (
          skipOst &&
          isOst &&
          !it.name.toLowerCase().includes("+ original soundtrack") &&
          !it.name.toLowerCase().includes("+ ost")
        ) {
          return false;
        }

        // Without Steam validation logic, we attempt basic word matching for DLCs/Cards for now since this service lacks the Steam validation integration of SteamGifts
        if (
          skipDlc &&
          (it.name.toLowerCase().includes("dlc") ||
            it.name.toLowerCase().includes("expansion"))
        ) {
          return false;
        }

        // Same for cards, unfortunately IG HTML doesn't explicitly mark trading cards on the giveaway boxes easily without extra requests

        if (reserve > 0 && this.currentValue - it.price < reserve) {
          if (!it.single && reserveNoMulti) {
            // skip checking reserve
          } else {
            return false;
          }
        }

        return true;
      })
      .reduce((distinct, current) => {
        if (distinct.filter(it => it.id === current.id).length === 0) {
          distinct.push(current);
        }
        return distinct;
      }, []);

    for (const giveaway of giveaways) {
      if (!this.isStarted()) {
        return;
      }

      const entry = await this.enterGiveaway(
        giveaway.id,
        giveaway.token,
        csrfToken,
      );

      if (entry.status === "ok") {
        this.log({
          text: `${translation.get("service.entered_in")} #link#`,
          anchor: giveaway.name,
          url: this.websiteUrl + giveaway.url,
        });
        this.setValue(entry.silver_tot);
      }
      await this.entryInterval();
    }
  }

  async getEnteredGiveawayIds() {
    const document = await this.http
      .get(
        `${this.websiteUrl}/library/giveaways/giveaways-in-progress/entries`,
        {
          transformResponse: this.clearResponse,
        },
      )
      .then(res => parse(res.data.html));

    return document
      .querySelectorAll("a:not([href='#'])")
      .map(it => it.getAttribute("href").match(/[0-9]+$/)[0]);
  }

  parseGiveaway(htmlNode, enteredIds) {
    const linkNode = htmlNode.querySelector("h5 a");
    const typeNode = htmlNode.querySelector(".items-list-item-type");
    const actionNode = htmlNode.querySelector("a.items-list-item-ticket-click");
    const price = Number(
      htmlNode
        .querySelector(".items-list-item-data-button a")
        ?.getAttribute("data-price") ?? 0,
    );
    const giveawayId = linkNode.getAttribute("href").match(/\d+/)[0];
    const single = typeNode.structuredText.indexOf("single") === 0;
    const requiredLevel = (() => {
      const levelSpan = typeNode.querySelector("span");
      if (!levelSpan) {
        return 0;
      }
      return Number(levelSpan.structuredText.replace("Lev. ", ""));
    })();
    const entriesNode = htmlNode.querySelector(
      ".items-list-item-data-right-bottom",
    );
    const entries = entriesNode
      ? Number(entriesNode.structuredText.replace(/[^0-9]/g, ""))
      : 0;

    return {
      id: giveawayId,
      url: linkNode.getAttribute("href"),
      name: linkNode.structuredText,
      token: actionNode
        ? actionNode.getAttribute("onclick").match(/[0-9], '(.*)'\)/)[1]
        : null,
      entered: enteredIds.some(it => it === giveawayId),
      price,
      single,
      requiredLevel,
      entries,
    };
  }

  async enterGiveaway(giveawayId, giveawayToken, csrfToken) {
    return this.http({
      transformResponse: this.jsonResponseTransformer,
      url: `${this.websiteUrl}/giveaways/join`,
      data: { id: giveawayId, token: giveawayToken },
      method: "post",
      headers: {
        authority: "www.indiegala.com",
        accept: "application/json, text/javascript, */*; q=0.01",
        origin: this.websiteUrl,
        referer: `${this.websiteUrl}/giveaways/`,
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "x-requested-with": "XMLHttpRequest",
        "x-csrf-token": csrfToken,
        "x-csrftoken": csrfToken,
      },
    })
      .then(res => res.data)
      .catch(() => ({
        status: "error",
      }));
  }

  jsonResponseTransformer(data) {
    return typeof data === "string" ? JSON.parse(data) : data;
  }

  clearResponse(data) {
    const response = clearHtmlTags(data, ["script"]).replace(/\n/g, "\\n");

    return JSON.parse(response);
  }
}

module.exports = IndieGala;

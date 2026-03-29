const { parse } = require("node-html-parser");

const BaseService = require("./base-service");
const translation = require("../../modules/translation");
const runningState = require("../running-state.enum");
const settingType = require("./settings/setting-type.enum");

class OpiumPulses extends BaseService {
  constructor(settingsStorage) {
    super(settingsStorage, {
      websiteUrl: "https://www.opiumpulses.com",
      authPageUrl: "https://www.opiumpulses.com/site/login",
      winsPageUrl: "https://www.opiumpulses.com/user/giveawaykeys",
      authCheckUrl: "https://www.opiumpulses.com/",
      authContent: "/site/logout",
    });

    delete this.settings.pages;


    this.settings.min_cost = {
      type: settingType.INTEGER,
      trans: this.translationKey("min_cost"),
      min: 0,
      max: 9999,
      default: this.getConfig("min_cost", 0),
    };
    this.settings.max_cost = {
      type: settingType.INTEGER,
      trans: this.translationKey("max_cost"),
      min: 0,
      max: 9999,
      default: this.getConfig("max_cost", 0),
    };
    this.settings.points_reserve = {
      type: settingType.INTEGER,
      trans: this.translationKey("points_reserve"),
      min: 0,
      max: 9999,
      default: this.getConfig("points_reserve", 0),
    };
  }

  async getUserInfo() {
    return this.http.get(`${this.websiteUrl}/user/account`).then(response => {
      const document = parse(response.data);

      const avatarNode = document.querySelector("img.img-thumbnail");
      const usernameNode = document.querySelector("#User_username");
      const valueNode = document.querySelector(".points-items li a");

      return {
        avatar: avatarNode ? avatarNode.getAttribute("src") : "",
        username: usernameNode ? usernameNode.getAttribute("value") : "",
        value: valueNode
          ? valueNode.structuredText.replace("Points:", "").trim()
          : "0",
      };
    });
  }

  async seekService() {
    try {
      await this.setGiveawaysFilter();

      const minCost = this.getConfig("min_cost", 0);
      const maxCost = this.getConfig("max_cost", 0);
      const reserve = this.getConfig("points_reserve", 0);

      const response = await this.http.get(`${this.websiteUrl}/giveaways`);
      const document = parse(response.data);
      const items = document.querySelectorAll(".giveaways-page-item");

      this.log(`OpiumPulses: Found ${items.length} giveaways on page`);

      const giveawaysRaw = items
        .map(htmlNode => {
          try {
            return this.parseGiveaway(htmlNode);
          } catch (e) {
            return null;
          }
        })
      const totalParsed = giveawaysRaw.length;
      const unentered = giveawaysRaw.filter(ga => ga && !ga.entered).length;
      const giveaways = giveawaysRaw.filter(ga => {
        if (!ga || ga.entered) {
          return false;
        }

        if (ga.cost === 0) {
          return true;
        }

        const canAfford = this.currentValue - ga.cost >= reserve;
        const costLimitPass =
          (minCost === 0 || ga.cost >= minCost) &&
          (maxCost === 0 || ga.cost <= maxCost);

        return canAfford && costLimitPass;
      });

      this.log(`OpiumPulses: Found ${items.length} giveaways, ${unentered} not entered yet.`);
      if (giveaways.length === 0 && unentered > 0) {
        this.log(`OpiumPulses: No unentered giveaways match your filters (check cost limits and points reserve).`);
      }

      for (const giveaway of giveaways) {
        if (!this.isStarted()) {
          break;
        }

        const entered = await this.enterGiveaway(giveaway);

        if (entered) {
          this.log({
            text: `${translation.get("service.entered_in")} #link#. ${this.translate("cost")}: ${giveaway.cost}`,
            anchor: giveaway.name,
            url: giveaway.url.startsWith("http")
              ? giveaway.url
              : this.websiteUrl + giveaway.url,
          });
        }
        await this.entryInterval();
      }
    } catch (err) {
      this.log(`OpiumPulses error: ${err.message}`, 3);
    }
  }

  async setGiveawaysFilter() {
    return this.http.get(`${this.websiteUrl}/giveaway/filterGiveaways`, {
      params: {
        source: "gf",
        pageSize: 240,
        jointypes: "everyone",
        status: "active",
        ajax: 1,
      },
    });
  }

  parseGiveaway(htmlNode) {
    const enteredNode = htmlNode.querySelector(".entered");
    const entered = !!enteredNode;

    const moreBtn = htmlNode.querySelector(".giveaways-page-item-img-btn-more");
    const url = moreBtn ? moreBtn.getAttribute("href") : "";

    const pointsNode = htmlNode.querySelector(
      ".giveaways-page-item-header-points",
    );
    const costText = pointsNode ? pointsNode.structuredText : "0";
    const cost = Number(costText.replace(/[^0-9]/g, ""));

    const enterBtn = htmlNode.querySelector(".giveaways-page-item-img-btn-enter");
    const onClickAttr = enterBtn ? enterBtn.getAttribute("onClick") : "";
    const checkUser = entered
      ? false
      : (onClickAttr || "").replace(/[^0-9]/g, "");

    const nameNode = htmlNode.querySelector(".giveaways-page-item-footer-name");
    const name = nameNode ? nameNode.structuredText.trim() : "Unknown";

    const code =
      url.indexOf("giveaways/") >= 0
        ? url.split("giveaways/")[1].split("/")[0]
        : url.split("/")[2] || "";

    return {
      name,
      url,
      cost,
      free: cost === 0,
      code,
      entered,
      checkUser,
    };
  }

  async enterGiveaway(giveaway) {
    if (!giveaway.code) {
      return false;
    }

    this.modifyCookie([["checkUser", giveaway.checkUser]]);

    return this.http
      .get(`${this.websiteUrl}/giveaways/enter/${giveaway.code}`)
      .then(async (response) => {
        const { data, status } = response;
        const responseData =
          typeof data === "object" ? JSON.stringify(data) : data || "";

        let success =
          responseData.indexOf("entered this") >= 0 ||
          responseData.indexOf("Successfully entered") >= 0 ||
          responseData.indexOf("success") >= 0 ||
          responseData.indexOf("successfully") >= 0;

        // If response is empty or inconclusive, but status is 200, verify by checking the giveaway page
        if (!success && status === 200 && giveaway.url) {
          const verifyUrl = giveaway.url.startsWith("http")
            ? giveaway.url
            : this.websiteUrl + giveaway.url;

          const verifyResponse = await this.http.get(verifyUrl);
          const verifyDocument = parse(verifyResponse.data || "");
          const infoNode = verifyDocument.querySelector(
            ".giveaways-single-promo-content-info",
          );
          const infoText = infoNode
            ? infoNode.structuredText.toLowerCase()
            : "";

          const hasEnteredText =
            infoText.indexOf("entered") >= 0 || infoText.indexOf("success") >= 0;
          const hasRemoveText = infoText.indexOf("remove") >= 0;
          const isNotEligible = infoText.indexOf("eligible") >= 0;

          if ((hasEnteredText || hasRemoveText) && !isNotEligible) {
            success = true;
          } else if (isNotEligible) {
            this.log(
              `OpiumPulses: Profile requirements not met for ${giveaway.name}`,
            );
          }
        }

        if (!success && responseData.toLowerCase().indexOf("already entered") >= 0) {
          giveaway.entered = true;
          this.log(
            translation.get("service.already_entered") + ` (${giveaway.name})`,
          );
        }

        return success;
      })
      .catch((err) => {
        this.log(`OpiumPulses enter error: ${err.message}`);
        return false;
      });
  }
}

module.exports = OpiumPulses;

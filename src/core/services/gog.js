const BaseService = require("./base-service");
const translation = require("../../modules/translation");

class Gog extends BaseService {
  constructor(settingsStorage, params, session) {
    super(
      settingsStorage,
      Object.assign(
        {
          websiteUrl: "https://www.gog.com",
          authPageUrl: "https://www.gog.com",
          authContent: 'isLoggedIn":true',
          authCheckUrl: "https://embed.gog.com/userData.json",
          withValue: false,
        },
        params,
      ),
      session,
    );

    // Default visit timer for GOG is set to 60 minutes since giveaways are infrequent and last for days.
    this.settings.timer.default = 60;

    delete this.settings.pages;
  }

  async getUserInfo() {
    return this.http
      .get("https://embed.gog.com/userData.json")
      .then(({ data }) => {
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        let avatar = parsed.avatar || "https://www.gog.com/favicon.ico";
        if (avatar.startsWith("//")) {
          avatar = "https:" + avatar;
        }
        return {
          avatar: avatar,
          username: parsed.username || "GOG User",
        };
      });
  }

  async seekService() {
    try {
      this.log("Проверяем раздачи GOG...");
      const response = await this.http.get(
        "https://www.gog.com/giveaway/claim",
      );
      const data = response.data;
      const finalUrl =
        response.request?.res?.responseUrl || response.config?.url || "";

      // GOG claim endpoint redirects to home page if there's no active giveaway or if it's already claimed
      const isHome =
        finalUrl === "https://www.gog.com" ||
        finalUrl === "https://www.gog.com/" ||
        finalUrl.endsWith("/en") ||
        finalUrl.endsWith("/en/");

      if (
        isHome &&
        !data.includes("Already claimed") &&
        !data.includes("success")
      ) {
        this.log("Активных раздач GOG не найдено.");
        return;
      }

      let gameName = "GOG Giveaway";
      if (finalUrl.includes("/game/")) {
        const match = finalUrl.match(/\/game\/([^/?]+)/);
        if (match) {
          gameName = match[1].replace(/_/g, " ").replace(/-/g, " ");
          gameName = gameName.replace(/\b\w/g, c => c.toUpperCase());
        }
      }

      if (
        data.includes("Already claimed") ||
        data.includes("already-claimed") ||
        data.includes("already_claimed")
      ) {
        this.log({
          text: `Уже участвует в GOG раздаче / ${translation.get("service.already_entered")} #link#`,
          anchor: gameName,
          url: finalUrl || "https://www.gog.com",
        });
      } else {
        this.log({
          text: `${translation.get("service.entered_in")} #link#`,
          anchor: gameName,
          url: finalUrl || "https://www.gog.com",
        });
      }
    } catch (err) {
      this.log("Ошибка при проверке раздач GOG: " + err.message);
    }
  }
}

module.exports = Gog;

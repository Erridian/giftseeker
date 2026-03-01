const { parse } = require("node-html-parser");

const authState = require("../auth-state.enum");
const BaseService = require("./base-service");
const translation = require("../../modules/translation");

class ManncoStore extends BaseService {
    constructor(settingsStorage) {
        super(settingsStorage, {
            websiteUrl: "https://mannco.store",
            authPageUrl: "https://mannco.store/login?login=",
            authCheckUrl: "https://mannco.store/",
            authContent: ".btn-steam", // We look for the absence of this button
        });

        delete this.settings.pages;
        delete this.settings.points_reserve;
    }

    async authCheck() {
        return this.http
            .get(this.websiteUrl, { validateStatus: () => true })
            .then(res => {
                const titleContent = res.data.match(/<title>(.*?)<\/title>/);
                const title = titleContent ? titleContent[1] : "No Title";

                if (res.status !== 200) {
                    this.log(`Mannco.store authCheck HTTP ${res.status} [${title}]`, 3);
                    return authState.NOT_AUTHORIZED;
                }

                if (titleContent && titleContent[1].includes("Just a moment...")) {
                    this.log("Cloudflare Challenge encountered. Please login/solve CAPTCHA.", 3);
                    return authState.NOT_AUTHORIZED;
                }

                const hasBtnSteam = res.data.indexOf('class="btn-steam"') >= 0;

                if (hasBtnSteam) {
                    this.log(`Mannco.store auth failing. btnSteam=${hasBtnSteam}`, 3);
                    return authState.NOT_AUTHORIZED;
                }

                return authState.AUTHORIZED;
            })
            .catch(err => {
                this.log(`authCheck connection error: ${err.message || err.code || 'Unknown'}`, 3);
                return err.status === 200 || (err.response && err.response.status === 200)
                    ? authState.NOT_AUTHORIZED
                    : authState.CONNECTION_REFUSED;
            });
    }

    async getUserInfo() {
        return this.http.get(this.websiteUrl).then(response => {
            const document = parse(response.data);

            const avatarNode = document.querySelector(".dropdown-user .user-avatar");
            const avatarUrl = avatarNode ? avatarNode.getAttribute("src") : "";

            const usernameNode = document.querySelector(".dropdown-user .user-name");
            const username = usernameNode ? usernameNode.structuredText.trim() : "Mannco User";

            // If the DOM is blocked or structured differently, try to extract from cookies instead from the response headers
            let cookieAvatar = "";
            let cookieName = "";

            // Look for `steam_personaname` and `steam_avatarfull` in the config cookie string
            const cookieStr = this.getConfig("cookie", "");
            if (cookieStr) {
                const nameMatch = cookieStr.match(/steam_personaname=(.*?)(;|$)/);
                if (nameMatch) cookieName = decodeURIComponent(nameMatch[1]);

                const avatarMatch = cookieStr.match(/steam_avatarfull=(.*?)(;|$)/);
                if (avatarMatch) cookieAvatar = decodeURIComponent(avatarMatch[1]);
            }

            return {
                avatar: cookieAvatar || avatarUrl,
                username: cookieName || username,
                value: "0"
            };
        });
    }

    async seekService() {
        const giveaways = await this.http
            .get(`${this.websiteUrl}/requests/raffle.php?mode=getPublic`, {
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": `${this.websiteUrl}/giveaways`
                }
            })
            .then(({ data }) => {
                const items = typeof data === "string" ? JSON.parse(data) : data;

                if (!Array.isArray(items)) {
                    this.log("Mannco: API did not return an array", 3);
                    return [];
                }

                return items.map(ga => {
                    // When a user joins a giveaway, the JSON usually populates the `descriptionEntered` field
                    // or adds an `entered`/`joined` flag. We will assume a non-empty `descriptionEntered` 
                    // or an explicit boolean flag means they are already joined.
                    const isJoined = ga.entered === true || ga.joined === true ||
                        (typeof ga.descriptionEntered === 'string' && ga.descriptionEntered.trim().length > 0);

                    return {
                        name: ga.name || "Unknown Giveaway",
                        url: ga.url,
                        id: ga.url,
                        isJoined: isJoined
                    };
                }).filter(ga => ga.url != null && !ga.isJoined);
            })
            .catch(err => {
                this.log(`Mannco seekService error: ${err.message}`, 3);
                return [];
            });

        this.log(`Mannco seekService found ${giveaways.length} new giveaways to join.`, 1);

        for (const giveaway of giveaways) {
            if (!this.isStarted()) {
                break;
            }

            await this.entryInterval();

            const entered = await this.enterGiveaway(giveaway);

            if (entered) {
                this.log({
                    text: `${translation.get("service.entered_in")} #link#`,
                    anchor: giveaway.name,
                    url: giveaway.url.startsWith("http") ? giveaway.url : `${this.websiteUrl}/${giveaway.url}`,
                });
            }
        }
    }

    async enterGiveaway(giveaway) {
        if (!giveaway.id) return false;

        const detailsUrl = `${this.websiteUrl}/giveaways/details/${giveaway.id}`;

        try {
            // First, fetch the details page to check if we are already joined
            const detailRes = await this.http.get(detailsUrl);
            const detailHtml = detailRes.data;

            // If the page does not contain "Join Now" or the join function, we assume we can't join it
            // (either we are already joined and it says "Leave", or Cloudflare blocked this specific request)
            if (!detailHtml.toLowerCase().includes("join now") && !detailHtml.toLowerCase().includes("onclick=\"join(")) {
                // We'll log skipping it to be sure
                // this.log(`Skipping ${giveaway.id} - Join button not found on details page.`, 3);
                return false;
            }

            // Only call the Join API if we saw the Join button
            const joinRes = await this.http.get(`${this.websiteUrl}/requests/raffle.php?mode=join&url=${giveaway.id}`, {
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": detailsUrl
                }
            });

            const dataStr = typeof joinRes.data === "string" ? joinRes.data : JSON.stringify(joinRes.data);

            // Check if the response actually indicates success ("ok")
            const success = dataStr.toLowerCase().includes("success") || dataStr.toLowerCase().includes("joined") || dataStr.toLowerCase().includes("true") || dataStr.trim().replace(/"/g, '') === "ok";

            if (!success) {
                // If the server returns "-2", it means we are already entered. We don't need to log this as a failure.
                if (dataStr.trim() !== "-2" && dataStr.trim() !== '"-2"') {
                    this.log(`Mannco Join failed [${giveaway.id}]: HTTP ${joinRes.status} Data: ${dataStr}`, 3);
                }
            }

            return success;
        } catch (err) {
            this.log(`Mannco Join Error [${giveaway.id}]: ${err.message}`, 3);
            return false;
        }
    }
}

module.exports = ManncoStore;

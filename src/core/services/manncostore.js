const { parse } = require("node-html-parser");

const authState = require("../auth-state.enum");
const BaseService = require("./base-service");
const translation = require("../../modules/translation");

class ManncoStore extends BaseService {
    constructor(settingsStorage) {
        super(settingsStorage, {
            websiteUrl: "https://mannco.store",
            authPageUrl: "https://mannco.store/login?login=",
            authContent: ".account-username", // Look for the presence of this class
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

                const hasUserAccount = res.data.indexOf('class="account-username"') >= 0;

                if (!hasUserAccount) {
                    this.log(`Mannco.store auth failing. account-username not found.`, 3);
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

            const avatarNode = document.querySelector(".header__navbar-account .account-avatar") || document.querySelector(".account-avatar");
            const avatarUrl = avatarNode ? avatarNode.getAttribute("src") : "";

            const usernameNode = document.querySelector(".header__navbar-account .account-username") || document.querySelector(".account-username");
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
        // First, fetch the list of giveaway URLs we have already joined
        const joinedIds = await this.http
            .get(`${this.websiteUrl}/requests/raffle.php?mode=getJoined`, {
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": `${this.websiteUrl}/giveaways`
                }
            })
            .then(({ data }) => {
                const text = typeof data === "string" ? data : JSON.stringify(data);
                return text.trim().split(',').filter(id => id.length > 0);
            })
            .catch(() => []);

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
                    // Check if we already joined via the dedicated endpoint or internal flags
                    const isJoined = joinedIds.includes(ga.url) || ga.entered === true || ga.joined === true ||
                        (typeof ga.descriptionEntered === 'string' && ga.descriptionEntered.trim().length > 0);

                    // Clean name from HTML leftovers
                    let name = ga.name || "Unknown Giveaway";
                    name = name
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/=/g, ' ')
                        .replace(/&quot;/g, '"')
                        .replace(/&#039;/g, "'")
                        .replace(/&amp;/g, '&')
                        .replace(/\s+/g, ' ')
                        .trim();

                    return {
                        name: name || "Unknown Giveaway",
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
                    url: giveaway.url.startsWith("http") ? giveaway.url : `${this.websiteUrl}/giveaways/details/${giveaway.url}`,
                });
            }
        }
    }

    async enterGiveaway(giveaway) {
        if (!giveaway.id) return false;

        const detailsUrl = `${this.websiteUrl}/giveaways/details/${giveaway.id}`;

        try {
            // First, fetch the details page to ensure we have a valid session context for this raffle
            const detailRes = await this.http.get(detailsUrl);
            const detailHtml = detailRes.data;

            // Search for current Steam ID on the page to confirm we are logged in from the server perspective
            // In 2.htm it's: let steamid = "76561198112968527";
            const steamIdMatch = detailHtml.match(/let steamid = "(.*?)";/);
            if (!steamIdMatch || steamIdMatch[1] === "") {
                this.log(`Mannco session issue: SteamID not found on giveaway page.`, 3);
                // We'll continue anyway, but this is a red flag.
            }

            // Only call the Join API if we see the Join Now button or function
            if (!detailHtml.includes('join();') && !detailHtml.includes('Join Now')) {
                this.log(`Mannco [${giveaway.name}]: Join button not found (already joined or restricted).`, 1);
                return false;
            }

            const joinRes = await this.http.get(`${this.websiteUrl}/requests/raffle.php?mode=join&url=${giveaway.id}`, {
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": detailsUrl
                }
            });

            const dataStr = (typeof joinRes.data === "string" ? joinRes.data : JSON.stringify(joinRes.data)).trim();

            // Check if the response actually indicates success ("ok")
            const success = dataStr.toLowerCase().includes("ok") || dataStr.toLowerCase().includes("success");

            if (!success) {
                // If it's -1 or -2, we already joined or it's restricted/full
                if (dataStr === "-1" || dataStr === "-2") {
                    return false;
                }
                this.log(`Mannco Join failed [${giveaway.id}]: HTTP ${joinRes.status} Data: ${dataStr}`, 3);
            }

            return success;
        } catch (err) {
            this.log(`Mannco Join Error [${giveaway.id}]: ${err.message}`, 3);
            return false;
        }
    }
}

module.exports = ManncoStore;

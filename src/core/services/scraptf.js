const { parse } = require("node-html-parser");
const BaseService = require("./base-service");
const translation = require("../../modules/translation");
const settingType = require("./settings/setting-type.enum");
const config = require("../../config");

class ScrapTF extends BaseService {
    constructor(settingsStorage) {
        super(settingsStorage, {
            websiteUrl: "https://scrap.tf",
            authPageUrl: "https://scrap.tf/login",
            authContent: "My Auctions",
            withValue: false,
        });

        this.settings.sort_by_end = {
            type: settingType.CHECKBOX,
            trans: this.translationKey("sort_by_end"),
            default: this.getConfig("sort_by_end", false),
        };

        this.csrf = "";
    }

    async authCheck() {
        return this.http
            .get(this.websiteUrl, {
                headers: {
                    "sec-fetch-site": "none",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-user": "?1",
                    "sec-fetch-dest": "document",
                },
            })
            .then(res => {
                const data = res.data || "";
                if (data.indexOf(this.authContent) >= 0) {
                    // Extract CSRF while we're at it
                    this.extractCsrf(data);
                    return 1;
                }
                return 0;
            })
            .catch(() => -1);
    }

    extractCsrf(html) {
        const match = html.match(/ScrapTF\.User\.Hash\s*=\s*["'](.*?)["']/);
        if (match) {
            this.csrf = match[1];
        }
    }

    async getUserInfo() {
        return this.http.get(this.websiteUrl).then(res => {
            const document = parse(res.data);
            const userMenu = document.querySelector(".nav-user");
            const avatarNode = userMenu ? userMenu.querySelector("img") : null;
            const usernameNode = userMenu ? userMenu.querySelector(".nav-user-name") : null;

            return {
                avatar: avatarNode ? avatarNode.getAttribute("src") : "https://scrap.tf/favicon.ico",
                username: usernameNode ? usernameNode.structuredText.trim() : "ScrapTF User",
            };
        });
    }

    async seekService() {
        this.log("ScrapTF: Automated entry is blocked by Cloudflare Turnstile.", 3);
        this.log("В данный момент не получается сделать автоматический вход из-за продвинутой защиты.", 3);
    }

    async getPage(page, lastId) {
        let url = `${this.websiteUrl}/raffles`;
        if (this.getConfig("sort_by_end", false)) {
            url += "/ending";
        }

        let method = "GET";
        let data = null;
        let headers = {
            Referer: this.websiteUrl + "/",
        };

        if (page > 1) {
            url = `${this.websiteUrl}/ajax/raffles/Paginate`;
            method = "POST";
            data = `start=${lastId}&sort=${this.getConfig("sort_by_end", false) ? 1 : 0}&puzzle=0&csrf=${this.csrf}`;
            headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
            headers["X-Requested-With"] = "XMLHttpRequest";
        }

        const response = await this.http({
            method,
            url,
            data,
            headers,
        });

        let html = "";
        let done = false;
        let newLastId = lastId;

        if (page === 1) {
            html = response.data;
            this.extractCsrf(html);

            // Check for wins
            const document = parse(html);
            const winNotice = document.querySelector(".nav-notice a");
            if (winNotice && winNotice.structuredText.includes("You've won")) {
                const winText = winNotice.structuredText.trim();
                this.log(`ScrapTF: ${winText}`, 2);
                this.events.emit("win");
            }
        } else {
            let resData = response.data;
            if (typeof resData === "string") {
                try {
                    resData = JSON.parse(resData);
                } catch (e) {
                    resData = null;
                }
            }

            if (resData && resData.success) {
                html = resData.html;
                newLastId = resData.lastid;
                done = resData.done;
            }
        }

        const document = parse(html);
        const items = document.querySelectorAll(".panel-raffle");
        const giveaways = [];

        for (const item of items) {
            // Robust class checking
            const classList = item.getAttribute("class") || "";
            if (classList.indexOf("raffle-entered") >= 0) continue;

            const nameNode = item.querySelector(".raffle-name a");
            if (!nameNode) continue;

            const name = nameNode.structuredText.trim();
            const urlAttr = nameNode.getAttribute("href");

            // Extract ID safely from URL (e.g., /raffles/ABCDEF or https://scrap.tf/raffles/ABCDEF)
            const idMatch = urlAttr.match(/\/raffles\/([A-Z0-9]+)/i);
            if (!idMatch) {
                this.log(`ScrapTF: Could not extract raffle ID from URL attribute: ${urlAttr}`, 3);
                continue;
            }

            const id = idMatch[1];
            const relUrl = "/raffles/" + id;

            // Get lastId for pagination from the last item of first page
            if (page === 1 && items.indexOf(item) === items.length - 1) {
                newLastId = id;
            }

            giveaways.push({ name, url: relUrl, id });
        }

        return { giveaways, lastId: newLastId, done };
    }

    async enterGiveaway(giveaway) {
        this.log(`ScrapTF: Automated entry for ${giveaway.name} is blocked by Cloudflare Turnstile.`, 3);
        return false;
    }
}

module.exports = ScrapTF;

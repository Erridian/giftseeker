import {
  updatePagePhrases,
  initTranslationSelector,
  getTranslation,
} from "../language.js";
import browser from "../browser.js";
const { ipcRenderer } = require("electron");

const logoutButton = document.querySelector(".logout-button");
const reloadServicesButton = document.getElementById("reload-services-btn");
const headUpdateBtn = document.getElementById("head-update-btn");
const updateModal = document.getElementById("update-modal");
const updateModalDesc = document.getElementById("update-modal-desc");
const updateModalNotes = document.getElementById("update-modal-notes");
const updateModalClose = document.getElementById("update-modal-close");
const updateModalLater = document.getElementById("update-modal-later");
const updateModalDownload = document.getElementById("update-modal-download");

let latestUpdateData = null;
let currentAppBuild = "";

const showUpdateModal = updateInfo => {
  if (!updateModal) return;
  const data = updateInfo || latestUpdateData;
  if (!data) return;

  if (updateModalDesc) {
    updateModalDesc.innerText = getTranslation(
      "ui.update_available_desc",
      data.version || "latest",
      data.currentVersion || currentAppBuild,
    );
  }

  if (updateModalNotes) {
    if (data.notes && data.notes.trim()) {
      updateModalNotes.innerText = data.notes.trim();
      updateModalNotes.style.display = "block";
    } else {
      updateModalNotes.style.display = "none";
    }
  }

  updateModal.style.display = "flex";
};

const hideUpdateModal = () => {
  if (updateModal) {
    updateModal.style.display = "none";
  }
};

if (updateModalClose) updateModalClose.onclick = hideUpdateModal;
if (updateModalLater) updateModalLater.onclick = hideUpdateModal;
if (updateModalDownload) {
  updateModalDownload.onclick = () => {
    hideUpdateModal();
    const targetUrl =
      (latestUpdateData && latestUpdateData.url) ||
      "https://github.com/Erridian/giftseeker/releases/latest";
    browser.openUrl(targetUrl);
  };
}

if (updateModal) {
  updateModal.onclick = e => {
    if (e.target === updateModal) {
      hideUpdateModal();
    }
  };
}

if (headUpdateBtn) {
  headUpdateBtn.onclick = () => {
    showUpdateModal();
  };
}

if (reloadServicesButton) {
  reloadServicesButton.onclick = () => {
    const icon = reloadServicesButton.querySelector(".fa");
    if (icon) icon.classList.add("fa-spin");
    reloadServicesButton.classList.add("disabled");

    ipcRenderer.send("request-services-reload");

    setTimeout(() => {
      if (icon) icon.classList.remove("fa-spin");
      reloadServicesButton.classList.remove("disabled");
    }, 600);
  };
}

const initSettingsSection = initialData => {
  const { currentBuild, translations, settings } = initialData;
  currentAppBuild = currentBuild;

  initTranslationSelector(translations);

  document.querySelector(".build .version").innerText = currentBuild;

  const checkUpdateBtn = document.getElementById("check-update-btn");
  const updateStatusLabel = document.getElementById("update-status-label");

  if (checkUpdateBtn) {
    checkUpdateBtn.onclick = () => {
      checkUpdateBtn.classList.add("disabled");
      if (updateStatusLabel) {
        updateStatusLabel.innerText = getTranslation("ui.update_checking");
      }
      ipcRenderer.send("check-for-updates", { manual: true });
    };
  }

  const userAgentArea = document.querySelector("textarea#useragent");

  userAgentArea.placeholder = initialData.userAgent.default;
  userAgentArea.value = initialData.userAgent.initial;
  userAgentArea.onchange = () => {
    ipcRenderer.send("setting-changed", {
      key: "user_agent",
      value: userAgentArea.value || userAgentArea.placeholder,
    });
  };

  const userDataPathArea = document.querySelector("input#user_data_path");
  userDataPathArea.value = settings.user_data_path || "";
  userDataPathArea.onchange = () => {
    ipcRenderer.send("setting-changed", {
      key: "user_data_path",
      value: userDataPathArea.value.trim(),
    });
  };

  const infoLinks = document.querySelector(".content-item .info-links");

  const erridianLink = document.createElement("button");
  erridianLink.classList.add("open-website");
  erridianLink.dataset.link = "https://erridian.ru";
  erridianLink.innerText = "Erridian.RU";

  const erridianDonationLink = document.createElement("button");
  erridianDonationLink.classList.add("open-website");
  erridianDonationLink.dataset.link =
    "https://www.donationalerts.com/r/erridian";
  erridianDonationLink.dataset.lang = "settings.support_fork";
  erridianDonationLink.style.marginLeft = "7px";

  const telegramLink = document.createElement("button");
  telegramLink.classList.add("open-website");
  telegramLink.dataset.link = "https://t.me/GiftSeeker_Fork_Erridian";
  telegramLink.dataset.lang = "settings.telegram";
  telegramLink.style.marginLeft = "7px";

  const vkLink = document.createElement("button");
  vkLink.classList.add("open-website");
  vkLink.dataset.link = "https://vk.com/club236495182";
  vkLink.dataset.lang = "settings.vk";
  vkLink.style.marginLeft = "7px";

  infoLinks.appendChild(erridianLink);
  infoLinks.appendChild(erridianDonationLink);
  infoLinks.appendChild(telegramLink);
  infoLinks.appendChild(vkLink);

  document
    .querySelectorAll("[data-menu-id=settings] .setter:not(select)")
    .forEach(control => {
      switch (control.getAttribute("type")) {
        case "checkbox":
          control.checked = settings[control.getAttribute("id")] ?? false;
          break;
      }

      control.onchange = () => {
        if (control.getAttribute("type") === "checkbox") {
          ipcRenderer.send("setting-changed", {
            key: control.getAttribute("id"),
            value: control.checked,
          });
        }
      };
    });

  const lightThemeCheckbox = document.querySelector("input#light_theme");
  const systemThemeCheckbox = document.querySelector("input#system_theme");

  const applyTheme = () => {
    const useSystem = systemThemeCheckbox ? systemThemeCheckbox.checked : false;
    const isLight = lightThemeCheckbox ? lightThemeCheckbox.checked : false;

    if (useSystem) {
      if (lightThemeCheckbox) {
        lightThemeCheckbox.disabled = true;
      }
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      if (systemDark) {
        document.body.classList.remove("light-theme");
      } else {
        document.body.classList.add("light-theme");
      }
    } else {
      if (lightThemeCheckbox) {
        lightThemeCheckbox.disabled = false;
      }
      if (isLight) {
        document.body.classList.add("light-theme");
      } else {
        document.body.classList.remove("light-theme");
      }
    }
  };

  if (lightThemeCheckbox) {
    const originalOnChange = lightThemeCheckbox.onchange;
    lightThemeCheckbox.onchange = () => {
      if (originalOnChange) {
        originalOnChange();
      }
      applyTheme();
    };
  }

  if (systemThemeCheckbox) {
    const originalOnChange = systemThemeCheckbox.onchange;
    systemThemeCheckbox.onchange = () => {
      if (originalOnChange) {
        originalOnChange();
      }
      applyTheme();
    };
  }

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", applyTheme);

  applyTheme();

  const loadSponsors = async () => {
    const container = document.getElementById("sponsors-container");
    if (!container) {
      return;
    }

    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/Erridian/giftseeker/master/sponsors.json?t=${Date.now()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }

      const data = await response.json();
      container.innerHTML = "";

      if (!data || !data.top_sponsors || data.top_sponsors.length === 0) {
        const emptyDiv = document.createElement("div");
        emptyDiv.className = "sponsors-empty";
        emptyDiv.dataset.lang = "settings.sponsors_empty";
        container.appendChild(emptyDiv);
      } else {
        data.top_sponsors.forEach(sp => {
          const item = document.createElement("div");
          const tier = sp.badge ? sp.badge.toLowerCase() : "normal";
          item.className = `sponsor-item ${tier}`;

          let icon = "fa-heart";
          if (tier === "gold") {
            icon = "fa-crown";
          } else if (tier === "silver") {
            icon = "fa-star";
          } else if (tier === "bronze") {
            icon = "fa-medal";
          }

          const amountHtml = sp.amount
            ? ` <span class="sponsor-amount">${sp.amount}</span>`
            : "";
          item.innerHTML = `<i class="fas ${icon}"></i> <span>${sp.name}</span>${amountHtml}`;
          container.appendChild(item);
        });
      }
    } catch (err) {
      console.error("Failed to load sponsors list:", err);
      container.innerHTML = "";
      const errorDiv = document.createElement("div");
      errorDiv.className = "sponsors-error";
      errorDiv.dataset.lang = "settings.sponsors_error";
      container.appendChild(errorDiv);
    }
    updatePagePhrases();
  };

  loadSponsors();
};

const initServicesSwitcher = settings => {
  let wideSwitcher = !!settings.wide_services_switcher;
  let windowHeight = window.offsetHeight;
  const expanderHeight = 40;
  const servicesSwitcher = document.querySelector(".services_switcher");
  const servicesIcons = document.querySelector(".services-icons");

  if (wideSwitcher) {
    servicesSwitcher.classList.add("wide");
  }

  document.querySelector(".services_switcher .expander .span-wrap").onclick =
    () => {
      servicesSwitcher.style.transition = "width 0.3s";
      servicesSwitcher.classList.toggle("wide");

      wideSwitcher = servicesSwitcher.classList.contains("wide");

      ipcRenderer.send("setting-changed", {
        key: "wide_services_switcher",
        value: wideSwitcher,
      });
    };

  const servicesSwitcherScroll = scrollStep => {
    let scrollTop = parseInt(servicesIcons.style.top || 0);
    const iconsHeight = servicesIcons.offsetHeight;
    const switcherHeight = servicesSwitcher.offsetHeight;
    const minScroll = switcherHeight - iconsHeight - expanderHeight;

    scrollTop += scrollStep;

    if (scrollTop < minScroll) {
      scrollTop = minScroll;
    }
    if (scrollTop > 0) {
      scrollTop = 0;
    }

    servicesIcons.style.top = `${scrollTop}px`;
  };

  window.onresize = () => {
    const newHeight = window.innerHeight;
    const difference = newHeight - windowHeight || 0;

    if (difference > 0) {
      servicesSwitcherScroll(difference);
    }

    windowHeight = window.innerHeight;
  };

  servicesSwitcher.onmousewheel = ev =>
    servicesSwitcherScroll(ev.wheelDelta > 0 ? 20 : -20);
};

setInterval(() => {
  ipcRenderer.send("check-session-is-alive");
}, 300000);

ipcRenderer.on("window-initial-data", async (event, initialData) => {
  const { accountInfo, translations } = initialData;

  updatePagePhrases(translations.phrases);
  initSettingsSection(initialData);
  initServicesSwitcher(initialData.settings);
});

ipcRenderer.on("translation-changed", async (event, translations) => {
  updatePagePhrases(translations.phrases);
});

logoutButton.onclick = () => {
  logoutButton.classList.add("disabled");

  ipcRenderer.send("user-logout");
};

document.querySelectorAll(".window-action-button").forEach(button => {
  button.onclick = () => {
    ipcRenderer.send("main-window-action", button.dataset.action);
  };
});

document.querySelectorAll(".menu li").forEach(menuItem => {
  menuItem.onclick = () => {
    document
      .querySelectorAll(".menu li, .content-item")
      .forEach(node => node.classList.remove("active"));

    document
      .querySelectorAll(`[data-menu-id=${menuItem.dataset.menuId}]`)
      .forEach(node => node.classList.add("active"));
  };
});

ipcRenderer.on("update-available", (event, info) => {
  latestUpdateData = info;
  if (headUpdateBtn) {
    headUpdateBtn.classList.add("visible");
  }

  const checkUpdateBtn = document.getElementById("check-update-btn");
  const updateStatusLabel = document.getElementById("update-status-label");

  if (checkUpdateBtn) {
    checkUpdateBtn.classList.remove("disabled");
  }

  if (updateStatusLabel) {
    updateStatusLabel.innerText = `${getTranslation("ui.update_available_title")} (${info.version})`;
    updateStatusLabel.style.color = "#a78bfa";
  }

  showUpdateModal(info);
});

ipcRenderer.on("update-check-result", (event, result) => {
  const checkUpdateBtn = document.getElementById("check-update-btn");
  const updateStatusLabel = document.getElementById("update-status-label");

  if (checkUpdateBtn) {
    checkUpdateBtn.classList.remove("disabled");
  }

  if (updateStatusLabel) {
    if (result.isLatest) {
      updateStatusLabel.innerText = getTranslation("ui.update_latest");
      updateStatusLabel.style.color = "#10b981";
    } else if (result.error) {
      updateStatusLabel.innerText = getTranslation("ui.update_error");
      updateStatusLabel.style.color = "#ef4444";
    }
  }
});

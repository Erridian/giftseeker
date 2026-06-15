# Dropushko (Дропушек)

*(English | [Русский](README.ru.md))*

> An automated assistant application designed to automatically participate in public game giveaways and loot draws on various gaming websites.
> The program is developed using Node.js, featuring an ultra-premium visual desktop interface built with Electron.

This project is a heavily redesigned, rebranded, and modernized fork of the original **GiftSeeker** application (originally created by Alexander Pinashin / CodeSprut).

---

## 🎮 Supported Websites

- **gog.com** (Free GOG giveaway claimer integration!)
- **steamgifts.com** (Featuring global chance-based sorting and page limit limits)
- **indiegala.com** (Auto-roulette coins spin & customizable cost/level filters)
- **opiumpulses.com** (Custom points filters and page limits)
- **mannco.store** (Auto-join loops with stop-on-error features)

---

## 📦 Installation & Download

You can find pre-built binaries (both the standard Windows **Installer** `.exe` and the 100% self-contained **Portable** build) inside the Releases section:
🔗 [Dropushko Releases](https://github.com/Erridian/giftseeker/releases)

---

## 🛠️ For Developers (Running from Source)

To run the application from source code, make sure you have the following prerequisites installed:
- [Node.js](https://nodejs.org/) version **>= 14.15.3**
- [Git](https://git-scm.com/install/windows) client for cloning

### Step-by-Step Launch:

1. Clone the project repository:
   ```shell
   git clone https://github.com/Erridian/giftseeker.git
   ```
2. Navigate into the project folder:
   ```shell
   cd giftseeker
   ```
3. Install project dependencies:
   ```shell
   npm install
   ```
4. Start the application:
   - For the graphic **Desktop UI**:
     ```shell
     npm run start:ui
     ```
   - For the lightweight background **CLI daemon**:
     ```shell
     npm run start:cli
     ```

---

## 🏗️ Packaging & Compilation

We use [electron-builder](https://github.com/electron-userland/electron-builder) under the hood to compile and bundle the project into release-ready binaries.

Use the following NPM scripts to compile the application:

- **Build standard Windows Installer (.exe):**
  ```shell
  npm run dist:win
  ```
- **Build truly self-contained Portable Version (single-file):**
  ```shell
  npm run dist:portable
  ```

---

## 💜 Support, News & Contacts

Stay up to date with new releases, features, and fork updates:
- 📢 **Telegram (News & Releases):** [Dropushko/GiftSeeker Fork by Erridian](https://t.me/GiftSeeker_Fork_Erridian)
- 💬 **VK Group:** [VK: GiftSeeker_Fork_Erridian](https://vk.com/club236495182)  
- ☕ **Financial Support (DonationAlerts):** [Support Erridian](https://www.donationalerts.com/r/erridian)

---

## 📜 Credits & License

- Original application core, engine concepts, and early designs by Alexander Pinashin ([CodeSprut](https://github.com/codesprut)).
- Rebranding, UI visual modernization, GOG claimer, isolated portable storage caching, and logic overhaul by [Erridian](https://github.com/Erridian).

This project is licensed under the **MIT License**.

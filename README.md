# GiftSeeker

*(English | [Русский](README.ru.md))*

> App for automatically participating in raffles on different websites.  
> Program developed as a Node.js application. Electron is used for the UI only.

## Supported websites

- steamgifts.com
- indiegala.com
- opiumpulses.com
- mannco.store



## Setup

You can find the ready-to-use Installer and Portable builds in Releases:
https://github.com/Erridian/giftseeker/releases

## Quick start

You will need to download [Node.js](https://nodejs.org/) **>= 14.15.3**.
To download the repository via console, you must have [Git](https://git-scm.com/install/windows) installed.

1. `git clone https://github.com/Erridian/giftseeker.git`
2. `cd giftseeker`
3. `npm install`
4. `npm run start:ui` or `npm run start:cli`

Now you have a running `desktop` or `cli` application on your screen.

## Build

We use the [electron-builder](https://github.com/electron-userland/electron-builder) module to build the application.

**Use the following commands to build the app:**

- Build standard Windows Installer (.exe):
```shell
npm run dist:win
```
- Build single-file Portable Executable:
```shell
npm run dist:portable
```

## Structure of the project

The application is located in the `src` directory, which consists of the following main folders:
- `core` - Node.js modules with main app features.
- `modules` - Useful independent utilities like the storage module.
- `electron` - The UI layer using Electron.
- `console` - CLI program implementation.
- `resources` - Contains common static files.

## Support & Feedback

For updates regarding this Fork, follow the Telegram channel:
[Telegram: GiftSeeker_Fork_Erridian](https://t.me/GiftSeeker_Fork_Erridian)

VK: https://vk.com/erridian
DonationAlerts: https://www.donationalerts.com/r/erridian

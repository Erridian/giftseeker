# GiftSeeker

*([English](README.md) | Русский)*

> Приложение для автоматического участия в розыгрышах игр на различных сайтах.  
> Программа разработана на Node.js. Интерфейс построен на базе Electron.

## Поддерживаемые сайты

- steamgifts.com
- indiegala.com
- opiumpulses.com
- mannco.store

## Установка

Вы можете найти готовый Установщик (.exe) и Portable-версию в разделе Releases:
https://github.com/Erridian/giftseeker/releases

## Для разработчиков (Запуск исходного кода)

Вам потребуется скачать [Node.js](https://nodejs.org/) версии **>= 14.15.3**.
Для скачивания приложения через консоль должен быть установлен [Git](https://git-scm.com/install/windows).

1. `git clone https://github.com/Erridian/giftseeker.git`
2. `cd giftseeker`
3. `npm install`
4. `npm run start:ui` или `npm run start:cli`

После этого перед вами откроется десктопная или консольная версия.

## Компиляция (.exe)

Для сборки проекта в исполняемые установщики используется пакет [electron-builder](https://github.com/electron-userland/electron-builder).

**Используйте следующие команды:**

- Сборка стандартного Windows Установщика:
```shell
npm run dist:win
```
- Сборка Portable-приложения одним файлом (без установки):
```shell
npm run dist:portable
```

## Поддержка и Новости проекта

Следить за новыми версиями и обновлениями форка можно в Telegram-канале:
[Telegram: GiftSeeker_Fork_Erridian](https://t.me/GiftSeeker_Fork_Erridian)

Связь со мной (ВК): https://vk.com/erridian  
Поддержать финансово (DonationAlerts): https://www.donationalerts.com/r/erridian

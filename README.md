## GiftSeeker

> App for automatically participate in raffles on different websites.  
> Program developed like a Node.js application. Electron used for UI only.

##### Supported websites

- steamgifts.com
- indiegala.com
- opiumpulses.com
- **mannco.store**

### 🛡 Обновление 2.2.6 (Erridian Fork)
В этой версии приложения (`2.2.6 By Erridian`) добавлены новые интеграции и глобальные исправления:

- Добавлен новый стабильный сервис **Mannco.store**. Бот поддерживает обход Cloudflare через графическое окно авторизации Steam. Реализован парсинг закрытого JSON API (без загрузки интерфейса) и умный фильтр для игнорирования уже завершенных или активных раздач.
- Устранены ошибки отображения `Disconnected` в сервисе **OpiumPulses**, связанные с потерей кастомных заголовков при редиректах.
- Исправлены падения приложения в **IndieGala** при отсутствии кнопок участия.
- Исправлены проблемы соединения и бесконечные циклы проверки авторизации в **SteamGifts**.
- Восстановлена базовая работоспособность сервиса **Astats**.

Для работы со SteamGifts внутренний сетевой слой (`src/core/services/base-service.js`) переписан: маршрутизация выполняется через нативный API `electron.net`. За счет этого Cloudflare распознает запросы как исходящие из настоящего браузера.

## Информация для новичков

1. Скачиваем программы [Node.js](https://nodejs.org/) и [Git](https://git-scm.com/install/windows) и устанавливаем (желательно со всеми галочками):
https://nodejs.org/en/download
https://git-scm.com/install/windows
2. Перезапускаем компьютер.
3. Запускаем Командную строку (желательно От имени администратора), если не знаете как это сделать - загуглите.
4. Вводим по очереди команды:
`git clone https://github.com/Erridian/giftseeker.git`
`cd giftseeker`
`npm install`
5. Проверяем получилась ли у нас рабочая программа. Вводим команду:
`npm run start:ui`
6. Если все работает как надо, то вводим команду:
`npm run dist:win`
7. Теперь у вас в папке c:\Users\User\giftseeker\dist\ (по-умолчанию) находится рабочая программа. Можете переместить её куда вам удобно или оставить как есть.
8. По желанию папку c:\Users\User\giftseeker\node_modules можно удалить, она все равно уже не нужна, а занимает много места.
9. В случае если что-то пошло не так - сделайте скриншот ошибки и свяжитесь с разработчиком:
https://vk.com/erridian


## Setup

Я не сделал установочник

## Quick start

Для начала нужно скачать [Node.js](https://nodejs.org/) **>= 14.15.3**.
Так же для того чтобы скачать через консоль данный репозитаорий, у вас должен быть установлен [Git](https://git-scm.com/install/windows)

1. `git clone https://github.com/Erridian/giftseeker.git`
2. `cd giftseeker`
3. `npm install`
4. `npm run start:ui` or `npm run start:cli`

Now you have a running `desktop` or `cli` application on your screen.

## Structure of the project

The application located in the `src` directory which consists of the following main folders:

- `core` - node.js modules with main app features.
- `modules` - useful independent modules. For example, a storage module.
- `electron` - serves as the app UI using the APIs provided by app modules.
- `console` - cli program implementation.
- `resources` - contains common static files.

## Testing

Run all tests:

```shell
npm run test
```

## Build

We use [electron-builder](https://github.com/electron-userland/electron-builder) module to build our application.

**Use follow commands to build the app:**

Package in a distributable format (e.g. dmg, Windows installer, deb package)

```shell
npm run dist:mac
npm run dist:win
npm run dist:linux
```

The build process compiles the content of the `src` and `node_modules` directories.

## Feedback

Any questions or suggestions?

Here's a list of different ways to me and request help:

- Report bugs and submit feature requests to [GitHub issues](https://github.com/codesprut/giftSeeker/issues)
- And do not forget to join our [Discord server](https://discord.gg/SKYr8z5)!

## Support - help us to grow ;)

- Star ☆ this project repository
- Join our communities on [vk.com](https://vk.com/giftseeker_ru) and [steamcommunity.com](https://steamcommunity.com/groups/GiftSeeker)

## Contributing

Contributions are always welcome!

By participating in this project you agree to abide by [contributor code of conduct](code-of-conduct.md) terms.

## License

MIT ©

const storage = require("./json-storage");
const https = require("https");
const axios = require("axios");

const settingsKey = "translation";
const axiosConfig = {
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
};

let settings;
let translations = {};

const downloadTranslation = async filename => {
  return axios
    .get(`/trans/${filename}`, axiosConfig)
    .then(({ data }) => storage.saveFile(filename, data));
};

const updateTranslations = async () => {
  const translations = await axios
    .get(`/api/translations`, axiosConfig)
    .then(res => res.data.translations)
    .catch(() => false);

  if (!translations) {
    return;
  }

  return Promise.allSettled(translations.map(it => updateTranslation(it)));
};

const updateTranslation = async translation => {
  const { name, contentLength } = translation;

  if (!storage.filesExists(name)) {
    return downloadTranslation(name);
  }

  const fileContent = await storage.loadFile(name);
  const localContentLength = JSON.stringify(fileContent).length;

  if (localContentLength !== contentLength) {
    return downloadTranslation(name);
  }
};

const loadTranslations = async () => {
  const translationsList = [];
  const storageFiles = await storage.filesList();

  for (const filename of storageFiles) {
    if (filename.indexOf("locale.") >= 0) {
      translationsList.push(filename.replace(".json", ""));
    }
  }

  if (!translationsList.length) {
    throw new Error(`No translations found on storage`);
  }

  const loadedTranslations = await storage.loadMany(translationsList);

  return Object.fromEntries(
    loadedTranslations.map(translation => {
      // Inject our custom translations locally since we can't control the remote API
      if (!translation.settings) translation.settings = {};
      if (!translation.service) translation.service = {};
      if (!translation.service.steamgifts) translation.service.steamgifts = {};
      if (!translation.service.indiegala) translation.service.indiegala = {};
      const sg = translation.service.steamgifts;
      const ig = translation.service.indiegala;

      if (translation.lang && translation.lang.culture === 'ru_RU') {
        translation.settings.user_data_path = 'Папка кэша (сохранится после перезапуска)';
        translation.settings.support_fork = '❤️ Поддержать форк';
        translation.settings.telegram = 'Телеграм (Новости)';
        translation.settings.vk = 'ВКонтакте (Группа)';
        translation.settings.autoswitch = 'Авто-переключение сервисов';
        translation.settings.autoscroll = 'Авто-прокрутка логов';
        translation.settings.steam_local = 'Локальные данные Steam';
        translation.settings.dlc_local = 'Локальные данные DLC';
        translation.settings.skipdlc_local = 'Локальные данные пропуска DLC';
        translation.settings.card_local = 'Локальные данные карточек';
        translation.settings.trial_local = 'Локальные данные Trial';
        sg.whitelist_only = 'Только Белый список';
        sg.whitelist_first = 'Вначале Белый список';
        sg.wishlist_first = 'Вначале страница желаемого';
        sg.group_only = 'Только страница групп';
        sg.group_first = 'Вначале страница групп';
        sg.card_only = 'Только с карточками';
        sg.card_first = 'Вначале с карточками';
        sg.multiple_first = 'Вначале с числом копий';
        sg.sort_by_copies = 'Сортировать по чилу копий';
        sg.sort_by_level = 'Сортировать по уровню';
        sg.skip_ost = 'Не вступать в Soundtrack';
        sg.skip_dlc = 'Не вступать в DLC';
        sg.free_ga = 'Вступать в бесплатные раздачи';
        sg.reserve_on_group = 'Резерв для страницы групп';
        sg.ignore_on_group = 'Игнорировать страницу групп';

        if (!translation.service.scraptf) translation.service.scraptf = {};
        const st = translation.service.scraptf;
        st.sort_by_end = 'Сортировать по дате окончания';
        st.min_entries = 'Мин. участников';
        sg.min_entries = 'Мин. Участников';
        sg.max_level = 'Макс. Уровень';

        ig.sort_by_price = 'Сортировка по цене';
        ig.sort_by_entries = 'Сортировка по участникам';
        ig.min_entries = 'Мин. Участников';
        ig.min_level = 'Мин. Уровень';
        ig.max_level = 'Макс. Уровень';
        ig.min_cost = 'Мин. Стоимость';
        ig.max_cost = 'Макс. Стоимость';
        ig.points_reserve = 'Резерв очков';
        ig.play_sound = 'Звуковые уведомления';
        ig.sort_by_level = 'Сортировать по уровню';
        ig.multi_join = 'Вступать многократно';
        ig.ending_first = 'Сначала завершающиеся';
        ig.reserve_no_multi = 'Игнорировать резерв (без многократных)';
        ig.sbl_ending_ig = 'Игнорировать завершающиеся (при сортировке по уровню)';
        ig.skip_ost = 'Пропускать Soundtrack';
        ig.reserve_on_sbl = 'Учитывать резерв (при сортировке по уровню)';
        ig.card_only = 'Только с карточками';
        ig.skip_dlc = 'Пропускать DLC';
        ig.reserve_for_smpl = 'Игнорировать резерв (при сортировке по уровню)';
        ig.whitelist_only = 'Только белый список';
        ig.skip_skipdlc = 'Игнорировать пропуск DLC без игры';
        ig.skip_trial = 'Пропускать Trial';
        ig.whitelist_nocards = 'Игнорировать карточки в белом списке';
        ig.steam_only = 'Только для Steam';
        ig.view_ga_info = 'Показывать информацию';

        const op = translation.service.opiumpulses;
        if (!translation.service.opiumpulses) translation.service.opiumpulses = {};
        translation.service.opiumpulses.on_start_reminder = '';
        translation.service.opiumpulses.cost = 'Стоимость';
        translation.service.opiumpulses.min_cost = 'Мин. Стоимость';
        translation.service.opiumpulses.max_cost = 'Макс. Стоимость';
        translation.service.opiumpulses.points_reserve = 'Резерв очков';
        translation.service.already_entered = 'Уже участвует';
        translation.service.entered_in = 'Вступил в';

        sg.whitelist_only_title = 'Вступать только в раздачи из вашего белого списка';
        sg.whitelist_first_title = 'Вступать сначала в раздачи из белого списка';
        sg.wishlist_first_title = 'Вступать сначала в раздачи из списка желаемого';
        sg.group_only_title = 'Вступать только в групповые раздачи';
        sg.group_first_title = 'Вступать сначала в групповые раздачи';
        sg.card_only_title = 'Вступать только в раздачи игр с карточками';
        sg.card_first_title = 'Вступать сначала в раздачи игр с карточками';
        sg.multiple_first_title = 'Вступать сначала в раздачи с количеством копий больше одной';
        sg.sort_by_copies_title = 'Сначала вступать в раздачи с наибольшим числом копий';
        sg.sort_by_level_title = 'Сначала вступать в раздачи с наибольшим требуемым уровнем';
        sg.skip_ost_title = 'Не вступать в раздачи саундтреков';
        sg.skip_dlc_title = 'Не вступать в раздачи дополнений';
        sg.play_sound_title = 'Воспроизводить звук при победе';
        sg.free_ga_title = 'Вступать в раздачи со стоимостью 0 очков';
        sg.reserve_on_group_title = 'Использовать резерв очков для групповых раздач';
        sg.ignore_on_group_title = 'Не учитывать настройки уровня и стоимости для групповых раздач';
        sg.min_entries_title = 'Минимальное количество участников для входа в раздачу';
        sg.max_level_title = 'Максимально допустимый требуемый уровень раздачи';
      } else {
        translation.settings.user_data_path = 'Custom User Data Path (Requires Restart)';
        translation.settings.support_fork = '❤️ Support Fork';
        translation.settings.telegram = 'Telegram (News)';
        translation.settings.vk = 'VK (Group)';
        translation.settings.autoswitch = 'Auto switch services';
        translation.settings.autoscroll = 'Auto scroll logs';
        translation.settings.steam_local = 'Local Steam data';
        translation.settings.dlc_local = 'Local DLC data';
        translation.settings.skipdlc_local = 'Local Skip DLC data';
        translation.settings.card_local = 'Local Card data';
        translation.settings.trial_local = 'Local Trial data';
        sg.whitelist_only = 'Whitelist only';
        sg.whitelist_first = 'Whitelist first';
        sg.wishlist_first = 'Wishlist first';
        sg.group_only = 'Groups only';
        sg.group_first = 'Groups first';
        sg.card_only = 'Cards only';
        sg.card_first = 'Cards first';
        sg.multiple_first = 'Multiple copies first';
        sg.sort_by_copies = 'Sort by copies';
        sg.sort_by_level = 'Sort by level';
        sg.skip_ost = 'Skip Soundtracks';
        sg.skip_dlc = 'Skip DLCs';
        sg.free_ga = 'Enter free giveaways';
        sg.reserve_on_group = 'Points reserve for groups';
        sg.ignore_on_group = 'Ignore Group page';
        sg.min_entries = 'Min. Entries';
        sg.max_level = 'Max. Level';

        ig.sort_by_price = 'Sort by price';
        ig.sort_by_entries = 'Sort by entries';
        ig.min_entries = 'Min. Entries';
        ig.min_level = 'Min. Level';
        ig.max_level = 'Max. Level';
        ig.min_cost = 'Min. Cost';
        ig.max_cost = 'Max. Cost';
        ig.points_reserve = 'Points Reserve';
        ig.play_sound = 'Play sound on win';
        ig.sort_by_level = 'Sort by level';
        ig.multi_join = 'Multi-join';
        ig.ending_first = 'Ending first';
        ig.reserve_no_multi = 'Ignore reserve (without multi-join)';
        ig.sbl_ending_ig = 'Ignore ending (with sort by level)';
        ig.skip_ost = 'Skip Soundtracks';
        ig.reserve_on_sbl = 'Respect reserve (with sort by level)';
        ig.card_only = 'Cards only';
        ig.skip_dlc = 'Skip DLCs';
        ig.reserve_for_smpl = 'Ignore reserve (with sort by level)';
        ig.whitelist_only = 'Whitelist only';
        ig.skip_skipdlc = 'Ignore skip DLC without base game';
        ig.skip_trial = 'Skip Trial';
        ig.whitelist_nocards = 'Ignore card setting for Whitelist';
        ig.steam_only = 'Steam only';
        ig.view_ga_info = 'View GA info';

        const op_en = translation.service.opiumpulses;
        if (!translation.service.opiumpulses) translation.service.opiumpulses = {};
        translation.service.opiumpulses.on_start_reminder = '';
        translation.service.opiumpulses.cost = 'Cost';
        translation.service.opiumpulses.min_cost = 'Min. Cost';
        translation.service.opiumpulses.max_cost = 'Max. Cost';
        translation.service.opiumpulses.points_reserve = 'Points Reserve';
        translation.service.already_entered = 'Already entered';
        translation.service.entered_in = 'Entered in';

        if (!translation.service.scraptf) translation.service.scraptf = {};
        const st_en = translation.service.scraptf;
        st_en.sort_by_end = 'Sort by end date';
        st_en.min_entries = 'Min. Entries';

        sg.whitelist_only_title = 'Enter only giveaways from your Whitelist';
        sg.whitelist_first_title = 'Enter Whitelist giveaways first';
        sg.wishlist_first_title = 'Enter Wishlist giveaways first';
        sg.group_only_title = 'Enter only Group giveaways';
        sg.group_first_title = 'Enter Group giveaways first';
        sg.card_only_title = 'Enter only giveaways with cards';
        sg.card_first_title = 'Enter giveaways with cards first';
        sg.multiple_first_title = 'Enter giveaways with multiple copies first';
        sg.sort_by_copies_title = 'Sort by copies count';
        sg.sort_by_level_title = 'Sort by level required';
        sg.skip_ost_title = 'Do not enter soundtracks';
        sg.skip_dlc_title = 'Do not enter DLCs';
        sg.play_sound_title = 'Play sound notification on win';
        sg.free_ga_title = 'Enter giveaways with cost 0';
        sg.reserve_on_group_title = 'Use points reserve for group giveaways';
        sg.ignore_on_group_title = 'Ignore level and cost limits for group giveaways';
        sg.min_entries_title = 'Minimum participants required to enter';
        sg.max_level_title = 'Maximum level required to enter';
      }

      return [
        translation.lang.culture,
        translation,
      ];
    }),
  );
};

const init = async (settingsInstance, downloadHost) => {
  settings = settingsInstance;
  axiosConfig.baseURL = downloadHost;

  await updateTranslations();
  translations = await loadTranslations();

  let selectedTranslation = current();

  if (!translations[selectedTranslation]) {
    selectedTranslation = Object.keys(translations)[0];
    settings.set(settingsKey, selectedTranslation);
  }
};

/**
 *
 * @param translationKey of translation string
 * @param replacers for substitute values into message
 * @returns {string}
 */
const get = (translationKey, ...replacers) => {
  const keysTree = `${current()}.${translationKey}`.split(".");

  const translation = keysTree.reduce(
    (searchLevel, key) => (searchLevel ? searchLevel[key] : undefined),
    translations,
  );

  if (!translation) {
    return translationKey;
  }

  return replacers.reduce(
    (message, value, index) => message.replace(`{${index}}`, value),
    translation,
  );
};

const change = newTranslation => {
  if (!translations[newTranslation]) {
    return;
  }

  settings.set(settingsKey, newTranslation);
};

/**
 *
 * @returns {string} current translation name
 */
const current = () => {
  return settings.get(settingsKey);
};

/**
 *
 * @returns {Object} current translation phrases tree
 */
const currentPhrases = () => {
  return translations[current()];
};

const listAvailable = () => {
  const list = [];
  for (const translation of Object.keys(translations)) {
    const { culture, name } = translations[translation].lang;
    list.push({ culture, name });
  }

  return list;
};

module.exports = {
  get,
  init,
  change,
  current,
  listAvailable,
  currentPhrases,
};

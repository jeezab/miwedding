# Милый свадебный лендинг

## Быстрый старт
Откройте `index.html` в браузере или запустите локальный сервер.

## Настройка контента
Все ключевые данные находятся в `scripts/config.js`.

- `coupleNames` — имена пары
- `eventDateISO` — дата свадьбы в формате `YYYY-MM-DD`
- `eventTime` — время в формате `HH:MM`
- `locationMapEmbedUrl` — ссылка на iframe карты (Яндекс/2ГИС)
- `rsvpEndpoint` — URL Google Apps Script Web App

## Подключение RSVP в Google Sheets
1. Создайте Google Sheet.
2. В Google Apps Script опубликуйте Web App.
3. Скопируйте URL Web App и вставьте в `rsvpEndpoint`.
4. Убедитесь, что скрипт возвращает JSON `{"ok": true}`.

## Замена фото
Плейсхолдеры находятся в `assets/photos/`.
Замените их своими изображениями и обновите пути в `index.html`.

## Деплой на GitHub Pages
1. Загрузите проект в репозиторий на GitHub.
2. В `Settings` -> `Pages` выберите источник `main` и root.
3. Сайт станет доступен по адресу GitHub Pages.
